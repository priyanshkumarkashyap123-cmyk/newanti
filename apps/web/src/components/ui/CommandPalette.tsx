/**
 * CommandPalette Component
 * Spotlight-style command palette with fuzzy search
 * Triggered by ⌘K / Ctrl+K
 */

import { FC, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Command, ArrowRight, Plus, Settings, HelpCircle,
    FileText, Play, Download, Upload, Folder, Home, LogOut,
    Keyboard, Moon, Sun, Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ============================================
// Types
// ============================================

interface CommandItem {
    id: string;
    label: string;
    description?: string;
    icon: React.ReactNode;
    shortcut?: string;
    action: () => void;
    category: string;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    customCommands?: CommandItem[];
}

// ============================================
// Default Commands
// ============================================

const createDefaultCommands = (navigate: (path: string) => void, onClose: () => void): CommandItem[] => [
    // Navigation
    {
        id: 'nav-home',
        label: 'Go to Home',
        description: 'Navigate to the landing page',
        icon: <Home className="w-4 h-4" />,
        shortcut: '⌘H',
        action: () => { navigate('/'); onClose(); },
        category: 'Navigation',
    },
    {
        id: 'nav-dashboard',
        label: 'Go to Dashboard',
        description: 'View your projects and stats',
        icon: <Folder className="w-4 h-4" />,
        shortcut: '⌘D',
        action: () => { navigate('/app'); onClose(); },
        category: 'Navigation',
    },
    {
        id: 'nav-settings',
        label: 'Open Settings',
        description: 'Manage your preferences',
        icon: <Settings className="w-4 h-4" />,
        shortcut: '⌘,',
        action: () => { navigate('/settings'); onClose(); },
        category: 'Navigation',
    },
    {
        id: 'nav-help',
        label: 'Help & Tutorials',
        description: 'Learn how to use BeamLab',
        icon: <HelpCircle className="w-4 h-4" />,
        shortcut: '⌘?',
        action: () => { navigate('/help'); onClose(); },
        category: 'Navigation',
    },

    // Actions
    {
        id: 'action-new-project',
        label: 'Create New Project',
        description: 'Start a new structural analysis',
        icon: <Plus className="w-4 h-4" />,
        shortcut: '⌘N',
        action: () => { navigate('/demo'); onClose(); },
        category: 'Actions',
    },
    {
        id: 'action-run-analysis',
        label: 'Run Analysis',
        description: 'Execute structural analysis',
        icon: <Play className="w-4 h-4" />,
        shortcut: '⌘⏎',
        action: () => { console.log('Run analysis'); onClose(); },
        category: 'Actions',
    },
    {
        id: 'action-export',
        label: 'Export Results',
        description: 'Download analysis results',
        icon: <Download className="w-4 h-4" />,
        shortcut: '⌘E',
        action: () => { navigate('/reports'); onClose(); },
        category: 'Actions',
    },
    {
        id: 'action-import',
        label: 'Import Model',
        description: 'Load a structural model file',
        icon: <Upload className="w-4 h-4" />,
        shortcut: '⌘O',
        action: () => { console.log('Import model'); onClose(); },
        category: 'Actions',
    },

    // Quick Actions
    {
        id: 'quick-shortcuts',
        label: 'Keyboard Shortcuts',
        description: 'View all keyboard shortcuts',
        icon: <Keyboard className="w-4 h-4" />,
        shortcut: '⌘/',
        action: () => { console.log('Show shortcuts'); onClose(); },
        category: 'Quick Actions',
    },
];

// ============================================
// Fuzzy Search
// ============================================

const fuzzySearch = (query: string, items: CommandItem[]): CommandItem[] => {
    if (!query) return items;

    const lowerQuery = query.toLowerCase();

    return items
        .filter(item => {
            const label = item.label.toLowerCase();
            const description = item.description?.toLowerCase() || '';
            const category = item.category.toLowerCase();

            return (
                label.includes(lowerQuery) ||
                description.includes(lowerQuery) ||
                category.includes(lowerQuery)
            );
        })
        .sort((a, b) => {
            // Prioritize label matches
            const aLabelMatch = a.label.toLowerCase().startsWith(lowerQuery);
            const bLabelMatch = b.label.toLowerCase().startsWith(lowerQuery);

            if (aLabelMatch && !bLabelMatch) return -1;
            if (!aLabelMatch && bLabelMatch) return 1;
            return 0;
        });
};

// ============================================
// Command Palette Component
// ============================================

export const CommandPalette: FC<CommandPaletteProps> = ({
    isOpen,
    onClose,
    customCommands = [],
}) => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const defaultCommands = useMemo(
        () => createDefaultCommands(navigate, onClose),
        [navigate, onClose]
    );

    const allCommands = useMemo(
        () => [...defaultCommands, ...customCommands],
        [defaultCommands, customCommands]
    );

    const filteredCommands = useMemo(
        () => fuzzySearch(query, allCommands),
        [query, allCommands]
    );

    // Group by category
    const groupedCommands = useMemo(() => {
        const groups: Record<string, CommandItem[]> = {};
        filteredCommands.forEach(cmd => {
            if (!groups[cmd.category]) groups[cmd.category] = [];
            groups[cmd.category].push(cmd);
        });
        return groups;
    }, [filteredCommands]);

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredCommands[selectedIndex]) {
                    filteredCommands[selectedIndex].action();
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }, [filteredCommands, selectedIndex, onClose]);

    // Scroll selected into view
    useEffect(() => {
        const selected = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
        selected?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

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
                        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
                    />

                    {/* Palette */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="fixed top-[20%] left-1/2 -translate-x-1/2 z-[101] w-full max-w-xl"
                    >
                        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                            {/* Search Input */}
                            <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800">
                                <Search className="w-5 h-5 text-slate-500" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => {
                                        setQuery(e.target.value);
                                        setSelectedIndex(0);
                                    }}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Search commands..."
                                    className="flex-1 bg-transparent text-white placeholder:text-slate-500 focus:outline-none text-lg"
                                />
                                <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 bg-slate-800 text-slate-400 text-xs rounded border border-slate-700">
                                    <Command className="w-3 h-3" />K
                                </kbd>
                            </div>

                            {/* Results */}
                            <div
                                ref={listRef}
                                className="max-h-[400px] overflow-y-auto p-2"
                            >
                                {filteredCommands.length === 0 ? (
                                    <div className="py-12 text-center text-slate-500">
                                        <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p>No commands found</p>
                                    </div>
                                ) : (
                                    Object.entries(groupedCommands).map(([category, commands]) => (
                                        <div key={category} className="mb-4 last:mb-0">
                                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                {category}
                                            </div>
                                            {commands.map((cmd) => {
                                                const globalIndex = filteredCommands.indexOf(cmd);
                                                const isSelected = globalIndex === selectedIndex;

                                                return (
                                                    <button
                                                        key={cmd.id}
                                                        data-index={globalIndex}
                                                        onClick={cmd.action}
                                                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                                                        className={`
                                                            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                                            transition-colors text-left
                                                            ${isSelected
                                                                ? 'bg-blue-600 text-white'
                                                                : 'text-slate-300 hover:bg-slate-800'
                                                            }
                                                        `}
                                                    >
                                                        <div className={`
                                                            w-8 h-8 rounded-lg flex items-center justify-center
                                                            ${isSelected ? 'bg-blue-500' : 'bg-slate-800'}
                                                        `}>
                                                            {cmd.icon}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium truncate">
                                                                {cmd.label}
                                                            </div>
                                                            {cmd.description && (
                                                                <div className={`text-sm truncate ${isSelected ? 'text-blue-200' : 'text-slate-500'
                                                                    }`}>
                                                                    {cmd.description}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {cmd.shortcut && (
                                                            <kbd className={`
                                                                px-2 py-1 text-xs rounded
                                                                ${isSelected
                                                                    ? 'bg-blue-500 text-white'
                                                                    : 'bg-slate-800 text-slate-400'
                                                                }
                                                            `}>
                                                                {cmd.shortcut}
                                                            </kbd>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-3 bg-slate-800/50 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-slate-700 rounded">↑</kbd>
                                        <kbd className="px-1.5 py-0.5 bg-slate-700 rounded">↓</kbd>
                                        to navigate
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-slate-700 rounded">↵</kbd>
                                        to select
                                    </span>
                                </div>
                                <span className="flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 bg-slate-700 rounded">esc</kbd>
                                    to close
                                </span>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// ============================================
// useCommandPalette Hook
// ============================================

export const useCommandPalette = () => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
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

export default CommandPalette;
