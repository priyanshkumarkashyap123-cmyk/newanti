/**
 * AnalysisWizard.tsx - Guided Step-by-Step Workflow
 * 
 * Features:
 * - Step-by-step guided analysis setup
 * - Visual feedback at each stage
 * - Quick templates for common structures
 * - Real-time 3D preview
 * - Smart defaults and suggestions
 */

import React, { FC, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Circle,
    HelpCircle,
    Play,
    Lightbulb,
    Layout,
    Box,
    Settings,
    Zap,
    BarChart3,
    Download,
    RefreshCw,
    ChevronRight,
    Building2,
    Home,
    Factory,
    Warehouse
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface WizardStep {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    isComplete: boolean;
    hasErrors: boolean;
}

export interface StructureTemplate {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    category: 'frame' | 'truss' | 'beam' | 'custom';
    thumbnail?: string;
    nodes: Array<{ x: number; y: number; z: number; fixed?: boolean }>;
    members: Array<{ start: number; end: number }>;
    defaultLoads: Array<{ node: number; fy: number }>;
}

export interface WizardState {
    currentStep: number;
    template: StructureTemplate | null;
    geometry: {
        width: number;
        height: number;
        depth: number;
        bays: number;
        stories: number;
    };
    material: string;
    section: string;
    loads: Array<{
        nodeIndex: number;
        fx: number;
        fy: number;
        fz: number;
    }>;
    analysisOptions: {
        includeSecondOrder: boolean;
        checkDesign: boolean;
        generateReport: boolean;
    };
}

// ============================================
// TEMPLATES
// ============================================

const STRUCTURE_TEMPLATES: StructureTemplate[] = [
    {
        id: 'simple-beam',
        name: 'Simple Beam',
        description: 'Simply supported beam with point load',
        icon: <Box size={24} />,
        category: 'beam',
        nodes: [
            { x: 0, y: 0, z: 0, fixed: true },
            { x: 6, y: 0, z: 0, fixed: true }
        ],
        members: [{ start: 0, end: 1 }],
        defaultLoads: [{ node: 0, fy: -50 }] // Will be applied at midpoint
    },
    {
        id: 'cantilever',
        name: 'Cantilever Beam',
        description: 'Fixed support with tip load',
        icon: <ArrowRight size={24} />,
        category: 'beam',
        nodes: [
            { x: 0, y: 0, z: 0, fixed: true },
            { x: 4, y: 0, z: 0 }
        ],
        members: [{ start: 0, end: 1 }],
        defaultLoads: [{ node: 1, fy: -25 }]
    },
    {
        id: 'portal-frame',
        name: 'Portal Frame',
        description: 'Single bay rigid frame',
        icon: <Home size={24} />,
        category: 'frame',
        nodes: [
            { x: 0, y: 0, z: 0, fixed: true },
            { x: 0, y: 4, z: 0 },
            { x: 6, y: 4, z: 0 },
            { x: 6, y: 0, z: 0, fixed: true }
        ],
        members: [
            { start: 0, end: 1 },
            { start: 1, end: 2 },
            { start: 2, end: 3 }
        ],
        defaultLoads: [
            { node: 1, fy: -30 },
            { node: 2, fy: -30 }
        ]
    },
    {
        id: 'multi-story',
        name: 'Multi-Story Building',
        description: '2D building frame with multiple floors',
        icon: <Building2 size={24} />,
        category: 'frame',
        nodes: [
            { x: 0, y: 0, z: 0, fixed: true },
            { x: 0, y: 3.5, z: 0 },
            { x: 0, y: 7, z: 0 },
            { x: 6, y: 0, z: 0, fixed: true },
            { x: 6, y: 3.5, z: 0 },
            { x: 6, y: 7, z: 0 }
        ],
        members: [
            { start: 0, end: 1 }, { start: 1, end: 2 },
            { start: 3, end: 4 }, { start: 4, end: 5 },
            { start: 1, end: 4 }, { start: 2, end: 5 }
        ],
        defaultLoads: [
            { node: 1, fy: -20 }, { node: 4, fy: -20 },
            { node: 2, fy: -15 }, { node: 5, fy: -15 }
        ]
    },
    {
        id: 'pratt-truss',
        name: 'Pratt Truss',
        description: 'Common roof truss design',
        icon: <Factory size={24} />,
        category: 'truss',
        nodes: [
            { x: 0, y: 0, z: 0, fixed: true },
            { x: 2, y: 0, z: 0 },
            { x: 4, y: 0, z: 0 },
            { x: 6, y: 0, z: 0 },
            { x: 8, y: 0, z: 0, fixed: true },
            { x: 2, y: 2, z: 0 },
            { x: 4, y: 3, z: 0 },
            { x: 6, y: 2, z: 0 }
        ],
        members: [
            // Bottom chord
            { start: 0, end: 1 }, { start: 1, end: 2 },
            { start: 2, end: 3 }, { start: 3, end: 4 },
            // Top chord
            { start: 0, end: 5 }, { start: 5, end: 6 },
            { start: 6, end: 7 }, { start: 7, end: 4 },
            // Verticals
            { start: 1, end: 5 }, { start: 2, end: 6 }, { start: 3, end: 7 },
            // Diagonals
            { start: 5, end: 2 }, { start: 6, end: 3 }
        ],
        defaultLoads: [
            { node: 5, fy: -15 }, { node: 6, fy: -20 }, { node: 7, fy: -15 }
        ]
    },
    {
        id: 'industrial-shed',
        name: 'Industrial Shed',
        description: 'Clear span industrial structure',
        icon: <Warehouse size={24} />,
        category: 'frame',
        nodes: [
            { x: 0, y: 0, z: 0, fixed: true },
            { x: 0, y: 6, z: 0 },
            { x: 7.5, y: 8, z: 0 },
            { x: 15, y: 6, z: 0 },
            { x: 15, y: 0, z: 0, fixed: true }
        ],
        members: [
            { start: 0, end: 1 },
            { start: 1, end: 2 },
            { start: 2, end: 3 },
            { start: 3, end: 4 }
        ],
        defaultLoads: [
            { node: 2, fy: -50 }
        ]
    }
];

// ============================================
// STEP COMPONENTS
// ============================================

interface TemplateStepProps {
    selected: StructureTemplate | null;
    onSelect: (template: StructureTemplate) => void;
}

const TemplateStep: FC<TemplateStepProps> = ({ selected, onSelect }) => {
    const [category, setCategory] = useState<string>('all');
    
    const filtered = category === 'all' 
        ? STRUCTURE_TEMPLATES 
        : STRUCTURE_TEMPLATES.filter(t => t.category === category);

    return (
        <div className="space-y-4">
            {/* Category filter */}
            <div className="flex gap-2 flex-wrap">
                {['all', 'beam', 'frame', 'truss'].map((cat) => (
                    <button type="button"
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`px-3 py-1 rounded-full text-sm capitalize transition-colors
                                  ${category === cat 
                                      ? 'bg-cyan-600 text-white' 
                                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-600'
                                  }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Template grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filtered.map((template) => (
                    <motion.button
                        key={template.id}
                        onClick={() => onSelect(template)}
                        className={`p-4 rounded-lg border-2 transition-all text-left
                                  ${selected?.id === template.id 
                                      ? 'border-cyan-500 bg-cyan-600/10' 
                                      : 'border-[#1a2333] hover:border-slate-500 bg-slate-100/50 dark:bg-slate-800/50'
                                  }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <div className={`mb-2 ${selected?.id === template.id ? 'text-cyan-400' : 'text-[#869ab8]'}`}>
                            {template.icon}
                        </div>
                        <h4 className="font-medium tracking-wide text-slate-700 dark:text-slate-200">{template.name}</h4>
                        <p className="text-xs text-[#869ab8] mt-1">{template.description}</p>
                        <div className="flex gap-2 mt-2">
                            <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[#869ab8]">
                                {template.nodes.length} nodes
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[#869ab8]">
                                {template.members.length} members
                            </span>
                        </div>
                    </motion.button>
                ))}
            </div>

            {/* Custom option */}
            <div className="border-t border-[#1a2333] pt-4">
                <button type="button" className="flex items-center gap-2 text-[#869ab8] hover:text-cyan-400 transition-colors">
                    <Settings size={16} />
                    <span className="text-sm">Start from scratch (Advanced)</span>
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
};

interface GeometryStepProps {
    template: StructureTemplate | null;
    geometry: WizardState['geometry'];
    onChange: (geometry: WizardState['geometry']) => void;
}

const GeometryStep: FC<GeometryStepProps> = ({ template, geometry, onChange }) => {
    const handleChange = (key: keyof WizardState['geometry'], value: number) => {
        onChange({ ...geometry, [key]: value });
    };

    return (
        <div className="space-y-6">
            {/* Quick tips */}
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 flex gap-2">
                <Lightbulb size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-300">
                    Adjust the dimensions below to customize the {template?.name || 'structure'}. 
                    The 3D preview will update in real-time.
                </p>
            </div>

            {/* Dimension inputs */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm text-[#869ab8]">Span / Width</label>
                    <div className="relative">
                        <input
                            type="number"
                            value={geometry.width}
                            onChange={(e) => handleChange('width', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg
                                     text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#869ab8]">m</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm text-[#869ab8]">Height</label>
                    <div className="relative">
                        <input
                            type="number"
                            value={geometry.height}
                            onChange={(e) => handleChange('height', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg
                                     text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#869ab8]">m</span>
                    </div>
                </div>

                {(template?.category === 'frame') && (
                    <>
                        <div className="space-y-2">
                            <label className="text-sm text-[#869ab8]">Number of Bays</label>
                            <input
                                type="number"
                                min={1}
                                max={10}
                                value={geometry.bays}
                                onChange={(e) => handleChange('bays', parseInt(e.target.value) || 1)}
                                className="w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg
                                         text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm text-[#869ab8]">Number of Stories</label>
                            <input
                                type="number"
                                min={1}
                                max={20}
                                value={geometry.stories}
                                onChange={(e) => handleChange('stories', parseInt(e.target.value) || 1)}
                                className="w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-lg
                                         text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                    </>
                )}
            </div>

            {/* 3D Preview placeholder */}
            <div className="aspect-video bg-[#131b2e] rounded-lg border border-[#1a2333] 
                          flex items-center justify-center">
                <div className="text-center">
                    <Box size={48} className="mx-auto text-slate-500 mb-2" />
                    <p className="text-sm text-[#869ab8]">3D Preview</p>
                    <p className="text-xs text-slate-500">(Connects to main viewer)</p>
                </div>
            </div>
        </div>
    );
};

interface MaterialStepProps {
    material: string;
    section: string;
    onMaterialChange: (id: string) => void;
    onSectionChange: (id: string) => void;
}

const MaterialStep: FC<MaterialStepProps> = ({ 
    material, 
    section, 
    onMaterialChange, 
    onSectionChange 
}) => {
    const materials = [
        { id: 'fe250', name: 'Fe 250 (Mild Steel)', E: 200, fy: 250 },
        { id: 'fe415', name: 'Fe 415 (HYSD)', E: 200, fy: 415 },
        { id: 'fe500', name: 'Fe 500 (TMT)', E: 200, fy: 500 },
        { id: 'a992', name: 'ASTM A992', E: 200, fy: 345 },
    ];

    const sections = [
        { id: 'ismb150', name: 'ISMB 150', A: 1800, Iy: 7.26 },
        { id: 'ismb200', name: 'ISMB 200', A: 2850, Iy: 22.35 },
        { id: 'ismb250', name: 'ISMB 250', A: 4100, Iy: 51.32 },
        { id: 'ismb300', name: 'ISMB 300', A: 5870, Iy: 98.35 },
        { id: 'ismb350', name: 'ISMB 350', A: 6670, Iy: 136.32 },
    ];

    return (
        <div className="space-y-6">
            {/* Material Selection */}
            <div>
                <h4 className="text-sm font-medium tracking-wide text-slate-600 dark:text-slate-300 mb-3">Select Material</h4>
                <div className="grid grid-cols-2 gap-2">
                    {materials.map((mat) => (
                        <button type="button"
                            key={mat.id}
                            onClick={() => onMaterialChange(mat.id)}
                            className={`p-3 rounded-lg border text-left transition-all
                                      ${material === mat.id 
                                          ? 'border-cyan-500 bg-cyan-600/10' 
                                          : 'border-[#1a2333] hover:border-slate-500'
                                      }`}
                        >
                            <div className="font-medium tracking-wide text-slate-700 dark:text-slate-200">{mat.name}</div>
                            <div className="text-xs text-[#869ab8] mt-1">
                                E = {mat.E} GPa, fy = {mat.fy} MPa
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Section Selection */}
            <div>
                <h4 className="text-sm font-medium tracking-wide text-slate-600 dark:text-slate-300 mb-3">Select Section</h4>
                <div className="space-y-2">
                    {sections.map((sec) => (
                        <button type="button"
                            key={sec.id}
                            onClick={() => onSectionChange(sec.id)}
                            className={`w-full p-3 rounded-lg border text-left transition-all
                                      flex items-center justify-between
                                      ${section === sec.id 
                                          ? 'border-cyan-500 bg-cyan-600/10' 
                                          : 'border-[#1a2333] hover:border-slate-500'
                                      }`}
                        >
                            <div>
                                <div className="font-medium tracking-wide text-slate-700 dark:text-slate-200">{sec.name}</div>
                                <div className="text-xs text-[#869ab8] mt-1">
                                    A = {sec.A} mm², Iy = {sec.Iy} × 10⁶ mm⁴
                                </div>
                            </div>
                            {section === sec.id && (
                                <Check size={18} className="text-cyan-400" />
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

interface LoadStepProps {
    template: StructureTemplate | null;
    loads: WizardState['loads'];
    onChange: (loads: WizardState['loads']) => void;
}

const LoadStep: FC<LoadStepProps> = ({ template, loads, onChange }) => {
    const handleLoadChange = (index: number, key: 'fx' | 'fy' | 'fz', value: number) => {
        const updated = [...loads];
        updated[index] = { ...updated[index], [key]: value };
        onChange(updated);
    };

    const applyDefaultLoads = () => {
        if (template?.defaultLoads) {
            onChange(template.defaultLoads.map((dl, idx) => ({
                nodeIndex: dl.node,
                fx: 0,
                fy: dl.fy,
                fz: 0
            })));
        }
    };

    return (
        <div className="space-y-6">
            {/* Quick apply */}
            {template?.defaultLoads && (
                <button type="button"
                    onClick={applyDefaultLoads}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 
                             text-white rounded-lg transition-colors"
                >
                    <Zap size={16} />
                    Apply Typical Loads
                </button>
            )}

            {/* Load inputs */}
            <div className="space-y-3">
                {loads.map((load, idx) => (
                    <div 
                        key={idx}
                        className="p-3 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-[#1a2333]"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                                Load at Node {load.nodeIndex + 1}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="text-xs text-[#869ab8]">Fx (kN)</label>
                                <input
                                    type="number"
                                    value={load.fx}
                                    onChange={(e) => handleLoadChange(idx, 'fx', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2 py-1 bg-slate-200 dark:bg-slate-700 border border-slate-600 
                                             rounded text-sm text-slate-700 dark:text-slate-200"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-[#869ab8]">Fy (kN)</label>
                                <input
                                    type="number"
                                    value={load.fy}
                                    onChange={(e) => handleLoadChange(idx, 'fy', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2 py-1 bg-slate-200 dark:bg-slate-700 border border-slate-600 
                                             rounded text-sm text-slate-700 dark:text-slate-200"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-[#869ab8]">Fz (kN)</label>
                                <input
                                    type="number"
                                    value={load.fz}
                                    onChange={(e) => handleLoadChange(idx, 'fz', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2 py-1 bg-slate-200 dark:bg-slate-700 border border-slate-600 
                                             rounded text-sm text-slate-700 dark:text-slate-200"
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add load button */}
            <button type="button" className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300">
                <Circle size={14} className="fill-current" />
                Add Point Load
            </button>

            {/* Load summary */}
            <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-[#869ab8] mb-2">Load Summary</div>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <div className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                            {loads.reduce((sum, l) => sum + Math.abs(l.fx), 0).toFixed(1)}
                        </div>
                        <div className="text-xs text-[#869ab8]">ΣFx (kN)</div>
                    </div>
                    <div>
                        <div className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                            {loads.reduce((sum, l) => sum + Math.abs(l.fy), 0).toFixed(1)}
                        </div>
                        <div className="text-xs text-[#869ab8]">ΣFy (kN)</div>
                    </div>
                    <div>
                        <div className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                            {loads.reduce((sum, l) => sum + Math.abs(l.fz), 0).toFixed(1)}
                        </div>
                        <div className="text-xs text-[#869ab8]">ΣFz (kN)</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface ReviewStepProps {
    state: WizardState;
    onRun: () => void;
}

const ReviewStep: FC<ReviewStepProps> = ({ state, onRun }) => {
    return (
        <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-[#1a2333]">
                    <div className="flex items-center gap-2 text-[#869ab8] mb-2">
                        <Layout size={16} />
                        <span className="text-sm">Structure</span>
                    </div>
                    <div className="font-medium tracking-wide text-slate-700 dark:text-slate-200">
                        {state.template?.name || 'Custom Structure'}
                    </div>
                    <div className="text-xs text-[#869ab8] mt-1">
                        {state.template?.nodes.length || 0} nodes, {state.template?.members.length || 0} members
                    </div>
                </div>

                <div className="p-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-[#1a2333]">
                    <div className="flex items-center gap-2 text-[#869ab8] mb-2">
                        <Box size={16} />
                        <span className="text-sm">Geometry</span>
                    </div>
                    <div className="font-medium tracking-wide text-slate-700 dark:text-slate-200">
                        {state.geometry.width}m × {state.geometry.height}m
                    </div>
                    <div className="text-xs text-[#869ab8] mt-1">
                        {state.geometry.bays} bay(s), {state.geometry.stories} story
                    </div>
                </div>

                <div className="p-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-[#1a2333]">
                    <div className="flex items-center gap-2 text-[#869ab8] mb-2">
                        <Settings size={16} />
                        <span className="text-sm">Material & Section</span>
                    </div>
                    <div className="font-medium tracking-wide text-slate-700 dark:text-slate-200 capitalize">
                        {state.material.replace(/([A-Z])/g, ' $1')}
                    </div>
                    <div className="text-xs text-[#869ab8] mt-1 uppercase">
                        {state.section}
                    </div>
                </div>

                <div className="p-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-[#1a2333]">
                    <div className="flex items-center gap-2 text-[#869ab8] mb-2">
                        <Zap size={16} />
                        <span className="text-sm">Loads</span>
                    </div>
                    <div className="font-medium tracking-wide text-slate-700 dark:text-slate-200">
                        {state.loads.length} point load(s)
                    </div>
                    <div className="text-xs text-[#869ab8] mt-1">
                        Total: {state.loads.reduce((s, l) => s + Math.sqrt(l.fx**2 + l.fy**2 + l.fz**2), 0).toFixed(1)} kN
                    </div>
                </div>
            </div>

            {/* Analysis options */}
            <div className="p-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-[#1a2333]">
                <h4 className="text-sm font-medium tracking-wide text-slate-600 dark:text-slate-300 mb-3">Analysis Options</h4>
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-[#869ab8]">
                        <input
                            type="checkbox"
                            checked={state.analysisOptions.includeSecondOrder}
                            className="rounded bg-slate-200 dark:bg-slate-700 border-slate-600 text-cyan-500"
                            readOnly
                        />
                        Include P-Δ effects (second-order)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[#869ab8]">
                        <input
                            type="checkbox"
                            checked={state.analysisOptions.checkDesign}
                            className="rounded bg-slate-200 dark:bg-slate-700 border-slate-600 text-cyan-500"
                            readOnly
                        />
                        Perform design checks (IS 800)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[#869ab8]">
                        <input
                            type="checkbox"
                            checked={state.analysisOptions.generateReport}
                            className="rounded bg-slate-200 dark:bg-slate-700 border-slate-600 text-cyan-500"
                            readOnly
                        />
                        Generate detailed report
                    </label>
                </div>
            </div>

            {/* Run button */}
            <motion.button
                onClick={onRun}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 
                         hover:from-cyan-500 hover:to-blue-500 text-white font-semibold 
                         rounded-lg flex items-center justify-center gap-2 transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                <Play size={18} />
                Run Analysis
            </motion.button>
        </div>
    );
};

// ============================================
// MAIN WIZARD COMPONENT
// ============================================

interface AnalysisWizardProps {
    onComplete: (state: WizardState) => void;
    onCancel?: () => void;
}

export const AnalysisWizard: FC<AnalysisWizardProps> = ({ onComplete, onCancel }) => {
    const [state, setState] = useState<WizardState>({
        currentStep: 0,
        template: null,
        geometry: {
            width: 6,
            height: 4,
            depth: 0,
            bays: 1,
            stories: 1
        },
        material: 'fe250',
        section: 'ismb200',
        loads: [],
        analysisOptions: {
            includeSecondOrder: false,
            checkDesign: true,
            generateReport: true
        }
    });

    const steps: WizardStep[] = [
        { 
            id: 'template', 
            title: 'Structure Type', 
            description: 'Choose a structure template or start from scratch',
            icon: <Layout size={18} />,
            isComplete: state.template !== null,
            hasErrors: false
        },
        { 
            id: 'geometry', 
            title: 'Geometry', 
            description: 'Define the dimensions of your structure',
            icon: <Box size={18} />,
            isComplete: state.geometry.width > 0 && state.geometry.height > 0,
            hasErrors: false
        },
        { 
            id: 'material', 
            title: 'Material & Section', 
            description: 'Select material properties and cross-section',
            icon: <Settings size={18} />,
            isComplete: state.material !== '' && state.section !== '',
            hasErrors: false
        },
        { 
            id: 'loads', 
            title: 'Loads', 
            description: 'Apply forces and moments',
            icon: <Zap size={18} />,
            isComplete: state.loads.length > 0,
            hasErrors: false
        },
        { 
            id: 'review', 
            title: 'Review & Run', 
            description: 'Check your model and run analysis',
            icon: <BarChart3 size={18} />,
            isComplete: false,
            hasErrors: false
        }
    ];

    const currentStep = steps[state.currentStep];
    const canGoNext = currentStep.isComplete || state.currentStep === steps.length - 1;
    const canGoPrev = state.currentStep > 0;

    const handleNext = () => {
        if (state.currentStep < steps.length - 1) {
            setState(s => ({ ...s, currentStep: s.currentStep + 1 }));
        }
    };

    const handlePrev = () => {
        if (state.currentStep > 0) {
            setState(s => ({ ...s, currentStep: s.currentStep - 1 }));
        }
    };

    const handleRun = () => {
        onComplete(state);
    };

    return (
        <div className="bg-[#0b1326] rounded-xl border border-[#1a2333] overflow-hidden max-w-3xl mx-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#1a2333] flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-[#dae2fd]">Analysis Setup Wizard</h2>
                    <p className="text-sm text-[#869ab8]">
                        Step {state.currentStep + 1} of {steps.length}: {currentStep.title}
                    </p>
                </div>
                {onCancel && (
                    <button type="button"
                        onClick={onCancel}
                        className="text-slate-500 hover:text-slate-700 dark:text-slate-200 transition-colors"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Progress bar */}
            <div className="px-6 py-3 bg-slate-100/50 dark:bg-slate-800/50">
                <div className="flex items-center justify-between">
                    {steps.map((step, idx) => (
                        <React.Fragment key={step.id}>
                            <button type="button"
                                onClick={() => idx < state.currentStep && setState(s => ({ ...s, currentStep: idx }))}
                                className={`flex items-center gap-2 ${
                                    idx < state.currentStep 
                                        ? 'text-cyan-400 cursor-pointer' 
                                        : idx === state.currentStep 
                                            ? 'text-[#dae2fd]' 
                                            : 'text-[#869ab8] cursor-default'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2
                                              ${idx < state.currentStep 
                                                  ? 'border-cyan-400 bg-cyan-400/20' 
                                                  : idx === state.currentStep 
                                                      ? 'border-cyan-500 bg-cyan-600' 
                                                      : 'border-slate-600'
                                              }`}>
                                    {idx < state.currentStep ? (
                                        <Check size={14} />
                                    ) : (
                                        <span className="text-xs">{idx + 1}</span>
                                    )}
                                </div>
                                <span className="hidden md:inline text-sm">{step.title}</span>
                            </button>
                            {idx < steps.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-2 ${
                                    idx < state.currentStep ? 'bg-cyan-400' : 'bg-slate-200 dark:bg-slate-700'
                                }`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="p-6 min-h-[400px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {currentStep.id === 'template' && (
                            <TemplateStep
                                selected={state.template}
                                onSelect={(template) => {
                                    setState(s => ({ 
                                        ...s, 
                                        template,
                                        loads: template.defaultLoads.map((dl, idx) => ({
                                            nodeIndex: dl.node,
                                            fx: 0,
                                            fy: dl.fy,
                                            fz: 0
                                        }))
                                    }));
                                }}
                            />
                        )}
                        {currentStep.id === 'geometry' && (
                            <GeometryStep
                                template={state.template}
                                geometry={state.geometry}
                                onChange={(geometry) => setState(s => ({ ...s, geometry }))}
                            />
                        )}
                        {currentStep.id === 'material' && (
                            <MaterialStep
                                material={state.material}
                                section={state.section}
                                onMaterialChange={(material) => setState(s => ({ ...s, material }))}
                                onSectionChange={(section) => setState(s => ({ ...s, section }))}
                            />
                        )}
                        {currentStep.id === 'loads' && (
                            <LoadStep
                                template={state.template}
                                loads={state.loads}
                                onChange={(loads) => setState(s => ({ ...s, loads }))}
                            />
                        )}
                        {currentStep.id === 'review' && (
                            <ReviewStep
                                state={state}
                                onRun={handleRun}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Footer navigation */}
            <div className="px-6 py-4 border-t border-[#1a2333] flex items-center justify-between">
                <button type="button"
                    onClick={handlePrev}
                    disabled={!canGoPrev}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
                              ${canGoPrev 
                                  ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800' 
                                  : 'text-slate-500 cursor-not-allowed'
                              }`}
                >
                    <ArrowLeft size={16} />
                    Back
                </button>

                <div className="text-sm text-[#869ab8]">
                    {currentStep.description}
                </div>

                {state.currentStep < steps.length - 1 && (
                    <button type="button"
                        onClick={handleNext}
                        disabled={!canGoNext}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
                                  ${canGoNext 
                                      ? 'bg-cyan-600 hover:bg-cyan-500 text-white' 
                                      : 'bg-slate-200 dark:bg-slate-700 text-[#869ab8] cursor-not-allowed'
                                  }`}
                    >
                        Next
                        <ArrowRight size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default AnalysisWizard;
