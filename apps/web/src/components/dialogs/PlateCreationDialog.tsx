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
import { X, Plus, Grid3X3, AlertCircle, CheckCircle } from 'lucide-react';
import { useModelStore, Plate } from '../../store/model';

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-700 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600">
                    <div className="flex items-center gap-3">
                        <Grid3X3 className="w-5 h-5 text-white" />
                        <div>
                            <h2 className="text-lg font-bold text-white">Create Plate Element</h2>
                            <p className="text-xs text-purple-200">Define a quadrilateral shell/slab</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

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
                            <div className="text-sm font-medium text-white">
                                {isValidSelection
                                    ? '4 nodes selected ✓'
                                    : `Select exactly 4 nodes (${selectedNodeIds.length}/4 selected)`}
                            </div>
                            <div className="text-xs text-zinc-400 mt-1">
                                {isValidSelection
                                    ? `Nodes: ${selectedNodeIds.join(', ')}`
                                    : 'Select nodes in counter-clockwise order in the viewport'}
                            </div>
                        </div>
                    </div>

                    {/* Thickness */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Plate Thickness
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                value={thickness * 1000} // Display in mm
                                onChange={(e) => setThickness(parseFloat(e.target.value) / 1000 || 0.15)}
                                step="10"
                                min="10"
                                className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white"
                            />
                            <span className="text-sm text-zinc-400 w-12">mm</span>
                        </div>
                    </div>

                    {/* Material */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">
                            Material
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {Object.entries(MATERIAL_PRESETS).map(([key, preset]) => (
                                <button
                                    key={key}
                                    onClick={() => setMaterialType(key as any)}
                                    className={`px-3 py-2 text-sm rounded-lg transition-all ${materialType === key
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                        }`}
                                >
                                    {preset.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Material Properties */}
                    {materialType === 'custom' && (
                        <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Young's Modulus (E)</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={customE / 1e6}
                                        onChange={(e) => setCustomE(parseFloat(e.target.value) * 1e6 || 200e6)}
                                        className="flex-1 px-3 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-white text-sm"
                                    />
                                    <span className="text-xs text-zinc-500">GPa</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Poisson's Ratio (ν)</label>
                                <input
                                    type="number"
                                    value={customNu}
                                    onChange={(e) => setCustomNu(parseFloat(e.target.value) || 0.3)}
                                    step="0.05"
                                    min="0"
                                    max="0.5"
                                    className="w-full px-3 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-white text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {/* Material Info */}
                    {materialType !== 'custom' && (
                        <div className="text-xs text-zinc-500">
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
                                className="w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-purple-600"
                            />
                            <span className="text-sm text-zinc-300">Apply Surface Pressure</span>
                        </label>

                        {applyPressure && (
                            <div className="flex items-center gap-3 pl-6">
                                <input
                                    type="number"
                                    value={pressure}
                                    onChange={(e) => setPressure(parseFloat(e.target.value) || 0)}
                                    className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white"
                                />
                                <span className="text-sm text-zinc-400">kN/m²</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 bg-zinc-800/50 border-t border-zinc-700">
                    <div className="text-xs text-zinc-500">
                        Plate elements use MITC4 formulation
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={!isValidSelection}
                            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all ${isValidSelection
                                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                                    : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                                }`}
                        >
                            <Plus className="w-4 h-4" />
                            Create Plate
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlateCreationDialog;
