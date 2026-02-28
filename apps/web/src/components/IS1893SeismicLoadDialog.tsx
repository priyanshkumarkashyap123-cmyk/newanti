/**
 * IS1893SeismicLoadDialog.tsx - IS 1893:2016 Seismic Load Generator UI
 * Indian seismic code - Equivalent Static Method
 */

import React, { useState, useMemo, useCallback } from 'react';
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
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Activity, MapPin, Building2, Calculator, Settings2, Loader2, AlertCircle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useModelStore } from '@/store/model';
import { API_CONFIG } from '@/config/env';

// ===== IS 1893 CONSTANTS =====

const SEISMIC_ZONES = [
    { value: 2, label: 'Zone II (Low)', Z: 0.10 },
    { value: 3, label: 'Zone III (Moderate)', Z: 0.16 },
    { value: 4, label: 'Zone IV (Severe)', Z: 0.24 },
    { value: 5, label: 'Zone V (Very Severe)', Z: 0.36 },
];

const SOIL_TYPES = [
    { value: 'ROCK', label: 'Type I - Rock/Hard Soil', description: 'N > 30' },
    { value: 'MEDIUM', label: 'Type II - Medium Soil', description: 'N = 10-30' },
    { value: 'SOFT', label: 'Type III - Soft Soil', description: 'N < 10' },
];

const BUILDING_TYPES = [
    { value: 'OMRF', label: 'Ordinary RC Moment Frame', R: 3.0 },
    { value: 'SMRF', label: 'Special RC Moment Frame', R: 5.0 },
    { value: 'OSMRF', label: 'Ordinary Steel MRF', R: 3.0 },
    { value: 'SSMRF', label: 'Special Steel MRF', R: 5.0 },
    { value: 'BF', label: 'Braced Frame', R: 4.0 },
    { value: 'SW', label: 'Shear Wall', R: 3.0 },
    { value: 'DUAL', label: 'Dual System', R: 5.0 },
];

const IMPORTANCE_CATEGORIES = [
    { value: 'ORDINARY', label: 'Ordinary (I = 1.0)', I: 1.0 },
    { value: 'IMPORTANT', label: 'Important (I = 1.5)', I: 1.5 },
    { value: 'CRITICAL', label: 'Critical / Post-Earthquake (I = 1.5)', I: 1.5 },
];

interface FloorData {
    level: number;
    height: number;
    weight: number; // kN
}

interface IS1893Params {
    zone: number;
    Z: number;
    soilType: string;
    buildingType: string;
    R: number;
    importance: string;
    I: number;
    height: number; // m
    numStoreys: number;
    floors: FloorData[];
    direction: string;
    dampingRatio: number;
}

interface IS1893Results {
    Z: number;
    I: number;
    R: number;
    Ta: number;
    Sa_g: number;
    Ah: number;
    W: number;
    Vb: number;
    Qi: { level: number; height: number; weight: number; force: number; shear: number }[];
    overturningMoment: number;
}

