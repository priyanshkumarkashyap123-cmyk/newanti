/**
 * GeometryToolsPanel.tsx - Advanced Geometry Manipulation UI
 * 
 * UI for accessing geometry operations:
 * - Coordinate System Toggle
 * - Extrude (Translational Repeat)
 * - Rotate Copy (Circular Repeat)
 * - Mirror
 * - Split Member (Insert Node)
 */

import { FC, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Copy, RotateCcw, FlipHorizontal, Scissors,
    ArrowRight, ArrowUp, ArrowDown, Grid3X3, Circle,
    ChevronDown, Info, Check, Play, Axis3D
} from 'lucide-react';
import { useModelStore, Node, Member } from '../store/model';
import {
    extrudeGeometry,
    rotateCopy,
    mirror,
    degToRad,
    GeometryEngine,
    CoordinateSystem
} from '../core/geometry_engine';

// ============================================
// TYPES
// ============================================

type GeometryTool = 'extrude' | 'rotate' | 'mirror' | 'split' | 'renumber';

interface GeometryToolsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export const GeometryToolsPanel: FC<GeometryToolsPanelProps> = ({ isOpen, onClose }) => {
    // Store
    const nodes = useModelStore((s) => s.nodes);
    const members = useModelStore((s) => s.members);
    const selectedIds = useModelStore((s) => s.selectedIds);
    const addNodes = useModelStore((s) => s.addNodes);
    const addMembers = useModelStore((s) => s.addMembers);
    const splitMemberById = useModelStore((s) => s.splitMemberById);

    // State
    const [activeTool, setActiveTool] = useState<GeometryTool>('extrude');
    const [coordSystem, setCoordSystem] = useState<CoordinateSystem>('cartesian');

    // Extrude params
    const [extrudeAxis, setExtrudeAxis] = useState<'x' | 'y' | 'z'>('z');
    const [extrudeSpacing, setExtrudeSpacing] = useState(3);
    const [extrudeSteps, setExtrudeSteps] = useState(3);
    const [linkSteps, setLinkSteps] = useState(true);

    // Rotate params
    const [rotateAxis, setRotateAxis] = useState<'x' | 'y' | 'z'>('z');
    const [rotateAngle, setRotateAngle] = useState(30);
    const [rotateSteps, setRotateSteps] = useState(6);
    const [rotateCenterX, setRotateCenterX] = useState(0);
    const [rotateCenterY, setRotateCenterY] = useState(0);
    const [rotateCenterZ, setRotateCenterZ] = useState(0);

    // Mirror params
    const [mirrorPlane, setMirrorPlane] = useState<'XY' | 'YZ' | 'XZ'>('YZ');

    // Split params
    const [splitRatio, setSplitRatio] = useState(0.5);

    // Renumber params
    const [renumberType, setRenumberType] = useState<'nodes' | 'members' | 'both'>('both');

    // Get selected nodes and members
    const { selectedNodes, selectedMembers } = useMemo(() => {
        const sNodes: Node[] = [];
        const sMembers: Member[] = [];

        selectedIds.forEach(id => {
            const node = nodes.get(id);
            if (node) sNodes.push(node);
            const member = members.get(id);
            if (member) sMembers.push(member);
        });

        return { selectedNodes: sNodes, selectedMembers: sMembers };
    }, [selectedIds, nodes, members]);

    // Tool config
    const TOOLS = [
        { id: 'extrude' as GeometryTool, name: 'Extrude', icon: Copy, description: 'Repeat along axis' },
        { id: 'rotate' as GeometryTool, name: 'Rotate Copy', icon: RotateCcw, description: 'Copy around axis' },
        { id: 'mirror' as GeometryTool, name: 'Mirror', icon: FlipHorizontal, description: 'Reflect across plane' },
        { id: 'split' as GeometryTool, name: 'Split Member', icon: Scissors, description: 'Insert node' },
        { id: 'renumber' as GeometryTool, name: 'Renumber', icon: Grid3X3, description: 'Sort IDs' },
    ];

