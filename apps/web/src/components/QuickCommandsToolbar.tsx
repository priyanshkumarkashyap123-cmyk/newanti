/**
 * QuickCommandsToolbar.tsx - Spacebar-Activated Command Palette
 * 
 * STAAD Pro-style floating toolbar that appears when pressing spacebar.
 * Provides quick access to frequently used commands.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    MousePointer,
    Move,
    Plus,
    Minus,
    Box,
    Circle,
    Square,
    Maximize2,
    RotateCcw,
    Play,
    Target,
    Grid,
    X
} from 'lucide-react';

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

    return createPortal(
        <div
            ref={toolbarRef}
            className="fixed z-[9999] bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-150"
            style={{
                left: Math.min(position.x, window.innerWidth - 400),
                top: Math.min(position.y, window.innerHeight - 200),
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-zinc-700">
                <span className="text-xs font-medium text-zinc-400">Quick Commands</span>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-zinc-700 rounded transition-colors"
                >
                    <X className="w-3 h-3 text-zinc-400" />
                </button>
            </div>

            {/* Command Grid */}
            <div className="flex flex-wrap gap-1 max-w-[380px]">
                {commands.map((cmd, index) => (
                    <button
                        key={cmd.id}
                        onClick={() => {
                            cmd.action();
                            onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`
                            flex flex-col items-center justify-center gap-1 p-3 rounded-lg
                            min-w-[70px] transition-all duration-150
                            ${selectedIndex === index
                                ? 'bg-blue-600 text-white'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                            }
                        `}
                    >
                        <div className="w-5 h-5">{cmd.icon}</div>
                        <span className="text-[10px] font-medium whitespace-nowrap">{cmd.label}</span>
                        {cmd.shortcut && (
                            <span className="text-[9px] text-zinc-400 opacity-70">{cmd.shortcut}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Footer hint */}
            <div className="mt-2 pt-2 border-t border-zinc-700 text-center">
                <span className="text-[10px] text-zinc-400">
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
    return [
        {
            id: 'select',
            icon: <MousePointer className="w-full h-full" />,
            label: 'Select',
            shortcut: 'V',
            action: actions.onSelect || (() => { }),
            group: 'cursor'
        },
        {
            id: 'move',
            icon: <Move className="w-full h-full" />,
            label: 'Move',
            shortcut: 'M',
            action: actions.onMove || (() => { }),
            group: 'cursor'
        },
        {
            id: 'add-node',
            icon: <Circle className="w-full h-full" />,
            label: 'Add Node',
            shortcut: 'N',
            action: actions.onAddNode || (() => { }),
            group: 'geometry'
        },
        {
            id: 'add-beam',
            icon: <Minus className="w-full h-full" />,
            label: 'Add Beam',
            shortcut: 'B',
            action: actions.onAddBeam || (() => { }),
            group: 'geometry'
        },
        {
            id: 'add-load',
            icon: <Plus className="w-full h-full" />,
            label: 'Add Load',
            shortcut: 'L',
            action: actions.onAddLoad || (() => { }),
            group: 'loading'
        },
        {
            id: 'section',
            icon: <Square className="w-full h-full" />,
            label: 'Section',
            shortcut: 'S',
            action: actions.onAssignSection || (() => { }),
            group: 'properties'
        },
        {
            id: 'support',
            icon: <Target className="w-full h-full" />,
            label: 'Support',
            shortcut: 'U',
            action: actions.onAssignSupport || (() => { }),
            group: 'properties'
        },
        {
            id: 'run-analysis',
            icon: <Play className="w-full h-full" />,
            label: 'Analyze',
            shortcut: 'F5',
            action: actions.onRunAnalysis || (() => { }),
            group: 'analysis'
        },
        {
            id: 'fit-view',
            icon: <Maximize2 className="w-full h-full" />,
            label: 'Fit View',
            shortcut: 'Home',
            action: actions.onFitView || (() => { }),
            group: 'view'
        },
        {
            id: 'toggle-grid',
            icon: <Grid className="w-full h-full" />,
            label: 'Grid',
            shortcut: 'G',
            action: actions.onToggleGrid || (() => { }),
            group: 'view'
        },
    ];
}

export { QuickCommandsToolbar };
