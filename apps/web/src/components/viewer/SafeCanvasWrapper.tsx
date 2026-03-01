/**
 * SafeCanvasWrapper.tsx
 * 
 * Error boundary and memory protection wrapper for the 3D canvas.
 * Prevents "Oh Snap" crashes by:
 * 1. Catching rendering errors gracefully
 * 2. Monitoring memory usage
 * 3. Providing fallback UI
 * 4. Automatic recovery attempts
 */

import React, { Component, ReactNode, useState, useEffect, useCallback } from 'react';
import { useModelStore } from '../../store/model';

// ============================================
// TYPES
// ============================================

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
    retryCount: number;
}

interface SafeCanvasWrapperProps {
    children: ReactNode;
    fallback?: ReactNode;
    maxRetries?: number;
}

// ============================================
// MEMORY THRESHOLDS
// ============================================

const MEMORY_WARNING_MB = 500;
const MEMORY_CRITICAL_MB = 800;
const MAX_SAFE_MEMBERS = 100000;
const MAX_SAFE_NODES = 100000;

// ============================================
// ERROR BOUNDARY CLASS
// ============================================

export class CanvasErrorBoundary extends Component<SafeCanvasWrapperProps, ErrorBoundaryState> {
    constructor(props: SafeCanvasWrapperProps) {
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
        console.error('[CanvasErrorBoundary] Caught error:', error);
        console.error('[CanvasErrorBoundary] Error info:', errorInfo);
        
        this.setState({ errorInfo });
        
        // Log to analytics/monitoring in production
        if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'canvas_error', {
                error_message: error.message,
                component_stack: errorInfo.componentStack,
            });
        }
    }

    handleRetry = () => {
        const maxRetries = this.props.maxRetries ?? 3;
        
        if (this.state.retryCount < maxRetries) {
            this.setState((prevState) => ({
                hasError: false,
                error: null,
                errorInfo: null,
                retryCount: prevState.retryCount + 1,
            }));
        }
    };

    handleClearModel = () => {
        // Clear the model to free memory
        const store = useModelStore.getState();
        // Clear nodes and members to reset the model
        store.nodes.clear();
        store.members.clear();
        
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            retryCount: 0,
        });
    };

    override render() {
        const { hasError, error, retryCount } = this.state;
        const { children, fallback, maxRetries = 3 } = this.props;

        if (hasError) {
            // Custom fallback or default error UI
            if (fallback) {
                return fallback;
            }

            const errorMsg = error?.message?.toLowerCase() || '';
            const isMemoryError = errorMsg.includes('memory') || 
                                  errorMsg.includes('allocation') ||
                                  errorMsg.includes('out of');
            const isContextError = errorMsg.includes('webgl') ||
                                   errorMsg.includes('context') ||
                                   errorMsg.includes('gpu');

            const title = isMemoryError 
                ? 'Model Too Large' 
                : isContextError 
                    ? '3D Rendering Interrupted' 
                    : 'Rendering Error';

            const description = isMemoryError
                ? 'Your structure has too many elements for your device. Try reducing the model size or using a device with more memory.'
                : isContextError
                    ? 'The GPU context was lost or interrupted. This is usually a temporary issue — click Retry to resume.'
                    : 'Something went wrong while rendering the 3D view. This is usually a temporary glitch — click Retry to resume.';

            return (
                <div className="flex flex-col items-center justify-center h-full bg-gray-50 dark:bg-gray-900 text-slate-900 dark:text-white p-8">
                    <div className="max-w-lg text-center">
                        <div className="text-6xl mb-4">🏗️</div>
                        <h2 className="text-2xl font-bold mb-4">
                            {title}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">
                            {description}
                        </p>
                        
                        <div className="flex gap-4 justify-center flex-wrap">
                            {retryCount < maxRetries && (
                                <button
                                    onClick={this.handleRetry}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                                >
                                    Retry ({maxRetries - retryCount} left)
                                </button>
                            )}
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                            >
                                Reload Page
                            </button>
                            <button
                                onClick={this.handleClearModel}
                                className="px-6 py-2 bg-red-600/80 hover:bg-red-700 rounded-lg transition-colors"
                            >
                                Clear Model
                            </button>
                        </div>
                        
                        {error && (
                            <details className="mt-6 text-left">
                                <summary className="cursor-pointer text-gray-500 hover:text-gray-400">
                                    Technical Details
                                </summary>
                                <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto max-h-40">
                                    {error.message}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return children;
    }
}

// ============================================
// MEMORY MONITOR HOOK
// ============================================

export function useMemoryMonitor() {
    const [memoryStatus, setMemoryStatus] = useState<'ok' | 'warning' | 'critical'>('ok');
    const [memoryUsage, setMemoryUsage] = useState<number>(0);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const checkMemory = () => {
            // Check browser memory API if available
            if ('memory' in performance) {
                const memory = (performance as any).memory;
                const usedMB = memory.usedJSHeapSize / (1024 * 1024);
                setMemoryUsage(Math.round(usedMB));
                
                if (usedMB > MEMORY_CRITICAL_MB) {
                    setMemoryStatus('critical');
                    console.warn(`[MemoryMonitor] CRITICAL: ${usedMB.toFixed(0)}MB used`);
                } else if (usedMB > MEMORY_WARNING_MB) {
                    setMemoryStatus('warning');
                } else {
                    setMemoryStatus('ok');
                }
            }
        };

        // Check every 5 seconds
        const interval = setInterval(checkMemory, 5000);
        checkMemory(); // Initial check

        return () => clearInterval(interval);
    }, []);

    return { memoryStatus, memoryUsage };
}

// ============================================
// MODEL SIZE CHECK HOOK
// ============================================

export function useModelSizeCheck() {
    const members = useModelStore((state) => state.members);
    const nodes = useModelStore((state) => state.nodes);

    const memberCount = members.size;
    const nodeCount = nodes.size;

    const isSafe = memberCount <= MAX_SAFE_MEMBERS && nodeCount <= MAX_SAFE_NODES;
    const isLarge = memberCount > 10000 || nodeCount > 10000;
    const isVeryLarge = memberCount > 30000 || nodeCount > 30000;
    const isExtreme = memberCount > 50000 || nodeCount > 50000;

    return {
        memberCount,
        nodeCount,
        totalElements: memberCount + nodeCount,
        isSafe,
        isLarge,
        isVeryLarge,
        isExtreme,
        recommendation: isExtreme
            ? 'Consider splitting into multiple models'
            : isVeryLarge
            ? 'Performance may be reduced'
            : isLarge
            ? 'Using optimized rendering'
            : 'Normal performance mode',
    };
}

// ============================================
// PERFORMANCE WARNING COMPONENT
// ============================================

export const PerformanceWarning: React.FC = () => {
    const { isVeryLarge, isExtreme, memberCount, nodeCount, recommendation } = useModelSizeCheck();
    const { memoryStatus, memoryUsage } = useMemoryMonitor();
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) return null;
    if (!isVeryLarge && memoryStatus === 'ok') return null;

    return (
        <div className={`fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg ${
            isExtreme || memoryStatus === 'critical'
                ? 'bg-red-900/90 border border-red-500'
                : 'bg-yellow-900/90 border border-yellow-500'
        }`}>
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        {isExtreme || memoryStatus === 'critical' ? '⚠️ Performance Warning' : '📊 Large Model'}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {memberCount.toLocaleString()} members, {nodeCount.toLocaleString()} nodes
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{recommendation}</p>
                    {memoryStatus !== 'ok' && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Memory: {memoryUsage}MB ({memoryStatus})
                        </p>
                    )}
                </div>
                <button
                    onClick={() => setDismissed(true)}
                    className="text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                >
                    ✕
                </button>
            </div>
        </div>
    );
};

// ============================================
// SAFE CANVAS WRAPPER (combines error boundary + monitoring)
// ============================================

export const SafeCanvasWrapper: React.FC<SafeCanvasWrapperProps> = ({ children, ...props }) => {
    return (
        <CanvasErrorBoundary {...props}>
            <PerformanceWarning />
            {children}
        </CanvasErrorBoundary>
    );
};

export default SafeCanvasWrapper;
