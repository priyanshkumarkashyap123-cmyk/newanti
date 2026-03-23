/**
 * IS875LoadDialog.tsx - Complete IS 875 Load System
 * 
 * Covers all 5 parts of IS 875:
 * - Part 1: Dead loads (material densities)
 * - Part 2: Imposed loads (occupancy-based)
 * - Part 3: Wind loads (calculated)
 * - Part 4: Snow loads (zone-based)
 * - Part 5: Special loads (equipment, impact)
 */

import { FC, useState, useMemo } from 'react';
import {
    Box, Users, Wind, Snowflake, Truck,
    Calculator, ArrowDown, ArrowRight, Check, Copy,
    ChevronDown, Info
} from 'lucide-react';
import { useModelStore, MemberLoad } from '../store/model';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useUIStore } from '../store/uiStore';

// ============================================
// TYPES
// ============================================

type LoadCategory = 'dead' | 'imposed' | 'wind' | 'snow' | 'special';

interface IS875LoadDialogProps {
    isOpen: boolean;
    onClose: () => void;
    targetMemberId?: string;
}

// ============================================
// IS 875 PART 1: DEAD LOAD DATA
// ============================================

const MATERIALS = [
    { id: 'concrete_rcc', name: 'RCC (Reinforced)', density: 25, unit: 'kN/m³' },
    { id: 'concrete_pcc', name: 'PCC (Plain)', density: 24, unit: 'kN/m³' },
    { id: 'brick_common', name: 'Brick Masonry', density: 19, unit: 'kN/m³' },
    { id: 'brick_flyash', name: 'Fly Ash Brick', density: 14, unit: 'kN/m³' },
    { id: 'steel', name: 'Structural Steel', density: 78.5, unit: 'kN/m³' },
    { id: 'timber', name: 'Timber (Avg)', density: 8, unit: 'kN/m³' },
    { id: 'glass', name: 'Glass (Plate)', density: 25, unit: 'kN/m³' },
    { id: 'soil_dry', name: 'Dry Earth', density: 16, unit: 'kN/m³' },
    { id: 'soil_wet', name: 'Wet Earth', density: 18, unit: 'kN/m³' },
    { id: 'water', name: 'Water', density: 10, unit: 'kN/m³' },
];

const FLOOR_FINISHES = [
    { id: 'tiles_25', name: 'Tiles (25mm)', load: 0.5, unit: 'kN/m²' },
    { id: 'tiles_40', name: 'Tiles (40mm)', load: 0.8, unit: 'kN/m²' },
    { id: 'marble_20', name: 'Marble (20mm)', load: 0.55, unit: 'kN/m²' },
    { id: 'granite_20', name: 'Granite (20mm)', load: 0.55, unit: 'kN/m²' },
    { id: 'wood_25', name: 'Wood Flooring (25mm)', load: 0.2, unit: 'kN/m²' },
    { id: 'screed_50', name: 'Cement Screed (50mm)', load: 1.0, unit: 'kN/m²' },
    { id: 'waterproofing', name: 'Waterproofing', load: 0.15, unit: 'kN/m²' },
];

// ============================================
// IS 875 PART 2: IMPOSED LOAD DATA (Table 1)
// ============================================

const OCCUPANCY_LOADS = [
    { id: 'residential', name: 'Residential (Dwelling)', load: 2.0, unit: 'kN/m²' },
    { id: 'office', name: 'Office Buildings', load: 2.5, unit: 'kN/m²' },
    { id: 'retail', name: 'Retail/Shops', load: 4.0, unit: 'kN/m²' },
    { id: 'assembly_fixed', name: 'Assembly (Fixed Seats)', load: 4.0, unit: 'kN/m²' },
    { id: 'assembly_moving', name: 'Assembly (Movable)', load: 5.0, unit: 'kN/m²' },
    { id: 'educational', name: 'Educational/Classrooms', load: 3.0, unit: 'kN/m²' },
    { id: 'hospital_ward', name: 'Hospital Wards', load: 2.0, unit: 'kN/m²' },
    { id: 'hospital_op', name: 'Hospital Operating Room', load: 3.0, unit: 'kN/m²' },
    { id: 'industrial_light', name: 'Industrial (Light)', load: 5.0, unit: 'kN/m²' },
    { id: 'industrial_heavy', name: 'Industrial (Heavy)', load: 10.0, unit: 'kN/m²' },
    { id: 'storage_light', name: 'Storage (Light)', load: 6.0, unit: 'kN/m²' },
    { id: 'storage_heavy', name: 'Storage (Heavy)', load: 12.0, unit: 'kN/m²' },
    { id: 'garage_light', name: 'Garage (Light Vehicles)', load: 2.5, unit: 'kN/m²' },
    { id: 'garage_heavy', name: 'Garage (Heavy)', load: 5.0, unit: 'kN/m²' },
    { id: 'stairs', name: 'Staircase', load: 5.0, unit: 'kN/m²' },
    { id: 'balcony', name: 'Balcony', load: 3.0, unit: 'kN/m²' },
    { id: 'terrace_accessible', name: 'Terrace (Accessible)', load: 1.5, unit: 'kN/m²' },
    { id: 'terrace_inaccessible', name: 'Terrace (Inaccessible)', load: 0.75, unit: 'kN/m²' },
];

