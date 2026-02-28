/**
 * BeamCalculator - Lightweight 2D Beam Solver
 * 
 * Simple beam analysis tool for simply supported and cantilever beams.
 * No authentication required - public SEO page.
 */

import React from 'react';
import { FC, useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Zap, Triangle, ArrowDown, Plus, Trash2, Play, RotateCcw,
    ChevronDown, ArrowRight, Box, Settings, Download, Share2,
    Loader2, AlertTriangle
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

type SupportType = 'pinned' | 'roller' | 'fixed';

interface Support {
    id: string;
    position: number;  // Distance from left (0 to beamLength)
    type: SupportType;
}

interface PointLoad {
    id: string;
    position: number;
    magnitude: number;  // kN (positive = downward)
}

interface DistributedLoad {
    id: string;
    startPosition: number;
    endPosition: number;
    magnitude: number;  // kN/m
}

interface BeamModel {
    length: number;      // meters
    E: number;           // GPa (Young's modulus)
    I: number;           // cm⁴ (Moment of inertia)
    supports: Support[];
    pointLoads: PointLoad[];
    distributedLoads: DistributedLoad[];
}

interface AnalysisResults {
    reactions: { position: number; Fy: number; M?: number }[];
    shearForce: { x: number; V: number }[];
    bendingMoment: { x: number; M: number }[];
    deflection: { x: number; delta: number }[];
    maxShear: number;
    maxMoment: number;
    maxDeflection: number;
}

// ============================================
// DEFAULT VALUES
// ============================================

const DEFAULT_BEAM: BeamModel = {
    length: 6,
    E: 200,  // GPa (Steel)
    I: 10000, // cm⁴
    supports: [
        { id: 's1', position: 0, type: 'pinned' },
        { id: 's2', position: 6, type: 'roller' }
    ],
    pointLoads: [
        { id: 'p1', position: 3, magnitude: 10 }
    ],
    distributedLoads: []
};

// ============================================
// BEAM SOLVER
// ============================================

function solveBeam(model: BeamModel): AnalysisResults {
    const { length, supports, pointLoads, distributedLoads, E, I } = model;
    const numPoints = 100;
    const dx = length / numPoints;

    // Calculate total load and moment about first support
    let totalLoad = 0;
    let momentAboutA = 0;

    for (const load of pointLoads) {
        totalLoad += load.magnitude;
        momentAboutA += load.magnitude * load.position;
    }

    for (const load of distributedLoads) {
        const w = load.magnitude;
        const L = load.endPosition - load.startPosition;
        const force = w * L;
        const centroid = load.startPosition + L / 2;
        totalLoad += force;
        momentAboutA += force * centroid;
    }

    // Calculate reactions (simply supported beam)
    const reactions: AnalysisResults['reactions'] = [];

    if (supports.length >= 2) {
        const a = supports[0].position;
        const b = supports[1].position;
        const span = b - a;

        if (span > 0) {
            const Rb = momentAboutA / span;
            const Ra = totalLoad - Rb;

            reactions.push({ position: a, Fy: Ra });
            reactions.push({ position: b, Fy: Rb });
        }
    } else if (supports.length === 1 && supports[0].type === 'fixed') {
        // Cantilever
        reactions.push({
            position: supports[0].position,
            Fy: totalLoad,
            M: momentAboutA
        });
    }

    // Calculate SFD
    const shearForce: AnalysisResults['shearForce'] = [];
    for (let i = 0; i <= numPoints; i++) {
        const x = i * dx;
        let V = 0;

        // Reactions (upward = positive)
        for (const r of reactions) {
            if (x >= r.position) {
                V += r.Fy;
            }
        }

        // Point loads (downward = negative)
        for (const load of pointLoads) {
            if (x >= load.position) {
                V -= load.magnitude;
            }
        }

        // Distributed loads
        for (const load of distributedLoads) {
            if (x > load.startPosition) {
                const end = Math.min(x, load.endPosition);
                const loadedLength = end - load.startPosition;
                V -= load.magnitude * loadedLength;
            }
        }

        shearForce.push({ x, V });
    }

    // Calculate BMD (integrate shear)
    const bendingMoment: AnalysisResults['bendingMoment'] = [];
    let M = 0;

    // Add fixed end moment if cantilever
    const fixedSupport = supports.find(s => s.type === 'fixed');
    if (fixedSupport) {
        M = reactions.find(r => r.position === fixedSupport.position)?.M || 0;
    }

    for (let i = 0; i <= numPoints; i++) {
        const x = i * dx;

        // Integrate from left
        M = 0;
        for (const r of reactions) {
            if (x >= r.position) {
                M += r.Fy * (x - r.position);
                if (r.M) M -= r.M;
            }
        }

        for (const load of pointLoads) {
            if (x >= load.position) {
                M -= load.magnitude * (x - load.position);
            }
        }

        for (const load of distributedLoads) {
            if (x > load.startPosition) {
                const end = Math.min(x, load.endPosition);
                const L = end - load.startPosition;
                M -= load.magnitude * L * (x - load.startPosition - L / 2);
            }
        }

        bendingMoment.push({ x, M });
    }

    // Calculate deflection (double integrate moment / EI)
    const deflection: AnalysisResults['deflection'] = [];
    const EI = E * 1e9 * I * 1e-8;  // Convert to N·m²

    for (let i = 0; i <= numPoints; i++) {
        const x = i * dx;
        // Simplified deflection for simply supported beam with central load
        // δ = Px(L² - x²) / (6EIL) for x < L/2
        // This is approximate - full integration would be more accurate

        let delta = 0;
        if (pointLoads.length > 0 && supports.length === 2) {
            const P = pointLoads[0].magnitude * 1000; // kN to N
            const a = pointLoads[0].position;
            const L = supports[1].position - supports[0].position;
            const b = L - a;

            if (x <= a) {
                delta = (P * b * x * (L * L - b * b - x * x)) / (6 * EI * L);
            } else {
                delta = (P * a * (L - x) * (L * L - a * a - (L - x) * (L - x))) / (6 * EI * L);
            }
        }

        deflection.push({ x, delta: delta * 1000 }); // Convert to mm
    }

    // Find max values
    const maxShear = Math.max(...shearForce.map(p => Math.abs(p.V)));
    const maxMoment = Math.max(...bendingMoment.map(p => Math.abs(p.M)));
    const maxDeflection = Math.max(...deflection.map(p => Math.abs(p.delta)));

    return {
        reactions,
        shearForce,
        bendingMoment,
        deflection,
        maxShear,
        maxMoment,
        maxDeflection
    };
}

// ============================================
// CHART COMPONENT
// ============================================

interface ChartProps {
    data: { x: number; y: number }[];
    title: string;
    yLabel: string;
    color: string;
    fillColor: string;
    beamLength: number;
}

const DiagramChart: FC<ChartProps> = ({ data, title, yLabel, color, fillColor, beamLength }) => {
    const width = 500;
    const height = 150;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };

    const maxY = Math.max(...data.map(d => Math.abs(d.y)), 0.1);

    const scaleX = (x: number) => padding.left + (x / beamLength) * (width - padding.left - padding.right);
    const scaleY = (y: number) => height / 2 - (y / maxY) * (height / 2 - padding.top);

    const pathD = data.map((d, i) =>
        `${i === 0 ? 'M' : 'L'} ${scaleX(d.x)} ${scaleY(d.y)}`
    ).join(' ');

    const areaD = `${pathD} L ${scaleX(beamLength)} ${height / 2} L ${scaleX(0)} ${height / 2} Z`;

    return (
        <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-4">
            <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">{title}</h4>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
                {/* Grid */}
                <line x1={padding.left} y1={height / 2} x2={width - padding.right} y2={height / 2}
                    stroke="#475569" strokeWidth="1" strokeDasharray="4" />

                {/* Fill area */}
                <path d={areaD} fill={fillColor} />

                {/* Line */}
                <path d={pathD} fill="none" stroke={color} strokeWidth="2" />

                {/* Y Label */}
                <text x="10" y={height / 2} fill="#94A3B8" fontSize="10" textAnchor="middle"
                    transform={`rotate(-90, 10, ${height / 2})`}>{yLabel}</text>

                {/* X axis labels */}
                <text x={padding.left} y={height - 5} fill="#94A3B8" fontSize="10">0</text>
                <text x={width - padding.right} y={height - 5} fill="#94A3B8" fontSize="10" textAnchor="end">
                    {beamLength}m
                </text>

                {/* Max value */}
                <text x={width - padding.right - 5} y={padding.top + 10} fill={color} fontSize="11" textAnchor="end" fontWeight="bold">
                    Max: {maxY.toFixed(2)}
                </text>
            </svg>
        </div>
    );
};

