/**
 * ============================================================================
 * STRUCTURED LOGGING SERVICE
 * ============================================================================
 * 
 * Industry-standard logging with:
 * - Log levels (debug, info, warn, error)
 * - Structured JSON output
 * - Context propagation
 * - Performance timing
 * - Error tracking integration (Sentry-ready)
 * - Log buffering and batching
 * - Environment-aware filtering
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPES
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  performance?: {
    duration: number;
    operation: string;
  };
  user?: {
    id?: string;
    email?: string;
  };
  request?: {
    url?: string;
    method?: string;
    status?: number;
  };
  environment: string;
  version: string;
  sessionId: string;
}

export interface LoggerConfig {
  level: LogLevel;
  context?: string;
  enableConsole?: boolean;
  enableRemote?: boolean;
  remoteEndpoint?: string;
  batchSize?: number;
  flushInterval?: number;
  sampleRate?: number;
}

// ============================================================================
// LOG LEVEL PRIORITY
// ============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ============================================================================
// SESSION ID
// ============================================================================

const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('beamlab-session-id');
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('beamlab-session-id', sessionId);
  }
  return sessionId;
};

// ============================================================================
// LOGGER CLASS
// ============================================================================

class Logger {
  private config: Required<LoggerConfig>;
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private sessionId: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: (import.meta.env.MODE === 'production' ? 'info' : 'debug') as LogLevel,
      context: 'app',
      enableConsole: import.meta.env.MODE !== 'production',
      enableRemote: import.meta.env.MODE === 'production',
      remoteEndpoint: import.meta.env.VITE_LOG_ENDPOINT || '',
      batchSize: 10,
      flushInterval: 5000,
      sampleRate: 1.0,
      ...config,
    };

    this.sessionId = getSessionId();
    this.startFlushTimer();
  }

  // ============================================
  // PUBLIC LOGGING METHODS
  // ============================================

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const errorData = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error
        ? { name: 'Unknown', message: String(error) }
        : undefined;

    this.log('error', message, data, errorData);
  }

  // ============================================
  // SPECIALIZED LOGGING
  // ============================================

  /**
   * Log API request/response
   */
  api(method: string, url: string, status: number, duration: number, error?: Error): void {
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    
    this.log(level, `API ${method} ${url}`, {
      request: { method, url, status },
      performance: { duration, operation: 'api-call' },
    }, error ? { name: error.name, message: error.message, stack: error.stack } : undefined);
  }

  /**
   * Log user action
   */
  action(action: string, target?: string, data?: Record<string, unknown>): void {
    this.info(`User action: ${action}`, {
      action,
      target,
      ...data,
    });
  }

  /**
   * Log page navigation
   */
  navigation(from: string, to: string): void {
    this.info(`Navigation: ${from} → ${to}`, {
      navigation: { from, to },
    });
  }

  /**
   * Log performance metric
   */
  performance(operation: string, duration: number, data?: Record<string, unknown>): void {
    this.info(`Performance: ${operation}`, {
      performance: { operation, duration },
      ...data,
    });
  }

  /**
   * Create a timer for measuring operations
   */
  time(operation: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.performance(operation, duration);
    };
  }

  /**
   * Create a child logger with context
   */
  child(context: string): Logger {
    return new Logger({
      ...this.config,
      context: `${this.config.context}:${context}`,
    });
  }

  // ============================================
  // CORE LOGGING
  // ============================================

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: { name: string; message: string; stack?: string }
  ): void {
    // Check log level
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.level]) {
      return;
    }

    // Sample rate filtering
    if (Math.random() > this.config.sampleRate) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.config.context,
      data,
      error,
      environment: import.meta.env.MODE || 'development',
      version: import.meta.env.VITE_APP_VERSION || '1.0.0',
      sessionId: this.sessionId,
    };

    // Console output in development
    if (this.config.enableConsole) {
      this.consoleOutput(entry);
    }

    // Buffer for remote logging
    if (this.config.enableRemote && this.config.remoteEndpoint) {
      this.buffer.push(entry);
      if (this.buffer.length >= this.config.batchSize) {
        this.flush();
      }
    }
  }

  private consoleOutput(entry: LogEntry): void {
    const prefix = `[${entry.context}]`;
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    
    const styles = {
      debug: 'color: #6B7280',
      info: 'color: #3B82F6',
      warn: 'color: #F59E0B',
      error: 'color: #EF4444; font-weight: bold',
    };

    const consoleMethod = entry.level === 'error' ? 'error' 
      : entry.level === 'warn' ? 'warn' 
      : 'log';

    console[consoleMethod](
      `%c${timestamp} ${prefix} ${entry.message}`,
      styles[entry.level],
      entry.data || '',
      entry.error?.stack || ''
    );
  }

  // ============================================
  // REMOTE LOGGING
  // ============================================

  private startFlushTimer(): void {
    if (this.flushTimer) return;
    
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);

    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flush();
        }
      });
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.config.remoteEndpoint) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      // Use sendBeacon for reliability
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(
          this.config.remoteEndpoint,
          JSON.stringify(entries)
        );
      } else {
        await fetch(this.config.remoteEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entries),
          keepalive: true,
        });
      }
    } catch {
      // Re-buffer on failure (up to a limit)
      if (this.buffer.length < 100) {
        this.buffer.unshift(...entries);
      }
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const logger = new Logger();

// Specialized loggers for different modules
export const apiLogger = logger.child('api');
export const authLogger = logger.child('auth');
export const analysisLogger = logger.child('analysis');
export const uiLogger = logger.child('ui');

export default logger;
