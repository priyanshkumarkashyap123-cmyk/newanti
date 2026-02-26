/**
 * KeyboardShortcuts Component
 * Modal displaying all available keyboard shortcuts
 */

import React from 'react';
import { FC, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Command, Keyboard, Mouse, Layers,
    ZoomIn, ZoomOut, RotateCcw, Move, Eye
} from 'lucide-react';

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
    <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 bg-slate-800 text-slate-300 text-sm font-medium rounded border border-slate-700 shadow-sm">
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
    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
        return undefined;
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-3xl max-h-[80vh] overflow-hidden"
                    >
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                                        <Keyboard className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Keyboard Shortcuts</h2>
                                        <p className="text-sm text-slate-400">Press ⌘/ to toggle this panel</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 overflow-y-auto max-h-[60vh]">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {shortcutCategories.map((category) => (
                                        <div key={category.title}>
                                            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
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
                                                        <span className="text-slate-300">
                                                            {shortcut.description}
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            {shortcut.keys.map((key, i) => (
                                                                <span key={i} className="flex items-center gap-1">
                                                                    <KeyBadge keyName={key} />
                                                                    {i < shortcut.keys.length - 1 && (
                                                                        <span className="text-slate-500 text-xs">+</span>
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
                            <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-800 text-center">
                                <p className="text-sm text-slate-400">
                                    Pro tip: Use <KeyBadge keyName="⌘K" /> to quickly search and execute any command
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
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
