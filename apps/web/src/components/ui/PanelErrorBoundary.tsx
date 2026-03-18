/**
 * PanelErrorBoundary - Shared ErrorBoundary for high-risk panel components
 *
 * Catches uncaught exceptions in Three.js canvas, analysis panels, and AI panels
 * and renders a graceful fallback UI instead of crashing the entire React tree.
 */

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// ============================================
// FALLBACK COMPONENTS
// ============================================

export const CanvasFallback = ({ onReload }: { onReload: () => void }) => (
    <div className="flex flex-col items-center justify-center h-full gap-4 bg-slate-900 text-white p-8">
        <AlertTriangle className="w-12 h-12 text-amber-400" />
        <div className="text-center">
            <p className="text-lg font-semibold">3D Canvas Error</p>
            <p className="text-sm text-slate-400 mt-1">The 3D renderer encountered an unexpected error.</p>
        </div>
        <button
            type="button"
            onClick={onReload}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm font-medium"
        >
            <RefreshCw className="w-4 h-4" />
            Reload Canvas
        </button>
    </div>
);

export const PanelFallback = ({ name }: { name: string }) => (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400" />
        <div>
            <p className="font-semibold text-slate-900 dark:text-white">{name} Error</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                This panel encountered an unexpected error. Try refreshing the page.
            </p>
        </div>
        <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors text-sm"
        >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Page
        </button>
    </div>
);

// ============================================
// ERROR BOUNDARY
// ============================================

interface ErrorBoundaryProps {
    fallback: ReactNode;
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class PanelErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    // @ts-ignore
    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[PanelErrorBoundary] Caught error:', error, info.componentStack);
    }

    // @ts-ignore
    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }
        return this.props.children;
    }
}

export default PanelErrorBoundary;
