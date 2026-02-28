/**
 * Notification System
 * Industry-standard toast notifications and alerts
 * 
 * Features:
 * - Toast notifications with queue management
 * - Multiple notification types
 * - Auto-dismiss with progress
 * - Action buttons
 * - Stacking and positioning
 * - Accessibility (ARIA live regions)
 * - Push notification integration
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';

// ============================================================================
// Types
// ============================================================================

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  actions?: NotificationAction[];
  dismissible?: boolean;
  icon?: React.ReactNode;
  timestamp: number;
  progress?: number;
}

interface NotificationOptions extends Omit<Notification, 'id' | 'timestamp' | 'progress'> {}

interface NotificationContextValue {
  notifications: Notification[];
  add: (options: NotificationOptions) => string;
  remove: (id: string) => void;
  removeAll: () => void;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
}

type NotificationPosition = 
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

// ============================================================================
// Context
// ============================================================================

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface NotificationProviderProps {
  children: React.ReactNode;
  maxNotifications?: number;
  defaultDuration?: number;
  position?: NotificationPosition;
}

export function NotificationProvider({
  children,
  maxNotifications = 5,
  defaultDuration = 5000,
  position = 'top-right',
}: NotificationProviderProps): JSX.Element {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const generateId = useCallback(() => {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const remove = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const removeAll = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setNotifications([]);
  }, []);

  const add = useCallback((options: NotificationOptions): string => {
    const id = generateId();
    const notification: Notification = {
      ...options,
      id,
      timestamp: Date.now(),
      dismissible: options.dismissible ?? true,
      duration: options.duration ?? defaultDuration,
    };

    setNotifications((prev) => {
      const updated = [...prev, notification];
      // Remove oldest if exceeding max
      if (updated.length > maxNotifications) {
        const toRemove = updated[0];
        remove(toRemove.id);
        return updated.slice(1);
      }
      return updated;
    });

    // Auto-dismiss
    if (!options.persistent && notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        remove(id);
      }, notification.duration);
      timersRef.current.set(id, timer);
    }

    return id;
  }, [generateId, defaultDuration, maxNotifications, remove]);

  const success = useCallback((title: string, message?: string) => {
    return add({ type: 'success', title, message });
  }, [add]);

  const error = useCallback((title: string, message?: string) => {
    return add({ type: 'error', title, message, duration: 0, persistent: true });
  }, [add]);

  const warning = useCallback((title: string, message?: string) => {
    return add({ type: 'warning', title, message });
  }, [add]);

  const info = useCallback((title: string, message?: string) => {
    return add({ type: 'info', title, message });
  }, [add]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const value = useMemo(() => ({
    notifications,
    add,
    remove,
    removeAll,
    success,
    error,
    warning,
    info,
  }), [notifications, add, remove, removeAll, success, error, warning, info]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer position={position} />
    </NotificationContext.Provider>
  );
}

// ============================================================================
// Container Component
// ============================================================================

interface NotificationContainerProps {
  position: NotificationPosition;
}

function NotificationContainer({ position }: NotificationContainerProps): JSX.Element {
  const { notifications } = useNotifications();

  const positionClasses: Record<NotificationPosition, string> = {
    'top-left': 'top-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-4 right-4',
  };

  const isTop = position.startsWith('top');

  return (
    <div
      className={`fixed z-50 flex flex-col gap-2 ${positionClasses[position]}`}
      role="region"
      aria-label="Notifications"
    >
      <div aria-live="polite" aria-atomic="false" className="sr-only">
        {notifications.map((n) => (
          <div key={n.id}>
            {n.type}: {n.title}. {n.message}
          </div>
        ))}
      </div>
      
      {(isTop ? notifications : [...notifications].reverse()).map((notification) => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
    </div>
  );
}

// ============================================================================
// Notification Item Component
// ============================================================================

interface NotificationItemProps {
  notification: Notification;
}

function NotificationItem({ notification }: NotificationItemProps): JSX.Element {
  const { remove } = useNotifications();
  const [progress, setProgress] = useState(100);
  const [isExiting, setIsExiting] = useState(false);

  // Progress bar animation
  useEffect(() => {
    if (notification.persistent || !notification.duration) return;

    const startTime = Date.now();
    const duration = notification.duration;

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining > 0) {
        requestAnimationFrame(updateProgress);
      }
    };

    const frameId = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(frameId);
  }, [notification.persistent, notification.duration]);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => remove(notification.id), 200);
  }, [remove, notification.id]);

  const typeStyles: Record<NotificationType, { bg: string; border: string; icon: JSX.Element }> = {
    success: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      icon: (
        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      icon: (
        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      icon: (
        <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      icon: (
        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  };

  const style = typeStyles[notification.type];

  return (
    <div
      className={`
        w-80 max-w-sm rounded-lg border shadow-lg overflow-hidden
        ${style.bg} ${style.border}
        transform transition-all duration-200 ease-out
        ${isExiting ? 'opacity-0 scale-95 translate-x-4' : 'opacity-100 scale-100 translate-x-0'}
      `}
      role="alert"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0">
            {notification.icon || style.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {notification.title}
            </p>
            {notification.message && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {notification.message}
              </p>
            )}

            {/* Actions */}
            {notification.actions && notification.actions.length > 0 && (
              <div className="mt-3 flex gap-2">
                {notification.actions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      action.onClick();
                      handleDismiss();
                    }}
                    className={`text-sm font-medium ${
                      action.variant === 'primary'
                        ? 'text-blue-600 hover:text-blue-500 dark:text-blue-400'
                        : 'text-gray-600 hover:text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dismiss button */}
          {notification.dismissible && (
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {!notification.persistent && notification.duration && notification.duration > 0 && (
        <div className="h-1 bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full transition-all duration-100 ${
              notification.type === 'success' ? 'bg-green-500' :
              notification.type === 'error' ? 'bg-red-500' :
              notification.type === 'warning' ? 'bg-yellow-500' :
              'bg-blue-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Push Notification Permission Hook
// ============================================================================

interface UsePushNotificationsReturn {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  showNotification: (title: string, options?: NotificationOptions) => void;
  isSupported: boolean;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );

  const isSupported = 'Notification' in window;

  const requestPermission = useCallback(async () => {
    if (!isSupported) return 'denied';

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, [isSupported]);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') return;

    // Extract only browser-compatible notification options
    const { message, icon: _icon, actions: _actions, ...browserOptions } = options || {};

    new Notification(title, {
      body: typeof message === 'string' ? message : undefined,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      ...browserOptions,
    });
  }, [isSupported, permission]);

  return {
    permission,
    requestPermission,
    showNotification,
    isSupported,
  };
}

// ============================================================================
// Confirmation Dialog
// ============================================================================

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
}: ConfirmDialogProps): JSX.Element | null {
  // Escape key to close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const confirmButtonClass = 
    variant === 'danger' ? 'bg-red-600 hover:bg-red-700 text-white' :
    variant === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700 text-white' :
    'bg-blue-600 hover:bg-blue-700 text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <div className="flex items-center justify-between">
          <h2
            id="confirm-dialog-title"
            className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-500 hover:text-gray-600 dark:hover:text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close dialog"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        <p
          id="confirm-dialog-description"
          className="mt-2 text-sm text-gray-600 dark:text-gray-400"
        >
          {message}
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${confirmButtonClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// useConfirm Hook
// ============================================================================

interface UseConfirmOptions {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
}

export function useConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<UseConfirmOptions>({});
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: UseConfirmOptions = {}): Promise<boolean> => {
    setOptions(opts);
    setIsOpen(true);

    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(false);
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(true);
  }, []);

  const ConfirmDialogComponent = useCallback(() => (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={options.title ?? 'Confirm'}
      message={options.message ?? 'Are you sure?'}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      variant={options.variant}
    />
  ), [isOpen, options, handleClose, handleConfirm]);

  return { confirm, ConfirmDialog: ConfirmDialogComponent };
}

// ============================================================================
// Exports
// ============================================================================

export type { Notification, NotificationOptions, NotificationType, NotificationAction };
