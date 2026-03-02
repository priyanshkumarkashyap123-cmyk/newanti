import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle, ChevronRight, Zap } from 'lucide-react';
import { ClientDesignService } from '../services/ClientDesignService';

interface DesignSettingsPanelProps {
    onRunDesign: (settings: any) => void;
    results?: any;
    loading?: boolean;
}

export function DesignSettingsPanel({ onRunDesign, results, loading = false }: DesignSettingsPanelProps) {
    const [code, setCode] = useState('AISC360-16');
    const [method, setMethod] = useState('LRFD');
    const [executionMode, setExecutionMode] = useState<'server' | 'client'>('server');
    const [clientResult, setClientResult] = useState<any>(null);

    const handleCheck = async () => {
        // Mode 1: Server-Side (Python)
        if (executionMode === 'server') {
            onRunDesign({ code, method });
            setClientResult(null);
        }
        // Mode 2: Client-Side (Rust WASM)
        else {
            if (code !== 'AISC360-16') {
                alert("Only AISC 360-16 is currently supported in Local Rust mode.");
                return;
            }

            await ClientDesignService.init();

            // Mock member for demo (W14x90)
            // In real app, iterate over selected members from store
            const mockMember = {
                d: 14.02, bf: 14.52, tw: 0.44, tf: 0.71, // W14x90
                rx: 6.14, ry: 3.7, zx: 157, zy: 75.6, sx: 143, sy: 49.9,
                j: 4.06, cw: 16000, ag: 26.5,
                fy: 50, E: 29000,
                lb: 180, lc_x: 180, lc_y: 180, cb: 1.0
            };

            const res = ClientDesignService.checkAISC(mockMember);

            if (res) {
                // Mock result formatting to match server response structure
                const ratio = Math.max(
                    res.Pn_compression > 0 ? 500 / res.Pn_compression : 0, // Mock demand 500kips
                    res.Mn_major > 0 ? 2000 / res.Mn_major : 0 // Mock moment
                );

                setClientResult({
                    "1": {
                        ratio: ratio,
                        status: ratio <= 1.0 ? "PASS" : "FAIL",
                        governing: "Client-Side Rust Check",
                        capacity: res,
                        log: ["Computed locally via WASM"]
                    }
                });
            }
        }
    };

    // Determine which results to show
    const activeResults = clientResult || results;
    const isClient = !!clientResult;

    // Helper stats
    const totalChecked = activeResults ? Object.keys(activeResults).length : 0;
    const passed = activeResults ? Object.values(activeResults).filter((r: any) => r.status === 'PASS').length : 0;
    const failed = activeResults ? Object.values(activeResults).filter((r: any) => r.status === 'FAIL').length : 0;

    return (
        <Card className="w-full h-full flex flex-col">
            <CardHeader className="pb-3 border-b">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    Structural Design
                </CardTitle>
            </CardHeader>

            <div className="flex-1 overflow-hidden flex flex-col">
                <CardContent className="space-y-4 p-4">

                    {/* Settings Group */}
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label>Execution Engine</Label>
                            <Tabs value={executionMode} onValueChange={(v: any) => setExecutionMode(v)} className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="server">Cloud (Python)</TabsTrigger>
                                    <TabsTrigger value="client" className="gap-2">
                                        <Zap className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                        Local (Rust)
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                            {executionMode === 'client' && (
                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                    <Zap className="w-3 h-3" /> Instant feedback via WASM.
                                </p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <Label>Design Code</Label>
                            <Select value={code} onValueChange={setCode}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="AISC360-16">AISC 360-16 (Steel)</SelectItem>
                                    <SelectItem value="Eurocode3">Eurocode 3 (Steel)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {code === 'AISC360-16' && (
                            <div className="space-y-1">
                                <Label>Method</Label>
                                <Tabs value={method} onValueChange={setMethod} className="w-full">
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="LRFD">LRFD</TabsTrigger>
                                        <TabsTrigger value="ASD">ASD</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>
                        )}

                        <Button
                            className={`w-full mt-2 ${executionMode === 'client' ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                            onClick={handleCheck}
                            disabled={loading}
                        >
                            {loading ? 'Checking...' : (executionMode === 'client' ? 'Run Local Check ⚡' : 'Run Cloud Check')}
                        </Button>
                    </div>

                    {/* Results Section */}
                    {activeResults && (
                        <div className="flex-1 flex flex-col border-t pt-4 space-y-3">
                            <div className="flex items-center justify-between font-semibold text-sm">
                                <span>Results Overview {isClient && "(Local)"}</span>
                                <Badge variant={failed > 0 ? "destructive" : "default"}>
                                    {failed > 0 ? "Check Failed" : "Passed"}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center text-sm">
                                <div className="bg-slate-50 p-2 rounded">
                                    <div className="text-slate-500 text-xs uppercase">Total</div>
                                    <div className="font-bold">{totalChecked}</div>
                                </div>
                                <div className="bg-green-50 p-2 rounded text-green-700">
                                    <div className="text-green-600 text-xs uppercase">Pass</div>
                                    <div className="font-bold">{passed}</div>
                                </div>
                                <div className="bg-red-50 p-2 rounded text-red-700">
                                    <div className="text-red-600 text-xs uppercase">Fail</div>
                                    <div className="font-bold">{failed}</div>
                                </div>
                            </div>

                            <Label className="text-xs text-slate-500 mt-2">Member Details</Label>
                            <ScrollArea className="h-64 border rounded-md">
                                <div className="divide-y">
                                    {Object.entries(activeResults).map(([id, res]: [string, any]) => (
                                        <div key={id} className="p-3 hover:bg-slate-50 flex justify-between items-center text-sm">
                                            <div className="space-y-1">
                                                <div className="font-medium flex items-center gap-2">
                                                    Member {id}
                                                    {res.status === 'PASS' ?
                                                        <CheckCircle2 className="w-3 h-3 text-green-500" /> :
                                                        <XCircle className="w-3 h-3 text-red-500" />
                                                    }
                                                </div>
                                                <div className="text-xs text-slate-500">{res.governing}</div>
                                                {isClient && <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Pn_c: {res.capacity?.Pn_compression?.toFixed(0)}</div>}
                                            </div>
                                            <div className="text-right">
                                                <div className={`font-bold ${res.ratio > 1.0 ? 'text-red-600' : 'text-green-600'}`}>
                                                    {res.ratio.toFixed(2)}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">Ratio</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}

                </CardContent>
            </div>
        </Card>
    );
}
