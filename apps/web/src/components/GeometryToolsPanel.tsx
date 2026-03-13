/**
 * GeometryToolsPanel.tsx - Advanced Geometry Manipulation UI
 *
 * Tools available:
 * - Extrude (Translational Repeat)
 * - Rotate Copy (Circular Repeat)
 * - Mirror (reflect across XY/YZ/XZ plane)
 * - Split Member (insert node at ratio)
 * - Divide Member (split into N equal segments)
 * - Align Nodes (align selected nodes to min/max/avg on axis)
 * - Move (translate selection by Δx, Δy, Δz)
 * - Renumber (reassign IDs spatially)
 * - Auto-Node (detect & split member intersections)
 */

import { FC, useEffect, useState, useMemo, useCallback } from 'react';
import {
    Copy, RotateCcw, FlipHorizontal, Scissors,
    Grid3X3, Play, Axis3D, SplitSquareVertical, History,
    AlignCenter, ArrowDownUp, MoveRight, Undo2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useModelStore, Node, Member } from '../store/model';
import { useUIStore } from '../store/uiStore';
import {
    mirror,
    GeometryEngine,
} from '../core/geometry_engine';

// ============================================
// TYPES
// ============================================

type GeometryTool = 'extrude' | 'rotate' | 'mirror' | 'split' | 'divide' | 'align' | 'move' | 'renumber';

interface OperationLogItem {
    id: string;
    tool: GeometryTool | 'auto-node';
    summary: string;
    detail: string;
    timestamp: number;
}

interface GeometryToolsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

// Persist log across sessions (key per browser tab — session-lived)
const LOG_STORAGE_KEY = 'beamlab-geometry-op-log';

const loadPersistedLog = (): OperationLogItem[] => {
    try {
        const raw = sessionStorage.getItem(LOG_STORAGE_KEY);
        return raw ? (JSON.parse(raw) as OperationLogItem[]) : [];
    } catch {
        return [];
    }
};

