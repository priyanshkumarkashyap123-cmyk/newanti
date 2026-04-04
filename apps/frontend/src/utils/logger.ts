/**
 * Production-ready logging utility
 * Automatically disabled in production builds
 * 
 * Usage:
 *   import { analysisLogger } from '../utils/logger';
 *   analysisLogger.info('Analysis started');
 *   analysisLogger.debug('Debug details:', data);
 * 
 * Features:
 *   - Automatically disabled in production
 *   - Can be enabled via localStorage for debugging
 *   - Performance timing support
 *   - Grouped logging for complex operations
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  prefix?: string;
}

// Check if in development mode or debug flag is set
const isDevelopment = import.meta.env.DEV;
const isDebugForced = typeof window !== 'undefined' &&
  localStorage.getItem('BEAMLAB_DEBUG') === 'true';

class Logger {
  private config: LoggerConfig;

  constructor(prefix?: string) {
    this.config = {
      enabled: isDevelopment || isDebugForced,
      level: 'info',
      prefix,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;

    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.config.level);
  }

  private formatMessage(...args: unknown[]): unknown[] {
    if (this.config.prefix) {
      return [`[${this.config.prefix}]`, ...args];
    }
    return args;
  }

  /**
   * Debug level - only in development with debug flag
   */
  debug(...args: unknown[]) {
    if (this.shouldLog('debug')) {
      console.log(...this.formatMessage('🔍', ...args));
    }
  }

  /**
   * Info level - general information in development
   */
  info(...args: unknown[]) {
    if (this.shouldLog('info')) {
      console.log(...this.formatMessage('ℹ️', ...args));
    }
  }

  /**
   * Log - alias for info level (backward compatibility)
   */
  log(...args: unknown[]) {
    this.info(...args);
  }

  /**
   * Success level - success messages in development
   */
  success(...args: unknown[]) {
    if (this.shouldLog('info')) {
      console.log(...this.formatMessage('✅', ...args));
    }
  }

  /**
   * Warning level - warnings in development
   */
  warn(...args: unknown[]) {
    if (this.shouldLog('warn')) {
      console.warn(...this.formatMessage('⚠️', ...args));
    }
  }

  /**
   * Error level - always logged, even in production
   */
  error(...args: unknown[]) {
    // Always log errors, even in production
    console.error(...this.formatMessage('❌', ...args));
  }

  /**
   * Performance timing - start timer
   */
  time(label: string) {
    if (this.config.enabled) {
      console.time(`[${this.config.prefix || 'Timer'}] ${label}`);
    }
  }

  /**
   * Performance timing - end timer and log duration
   */
  timeEnd(label: string) {
    if (this.config.enabled) {
      console.timeEnd(`[${this.config.prefix || 'Timer'}] ${label}`);
    }
  }

  /**
   * Group related logs together (collapsible in console)
   */
  group(label: string) {
    if (this.config.enabled) {
      console.groupCollapsed(...this.formatMessage(label));
    }
  }

  /**
   * End grouped logging
   */
  groupEnd() {
    if (this.config.enabled) {
      console.groupEnd();
    }
  }

  /**
   * Log with conditional - only logs if condition is true
   */
  logIf(condition: boolean, level: LogLevel, ...args: unknown[]) {
    if (condition) {
      this[level](...args);
    }
  }

  /**
   * Table logging for structured data
   */
  table(data: Record<string, unknown> | unknown[]) {
    if (this.config.enabled) {
      console.table(data);
    }
  }
}

// Create logger instances for different modules
export const createLogger = (prefix: string) => new Logger(prefix);

// Default logger
export const logger = new Logger();

// Commonly used loggers - organized by module
export const analysisLogger = createLogger('Analysis');
export const renderLogger = createLogger('Render');
export const aiLogger = createLogger('AI');
export const solverLogger = createLogger('Solver');
export const authLogger = createLogger('Auth');
export const wasmLogger = createLogger('WASM');
export const stressLogger = createLogger('Stress');
export const loadLogger = createLogger('Load');
export const uiLogger = createLogger('UI');
export const modelerLogger = createLogger('Modeler');

/**
 * Enable debug logging in production (for troubleshooting)
 * Call from browser console: window.enableBeamLabDebug()
 */
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).enableBeamLabDebug = () => {
    localStorage.setItem('BEAMLAB_DEBUG', 'true');
    console.log('🔧 BeamLab debug mode enabled. Refresh the page.');
  };

  (window as unknown as Record<string, unknown>).disableBeamLabDebug = () => {
    localStorage.removeItem('BEAMLAB_DEBUG');
    console.log('🔧 BeamLab debug mode disabled. Refresh the page.');
  };
}
