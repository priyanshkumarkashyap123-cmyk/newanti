/**
 * ContextMenu Component
 * Right-click context menu with animations
 *
 * Enhancements per Figma §21 & §22:
 *   - role="menu" / role="menuitem" ARIA pattern
 *   - Full keyboard navigation (ArrowUp/Down, Home, End, Enter, Escape)
 *   - Portal rendering to avoid overflow clipping
 *   - Submenu with AnimatePresence for exit animation
 *   - Removed unused imports
 */

import React from 'react';
import { FC, ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Copy, Trash2, Edit2, Eye, Lock, Unlock,
    ChevronRight, Scissors
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
// Helpers
// ============================================

/** Filters out dividers, returns only actionable items */
function getMenuItems(items: MenuItemOrDivider[]): MenuItem[] {
    return items.filter((i): i is MenuItem => !('type' in i));
}

/** Returns the next non-disabled index (wrapping) */
function nextEnabledIndex(items: MenuItem[], current: number, direction: 1 | -1): number {
    const len = items.length;
    let idx = (current + direction + len) % len;
    let attempts = 0;
    while (items[idx].disabled && attempts < len) {
        idx = (idx + direction + len) % len;
        attempts++;
    }
    return idx;
}

// ============================================
// Menu Item Component
// ============================================

const MenuItemComponent: FC<{
    item: MenuItem;
    onClose: () => void;
    focused: boolean;
    onMouseEnter: () => void;
}> = ({ item, onClose, focused, onMouseEnter }) => {
    const [showSubmenu, setShowSubmenu] = useState(false);
    const itemRef = useRef<HTMLButtonElement>(null);

    // Auto-focus when keyboard-focused
    React.useEffect(() => {
        if (focused && itemRef.current) {
            itemRef.current.focus();
        }
    }, [focused]);

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
            <button type="button"
                ref={itemRef}
                onClick={handleClick}
                onMouseEnter={() => {
                    onMouseEnter();
                    if (item.submenu) setShowSubmenu(true);
                }}
                onMouseLeave={() => item.submenu && setShowSubmenu(false)}
                disabled={item.disabled}
                role="menuitem"
                aria-haspopup={item.submenu ? 'menu' : undefined}
                aria-expanded={item.submenu ? showSubmenu : undefined}
                tabIndex={focused ? 0 : -1}
                className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left
                    transition-colors text-sm outline-none
                    ${item.disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : item.danger
                            ? 'hover:bg-red-500/10 text-red-400 hover:text-red-300 focus-visible:bg-red-500/10'
                            : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white focus-visible:bg-slate-200 dark:focus-visible:bg-slate-700'
                    }
                `}
            >
                {item.icon && (
                    <span className={item.danger ? 'text-red-400' : 'text-[#869ab8]'}>
                        {item.icon}
                    </span>
                )}
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                    <span className="text-xs text-[#869ab8] font-mono">
                        {item.shortcut}
                    </span>
                )}
                {item.submenu && (
                    <ChevronRight className="w-4 h-4 text-[#869ab8]" />
                )}
            </button>

            {/* Submenu */}
            <AnimatePresence>
                {item.submenu && showSubmenu && (
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.1 }}
                        role="menu"
                        aria-label={`${item.label} submenu`}
                        className="absolute left-full top-0 ml-1 min-w-[180px] bg-[#131b2e] border border-[#1a2333] rounded-xl shadow-xl p-1"
                    >
                        {item.submenu.map((subItem) => (
                            <MenuItemComponent
                                key={subItem.id}
                                item={subItem}
                                onClose={onClose}
                                focused={false}
                                onMouseEnter={() => {}}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
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
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const menuRef = useRef<HTMLDivElement>(null);

    const menuItems = getMenuItems(items);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const x = Math.min(e.clientX, window.innerWidth - 220);
        const y = Math.min(e.clientY, window.innerHeight - 300);
        setPosition({ x, y });
        setIsOpen(true);
        setFocusedIndex(0);
        onOpenChange?.(true);
    }, [onOpenChange]);

    const handleClose = useCallback(() => {
        setIsOpen(false);
        setFocusedIndex(-1);
        onOpenChange?.(false);
    }, [onOpenChange]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isOpen) return;

        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                handleClose();
                break;
            case 'ArrowDown':
                e.preventDefault();
                setFocusedIndex((prev) => nextEnabledIndex(menuItems, prev, 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setFocusedIndex((prev) => nextEnabledIndex(menuItems, prev, -1));
                break;
            case 'Home':
                e.preventDefault();
                setFocusedIndex(nextEnabledIndex(menuItems, -1, 1));
                break;
            case 'End':
                e.preventDefault();
                setFocusedIndex(nextEnabledIndex(menuItems, 0, -1));
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (focusedIndex >= 0 && !menuItems[focusedIndex].disabled) {
                    const item = menuItems[focusedIndex];
                    if (!item.submenu) {
                        item.action?.();
                        handleClose();
                    }
                }
                break;
            case 'Tab':
                e.preventDefault();
                handleClose();
                break;
        }
    }, [isOpen, focusedIndex, menuItems, handleClose]);

    // Close on click outside & keyboard
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                handleClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
                document.removeEventListener('keydown', handleKeyDown);
            };
        }
        return undefined;
    }, [isOpen, handleClose, handleKeyDown]);

    // Track the actionable-item index for each rendered row
    let actionableIdx = -1;

    return (
        <>
            <div onContextMenu={handleContextMenu} className="contents">
                {children}
            </div>

            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            ref={menuRef}
                            initial={{ opacity: 0, scale: 0.95, y: -5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -5 }}
                            transition={{ duration: 0.1 }}
                            role="menu"
                            aria-label="Context menu"
                            className="fixed z-[200] min-w-[200px] bg-[#131b2e] border border-[#1a2333] rounded-xl shadow-2xl p-1.5"
                            style={{ left: position.x, top: position.y }}
                        >
                            {items.map((item, index) => {
                                if ('type' in item && item.type === 'divider') {
                                    return (
                                        <div
                                            key={`divider-${index}`}
                                            role="separator"
                                            className="my-1.5 border-t border-[#1a2333]"
                                        />
                                    );
                                }
                                actionableIdx++;
                                const currentIdx = actionableIdx;
                                return (
                                    <MenuItemComponent
                                        key={(item as MenuItem).id}
                                        item={item as MenuItem}
                                        onClose={handleClose}
                                        focused={currentIdx === focusedIndex}
                                        onMouseEnter={() => setFocusedIndex(currentIdx)}
                                    />
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
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