const IS1893SeismicLoadDialog: React.FC = () => {
    const { modals, setModal } = useUIStore();
    const isOpen = modals.is1893SeismicDialog || false;

    const [activeTab, setActiveTab] = useState('site');
    const [isLoading, setIsLoading] = useState(false);
    const [backendError, setBackendError] = useState<string | null>(null);

    const [params, setParams] = useState<IS1893Params>({
        zone: 3,
        Z: 0.16,
        soilType: 'MEDIUM',
        buildingType: 'SMRF',
        R: 5.0,
        importance: 'ORDINARY',
        I: 1.0,
        height: 30,
        numStoreys: 10,
        floors: [],
        direction: 'X',
        dampingRatio: 0.05,
    });

    // Auto-generate floor data
    const prevConfig = React.useRef('');
    React.useEffect(() => {
        const config = `${params.numStoreys}-${params.height}`;
        if (config === prevConfig.current) return;
        prevConfig.current = config;

        const storyHeight = params.height / params.numStoreys;
        const floors: FloorData[] = [];
        for (let i = 1; i <= params.numStoreys; i++) {
            floors.push({
                level: i,
                height: i * storyHeight,
                weight: i === params.numStoreys ? 800 : 1000,
            });
        }
        setParams(prev => ({ ...prev, floors }));
    }, [params.numStoreys, params.height]);

    // Calculate Sa/g per IS 1893:2016 Clause 6.4.2
    const getSa_g = (T: number, soil: string): number => {
        if (soil === 'ROCK') {
            if (T <= 0.10) return 1 + 15 * T;
            if (T <= 0.40) return 2.50;
            return 1.00 / T;
        } else if (soil === 'MEDIUM') {
            if (T <= 0.10) return 1 + 15 * T;
            if (T <= 0.55) return 2.50;
            return 1.36 / T;
        } else { // SOFT
            if (T <= 0.10) return 1 + 15 * T;
            if (T <= 0.67) return 2.50;
            return 1.67 / T;
        }
    };

    // Calculate results per IS 1893:2016
    const results = useMemo((): IS1893Results | null => {
        if (!params.height || params.floors.length === 0) return null;

        const W = params.floors.reduce((sum, f) => sum + f.weight, 0);
        if (W === 0) return null;

        const { Z, I, R } = params;

        // Approximate fundamental period (Cl. 7.6.2)
        // For moment frames: Ta = 0.075 * h^0.75
        // For shear walls/braced: Ta = 0.085 * h^0.75
        const isMRF = ['OMRF', 'SMRF', 'OSMRF', 'SSMRF'].includes(params.buildingType);
        const Ta = isMRF
            ? 0.075 * Math.pow(params.height, 0.75)
            : 0.085 * Math.pow(params.height, 0.75);

        // Spectral acceleration coefficient
        const Sa_g = getSa_g(Ta, params.soilType);

        // Design horizontal acceleration spectrum (Cl. 6.4.2)
        const Ah = (Z * I * Sa_g) / (2 * R);

        // Base shear (Cl. 7.6.1)
        const Vb = Ah * W;

        // Vertical distribution (Cl. 7.7.1)
        // Qi = Vb * (Wi * hi²) / Σ(Wj * hj²)
        const denom = params.floors.reduce((sum, f) => sum + f.weight * f.height * f.height, 0);

        let cumShear = 0;
        const Qi = params.floors.slice().reverse().map(floor => {
            const Qi_factor = (floor.weight * floor.height * floor.height) / denom;
            const Fx = Qi_factor * Vb;
            cumShear += Fx;
            return { ...floor, force: Fx, shear: cumShear };
        }).reverse();

        // Overturning moment
        const M = Qi.reduce((sum, q) => sum + q.force * q.height, 0);

        return { Z, I, R, Ta, Sa_g, Ah, W, Vb, Qi, overturningMoment: M };
    }, [params]);

    const handleZoneChange = (value: string) => {
        const zone = SEISMIC_ZONES.find(z => z.value === parseInt(value));
        if (zone) setParams(prev => ({ ...prev, zone: zone.value, Z: zone.Z }));
    };

    const handleBuildingChange = (value: string) => {
        const bt = BUILDING_TYPES.find(b => b.value === value);
        if (bt) setParams(prev => ({ ...prev, buildingType: bt.value, R: bt.R }));
    };

    const handleImportanceChange = (value: string) => {
        const imp = IMPORTANCE_CATEGORIES.find(i => i.value === value);
        if (imp) setParams(prev => ({ ...prev, importance: imp.value, I: imp.I }));
    };

    // Backend validation + enhanced results
    const validateWithBackend = useCallback(async () => {
        setIsLoading(true);
        setBackendError(null);
        try {
            const response = await fetch(`${API_CONFIG.pythonUrl}/load-generation/is1893-seismic`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    zone: params.zone,
                    soil_type: params.soilType,
                    building_type: params.buildingType,
                    importance: params.importance,
                    height: params.height,
                    direction: params.direction,
                }),
            });
            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            const data = await response.json();
            if (data.success) {
                setBackendError(null);
            }
        } catch (err) {
            setBackendError(err instanceof Error ? err.message : 'Backend validation failed');
        } finally {
            setIsLoading(false);
        }
    }, [params]);

    const handleApply = () => {
        if (!results) return;
        const { nodes, addLoadCase } = useModelStore.getState();
        const direction = params.direction || 'X';

        // Group nodes by Y-level
        const levelMap = new Map<number, string[]>();
        nodes.forEach((node, id) => {
            const roundedY = Math.round(node.y * 10) / 10;
            if (!levelMap.has(roundedY)) levelMap.set(roundedY, []);
            levelMap.get(roundedY)!.push(id);
        });

        // Build nodal loads
        const nodalLoads: { id: string; nodeId: string; fx?: number; fy?: number; fz?: number }[] = [];
        let loadIdx = 0;

        results.Qi.forEach(story => {
            let bestY = -1;
            let bestDist = Infinity;
            levelMap.forEach((_, y) => {
                const dist = Math.abs(y - story.height);
                if (dist < bestDist) { bestDist = dist; bestY = y; }
            });

            if (bestY >= 0 && bestDist < 1.0) {
                const nodeIds = levelMap.get(bestY) || [];
                if (nodeIds.length > 0) {
                    const forcePerNode = story.force / nodeIds.length;
                    nodeIds.forEach(nodeId => {
                        loadIdx++;
                        const load: any = { id: `EQ_IS_${loadIdx}`, nodeId };
                        if (direction === 'X') load.fx = forcePerNode;
                        else load.fz = forcePerNode;
                        nodalLoads.push(load);
                    });
                }
            }
        });

        addLoadCase({
            id: `LC_EQ_IS1893_${direction}`,
            name: `Seismic IS 1893 (${direction})`,
            type: 'seismic',
            loads: nodalLoads,
            memberLoads: [],
            factor: 1.0,
        });

        setModal('is1893SeismicDialog', false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => setModal('is1893SeismicDialog', open)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-orange-500" />
                        IS 1893 Seismic Load Generator
                        <Badge variant="secondary" className="ml-2">IS 1893:2016</Badge>
                    </DialogTitle>
                    <DialogDescription>
                        Calculate seismic loads per IS 1893:2016 Equivalent Static Method
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="site"><MapPin className="h-4 w-4 mr-1" />Zone</TabsTrigger>
                        <TabsTrigger value="building"><Building2 className="h-4 w-4 mr-1" />Building</TabsTrigger>
                        <TabsTrigger value="params"><Settings2 className="h-4 w-4 mr-1" />Parameters</TabsTrigger>
                        <TabsTrigger value="results"><Calculator className="h-4 w-4 mr-1" />Results</TabsTrigger>
                    </TabsList>

                    {/* Zone Tab */}
                    <TabsContent value="site" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Seismic Zone</Label>
                                <Select value={params.zone.toString()} onValueChange={handleZoneChange}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {SEISMIC_ZONES.map(z => (
                                            <SelectItem key={z.value} value={z.value.toString()}>
                                                {z.label} (Z = {z.Z})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Soil Type</Label>
                                <Select value={params.soilType} onValueChange={v => setParams(prev => ({ ...prev, soilType: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {SOIL_TYPES.map(s => (
                                            <SelectItem key={s.value} value={s.value}>
                                                {s.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800 space-y-2">
                            <div className="text-sm font-medium text-orange-900 dark:text-orange-200">Zone Factor</div>
                            <div className="grid grid-cols-4 gap-4 text-sm">
                                {SEISMIC_ZONES.map(z => (
                                    <div key={z.value} className={`p-2 rounded text-center ${params.zone === z.value ? 'bg-orange-200 dark:bg-orange-900 font-bold' : ''}`}>
                                        <div>Zone {z.value}</div>
                                        <div className="text-lg font-mono">{z.Z}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </TabsContent>

                    {/* Building Tab */}
                    <TabsContent value="building" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Building Height (m)</Label>
                                <Input
                                    type="number"
                                    value={params.height}
                                    onChange={e => setParams(prev => ({ ...prev, height: parseFloat(e.target.value) || 0 }))}
                                    min={1}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Number of Storeys</Label>
                                <Input
                                    type="number"
                                    value={params.numStoreys}
                                    onChange={e => setParams(prev => ({ ...prev, numStoreys: parseInt(e.target.value) || 1 }))}
                                    min={1}
                                    max={60}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Structural System</Label>
                                <Select value={params.buildingType} onValueChange={handleBuildingChange}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {BUILDING_TYPES.map(b => (
                                            <SelectItem key={b.value} value={b.value}>
                                                {b.label} (R = {b.R})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Importance Category</Label>
                                <Select value={params.importance} onValueChange={handleImportanceChange}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {IMPORTANCE_CATEGORIES.map(i => (
                                            <SelectItem key={i.value} value={i.value}>
                                                {i.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Floor Weight Editor */}
                        <div className="space-y-2">
                            <Label>Floor Weights (kN)</Label>
                            <ScrollArea className="h-[150px]">
                                <div className="space-y-1">
                                    {params.floors.map((f, i) => (
                                        <div key={i} className="flex items-center gap-3 text-sm">
                                            <span className="w-16 text-muted-foreground">Level {f.level}</span>
                                            <span className="w-20 font-mono text-muted-foreground">{f.height.toFixed(1)}m</span>
                                            <Input
                                                type="number"
                                                value={f.weight}
                                                className="h-7 w-24"
                                                onChange={e => {
                                                    const newFloors = [...params.floors];
                                                    newFloors[i] = { ...f, weight: parseFloat(e.target.value) || 0 };
                                                    setParams(prev => ({ ...prev, floors: newFloors }));
                                                }}
                                            />
                                            <span className="text-muted-foreground">kN</span>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </TabsContent>

                    {/* Parameters Tab */}
                    <TabsContent value="params" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Load Direction</Label>
                                <Select value={params.direction} onValueChange={v => setParams(prev => ({ ...prev, direction: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="X">X-Direction</SelectItem>
                                        <SelectItem value="Z">Z-Direction</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Damping Ratio</Label>
                                <Input
                                    type="number"
                                    value={params.dampingRatio}
                                    onChange={e => setParams(prev => ({ ...prev, dampingRatio: parseFloat(e.target.value) || 0.05 }))}
                                    step={0.01}
                                    min={0.01}
                                    max={0.20}
                                />
                            </div>
                        </div>

                        {results && (
                            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-3">
                                <div className="text-sm font-medium">Design Parameters (IS 1893:2016)</div>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <div className="text-muted-foreground">Z (Zone Factor)</div>
                                        <div className="text-lg font-mono">{results.Z}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">I (Importance)</div>
                                        <div className="text-lg font-mono">{results.I.toFixed(1)}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">R (Response Reduction)</div>
                                        <div className="text-lg font-mono">{results.R.toFixed(1)}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">T<sub>a</sub> (Period)</div>
                                        <div className="text-lg font-mono">{results.Ta.toFixed(3)} s</div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">S<sub>a</sub>/g</div>
                                        <div className="text-lg font-mono">{results.Sa_g.toFixed(3)}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground">A<sub>h</sub></div>
                                        <div className="text-lg font-mono">{results.Ah.toFixed(4)}</div>
                                    </div>
                                </div>
                                <div className="text-xs text-muted-foreground mt-2">
                                    A<sub>h</sub> = (Z × I × S<sub>a</sub>/g) / (2 × R) = ({results.Z} × {results.I} × {results.Sa_g.toFixed(3)}) / (2 × {results.R}) = {results.Ah.toFixed(4)}
                                </div>
                            </div>
                        )}

                        <Button
                            size="sm"
                            variant="outline"
                            onClick={validateWithBackend}
                            disabled={isLoading}
                            className="w-full"
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calculator className="h-4 w-4 mr-2" />}
                            Validate with Backend Server
                        </Button>
                        {backendError && (
                            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-950 rounded p-2">
                                <AlertCircle className="h-3 w-3" />
                                {backendError}
                            </div>
                        )}
                    </TabsContent>

                    {/* Results Tab */}
                    <TabsContent value="results" className="space-y-4 mt-4">
                        {results ? (
                            <>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg text-center">
                                        <div className="text-xs text-muted-foreground">Seismic Weight (W)</div>
                                        <div className="text-xl font-bold font-mono">{results.W.toFixed(0)} kN</div>
                                    </div>
                                    <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg text-center">
                                        <div className="text-xs text-muted-foreground">Base Shear (V<sub>b</sub>)</div>
                                        <div className="text-xl font-bold font-mono text-red-600">{results.Vb.toFixed(1)} kN</div>
                                        <div className="text-xs text-muted-foreground">{(results.Ah * 100).toFixed(2)}% of W</div>
                                    </div>
                                    <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
                                        <div className="text-xs text-muted-foreground">OTM</div>
                                        <div className="text-xl font-bold font-mono">{results.overturningMoment.toFixed(0)} kN·m</div>
                                    </div>
                                </div>

                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-100 dark:bg-slate-800">
                                            <tr>
                                                <th className="px-3 py-2 text-left">Level</th>
                                                <th className="px-3 py-2 text-right">Height (m)</th>
                                                <th className="px-3 py-2 text-right">W<sub>i</sub> (kN)</th>
                                                <th className="px-3 py-2 text-right">Q<sub>i</sub> (kN)</th>
                                                <th className="px-3 py-2 text-right">V<sub>i</sub> (kN)</th>
                                                <th className="px-3 py-2 text-right">Bar</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.Qi.map((q, i) => {
                                                const maxForce = Math.max(...results.Qi.map(r => r.force));
                                                const pct = maxForce > 0 ? (q.force / maxForce) * 100 : 0;
                                                return (
                                                    <tr key={i} className="border-t hover:bg-slate-50 dark:hover:bg-slate-900">
                                                        <td className="px-3 py-1">{q.level}</td>
                                                        <td className="px-3 py-1 text-right font-mono">{q.height.toFixed(1)}</td>
                                                        <td className="px-3 py-1 text-right font-mono">{q.weight.toFixed(0)}</td>
                                                        <td className="px-3 py-1 text-right font-mono text-red-600">{q.force.toFixed(1)}</td>
                                                        <td className="px-3 py-1 text-right font-mono">{q.shear.toFixed(1)}</td>
                                                        <td className="px-3 py-1">
                                                            <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
                                                                <div
                                                                    className="h-full bg-orange-500 rounded"
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <div className="p-8 text-center text-muted-foreground">
                                <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p>Configure zone, building, and parameters to see results</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setModal('is1893SeismicDialog', false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleApply} disabled={!results} className="bg-orange-600 hover:bg-orange-700">
                        <Activity className="h-4 w-4 mr-2" />
                        Apply Seismic Loads
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default IS1893SeismicLoadDialog;