// ============================================
// BEAM VISUAL EDITOR
// ============================================

interface BeamEditorProps {
    model: BeamModel;
    onModelChange: (model: BeamModel) => void;
}

const BeamEditor: FC<BeamEditorProps> = ({ model, onModelChange }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [tool, setTool] = useState<'select' | 'support' | 'pointLoad'>('select');

    const width = 600;
    const height = 120;
    const beamY = 60;
    const padding = 50;

    const scaleX = (pos: number) => padding + (pos / model.length) * (width - 2 * padding);
    const unscaleX = (x: number) => ((x - padding) / (width - 2 * padding)) * model.length;

    const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pos = Math.max(0, Math.min(model.length, unscaleX(x)));

        if (tool === 'support') {
            const newSupport: Support = {
                id: `s${Date.now()}`,
                position: Math.round(pos * 10) / 10,
                type: 'pinned'
            };
            onModelChange({ ...model, supports: [...model.supports, newSupport] });
        } else if (tool === 'pointLoad') {
            const newLoad: PointLoad = {
                id: `p${Date.now()}`,
                position: Math.round(pos * 10) / 10,
                magnitude: 10
            };
            onModelChange({ ...model, pointLoads: [...model.pointLoads, newLoad] });
        }
    };

    return (
        <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-4">
            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-4">
                <span className="text-slate-500 dark:text-slate-400 text-sm">Add:</span>
                <button
                    onClick={() => setTool('support')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${tool === 'support' ? 'bg-green-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-600'
                        }`}
                >
                    <Triangle className="w-4 h-4" />
                    Support
                </button>
                <button
                    onClick={() => setTool('pointLoad')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${tool === 'pointLoad' ? 'bg-red-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-600'
                        }`}
                >
                    <ArrowDown className="w-4 h-4" />
                    Point Load
                </button>
            </div>

            {/* Beam Drawing */}
            <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                className="w-full cursor-crosshair bg-slate-50/50 dark:bg-slate-900/50 rounded-lg"
                onClick={handleClick}
            >
                {/* Beam line */}
                <line
                    x1={scaleX(0)} y1={beamY}
                    x2={scaleX(model.length)} y2={beamY}
                    stroke="#60A5FA" strokeWidth="8" strokeLinecap="round"
                />

                {/* Supports */}
                {model.supports.map((support) => (
                    <g key={support.id} transform={`translate(${scaleX(support.position)}, ${beamY})`}>
                        {support.type === 'pinned' && (
                            <polygon points="0,0 -12,25 12,25" fill="#22C55E" />
                        )}
                        {support.type === 'roller' && (
                            <>
                                <polygon points="0,0 -12,20 12,20" fill="#22C55E" />
                                <circle cx="0" cy="25" r="5" fill="#22C55E" />
                            </>
                        )}
                        {support.type === 'fixed' && (
                            <rect x="-5" y="-20" width="10" height="45" fill="#22C55E" />
                        )}
                        <text x="0" y="45" textAnchor="middle" fill="#94A3B8" fontSize="10">
                            {support.position}m
                        </text>
                    </g>
                ))}

                {/* Point Loads */}
                {model.pointLoads.map((load) => (
                    <g key={load.id} transform={`translate(${scaleX(load.position)}, ${beamY - 40})`}>
                        <line x1="0" y1="0" x2="0" y2="35" stroke="#EF4444" strokeWidth="3" />
                        <polygon points="0,35 -8,20 8,20" fill="#EF4444" />
                        <text x="0" y="-5" textAnchor="middle" fill="#EF4444" fontSize="11" fontWeight="bold">
                            {load.magnitude} kN
                        </text>
                    </g>
                ))}

                {/* Dimension line */}
                <line x1={scaleX(0)} y1={height - 15} x2={scaleX(model.length)} y2={height - 15}
                    stroke="#64748B" strokeWidth="1" markerEnd="url(#arrow)" markerStart="url(#arrow-start)" />
                <text x={width / 2} y={height - 3} textAnchor="middle" fill="#94A3B8" fontSize="11">
                    L = {model.length} m
                </text>
            </svg>
        </div>
    );
};

