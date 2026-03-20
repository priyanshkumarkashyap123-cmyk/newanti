/**
 * WebSocket Connection Manager
 * Industry-standard real-time communication layer
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Connection state management
 * - Message queuing during disconnection
 * - Heartbeat/ping-pong
 * - Type-safe message handling
 * - Event subscription system
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ConnectionState = 
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

export interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: number;
  id?: string;
}

export interface WebSocketConfig {
  url: string;
  protocols?: string | string[];
  reconnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  maxReconnectInterval?: number;
  heartbeatInterval?: number;
  heartbeatMessage?: string;
  messageQueueSize?: number;
  debug?: boolean;
}

type MessageHandler<T = unknown> = (message: WebSocketMessage<T>) => void;
type StateHandler = (state: ConnectionState) => void;
type ErrorHandler = (error: Event | Error) => void;

// ============================================================================
// WebSocket Manager Class
// ============================================================================

export class WebSocketManager {
  private socket: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private state: ConnectionState = 'disconnected';
  private reconnectCount = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private stateHandlers: Set<StateHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private lastPong = Date.now();

  constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      protocols: config.protocols ?? [],
      reconnect: config.reconnect ?? true,
      reconnectAttempts: config.reconnectAttempts ?? 10,
      reconnectInterval: config.reconnectInterval ?? 1000,
      maxReconnectInterval: config.maxReconnectInterval ?? 30000,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      heartbeatMessage: config.heartbeatMessage ?? 'ping',
      messageQueueSize: config.messageQueueSize ?? 100,
      debug: config.debug ?? false,
    };
  }

  // --------------------------------------------------------------------------
  // Connection Management
  // --------------------------------------------------------------------------

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.log('Already connected');
      return;
    }

    this.setState('connecting');
    
    try {
      this.socket = new WebSocket(
        this.config.url,
        this.config.protocols
      );
      this.setupEventHandlers();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.stopReconnect();
    
    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }
    
    this.setState('disconnected');
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.onopen = () => {
      this.log('Connection established');
      this.setState('connected');
      this.reconnectCount = 0;
      this.startHeartbeat();
      this.flushMessageQueue();
    };

    this.socket.onclose = (event) => {
      this.log(`Connection closed: ${event.code} ${event.reason}`);
      this.stopHeartbeat();
      
      if (event.code !== 1000 && this.config.reconnect) {
        this.scheduleReconnect();
      } else {
        this.setState('disconnected');
      }
    };

    this.socket.onerror = (error) => {
      this.log('Connection error', error);
      this.handleError(error);
    };

    this.socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  // --------------------------------------------------------------------------
  // Message Handling
  // --------------------------------------------------------------------------

  send<T>(type: string, payload: T): boolean {
    const message: WebSocketMessage<T> = {
      type,
      payload,
      timestamp: Date.now(),
      id: this.generateId(),
    };

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      this.log('Sent:', message);
      return true;
    }

    // Queue message if not connected
    if (this.messageQueue.length < this.config.messageQueueSize) {
      this.messageQueue.push(message);
      this.log('Queued:', message);
    } else {
      this.log('Queue full, message dropped');
    }
    
    return false;
  }

  private handleMessage(data: string): void {
    // Handle heartbeat
    if (data === 'pong') {
      this.lastPong = Date.now();
      return;
    }

    try {
      const message = JSON.parse(data) as WebSocketMessage;
      this.log('Received:', message);

      // Notify specific handlers
      const handlers = this.messageHandlers.get(message.type);
      if (handlers) {
        handlers.forEach(handler => handler(message));
      }

      // Notify wildcard handlers
      const wildcardHandlers = this.messageHandlers.get('*');
      if (wildcardHandlers) {
        wildcardHandlers.forEach(handler => handler(message));
      }
    } catch {
      this.log('Failed to parse message:', data);
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(message));
        this.log('Flushed queued message:', message);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Reconnection
  // --------------------------------------------------------------------------

  private scheduleReconnect(): void {
    if (this.reconnectCount >= this.config.reconnectAttempts) {
      this.log('Max reconnect attempts reached');
      this.setState('error');
      return;
    }

    this.setState('reconnecting');
    
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectCount),
      this.config.maxReconnectInterval
    );

    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectCount + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectCount++;
      this.connect();
    }, delay);
  }

  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectCount = 0;
  }

  // --------------------------------------------------------------------------
  // Heartbeat
  // --------------------------------------------------------------------------

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        // Check if we received pong recently
        const timeSinceLastPong = Date.now() - this.lastPong;
        if (timeSinceLastPong > this.config.heartbeatInterval * 2) {
          this.log('Heartbeat timeout, reconnecting');
          this.socket.close();
          return;
        }

        this.socket.send(this.config.heartbeatMessage);
        this.log('Heartbeat sent');
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // --------------------------------------------------------------------------
  // Event Subscriptions
  // --------------------------------------------------------------------------

  on<T>(type: string, handler: MessageHandler<T>): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler as MessageHandler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        handlers.delete(handler as MessageHandler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(type);
        }
      }
    };
  }

  onStateChange(handler: StateHandler): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  // --------------------------------------------------------------------------
  // State Management
  // --------------------------------------------------------------------------

  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.stateHandlers.forEach(handler => handler(state));
    }
  }

  getState(): ConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }

  // --------------------------------------------------------------------------
  // Error Handling
  // --------------------------------------------------------------------------

  private handleError(error: Event | Error): void {
    this.setState('error');
    this.errorHandlers.forEach(handler => handler(error));
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[WebSocket]', ...args);
    }
  }
}

// ============================================================================
// React Hook
// ============================================================================

interface UseWebSocketOptions extends Omit<WebSocketConfig, 'url'> {
  url: string;
  enabled?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event | Error) => void;
}

interface UseWebSocketReturn {
  state: ConnectionState;
  isConnected: boolean;
  send: <T>(type: string, payload: T) => boolean;
  subscribe: <T>(type: string, handler: MessageHandler<T>) => () => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { url, enabled = true, onConnect, onDisconnect, onError, ...config } = options;
  const managerRef = useRef<WebSocketManager | null>(null);
  const [state, setState] = useState<ConnectionState>('disconnected');

  // Initialize manager
  useEffect(() => {
    managerRef.current = new WebSocketManager({ url, ...config });
    
    const unsubState = managerRef.current.onStateChange((newState) => {
      setState(newState);
      if (newState === 'connected') onConnect?.();
      if (newState === 'disconnected') onDisconnect?.();
    });

    const unsubError = managerRef.current.onError((error) => {
      onError?.(error);
    });

    return () => {
      unsubState();
      unsubError();
      managerRef.current?.disconnect();
    };
  }, [url]);

  // Auto-connect when enabled
  useEffect(() => {
    if (enabled && managerRef.current) {
      managerRef.current.connect();
    } else if (!enabled && managerRef.current) {
      managerRef.current.disconnect();
    }
  }, [enabled]);

  const send = useCallback(<T,>(type: string, payload: T): boolean => {
    return managerRef.current?.send(type, payload) ?? false;
  }, []);

  const subscribe = useCallback(<T,>(type: string, handler: MessageHandler<T>): () => void => {
    return managerRef.current?.on(type, handler) ?? (() => {});
  }, []);

  const connect = useCallback(() => {
    managerRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    managerRef.current?.disconnect();
  }, []);

  return {
    state,
    isConnected: state === 'connected',
    send,
    subscribe,
    connect,
    disconnect,
  };
}

// ============================================================================
// Connection Status Component
// ============================================================================

interface ConnectionStatusProps {
  state: ConnectionState;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ConnectionStatus({
  state,
  showLabel = true,
  size = 'md',
}: ConnectionStatusProps): JSX.Element {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const stateConfig: Record<ConnectionState, { color: string; label: string }> = {
    connected: { color: 'bg-green-500', label: 'Connected' },
    connecting: { color: 'bg-yellow-500 animate-pulse', label: 'Connecting...' },
    disconnected: { color: 'bg-slate-500', label: 'Disconnected' },
    reconnecting: { color: 'bg-yellow-500 animate-pulse', label: 'Reconnecting...' },
    error: { color: 'bg-red-500', label: 'Error' },
  };

  const { color, label } = stateConfig[state];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block rounded-full ${sizeClasses[size]} ${color}`}
        aria-hidden="true"
      />
      {showLabel && <span className="text-sm text-[#869ab8]">{label}</span>}
      <span className="sr-only">{label}</span>
    </div>
  );
}
