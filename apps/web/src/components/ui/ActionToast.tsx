import { FC, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, Loader2, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'loading';

export interface ToastProps {
    message: string;
    type?: ToastType;
    duration?: number;
    onClose?: () => void;
}

export const ActionToast: FC<ToastProps> = ({
    message,
    type = 'info',
    duration = 3000,
    onClose
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
        info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
        loading: 'bg-zinc-800 border-zinc-700 text-zinc-300'
    };

    const icons = {
        success: <CheckCircle2 size={18} />,
        error: <AlertCircle size={18} />,
        info: <Info size={18} />,
        loading: <Loader2 size={18} className="animate-spin" />
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`
                fixed bottom-8 left-1/2 -translate-x-1/2 z-[200]
                flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-md shadow-lg
                ${colors[type]}
            `}
        >
            {icons[type]}
            <span className="text-sm font-medium">{message}</span>
            {onClose && (
                <button onClick={onClose} className="ml-2 hover:opacity-70">
                    <X size={14} />
                </button>
            )}
        </motion.div>
    );
};
