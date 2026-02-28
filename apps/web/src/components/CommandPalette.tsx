/**
 * CommandPalette.tsx - Global Command Palette (Cmd+K / Ctrl+K)
 * 
 * Provides instant access to all features via fuzzy search.
 * Inspired by VS Code, Figma, and Linear command palettes.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    Search,
    X,
    Box,
    Layers,
    Download,
    BarChart3,
    Ruler,
    Wind,
    Zap,
    Train,
    FileDown,
    Settings,
    Play,
    Plus,
    Trash2,
    Copy,
    Move,
    Grid3X3,
    Building2,
    Triangle,
    Calculator,
    FileJson,
    Landmark,
    Wand2,
    Crown,
    ChevronRight
} from 'lucide-react';
import { useUIStore, Category, CATEGORY_TOOLS } from '../store/uiStore';
import { useModelStore } from '../store/model';

// ============================================
// TYPES
// ============================================

interface Command {
    id: string;
    label: string;
    description: string;
    category: Category | 'GLOBAL';
    icon: React.ReactNode;
    shortcut?: string;
    action: () => void;
    isPro?: boolean;
    keywords?: string[];
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

// ============================================
// COMMAND REGISTRY
// ============================================

const useCommands = (): Command[] => {
    const setCategory = useUIStore((s) => s.setCategory);
    const setActiveTool = useUIStore((s) => s.setActiveTool);
    const openModal = useUIStore((s) => s.openModal);
    const clearModel = useModelStore((s) => s.clearModel);
    const loadStructure = useModelStore((s) => s.loadStructure);

    return useMemo(() => [
        // ========== QUICK ACTIONS ==========
        {
            id: 'run-analysis',
            label: 'Run Analysis',
            description: 'Execute structural analysis on current model',
            category: 'ANALYSIS' as Category,
            icon: <Play className="w-4 h-4 text-green-400" />,
            shortcut: '⌘⏎',
            action: () => document.dispatchEvent(new CustomEvent('trigger-analysis')),
            keywords: ['analyze', 'solve', 'calculate', 'run']
        },
        {
            id: 'new-project',
            label: 'New Project',
            description: 'Start a fresh structural model',
            category: 'GLOBAL',
            icon: <Plus className="w-4 h-4 text-blue-400" />,
            shortcut: '⌘N',
            action: () => clearModel(),
            keywords: ['new', 'clear', 'fresh', 'start']
        },
        {
            id: 'save-project',
            label: 'Save to Cloud',
            description: 'Save current project to cloud storage',
            category: 'GLOBAL',
            icon: <FileDown className="w-4 h-4 text-blue-400" />,
            shortcut: '⌘S',
            action: () => document.dispatchEvent(new CustomEvent('trigger-save')),
            keywords: ['save', 'cloud', 'store', 'backup']
        },

        // ========== CATEGORY SWITCHING ==========
        {
            id: 'category-modeling',
            label: 'Switch to Modeling',
            description: 'Draw nodes, beams, and edit geometry',
            category: 'MODELING' as Category,
            icon: <Box className="w-4 h-4 text-purple-400" />,
            action: () => setCategory('MODELING'),
            keywords: ['model', 'draw', 'geometry', 'create']
        },
        {
            id: 'category-properties',
            label: 'Switch to Properties',
            description: 'Assign sections, materials, and supports',
            category: 'PROPERTIES' as Category,
            icon: <Layers className="w-4 h-4 text-orange-400" />,
            action: () => setCategory('PROPERTIES'),
            keywords: ['properties', 'section', 'material', 'assign']
        },
        {
            id: 'category-loading',
            label: 'Switch to Loading',
            description: 'Apply loads and load combinations',
            category: 'LOADING' as Category,
            icon: <Download className="w-4 h-4 text-blue-400" />,
            action: () => setCategory('LOADING'),
            keywords: ['load', 'force', 'pressure', 'weight']
        },
        {
            id: 'category-analysis',
            label: 'Switch to Analysis',
            description: 'Run analysis and view results',
            category: 'ANALYSIS' as Category,
            icon: <BarChart3 className="w-4 h-4 text-green-400" />,
            action: () => setCategory('ANALYSIS'),
            keywords: ['analysis', 'solve', 'results', 'diagrams']
        },
        {
            id: 'category-design',
            label: 'Switch to Design',
            description: 'Perform code checks and generate reports',
            category: 'DESIGN' as Category,
            icon: <Ruler className="w-4 h-4 text-cyan-400" />,
            action: () => setCategory('DESIGN'),
            keywords: ['design', 'check', 'code', 'report']
        },

        // ========== STRUCTURE TEMPLATES ==========
        {
            id: 'structure-gallery',
            label: 'Structure Gallery',
            description: 'Browse iconic structures (Burj Khalifa, Golden Gate...)',
            category: 'MODELING' as Category,
            icon: <Landmark className="w-4 h-4 text-emerald-400" />,
            action: () => openModal('structureGallery'),
            keywords: ['gallery', 'famous', 'burj', 'bridge', 'iconic']
        },
        {
            id: 'structure-wizard',
            label: 'Structure Wizard',
            description: 'Generate trusses, frames, and parametric structures',
            category: 'MODELING' as Category,
            icon: <Wand2 className="w-4 h-4 text-purple-400" />,
            action: () => openModal('structureWizard'),
            keywords: ['wizard', 'generate', 'truss', 'frame', 'parametric']
        },

        // ========== LOAD GENERATORS ==========
        {
            id: 'wind-load-is875',
            label: 'Wind Load Generator (IS 875)',
            description: 'Indian Standard wind load calculation',
            category: 'LOADING' as Category,
            icon: <Wind className="w-4 h-4 text-cyan-400" />,
            action: () => openModal('windLoadDialog'),
            keywords: ['wind', 'is875', 'indian', 'load']
        },
        {
            id: 'seismic-load-is1893',
            label: 'Seismic Load Generator (IS 1893)',
            description: 'Indian Standard earthquake load calculation',
            category: 'LOADING' as Category,
            icon: <Zap className="w-4 h-4 text-red-400" />,
            action: () => openModal('seismicLoadDialog'),
            keywords: ['seismic', 'earthquake', 'is1893', 'indian']
        },
        {
            id: 'asce7-wind',
            label: 'ASCE 7 Wind Load',
            description: 'American Standard wind load (ASCE 7-22)',
            category: 'LOADING' as Category,
            icon: <Wind className="w-4 h-4 text-blue-400" />,
            action: () => openModal('asce7WindDialog'),
            keywords: ['asce', 'american', 'wind', 'usa']
        },
        {
            id: 'asce7-seismic',
            label: 'ASCE 7 Seismic Load',
            description: 'American Standard earthquake load (ASCE 7-22)',
            category: 'LOADING' as Category,
            icon: <Zap className="w-4 h-4 text-orange-400" />,
            action: () => openModal('asce7SeismicDialog'),
            keywords: ['asce', 'american', 'seismic', 'earthquake', 'usa']
        },
        {
            id: 'moving-load',
            label: 'Moving Load Analysis',
            description: 'IRC 6 / AASHTO vehicle and bridge loads',
            category: 'LOADING' as Category,
            icon: <Train className="w-4 h-4 text-amber-400" />,
            action: () => openModal('movingLoadDialog'),
            keywords: ['moving', 'vehicle', 'bridge', 'irc', 'aashto', 'truck']
        },
        {
            id: 'load-combinations',
            label: 'Load Combinations',
            description: 'ASCE 7 / IS 456 load combination factors',
            category: 'LOADING' as Category,
            icon: <Grid3X3 className="w-4 h-4 text-purple-400" />,
            action: () => openModal('loadCombinationsDialog'),
            keywords: ['combination', 'factor', 'asce', 'is456']
        },
        {
            id: 'loading-manager',
            label: 'Comprehensive Loading Manager',
            description: 'Nodal, member, floor, and thermal loads',
            category: 'LOADING' as Category,
            icon: <Download className="w-4 h-4 text-blue-400" />,
            action: () => openModal('loadDialog'),
            keywords: ['load', 'manager', 'nodal', 'member', 'udl']
        },

        // ========== SPECIAL STRUCTURES ==========
        {
            id: 'railway-bridge',
            label: 'Railway Bridge Designer',
            description: 'IRS/MBG compliant railway bridge design',
            category: 'MODELING' as Category,
            icon: <Train className="w-4 h-4 text-orange-400" />,
            action: () => openModal('railwayBridge'),
            isPro: true,
            keywords: ['railway', 'bridge', 'train', 'irs', 'mbg']
        },
        {
            id: 'foundation-design',
            label: 'Foundation Design',
            description: 'Isolated and combined footing design',
            category: 'DESIGN' as Category,
            icon: <Building2 className="w-4 h-4 text-amber-400" />,
            action: () => openModal('foundationDesign'),
            keywords: ['foundation', 'footing', 'isolated', 'combined']
        },

        // ========== ANALYSIS TYPES ==========
        {
            id: 'modal-analysis',
            label: 'Modal Analysis',
            description: 'Eigenvalue analysis for natural frequencies',
            category: 'ANALYSIS' as Category,
            icon: <BarChart3 className="w-4 h-4 text-purple-400" />,
            action: () => document.dispatchEvent(new CustomEvent('trigger-modal-analysis')),
            isPro: true,
            keywords: ['modal', 'eigenvalue', 'frequency', 'vibration']
        },
        {
            id: 'advanced-analysis',
            label: 'Advanced Analysis Options',
            description: 'P-Delta, Buckling, Time History analysis',
            category: 'ANALYSIS' as Category,
            icon: <Calculator className="w-4 h-4 text-cyan-400" />,
            action: () => openModal('advancedAnalysis'),
            isPro: true,
            keywords: ['advanced', 'pdelta', 'buckling', 'nonlinear']
        },

        // ========== DESIGN CODES ==========
        {
            id: 'design-codes',
            label: 'Design Code Checks',
            description: 'IS 456, IS 800, AISC 360, Eurocode verification',
            category: 'DESIGN' as Category,
            icon: <Ruler className="w-4 h-4 text-green-400" />,
            action: () => openModal('designCodes'),
            keywords: ['design', 'code', 'is456', 'is800', 'aisc', 'eurocode']
        },

        // ========== IMPORT/EXPORT ==========
        {
            id: 'import-export',
            label: 'Import / Export',
            description: 'DXF, IFC, JSON file interchange',
            category: 'GLOBAL',
            icon: <FileJson className="w-4 h-4 text-green-400" />,
            action: () => openModal('interoperability'),
            keywords: ['import', 'export', 'dxf', 'ifc', 'json', 'autocad']
        },

        // ========== TOOLS ==========
        {
            id: 'geometry-tools',
            label: 'Geometry Tools',
            description: 'Extrude, rotate, mirror, and align geometry',
            category: 'MODELING' as Category,
            icon: <Move className="w-4 h-4 text-teal-400" />,
            action: () => openModal('geometryTools'),
            keywords: ['geometry', 'extrude', 'rotate', 'mirror', 'align']
        },
        {
            id: 'fea-meshing',
            label: 'FEA Meshing',
            description: 'Generate plate and surface meshes',
            category: 'MODELING' as Category,
            icon: <Grid3X3 className="w-4 h-4 text-violet-400" />,
            action: () => openModal('meshing'),
            isPro: true,
            keywords: ['mesh', 'fea', 'plate', 'shell', 'finite element']
        },

        // ========== DRAWING TOOLS ==========
        {
            id: 'tool-select',
            label: 'Select Tool',
            description: 'Select nodes and members',
            category: 'MODELING' as Category,
            icon: <Box className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />,
            shortcut: 'V',
            action: () => { setCategory('MODELING'); setActiveTool('SELECT'); },
            keywords: ['select', 'pick', 'choose']
        },
        {
            id: 'tool-draw-node',
            label: 'Draw Node',
            description: 'Add a new node point',
            category: 'MODELING' as Category,
            icon: <Plus className="w-4 h-4 text-blue-400" />,
            shortcut: 'N',
            action: () => { setCategory('MODELING'); setActiveTool('DRAW_NODE'); },
            keywords: ['node', 'point', 'joint', 'add']
        },
        {
            id: 'tool-draw-beam',
            label: 'Draw Beam / Member',
            description: 'Add a new beam or member',
            category: 'MODELING' as Category,
            icon: <Box className="w-4 h-4 text-green-400" />,
            shortcut: 'B',
            action: () => { setCategory('MODELING'); setActiveTool('DRAW_BEAM'); },
            keywords: ['beam', 'member', 'line', 'element']
        },
        {
            id: 'tool-delete',
            label: 'Delete Selection',
            description: 'Remove selected elements',
            category: 'MODELING' as Category,
            icon: <Trash2 className="w-4 h-4 text-red-400" />,
            shortcut: '⌫',
            action: () => useModelStore.getState().deleteSelection(),
            keywords: ['delete', 'remove', 'erase']
        },
    ], [setCategory, setActiveTool, openModal, clearModel, loadStructure]);
};

// ============================================
// FUZZY SEARCH
// ============================================

const fuzzyMatch = (text: string, query: string): boolean => {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Exact match
    if (lowerText.includes(lowerQuery)) return true;

    // Fuzzy match - all query chars must appear in order
    let queryIdx = 0;
    for (let i = 0; i < lowerText.length && queryIdx < lowerQuery.length; i++) {
        if (lowerText[i] === lowerQuery[queryIdx]) {
            queryIdx++;
        }
    }
    return queryIdx === lowerQuery.length;
};

// ============================================
// COMMAND PALETTE COMPONENT
// ============================================

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const commands = useCommands();

    // Filter commands based on query
    const filteredCommands = useMemo(() => {
        if (!query.trim()) return commands;

        return commands.filter(cmd => {
            const searchText = `${cmd.label} ${cmd.description} ${cmd.keywords?.join(' ') || ''}`;
            return fuzzyMatch(searchText, query);
        });
    }, [commands, query]);

    // Reset selection when query changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            setQuery('');
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current) {
            const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
            if (selectedEl) {
                selectedEl.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredCommands[selectedIndex]) {
                    filteredCommands[selectedIndex].action();
                    onClose();
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }, [filteredCommands, selectedIndex, onClose]);

    // Execute command
    const executeCommand = useCallback((command: Command) => {
        command.action();
        onClose();
    }, [onClose]);

    if (!isOpen) return null;

    // Group commands by category
    const groupedCommands = filteredCommands.reduce((acc, cmd) => {
        const cat = cmd.category;
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(cmd);
        return acc;
    }, {} as Record<string, Command[]>);

    const categoryLabels: Record<string, string> = {
        'GLOBAL': '⚡ Quick Actions',
        'MODELING': '📐 Modeling',
        'PROPERTIES': '🔧 Properties',
        'LOADING': '⬇️ Loading',
        'ANALYSIS': '📊 Analysis',
        'DESIGN': '✅ Design'
    };

    let flatIndex = -1;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Palette */}
            <div
                className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-4 border-b border-zinc-200 dark:border-zinc-800">
                    <Search className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search all features... (e.g., 'wind load', 'modal analysis', 'burj khalifa')"
                        className="flex-1 bg-transparent text-zinc-900 dark:text-white text-lg placeholder-zinc-400 dark:placeholder-zinc-500 outline-none"
                    />
                    <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded">
                        ESC
                    </kbd>
                </div>

                {/* Commands List */}
                <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
                    {Object.entries(groupedCommands).map(([category, cmds]) => (
                        <div key={category}>
                            {/* Category Header */}
                            <div className="sticky top-0 px-4 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 bg-white/95 dark:bg-zinc-900/95 backdrop-blur uppercase tracking-wider">
                                {categoryLabels[category] || category}
                            </div>

                            {/* Commands */}
                            {cmds.map((cmd) => {
                                flatIndex++;
                                const isSelected = flatIndex === selectedIndex;

                                return (
                                    <button
                                        key={cmd.id}
                                        onClick={() => executeCommand(cmd)}
                                        className={`
                                            w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                                            ${isSelected
                                                ? 'bg-blue-600/20 border-l-2 border-blue-500'
                                                : 'hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 border-l-2 border-transparent'
                                            }
                                        `}
                                    >
                                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                                            {cmd.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-zinc-900 dark:text-white truncate">{cmd.label}</span>
                                                {cmd.isPro && (
                                                    <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded">
                                                        <Crown className="w-3 h-3" />
                                                        PRO
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{cmd.description}</span>
                                        </div>
                                        {cmd.shortcut && (
                                            <kbd className="flex-shrink-0 px-2 py-1 text-xs font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded">
                                                {cmd.shortcut}
                                            </kbd>
                                        )}
                                        <ChevronRight className="w-4 h-4 text-zinc-500" />
                                    </button>
                                );
                            })}
                        </div>
                    ))}

                    {filteredCommands.length === 0 && (
                        <div className="px-4 py-12 text-center">
                            <Search className="w-12 h-12 mx-auto text-zinc-500 mb-4" />
                            <p className="text-zinc-500 dark:text-zinc-400">No commands found for "{query}"</p>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Try different keywords</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80">
                    <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">↑↓</kbd>
                            Navigate
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">↵</kbd>
                            Select
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">ESC</kbd>
                            Close
                        </span>
                    </div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{filteredCommands.length} commands</span>
                </div>
            </div>
        </div>,
        document.body
    );
};

// ============================================
// GLOBAL KEYBOARD SHORTCUT HOOK
// ============================================

export const useCommandPalette = () => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd+K (Mac) or Ctrl+K (Windows)
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    return {
        isOpen,
        setIsOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen(prev => !prev)
    };
};

export default CommandPalette;
