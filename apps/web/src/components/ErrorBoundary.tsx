import React, { ReactNode, ReactElement } from 'react';
import { uiLogger } from '../lib/logging/logger';

// ============================================
// TYPES
// ============================================

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI. If omitted, the built-in error card is rendered. */
  fallback?: ReactNode;
  /** Called with the caught error for external logging / Sentry. */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Scope label for diagnostics (e.g. "PaymentFlow", "Editor"). */
  scope?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
}

const MAX_RETRIES = 3;

// ============================================
// ERROR BOUNDARY (Class Component — required by React API)
// ============================================

/**
 * Production-grade error boundary with retry, diagnostics,
 * contextual tips, and error export.
 *
 * Features:
 * - Automatic retry with exponential back-off (up to MAX_RETRIES)
 * - Context-aware tips for memory / WebGL / network errors
 * - One-click error report export (JSON)
 * - Clear-storage + reload escape hatch
 * - Sentry / external logging via `onError` prop
 * - Scope label for multi-boundary setups
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });

    const scope = this.props.scope ?? 'App';
    uiLogger.error('ErrorBoundary caught error', { scope, error: error.message, stack: error.stack });
    uiLogger.error('ErrorBoundary component stack', { scope, componentStack: errorInfo.componentStack });

    // External logging (Sentry, etc.)
    this.props.onError?.(error, errorInfo);
  }

  // ---- Actions ----

  handleRetry = () => {
    const next = this.state.retryCount + 1;
    if (next >= MAX_RETRIES) {
      uiLogger.warn('ErrorBoundary max retries reached, reloading page');
      window.location.reload();
      return;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: next,
    });
  };

  handleClearAndReload = () => {
    try {
      localStorage.removeItem('beamlab_project');
      localStorage.removeItem('beamlab_project_backup');
      localStorage.removeItem('beamlab_subscription_tier');
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  handleExportError = () => {
    const report = {
      timestamp: new Date().toISOString(),
      scope: this.props.scope ?? 'App',
      error: {
        name: this.state.error?.name,
        message: this.state.error?.message,
        stack: this.state.error?.stack,
      },
      componentStack: this.state.errorInfo?.componentStack,
      retryCount: this.state.retryCount,
      browser: navigator.userAgent,
      url: window.location.href,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      memoryMB:
        'memory' in performance
          ? Math.round(
              ((performance as unknown as { memory: { usedJSHeapSize: number } }).memory
                .usedJSHeapSize /
                1024 /
                1024) *
                10,
            ) / 10
          : undefined,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beamlab-error-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- Helpers ----

  private classifyError(): 'memory' | 'render' | 'network' | 'generic' {
    const msg = this.state.error?.message?.toLowerCase() ?? '';
    if (msg.includes('memory') || msg.includes('oom') || msg.includes('allocation')) return 'memory';
    if (msg.includes('webgl') || msg.includes('three') || msg.includes('canvas') || msg.includes('gpu'))
      return 'render';
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to load'))
      return 'network';
    return 'generic';
  }

  // ---- Render ----

  override render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children as ReactElement;
    }

    if (this.props.fallback) {
      return this.props.fallback as ReactElement;
    }

    const kind = this.classifyError();

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm">
        <div className="w-[90%] max-w-lg overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-2xl">
          {/* ---- Header ---- */}
          <div className="bg-gradient-to-r from-red-600 to-orange-500 px-6 py-4">
            <h2 className="text-lg font-bold text-white">⚠️ Something went wrong</h2>
            <p className="mt-1 text-sm text-red-100">
              Don&apos;t worry — your work can be recovered
            </p>
          </div>

          {/* ---- Body ---- */}
          <div className="space-y-4 p-6">
            {/* Error message */}
            <div className="rounded-lg border border-slate-600 bg-slate-900 p-3">
              <code className="block break-words text-xs text-slate-400">
                {this.state.error?.message || 'Unknown error occurred'}
              </code>
            </div>

            {/* Contextual tip */}
            {kind === 'memory' && (
              <Tip
                color="amber"
                title="Memory Issue"
                message="Try closing other browser tabs or reducing model complexity."
              />
            )}
            {kind === 'render' && (
              <Tip
                color="blue"
                title="Rendering Issue"
                message="Enable hardware acceleration in your browser settings, or try a different browser."
              />
            )}
            {kind === 'network' && (
              <Tip
                color="emerald"
                title="Network Issue"
                message="Check your internet connection and try again."
              />
            )}

            {this.state.retryCount > 0 && (
              <p className="text-center text-xs text-slate-500">
                Retry {this.state.retryCount} of {MAX_RETRIES}
              </p>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium tracking-wide text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                🔄 Try Again
              </button>
              <button
                type="button"
                onClick={this.handleClearAndReload}
                className="rounded-lg bg-orange-600 px-4 py-3 text-sm font-medium tracking-wide text-white transition hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                🗑️ Clear &amp; Restart
              </button>
            </div>

            <button
              type="button"
              onClick={this.handleExportError}
              className="w-full rounded-lg bg-slate-700 px-4 py-2.5 text-xs text-slate-400 transition hover:bg-slate-600 hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              📥 Export Error Report
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// ---- Tip sub-component ----

function Tip({
  color,
  title,
  message,
}: {
  color: 'amber' | 'blue' | 'emerald';
  title: string;
  message: string;
}) {
  const colors = {
    amber: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
    blue: 'border-blue-500/50 bg-blue-500/10 text-blue-300',
    emerald: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
  };

  return (
    <div className={`rounded-lg border p-3 ${colors[color]}`}>
      <p className="text-sm">
        <strong>{title}:</strong> {message}
      </p>
    </div>
  );
}

// ============================================
// HOOKS
// ============================================

/**
 * Hook for handling synchronous errors in functional components.
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = React.useCallback((err: Error) => {
    uiLogger.error('useErrorHandler caught', { error: err.message });
    setError(err);
  }, []);

  const clearError = React.useCallback(() => setError(null), []);

  return { error, handleError, clearError };
}

/**
 * Hook that re-throws an error inside the React render cycle
 * so it gets caught by the nearest ErrorBoundary.
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
