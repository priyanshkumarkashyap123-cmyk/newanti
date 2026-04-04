/**
 * ContextMenu.tsx - Right-Click Context Menu
 * 
 * STAAD Pro-style context menu that appears on right-click.
 * Shows context-sensitive options based on selection.
 */

import React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    Edit,
    Trash2,
    Copy,
    Clipboard,
    Plus,
    Target,
    Box,
    Settings,
    Settings2,
    Scissors,
    GitBranch,
    MoveHorizontal,
    ChevronRight,
    Eye,
    EyeOff
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export type ContextMenuItemType = 'action' | 'divider' | 'submenu';

export interface ContextMenuItem {
    type: ContextMenuItemType;
    id?: string;
    icon?: React.ReactNode;
    label?: string;
    shortcut?: string;
    disabled?: boolean;
    danger?: boolean;
    action?: () => void;
    submenu?: ContextMenuItem[];
}

export type SelectionContext = 'empty' | 'node' | 'member' | 'mixed';

interface ContextMenuProps {
    items: ContextMenuItem[];
    position: { x: number; y: number };
    onClose: () => void;
}

// ============================================
// CONTEXT MENU COMPONENT
// ============================================

function ContextMenu({ items, position, onClose }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [hoveredSubmenu, setHoveredSubmenu] = useState<string | null>(null);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [adjustedPosition, setAdjustedPosition] = useState(position);

    // Get only actionable (non-divider) items for keyboard navigation
    const actionableItems = items.reduce<{ item: ContextMenuItem; originalIndex: number }[]>(
        (acc, item, i) => {
            if (item.type !== 'divider') acc.push({ item, originalIndex: i });
            return acc;
        }, []
    );

    // Measure menu and clamp to viewport
    useEffect(() => {
        if (!menuRef.current) return;
        const rect = menuRef.current.getBoundingClientRect();
        const x = Math.min(position.x, window.innerWidth - rect.width - 8);
        const y = Math.min(position.y, window.innerHeight - rect.height - 8);
        setAdjustedPosition({ x: Math.max(4, x), y: Math.max(4, y) });
    }, [position]);

    // Keyboard navigation: Escape, ArrowUp/Down, Enter, Home, End
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setFocusedIndex(prev => {
                        const next = prev + 1;
                        return next >= actionableItems.length ? 0 : next;
                    });
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setFocusedIndex(prev => {
                        const next = prev - 1;
                        return next < 0 ? actionableItems.length - 1 : next;
                    });
                    break;
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    if (focusedIndex >= 0 && focusedIndex < actionableItems.length) {
                        const focused = actionableItems[focusedIndex];
                        if (focused && !focused.item.disabled && focused.item.action) {
                            focused.item.action();
                            onClose();
                        }
                    }
                    break;
                case 'Home':
                    e.preventDefault();
                    setFocusedIndex(0);
                    break;
                case 'End':
                    e.preventDefault();
                    setFocusedIndex(actionableItems.length - 1);
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, focusedIndex, actionableItems]);

    // Close on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        // Delay to prevent immediate close on right-click
        const timer = setTimeout(() => {
            document.addEventListener('click', handleClick);
        }, 100);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('click', handleClick);
        };
    }, [onClose]);

    const renderMenuItem = (item: ContextMenuItem, index: number) => {
        if (item.type === 'divider') {
            return <div key={index} className="my-1 h-px bg-slate-200 dark:bg-slate-700" />;
        }

        const isHovered = hoveredSubmenu === item.id;

        return (
            <div key={item.id || index} className="relative">
                <button type="button"
                    role="menuitem"
                    tabIndex={-1}
                    aria-disabled={item.disabled}
                    onClick={() => {
                        if (item.action && !item.disabled) {
                            item.action();
                            onClose();
                        }
                    }}
                    onMouseEnter={() => {
                        if (item.submenu) setHoveredSubmenu(item.id || null);
                        // Sync focus index on mouse hover
                        const ai = actionableItems.findIndex(a => a.originalIndex === index);
                        if (ai >= 0) setFocusedIndex(ai);
                    }}
                    onMouseLeave={() => !item.submenu && setHoveredSubmenu(null)}
                    disabled={item.disabled}
                    data-index={index}
                    className={`
                        w-full flex items-center gap-3 px-4 py-2 text-left text-sm
                        transition-colors duration-75 rounded outline-none
                        ${actionableItems.find(a => a.originalIndex === index)?.item === item &&
                          focusedIndex === actionableItems.findIndex(a => a.originalIndex === index)
                            ? 'ring-2 ring-blue-400/60 ring-inset'
                            : ''}
                        ${item.disabled
                            ? 'text-[#424754] cursor-not-allowed'
                            : item.danger
                                ? 'text-red-600 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }
                    `}
                >
                    <span className="w-4 h-4 flex-shrink-0 text-[#869ab8]">
                        {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                        <span className="text-[11px] text-[#869ab8] ml-4">
                            {item.shortcut}
                        </span>
                    )}
                    {item.submenu && (
                        <ChevronRight className="w-3 h-3 text-[#869ab8]" />
                    )}
                </button>

                {/* Submenu */}
                {item.submenu && isHovered && (
                    <div
                        className="absolute left-full top-0 ml-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-[#1a2333] rounded-lg shadow-xl py-1 min-w-[160px]"
                        onMouseEnter={() => setHoveredSubmenu(item.id || null)}
                        onMouseLeave={() => setHoveredSubmenu(null)}
                    >
                        {item.submenu.map((subItem, subIndex) =>
                            renderMenuItem(subItem, subIndex)
                        )}
                    </div>
                )}
            </div>
        );
    };

    return createPortal(
        <div
            ref={menuRef}
            role="menu"
            aria-label="Context menu"
            className="fixed z-[9999] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-[#1a2333] rounded-lg shadow-2xl py-1 min-w-[200px] animate-[scaleIn_100ms_ease-out] origin-top-left"
            style={{
                left: adjustedPosition.x,
                top: adjustedPosition.y,
            }}
            onContextMenu={(e) => e.preventDefault()}
        >
            {items.map((item, index) => renderMenuItem(item, index))}
        </div>,
        document.body
    );
}