const persistLog = (log: OperationLogItem[]) => {
    try {
        sessionStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(log.slice(0, 20)));
    } catch {
        // sessionStorage quota exceeded — silently ignore
    }
};

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
    const addNode = useModelStore((s) => s.addNode);
    const addMember = useModelStore((s) => s.addMember);
    const updateNodes = useModelStore((s) => s.updateNodes);
    const splitMemberById = useModelStore((s) => s.splitMemberById);
    const applyTranslationalRepeat = useModelStore((s) => s.applyTranslationalRepeat);
    const applyCircularRepeat = useModelStore((s) => s.applyCircularRepeat);
    const detectAndAutoNode = useModelStore((s) => s.detectAndAutoNode);
    const geometryToolPreset = useUIStore((s) => s.geometryToolPreset);
    const setGeometryToolPreset = useUIStore((s) => s.setGeometryToolPreset);
    const showNotification = useUIStore((s) => s.showNotification);

    // State
    const [activeTool, setActiveTool] = useState<GeometryTool | 'auto-node'>('extrude');
    const [coordSystem, setCoordSystem] = useState<'cartesian' | 'cylindrical'>('cartesian');
    const [operationLog, setOperationLog] = useState<OperationLogItem[]>(loadPersistedLog);

    // Extrude params
    const [extrudeAxis, setExtrudeAxis] = useState<'x' | 'y' | 'z'>('z');
    const [extrudeSpacing, setExtrudeSpacing] = useState(3);
    const [extrudeSteps, setExtrudeSteps] = useState(3);
    const [linkSteps, setLinkSteps] = useState(true);

    // Rotate params
    const [rotateAxis, setRotateAxis] = useState<'x' | 'y' | 'z'>('z');
    const [rotateAngle, setRotateAngle] = useState(30);
    const [rotateSteps, setRotateSteps] = useState(6);
    const [rotateLinkSteps, setRotateLinkSteps] = useState(false);
    const [rotateCloseLoop, setRotateCloseLoop] = useState(false);
    const [rotateCenterX, setRotateCenterX] = useState(0);
    const [rotateCenterY, setRotateCenterY] = useState(0);
    const [rotateCenterZ, setRotateCenterZ] = useState(0);

    // Mirror params
    const [mirrorPlane, setMirrorPlane] = useState<'XY' | 'YZ' | 'XZ'>('YZ');

    // Split params
    const [splitRatio, setSplitRatio] = useState(0.5);

    // Divide params — N equal segments
    const [divideSegments, setDivideSegments] = useState(2);

    // Align params
    const [alignAxis, setAlignAxis] = useState<'x' | 'y' | 'z'>('y');
    const [alignTarget, setAlignTarget] = useState<'min' | 'max' | 'avg'>('avg');

    // Move (translate) params
    const [moveDx, setMoveDx] = useState(0);
    const [moveDy, setMoveDy] = useState(0);
    const [moveDz, setMoveDz] = useState(0);
    const [moveCopy, setMoveCopy] = useState(false);

    // Auto-node params
    const [autoNodeTolerance, setAutoNodeTolerance] = useState(0.01);

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

    const getOperationNodes = (): Node[] => {
        const nodeMap = new Map<string, Node>();
        selectedNodes.forEach((node) => nodeMap.set(node.id, node));

        selectedMembers.forEach((member) => {
            const start = nodes.get(member.startNodeId);
            const end = nodes.get(member.endNodeId);
            if (start) nodeMap.set(start.id, start);
            if (end) nodeMap.set(end.id, end);
        });

        return Array.from(nodeMap.values());
    };

    // Tool config — 9 tools total for full STAAD parity
    const TOOLS = [
        { id: 'extrude' as GeometryTool,   name: 'Extrude',    icon: Copy,             description: 'Repeat along axis' },
        { id: 'rotate' as GeometryTool,    name: 'Rotate Copy',icon: RotateCcw,        description: 'Copy around axis' },
        { id: 'mirror' as GeometryTool,    name: 'Mirror',     icon: FlipHorizontal,   description: 'Reflect across plane' },
        { id: 'split' as GeometryTool,     name: 'Split',      icon: Scissors,         description: 'Insert node at ratio' },
        { id: 'divide' as GeometryTool,    name: 'Divide',     icon: ArrowDownUp,      description: 'Split into N segments' },
        { id: 'align' as GeometryTool,     name: 'Align',      icon: AlignCenter,      description: 'Align nodes to axis' },
        { id: 'move' as GeometryTool,      name: 'Move',       icon: MoveRight,        description: 'Translate by delta' },
        { id: 'renumber' as GeometryTool,  name: 'Renumber',   icon: Grid3X3,          description: 'Sort IDs spatially' },
        { id: 'auto-node' as const,        name: 'Auto-Node',  icon: SplitSquareVertical, description: 'Detect & split intersections' },
    ];

    const pushLog = useCallback((item: Omit<OperationLogItem, 'id' | 'timestamp'>) => {
        const logItem: OperationLogItem = {
            ...item,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
        };
        setOperationLog((prev) => {
            const next = [logItem, ...prev].slice(0, 20);
            persistLog(next);
            return next;
        });
    }, []);

    const undoLastLog = () => {
        setOperationLog((prev) => {
            const next = prev.slice(1);
            persistLog(next);
            return next;
        });
    };

    useEffect(() => {
        if (!isOpen || !geometryToolPreset) return;

        const presetMap: Record<string, GeometryTool> = {
            extrude: 'extrude',
            rotate: 'rotate',
            mirror: 'mirror',
            split: 'split',
            renumber: 'renumber',
            divide: 'divide',
            align: 'align',
            move: 'move',
        };

        const nextTool = presetMap[geometryToolPreset];
        if (nextTool) {
            setActiveTool(nextTool);
        }
    }, [isOpen, geometryToolPreset]);

    // Execute the current operation
    const operationPreview = useMemo(() => {
        if (activeTool === 'extrude') {
            const baseNodes = getOperationNodes().length;
            const baseMembers = selectedMembers.length;
            return {
                title: 'Translational Repeat',
                line1: `Copies: ${extrudeSteps} step(s) along ${extrudeAxis.toUpperCase()} axis at ${extrudeSpacing} m spacing`,
                line2: `Estimated new nodes: ~${Math.max(0, baseNodes * extrudeSteps)} | members: ~${Math.max(0, baseMembers * extrudeSteps)}`,
            };
        }

        if (activeTool === 'rotate') {
            const baseNodes = getOperationNodes().length;
            const baseMembers = selectedMembers.length;
            return {
                title: 'Circular Repeat',
                line1: `${rotateSteps} copies at ${rotateAngle}° around ${rotateAxis.toUpperCase()} axis`,
                line2: `Estimated new nodes: ~${Math.max(0, baseNodes * rotateSteps)} | members: ~${Math.max(0, baseMembers * rotateSteps)}`,
            };
        }

        if (activeTool === 'mirror') {
            return {
                title: 'Mirror Geometry',
                line1: `Reflect selected entities across ${mirrorPlane} plane`,
                line2: 'Output: mirrored node/member copies (originals preserved)',
            };
        }

        if (activeTool === 'split') {
            return {
                title: 'Split Member',
                line1: `Insert new node at ${(splitRatio * 100).toFixed(0)}% from start node`,
                line2: 'Output: 1 new node + 2 new members, original member removed',
            };
        }

        if (activeTool === 'divide') {
            const segs = Math.max(2, divideSegments);
            return {
                title: 'Divide Member',
                line1: `Split ${selectedMembers.length} selected member(s) into ${segs} equal segments`,
                line2: `Output: ${selectedMembers.length * (segs - 1)} new intermediate nodes, ${selectedMembers.length * segs} new members`,
            };
        }

        if (activeTool === 'align') {
            return {
                title: 'Align Nodes',
                line1: `Align ${selectedNodes.length} selected node(s) to ${alignTarget.toUpperCase()} ${alignAxis.toUpperCase()} coordinate`,
                line2: `All selected nodes will share the same ${alignAxis.toUpperCase()} value`,
            };
        }

        if (activeTool === 'move') {
            const total = getOperationNodes().length;
            return {
                title: moveCopy ? 'Copy & Translate' : 'Move Selection',
                line1: `Δx=${moveDx} m, Δy=${moveDy} m, Δz=${moveDz} m`,
                line2: moveCopy
                    ? `Creates ${total} new node copies at offset position`
                    : `Moves ${total} node(s) to new position`,
            };
        }

        if (activeTool === 'renumber') {
            return {
                title: 'Renumber Entities',
                line1: `Target: ${renumberType}`,
                line2: 'Sorts spatially (Y → Z → X) and reassigns IDs sequentially (N1, N2…, M1, M2…)',
            };
        }

        return {
            title: 'Auto-Node Intersections',
            line1: `Tolerance: ${autoNodeTolerance.toFixed(3)} m`,
            line2: 'Scans all member pairs for intersections and splits them at crossing points',
        };
    }, [activeTool, extrudeSteps, extrudeAxis, extrudeSpacing, rotateSteps, rotateAngle, rotateAxis, mirrorPlane, splitRatio, divideSegments, alignAxis, alignTarget, moveDx, moveDy, moveDz, moveCopy, renumberType, autoNodeTolerance, selectedMembers, selectedNodes]);

    const canExecute = useMemo(() => {
        if (activeTool === 'split')  return selectedMembers.length === 1;
        if (activeTool === 'divide') return selectedMembers.length >= 1;
        if (activeTool === 'align')  return selectedNodes.length >= 2;
        if (activeTool === 'move')   return selectedNodes.length > 0 || selectedMembers.length > 0;
        if (activeTool === 'auto-node') return members.size >= 2;
        if (activeTool === 'renumber')  return nodes.size > 0 || members.size > 0;
        return selectedNodes.length > 0 || selectedMembers.length > 0;
    }, [activeTool, selectedMembers.length, selectedNodes.length, members.size, nodes.size]);

    const handleExecute = () => {
        if (!canExecute) {
            showNotification('warning', 'Current selection/model state is not valid for this operation');
            return;
        }

        switch (activeTool) {
            case 'extrude': {
                const operationNodes = getOperationNodes();
                if (operationNodes.length === 0) {
                    showNotification('warning', 'Please select at least one node or member to extrude');
                    return;
                }

                const axis = {
                    x: extrudeAxis === 'x' ? 1 : 0,
                    y: extrudeAxis === 'y' ? 1 : 0,
                    z: extrudeAxis === 'z' ? 1 : 0
                };
                applyTranslationalRepeat({
                    nodeIds: operationNodes.map((node) => node.id),
                    memberIds: selectedMembers.map((member) => member.id),
                    axis,
                    spacing_m: extrudeSpacing,
                    steps: extrudeSteps,
                    linkSteps
                });
                pushLog({
                    tool: 'extrude',
                    summary: `Extrude · ${extrudeSteps} step(s)`,
                    detail: `Axis ${extrudeAxis.toUpperCase()}, spacing ${extrudeSpacing} m`,
                });
                showNotification('success', `Extruded ${extrudeSteps} step(s) along ${extrudeAxis.toUpperCase()}`);
                break;
            }
            case 'rotate': {
                const operationNodes = getOperationNodes();
                if (operationNodes.length === 0) {
                    showNotification('warning', 'Please select at least one node or member to rotate-copy');
                    return;
                }

                const axis = {
                    x: rotateAxis === 'x' ? 1 : 0,
                    y: rotateAxis === 'y' ? 1 : 0,
                    z: rotateAxis === 'z' ? 1 : 0
                };
                applyCircularRepeat({
                    nodeIds: operationNodes.map((node) => node.id),
                    memberIds: selectedMembers.map((member) => member.id),
                    axis,
                    center_m: { x: rotateCenterX, y: rotateCenterY, z: rotateCenterZ },
                    angleDeg: rotateAngle,
                    steps: rotateSteps,
                    linkSteps: rotateLinkSteps,
                    closeLoop: rotateCloseLoop
                });
                pushLog({
                    tool: 'rotate',
                    summary: `Rotate Copy · ${rotateSteps} copy/copies`,
                    detail: `${rotateAngle}° about ${rotateAxis.toUpperCase()} @ (${rotateCenterX}, ${rotateCenterY}, ${rotateCenterZ})`,
                });
                showNotification('success', `Created ${rotateSteps} rotated copies around ${rotateAxis.toUpperCase()}`);
                break;
            }
            case 'mirror': {
                const result = mirror(selectedNodes, selectedMembers, mirrorPlane);
                addNodes(result.nodes);
                addMembers(result.members);
                showNotification('success', `Mirrored: ${result.nodes.length} nodes and ${result.members.length} members created`);
                pushLog({
                    tool: 'mirror',
                    summary: 'Mirror operation completed',
                    detail: `${mirrorPlane} plane · ${result.members.length} members created`,
                });
                break;
            }
            case 'split': {
                if (selectedMembers.length !== 1) {
                    showNotification('warning', 'Select exactly one member to split');
                    return;
                }
                splitMemberById(selectedMembers[0].id, splitRatio);
                showNotification('success', `Member split at ${(splitRatio * 100).toFixed(0)}%`);
                pushLog({
                    tool: 'split',
                    summary: `Split member ${selectedMembers[0].id}`,
                    detail: `Ratio ${(splitRatio * 100).toFixed(0)}% from start`,
                });
                break;
            }
            case 'divide': {
                // Divide each selected member into N equal segments
                const segs = Math.max(2, divideSegments);
                let totalNewNodes = 0;
                let totalNewMembers = 0;

                selectedMembers.forEach((member) => {
                    const startNode = nodes.get(member.startNodeId);
                    const endNode = nodes.get(member.endNodeId);
                    if (!startNode || !endNode) return;

                    const positions = Array.from({ length: segs - 1 }, (_, i) => (i + 1) / segs);
                    const intermediateIds: string[] = [];

                    positions.forEach((t) => {
                        const id = `N${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                        addNode({
                            id,
                            x: startNode.x + t * (endNode.x - startNode.x),
                            y: startNode.y + t * (endNode.y - startNode.y),
                            z: startNode.z + t * (endNode.z - startNode.z),
                        });
                        intermediateIds.push(id);
                        totalNewNodes++;
                    });

                    const allNodeIds = [member.startNodeId, ...intermediateIds, member.endNodeId];
                    for (let i = 0; i < allNodeIds.length - 1; i++) {
                        addMember({
                            id: `M${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${i}`,
                            startNodeId: allNodeIds[i],
                            endNodeId: allNodeIds[i + 1],
                            E: member.E,
                            A: member.A,
                            I: member.I,
                            Iy: member.Iy,
                            Iz: member.Iz,
                            J: member.J,
                            G: member.G,
                            rho: member.rho,
                            sectionId: member.sectionId,
                            sectionType: member.sectionType,
                            dimensions: member.dimensions,
                            betaAngle: member.betaAngle,
                        });
                        totalNewMembers++;
                    }

                    // Remove original member from store
                    const updated = new Map(useModelStore.getState().members);
                    updated.delete(member.id);
                    useModelStore.setState({ members: updated });
                });

                showNotification('success', `Divided ${selectedMembers.length} member(s) → ${totalNewMembers} segments, ${totalNewNodes} new nodes`);
                pushLog({
                    tool: 'divide',
                    summary: `Divide · ${segs} segments`,
                    detail: `${selectedMembers.length} member(s) → ${totalNewNodes} nodes created`,
                });
                break;
            }
            case 'align': {
                if (selectedNodes.length < 2) {
                    showNotification('warning', 'Select at least 2 nodes to align');
                    return;
                }

                const coords = selectedNodes.map(n => alignAxis === 'x' ? n.x : alignAxis === 'y' ? n.y : n.z);
                let targetValue: number;
                if (alignTarget === 'min') targetValue = Math.min(...coords);
                else if (alignTarget === 'max') targetValue = Math.max(...coords);
                else targetValue = coords.reduce((a, b) => a + b, 0) / coords.length;

                const updates = new Map<string, Partial<Node>>();
                selectedNodes.forEach(n => {
                    updates.set(n.id, { [alignAxis]: targetValue });
                });
                updateNodes(updates);

                showNotification('success', `Aligned ${selectedNodes.length} nodes to ${alignAxis.toUpperCase()} = ${targetValue.toFixed(3)} m`);
                pushLog({
                    tool: 'align',
                    summary: `Align ${selectedNodes.length} nodes`,
                    detail: `${alignAxis.toUpperCase()} → ${alignTarget} = ${targetValue.toFixed(3)} m`,
                });
                break;
            }
            case 'move': {
                const operationNodes = getOperationNodes();
                if (operationNodes.length === 0) {
                    showNotification('warning', 'Select at least one node or member to move');
                    return;
                }

                if (moveCopy) {
                    // Create copies at offset position
                    const newNodeIdMap = new Map<string, string>();
                    operationNodes.forEach(n => {
                        const newId = `N${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                        addNode({ id: newId, x: n.x + moveDx, y: n.y + moveDy, z: n.z + moveDz });
                        newNodeIdMap.set(n.id, newId);
                    });
                    selectedMembers.forEach(m => {
                        const newStart = newNodeIdMap.get(m.startNodeId);
                        const newEnd = newNodeIdMap.get(m.endNodeId);
                        if (newStart && newEnd) {
                            addMember({
                                id: `M${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                startNodeId: newStart,
                                endNodeId: newEnd,
                                E: m.E, A: m.A, I: m.I, Iy: m.Iy, Iz: m.Iz,
                                J: m.J, G: m.G, rho: m.rho,
                                sectionId: m.sectionId, sectionType: m.sectionType,
                                dimensions: m.dimensions, betaAngle: m.betaAngle,
                            });
                        }
                    });
                    showNotification('success', `Copied ${operationNodes.length} nodes offset by (${moveDx}, ${moveDy}, ${moveDz}) m`);
                    pushLog({ tool: 'move', summary: 'Copy & Translate', detail: `Δx=${moveDx}, Δy=${moveDy}, Δz=${moveDz} m · ${operationNodes.length} nodes copied` });
                } else {
                    // Move in place
                    const updates = new Map<string, Partial<Node>>();
                    operationNodes.forEach(n => {
                        updates.set(n.id, { x: n.x + moveDx, y: n.y + moveDy, z: n.z + moveDz });
                    });
                    updateNodes(updates);
                    showNotification('success', `Moved ${operationNodes.length} nodes by (${moveDx}, ${moveDy}, ${moveDz}) m`);
                    pushLog({ tool: 'move', summary: 'Move', detail: `Δx=${moveDx}, Δy=${moveDy}, Δz=${moveDz} m · ${operationNodes.length} nodes` });
                }
                break;
            }
            case 'renumber': {
                if (renumberType === 'nodes' || renumberType === 'both') {
                    useModelStore.getState().renumberNodes();
                }
                if (renumberType === 'members' || renumberType === 'both') {
                    useModelStore.getState().renumberMembers();
                }
                showNotification('success', `Renumbered ${renumberType}`);
                pushLog({
                    tool: 'renumber',
                    summary: 'Renumber complete',
                    detail: `Target: ${renumberType}`,
                });
                break;
            }
            case 'auto-node': {
                const result = detectAndAutoNode(autoNodeTolerance);
                if (result.intersectionCount === 0) {
                    showNotification('info', 'No new intersections found within tolerance');
                } else {
                    showNotification('success', `Auto-Node: ${result.intersectionCount} intersection(s) split → ${result.createdNodeIds.length} nodes added`);
                }
                pushLog({
                    tool: 'auto-node',
                    summary: `Auto-Node · ${result.intersectionCount} intersection(s)`,
                    detail: `Created ${result.createdNodeIds.length} nodes, ${result.createdMemberIds.length} members`,
                });
                break;
            }
        }

        setGeometryToolPreset(null);
        onClose();
    };

    const ActiveIcon = TOOLS.find(t => t.id === activeTool)?.icon || Copy;

    const handleClose = () => {
        setGeometryToolPreset(null);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
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

                    {/* Tool Selection — 9 tools in 3×3 grid */}
                    <div className="grid grid-cols-3 md:grid-cols-9 gap-2 mb-6">
                        {TOOLS.map((tool) => {
                            const Icon = tool.icon;
                            return (
                                <button type="button"
                                    key={tool.id}
                                    title={tool.description}
                                    onClick={() => setActiveTool(tool.id)}
                                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all ${activeTool === tool.id
                                        ? 'border-violet-500 bg-violet-500/10'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                        }`}
                                >
                                    <Icon className={`w-5 h-5 ${activeTool === tool.id ? 'text-violet-400' : 'text-slate-500 dark:text-slate-400'}`} />
                                    <span className="text-[10px] text-slate-600 dark:text-slate-300 text-center leading-tight">{tool.name}</span>
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

                    {/* Execution Preview */}
                    <div className="mb-6 p-4 rounded-lg border border-violet-300/40 dark:border-violet-700/40 bg-violet-50/70 dark:bg-violet-950/30">
                        <div className="flex items-center gap-2 mb-2">
                            <ActiveIcon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                            <span className="text-sm font-semibold text-violet-800 dark:text-violet-200">{operationPreview.title}</span>
                        </div>
                        <p className="text-xs text-violet-700 dark:text-violet-300">{operationPreview.line1}</p>
                        <p className="text-xs text-violet-700 dark:text-violet-300 mt-1">{operationPreview.line2}</p>
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
                                <div className="grid grid-cols-1 gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={rotateLinkSteps}
                                            onChange={(e) => setRotateLinkSteps(e.target.checked)}
                                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-violet-600"
                                        />
                                        <span className="text-sm text-slate-600 dark:text-slate-300">Link adjacent rotated copies</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={rotateCloseLoop}
                                            onChange={(e) => setRotateCloseLoop(e.target.checked)}
                                            disabled={!rotateLinkSteps}
                                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-violet-600 disabled:opacity-50"
                                        />
                                        <span className="text-sm text-slate-600 dark:text-slate-300">Close loop (last copy → first copy)</span>
                                    </label>
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

                        {activeTool === 'auto-node' && (
                            <div>
                                <Label className="text-sm text-slate-500 dark:text-slate-400 block mb-2">
                                    Intersection Tolerance (m)
                                </Label>
                                <Input
                                    type="number"
                                    min={0.001}
                                    step={0.001}
                                    value={autoNodeTolerance}
                                    onChange={(e) => setAutoNodeTolerance(Math.max(0.001, parseFloat(e.target.value) || 0.01))}
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                    Recommended: 0.005–0.020 m depending on model precision.
                                </p>
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

                        {activeTool === 'divide' && (
                            <div>
                                <Label className="text-sm text-slate-500 dark:text-slate-400 block mb-2">
                                    Number of Segments
                                </Label>
                                <div className="flex items-center gap-4 mb-3">
                                    <Input
                                        type="number"
                                        min={2}
                                        max={20}
                                        value={divideSegments}
                                        onChange={(e) => setDivideSegments(Math.max(2, parseInt(e.target.value) || 2))}
                                        className="w-28"
                                    />
                                    <span className="text-sm text-slate-500 dark:text-slate-400">
                                        → {divideSegments - 1} intermediate node(s) per member
                                    </span>
                                </div>
                                {/* Visual segment preview */}
                                <div className="p-3 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: divideSegments }).map((_, i) => (
                                            <div key={i} className="flex-1 h-2 rounded bg-violet-400/70 dark:bg-violet-600/70" />
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                                        Each member split at equal {(100 / divideSegments).toFixed(1)}% intervals · properties copied to each segment
                                    </p>
                                </div>
                                {selectedMembers.length === 0 && (
                                    <p className="text-amber-400 text-sm mt-2">⚠️ Select at least one member to divide</p>
                                )}
                            </div>
                        )}

                        {activeTool === 'align' && (
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-sm text-slate-500 dark:text-slate-400 block mb-2">Align Axis</Label>
                                    <div className="flex gap-2">
                                        {(['x', 'y', 'z'] as const).map(axis => (
                                            <Button
                                                key={axis}
                                                variant={alignAxis === axis ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setAlignAxis(axis)}
                                                className={`flex-1 ${alignAxis === axis ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}`}
                                            >
                                                {axis.toUpperCase()}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm text-slate-500 dark:text-slate-400 block mb-2">Align To</Label>
                                    <div className="flex gap-2">
                                        {(['min', 'max', 'avg'] as const).map(target => (
                                            <Button
                                                key={target}
                                                variant={alignTarget === target ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setAlignTarget(target)}
                                                className={`flex-1 ${alignTarget === target ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}`}
                                            >
                                                {target.charAt(0).toUpperCase() + target.slice(1)}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Sets all selected nodes' {alignAxis.toUpperCase()} coordinate to the {alignTarget} value among them.
                                    {selectedNodes.length < 2 && <span className="text-amber-400 ml-1">⚠️ Select ≥2 nodes</span>}
                                </p>
                            </div>
                        )}

                        {activeTool === 'move' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label className="text-sm text-slate-500 dark:text-slate-400 block mb-2">Δx (m)</Label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            value={moveDx}
                                            onChange={(e) => setMoveDx(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-sm text-slate-500 dark:text-slate-400 block mb-2">Δy (m)</Label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            value={moveDy}
                                            onChange={(e) => setMoveDy(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-sm text-slate-500 dark:text-slate-400 block mb-2">Δz (m)</Label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            value={moveDz}
                                            onChange={(e) => setMoveDz(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={moveCopy}
                                        onChange={(e) => setMoveCopy(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-violet-600"
                                    />
                                    <span className="text-sm text-slate-600 dark:text-slate-300">
                                        Copy selection (keep originals)
                                    </span>
                                </label>
                            </div>
                        )}
                    </div>

                    {/* Operation History */}
                    <div className="mt-6 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100/30 dark:bg-slate-800/30">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <History className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                    Session History ({operationLog.length})
                                </span>
                            </div>
                            {operationLog.length > 0 && (
                                <button
                                    type="button"
                                    onClick={undoLastLog}
                                    className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-rose-500 transition-colors"
                                    title="Remove last log entry"
                                >
                                    <Undo2 className="w-3.5 h-3.5" />
                                    Remove last
                                </button>
                            )}
                        </div>
                        {operationLog.length === 0 ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">No operations yet in this session.</p>
                        ) : (
                            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                                {operationLog.map((item) => (
                                    <div key={item.id} className="p-2 rounded-md bg-white/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{item.summary}</span>
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400">{new Date(item.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">{item.detail}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="flex justify-between sm:justify-between">
                    <Button variant="ghost" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleExecute} disabled={!canExecute} className="bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60 disabled:pointer-events-none">
                        <Play className="w-4 h-4 mr-2" />
                        {activeTool === 'auto-node' ? 'Execute Auto-Node' :
                         activeTool === 'divide'    ? 'Execute Divide' :
                         activeTool === 'align'     ? 'Execute Align' :
                         activeTool === 'move'      ? (moveCopy ? 'Execute Copy' : 'Execute Move') :
                         'Execute Operation'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default GeometryToolsPanel;
