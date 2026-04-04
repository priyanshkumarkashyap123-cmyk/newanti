/**
 * ModelingSidebar.tsx - Template Bank Component
 * 
 * Lists 50+ structural problems organized by category.
 * Clicking an item fetches the template from Python backend
 * and updates the global model store.
 */

import React from 'react';
import { FC, useState } from 'react';
import {
    ChevronDown,
    ChevronRight,
    Loader2,
    Minus,
    Box,
    Triangle,
    Building2,
    ArrowDownUp,
    CheckCircle,
    Landmark
} from 'lucide-react';
import { fetchTemplate, TemplateType, TemplateParams } from '../../services/factoryService';
import { useModelStore } from '../../store/model';
import { Bridge } from '../../services/bridgeService';
import { FAMOUS_STRUCTURES_TEMPLATES, generateFromTemplate } from '../../services/StructureFactory';
import { Save, FolderOpen, RefreshCcw } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface TemplateItem {
    id: string;
    name: string;
    templateType: TemplateType;
    params: TemplateParams;
    difficulty?: 'easy' | 'medium' | 'hard';
    isFamousStructure?: boolean;  // Flag for local generation
}

interface TemplateCategory {
    id: string;
    name: string;
    icon: React.ReactNode;
    items: TemplateItem[];
}

// ============================================
// TEMPLATE BANK DATA (50+ Problems)
// ============================================

