/**
 * WindLoadDialog.tsx - Wind Load Generator UI
 * Based on IS 875 Part 3: 2015
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
import { Wind, MapPin, Mountain, AlertTriangle, Calculator, Info } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

// ===== CONSTANTS FROM IS 875 =====

interface CityWindData {
    vb: number;
    zone: string;
}

const CITY_WIND_SPEEDS: Record<string, CityWindData> = {
    'Delhi': { vb: 47, zone: 'A' },
    'Mumbai': { vb: 44, zone: 'A' },
    'Kolkata': { vb: 50, zone: 'A' },
    'Chennai': { vb: 50, zone: 'A' },
    'Bangalore': { vb: 33, zone: 'A' },
    'Hyderabad': { vb: 44, zone: 'A' },
    'Ahmedabad': { vb: 39, zone: 'A' },
    'Pune': { vb: 39, zone: 'A' },
    'Jaipur': { vb: 47, zone: 'A' },
    'Lucknow': { vb: 47, zone: 'A' },
    'Bhopal': { vb: 39, zone: 'A' },
    'Visakhapatnam': { vb: 50, zone: 'B' },
    'Bhubaneswar': { vb: 50, zone: 'B' },
    'Coastal Andhra': { vb: 50, zone: 'B' },
    'Coastal Odisha': { vb: 50, zone: 'B' },
    'Custom': { vb: 0, zone: 'A' },
};

const TERRAIN_CATEGORIES = [
    { value: '1', label: 'Category 1 - Open sea, coastal areas', k2Base: 1.05 },
    { value: '2', label: 'Category 2 - Open terrain, few obstacles', k2Base: 1.00 },
    { value: '3', label: 'Category 3 - Suburban, industrial areas', k2Base: 0.91 },
    { value: '4', label: 'Category 4 - Urban, well-developed areas', k2Base: 0.80 },
];

const STRUCTURE_CLASSES = [
    { value: 'A', label: 'Class A - h ≤ 20m, max dimension ≤ 50m' },
    { value: 'B', label: 'Class B - 20m < h ≤ 50m or max dimension > 50m' },
    { value: 'C', label: 'Class C - h > 50m' },
];

const BUILDING_TYPES = [
    { value: 'rectangular', label: 'Rectangular Building' },
    { value: 'square', label: 'Square Building' },
    { value: 'circular', label: 'Circular Building/Tank' },
    { value: 'industrial', label: 'Industrial Shed' },
    { value: 'frame', label: 'Open Frame Structure' },
];

interface WindLoadParams {
    city: string;
    vb: number;            // Basic wind speed (m/s)
    terrainCategory: string;
    structureClass: string;
    buildingType: string;
    buildingHeight: number;
    buildingWidth: number;  // Along wind
    buildingDepth: number;  // Across wind
    
    // Risk factors (k1)
    designLife: number;     // years
    
    // Topography (k3)
    isHilly: boolean;
    hillSlope: number;      // degrees
    hillHeight: number;     // m
    
    // Cyclonic region (k4)
    isCyclonic: boolean;
    
    // Internal pressure
    openingPercentage: number;  // % of wall area
}

interface WindResults {
    k1: number;
    k2Values: { height: number; k2: number }[];
    k3: number;
    k4: number;
    vzValues: { height: number; vz: number }[];
    pzValues: { height: number; pz: number }[];
    cpe: { windward: number; leeward: number; side: number; roof: number };
    cpi: { positive: number; negative: number };
    designPressures: { height: number; windward: number; leeward: number; suction: number }[];
}

const WindLoadDialog: React.FC = () => {
    const { modals, setModal } = useUIStore();
    const isOpen = modals.windLoadDialog || false;
    
    const [activeTab, setActiveTab] = useState('location');
    const [params, setParams] = useState<WindLoadParams>({
        city: 'Delhi',
        vb: 47,
        terrainCategory: '2',
        structureClass: 'A',
        buildingType: 'rectangular',
        buildingHeight: 30,
        buildingWidth: 20,
        buildingDepth: 15,
        designLife: 50,
        isHilly: false,
        hillSlope: 0,
        hillHeight: 0,
        isCyclonic: false,
        openingPercentage: 5,
    });
    
    const [showResults, setShowResults] = useState(false);
    
    // Calculate wind loads
    const results = useMemo((): WindResults | null => {
        if (!params.vb || !params.buildingHeight) return null;
        
        // k1 - Risk coefficient (Table 1 of IS 875)
        let k1 = 1.0;
        if (params.designLife <= 25) k1 = 0.92;
        else if (params.designLife <= 50) k1 = 1.0;
        else if (params.designLife <= 100) k1 = 1.08;
        
        // k2 - Terrain and height factor (Table 2)
        const terrainData = TERRAIN_CATEGORIES.find(t => t.value === params.terrainCategory);
        const k2Base = terrainData?.k2Base || 1.0;
        
        const heights = [5, 10, 15, 20, 30, 50, 100, 150, 200];
        const k2Multipliers: Record<string, number[]> = {
            '1': [1.05, 1.12, 1.15, 1.18, 1.22, 1.27, 1.33, 1.37, 1.39],
            '2': [1.00, 1.05, 1.09, 1.12, 1.17, 1.24, 1.32, 1.37, 1.39],
            '3': [0.91, 0.91, 0.94, 0.98, 1.05, 1.15, 1.27, 1.33, 1.37],
            '4': [0.80, 0.80, 0.80, 0.84, 0.94, 1.10, 1.24, 1.32, 1.37],
        };
        
        const k2Values: { height: number; k2: number }[] = heights
            .filter(h => h <= params.buildingHeight + 10)
            .map((h, i) => ({
                height: h,
                k2: k2Multipliers[params.terrainCategory]?.[i] || k2Base
            }));
        
        // k3 - Topography factor
        let k3 = 1.0;
        if (params.isHilly && params.hillSlope > 3) {
            if (params.hillSlope < 17) {
                k3 = 1 + 0.36 * (params.hillSlope / 17);
            } else {
                k3 = 1.36;
            }
        }
        
        // k4 - Importance factor for cyclonic region
        let k4 = 1.0;
        if (params.isCyclonic) {
            k4 = params.structureClass === 'A' ? 1.15 : 
                 params.structureClass === 'B' ? 1.10 : 1.05;
        }
        
        // Calculate Vz and pz at different heights
        const vzValues = k2Values.map(({ height, k2 }) => ({
            height,
            vz: params.vb * k1 * k2 * k3 * k4
        }));
        
        const pzValues = vzValues.map(({ height, vz }) => ({
            height,
            pz: 0.6 * vz * vz / 1000  // kN/m²
        }));
        
        // External pressure coefficients (Cpe) - Simplified for rectangular buildings
        const heightWidthRatio = params.buildingHeight / params.buildingWidth;
        const cpeWindward = 0.8;
        const cpeLeeward = heightWidthRatio > 2 ? -0.6 : heightWidthRatio > 1 ? -0.5 : -0.4;
        const cpeSide = -0.8;
        const cpeRoof = heightWidthRatio > 1 ? -0.9 : -0.7;
        
        // Internal pressure coefficient (Cpi)
        let cpiPositive = 0.0;
        let cpiNegative = 0.0;
        
        if (params.openingPercentage < 5) {
            cpiPositive = 0.2;
            cpiNegative = -0.2;
        } else if (params.openingPercentage < 20) {
            cpiPositive = 0.5;
            cpiNegative = -0.5;
        } else {
            cpiPositive = 0.7;
            cpiNegative = -0.7;
        }
        
        // Design pressures
        const designPressures = pzValues.map(({ height, pz }) => ({
            height,
            windward: pz * (cpeWindward - cpiNegative),
            leeward: pz * (cpeLeeward - cpiPositive),
            suction: pz * (cpeSide - cpiPositive),
        }));
        
        return {
            k1,
            k2Values,
            k3,
            k4,
            vzValues,
            pzValues,
            cpe: { windward: cpeWindward, leeward: cpeLeeward, side: cpeSide, roof: cpeRoof },
            cpi: { positive: cpiPositive, negative: cpiNegative },
            designPressures,
        };
    }, [params]);
    
    const handleCityChange = (city: string) => {
        const cityData = CITY_WIND_SPEEDS[city];
        setParams(prev => ({
            ...prev,
            city,
            vb: cityData?.vb || prev.vb,
            isCyclonic: cityData?.zone === 'B',
        }));
    };
    
    const handleApplyLoads = () => {
        if (!results) return;
        
        // TODO: Convert to member loads and apply to model
// console.log('Applying wind loads:', results);
        
        // Close dialog
        setModal('windLoadDialog', false);
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={(open) => setModal('windLoadDialog', open)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wind className="h-5 w-5 text-cyan-500" />
                        Wind Load Generator
                        <Badge variant="secondary" className="ml-2">IS 875 Part 3: 2015</Badge>
                    </DialogTitle>
                    <DialogDescription>
                        Calculate wind loads as per IS 875 (Part 3): 2015 - Code of practice for design loads
                    </DialogDescription>
                </DialogHeader>
                
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="location">
                            <MapPin className="h-4 w-4 mr-1" />
                            Location
                        </TabsTrigger>
                        <TabsTrigger value="building">
                            <Wind className="h-4 w-4 mr-1" />
                            Building
                        </TabsTrigger>
                        <TabsTrigger value="terrain">
                            <Mountain className="h-4 w-4 mr-1" />
                            Terrain
                        </TabsTrigger>
                        <TabsTrigger value="results">
                            <Calculator className="h-4 w-4 mr-1" />
                            Results
                        </TabsTrigger>
                    </TabsList>
                    
                    {/* Location Tab */}
                    <TabsContent value="location" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>City / Region</Label>
                                <Select 
                                    value={params.city} 
                                    onValueChange={handleCityChange}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select city" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.keys(CITY_WIND_SPEEDS).map(city => (
                                            <SelectItem key={city} value={city}>
                                                {city} ({CITY_WIND_SPEEDS[city].vb} m/s)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Basic Wind Speed (Vb)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        value={params.vb}
                                        onChange={(e) => setParams(prev => ({
                                            ...prev,
                                            vb: parseFloat(e.target.value) || 0
                                        }))}
                                        disabled={params.city !== 'Custom'}
                                    />
                                    <span className="flex items-center text-sm text-muted-foreground">m/s</span>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Design Life</Label>
                                <Select
                                    value={params.designLife.toString()}
                                    onValueChange={(v) => setParams(prev => ({
                                        ...prev,
                                        designLife: parseInt(v)
                                    }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="25">25 years (k1 = 0.92)</SelectItem>
                                        <SelectItem value="50">50 years (k1 = 1.00)</SelectItem>
                                        <SelectItem value="100">100 years (k1 = 1.08)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Structure Class</Label>
                                <Select
                                    value={params.structureClass}
                                    onValueChange={(v) => setParams(prev => ({
                                        ...prev,
                                        structureClass: v
                                    }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STRUCTURE_CLASSES.map(sc => (
                                            <SelectItem key={sc.value} value={sc.value}>
                                                {sc.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                <span className="text-sm">Cyclonic Region</span>
                            </div>
                            <Switch
                                checked={params.isCyclonic}
                                onCheckedChange={(checked) => setParams(prev => ({
                                    ...prev,
                                    isCyclonic: checked
                                }))}
                            />
                        </div>
                    </TabsContent>
                    
                    {/* Building Tab */}
                    <TabsContent value="building" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Building Type</Label>
                                <Select
                                    value={params.buildingType}
                                    onValueChange={(v) => setParams(prev => ({
                                        ...prev,
                                        buildingType: v
                                    }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {BUILDING_TYPES.map(bt => (
                                            <SelectItem key={bt.value} value={bt.value}>
                                                {bt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Opening Percentage (%)</Label>
                                <Input
                                    type="number"
                                    value={params.openingPercentage}
                                    onChange={(e) => setParams(prev => ({
                                        ...prev,
                                        openingPercentage: parseFloat(e.target.value) || 0
                                    }))}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Affects internal pressure coefficient (Cpi)
                                </p>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Building Height (m)</Label>
                                <Input
                                    type="number"
                                    value={params.buildingHeight}
                                    onChange={(e) => setParams(prev => ({
                                        ...prev,
                                        buildingHeight: parseFloat(e.target.value) || 0
                                    }))}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Building Width - Along Wind (m)</Label>
                                <Input
                                    type="number"
                                    value={params.buildingWidth}
                                    onChange={(e) => setParams(prev => ({
                                        ...prev,
                                        buildingWidth: parseFloat(e.target.value) || 0
                                    }))}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Building Depth - Across Wind (m)</Label>
                                <Input
                                    type="number"
                                    value={params.buildingDepth}
                                    onChange={(e) => setParams(prev => ({
                                        ...prev,
                                        buildingDepth: parseFloat(e.target.value) || 0
                                    }))}
                                />
                            </div>
                        </div>
                        
                        {/* Building diagram */}
                        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                            <svg viewBox="0 0 300 150" className="w-full h-32">
                                {/* Building outline */}
                                <rect x="80" y="20" width="80" height="110" 
                                    fill="none" stroke="currentColor" strokeWidth="2" />
                                
                                {/* Wind arrows */}
                                <g className="text-cyan-500">
                                    <line x1="30" y1="75" x2="70" y2="75" stroke="currentColor" strokeWidth="2" />
                                    <polygon points="70,75 60,70 60,80" fill="currentColor" />
                                    <line x1="30" y1="45" x2="70" y2="45" stroke="currentColor" strokeWidth="2" />
                                    <polygon points="70,45 60,40 60,50" fill="currentColor" />
                                    <line x1="30" y1="105" x2="70" y2="105" stroke="currentColor" strokeWidth="2" />
                                    <polygon points="70,105 60,100 60,110" fill="currentColor" />
                                </g>
                                
                                {/* Dimensions */}
                                <text x="120" y="140" textAnchor="middle" className="text-xs fill-current">
                                    {params.buildingWidth}m
                                </text>
                                <text x="170" y="75" textAnchor="start" className="text-xs fill-current">
                                    {params.buildingHeight}m
                                </text>
                                
                                {/* Labels */}
                                <text x="20" y="75" textAnchor="end" className="text-xs fill-cyan-500">Wind</text>
                            </svg>
                        </div>
                    </TabsContent>
                    
                    {/* Terrain Tab */}
                    <TabsContent value="terrain" className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label>Terrain Category</Label>
                            <Select
                                value={params.terrainCategory}
                                onValueChange={(v) => setParams(prev => ({
                                    ...prev,
                                    terrainCategory: v
                                }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TERRAIN_CATEGORIES.map(tc => (
                                        <SelectItem key={tc.value} value={tc.value}>
                                            {tc.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Mountain className="h-4 w-4" />
                                    <span className="font-medium">Topography Effects</span>
                                </div>
                                <Switch
                                    checked={params.isHilly}
                                    onCheckedChange={(checked) => setParams(prev => ({
                                        ...prev,
                                        isHilly: checked
                                    }))}
                                />
                            </div>
                            
                            {params.isHilly && (
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="space-y-2">
                                        <Label>Hill Slope (degrees)</Label>
                                        <Input
                                            type="number"
                                            value={params.hillSlope}
                                            onChange={(e) => setParams(prev => ({
                                                ...prev,
                                                hillSlope: parseFloat(e.target.value) || 0
                                            }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Hill Height (m)</Label>
                                        <Input
                                            type="number"
                                            value={params.hillHeight}
                                            onChange={(e) => setParams(prev => ({
                                                ...prev,
                                                hillHeight: parseFloat(e.target.value) || 0
                                            }))}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Terrain illustration */}
                        <div className="grid grid-cols-4 gap-2">
                            {TERRAIN_CATEGORIES.map((tc, i) => (
                                <div
                                    key={tc.value}
                                    className={`p-2 rounded-lg border-2 cursor-pointer transition-all ${
                                        params.terrainCategory === tc.value
                                            ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950'
                                            : 'border-slate-200 dark:border-slate-700'
                                    }`}
                                    onClick={() => setParams(prev => ({ ...prev, terrainCategory: tc.value }))}
                                >
                                    <div className="text-center">
                                        <div className="text-2xl mb-1">
                                            {i === 0 ? '🌊' : i === 1 ? '🏜️' : i === 2 ? '🏘️' : '🏙️'}
                                        </div>
                                        <div className="text-xs font-medium">Cat {tc.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </TabsContent>
                    
                    {/* Results Tab */}
                    <TabsContent value="results" className="space-y-4 mt-4">
                        {results ? (
                            <>
                                {/* K-factors summary */}
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-center">
                                        <div className="text-xs text-muted-foreground">k1 (Risk)</div>
                                        <div className="text-lg font-bold">{results.k1.toFixed(2)}</div>
                                    </div>
                                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-center">
                                        <div className="text-xs text-muted-foreground">k2 (at top)</div>
                                        <div className="text-lg font-bold">
                                            {results.k2Values[results.k2Values.length - 1]?.k2.toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-center">
                                        <div className="text-xs text-muted-foreground">k3 (Topo)</div>
                                        <div className="text-lg font-bold">{results.k3.toFixed(2)}</div>
                                    </div>
                                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-center">
                                        <div className="text-xs text-muted-foreground">k4 (Cyclone)</div>
                                        <div className="text-lg font-bold">{results.k4.toFixed(2)}</div>
                                    </div>
                                </div>
                                
                                {/* Pressure coefficients */}
                                <div className="p-4 bg-cyan-50 dark:bg-cyan-950 rounded-lg">
                                    <h4 className="font-medium mb-2 flex items-center gap-2">
                                        <Info className="h-4 w-4" />
                                        Pressure Coefficients
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <div className="text-muted-foreground">External (Cpe)</div>
                                            <div>Windward: +{results.cpe.windward}</div>
                                            <div>Leeward: {results.cpe.leeward}</div>
                                            <div>Side: {results.cpe.side}</div>
                                            <div>Roof: {results.cpe.roof}</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground">Internal (Cpi)</div>
                                            <div>Positive: +{results.cpi.positive}</div>
                                            <div>Negative: {results.cpi.negative}</div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Pressure table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left p-2">Height (m)</th>
                                                <th className="text-right p-2">Vz (m/s)</th>
                                                <th className="text-right p-2">pz (kN/m²)</th>
                                                <th className="text-right p-2">Windward</th>
                                                <th className="text-right p-2">Leeward</th>
                                                <th className="text-right p-2">Suction</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.designPressures.map((dp, i) => (
                                                <tr key={i} className="border-b">
                                                    <td className="p-2">{dp.height}</td>
                                                    <td className="text-right p-2">
                                                        {results.vzValues[i]?.vz.toFixed(1)}
                                                    </td>
                                                    <td className="text-right p-2">
                                                        {results.pzValues[i]?.pz.toFixed(3)}
                                                    </td>
                                                    <td className="text-right p-2 text-green-600">
                                                        +{dp.windward.toFixed(3)}
                                                    </td>
                                                    <td className="text-right p-2 text-red-600">
                                                        {dp.leeward.toFixed(3)}
                                                    </td>
                                                    <td className="text-right p-2 text-red-600">
                                                        {dp.suction.toFixed(3)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                
                                <p className="text-xs text-muted-foreground">
                                    * All pressures in kN/m². Positive = inward pressure, Negative = suction.
                                </p>
                            </>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                Enter building parameters to calculate wind loads
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
                
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setModal('windLoadDialog', false)}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleApplyLoads} 
                        disabled={!results}
                        className="bg-cyan-600 hover:bg-cyan-700"
                    >
                        <Wind className="h-4 w-4 mr-2" />
                        Apply Wind Loads
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default WindLoadDialog;