    // Execute the current operation
    const handleExecute = () => {
        if (selectedNodes.length === 0 && selectedMembers.length === 0 && activeTool !== 'split') {
            alert('Please select nodes or members first');
            return;
        }

        switch (activeTool) {
            case 'extrude': {
                const axis = {
                    x: extrudeAxis === 'x' ? 1 : 0,
                    y: extrudeAxis === 'y' ? 1 : 0,
                    z: extrudeAxis === 'z' ? 1 : 0
                };
                const result = extrudeGeometry(
                    selectedNodes,
                    selectedMembers,
                    axis,
                    extrudeSpacing,
                    extrudeSteps,
                    linkSteps
                );
                addNodes(result.nodes);
                addMembers(result.members);
                break;
            }
            case 'rotate': {
                const axis = {
                    x: rotateAxis === 'x' ? 1 : 0,
                    y: rotateAxis === 'y' ? 1 : 0,
                    z: rotateAxis === 'z' ? 1 : 0
                };
                const center = { x: rotateCenterX, y: rotateCenterY, z: rotateCenterZ };
                const result = rotateCopy(
                    selectedNodes,
                    selectedMembers,
                    axis,
                    center,
                    degToRad(rotateAngle),
                    rotateSteps
                );
                addNodes(result.nodes);
                addMembers(result.members);
                break;
            }
            case 'mirror': {
                const result = mirror(selectedNodes, selectedMembers, mirrorPlane);
                addNodes(result.nodes);
                addMembers(result.members);
                break;
            }
            case 'split': {
                if (selectedMembers.length !== 1) {
                    alert('Select exactly one member to split');
                    return;
                }
                splitMemberById(selectedMembers[0].id, splitRatio);
                break;
            }
            case 'renumber': {
                if (renumberType === 'nodes' || renumberType === 'both') {
                    useModelStore.getState().renumberNodes();
                }
                if (renumberType === 'members' || renumberType === 'both') {
                    useModelStore.getState().renumberMembers();
                }
                break;
            }
        }

        onClose();
    };

    if (!isOpen) return null;