// ============================================
// MAIN PAGE
// ============================================

export const BeamCalculator: FC = () => {
    const [model, setModel] = useState<BeamModel>(DEFAULT_BEAM);
    const [results, setResults] = useState<AnalysisResults | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Use ref to track if we're already analyzing to prevent loops
    const isAnalyzingRef = useRef(false);

    const runAnalysis = useCallback(() => {
        if (isAnalyzingRef.current) return; // Prevent re-entry
        isAnalyzingRef.current = true;
        setIsAnalyzing(true);
        setError(null);
        setTimeout(() => {
            try {
                const res = solveBeam(model);
                setResults(res);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Analysis failed. Please check your inputs.');
                setResults(null);
            } finally {
                setIsAnalyzing(false);
                isAnalyzingRef.current = false;
            }
        }, 300);
    }, [model]);

    const resetModel = () => {
        setModel(DEFAULT_BEAM);
        setResults(null);
    };

    // Auto-analyze on model change
    useEffect(() => {
        if (model.supports.length >= 1 && model.pointLoads.length >= 1) {
            queueMicrotask(() => {
                runAnalysis();
            });
        }
    }, [model, runAnalysis]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 dark:from-slate-900 to-white dark:to-slate-950">
            {/* Header */}
            <header className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-white font-bold">BeamLab</span>
                        </Link>
                        <span className="text-slate-500">/</span>
                        <Link to="/tools" className="text-slate-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white text-sm">Tools</Link>
                        <span className="text-slate-500">/</span>
                        <span className="text-zinc-900 dark:text-white text-sm font-medium">Beam Calculator</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="text-slate-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white p-2">
                            <Share2 className="w-5 h-5" />
                        </button>
                        <button className="text-slate-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white p-2">
                            <Download className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-8">
                {/* Title */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Simple Beam Calculator</h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Calculate reactions, shear force, bending moment, and deflection for simply supported beams.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Input */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Beam Properties */}
                        <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-4">
                            <h3 className="text-zinc-900 dark:text-white font-medium mb-4 flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                Beam Properties
                            </h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-slate-500 dark:text-slate-400 text-xs block mb-1">Length (m)</label>
                                    <input
                                        type="number"
                                        value={model.length}
                                        onChange={(e) => setModel({ ...model, length: parseFloat(e.target.value) || 1 })}
                                        className="w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 text-zinc-900 dark:text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-slate-500 dark:text-slate-400 text-xs block mb-1">E (GPa)</label>
                                    <input
                                        type="number"
                                        value={model.E}
                                        onChange={(e) => setModel({ ...model, E: parseFloat(e.target.value) || 200 })}
                                        className="w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 text-zinc-900 dark:text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-slate-500 dark:text-slate-400 text-xs block mb-1">I (cm⁴)</label>
                                    <input
                                        type="number"
                                        value={model.I}
                                        onChange={(e) => setModel({ ...model, I: parseFloat(e.target.value) || 1000 })}
                                        className="w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 text-zinc-900 dark:text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Visual Editor */}
                        <BeamEditor model={model} onModelChange={setModel} />

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={runAnalysis}
                                disabled={isAnalyzing}
                                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Calculating...
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4" />
                                        Calculate
                                    </>
                                )}
                            </button>
                            <button
                                onClick={resetModel}
                                className="flex items-center gap-2 px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Reset
                            </button>
                        </div>
                    </div>

                    {/* Right: Quick Results */}
                    <div className="space-y-4">
                        <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-4">
                            <h3 className="text-zinc-900 dark:text-white font-medium mb-4">Quick Results</h3>

                            {results ? (
                                <div className="space-y-3">
                                    {/* Reactions */}
                                    <div className="bg-slate-200/50 dark:bg-slate-700/50 rounded-lg p-3">
                                        <div className="text-slate-500 dark:text-slate-400 text-xs mb-1">Reactions</div>
                                        {results.reactions.map((r, i) => (
                                            <div key={i} className="text-zinc-900 dark:text-white text-sm">
                                                R{i + 1} = <span className="text-green-400 font-mono">{r.Fy.toFixed(2)} kN</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Max Values */}
                                    <div className="bg-slate-200/50 dark:bg-slate-700/50 rounded-lg p-3">
                                        <div className="text-slate-500 dark:text-slate-400 text-xs mb-1">Max Shear</div>
                                        <div className="text-xl font-bold text-red-400">
                                            {results.maxShear.toFixed(2)} kN
                                        </div>
                                    </div>
                                    <div className="bg-slate-200/50 dark:bg-slate-700/50 rounded-lg p-3">
                                        <div className="text-slate-500 dark:text-slate-400 text-xs mb-1">Max Moment</div>
                                        <div className="text-xl font-bold text-purple-400">
                                            {results.maxMoment.toFixed(2)} kN·m
                                        </div>
                                    </div>
                                    <div className="bg-slate-200/50 dark:bg-slate-700/50 rounded-lg p-3">
                                        <div className="text-slate-500 dark:text-slate-400 text-xs mb-1">Max Deflection</div>
                                        <div className="text-xl font-bold text-blue-400">
                                            {results.maxDeflection.toFixed(2)} mm
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-slate-500 dark:text-slate-400 text-center py-8">
                                    Click Calculate to see results
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                {/* Result Charts */}
                {results && (
                    <div className="mt-8 space-y-4">
                        <h3 className="text-zinc-900 dark:text-white font-medium">Diagrams</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <DiagramChart
                                data={results.shearForce.map(p => ({ x: p.x, y: p.V }))}
                                title="Shear Force Diagram (SFD)"
                                yLabel="V (kN)"
                                color="#EF4444"
                                fillColor="rgba(239, 68, 68, 0.2)"
                                beamLength={model.length}
                            />
                            <DiagramChart
                                data={results.bendingMoment.map(p => ({ x: p.x, y: p.M }))}
                                title="Bending Moment Diagram (BMD)"
                                yLabel="M (kN·m)"
                                color="#A855F7"
                                fillColor="rgba(168, 85, 247, 0.2)"
                                beamLength={model.length}
                            />
                            <DiagramChart
                                data={results.deflection.map(p => ({ x: p.x, y: -p.delta }))}
                                title="Deflection Diagram"
                                yLabel="δ (mm)"
                                color="#3B82F6"
                                fillColor="rgba(59, 130, 246, 0.2)"
                                beamLength={model.length}
                            />
                        </div>
                    </div>
                )}

                {/* Hook to 3D Workspace */}
                {results && (
                    <div className="mt-12 bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-800/50 rounded-2xl p-8 text-center">
                        <Box className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                            Need to analyze a frame?
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-lg mx-auto">
                            Open your beam in our full 3D Workspace with advanced FEA,
                            steel design checks, and multi-story frame analysis.
                        </p>
                        <Link
                            to="/demo"
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
                        >
                            Open in 3D Workspace
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
};

export default BeamCalculator;
