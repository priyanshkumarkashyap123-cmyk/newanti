/**
 * StructureWizard.tsx - Parametric Structure Generator
 * 
 * Generates ready-to-analyze structures:
 * - Multi-story building frames
 * - Portal frames (industrial)
 * - Simple truss bridges
 * - Residential frames
 */

import { FC, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Building2, Factory, Milestone, Home,
    ArrowRight, ArrowLeft, Check, Layers, Grid3X3,
    Ruler, Settings2, Sparkles
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

type StructureType = 'building' | 'portal' | 'truss' | 'residential';

interface StructureConfig {
    type: StructureType;
    // Building params
    numStorys?: number;
    numBaysX?: number;
    numBaysY?: number;
    storyHeight?: number;
    bayWidthX?: number;
    bayWidthY?: number;
    // Truss params
    span?: number;
    height?: number;
    numPanels?: number;
    // Material
    material?: 'steel' | 'concrete';
    sectionSize?: 'light' | 'medium' | 'heavy';
}

interface GeneratedNode {
    id: string;
    x: number;
    y: number;
    z: number;
    restraints?: {
        fx: boolean;
        fy: boolean;
        fz: boolean;
        mx: boolean;
        my: boolean;
        mz: boolean;
    };
}

interface GeneratedMember {
    id: string;
    startNodeId: string;
    endNodeId: string;
    type: 'beam' | 'column' | 'brace';
}

interface GeneratedStructure {
    nodes: GeneratedNode[];
    members: GeneratedMember[];
    name: string;
}

interface StructureWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (structure: GeneratedStructure) => void;
}

// ============================================
// STRUCTURE TYPE OPTIONS
// ============================================

const STRUCTURE_TYPES = [
    {
        id: 'building' as StructureType,
        name: 'Multi-Story Building',
        description: 'Steel or concrete frame building with multiple floors',
        icon: Building2,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
    },
    {
        id: 'portal' as StructureType,
        name: 'Portal Frame',
        description: 'Industrial shed or warehouse portal frame',
        icon: Factory,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
    },
    {
        id: 'truss' as StructureType,
        name: 'Truss Bridge',
        description: 'Simple Pratt or Warren truss bridge',
        icon: Milestone,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
    },
    {
        id: 'residential' as StructureType,
        name: 'Residential Frame',
        description: '2-story house frame with typical dimensions',
        icon: Home,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
    },
];

// ============================================
// STRUCTURE GENERATORS
// ============================================

function generateBuildingFrame(config: StructureConfig): GeneratedStructure {
    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];

    const numStorys = config.numStorys || 3;
    const numBaysX = config.numBaysX || 2;
    const numBaysY = config.numBaysY || 2;
    const storyHeight = config.storyHeight || 3.5;
    const bayWidthX = config.bayWidthX || 6;
    const bayWidthY = config.bayWidthY || 6;

    let nodeId = 1;
    const nodeMap: Map<string, string> = new Map();

    // Generate nodes
    for (let floor = 0; floor <= numStorys; floor++) {
        for (let ix = 0; ix <= numBaysX; ix++) {
            for (let iy = 0; iy <= numBaysY; iy++) {
                const id = `N${nodeId++}`;
                const key = `${floor}-${ix}-${iy}`;
                nodeMap.set(key, id);

                const node: GeneratedNode = {
                    id,
                    x: ix * bayWidthX,
                    y: floor * storyHeight,
                    z: iy * bayWidthY,
                };

                // Fix base nodes
                if (floor === 0) {
                    node.restraints = {
                        fx: true, fy: true, fz: true,
                        mx: true, my: true, mz: true
                    };
                }

                nodes.push(node);
            }
        }
    }

    let memberId = 1;

    // Generate columns (vertical)
    for (let floor = 0; floor < numStorys; floor++) {
        for (let ix = 0; ix <= numBaysX; ix++) {
            for (let iy = 0; iy <= numBaysY; iy++) {
                const bottomKey = `${floor}-${ix}-${iy}`;
                const topKey = `${floor + 1}-${ix}-${iy}`;
                members.push({
                    id: `M${memberId++}`,
                    startNodeId: nodeMap.get(bottomKey)!,
                    endNodeId: nodeMap.get(topKey)!,
                    type: 'column'
                });
            }
        }
    }

    // Generate beams (horizontal X-direction)
    for (let floor = 1; floor <= numStorys; floor++) {
        for (let ix = 0; ix < numBaysX; ix++) {
            for (let iy = 0; iy <= numBaysY; iy++) {
                const leftKey = `${floor}-${ix}-${iy}`;
                const rightKey = `${floor}-${ix + 1}-${iy}`;
                members.push({
                    id: `M${memberId++}`,
                    startNodeId: nodeMap.get(leftKey)!,
                    endNodeId: nodeMap.get(rightKey)!,
                    type: 'beam'
                });
            }
        }
    }

    // Generate beams (horizontal Y-direction)
    for (let floor = 1; floor <= numStorys; floor++) {
        for (let ix = 0; ix <= numBaysX; ix++) {
            for (let iy = 0; iy < numBaysY; iy++) {
                const frontKey = `${floor}-${ix}-${iy}`;
                const backKey = `${floor}-${ix}-${iy + 1}`;
                members.push({
                    id: `M${memberId++}`,
                    startNodeId: nodeMap.get(frontKey)!,
                    endNodeId: nodeMap.get(backKey)!,
                    type: 'beam'
                });
            }
        }
    }

    return {
        nodes,
        members,
        name: `${numStorys}-Story Building (${numBaysX}x${numBaysY} bays)`
    };
}

