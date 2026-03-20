import React, { ReactNode, ReactElement } from 'react';
import { uiLogger } from '../lib/logging/logger';

// ============================================
// TYPES
// ============================================

interface SectionErrorBoundaryProps {
  children: ReactNode;
  /** Label for the section being wrapped (e.g. "3D Viewer", "Analysis Panel"). */
  section: string;
  /** Optional custom fallback UI. */
  fallback?: ReactNode;
  /** Called with the caught error for external logging. */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================
// CLASS COMPONENT (required by React error boundary API)
// ============================================

/**
 * Lightweight, inline error boundary for wrapping subsections of the app.
 * Unlike the full-screen ErrorBoundary, this renders a compact error card
 * inline so the rest of the page remains usable.
 */
export class SectionErrorBoundaryClass extends React.Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<SectionErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    uiLogger.error('SectionErrorBoundary caught error', {
      section: this.props.section,
      error: error.message,
      stack: error.stack,
    });
    uiLogger.error('SectionErrorBoundary component stack', {
      section: this.props.section,
      componentStack: errorInfo.componentStack,
    });

    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  override render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children as ReactElement;
    }

    if (this.props.fallback) {
      return this.props.fallback as ReactElement;
    }

    return (
      <div className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800/90 p-6">
        <div className="w-full max-w-sm space-y-3 text-center">
          <div className="text-2xl">⚠️</div>
          <h3 className="text-sm font-semibold text-slate-200">
            {this.props.section} failed to load
          </h3>
          <p className="text-xs text-slate-400">
            {this.state.error?.message || 'An unexpected error occurred in this section.'}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium tracking-wide tracking-wide text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }
}

// ============================================
// CONVENIENCE WRAPPER (function component)
// ============================================

/**
 * Convenience function-component wrapper around SectionErrorBoundaryClass.
 *
 * @example
 * <SectionErrorBoundary section="3D Viewer">
 *   <Canvas>...</Canvas>
 * </SectionErrorBoundary>
 */
export function SectionErrorBoundary(props: SectionErrorBoundaryProps) {
  return <SectionErrorBoundaryClass {...props} />;
}

export default SectionErrorBoundary;
