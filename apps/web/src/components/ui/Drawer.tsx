/**
 * Drawer & Sheet Components
 * Slide-over panels from edges
 */

import { FC, ReactNode, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent } from './dialog';

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
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className={`
                    fixed inset-y-0 h-full max-h-screen max-w-none translate-x-0 translate-y-0
                    rounded-none p-0 flex flex-col border-0
                    ${side === 'left' ? 'left-0 right-auto border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left' : 'right-0 left-auto border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right'}
                    ${sizeClasses[size]}
                    border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl
                    ${className}
                `}
                onInteractOutside={closeOnBackdrop ? undefined : (e) => e.preventDefault()}
            >
                {/* Header */}
                {(title || showCloseButton) && (
                    <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-800">
                        {showCloseButton && (
                            <button type="button"
                                onClick={onClose}
                                className="p-2 -m-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                {side === 'left' ? (
                                    <ChevronLeft className="w-5 h-5" />
                                ) : (
                                    <ChevronRight className="w-5 h-5" />
                                )}
                            </button>
                        )}
                        {title && (
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
                        )}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                        {footer}
                    </div>
                )}
            </DialogContent>
        </Dialog>
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
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className={`
                    fixed bottom-0 left-0 right-0 top-auto
                    translate-x-0 translate-y-0 max-w-full
                    rounded-b-none rounded-t-2xl p-0 flex flex-col
                    ${heightClasses[height]}
                    border-t border-slate-300 dark:border-slate-700
                    bg-white dark:bg-slate-900 shadow-2xl
                    data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom
                    ${className}
                `}
                onInteractOutside={closeOnBackdrop ? undefined : (e) => e.preventDefault()}
            >
                {/* Handle */}
                {showHandle && (
                    <div
                        onClick={onClose}
                        className="flex justify-center py-3 cursor-pointer"
                    >
                        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
                    </div>
                )}

                {/* Header */}
                {title && (
                    <div className="flex items-center justify-between px-5 pb-3 border-b border-slate-200 dark:border-slate-800">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
                        <button type="button"
                            onClick={onClose}
                            className="p-2 -m-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            <ChevronDown className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {children}
                </div>
            </DialogContent>
        </Dialog>
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
