import React, { ReactNode, ReactElement } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

/**
 * Error boundary to catch and handle component errors gracefully
 * Prevents entire app from crashing on component errors
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.setState({
            error,
            errorInfo,
        });

        // Log error for debugging
        console.error('ErrorBoundary caught error:', error);
        console.error('Error info:', errorInfo);

        // Call parent error handler if provided
        this.props.onError?.(error, errorInfo);
    }

    render(): ReactElement {
        if (this.state.hasError) {
            return (
                this.props.fallback || (
                    <div style={{
                        padding: '20px',
                        margin: '10px',
                        border: '2px solid #ff6b6b',
                        borderRadius: '4px',
                        backgroundColor: '#ffe0e0',
                        color: '#c92a2a',
                    }}>
                        <h2>Something went wrong</h2>
                        <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
                            {this.state.error?.toString()}
                            {this.state.errorInfo?.componentStack}
                        </details>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                marginTop: '10px',
                                padding: '8px 16px',
                                backgroundColor: '#ff6b6b',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            Reload Page
                        </button>
                    </div>
                )
            );
        }

        return this.props.children as ReactElement;
    }
}

/**
 * Hook for handling async errors in functional components
 */
export function useErrorHandler() {
    const [error, setError] = React.useState<Error | null>(null);

    const handleError = React.useCallback((error: Error) => {
        console.error('Handled error:', error);
        setError(error);
    }, []);

    const clearError = React.useCallback(() => {
        setError(null);
    }, []);

    return { error, handleError, clearError };
}

/**
 * Hook for catching and handling promise rejections
 */
export function useAsyncError() {
    const [, setError] = React.useState();

    return React.useCallback(
        (error: Error) => {
            setError(() => {
                throw error;
            });
        },
        [setError],
    );
}
