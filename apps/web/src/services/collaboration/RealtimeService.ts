import { v4 as uuidv4 } from 'uuid';
import { API_CONFIG } from '../../config/env';

// Types
export interface CursorPosition {
    x: number;
    y: number;
    z: number;
}

export interface RemoteUser {
    id: string;
    color: string;
    cursor: CursorPosition | null;
    selection: string[]; // Selected element IDs
}

type EventCallback = (type: string, data: any) => void;

class RealtimeService {
    private socket: WebSocket | null = null;
    private userId: string;
    private listeners: EventCallback[] = [];
    private remoteUsers: Map<string, RemoteUser> = new Map();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private isIntentionalDisconnect = false;
    private messageQueue: unknown[] = [];

    // Config - derive WS URL from Python API URL (http→ws, https→wss)
    private WS_URL = import.meta.env['VITE_WEBSOCKET_URL'] || API_CONFIG.pythonUrl.replace(/^http/, 'ws') + '/ws';

    constructor() {
        this.userId = uuidv4().substring(0, 8); // Random ID for this session
    }

    public connect() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        this.isIntentionalDisconnect = false;
        console.log(`[Realtime] Connecting as ${this.userId}...`);
        this.socket = new WebSocket(`${this.WS_URL}/${this.userId}`);

        this.socket.onopen = () => {
            console.log('[Realtime] Connected');
            this.reconnectAttempts = 0;
            this.notifyListeners('connection_status', { connected: true });
            
            // Flush queued messages
            while (this.messageQueue.length > 0) {
                const msg = this.messageQueue.shift();
                this.send(msg);
            }
        };

        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (e) {
                console.error('[Realtime] Failed to parse message', e);
            }
        };

        this.socket.onclose = () => {
            console.log('[Realtime] Disconnected');
            this.notifyListeners('connection_status', { connected: false });
            
            // Auto-reconnect with exponential backoff
            if (!this.isIntentionalDisconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
                console.log(`[Realtime] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
                this.reconnectTimer = setTimeout(() => {
                    this.reconnectAttempts++;
                    this.connect();
                }, delay);
            }
        };

        this.socket.onerror = (error) => {
            console.error('[Realtime] WebSocket error', error);
        };
    }

    public disconnect() {
        this.isIntentionalDisconnect = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.remoteUsers.clear();
        this.notifyListeners('connection_status', { connected: false });
    }

    public isConnected(): boolean {
        return this.socket?.readyState === WebSocket.OPEN;
    }

    private handleMessage(message: any) {
        const { type, userId } = message;

        if (type === 'cursor_move') {
            this.updateRemoteCursor(userId, message.position);
        } else if (type === 'selection_change') {
            this.updateRemoteSelection(userId, message.selection);
        } else if (type === 'user_left') {
            this.remoteUsers.delete(userId);
            this.notifyListeners('users_update', this.getUsers());
        }

        // Notify raw listeners
        this.notifyListeners(type, message);
    }

    private updateRemoteCursor(userId: string, position: CursorPosition) {
        let user = this.remoteUsers.get(userId);
        if (!user) {
            user = { id: userId, color: this.getRandomColor(), cursor: null, selection: [] };
            this.remoteUsers.set(userId, user);
        }
        user.cursor = position;
        this.notifyListeners('users_update', this.getUsers());
    }

    private updateRemoteSelection(userId: string, selection: string[]) {
        let user = this.remoteUsers.get(userId);
        if (!user) {
            user = { id: userId, color: this.getRandomColor(), cursor: null, selection: [] };
            this.remoteUsers.set(userId, user);
        }
        user.selection = selection;
        this.notifyListeners('users_update', this.getUsers());
    }

    // ============================================
    // API
    // ============================================

    public broadcastCursor(x: number, y: number, z: number) {
        this.send({
            type: 'cursor_move',
            userId: this.userId,
            position: { x, y, z }
        });
    }

    public broadcastSelection(selection: string[]) {
        this.send({
            type: 'selection_change',
            userId: this.userId,
            selection
        });
    }

    public on(callback: EventCallback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    public getUsers(): RemoteUser[] {
        return Array.from(this.remoteUsers.values());
    }

    public getMyId(): string {
        return this.userId;
    }

    // ============================================
    // UTILS
    // ============================================

    private notifyListeners(type: string, data: any) {
        this.listeners.forEach(callback => callback(type, data));
    }

    private send(data: any) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        } else {
            // Queue message for when connection is restored
            if (this.messageQueue.length < 50) {
                this.messageQueue.push(data);
            }
        }
    }

    private getRandomColor() {
        const colors = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#33FFF5', '#e91e63', '#9c27b0'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
}

export const realtime = new RealtimeService();
