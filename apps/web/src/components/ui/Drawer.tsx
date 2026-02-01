/**
 * Drawer & Sheet Components
 * Slide-over panels from edges
 */

import { FC, ReactNode, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, ChevronDown, GripHorizontal } from 'lucide-react';

// ============================================
// Types
// ============================================

type DrawerSide = 'left' | 'right';
type DrawerSize = 'sm' | 'md' | 'lg' | 'xl';

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    side?: DrawerSide;
    size?: DrawerSize;
    title?: string;
    showCloseButton?: boolean;
    closeOnBackdrop?: boolean;
    children: ReactNode;
    footer?: ReactNode;
    className?: string;
}

// ============================================
// Size Configurations
// ============================================

const sizeClasses: Record<DrawerSize, string> = {
    sm: 'w-80',
    md: 'w-96',
    lg: 'w-[480px]',
    xl: 'w-[600px]',
};

// ============================================
// Drawer Component
// ============================================

export const Drawer: FC<DrawerProps> = ({
    isOpen,
    onClose,
    side = 'right',
    size = 'md',
    title,
    showCloseButton = true,
    closeOnBackdrop = true,
    children,
    footer,
    className = '',
}) => {
    // Escape key handler
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

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

    const slideVariants = {
        left: {
            initial: { x: '-100%' },
            animate: { x: 0 },
            exit: { x: '-100%' },
        },
        right: {
            initial: { x: '100%' },
            animate: { x: 0 },
            exit: { x: '100%' },
        },
    };

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
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={slideVariants[side].initial}
                        animate={slideVariants[side].animate}
                        exit={slideVariants[side].exit}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className={`
                            fixed top-0 bottom-0 z-[501]
                            ${side === 'left' ? 'left-0' : 'right-0'}
                            ${sizeClasses[size]}
                            bg-slate-900 border-${side === 'left' ? 'r' : 'l'} border-slate-700 shadow-2xl
                            flex flex-col
                            ${className}
                        `}
                    >
                        {/* Header */}
                        {(title || showCloseButton) && (
                            <div className="flex items-center justify-between p-4 border-b border-slate-800">
                                <div className="flex items-center gap-3">
                                    {showCloseButton && (
                                        <button
                                            onClick={onClose}
                                            className="p-2 -m-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                        >
                                            {side === 'left' ? (
                                                <ChevronLeft className="w-5 h-5" />
                                            ) : (
                                                <ChevronRight className="w-5 h-5" />
                                            )}
                                        </button>
                                    )}
                                    {title && (
                                        <h2 className="text-lg font-bold text-white">{title}</h2>
                                    )}
                                </div>
                                {showCloseButton && (
                                    <button
                                        onClick={onClose}
                                        className="p-2 -m-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {children}
                        </div>

                        {/* Footer */}
                        {footer && (
                            <div className="p-4 border-t border-slate-800 bg-slate-800/50">
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// ============================================
// Sheet Component (Bottom Drawer)
// ============================================

type SheetHeight = 'sm' | 'md' | 'lg' | 'auto' | 'full';

interface SheetProps {
    isOpen: boolean;
    onClose: () => void;
    height?: SheetHeight;
    title?: string;
    showHandle?: boolean;
    closeOnBackdrop?: boolean;
    children: ReactNode;
    className?: string;
}

const heightClasses: Record<SheetHeight, string> = {
    sm: 'max-h-[30vh]',
    md: 'max-h-[50vh]',
    lg: 'max-h-[70vh]',
    auto: 'max-h-[85vh]',
    full: 'h-[95vh]',
};

export const Sheet: FC<SheetProps> = ({
    isOpen,
    onClose,
    height = 'auto',
    title,
    showHandle = true,
    closeOnBackdrop = true,
    children,
    className = '',
}) => {
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

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeOnBackdrop ? onClose : undefined}
                        className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm"
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className={`
                            fixed bottom-0 left-0 right-0 z-[501]
                            ${heightClasses[height]}
                            bg-slate-900 border-t border-slate-700 rounded-t-2xl shadow-2xl
                            flex flex-col
                            ${className}
                        `}
                    >
                        {/* Handle */}
                        {showHandle && (
                            <div
                                onClick={onClose}
                                className="flex justify-center py-3 cursor-pointer"
                            >
                                <div className="w-10 h-1 bg-slate-600 rounded-full" />
                            </div>
                        )}

                        {/* Header */}
                        {title && (
                            <div className="flex items-center justify-between px-5 pb-3 border-b border-slate-800">
                                <h2 className="text-lg font-bold text-white">{title}</h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 -m-2 text-slate-400 hover:text-white transition-colors"
                                >
                                    <ChevronDown className="w-5 h-5" />
                                </button>
                            </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-5">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// ============================================
// useDrawer Hook
// ============================================

export const useDrawer = (initialState = false) => {
    const [isOpen, setIsOpen] = useState(initialState);

    return {
        isOpen,
        open: useCallback(() => setIsOpen(true), []),
        close: useCallback(() => setIsOpen(false), []),
        toggle: useCallback(() => setIsOpen(prev => !prev), []),
    };
};

// ============================================
// useSheet Hook
// ============================================

export const useSheet = (initialState = false) => {
    const [isOpen, setIsOpen] = useState(initialState);

    return {
        isOpen,
        open: useCallback(() => setIsOpen(true), []),
        close: useCallback(() => setIsOpen(false), []),
        toggle: useCallback(() => setIsOpen(prev => !prev), []),
    };
};

export default Drawer;
