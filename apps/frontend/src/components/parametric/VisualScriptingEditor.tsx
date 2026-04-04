/**
 * VisualScriptingEditor - Main Component
 * 
 * Split-pane interface with 3D preview on top and node graph editor on bottom.
 * Uses ReactFlow for node-based visual scripting.
 */

import { FC, useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Controls,
    Background,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    NodeTypes,
    Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';

// Custom nodes
import NumberInputNode from './NumberInputNode';
import PointGeneratorNode from './PointGeneratorNode';
import LineConnectorNode from './LineConnectorNode';
import FrameRepeaterNode from './FrameRepeaterNode';

// Execution engine
import { executeGraph } from './GraphExecutor';
import { GeneratedModel, NODE_DEFINITIONS, NODE_COLORS, NodeCategory } from './nodeTypes';

// ============================================
// NODE TYPES REGISTRATION
// ============================================

const nodeTypes: NodeTypes = {
    numberInput: NumberInputNode,
    pointGenerator: PointGeneratorNode,
    lineConnector: LineConnectorNode,
    frameRepeater: FrameRepeaterNode
};

// ============================================
// INITIAL GRAPH
// ============================================

const initialNodes: Node[] = [
    {
        id: 'num1',
        type: 'numberInput',
        position: { x: 50, y: 50 },
        data: { label: 'Bay Spacing', value: 6, min: 1, max: 20, step: 0.5 }
    },
    {
        id: 'num2',
        type: 'numberInput',
        position: { x: 50, y: 180 },
        data: { label: 'Height', value: 4, min: 1, max: 15, step: 0.5 }
    },
    {
        id: 'point1',
        type: 'pointGenerator',
        position: { x: 280, y: 30 },
        data: { label: 'Base Point 1', point: { x: 0, y: 0, z: 0 } }
    },
    {
        id: 'point2',
        type: 'pointGenerator',
        position: { x: 280, y: 200 },
        data: { label: 'Top Point', point: { x: 0, y: 0, z: 4 } }
    },
    {
        id: 'line1',
        type: 'lineConnector',
        position: { x: 520, y: 80 },
        data: { label: 'Column', divisions: 1 }
    },
    {
        id: 'frame1',
        type: 'frameRepeater',
        position: { x: 780, y: 60 },
        data: { label: 'Frame Bays', repeatCount: 4, spacing: 6, direction: 'x' }
    }
];

const initialEdges: Edge[] = [
    { id: 'e1', source: 'point1', sourceHandle: 'point', target: 'line1', targetHandle: 'start' },
    { id: 'e2', source: 'point2', sourceHandle: 'point', target: 'line1', targetHandle: 'end' },
    { id: 'e3', source: 'line1', sourceHandle: 'points', target: 'frame1', targetHandle: 'points' }
];

// ============================================
// 3D PREVIEW COMPONENT
// ============================================

interface PreviewProps {
    model: GeneratedModel;
}

const Preview3D: FC<PreviewProps> = ({ model }) => {
    return (
        <Canvas
            camera={{ position: [20, 15, 20], fov: 50 }}
            style={{ background: '#0F172A' }}
        >
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />

            <OrbitControls enableDamping dampingFactor={0.05} />

            {/* Grid */}
            <gridHelper args={[50, 50, '#334155', '#1E293B']} />

            {/* Nodes */}
            {model.nodes.map((node) => (
                <mesh key={node.id} position={[node.x, node.z, node.y]}>
                    <sphereGeometry args={[0.15, 16, 16]} />
                    <meshStandardMaterial color="#3B82F6" emissive="#3B82F6" emissiveIntensity={0.3} />
                </mesh>
            ))}

            {/* Members */}
            {model.members.map((member) => {
                const startNode = model.nodes.find(n => n.id === member.startNodeId);
                const endNode = model.nodes.find(n => n.id === member.endNodeId);

                if (!startNode || !endNode) return null;

                return (
                    <Line
                        key={member.id}
                        points={[
                            new THREE.Vector3(startNode.x, startNode.z, startNode.y),
                            new THREE.Vector3(endNode.x, endNode.z, endNode.y)
                        ]}
                        color="#22C55E"
                        lineWidth={2}
                    />
                );
            })}

            {/* Axes */}
            <axesHelper args={[5]} />
        </Canvas>
    );
};

// ============================================
// NODE PALETTE
// ============================================

interface NodePaletteProps {
    onAddNode: (type: string) => void;
}

const NodePalette: FC<NodePaletteProps> = ({ onAddNode }) => {
    const categories = useMemo(() => {
        const cats: Record<NodeCategory, typeof NODE_DEFINITIONS[string][]> = {
            input: [],
            geometry: [],
            transform: [],
            output: []
        };

        Object.values(NODE_DEFINITIONS).forEach(def => {
            cats[def.category].push(def);
        });

        return cats;
    }, []);

    return (
        <div className="bg-[#131b2e] rounded-lg p-3 shadow-lg">
            <h4 className="text-[#dae2fd] text-sm font-semibold mb-3">Add Node</h4>
            <div className="space-y-3">
                {Object.entries(categories).map(([category, nodes]) => (
                    nodes.length > 0 && (
                        <div key={category}>
                            <div className="text-[#869ab8] text-xs uppercase mb-1">{category}</div>
                            <div className="flex flex-wrap gap-1">
                                {nodes.map(node => (
                                    <button type="button"
                                        key={node.type}
                                        onClick={() => onAddNode(node.type)}
                                        className="px-2 py-1 text-xs text-[#dae2fd] rounded transition-colors"
                                        style={{ backgroundColor: NODE_COLORS[node.category as NodeCategory] }}
                                    >
                                        {node.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )
                ))}
            </div>
        </div>
    );
};

// ============================================
// MAIN EDITOR COMPONENT
// ============================================

interface VisualScriptingEditorProps {
    onModelGenerated?: (model: GeneratedModel) => void;
}

export const VisualScriptingEditor: FC<VisualScriptingEditorProps> = ({ onModelGenerated }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [generatedModel, setGeneratedModel] = useState<GeneratedModel>({ nodes: [], members: [] });
    const [splitRatio, setSplitRatio] = useState(0.5); // 50% each
    const [isAutoExecute, setIsAutoExecute] = useState(true);

    // Execute graph when nodes or edges change
    useEffect(() => {
        if (isAutoExecute) {
            const model = executeGraph(nodes, edges);
            queueMicrotask(() => {
                setGeneratedModel(model);
            });
            onModelGenerated?.(model);
        }
    }, [nodes, edges, isAutoExecute, onModelGenerated]);

    // Handle new connections
    const onConnect = useCallback((connection: Connection) => {
        setEdges((eds) => addEdge({
            ...connection,
            animated: true,
            style: { stroke: '#3B82F6', strokeWidth: 2 }
        }, eds));
    }, [setEdges]);

    // Handle node data changes
    const handleNodeDataChange = useCallback((nodeId: string, newData: any) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            ...newData,
                            // Note: onChange callback will be properly bound when component updates
                        }
                    };
                }
                return node;
            })
        );
    }, [setNodes]);

    // Create onChange handler for a node
    const createOnChangeHandler = useCallback((nodeId: string) => {
        return (value: any) => handleNodeDataChange(nodeId, typeof value === 'object' ? value : { value });
    }, [handleNodeDataChange]);

    // Initialize onChange handlers
    useEffect(() => {
        queueMicrotask(() => {
            setNodes((nds) =>
                nds.map((node) => ({
                    ...node,
                    data: {
                        ...node.data,
                        onChange: createOnChangeHandler(node.id)
                    }
                }))
            );
        });
    }, [createOnChangeHandler, setNodes]);

    // Add new node
    const handleAddNode = useCallback((type: string) => {
        const definition = NODE_DEFINITIONS[type];
        if (!definition) return;

        const nodeId = `${type}_${Date.now()}`;
        const newNode: Node = {
            id: nodeId,
            type,
            position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
            data: {
                label: definition.label,
                ...definition.defaultData,
                onChange: createOnChangeHandler(nodeId)
            }
        };

        setNodes((nds) => [...nds, newNode]);
    }, [setNodes, createOnChangeHandler]);

    // Manual execute
    const handleExecute = useCallback(() => {
        const model = executeGraph(nodes, edges);
        setGeneratedModel(model);
        onModelGenerated?.(model);
    }, [nodes, edges, onModelGenerated]);

    // Clear graph
    const handleClear = useCallback(() => {
        setNodes([]);
        setEdges([]);
        setGeneratedModel({ nodes: [], members: [] });
    }, [setNodes, setEdges]);

    return (
        <div className="h-full flex flex-col bg-[#0b1326]">
            {/* 3D Preview (Top) */}
            <div
                className="relative border-b border-[#1a2333]"
                style={{ height: `${splitRatio * 100}%` }}
            >
                <Preview3D model={generatedModel} />

                {/* Stats overlay */}
                <div className="absolute top-4 left-4 bg-slate-100/90 dark:bg-slate-800/90 rounded-lg px-3 py-2 text-[#dae2fd] text-sm">
                    <div className="flex gap-4">
                        <span>Nodes: <strong>{generatedModel.nodes.length}</strong></span>
                        <span>Members: <strong>{generatedModel.members.length}</strong></span>
                    </div>
                </div>

                {/* Apply button */}
                <div className="absolute top-4 right-4 flex gap-2">
                    <button type="button"
                        onClick={() => onModelGenerated?.(generatedModel)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium tracking-wide rounded-lg transition-colors"
                    >
                        Apply to Model
                    </button>
                </div>
            </div>

            {/* Resize handle */}
            <div
                className="h-2 bg-slate-200 dark:bg-slate-700 cursor-row-resize hover:bg-blue-500 transition-colors"
                onMouseDown={(e) => {
                    const startY = e.clientY;
                    const startRatio = splitRatio;
                    const container = e.currentTarget.parentElement;
                    if (!container) return;

                    const handleMouseMove = (moveEvent: MouseEvent) => {
                        const deltaY = moveEvent.clientY - startY;
                        const newRatio = startRatio + deltaY / container.clientHeight;
                        setSplitRatio(Math.max(0.2, Math.min(0.8, newRatio)));
                    };

                    const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                    };

                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                }}
            />

            {/* Graph Editor (Bottom) */}
            <div className="flex-1 relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    fitView
                    snapToGrid
                    snapGrid={[15, 15]}
                    defaultEdgeOptions={{
                        animated: true,
                        style: { stroke: '#3B82F6', strokeWidth: 2 }
                    }}
                >
                    <Background color="#334155" gap={20} />
                    <Controls className="bg-[#131b2e] border-[#1a2333]" />
                    <MiniMap
                        nodeColor={(node) => NODE_COLORS[(NODE_DEFINITIONS[node.type || '']?.category || 'input') as NodeCategory]}
                        maskColor="rgba(15, 23, 42, 0.8)"
                        className="bg-[#131b2e] border border-[#1a2333]"
                    />

                    {/* Toolbar */}
                    <Panel position="top-left" className="flex gap-2">
                        <NodePalette onAddNode={handleAddNode} />
                    </Panel>

                    <Panel position="top-right" className="flex gap-2">
                        <button type="button"
                            onClick={handleExecute}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
                        >
                            ▶ Execute
                        </button>
                        <button type="button"
                            onClick={() => setIsAutoExecute(!isAutoExecute)}
                            className={`px-3 py-2 text-sm rounded-lg transition-colors ${isAutoExecute ? 'bg-green-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                }`}
                        >
                            Auto: {isAutoExecute ? 'ON' : 'OFF'}
                        </button>
                        <button type="button"
                            onClick={handleClear}
                            className="px-3 py-2 bg-red-600/80 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
                        >
                            Clear
                        </button>
                    </Panel>
                </ReactFlow>
            </div>
        </div>
    );
};

export default VisualScriptingEditor;
