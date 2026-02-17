/**
 * StructureWizard.tsx - Comprehensive Structure Generator
 * 
 * Template Library for parametric structure generation:
 * 
 * TRUSSES:
 * - Pratt Truss (diagonals toward center - tension optimized)
 * - Warren Truss (alternating diagonals - balanced)
 * - Howe Truss (diagonals away from center - compression optimized)
 * - K-Truss (double diagonals per panel)
 * 
 * FRAMES:
 * - Bay Frame (2D portal)
 * - Grid Frame (3D space frame)
 * - Multi-Story Building
 * - Portal Frame (industrial)
 * 
 * SHELLS:
 * - Cylindrical Surface (barrel vault)
 * - Spherical Cap (dome)
 */

import { FC, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Building2, Factory, Milestone, Home,
    ArrowRight, ArrowLeft, Check, Layers, Grid3X3,
    Ruler, Settings2, Sparkles, Triangle, Circle,
    Box, Hexagon, Columns, Tent
} from 'lucide-react';
import { StructureWizard as WizardGenerator } from '../modules/modeling/physical_modeler';

// ============================================
// TYPES
// ============================================

type StructureCategory = 'truss' | 'frame' | 'shell';
type TrussType = 'pratt' | 'warren' | 'howe' | 'ktruss';
type FrameType = 'building' | 'portal' | 'bay' | 'grid' | 'residential';
type ShellType = 'cylindrical' | 'spherical' | 'dome';

type StructureType = TrussType | FrameType | ShellType;

interface StructureConfig {
    category: StructureCategory;
    type: StructureType;
    
    // Common params
    name?: string;
    
    // Truss params
    span?: number;
    height?: number;
    numPanels?: number;  // bays for trusses
    bottomChordY?: number;
    
    // Frame params - Building
    numStorys?: number;
    numBaysX?: number;
    numBaysY?: number;
    storyHeight?: number;
    bayWidthX?: number;
    bayWidthY?: number;
    
    // Shell params
    radius?: number;
    divisions?: number;
    angleDegrees?: number;
    shellSpan?: number;
    
    // Material
    material?: 'steel' | 'concrete' | 'timber';
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
    sectionId?: string;
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
// STRUCTURE CATEGORIES
// ============================================

const STRUCTURE_CATEGORIES = [
    {
        id: 'truss' as StructureCategory,
        name: 'Trusses',
        description: 'Triangulated structures for bridges and roofs',
        icon: Triangle,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
    },
    {
        id: 'frame' as StructureCategory,
        name: 'Frames',
        description: 'Beam-column systems for buildings',
        icon: Building2,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
    },
    {
        id: 'shell' as StructureCategory,
        name: 'Shells & Surfaces',
        description: 'Curved structures for domes and vaults',
        icon: Circle,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
    },
];

// ============================================
// TRUSS TYPES
// ============================================

const TRUSS_TYPES = [
    {
        id: 'pratt' as TrussType,
        name: 'Pratt Truss',
        description: 'Diagonals slope toward center - optimized for tension',
        icon: Triangle,
    },
    {
        id: 'warren' as TrussType,
        name: 'Warren Truss',
        description: 'Alternating diagonals - balanced design',
        icon: Triangle,
    },
    {
        id: 'howe' as TrussType,
        name: 'Howe Truss',
        description: 'Diagonals slope away from center - compression optimized',
        icon: Triangle,
    },
    {
        id: 'ktruss' as TrussType,
        name: 'K-Truss',
        description: 'Double diagonals per panel - for heavy loads',
        icon: Triangle,
    },
];

// ============================================
// FRAME TYPES
// ============================================

const FRAME_TYPES = [
    {
        id: 'building' as FrameType,
        name: 'Multi-Story Building',
        description: 'Steel or concrete frame with multiple floors',
        icon: Building2,
    },
    {
        id: 'portal' as FrameType,
        name: 'Portal Frame',
        description: 'Industrial shed or warehouse',
        icon: Factory,
    },
    {
        id: 'bay' as FrameType,
        name: 'Bay Frame',
        description: 'Single-bay 2D portal frame',
        icon: Columns,
    },
    {
        id: 'grid' as FrameType,
        name: 'Grid Frame',
        description: '3D space frame with beams in both directions',
        icon: Grid3X3,
    },
    {
        id: 'residential' as FrameType,
        name: 'Residential Frame',
        description: '2-story house frame with typical dimensions',
        icon: Home,
    },
];

// ============================================
// SHELL TYPES
// ============================================

const SHELL_TYPES = [
    {
        id: 'cylindrical' as ShellType,
        name: 'Cylindrical Surface',
        description: 'Barrel vault or tunnel structure',
        icon: Box,
    },
    {
        id: 'spherical' as ShellType,
        name: 'Spherical Cap',
        description: 'Dome or spherical shell',
        icon: Circle,
    },
    {
        id: 'dome' as ShellType,
        name: 'Geodesic Dome',
        description: 'Triangulated spherical dome',
        icon: Hexagon,
    },
];

// ============================================
// LEGACY STRUCTURE TYPE OPTIONS (for backward compatibility)
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
    const [selectedCategory, setSelectedCategory] = useState<StructureCategory | null>(null);
    const [selectedType, setSelectedType] = useState<StructureType | null>(null);
    const [config, setConfig] = useState<StructureConfig>({
        category: 'frame',
        type: 'building',
        numStorys: 3,
        numBaysX: 2,
        numBaysY: 2,
        storyHeight: 3.5,
        bayWidthX: 6,
        bayWidthY: 6,
        span: 24,
        height: 4,
        numPanels: 6,
        radius: 10,
        divisions: 8,
        angleDegrees: 180,
        shellSpan: 20,
        material: 'steel',
        sectionSize: 'medium'
    });

