/**
 * Production-ready logging utility
 * Automatically disabled in production builds
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  prefix?: string;
}

const isDevelopment = import.meta.env.DEV;

class Logger {
  private config: LoggerConfig;

  constructor(prefix?: string) {
    this.config = {
      enabled: isDevelopment,
      level: 'info',
      prefix,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.config.level);
  }

  private formatMessage(...args: any[]): any[] {
    if (this.config.prefix) {
      return [`[${this.config.prefix}]`, ...args];
    }
    return args;
  }

  debug(...args: any[]) {
    if (this.shouldLog('debug')) {
      console.log(...this.formatMessage(...args));
    }
  }

  info(...args: any[]) {
    if (this.shouldLog('info')) {
      console.log(...this.formatMessage(...args));
    }
  }

  warn(...args: any[]) {
    if (this.shouldLog('warn')) {
      console.warn(...this.formatMessage(...args));
    }
  }

  error(...args: any[]) {
    // Always log errors, even in production
    console.error(...this.formatMessage(...args));
  }

  // Performance timing
  time(label: string) {
    if (this.config.enabled) {
      console.time(this.formatMessage(label)[0]);
    }
  }

  timeEnd(label: string) {
    if (this.config.enabled) {
      console.timeEnd(this.formatMessage(label)[0]);
    }
  }
}

// Create logger instances for different modules
export const createLogger = (prefix: string) => new Logger(prefix);

// Default logger
export const logger = new Logger();

// Commonly used loggers
export const analysisLogger = createLogger('Analysis');
export const renderLogger = createLogger('Render');
export const aiLogger = createLogger('AI');
export const solverLogger = createLogger('Solver');
export const authLogger = createLogger('Auth');