// ============================================
// HOOK: useContextMenu
// ============================================

export function useContextMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [items, setItems] = useState<ContextMenuItem[]>([]);

    const show = useCallback((e: React.MouseEvent, menuItems: ContextMenuItem[]) => {
        e.preventDefault();
        e.stopPropagation();
        setPosition({ x: e.clientX, y: e.clientY });
        setItems(menuItems);
        setIsOpen(true);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
    }, []);

    return {
        isOpen,
        position,
        items,
        show,
        close,
        ContextMenu: isOpen ? (
            <ContextMenu items={items} position={position} onClose={close} />
        ) : null
    };
}

// ============================================
// MENU ITEM FACTORIES
// ============================================

export function getNodeContextMenuItems(
    nodeId: string,
    actions: {
        onEdit?: () => void;
        onAddBeamFrom?: () => void;
        onAssignSupport?: () => void;
        onAssignLoad?: () => void;
        onMerge?: () => void;
        canMerge?: boolean;
        onDelete?: () => void;
    }
): ContextMenuItem[] {
    return [
        {
            type: 'action',
            id: 'edit',
            icon: <Edit className="w-full h-full" />,
            label: 'Edit Coordinates',
            action: actions.onEdit
        },
        { type: 'divider' },
        {
            type: 'action',
            id: 'add-beam',
            icon: <Plus className="w-full h-full" />,
            label: 'Add Beam from Here',
            shortcut: 'B',
            action: actions.onAddBeamFrom
        },
        {
            type: 'action',
            id: 'assign-support',
            icon: <Target className="w-full h-full" />,
            label: 'Assign Support',
            action: actions.onAssignSupport
        },
        {
            type: 'action',
            id: 'assign-load',
            icon: <Box className="w-full h-full" />,
            label: 'Assign Load',
            action: actions.onAssignLoad
        },
        { type: 'divider' },
        {
            type: 'action',
            id: 'merge-nodes',
            icon: <Target className="w-full h-full" />,
            label: 'Merge Selected Nodes',
            action: actions.onMerge,
            disabled: !actions.canMerge
        },
        {
            type: 'action',
            id: 'delete',
            icon: <Trash2 className="w-full h-full" />,
            label: 'Delete Node',
            shortcut: 'Del',
            danger: true,
            action: actions.onDelete
        }
    ];
}