// ============================================
// IS 875 PART 4: SNOW LOAD DATA
// ============================================

const SNOW_ZONES = [
    { id: 'zone1', name: 'Zone 1 (Coastal)', groundLoad: 0, description: 'No snow' },
    { id: 'zone2', name: 'Zone 2 (Plains)', groundLoad: 0.5, description: 'Light snow areas' },
    { id: 'zone3', name: 'Zone 3 (Hills 1500-2500m)', groundLoad: 1.5, description: 'Moderate snow' },
    { id: 'zone4', name: 'Zone 4 (Hills 2500-3500m)', groundLoad: 2.5, description: 'Heavy snow' },
    { id: 'zone5', name: 'Zone 5 (>3500m)', groundLoad: 5.0, description: 'Very heavy snow' },
];

// ============================================
// IS 875 PART 5: SPECIAL LOADS
// ============================================

const SPECIAL_LOADS = [
    { id: 'eot_crane_light', name: 'EOT Crane (5T)', verticalLoad: 50, horizontalLoad: 5 },
    { id: 'eot_crane_medium', name: 'EOT Crane (10T)', verticalLoad: 100, horizontalLoad: 10 },
    { id: 'eot_crane_heavy', name: 'EOT Crane (25T)', verticalLoad: 250, horizontalLoad: 25 },
    { id: 'impact_machinery', name: 'Machinery Impact', factor: 1.25 },
    { id: 'impact_elevator', name: 'Elevator Impact', factor: 2.0 },
    { id: 'partition', name: 'Partition Load', load: 1.0, unit: 'kN/m²' },
];

// ============================================
// CATEGORY CONFIG
// ============================================

