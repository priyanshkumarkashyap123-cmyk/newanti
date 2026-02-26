/**
 * ErrorBoundary Component
 * Catches React errors and displays a friendly error UI
 */

import { Component, ReactNode, ErrorInfo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home, Bug, Copy, Check } from 'lucide-react';
import { useState } from 'react';

// ============================================
// Error Boundary Class Component
// ============================================

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
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

        // Log to console in development
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
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
                    onRetry={this.handleRetry}
                />
            );
        }

        return this.props.children;
    }
}

// ============================================
// Error Fallback UI
// ============================================

interface ErrorFallbackProps {
    error: Error | null;
    errorInfo: ErrorInfo | null;
    onRetry: () => void;
}

const ErrorFallback = ({ error, errorInfo, onRetry }: ErrorFallbackProps) => {
    const [copied, setCopied] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    const copyError = () => {
        const errorText = `Error: ${error?.message}\n\nStack: ${error?.stack}\n\nComponent Stack: ${errorInfo?.componentStack}`;
        navigator.clipboard.writeText(errorText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl"
            >
                {/* Header */}
                <div className="bg-red-500/10 border-b border-red-500/20 p-6">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center"
                    >
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                    </motion.div>
                    <h1 className="text-2xl font-bold text-white text-center">
                        Something went wrong
                    </h1>
                    <p className="text-red-300/70 text-center mt-2 text-sm">
                        An unexpected error occurred. Don't worry, your data is safe.
                    </p>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Error Message */}
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                        <p className="text-sm text-slate-400 font-mono break-all">
                            {error?.message || 'Unknown error'}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={onRetry}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Try Again
                        </button>
                        <a
                            href="/"
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors"
                        >
                            <Home className="w-4 h-4" />
                            Home
                        </a>
                    </div>

                    {/* Show Details Toggle */}
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-400 transition-colors"
                    >
                        <Bug className="w-4 h-4" />
                        {showDetails ? 'Hide' : 'Show'} technical details
                    </button>

                    {/* Technical Details */}
                    {showDetails && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="space-y-3"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400 uppercase tracking-wider">
                                    Stack Trace
                                </span>
                                <button
                                    onClick={copyError}
                                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-3 h-3" />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3 h-3" />
                                            Copy
                                        </>
                                    )}
                                </button>
                            </div>
                            <pre className="p-3 bg-slate-950 rounded-lg text-xs text-slate-400 font-mono overflow-x-auto max-h-40 overflow-y-auto">
                                {error?.stack}
                            </pre>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

// ============================================
// Inline Error Message
// ============================================

interface InlineErrorProps {
    message: string;
    className?: string;
}

export const InlineError = ({ message, className = '' }: InlineErrorProps) => (
    <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        className={`flex items-center gap-2 text-sm text-red-400 ${className}`}
    >
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span>{message}</span>
    </motion.div>
);

// ============================================
// Error Toast with Shake
// ============================================

interface ErrorToastProps {
    message: string;
    isVisible: boolean;
    onDismiss?: () => void;
}

export const ErrorToast = ({ message, isVisible, onDismiss }: ErrorToastProps) => (
    <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={isVisible ? {
            opacity: 1,
            y: 0,
            scale: 1,
            x: [0, -5, 5, -5, 5, 0], // Shake animation
        } : { opacity: 0, y: 50, scale: 0.9 }}
        transition={{ duration: 0.4 }}
        className={`
            fixed bottom-8 left-1/2 -translate-x-1/2 z-50
            flex items-center gap-3 px-5 py-4 rounded-xl
            bg-red-500/10 border border-red-500/30 backdrop-blur-md shadow-xl
            ${isVisible ? '' : 'pointer-events-none'}
        `}
    >
        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
        <span className="text-red-300 font-medium">{message}</span>
        {onDismiss && (
            <button
                onClick={onDismiss}
                className="ml-2 text-red-400/50 hover:text-red-400 transition-colors"
            >
                ✕
            </button>
        )}
    </motion.div>
);

export default ErrorBoundary;
