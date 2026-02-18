/**
 * MeshingPanel.tsx - FEA Meshing Interface
 * 
 * Provides UI to access the backend meshing engine:
 * - Plate meshing (N×M grid)
 * - Triangulation with holes
 * - Mesh quality display
 */

import { FC, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Grid3X3, Triangle, Box, Loader2,
    Check, AlertCircle, Settings2, Layers
} from 'lucide-react';
import { useModelStore } from '../store/model';
import { MesherService } from '../utils/MesherService';

// ============================================
// TYPES
// ============================================

interface MeshingPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

type MeshType = 'plate' | 'triangulate' | 'brick';

// ============================================
// MAIN COMPONENT
// ============================================

export const MeshingPanel: FC<MeshingPanelProps> = ({ isOpen, onClose }) => {
    // State
    const [meshType, setMeshType] = useState<MeshType>('plate');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Plate mesh params
    const [nx, setNx] = useState(4);
    const [ny, setNy] = useState(4);
    const [snapToNodes, setSnapToNodes] = useState(true);

    // Mesh results
    const [meshResult, setMeshResult] = useState<{
        nodes: number;
        elements: number;
        type: string;
    } | null>(null);

    // Store
    const selectedIds = useModelStore((s) => s.selectedIds);
    const nodes = useModelStore((s) => s.nodes);
    const addNode = useModelStore((s) => s.addNode);
    const addPlate = useModelStore((s) => s.addPlate);
    const getNextPlateId = useModelStore((s) => s.getNextPlateId);

    // Get selected nodes as plate corners
    const getSelectedCorners = () => {
        const selectedNodeIds = Array.from(selectedIds).filter((id: string) => nodes.has(id));
        if (selectedNodeIds.length < 4 && meshType === 'plate') {
            return null;
        }

        const corners = selectedNodeIds.slice(0, 4).map(id => {
            const node = nodes.get(id)!;
            return { x: node.x, y: node.y, z: node.z };
        });
        return corners;
    };

    // Mesh plate using local MesherService
    const handleMeshPlate = async () => {
        const corners = getSelectedCorners();
        if (!corners) {
            setError('Select 4 nodes to define plate corners');
            return;
        }

        setIsProcessing(true);
        setError(null);
        setSuccess(null);

        try {
            // Use local MesherService to generate the mesh
            const result = MesherService.meshSurface(corners, {
                meshSize: Math.max(
                    Math.abs(corners[1].x - corners[0].x) / nx,
                    Math.abs(corners[2].y - corners[0].y) / ny,
                    0.1
                ),
                thickness: 0.15,
                materialId: 'concrete',
            });

            // Map MesherService node IDs → model store node IDs
            const meshNodeIdToStoreId = new Map<string, string>();
            const { getNextNodeId } = useModelStore.getState();

            for (const meshNode of result.nodes) {
                // Check if a node already exists at this position (snap tolerance 0.01m)
                let existingId: string | null = null;
                for (const [id, n] of nodes) {
                    if (Math.abs(n.x - meshNode.x) < 0.01 &&
                        Math.abs(n.y - meshNode.y) < 0.01 &&
                        Math.abs(n.z - meshNode.z) < 0.01) {
                        existingId = id;
                        break;
                    }
                }

                if (existingId) {
                    meshNodeIdToStoreId.set(meshNode.id, existingId);
                } else {
                    const storeId = getNextNodeId();
                    meshNodeIdToStoreId.set(meshNode.id, storeId);
                    addNode({
                        id: storeId,
                        x: meshNode.x,
                        y: meshNode.y,
                        z: meshNode.z,
                    });
                }
            }

            // Create plate elements in the store
            for (const elem of result.elements) {
                const plateId = getNextPlateId();
                const nodeIds = elem.nodes.map(nid => meshNodeIdToStoreId.get(nid)!);
                addPlate({
                    id: plateId,
                    nodeIds: nodeIds as [string, string, string, string],
                    thickness: elem.thickness,
                    E: 25e6,  // Concrete default
                    nu: 0.2,
                    materialType: 'concrete',
                });
            }

            setMeshResult({
                nodes: result.nodes.length,
                elements: result.elements.length,
                type: 'QUAD4'
            });
            setSuccess(`Generated ${result.elements.length} plate elements with ${result.nodes.length} nodes`);
        } catch (err) {
            setError(`Meshing Error: ${err instanceof Error ? err.message : 'Unknown'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // Triangulate boundary using local MesherService
    const handleTriangulate = async () => {
        const selectedNodeIds = Array.from(selectedIds).filter((id: string) => nodes.has(id));
        if (selectedNodeIds.length < 3) {
            setError('Select at least 3 nodes for boundary');
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            const boundary = selectedNodeIds.map(id => {
                const node = nodes.get(id)!;
                return { x: node.x, y: node.y, z: node.z };
            });

            // Use meshSurface for polygon meshing
            const avgEdgeLength = boundary.reduce((sum, p, i) => {
                const next = boundary[(i + 1) % boundary.length];
                return sum + Math.hypot(next.x - p.x, next.y - p.y);
            }, 0) / boundary.length;

            const result = MesherService.meshSurface(boundary, {
                meshSize: avgEdgeLength / 2,
                thickness: 0.15,
                materialId: 'concrete',
            });

            // Map mesh node IDs → model store node IDs
            const meshNodeIdToStoreId = new Map<string, string>();
            const { getNextNodeId } = useModelStore.getState();

            for (const meshNode of result.nodes) {
                let existingId: string | null = null;
                for (const [id, n] of nodes) {
                    if (Math.abs(n.x - meshNode.x) < 0.01 &&
                        Math.abs(n.y - meshNode.y) < 0.01 &&
                        Math.abs(n.z - meshNode.z) < 0.01) {
                        existingId = id;
                        break;
                    }
                }

                if (existingId) {
                    meshNodeIdToStoreId.set(meshNode.id, existingId);
                } else {
                    const storeId = getNextNodeId();
                    meshNodeIdToStoreId.set(meshNode.id, storeId);
                    addNode({
                        id: storeId,
                        x: meshNode.x,
                        y: meshNode.y,
                        z: meshNode.z,
                    });
                }
            }

            // Create plate elements
            for (const elem of result.elements) {
                const plateId = getNextPlateId();
                const nodeIds = elem.nodes.map(nid => meshNodeIdToStoreId.get(nid)!);
                addPlate({
                    id: plateId,
                    nodeIds: nodeIds as [string, string, string, string],
                    thickness: elem.thickness,
                    E: 25e6,
                    nu: 0.2,
                    materialType: 'concrete',
                });
            }

            setMeshResult({
                nodes: result.nodes.length,
                elements: result.elements.length,
                type: 'QUAD4'
            });
            setSuccess(`Generated ${result.elements.length} elements with ${result.nodes.length} nodes`);
        } catch (err) {
            setError(`Meshing Error: ${err instanceof Error ? err.message : 'Unknown'}`);
        } finally {
            setIsProcessing(false);
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
                    className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
                                <Grid3X3 className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">FEA Meshing</h2>
                                <p className="text-sm text-zinc-400">Plate & Surface Mesh Generation</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Mesh Type Selection */}
                        <div className="flex gap-2 mb-6">
                            <button
                                onClick={() => setMeshType('plate')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${meshType === 'plate'
                                    ? 'bg-violet-600 text-white'
                                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                    }`}
                            >
                                <Grid3X3 className="w-4 h-4" />
                                Plate (Quad)
                            </button>
                            <button
                                onClick={() => setMeshType('triangulate')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${meshType === 'triangulate'
                                    ? 'bg-violet-600 text-white'
                                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                    }`}
                            >
                                <Triangle className="w-4 h-4" />
                                Triangulate
                            </button>
                        </div>

                        {/* Selection Info */}
                        <div className="mb-4 p-3 bg-zinc-800/50 rounded-lg flex items-center gap-3">
                            <Layers className="w-5 h-5 text-violet-400" />
                            <div className="text-sm">
                                <span className="text-zinc-400">Selected Nodes: </span>
                                <span className="text-white font-medium">
                                    {Array.from(selectedIds).filter((id: string) => nodes.has(id)).length}
                                </span>
                                <span className="text-zinc-400 ml-2">
                                    {meshType === 'plate' ? '(Need 4 for corners)' : '(Min 3 for boundary)'}
                                </span>
                            </div>
                        </div>

                        {/* Plate Mesh Options */}
                        {meshType === 'plate' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-zinc-400 mb-2">Divisions X</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={20}
                                            value={nx}
                                            onChange={(e) => setNx(parseInt(e.target.value) || 4)}
                                            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-zinc-400 mb-2">Divisions Y</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={20}
                                            value={ny}
                                            onChange={(e) => setNy(parseInt(e.target.value) || 4)}
                                            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                        />
                                    </div>
                                </div>

                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={snapToNodes}
                                        onChange={(e) => setSnapToNodes(e.target.checked)}
                                        className="w-4 h-4 rounded border-zinc-600"
                                    />
                                    <span className="text-sm text-zinc-300">Snap to existing nodes (hard points)</span>
                                </label>
                            </div>
                        )}

                        {/* Triangulation Options */}
                        {meshType === 'triangulate' && (
                            <div className="p-4 bg-zinc-800/50 rounded-lg text-center">
                                <Triangle className="w-10 h-10 text-violet-400 mx-auto mb-3" />
                                <p className="text-zinc-300">Select boundary nodes in order (CCW)</p>
                                <p className="text-sm text-zinc-400 mt-1">
                                    Constrained Delaunay Triangulation
                                </p>
                            </div>
                        )}

                        {/* Mesh Result */}
                        {meshResult && (
                            <div className="mt-4 p-3 bg-violet-900/20 border border-violet-800 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <Box className="w-4 h-4 text-violet-400" />
                                    <span className="text-sm text-white font-medium">Mesh Generated</span>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <span className="text-zinc-400">Nodes:</span>
                                        <span className="text-white ml-2">{meshResult.nodes}</span>
                                    </div>
                                    <div>
                                        <span className="text-zinc-400">Elements:</span>
                                        <span className="text-white ml-2">{meshResult.elements}</span>
                                    </div>
                                    <div>
                                        <span className="text-zinc-400">Type:</span>
                                        <span className="text-white ml-2">{meshResult.type}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Status Messages */}
                        {error && (
                            <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-400" />
                                <span className="text-sm text-red-300">{error}</span>
                            </div>
                        )}
                        {success && (
                            <div className="mt-4 p-3 bg-emerald-900/20 border border-emerald-800 rounded-lg flex items-center gap-2">
                                <Check className="w-4 h-4 text-emerald-400" />
                                <span className="text-sm text-emerald-300">{success}</span>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-zinc-800 flex justify-between">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-zinc-400 hover:text-white"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={meshType === 'plate' ? handleMeshPlate : handleTriangulate}
                            disabled={isProcessing}
                            className="px-6 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2"
                        >
                            {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                            {meshType === 'plate' ? 'Generate Plate Mesh' : 'Triangulate'}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default MeshingPanel;
