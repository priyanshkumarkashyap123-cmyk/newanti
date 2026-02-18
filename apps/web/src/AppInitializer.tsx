/**
 * AppInitializer.tsx - Application Initialization
 * 
 * CEO-level initialization that wires all services,
 * sets up error handling, and prepares the application.
 */

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { beamlab, errorHandler, ERROR_CODES } from './services/ServiceRegistry';

// ============================================
// TYPES
// ============================================

interface AppState {
    initialized: boolean;
    loading: boolean;
    error: string | null;
    services: typeof beamlab;
}

interface AppContextValue extends AppState {
    reinitialize: () => Promise<void>;
}

// ============================================
// CONTEXT
// ============================================

const AppContext = createContext<AppContextValue | null>(null);

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within AppProvider');
    }
    return context;
};

// ============================================
// PROVIDER
// ============================================

interface AppProviderProps {
    children: ReactNode;
}

// List of public routes that don't require initialization
const PUBLIC_PATHS = [
    '/',
    '/pricing',
    '/capabilities',
    '/about',
    '/contact',
    '/help',
    '/privacy',
    '/terms',
    '/sign-in',
    '/sign-up',
    '/forgot-password',
    '/reset-password',
    '/workspace-demo',
    '/rust-wasm-demo',
    '/demo',
    '/worker-test',
    '/ai-dashboard',
    '/ai-power',
    '/privacy-policy',
    '/terms-of-service'
];

const isPublicRoute = (pathname: string): boolean => {
    return PUBLIC_PATHS.some(path =>
        pathname === path || (path !== '/' && pathname.startsWith(path + '/'))
    );
};

export const AppProvider = ({ children }: AppProviderProps) => {
    const location = useLocation();
    const [state, setState] = useState<AppState>({
        initialized: false,
        loading: true, // Default to true so children don't render before init completes
        error: null,
        services: beamlab
    });

    const initialize = async () => {
        console.log('[BeamLab] 🚀 Initializing application...');

        try {
            // 1. Initialize error handling listeners
            errorHandler.onError((error) => {
                console.error(`[${error.code}] ${error.userMessage}`);

                // Show toast for user-facing errors
                if (error.severity === 'error' || error.severity === 'critical') {
                    // You can integrate with a toast library here
                    window.dispatchEvent(new CustomEvent('app:error', {
                        detail: error
                    }));
                }
            });

            // 2. Initialize core services
            await beamlab.initialize();

            // 3. Register global event handlers
            registerGlobalHandlers();

            // 4. Load user preferences
            await loadUserPreferences();

            // 5. Mark as initialized
            setState(prev => ({
                ...prev,
                initialized: true,
                loading: false
            }));

            console.log('[BeamLab] ✅ Application initialized successfully');

        } catch (error) {
            console.error('[BeamLab] ❌ Initialization failed:', error);

            setState(prev => ({
                ...prev,
                loading: false,
                error: 'Failed to initialize application. Please refresh the page.'
            }));
        }
    };

    const reinitialize = async () => {
        setState(prev => ({ ...prev, loading: true, error: null }));
        await initialize();
    };

    const isPublicPath = isPublicRoute(location.pathname);

    useEffect(() => {
        if (isPublicPath) {
            queueMicrotask(() => {
                setState(prev => ({ ...prev, loading: false, error: null }));
            });
            return;
        }
        // Use queueMicrotask to avoid synchronous setState in effect
        queueMicrotask(() => {
            initialize();
        });
    }, [isPublicPath]);

    return (
        <AppContext.Provider value={{ ...state, reinitialize }}>
            {isPublicPath ? (
                children
            ) : state.loading ? (
                <LoadingScreen />
            ) : state.error ? (
                <ErrorScreen error={state.error} onRetry={reinitialize} />
            ) : (
                children
            )}
        </AppContext.Provider>
    );
};

// ============================================
// GLOBAL EVENT HANDLERS
// ============================================

// Track AbortController for global handlers to prevent duplicate registration
let globalHandlersAbort: AbortController | null = null;

function registerGlobalHandlers() {
    // Abort previous listeners to prevent duplicates on reinitialize
    globalHandlersAbort?.abort();
    globalHandlersAbort = new AbortController();
    const { signal } = globalHandlersAbort;

    // Analysis trigger
    window.addEventListener('triggerAnalysis', async () => {
        try {
            const model = (window as any).__beamlab_model__;
            if (!model) return;
            const nodes = Array.from(model.nodes?.values?.() || []) as any[];
            const members = Array.from(model.members?.values?.() || []) as any[];
            const supports = nodes.filter((n: any) => n?.restraints);
            const result = await beamlab.solver.analyze(nodes, members, model.memberLoads || [], supports);
            window.dispatchEvent(new CustomEvent('analysisComplete', {
                detail: result
            }));
        } catch (error) {
            errorHandler.createError(
                error as Error,
                'analysis',
                ERROR_CODES.ANALYSIS_CONVERGENCE_FAILED
            );
        }
    }, { signal });

    // Voice command execution
    window.addEventListener('voiceCommand', async (e: any) => {
        const transcript = e.detail?.transcript;
        if (transcript) {
            const result = await beamlab.voiceCommands.execute(transcript);
            window.dispatchEvent(new CustomEvent('voiceResult', {
                detail: result
            }));
        }
    }, { signal });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
        // Ctrl+S - Save
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('app:save'));
        }
        // Ctrl+Z - Undo
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('app:undo'));
        }
        // Ctrl+Shift+Z or Ctrl+Y - Redo
        if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('app:redo'));
        }
        // F5 - Run Analysis
        if (e.key === 'F5') {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('triggerAnalysis'));
        }
    }, { signal });

    console.log('[BeamLab] Global event handlers registered');
}

// ============================================
// USER PREFERENCES
// ============================================

async function loadUserPreferences() {
    try {
        const prefs = localStorage.getItem('beamlab_preferences');
        if (prefs) {
            const parsed = JSON.parse(prefs);
            // Apply preferences
            if (parsed.theme === 'light') {
                document.documentElement.classList.add('light-theme');
            }
            if (parsed.units) {
                window.__beamlab_units__ = parsed.units;
            }
        }
    } catch (e) {
        console.warn('[BeamLab] Failed to load preferences:', e);
    }
}

// ============================================
// UI COMPONENTS
// ============================================

const LoadingScreen = () => (
    <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2f 100%)',
        color: '#fff'
    }}>
        <div style={{
            width: 60,
            height: 60,
            border: '3px solid #333',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ marginTop: 24, opacity: 0.7 }}>Initializing BeamLab...</p>
    </div>
);

const ErrorScreen = ({
    error,
    onRetry
}: {
    error: string;
    onRetry: () => void;
}) => (
    <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0a0a0f',
        color: '#fff',
        textAlign: 'center',
        padding: 40
    }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ marginBottom: 16, color: '#ef4444' }}>Initialization Error</h1>
        <p style={{ opacity: 0.7, marginBottom: 24 }}>{error}</p>
        <button
            onClick={onRetry}
            style={{
                padding: '12px 24px',
                background: '#3b82f6',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 'bold'
            }}
        >
            Retry
        </button>
    </div>
);

// ============================================
// GLOBAL TYPE DECLARATIONS
// ============================================

declare global {
    interface Window {
        __beamlab_model__: any;
        __beamlab_units__: string;
        beamlab: typeof beamlab;
    }
}

// Expose beamlab globally for debugging
if (typeof window !== 'undefined') {
    window.beamlab = beamlab;
}

export default AppProvider;
