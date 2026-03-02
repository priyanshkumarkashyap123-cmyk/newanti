/**
 * FoundationDesignDialog.tsx - Soil Conditions & Foundation Design
 * 
 * Features:
 * - Soil type selection with bearing capacity
 * - Isolated footing design (IS 456)
 * - Column load input from reactions
 * - Rebar calculation and sizing
 */

import { FC, useState, useEffect, useMemo } from 'react';
import {
    X, Layers, ArrowRight, Calculator, Check,
    AlertTriangle, Info, Download, ChevronDown
} from 'lucide-react';
import { useModelStore } from '../store/model';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

// ============================================
// TYPES
// ============================================

interface SoilType {
    id: string;
    name: string;
    description: string;
    bearingCapacity: number; // kN/m²
    color: string;
}

interface FoundationResult {
    type: 'isolated' | 'combined' | 'raft';
    columnId: string;
    columnLoad: number; // kN
    moment: number; // kN-m
    requiredWidth: number; // m
    requiredLength: number; // m
    requiredDepth: number; // m
    areaRequired: number; // m²
    areaProvided: number; // m²
    bearingPressure: number; // kN/m²
    safetyFactor: number;
    status: 'safe' | 'unsafe' | 'marginal';
    rebarMain: string; // e.g., "12Ø @ 150 c/c"
    rebarDist: string;
    concreteVolume: number; // m³
}

interface FoundationDesignDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

// ============================================
// SOIL TYPES DATA
// ============================================

const SOIL_TYPES: SoilType[] = [
    {
        id: 'soft_clay',
        name: 'Soft Clay',
        description: 'Weak bearing capacity, high settlement potential',
        bearingCapacity: 100,
        color: 'bg-amber-600'
    },
    {
        id: 'medium_clay',
        name: 'Medium Clay',
        description: 'Moderate strength, typical for residential',
        bearingCapacity: 150,
        color: 'bg-amber-500'
    },
    {
        id: 'stiff_clay',
        name: 'Stiff Clay',
        description: 'Good bearing capacity for multi-story',
        bearingCapacity: 200,
        color: 'bg-amber-400'
    },
    {
        id: 'loose_sand',
        name: 'Loose Sand',
        description: 'Low density, requires compaction',
        bearingCapacity: 100,
        color: 'bg-yellow-500'
    },
    {
        id: 'medium_sand',
        name: 'Medium Dense Sand',
        description: 'Good for shallow foundations',
        bearingCapacity: 200,
        color: 'bg-yellow-400'
    },
    {
        id: 'dense_sand',
        name: 'Dense Sand/Gravel',
        description: 'Excellent for heavy loads',
        bearingCapacity: 300,
        color: 'bg-yellow-300'
    },
    {
        id: 'hard_rock',
        name: 'Hard Rock',
        description: 'Maximum bearing capacity',
        bearingCapacity: 1000,
        color: 'bg-slate-400'
    },
    {
        id: 'weathered_rock',
        name: 'Weathered Rock',
        description: 'Good capacity with some variation',
        bearingCapacity: 500,
        color: 'bg-slate-500'
    },
];

// ============================================
// DESIGN FUNCTIONS
// ============================================