const TEMPLATE_BANK: TemplateCategory[] = [
    {
        id: 'beams',
        name: 'Beams',
        icon: <Minus className="w-4 h-4" />,
        items: [
            { id: 'beam-1', name: 'Simple Beam (5m)', templateType: 'beam', params: { span: 5, supports: 'simple' }, difficulty: 'easy' },
            { id: 'beam-2', name: 'Simple Beam (8m)', templateType: 'beam', params: { span: 8, supports: 'simple' }, difficulty: 'easy' },
            { id: 'beam-3', name: 'Cantilever Beam (3m)', templateType: 'beam', params: { span: 3, supports: 'cantilever' }, difficulty: 'easy' },
            { id: 'beam-4', name: 'Cantilever Beam (5m)', templateType: 'beam', params: { span: 5, supports: 'cantilever' }, difficulty: 'medium' },
            { id: 'beam-5', name: 'Fixed Beam (6m)', templateType: 'beam', params: { span: 6, supports: 'fixed' }, difficulty: 'medium' },
            { id: 'beam-6', name: 'Fixed Beam (10m)', templateType: 'beam', params: { span: 10, supports: 'fixed' }, difficulty: 'medium' },
            { id: 'beam-7', name: 'Simple Beam (12m)', templateType: 'beam', params: { span: 12, supports: 'simple' }, difficulty: 'medium' },
            { id: 'beam-8', name: 'Overhanging Beam (4+2m)', templateType: 'beam', params: { span: 6, supports: 'simple' }, difficulty: 'hard' },
            { id: 'beam-9', name: 'Continuous Beam (3 Span)', templateType: 'beam', params: { span: 9, supports: 'simple' }, difficulty: 'hard' },
            { id: 'beam-10', name: 'Heavy Beam (15m)', templateType: 'beam', params: { span: 15, supports: 'simple' }, difficulty: 'hard' },
        ]
    },
    {
        id: 'trusses',
        name: 'Trusses',
        icon: <Triangle className="w-4 h-4" />,
        items: [
            { id: 'truss-1', name: 'Pratt Truss (12m)', templateType: 'pratt_truss', params: { span: 12, height: 2.5, bays: 6 }, difficulty: 'medium' },
            { id: 'truss-2', name: 'Pratt Truss (18m)', templateType: 'pratt_truss', params: { span: 18, height: 3, bays: 6 }, difficulty: 'medium' },
            { id: 'truss-3', name: 'Pratt Truss (24m)', templateType: 'pratt_truss', params: { span: 24, height: 4, bays: 8 }, difficulty: 'hard' },
            { id: 'truss-4', name: 'Pratt Truss (30m)', templateType: 'pratt_truss', params: { span: 30, height: 5, bays: 10 }, difficulty: 'hard' },
            { id: 'truss-5', name: 'Warren Truss (12m)', templateType: 'warren_truss', params: { span: 12, height: 2, panels: 6 }, difficulty: 'medium' },
            { id: 'truss-6', name: 'Warren Truss (18m)', templateType: 'warren_truss', params: { span: 18, height: 3, panels: 8 }, difficulty: 'medium' },
            { id: 'truss-7', name: 'Warren Truss (24m)', templateType: 'warren_truss', params: { span: 24, height: 4, panels: 10 }, difficulty: 'hard' },
            { id: 'truss-8', name: 'Bridge Truss (15m)', templateType: 'pratt_truss', params: { span: 15, height: 3, bays: 5 }, difficulty: 'medium' },
            { id: 'truss-9', name: 'Roof Truss (10m)', templateType: 'pratt_truss', params: { span: 10, height: 2, bays: 4 }, difficulty: 'easy' },
            { id: 'truss-10', name: 'Heavy Bridge (40m)', templateType: 'pratt_truss', params: { span: 40, height: 6, bays: 12 }, difficulty: 'hard' },
            { id: 'truss-11', name: 'Light Truss (8m)', templateType: 'pratt_truss', params: { span: 8, height: 1.5, bays: 4 }, difficulty: 'easy' },
            { id: 'truss-12', name: 'Industrial Truss (20m)', templateType: 'warren_truss', params: { span: 20, height: 3.5, panels: 8 }, difficulty: 'medium' },
        ]
    },
    {
        id: 'frames',
        name: 'Frames',
        icon: <Building2 className="w-4 h-4" />,
        items: [
            { id: 'frame-1', name: 'Portal Frame (10m)', templateType: 'portal_frame', params: { width: 10, height: 5, roof_angle: 10 }, difficulty: 'easy' },
            { id: 'frame-2', name: 'Portal Frame (15m)', templateType: 'portal_frame', params: { width: 15, height: 6, roof_angle: 12 }, difficulty: 'medium' },
            { id: 'frame-3', name: 'Warehouse Frame (20m)', templateType: 'portal_frame', params: { width: 20, height: 7, roof_angle: 15 }, difficulty: 'medium' },
            { id: 'frame-4', name: 'Warehouse Frame (30m)', templateType: 'portal_frame', params: { width: 30, height: 8, roof_angle: 12 }, difficulty: 'hard' },
            { id: 'frame-5', name: 'Aircraft Hangar (40m)', templateType: 'portal_frame', params: { width: 40, height: 10, roof_angle: 8 }, difficulty: 'hard' },
            { id: 'frame-6', name: 'G+1 Building', templateType: 'multi_story_frame', params: { bays: 2, stories: 2, bay_width: 5, story_height: 3.5 }, difficulty: 'easy' },
            { id: 'frame-7', name: 'G+2 Building', templateType: 'multi_story_frame', params: { bays: 2, stories: 3, bay_width: 5, story_height: 3.5 }, difficulty: 'medium' },
            { id: 'frame-8', name: 'G+3 Building', templateType: 'multi_story_frame', params: { bays: 3, stories: 4, bay_width: 6, story_height: 3.5 }, difficulty: 'medium' },
            { id: 'frame-9', name: 'G+4 Building', templateType: 'multi_story_frame', params: { bays: 3, stories: 5, bay_width: 6, story_height: 3.5 }, difficulty: 'hard' },
            { id: 'frame-10', name: 'G+5 Building', templateType: 'multi_story_frame', params: { bays: 4, stories: 6, bay_width: 6, story_height: 3.5 }, difficulty: 'hard' },
            { id: 'frame-11', name: 'Commercial (3 Bay)', templateType: 'multi_story_frame', params: { bays: 3, stories: 4, bay_width: 8, story_height: 4 }, difficulty: 'hard' },
            { id: 'frame-12', name: 'Residential Block', templateType: 'multi_story_frame', params: { bays: 4, stories: 5, bay_width: 5, story_height: 3 }, difficulty: 'hard' },
            { id: 'frame-13', name: 'Flat Roof Warehouse (25m)', templateType: 'portal_frame', params: { width: 25, height: 6, roof_angle: 5 }, difficulty: 'medium' },
            { id: 'frame-14', name: 'Small Shed (8m)', templateType: 'portal_frame', params: { width: 8, height: 4, roof_angle: 15 }, difficulty: 'easy' },
            { id: 'frame-15', name: 'Industrial Hall (35m)', templateType: 'portal_frame', params: { width: 35, height: 9, roof_angle: 10 }, difficulty: 'hard' },
        ]
    },
    {
        id: 'special',
        name: 'Special Structures',
        icon: <Box className="w-4 h-4" />,
        items: [
            { id: 'special-1', name: 'Transmission Tower', templateType: 'pratt_truss', params: { span: 6, height: 20, bays: 4 }, difficulty: 'hard' },
            { id: 'special-2', name: 'Billboard Frame', templateType: 'portal_frame', params: { width: 8, height: 12, roof_angle: 0 }, difficulty: 'medium' },
            { id: 'special-3', name: 'Water Tank Support', templateType: 'multi_story_frame', params: { bays: 2, stories: 2, bay_width: 4, story_height: 5 }, difficulty: 'medium' },
            { id: 'special-4', name: 'Crane Gantry', templateType: 'portal_frame', params: { width: 12, height: 8, roof_angle: 0 }, difficulty: 'hard' },
            { id: 'special-5', name: 'Pipe Rack', templateType: 'multi_story_frame', params: { bays: 4, stories: 2, bay_width: 6, story_height: 4 }, difficulty: 'medium' },
            { id: 'special-6', name: 'Conveyor Support', templateType: 'pratt_truss', params: { span: 20, height: 2, bays: 8 }, difficulty: 'medium' },
            { id: 'special-7', name: 'Footbridge (15m)', templateType: 'warren_truss', params: { span: 15, height: 2, panels: 8 }, difficulty: 'medium' },
            { id: 'special-8', name: 'Canopy Structure', templateType: 'portal_frame', params: { width: 12, height: 4, roof_angle: 5 }, difficulty: 'easy' },
            { id: 'special-9', name: 'Bus Shelter', templateType: 'portal_frame', params: { width: 6, height: 3, roof_angle: 8 }, difficulty: 'easy' },
            { id: 'special-10', name: 'Staircase Tower', templateType: 'multi_story_frame', params: { bays: 1, stories: 5, bay_width: 3, story_height: 3 }, difficulty: 'hard' },
            { id: 'special-11', name: 'Pedestrian Bridge (25m)', templateType: 'warren_truss', params: { span: 25, height: 3, panels: 10 }, difficulty: 'hard' },
            { id: 'special-12', name: 'Loading Bay Frame', templateType: 'portal_frame', params: { width: 10, height: 5, roof_angle: 0 }, difficulty: 'easy' },
        ]
    },
    {
        id: 'famous',
        name: '🌟 Famous Structures',
        icon: <Landmark className="w-4 h-4" />,
        items: FAMOUS_STRUCTURES_TEMPLATES.map(t => ({
            id: t.id,
            name: t.name,
            templateType: 'beam' as TemplateType,  // Placeholder - uses local generator
            params: {},
            difficulty: 'hard' as const,
            isFamousStructure: true
        }))
    }
];

