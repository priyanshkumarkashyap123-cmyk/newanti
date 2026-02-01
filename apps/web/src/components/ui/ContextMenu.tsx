/**
 * ContextMenu Component
 * Right-click context menu with animations
 */

import { FC, ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Copy, Trash2, Edit2, Eye, EyeOff, Lock, Unlock,
    Layers, ChevronRight, Scissors, Clipboard
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface MenuItem {
    id: string;
    label: string;
    icon?: ReactNode;
    shortcut?: string;
    action?: () => void;
    disabled?: boolean;
    danger?: boolean;
    submenu?: MenuItem[];
}

interface MenuDivider {
    type: 'divider';
}

type MenuItemOrDivider = MenuItem | MenuDivider;

interface ContextMenuProps {
    items: MenuItemOrDivider[];
    children: ReactNode;
    onOpenChange?: (open: boolean) => void;
}

// ============================================
// Built-in Menu Presets
// ============================================

export const createNodeContextMenu = (
    onEdit: () => void,
    onDelete: () => void,
    onDuplicate: () => void,
    onToggleLock: () => void,
    isLocked: boolean
): MenuItemOrDivider[] => [
        { id: 'edit', label: 'Edit Node', icon: <Edit2 className="w-4 h-4" />, shortcut: 'E', action: onEdit },
        { id: 'duplicate', label: 'Duplicate', icon: <Copy className="w-4 h-4" />, shortcut: '⌘D', action: onDuplicate },
        { type: 'divider' },
        {
            id: 'lock',
            label: isLocked ? 'Unlock' : 'Lock',
            icon: isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />,
            shortcut: 'L',
            action: onToggleLock,
        },
        { type: 'divider' },
        { id: 'delete', label: 'Delete', icon: <Trash2 className="w-4 h-4" />, shortcut: '⌫', action: onDelete, danger: true },
    ];

export const createMemberContextMenu = (
    onEdit: () => void,
    onDelete: () => void,
    onSplit: () => void,
    onShowProperties: () => void
): MenuItemOrDivider[] => [
        { id: 'properties', label: 'Properties', icon: <Eye className="w-4 h-4" />, shortcut: 'P', action: onShowProperties },
        { id: 'edit', label: 'Edit Member', icon: <Edit2 className="w-4 h-4" />, shortcut: 'E', action: onEdit },
        { type: 'divider' },
        { id: 'split', label: 'Split at Midpoint', icon: <Scissors className="w-4 h-4" />, action: onSplit },
        { type: 'divider' },
        { id: 'delete', label: 'Delete', icon: <Trash2 className="w-4 h-4" />, shortcut: '⌫', action: onDelete, danger: true },
    ];

// ============================================
// Menu Item Component
// ============================================

const MenuItemComponent: FC<{
    item: MenuItem;
    onClose: () => void;
}> = ({ item, onClose }) => {
    const [showSubmenu, setShowSubmenu] = useState(false);

    const handleClick = () => {
        if (item.disabled) return;
        if (item.submenu) {
            setShowSubmenu(!showSubmenu);
        } else {
            item.action?.();
            onClose();
        }
    };

    return (
        <div className="relative">
            <button
                onClick={handleClick}
                onMouseEnter={() => item.submenu && setShowSubmenu(true)}
                onMouseLeave={() => item.submenu && setShowSubmenu(false)}
                disabled={item.disabled}
                className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left
                    transition-colors text-sm
                    ${item.disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : item.danger
                            ? 'hover:bg-red-500/10 text-red-400 hover:text-red-300'
                            : 'hover:bg-slate-700 text-slate-300 hover:text-white'
                    }
                `}
            >
                {item.icon && (
                    <span className={item.danger ? 'text-red-400' : 'text-slate-400'}>
                        {item.icon}
                    </span>
                )}
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                    <span className="text-xs text-slate-500 font-mono">
                        {item.shortcut}
                    </span>
                )}
                {item.submenu && (
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                )}
            </button>

            {/* Submenu */}
            {item.submenu && showSubmenu && (
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="absolute left-full top-0 ml-1 min-w-[180px] bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-1"
                >
                    {item.submenu.map((subItem) => (
                        <MenuItemComponent
                            key={subItem.id}
                            item={subItem}
                            onClose={onClose}
                        />
                    ))}
                </motion.div>
            )}
        </div>
    );
};

// ============================================
// Context Menu Component
// ============================================

export const ContextMenu: FC<ContextMenuProps> = ({
    items,
    children,
    onOpenChange,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const menuRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();

        // Calculate position
        const x = Math.min(e.clientX, window.innerWidth - 220);
        const y = Math.min(e.clientY, window.innerHeight - 300);

        setPosition({ x, y });
        setIsOpen(true);
        onOpenChange?.(true);
    }, [onOpenChange]);

    const handleClose = useCallback(() => {
        setIsOpen(false);
        onOpenChange?.(false);
    }, [onOpenChange]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                handleClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose();
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
                document.removeEventListener('keydown', handleEscape);
            };
        }
        return undefined;
    }, [isOpen, handleClose]);

    return (
        <>
            <div
                ref={containerRef}
                onContextMenu={handleContextMenu}
                className="contents"
            >
                {children}
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={menuRef}
                        initial={{ opacity: 0, scale: 0.95, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -5 }}
                        transition={{ duration: 0.1 }}
                        className="fixed z-[200] min-w-[200px] bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-1.5"
                        style={{ left: position.x, top: position.y }}
                    >
                        {items.map((item, index) => {
                            if ('type' in item && item.type === 'divider') {
                                return (
                                    <div
                                        key={`divider-${index}`}
                                        className="my-1.5 border-t border-slate-700"
                                    />
                                );
                            }
                            return (
                                <MenuItemComponent
                                    key={(item as MenuItem).id}
                                    item={item as MenuItem}
                                    onClose={handleClose}
                                />
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

// ============================================
// Simple Context Menu Hook
// ============================================

export const useContextMenu = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const show = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setPosition({
            x: Math.min(e.clientX, window.innerWidth - 220),
            y: Math.min(e.clientY, window.innerHeight - 300),
        });
        setIsOpen(true);
    }, []);

    const hide = useCallback(() => {
        setIsOpen(false);
    }, []);

    return { isOpen, position, show, hide };
};

export default ContextMenu;
