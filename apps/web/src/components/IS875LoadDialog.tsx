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
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Box, Users, Wind, Snowflake, Truck,
    Calculator, ArrowDown, ArrowRight, Check, Copy,
    ChevronDown, Info
} from 'lucide-react';
import { useModelStore, MemberLoad } from '../store/model';

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
    { id: 'dead' as LoadCategory, name: 'Dead Load', icon: Box, color: 'text-gray-400', bgColor: 'bg-gray-500/10', description: 'IS 875 Part 1 - Self weight' },
    { id: 'imposed' as LoadCategory, name: 'Imposed Load', icon: Users, color: 'text-blue-400', bgColor: 'bg-blue-500/10', description: 'IS 875 Part 2 - Live loads' },
    { id: 'wind' as LoadCategory, name: 'Wind Load', icon: Wind, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', description: 'IS 875 Part 3 - Wind pressure' },
    { id: 'snow' as LoadCategory, name: 'Snow Load', icon: Snowflake, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10', description: 'IS 875 Part 4 - Snow' },
    { id: 'special' as LoadCategory, name: 'Special Loads', icon: Truck, color: 'text-orange-400', bgColor: 'bg-orange-500/10', description: 'IS 875 Part 5 - Crane, impact' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export const IS875LoadDialog: FC<IS875LoadDialogProps> = ({ isOpen, onClose, targetMemberId }) => {
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
            alert('Please select a member to apply the load');
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

    if (!isOpen) return null;

    const currentCategory = LOAD_CATEGORIES.find(c => c.id === category);
    const CategoryIcon = currentCategory?.icon || Box;

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
                    className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl"
                >
                    {/* Header */}
                    <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center`}>
                                <CategoryIcon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">IS 875 Load Generator</h2>
                                <p className="text-sm text-zinc-400">Apply loads as per Indian Standards</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Category Tabs */}
                        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                            {LOAD_CATEGORIES.map((cat) => {
                                const Icon = cat.icon;
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => setCategory(cat.id)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${category === cat.id
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span className="text-sm font-medium">{cat.name}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Load Type Selector */}
                        <div className="mb-6">
                            <label className="text-zinc-400 text-sm mb-2 block">Distribution Type</label>
                            <div className="flex gap-2">
                                {[
                                    { id: 'UDL', label: 'Uniform (UDL)', icon: '▬▬▬' },
                                    { id: 'UVL', label: 'Varying (UVL)', icon: '◢' },
                                    { id: 'point', label: 'Point Load', icon: '↓' }
                                ].map((type) => (
                                    <button
                                        key={type.id}
                                        onClick={() => setLoadType(type.id as 'UDL' | 'UVL' | 'point')}
                                        className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${loadType === type.id
                                                ? 'border-blue-500 bg-blue-500/10'
                                                : 'border-zinc-700 hover:border-zinc-600'
                                            }`}
                                    >
                                        <span className="text-xl">{type.icon}</span>
                                        <span className="text-xs text-zinc-400">{type.label}</span>
                                    </button>
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
                                            <label className="text-zinc-400 text-sm mb-2 block">Material (IS 875 Part 1)</label>
                                            <select
                                                value={selectedMaterial.id}
                                                onChange={(e) => setSelectedMaterial(MATERIALS.find(m => m.id === e.target.value) || MATERIALS[0])}
                                                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
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
                                                <label className="text-zinc-400 text-sm mb-2 block">Thickness (m)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={thickness}
                                                    onChange={(e) => setThickness(parseFloat(e.target.value) || 0.15)}
                                                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-zinc-400 text-sm mb-2 block">Width (m)</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={width}
                                                    onChange={(e) => setWidth(parseFloat(e.target.value) || 1)}
                                                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {category === 'imposed' && (
                                    <>
                                        <div>
                                            <label className="text-zinc-400 text-sm mb-2 block">Occupancy Type (IS 875 Part 2 Table 1)</label>
                                            <select
                                                value={selectedOccupancy.id}
                                                onChange={(e) => setSelectedOccupancy(OCCUPANCY_LOADS.find(o => o.id === e.target.value) || OCCUPANCY_LOADS[0])}
                                                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                            >
                                                {OCCUPANCY_LOADS.map(o => (
                                                    <option key={o.id} value={o.id}>
                                                        {o.name} ({o.load} {o.unit})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-zinc-400 text-sm mb-2 block">Tributary Width (m)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={tributaryWidth}
                                                onChange={(e) => setTributaryWidth(parseFloat(e.target.value) || 3)}
                                                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                            />
                                        </div>
                                    </>
                                )}

                                {category === 'wind' && (
                                    <>
                                        <div>
                                            <label className="text-zinc-400 text-sm mb-2 block">Design Wind Pressure Pz (kN/m²)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={windPressure}
                                                onChange={(e) => setWindPressure(parseFloat(e.target.value) || 1.5)}
                                                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                            />
                                            <p className="text-xs text-zinc-400 mt-1">Use IS 875 Part 3 calculator to determine Pz</p>
                                        </div>
                                        <div>
                                            <label className="text-zinc-400 text-sm mb-2 block">Surface Width (m)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={surfaceWidth}
                                                onChange={(e) => setSurfaceWidth(parseFloat(e.target.value) || 3)}
                                                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                            />
                                        </div>
                                    </>
                                )}

                                {category === 'snow' && (
                                    <>
                                        <div>
                                            <label className="text-zinc-400 text-sm mb-2 block">Snow Zone (IS 875 Part 4)</label>
                                            <select
                                                value={selectedSnowZone.id}
                                                onChange={(e) => setSelectedSnowZone(SNOW_ZONES.find(z => z.id === e.target.value) || SNOW_ZONES[2])}
                                                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                            >
                                                {SNOW_ZONES.map(z => (
                                                    <option key={z.id} value={z.id}>
                                                        {z.name} - {z.groundLoad} kN/m²
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-zinc-400 mt-1">{selectedSnowZone.description}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-zinc-400 text-sm mb-2 block">Roof Slope (°)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="60"
                                                    value={roofSlope}
                                                    onChange={(e) => setRoofSlope(parseFloat(e.target.value) || 10)}
                                                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-zinc-400 text-sm mb-2 block">Tributary Width (m)</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={tributaryWidth}
                                                    onChange={(e) => setTributaryWidth(parseFloat(e.target.value) || 3)}
                                                    className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {category === 'special' && (
                                    <>
                                        <div>
                                            <label className="text-zinc-400 text-sm mb-2 block">Special Load Type (IS 875 Part 5)</label>
                                            <select
                                                value={selectedSpecial.id}
                                                onChange={(e) => setSelectedSpecial(SPECIAL_LOADS.find(s => s.id === e.target.value) || SPECIAL_LOADS[0])}
                                                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
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
                            <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
                                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                    <Calculator className="w-4 h-4 text-blue-400" />
                                    Calculated Load
                                </h3>

                                <div className="bg-zinc-900/50 rounded-lg p-4 mb-4 font-mono text-sm text-zinc-300">
                                    {calculatedLoad.formula}
                                </div>

                                <div className="text-center py-6">
                                    <div className="text-4xl font-bold text-white">
                                        {Math.abs(calculatedLoad.load).toFixed(2)}
                                    </div>
                                    <div className="text-zinc-400">
                                        kN/m {loadType === 'point' ? '(point)' : '(distributed)'}
                                    </div>
                                    <div className="text-xs text-zinc-400 mt-2 flex items-center justify-center gap-1">
                                        <ArrowDown className="w-3 h-3" />
                                        Downward direction (gravity)
                                    </div>
                                </div>

                                {/* Target Info */}
                                <div className="bg-zinc-800 rounded-lg p-3">
                                    <div className="text-xs text-zinc-400">Applying to</div>
                                    <div className="text-white font-medium">
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
                        <div className="mt-6 bg-blue-900/20 border border-blue-800 rounded-lg p-4 flex items-start gap-3">
                            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-zinc-300">
                                <strong className="text-white">{currentCategory?.description}</strong>
                                <p className="text-zinc-400 mt-1">
                                    Load values are as per IS 875:2015. For critical structures, verify with latest code provisions.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="sticky bottom-0 px-6 py-4 border-t border-zinc-800 bg-zinc-900 flex justify-between">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApplyLoad}
                            disabled={!targetMemberId && selectedIds.size === 0}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <Check className="w-4 h-4" />
                            Apply Load
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default IS875LoadDialog;