    const ActiveIcon = TOOLS.find(t => t.id === activeTool)?.icon || Copy;

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
                    className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl"
                >
                    {/* Header */}
                    <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
                                <Axis3D className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Geometry Tools</h2>
                                <p className="text-sm text-zinc-400">Advanced manipulation operations</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Coordinate System Toggle */}
                        <div className="mb-6 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Grid3X3 className="w-4 h-4 text-zinc-400" />
                                    <span className="text-sm text-zinc-300">Coordinate System</span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCoordSystem('cartesian')}
                                        className={`px-3 py-1.5 text-sm rounded-lg transition-all ${coordSystem === 'cartesian'
                                            ? 'bg-violet-600 text-white'
                                            : 'bg-zinc-700 text-zinc-400 hover:text-white'
                                            }`}
                                    >
                                        Cartesian (X,Y,Z)
                                    </button>
                                    <button
                                        onClick={() => setCoordSystem('cylindrical')}
                                        className={`px-3 py-1.5 text-sm rounded-lg transition-all ${coordSystem === 'cylindrical'
                                            ? 'bg-violet-600 text-white'
                                            : 'bg-zinc-700 text-zinc-400 hover:text-white'
                                            }`}
                                    >
                                        Cylindrical (R,θ,Z)
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Tool Selection */}
                        <div className="grid grid-cols-4 gap-2 mb-6">
                            {TOOLS.map((tool) => {
                                const Icon = tool.icon;
                                return (
                                    <button
                                        key={tool.id}
                                        onClick={() => setActiveTool(tool.id)}
                                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${activeTool === tool.id
                                            ? 'border-violet-500 bg-violet-500/10'
                                            : 'border-zinc-700 hover:border-zinc-600'
                                            }`}
                                    >
                                        <Icon className={`w-6 h-6 ${activeTool === tool.id ? 'text-violet-400' : 'text-zinc-400'}`} />
                                        <span className="text-xs text-zinc-300">{tool.name}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Selection Info */}
                        <div className="mb-6 p-3 bg-zinc-800/30 rounded-lg flex items-center justify-between">
                            <span className="text-sm text-zinc-400">Selection</span>
                            <span className="text-sm text-white">
                                {selectedNodes.length} nodes, {selectedMembers.length} members
                            </span>
                        </div>

                        {/* Tool Parameters */}
                        <div className="space-y-4">
                            {activeTool === 'extrude' && (
                                <>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-sm text-zinc-400 block mb-2">Axis</label>
                                            <div className="flex gap-2">
                                                {(['x', 'y', 'z'] as const).map(axis => (
                                                    <button
                                                        key={axis}
                                                        onClick={() => setExtrudeAxis(axis)}
                                                        className={`flex-1 py-2 rounded-lg text-sm font-medium ${extrudeAxis === axis
                                                            ? 'bg-violet-600 text-white'
                                                            : 'bg-zinc-700 text-zinc-400'
                                                            }`}
                                                    >
                                                        {axis.toUpperCase()}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-sm text-zinc-400 block mb-2">Spacing (m)</label>
                                            <input
                                                type="number"
                                                value={extrudeSpacing}
                                                onChange={(e) => setExtrudeSpacing(parseFloat(e.target.value) || 3)}
                                                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-zinc-400 block mb-2">Steps</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={extrudeSteps}
                                                onChange={(e) => setExtrudeSteps(parseInt(e.target.value) || 3)}
                                                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                            />
                                        </div>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={linkSteps}
                                            onChange={(e) => setLinkSteps(e.target.checked)}
                                            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-violet-600"
                                        />
                                        <span className="text-sm text-zinc-300">Link steps with members</span>
                                    </label>
                                </>
                            )}

                            {activeTool === 'rotate' && (
                                <>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-sm text-zinc-400 block mb-2">Rotation Axis</label>
                                            <div className="flex gap-2">
                                                {(['x', 'y', 'z'] as const).map(axis => (
                                                    <button
                                                        key={axis}
                                                        onClick={() => setRotateAxis(axis)}
                                                        className={`flex-1 py-2 rounded-lg text-sm font-medium ${rotateAxis === axis
                                                            ? 'bg-violet-600 text-white'
                                                            : 'bg-zinc-700 text-zinc-400'
                                                            }`}
                                                    >
                                                        {axis.toUpperCase()}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-sm text-zinc-400 block mb-2">Angle (°)</label>
                                            <input
                                                type="number"
                                                value={rotateAngle}
                                                onChange={(e) => setRotateAngle(parseFloat(e.target.value) || 30)}
                                                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-zinc-400 block mb-2">Copies</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={rotateSteps}
                                                onChange={(e) => setRotateSteps(parseInt(e.target.value) || 6)}
                                                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm text-zinc-400 block mb-2">Center Point</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <input
                                                type="number"
                                                placeholder="X"
                                                value={rotateCenterX}
                                                onChange={(e) => setRotateCenterX(parseFloat(e.target.value) || 0)}
                                                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                            />
                                            <input
                                                type="number"
                                                placeholder="Y"
                                                value={rotateCenterY}
                                                onChange={(e) => setRotateCenterY(parseFloat(e.target.value) || 0)}
                                                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                            />
                                            <input
                                                type="number"
                                                placeholder="Z"
                                                value={rotateCenterZ}
                                                onChange={(e) => setRotateCenterZ(parseFloat(e.target.value) || 0)}
                                                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {activeTool === 'mirror' && (
                                <div>
                                    <label className="text-sm text-zinc-400 block mb-2">Mirror Plane</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['XY', 'YZ', 'XZ'] as const).map(plane => (
                                            <button
                                                key={plane}
                                                onClick={() => setMirrorPlane(plane)}
                                                className={`py-3 rounded-lg text-sm font-medium transition-all ${mirrorPlane === plane
                                                    ? 'bg-violet-600 text-white'
                                                    : 'bg-zinc-700 text-zinc-400 hover:text-white'
                                                    }`}
                                            >
                                                {plane} Plane
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-zinc-400 mt-2">
                                        {mirrorPlane === 'XY' && 'Mirror across XY plane (flip Z)'}
                                        {mirrorPlane === 'YZ' && 'Mirror across YZ plane (flip X)'}
                                        {mirrorPlane === 'XZ' && 'Mirror across XZ plane (flip Y)'}
                                    </p>
                                </div>
                            )}

                            {activeTool === 'split' && (
                                <div>
                                    <label className="text-sm text-zinc-400 block mb-2">
                                        Split Position ({(splitRatio * 100).toFixed(0)}% from start)
                                    </label>
                                    <input
                                        type="range"
                                        min="0.1"
                                        max="0.9"
                                        step="0.1"
                                        value={splitRatio}
                                        onChange={(e) => setSplitRatio(parseFloat(e.target.value))}
                                        className="w-full"
                                    />
                                    <div className="flex justify-between text-xs text-zinc-400 mt-1">
                                        <span>Start</span>
                                        <span>Mid</span>
                                        <span>End</span>
                                    </div>
                                    {selectedMembers.length !== 1 && (
                                        <p className="text-amber-400 text-sm mt-2">
                                            ⚠️ Select exactly one member to split
                                        </p>
                                    )}
                                </div>
                            )}

                            {activeTool === 'renumber' && (
                                <div>
                                    <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 mb-4">
                                        <p className="text-sm text-zinc-300">
                                            Renumbering will sort entities spatially (Y → Z → X) and reassign IDs sequentially (N1, N2... M1, M2...).
                                        </p>
                                    </div>
                                    <label className="text-sm text-zinc-400 block mb-2">Renumber What?</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['nodes', 'members', 'both'] as const).map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setRenumberType(type)}
                                                className={`py-3 rounded-lg text-sm font-medium transition-all ${renumberType === type
                                                    ? 'bg-violet-600 text-white'
                                                    : 'bg-zinc-700 text-zinc-400 hover:text-white'
                                                    }`}
                                            >
                                                {type.charAt(0).toUpperCase() + type.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="sticky bottom-0 px-6 py-4 border-t border-zinc-800 bg-zinc-900 flex justify-between">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-zinc-400 hover:text-white"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleExecute}
                            className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg flex items-center gap-2"
                        >
                            <Play className="w-4 h-4" />
                            Execute
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default GeometryToolsPanel;