const LOAD_CATEGORIES = [
    { id: 'dead' as LoadCategory, name: 'Dead Load', icon: Box, color: 'text-[#869ab8]', bgColor: 'bg-slate-500/10', description: 'IS 875 Part 1 - Self weight' },
    { id: 'imposed' as LoadCategory, name: 'Imposed Load', icon: Users, color: 'text-blue-400', bgColor: 'bg-blue-500/10', description: 'IS 875 Part 2 - Live loads' },
    { id: 'wind' as LoadCategory, name: 'Wind Load', icon: Wind, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', description: 'IS 875 Part 3 - Wind pressure' },
    { id: 'snow' as LoadCategory, name: 'Snow Load', icon: Snowflake, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10', description: 'IS 875 Part 4 - Snow' },
    { id: 'special' as LoadCategory, name: 'Special Loads', icon: Truck, color: 'text-orange-400', bgColor: 'bg-orange-500/10', description: 'IS 875 Part 5 - Crane, impact' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export const IS875LoadDialog: FC<IS875LoadDialogProps> = ({ isOpen, onClose, targetMemberId }) => {
    const showNotification = useUIStore((s) => s.showNotification);
    const addMemberLoad = useModelStore((s) => s.addMemberLoad);
    const selectedIds = useModelStore((s) => s.selectedIds);
    const members = useModelStore((s) => s.members);

    // State
    const [category, setCategory] = useState<LoadCategory>('imposed');
    const [loadType, setLoadType] = useState<'UDL' | 'UVL' | 'point'>('UDL');

    // Dead load state
    const [selectedMaterial, setSelectedMaterial] = useState(MATERIALS[0]);
    const [thickness, setThickness] = useState(0.15); // meters
    const [width, setWidth] = useState(1.0); // meters

    // Imposed load state
    const [selectedOccupancy, setSelectedOccupancy] = useState(OCCUPANCY_LOADS[0]);
    const [tributaryWidth, setTributaryWidth] = useState(3.0); // meters

    // Wind load state
    const [windPressure, setWindPressure] = useState(1.5); // kN/m²
    const [surfaceWidth, setSurfaceWidth] = useState(3.0); // meters

    // Snow load state
    const [selectedSnowZone, setSelectedSnowZone] = useState(SNOW_ZONES[2]);
    const [roofSlope, setRoofSlope] = useState(10); // degrees

    // Special load state
    const [selectedSpecial, setSelectedSpecial] = useState(SPECIAL_LOADS[0]);

    // Calculate final load
    const calculatedLoad = useMemo(() => {
        let load = 0;
        let formula = '';

        switch (category) {
            case 'dead':
                load = selectedMaterial.density * thickness * width;
                formula = `${selectedMaterial.density} × ${thickness} × ${width} = ${load.toFixed(2)} kN/m`;
                break;
            case 'imposed':
                load = selectedOccupancy.load * tributaryWidth;
                formula = `${selectedOccupancy.load} × ${tributaryWidth} = ${load.toFixed(2)} kN/m`;
                break;
            case 'wind':
                load = windPressure * surfaceWidth;
                formula = `${windPressure} × ${surfaceWidth} = ${load.toFixed(2)} kN/m`;
                break;
            case 'snow':
                // Snow load with slope factor
                const slopeFactor = Math.cos(roofSlope * Math.PI / 180);
                load = selectedSnowZone.groundLoad * 0.7 * slopeFactor * tributaryWidth;
                formula = `${selectedSnowZone.groundLoad} × 0.7 × cos(${roofSlope}°) × ${tributaryWidth} = ${load.toFixed(2)} kN/m`;
                break;
            case 'special':
                if ('load' in selectedSpecial) {
                    load = (selectedSpecial.load || 0) * tributaryWidth;
                    formula = `${selectedSpecial.load} × ${tributaryWidth} = ${load.toFixed(2)} kN/m`;
                } else if ('verticalLoad' in selectedSpecial) {
                    load = selectedSpecial.verticalLoad || 0;
                    formula = `Crane load = ${load.toFixed(2)} kN (point load)`;
                }
                break;
        }

        return { load, formula };
    }, [category, selectedMaterial, thickness, width, selectedOccupancy, tributaryWidth, windPressure, surfaceWidth, selectedSnowZone, roofSlope, selectedSpecial]);

    // Apply load
    const handleApplyLoad = () => {
        const memberId = targetMemberId || (selectedIds.size > 0 ? Array.from(selectedIds)[0] : null);

        if (!memberId || !members.has(memberId)) {
            showNotification('warning', 'Select a valid member before applying IS 875 load.');
            return;
        }

        const newLoad: MemberLoad = {
            id: `ML_${Date.now()}`,
            memberId,
            type: loadType,
            w1: -calculatedLoad.load, // Negative for downward
            w2: loadType === 'UVL' ? 0 : -calculatedLoad.load, // UVL varies to 0
            direction: category === 'wind' ? 'global_x' : 'global_y',
            startPos: 0,
            endPos: 1
        };

        addMemberLoad(newLoad);
        onClose();
    };

    const currentCategory = LOAD_CATEGORIES.find(c => c.id === category);
    const CategoryIcon = currentCategory?.icon || Box;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
                                <CategoryIcon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold">IS 875 Load Generator</DialogTitle>
                                <DialogDescription>Apply loads as per Indian Standards</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Content */}
                    <div className="p-6">
                        {/* Category Tabs */}
                        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                            {LOAD_CATEGORIES.map((cat) => {
                                const Icon = cat.icon;
                                return (
                                    <Button
                                        key={cat.id}
                                        variant={category === cat.id ? 'default' : 'outline'}
                                        onClick={() => setCategory(cat.id)}
                                        className="flex items-center gap-2 whitespace-nowrap"
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span className="text-sm font-medium tracking-wide">{cat.name}</span>
                                    </Button>
                                );
                            })}
                        </div>

                        {/* Load Type Selector */}
                        <div className="mb-6">
                            <Label className="text-[#869ab8] text-sm mb-2 block">Distribution Type</Label>
                            <div className="flex gap-2">
                                {[
                                    { id: 'UDL', label: 'Uniform (UDL)', icon: '▬▬▬' },
                                    { id: 'UVL', label: 'Varying (UVL)', icon: '◢' },
                                    { id: 'point', label: 'Point Load', icon: '↓' }
                                ].map((type) => (
                                    <Button
                                        key={type.id}
                                        variant="outline"
                                        onClick={() => setLoadType(type.id as 'UDL' | 'UVL' | 'point')}
                                        className={`flex-1 flex flex-col items-center gap-1 p-3 h-auto transition-all ${loadType === type.id
                                                ? 'border-blue-500 bg-blue-500/10'
                                                : 'border-[#1a2333] hover:border-slate-300 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        <span className="text-xl">{type.icon}</span>
                                        <span className="text-xs text-[#869ab8]">{type.label}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Category-specific inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column - Input Selection */}
                            <div className="space-y-4">
                                {category === 'dead' && (
                                    <>
                                        <div>
                                            <Label className="text-[#869ab8] text-sm mb-2 block">Material (IS 875 Part 1)</Label>
                                            <select
                                                value={selectedMaterial.id}
                                                onChange={(e) => setSelectedMaterial(MATERIALS.find(m => m.id === e.target.value) || MATERIALS[0])}
                                                className="w-full px-3 py-2.5 bg-[#131b2e] border border-[#1a2333] rounded-lg text-[#dae2fd]"
                                            >
                                                {MATERIALS.map(m => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.name} ({m.density} {m.unit})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label className="text-[#869ab8] text-sm mb-2 block">Thickness (m)</Label>
                                                <Input
                                                    type="number"
                                                    step={0.01}
                                                    value={thickness}
                                                    onChange={(e) => setThickness(parseFloat(e.target.value) || 0.15)}
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-[#869ab8] text-sm mb-2 block">Width (m)</Label>
                                                <Input
                                                    type="number"
                                                    step={0.1}
                                                    value={width}
                                                    onChange={(e) => setWidth(parseFloat(e.target.value) || 1)}
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {category === 'imposed' && (
                                    <>
                                        <div>
                                            <Label className="text-[#869ab8] text-sm mb-2 block">Occupancy Type (IS 875 Part 2 Table 1)</Label>
                                            <select
                                                value={selectedOccupancy.id}
                                                onChange={(e) => setSelectedOccupancy(OCCUPANCY_LOADS.find(o => o.id === e.target.value) || OCCUPANCY_LOADS[0])}
                                                className="w-full px-3 py-2.5 bg-[#131b2e] border border-[#1a2333] rounded-lg text-[#dae2fd]"
                                            >
                                                {OCCUPANCY_LOADS.map(o => (
                                                    <option key={o.id} value={o.id}>
                                                        {o.name} ({o.load} {o.unit})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <Label className="text-[#869ab8] text-sm mb-2 block">Tributary Width (m)</Label>
                                            <Input
                                                type="number"
                                                step={0.1}
                                                value={tributaryWidth}
                                                onChange={(e) => setTributaryWidth(parseFloat(e.target.value) || 3)}
                                            />
                                        </div>
                                    </>
                                )}

                                {category === 'wind' && (
                                    <>
                                        <div>
                                            <Label className="text-[#869ab8] text-sm mb-2 block">Design Wind Pressure Pz (kN/m²)</Label>
                                            <Input
                                                type="number"
                                                step={0.1}
                                                value={windPressure}
                                                onChange={(e) => setWindPressure(parseFloat(e.target.value) || 1.5)}
                                            />
                                            <p className="text-xs text-[#869ab8] mt-1">Use IS 875 Part 3 calculator to determine Pz</p>
                                        </div>
                                        <div>
                                            <Label className="text-[#869ab8] text-sm mb-2 block">Surface Width (m)</Label>
                                            <Input
                                                type="number"
                                                step={0.1}
                                                value={surfaceWidth}
                                                onChange={(e) => setSurfaceWidth(parseFloat(e.target.value) || 3)}
                                            />
                                        </div>
                                    </>
                                )}

                                {category === 'snow' && (
                                    <>
                                        <div>
                                            <Label className="text-[#869ab8] text-sm mb-2 block">Snow Zone (IS 875 Part 4)</Label>
                                            <select
                                                value={selectedSnowZone.id}
                                                onChange={(e) => setSelectedSnowZone(SNOW_ZONES.find(z => z.id === e.target.value) || SNOW_ZONES[2])}
                                                className="w-full px-3 py-2.5 bg-[#131b2e] border border-[#1a2333] rounded-lg text-[#dae2fd]"
                                            >
                                                {SNOW_ZONES.map(z => (
                                                    <option key={z.id} value={z.id}>
                                                        {z.name} - {z.groundLoad} kN/m²
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-[#869ab8] mt-1">{selectedSnowZone.description}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label className="text-[#869ab8] text-sm mb-2 block">Roof Slope (°)</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={60}
                                                    value={roofSlope}
                                                    onChange={(e) => setRoofSlope(parseFloat(e.target.value) || 10)}
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-[#869ab8] text-sm mb-2 block">Tributary Width (m)</Label>
                                                <Input
                                                    type="number"
                                                    step={0.1}
                                                    value={tributaryWidth}
                                                    onChange={(e) => setTributaryWidth(parseFloat(e.target.value) || 3)}
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {category === 'special' && (
                                    <>
                                        <div>
                                            <Label className="text-[#869ab8] text-sm mb-2 block">Special Load Type (IS 875 Part 5)</Label>
                                            <select
                                                value={selectedSpecial.id}
                                                onChange={(e) => setSelectedSpecial(SPECIAL_LOADS.find(s => s.id === e.target.value) || SPECIAL_LOADS[0])}
                                                className="w-full px-3 py-2.5 bg-[#131b2e] border border-[#1a2333] rounded-lg text-[#dae2fd]"
                                            >
                                                {SPECIAL_LOADS.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Right Column - Calculation Result */}
                            <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-4 border border-[#1a2333]">
                                <h3 className="text-[#dae2fd] font-semibold mb-4 flex items-center gap-2">
                                    <Calculator className="w-4 h-4 text-blue-400" />
                                    Calculated Load
                                </h3>

                                <div className="bg-slate-200/50 dark:bg-slate-900/50 rounded-lg p-4 mb-4 font-mono text-sm text-[#adc6ff]">
                                    {calculatedLoad.formula}
                                </div>

                                <div className="text-center py-6">
                                    <div className="text-4xl font-bold text-[#dae2fd]">
                                        {Math.abs(calculatedLoad.load).toFixed(2)}
                                    </div>
                                    <div className="text-[#869ab8]">
                                        kN/m {loadType === 'point' ? '(point)' : '(distributed)'}
                                    </div>
                                    <div className="text-xs text-[#869ab8] mt-2 flex items-center justify-center gap-1">
                                        <ArrowDown className="w-3 h-3" />
                                        Downward direction (gravity)
                                    </div>
                                </div>

                                {/* Target Info */}
                                <div className="bg-[#131b2e] rounded-lg p-3">
                                    <div className="text-xs text-[#869ab8]">Applying to</div>
                                    <div className="text-[#dae2fd] font-medium tracking-wide">
                                        {targetMemberId
                                            ? `Member ${targetMemberId}`
                                            : selectedIds.size > 0
                                                ? `Member ${Array.from(selectedIds)[0]}`
                                                : 'Select a member first'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="mt-6 bg-blue-100/50 dark:bg-blue-900/20 border border-[#1a2333] rounded-lg p-4 flex items-start gap-3">
                            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-[#adc6ff]">
                                <strong className="text-[#dae2fd]">{currentCategory?.description}</strong>
                                <p className="text-[#869ab8] mt-1">
                                    Load values are as per IS 875:2015. For critical structures, verify with latest code provisions.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <DialogFooter className="flex justify-between sm:justify-between">
                        <Button variant="ghost" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleApplyLoad}
                            disabled={!targetMemberId && selectedIds.size === 0}
                        >
                            <Check className="w-4 h-4 mr-2" />
                            Apply Load
                        </Button>
                    </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default IS875LoadDialog;
