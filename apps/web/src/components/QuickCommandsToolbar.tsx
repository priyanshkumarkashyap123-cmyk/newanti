/**
 * QuickCommandsToolbar.tsx - Spacebar-Activated Command Palette
 * 
 * STAAD Pro-style floating toolbar that appears when pressing spacebar.
 * Provides quick access to frequently used commands.
 */

import React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getQuickActionIds } from '../data/modelingActionRegistry';

// ============================================
// TYPES
// ============================================

export type QuickCommand = {
    id: string;
    icon: React.ReactNode;
    label: string;
    shortcut?: string;
    action: () => void;
    group?: string;
};

interface QuickCommandsToolbarProps {
    commands: QuickCommand[];
    onClose: () => void;
    position: { x: number; y: number };
}

// ============================================
// QUICK COMMANDS TOOLBAR COMPONENT
// ============================================

function QuickCommandsToolbar({ commands, onClose, position }: QuickCommandsToolbarProps) {
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
                case 'ArrowRight':
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev + 1) % commands.length);
                    break;
                case 'ArrowLeft':
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev - 1 + commands.length) % commands.length);
                    break;
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    commands[selectedIndex]?.action();
                    onClose();
                    break;
                default:
                    // Check for keyboard shortcuts (1-9 for quick selection)
                    if (e.key >= '1' && e.key <= '9') {
                        const index = parseInt(e.key) - 1;
                        if (index < commands.length) {
                            e.preventDefault();
                            commands[index].action();
                            onClose();
                        }
                    }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [commands, selectedIndex, onClose]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Group commands by their group property
    const groupedCommands = commands.reduce((acc, cmd) => {
        const group = cmd.group || 'default';
        if (!acc[group]) acc[group] = [];
        acc[group].push(cmd);
        return acc;
    }, {} as Record<string, QuickCommand[]>);

    // Define group display order and labels (STAAD Pro-style workflow)
    const groupOrder: { key: string; label: string }[] = [
        { key: 'geometry', label: 'Geometry' },
        { key: 'properties', label: 'Properties' },
        { key: 'loading', label: 'Loading' },
        { key: 'analysis', label: 'Analysis' },
        { key: 'view', label: 'View' },
        { key: 'cursor', label: 'Tools' },
        { key: 'default', label: 'Other' },
    ];

    // Compute flat index for keyboard navigation
    let flatIndex = 0;
    const flatMap: { group: string; cmd: QuickCommand; flat: number }[] = [];
    for (const g of groupOrder) {
        const cmds = groupedCommands[g.key];
        if (cmds) {
            for (const cmd of cmds) {
                flatMap.push({ group: g.key, cmd, flat: flatIndex++ });
            }
        }
    }

    return createPortal(
        <div
            ref={toolbarRef}
            className="fixed z-[9999] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-[#1a2333] rounded-xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150"
            style={{
                left: Math.min(position.x, window.innerWidth - 400),
                top: Math.min(position.y, window.innerHeight - 300),
                maxWidth: 420,
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-1 pb-2 mb-2 border-b border-[#1a2333]">
                <span className="text-xs font-medium tracking-wide tracking-wide text-[#869ab8]">Quick Commands</span>
                <button type="button"
                    onClick={onClose}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                >
                    <X className="w-3 h-3 text-[#869ab8]" />
                </button>
            </div>

            {/* Grouped Command Grid */}
            <div className="space-y-3">
                {groupOrder.map((g) => {
                    const cmds = groupedCommands[g.key];
                    if (!cmds || cmds.length === 0) return null;
                    return (
                        <div key={g.key}>
                            <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 mb-1 px-1">
                                {g.label}
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {cmds.map((cmd) => {
                                    const fi = flatMap.find((f) => f.cmd.id === cmd.id);
                                    const index = fi ? fi.flat : 0;
                                    return (
                                        <button type="button"
                                            key={cmd.id}
                                            onClick={() => {
                                                cmd.action();
                                                onClose();
                                            }}
                                            onMouseEnter={() => setSelectedIndex(index)}
                                            className={`
                                                flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg
                                                min-w-[64px] transition-all duration-150
                                                ${selectedIndex === index
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-[#131b2e] hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                                                }
                                            `}
                                        >
                                            <div className="w-4 h-4">{cmd.icon}</div>
                                            <span className="text-[10px] font-medium tracking-wide tracking-wide whitespace-nowrap">{cmd.label}</span>
                                            {cmd.shortcut && (
                                                <span className={`text-[9px] ${selectedIndex === index ? 'text-blue-200' : 'text-slate-500'}`}>{cmd.shortcut}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer hint */}
            <div className="mt-2 pt-2 border-t border-[#1a2333] text-center">
                <span className="text-[10px] text-[#869ab8]">
                    Arrow keys to navigate • Enter to select • Esc to close
                </span>
            </div>
        </div>,
        document.body
    );
}

// ============================================
// HOOK: useQuickCommands
// ============================================

export function useQuickCommands(commands: QuickCommand[]) {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const handleSpacebar = useCallback((e: KeyboardEvent) => {
        // Only trigger if spacebar and not in an input/textarea
        const target = e.target as HTMLElement;
        const isInputFocused =
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable;

        if (e.key === ' ' && !isInputFocused && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();

            // Position at center of viewport or near cursor
            setPosition({
                x: window.innerWidth / 2 - 190,
                y: window.innerHeight / 2 - 100
            });
            setIsOpen(true);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('keydown', handleSpacebar);
        return () => document.removeEventListener('keydown', handleSpacebar);
    }, [handleSpacebar]);

    const close = useCallback(() => setIsOpen(false), []);

    return {
        isOpen,
        position,
        close,
        QuickCommandsToolbar: isOpen ? (
            <QuickCommandsToolbar
                commands={commands}
                onClose={close}
                position={position}
            />
        ) : null
    };
}

// ============================================
// DEFAULT COMMANDS FACTORY
// ============================================

export function getDefaultQuickCommands(actions: {
    onAddNode?: () => void;
    onAddBeam?: () => void;
    onAddLoad?: () => void;
    onAssignSection?: () => void;
    onAssignSupport?: () => void;
    onRunAnalysis?: () => void;
    onFitView?: () => void;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onToggleGrid?: () => void;
    onSelect?: () => void;
    onMove?: () => void;
}): QuickCommand[] {
    const actionById: Record<string, () => void> = {
        select: actions.onSelect || (() => { }),
        move: actions.onMove || (() => { }),
        'add-node': actions.onAddNode || (() => { }),
        'add-beam': actions.onAddBeam || (() => { }),
        'point-load': actions.onAddLoad || (() => { }),
        'assign-section': actions.onAssignSection || (() => { }),
        'support-tool': actions.onAssignSupport || (() => { }),
        'run-analysis': actions.onRunAnalysis || (() => { }),
        ortho: actions.onToggleGrid || (() => { }),
    };

    const quickActions = getQuickActionIds();
    const mappedQuickActions: QuickCommand[] = quickActions.map((action) => {
        const Icon = action.icon;
        return {
            id: action.id,
            icon: <Icon className="w-full h-full" />,
            label: action.label,
            shortcut: action.shortcut,
            action: actionById[action.id] || (() => { }),
            group: action.quickGroup,
        };
    });

    // Keep fit-view explicitly as a viewport utility shortcut.
    mappedQuickActions.push({
        id: 'fit-view',
        icon: actions.onFitView ? <span className="w-full h-full inline-flex items-center justify-center text-[10px] font-bold">Fit</span> : <span className="w-full h-full inline-flex items-center justify-center text-[10px] font-bold">Fit</span>,
        label: 'Fit View',
        shortcut: 'Home',
        action: actions.onFitView || (() => { }),
        group: 'view',
    });

    return mappedQuickActions;
}

export { QuickCommandsToolbar };
