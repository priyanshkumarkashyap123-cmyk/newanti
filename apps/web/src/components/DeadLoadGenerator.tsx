/**
 * DeadLoadGenerator.tsx - Automatic Dead Load Application
 * 
 * Generates and applies dead loads based on:
 * - Member self-weight (calculated from section properties)
 * - Floor/slab loads (user-defined)
 * - Equipment/fixtures (user-defined)
 */

import { FC, useState } from 'react';
import { X, Weight, Loader2 } from 'lucide-react';
import { useModelStore } from '../store/model';
import { STEEL_SECTIONS } from '../data/SectionDatabase';

interface DeadLoadGeneratorProps {
    open: boolean;
    onClose: () => void;
}

export const DeadLoadGenerator: FC<DeadLoadGeneratorProps> = ({ open, onClose }) => {
    const nodes = useModelStore(state => state.nodes);
    const members = useModelStore(state => state.members);
    const selectedIds = useModelStore(state => state.selectedIds);
    const addLoad = useModelStore(state => state.addLoad);
    const addMemberLoad = useModelStore(state => state.addMemberLoad);
    const clearSelection = useModelStore(state => state.clearSelection);

    const [includeSelfWeight, setIncludeSelfWeight] = useState(true);
    const [floorLoad, setFloorLoad] = useState(2.0); // kN/m²
    const [applyToSelection, setApplyToSelection] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Calculate member self-weight per unit length (kN/m)
    const calculateMemberWeightPerMeter = (memberId: string): number => {
        const member = members.get(memberId);
        if (!member) return 0;

        // Get section properties
        const section = STEEL_SECTIONS.find(s => s.id === member.sectionId);
        if (!section) return 0;

        // Mass per unit length (kg/m) = A (mm²) × density (kg/mm³)
        // For steel: density ≈ 7850 kg/m³ = 7.85e-6 kg/mm³
        const density = 7.85e-6; // kg/mm³
        const massPerMeter = section.A * density * 1000; // kg/m
        const weightPerMeter = massPerMeter * 9.81 / 1000; // kN/m

        return weightPerMeter;
    };

    const handleGenerate = () => {
        setIsGenerating(true);

        // Track load applications
        let loadCounter = 1;
        let successCount = 0;
        let skippedCount = 0;
        let floorLoadCount = 0;

        try {
            // Validation
            if (members.size === 0) {
                throw new Error('No members in the model. Please create members first.');
            }

            if (includeSelfWeight) {
                // Apply self-weight as uniformly distributed load (UDL) along each member
                const targetMembers = applyToSelection && selectedIds.size > 0
                    ? Array.from(members.values()).filter(m => selectedIds.has(m.id))
                    : Array.from(members.values());

                if (targetMembers.length === 0) {
                    throw new Error('No members selected. Please select members or uncheck "Apply to Selection".');
                }

                targetMembers.forEach(member => {
                    const weightPerMeter = calculateMemberWeightPerMeter(member.id);
                    
                    if (weightPerMeter > 0) {
                        // Apply as UDL in global_y direction (downward)
                        addMemberLoad({
                            id: `DL_SW_${loadCounter++}`,
                            memberId: member.id,
                            type: 'UDL',
                            w1: -weightPerMeter, // Negative for downward
                            w2: -weightPerMeter, // Same as w1 for uniform distribution
                            direction: 'global_y',
                            startPos: 0,
                            endPos: 1,
                        });
                        successCount++;
                    } else {
                        skippedCount++;
                    }
                });
            }

            // Apply floor load if specified
            if (floorLoad > 0) {
                // Find horizontal members (beams) and apply floor load as UDL
                const horizontalMembers = Array.from(members.values()).filter(member => {
                    const startNode = nodes.get(member.startNodeId);
                    const endNode = nodes.get(member.endNodeId);
                    if (!startNode || !endNode) return false;

                    // Check if member is mostly horizontal (small Y difference)
                    const dy = Math.abs(endNode.y - startNode.y);
                    const dx = Math.abs(endNode.x - startNode.x);
                    const dz = Math.abs(endNode.z - startNode.z);
                    const horizontalLength = Math.sqrt(dx * dx + dz * dz);

                    return dy < 0.5 && horizontalLength > 0.5; // Mostly horizontal
                });

                // Apply floor load as UDL on each horizontal member
                horizontalMembers.forEach(member => {
                    if (applyToSelection && !selectedIds.has(member.id)) return;

                    // Calculate tributary width (simplified - assumes 1m tributary width)
                    // In real scenarios, this would be calculated from floor geometry
                    const tributaryWidth = 1.0; // m
                    const loadPerMeter = floorLoad * tributaryWidth; // kN/m

                    addMemberLoad({
                        id: `DL_FLOOR_${loadCounter++}`,
                        memberId: member.id,
                        type: 'UDL',
                        w1: -loadPerMeter, // Negative for downward
                        w2: -loadPerMeter, // Uniform
                        direction: 'global_y',
                        startPos: 0,
                        endPos: 1,
                    });
                    floorLoadCount++;
                });
            }

            // Success notification
            const totalApplied = successCount + floorLoadCount;
            if (totalApplied > 0) {
                console.log(`[Dead Load] Applied ${totalApplied} loads (${successCount} self-weight, ${floorLoadCount} floor)`);
                if (skippedCount > 0) {
                    console.warn(`[Dead Load] Skipped ${skippedCount} members without section data`);
                }
            }

            if (!applyToSelection) {
                clearSelection();
            }
            onClose();
        } catch (error) {
            console.error('[Dead Load Generator] Error:', error);
            alert(error instanceof Error ? error.message : 'Failed to generate dead loads');
        } finally {
            setIsGenerating(false);
        }
    };

    if (!open) return null;

    const hasSelection = selectedIds.size > 0;
    const targetNodeCount = applyToSelection && hasSelection
        ? Array.from(selectedIds).filter(id => nodes.has(id)).length
        : nodes.size;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-700 w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900">
                    <div className="flex items-center gap-3">
                        <Weight className="w-6 h-6 text-amber-400" />
                        <div>
                            <h2 className="text-xl font-bold text-white">Dead Load Generator</h2>
                            <p className="text-sm text-slate-400">
                                Automatic self-weight and floor load calculation
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Self-Weight Option */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includeSelfWeight}
                                onChange={(e) => setIncludeSelfWeight(e.target.checked)}
                                className="w-5 h-5 mt-0.5 rounded border-2 border-slate-600 bg-slate-700 checked:bg-blue-500 checked:border-blue-500"
                            />
                            <div className="flex-1">
                                <div className="font-semibold text-white">Include Member Self-Weight</div>
                                <p className="text-sm text-slate-400 mt-1">
                                    Automatically calculate and apply weight of all structural members based on
                                    section properties (steel density: 7850 kg/m³)
                                </p>
                            </div>
                        </label>
                    </div>

                    {/* Floor Load */}
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <div className="font-semibold text-white mb-3">Additional Floor Load</div>
                        <p className="text-sm text-slate-400 mb-3">
                            Apply uniform floor load to horizontal members (slabs, beams)
                        </p>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">
                                    Floor Load Intensity (kN/m²)
                                </label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={floorLoad}
                                    onChange={(e) => setFloorLoad(parseFloat(e.target.value) || 0)}
                                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                                />
                            </div>

                            {/* Quick presets */}
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setFloorLoad(2.0)}
                                    className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md"
                                >
                                    Residential (2.0)
                                </button>
                                <button
                                    onClick={() => setFloorLoad(4.0)}
                                    className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md"
                                >
                                    Office (4.0)
                                </button>
                                <button
                                    onClick={() => setFloorLoad(5.0)}
                                    className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md"
                                >
                                    Retail (5.0)
                                </button>
                                <button
                                    onClick={() => setFloorLoad(0)}
                                    className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md"
                                >
                                    None
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Apply to Selection */}
                    {hasSelection && (
                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={applyToSelection}
                                    onChange={(e) => setApplyToSelection(e.target.checked)}
                                    className="w-5 h-5 mt-0.5 rounded border-2 border-blue-600 bg-slate-700 checked:bg-blue-500 checked:border-blue-500"
                                />
                                <div className="flex-1">
                                    <div className="font-semibold text-blue-300">Apply to Selection Only</div>
                                    <p className="text-sm text-blue-200 mt-1">
                                        Apply loads only to the {selectedIds.size} selected element(s) instead of entire structure
                                    </p>
                                </div>
                            </label>
                        </div>
                    )}

                    {/* Summary */}
                    <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
                        <div className="text-sm font-semibold text-amber-300 mb-2">Summary</div>
                        <div className="text-sm text-amber-200 space-y-1">
                            <div>• Target: {targetNodeCount} node(s)</div>
                            {includeSelfWeight && <div>• Self-weight: Auto-calculated from sections</div>}
                            {floorLoad > 0 && <div>• Floor load: {floorLoad.toFixed(2)} kN/m²</div>}
                            <div>• Direction: Downward (-Y)</div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/50 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || (!includeSelfWeight && floorLoad === 0)}
                        className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${!isGenerating && (includeSelfWeight || floorLoad > 0)
                                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-500/30'
                                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                            }`}
                    >
                        {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                        Generate Dead Loads
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeadLoadGenerator;
