/**
 * ConfirmDialog Component
 * Confirmation dialogs for destructive actions
 */

import { FC, ReactNode, useState, createContext, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X, AlertCircle, Info, CheckCircle } from 'lucide-react';

// ============================================
// Types
// ============================================

type DialogVariant = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: DialogVariant;
    icon?: ReactNode;
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

// ============================================
// Context
// ============================================

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within ConfirmProvider');
    }
    return context.confirm;
};

// ============================================
// Provider
// ============================================

interface ConfirmProviderProps {
    children: ReactNode;
}

export const ConfirmProvider: FC<ConfirmProviderProps> = ({ children }) => {
    const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null);

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setDialog({ ...options, resolve });
        });
    }, []);

    const handleConfirm = () => {
        dialog?.resolve(true);
        setDialog(null);
    };

    const handleCancel = () => {
        dialog?.resolve(false);
        setDialog(null);
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}

            <AnimatePresence>
                {dialog && (
                    <ConfirmDialogUI
                        {...dialog}
                        onConfirm={handleConfirm}
                        onCancel={handleCancel}
                    />
                )}
            </AnimatePresence>
        </ConfirmContext.Provider>
    );
};

// ============================================
// Dialog UI
// ============================================

interface ConfirmDialogUIProps extends ConfirmOptions {
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmDialogUI: FC<ConfirmDialogUIProps> = ({
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    icon,
    onConfirm,
    onCancel,
}) => {
    const variantConfig = {
        danger: {
            icon: <Trash2 className="w-6 h-6" />,
            iconBg: 'bg-red-500/20',
            iconColor: 'text-red-400',
            buttonBg: 'bg-red-600 hover:bg-red-500',
        },
        warning: {
            icon: <AlertTriangle className="w-6 h-6" />,
            iconBg: 'bg-yellow-500/20',
            iconColor: 'text-yellow-400',
            buttonBg: 'bg-yellow-600 hover:bg-yellow-500',
        },
        info: {
            icon: <Info className="w-6 h-6" />,
            iconBg: 'bg-blue-500/20',
            iconColor: 'text-blue-400',
            buttonBg: 'bg-blue-600 hover:bg-blue-500',
        },
        success: {
            icon: <CheckCircle className="w-6 h-6" />,
            iconBg: 'bg-green-500/20',
            iconColor: 'text-green-400',
            buttonBg: 'bg-green-600 hover:bg-green-500',
        },
    };

    const config = variantConfig[variant];

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onCancel}
                className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm"
            />

            {/* Dialog */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[401] w-full max-w-md"
            >
                <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                    {/* Content */}
                    <div className="p-6 text-center">
                        {/* Icon */}
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                            className={`w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center ${config.iconBg} ${config.iconColor}`}
                        >
                            {icon || config.icon}
                        </motion.div>

                        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
                        <p className="text-slate-400">{message}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 px-6 py-4 bg-slate-800/50 border-t border-slate-800">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-2.5 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
                        >
                            {cancelText}
                        </button>
                        <motion.button
                            onClick={onConfirm}
                            whileTap={{ scale: 0.98 }}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-white font-medium transition-colors ${config.buttonBg}`}
                        >
                            {confirmText}
                        </motion.button>
                    </div>
                </div>
            </motion.div>
        </>
    );
};

// ============================================
// Standalone Dialog (without context)
// ============================================

interface ConfirmDialogProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: DialogVariant;
    isLoading?: boolean;
}

export const ConfirmDialog: FC<ConfirmDialogProps> = ({
    isOpen,
    onConfirm,
    onCancel,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    isLoading = false,
}) => {
    const variantConfig = {
        danger: {
            icon: <Trash2 className="w-6 h-6" />,
            iconBg: 'bg-red-500/20',
            iconColor: 'text-red-400',
            buttonBg: 'bg-red-600 hover:bg-red-500',
        },
        warning: {
            icon: <AlertTriangle className="w-6 h-6" />,
            iconBg: 'bg-yellow-500/20',
            iconColor: 'text-yellow-400',
            buttonBg: 'bg-yellow-600 hover:bg-yellow-500',
        },
        info: {
            icon: <Info className="w-6 h-6" />,
            iconBg: 'bg-blue-500/20',
            iconColor: 'text-blue-400',
            buttonBg: 'bg-blue-600 hover:bg-blue-500',
        },
        success: {
            icon: <CheckCircle className="w-6 h-6" />,
            iconBg: 'bg-green-500/20',
            iconColor: 'text-green-400',
            buttonBg: 'bg-green-600 hover:bg-green-500',
        },
    };

    const config = variantConfig[variant];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onCancel}
                        className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm"
                    />

                    {/* Dialog */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[401] w-full max-w-md"
                    >
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                            <div className="p-6 text-center">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                                    className={`w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center ${config.iconBg} ${config.iconColor}`}
                                >
                                    {config.icon}
                                </motion.div>
                                <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
                                <p className="text-slate-400">{message}</p>
                            </div>
                            <div className="flex gap-3 px-6 py-4 bg-slate-800/50 border-t border-slate-800">
                                <button
                                    onClick={onCancel}
                                    disabled={isLoading}
                                    className="flex-1 py-2.5 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors disabled:opacity-50"
                                >
                                    {cancelText}
                                </button>
                                <motion.button
                                    onClick={onConfirm}
                                    disabled={isLoading}
                                    whileTap={{ scale: 0.98 }}
                                    className={`flex-1 py-2.5 px-4 rounded-lg text-white font-medium transition-colors ${config.buttonBg} disabled:opacity-50`}
                                >
                                    {isLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Processing...
                                        </span>
                                    ) : (
                                        confirmText
                                    )}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ConfirmDialog;