// ============================================
// DIFFICULTY BADGE COMPONENT
// ============================================

const DifficultyBadge: FC<{ difficulty?: 'easy' | 'medium' | 'hard' }> = ({ difficulty }) => {
    if (!difficulty) return null;

    const colors = {
        easy: 'bg-green-500/20 text-green-400 border-green-500/30',
        medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        hard: 'bg-red-500/20 text-red-400 border-red-500/30'
    };

    return (
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${colors[difficulty]}`}>
            {difficulty}
        </span>
    );
};

// ============================================
// TOAST COMPONENT (Simple inline toast)
// ============================================

interface ToastState {
    show: boolean;
    message: string;
    type: 'loading' | 'success' | 'error';
}

const Toast: FC<{ state: ToastState }> = ({ state }) => {
    if (!state.show) return null;

    const colors = {
        loading: 'bg-blue-600',
        success: 'bg-green-600',
        error: 'bg-red-600'
    };

    return (
        <div className={`fixed bottom-4 right-4 ${colors[state.type]} text-[#dae2fd] px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50`}>
            {state.type === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
            {state.type === 'success' && <CheckCircle className="w-4 h-4" />}
            {state.message}
        </div>
    );
};

// ============================================
// MAIN MODELING SIDEBAR COMPONENT
// ============================================

export const ModelingSidebar: FC = () => {
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['beams']));
    const [loadingItem, setLoadingItem] = useState<string | null>(null);
    const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'loading' });

    // Store actions
    const clearModel = useModelStore((state) => state.clearModel);
    const addNode = useModelStore((state) => state.addNode);
    const addMember = useModelStore((state) => state.addMember);
    const updateNode = useModelStore((state) => state.updateNode);

    // Toggle category expansion
    const toggleCategory = (categoryId: string) => {
        setExpandedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(categoryId)) {
                next.delete(categoryId);
            } else {
                next.add(categoryId);
            }
            return next;
        });
    };

    // Show toast message
    const showToast = (message: string, type: 'loading' | 'success' | 'error') => {
        setToast({ show: true, message, type });
        if (type !== 'loading') {
            setTimeout(() => setToast({ show: false, message: '', type: 'loading' }), 3000);
        }
    };

    // Handle template click
    const handleTemplateClick = async (item: TemplateItem) => {
        if (loadingItem) return; // Prevent multiple clicks

        setLoadingItem(item.id);
        showToast(`Loading ${item.name}...`, 'loading');

        try {
            let model;

            // Check if this is a Famous Structure (local generation)
            if (item.isFamousStructure) {
                const generatedStructure = generateFromTemplate(item.id);
                if (!generatedStructure) {
                    throw new Error(`Failed to generate ${item.name}`);
                }
                model = {
                    nodes: generatedStructure.nodes.map(n => ({
                        ...n,
                        support: n.restraints?.fx ? (n.restraints?.mx ? 'FIXED' : 'PINNED') : 'NONE'
                    })),
                    members: generatedStructure.members.map(m => ({
                        ...m,
                        section: m.sectionId
                    }))
                };
            } else {
                // Regular template - fetch from Python backend
                model = await fetchTemplate(item.templateType, item.params);
            }

            // Clear existing model
            clearModel();

            // Add nodes
            for (const node of model.nodes) {
                addNode({
                    id: node.id,
                    x: node.x,
                    y: node.y,
                    z: node.z
                });

                // Set support if defined
                if (node.support && node.support !== 'NONE') {
                    const isPinned = node.support === 'PINNED' || node.support === 'ROLLER';
                    const isFixed = node.support === 'FIXED';

                    updateNode(node.id, {
                        restraints: {
                            fx: true,
                            fy: true,
                            fz: true,
                            mx: isFixed,
                            my: isFixed,
                            mz: isPinned ? false : isFixed
                        }
                    });
                }
            }

            // Add members
            for (const member of model.members) {
                addMember({
                    id: member.id,
                    startNodeId: member.startNodeId,
                    endNodeId: member.endNodeId,
                    sectionId: member.section
                });
            }

            showToast(`${item.name} loaded! (${model.nodes.length} nodes, ${model.members.length} members)`, 'success');
        } catch (error) {
            console.error('[ModelingSidebar] Error:', error);
            showToast(error instanceof Error ? error.message : 'Failed to load template', 'error');
        } finally {
            setLoadingItem(null);
        }
    };

    return (
        <>
            <div className="h-full flex flex-col bg-[#0b1326]">
                {/* Header */}
                <div className="px-3 py-2 border-b border-[#1a2333]">
                    <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                        <ArrowDownUp className="w-3 h-3" />
                        Template Bank
                    </h3>
                    <p className="text-[10px] text-[#869ab8] mt-1">
                        {TEMPLATE_BANK.reduce((acc, cat) => acc + cat.items.length, 0)} sample structures
                    </p>
                </div>

                {/* Persistence Actions (Phase 3) */}
                <div className="grid grid-cols-2 gap-2 px-3 pb-3 border-b border-[#1a2333]">
                    <button type="button"
                        onClick={async () => {
                            showToast('Saving Project...', 'loading');
                            const state = useModelStore.getState();
                            const data = {
                                projectInfo: state.projectInfo,
                                nodes: Array.from(state.nodes.values()),
                                members: Array.from(state.members.values()),
                                civilData: Array.from(state.civilData.values()) || []
                            };
                            const res = await Bridge.saveProject(data);
                            if (res) showToast('Project Saved!', 'success');
                            else showToast('Save Failed', 'error');
                        }}
                        className="flex items-center justify-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#4d8eff] to-[#3b72cc] hover:from-[#3b72cc] hover:to-[#2a5599] text-white shadow-[0_0_15px_rgba(77,142,255,0.3)] hover:shadow-[0_0_20px_rgba(77,142,255,0.5)] rounded text-xs font-medium tracking-wide transition-colors"
                    >
                        <Save className="w-3 h-3" />
                        Save
                    </button>
                    <button type="button"
                        onClick={async () => {
                            showToast('Fetching Projects...', 'loading');
                            const projects = await Bridge.listProjects();
                            if (projects.length > 0) {
                                // For now, just load the first one or alert count
                                // Ideally open a modal. Simulating load of most recent:
                                const latest = projects[0];
                                const fullProject = await Bridge.loadProject(latest.id);
                                if (fullProject) {
                                    clearModel();
                                    fullProject.nodes?.forEach((n: any) => addNode(n));
                                    fullProject.members?.forEach((m: any) => addMember(m));
                                    // Load civil data if stored
                                    if (fullProject.civilData) {
                                        // We haven't exposed addCivilResult in component props, but we can get from store
                                        const { addCivilResult } = useModelStore.getState();
                                        fullProject.civilData.forEach((cd: any) => addCivilResult(cd));
                                    }
                                    showToast(`Loaded: ${latest.name}`, 'success');
                                }
                            } else {
                                showToast('No saved projects found', 'error');
                            }
                        }}
                        className="flex items-center justify-center gap-2 px-3 py-1.5 bg-[#131b2e] hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs font-medium tracking-wide transition-colors"
                    >
                        <FolderOpen className="w-3 h-3" />
                        Load
                    </button>
                </div>

                {/* Categories */}
                <div className="flex-1 overflow-y-auto">
                    {TEMPLATE_BANK.map((category) => {
                        const isExpanded = expandedCategories.has(category.id);

                        return (
                            <div key={category.id} className="border-b border-slate-800/50">
                                {/* Category Header */}
                                <button type="button"
                                    onClick={() => toggleCategory(category.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium tracking-wide text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                                >
                                    {isExpanded
                                        ? <ChevronDown className="w-4 h-4 text-[#869ab8]" />
                                        : <ChevronRight className="w-4 h-4 text-[#869ab8]" />
                                    }
                                    <span className="text-[#869ab8]">{category.icon}</span>
                                    {category.name}
                                    <span className="ml-auto text-xs text-slate-500">
                                        {category.items.length}
                                    </span>
                                </button>

                                {/* Category Items */}
                                {isExpanded && (
                                    <div className="pb-2">
                                        {category.items.map((item) => {
                                            const isLoading = loadingItem === item.id;

                                            return (
                                                <button type="button"
                                                    key={item.id}
                                                    onClick={() => handleTemplateClick(item)}
                                                    disabled={loadingItem !== null}
                                                    className={`
                                                        w-full flex items-center justify-between gap-2
                                                        px-6 py-1.5 text-xs text-left
                                                        transition-colors
                                                        ${isLoading
                                                            ? 'bg-blue-600/20 text-blue-400'
                                                            : 'text-[#869ab8] hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                                                        }
                                                        ${loadingItem && !isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                                                    `}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                                                        {item.name}
                                                    </span>
                                                    <DifficultyBadge difficulty={item.difficulty} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Toast */}
            <Toast state={toast} />
        </>
    );
};

export default ModelingSidebar;
