/**
 * CommandPalette Component
 * Spotlight-style command palette with fuzzy search
 * Triggered by ⌘K / Ctrl+K
 */

import React from 'react';
import { FC, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Search, Command, ArrowRight, Plus, Settings, HelpCircle,
    FileText, Play, Download, Upload, Folder, Home, LogOut,
    Keyboard, Moon, Sun, Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from './dialog';
import {
    APP_SEARCH_ITEMS,
    getFeatureCategoryById,
    findFeatureByPath,
} from '../../config/appRouteMeta';

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
        action: () => { navigate('/stream'); onClose(); },
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
        action: () => { navigate('/app'); onClose(); },
        category: 'Actions',
    },
    {
        id: 'action-run-analysis',
        label: 'Run Analysis',
        description: 'Execute structural analysis',
        icon: <Play className="w-4 h-4" />,
        shortcut: '⌘⏎',
        action: () => { onClose(); },
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
        action: () => { onClose(); },
        category: 'Actions',
    },

    // Quick Actions
    {
        id: 'quick-shortcuts',
        label: 'Keyboard Shortcuts',
        description: 'View all keyboard shortcuts',
        icon: <Keyboard className="w-4 h-4" />,
        shortcut: '⌘/',
        action: () => { onClose(); },
        category: 'Quick Actions',
    },
];

const createRouteCommands = (
    navigate: (path: string) => void,
    onClose: () => void,
): CommandItem[] => {
    const seen = new Set<string>();

    return APP_SEARCH_ITEMS
        .filter((item) => {
            const key = `${item.path}|${item.label}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .map((item): CommandItem => {
            const feature = findFeatureByPath(item.path);
            const featureCategory = feature ? getFeatureCategoryById(feature.category) : undefined;
            const category = item.type === 'help'
                ? 'Help'
                : item.type === 'action'
                    ? 'Actions'
                    : 'Navigation';

            const icon = item.type === 'help'
                ? <HelpCircle className="w-4 h-4" />
                : item.type === 'action'
                    ? <Zap className="w-4 h-4" />
                    : <ArrowRight className="w-4 h-4" />;

            return {
                id: `route-${item.type}-${item.path}`,
                label: item.label,
                description: featureCategory
                    ? `${featureCategory.label}${featureCategory.planRequired ? ` • ${featureCategory.planRequired}` : ''}`
                    : `Open ${item.path}`,
                icon,
                shortcut: item.shortcut,
                category,
                action: () => {
                    navigate(item.path);
                    onClose();
                },
            };
        });
};

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

    const routeCommands = useMemo(
        () => createRouteCommands(navigate, onClose),
        [navigate, onClose]
    );

    const allCommands = useMemo(
        () => [...defaultCommands, ...routeCommands, ...customCommands],
        [defaultCommands, routeCommands, customCommands]
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
            queueMicrotask(() => {
                setQuery('');
                setSelectedIndex(0);
            });
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
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xl p-0 overflow-hidden top-[20%] translate-y-0">
                {/* Search Input */}
                            <div className="flex items-center gap-3 px-4 py-4 border-b border-[#1a2333]">
                                <Search className="w-5 h-5 text-[#869ab8]" />
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
                                    className="flex-1 bg-transparent text-[#dae2fd] placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none text-lg"
                                />
                                <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 bg-[#131b2e] text-[#869ab8] text-xs rounded border border-[#1a2333]">
                                    <Command className="w-3 h-3" />K
                                </kbd>
                            </div>

                            {/* Results */}
                            <div
                                ref={listRef}
                                className="max-h-[400px] overflow-y-auto p-2"
                            >
                                {filteredCommands.length === 0 ? (
                                    <div className="py-12 text-center text-[#869ab8]">
                                        <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p>No commands found</p>
                                    </div>
                                ) : (
                                    Object.entries(groupedCommands).map(([category, commands]) => (
                                        <div key={category} className="mb-4 last:mb-0">
                                            <div className="px-3 py-2 text-xs font-semibold text-[#869ab8] uppercase tracking-wider">
                                                {category}
                                            </div>
                                            {commands.map((cmd) => {
                                                const globalIndex = filteredCommands.indexOf(cmd);
                                                const isSelected = globalIndex === selectedIndex;

                                                return (
                                                    <button type="button"
                                                        key={cmd.id}
                                                        data-index={globalIndex}
                                                        onClick={cmd.action}
                                                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                                                        className={`
                                                            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                                            transition-colors text-left
                                                            ${isSelected
                                                                ? 'bg-blue-600 text-white'
                                                                : 'text-[#adc6ff] hover:bg-[#131b2e]'
                                                            }
                                                        `}
                                                    >
                                                        <div className={`
                                                            w-8 h-8 rounded-lg flex items-center justify-center
                                                            ${isSelected ? 'bg-blue-500' : 'bg-[#131b2e]'}
                                                        `}>
                                                            {cmd.icon}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium tracking-wide truncate">
                                                                {cmd.label}
                                                            </div>
                                                            {cmd.description && (
                                                                <div className={`text-sm truncate ${isSelected ? 'text-blue-200' : 'text-[#869ab8]'
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
                                                                    : 'bg-[#131b2e] text-[#869ab8]'
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
                            <div className="px-4 py-3 bg-[#131b2e] border-t border-[#1a2333] flex items-center justify-between text-xs text-[#869ab8]">
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">↑</kbd>
                                        <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">↓</kbd>
                                        to navigate
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">↵</kbd>
                                        to select
                                    </span>
                                </div>
                                <span className="flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">esc</kbd>
                                    to close
                                </span>
                            </div>
            </DialogContent>
        </Dialog>
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

        const openPalette = () => {
            setIsOpen(true);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('beamlab:open-command-palette', openPalette as EventListener);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('beamlab:open-command-palette', openPalette as EventListener);
        };
    }, []);

    return {
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen(prev => !prev),
    };
};

export default CommandPalette;
