import { FC, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, Loader2, X, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'loading' | 'warning';

export interface ToastProps {
    message: string;
    type?: ToastType;
    duration?: number;
    onClose?: () => void;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export const ActionToast: FC<ToastProps> = ({
    message,
    type = 'info',
    duration = 3000,
    onClose,
    action
}) => {
    useEffect(() => {
        if (duration && type !== 'loading') {
            const timer = setTimeout(() => {
                onClose?.();
            }, duration);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [duration, onClose, type]);

    const colors = {
        success: 'bg-green-500/10 border-green-500/20 text-green-400',
        error: 'bg-red-500/10 border-red-500/20 text-red-400',
        warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
        loading: 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
    };

    const icons = {
        success: <CheckCircle2 size={18} aria-hidden="true" />,
        error: <AlertCircle size={18} aria-hidden="true" />,
        warning: <AlertTriangle size={18} aria-hidden="true" />,
        info: <Info size={18} aria-hidden="true" />,
        loading: <Loader2 size={18} className="animate-spin" aria-hidden="true" />
    };

    const ariaRoles = {
        success: 'status',
        error: 'alert',
        warning: 'alert',
        info: 'status',
        loading: 'status'
    } as const;

    return (
        <motion.div
            role={ariaRoles[type]}
            aria-live={type === 'error' || type === 'warning' ? 'assertive' : 'polite'}
            aria-atomic="true"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`
                fixed bottom-8 left-1/2 -translate-x-1/2 z-[200]
                flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl
                ${colors[type]}
            `}
        >
            {icons[type]}
            <span className="text-sm font-medium">{message}</span>
            {action && (
                <button 
                    onClick={action.onClick}
                    className="ml-2 px-2 py-1 text-xs font-semibold rounded bg-white/10 hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                    {action.label}
                </button>
            )}
            {onClose && (
                <button 
                    onClick={onClose} 
                    className="ml-2 p-1 rounded hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    aria-label="Dismiss notification"
                >
                    <X size={14} aria-hidden="true" />
                </button>
            )}
        </motion.div>
    );
};
