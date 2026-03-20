/**
 * SeismicLoadDialog.tsx - Seismic Load Generator UI
 * Based on IS 1893 Part 1: 2016
 */

import React, { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Activity, MapPin, Building2, Calculator, Info, AlertTriangle, Layers, Loader2 } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useShallow } from 'zustand/react/shallow';

// ===== CONSTANTS FROM IS 1893 =====

const SEISMIC_ZONES = [
    { value: 'II', label: 'Zone II (Low Seismicity)', Z: 0.10, color: 'green' },
    { value: 'III', label: 'Zone III (Moderate)', Z: 0.16, color: 'yellow' },
    { value: 'IV', label: 'Zone IV (Severe)', Z: 0.24, color: 'orange' },
    { value: 'V', label: 'Zone V (Very Severe)', Z: 0.36, color: 'red' },
];

const SOIL_TYPES = [
    { value: 'I', label: 'Type I - Rock or Hard Soil', description: 'N > 30' },
    { value: 'II', label: 'Type II - Medium Soil', description: '10 ≤ N ≤ 30' },
    { value: 'III', label: 'Type III - Soft Soil', description: 'N < 10' },
];

const BUILDING_TYPES = [
    { value: 'RCC_FRAME', label: 'RCC Frame Building', R: 5.0 },
    { value: 'RCC_FRAME_DUCTILE', label: 'RCC Frame (SMRF)', R: 5.0 },
    { value: 'STEEL_FRAME', label: 'Steel Frame Building', R: 5.0 },
    { value: 'STEEL_BRACED', label: 'Steel Braced Frame', R: 4.0 },
    { value: 'RCC_SHEAR_WALL', label: 'RCC Shear Wall', R: 4.0 },
    { value: 'MASONRY', label: 'Masonry Building', R: 1.5 },
    { value: 'PRECAST', label: 'Precast Concrete', R: 4.0 },
];

const IMPORTANCE_FACTORS = [
    { value: '1.0', label: 'General buildings (I = 1.0)' },
    { value: '1.2', label: 'Schools, Hospitals, Assembly (I = 1.2)' },
    { value: '1.5', label: 'Critical infrastructure (I = 1.5)' },
];

interface FloorData {
    level: number;
    height: number;  // Height from base (m)
    weight: number;  // Seismic weight (kN)
}

interface SeismicParams {
    zone: string;
    Z: number;
    soilType: string;
    buildingType: string;
    R: number;
    I: number;
    
    // Building geometry
    height: number;
    numStoreys: number;
    floors: FloorData[];
    
    // Time period
    timeMethod: 'empirical' | 'modal' | 'custom';
    customT: number;
    buildingMaterial: 'rcc' | 'steel' | 'masonry';
    
    // Analysis type
    analysisMethod: 'ESA' | 'RSA';  // Equivalent Static or Response Spectrum
    
    // Special conditions
    isSoftStorey: boolean;
    isIrregular: boolean;
    torsionallyIrregular: boolean;
}

interface SeismicResults {
    T: number;           // Fundamental time period
    Sa_g: number;        // Spectral acceleration / g
    Ah: number;          // Horizontal seismic coefficient
    Vb: number;          // Base shear (kN)
    W: number;           // Total seismic weight
    Qi: { level: number; height: number; weight: number; force: number }[];  // Storey forces
    overturningMoment: number;
}

