/**
 * SmartSidebar.tsx - Dynamic Sidebar Based on Active Category
 * 
 * Renders different tool panels based on uiStore.activeCategory:
 * - MODELING: Template Bank, Draw Tools
 * - PROPERTIES: Section Picker
 * - LOADING: Load Generators, Manual Loads
 * - ANALYSIS: Solver Controls, Result Toggles
 * - DESIGN: Design Check panels
 */

import { FC, useState, useCallback } from 'react';
import {
    ChevronDown,
    ChevronRight,
    Box,
    Triangle,
    Building2,
    Plus,
    Trash2,
    MousePointer,
    Wind,
    Zap,
    Download,
    Play,
    CheckSquare,
    Square,
    Settings,
    Loader2,
    ArrowRight,
    Lock,
    Crown,
    Wand2,
    Copy,
    Clipboard,
    Move,

    Scissors,
    CheckCircle,
    Landmark
} from 'lucide-react';
import { useUIStore, Category } from '../../store/uiStore';
import { useModelStore } from '../../store/model';
import { TEMPLATE_BANK } from '../../data/templates';
import { useSubscription } from '../../hooks/useSubscription';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from '../ui/Tooltip';

// ============================================
// TYPES
// ============================================

interface AccordionItemProps {
    title: string;
    icon?: React.ReactNode;
    defaultOpen?: boolean;
    children: React.ReactNode;
}

// ============================================
// ACCORDION COMPONENT
// ============================================

