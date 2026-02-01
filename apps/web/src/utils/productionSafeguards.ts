/**
 * Production Safeguards - Global Error Handling & Performance Monitoring
 * 
 * This module provides:
 * - Global error and unhandled rejection handlers
 * - Performance monitoring
 * - Memory leak detection
 * - Console log filtering for production
 */

export interface ErrorLog {
    timestamp: Date;
    message: string;
    stack?: string;
    url?: string;
    lineNo?: number;
    colNo?: number;
    type: 'error' | 'promise-rejection' | 'component-error';
}

class ProductionSafeguards {
    private errorLogs: ErrorLog[] = [];
    private maxLogs = 50;
    private isProduction = import.meta.env.PROD;
    
    /**
     * Initialize all production safeguards
     */
    initialize() {
        this.setupGlobalErrorHandler();
        this.setupUnhandledRejectionHandler();
        this.setupConsoleFiltering();
        this.setupPerformanceMonitoring();
        
        console.log('✅ Production safeguards initialized');
    }
    
    /**
     * Global error handler - catches uncaught JavaScript errors
     */
    private setupGlobalErrorHandler() {
        window.addEventListener('error', (event: ErrorEvent) => {
            const errorLog: ErrorLog = {
                timestamp: new Date(),
                message: event.message,
                stack: event.error?.stack,
                url: event.filename,
                lineNo: event.lineno,
                colNo: event.colno,
                type: 'error'
            };
            
            this.logError(errorLog);
            
            // Log to console in development
            if (!this.isProduction) {
                console.error('🔴 Global Error:', errorLog);
            }
            
            // Prevent default browser error handling in production
            if (this.isProduction) {
                event.preventDefault();
            }
        });
    }
    
    /**
     * Unhandled promise rejection handler
     */
    private setupUnhandledRejectionHandler() {
        window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
            const errorLog: ErrorLog = {
                timestamp: new Date(),
                message: event.reason?.message || String(event.reason),
                stack: event.reason?.stack,
                type: 'promise-rejection'
            };
            
            this.logError(errorLog);
            
            // Log to console in development
            if (!this.isProduction) {
                console.error('🔴 Unhandled Promise Rejection:', errorLog);
            }
            
            // Prevent default handling in production
            if (this.isProduction) {
                event.preventDefault();
            }
        });
    }
    
    /**
     * Filter console logs in production
     */
    private setupConsoleFiltering() {
        if (this.isProduction) {
            // Save original console methods
            const originalConsole = {
                log: console.log,
                info: console.info,
                warn: console.warn,
                error: console.error
            };
            
            // Override console.log and console.info in production
            console.log = () => {};
            console.info = () => {};
            
            // Keep warnings and errors but format them
            console.warn = (...args: any[]) => {
                originalConsole.warn('⚠️', ...args);
            };
            
            console.error = (...args: any[]) => {
                originalConsole.error('❌', ...args);
            };
        }
    }
    
    /**
     * Monitor performance and detect issues
     */
    private setupPerformanceMonitoring() {
        // Monitor long tasks (>50ms)
        if ('PerformanceObserver' in window) {
            try {
                const perfObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.duration > 50) {
                            console.warn(`⚠️ Long task detected: ${entry.duration.toFixed(2)}ms`);
                        }
                    }
                });
                
                perfObserver.observe({ entryTypes: ['measure', 'navigation'] });
            } catch (e) {
                // PerformanceObserver not supported or failed
            }
        }
        
        // Monitor memory usage (Chrome only)
        if ('memory' in performance) {
            setInterval(() => {
                const memory = (performance as any).memory;
                const usedMB = memory.usedJSHeapSize / 1048576;
                const limitMB = memory.jsHeapSizeLimit / 1048576;
                const percentUsed = (usedMB / limitMB) * 100;
                
                if (percentUsed > 90) {
                    console.warn(`⚠️ High memory usage: ${percentUsed.toFixed(1)}% (${usedMB.toFixed(1)}MB / ${limitMB.toFixed(1)}MB)`);
                }
            }, 30000); // Check every 30 seconds
        }
    }
    
    /**
     * Store error log (limited to maxLogs)
     */
    private logError(error: ErrorLog) {
        this.errorLogs.push(error);
        
        // Keep only last N logs
        if (this.errorLogs.length > this.maxLogs) {
            this.errorLogs.shift();
        }
        
        // In production, you could send to error tracking service
        if (this.isProduction) {
            this.sendToErrorTracking(error);
        }
    }
    
    /**
     * Send error to tracking service (placeholder)
     * Replace with actual service like Sentry, LogRocket, etc.
     */
    private sendToErrorTracking(error: ErrorLog) {
        // Note: Sentry is enabled via .env VITE_SENTRY_DSN
        // This function kept for legacy/fallback purposes
        // Azure Static Web Apps doesn't have a backend API for error logging
        // Use Sentry integration instead
        try {
            // Don't attempt to POST to /api/log-error as static web app has no API
            // Error tracking is handled by Sentry if configured
            if (typeof window !== 'undefined' && (window as any).__SENTRY__) {
                // Sentry is available, errors are already tracked
                return;
            }
        } catch (e) {
            // Silent fail
        }
        }
    }
    
    /**
     * Get recent error logs
     */
    getRecentErrors(count: number = 10): ErrorLog[] {
        return this.errorLogs.slice(-count);
    }
    
    /**
     * Clear error logs
     */
    clearErrors() {
        this.errorLogs = [];
    }
    
    /**
     * Check if app is in healthy state
     */
    healthCheck(): { healthy: boolean; issues: string[] } {
        const issues: string[] = [];
        
        // Check error rate
        const recentErrors = this.errorLogs.filter(
            log => Date.now() - log.timestamp.getTime() < 60000 // Last minute
        );
        
        if (recentErrors.length > 10) {
            issues.push(`High error rate: ${recentErrors.length} errors in last minute`);
        }
        
        // Check memory if available
        if ('memory' in performance) {
            const memory = (performance as any).memory;
            const percentUsed = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
            
            if (percentUsed > 90) {
                issues.push(`High memory usage: ${percentUsed.toFixed(1)}%`);
            }
        }
        
        return {
            healthy: issues.length === 0,
            issues
        };
    }
}

// Export singleton instance
export const safeguards = new ProductionSafeguards();

// Auto-initialize when imported
safeguards.initialize();
