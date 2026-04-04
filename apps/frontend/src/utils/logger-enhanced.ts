/**
 * ============================================================================
 * LOGGER UTILITY - Enhanced Version
 * ============================================================================
 * 
 * Centralized logging with environment-aware filtering and structured output.
 * Replaces scattered console.log calls throughout the application.
 * 
 * @version 2.0.0
 */

import { MONITORING_CONFIG, APP_ENV } from '../config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

interface LogOptions {
    context?: string;
    data?: unknown;
    timestamp?: boolean;
}

class Logger {
    private shouldLog(level: LogLevel): boolean {
        // Always log errors and warnings
        if (level === 'error' || level === 'warn') return true;
        
        // In production, only log errors and warnings unless debug is enabled
        if (APP_ENV.isProd && !MONITORING_CONFIG.debug) return false;
        
        // In development, log everything
        return true;
    }

    private formatMessage(level: LogLevel, message: string, options?: LogOptions): string {
        const timestamp = options?.timestamp !== false 
            ? `[${new Date().toISOString().split('T')[1].split('.')[0]}]` 
            : '';
        const context = options?.context ? `[${options.context}]` : '';
        const emoji = this.getEmoji(level);
        
        return `${timestamp} ${emoji} ${context} ${message}`.trim();
    }

    private getEmoji(level: LogLevel): string {
        const emojis: Record<LogLevel, string> = {
            debug: '🔍',
            info: 'ℹ️',
            warn: '⚠️',
            error: '❌',
            success: '✅'
        };
        return emojis[level];
    }

    private log(level: LogLevel, message: string, options?: LogOptions): void {
        if (!this.shouldLog(level)) return;

        const formattedMessage = this.formatMessage(level, message, options);
        const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';

        if (options?.data !== undefined) {
            console[consoleMethod](formattedMessage, options.data);
        } else {
            console[consoleMethod](formattedMessage);
        }
    }

    debug(message: string, options?: LogOptions): void {
        this.log('debug', message, options);
    }

    info(message: string, options?: LogOptions): void {
        this.log('info', message, options);
    }

    warn(message: string, options?: LogOptions): void {
        this.log('warn', message, options);
    }

    error(message: string, error?: unknown, options?: LogOptions): void {
        this.log('error', message, { ...options, data: error });
    }

    success(message: string, options?: LogOptions): void {
        this.log('success', message, options);
    }

    /**
     * Create a contextual logger for a specific component/module
     */
    context(contextName: string) {
        return {
            debug: (msg: string, opts?: Omit<LogOptions, 'context'>) => 
                this.debug(msg, { ...opts, context: contextName }),
            info: (msg: string, opts?: Omit<LogOptions, 'context'>) => 
                this.info(msg, { ...opts, context: contextName }),
            warn: (msg: string, opts?: Omit<LogOptions, 'context'>) => 
                this.warn(msg, { ...opts, context: contextName }),
            error: (msg: string, err?: unknown, opts?: Omit<LogOptions, 'context'>) => 
                this.error(msg, err, { ...opts, context: contextName }),
            success: (msg: string, opts?: Omit<LogOptions, 'context'>) => 
                this.success(msg, { ...opts, context: contextName }),
        };
    }

    /**
     * Group related logs together (collapsed by default)
     */
    group(label: string, collapsed = true): void {
        if (!this.shouldLog('info')) return;
        collapsed ? console.groupCollapsed(label) : console.group(label);
    }

    groupEnd(): void {
        if (!this.shouldLog('info')) return;
        console.groupEnd();
    }

    /**
     * Log performance timing
     */
    time(label: string): void {
        if (!this.shouldLog('debug')) return;
        console.time(`⏱️ ${label}`);
    }

    timeEnd(label: string): void {
        if (!this.shouldLog('debug')) return;
        console.timeEnd(`⏱️ ${label}`);
    }

    /**
     * Table output for structured data
     */
    table(data: unknown): void {
        if (!this.shouldLog('info')) return;
        console.table(data);
    }
}

// Export singleton instance
export const logger = new Logger();

// Export legacy logger for backward compatibility
export default logger;
