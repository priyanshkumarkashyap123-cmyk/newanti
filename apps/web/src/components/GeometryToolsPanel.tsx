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
import {
    Copy, RotateCcw, FlipHorizontal, Scissors,
    ArrowRight, ArrowUp, ArrowDown, Grid3X3, Circle,
    ChevronDown, Info, Check, Play, Axis3D
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
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

    const ActiveIcon = TOOLS.find(t => t.id === activeTool)?.icon || Copy;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
                            <Axis3D className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold">Geometry Tools</DialogTitle>
                            <DialogDescription>Advanced manipulation operations</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Content */}
                <div className="py-2">
                    {/* Coordinate System Toggle */}
                    <div className="mb-6 p-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Grid3X3 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                <span className="text-sm text-slate-600 dark:text-slate-300">Coordinate System</span>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant={coordSystem === 'cartesian' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setCoordSystem('cartesian')}
                                    className={coordSystem === 'cartesian' ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}
                                >
                                    Cartesian (X,Y,Z)
                                </Button>
                                <Button
                                    variant={coordSystem === 'cylindrical' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setCoordSystem('cylindrical')}
                                    className={coordSystem === 'cylindrical' ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}
                                >
                                    Cylindrical (R,θ,Z)
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Tool Selection */}
                    <div className="grid grid-cols-4 gap-2 mb-6">
                        {TOOLS.map((tool) => {
                            const Icon = tool.icon;
                            return (
                                <button type="button"
                                    key={tool.id}
                                    onClick={() => setActiveTool(tool.id)}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${activeTool === tool.id
                                        ? 'border-violet-500 bg-violet-500/10'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                        }`}
                                >
                                    <Icon className={`w-6 h-6 ${activeTool === tool.id ? 'text-violet-400' : 'text-slate-500 dark:text-slate-400'}`} />
                                    <span className="text-xs text-slate-600 dark:text-slate-300">{tool.name}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Selection Info */}
                    <div className="mb-6 p-3 bg-slate-100/30 dark:bg-slate-800/30 rounded-lg flex items-center justify-between">
                        <span className="text-sm text-slate-500 dark:text-slate-400">Selection</span>
                        <span className="text-sm text-slate-900 dark:text-white">
                            {selectedNodes.length} nodes, {selectedMembers.length} members
                        </span>
                    </div>

                    {/* Tool Parameters */}
                    <div className="space-y-4">
                        {activeTool === 'extrude' && (
                            <>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label className="text-sm text-slate-500 dark:text-slate-400 block mb-2">Axis</Label>
                                        <div className="flex gap-2">
                                            {(['x', 'y', 'z'] as const).map(axis => (
                                                <Button
                                                    key={axis}
                                                    variant={extrudeAxis === axis ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setExtrudeAxis(axis)}
                                                    className={`flex-1 ${extrudeAxis === axis ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}`}
                                                >
                                                    {axis.toUpperCase()}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-sm text-slate-500 dark:text-slate-400 block mb-2">Spacing (m)</Label>
                                        <Input
                                            type="number"
                                            value={extrudeSpacing}
                                            onChange={(e) => setExtrudeSpacing(parseFloat(e.target.value) || 3)}
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-sm text-slate-500 dark:text-slate-400 block mb-2">Steps</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            value={extrudeSteps}
                                            onChange={(e) => setExtrudeSteps(parseInt(e.target.value) || 3)}
                                        />
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={linkSteps}
                                        onChange={(e) => setLinkSteps(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-violet-600"
                                    />
                                    <span className="text-sm text-slate-600 dark:text-slate-300">Link steps with members</span>
                                </label>
                            </>
                        )}

                        {activeTool === 'rotate' && (
                            <>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label className="text-sm text-slate-500 dark:text-slate-400 block mb-2">Rotation Axis</Label>
                                        <div className="flex gap-2">
                                            {(['x', 'y', 'z'] as const).map(axis => (
                                                <Button
                                                    key={axis}
                                                    variant={rotateAxis === axis ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setRotateAxis(axis)}
                                                    className={`flex-1 ${rotateAxis === axis ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}`}
                                                >
                                                    {axis.toUpperCase()}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-sm text-slate-500 dark:text-slate-400 block mb-2">Angle (°)</Label>
                                        <Input
                                            type="number"
                                            value={rotateAngle}
                                            onChange={(e) => setRotateAngle(parseFloat(e.target.value) || 30)}
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-sm text-slate-500 dark:text-slate-400 block mb-2">Copies</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            value={rotateSteps}
                                            onChange={(e) => setRotateSteps(parseInt(e.target.value) || 6)}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm text-slate-500 dark:text-slate-400 block mb-2">Center Point</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <Input
                                            type="number"
                                            placeholder="X"
                                            value={rotateCenterX}
                                            onChange={(e) => setRotateCenterX(parseFloat(e.target.value) || 0)}
                                        />
                                        <Input
                                            type="number"
                                            placeholder="Y"
                                            value={rotateCenterY}
                                            onChange={(e) => setRotateCenterY(parseFloat(e.target.value) || 0)}
                                        />
                                        <Input
                                            type="number"
                                            placeholder="Z"
                                            value={rotateCenterZ}
                                            onChange={(e) => setRotateCenterZ(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {activeTool === 'mirror' && (
                            <div>
                                <Label className="text-sm text-slate-500 dark:text-slate-400 block mb-2">Mirror Plane</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['XY', 'YZ', 'XZ'] as const).map(plane => (
                                        <Button
                                            key={plane}
                                            variant={mirrorPlane === plane ? 'default' : 'outline'}
                                            onClick={() => setMirrorPlane(plane)}
                                            className={`py-3 ${mirrorPlane === plane ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}`}
                                        >
                                            {plane} Plane
                                        </Button>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                    {mirrorPlane === 'XY' && 'Mirror across XY plane (flip Z)'}
                                    {mirrorPlane === 'YZ' && 'Mirror across YZ plane (flip X)'}
                                    {mirrorPlane === 'XZ' && 'Mirror across XZ plane (flip Y)'}
                                </p>
                            </div>
                        )}

                        {activeTool === 'split' && (
                            <div>
                                <Label className="text-sm text-slate-500 dark:text-slate-400 block mb-2">
                                    Split Position ({(splitRatio * 100).toFixed(0)}% from start)
                                </Label>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="0.9"
                                    step="0.1"
                                    value={splitRatio}
                                    onChange={(e) => setSplitRatio(parseFloat(e.target.value))}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
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
                                <div className="p-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                        Renumbering will sort entities spatially (Y → Z → X) and reassign IDs sequentially (N1, N2... M1, M2...).
                                    </p>
                                </div>
                                <Label className="text-sm text-slate-500 dark:text-slate-400 block mb-2">Renumber What?</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['nodes', 'members', 'both'] as const).map(type => (
                                        <Button
                                            key={type}
                                            variant={renumberType === type ? 'default' : 'outline'}
                                            onClick={() => setRenumberType(type)}
                                            className={`py-3 ${renumberType === type ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}`}
                                        >
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="flex justify-between sm:justify-between">
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleExecute} className="bg-violet-600 hover:bg-violet-700 text-white">
                        <Play className="w-4 h-4 mr-2" />
                        Execute
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default GeometryToolsPanel;
