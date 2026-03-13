import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Activity, Play, Pause, Waves, Calculator } from 'lucide-react';
import { useModelStore } from '../store/model';
import { useUIStore } from '../store/uiStore';
import { ClientDesignService } from '../services/ClientDesignService';

export function DynamicsPanel() {
    const nodes = useModelStore(state => state.nodes);
    const members = useModelStore(state => state.members);
    const showNotification = useUIStore(state => state.showNotification);

    // Modal Analysis State
    const [numModes, setNumModes] = useState(3);
    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [animatingMode, setAnimatingMode] = useState<number | null>(null);

    // Seismic Params State
    const [zone, setZone] = useState(0.36); // Zone V
    const [importance, setImportance] = useState(1.0);
    const [reduction, setReduction] = useState(5.0); // SMRF
    const [soil, setSoil] = useState(2); // Medium
    const [scaleX, setScaleX] = useState(1.0);
    const [scaleZ, setScaleZ] = useState(1.0);
    const [seismicResult, setSeismicResult] = useState<any>(null);

    const handleRunAnalysis = async () => {
        setLoading(true);
        try {
            const nodeArray = Array.from(nodes.values());
            const memberArray = Array.from(members.values());

            const res = await ClientDesignService.runModalAnalysis(nodeArray, memberArray, numModes);

            if (res && res.success) {
                setResults(res);
                setSeismicResult(null); // Reset seismic results on new modal run
            } else {
                showNotification('error', `Analysis failed: ${res?.error || 'Unknown error'}`);
            }
        } catch (e) {
            console.error(e);
            showNotification('error', 'Failed to run dynamic analysis');
        } finally {
            setLoading(false);
        }
    };

    const handleSeismicCheck = async () => {
        if (!results) return;
        try {
            const res = await ClientDesignService.runResponseSpectrum(results, {
                zone, importance, reduction, soil, scaleX, scaleZ
            });
            if (res && res.success) {
                setSeismicResult(res);
                showNotification('success', 'Response spectrum results updated');
            }
        } catch (e) {
            console.warn(e);
            showNotification('error', 'Failed to compute response spectrum');
        }
    };

    const toggleAnimation = (modeIndex: number) => {
        if (animatingMode === modeIndex) {
            setAnimatingMode(null);
        } else {
            setAnimatingMode(modeIndex);
        }
    };

    return (
        <Card className="w-full h-full flex flex-col">
            <CardHeader className="pb-3 border-b">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="w-5 h-5 text-indigo-600" />
                    Dynamic Analysis
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 p-4 flex-1 overflow-auto">
                {/* 1. Modal Settings */}
                <div className="space-y-3">
                    <Label className="text-xs font-semibold text-slate-500 uppercase">Eigenvalue Solver</Label>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label>Modes</Label>
                            <Input
                                type="number"
                                min={1} max={50}
                                value={numModes}
                                onChange={(e) => setNumModes(parseInt(e.target.value))}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Mass</Label>
                            <Select defaultValue="consistent">
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="consistent">Consistent</SelectItem>
                                    <SelectItem value="lumped">Lumped</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Button
                        className="w-full bg-indigo-600 hover:bg-indigo-700"
                        onClick={handleRunAnalysis}
                        disabled={loading}
                    >
                        {loading ? 'Solving...' : 'Calculate Frequencies'}
                    </Button>
                </div>

                {/* 2. Modal Results */}
                {results && (
                    <div className="space-y-2">
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">Mode</TableHead>
                                        <TableHead>Freq(Hz)</TableHead>
                                        <TableHead>T(s)</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {results.frequencies.map((f: number, i: number) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium">{i + 1}</TableCell>
                                            <TableCell>{f.toFixed(2)}</TableCell>
                                            <TableCell>{results.periods[i].toFixed(3)}</TableCell>
                                            <TableCell>
                                                <Button
                                                    size="sm" variant="ghost" className="h-6 w-6 p-0"
                                                    onClick={() => toggleAnimation(i)}
                                                >
                                                    {animatingMode === i ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* 3. Seismic Analysis */}
                        <div className="pt-4 border-t space-y-3">
                            <h4 className="flex items-center gap-2 text-sm font-semibold">
                                <Waves className="w-4 h-4 text-blue-500" />
                                Response Spectrum (IS 1893)
                            </h4>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <Label>Zone (Z)</Label>
                                    <Input type="number" step="0.01" value={zone} onChange={e => setZone(parseFloat(e.target.value))} />
                                </div>
                                <div>
                                    <Label>Importance (I)</Label>
                                    <Input type="number" step="0.1" value={importance} onChange={e => setImportance(parseFloat(e.target.value))} />
                                </div>
                                <div>
                                    <Label>Response Red. (R)</Label>
                                    <Input type="number" step="0.5" value={reduction} onChange={e => setReduction(parseFloat(e.target.value))} />
                                </div>
                                <div>
                                    <Label>Soil Type</Label>
                                    <Select value={soil.toString()} onValueChange={v => setSoil(parseInt(v))}>
                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">Hard/Rock</SelectItem>
                                            <SelectItem value="2">Medium</SelectItem>
                                            <SelectItem value="3">Soft</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Scale X</Label>
                                    <Input type="number" step="0.1" value={scaleX} onChange={e => setScaleX(parseFloat(e.target.value))} />
                                </div>
                                <div>
                                    <Label>Scale Z</Label>
                                    <Input type="number" step="0.1" value={scaleZ} onChange={e => setScaleZ(parseFloat(e.target.value))} />
                                </div>
                            </div>

                            <Button variant="secondary" size="sm" className="w-full gap-2" onClick={handleSeismicCheck}>
                                <Calculator className="w-3 h-3" /> Calculate Base Shear
                            </Button>

                            {seismicResult && (
                                <div className="bg-slate-100 p-3 rounded-md text-sm space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Base Shear X:</span>
                                        <span className="font-bold">{seismicResult.base_shear_x.toFixed(2)} kN</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Base Shear Z:</span>
                                        <span className="font-bold">{seismicResult.base_shear_z.toFixed(2)} kN</span>
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 pt-1 border-t">
                                        Governing Period: {seismicResult.periods[0].toFixed(3)}s
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
