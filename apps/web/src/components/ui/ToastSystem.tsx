/**
 * ============================================================================
 * NOTIFICATION/TOAST SYSTEM
 * ============================================================================
 * 
 * Industry-standard notification system with:
 * - Toast notifications with queueing
 * - Multiple positions
 * - Stacking and limits
 * - Pause on hover
 * - Actions in toasts
 * - Accessibility (ARIA live regions)
 * - Promise-based notifications
 * - Custom renderers
 * 
 * @version 1.0.0
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
  FC,
} from 'react';
import { announce } from '@/utils/accessibility';
import { prefersReducedMotion } from '@/utils/accessibility';

// ============================================================================
// TYPES
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';
export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  position?: ToastPosition;
  dismissible?: boolean;
  action?: ToastAction;
  icon?: ReactNode;
  onDismiss?: () => void;
  pauseOnHover?: boolean;
  createdAt: number;
  progress?: number;
}

export interface ToastOptions extends Omit<Toast, 'id' | 'createdAt'> {}

export interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: ToastOptions) => string;
  removeToast: (id: string) => void;
  removeAllToasts: () => void;
  updateToast: (id: string, updates: Partial<ToastOptions>) => void;
  
  // Convenience methods
  success: (message: string, options?: Partial<ToastOptions>) => string;
  error: (message: string, options?: Partial<ToastOptions>) => string;
  warning: (message: string, options?: Partial<ToastOptions>) => string;
  info: (message: string, options?: Partial<ToastOptions>) => string;
  loading: (message: string, options?: Partial<ToastOptions>) => string;
  
  // Promise-based
  promise: <T>(
    promise: Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: Error) => string);
    }
  ) => Promise<T>;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_DURATION = 5000;
const MAX_TOASTS = 5;
const TOAST_GAP = 12;

const DEFAULT_TOAST_OPTIONS: Partial<ToastOptions> = {
  type: 'info',
  duration: DEFAULT_DURATION,
  position: 'bottom-right',
  dismissible: true,
  pauseOnHover: true,
};

// ============================================================================
// CONTEXT
// ============================================================================

const ToastContext = createContext<ToastContextValue | null>(null);

// ============================================================================
// TOAST PROVIDER
// ============================================================================

export interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number;
  defaultPosition?: ToastPosition;
  defaultDuration?: number;
}

export const ToastProvider: FC<ToastProviderProps> = ({
  children,
  maxToasts = MAX_TOASTS,
  defaultPosition = 'bottom-right',
  defaultDuration = DEFAULT_DURATION,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Generate unique ID
  const generateId = useCallback(() => {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Clear timer for a toast
  const clearTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  // Set timer for auto-dismiss
  const setTimer = useCallback((id: string, duration: number) => {
    clearTimer(id);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timersRef.current.delete(id);
    }, duration);
    timersRef.current.set(id, timer);
  }, [clearTimer]);

  // Add toast
  const addToast = useCallback(
    (options: ToastOptions): string => {
      const id = generateId();
      const toast: Toast = {
        ...DEFAULT_TOAST_OPTIONS,
        position: defaultPosition,
        duration: defaultDuration,
        ...options,
        id,
        createdAt: Date.now(),
      };

      setToasts((prev) => {
        // Remove oldest if at limit
        const updated = prev.length >= maxToasts ? prev.slice(1) : prev;
        return [...updated, toast];
      });

      // Announce to screen readers
      const ariaRole = toast.type === 'error' ? 'assertive' : 'polite';
      announce(
        toast.title ? `${toast.title}: ${toast.message}` : toast.message,
        ariaRole
      );

      // Set auto-dismiss timer
      if (toast.duration && toast.duration > 0 && toast.type !== 'loading') {
        setTimer(id, toast.duration);
      }

      return id;
    },
    [generateId, defaultPosition, defaultDuration, maxToasts, setTimer]
  );

  // Remove toast
  const removeToast = useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((prev) => {
        const toast = prev.find((t) => t.id === id);
        toast?.onDismiss?.();
        return prev.filter((t) => t.id !== id);
      });
    },
    [clearTimer]
  );

  // Remove all toasts
  const removeAllToasts = useCallback(() => {
    timersRef.current.forEach((_, id) => clearTimer(id));
    setToasts([]);
  }, [clearTimer]);

  // Update toast
  const updateToast = useCallback(
    (id: string, updates: Partial<ToastOptions>) => {
      setToasts((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          
          const updated = { ...t, ...updates };
          
          // Reset timer if duration changed
          if (updates.duration && updates.type !== 'loading') {
            setTimer(id, updates.duration);
          }
          
          return updated;
        })
      );
    },
    [setTimer]
  );

  // Convenience methods
  const success = useCallback(
    (message: string, options?: Partial<ToastOptions>) =>
      addToast({ ...options, type: 'success', message }),
    [addToast]
  );

  const error = useCallback(
    (message: string, options?: Partial<ToastOptions>) =>
      addToast({ ...options, type: 'error', message, duration: options?.duration ?? 8000 }),
    [addToast]
  );

  const warning = useCallback(
    (message: string, options?: Partial<ToastOptions>) =>
      addToast({ ...options, type: 'warning', message }),
    [addToast]
  );

  const info = useCallback(
    (message: string, options?: Partial<ToastOptions>) =>
      addToast({ ...options, type: 'info', message }),
    [addToast]
  );

  const loading = useCallback(
    (message: string, options?: Partial<ToastOptions>) =>
      addToast({ ...options, type: 'loading', message, dismissible: false }),
    [addToast]
  );

  // Promise-based toast
  const promiseToast = useCallback(
    async <T,>(
      promise: Promise<T>,
      options: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((err: Error) => string);
      }
    ): Promise<T> => {
      const id = addToast({
        type: 'loading',
        message: options.loading,
        dismissible: false,
      });

      try {
        const result = await promise;
        const successMessage =
          typeof options.success === 'function'
            ? options.success(result)
            : options.success;

        updateToast(id, {
          type: 'success',
          message: successMessage,
          dismissible: true,
          duration: DEFAULT_DURATION,
        });

        return result;
      } catch (err) {
        const errorMessage =
          typeof options.error === 'function'
            ? options.error(err as Error)
            : options.error;

        updateToast(id, {
          type: 'error',
          message: errorMessage,
          dismissible: true,
          duration: 8000,
        });

        throw err;
      }
    },
    [addToast, updateToast]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((_, id) => clearTimer(id));
    };
  }, [clearTimer]);

  const value: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    removeAllToasts,
    updateToast,
    success,
    error,
    warning,
    info,
    loading,
    promise: promiseToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

// ============================================================================
// USE TOAST HOOK
// ============================================================================

// No-op toast implementation for when provider is not available
const noOpToast: ToastContextValue = {
  toasts: [],
  addToast: () => '',
  removeToast: () => {},
  removeAllToasts: () => {},
  updateToast: () => {},
  success: () => '',
  error: () => '',
  warning: () => '',
  info: () => '',
  loading: () => '',
  promise: async (promise) => promise,
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    console.warn('useToast called outside ToastProvider - using no-op implementation');
    return noOpToast;
  }
  return context;
}

// ============================================================================
// POSITION UTILITIES
// ============================================================================

function getPositionClasses(position: ToastPosition): string {
  const baseClasses = 'flex flex-col p-4 max-w-sm w-full sm:max-w-md';
  
  switch (position) {
    case 'top-left':
      return `${baseClasses} top-0 left-0 items-start`;
    case 'top-center':
      return `${baseClasses} top-0 left-1/2 -translate-x-1/2 items-center`;
    case 'top-right':
      return `${baseClasses} top-0 right-0 items-end`;
    case 'bottom-left':
      return `${baseClasses} bottom-0 left-0 items-start`;
    case 'bottom-center':
      return `${baseClasses} bottom-0 left-1/2 -translate-x-1/2 items-center`;
    case 'bottom-right':
      return `${baseClasses} bottom-0 right-0 items-end`;
    default:
      return `${baseClasses} bottom-0 right-0 items-end`;
  }
}

// ============================================================================
// TOAST CONTAINER
// ============================================================================

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const ToastContainer: FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  // Group toasts by position
  const groupedToasts = toasts.reduce((acc, toast) => {
    const position = toast.position || 'bottom-right';
    if (!acc[position]) acc[position] = [];
    acc[position].push(toast);
    return acc;
  }, {} as Record<ToastPosition, Toast[]>);

  return (
    <>
      {Object.entries(groupedToasts).map(([position, positionToasts]) => (
        <div
          key={position}
          className={`fixed z-[9999] pointer-events-none ${getPositionClasses(position as ToastPosition)}`}
          style={{ gap: TOAST_GAP }}
        >
          {positionToasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onDismiss={() => onDismiss(toast.id)}
            />
          ))}
        </div>
      ))}
    </>
  );
};

// ============================================================================
// TOAST ITEM
// ============================================================================

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

const ToastItem: FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const progressRef = useRef<number>(100);
  const startTimeRef = useRef<number | null>(null);
  const remainingTimeRef = useRef<number>(toast.duration || DEFAULT_DURATION);
  const [reducedMotion, setReducedMotion] = useState(false);

  const handleDismiss = useCallback(() => {
    if (!toast.dismissible && toast.type !== 'loading') return;
    
    setIsExiting(true);
    setTimeout(() => {
      onDismiss();
    }, reducedMotion ? 0 : 200);
  }, [toast.dismissible, toast.type, onDismiss, reducedMotion]);

  const handleMouseEnter = () => {
    if (toast.pauseOnHover) {
      setIsPaused(true);
      remainingTimeRef.current = (progressRef.current / 100) * (toast.duration || DEFAULT_DURATION);
    }
  };

  const handleMouseLeave = () => {
    if (toast.pauseOnHover) {
      setIsPaused(false);
      startTimeRef.current = Date.now();
    }
  };

  // Initialize refs and check reduced motion preference in useEffect
  useEffect(() => {
    startTimeRef.current = Date.now();
    queueMicrotask(() => setReducedMotion(prefersReducedMotion()));
  }, []);

  // Handle progress bar animation
  useEffect(() => {
    if (!toast.duration || toast.type === 'loading' || isPaused || startTimeRef.current === null) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - (startTimeRef.current ?? Date.now());
      const newProgress = Math.max(0, 100 - (elapsed / remainingTimeRef.current) * 100);
      progressRef.current = newProgress;
      // Use queueMicrotask to avoid synchronous setState in effect
      queueMicrotask(() => setProgress(newProgress));

      if (newProgress <= 0) {
        clearInterval(interval);
        handleDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [toast.duration, toast.type, isPaused, handleDismiss]);

  const typeStyles = getTypeStyles(toast.type);

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`
        pointer-events-auto w-full max-w-sm mb-3
        bg-slate-100 dark:bg-slate-800 border ${typeStyles.border} rounded-xl shadow-lg
        transform transition-all duration-200
        ${isExiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}
        ${reducedMotion ? '' : 'animate-slide-in'}
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && toast.dismissible) {
          e.stopPropagation();
          handleDismiss();
        }
      }}
      tabIndex={toast.dismissible ? 0 : undefined}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`flex-shrink-0 ${typeStyles.iconColor}`}>
            {toast.icon || getDefaultIcon(toast.type)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {toast.title && (
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{toast.title}</p>
            )}
            <p className={`text-sm text-slate-600 dark:text-slate-300 ${toast.title ? 'mt-1' : ''}`}>
              {toast.message}
            </p>

            {/* Action button */}
            {toast.action && (
              <div className="mt-3">
                <button
                  onClick={() => {
                    toast.action?.onClick();
                    handleDismiss();
                  }}
                  className={`
                    text-sm font-medium px-3 py-1.5 rounded-lg transition-colors
                    ${
                      toast.action.variant === 'secondary'
                        ? 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                        : `${typeStyles.actionBg} ${typeStyles.actionText}`
                    }
                  `}
                >
                  {toast.action.label}
                </button>
              </div>
            )}
          </div>

          {/* Dismiss button */}
          {toast.dismissible && (
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-slate-500 hover:text-slate-700 dark:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
              aria-label="Dismiss notification"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {toast.duration && toast.type !== 'loading' && (
        <div className="h-1 bg-slate-200/50 dark:bg-slate-700/50 rounded-b-xl overflow-hidden">
          <div
            className={`h-full ${typeStyles.progressBg} transition-all duration-100`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// HELPERS
// ============================================================================

interface TypeStyles {
  border: string;
  iconColor: string;
  progressBg: string;
  actionBg: string;
  actionText: string;
}

function getTypeStyles(type: ToastType): TypeStyles {
  switch (type) {
    case 'success':
      return {
        border: 'border-green-500/30',
        iconColor: 'text-green-400',
        progressBg: 'bg-green-500',
        actionBg: 'bg-green-500/20 hover:bg-green-500/30',
        actionText: 'text-green-400',
      };
    case 'error':
      return {
        border: 'border-red-500/30',
        iconColor: 'text-red-400',
        progressBg: 'bg-red-500',
        actionBg: 'bg-red-500/20 hover:bg-red-500/30',
        actionText: 'text-red-400',
      };
    case 'warning':
      return {
        border: 'border-yellow-500/30',
        iconColor: 'text-yellow-400',
        progressBg: 'bg-yellow-500',
        actionBg: 'bg-yellow-500/20 hover:bg-yellow-500/30',
        actionText: 'text-yellow-400',
      };
    case 'loading':
      return {
        border: 'border-blue-500/30',
        iconColor: 'text-blue-400',
        progressBg: 'bg-blue-500',
        actionBg: 'bg-blue-500/20 hover:bg-blue-500/30',
        actionText: 'text-blue-400',
      };
    case 'info':
    default:
      return {
        border: 'border-slate-500/30',
        iconColor: 'text-blue-400',
        progressBg: 'bg-blue-500',
        actionBg: 'bg-blue-500/20 hover:bg-blue-500/30',
        actionText: 'text-blue-400',
      };
  }
}

function getDefaultIcon(type: ToastType): ReactNode {
  switch (type) {
    case 'success':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'error':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case 'warning':
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
    case 'loading':
      return (
        <svg
          className="w-5 h-5 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
}

// ============================================================================
// CSS ANIMATIONS (add to globals.css)
// ============================================================================

/*
@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-in {
  animation: slide-in 0.2s ease-out;
}
*/

export default {
  ToastProvider,
  useToast,
};
