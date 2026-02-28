/**
 * MeshingPanel.tsx - FEA Meshing Interface
 * 
 * Provides UI to access the backend meshing engine:
 * - Plate meshing (N×M grid)
 * - Triangulation with holes
 * - Mesh quality display
 */

import { FC, useState } from 'react';
import {
    Grid3X3, Triangle, Box, Loader2,
    Check, AlertCircle, Layers
} from 'lucide-react';
import { useModelStore } from '../store/model';
import { MesherService } from '../utils/MesherService';
import { API_CONFIG } from '../config/env';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';

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
    const [useBackend, setUseBackend] = useState(true);

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

    // Mesh plate — try Python backend first, fall back to local MesherService
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
            let result: { nodes: { id: string; x: number; y: number; z: number }[]; elements: { nodes: string[]; thickness: number }[] };

            if (useBackend) {
                try {
                    const response = await fetch(`${API_CONFIG.pythonUrl}/mesh/plate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            corners,
                            nx,
                            ny,
                            thickness: 0.15,
                        }),
                    });
                    if (!response.ok) throw new Error(`Backend error: ${response.status}`);
                    const data = await response.json();
                    result = data;
                } catch {
                    // Fallback to local mesher
                    result = MesherService.meshSurface(corners, {
                        meshSize: Math.max(
                            Math.abs(corners[1].x - corners[0].x) / nx,
                            Math.abs(corners[2].y - corners[0].y) / ny,
                            0.1
                        ),
                        thickness: 0.15,
                        materialId: 'concrete',
                    });
                }
            } else {
                result = MesherService.meshSurface(corners, {
                    meshSize: Math.max(
                        Math.abs(corners[1].x - corners[0].x) / nx,
                        Math.abs(corners[2].y - corners[0].y) / ny,
                        0.1
                    ),
                    thickness: 0.15,
                    materialId: 'concrete',
                });
            }

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

    // Triangulate boundary — try Python backend, fall back to local
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

            const avgEdgeLength = boundary.reduce((sum, p, i) => {
                const next = boundary[(i + 1) % boundary.length];
                return sum + Math.hypot(next.x - p.x, next.y - p.y);
            }, 0) / boundary.length;

            let result: { nodes: { id: string; x: number; y: number; z: number }[]; elements: { nodes: string[]; thickness: number }[] };

            if (useBackend) {
                try {
                    const response = await fetch(`${API_CONFIG.pythonUrl}/mesh/triangulate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            boundary,
                            mesh_size: avgEdgeLength / 2,
                            thickness: 0.15,
                        }),
                    });
                    if (!response.ok) throw new Error(`Backend error: ${response.status}`);
                    result = await response.json();
                } catch {
                    result = MesherService.meshSurface(boundary, {
                        meshSize: avgEdgeLength / 2,
                        thickness: 0.15,
                        materialId: 'concrete',
                    });
                }
            } else {
                result = MesherService.meshSurface(boundary, {
                    meshSize: avgEdgeLength / 2,
                    thickness: 0.15,
                    materialId: 'concrete',
                });
            }

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

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
                            <Grid3X3 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <DialogTitle>FEA Meshing</DialogTitle>
                            <DialogDescription>Plate & Surface Mesh Generation</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Mesh Type Selection */}
                    <div className="flex gap-2">
                        <Button
                            variant={meshType === 'plate' ? 'default' : 'outline'}
                            className={`flex-1 ${meshType === 'plate' ? 'bg-violet-600 hover:bg-violet-700' : ''}`}
                            onClick={() => setMeshType('plate')}
                        >
                            <Grid3X3 className="w-4 h-4 mr-2" />
                            Plate (Quad)
                        </Button>
                        <Button
                            variant={meshType === 'triangulate' ? 'default' : 'outline'}
                            className={`flex-1 ${meshType === 'triangulate' ? 'bg-violet-600 hover:bg-violet-700' : ''}`}
                            onClick={() => setMeshType('triangulate')}
                        >
                            <Triangle className="w-4 h-4 mr-2" />
                            Triangulate
                        </Button>
                    </div>

                    {/* Selection Info */}
                    <div className="p-3 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg flex items-center gap-3">
                        <Layers className="w-5 h-5 text-violet-500 dark:text-violet-400" />
                        <div className="text-sm">
                            <span className="text-zinc-500 dark:text-zinc-400">Selected Nodes: </span>
                            <span className="font-medium text-zinc-900 dark:text-white">
                                {Array.from(selectedIds).filter((id: string) => nodes.has(id)).length}
                            </span>
                            <span className="text-zinc-500 dark:text-zinc-400 ml-2">
                                {meshType === 'plate' ? '(Need 4 for corners)' : '(Min 3 for boundary)'}
                            </span>
                        </div>
                    </div>

                    {/* Plate Mesh Options */}
                    {meshType === 'plate' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="nx">Divisions X</Label>
                                    <Input
                                        id="nx"
                                        type="number"
                                        min={1}
                                        max={20}
                                        value={nx}
                                        onChange={(e) => setNx(parseInt(e.target.value) || 4)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ny">Divisions Y</Label>
                                    <Input
                                        id="ny"
                                        type="number"
                                        min={1}
                                        max={20}
                                        value={ny}
                                        onChange={(e) => setNy(parseInt(e.target.value) || 4)}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="snapToNodes"
                                    checked={snapToNodes}
                                    onCheckedChange={(checked) => setSnapToNodes(checked === true)}
                                />
                                <Label htmlFor="snapToNodes" className="cursor-pointer text-sm font-normal">
                                    Snap to existing nodes (hard points)
                                </Label>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="useBackend"
                                    checked={useBackend}
                                    onCheckedChange={(checked) => setUseBackend(checked === true)}
                                />
                                <Label htmlFor="useBackend" className="cursor-pointer text-sm font-normal">
                                    Use Python backend mesher (recommended)
                                </Label>
                            </div>
                        </div>
                    )}

                    {/* Triangulation Options */}
                    {meshType === 'triangulate' && (
                        <div className="p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg text-center">
                            <Triangle className="w-10 h-10 text-violet-500 dark:text-violet-400 mx-auto mb-3" />
                            <p className="text-zinc-700 dark:text-zinc-300">Select boundary nodes in order (CCW)</p>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                                Constrained Delaunay Triangulation
                            </p>
                        </div>
                    )}

                    {/* Mesh Result */}
                    {meshResult && (
                        <div className="p-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <Box className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                                <span className="text-sm font-medium text-zinc-900 dark:text-white">Mesh Generated</span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="text-zinc-500 dark:text-zinc-400">Nodes:</span>
                                    <span className="text-zinc-900 dark:text-white ml-2">{meshResult.nodes}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-500 dark:text-zinc-400">Elements:</span>
                                    <span className="text-zinc-900 dark:text-white ml-2">{meshResult.elements}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-500 dark:text-zinc-400">Type:</span>
                                    <span className="text-zinc-900 dark:text-white ml-2">{meshResult.type}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Status Messages */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                            <span className="text-sm text-emerald-700 dark:text-emerald-300">{success}</span>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={meshType === 'plate' ? handleMeshPlate : handleTriangulate}
                        disabled={isProcessing}
                        className="bg-violet-600 hover:bg-violet-700"
                    >
                        {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {meshType === 'plate' ? 'Generate Plate Mesh' : 'Triangulate'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MeshingPanel;
