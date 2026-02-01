/**
 * Error Handling System
 * 
 * Comprehensive error handling utilities including:
 * - Error Boundary component with fallback UI
 * - Error logging and reporting
 * - Error recovery mechanisms
 * - User-friendly error messages
 * - Retry functionality
 */

'use client';

import React, {
  Component,
  ErrorInfo,
  ReactNode,
  createContext,
  useContext,
  useCallback,
  useState,
} from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home, Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from './utils';

// ============================================================================
// TYPES
// ============================================================================

export interface AppError {
  id: string;
  message: string;
  code?: string;
  status?: number;
  timestamp: Date;
  context?: Record<string, unknown>;
  stack?: string;
  recoverable?: boolean;
}

export interface ErrorContextValue {
  errors: AppError[];
  addError: (error: Partial<AppError>) => string;
  removeError: (id: string) => void;
  clearErrors: () => void;
  lastError: AppError | null;
}

// ============================================================================
// ERROR CONTEXT
// ============================================================================

const ErrorContext = createContext<ErrorContextValue | null>(null);

export const useErrorContext = (): ErrorContextValue => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useErrorContext must be used within an ErrorProvider');
  }
  return context;
};

export const ErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [errors, setErrors] = useState<AppError[]>([]);

  const generateId = () => `error-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const addError = useCallback((error: Partial<AppError>): string => {
    const id = error.id || generateId();
    const newError: AppError = {
      id,
      message: error.message || 'An unexpected error occurred',
      code: error.code,
      status: error.status,
      timestamp: new Date(),
      context: error.context,
      stack: error.stack,
      recoverable: error.recoverable ?? true,
    };
    
    setErrors((prev) => [...prev, newError]);
    
    // Log to console for debugging
    console.error('[App Error]', newError);
    
    return id;
  }, []);

  const removeError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const lastError = errors.length > 0 ? errors[errors.length - 1] : null;

  return (
    <ErrorContext.Provider
      value={{ errors, addError, removeError, clearErrors, lastError }}
    >
      {children}
    </ErrorContext.Provider>
  );
};

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    
    // Log error details
    console.error('[Error Boundary Caught]', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// ERROR FALLBACK UI
// ============================================================================

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo?: ErrorInfo | null;
  onReset?: () => void;
  onGoHome?: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  onReset,
  onGoHome,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-[400px] flex items-center justify-center p-8"
    >
      <div className="max-w-lg w-full text-center">
        {/* Error Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 mb-6"
        >
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </motion.div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-slate-400 mb-6">
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 mb-6">
          {onReset && (
            <Button onClick={onReset} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
          )}
          {onGoHome && (
            <Button variant="outline" onClick={onGoHome} className="gap-2">
              <Home className="w-4 h-4" />
              Go Home
            </Button>
          )}
        </div>

        {/* Error Details Toggle */}
        {(error?.stack || errorInfo?.componentStack) && (
          <div className="text-left">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-400 transition-colors mx-auto"
            >
              <Bug className="w-4 h-4" />
              Technical Details
              {showDetails ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showDetails && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 p-4 bg-slate-800 rounded-lg text-left overflow-auto max-h-64"
              >
                {error?.stack && (
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-red-400 uppercase mb-2">
                      Error Stack
                    </h4>
                    <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono">
                      {error.stack}
                    </pre>
                  </div>
                )}
                {errorInfo?.componentStack && (
                  <div>
                    <h4 className="text-xs font-semibold text-amber-400 uppercase mb-2">
                      Component Stack
                    </h4>
                    <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ============================================================================
// ERROR UTILITIES
// ============================================================================

/**
 * Categorize errors by type for better user messaging
 */
export const categorizeError = (
  error: unknown
): { category: string; message: string; recoverable: boolean } => {
  if (error instanceof TypeError) {
    return {
      category: 'type',
      message: 'A data type error occurred. Please refresh the page.',
      recoverable: true,
    };
  }

  if (error instanceof SyntaxError) {
    return {
      category: 'syntax',
      message: 'Invalid data format received. Please try again.',
      recoverable: true,
    };
  }

  if (error instanceof Error) {
    // Network errors
    if (
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('Network')
    ) {
      return {
        category: 'network',
        message: 'Unable to connect. Please check your internet connection.',
        recoverable: true,
      };
    }

    // Authentication errors
    if (
      error.message.includes('401') ||
      error.message.includes('Unauthorized') ||
      error.message.includes('authentication')
    ) {
      return {
        category: 'auth',
        message: 'Your session has expired. Please log in again.',
        recoverable: false,
      };
    }

    // Permission errors
    if (error.message.includes('403') || error.message.includes('Forbidden')) {
      return {
        category: 'permission',
        message: 'You don\'t have permission to perform this action.',
        recoverable: false,
      };
    }

    // Not found errors
    if (error.message.includes('404') || error.message.includes('Not Found')) {
      return {
        category: 'notFound',
        message: 'The requested resource was not found.',
        recoverable: false,
      };
    }

    // Server errors
    if (error.message.includes('500') || error.message.includes('Internal Server')) {
      return {
        category: 'server',
        message: 'A server error occurred. Our team has been notified.',
        recoverable: true,
      };
    }

    // Rate limiting
    if (error.message.includes('429') || error.message.includes('Too Many')) {
      return {
        category: 'rateLimit',
        message: 'Too many requests. Please wait a moment and try again.',
        recoverable: true,
      };
    }

    // Validation errors
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return {
        category: 'validation',
        message: error.message,
        recoverable: true,
      };
    }
  }

  return {
    category: 'unknown',
    message: 'An unexpected error occurred. Please try again.',
    recoverable: true,
  };
};

/**
 * Safe async wrapper with error handling
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  options?: {
    onError?: (error: Error) => void;
    fallback?: T;
    retries?: number;
    retryDelay?: number;
  }
): Promise<{ data: T | null; error: Error | null }> {
  const { onError, fallback, retries = 0, retryDelay = 1000 } = options || {};
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const data = await fn();
      return { data, error: null };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }

  onError?.(lastError!);
  return { data: fallback ?? null, error: lastError };
}

/**
 * Hook for async operations with error handling
 */
export function useAsyncError() {
  const [error, setError] = useState<Error | null>(null);

  const throwError = useCallback((e: Error) => {
    setError(e);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { error, throwError, clearError };
}

/**
 * Create standardized API error
 */
export class APIError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    code: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      details: this.details,
    };
  }
}

// ============================================================================
// INLINE ERROR DISPLAY
// ============================================================================

interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const InlineError: React.FC<InlineErrorProps> = ({
  message,
  onRetry,
  className,
}) => (
  <div
    className={cn(
      'flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg',
      className
    )}
  >
    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
    <p className="text-sm text-red-400 flex-1">{message}</p>
    {onRetry && (
      <Button variant="ghost" size="sm" onClick={onRetry} className="text-red-400 hover:text-red-300">
        <RefreshCw className="w-4 h-4" />
      </Button>
    )}
  </div>
);

export default ErrorBoundary;
