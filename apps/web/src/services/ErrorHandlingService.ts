/**
 * ErrorHandlingService.ts - Comprehensive Error Handling
 * 
 * Provides:
 * - Error classification and categorization
 * - User-friendly error messages
 * - Error recovery strategies
 * - Error logging and reporting
 * - Retry mechanisms
 */

// ============================================
// TYPES
// ============================================

export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';

export type ErrorCategory =
    | 'analysis'
    | 'design_code'
    | 'ai'
    | 'voice'
    | 'network'
    | 'database'
    | 'export'
    | 'validation'
    | 'unknown';

export interface StructuredError {
    id: string;
    timestamp: Date;
    category: ErrorCategory;
    severity: ErrorSeverity;
    code: string;
    message: string;
    userMessage: string;
    technicalDetails?: string;
    recoverable: boolean;
    recoveryAction?: string;
    context?: Record<string, any>;
}

export interface ErrorRecoveryAction {
    label: string;
    action: () => Promise<void> | void;
    primary?: boolean;
}

// ============================================
// ERROR CODES
// ============================================

export const ERROR_CODES = {
    // Analysis errors
    ANALYSIS_SINGULAR_MATRIX: 'ANA_001',
    ANALYSIS_UNSTABLE_STRUCTURE: 'ANA_002',
    ANALYSIS_CONVERGENCE_FAILED: 'ANA_003',
    ANALYSIS_TIMEOUT: 'ANA_004',

    // Design code errors
    DESIGN_SECTION_NOT_FOUND: 'DES_001',
    DESIGN_MATERIAL_INVALID: 'DES_002',
    DESIGN_CAPACITY_EXCEEDED: 'DES_003',

    // AI errors
    AI_MODEL_UNAVAILABLE: 'AI_001',
    AI_RATE_LIMITED: 'AI_002',
    AI_PARSE_FAILED: 'AI_003',
    AI_CONTEXT_TOO_LONG: 'AI_004',

    // Voice errors
    VOICE_MICROPHONE_DENIED: 'VOC_001',
    VOICE_RECOGNITION_FAILED: 'VOC_002',
    VOICE_COMMAND_UNKNOWN: 'VOC_003',

    // Network errors
    NETWORK_OFFLINE: 'NET_001',
    NETWORK_TIMEOUT: 'NET_002',
    NETWORK_SERVER_ERROR: 'NET_003',

    // Database errors
    DB_CONNECTION_FAILED: 'DB_001',
    DB_QUERY_FAILED: 'DB_002',
    DB_CONSTRAINT_VIOLATION: 'DB_003',

    // Export errors
    EXPORT_GENERATION_FAILED: 'EXP_001',
    EXPORT_FILE_TOO_LARGE: 'EXP_002',

    // Validation errors
    VALIDATION_FAILED: 'VAL_001',
    VALIDATION_THRESHOLD_EXCEEDED: 'VAL_002'
};

// ============================================
// USER-FRIENDLY MESSAGES
// ============================================

const USER_MESSAGES: Record<string, string> = {
    [ERROR_CODES.ANALYSIS_SINGULAR_MATRIX]: 'The structure appears to be unstable. Please check support conditions.',
    [ERROR_CODES.ANALYSIS_UNSTABLE_STRUCTURE]: 'The structure is not properly supported. Add or fix supports.',
    [ERROR_CODES.ANALYSIS_CONVERGENCE_FAILED]: 'Analysis could not converge. Try simplifying the model.',
    [ERROR_CODES.ANALYSIS_TIMEOUT]: 'Analysis is taking too long. Try reducing model complexity.',
    [ERROR_CODES.DESIGN_SECTION_NOT_FOUND]: 'The specified section was not found in the database.',
    [ERROR_CODES.DESIGN_CAPACITY_EXCEEDED]: 'Member capacity is exceeded. Consider a larger section.',
    [ERROR_CODES.AI_MODEL_UNAVAILABLE]: 'AI service is temporarily unavailable. Please try again.',
    [ERROR_CODES.AI_RATE_LIMITED]: 'Too many requests. Please wait a moment and try again.',
    [ERROR_CODES.VOICE_MICROPHONE_DENIED]: 'Microphone access was denied. Enable in browser settings.',
    [ERROR_CODES.VOICE_COMMAND_UNKNOWN]: 'I didn\'t understand that command. Try saying it differently.',
    [ERROR_CODES.NETWORK_OFFLINE]: 'You appear to be offline. Check your internet connection.',
    [ERROR_CODES.NETWORK_TIMEOUT]: 'Request timed out. Please try again.',
    [ERROR_CODES.DB_CONNECTION_FAILED]: 'Could not connect to database. Saving locally instead.',
    [ERROR_CODES.EXPORT_GENERATION_FAILED]: 'Export failed. Please try a different format.',
};

// ============================================
// ERROR HANDLING SERVICE
// ============================================

class ErrorHandlingServiceClass {
    private errorLog: StructuredError[] = [];
    private listeners: ((error: StructuredError) => void)[] = [];
    private retryAttempts: Map<string, number> = new Map();
    private maxRetries = 3;

    /**
     * Create a structured error from any error
     */
    createError(
        error: Error | string,
        category: ErrorCategory,
        code: string,
        context?: Record<string, any>
    ): StructuredError {
        const message = error instanceof Error ? error.message : error;

        const structured: StructuredError = {
            id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            category,
            severity: this.determineSeverity(code),
            code,
            message,
            userMessage: USER_MESSAGES[code] || 'An unexpected error occurred.',
            technicalDetails: error instanceof Error ? error.stack : undefined,
            recoverable: this.isRecoverable(code),
            recoveryAction: this.getRecoveryAction(code),
            context
        };

        this.logError(structured);
        this.notifyListeners(structured);

        return structured;
    }