    const handleSelectCategory = (category: StructureCategory) => {
        setSelectedCategory(category);
        setStep(2);
    };

    const handleSelectType = (type: StructureType) => {
        setSelectedType(type);
        setConfig({ ...config, type });
        setStep(3);
    };

    const handleGenerate = () => {
        if (!selectedType || !selectedCategory) return;

        let structure: GeneratedStructure;

        // Use the StructureWizard generators from physical_modeler
        if (selectedCategory === 'truss') {
            const result = WizardGenerator.generateTruss({
                type: selectedType as TrussType,
                span: config.span ?? 24,
                height: config.height ?? 4,
                bays: config.numPanels ?? 6,
                bottomChordY: config.bottomChordY ?? 0
            });
            structure = {
                nodes: result.nodes.map(n => ({ ...n, type: 'beam' as const })),
                members: result.members.map(m => ({ ...m, type: 'brace' as const })),
                name: `${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} Truss (${config.span}m)`
            };
        } else if (selectedCategory === 'frame') {
            switch (selectedType) {
                case 'building':
                    structure = generateBuildingFrame(config);
                    break;
                case 'portal':
                    structure = generatePortalFrame(config);
                    break;
                case 'bay':
                case 'grid': {
                    const result = WizardGenerator.generateFrame({
                        type: selectedType as 'bay' | 'grid',
                        spanX: config.bayWidthX ?? 6,
                        spanY: config.bayWidthY ?? 6,
                        height: config.storyHeight ?? 3.5,
                        nBaysX: config.numBaysX ?? 2,
                        nBaysY: config.numBaysY ?? 2,
                        nStories: config.numStorys ?? 3
                    });
                    structure = {
                        nodes: result.nodes,
                        members: result.members.map(m => ({ ...m, type: 'beam' as const })),
                        name: `${selectedType === 'grid' ? 'Grid' : 'Bay'} Frame (${config.numBaysX}x${config.numBaysY})`
                    };
                    break;
                }
                case 'residential':
                    structure = generateResidentialFrame(config);
                    break;
                default:
                    return;
            }
        } else if (selectedCategory === 'shell') {
            const result = WizardGenerator.generateShell({
                type: selectedType as ShellType,
                radius: config.radius ?? 10,
                span: config.shellSpan ?? 20,
                divisions: config.divisions ?? 8,
                angleDegrees: config.angleDegrees ?? 180
            });
            structure = {
                nodes: result.nodes,
                members: result.members.map(m => ({ ...m, type: 'beam' as const })),
                name: `${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} Shell (R=${config.radius}m)`
            };
        } else {
            return;
        }

        onGenerate(structure);
        onClose();
        // Reset wizard state
        setStep(1);
        setSelectedCategory(null);
        setSelectedType(null);
    };

    const handleNext = () => {
        if (step === 1 && selectedCategory) {
            setStep(2);
        } else if (step === 2 && selectedType) {
            setStep(3);
        } else if (step === 3) {
            handleGenerate();
        }
    };

