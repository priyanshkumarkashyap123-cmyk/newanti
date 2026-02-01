/**
 * Modal Component
 * Flexible modal dialog with sizes, animations, and focus trap
 */

import { FC, ReactNode, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

// ============================================
// Types
// ============================================

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    size?: ModalSize;
    showCloseButton?: boolean;
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    children: ReactNode;
    footer?: ReactNode;
    className?: string;
}

// ============================================
// Size Configurations
// ============================================

const sizeClasses: Record<ModalSize, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw] max-h-[90vh]',
};

// ============================================
// Modal Component
// ============================================

export const Modal: FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    description,
    size = 'md',
    showCloseButton = true,
    closeOnBackdrop = true,
    closeOnEscape = true,
    children,
    footer,
    className = '',
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);

    // Focus trap
    useEffect(() => {
        if (isOpen) {
            previousActiveElement.current = document.activeElement as HTMLElement;
            setTimeout(() => {
                modalRef.current?.focus();
            }, 50);
        } else {
            previousActiveElement.current?.focus();
        }
    }, [isOpen]);

    // Escape key handler
    useEffect(() => {
        if (!isOpen || !closeOnEscape) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, closeOnEscape, onClose]);

    // Prevent body scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Generate unique IDs for accessibility
    const titleId = title ? 'modal-title' : undefined;
    const descriptionId = description ? 'modal-description' : undefined;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={closeOnBackdrop ? onClose : undefined}
                        className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm"
                        aria-hidden="true"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="fixed inset-0 z-[501] flex items-center justify-center p-4"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        aria-describedby={descriptionId}
                    >
                        <div
                            ref={modalRef}
                            tabIndex={-1}
                            className={`
                                w-full ${sizeClasses[size]}
                                bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl
                                outline-none overflow-hidden
                                focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
                                ${className}
                            `}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            {(title || showCloseButton) && (
                                <div className="flex items-start justify-between p-5 border-b border-slate-800">
                                    <div>
                                        {title && (
                                            <h2 id={titleId} className="text-xl font-bold text-white">{title}</h2>
                                        )}
                                        {description && (
                                            <p id={descriptionId} className="text-sm text-slate-400 mt-1">{description}</p>
                                        )}
                                    </div>
                                    {showCloseButton && (
                                        <button
                                            onClick={onClose}
                                            className="p-2 -m-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                            aria-label="Close dialog"
                                        >
                                            <X className="w-5 h-5" aria-hidden="true" />
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Content */}
                            <div className="p-5 max-h-[60vh] overflow-y-auto">
                                {children}
                            </div>

                            {/* Footer */}
                            {footer && (
                                <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-800 bg-slate-800/50">
                                    {footer}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// ============================================
// Modal Header (for custom headers)
// ============================================

interface ModalHeaderProps {
    children: ReactNode;
    className?: string;
}

export const ModalHeader: FC<ModalHeaderProps> = ({ children, className = '' }) => (
    <div className={`p-5 border-b border-slate-800 ${className}`}>
        {children}
    </div>
);

// ============================================
// Modal Body
// ============================================

interface ModalBodyProps {
    children: ReactNode;
    className?: string;
}

export const ModalBody: FC<ModalBodyProps> = ({ children, className = '' }) => (
    <div className={`p-5 ${className}`}>
        {children}
    </div>
);

// ============================================
// Modal Footer
// ============================================

interface ModalFooterProps {
    children: ReactNode;
    className?: string;
}

export const ModalFooter: FC<ModalFooterProps> = ({ children, className = '' }) => (
    <div className={`flex items-center justify-end gap-3 p-5 border-t border-slate-800 bg-slate-800/50 ${className}`}>
        {children}
    </div>
);

// ============================================
// useModal Hook
// ============================================

import { useState } from 'react';

export const useModal = (initialState = false) => {
    const [isOpen, setIsOpen] = useState(initialState);

    return {
        isOpen,
        open: useCallback(() => setIsOpen(true), []),
        close: useCallback(() => setIsOpen(false), []),
        toggle: useCallback(() => setIsOpen(prev => !prev), []),
    };
};

// ============================================
// Confirm Modal - Pre-built confirmation dialog
// ============================================

import { AlertTriangle, Info, CheckCircle, HelpCircle } from 'lucide-react';
import { Button } from './button';

type ModalVariant = 'default' | 'danger' | 'warning' | 'success' | 'info';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ModalVariant;
    loading?: boolean;
}

const variantConfig: Record<ModalVariant, { icon: typeof AlertTriangle; color: string; buttonVariant: 'default' | 'destructive' }> = {
    default: { icon: Info, color: 'text-blue-400', buttonVariant: 'default' },
    danger: { icon: AlertTriangle, color: 'text-red-400', buttonVariant: 'destructive' },
    warning: { icon: AlertTriangle, color: 'text-amber-400', buttonVariant: 'default' },
    success: { icon: CheckCircle, color: 'text-green-400', buttonVariant: 'default' },
    info: { icon: HelpCircle, color: 'text-blue-400', buttonVariant: 'default' },
};

export const ConfirmModal: FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'danger',
    loading = false,
}) => {
    const config = variantConfig[variant];
    const IconComponent = config.icon;

    const handleConfirm = useCallback(() => {
        onConfirm();
    }, [onConfirm]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm">
            <div className="p-6">
                <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        variant === 'danger' ? 'bg-red-500/10' :
                        variant === 'warning' ? 'bg-amber-500/10' :
                        variant === 'success' ? 'bg-green-500/10' :
                        'bg-blue-500/10'
                    }`}>
                        <IconComponent className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white">{title}</h3>
                        <p className="mt-2 text-sm text-slate-400">{description}</p>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        {cancelLabel}
                    </Button>
                    <Button 
                        variant={config.buttonVariant} 
                        onClick={handleConfirm} 
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Processing...
                            </span>
                        ) : confirmLabel}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// ============================================
// Alert Modal - Simple alert dialog
// ============================================

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    variant?: ModalVariant;
    buttonLabel?: string;
}

export const AlertModal: FC<AlertModalProps> = ({
    isOpen,
    onClose,
    title,
    description,
    variant = 'info',
    buttonLabel = 'OK',
}) => {
    const config = variantConfig[variant];
    const IconComponent = config.icon;

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm">
            <div className="p-6">
                <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        variant === 'danger' ? 'bg-red-500/10' :
                        variant === 'warning' ? 'bg-amber-500/10' :
                        variant === 'success' ? 'bg-green-500/10' :
                        'bg-blue-500/10'
                    }`}>
                        <IconComponent className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white">{title}</h3>
                        <p className="mt-2 text-sm text-slate-400">{description}</p>
                    </div>
                </div>
                <div className="flex justify-end mt-6">
                    <Button onClick={onClose}>{buttonLabel}</Button>
                </div>
            </div>
        </Modal>
    );
};

// ============================================
// Delete Confirm Modal - Specialized for deletions
// ============================================

interface DeleteConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDelete: () => void;
    itemName: string;
    itemType?: string;
    loading?: boolean;
}

export const DeleteConfirmModal: FC<DeleteConfirmModalProps> = ({
    isOpen,
    onClose,
    onDelete,
    itemName,
    itemType = 'item',
    loading = false,
}) => (
    <ConfirmModal
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={onDelete}
        title={`Delete ${itemType}?`}
        description={`Are you sure you want to delete "${itemName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={loading}
    />
);

export default Modal;