    /**
     * Handle an error with automatic recovery attempt
     */
    async handleWithRecovery<T>(
        operation: () => Promise<T>,
        category: ErrorCategory,
        code: string,
        context?: Record<string, any>
    ): Promise<T> {
        const attemptKey = `${code}_${JSON.stringify(context)}`;
        const attempts = this.retryAttempts.get(attemptKey) || 0;

        try {
            const result = await operation();
            this.retryAttempts.delete(attemptKey);
            return result;
        } catch (error) {
            const structured = this.createError(error as Error, category, code, context);

            if (structured.recoverable && attempts < this.maxRetries) {
                this.retryAttempts.set(attemptKey, attempts + 1);
                await this.delay(Math.pow(2, attempts) * 1000); // Exponential backoff
                return this.handleWithRecovery(operation, category, code, context);
            }

            throw structured;
        }
    }

    /**
     * Get recovery actions for an error
     */
    getRecoveryActions(error: StructuredError): ErrorRecoveryAction[] {
        const actions: ErrorRecoveryAction[] = [];

        switch (error.code) {
            case ERROR_CODES.ANALYSIS_UNSTABLE_STRUCTURE:
                actions.push({
                    label: 'Add Fixed Support',
                    action: () => { window.dispatchEvent(new CustomEvent('addSupport', { detail: 'fixed' })); },
                    primary: true
                });
                actions.push({
                    label: 'Review Supports',
                    action: () => { window.dispatchEvent(new CustomEvent('showPanel', { detail: 'supports' })); }
                });
                break;

            case ERROR_CODES.DESIGN_CAPACITY_EXCEEDED:
                actions.push({
                    label: 'Select Larger Section',
                    action: () => { window.dispatchEvent(new CustomEvent('showPanel', { detail: 'sections' })); },
                    primary: true
                });
                actions.push({
                    label: 'Run Optimization',
                    action: () => { window.dispatchEvent(new CustomEvent('runOptimization')); }
                });
                break;

            case ERROR_CODES.NETWORK_OFFLINE:
                actions.push({
                    label: 'Work Offline',
                    action: () => { localStorage.setItem('offlineMode', 'true'); },
                    primary: true
                });
                actions.push({
                    label: 'Retry Connection',
                    action: () => { window.location.reload(); }
                });
                break;

            case ERROR_CODES.AI_RATE_LIMITED:
                actions.push({
                    label: 'Wait and Retry',
                    action: async () => {
                        await this.delay(60000);
                        window.dispatchEvent(new CustomEvent('retryAI'));
                    },
                    primary: true
                });
                break;

            default:
                actions.push({
                    label: 'Dismiss',
                    action: () => { },
                    primary: true
                });
        }

        return actions;
    }

    /**
     * Subscribe to error events
     */
    onError(listener: (error: StructuredError) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Get error history
     */
    getErrorLog(limit: number = 50): StructuredError[] {
        return this.errorLog.slice(-limit);
    }

    /**
     * Clear error log
     */
    clearErrorLog(): void {
        this.errorLog = [];
    }

    /**
     * Export error log for debugging
     */
    exportErrorLog(): string {
        return JSON.stringify(this.errorLog, null, 2);
    }

    // ============================================
    // PRIVATE METHODS
    // ============================================

    private determineSeverity(code: string): ErrorSeverity {
        if (code.startsWith('ANA_') || code.startsWith('DB_')) return 'critical';
        if (code.startsWith('DES_') || code.startsWith('NET_')) return 'error';
        if (code.startsWith('VAL_')) return 'warning';
        return 'info';
    }

    private isRecoverable(code: string): boolean {
        const nonRecoverable = [
            ERROR_CODES.VOICE_MICROPHONE_DENIED,
            ERROR_CODES.DB_CONSTRAINT_VIOLATION
        ];
        return !nonRecoverable.includes(code);
    }

    private getRecoveryAction(code: string): string | undefined {
        const actions: Record<string, string> = {
            [ERROR_CODES.ANALYSIS_UNSTABLE_STRUCTURE]: 'Check and fix support conditions',
            [ERROR_CODES.DESIGN_CAPACITY_EXCEEDED]: 'Select a larger section',
            [ERROR_CODES.NETWORK_OFFLINE]: 'Switch to offline mode',
            [ERROR_CODES.AI_RATE_LIMITED]: 'Wait 60 seconds and retry'
        };
        return actions[code];
    }

    private logError(error: StructuredError): void {
        this.errorLog.push(error);

        // Keep only last 1000 errors
        if (this.errorLog.length > 1000) {
            this.errorLog = this.errorLog.slice(-1000);
        }

        // Console log based on severity
        const consoleMethods: Record<ErrorSeverity, 'error' | 'warn' | 'info' | 'log'> = {
            critical: 'error',
            error: 'error',
            warning: 'warn',
            info: 'info'
        };

        console[consoleMethods[error.severity]](`[${error.code}] ${error.message}`, error.context);
    }

    private notifyListeners(error: StructuredError): void {
        for (const listener of this.listeners) {
            try {
                listener(error);
            } catch (e) {
                console.error('Error in error listener:', e);
            }
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ============================================
// SINGLETON
// ============================================

export const errorHandler = new ErrorHandlingServiceClass();
export default ErrorHandlingServiceClass;