    const handleBack = () => {
        if (step === 3) {
            setStep(2);
        } else if (step === 2) {
            setStep(1);
            setSelectedType(null);
        }
    };

    const getTypeOptions = () => {
        switch (selectedCategory) {
            case 'truss':
                return TRUSS_TYPES;
            case 'frame':
                return FRAME_TYPES;
            case 'shell':
                return SHELL_TYPES;
            default:
                return [];
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
                    className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
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
                        {/* Step 1: Select Category */}
                        {step === 1 && (
                            <div className="space-y-4">
                                <h3 className="text-white font-medium mb-4">Select Structure Category</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    {STRUCTURE_CATEGORIES.map((cat) => {
                                        const Icon = cat.icon;
                                        const isSelected = selectedCategory === cat.id;
                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => handleSelectCategory(cat.id)}
                                                className={`p-4 rounded-xl border text-left transition-all relative ${isSelected
                                                        ? 'border-blue-500 bg-blue-500/10'
                                                        : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
                                                    }`}
                                            >
                                                <div className={`w-12 h-12 rounded-lg ${cat.bgColor} flex items-center justify-center mb-3`}>
                                                    <Icon className={`w-6 h-6 ${cat.color}`} />
                                                </div>
                                                <h4 className="text-white font-semibold">{cat.name}</h4>
                                                <p className="text-sm text-zinc-400 mt-1">{cat.description}</p>
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

                        {/* Step 2: Select Type within Category */}
                        {step === 2 && selectedCategory && (
                            <div className="space-y-4">
                                <h3 className="text-white font-medium mb-4">
                                    Select {selectedCategory === 'truss' ? 'Truss' : selectedCategory === 'frame' ? 'Frame' : 'Shell'} Type
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {getTypeOptions().map((type) => {
                                        const Icon = type.icon;
                                        const isSelected = selectedType === type.id;
                                        return (
                                            <button
                                                key={type.id}
                                                onClick={() => handleSelectType(type.id)}
                                                className={`p-4 rounded-xl border text-left transition-all relative ${isSelected
                                                        ? 'border-blue-500 bg-blue-500/10'
                                                        : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3 mb-2">
                                                    <Icon className="w-5 h-5 text-zinc-400" />
                                                    <h4 className="text-white font-semibold">{type.name}</h4>
                                                </div>
                                                <p className="text-sm text-zinc-400">{type.description}</p>
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

                        {/* Step 3: Configure Parameters */}
                        {step === 3 && (
                            <div className="space-y-6">
                                <h3 className="text-white font-medium">Configure Parameters</h3>

                                {/* TRUSS PARAMETERS */}
                                {selectedCategory === 'truss' && (
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-2">Span (m)</label>
                                            <input
                                                type="number"
                                                min={12}
                                                max={100}
                                                value={config.span}
                                                onChange={(e) => setConfig({ ...config, span: parseFloat(e.target.value) || 24 })}
                                                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-2">Height (m)</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={20}
                                                value={config.height}
                                                onChange={(e) => setConfig({ ...config, height: parseFloat(e.target.value) || 4 })}
                                                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-2">Number of Bays</label>
                                            <input
                                                type="number"
                                                min={4}
                                                max={20}
                                                value={config.numPanels}
                                                onChange={(e) => setConfig({ ...config, numPanels: parseInt(e.target.value) || 6 })}
                                                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                        <div className="col-span-3 bg-zinc-800 rounded-lg p-4">
                                            <p className="text-sm text-zinc-300">
                                                <strong>{selectedType?.toString().toUpperCase()} Truss:</strong>{' '}
                                                {selectedType === 'pratt' && 'Diagonals slope toward center - optimized for tension diagonals and compression verticals.'}
                                                {selectedType === 'warren' && 'Alternating diagonals without verticals - balanced and efficient design.'}
                                                {selectedType === 'howe' && 'Diagonals slope away from center - compression diagonals and tension verticals.'}
                                                {selectedType === 'ktruss' && 'Double diagonals per panel forming K-shapes - suitable for heavy loads.'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* FRAME PARAMETERS - Building/Grid */}
                                {selectedCategory === 'frame' && (selectedType === 'building' || selectedType === 'grid' || selectedType === 'bay') && (
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
                                        {(selectedType === 'building' || selectedType === 'grid') && (
                                            <>
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
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* FRAME PARAMETERS - Portal */}
                                {selectedCategory === 'frame' && selectedType === 'portal' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-2">Span (m)</label>
                                            <input
                                                type="number"
                                                min={8}
                                                max={50}
                                                value={config.span}
                                                onChange={(e) => setConfig({ ...config, span: parseFloat(e.target.value) || 15 })}
                                                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-2">Eave Height (m)</label>
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

                                {/* FRAME PARAMETERS - Residential */}
                                {selectedCategory === 'frame' && selectedType === 'residential' && (
                                    <div className="bg-zinc-800 rounded-lg p-4 text-center">
                                        <Home className="w-12 h-12 text-purple-500 mx-auto mb-3" />
                                        <p className="text-zinc-300">Standard 2-story residential frame</p>
                                        <p className="text-sm text-zinc-400 mt-1">8m × 10m footprint, 3m story height</p>
                                    </div>
                                )}

                                {/* SHELL PARAMETERS */}
                                {selectedCategory === 'shell' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-2">Radius (m)</label>
                                            <input
                                                type="number"
                                                min={5}
                                                max={50}
                                                value={config.radius}
                                                onChange={(e) => setConfig({ ...config, radius: parseFloat(e.target.value) || 10 })}
                                                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-2">Divisions</label>
                                            <input
                                                type="number"
                                                min={4}
                                                max={24}
                                                value={config.divisions}
                                                onChange={(e) => setConfig({ ...config, divisions: parseInt(e.target.value) || 8 })}
                                                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                            />
                                        </div>
                                        {selectedType === 'cylindrical' && (
                                            <>
                                                <div>
                                                    <label className="block text-sm text-zinc-400 mb-2">Length (m)</label>
                                                    <input
                                                        type="number"
                                                        min={10}
                                                        max={100}
                                                        value={config.shellSpan}
                                                        onChange={(e) => setConfig({ ...config, shellSpan: parseFloat(e.target.value) || 20 })}
                                                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm text-zinc-400 mb-2">Arc Angle (degrees)</label>
                                                    <input
                                                        type="number"
                                                        min={30}
                                                        max={360}
                                                        value={config.angleDegrees}
                                                        onChange={(e) => setConfig({ ...config, angleDegrees: parseInt(e.target.value) || 180 })}
                                                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                                    />
                                                </div>
                                            </>
                                        )}
                                        {(selectedType === 'spherical' || selectedType === 'dome') && (
                                            <div>
                                                <label className="block text-sm text-zinc-400 mb-2">Dome Angle (degrees)</label>
                                                <input
                                                    type="number"
                                                    min={30}
                                                    max={90}
                                                    value={config.angleDegrees}
                                                    onChange={(e) => setConfig({ ...config, angleDegrees: parseInt(e.target.value) || 90 })}
                                                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>
                                        )}
                                        <div className="col-span-2 bg-zinc-800 rounded-lg p-4">
                                            <p className="text-sm text-zinc-300">
                                                {selectedType === 'cylindrical' && 'Barrel vault structure with longitudinal, circumferential, and diagonal bracing.'}
                                                {selectedType === 'spherical' && 'Spherical cap with meridional and parallel ring members.'}
                                                {selectedType === 'dome' && 'Geodesic triangulated dome structure.'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-zinc-800 flex justify-between sticky bottom-0 bg-zinc-900">
                        <button
                            onClick={step === 1 ? onClose : handleBack}
                            className="px-4 py-2 text-zinc-400 hover:text-white transition-colors flex items-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            {step === 1 ? 'Cancel' : 'Back'}
                        </button>
                        <div className="flex items-center gap-2">
                            {/* Step indicators */}
                            <div className="flex items-center gap-1 mr-4">
                                {[1, 2, 3].map((s) => (
                                    <div
                                        key={s}
                                        className={`w-2 h-2 rounded-full transition-colors ${
                                            s === step ? 'bg-blue-500' : s < step ? 'bg-green-500' : 'bg-zinc-600'
                                        }`}
                                    />
                                ))}
                            </div>
                            <button
                                onClick={handleNext}
                                disabled={(step === 1 && !selectedCategory) || (step === 2 && !selectedType)}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
                            >
                                {step === 3 ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Generate & Merge
                                    </>
                                ) : (
                                    <>
                                        Next
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default StructureWizard;
