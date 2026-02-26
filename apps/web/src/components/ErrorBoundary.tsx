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
    retryCount: number;
}

const MAX_RETRIES = 3;

/**
 * Error boundary to catch and handle component errors gracefully
 * Prevents entire app from crashing on component errors
 * Now with retry capability and better recovery options
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            retryCount: 0,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.setState({
            error,
            errorInfo,
        });

        // Log error for debugging
        console.error('[ErrorBoundary] Caught error:', error);
        console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

        // Call parent error handler if provided
        this.props.onError?.(error, errorInfo);
    }

    handleRetry = () => {
        const newRetryCount = this.state.retryCount + 1;

        if (newRetryCount >= MAX_RETRIES) {
            console.warn('[ErrorBoundary] Max retries reached, reloading page');
            window.location.reload();
            return;
        }

        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            retryCount: newRetryCount,
        });
    };

    handleClearAndReload = () => {
        try {
            localStorage.removeItem('beamlab_project');
            localStorage.removeItem('beamlab_project_backup');
            console.log('[ErrorBoundary] Cleared saved project data');
        } catch (e) {
            console.error('[ErrorBoundary] Failed to clear storage:', e);
        }
        window.location.reload();
    };

    handleExportError = () => {
        const errorReport = {
            timestamp: new Date().toISOString(),
            error: {
                name: this.state.error?.name,
                message: this.state.error?.message,
                stack: this.state.error?.stack
            },
            componentStack: this.state.errorInfo?.componentStack,
            userAgent: navigator.userAgent,
            url: window.location.href,
            retryCount: this.state.retryCount
        };

        const blob = new Blob([JSON.stringify(errorReport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `beamlab-error-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    override render(): React.ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback as ReactElement;
            }

            const isMemoryError = this.state.error?.message?.toLowerCase().includes('memory') ||
                                  this.state.error?.message?.toLowerCase().includes('oom');
            const isRenderError = this.state.error?.message?.toLowerCase().includes('webgl') ||
                                  this.state.error?.message?.toLowerCase().includes('three');

            return (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(4px)',
                }}>
                    <div style={{
                        maxWidth: '500px',
                        width: '90%',
                        backgroundColor: '#1e293b',
                        borderRadius: '12px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        border: '1px solid #334155',
                        overflow: 'hidden',
                    }}>
                        {/* Header */}
                        <div style={{
                            background: 'linear-gradient(135deg, #dc2626, #ea580c)',
                            padding: '16px 24px',
                        }}>
                            <h2 style={{ color: 'white', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                                ⚠️ Something went wrong
                            </h2>
                            <p style={{ color: '#fecaca', margin: '4px 0 0', fontSize: '14px' }}>
                                Don't worry - your work can be recovered
                            </p>
                        </div>

                        {/* Content */}
                        <div style={{ padding: '24px' }}>
                            {/* Error Message */}
                            <div style={{
                                backgroundColor: '#0f172a',
                                borderRadius: '8px',
                                padding: '12px',
                                border: '1px solid #334155',
                                marginBottom: '16px',
                            }}>
                                <p style={{ color: '#94a3b8', fontSize: '13px', fontFamily: 'monospace', margin: 0, wordBreak: 'break-word' }}>
                                    {this.state.error?.message || 'Unknown error occurred'}
                                </p>
                            </div>

                            {/* Tips */}
                            {isMemoryError && (
                                <div style={{
                                    backgroundColor: 'rgba(217, 119, 6, 0.2)',
                                    border: '1px solid rgba(217, 119, 6, 0.5)',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    marginBottom: '16px',
                                }}>
                                    <p style={{ color: '#fcd34d', fontSize: '13px', margin: 0 }}>
                                        <strong>Memory Issue:</strong> Try closing other tabs or using a smaller model.
                                    </p>
                                </div>
                            )}

                            {isRenderError && (
                                <div style={{
                                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                    border: '1px solid rgba(59, 130, 246, 0.5)',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    marginBottom: '16px',
                                }}>
                                    <p style={{ color: '#93c5fd', fontSize: '13px', margin: 0 }}>
                                        <strong>Rendering Issue:</strong> Your browser may need hardware acceleration enabled.
                                    </p>
                                </div>
                            )}

                            {this.state.retryCount > 0 && (
                                <p style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', marginBottom: '16px' }}>
                                    Retry {this.state.retryCount} of {MAX_RETRIES}
                                </p>
                            )}

                            {/* Buttons */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <button
                                    onClick={this.handleRetry}
                                    style={{
                                        padding: '12px',
                                        backgroundColor: '#2563eb',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: '500',
                                        fontSize: '14px',
                                    }}
                                >
                                    🔄 Try Again
                                </button>
                                <button
                                    onClick={this.handleClearAndReload}
                                    style={{
                                        padding: '12px',
                                        backgroundColor: '#ea580c',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: '500',
                                        fontSize: '14px',
                                    }}
                                >
                                    🗑️ Clear & Restart
                                </button>
                            </div>

                            <button
                                onClick={this.handleExportError}
                                style={{
                                    width: '100%',
                                    marginTop: '12px',
                                    padding: '10px',
                                    backgroundColor: '#334155',
                                    color: '#94a3b8',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                }}
                            >
                                📥 Export Error Report
                            </button>
                        </div>
                    </div>
                </div>
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
