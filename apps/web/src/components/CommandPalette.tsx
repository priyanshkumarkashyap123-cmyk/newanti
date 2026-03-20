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
    const showNotification = useUIStore((s) => s.showNotification);
    const setTool = useModelStore((s) => s.setTool);
    const clearModel = useModelStore((s) => s.clearModel);
    const loadStructure = useModelStore((s) => s.loadStructure);

    const prettifyToolName = useCallback((toolId: string): string => {
        return toolId
            .toLowerCase()
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }, []);

    const MODELING_TOOL_BRIDGE: Record<string, Parameters<typeof setTool>[0]> = {
        SELECT: 'select',
        SELECT_RANGE: 'select_range',
        DRAW_NODE: 'node',
        DRAW_BEAM: 'member',
        DRAW_COLUMN: 'member',
        ASSIGN_SUPPORT: 'support',
        ADD_POINT_LOAD: 'load',
        ADD_UDL: 'memberLoad',
    };

    return useMemo(() => {
        const manualCommands: Command[] = [
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
        {
            id: 'staad-command-explorer',
            label: 'STAAD Command Explorer',
            description: 'Open full command inventory with execution status (Ready / Partial / Limited)',
            category: 'GLOBAL',
            icon: <Search className="w-4 h-4 text-indigo-400" />,
            shortcut: '⌘K',
            action: () => document.dispatchEvent(new CustomEvent('open-staad-command-explorer')),
            keywords: ['staad', 'commands', 'inventory', 'explorer', 'coverage']
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
        {
            id: 'category-civil',
            label: 'Switch to Civil Engineering',
            description: 'Geotechnical, hydraulics, transport, and environmental tools',
            category: 'CIVIL' as Category,
            icon: <Building2 className="w-4 h-4 text-teal-400" />,
            action: () => setCategory('CIVIL'),
            keywords: ['civil', 'geotech', 'hydraulics', 'transport', 'environment', 'soil']
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
            icon: <Box className="w-4 h-4 text-[#869ab8]" />,
            shortcut: 'V',
            action: () => { setCategory('MODELING'); setTool('select'); showNotification('info', 'Select tool — click to select elements'); },
            keywords: ['select', 'pick', 'choose']
        },
        {
            id: 'tool-draw-node',
            label: 'Draw Node',
            description: 'Add a new node point',
            category: 'MODELING' as Category,
            icon: <Plus className="w-4 h-4 text-blue-400" />,
            shortcut: 'N',
            action: () => { setCategory('MODELING'); setTool('node'); showNotification('info', 'Node tool — click on grid to place nodes'); },
            keywords: ['node', 'point', 'joint', 'add']
        },
        {
            id: 'tool-draw-beam',
            label: 'Draw Beam / Member',
            description: 'Add a new beam or member',
            category: 'MODELING' as Category,
            icon: <Box className="w-4 h-4 text-green-400" />,
            shortcut: 'B',
            action: () => { setCategory('MODELING'); setTool('member'); showNotification('info', 'Beam tool — click two points to draw a beam'); },
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
        ];

        const dynamicCoverageCommands: Command[] = [];

        (Object.entries(CATEGORY_TOOLS) as [Category, string[]][]).forEach(([category, tools]) => {
            tools.forEach((toolId) => {
                const pretty = prettifyToolName(toolId);
                const bridgeTool = MODELING_TOOL_BRIDGE[toolId];

                dynamicCoverageCommands.push({
                    id: `staad-cmd-${category.toLowerCase()}-${toolId.toLowerCase()}`,
                    label: pretty,
                    description: `STAAD-style command from ${category} tools`,
                    category,
                    icon: <ChevronRight className="w-4 h-4 text-[#869ab8]" />,
                    action: () => {
                        setCategory(category);

                        // Route command to UI active tool surface when available
                        setActiveTool(toolId);

                        // Bridge core modeling commands to the canvas tool state
                        if (bridgeTool) {
                            setTool(bridgeTool);
                        }

                        showNotification('info', `${pretty} command is available and selected`);
                    },
                    isPro: [
                        'PUSHOVER', 'TIME_HISTORY', 'RESPONSE_SPECTRUM',
                        'ADD_MOVING_LOAD', 'ADD_HYDROSTATIC', 'ADD_PRETENSION',
                        'TIMBER_DESIGN', 'COMPOSITE_DESIGN', 'SECTION_BUILDER',
                    ].includes(toolId),
                    keywords: [
                        'staad',
                        'command',
                        'tool',
                        category.toLowerCase(),
                        ...pretty.toLowerCase().split(' '),
                    ],
                });
            });
        });

        const merged = [...manualCommands, ...dynamicCoverageCommands];
        const seen = new Set<string>();
        return merged.filter((cmd) => {
            if (seen.has(cmd.id)) return false;
            seen.add(cmd.id);
            return true;
        });
    }, [setCategory, setActiveTool, setTool, openModal, clearModel, loadStructure, showNotification, prettifyToolName]);
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

// ============================================
// RECENTLY USED TRACKING
// ============================================

const RECENT_KEY = 'beamlab-recent-commands';
const MAX_RECENT = 5;

const getRecentCommandIds = (): string[] => {
    try {
        return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch {
        return [];
    }
};

const trackCommandUsage = (id: string) => {
    const recent = getRecentCommandIds().filter(r => r !== id);
    recent.unshift(id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
};

// ============================================
// MATCH HIGHLIGHTING
// ============================================

const highlightMatch = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx === -1) return text;
    return (
        <>
            {text.slice(0, idx)}
            <mark className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
            {text.slice(idx + query.length)}
        </>
    );
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
    const commands = useCommands();

    // Filter commands based on query
    const filteredCommands = useMemo(() => {
        if (!query.trim()) return commands;

        return commands.filter(cmd => {
            const searchText = `${cmd.label} ${cmd.description} ${cmd.keywords?.join(' ') || ''}`;
            return fuzzyMatch(searchText, query);
        });
    }, [commands, query]);

    // Build grouped + flat command list (includes recent when no query)
    const { groupedCommands, allFlatCommands, categoryLabels } = useMemo(() => {
        const recentIds = getRecentCommandIds();
        const recentCommands = !query.trim()
            ? recentIds.map(id => commands.find(c => c.id === id)).filter(Boolean) as Command[]
            : [];

        const grouped: Record<string, Command[]> = {};
        if (recentCommands.length > 0) {
            grouped['RECENT'] = recentCommands;
        }
        filteredCommands.forEach(cmd => {
            const cat = cmd.category;
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(cmd);
        });

        const labels: Record<string, string> = {
            'RECENT': '🕐 Recently Used',
            'GLOBAL': '⚡ Quick Actions',
            'MODELING': '📐 Modeling',
            'PROPERTIES': '🔧 Properties',
            'LOADING': '⬇️ Loading',
            'ANALYSIS': '📊 Analysis',
            'DESIGN': '✅ Design',
            'CIVIL': '🏗️ Civil Engineering',
        };

        return {
            groupedCommands: grouped,
            allFlatCommands: Object.values(grouped).flat(),
            categoryLabels: labels,
        };
    }, [commands, filteredCommands, query]);

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

    // Scroll selected item into view (use ref map, not children indexing)
    useEffect(() => {
        const el = itemRefs.current.get(selectedIndex);
        if (el) {
            el.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, allFlatCommands.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (allFlatCommands[selectedIndex]) {
                    trackCommandUsage(allFlatCommands[selectedIndex].id);
                    allFlatCommands[selectedIndex].action();
                    onClose();
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }, [allFlatCommands, selectedIndex, onClose]);

    // Execute command and track usage
    const executeCommand = useCallback((command: Command) => {
        trackCommandUsage(command.id);
        command.action();
        onClose();
    }, [onClose]);

    if (!isOpen) return null;

    let flatIndex = -1;
    // Clear ref map at each render
    itemRefs.current.clear();

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Palette */}
            <div
                className="relative w-full max-w-2xl bg-[#0b1326] border border-[#1a2333] rounded-xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1a2333]">
                    <Search className="w-5 h-5 text-[#869ab8]" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search commands… try 'wind', 'modal', 'extrude', 'is 800'"
                        className="flex-1 bg-transparent text-[#dae2fd] text-lg placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                    />
                    <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-[#869ab8] bg-[#131b2e] border border-[#1a2333] rounded">
                        ESC
                    </kbd>
                </div>

                {/* Commands List */}
                <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
                    {Object.entries(groupedCommands).map(([category, cmds]) => (
                        <div key={category}>
                            {/* Category Header */}
                            <div className="sticky top-0 px-4 py-2 text-xs font-semibold text-[#869ab8] bg-white/95 dark:bg-slate-900/95 backdrop-blur uppercase tracking-wider flex items-center justify-between">
                                <span>{categoryLabels[category] || category}</span>
                                <span className="text-[10px] font-normal normal-case text-[#424754]">{cmds.length}</span>
                            </div>

                            {/* Commands */}
                            {cmds.map((cmd) => {
                                flatIndex++;
                                const isSelected = flatIndex === selectedIndex;

                                return (
                                    <button type="button"
                                        key={cmd.id}
                                        ref={(el) => { if (el) itemRefs.current.set(flatIndex, el); }}
                                        onClick={() => executeCommand(cmd)}
                                        onMouseEnter={() => setSelectedIndex(flatIndex)}
                                        className={`
                                            w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                                            ${isSelected
                                                ? 'bg-blue-600/20 border-l-2 border-blue-500'
                                                : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border-l-2 border-transparent'
                                            }
                                        `}
                                    >
                                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-[#131b2e]">
                                            {cmd.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium tracking-wide tracking-wide text-[#dae2fd] truncate">{highlightMatch(cmd.label, query)}</span>
                                                {cmd.isPro && (
                                                    <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded">
                                                        <Crown className="w-3 h-3" />
                                                        PRO
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-sm text-[#869ab8] truncate block">{highlightMatch(cmd.description, query)}</span>
                                        </div>
                                        {cmd.shortcut && (
                                            <kbd className="flex-shrink-0 px-2 py-1 text-xs font-mono text-[#869ab8] bg-[#131b2e] border border-[#1a2333] rounded">
                                                {cmd.shortcut}
                                            </kbd>
                                        )}
                                        <ChevronRight className="w-4 h-4 text-slate-500" />
                                    </button>
                                );
                            })}
                        </div>
                    ))}

                    {filteredCommands.length === 0 && (
                        <div className="px-4 py-12 text-center">
                            <Search className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                            <p className="text-[#869ab8]">No commands found for "{query}"</p>
                            <p className="text-sm text-[#869ab8] mt-1">Try different keywords</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-[#1a2333] bg-white/80 dark:bg-slate-900/80">
                    <div className="flex items-center gap-4 text-xs text-[#869ab8]">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-[#131b2e] rounded">↑↓</kbd>
                            Navigate
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-[#131b2e] rounded">↵</kbd>
                            Select
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-[#131b2e] rounded">ESC</kbd>
                            Close
                        </span>
                    </div>
                    <span className="text-xs text-[#869ab8]">
                        {query.trim()
                            ? `${allFlatCommands.length} of ${commands.length} matched`
                            : `${commands.length} commands`}
                    </span>
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