export function getMemberContextMenuItems(
    memberId: string,
    actions: {
        onEdit?: () => void;
        onAssignSection?: () => void;
        onAssignMaterial?: () => void;
        onInsertNode?: () => void;
        onSplit?: () => void;
        onAssignLoad?: () => void;
        onReleases?: () => void; // Legacy, kept for compatibility
        onSpecifications?: () => void; // New unified specs
        onDelete?: () => void;
    }
): ContextMenuItem[] {
    return [
        {
            type: 'action',
            id: 'edit',
            icon: <Edit className="w-full h-full" />,
            label: 'Edit Properties',
            action: actions.onEdit
        },
        { type: 'divider' },
        {
            type: 'action',
            id: 'assign-section',
            icon: <Box className="w-full h-full" />,
            label: 'Assign Section',
            shortcut: 'S',
            action: actions.onAssignSection
        },
        {
            type: 'action',
            id: 'assign-material',
            icon: <Settings className="w-full h-full" />,
            label: 'Assign Material',
            action: actions.onAssignMaterial
        },
        {
            type: 'action',
            id: 'releases',
            icon: <GitBranch className="w-full h-full" />,
            label: 'Member Releases',
            action: actions.onReleases
        },
        { type: 'divider' },
        {
            type: 'action',
            id: 'insert-node',
            icon: <Scissors className="w-full h-full" />,
            label: 'Insert Node',
            action: actions.onInsertNode
        },
        {
            type: 'action',
            id: 'split-at-nodes',
            icon: <Scissors className="w-full h-full" />,
            label: 'Split at Nodes',
            action: actions.onSplit
        },
        { type: 'divider' },
        {
            type: 'action',
            id: 'specifications',
            icon: <Settings2 className="w-full h-full" />,
            label: 'Member Specifications',
            action: actions.onSpecifications
        },
        { type: 'divider' },
        {
            type: 'action',
            id: 'assign-load',
            icon: <Box className="w-full h-full" />,
            label: 'Add Load',
            shortcut: 'L',
            action: actions.onAssignLoad
        },
        { type: 'divider' },
        {
            type: 'action',
            id: 'delete',
            icon: <Trash2 className="w-full h-full" />,
            label: 'Delete Member',
            shortcut: 'Del',
            danger: true,
            action: actions.onDelete
        }
    ];
}

export function getEmptyContextMenuItems(
    actions: {
        onAddNodeHere?: () => void;
        onPaste?: () => void;
        onFitView?: () => void;
        onToggleGrid?: () => void;
        onViewSettings?: () => void;
    }
): ContextMenuItem[] {
    return [
        {
            type: 'action',
            id: 'add-node',
            icon: <Plus className="w-full h-full" />,
            label: 'Add Node Here',
            shortcut: 'N',
            action: actions.onAddNodeHere
        },
        {
            type: 'action',
            id: 'paste',
            icon: <Clipboard className="w-full h-full" />,
            label: 'Paste',
            shortcut: 'Ctrl+V',
            action: actions.onPaste
        },
        { type: 'divider' },
        {
            type: 'action',
            id: 'fit-view',
            icon: <MoveHorizontal className="w-full h-full" />,
            label: 'Fit View',
            shortcut: 'Home',
            action: actions.onFitView
        },
        {
            type: 'submenu',
            id: 'view',
            icon: <Eye className="w-full h-full" />,
            label: 'View Options',
            submenu: [
                {
                    type: 'action',
                    id: 'toggle-grid',
                    label: 'Toggle Grid',
                    shortcut: 'G',
                    action: actions.onToggleGrid
                },
                {
                    type: 'action',
                    id: 'view-settings',
                    label: 'View Settings',
                    action: actions.onViewSettings
                }
            ]
        }
    ];
}

export { ContextMenu };
