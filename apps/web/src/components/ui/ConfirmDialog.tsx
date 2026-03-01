/**
 * ConfirmDialog Component
 * Confirmation dialogs for destructive actions
 */

import { FC, ReactNode, useState, createContext, useContext, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Trash2, Info, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './dialog';
import { Button } from './button';

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

            {dialog && (
                <ConfirmDialogUI
                    {...dialog}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                />
            )}
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
        <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
            <DialogContent className="max-w-md">
                <div className="text-center">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                        className={`w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center ${config.iconBg} ${config.iconColor}`}
                    >
                        {icon || config.icon}
                    </motion.div>

                    <DialogHeader className="text-center sm:text-center">
                        <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
                        <DialogDescription>{message}</DialogDescription>
                    </DialogHeader>
                </div>

                <DialogFooter className="sm:justify-center gap-3">
                    <Button variant="outline" onClick={onCancel} className="flex-1">
                        {cancelText}
                    </Button>
                    <Button onClick={onConfirm} className={`flex-1 text-slate-900 dark:text-white ${config.buttonBg}`}>
                        {confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
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
        <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
            <DialogContent className="max-w-md">
                <div className="text-center">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                        className={`w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center ${config.iconBg} ${config.iconColor}`}
                    >
                        {config.icon}
                    </motion.div>

                    <DialogHeader className="text-center sm:text-center">
                        <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
                        <DialogDescription>{message}</DialogDescription>
                    </DialogHeader>
                </div>

                <DialogFooter className="sm:justify-center gap-3">
                    <Button variant="outline" onClick={onCancel} disabled={isLoading} className="flex-1">
                        {cancelText}
                    </Button>
                    <Button onClick={onConfirm} disabled={isLoading} className={`flex-1 text-slate-900 dark:text-white ${config.buttonBg}`}>
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Processing...
                            </span>
                        ) : (
                            confirmText
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ConfirmDialog;
