import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { MaterialSelector } from './MaterialSelector';
import axios from 'axios';
import { API_CONFIG } from '../config/env';
import { Grid3X3, Layers } from 'lucide-react';

interface Node {
    id: string | number;
    x: number;
    y: number;
    z: number;
}

interface PlateDesignerDialogProps {
    open: boolean;
    onClose: () => void;
    availableNodes: Node[];
    onPlateCreated?: (plate: any) => void;
}

export function PlateDesignerDialog({ open, onClose, availableNodes, onPlateCreated }: PlateDesignerDialogProps) {
    const [thickness, setThickness] = useState<number>(12.0);
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(['', '', '', '']);
    const [materialId, setMaterialId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);


    const handleCreatePlate = async () => {
        // Validate inputs
        const nodes = selectedNodeIds.filter(id => id.trim() !== '');
        if (nodes.length !== 4) {
            setError('Please select exactly 4 nodes to form a quadrilateral plate.');
            return;
        }
        if (!materialId) {
            setError('Please create and select a material.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Convert string IDs to numbers if your backend expects numbers, 
            // or keep as strings. The Python backend handles lists of IDs.
            // Assuming IDs are passed as they are.
            const cleanNodeIds = nodes.map(id => isNaN(Number(id)) ? id : Number(id));

            const payload = {
                node_ids: cleanNodeIds,
                thickness: thickness,
                material_id: materialId
            };

            const response = await axios.post(`${API_CONFIG.pythonUrl}/elements/plate/create`, payload);

            if (response.data.success) {
                if (onPlateCreated) {
                    onPlateCreated({
                        id: response.data.element_id,
                        ...payload
                    });
                }
                onClose();
            }
        } catch (err: any) {
            console.error("Error creating plate:", err);
            setError(err.response?.data?.detail || "Failed to create plate element.");
        } finally {
            setLoading(false);
        }
    };

    const handleNodeSelect = (index: number, val: string) => {
        const newIds = [...selectedNodeIds];
        newIds[index] = val;
        setSelectedNodeIds(newIds);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="w-5 h-5" /> Plate / Shell Element Modeler
                    </DialogTitle>
                    <DialogDescription>
                        Create 4-node quadrilateral plate elements with non-linear material properties.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div className="space-y-4">
                        <div>
                            <Label>Plate Thickness (mm)</Label>
                            <Input
                                type="number"
                                value={thickness}
                                onChange={(e) => setThickness(parseFloat(e.target.value))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Nodes (Counter-Clockwise)</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {[0, 1, 2, 3].map((i) => (
                                    <div key={i}>
                                        <Input
                                            placeholder={`Node ${i + 1} ID`}
                                            value={selectedNodeIds[i]}
                                            onChange={(e) => handleNodeSelect(i, e.target.value)}
                                            list="available-nodes"
                                        />
                                    </div>
                                ))}
                            </div>
                            <datalist id="available-nodes">
                                {availableNodes.map(n => (
                                    <option key={n.id} value={n.id}>{`Node ${n.id} (${n.x}, ${n.y}, ${n.z})`}</option>
                                ))}
                            </datalist>
                            <p className="text-xs text-gray-500">
                                Select 4 nodes forming a convex quadrilateral.
                            </p>
                        </div>
                    </div>

                    <div className="border-l pl-6">
                        <MaterialSelector
                            onMaterialSelect={setMaterialId}
                            className="mb-4"
                        />

                        {error && (
                            <div className="p-2 bg-red-50 text-red-600 text-xs rounded border border-red-200 mb-4">
                                {error}
                            </div>
                        )}

                        <Button onClick={handleCreatePlate} disabled={loading} className="w-full">
                            {loading ? 'Creating...' : 'Create Plate Element'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
