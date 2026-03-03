/**
 * ASCE7SeismicLoadDialog.tsx - ASCE 7 Seismic Load Generator UI
 * Based on ASCE 7-22 Equivalent Lateral Force Procedure
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
import { Activity, MapPin, Building2, Calculator, Info, Settings2, Loader2 } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useModelStore } from '@/store/model';
import { useShallow } from 'zustand/react/shallow';
import { API_CONFIG } from '@/config/env';

// ===== ASCE 7 CONSTANTS =====

const SITE_CLASSES = [
    { value: 'A', label: 'Site Class A - Hard Rock', description: 'Vs > 5000 ft/s' },
    { value: 'B', label: 'Site Class B - Rock', description: 'Vs = 2500-5000 ft/s' },
    { value: 'C', label: 'Site Class C - Dense Soil', description: 'Vs = 1200-2500 ft/s' },
    { value: 'D', label: 'Site Class D - Stiff Soil (Default)', description: 'Vs = 600-1200 ft/s' },
    { value: 'E', label: 'Site Class E - Soft Soil', description: 'Vs < 600 ft/s' },
];

const RISK_CATEGORIES = [
    { value: 1, label: 'Risk Category I - Low hazard', Ie: 1.0 },
    { value: 2, label: 'Risk Category II - Standard (Default)', Ie: 1.0 },
    { value: 3, label: 'Risk Category III - Substantial hazard', Ie: 1.25 },
    { value: 4, label: 'Risk Category IV - Essential facilities', Ie: 1.5 },
];

const STRUCTURAL_SYSTEMS = [
    { value: 'SMF_S', label: 'Special Steel Moment Frame', R: 8.0, Cd: 5.5, Omega: 3.0 },
    { value: 'SMF_RC', label: 'Special RC Moment Frame', R: 8.0, Cd: 5.5, Omega: 3.0 },
    { value: 'IMF', label: 'Intermediate Moment Frame', R: 5.0, Cd: 4.5, Omega: 3.0 },
    { value: 'OMF_S', label: 'Ordinary Steel Moment Frame', R: 3.5, Cd: 3.0, Omega: 3.0 },
    { value: 'OMF_RC', label: 'Ordinary RC Moment Frame', R: 3.0, Cd: 2.5, Omega: 3.0 },
    { value: 'SCBF', label: 'Special Concentric Braced Frame', R: 6.0, Cd: 5.0, Omega: 2.0 },
    { value: 'OCBF', label: 'Ordinary Concentric Braced Frame', R: 3.25, Cd: 3.25, Omega: 2.0 },
    { value: 'SSW', label: 'Special Shear Wall', R: 6.0, Cd: 5.0, Omega: 2.5 },
    { value: 'OSW', label: 'Ordinary Shear Wall', R: 5.0, Cd: 4.5, Omega: 2.5 },
    { value: 'DUAL', label: 'Dual System', R: 7.0, Cd: 5.5, Omega: 2.5 },
];

interface FloorData {
    level: number;
    height: number;
    weight: number;
}

interface ASCE7Params {
    // Site parameters
    Ss: number;  // Short period spectral acceleration
    S1: number;  // 1-second spectral acceleration
    TL: number;  // Long-period transition
    siteClass: string;

    // Building info
    riskCategory: number;
    structuralSystem: string;
    R: number;
    Cd: number;
    Omega: number;
    Ie: number;

    // Geometry
    height: number;  // meters
    numStoreys: number;
    floors: FloorData[];

    // Period
    userPeriod: number | null;
    direction: 'X' | 'Y';
}

interface ASCE7Results {
    Fa: number;
    Fv: number;
    SDS: number;
    SD1: number;
    SDC: string;
    Ta: number;
    T: number;
    Cu: number;
    Cs: number;
    W: number;
    V: number;
    Qi: { level: number; height: number; weight: number; force: number; shear: number }[];
    overturningMoment: number;
}

const ASCE7SeismicLoadDialog: React.FC = () => {
    const { modals, setModal } = useUIStore(
      useShallow((s) => ({ modals: s.modals, setModal: s.setModal }))
    );
    const isOpen = modals.asce7SeismicDialog || false;

    const [activeTab, setActiveTab] = useState('site');
    const [params, setParams] = useState<ASCE7Params>({
        Ss: 1.0,
        S1: 0.4,
        TL: 8.0,
        siteClass: 'D',
        riskCategory: 2,
        structuralSystem: 'SMF_S',
        R: 8.0,
        Cd: 5.5,
        Omega: 3.0,
        Ie: 1.0,
        height: 30,
        numStoreys: 10,
        floors: [],
        userPeriod: null,
        direction: 'X',
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

    // Get Fa coefficient
    const getFa = (Ss: number, site: string): number => {
        const table: Record<string, number[]> = {
            'A': [0.8, 0.8, 0.8, 0.8, 0.8],
            'B': [0.9, 0.9, 0.9, 0.9, 0.9],
            'C': [1.3, 1.3, 1.2, 1.2, 1.2],
            'D': [1.6, 1.4, 1.2, 1.1, 1.0],
            'E': [2.4, 1.7, 1.3, 1.0, 0.9],
        };
        const ssVals = [0.25, 0.5, 0.75, 1.0, 1.25];
        const row = table[site] || table['D'];
        if (Ss <= 0.25) return row[0];
        if (Ss >= 1.25) return row[4];
        for (let i = 0; i < ssVals.length - 1; i++) {
            if (Ss <= ssVals[i + 1]) {
                const t = (Ss - ssVals[i]) / (ssVals[i + 1] - ssVals[i]);
                return row[i] + t * (row[i + 1] - row[i]);
            }
        }
        return row[4];
    };

    // Get Fv coefficient
    const getFv = (S1: number, site: string): number => {
        const table: Record<string, number[]> = {
            'A': [0.8, 0.8, 0.8, 0.8, 0.8],
            'B': [0.8, 0.8, 0.8, 0.8, 0.8],
            'C': [1.5, 1.5, 1.5, 1.5, 1.5],
            'D': [2.4, 2.2, 2.0, 1.9, 1.8],
            'E': [4.2, 3.3, 2.8, 2.4, 2.2],
        };
        const s1Vals = [0.1, 0.2, 0.3, 0.4, 0.5];
        const row = table[site] || table['D'];
        if (S1 <= 0.1) return row[0];
        if (S1 >= 0.5) return row[4];
        for (let i = 0; i < s1Vals.length - 1; i++) {
            if (S1 <= s1Vals[i + 1]) {
                const t = (S1 - s1Vals[i]) / (s1Vals[i + 1] - s1Vals[i]);
                return row[i] + t * (row[i + 1] - row[i]);
            }
        }
        return row[4];
    };

    // Calculate results
    const results = useMemo((): ASCE7Results | null => {
        if (!params.height || params.floors.length === 0) return null;

        const W = params.floors.reduce((sum, f) => sum + f.weight, 0);
        if (W === 0) return null;

        // Site coefficients
        const Fa = getFa(params.Ss, params.siteClass);
        const Fv = getFv(params.S1, params.siteClass);

        // Design accelerations
        const SMS = Fa * params.Ss;
        const SM1 = Fv * params.S1;
        const SDS = (2 / 3) * SMS;
        const SD1 = (2 / 3) * SM1;

        // Seismic Design Category
        let SDC: string;
        if (SDS >= 0.50 || SD1 >= 0.20) SDC = 'D';
        else if (SDS >= 0.33 || SD1 >= 0.133) SDC = 'C';
        else if (SDS >= 0.167 || SD1 >= 0.067) SDC = 'B';
        else SDC = 'A';

        // Period
        const hn_ft = params.height * 3.281;
        const sys = params.structuralSystem;
        let Ct: number, x: number;
        if (sys.includes('SMF_S') || sys.includes('OMF_S')) { Ct = 0.028; x = 0.8; }
        else if (sys.includes('SMF_RC') || sys.includes('OMF_RC') || sys === 'IMF') { Ct = 0.016; x = 0.9; }
        else { Ct = 0.02; x = 0.75; }

        const Ta = Ct * Math.pow(hn_ft, x);

        // Cu coefficient
        let Cu: number;
        if (SD1 >= 0.4) Cu = 1.4;
        else if (SD1 >= 0.3) Cu = 1.4;
        else if (SD1 >= 0.2) Cu = 1.5;
        else if (SD1 >= 0.15) Cu = 1.6;
        else Cu = 1.7;

        const T = params.userPeriod !== null ? Math.min(params.userPeriod, Cu * Ta) : Ta;

        // Seismic response coefficient
        let Cs = SDS / (params.R / params.Ie);
        const Cs_max = T <= params.TL
            ? SD1 / (T * (params.R / params.Ie))
            : SD1 * params.TL / (T * T * (params.R / params.Ie));
        Cs = Math.min(Cs, Cs_max);
        const Cs_min = Math.max(0.044 * SDS * params.Ie, 0.01);
        Cs = Math.max(Cs, Cs_min);
        if (params.S1 >= 0.6) {
            Cs = Math.max(Cs, 0.5 * params.S1 / (params.R / params.Ie));
        }

        // Base shear
        const V = Cs * W;

        // Vertical distribution
        const k = T <= 0.5 ? 1.0 : T >= 2.5 ? 2.0 : 1.0 + (T - 0.5) / 2.0;
        const denom = params.floors.reduce((sum, f) => sum + f.weight * Math.pow(f.height, k), 0);

        let cumShear = 0;
        const Qi = params.floors.slice().reverse().map(floor => {
            const Cvx = (floor.weight * Math.pow(floor.height, k)) / denom;
            const Fx = Cvx * V;
            cumShear += Fx;
            return { ...floor, force: Fx, shear: cumShear };
        }).reverse();

        // Overturning moment
        const M = Qi.reduce((sum, q) => sum + q.force * q.height, 0);

        return { Fa, Fv, SDS, SD1, SDC, Ta, T, Cu, Cs, W, V, Qi, overturningMoment: M };
    }, [params]);

    const handleSystemChange = (value: string) => {
        const sys = STRUCTURAL_SYSTEMS.find(s => s.value === value);
        if (sys) {
            setParams(prev => ({
                ...prev,
                structuralSystem: value,
                R: sys.R,
                Cd: sys.Cd,
                Omega: sys.Omega,
            }));
        }
    };

    const handleRiskChange = (value: string) => {
        const rc = RISK_CATEGORIES.find(r => r.value === parseInt(value));
        if (rc) {
            setParams(prev => ({ ...prev, riskCategory: rc.value, Ie: rc.Ie }));
        }
    };

    const handleApply = () => {
        if (!results) return;
        const { nodes, addLoadCase } = useModelStore.getState();
        const direction = params.direction || 'X';

        // Group nodes by Y-level (floor height) with 0.1m tolerance
        const levelMap = new Map<number, string[]>();
        nodes.forEach((node, id) => {
            const roundedY = Math.round(node.y * 10) / 10;
            if (!levelMap.has(roundedY)) levelMap.set(roundedY, []);
            levelMap.get(roundedY)!.push(id);
        });

        // Build nodal loads by matching story heights to Y-levels
        const nodalLoads: { id: string; nodeId: string; fx?: number; fy?: number; fz?: number }[] = [];
        let loadIdx = 0;

        results.Qi.forEach(story => {
            // Find the closest Y-level to this story height
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
                        const load: any = { id: `EQ_${loadIdx}`, nodeId };
                        if (direction === 'X') load.fx = forcePerNode;
                        else load.fz = forcePerNode;
                        nodalLoads.push(load);
                    });
                }
            }
        });

        // Create seismic load case
        addLoadCase({
            id: `LC_EQ_ASCE7_${direction}`,
            name: `Seismic ASCE 7 (${direction})`,
            type: 'seismic',
            loads: nodalLoads,
            memberLoads: [],
            factor: 1.0,
        });

        setModal('asce7SeismicDialog', false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => setModal('asce7SeismicDialog', open)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-blue-500" />
                        ASCE 7 Seismic Load Generator
                        <Badge variant="secondary" className="ml-2">ASCE 7-22</Badge>
                    </DialogTitle>
                    <DialogDescription>
                        Calculate seismic loads per ASCE 7-22 Equivalent Lateral Force Procedure
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="site"><MapPin className="h-4 w-4 mr-1" />Site</TabsTrigger>
                        <TabsTrigger value="building"><Building2 className="h-4 w-4 mr-1" />Building</TabsTrigger>
                        <TabsTrigger value="params"><Settings2 className="h-4 w-4 mr-1" />Parameters</TabsTrigger>
                        <TabsTrigger value="results"><Calculator className="h-4 w-4 mr-1" />Results</TabsTrigger>
                    </TabsList>

                    {/* Site Tab */}
                    <TabsContent value="site" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Short Period Spectral Acceleration (Ss)</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={params.Ss}
                                    onChange={e => setParams(p => ({ ...p, Ss: parseFloat(e.target.value) || 0 }))}
                                />
                                <p className="text-xs text-muted-foreground">From USGS seismic hazard maps (g)</p>
                            </div>
                            <div className="space-y-2">
                                <Label>1-Second Spectral Acceleration (S1)</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={params.S1}
                                    onChange={e => setParams(p => ({ ...p, S1: parseFloat(e.target.value) || 0 }))}
                                />
                                <p className="text-xs text-muted-foreground">From USGS seismic hazard maps (g)</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Site Class</Label>
                            <Select value={params.siteClass} onValueChange={v => setParams(p => ({ ...p, siteClass: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {SITE_CLASSES.map(sc => (
                                        <SelectItem key={sc.value} value={sc.value}>
                                            {sc.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Info className="h-4 w-4 text-blue-600" />
                                <span className="text-sm">
                                    Ss and S1 values can be obtained from the USGS Seismic Design Maps at{' '}
                                    <a href="https://seismicmaps.org" target="_blank" rel="noopener" className="underline">
                                        seismicmaps.org
                                    </a>
                                </span>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Building Tab */}
                    <TabsContent value="building" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Risk Category</Label>
                                <Select value={params.riskCategory.toString()} onValueChange={handleRiskChange}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {RISK_CATEGORIES.map(rc => (
                                            <SelectItem key={rc.value} value={rc.value.toString()}>
                                                {rc.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Importance Factor (Ie)</Label>
                                <Input value={params.Ie} disabled className="bg-slate-100 dark:bg-slate-800" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Seismic Force-Resisting System</Label>
                            <Select value={params.structuralSystem} onValueChange={handleSystemChange}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {STRUCTURAL_SYSTEMS.map(sys => (
                                        <SelectItem key={sys.value} value={sys.value}>
                                            {sys.label} (R={sys.R})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded text-center">
                                <div className="text-xs text-muted-foreground">R Factor</div>
                                <div className="font-bold">{params.R}</div>
                            </div>
                            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded text-center">
                                <div className="text-xs text-muted-foreground">Cd Factor</div>
                                <div className="font-bold">{params.Cd}</div>
                            </div>
                            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded text-center">
                                <div className="text-xs text-muted-foreground">Ω₀ Factor</div>
                                <div className="font-bold">{params.Omega}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Building Height (m)</Label>
                                <Input
                                    type="number"
                                    value={params.height}
                                    onChange={e => setParams(p => ({ ...p, height: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Number of Stories</Label>
                                <Input
                                    type="number"
                                    value={params.numStoreys}
                                    onChange={e => setParams(p => ({ ...p, numStoreys: parseInt(e.target.value) || 1 }))}
                                    min={1}
                                />
                            </div>
                        </div>
                    </TabsContent>

                    {/* Parameters Tab */}
                    <TabsContent value="params" className="space-y-4 mt-4">
                        <div className="flex items-center justify-between">
                            <Label>Story Weights</Label>
                            <span className="text-sm text-muted-foreground">
                                Total: {params.floors.reduce((s, f) => s + f.weight, 0).toFixed(0)} kN
                            </span>
                        </div>

                        <div className="max-h-56 overflow-y-auto border rounded">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                                    <tr>
                                        <th className="p-2 text-left">Story</th>
                                        <th className="p-2 text-right">Height (m)</th>
                                        <th className="p-2 text-right">Weight (kN)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {params.floors.slice().reverse().map((floor, i) => (
                                        <tr key={floor.level} className="border-t">
                                            <td className="p-2">{floor.level === params.numStoreys ? 'Roof' : `Story ${floor.level}`}</td>
                                            <td className="p-2 text-right">{floor.height.toFixed(1)}</td>
                                            <td className="p-2">
                                                <Input
                                                    type="number"
                                                    value={floor.weight}
                                                    onChange={e => {
                                                        const newFloors = [...params.floors];
                                                        newFloors[params.numStoreys - 1 - i].weight = parseFloat(e.target.value) || 0;
                                                        setParams(p => ({ ...p, floors: newFloors }));
                                                    }}
                                                    className="w-24 ml-auto"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Load Direction</Label>
                                <Select value={params.direction} onValueChange={v => setParams(p => ({ ...p, direction: v as 'X' | 'Y' }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="X">X Direction</SelectItem>
                                        <SelectItem value="Y">Y Direction</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Long-Period Transition (TL)</Label>
                                <Input
                                    type="number"
                                    value={params.TL}
                                    onChange={e => setParams(p => ({ ...p, TL: parseFloat(e.target.value) || 8 }))}
                                />
                            </div>
                        </div>
                    </TabsContent>

                    {/* Results Tab */}
                    <TabsContent value="results" className="space-y-4 mt-4">
                        {results ? (
                            <>
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded text-center">
                                        <div className="text-xs text-muted-foreground">SDS</div>
                                        <div className="font-bold">{results.SDS.toFixed(3)}</div>
                                    </div>
                                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded text-center">
                                        <div className="text-xs text-muted-foreground">SD1</div>
                                        <div className="font-bold">{results.SD1.toFixed(3)}</div>
                                    </div>
                                    <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded text-center">
                                        <div className="text-xs text-muted-foreground">SDC</div>
                                        <div className="font-bold text-blue-700 dark:text-blue-300">{results.SDC}</div>
                                    </div>
                                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded text-center">
                                        <div className="text-xs text-muted-foreground">T (Period)</div>
                                        <div className="font-bold">{results.T.toFixed(3)}s</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded text-center">
                                        <div className="text-xs text-muted-foreground">Cs</div>
                                        <div className="font-bold text-blue-700 dark:text-blue-300">{results.Cs.toFixed(4)}</div>
                                    </div>
                                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded text-center">
                                        <div className="text-xs text-muted-foreground">W (Total Weight)</div>
                                        <div className="font-bold">{results.W.toFixed(0)} kN</div>
                                    </div>
                                    <div className="p-3 bg-red-100 dark:bg-red-900 rounded text-center">
                                        <div className="text-xs text-muted-foreground">V (Base Shear)</div>
                                        <div className="font-bold text-red-700 dark:text-red-300">{results.V.toFixed(1)} kN</div>
                                    </div>
                                </div>

                                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded font-mono text-sm">
                                    <div>V = Cs × W = {results.Cs.toFixed(4)} × {results.W.toFixed(0)} = {results.V.toFixed(1)} kN</div>
                                    <div className="text-muted-foreground text-xs mt-1">
                                        ({(results.Cs * 100).toFixed(2)}% of seismic weight)
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-900">
                                            <tr className="border-b">
                                                <th className="p-2 text-left">Story</th>
                                                <th className="p-2 text-right">hx (m)</th>
                                                <th className="p-2 text-right">Wx (kN)</th>
                                                <th className="p-2 text-right">Fx (kN)</th>
                                                <th className="p-2 text-right">Vx (kN)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.Qi.slice().reverse().map(q => (
                                                <tr key={q.level} className="border-b">
                                                    <td className="p-2">{q.level === params.numStoreys ? 'Roof' : `Story ${q.level}`}</td>
                                                    <td className="p-2 text-right">{q.height.toFixed(1)}</td>
                                                    <td className="p-2 text-right">{q.weight.toFixed(0)}</td>
                                                    <td className="p-2 text-right font-medium text-red-600">{q.force.toFixed(1)}</td>
                                                    <td className="p-2 text-right text-muted-foreground">{q.shear.toFixed(1)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-100 dark:bg-slate-800 font-medium">
                                            <tr>
                                                <td className="p-2">Total</td>
                                                <td className="p-2"></td>
                                                <td className="p-2 text-right">{results.W.toFixed(0)}</td>
                                                <td className="p-2 text-right text-red-600">{results.V.toFixed(1)}</td>
                                                <td className="p-2"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <div className="p-3 border rounded flex justify-between">
                                    <span>Overturning Moment at Base</span>
                                    <span className="font-bold">{results.overturningMoment.toFixed(1)} kN·m</span>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                Enter site and building parameters to calculate seismic loads
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setModal('asce7SeismicDialog', false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleApply} disabled={!results} className="bg-blue-600 hover:bg-blue-700">
                        <Activity className="h-4 w-4 mr-2" />
                        Apply Seismic Loads
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ASCE7SeismicLoadDialog;
