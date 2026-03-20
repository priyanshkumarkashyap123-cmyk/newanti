import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { PlayCircle, Activity, Info } from 'lucide-react';
import axios from 'axios';

interface NonLinearAnalysisPanelProps {
    onRunAnalysis: (settings: any) => void;
    isAnalyzing?: boolean;
}

export function NonLinearAnalysisPanel({ onRunAnalysis, isAnalyzing = false }: NonLinearAnalysisPanelProps) {
    const [method, setMethod] = useState('newton-raphson');
    const [loadSteps, setLoadSteps] = useState(10);
    const [tolerance, setTolerance] = useState(0.001);
    const [maxIterations, setMaxIterations] = useState(50);
    const [geometricNonLinearity, setGeometricNonLinearity] = useState(true);
    const [materialNonLinearity, setMaterialNonLinearity] = useState(true);

    const handleRun = () => {
        onRunAnalysis({
            method,
            steps: loadSteps,
            tolerance,
            maxIterations,
            includes: {
                geometric: geometricNonLinearity,
                material: materialNonLinearity
            }
        });
    };

    return (
        <div className="bg-[#131b2e] border border-[#424754]/30 rounded-xl overflow-hidden w-full font-['Inter'] text-[#dae2fd]">
            <div className="p-4 border-b border-[#424754]/30 flex items-center gap-3">
                <Activity className="w-5 h-5 text-[#adc6ff]" />
                <h3 className="font-['Manrope'] font-extrabold text-lg text-[#dae2fd] tracking-tight">Non-Linear Analysis Control</h3>
            </div>
            <div className="p-6 space-y-6">

                {/* Analysis Method */}
                <div className="space-y-2">
                    <Label className="text-[#8c909f] text-sm uppercase tracking-wider font-bold">Solution Method</Label>
                    <Select value={method} onValueChange={setMethod}>
                        <SelectTrigger className="bg-[#0b1326] border-[#424754]/40 text-[#dae2fd] focus:ring-[#adc6ff]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0b1326] border-[#424754]/40 text-[#dae2fd]">
                            <SelectItem value="newton-raphson" className="focus:bg-[#222a3d] focus:text-white">Newton-Raphson (Standard)</SelectItem>
                            <SelectItem value="modified-newton" className="focus:bg-[#222a3d] focus:text-white">Modified Newton-Raphson</SelectItem>
                            <SelectItem value="arc-length" className="focus:bg-[#222a3d] focus:text-white">Arc-Length Method</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-[#8c909f] mt-1">
                        Standard NR is best for most structural problems. Use Arc-Length for snap-through buckling.
                    </p>
                </div>

                {/* Load Stepping */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-[#dae2fd]">Load Steps: <span className="text-[#adc6ff] font-mono">{loadSteps}</span></Label>
                        <span className="text-xs text-[#8c909f]">Increments</span>
                    </div>
                    <Slider
                        value={[loadSteps]}
                        min={1}
                        max={100}
                        step={1}
                        onValueChange={(v) => setLoadSteps(v[0])}
                        className="[&_[role=slider]]:bg-[#adc6ff] [&_[role=slider]]:border-[#adc6ff] [&_.bg-primary]:bg-[#424754]"
                    />
                </div>

                {/* Convergence Settings */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-[#dae2fd]">Tolerance</Label>
                        <Input
                            type="number"
                            value={tolerance}
                            onChange={(e) => setTolerance(parseFloat(e.target.value))}
                            step="0.0001"
                            className="bg-[#0b1326] border-[#424754]/40 text-[#dae2fd] focus:-ring-[#adc6ff] font-mono"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[#dae2fd]">Max Iterations</Label>
                        <Input
                            type="number"
                            value={maxIterations}
                            onChange={(e) => setMaxIterations(parseInt(e.target.value))}
                            className="bg-[#0b1326] border-[#424754]/40 text-[#dae2fd] focus:-ring-[#adc6ff] font-mono"
                        />
                    </div>
                </div>

                {/* Effects to Include */}
                <div className="space-y-4 pt-4 border-t border-[#424754]/30">
                    <Label className="text-[#8c909f] text-sm uppercase tracking-wider font-bold">Non-Linearity Types</Label>
                    
                    <div className="flex items-center justify-between bg-[#0b1326] p-3 rounded-lg border border-[#424754]/20 hover:border-[#424754]/50 transition-colors">
                        <div className="flex items-center gap-3">
                            <Switch
                                checked={geometricNonLinearity}
                                onCheckedChange={setGeometricNonLinearity}
                                className="data-[state=checked]:bg-[#4edea3]"
                            />
                            <Label className="font-normal cursor-pointer text-[#dae2fd]" onClick={() => setGeometricNonLinearity(!geometricNonLinearity)}>
                                Geometric (P-Delta, Large Disp)
                            </Label>
                        </div>
                        <span title="Updates stiffness matrix based on deformed geometry" className="text-[#8c909f] cursor-help">
                            <Info className="w-4 h-4" />
                        </span>
                    </div>

                    <div className="flex items-center justify-between bg-[#0b1326] p-3 rounded-lg border border-[#424754]/20 hover:border-[#424754]/50 transition-colors">
                        <div className="flex items-center gap-3">
                            <Switch
                                checked={materialNonLinearity}
                                onCheckedChange={setMaterialNonLinearity}
                                className="data-[state=checked]:bg-[#4edea3]"
                            />
                            <Label className="font-normal cursor-pointer text-[#dae2fd]" onClick={() => setMaterialNonLinearity(!materialNonLinearity)}>
                                Material (Yielding, Crushing)
                            </Label>
                        </div>
                        <span title="Uses non-linear stress-strain relationships" className="text-[#8c909f] cursor-help">
                            <Info className="w-4 h-4" />
                        </span>
                    </div>
                </div>

                {/* Action Button */}
                <Button
                    className="w-full bg-[#primary-container] bg-[#4d8eff] hover:bg-[#3b7cee] text-[#060e20] font-bold text-sm h-12 shadow-[0_0_15px_rgba(77,142,255,0.2)] transition-all"
                    onClick={handleRun}
                    disabled={isAnalyzing}
                >
                    {isAnalyzing ? (
                        <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#060e20] border-t-transparent"></div>
                            Solving Non-Linear Steps...
                        </div>
                    ) : (
                        <>
                            <PlayCircle className="w-5 h-5 mr-no2 mr-2" />
                            Run Non-Linear Analysis
                        </>
                    )}
                </Button>

            </div>
        </div>
    );
}