const AccordionItem: FC<AccordionItemProps> = ({
    title,
    icon,
    defaultOpen = true,
    children
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border-b border-slate-700">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800/50 transition-colors"
            >
                {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
                {icon && <span className="text-slate-400">{icon}</span>}
                {title}
            </button>
            {isOpen && (
                <div className="px-3 pb-3">
                    {children}
                </div>
            )}
        </div>
    );
};

// ============================================
// MODELING PANELS
// ============================================

const TemplateBankPanel: FC = () => {
    const [loading, setLoading] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const clearModel = useModelStore((state) => state.clearModel);
    const loadStructure = useModelStore((state) => state.loadStructure);
    const addNode = useModelStore((state) => state.addNode);
    const addMember = useModelStore((state) => state.addMember);
    const updateNode = useModelStore((state) => state.updateNode);

    // Get unique categories from TEMPLATE_BANK
    const categories = ['all', ...new Set(Object.values(TEMPLATE_BANK).map(t => t.category))];

    // Filter templates by category
    const filteredTemplates = Object.entries(TEMPLATE_BANK).filter(
        ([, template]) => selectedCategory === 'all' || template.category === selectedCategory
    ).slice(0, 8); // Show max 8 templates

    const handleTemplateClick = useCallback(async (templateKey: string, template: typeof TEMPLATE_BANK[keyof typeof TEMPLATE_BANK]) => {
        setLoading(templateKey);
        try {
            // Clear existing model
            clearModel();

            // Add nodes with staggered animation
            for (const node of template.nodes) {
                addNode({
                    id: node.id,
                    x: node.x,
                    y: node.y,
                    z: node.z
                });

                // Set support if defined
                if (node.support && node.support !== 'NONE') {
                    const restraints = {
                        fx: node.support === 'FIXED' || node.support === 'PINNED',
                        fy: true, // All supports restrain Y
                        fz: node.support === 'FIXED' || node.support === 'PINNED',
                        mx: node.support === 'FIXED',
                        my: node.support === 'FIXED',
                        mz: node.support === 'FIXED'
                    };
                    updateNode(node.id, { restraints });
                }

                await new Promise(r => setTimeout(r, 20)); // Stagger
            }

            // Add members
            for (const member of template.members) {
                addMember({
                    id: member.id,
                    startNodeId: member.startNode,
                    endNodeId: member.endNode,
                    sectionId: member.section || 'ISMB300'
                });
                await new Promise(r => setTimeout(r, 15)); // Stagger
            }

            console.log(`✓ Loaded template: ${template.name}`);
        } catch (error) {
            console.error('Template load error:', error);
        } finally {
            setLoading(null);
        }
    }, [clearModel, addNode, addMember, updateNode]);

    // Icon mapping for categories
    const getCategoryIcon = (category: string) => {
        switch (category.toLowerCase()) {
            case 'industrial': return <Building2 className="w-4 h-4" />;
            case 'buildings': return <Building2 className="w-4 h-4" />;
            case 'trusses': return <Triangle className="w-4 h-4" />;
            case 'bridges': return <Box className="w-4 h-4" />;
            case 'beams': return <Box className="w-4 h-4" />;
            case 'towers': return <Triangle className="w-4 h-4" />;
            default: return <Box className="w-4 h-4" />;
        }
    };

    return (
        <div className="space-y-3">
            {/* Famous Structures Gallery Button - PROMINENT */}
            <div className="p-3 bg-gradient-to-r from-emerald-900/60 to-teal-900/60 border border-emerald-500/40 rounded-lg">
                <button
                    onClick={() => useUIStore.getState().openModal('structureGallery')}
                    className="w-full flex items-center justify-between mb-3 group"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/30 rounded-md group-hover:bg-emerald-500/40 transition-colors">
                            <Landmark className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div className="text-left">
                            <div className="text-base font-semibold text-emerald-100">🏗️ Iconic Structures</div>
                            <div className="text-[11px] text-emerald-400/70">Click to explore detailed famous buildings & bridges</div>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Quick Access - Top 3 Famous Structures */}
                <div className="grid grid-cols-1 gap-1.5">
                    <button
                        onClick={async () => {
                            const { generateBurjKhalifa } = await import('../../services/StructureFactory');
                            const structure = generateBurjKhalifa();
                            clearModel();
                            loadStructure(structure.nodes, structure.members);
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 text-xs bg-emerald-800/30 hover:bg-emerald-700/40 rounded text-emerald-200 transition-colors"
                    >
                        <span>🏢</span>
                        <span>Burj Khalifa (60 floors, 1500+ nodes)</span>
                    </button>
                    <button
                        onClick={async () => {
                            const { generateChenabBridge } = await import('../../services/StructureFactory');
                            const structure = generateChenabBridge();
                            clearModel();
                            loadStructure(structure.nodes, structure.members);
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 text-xs bg-emerald-800/30 hover:bg-emerald-700/40 rounded text-emerald-200 transition-colors"
                    >
                        <span>🌉</span>
                        <span>Chenab Bridge (467m arch span)</span>
                    </button>
                    <button
                        onClick={async () => {
                            const { generateGoldenGateBridge } = await import('../../services/StructureFactory');
                            const structure = generateGoldenGateBridge();
                            clearModel();
                            loadStructure(structure.nodes, structure.members);
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 text-xs bg-emerald-800/30 hover:bg-emerald-700/40 rounded text-emerald-200 transition-colors"
                    >
                        <span>🌁</span>
                        <span>Golden Gate Bridge (suspension)</span>
                    </button>
                </div>
            </div>

            <div className="h-px bg-zinc-800" />

            {/* Simple Templates Header */}
            <div className="text-[11px] text-zinc-500 font-medium uppercase tracking-wide">
                Quick Examples
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-1">
                {categories.slice(0, 5).map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`
                            px-2 py-1 text-xs rounded-md transition-colors capitalize
                            ${selectedCategory === cat
                                ? 'bg-blue-600 text-white'
                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }
                        `}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Templates List */}
            <div className="space-y-1.5">
                {filteredTemplates.map(([key, template]) => (
                    <button
                        key={key}
                        onClick={() => handleTemplateClick(key, template)}
                        disabled={loading !== null}
                        className={`
                            w-full flex items-center justify-between gap-2 px-3 py-2.5
                            text-sm text-left rounded-lg transition-all
                            ${loading === key
                                ? 'bg-blue-600/20 text-blue-400'
                                : 'text-zinc-300 bg-zinc-800/50 hover:bg-zinc-700/50'
                            }
                        `}
                    >
                        <span className="flex items-center gap-2">
                            {getCategoryIcon(template.category)}
                            <span className="truncate">{template.name}</span>
                        </span>
                        {loading === key ? (
                            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                        ) : (
                            <ArrowRight className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                        )}
                    </button>
                ))}
            </div>

            {/* Template count */}
            <p className="text-[10px] text-zinc-500 text-center">
                {filteredTemplates.length} quick templates • Click "Iconic Structures" for detailed models
            </p>
        </div>
    );
};


const DrawToolsPanel: FC = () => {
    const { activeTool, setActiveTool } = useUIStore();

    const tools = [
        { id: 'SELECT', label: 'Select', icon: <MousePointer className="w-4 h-4" /> },
        { id: 'DRAW_NODE', label: 'Add Node', icon: <Plus className="w-4 h-4" /> },
        { id: 'DRAW_BEAM', label: 'Add Beam', icon: <Box className="w-4 h-4" /> },
        { id: 'DELETE', label: 'Delete', icon: <Trash2 className="w-4 h-4" /> },
    ];

    return (
        <div className="grid grid-cols-2 gap-1.5">
            {tools.map((tool) => (
                <Tooltip key={tool.id} content={`Activate ${tool.label} Tool`} shortcut={tool.id === 'SELECT' ? 'V' : tool.id === 'DRAW_NODE' ? 'N' : tool.id === 'DRAW_BEAM' ? 'B' : tool.id === 'DELETE' ? 'Del' : undefined}>
                    <button
                        onClick={() => setActiveTool(tool.id)}
                        className={`
                            w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all
                            ${activeTool === tool.id
                                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                : 'text-slate-300 bg-slate-800/50 hover:bg-slate-700/50'
                            }
                        `}
                    >
                        {tool.icon}
                        {tool.label}
                    </button>
                </Tooltip>
            ))}
        </div>
    );
};

// ============================================
// EDIT TOOLS PANEL (Like STAAD)
// ============================================

const EditToolsPanel: FC = () => {
    const selectedIds = useModelStore((s) => s.selectedIds);
    const selectAll = useModelStore((s) => s.selectAll);
    const copySelection = useModelStore((s) => s.copySelection);
    const pasteClipboard = useModelStore((s) => s.pasteClipboard);
    const duplicateSelection = useModelStore((s) => s.duplicateSelection);
    const moveSelection = useModelStore((s) => s.moveSelection);
    const deleteSelection = useModelStore((s) => s.deleteSelection);
    const clipboard = useModelStore((s) => s.clipboard);
    const members = useModelStore((s) => s.members);
    const splitMemberById = useModelStore((s) => s.splitMemberById);

    const [moveOffset, setMoveOffset] = useState({ x: 0, y: 0, z: 0 });
    const [splitRatio, setSplitRatio] = useState(0.5);
    const [showMoveDialog, setShowMoveDialog] = useState(false);
    const [showSplitDialog, setShowSplitDialog] = useState(false);

    const hasSelection = selectedIds.size > 0;
    const selectedMemberId = hasSelection ?
        [...selectedIds].find(id => members.has(id)) : null;

    return (
        <div className="space-y-3">
            <div>
                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    Selection
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    <Tooltip content="Select all elements">
                        <button
                            onClick={() => selectAll()}
                            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-slate-300 bg-slate-800/50 hover:bg-slate-700/50"
                        >
                            <CheckCircle className="w-4 h-4" />
                            Select All
                        </button>
                    </Tooltip>
                    <Tooltip content="Delete selected elements" shortcut="Del">
                        <button
                            onClick={() => deleteSelection()}
                            disabled={!hasSelection}
                            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg ${hasSelection
                                ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
                                : 'text-slate-500 bg-slate-800/30 cursor-not-allowed'
                                }`}
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* Boundary Conditions - NEW */}
            <div>
                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    Supports
                </div>
                <Tooltip content="Assign boundary conditions (supports/restraints) to selected nodes">
                    <button
                        onClick={() => useUIStore.getState().openModal('boundaryConditionsDialog')}
                        disabled={!hasSelection}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg ${hasSelection
                            ? 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30'
                            : 'text-slate-500 bg-slate-800/30 cursor-not-allowed border border-transparent'
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Boundary Conditions
                    </button>
                </Tooltip>
            </div>

            {/* Advanced Selection - NEW */}
            <div>
                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    Advanced Select
                </div>
                <Tooltip content="Select by IDs, level, axis, or section">
                    <button
                        onClick={() => useUIStore.getState().openModal('selectionToolbar')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30"
                    >
                        <Box className="w-4 h-4" />
                        Selection Tools
                    </button>
                </Tooltip>
            </div>

            {/* Clipboard Tools */}
            <div>
                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    Clipboard
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                    <button
                        onClick={() => copySelection()}
                        disabled={!hasSelection}
                        className={`flex flex-col items-center gap-1 px-2 py-2 text-xs rounded-lg ${hasSelection
                            ? 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20'
                            : 'text-zinc-500 bg-zinc-800/30 cursor-not-allowed'
                            }`}
                    >
                        <Copy className="w-4 h-4" />
                        Copy
                    </button>
                    <button
                        onClick={() => pasteClipboard()}
                        disabled={!clipboard}
                        className={`flex flex-col items-center gap-1 px-2 py-2 text-xs rounded-lg ${clipboard
                            ? 'text-green-400 bg-green-500/10 hover:bg-green-500/20'
                            : 'text-zinc-500 bg-zinc-800/30 cursor-not-allowed'
                            }`}
                    >
                        <Clipboard className="w-4 h-4" />
                        Paste
                    </button>
                    <button
                        onClick={() => duplicateSelection()}
                        disabled={!hasSelection}
                        className={`flex flex-col items-center gap-1 px-2 py-2 text-xs rounded-lg ${hasSelection
                            ? 'text-purple-400 bg-purple-500/10 hover:bg-purple-500/20'
                            : 'text-zinc-500 bg-zinc-800/30 cursor-not-allowed'
                            }`}
                    >
                        <Plus className="w-4 h-4" />
                        Duplicate
                    </button>
                </div>
            </div>

            {/* Transform Tools */}
            <div>
                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    Transform
                </div>
                <Tooltip content="Move selection by offset" shortcut="M">
                    <button
                        onClick={() => setShowMoveDialog(!showMoveDialog)}
                        disabled={!hasSelection}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg ${hasSelection
                            ? 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20'
                            : 'text-slate-500 bg-slate-800/30 cursor-not-allowed'
                            }`}
                    >
                        <Move className="w-4 h-4" />
                        Move Selection
                    </button>
                </Tooltip>

                {showMoveDialog && hasSelection && (
                    <div className="mt-2 p-3 bg-zinc-800/80 rounded-lg space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="text-[10px] text-zinc-500">X (m)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={moveOffset.x}
                                    onChange={(e) => setMoveOffset({ ...moveOffset, x: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-2 py-1 text-sm bg-zinc-900 border border-zinc-700 rounded text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-zinc-500">Y (m)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={moveOffset.y}
                                    onChange={(e) => setMoveOffset({ ...moveOffset, y: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-2 py-1 text-sm bg-zinc-900 border border-zinc-700 rounded text-white"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-zinc-500">Z (m)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={moveOffset.z}
                                    onChange={(e) => setMoveOffset({ ...moveOffset, z: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-2 py-1 text-sm bg-zinc-900 border border-zinc-700 rounded text-white"
                                />
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                moveSelection(moveOffset.x, moveOffset.y, moveOffset.z);
                                setShowMoveDialog(false);
                            }}
                            className="w-full px-3 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded"
                        >
                            Apply Move
                        </button>
                    </div>
                )}
            </div>

            {/* Split Member Tool */}
            <div>
                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    Member Operations
                </div>
                <button
                    onClick={() => setShowSplitDialog(!showSplitDialog)}
                    disabled={!selectedMemberId}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg ${selectedMemberId
                        ? 'text-orange-400 bg-orange-500/10 hover:bg-orange-500/20'
                        : 'text-zinc-500 bg-zinc-800/30 cursor-not-allowed'
                        }`}
                >
                    <Scissors className="w-4 h-4" />
                    Split Member
                </button>

                {showSplitDialog && selectedMemberId && (
                    <div className="mt-2 p-3 bg-zinc-800/80 rounded-lg space-y-2">
                        <div>
                            <label className="text-[10px] text-zinc-500">Split Position (0-1)</label>
                            <input
                                type="range"
                                min="0.1"
                                max="0.9"
                                step="0.05"
                                value={splitRatio}
                                onChange={(e) => setSplitRatio(parseFloat(e.target.value))}
                                className="w-full"
                            />
                            <div className="text-xs text-center text-zinc-400">{(splitRatio * 100).toFixed(0)}% from start</div>
                        </div>
                        <button
                            onClick={() => {
                                splitMemberById(selectedMemberId, splitRatio);
                                setShowSplitDialog(false);
                            }}
                            className="w-full px-3 py-1.5 text-sm bg-orange-600 hover:bg-orange-500 text-white rounded"
                        >
                            Insert Node & Split
                        </button>
                    </div>
                )}
            </div>

            {/* Status */}
            <div className="text-[10px] text-zinc-500 text-center pt-2 border-t border-zinc-800">
                {selectedIds.size} items selected
                {clipboard && ` • ${clipboard.nodes.length + clipboard.members.length} in clipboard`}
            </div>
        </div>
    );
};

// ============================================
// ADVANCED TOOLS PANEL
// ============================================

const AdvancedToolsPanel: FC = () => {
    const openModal = useUIStore((s) => s.openModal);

    const tools = [
        {
            id: 'deadLoadGenerator',
            label: 'Dead Load Generator',
            description: 'Auto-calculate self-weight & floor loads',
            color: 'text-amber-400',
            bgColor: 'bg-amber-500/10',
            borderColor: 'border-amber-500/30'
        },
        {
            id: 'loadDialog',
            label: 'Loading Manager',
            description: 'Nodal, member, floor, thermal loads',
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/10',
            borderColor: 'border-blue-500/30'
        },
        {
            id: 'windLoadDialog',
            label: 'Wind Load Generator',
            description: 'IS 875 Part 3 wind analysis',
            color: 'text-cyan-400',
            bgColor: 'bg-cyan-500/10',
            borderColor: 'border-cyan-500/30'
        },
        {
            id: 'seismicLoadDialog',
            label: 'Seismic Load Generator',
            description: 'IS 1893 earthquake analysis',
            color: 'text-red-400',
            bgColor: 'bg-red-500/10',
            borderColor: 'border-red-500/30'
        },
        {
            id: 'asce7SeismicDialog',
            label: 'ASCE 7 Seismic Load',
            description: 'ASCE 7-22 ELF procedure (US)',
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/10',
            borderColor: 'border-blue-500/30'
        },
        {
            id: 'asce7WindDialog',
            label: 'ASCE 7 Wind Load',
            description: 'ASCE 7-22 Directional (US)',
            color: 'text-cyan-400',
            bgColor: 'bg-cyan-500/10',
            borderColor: 'border-cyan-500/30'
        },
        {
            id: 'loadCombinationsDialog',
            label: 'Load Combinations',
            description: 'ASCE 7 / IS 456 combinations',
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/10',
            borderColor: 'border-purple-500/30'
        },
        {
            id: 'movingLoadDialog',
            label: 'Moving Load Analysis',
            description: 'IRC 6 / AASHTO bridge loads',
            color: 'text-amber-400',
            bgColor: 'bg-amber-500/10',
            borderColor: 'border-amber-500/30'
        },
        {
            id: 'structureWizard',
            label: 'Structure Wizard',
            description: 'Generate trusses, frames, shells',
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/10',
            borderColor: 'border-purple-500/30'
        },
        {
            id: 'railwayBridge',
            label: 'Railway Bridge',
            description: 'IRS/MBG bridge design',
            color: 'text-orange-400',
            bgColor: 'bg-orange-500/10',
            borderColor: 'border-orange-500/30'
        },
        {
            id: 'geometryTools',
            label: 'Geometry Tools',
            description: 'Extrude, rotate, mirror',
            color: 'text-teal-400',
            bgColor: 'bg-teal-500/10',
            borderColor: 'border-teal-500/30'
        },
        {
            id: 'interoperability',
            label: 'Import / Export',
            description: 'DXF, IFC, JSON formats',
            color: 'text-green-400',
            bgColor: 'bg-green-500/10',
            borderColor: 'border-green-500/30'
        },
        {
            id: 'meshing',
            label: 'FEA Meshing',
            description: 'Plate & surface mesh generation',
            color: 'text-violet-400',
            bgColor: 'bg-violet-500/10',
            borderColor: 'border-violet-500/30'
        },
    ];

    return (
        <div className="space-y-2">
            {tools.map((tool) => (
                <button
                    key={tool.id}
                    onClick={() => openModal(tool.id as 'deadLoadGenerator' | 'structureWizard' | 'geometryTools' | 'interoperability' | 'railwayBridge' | 'loadDialog' | 'meshing' | 'windLoadDialog' | 'seismicLoadDialog' | 'movingLoadDialog' | 'asce7SeismicDialog' | 'asce7WindDialog' | 'loadCombinationsDialog')}
                    className={`
                        w-full flex flex-col items-start gap-1 px-3 py-2.5 text-sm rounded-lg transition-all
                        ${tool.bgColor} ${tool.color} border ${tool.borderColor}
                        hover:brightness-110
                    `}
                >
                    <span className="font-medium">{tool.label}</span>
                    <span className="text-xs opacity-70">{tool.description}</span>
                </button>
            ))}
        </div>
    );
};

// ============================================
// PROPERTIES PANEL
// ============================================

const SectionPickerPanel: FC = () => {
    const [selectedCode, setSelectedCode] = useState('IS808');
    const [selectedSection, setSelectedSection] = useState('ISMB300');
    const { subscription, canAccess } = useSubscription();
    const navigate = useNavigate();

    const isPro = subscription.tier === 'pro' || subscription.tier === 'enterprise';

    const codes = [
        { id: 'IS808', label: 'IS 808 (Indian)', isPro: false },
        { id: 'AISC', label: 'AISC (American)', isPro: false },
        { id: 'EN', label: 'EN 10034 (European)', isPro: false },
    ];

    const sections: Record<string, string[]> = {
        IS808: ['ISMB 150', 'ISMB 200', 'ISMB 250', 'ISMB 300', 'ISMB 350', 'ISMB 400'],
        AISC: ['W10x12', 'W12x26', 'W14x30', 'W16x40', 'W18x50', 'W21x62'],
        EN: ['IPE 200', 'IPE 240', 'IPE 270', 'IPE 300', 'IPE 330', 'IPE 360'],
    };

    const handleCodeChange = (codeId: string) => {
        const code = codes.find(c => c.id === codeId);
        if (code?.isPro && !isPro) {
            // Show upgrade prompt
            return;
        }
        setSelectedCode(codeId);
    };

    return (
        <div className="space-y-3">
            {/* Code Selector */}
            <div>
                <label className="block text-xs text-zinc-500 mb-1">Design Code</label>
                <div className="space-y-1">
                    {codes.map((code) => {
                        const isLocked = code.isPro && !isPro;
                        return (
                            <button
                                key={code.id}
                                onClick={() => handleCodeChange(code.id)}
                                className={`
                                    w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors
                                    ${selectedCode === code.id && !isLocked
                                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                        : isLocked
                                            ? 'bg-zinc-800/30 text-zinc-500 cursor-not-allowed'
                                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                    }
                                `}
                            >
                                <span>{code.label}</span>
                                {isLocked ? (
                                    <span className="flex items-center gap-1 text-xs text-yellow-500">
                                        <Lock className="w-3 h-3" />
                                        PRO
                                    </span>
                                ) : selectedCode === code.id ? (
                                    <span className="text-xs text-blue-400">✓</span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Pro Upgrade Banner (shown for free users) */}
            {!isPro && (
                <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg p-3 border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Crown className="w-4 h-4 text-yellow-500" />
                        <span className="text-xs font-medium text-white">Unlock All Design Codes</span>
                    </div>
                    <p className="text-xs text-zinc-400 mb-2">
                        Get access to AISC 360, Eurocode 3, and more international standards.
                    </p>
                    <button
                        onClick={() => navigate('/pricing')}
                        className="w-full py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-medium rounded-md hover:opacity-90 transition-opacity"
                    >
                        Upgrade to Pro
                    </button>
                </div>
            )}

            {/* Section List */}
            <div>
                <label className="block text-xs text-zinc-500 mb-1">Section Profile</label>
                <div className="max-h-40 overflow-y-auto space-y-1 bg-zinc-800/50 rounded-lg p-2">
                    {sections[selectedCode]?.map((section) => (
                        <button
                            key={section}
                            onClick={() => setSelectedSection(section)}
                            className={`
                                w-full text-left px-2 py-1.5 text-sm rounded transition-colors
                                ${selectedSection === section
                                    ? 'bg-blue-600/20 text-blue-400'
                                    : 'text-zinc-300 hover:bg-zinc-700/50'
                                }
                            `}
                        >
                            {section}
                        </button>
                    ))}
                </div>
            </div>

            {/* Assign Button */}
            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                Assign to Selected
            </button>
        </div>
    );
};

// ============================================
// LOADING PANELS
// ============================================

const LoadGeneratorsPanel: FC = () => {
    const [windSpeed, setWindSpeed] = useState('39');
    const [terrainCategory, setTerrainCategory] = useState('2');
    const [deadLoadEnabled, setDeadLoadEnabled] = useState(true);

    return (
        <div className="space-y-4">
            {/* Wind Load Generator */}
            <div className="bg-zinc-800/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                    <Wind className="w-4 h-4 text-cyan-400" />
                    Wind Load (IS 875)
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs text-zinc-500">Wind Speed (m/s)</label>
                        <input
                            type="number"
                            value={windSpeed}
                            onChange={(e) => setWindSpeed(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-zinc-500">Terrain</label>
                        <select
                            value={terrainCategory}
                            onChange={(e) => setTerrainCategory(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200"
                        >
                            <option value="1">Category 1</option>
                            <option value="2">Category 2</option>
                            <option value="3">Category 3</option>
                            <option value="4">Category 4</option>
                        </select>
                    </div>
                </div>
                <button className="w-full bg-cyan-600/20 text-cyan-400 text-sm py-1.5 rounded hover:bg-cyan-600/30 transition-colors">
                    Generate Wind Loads
                </button>
            </div>

            {/* Dead Load Toggle */}
            <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-orange-400" />
                    <span className="text-sm text-zinc-300">Dead Load (Self Weight)</span>
                </div>
                <button
                    onClick={() => setDeadLoadEnabled(!deadLoadEnabled)}
                    className={`w-10 h-5 rounded-full transition-colors ${deadLoadEnabled ? 'bg-green-600' : 'bg-zinc-700'}`}
                >
                    <span className={`block w-4 h-4 bg-white rounded-full transform transition-transform ${deadLoadEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
            </div>
        </div>
    );
};

const ManualLoadsPanel: FC = () => {
    const [fx, setFx] = useState('0');
    const [fy, setFy] = useState('-10');
    const [fz, setFz] = useState('0');
    const [moment, setMoment] = useState('0');
    const setTool = useModelStore((state) => state.setTool);
    const activeTool = useModelStore((state) => state.activeTool);

    return (
        <div className="space-y-3">
            {/* Interactive Load Placement */}
            <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 border border-orange-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🎯</span>
                    <span className="text-sm font-medium text-orange-300">Interactive Placement</span>
                </div>
                <p className="text-xs text-zinc-400 mb-3">
                    Click and drag on members to place UDL loads visually
                </p>
                <button
                    onClick={() => setTool(activeTool === 'memberLoad' ? 'select' : 'memberLoad')}
                    className={`
                        w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all
                        ${activeTool === 'memberLoad'
                            ? 'bg-orange-600 text-white ring-2 ring-orange-400 ring-offset-2 ring-offset-zinc-900'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        }
                    `}
                >
                    {activeTool === 'memberLoad' ? (
                        <>
                            <span className="animate-pulse">●</span>
                            Drawing Loads... (ESC to exit)
                        </>
                    ) : (
                        <>
                            〰️ Draw UDL/Point Loads
                        </>
                    )}
                </button>
            </div>

            {/* Manual Node Loads */}
            <div className="text-xs text-zinc-500 uppercase tracking-wide pt-2">Node Loads</div>
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <label className="block text-xs text-zinc-500">Fx (kN)</label>
                    <input
                        type="number"
                        value={fx}
                        onChange={(e) => setFx(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200"
                    />
                </div>
                <div>
                    <label className="block text-xs text-zinc-500">Fy (kN)</label>
                    <input
                        type="number"
                        value={fy}
                        onChange={(e) => setFy(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200"
                    />
                </div>
                <div>
                    <label className="block text-xs text-zinc-500">Fz (kN)</label>
                    <input
                        type="number"
                        value={fz}
                        onChange={(e) => setFz(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200"
                    />
                </div>
            </div>
            <div>
                <label className="block text-xs text-zinc-500">Moment (kN·m)</label>
                <input
                    type="number"
                    value={moment}
                    onChange={(e) => setMoment(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200"
                />
            </div>
            <button className="w-full bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                Apply to Selected Node
            </button>
        </div>
    );
};

// ============================================
// ANALYSIS PANELS
// ============================================

const SolverControlsPanel: FC = () => {
    const [isRunning, setIsRunning] = useState(false);
    const setAnalysisResults = useUIStore((state) => state.setAnalysisResults);
    const openModal = useUIStore((state) => state.openModal);

    const handleRunSolver = async () => {
        setIsRunning(true);

        // Simulate analysis
        await new Promise(resolve => setTimeout(resolve, 2000));

        setAnalysisResults({
            completed: true,
            timestamp: Date.now()
        });

        setIsRunning(false);
    };

    return (
        <div className="space-y-3">
            <button
                onClick={handleRunSolver}
                disabled={isRunning}
                className={`
                    w-full flex items-center justify-center gap-2 py-4 text-lg font-bold rounded-lg transition-all
                    ${isRunning
                        ? 'bg-green-600/50 text-green-300 cursor-wait'
                        : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/30'
                    }
                `}
            >
                {isRunning ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Running Analysis...
                    </>
                ) : (
                    <>
                        <Play className="w-5 h-5" />
                        RUN SOLVER
                    </>
                )}
            </button>

            {/* Advanced Analysis Button */}
            <button
                onClick={() => openModal('advancedAnalysis')}
                className="w-full flex items-center justify-between px-3 py-3 bg-purple-600/20 rounded-lg text-purple-300 hover:bg-purple-600/30 border border-purple-500/30 transition-colors"
            >
                <span className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Advanced Analysis
                </span>
                <ArrowRight className="w-4 h-4 text-purple-400" />
            </button>

            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-zinc-800/50 rounded p-2">
                    <span className="text-zinc-500">Solver:</span>
                    <span className="text-zinc-300 ml-1">Linear Static</span>
                </div>
                <div className="bg-zinc-800/50 rounded p-2">
                    <span className="text-zinc-500">DOF:</span>
                    <span className="text-zinc-300 ml-1">6 per node</span>
                </div>
            </div>

            {/* Advanced Analysis Options */}
            <div className="space-y-2 pt-2 border-t border-zinc-700">
                <p className="text-xs text-zinc-500 font-medium uppercase">Advanced Solvers</p>
                <button
                    onClick={() => openModal('pDeltaAnalysis')}
                    className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800/50 rounded-lg text-zinc-300 hover:bg-zinc-700/50 transition-colors text-sm"
                >
                    <span>P-Delta (Geometric)</span>
                    <ArrowRight className="w-3 h-3 text-zinc-500" />
                </button>
                <button
                    onClick={() => openModal('modalAnalysis')}
                    className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800/50 rounded-lg text-zinc-300 hover:bg-zinc-700/50 transition-colors text-sm"
                >
                    <span>Modal / Eigenvalue</span>
                    <ArrowRight className="w-3 h-3 text-zinc-500" />
                </button>
                <button
                    onClick={() => openModal('bucklingAnalysis')}
                    className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800/50 rounded-lg text-zinc-300 hover:bg-zinc-700/50 transition-colors text-sm"
                >
                    <span>Buckling Analysis</span>
                    <ArrowRight className="w-3 h-3 text-zinc-500" />
                </button>
            </div>
        </div>
    );
};

const ResultTogglesPanel: FC = () => {
    const [showDeflection, setShowDeflection] = useState(true);
    const [showBendingMoment, setShowBendingMoment] = useState(false);
    const [showShearForce, setShowShearForce] = useState(false);

    const toggles = [
        { id: 'deflection', label: 'Deflection', checked: showDeflection, toggle: setShowDeflection, color: 'blue' },
        { id: 'bending', label: 'Bending Moment', checked: showBendingMoment, toggle: setShowBendingMoment, color: 'green' },
        { id: 'shear', label: 'Shear Force', checked: showShearForce, toggle: setShowShearForce, color: 'orange' },
    ];

    return (
        <div className="space-y-2">
            {toggles.map((toggle) => (
                <button
                    key={toggle.id}
                    onClick={() => toggle.toggle(!toggle.checked)}
                    className={`
                        w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
                        ${toggle.checked
                            ? `bg-${toggle.color}-600/20 text-${toggle.color}-400 border border-${toggle.color}-500/30`
                            : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50'
                        }
                    `}
                >
                    {toggle.checked ? (
                        <CheckSquare className="w-4 h-4" />
                    ) : (
                        <Square className="w-4 h-4" />
                    )}
                    {toggle.label}
                </button>
            ))}
        </div>
    );
};

// ============================================
// DESIGN PANEL
// ============================================

const DesignChecksPanel: FC = () => {
    const openModal = useUIStore((state) => state.openModal);

    return (
        <div className="space-y-3">
            {/* Main Design Dialog Button */}
            <button
                onClick={() => openModal('designCodes')}
                className="w-full flex items-center justify-between px-3 py-3 bg-blue-600/20 rounded-lg text-blue-300 hover:bg-blue-600/30 border border-blue-500/30 transition-colors"
            >
                <span className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Design Code Checks
                </span>
                <ArrowRight className="w-4 h-4 text-blue-400" />
            </button>

            {/* Individual Design Buttons */}
            <div className="space-y-2 pt-2">
                <button
                    onClick={() => openModal('steelDesign')}
                    className="w-full flex items-center justify-between px-3 py-3 bg-zinc-800/50 rounded-lg text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                >
                    <span className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-blue-400" />
                        Steel Code Check (IS 800)
                    </span>
                    <ArrowRight className="w-4 h-4 text-zinc-500" />
                </button>
                <button
                    onClick={() => openModal('concreteDesign')}
                    className="w-full flex items-center justify-between px-3 py-3 bg-zinc-800/50 rounded-lg text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                >
                    <span className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-orange-400" />
                        Concrete Design (IS 456)
                    </span>
                    <ArrowRight className="w-4 h-4 text-zinc-500" />
                </button>
                <button
                    onClick={() => openModal('connectionDesign')}
                    className="w-full flex items-center justify-between px-3 py-3 bg-zinc-800/50 rounded-lg text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                >
                    <span className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-purple-400" />
                        Connection Design
                    </span>
                    <ArrowRight className="w-4 h-4 text-zinc-500" />
                </button>
                <button
                    onClick={() => openModal('foundationDesign')}
                    className="w-full flex items-center justify-between px-3 py-3 bg-zinc-800/50 rounded-lg text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                >
                    <span className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-green-400" />
                        Foundation Design
                    </span>
                    <ArrowRight className="w-4 h-4 text-zinc-500" />
                </button>
            </div>

            {/* Generate Report */}
            <div className="pt-2 border-t border-zinc-700">
                <button className="w-full flex items-center justify-between px-3 py-3 bg-green-600/20 rounded-lg text-green-300 hover:bg-green-600/30 border border-green-500/30 transition-colors">
                    <span className="flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Generate Design Report
                    </span>
                    <ArrowRight className="w-4 h-4 text-green-400" />
                </button>
            </div>
        </div>
    );
};

// ============================================
// MAIN SMART SIDEBAR COMPONENT
// ============================================

export const SmartSidebar: FC = () => {
    const { activeCategory, sidebarMode } = useUIStore();

    if (sidebarMode === 'COLLAPSED') {
        return null;
    }

    // Tool counts per category for the badge
    const toolCounts: Record<string, number> = {
        'MODELING': 4,  // Template Bank, Draw, Edit, Advanced
        'PROPERTIES': 1, // Section Picker
        'LOADING': 2,   // Load Generators, Manual Loads
        'ANALYSIS': 2,  // Solver Controls, Result Toggles
        'DESIGN': 1     // Design Checks
    };

    return (
        <div className="h-full w-64 bg-slate-900 border-r border-slate-700 flex flex-col overflow-hidden">
            {/* Header with Search Hint */}
            <div className="px-3 py-3 border-b border-slate-700 bg-gradient-sidebar">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {activeCategory} TOOLS
                    </h2>
                    <span className="text-[10px] text-slate-500 font-medium">
                        {toolCounts[activeCategory] || 0} panels
                    </span>
                </div>

                {/* Quick Search Trigger */}
                <button
                    onClick={() => {
                        // Trigger Command Palette
                        const event = new KeyboardEvent('keydown', {
                            key: 'k',
                            metaKey: true,
                            bubbles: true
                        });
                        document.dispatchEvent(event);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-600/50 rounded-md text-slate-300 text-xs transition-colors group"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="flex-1 text-left">Search all features...</span>
                    <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-700 rounded border border-slate-600 group-hover:bg-slate-600 text-slate-300">
                        ⌘K
                    </kbd>
                </button>
            </div>

            {/* Dynamic Content */}
            <div className="flex-1 overflow-y-auto">
                {/* MODELING */}
                {activeCategory === 'MODELING' && (
                    <>
                        <AccordionItem title="Template Bank" icon={<Box className="w-4 h-4" />}>
                            <TemplateBankPanel />
                        </AccordionItem>
                        <AccordionItem title="Draw Tools" icon={<Plus className="w-4 h-4" />}>
                            <DrawToolsPanel />
                        </AccordionItem>
                        <AccordionItem title="Edit Tools" icon={<Copy className="w-4 h-4" />} defaultOpen={false}>
                            <EditToolsPanel />
                        </AccordionItem>
                        <AccordionItem title="Advanced Tools" icon={<Wand2 className="w-4 h-4" />} defaultOpen={false}>
                            <AdvancedToolsPanel />
                        </AccordionItem>
                    </>
                )}

                {/* PROPERTIES */}
                {activeCategory === 'PROPERTIES' && (
                    <>
                        <AccordionItem title="Section Picker" icon={<Settings className="w-4 h-4" />}>
                            <SectionPickerPanel />
                        </AccordionItem>
                    </>
                )}

                {/* LOADING */}
                {activeCategory === 'LOADING' && (
                    <>
                        <AccordionItem title="Load Generators" icon={<Wind className="w-4 h-4" />}>
                            <LoadGeneratorsPanel />
                        </AccordionItem>
                        <AccordionItem title="Manual Loads" icon={<Download className="w-4 h-4" />}>
                            <ManualLoadsPanel />
                        </AccordionItem>
                    </>
                )}

                {/* ANALYSIS */}
                {activeCategory === 'ANALYSIS' && (
                    <>
                        <AccordionItem title="Solver Controls" icon={<Play className="w-4 h-4" />} defaultOpen>
                            <SolverControlsPanel />
                        </AccordionItem>
                        <AccordionItem title="Result Toggles" icon={<CheckSquare className="w-4 h-4" />}>
                            <ResultTogglesPanel />
                        </AccordionItem>
                    </>
                )}

                {/* DESIGN */}
                {activeCategory === 'DESIGN' && (
                    <>
                        <AccordionItem title="Design Checks" icon={<Settings className="w-4 h-4" />}>
                            <DesignChecksPanel />
                        </AccordionItem>
                    </>
                )}
            </div>
        </div>
    );
};

export default SmartSidebar;
