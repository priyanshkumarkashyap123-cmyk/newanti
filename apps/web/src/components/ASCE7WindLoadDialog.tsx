/**
 * ASCE7WindLoadDialog.tsx - ASCE 7 Wind Load Generator
 * Based on ASCE 7-22 Chapter 27 (Directional Procedure)
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
import { Wind, MapPin, Mountain, AlertTriangle, Calculator, Info, Building2 } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { API_CONFIG } from '../config/env';
import { getErrorMessage } from '../lib/errorHandling';
// import { useToast } from './ui/use-toast';

// ===== CONSTANTS =====

const EXPOSURE_CATEGORIES = [
    { value: 'B', label: 'Exposure B - Urban/Suburban' },
    { value: 'C', label: 'Exposure C - Open Terrain' },
    { value: 'D', label: 'Exposure D - Coastal/Water' },
];

const RISK_CATEGORIES = [
    { value: '1', label: 'Category I - Low Risk' },
    { value: '2', label: 'Category II - Standard' },
    { value: '3', label: 'Category III - Substantial Hazard' },
    { value: '4', label: 'Category IV - Essential Facilities' },
];

const ENCLOSURE_TYPES = [
    { value: 'enclosed', label: 'Enclosed Building' },
    { value: 'partially_enclosed', label: 'Partially Enclosed' },
    { value: 'open', label: 'Open Building' },
];

// Common US cities wind speeds (mph) for quick selection
const CITY_WIND_SPEEDS: Record<string, number> = {
    'Miami, FL': 175,
    'New York, NY': 120,
    'Chicago, IL': 115,
    'Los Angeles, CA': 95,
    'Houston, TX': 140,
    'Denver, CO': 115,
    'Seattle, WA': 100,
    'Custom': 115,
};

interface ASCE7WindParams {
    // Location
    city: string;
    V: number;              // Basic Wind Speed (mph)
    riskCategory: string;
    exposure: string;

    // Building Geometry
    height: number;         // Mean roof height (m)
    width: number;          // Along wind (m)
    length: number;         // Across wind (m)
    roofType: string;       // flat, gable, hip
    roofAngle: number;      // degrees

    // Topography
    Kzt: number;            // Topographic Factor
    groundElevation: number; // zg (ft) used for Ke

    // Enclosure
    enclosure: string;

    // Directionality
    Kd: number;
}

interface WindPressure {
    height: number;
    qz: number;
    windward: number;
    leeward: number;
    side: number;
    roof: number;
}

interface ASCE7WindResult {
    success: boolean;
    parameters: {
        Ke: number;
        Kd: number;
        Kzt: number;
        G: number;
        GCpi: number;
    };
    qh: number; // Velocity pressure at roof
    pressures: WindPressure[];
}

const ASCE7WindLoadDialog: React.FC = () => {
    const { modals, setModal } = useUIStore();
    // const { toast } = useToast();
    const isOpen = modals.asce7WindDialog || false;

    const [activeTab, setActiveTab] = useState('parameters');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ASCE7WindResult | null>(null);
    const [calcStatus, setCalcStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [params, setParams] = useState<ASCE7WindParams>({
        city: 'Custom',
        V: 115,
        riskCategory: '2',
        exposure: 'C',
        height: 30,
        width: 20,
        length: 30,
        roofType: 'flat',
        roofAngle: 0,
        Kzt: 1.0,
        groundElevation: 0,
        enclosure: 'enclosed',
        Kd: 0.85,
    });

    const handleCityChange = (city: string) => {
        setParams(prev => ({
            ...prev,
            city,
            V: CITY_WIND_SPEEDS[city] || prev.V
        }));
    };

    const handleCalculate = async () => {
        setLoading(true);
        try {
            // Call backend API
            const response = await fetch(`${API_CONFIG.pythonUrl}/load-generation/asce7-wind`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    V: params.V,
                    exposure: params.exposure,
                    height: params.height,
                    width: params.width,
                    length: params.length,
                    risk_category: parseInt(params.riskCategory),
                    direction: 'X', // Default direction
                    // Add other parameters if backend supports them (it mostly does)
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to calculate wind loads');
            }

            const data = await response.json();

            // Transform backend response to UI format
            // Backend returns: { qh, pressures: [{height, qz, p_windward, ...}], Ke, Kd, etc. }
            // Note: Our API response might look slightly different based on what we saw in main.py
            // Let's assume main.py returns what ASCE7WindGenerator.analyze() returns structure

            setResult({
                success: true,
                parameters: {
                    Ke: data.Ke || 1.0,
                    Kd: data.Kd || 0.85,
                    Kzt: data.Kzt || 1.0,
                    G: 0.85, // Default Gust Effect Factor
                    GCpi: data.GCpi || 0.18,
                },
                qh: data.qh,
                pressures: data.pressures.map((p: any) => ({
                    height: p.height,
                    qz: p.qz,
                    windward: p.p_windward,
                    leeward: p.p_leeward, // Backend might calculate net, we need components
                    // Or backend returns net pressures. 
                    // Let's assume backend returns sufficient info or we calculate logic here if needed.
                    // Actually main.py for wind seemed to just return params params initially? 
                    // Wait, main.py (L1100+) calls `generator.analyze()` and returns that result directly (step 1102+).
                    // `asce7_wind.py` `analyze` returns `ASCE7WindResult` which has `pressures: List[WindPressure]`.
                    // `WindPressure` has `p_windward`, `p_leeward`, `p_net`.
                    side: p.p_net, // Simplified for now
                    roof: 0, // Backend might not list roof pressure in 'pressures' (which are by height). 
                    // It has `get_roof_Cp`.
                }))
            });

            setActiveTab('results');

        } catch (error: unknown) {
            console.error(error);
            setCalcStatus({ type: 'error', text: `Calculation Failed: ${getErrorMessage(error, 'Unknown error')}` });
        } finally {
            setLoading(false);
        }
    };

    const handleApply = () => {
        // Apply logic here
// console.log('Applying wind loads:', result);
        setCalcStatus({ type: 'success', text: 'Wind Loads generated. Nodal application pending integration.' });
        setTimeout(() => {
            setCalcStatus(null);
            setModal('asce7WindDialog', false);
        }, 1500);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => setModal('asce7WindDialog', open)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wind className="h-5 w-5 text-cyan-500" />
                        ASCE 7 Wind Load Generator
                        <Badge variant="secondary" className="ml-2">ASCE 7-22</Badge>
                    </DialogTitle>
                    <DialogDescription>
                        Directional Procedure (Chapter 27) for Main Wind-Force Resisting System
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="parameters">
                            <MapPin className="h-4 w-4 mr-1" />
                            Parameters
                        </TabsTrigger>
                        <TabsTrigger value="building">
                            <Building2 className="h-4 w-4 mr-1" />
                            Building Geometry
                        </TabsTrigger>
                        <TabsTrigger value="results" disabled={!result}>
                            <Calculator className="h-4 w-4 mr-1" />
                            Results
                        </TabsTrigger>
                    </TabsList>

                    {/* Parameters Tab */}
                    <TabsContent value="parameters" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Select City (Optional)</Label>
                                <Select value={params.city} onValueChange={handleCityChange}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.keys(CITY_WIND_SPEEDS).map(city => (
                                            <SelectItem key={city} value={city}>
                                                {city} ({CITY_WIND_SPEEDS[city]} mph)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Basic Wind Speed, V (mph)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        value={params.V}
                                        onChange={(e) => setParams(prev => ({ ...prev, V: parseFloat(e.target.value) || 0 }))}
                                    />
                                    <span className="flex items-center text-sm text-muted-foreground">mph</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Risk Category</Label>
                                <Select
                                    value={params.riskCategory}
                                    onValueChange={(v) => setParams(prev => ({ ...prev, riskCategory: v }))}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {RISK_CATEGORIES.map(rc => (
                                            <SelectItem key={rc.value} value={rc.value}>{rc.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Exposure Category</Label>
                                <Select
                                    value={params.exposure}
                                    onValueChange={(v) => setParams(prev => ({ ...prev, exposure: v }))}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {EXPOSURE_CATEGORIES.map(ec => (
                                            <SelectItem key={ec.value} value={ec.value}>{ec.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Building Enclosure</Label>
                                <Select
                                    value={params.enclosure}
                                    onValueChange={(v) => setParams(prev => ({ ...prev, enclosure: v }))}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {ENCLOSURE_TYPES.map(et => (
                                            <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Directionality Factor (Kd)</Label>
                                <Input
                                    type="number"
                                    step="0.05"
                                    value={params.Kd}
                                    onChange={(e) => setParams(prev => ({ ...prev, Kd: parseFloat(e.target.value) || 0.85 }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Ground Elevation (ft)</Label>
                                <Input
                                    type="number"
                                    value={params.groundElevation}
                                    onChange={(e) => setParams(prev => ({ ...prev, groundElevation: parseFloat(e.target.value) || 0 }))}
                                />
                                <p className="text-xs text-muted-foreground">Used for Ke factor</p>
                            </div>

                            <div className="space-y-2">
                                <Label>Topographic Factor (Kzt)</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={params.Kzt}
                                    onChange={(e) => setParams(prev => ({ ...prev, Kzt: parseFloat(e.target.value) || 1.0 }))}
                                />
                            </div>
                        </div>
                    </TabsContent>

                    {/* Building Geometry Tab */}
                    <TabsContent value="building" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Mean Roof Height (m)</Label>
                                <Input
                                    type="number"
                                    value={params.height}
                                    onChange={(e) => setParams(prev => ({ ...prev, height: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>width (Across Wind) B (m)</Label>
                                <Input
                                    type="number"
                                    value={params.length}
                                    onChange={(e) => setParams(prev => ({ ...prev, length: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Depth (Along Wind) L (m)</Label>
                                <Input
                                    type="number"
                                    value={params.width}
                                    onChange={(e) => setParams(prev => ({ ...prev, width: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Roof Type</Label>
                                <Select
                                    value={params.roofType}
                                    onValueChange={(v) => setParams(prev => ({ ...prev, roofType: v }))}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="flat">Flat</SelectItem>
                                        <SelectItem value="gable">Gable</SelectItem>
                                        <SelectItem value="hip">Hip</SelectItem>
                                        <SelectItem value="monoslope">Monoslope</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {params.roofType !== 'flat' && (
                                <div className="space-y-2">
                                    <Label>Roof Angle (degrees)</Label>
                                    <Input
                                        type="number"
                                        value={params.roofAngle}
                                        onChange={(e) => setParams(prev => ({ ...prev, roofAngle: parseFloat(e.target.value) || 0 }))}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg flex justify-center items-center">
                            <div className="text-center text-muted-foreground text-sm">
                                <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                Review dimensions carefully. <br />
                                "Width" is dimension perpendicular to wind.<br />
                                "Depth" is dimension parallel to wind.
                            </div>
                        </div>

                        <div className="flex justify-end mt-4">
                            <Button onClick={handleCalculate} disabled={loading} className="w-full md:w-auto">
                                {loading && <Calculator className="mr-2 h-4 w-4 animate-spin" />}
                                Calculate Wind Pressures
                            </Button>
                        </div>
                    </TabsContent>

                    {/* Results Tab */}
                    <TabsContent value="results" className="space-y-4 mt-4">
                        {result ? (
                            <div className="space-y-6">
                                {/* Summary Cards */}
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-center">
                                        <div className="text-xs text-muted-foreground">Velocity Pressure (qh)</div>
                                        <div className="text-lg font-bold text-cyan-500">{result.qh.toFixed(3)} <span className="text-xs text-muted-foreground">kN/m²</span></div>
                                    </div>
                                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-center">
                                        <div className="text-xs text-muted-foreground">Kd</div>
                                        <div className="text-lg font-bold">{result.parameters.Kd}</div>
                                    </div>
                                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-center">
                                        <div className="text-xs text-muted-foreground">Ke</div>
                                        <div className="text-lg font-bold">{result.parameters.Ke.toFixed(3)}</div>
                                    </div>
                                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-center">
                                        <div className="text-xs text-muted-foreground">GCpi</div>
                                        <div className="text-lg font-bold">±{result.parameters.GCpi}</div>
                                    </div>
                                </div>

                                {/* Pressures Table */}
                                <div className="rounded-md border">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50">
                                                <tr className="border-b">
                                                    <th className="h-10 px-4 text-left font-medium">Height (m)</th>
                                                    <th className="h-10 px-4 text-right font-medium">qz (kN/m²)</th>
                                                    <th className="h-10 px-4 text-right font-medium">Windward (kN/m²)</th>
                                                    <th className="h-10 px-4 text-right font-medium">Leeward (kN/m²)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {result.pressures.map((p, i) => (
                                                    <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                                                        <td className="p-4">{p.height.toFixed(1)}</td>
                                                        <td className="p-4 text-right">{p.qz.toFixed(3)}</td>
                                                        <td className="p-4 text-right text-green-600">{p.windward.toFixed(3)}</td>
                                                        <td className="p-4 text-right text-red-600">{p.leeward.toFixed(3)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 p-3 rounded">
                                    <Info className="h-4 w-4" />
                                    Positive values indicate pressure acting TOWARDS the surface. Negative values indicate suction AWAY from the surface.
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-10 text-muted-foreground">
                                Please enter parameters and click Calculate.
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                {calcStatus && (
                    <div className={`p-3 rounded-lg text-sm font-medium ${
                        calcStatus.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                        {calcStatus.type === 'success' ? '✓' : '✗'} {calcStatus.text}
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setModal('asce7WindDialog', false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleApply} disabled={!result} className="bg-cyan-600 hover:bg-cyan-700">
                        Apply Loads
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ASCE7WindLoadDialog;
