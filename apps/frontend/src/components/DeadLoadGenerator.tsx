/**
 * DeadLoadGenerator.tsx - Automatic Dead Load Application
 * 
 * Generates and applies dead loads based on:
 * - Member self-weight (calculated from section properties)
 * - Floor/slab loads (user-defined)
 * - Equipment/fixtures (user-defined)
 */

import { FC, useState } from 'react';
import { Weight, Loader2 } from 'lucide-react';
import { useModelStore } from '../store/model';
import SectionDatabase from '../data/SectionDatabase';
const { STEEL_SECTIONS } = SectionDatabase;
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useUIStore } from '../store/uiStore';

interface DeadLoadGeneratorProps {
    open: boolean;
    onClose: () => void;
}

export const DeadLoadGenerator: FC<DeadLoadGeneratorProps> = ({ open, onClose }) => {
    const showNotification = useUIStore((s) => s.showNotification);
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
// console.log(`[Dead Load] Applied ${totalApplied} loads (${successCount} self-weight, ${floorLoadCount} floor)`);
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
            showNotification('error', error instanceof Error ? error.message : 'Failed to generate dead loads');
        } finally {
            setIsGenerating(false);
        }
    };

    const hasSelection = selectedIds.size > 0;
    const targetNodeCount = applyToSelection && hasSelection
        ? Array.from(selectedIds).filter(id => nodes.has(id)).length
        : nodes.size;

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <Weight className="w-6 h-6 text-amber-400" />
                        <div>
                            <DialogTitle className="text-xl font-bold">Dead Load Generator</DialogTitle>
                            <DialogDescription>
                                Automatic self-weight and floor load calculation
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Self-Weight Option */}
                    <div className="bg-[#1a2333]/50 rounded-lg p-4 border border-[#1a2333]">
                        <Label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includeSelfWeight}
                                onChange={(e) => setIncludeSelfWeight(e.target.checked)}
                                className="w-5 h-5 mt-0.5 rounded border-2 border-[#424754] bg-slate-200 bg-slate-700 checked:bg-blue-500 checked:border-[#4d8eff]"
                            />
                            <div className="flex-1">
                                <div className="font-semibold text-[#dae2fd]">Include Member Self-Weight</div>
                                <p className="text-sm text-[#869ab8] mt-1">
                                    Automatically calculate and apply weight of all structural members based on
                                    section properties (steel density: 7850 kg/m³)
                                </p>
                            </div>
                        </Label>
                    </div>

                    {/* Floor Load */}
                    <div className="bg-[#1a2333]/50 rounded-lg p-4 border border-[#1a2333]">
                        <div className="font-semibold text-[#dae2fd] mb-3">Additional Floor Load</div>
                        <p className="text-sm text-[#869ab8] mb-3">
                            Apply uniform floor load to horizontal members (slabs, beams)
                        </p>
                        <div className="space-y-3">
                            <div>
                                <Label className="block text-xs text-[#869ab8] mb-1">
                                    Floor Load Intensity (kN/m²)
                                </Label>
                                <Input
                                    type="number"
                                    step="0.5"
                                    value={floorLoad}
                                    onChange={(e) => setFloorLoad(parseFloat(e.target.value) || 0)}
                                />
                            </div>

                            {/* Quick presets */}
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setFloorLoad(2.0)}
                                    className="text-xs"
                                >
                                    Residential (2.0)
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setFloorLoad(4.0)}
                                    className="text-xs"
                                >
                                    Office (4.0)
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setFloorLoad(5.0)}
                                    className="text-xs"
                                >
                                    Retail (5.0)
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setFloorLoad(0)}
                                    className="text-xs"
                                >
                                    None
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Apply to Selection */}
                    {hasSelection && (
                        <div className="bg-blue-50 bg-blue-900/20 border border-blue-300 border-[#4d8eff]/30 rounded-lg p-4">
                            <Label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={applyToSelection}
                                    onChange={(e) => setApplyToSelection(e.target.checked)}
                                    className="w-5 h-5 mt-0.5 rounded border-2 border-blue-600 bg-slate-200 bg-slate-700 checked:bg-blue-500 checked:border-[#4d8eff]"
                                />
                                <div className="flex-1">
                                    <div className="font-semibold text-blue-700 text-[#adc6ff]">Apply to Selection Only</div>
                                    <p className="text-sm text-blue-600 text-blue-200 mt-1">
                                        Apply loads only to the {selectedIds.size} selected element(s) instead of entire structure
                                    </p>
                                </div>
                            </Label>
                        </div>
                    )}

                    {/* Summary */}
                    <div className="bg-amber-50 bg-amber-900/20 border border-amber-300 border-amber-500/30 rounded-lg p-4">
                        <div className="text-sm font-semibold text-amber-700 text-amber-300 mb-2">Summary</div>
                        <div className="text-sm text-amber-600 text-amber-200 space-y-1">
                            <div>• Target: {targetNodeCount} node(s)</div>
                            {includeSelfWeight && <div>• Self-weight: Auto-calculated from sections</div>}
                            {floorLoad > 0 && <div>• Floor load: {floorLoad.toFixed(2)} kN/m²</div>}
                            <div>• Direction: Downward (-Y)</div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="flex items-center justify-between sm:justify-between">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleGenerate}
                        disabled={isGenerating || (!includeSelfWeight && floorLoad === 0)}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                        {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                        Generate Dead Loads
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default DeadLoadGenerator;