function generatePortalFrame(config: StructureConfig): GeneratedStructure {
    const span = config.span || 15;
    const height = config.storyHeight || 6;
    const eaveHeight = height * 0.7;

    const nodes: GeneratedNode[] = [
        { id: 'N1', x: 0, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
        { id: 'N2', x: 0, y: eaveHeight, z: 0 },
        { id: 'N3', x: span / 2, y: height, z: 0 },
        { id: 'N4', x: span, y: eaveHeight, z: 0 },
        { id: 'N5', x: span, y: 0, z: 0, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
    ];

    const members: GeneratedMember[] = [
        { id: 'M1', startNodeId: 'N1', endNodeId: 'N2', type: 'column' },
        { id: 'M2', startNodeId: 'N2', endNodeId: 'N3', type: 'beam' },
        { id: 'M3', startNodeId: 'N3', endNodeId: 'N4', type: 'beam' },
        { id: 'M4', startNodeId: 'N4', endNodeId: 'N5', type: 'column' },
    ];

    return {
        nodes,
        members,
        name: `Portal Frame (${span}m span)`
    };
}

function generateTrussBridge(config: StructureConfig): GeneratedStructure {
    const span = config.span || 24;
    const height = config.height || 4;
    const numPanels = config.numPanels || 6;
    const panelWidth = span / numPanels;

    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];

    let nodeId = 1;
    let memberId = 1;

    // Bottom chord nodes
    for (let i = 0; i <= numPanels; i++) {
        const node: GeneratedNode = {
            id: `N${nodeId++}`,
            x: i * panelWidth,
            y: 0,
            z: 0
        };
        if (i === 0 || i === numPanels) {
            node.restraints = { fx: true, fy: true, fz: true, mx: false, my: false, mz: false };
        }
        nodes.push(node);
    }

    // Top chord nodes
    for (let i = 0; i <= numPanels; i++) {
        nodes.push({
            id: `N${nodeId++}`,
            x: i * panelWidth,
            y: height,
            z: 0
        });
    }

    // Bottom chord members
    for (let i = 0; i < numPanels; i++) {
        members.push({
            id: `M${memberId++}`,
            startNodeId: `N${i + 1}`,
            endNodeId: `N${i + 2}`,
            type: 'beam'
        });
    }

    // Top chord members
    for (let i = 0; i < numPanels; i++) {
        members.push({
            id: `M${memberId++}`,
            startNodeId: `N${numPanels + 2 + i}`,
            endNodeId: `N${numPanels + 3 + i}`,
            type: 'beam'
        });
    }

    // Verticals
    for (let i = 0; i <= numPanels; i++) {
        members.push({
            id: `M${memberId++}`,
            startNodeId: `N${i + 1}`,
            endNodeId: `N${numPanels + 2 + i}`,
            type: 'brace'
        });
    }

    // Diagonals (Warren truss pattern)
    for (let i = 0; i < numPanels; i++) {
        if (i % 2 === 0) {
            // Diagonal up-right
            members.push({
                id: `M${memberId++}`,
                startNodeId: `N${i + 1}`,
                endNodeId: `N${numPanels + 3 + i}`,
                type: 'brace'
            });
        } else {
            // Diagonal down-right
            members.push({
                id: `M${memberId++}`,
                startNodeId: `N${numPanels + 2 + i}`,
                endNodeId: `N${i + 2}`,
                type: 'brace'
            });
        }
    }

    return {
        nodes,
        members,
        name: `Warren Truss Bridge (${span}m span)`
    };
}

function generateResidentialFrame(config: StructureConfig): GeneratedStructure {
    // Simple 2-story residential frame
    const width = 8;
    const depth = 10;
    const storyHeight = 3;

    const nodes: GeneratedNode[] = [];
    const members: GeneratedMember[] = [];

    let nodeId = 1;
    let memberId = 1;

    // Ground floor corners
    const basePositions = [
        [0, 0], [width, 0], [width, depth], [0, depth]
    ];

    // Generate nodes for ground and first floor
    for (let floor = 0; floor <= 2; floor++) {
        for (const [x, z] of basePositions) {
            const node: GeneratedNode = {
                id: `N${nodeId++}`,
                x,
                y: floor * storyHeight,
                z
            };
            if (floor === 0) {
                node.restraints = { fx: true, fy: true, fz: true, mx: true, my: true, mz: true };
            }
            nodes.push(node);
        }
    }

    // Columns
    for (let floor = 0; floor < 2; floor++) {
        for (let corner = 0; corner < 4; corner++) {
            members.push({
                id: `M${memberId++}`,
                startNodeId: `N${floor * 4 + corner + 1}`,
                endNodeId: `N${(floor + 1) * 4 + corner + 1}`,
                type: 'column'
            });
        }
    }

    // Beams per floor
    for (let floor = 1; floor <= 2; floor++) {
        const base = (floor) * 4;
        // Front beam
        members.push({ id: `M${memberId++}`, startNodeId: `N${base + 1}`, endNodeId: `N${base + 2}`, type: 'beam' });
        // Right beam
        members.push({ id: `M${memberId++}`, startNodeId: `N${base + 2}`, endNodeId: `N${base + 3}`, type: 'beam' });
        // Back beam
        members.push({ id: `M${memberId++}`, startNodeId: `N${base + 3}`, endNodeId: `N${base + 4}`, type: 'beam' });
        // Left beam
        members.push({ id: `M${memberId++}`, startNodeId: `N${base + 4}`, endNodeId: `N${base + 1}`, type: 'beam' });
    }

    return {
        nodes,
        members,
        name: '2-Story Residential Frame'
    };
}

// ============================================
// MAIN COMPONENT
// ============================================

export const StructureWizard: FC<StructureWizardProps> = ({ isOpen, onClose, onGenerate }) => {
    const [step, setStep] = useState(1);
    const [selectedType, setSelectedType] = useState<StructureType | null>(null);
    const [config, setConfig] = useState<StructureConfig>({
        type: 'building',
        numStorys: 3,
        numBaysX: 2,
        numBaysY: 2,
        storyHeight: 3.5,
        bayWidthX: 6,
        bayWidthY: 6,
        span: 15,
        height: 4,
        numPanels: 6,
        material: 'steel',
        sectionSize: 'medium'
    });

    const handleSelectType = (type: StructureType) => {
        setSelectedType(type);
        setConfig({ ...config, type });
    };

    const handleGenerate = () => {
        if (!selectedType) return;

        let structure: GeneratedStructure;

        switch (selectedType) {
            case 'building':
                structure = generateBuildingFrame(config);
                break;
            case 'portal':
                structure = generatePortalFrame(config);
                break;
            case 'truss':
                structure = generateTrussBridge(config);
                break;
            case 'residential':
                structure = generateResidentialFrame(config);
                break;
            default:
                return;
        }

        onGenerate(structure);
        onClose();
    };

    const handleNext = () => {
        if (step === 1 && selectedType) {
            setStep(2);
        } else if (step === 2) {
            handleGenerate();
        }
    };

    const handleBack = () => {
        if (step === 2) {
            setStep(1);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Structure Wizard</h2>
                                <p className="text-sm text-zinc-400">Generate a parametric structure</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {step === 1 && (
                            <div className="space-y-4">
                                <h3 className="text-white font-medium mb-4">Select Structure Type</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {STRUCTURE_TYPES.map((type) => {
                                        const Icon = type.icon;
                                        const isSelected = selectedType === type.id;
                                        return (
                                            <button
                                                key={type.id}
                                                onClick={() => handleSelectType(type.id)}
                                                className={`p-4 rounded-xl border text-left transition-all ${isSelected
                                                        ? 'border-blue-500 bg-blue-500/10'
                                                        : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
                                                    }`}
                                            >
                                                <div className={`w-12 h-12 rounded-lg ${type.bgColor} flex items-center justify-center mb-3`}>
                                                    <Icon className={`w-6 h-6 ${type.color}`} />
                                                </div>
                                                <h4 className="text-white font-semibold">{type.name}</h4>
                                                <p className="text-sm text-zinc-400 mt-1">{type.description}</p>
                                                {isSelected && (
                                                    <div className="absolute top-2 right-2">
                                                        <Check className="w-5 h-5 text-blue-500" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6">
                                <h3 className="text-white font-medium">Configure Parameters</h3>

                                {selectedType === 'building' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-2">Number of Stories</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={20}
                                                value={config.numStorys}
                                                onChange={(e) => setConfig({ ...config, numStorys: parseInt(e.target.value) || 3 })}
                                                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-2">Story Height (m)</label>
                                            <input
                                                type="number"
                                                step={0.5}
                                                min={2.5}
                                                max={6}
                                                value={config.storyHeight}
                                                onChange={(e) => setConfig({ ...config, storyHeight: parseFloat(e.target.value) || 3.5 })}
                                                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-2">Bays in X Direction</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={10}
                                                value={config.numBaysX}
                                                onChange={(e) => setConfig({ ...config, numBaysX: parseInt(e.target.value) || 2 })}
                                                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-2">Bay Width X (m)</label>
                                            <input
                                                type="number"
                                                step={0.5}
                                                min={3}
                                                max={12}
                                                value={config.bayWidthX}
                                                onChange={(e) => setConfig({ ...config, bayWidthX: parseFloat(e.target.value) || 6 })}
                                                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-2">Bays in Y Direction</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={10}
                                                value={config.numBaysY}
                                                onChange={(e) => setConfig({ ...config, numBaysY: parseInt(e.target.value) || 2 })}
                                                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-2">Bay Width Y (m)</label>
                                            <input
                                                type="number"
                                                step={0.5}
                                                min={3}
                                                max={12}
                                                value={config.bayWidthY}
                                                onChange={(e) => setConfig({ ...config, bayWidthY: parseFloat(e.target.value) || 6 })}
                                                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {selectedType === 'portal' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-2">Span (m)</label>
                                            <input
                                                type="number"
                                                min={8}
                                                max={40}
                                                value={config.span}
                                                onChange={(e) => setConfig({ ...config, span: parseFloat(e.target.value) || 15 })}
                                                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-2">Height (m)</label>
                                            <input
                                                type="number"
                                                min={4}
                                                max={15}
                                                value={config.storyHeight}
                                                onChange={(e) => setConfig({ ...config, storyHeight: parseFloat(e.target.value) || 6 })}
                                                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {selectedType === 'truss' && (
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-2">Span (m)</label>
                                            <input
                                                type="number"
                                                min={12}
                                                max={60}
                                                value={config.span}
                                                onChange={(e) => setConfig({ ...config, span: parseFloat(e.target.value) || 24 })}
                                                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-2">Height (m)</label>
                                            <input
                                                type="number"
                                                min={2}
                                                max={10}
                                                value={config.height}
                                                onChange={(e) => setConfig({ ...config, height: parseFloat(e.target.value) || 4 })}
                                                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-2">Number of Panels</label>
                                            <input
                                                type="number"
                                                min={4}
                                                max={12}
                                                value={config.numPanels}
                                                onChange={(e) => setConfig({ ...config, numPanels: parseInt(e.target.value) || 6 })}
                                                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {selectedType === 'residential' && (
                                    <div className="bg-zinc-800 rounded-lg p-4 text-center">
                                        <Home className="w-12 h-12 text-purple-500 mx-auto mb-3" />
                                        <p className="text-zinc-300">Standard 2-story residential frame</p>
                                        <p className="text-sm text-zinc-500 mt-1">8m × 10m footprint, 3m story height</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-zinc-800 flex justify-between">
                        <button
                            onClick={step === 1 ? onClose : handleBack}
                            className="px-4 py-2 text-zinc-400 hover:text-white transition-colors flex items-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            {step === 1 ? 'Cancel' : 'Back'}
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={step === 1 && !selectedType}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
                        >
                            {step === 2 ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    Generate Structure
                                </>
                            ) : (
                                <>
                                    Next
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default StructureWizard;
