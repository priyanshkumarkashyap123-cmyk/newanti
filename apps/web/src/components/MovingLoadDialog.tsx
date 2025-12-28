/**
 * MovingLoadDialog.tsx - Moving Load (Bridge) Analysis UI
 * Based on IRC 6:2017 and AASHTO HL-93
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
import { Slider } from './ui/slider';
import { 
    Truck, 
    Route, 
    Settings, 
    Calculator, 
    Play, 
    Pause, 
    SkipForward,
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    Info,
    Zap
} from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

// ===== VEHICLE DEFINITIONS =====

interface Axle {
    position: number;  // Distance from front (m)
    load: number;      // Axle load (kN)
    width?: number;    // Transverse width (m)
}

interface Vehicle {
    id: string;
    name: string;
    code: string;
    axles: Axle[];
    totalLoad: number;
    length: number;
    description: string;
}

const STANDARD_VEHICLES: Vehicle[] = [
    {
        id: 'irc_class_a',
        name: 'IRC Class A',
        code: 'IRC 6:2017',
        description: 'Standard wheeled vehicle for bridges',
        axles: [
            { position: 0, load: 27, width: 1.8 },
            { position: 1.1, load: 27, width: 1.8 },
            { position: 4.3, load: 114, width: 1.8 },
            { position: 7.5, load: 114, width: 1.8 },
            { position: 10.7, load: 68, width: 1.8 },
            { position: 13.9, load: 68, width: 1.8 },
            { position: 16.0, load: 68, width: 1.8 },
            { position: 18.5, load: 68, width: 1.8 },
        ],
        totalLoad: 554,
        length: 18.5,
    },
    {
        id: 'irc_class_aa_tracked',
        name: 'IRC Class AA (Tracked)',
        code: 'IRC 6:2017',
        description: 'Military tracked vehicle',
        axles: [
            { position: 0, load: 350, width: 0.85 },
            { position: 3.6, load: 350, width: 0.85 },
        ],
        totalLoad: 700,
        length: 3.6,
    },
    {
        id: 'irc_70r_wheeled',
        name: 'IRC 70R (Wheeled)',
        code: 'IRC 6:2017',
        description: 'Heavy wheeled vehicle (1000 kN)',
        axles: [
            { position: 0, load: 80, width: 2.06 },
            { position: 1.37, load: 120, width: 2.06 },
            { position: 4.17, load: 120, width: 2.06 },
            { position: 5.54, load: 170, width: 2.06 },
            { position: 8.34, load: 170, width: 2.06 },
            { position: 9.71, load: 170, width: 2.06 },
            { position: 12.51, load: 170, width: 2.06 },
        ],
        totalLoad: 1000,
        length: 12.51,
    },
    {
        id: 'aashto_hl93_truck',
        name: 'AASHTO HL-93 Truck',
        code: 'AASHTO LRFD',
        description: 'US design truck (3-axle)',
        axles: [
            { position: 0, load: 35, width: 1.8 },
            { position: 4.3, load: 145, width: 1.8 },
            { position: 8.6, load: 145, width: 1.8 },  // Variable 4.3-9.0m
        ],
        totalLoad: 325,
        length: 8.6,
    },
    {
        id: 'aashto_hl93_tandem',
        name: 'AASHTO HL-93 Tandem',
        code: 'AASHTO LRFD',
        description: 'US design tandem',
        axles: [
            { position: 0, load: 110, width: 1.8 },
            { position: 1.2, load: 110, width: 1.8 },
        ],
        totalLoad: 220,
        length: 1.2,
    },
    {
        id: 'ec_lm1',
        name: 'Eurocode LM1',
        code: 'EN 1991-2',
        description: 'European load model (tandem)',
        axles: [
            { position: 0, load: 150, width: 2.0 },
            { position: 1.2, load: 150, width: 2.0 },
        ],
        totalLoad: 300,
        length: 1.2,
    },
    {
        id: 'custom',
        name: 'Custom Vehicle',
        code: 'User Defined',
        description: 'Define your own axle configuration',
        axles: [
            { position: 0, load: 100, width: 1.8 },
            { position: 4.0, load: 100, width: 1.8 },
        ],
        totalLoad: 200,
        length: 4.0,
    }
];

interface Lane {
    id: string;
    startNode: string;
    endNode: string;
    offset: number;  // Transverse offset from centerline
}

interface MovingLoadParams {
    vehicleId: string;
    vehicle: Vehicle;
    
    // Bridge geometry
    spanLength: number;
    numSpans: number;
    laneWidth: number;
    numLanes: number;
    
    // Analysis options
    increment: number;       // Position increment (m)
    includeImpact: boolean;
    impactFactor: number;
    
    // Lane positions
    lanes: Lane[];
    selectedLane: number;
    
    // Animation
    currentPosition: number;
    isAnimating: boolean;
}

interface EnvelopeResult {
    position: number;
    maxMoment: number;
    minMoment: number;
    maxShear: number;
    minShear: number;
    maxReaction: number;
}

const MovingLoadDialog: React.FC = () => {
    const { modals, setModal } = useUIStore();
    const isOpen = modals.movingLoadDialog || false;
    
    const [activeTab, setActiveTab] = useState('vehicle');
    const [params, setParams] = useState<MovingLoadParams>({
        vehicleId: 'irc_class_a',
        vehicle: STANDARD_VEHICLES[0],
        spanLength: 20,
        numSpans: 1,
        laneWidth: 3.5,
        numLanes: 2,
        increment: 0.5,
        includeImpact: true,
        impactFactor: 1.0,
        lanes: [],
        selectedLane: 0,
        currentPosition: 0,
        isAnimating: false,
    });
    
    const [envelopeResults, setEnvelopeResults] = useState<EnvelopeResult[]>([]);
    const [animationFrame, setAnimationFrame] = useState<number | null>(null);
    
    // Calculate impact factor per IRC 6
    const calculateImpactFactor = (span: number, vehicleType: string): number => {
        if (vehicleType.includes('tracked')) {
            // Tracked vehicles (Class AA)
            if (span <= 5) return 1.25;
            if (span >= 9) return 1.10;
            return 1.25 - 0.0375 * (span - 5);
        } else if (vehicleType.includes('wheeled') || vehicleType.includes('70r')) {
            // Wheeled vehicles
            if (span <= 3) return 1.545;
            if (span <= 45) return 4.5 / (6 + span) + 1.0;
            return 1.088;
        } else {
            // Class A
            if (span <= 3) return 1.545;
            if (span <= 45) return 4.5 / (6 + span) + 1.0;
            return 1.088;
        }
    };
    
    // Update impact factor when vehicle or span changes
    React.useEffect(() => {
        if (params.includeImpact) {
            const impact = calculateImpactFactor(params.spanLength, params.vehicleId);
            setParams(prev => ({ ...prev, impactFactor: impact }));
        }
    }, [params.spanLength, params.vehicleId, params.includeImpact]);
    
    // Calculate influence line values for simply supported span
    const calculateInfluenceLine = (position: number, span: number, type: 'moment' | 'shear') => {
        const x = position;
        const L = span;
        
        if (x < 0 || x > L) return { value: 0, loadPosition: position };
        
        if (type === 'moment') {
            // IL for moment at x: ordinate = x(L-a)/L where a is load position
            // Max moment ordinate at x = x(L-x)/L
            return {
                value: x * (L - x) / L,
                loadPosition: x
            };
        } else {
            // IL for shear at x
            // For load at a: if a < x: +ordinate, if a > x: -ordinate
            return {
                value: x < L / 2 ? (L - x) / L : -x / L,
                loadPosition: x
            };
        }
    };
    
    // Calculate envelope results
    const calculateEnvelope = () => {
        const results: EnvelopeResult[] = [];
        const L = params.spanLength;
        const vehicle = params.vehicle;
        const impact = params.includeImpact ? params.impactFactor : 1.0;
        
        // Analysis points along span
        const numPoints = Math.ceil(L / params.increment) + 1;
        
        for (let i = 0; i < numPoints; i++) {
            const x = i * params.increment;
            if (x > L) continue;
            
            let maxM = 0, minM = 0, maxV = 0, minV = 0, maxR = 0;
            
            // Move vehicle across span
            const vehicleLength = vehicle.length;
            const startPos = -vehicleLength;
            const endPos = L + vehicleLength;
            
            for (let vPos = startPos; vPos <= endPos; vPos += params.increment) {
                let M = 0, V = 0, RA = 0;
                
                // Sum effects from all axles
                for (const axle of vehicle.axles) {
                    const axlePos = vPos + axle.position;
                    
                    if (axlePos >= 0 && axlePos <= L) {
                        const P = axle.load * impact;
                        
                        // Moment at x due to load P at axlePos
                        if (axlePos < x) {
                            M += P * axlePos * (L - x) / L;
                        } else {
                            M += P * (L - axlePos) * x / L;
                        }
                        
                        // Shear at x
                        if (axlePos < x) {
                            V -= P * axlePos / L;
                        } else {
                            V += P * (L - axlePos) / L;
                        }
                        
                        // Reaction at A
                        RA += P * (L - axlePos) / L;
                    }
                }
                
                maxM = Math.max(maxM, M);
                minM = Math.min(minM, M);
                maxV = Math.max(maxV, V);
                minV = Math.min(minV, V);
                maxR = Math.max(maxR, RA);
            }
            
            results.push({
                position: x,
                maxMoment: maxM,
                minMoment: minM,
                maxShear: maxV,
                minShear: minV,
                maxReaction: maxR,
            });
        }
        
        setEnvelopeResults(results);
    };
    
    // Vehicle selection handler
    const handleVehicleChange = (vehicleId: string) => {
        const vehicle = STANDARD_VEHICLES.find(v => v.id === vehicleId) || STANDARD_VEHICLES[0];
        setParams(prev => ({
            ...prev,
            vehicleId,
            vehicle: { ...vehicle }
        }));
    };
    
    // Animation controls
    const startAnimation = () => {
        setParams(prev => ({ ...prev, isAnimating: true }));
        animateStep();
    };
    
    const stopAnimation = () => {
        setParams(prev => ({ ...prev, isAnimating: false }));
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
    };
    
    const animateStep = () => {
        setParams(prev => {
            let newPos = prev.currentPosition + 0.2;
            if (newPos > prev.spanLength + prev.vehicle.length) {
                newPos = -prev.vehicle.length;
            }
            return { ...prev, currentPosition: newPos };
        });
        
        setAnimationFrame(requestAnimationFrame(() => {
            setTimeout(animateStep, 50);
        }));
    };
    
    const stepForward = () => {
        setParams(prev => ({
            ...prev,
            currentPosition: Math.min(
                prev.currentPosition + params.increment,
                prev.spanLength + prev.vehicle.length
            )
        }));
    };
    
    const stepBackward = () => {
        setParams(prev => ({
            ...prev,
            currentPosition: Math.max(
                prev.currentPosition - params.increment,
                -prev.vehicle.length
            )
        }));
    };
    
    // Find max values from envelope
    const maxValues = useMemo(() => {
        if (envelopeResults.length === 0) return null;
        
        return {
            maxMoment: Math.max(...envelopeResults.map(r => r.maxMoment)),
            maxShear: Math.max(...envelopeResults.map(r => Math.max(r.maxShear, Math.abs(r.minShear)))),
            maxReaction: Math.max(...envelopeResults.map(r => r.maxReaction)),
        };
    }, [envelopeResults]);
    
    const handleApplyLoads = () => {
        console.log('Applying moving load envelope:', {
            vehicle: params.vehicle,
            envelope: envelopeResults,
            maxValues
        });
        
        setModal('movingLoadDialog', false);
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={(open: boolean) => setModal('movingLoadDialog', open)}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-amber-500" />
                        Moving Load Analysis
                        <Badge variant="secondary" className="ml-2">Bridge Design</Badge>
                    </DialogTitle>
                    <DialogDescription>
                        Analyze moving vehicle loads for bridges per IRC 6:2017 / AASHTO LRFD
                    </DialogDescription>
                </DialogHeader>
                
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="vehicle">
                            <Truck className="h-4 w-4 mr-1" />
                            Vehicle
                        </TabsTrigger>
                        <TabsTrigger value="bridge">
                            <Route className="h-4 w-4 mr-1" />
                            Bridge
                        </TabsTrigger>
                        <TabsTrigger value="animation">
                            <Play className="h-4 w-4 mr-1" />
                            Animation
                        </TabsTrigger>
                        <TabsTrigger value="results">
                            <TrendingUp className="h-4 w-4 mr-1" />
                            Envelope
                        </TabsTrigger>
                    </TabsList>
                    
                    {/* Vehicle Tab */}
                    <TabsContent value="vehicle" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Standard Vehicle</Label>
                                <Select
                                    value={params.vehicleId}
                                    onValueChange={handleVehicleChange}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STANDARD_VEHICLES.map(v => (
                                            <SelectItem key={v.id} value={v.id}>
                                                <div className="flex justify-between items-center w-full">
                                                    <span>{v.name}</span>
                                                    <Badge variant="outline" className="ml-2">
                                                        {v.totalLoad} kN
                                                    </Badge>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    {params.vehicle.description}
                                </p>
                            </div>
                            
                            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                <div className="text-sm font-medium mb-2">{params.vehicle.code}</div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>Total Load: <span className="font-bold">{params.vehicle.totalLoad} kN</span></div>
                                    <div>Length: <span className="font-bold">{params.vehicle.length} m</span></div>
                                    <div>Axles: <span className="font-bold">{params.vehicle.axles.length}</span></div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Vehicle diagram */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                            <Label className="mb-2 block">Axle Configuration</Label>
                            <svg viewBox={`-2 0 ${params.vehicle.length + 4} 50`} className="w-full h-24">
                                {/* Vehicle body */}
                                <rect 
                                    x="0" 
                                    y="10" 
                                    width={params.vehicle.length} 
                                    height="15" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="0.3"
                                    rx="2"
                                />
                                
                                {/* Axles */}
                                {params.vehicle.axles.map((axle, i) => (
                                    <g key={i}>
                                        {/* Wheel */}
                                        <circle 
                                            cx={axle.position} 
                                            cy="30" 
                                            r="4" 
                                            fill="currentColor" 
                                            opacity={0.7}
                                        />
                                        {/* Load arrow */}
                                        <line 
                                            x1={axle.position} 
                                            y1="0" 
                                            x2={axle.position} 
                                            y2="8" 
                                            stroke="#ef4444" 
                                            strokeWidth="0.5"
                                        />
                                        <polygon 
                                            points={`${axle.position},10 ${axle.position-1.5},5 ${axle.position+1.5},5`}
                                            fill="#ef4444"
                                        />
                                        {/* Load text */}
                                        <text 
                                            x={axle.position} 
                                            y="45" 
                                            textAnchor="middle" 
                                            fontSize="3"
                                            fill="currentColor"
                                        >
                                            {axle.load}kN
                                        </text>
                                    </g>
                                ))}
                                
                                {/* Dimension line */}
                                <line 
                                    x1="0" 
                                    y1="38" 
                                    x2={params.vehicle.length} 
                                    y2="38" 
                                    stroke="currentColor" 
                                    strokeWidth="0.2"
                                />
                                <text 
                                    x={params.vehicle.length / 2} 
                                    y="42" 
                                    textAnchor="middle" 
                                    fontSize="3"
                                    fill="currentColor"
                                >
                                    {params.vehicle.length}m
                                </text>
                            </svg>
                        </div>
                        
                        {/* Axle table */}
                        <div className="max-h-48 overflow-y-auto border rounded">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                                    <tr>
                                        <th className="p-2 text-left">Axle</th>
                                        <th className="p-2 text-right">Position (m)</th>
                                        <th className="p-2 text-right">Load (kN)</th>
                                        <th className="p-2 text-right">Width (m)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {params.vehicle.axles.map((axle, i) => (
                                        <tr key={i} className="border-t">
                                            <td className="p-2">{i + 1}</td>
                                            <td className="p-2 text-right">{axle.position.toFixed(2)}</td>
                                            <td className="p-2 text-right font-medium">{axle.load}</td>
                                            <td className="p-2 text-right">{axle.width || 1.8}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </TabsContent>
                    
                    {/* Bridge Tab */}
                    <TabsContent value="bridge" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Span Length (m)</Label>
                                <Input
                                    type="number"
                                    value={params.spanLength}
                                    onChange={(e) => setParams(prev => ({
                                        ...prev,
                                        spanLength: parseFloat(e.target.value) || 0
                                    }))}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Number of Spans</Label>
                                <Input
                                    type="number"
                                    value={params.numSpans}
                                    onChange={(e) => setParams(prev => ({
                                        ...prev,
                                        numSpans: parseInt(e.target.value) || 1
                                    }))}
                                    min={1}
                                    max={10}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Lane Width (m)</Label>
                                <Input
                                    type="number"
                                    value={params.laneWidth}
                                    onChange={(e) => setParams(prev => ({
                                        ...prev,
                                        laneWidth: parseFloat(e.target.value) || 3.5
                                    }))}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Number of Lanes</Label>
                                <Input
                                    type="number"
                                    value={params.numLanes}
                                    onChange={(e) => setParams(prev => ({
                                        ...prev,
                                        numLanes: parseInt(e.target.value) || 1
                                    }))}
                                    min={1}
                                    max={6}
                                />
                            </div>
                        </div>
                        
                        {/* Impact Factor */}
                        <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-amber-600" />
                                    <Label>Include Impact Factor</Label>
                                </div>
                                <Switch
                                    checked={params.includeImpact}
                                    onCheckedChange={(checked: boolean) => setParams(prev => ({
                                        ...prev,
                                        includeImpact: checked
                                    }))}
                                />
                            </div>
                            
                            {params.includeImpact && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="text-sm">
                                        <span className="text-muted-foreground">Calculated Impact (IRC 6):</span>
                                        <span className="ml-2 font-bold text-amber-700 dark:text-amber-300">
                                            {(params.impactFactor * 100 - 100).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-muted-foreground">Factor:</span>
                                        <span className="ml-2 font-bold">
                                            {params.impactFactor.toFixed(3)}
                                        </span>
                                    </div>
                                </div>
                            )}
                            
                            <div className="text-xs text-muted-foreground">
                                {params.vehicleId.includes('tracked') 
                                    ? 'Tracked: Impact = 25% for L≤5m, 10% for L≥9m (linear interpolation)'
                                    : 'Wheeled: Impact = 4.5/(6+L) for 3m ≤ L ≤ 45m'
                                }
                            </div>
                        </div>
                        
                        {/* Analysis settings */}
                        <div className="space-y-2">
                            <Label>Position Increment (m)</Label>
                            <div className="flex items-center gap-4">
                                <Slider
                                    value={[params.increment]}
                                    onValueChange={([v]: number[]) => setParams(prev => ({ ...prev, increment: v }))}
                                    min={0.1}
                                    max={2.0}
                                    step={0.1}
                                    className="flex-1"
                                />
                                <span className="w-16 text-right font-mono">{params.increment.toFixed(1)} m</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Smaller increment = more accurate but slower analysis
                            </p>
                        </div>
                    </TabsContent>
                    
                    {/* Animation Tab */}
                    <TabsContent value="animation" className="space-y-4 mt-4">
                        {/* Bridge visualization with moving vehicle */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                            <svg viewBox={`-5 0 ${params.spanLength + 10} 60`} className="w-full h-40">
                                {/* Ground */}
                                <line 
                                    x1="-3" y1="45" 
                                    x2={params.spanLength + 3} y2="45" 
                                    stroke="currentColor" 
                                    strokeWidth="0.3"
                                />
                                
                                {/* Supports */}
                                <g className="text-slate-400">
                                    <polygon points="-2,45 2,45 0,50" fill="currentColor" />
                                    <polygon 
                                        points={`${params.spanLength-2},45 ${params.spanLength+2},45 ${params.spanLength},50`} 
                                        fill="currentColor" 
                                    />
                                </g>
                                
                                {/* Span */}
                                <rect 
                                    x="0" y="40" 
                                    width={params.spanLength} height="4" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="0.5"
                                />
                                
                                {/* Vehicle at current position */}
                                <g transform={`translate(${params.currentPosition}, 0)`}>
                                    <rect 
                                        x="0" y="25" 
                                        width={params.vehicle.length} height="10" 
                                        fill="#f59e0b" 
                                        opacity="0.8"
                                        rx="1"
                                    />
                                    {params.vehicle.axles.map((axle, i) => (
                                        <g key={i}>
                                            <circle 
                                                cx={axle.position} 
                                                cy="38" 
                                                r="2" 
                                                fill="#374151"
                                            />
                                            <line 
                                                x1={axle.position} 
                                                y1="38" 
                                                x2={axle.position} 
                                                y2="42" 
                                                stroke="#ef4444" 
                                                strokeWidth="0.5"
                                            />
                                        </g>
                                    ))}
                                </g>
                                
                                {/* Dimension */}
                                <text 
                                    x={params.spanLength / 2} 
                                    y="55" 
                                    textAnchor="middle" 
                                    fontSize="3"
                                    fill="currentColor"
                                >
                                    L = {params.spanLength}m
                                </text>
                            </svg>
                        </div>
                        
                        {/* Animation controls */}
                        <div className="flex items-center justify-center gap-4">
                            <Button variant="outline" size="icon" onClick={stepBackward}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            
                            {params.isAnimating ? (
                                <Button onClick={stopAnimation} size="lg">
                                    <Pause className="h-5 w-5 mr-2" />
                                    Pause
                                </Button>
                            ) : (
                                <Button onClick={startAnimation} size="lg" className="bg-amber-600 hover:bg-amber-700">
                                    <Play className="h-5 w-5 mr-2" />
                                    Animate
                                </Button>
                            )}
                            
                            <Button variant="outline" size="icon" onClick={stepForward}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                        
                        {/* Position slider */}
                        <div className="space-y-2">
                            <Label>Vehicle Position: {params.currentPosition.toFixed(1)} m</Label>
                            <Slider
                                value={[params.currentPosition]}
                                onValueChange={([v]: number[]) => setParams(prev => ({ ...prev, currentPosition: v }))}
                                min={-params.vehicle.length}
                                max={params.spanLength + params.vehicle.length}
                                step={0.1}
                            />
                        </div>
                    </TabsContent>
                    
                    {/* Results/Envelope Tab */}
                    <TabsContent value="results" className="space-y-4 mt-4">
                        <div className="flex justify-between items-center">
                            <Label>Influence Line Envelope</Label>
                            <Button onClick={calculateEnvelope} className="bg-green-600 hover:bg-green-700">
                                <Calculator className="h-4 w-4 mr-2" />
                                Calculate Envelope
                            </Button>
                        </div>
                        
                        {maxValues && (
                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-3 bg-red-100 dark:bg-red-900 rounded-lg text-center">
                                    <div className="text-xs text-muted-foreground">Max Moment</div>
                                    <div className="text-lg font-bold text-red-700 dark:text-red-300">
                                        {maxValues.maxMoment.toFixed(1)} kN·m
                                    </div>
                                </div>
                                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg text-center">
                                    <div className="text-xs text-muted-foreground">Max Shear</div>
                                    <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                                        {maxValues.maxShear.toFixed(1)} kN
                                    </div>
                                </div>
                                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg text-center">
                                    <div className="text-xs text-muted-foreground">Max Reaction</div>
                                    <div className="text-lg font-bold text-green-700 dark:text-green-300">
                                        {maxValues.maxReaction.toFixed(1)} kN
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Envelope diagram */}
                        {envelopeResults.length > 0 && (
                            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                <svg viewBox={`0 0 ${params.spanLength} 100`} className="w-full h-48">
                                    {/* Zero line */}
                                    <line 
                                        x1="0" y1="50" 
                                        x2={params.spanLength} y2="50" 
                                        stroke="currentColor" 
                                        strokeWidth="0.2"
                                        strokeDasharray="1"
                                    />
                                    
                                    {/* Moment envelope */}
                                    {maxValues && (
                                        <>
                                            <polyline
                                                points={envelopeResults.map(r => 
                                                    `${r.position},${50 - (r.maxMoment / maxValues.maxMoment) * 40}`
                                                ).join(' ')}
                                                fill="none"
                                                stroke="#ef4444"
                                                strokeWidth="0.5"
                                            />
                                            <text x="1" y="10" fontSize="3" fill="#ef4444">Moment (+)</text>
                                        </>
                                    )}
                                    
                                    {/* Supports markers */}
                                    <circle cx="0" cy="50" r="1.5" fill="currentColor" />
                                    <circle cx={params.spanLength} cy="50" r="1.5" fill="currentColor" />
                                </svg>
                            </div>
                        )}
                        
                        {/* Results table */}
                        {envelopeResults.length > 0 && (
                            <div className="max-h-48 overflow-y-auto border rounded">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                                        <tr>
                                            <th className="p-2 text-left">x (m)</th>
                                            <th className="p-2 text-right">M+ (kN·m)</th>
                                            <th className="p-2 text-right">V+ (kN)</th>
                                            <th className="p-2 text-right">V- (kN)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {envelopeResults.filter((_, i) => i % 2 === 0).map((r, i) => (
                                            <tr key={i} className="border-t">
                                                <td className="p-2">{r.position.toFixed(1)}</td>
                                                <td className="p-2 text-right text-red-600">
                                                    {r.maxMoment.toFixed(1)}
                                                </td>
                                                <td className="p-2 text-right text-blue-600">
                                                    {r.maxShear.toFixed(1)}
                                                </td>
                                                <td className="p-2 text-right text-blue-600">
                                                    {r.minShear.toFixed(1)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        
                        {envelopeResults.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>Click "Calculate Envelope" to generate influence line envelope</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
                
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setModal('movingLoadDialog', false)}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleApplyLoads} 
                        disabled={envelopeResults.length === 0}
                        className="bg-amber-600 hover:bg-amber-700"
                    >
                        <Truck className="h-4 w-4 mr-2" />
                        Apply Moving Loads
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MovingLoadDialog;
