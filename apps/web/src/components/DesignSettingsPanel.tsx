import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle, ChevronRight } from 'lucide-react';
import axios from 'axios';

interface DesignSettingsPanelProps {
    onRunDesign: (settings: any) => void;
    results?: any;
    loading?: boolean;
}

export function DesignSettingsPanel({ onRunDesign, results, loading = false }: DesignSettingsPanelProps) {
    const [code, setCode] = useState('AISC360-16');
    const [method, setMethod] = useState('LRFD');
    const PYTHON_API_URL = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:8081';

    const handleCheck = async () => {
        // In a real app, 'members' data would come from the central store.
        // Here we emit an event or call API directly if we had member data prop.
        // Assuming props.onRunDesign handles data gathering and API call.
        onRunDesign({ code, method });
    };

    // Helper stats
    const totalChecked = results ? Object.keys(results).length : 0;
    const passed = results ? Object.values(results).filter((r: any) => r.status === 'PASS').length : 0;
    const failed = results ? Object.values(results).filter((r: any) => r.status === 'FAIL').length : 0;

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
                            <Label>Design Code</Label>
                            <Select value={code} onValueChange={setCode}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="AISC360-16">AISC 360-16 (Steel)</SelectItem>
                                    <SelectItem value="Eurocode3">Eurocode 3 (Steel)</SelectItem>
                                    <SelectItem value="ACI318-19" disabled>ACI 318-19 (Concrete) - Coming Soon</SelectItem>
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
                            className="w-full bg-indigo-600 hover:bg-indigo-700 mt-2"
                            onClick={handleCheck}
                            disabled={loading}
                        >
                            {loading ? 'Checking...' : 'Run Code Check'}
                        </Button>
                    </div>

                    {/* Results Section */}
                    {results && (
                        <div className="flex-1 flex flex-col border-t pt-4 space-y-3">
                            <div className="flex items-center justify-between font-semibold text-sm">
                                <span>Results Overview</span>
                                <Badge variant={failed > 0 ? "destructive" : "default"}>
                                    {failed > 0 ? "Check Failed" : "Passed"}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center text-sm">
                                <div className="bg-slate-50 p-2 rounded">
                                    <div className="text-gray-500 text-xs uppercase">Total</div>
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

                            <Label className="text-xs text-gray-500 mt-2">Member Details</Label>
                            <ScrollArea className="h-64 border rounded-md">
                                <div className="divide-y">
                                    {Object.entries(results).map(([id, res]: [string, any]) => (
                                        <div key={id} className="p-3 hover:bg-slate-50 flex justify-between items-center text-sm">
                                            <div className="space-y-1">
                                                <div className="font-medium flex items-center gap-2">
                                                    Member {id}
                                                    {res.status === 'PASS' ?
                                                        <CheckCircle2 className="w-3 h-3 text-green-500" /> :
                                                        <XCircle className="w-3 h-3 text-red-500" />
                                                    }
                                                </div>
                                                <div className="text-xs text-gray-500">{res.governing}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`font-bold ${res.ratio > 1.0 ? 'text-red-600' : 'text-green-600'}`}>
                                                    {res.ratio.toFixed(2)}
                                                </div>
                                                <div className="text-xs text-gray-400">Ratio</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>

                            <Button variant="outline" size="sm" className="w-full gap-1 text-xs">
                                View Calculation Log <ChevronRight className="w-3 h-3" />
                            </Button>
                        </div>
                    )}

                </CardContent>
            </div>
        </Card>
    );
}
