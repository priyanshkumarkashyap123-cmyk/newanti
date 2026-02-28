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
        <Card className="w-full">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="w-5 h-5 text-blue-600" />
                    Non-Linear Analysis Control
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">

                {/* Analysis Method */}
                <div className="space-y-2">
                    <Label>Solution Method</Label>
                    <Select value={method} onValueChange={setMethod}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newton-raphson">Newton-Raphson (Standard)</SelectItem>
                            <SelectItem value="modified-newton">Modified Newton-Raphson</SelectItem>
                            <SelectItem value="arc-length">Arc-Length Method</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        Standard NR is best for most structural problems. Use Arc-Length for snap-through buckling.
                    </p>
                </div>

                {/* Load Stepping */}
                <div className="space-y-4">
                    <div className="flex justify-between">
                        <Label>Load Steps: {loadSteps}</Label>
                        <span className="text-xs text-muted-foreground">Increments</span>
                    </div>
                    <Slider
                        value={[loadSteps]}
                        min={1}
                        max={100}
                        step={1}
                        onValueChange={(v) => setLoadSteps(v[0])}
                    />
                </div>

                {/* Convergence Settings */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Tolerance</Label>
                        <Input
                            type="number"
                            value={tolerance}
                            onChange={(e) => setTolerance(parseFloat(e.target.value))}
                            step="0.0001"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Max Iterations</Label>
                        <Input
                            type="number"
                            value={maxIterations}
                            onChange={(e) => setMaxIterations(parseInt(e.target.value))}
                        />
                    </div>
                </div>

                {/* Effects to Include */}
                <div className="space-y-3 pt-2 border-t">
                    <Label className="text-sm font-semibold">Non-Linearity Types</Label>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={geometricNonLinearity}
                                onCheckedChange={setGeometricNonLinearity}
                            />
                            <Label className="font-normal cursor-pointer" onClick={() => setGeometricNonLinearity(!geometricNonLinearity)}>
                                Geometric (P-Delta, Large Disp)
                            </Label>
                        </div>
                        <span title="Updates stiffness matrix based on deformed geometry" className="text-gray-500 dark:text-gray-400 cursor-help w-4 h-4">
                            <Info className="w-4 h-4" />
                        </span>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={materialNonLinearity}
                                onCheckedChange={setMaterialNonLinearity}
                            />
                            <Label className="font-normal cursor-pointer" onClick={() => setMaterialNonLinearity(!materialNonLinearity)}>
                                Material (Yielding, Crushing)
                            </Label>
                        </div>
                        <span title="Uses non-linear stress-strain relationships" className="text-gray-500 dark:text-gray-400 cursor-help w-4 h-4">
                            <Info className="w-4 h-4" />
                        </span>
                    </div>
                </div>

                {/* Action Button */}
                <Button
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="lg"
                    onClick={handleRun}
                    disabled={isAnalyzing}
                >
                    {isAnalyzing ? (
                        <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-zinc-200 dark:border-white border-t-transparent"></div>
                            Solving...
                        </div>
                    ) : (
                        <>
                            <PlayCircle className="w-5 h-5 mr-2" />
                            Run Non-Linear Analysis
                        </>
                    )}
                </Button>

            </CardContent>
        </Card>
    );
}
