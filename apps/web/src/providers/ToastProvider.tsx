import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
    id: string;
    type: ToastType;
    title?: string;
    message: string;
    duration?: number;
}

interface ToastContextType {
    toast: (props: Omit<Toast, 'id'>) => void;
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const addToast = useCallback(({ type, title, message, duration = 5000 }: Omit<Toast, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, type, title, message, duration }]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, [removeToast]);

    const helpers = {
        success: (message: string, title?: string) => addToast({ type: 'success', message, title }),
        error: (message: string, title?: string) => addToast({ type: 'error', message, title }),
        info: (message: string, title?: string) => addToast({ type: 'info', message, title }),
        warning: (message: string, title?: string) => addToast({ type: 'warning', message, title }),
    };

    return (
        <ToastContext.Provider value={{ toast: addToast, ...helpers }}>
            {children}
            {createPortal(
                <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                    {toasts.map((toast) => (
                        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
                    ))}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    const icons = {
        success: <CheckCircle className="w-5 h-5 text-green-500" />,
        error: <AlertCircle className="w-5 h-5 text-red-500" />,
        warning: <AlertCircle className="w-5 h-5 text-amber-500" />,
        info: <Info className="w-5 h-5 text-blue-500" />,
    };

    const colors = {
        success: 'border-green-500/20 bg-green-500/10',
        error: 'border-red-500/20 bg-red-500/10',
        warning: 'border-amber-500/20 bg-amber-500/10',
        info: 'border-blue-500/20 bg-blue-500/10',
    };

    return (
        <div className={`
      pointer-events-auto min-w-[300px] max-w-[400px]
      rounded-lg border ${colors[toast.type]} backdrop-blur-md
      p-4 shadow-lg animate-in slide-in-from-right-full fade-in duration-300
    `}>
            <div className="flex items-start gap-3">
                {icons[toast.type]}
                <div className="flex-1 pt-0.5">
                    {toast.title && <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">{toast.title}</h4>}
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{toast.message}</p>
                </div>
                <button
                    onClick={onClose}
                    className="text-slate-500 hover:text-zinc-900 dark:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
