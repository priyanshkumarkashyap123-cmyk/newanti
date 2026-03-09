/**
 * AppInitializer.tsx - Application Initialization
 *
 * CEO-level initialization that wires all services,
 * sets up error handling, and prepares the application.
 */

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  createContext,
  useContext,
  ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import logger from "./lib/logger";
import { beamlab, errorHandler, ERROR_CODES } from "./services/ServiceRegistry";

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
    throw new Error("useApp must be used within AppProvider");
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
  "/",
  "/pricing",
  "/capabilities",
  "/about",
  "/contact",
  "/help",
  "/privacy",
  "/terms",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/workspace-demo",
  "/rust-wasm-demo",
  "/demo",
  "/worker-test",
  "/ai-dashboard",
  "/ai-power",
  "/privacy-policy",
  "/terms-of-service",
];

const isPublicRoute = (pathname: string): boolean => {
  return PUBLIC_PATHS.some(
    (path) =>
      pathname === path || (path !== "/" && pathname.startsWith(path + "/")),
  );
};

const normalizeError = (error: unknown): { message: string; stack?: string } => {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
};

export const AppProvider = ({ children }: AppProviderProps) => {
  const location = useLocation();
  const [state, setState] = useState<AppState>({
    initialized: false,
    loading: true, // Default to true so children don't render before init completes
    error: null,
    services: beamlab,
  });

  const initialize = async () => {
    logger.log("[BeamLab] 🚀 Initializing application...");

    try {
      // 1. Initialize error handling listeners
      errorHandler.onError((error) => {
        logger.error(`[${error.code}] ${error.userMessage}`);

        // Show toast for user-facing errors
        if (error.severity === "error" || error.severity === "critical") {
          // You can integrate with a toast library here
          window.dispatchEvent(
            new CustomEvent("app:error", {
              detail: error,
            }),
          );
        }
      });

      // 2. Initialize core services
      await beamlab.initialize();

      // 3. Register global event handlers
      registerGlobalHandlers();

      // 4. Load user preferences
      await loadUserPreferences();

      // 5. Mark as initialized
      setState((prev) => ({
        ...prev,
        initialized: true,
        loading: false,
      }));

      logger.log("[BeamLab] ✅ Application initialized successfully");
    } catch (error) {
      const normalized = normalizeError(error);
      logger.error("[BeamLab] ❌ Initialization failed:", {
        message: normalized.message,
        stack: normalized.stack,
      });

      errorHandler.createError(
        normalized.message,
        "unknown",
        ERROR_CODES.NETWORK_SERVER_ERROR,
        {
          source: "AppInitializer.initialize",
          stack: normalized.stack,
        },
      );

      window.dispatchEvent(
        new CustomEvent("app:initialization-failed", {
          detail: {
            message: normalized.message,
            stack: normalized.stack,
            timestamp: new Date().toISOString(),
          },
        }),
      );

      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Failed to initialize application. Please refresh the page.",
      }));
    }
  };

  const reinitialize = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    await initialize();
  }, []);

  const isPublicPath = isPublicRoute(location.pathname);

  useEffect(() => {
    if (isPublicPath) {
      queueMicrotask(() => {
        setState((prev) => ({ ...prev, loading: false, error: null }));
      });
      return;
    }
    // Use queueMicrotask to avoid synchronous setState in effect
    queueMicrotask(() => {
      initialize();
    });
  }, [isPublicPath]);

  const contextValue = useMemo<AppContextValue>(
    () => ({ ...state, reinitialize }),
    [state, reinitialize]
  );

  return (
    <AppContext.Provider value={contextValue}>
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
  window.addEventListener(
    "triggerAnalysis",
    async () => {
      try {
        const model = (window as any).__beamlab_model__;
        if (!model) return;
        const nodes = Array.from(model.nodes?.values?.() || []) as any[];
        const members = Array.from(model.members?.values?.() || []) as any[];
        const supports = nodes.filter((n: any) => n?.restraints);
        const result = await beamlab.solver.analyze(
          nodes,
          members,
          model.memberLoads || [],
          supports,
        );
        window.dispatchEvent(
          new CustomEvent("analysisComplete", {
            detail: result,
          }),
        );
      } catch (error) {
        errorHandler.createError(
          error as Error,
          "analysis",
          ERROR_CODES.ANALYSIS_CONVERGENCE_FAILED,
        );
      }
    },
    { signal },
  );

  // Voice command execution
  window.addEventListener(
    "voiceCommand",
    async (e: any) => {
      const transcript = e.detail?.transcript;
      if (transcript) {
        const result = await beamlab.voiceCommands.execute(transcript);
        window.dispatchEvent(
          new CustomEvent("voiceResult", {
            detail: result,
          }),
        );
      }
    },
    { signal },
  );

  // Keyboard shortcuts
  window.addEventListener(
    "keydown",
    (e) => {
      // Ctrl+S / Cmd+S - Save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("app:save"));
      }
      // Ctrl+Z / Cmd+Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("app:undo"));
      }
      // Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y / Cmd+Y - Redo
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") ||
        ((e.ctrlKey || e.metaKey) && e.key === "y")
      ) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("app:redo"));
      }
      // F5 - Run Analysis
      if (e.key === "F5") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("triggerAnalysis"));
      }
    },
    { signal },
  );

  logger.log("[BeamLab] Global event handlers registered");
}

// ============================================
// USER PREFERENCES
// ============================================

async function loadUserPreferences() {
  try {
    const prefs = localStorage.getItem("beamlab_preferences");
    if (prefs) {
      const parsed = JSON.parse(prefs);
      // Apply theme preference — ThemeProvider handles this via
      // the 'structural-ui-theme' localStorage key, but also support
      // the legacy 'beamlab_preferences' key for backward compat
      if (parsed.theme === "light") {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
        document.documentElement.classList.add("dark");
      }
      if (parsed.units) {
        window.__beamlab_units__ = parsed.units;
      }
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[BeamLab] Failed to load preferences:", e);
  }
}

// ============================================
// UI COMPONENTS
// ============================================

const LoadingScreen = () => (
  <div
    className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-white"
  >
    <div
      className="w-[60px] h-[60px] border-[3px] border-gray-700 border-t-blue-500 rounded-full animate-spin"
    />
    <p className="mt-6 opacity-70">Initializing BeamLab...</p>
  </div>
);

const ErrorScreen = ({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) => (
  <div
    className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white text-center p-10"
  >
    <div className="text-5xl mb-4">⚠️</div>
    <h1 className="mb-4 text-red-500">Initialization Error</h1>
    <p className="opacity-70 mb-6">{error}</p>
    <button type="button"
      onClick={onRetry}
      className="px-6 py-3 bg-blue-500 border-none rounded-lg text-white cursor-pointer font-bold hover:bg-blue-600"
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

// Expose beamlab globally for debugging (dev only)
if (typeof window !== "undefined" && import.meta.env.DEV) {
  window.beamlab = beamlab;
}

export default AppProvider;
