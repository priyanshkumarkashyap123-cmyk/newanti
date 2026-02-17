/**
 * GeneratorDialogs.tsx - Structure Generator Dialogs
 * 
 * Parametric dialogs for generating common structural patterns:
 * - Truss Generator (Warren, Pratt, Howe)
 * - Arch Generator (Parabolic, Circular)
 * - Frame Generator (Portal, Multi-story)
 * - Deck Generator (Bridge deck with stringers)
 * - Cable Pattern Generator (Fan, Harp, Semi-harp)
 */

import { FC, useState } from 'react';
import { X, Triangle, Spline, Building, Layers, Cable } from 'lucide-react';
import { useModelStore } from '../../store/model';

// ============================================
// TYPES
// ============================================

interface DialogProps {
    isOpen: boolean;
    onClose: () => void;
}

type TrussType = 'warren' | 'pratt' | 'howe' | 'k-truss';
type ArchType = 'parabolic' | 'circular' | 'catenary';
type CableArrangement = 'fan' | 'harp' | 'semi-harp';

// ============================================
// TRUSS GENERATOR DIALOG
// ============================================

export const TrussGeneratorDialog: FC<DialogProps> = ({ isOpen, onClose }) => {
    const [trussType, setTrussType] = useState<TrussType>('warren');
    const [span, setSpan] = useState(24);
    const [height, setHeight] = useState(4);
    const [panels, setPanels] = useState(8);

    const { addNode, addMember, clearModel } = useModelStore();

    const handleGenerate = () => {
        clearModel();

        const panelWidth = span / panels;
        let nodeId = 1;
        let memberId = 1;

        // Generate bottom chord nodes
        const bottomNodes: string[] = [];
        for (let i = 0; i <= panels; i++) {
            const id = `N${nodeId++}`;
            addNode({ id, x: i * panelWidth, y: 0, z: 0 });
            bottomNodes.push(id);
        }

        // Generate top chord nodes
        const topNodes: string[] = [];
        if (trussType === 'warren') {
            // Warren: top nodes between bottom nodes
            for (let i = 0; i < panels; i++) {
                const id = `N${nodeId++}`;
                addNode({ id, x: (i + 0.5) * panelWidth, y: height, z: 0 });
                topNodes.push(id);
            }
        } else {
            // Pratt/Howe: top nodes aligned with bottom
            for (let i = 0; i <= panels; i++) {
                const id = `N${nodeId++}`;
                addNode({ id, x: i * panelWidth, y: height, z: 0 });
                topNodes.push(id);
            }
        }

        // Generate bottom chord members
        for (let i = 0; i < panels; i++) {
            addMember({
                id: `M${memberId++}`,
                startNodeId: bottomNodes[i],
                endNodeId: bottomNodes[i + 1]
            });
        }

        // Generate top chord members
        if (trussType === 'warren') {
            for (let i = 0; i < panels - 1; i++) {
                addMember({
                    id: `M${memberId++}`,
                    startNodeId: topNodes[i],
                    endNodeId: topNodes[i + 1]
                });
            }
        } else {
            for (let i = 0; i < panels; i++) {
                addMember({
                    id: `M${memberId++}`,
                    startNodeId: topNodes[i],
                    endNodeId: topNodes[i + 1]
                });
            }
        }

        // Generate web members based on truss type
        if (trussType === 'warren') {
            // Warren diagonals
            for (let i = 0; i < panels; i++) {
                addMember({
                    id: `M${memberId++}`,
                    startNodeId: bottomNodes[i],
                    endNodeId: topNodes[i]
                });
                addMember({
                    id: `M${memberId++}`,
                    startNodeId: topNodes[i],
                    endNodeId: bottomNodes[i + 1]
                });
            }
        } else if (trussType === 'pratt') {
            // Pratt: verticals + diagonals toward center
            for (let i = 0; i <= panels; i++) {
                addMember({
                    id: `M${memberId++}`,
                    startNodeId: bottomNodes[i],
                    endNodeId: topNodes[i]
                });
            }
            for (let i = 0; i < panels / 2; i++) {
                addMember({
                    id: `M${memberId++}`,
                    startNodeId: topNodes[i],
                    endNodeId: bottomNodes[i + 1]
                });
            }
            for (let i = panels / 2; i < panels; i++) {
                addMember({
                    id: `M${memberId++}`,
                    startNodeId: bottomNodes[i],
                    endNodeId: topNodes[i + 1]
                });
            }
        } else if (trussType === 'howe') {
            // Howe: verticals + diagonals away from center
            for (let i = 0; i <= panels; i++) {
                addMember({
                    id: `M${memberId++}`,
                    startNodeId: bottomNodes[i],
                    endNodeId: topNodes[i]
                });
            }
            for (let i = 0; i < panels / 2; i++) {
                addMember({
                    id: `M${memberId++}`,
                    startNodeId: bottomNodes[i],
                    endNodeId: topNodes[i + 1]
                });
            }
            for (let i = panels / 2; i < panels; i++) {
                addMember({
                    id: `M${memberId++}`,
                    startNodeId: topNodes[i],
                    endNodeId: bottomNodes[i + 1]
                });
            }
        }

        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-[400px] shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
                    <div className="flex items-center gap-2">
                        <Triangle className="w-5 h-5 text-blue-400" />
                        <h2 className="text-lg font-semibold text-white">Truss Generator</h2>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">
                    {/* Truss Type */}
                    <div>
                        <label className="block text-sm text-zinc-400 mb-2">Truss Type</label>
                        <div className="grid grid-cols-4 gap-2">
                            {(['warren', 'pratt', 'howe', 'k-truss'] as TrussType[]).map(type => (
                                <button
                                    key={type}
                                    onClick={() => setTrussType(type)}
                                    className={`px-3 py-2 rounded text-sm capitalize
                    ${trussType === type
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Dimensions */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Span (m)</label>
                            <input
                                type="number"
                                value={span}
                                onChange={(e) => setSpan(Number(e.target.value))}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Height (m)</label>
                            <input
                                type="number"
                                value={height}
                                onChange={(e) => setHeight(Number(e.target.value))}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Panels</label>
                            <input
                                type="number"
                                value={panels}
                                onChange={(e) => setPanels(Number(e.target.value))}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                            />
                        </div>
                    </div>

                    {/* Preview Info */}
                    <div className="bg-zinc-800/50 rounded p-3 text-sm">
                        <div className="text-zinc-400">
                            Estimated: <span className="text-white">{panels + 1 + (trussType === 'warren' ? panels : panels + 1)}</span> nodes,
                            <span className="text-white ml-1">{panels * 3 + (trussType === 'warren' ? panels - 1 : panels)}</span> members
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-700">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-zinc-400 hover:text-white"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleGenerate}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
                    >
                        Generate
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// ARCH GENERATOR DIALOG
// ============================================

export const ArchGeneratorDialog: FC<DialogProps> = ({ isOpen, onClose }) => {
    const [archType, setArchType] = useState<ArchType>('parabolic');
    const [span, setSpan] = useState(60);
    const [rise, setRise] = useState(15);
    const [segments, setSegments] = useState(12);
    const [includeHangers, setIncludeHangers] = useState(true);

    const { addNode, addMember, clearModel } = useModelStore();

    const handleGenerate = () => {
        clearModel();

        let nodeId = 1;
        let memberId = 1;
        const halfSpan = span / 2;

        // Generate arch nodes
        const archNodes: string[] = [];
        for (let i = 0; i <= segments; i++) {
            const x = -halfSpan + i * (span / segments);
            let y;

            if (archType === 'parabolic') {
                // Parabola: y = 4h(x/L)(1 - x/L)
                const normalizedX = (x + halfSpan) / span;
                y = 4 * rise * normalizedX * (1 - normalizedX);
            } else if (archType === 'circular') {
                // Circular: y = sqrt(R² - x²) - (R - h)
                const R = (span * span / 4 + rise * rise) / (2 * rise);
                y = Math.sqrt(R * R - x * x) - (R - rise);
            } else {
                // Catenary approximation
                const a = span / (2 * Math.acosh(1 + rise / span));
                y = a * (Math.cosh(x / a) - 1);
            }

            const id = `N${nodeId++}`;
            addNode({ id, x, y, z: 0 });
            archNodes.push(id);
        }

        // Generate arch members
        for (let i = 0; i < segments; i++) {
            addMember({
                id: `M${memberId++}`,
                startNodeId: archNodes[i],
                endNodeId: archNodes[i + 1]
            });
        }

        // Generate deck and hangers if enabled
        if (includeHangers) {
            const deckY = rise + 5;
            const deckNodes: string[] = [];

            for (let i = 0; i <= segments; i++) {
                const x = -halfSpan + i * (span / segments);
                const id = `N${nodeId++}`;
                addNode({ id, x, y: deckY, z: 0 });
                deckNodes.push(id);

                // Hanger from deck to arch
                addMember({
                    id: `M${memberId++}`,
                    startNodeId: id,
                    endNodeId: archNodes[i]
                });
            }

            // Deck members
            for (let i = 0; i < segments; i++) {
                addMember({
                    id: `M${memberId++}`,
                    startNodeId: deckNodes[i],
                    endNodeId: deckNodes[i + 1]
                });
            }
        }

        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-[400px] shadow-2xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
                    <div className="flex items-center gap-2">
                        <Spline className="w-5 h-5 text-blue-400" />
                        <h2 className="text-lg font-semibold text-white">Arch Generator</h2>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm text-zinc-400 mb-2">Arch Type</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['parabolic', 'circular', 'catenary'] as ArchType[]).map(type => (
                                <button
                                    key={type}
                                    onClick={() => setArchType(type)}
                                    className={`px-3 py-2 rounded text-sm capitalize
                    ${archType === type
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Span (m)</label>
                            <input
                                type="number"
                                value={span}
                                onChange={(e) => setSpan(Number(e.target.value))}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Rise (m)</label>
                            <input
                                type="number"
                                value={rise}
                                onChange={(e) => setRise(Number(e.target.value))}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Segments</label>
                            <input
                                type="number"
                                value={segments}
                                onChange={(e) => setSegments(Number(e.target.value))}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                            />
                        </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={includeHangers}
                            onChange={(e) => setIncludeHangers(e.target.checked)}
                            className="w-4 h-4 rounded bg-zinc-800 border-zinc-600"
                        />
                        <span className="text-sm text-zinc-300">Include deck with hangers</span>
                    </label>
                </div>

                <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-700">
                    <button onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white">
                        Cancel
                    </button>
                    <button
                        onClick={handleGenerate}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
                    >
                        Generate
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// FRAME GENERATOR DIALOG
// ============================================

export const FrameGeneratorDialog: FC<DialogProps> = ({ isOpen, onClose }) => {
    const [frameType, setFrameType] = useState<'portal' | 'multi-story'>('portal');
    const [bayWidth, setBayWidth] = useState(6);
    const [storyHeight, setStoryHeight] = useState(3.5);
    const [bays, setBays] = useState(3);
    const [stories, setStories] = useState(4);

    const { addNode, addMember, clearModel } = useModelStore();

    const handleGenerate = () => {
        clearModel();

        let nodeId = 1;
        let memberId = 1;
        const totalStories = frameType === 'portal' ? 1 : stories;

        // Create nodes grid
        const nodeGrid: string[][] = [];
        for (let floor = 0; floor <= totalStories; floor++) {
            const floorNodes: string[] = [];
            for (let bay = 0; bay <= bays; bay++) {
                const id = `N${nodeId++}`;
                addNode({
                    id,
                    x: bay * bayWidth,
                    y: floor * storyHeight,
                    z: 0
                });
                floorNodes.push(id);
            }
            nodeGrid.push(floorNodes);
        }

        // Create columns
        for (let bay = 0; bay <= bays; bay++) {
            for (let floor = 0; floor < totalStories; floor++) {
                addMember({
                    id: `M${memberId++}`,
                    startNodeId: nodeGrid[floor][bay],
                    endNodeId: nodeGrid[floor + 1][bay]
                });
            }
        }

        // Create beams
        for (let floor = 1; floor <= totalStories; floor++) {
            for (let bay = 0; bay < bays; bay++) {
                addMember({
                    id: `M${memberId++}`,
                    startNodeId: nodeGrid[floor][bay],
                    endNodeId: nodeGrid[floor][bay + 1]
                });
            }
        }

        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-[400px] shadow-2xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
                    <div className="flex items-center gap-2">
                        <Building className="w-5 h-5 text-blue-400" />
                        <h2 className="text-lg font-semibold text-white">Frame Generator</h2>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm text-zinc-400 mb-2">Frame Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setFrameType('portal')}
                                className={`px-3 py-2 rounded text-sm
                  ${frameType === 'portal'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                    }`}
                            >
                                Portal Frame
                            </button>
                            <button
                                onClick={() => setFrameType('multi-story')}
                                className={`px-3 py-2 rounded text-sm
                  ${frameType === 'multi-story'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                    }`}
                            >
                                Multi-Story
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Bay Width (m)</label>
                            <input
                                type="number"
                                value={bayWidth}
                                onChange={(e) => setBayWidth(Number(e.target.value))}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Story Height (m)</label>
                            <input
                                type="number"
                                value={storyHeight}
                                onChange={(e) => setStoryHeight(Number(e.target.value))}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Number of Bays</label>
                            <input
                                type="number"
                                value={bays}
                                onChange={(e) => setBays(Number(e.target.value))}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                            />
                        </div>
                        {frameType === 'multi-story' && (
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Number of Stories</label>
                                <input
                                    type="number"
                                    value={stories}
                                    onChange={(e) => setStories(Number(e.target.value))}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                                />
                            </div>
                        )}
                    </div>

                    <div className="bg-zinc-800/50 rounded p-3 text-sm">
                        <div className="text-zinc-400">
                            Estimated: <span className="text-white">{(bays + 1) * (frameType === 'portal' ? 2 : stories + 1)}</span> nodes,
                            <span className="text-white ml-1">{(bays + 1) * (frameType === 'portal' ? 1 : stories) + bays * (frameType === 'portal' ? 1 : stories)}</span> members
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-700">
                    <button onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white">
                        Cancel
                    </button>
                    <button
                        onClick={handleGenerate}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
                    >
                        Generate
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// CABLE PATTERN GENERATOR DIALOG
// ============================================

export const CablePatternDialog: FC<DialogProps> = ({ isOpen, onClose }) => {
    const [arrangement, setArrangement] = useState<CableArrangement>('fan');
    const [towerHeight, setTowerHeight] = useState(40);
    const [deckLength, setDeckLength] = useState(100);
    const [cableSpacing, setCableSpacing] = useState(10);

    const { addNode, addMember, clearModel } = useModelStore();

    const handleGenerate = () => {
        clearModel();

        let nodeId = 1;
        let memberId = 1;
        const halfLength = deckLength / 2;
        const numCables = Math.floor(deckLength / cableSpacing);

        // Create tower
        const towerBase = `N${nodeId++}`;
        addNode({ id: towerBase, x: 0, y: 0, z: 0 });

        const towerTop = `N${nodeId++}`;
        addNode({ id: towerTop, x: 0, y: towerHeight, z: 0 });

        addMember({
            id: `M${memberId++}`,
            startNodeId: towerBase,
            endNodeId: towerTop
        });

        // Create deck nodes
        const deckNodes: string[] = [];
        for (let i = 0; i <= numCables; i++) {
            const x = -halfLength + i * cableSpacing;
            const id = `N${nodeId++}`;
            addNode({ id, x, y: 0, z: 0 });
            deckNodes.push(id);
        }

        // Deck members
        for (let i = 0; i < deckNodes.length - 1; i++) {
            addMember({
                id: `M${memberId++}`,
                startNodeId: deckNodes[i],
                endNodeId: deckNodes[i + 1]
            });
        }

        // Create cables based on arrangement
        if (arrangement === 'fan') {
            // Fan: all cables from single point at tower top
            deckNodes.forEach((deckNode, i) => {
                if (i !== Math.floor(deckNodes.length / 2)) {  // Skip node at tower
                    addMember({
                        id: `M${memberId++}`,
                        startNodeId: towerTop,
                        endNodeId: deckNode
                    });
                }
            });
        } else if (arrangement === 'harp') {
            // Harp: parallel cables from distributed points on tower
            deckNodes.forEach((deckNode, i) => {
                if (i !== Math.floor(deckNodes.length / 2)) {
                    const relativePos = (i - deckNodes.length / 2) / (deckNodes.length / 2);
                    const anchorY = towerHeight * (0.3 + 0.7 * Math.abs(relativePos));
                    const anchorId = `N${nodeId++}`;
                    addNode({ id: anchorId, x: 0, y: anchorY, z: 0 });
                    addMember({
                        id: `M${memberId++}`,
                        startNodeId: anchorId,
                        endNodeId: deckNode
                    });
                }
            });
        } else {
            // Semi-harp: combination
            deckNodes.forEach((deckNode, i) => {
                if (i !== Math.floor(deckNodes.length / 2)) {
                    const relativePos = (i - deckNodes.length / 2) / (deckNodes.length / 2);
                    const anchorY = towerHeight * (0.6 + 0.4 * Math.abs(relativePos));
                    const anchorId = `N${nodeId++}`;
                    addNode({ id: anchorId, x: 0, y: anchorY, z: 0 });
                    addMember({
                        id: `M${memberId++}`,
                        startNodeId: anchorId,
                        endNodeId: deckNode
                    });
                }
            });
        }

        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-[400px] shadow-2xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
                    <div className="flex items-center gap-2">
                        <Cable className="w-5 h-5 text-blue-400" />
                        <h2 className="text-lg font-semibold text-white">Cable Pattern Generator</h2>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm text-zinc-400 mb-2">Cable Arrangement</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['fan', 'harp', 'semi-harp'] as CableArrangement[]).map(type => (
                                <button
                                    key={type}
                                    onClick={() => setArrangement(type)}
                                    className={`px-3 py-2 rounded text-sm capitalize
                    ${arrangement === type
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Tower Height (m)</label>
                            <input
                                type="number"
                                value={towerHeight}
                                onChange={(e) => setTowerHeight(Number(e.target.value))}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Deck Length (m)</label>
                            <input
                                type="number"
                                value={deckLength}
                                onChange={(e) => setDeckLength(Number(e.target.value))}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-zinc-400 mb-1">Cable Spacing (m)</label>
                        <input
                            type="number"
                            value={cableSpacing}
                            onChange={(e) => setCableSpacing(Number(e.target.value))}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-700">
                    <button onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white">
                        Cancel
                    </button>
                    <button
                        onClick={handleGenerate}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
                    >
                        Generate
                    </button>
                </div>
            </div>
        </div>
    );
};

export default {
    TrussGeneratorDialog,
    ArchGeneratorDialog,
    FrameGeneratorDialog,
    CablePatternDialog
};
