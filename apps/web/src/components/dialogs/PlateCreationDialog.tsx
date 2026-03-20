/**
 * PlateCreationDialog.tsx - Create Plate/Shell Elements
 * 
 * Features:
 * - Select 4 nodes to define a quadrilateral plate
 * - Set thickness and material properties
 * - Optional pressure load
 * - Material presets (steel, concrete)
 */

import React, { FC, useState, useMemo } from 'react';
import { Plus, Grid3X3, AlertCircle, CheckCircle } from 'lucide-react';
import { useModelStore, Plate } from '../../store/model';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

// ============================================
// TYPES
// ============================================

interface PlateCreationDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

interface MaterialPreset {
    name: string;
    E: number;      // Young's modulus (kN/m²)
    nu: number;     // Poisson's ratio
}

// ============================================
// CONSTANTS
// ============================================

const MATERIAL_PRESETS: Record<string, MaterialPreset> = {
    steel: { name: 'Steel', E: 200e6, nu: 0.3 },
    concrete: { name: 'Concrete M25', E: 25e6, nu: 0.2 },
    aluminum: { name: 'Aluminum', E: 70e6, nu: 0.33 },
    custom: { name: 'Custom', E: 200e6, nu: 0.3 },
};

// ============================================
// COMPONENT
// ============================================

export const PlateCreationDialog: FC<PlateCreationDialogProps> = ({ isOpen, onClose }) => {
    // Store
    const nodes = useModelStore((s) => s.nodes);
    const selectedIds = useModelStore((s) => s.selectedIds);
    const getNextPlateId = useModelStore((s) => s.getNextPlateId);
    const addPlate = useModelStore((s) => s.addPlate);

    // State
    const [thickness, setThickness] = useState(0.15); // 150mm default
    const [materialType, setMaterialType] = useState<'steel' | 'concrete' | 'aluminum' | 'custom'>('concrete');
    const [customE, setCustomE] = useState(200e6);
    const [customNu, setCustomNu] = useState(0.3);
    const [pressure, setPressure] = useState(0); // kN/m²
    const [applyPressure, setApplyPressure] = useState(false);

    // Get selected nodes (must be exactly 4)
    const selectedNodeIds = useMemo(() => {
        return Array.from(selectedIds).filter(id => nodes.has(id));
    }, [selectedIds, nodes]);

    const isValidSelection = selectedNodeIds.length === 4;

    // Get material properties
    const material = materialType === 'custom'
        ? { E: customE, nu: customNu }
        : MATERIAL_PRESETS[materialType];

    // Handle create
    const handleCreate = () => {
        if (!isValidSelection) return;

        const plateId = getNextPlateId();
        const newPlate: Plate = {
            id: plateId,
            nodeIds: selectedNodeIds as [string, string, string, string],
            thickness,
            E: material.E,
            nu: material.nu,
            materialType: materialType === 'aluminum' ? 'custom' : materialType,
            pressure: applyPressure ? pressure : undefined,
        };

        addPlate(newPlate);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <Grid3X3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        <div>
                            <DialogTitle>Create Plate Element</DialogTitle>
                            <DialogDescription>Define a quadrilateral shell/slab</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Node Selection Status */}
                    <div className={`flex items-center gap-3 p-4 rounded-lg border ${isValidSelection
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-yellow-500/10 border-yellow-500/30'
                        }`}>
                        {isValidSelection ? (
                            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                        )}
                        <div>
                            <div className="text-sm font-medium tracking-wide tracking-wide text-[#dae2fd]">
                                {isValidSelection
                                    ? '4 nodes selected ✓'
                                    : `Select exactly 4 nodes (${selectedNodeIds.length}/4 selected)`}
                            </div>
                            <div className="text-xs text-[#869ab8] mt-1">
                                {isValidSelection
                                    ? `Nodes: ${selectedNodeIds.join(', ')}`
                                    : 'Select nodes in counter-clockwise order in the viewport'}
                            </div>
                        </div>
                    </div>

                    {/* Thickness */}
                    <div>
                        <Label className="block text-sm font-medium tracking-wide tracking-wide text-slate-600 dark:text-slate-300 mb-2">
                            Plate Thickness
                        </Label>
                        <div className="flex items-center gap-3">
                            <Input
                                type="number"
                                value={thickness * 1000} // Display in mm
                                onChange={(e) => setThickness(parseFloat(e.target.value) / 1000 || 0.15)}
                                step={10}
                                min={10}
                                className="flex-1"
                            />
                            <span className="text-sm text-[#869ab8] w-12">mm</span>
                        </div>
                    </div>

                    {/* Material */}
                    <div>
                        <Label className="block text-sm font-medium tracking-wide tracking-wide text-slate-600 dark:text-slate-300 mb-2">
                            Material
                        </Label>
                        <div className="grid grid-cols-4 gap-2">
                            {Object.entries(MATERIAL_PRESETS).map(([key, preset]) => (
                                <Button
                                    key={key}
                                    variant={materialType === key ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setMaterialType(key as any)}
                                    className={materialType === key ? 'bg-purple-600 hover:bg-purple-700' : ''}
                                >
                                    {preset.name}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Material Properties */}
                    {materialType === 'custom' && (
                        <div className="grid grid-cols-2 gap-4 p-4 bg-[#131b2e] rounded-lg border border-[#1a2333]">
                            <div>
                                <Label className="block text-xs text-[#869ab8] mb-1">Young's Modulus (E)</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        value={customE / 1e6}
                                        onChange={(e) => setCustomE(parseFloat(e.target.value) * 1e6 || 200e6)}
                                        className="flex-1 text-sm"
                                    />
                                    <span className="text-xs text-[#869ab8]">GPa</span>
                                </div>
                            </div>
                            <div>
                                <Label className="block text-xs text-[#869ab8] mb-1">Poisson's Ratio (ν)</Label>
                                <Input
                                    type="number"
                                    value={customNu}
                                    onChange={(e) => setCustomNu(parseFloat(e.target.value) || 0.3)}
                                    step={0.05}
                                    min={0}
                                    max={0.5}
                                    className="w-full text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {/* Material Info */}
                    {materialType !== 'custom' && (
                        <div className="text-xs text-[#869ab8]">
                            E = {(material.E / 1e6).toFixed(0)} GPa, ν = {material.nu}
                        </div>
                    )}

                    {/* Optional Pressure Load */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={applyPressure}
                                onChange={(e) => setApplyPressure(e.target.checked)}
                                className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-purple-600"
                            />
                            <span className="text-sm text-slate-600 dark:text-slate-300">Apply Surface Pressure</span>
                        </label>

                        {applyPressure && (
                            <div className="flex items-center gap-3 pl-6">
                                <Input
                                    type="number"
                                    value={pressure}
                                    onChange={(e) => setPressure(parseFloat(e.target.value) || 0)}
                                    className="flex-1"
                                />
                                <span className="text-sm text-[#869ab8]">kN/m²</span>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="flex items-center justify-between sm:justify-between">
                    <div className="text-xs text-[#869ab8]">
                        Plate elements use MITC4 formulation
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreate}
                            disabled={!isValidSelection}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            <Plus className="w-4 h-4" />
                            Create Plate
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PlateCreationDialog;