function designIsolatedFooting(
    columnLoad: number,
    moment: number,
    bearingCapacity: number,
    fck: number = 25, // M25 concrete
    fy: number = 500 // Fe500 steel
): Omit<FoundationResult, 'columnId'> {
    // Safety factor for bearing capacity
    const SBC = bearingCapacity; // Safe Bearing Capacity (kN/m²)

    // Eccentricity from moment
    const eccentricity = moment > 0 ? moment / columnLoad : 0;

    // Required area with eccentricity consideration
    const effectiveLoad = columnLoad * (1 + 6 * eccentricity / 1.5); // Approximate
    const areaRequired = effectiveLoad / SBC;

    // Square footing dimensions
    const sideRequired = Math.sqrt(areaRequired);
    const sideProvided = Math.ceil(sideRequired * 10) / 10; // Round up to 0.1m
    const minSide = Math.max(sideProvided, 1.0); // Minimum 1m

    const areaProvided = minSide * minSide;

    // Actual bearing pressure
    const bearingPressure = columnLoad / areaProvided;
    const safetyFactor = SBC / bearingPressure;

    // Depth calculation (one-way shear criterion)
    // Approximate depth = 0.15 * side + 0.2
    const requiredDepth = Math.max(0.3, 0.15 * minSide + 0.15);
    const depthProvided = Math.ceil(requiredDepth * 20) / 20; // Round to 0.05m

    // Reinforcement calculation (simplified IS 456)
    // Bending moment at critical section
    const overhang = (minSide - 0.4) / 2; // Assuming 400mm column
    const BM = bearingPressure * minSide * overhang * overhang / 2;

    // Required steel (approximate)
    const d = depthProvided - 0.075; // Effective depth
    const Ast = BM * 1e6 / (0.87 * fy * 0.9 * d * 1000); // mm²/m

    // Bar spacing
    const barDia = Ast > 800 ? 16 : Ast > 400 ? 12 : 10;
    const barArea = Math.PI * barDia * barDia / 4;
    const spacing = Math.floor((barArea * 1000) / Math.max(Ast, 200)); // Min 200 mm²/m
    const spacingProvided = Math.min(spacing, 200); // Max 200mm c/c

    // Determine status
    let status: 'safe' | 'unsafe' | 'marginal';
    if (safetyFactor >= 2) {
        status = 'safe';
    } else if (safetyFactor >= 1.5) {
        status = 'marginal';
    } else {
        status = 'unsafe';
    }

    return {
        type: 'isolated',
        columnLoad,
        moment,
        requiredWidth: minSide,
        requiredLength: minSide,
        requiredDepth: depthProvided,
        areaRequired,
        areaProvided,
        bearingPressure,
        safetyFactor,
        status,
        rebarMain: `${barDia}Ø @ ${spacingProvided} c/c both ways`,
        rebarDist: `8Ø @ 200 c/c (distribution)`,
        concreteVolume: minSide * minSide * depthProvided
    };
}

// ============================================
// SELECT COMPONENT
// ============================================

interface SelectProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
}

const Select: FC<SelectProps> = ({ label, value, onChange, options }) => (
    <div className="flex flex-col gap-2">
        <Label className="text-slate-500 dark:text-slate-400 text-sm font-medium">{label}</Label>
        <div className="relative">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white h-11 px-4 pr-10 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400 pointer-events-none" />
        </div>
    </div>
);

// ============================================
// INPUT COMPONENT
// ============================================

interface InputProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    unit?: string;
    min?: number;
    max?: number;
    step?: number;
}

const NumberInput: FC<InputProps> = ({ label, value, onChange, unit, min = 0, max, step = 1 }) => (
    <div className="flex flex-col gap-2">
        <Label className="text-slate-500 dark:text-slate-400 text-sm font-medium">{label}</Label>
        <div className="relative">
            <Input
                type="number"
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                min={min}
                max={max}
                step={step}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white h-11 px-4 pr-12 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
            />
            {unit && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 text-sm">
                    {unit}
                </span>
            )}
        </div>
    </div>
);

// ============================================
// RESULT CARD
// ============================================