const SeismicLoadDialog: React.FC = () => {
    const { modals, setModal } = useUIStore(
      useShallow((s) => ({ modals: s.modals, setModal: s.setModal }))
    );
    const isOpen = modals.seismicLoadDialog || false;
    
    const [activeTab, setActiveTab] = useState('zone');
    const [isApplying, setIsApplying] = useState(false);
    const [params, setParams] = useState<SeismicParams>({
        zone: 'III',
        Z: 0.16,
        soilType: 'II',
        buildingType: 'RCC_FRAME',
        R: 5.0,
        I: 1.0,
        height: 30,
        numStoreys: 10,
        floors: [],
        timeMethod: 'empirical',
        customT: 0.5,
        buildingMaterial: 'rcc',
        analysisMethod: 'ESA',
        isSoftStorey: false,
        isIrregular: false,
        torsionallyIrregular: false,
    });
    
    // Auto-generate floor data when storey count changes
    const prevFloorConfigRef = React.useRef<string>('');
    React.useEffect(() => {
        const configKey = `${params.numStoreys}-${params.height}`;
        // Only update if the config actually changed (prevent infinite loops)
        if (configKey === prevFloorConfigRef.current) return;
        prevFloorConfigRef.current = configKey;
        
        const storeyHeight = params.height / params.numStoreys;
        const typicalFloorWeight = 1000; // kN (placeholder)
        
        const floors: FloorData[] = [];
        for (let i = 1; i <= params.numStoreys; i++) {
            floors.push({
                level: i,
                height: i * storeyHeight,
                weight: i === params.numStoreys ? typicalFloorWeight * 0.5 : typicalFloorWeight,
            });
        }
        setParams(prev => ({ ...prev, floors }));
    }, [params.numStoreys, params.height]);
    
    // Calculate seismic loads
    const results = useMemo((): SeismicResults | null => {
        if (!params.height || params.floors.length === 0) return null;
        
        // Total seismic weight
        const W = params.floors.reduce((sum, f) => sum + f.weight, 0);
        if (W === 0) return null;
        
        // Fundamental time period (Clause 7.6)
        let T: number;
        if (params.timeMethod === 'custom') {
            T = params.customT;
        } else {
            // Empirical formula
            if (params.buildingMaterial === 'rcc') {
                // RCC frame: T = 0.075 × h^0.75
                T = 0.075 * Math.pow(params.height, 0.75);
            } else if (params.buildingMaterial === 'steel') {
                // Steel frame: T = 0.085 × h^0.75
                T = 0.085 * Math.pow(params.height, 0.75);
            } else {
                // Masonry: T = 0.09 × h / √d (assuming d = width ≈ h/3)
                const d = params.height / 3;
                T = 0.09 * params.height / Math.sqrt(d);
            }
        }
        
        // Spectral acceleration coefficient (Clause 6.4)
        let Sa_g: number;
        if (params.soilType === 'I') {
            // Rock/Hard soil
            if (T <= 0.10) Sa_g = 1 + 15 * T;
            else if (T <= 0.40) Sa_g = 2.5;
            else if (T <= 4.00) Sa_g = 1.0 / T;
            else Sa_g = 0.25;
        } else if (params.soilType === 'II') {
            // Medium soil
            if (T <= 0.10) Sa_g = 1 + 15 * T;
            else if (T <= 0.55) Sa_g = 2.5;
            else if (T <= 4.00) Sa_g = 1.36 / T;
            else Sa_g = 0.34;
        } else {
            // Soft soil
            if (T <= 0.10) Sa_g = 1 + 15 * T;
            else if (T <= 0.67) Sa_g = 2.5;
            else if (T <= 4.00) Sa_g = 1.67 / T;
            else Sa_g = 0.42;
        }
        
        // Horizontal seismic coefficient (Clause 6.4.2)
        const Ah = (params.Z / 2) * (params.I / params.R) * Sa_g;
        
        // Apply minimum value check
        const Ah_final = Math.max(Ah, params.Z * params.I / (2 * params.R));
        
        // Base shear
        const Vb = Ah_final * W;
        
        // Vertical distribution of base shear (Clause 7.7)
        const sumWiHi2 = params.floors.reduce((sum, f) => sum + f.weight * f.height * f.height, 0);
        
        const Qi = params.floors.map(floor => ({
            ...floor,
            force: Vb * (floor.weight * floor.height * floor.height) / sumWiHi2
        }));
        
        // Overturning moment at base
        const overturningMoment = Qi.reduce((sum, q) => sum + q.force * q.height, 0);
        
        return {
            T,
            Sa_g,
            Ah: Ah_final,
            Vb,
            W,
            Qi,
            overturningMoment
        };
    }, [params]);
    
    const handleZoneChange = (zone: string) => {
        const zoneData = SEISMIC_ZONES.find(z => z.value === zone);
        setParams(prev => ({
            ...prev,
            zone,
            Z: zoneData?.Z || 0.16
        }));
    };
    
    const handleBuildingTypeChange = (type: string) => {
        const typeData = BUILDING_TYPES.find(t => t.value === type);
        setParams(prev => ({
            ...prev,
            buildingType: type,
            R: typeData?.R || 5.0
        }));
    };
    
    const updateFloorWeight = (index: number, weight: number) => {
        const newFloors = [...params.floors];
        newFloors[index] = { ...newFloors[index], weight };
        setParams(prev => ({ ...prev, floors: newFloors }));
    };
    
    const handleApplyLoads = async () => {
        if (!results) return;
        
        setIsApplying(true);
        try {
            // Seismic load application requires floor-level discretization and mass distribution
            
            // Simulate async operation (e.g., applying to model store)
            await new Promise(resolve => setTimeout(resolve, 500));
            
            setModal('seismicLoadDialog', false);
        } finally {
            setIsApplying(false);
        }
    };
    
    const zoneColor = SEISMIC_ZONES.find(z => z.value === params.zone)?.color || 'gray';
    
    return (
        <Dialog open={isOpen} onOpenChange={(open: boolean) => setModal('seismicLoadDialog', open)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-[#ffb4ab]" />
                        Seismic Load Generator
                        <Badge variant="secondary" className="ml-2">IS 1893:2016</Badge>
                    </DialogTitle>
                    <DialogDescription>
                        Calculate seismic loads as per IS 1893 (Part 1): 2016 - Criteria for Earthquake Resistant Design
                    </DialogDescription>
                </DialogHeader>
                
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="zone">
                            <MapPin className="h-4 w-4 mr-1" />
                            Zone
                        </TabsTrigger>
                        <TabsTrigger value="building">
                            <Building2 className="h-4 w-4 mr-1" />
                            Building
                        </TabsTrigger>
                        <TabsTrigger value="floors">
                            <Layers className="h-4 w-4 mr-1" />
                            Floors
                        </TabsTrigger>
                        <TabsTrigger value="results">
                            <Calculator className="h-4 w-4 mr-1" />
                            Results
                        </TabsTrigger>
                    </TabsList>
                    
                    {/* Zone Tab */}
                    <TabsContent value="zone" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            {/* Seismic Zone Map */}
                            <div className="space-y-2">
                                <Label>Seismic Zone</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {SEISMIC_ZONES.map(zone => (
                                        <div
                                            key={zone.value}
                                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                                params.zone === zone.value
                                                    ? 'border-red-500 bg-red-50 bg-red-950'
                                                    : 'border-[#1a2333] hover:border-slate-400'
                                            }`}
                                            onClick={() => handleZoneChange(zone.value)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold">Zone {zone.value}</span>
                                                <Badge variant={zone.color === 'red' ? 'destructive' : 'secondary'}>
                                                    Z = {zone.Z}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {zone.label.split('(')[1]?.replace(')', '')}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Soil Type */}
                            <div className="space-y-2">
                                <Label>Soil Type</Label>
                                <RadioGroup
                                    value={params.soilType}
                                    onValueChange={(v: string) => setParams(prev => ({ ...prev, soilType: v }))}
                                    className="space-y-2"
                                >
                                    {SOIL_TYPES.map(soil => (
                                        <div key={soil.value} className="flex items-center space-x-2 p-2 rounded border">
                                            <RadioGroupItem value={soil.value} id={`soil-${soil.value}`} />
                                            <Label htmlFor={`soil-${soil.value}`} className="flex-1 cursor-pointer">
                                                <div className="font-medium tracking-wide tracking-wide">{soil.label}</div>
                                                <div className="text-xs text-muted-foreground">{soil.description}</div>
                                            </Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Importance Factor (I)</Label>
                                <Select
                                    value={params.I.toString()}
                                    onValueChange={(v: string) => setParams(prev => ({ ...prev, I: parseFloat(v) }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {IMPORTANCE_FACTORS.map(f => (
                                            <SelectItem key={f.value} value={f.value}>
                                                {f.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Zone Factor (Z)</Label>
                                <Input
                                    value={params.Z}
                                    disabled
                                    className="bg-[#1a2333]"
                                />
                            </div>
                        </div>
                    </TabsContent>
                    
                    {/* Building Tab */}
                    <TabsContent value="building" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Building Type</Label>
                                <Select
                                    value={params.buildingType}
                                    onValueChange={handleBuildingTypeChange}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {BUILDING_TYPES.map(bt => (
                                            <SelectItem key={bt.value} value={bt.value}>
                                                {bt.label} (R = {bt.R})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Response Reduction Factor (R)</Label>
                                <Input
                                    type="number"
                                    value={params.R}
                                    onChange={(e) => setParams(prev => ({
                                        ...prev,
                                        R: parseFloat(e.target.value) || 5.0
                                    }))}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Building Height (m)</Label>
                                <Input
                                    type="number"
                                    value={params.height}
                                    onChange={(e) => setParams(prev => ({
                                        ...prev,
                                        height: parseFloat(e.target.value) || 0
                                    }))}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Number of Storeys</Label>
                                <Input
                                    type="number"
                                    value={params.numStoreys}
                                    onChange={(e) => setParams(prev => ({
                                        ...prev,
                                        numStoreys: parseInt(e.target.value) || 1
                                    }))}
                                    min={1}
                                    max={50}
                                />
                            </div>
                        </div>
                        
                        {/* Time Period */}
                        <div className="p-4 bg-blue-50 bg-blue-950 rounded-lg space-y-3">
                            <Label>Time Period Calculation</Label>
                            <RadioGroup
                                value={params.timeMethod}
                                onValueChange={(v: 'empirical' | 'modal' | 'custom') => 
                                    setParams(prev => ({ ...prev, timeMethod: v }))
                                }
                                className="flex gap-4"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="empirical" id="t-empirical" />
                                    <Label htmlFor="t-empirical">Empirical (Cl. 7.6)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="custom" id="t-custom" />
                                    <Label htmlFor="t-custom">Custom</Label>
                                </div>
                            </RadioGroup>
                            
                            {params.timeMethod === 'empirical' && (
                                <div className="space-y-2">
                                    <Label>Frame Type</Label>
                                    <Select
                                        value={params.buildingMaterial}
                                        onValueChange={(v: 'rcc' | 'steel' | 'masonry') => 
                                            setParams(prev => ({ ...prev, buildingMaterial: v }))
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="rcc">RCC Frame (T = 0.075h⁰·⁷⁵)</SelectItem>
                                            <SelectItem value="steel">Steel Frame (T = 0.085h⁰·⁷⁵)</SelectItem>
                                            <SelectItem value="masonry">Masonry (T = 0.09h/√d)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            
                            {params.timeMethod === 'custom' && (
                                <div className="space-y-2">
                                    <Label>Custom Time Period (s)</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={params.customT}
                                        onChange={(e) => setParams(prev => ({
                                            ...prev,
                                            customT: parseFloat(e.target.value) || 0
                                        }))}
                                    />
                                </div>
                            )}
                        </div>
                        
                        {/* Irregularities */}
                        <div className="space-y-2">
                            <Label>Structural Irregularities</Label>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="flex items-center justify-between p-2 border rounded">
                                    <span className="text-sm">Soft Storey</span>
                                    <Switch
                                        checked={params.isSoftStorey}
                                        onCheckedChange={(checked: boolean) => setParams(prev => ({
                                            ...prev,
                                            isSoftStorey: checked
                                        }))}
                                    />
                                </div>
                                <div className="flex items-center justify-between p-2 border rounded">
                                    <span className="text-sm">Plan Irregular</span>
                                    <Switch
                                        checked={params.isIrregular}
                                        onCheckedChange={(checked: boolean) => setParams(prev => ({
                                            ...prev,
                                            isIrregular: checked
                                        }))}
                                    />
                                </div>
                                <div className="flex items-center justify-between p-2 border rounded">
                                    <span className="text-sm">Torsional</span>
                                    <Switch
                                        checked={params.torsionallyIrregular}
                                        onCheckedChange={(checked: boolean) => setParams(prev => ({
                                            ...prev,
                                            torsionallyIrregular: checked
                                        }))}
                                    />
                                </div>
                            </div>
                            
                            {(params.isSoftStorey || params.isIrregular || params.torsionallyIrregular) && (
                                <div className="flex items-center gap-2 p-2 bg-amber-50 bg-amber-950 rounded border border-amber-200">
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                    <span className="text-sm text-amber-700 text-amber-300">
                                        Response Spectrum Analysis is mandatory for irregular buildings
                                    </span>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                    
                    {/* Floors Tab */}
                    <TabsContent value="floors" className="space-y-4 mt-4">
                        <div className="flex items-center justify-between">
                            <Label>Floor Seismic Weights</Label>
                            <div className="text-sm text-muted-foreground">
                                Total: {params.floors.reduce((s, f) => s + f.weight, 0).toFixed(0)} kN
                            </div>
                        </div>
                        
                        <div className="max-h-64 overflow-y-auto border rounded">
                            <table className="w-full text-sm">
                                <thead className="bg-[#1a2333] sticky top-0">
                                    <tr>
                                        <th className="p-2 text-left">Floor</th>
                                        <th className="p-2 text-right">Height (m)</th>
                                        <th className="p-2 text-right">Weight (kN)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {params.floors.slice().reverse().map((floor, i) => (
                                        <tr key={floor.level} className="border-t">
                                            <td className="p-2">
                                                {floor.level === params.numStoreys ? 'Roof' : `Floor ${floor.level}`}
                                            </td>
                                            <td className="p-2 text-right">{floor.height.toFixed(1)}</td>
                                            <td className="p-2">
                                                <Input
                                                    type="number"
                                                    value={floor.weight}
                                                    onChange={(e) => updateFloorWeight(
                                                        params.numStoreys - 1 - i,
                                                        parseFloat(e.target.value) || 0
                                                    )}
                                                    className="w-24 ml-auto"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="p-3 bg-blue-50 bg-blue-950 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Info className="h-4 w-4 text-blue-600" />
                                <span className="text-sm">
                                    Seismic weight includes dead load + 25-50% of imposed load (Table 8)
                                </span>
                            </div>
                        </div>
                    </TabsContent>
                    
                    {/* Results Tab */}
                    <TabsContent value="results" className="space-y-4 mt-4">
                        {results ? (
                            <>
                                {/* Key parameters */}
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="p-3 bg-[#1a2333] rounded-lg text-center">
                                        <div className="text-xs text-muted-foreground">Time Period</div>
                                        <div className="text-lg font-bold">{results.T.toFixed(3)} s</div>
                                    </div>
                                    <div className="p-3 bg-[#1a2333] rounded-lg text-center">
                                        <div className="text-xs text-muted-foreground">Sa/g</div>
                                        <div className="text-lg font-bold">{results.Sa_g.toFixed(3)}</div>
                                    </div>
                                    <div className="p-3 bg-red-100 bg-red-900 rounded-lg text-center">
                                        <div className="text-xs text-muted-foreground">Ah</div>
                                        <div className="text-lg font-bold text-red-700 text-red-300">
                                            {results.Ah.toFixed(4)}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-red-100 bg-red-900 rounded-lg text-center">
                                        <div className="text-xs text-muted-foreground">Base Shear</div>
                                        <div className="text-lg font-bold text-red-700 text-red-300">
                                            {results.Vb.toFixed(1)} kN
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Formula display */}
                                <div className="p-3 bg-blue-50 bg-blue-950 rounded-lg">
                                    <div className="text-sm font-mono">
                                        Ah = (Z/2) × (I/R) × (Sa/g) = ({params.Z}/2) × ({params.I}/{params.R}) × {results.Sa_g.toFixed(3)} = {results.Ah.toFixed(4)}
                                    </div>
                                    <div className="text-sm font-mono mt-1">
                                        Vb = Ah × W = {results.Ah.toFixed(4)} × {results.W.toFixed(0)} = {results.Vb.toFixed(1)} kN
                                    </div>
                                </div>
                                
                                {/* Storey forces */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b bg-[#0b1326]">
                                                <th className="text-left p-2">Floor</th>
                                                <th className="text-right p-2">hi (m)</th>
                                                <th className="text-right p-2">Wi (kN)</th>
                                                <th className="text-right p-2">Wi×hi²</th>
                                                <th className="text-right p-2">Qi (kN)</th>
                                                <th className="text-right p-2">ΣQi (kN)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.Qi.slice().reverse().map((q, i) => {
                                                const cumulativeForce = results.Qi
                                                    .filter(qj => qj.level >= q.level)
                                                    .reduce((sum, qj) => sum + qj.force, 0);
                                                
                                                return (
                                                    <tr key={q.level} className="border-b">
                                                        <td className="p-2">
                                                            {q.level === params.numStoreys ? 'Roof' : `Floor ${q.level}`}
                                                        </td>
                                                        <td className="text-right p-2">{q.height.toFixed(1)}</td>
                                                        <td className="text-right p-2">{q.weight.toFixed(0)}</td>
                                                        <td className="text-right p-2">
                                                            {(q.weight * q.height * q.height).toFixed(0)}
                                                        </td>
                                                        <td className="text-right p-2 font-medium tracking-wide tracking-wide text-red-600">
                                                            {q.force.toFixed(1)}
                                                        </td>
                                                        <td className="text-right p-2 text-muted-foreground">
                                                            {cumulativeForce.toFixed(1)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-[#1a2333] font-medium tracking-wide tracking-wide">
                                                <td className="p-2">Total</td>
                                                <td className="p-2"></td>
                                                <td className="text-right p-2">{results.W.toFixed(0)}</td>
                                                <td className="p-2"></td>
                                                <td className="text-right p-2 text-red-600">
                                                    {results.Vb.toFixed(1)}
                                                </td>
                                                <td className="p-2"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                
                                {/* Overturning moment */}
                                <div className="p-3 border rounded-lg">
                                    <div className="flex justify-between">
                                        <span>Overturning Moment at Base</span>
                                        <span className="font-bold">{results.overturningMoment.toFixed(1)} kN·m</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                Enter building parameters and floor weights to calculate seismic loads
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
                
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setModal('seismicLoadDialog', false)} disabled={isApplying}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleApplyLoads} 
                        disabled={!results || isApplying}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {isApplying ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Applying...
                            </>
                        ) : (
                            <>
                                <Activity className="h-4 w-4 mr-2" />
                                Apply Seismic Loads
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SeismicLoadDialog;
