/**
 * KeyboardShortcuts Component
 * Modal displaying all available keyboard shortcuts
 */

import React from 'react';
import { FC, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Command, Keyboard, Mouse, Layers,
    ZoomIn, ZoomOut, RotateCcw, Move, Eye
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog';

// ============================================
// Types
// ============================================

interface Shortcut {
    keys: string[];
    description: string;
}

interface ShortcutCategory {
    title: string;
    icon: React.ReactNode;
    shortcuts: Shortcut[];
}

// ============================================
// Shortcut Data
// ============================================

const shortcutCategories: ShortcutCategory[] = [
    {
        title: 'General',
        icon: <Command className="w-4 h-4" />,
        shortcuts: [
            { keys: ['⌘', 'K'], description: 'Open command palette' },
            { keys: ['⌘', 'S'], description: 'Save project' },
            { keys: ['⌘', 'Z'], description: 'Undo' },
            { keys: ['⌘', '⇧', 'Z'], description: 'Redo' },
            { keys: ['⌘', '/'], description: 'Show keyboard shortcuts' },
            { keys: ['Esc'], description: 'Cancel / Close modal' },
        ],
    },
    {
        title: 'Viewport',
        icon: <Mouse className="w-4 h-4" />,
        shortcuts: [
            { keys: ['Scroll'], description: 'Zoom in/out' },
            { keys: ['Click', 'Drag'], description: 'Rotate view' },
            { keys: ['⇧', 'Drag'], description: 'Pan view' },
            { keys: ['F'], description: 'Fit model to view' },
            { keys: ['R'], description: 'Reset view' },
            { keys: ['1'], description: 'Front view' },
            { keys: ['2'], description: 'Top view' },
            { keys: ['3'], description: 'Right view' },
        ],
    },
    {
        title: 'Selection',
        icon: <Layers className="w-4 h-4" />,
        shortcuts: [
            { keys: ['Click'], description: 'Select element' },
            { keys: ['⇧', 'Click'], description: 'Add to selection' },
            { keys: ['⌘', 'A'], description: 'Select all' },
            { keys: ['⌘', 'D'], description: 'Deselect all' },
            { keys: ['Delete'], description: 'Delete selected' },
            { keys: ['⌘', 'C'], description: 'Copy selected' },
            { keys: ['⌘', 'V'], description: 'Paste' },
        ],
    },
    {
        title: 'Analysis',
        icon: <Eye className="w-4 h-4" />,
        shortcuts: [
            { keys: ['Space'], description: 'Run analysis' },
            { keys: ['⌘', '⏎'], description: 'Run with options' },
            { keys: ['T'], description: 'Toggle diagram type' },
            { keys: ['G'], description: 'Toggle grid' },
            { keys: ['L'], description: 'Toggle labels' },
            { keys: ['D'], description: 'Toggle deformed shape' },
        ],
    },
];

// ============================================
// Key Badge Component
// ============================================

const KeyBadge: FC<{ keyName: string }> = ({ keyName }) => (
    <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded border border-zinc-300 dark:border-zinc-700 shadow-sm">
        {keyName}
    </span>
);

// ============================================
// Keyboard Shortcuts Modal
// ============================================

interface KeyboardShortcutsProps {
    isOpen: boolean;
    onClose: () => void;
}

export const KeyboardShortcuts: FC<KeyboardShortcutsProps> = ({ isOpen, onClose }) => {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                            <Keyboard className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold">Keyboard Shortcuts</DialogTitle>
                            <DialogDescription>Press ⌘/ to toggle this panel</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {shortcutCategories.map((category) => (
                            <div key={category.title}>
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
                                    {category.icon}
                                    {category.title}
                                </h3>
                                <div className="space-y-3">
                                    {category.shortcuts.map((shortcut, index) => (
                                        <motion.div
                                            key={shortcut.description}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.02 }}
                                            className="flex items-center justify-between py-2"
                                        >
                                            <span className="text-zinc-700 dark:text-zinc-300">
                                                {shortcut.description}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                {shortcut.keys.map((key, i) => (
                                                    <span key={i} className="flex items-center gap-1">
                                                        <KeyBadge keyName={key} />
                                                        {i < shortcut.keys.length - 1 && (
                                                            <span className="text-zinc-400 dark:text-zinc-500 text-xs">+</span>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800 text-center">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Pro tip: Use <KeyBadge keyName="⌘K" /> to quickly search and execute any command
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// ============================================
// useKeyboardShortcuts Hook
// ============================================

export const useKeyboardShortcuts = () => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === '/') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return {
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen(prev => !prev),
    };
};

export default KeyboardShortcuts;