const ResultCard: FC<{ result: FoundationResult }> = ({ result }) => {
    const statusColors = {
        safe: 'border-green-500 bg-green-500/10',
        marginal: 'border-yellow-500 bg-yellow-500/10',
        unsafe: 'border-red-500 bg-red-500/10'
    };

    const statusIcons = {
        safe: <Check className="w-5 h-5 text-green-500" />,
        marginal: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
        unsafe: <X className="w-5 h-5 text-red-500" />
    };

    return (
        <div className={`rounded-lg border-2 p-4 ${statusColors[result.status]}`}>
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-slate-900 dark:text-white font-semibold">Foundation Design</h4>
                <div className="flex items-center gap-2">
                    {statusIcons[result.status]}
                    <span className={`text-sm font-medium capitalize ${result.status === 'safe' ? 'text-green-500' :
                            result.status === 'marginal' ? 'text-yellow-500' : 'text-red-500'
                        }`}>
                        {result.status}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                    <span className="text-slate-500 dark:text-slate-400">Size</span>
                    <p className="text-slate-900 dark:text-white font-medium">{result.requiredWidth}m × {result.requiredLength}m</p>
                </div>
                <div>
                    <span className="text-slate-500 dark:text-slate-400">Depth</span>
                    <p className="text-slate-900 dark:text-white font-medium">{result.requiredDepth}m</p>
                </div>
                <div>
                    <span className="text-slate-500 dark:text-slate-400">Bearing Pressure</span>
                    <p className="text-slate-900 dark:text-white font-medium">{result.bearingPressure.toFixed(1)} kN/m²</p>
                </div>
                <div>
                    <span className="text-slate-500 dark:text-slate-400">Safety Factor</span>
                    <p className="text-slate-900 dark:text-white font-medium">{result.safetyFactor.toFixed(2)}</p>
                </div>
                <div className="col-span-2">
                    <span className="text-slate-500 dark:text-slate-400">Main Reinforcement</span>
                    <p className="text-slate-900 dark:text-white font-medium">{result.rebarMain}</p>
                </div>
                <div className="col-span-2">
                    <span className="text-slate-500 dark:text-slate-400">Concrete Volume</span>
                    <p className="text-slate-900 dark:text-white font-medium">{result.concreteVolume.toFixed(2)} m³</p>
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const FoundationDesignDialog: FC<FoundationDesignDialogProps> = ({ isOpen, onClose }) => {
    // Store
    const analysisResults = useModelStore((s) => s.analysisResults);
    const nodes = useModelStore((s) => s.nodes);

    // State
    const [selectedSoil, setSelectedSoil] = useState<string>('medium_sand');
    const [customBearing, setCustomBearing] = useState<number>(200);
    const [useCustomBearing, setUseCustomBearing] = useState(false);
    const [columnLoad, setColumnLoad] = useState<number>(500);
    const [moment, setMoment] = useState<number>(50);
    const [foundationDepth, setFoundationDepth] = useState<number>(1.5);
    const [waterTable, setWaterTable] = useState<number>(3.0);
    const [concreteGrade, setConcreteGrade] = useState<string>('M25');

    // Get bearing capacity
    const bearingCapacity = useMemo(() => {
        if (useCustomBearing) return customBearing;
        const soil = SOIL_TYPES.find(s => s.id === selectedSoil);
        return soil?.bearingCapacity || 200;
    }, [selectedSoil, customBearing, useCustomBearing]);

    // Calculate foundation
    const result = useMemo(() => {
        const fck = parseInt(concreteGrade.replace('M', ''));
        return designIsolatedFooting(columnLoad, moment, bearingCapacity, fck);
    }, [columnLoad, moment, bearingCapacity, concreteGrade]);

    // Auto-populate from reactions
    useEffect(() => {
        if (analysisResults?.reactions) {
            // Defer to avoid synchronous setState at effect start
            queueMicrotask(() => {
                // Find maximum reaction
                let maxReaction = 0;
                let maxMoment = 0;
                analysisResults.reactions.forEach((reaction) => {
                    const totalVertical = Math.abs(reaction.fy);
                    if (totalVertical > maxReaction) {
                        maxReaction = totalVertical;
                        maxMoment = Math.abs(reaction.mz || 0);
                    }
                });
                if (maxReaction > 0) {
                    setColumnLoad(Math.round(maxReaction));
                    setMoment(Math.round(maxMoment));
                }
            });
        }
    }, [analysisResults]);

    const selectedSoilData = SOIL_TYPES.find(s => s.id === selectedSoil);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center">
                                <Layers className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold">Foundation Design</DialogTitle>
                                <DialogDescription>Soil conditions & isolated footing</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Soil Properties Section */}
                        <section>
                            <h3 className="text-slate-900 dark:text-white font-semibold mb-4 flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-amber-500/20 flex items-center justify-center text-amber-500 text-xs font-bold">1</div>
                                Soil Properties
                            </h3>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                {SOIL_TYPES.map((soil) => (
                                    <button type="button"
                                        key={soil.id}
                                        onClick={() => {
                                            setSelectedSoil(soil.id);
                                            setUseCustomBearing(false);
                                        }}
                                        className={`p-3 rounded-lg border text-left transition-all ${selectedSoil === soil.id && !useCustomBearing
                                                ? 'border-blue-500 bg-blue-500/10'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        <div className={`w-4 h-4 rounded ${soil.color} mb-2`} />
                                        <p className="text-slate-900 dark:text-white text-sm font-medium">{soil.name}</p>
                                        <p className="text-slate-500 dark:text-slate-400 text-xs">{soil.bearingCapacity} kN/m²</p>
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={useCustomBearing}
                                        onChange={(e) => setUseCustomBearing(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-600 bg-white dark:bg-slate-900 text-blue-600"
                                    />
                                    <span className="text-slate-600 dark:text-slate-300 text-sm">Custom Bearing Capacity</span>
                                </label>
                                {useCustomBearing && (
                                    <div className="flex-1">
                                        <NumberInput
                                            label=""
                                            value={customBearing}
                                            onChange={setCustomBearing}
                                            unit="kN/m²"
                                            min={50}
                                            max={2000}
                                        />
                                    </div>
                                )}
                            </div>

                            {selectedSoilData && !useCustomBearing && (
                                <div className="mt-3 p-3 rounded-lg bg-slate-100/30 dark:bg-slate-800/30 flex items-start gap-2">
                                    <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">{selectedSoilData.description}</p>
                                </div>
                            )}
                        </section>

                        {/* Loading Section */}
                        <section>
                            <h3 className="text-slate-900 dark:text-white font-semibold mb-4 flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center text-blue-500 text-xs font-bold">2</div>
                                Column Loading
                                {analysisResults && (
                                    <span className="text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded">
                                        Auto-populated from analysis
                                    </span>
                                )}
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                <NumberInput
                                    label="Axial Load (P)"
                                    value={columnLoad}
                                    onChange={setColumnLoad}
                                    unit="kN"
                                    min={10}
                                    step={10}
                                />
                                <NumberInput
                                    label="Moment (M)"
                                    value={moment}
                                    onChange={setMoment}
                                    unit="kN-m"
                                    min={0}
                                    step={5}
                                />
                                <NumberInput
                                    label="Foundation Depth"
                                    value={foundationDepth}
                                    onChange={setFoundationDepth}
                                    unit="m"
                                    min={0.5}
                                    max={5}
                                    step={0.1}
                                />
                                <NumberInput
                                    label="Water Table Depth"
                                    value={waterTable}
                                    onChange={setWaterTable}
                                    unit="m"
                                    min={0}
                                    step={0.5}
                                />
                            </div>
                        </section>

                        {/* Material Section */}
                        <section>
                            <h3 className="text-slate-900 dark:text-white font-semibold mb-4 flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-green-500/20 flex items-center justify-center text-green-500 text-xs font-bold">3</div>
                                Concrete Grade
                            </h3>

                            <div className="flex gap-2">
                                {['M20', 'M25', 'M30', 'M35', 'M40'].map((grade) => (
                                    <button type="button"
                                        key={grade}
                                        onClick={() => setConcreteGrade(grade)}
                                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${concreteGrade === grade
                                                ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        {grade}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Results Section */}
                        <section>
                            <h3 className="text-slate-900 dark:text-white font-semibold mb-4 flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center text-purple-500 text-xs font-bold">4</div>
                                Design Results
                            </h3>

                            <ResultCard result={{ ...result, columnId: 'C1' }} />
                        </section>
                    </div>

                    {/* Footer */}
                    <DialogFooter className="flex justify-between sm:justify-between">
                        <Button variant="ghost" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button className="flex items-center gap-2">
                            <Download className="w-4 h-4" />
                            Export Design
                        </Button>
                    </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default FoundationDesignDialog;
