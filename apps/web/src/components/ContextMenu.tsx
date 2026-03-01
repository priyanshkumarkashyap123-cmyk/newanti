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

    // Close on escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

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

    // Calculate position to keep menu in viewport
    const adjustedPosition = {
        x: Math.min(position.x, window.innerWidth - 220),
        y: Math.min(position.y, window.innerHeight - 300)
    };

    const renderMenuItem = (item: ContextMenuItem, index: number) => {
        if (item.type === 'divider') {
            return <div key={index} className="my-1 h-px bg-slate-200 dark:bg-slate-700" />;
        }

        const isHovered = hoveredSubmenu === item.id;

        return (
            <div key={item.id || index} className="relative">
                <button
                    onClick={() => {
                        if (item.action && !item.disabled) {
                            item.action();
                            onClose();
                        }
                    }}
                    onMouseEnter={() => item.submenu && setHoveredSubmenu(item.id || null)}
                    onMouseLeave={() => !item.submenu && setHoveredSubmenu(null)}
                    disabled={item.disabled}
                    className={`
                        w-full flex items-center gap-3 px-3 py-2 text-left text-sm
                        transition-colors duration-75 rounded
                        ${item.disabled
                            ? 'text-slate-500 dark:text-slate-400 cursor-not-allowed'
                            : item.danger
                                ? 'text-red-400 hover:bg-red-500/20'
                                : 'text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }
                    `}
                >
                    <span className="w-4 h-4 flex-shrink-0 text-slate-500 dark:text-slate-400">
                        {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-4">
                            {item.shortcut}
                        </span>
                    )}
                    {item.submenu && (
                        <ChevronRight className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                    )}
                </button>

                {/* Submenu */}
                {item.submenu && isHovered && (
                    <div
                        className="absolute left-full top-0 ml-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 min-w-[160px]"
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
            className="fixed z-[9999] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl py-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-100"
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
