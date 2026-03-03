/**
 * NotificationManager Component
 * Centralized notification system with stacking toasts
 */

import { FC, createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle, AlertCircle, AlertTriangle, Info,
    X, Loader2, Bell
} from 'lucide-react';

// ============================================
// Types
// ============================================

type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message?: string;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
    dismissible?: boolean;
}

interface NotificationContextType {
    notifications: Notification[];
    notify: (notification: Omit<Notification, 'id'>) => string;
    dismiss: (id: string) => void;
    dismissAll: () => void;
    update: (id: string, updates: Partial<Notification>) => void;
}

// ============================================
// Context
// ============================================

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within NotificationProvider');
    }
    return context;
};

// ============================================
// Provider
// ============================================

interface NotificationProviderProps {
    children: ReactNode;
    maxVisible?: number;
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export const NotificationProvider: FC<NotificationProviderProps> = ({
    children,
    maxVisible = 5,
    position = 'bottom-right',
}) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const notify = useCallback((notification: Omit<Notification, 'id'>) => {
        const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const newNotification: Notification = {
            id,
            dismissible: true,
            duration: notification.type === 'loading' ? 0 : 5000,
            ...notification,
        };

        setNotifications(prev => [...prev, newNotification]);

        // Auto-dismiss
        if (newNotification.duration && newNotification.duration > 0) {
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== id));
            }, newNotification.duration);
        }

        return id;
    }, []);

    const dismiss = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const dismissAll = useCallback(() => {
        setNotifications([]);
    }, []);

    const update = useCallback((id: string, updates: Partial<Notification>) => {
        setNotifications(prev =>
            prev.map(n => (n.id === id ? { ...n, ...updates } : n))
        );
    }, []);

    const positionClasses = {
        'top-right': 'top-4 right-4',
        'top-left': 'top-4 left-4',
        'bottom-right': 'bottom-4 right-4',
        'bottom-left': 'bottom-4 left-4',
        'top-center': 'top-4 left-1/2 -translate-x-1/2',
        'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
    };

    const visibleNotifications = notifications.slice(-maxVisible);

    const contextValue = useMemo(
        () => ({ notifications, notify, dismiss, dismissAll, update }),
        [notifications, notify, dismiss, dismissAll, update]
    );

    return (
        <NotificationContext.Provider value={contextValue}>
            {children}

            {/* Notification Stack */}
            <div className={`fixed z-[300] flex flex-col gap-3 ${positionClasses[position]}`}>
                <AnimatePresence mode="popLayout">
                    {visibleNotifications.map((notification, index) => (
                        <NotificationToast
                            key={notification.id}
                            notification={notification}
                            onDismiss={() => dismiss(notification.id)}
                            index={index}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </NotificationContext.Provider>
    );
};

// ============================================
// Toast Component
// ============================================

interface NotificationToastProps {
    notification: Notification;
    onDismiss: () => void;
    index: number;
}

const NotificationToast: FC<NotificationToastProps> = ({
    notification,
    onDismiss,
    index,
}) => {
    const icons = {
        success: <CheckCircle className="w-5 h-5 text-green-400" />,
        error: <AlertCircle className="w-5 h-5 text-red-400" />,
        warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
        info: <Info className="w-5 h-5 text-blue-400" />,
        loading: <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />,
    };

    const bgColors = {
        success: 'bg-green-500/10 border-green-500/30',
        error: 'bg-red-500/10 border-red-500/30',
        warning: 'bg-yellow-500/10 border-yellow-500/30',
        info: 'bg-blue-500/10 border-blue-500/30',
        loading: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={`
                w-80 p-4 rounded-xl border backdrop-blur-lg shadow-2xl
                ${bgColors[notification.type]}
            `}
        >
            <div className="flex gap-3">
                {icons[notification.type]}
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">
                        {notification.title}
                    </p>
                    {notification.message && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {notification.message}
                        </p>
                    )}
                    {notification.action && (
                        <button type="button"
                            onClick={notification.action.onClick}
                            className="mt-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            {notification.action.label}
                        </button>
                    )}
                </div>
                {notification.dismissible && notification.type !== 'loading' && (
                    <button type="button"
                        onClick={onDismiss}
                        className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
        </motion.div>
    );
};

// ============================================
// Convenience Functions
// ============================================

export const createNotificationHelpers = (notify: NotificationContextType['notify'], update: NotificationContextType['update']) => ({
    success: (title: string, message?: string) => notify({ type: 'success', title, message }),
    error: (title: string, message?: string) => notify({ type: 'error', title, message, duration: 8000 }),
    warning: (title: string, message?: string) => notify({ type: 'warning', title, message }),
    info: (title: string, message?: string) => notify({ type: 'info', title, message }),
    loading: (title: string, message?: string) => notify({ type: 'loading', title, message, dismissible: false }),
    promise: async <T,>(
        promise: Promise<T>,
        {
            loading: loadingTitle,
            success: successTitle,
            error: errorTitle,
        }: { loading: string; success: string; error: string }
    ): Promise<T> => {
        const id = notify({ type: 'loading', title: loadingTitle, dismissible: false });
        try {
            const result = await promise;
            update(id, { type: 'success', title: successTitle, dismissible: true, duration: 3000 });
            return result;
        } catch (e) {
            update(id, { type: 'error', title: errorTitle, dismissible: true, duration: 5000 });
            throw e;
        }
    },
});

export default NotificationProvider;
