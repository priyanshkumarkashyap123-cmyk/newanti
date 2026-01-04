/**
 * BucklingAnalysisPanel.tsx - Linear Buckling Analysis
 * 
 * Displays stability analysis results:
 * - Critical load factors
 * - Buckling mode shapes
 * - Effective length factors
 * - Stability status
 */

import { FC, useState, useMemo } from 'react';
import {
    Shield,
    AlertTriangle,
    CheckCircle,
    XCircle,
    RefreshCw,
    Download,
    Eye,
    Crown,
    TrendingDown,
} from 'lucide-react';
import { useModelStore } from '../store/model';
import { useAdvancedAnalysis } from '../hooks/useAdvancedAnalysis';
import { useAuth } from '../providers/AuthProvider';

// ============================================
// TYPES
// ============================================

interface BucklingMode {
    modeNumber: number;
    factor: number;
    isStable: boolean;
    criticalLoad?: number;
}

interface BucklingAnalysisPanelProps {
    isPro?: boolean;
}

// ============================================
// EFFECTIVE LENGTH FACTORS
// ============================================

const EFFECTIVE_LENGTH_FACTORS = [
    { case: 'Both ends fixed', K: 0.5, diagram: '▬▬▬' },
    { case: 'Fixed-Pinned', K: 0.7, diagram: '▬▬○' },
    { case: 'Both ends pinned', K: 1.0, diagram: '○▬▬○' },
    { case: 'Fixed-Free (cantilever)', K: 2.0, diagram: '▬▬▶' },
    { case: 'Fixed-Guided', K: 1.0, diagram: '▬▬═' },
    { case: 'Pinned-Guided', K: 2.0, diagram: '○▬═' },
];

// ============================================
// UTILITY COMPONENTS
// ============================================

const StabilityIndicator: FC<{ factor: number }> = ({ factor }) => {
    const isStable = factor > 1.0;
    const isWarning = factor > 1.0 && factor < 1.5;

    return (
        <div className={`
            flex items-center gap-2 px-3 py-2 rounded-lg
            ${isStable
                ? isWarning
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            }
        `}>
            {isStable ? (
                isWarning ? (
                    <AlertTriangle className="w-5 h-5" />
                ) : (
                    <CheckCircle className="w-5 h-5" />
                )
            ) : (
                <XCircle className="w-5 h-5" />
            )}
            <div>
                <div className="font-semibold text-sm">
                    {isStable
                        ? isWarning ? 'Marginally Stable' : 'Stable'
                        : 'Unstable'
                    }
                </div>
                <div className="text-xs opacity-75">
                    Factor of Safety: {factor.toFixed(2)}
                </div>
            </div>
        </div>
    );
};

const ModeCard: FC<{
    mode: BucklingMode;
    selected: boolean;
    onSelect: () => void;
    onVisualize: () => void;
}> = ({ mode, selected, onSelect, onVisualize }) => {
    const getStatusColor = (factor: number) => {
        if (factor > 1.5) return 'text-green-500 bg-green-100 dark:bg-green-900/30';
        if (factor > 1.0) return 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30';
        return 'text-red-500 bg-red-100 dark:bg-red-900/30';
    };

    return (
        <div
            onClick={onSelect}
            className={`
                p-3 rounded-lg border cursor-pointer transition-all
                ${selected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}
            `}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">Mode {mode.modeNumber}</span>
                <button
                    onClick={(e) => { e.stopPropagation(); onVisualize(); }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    title="Visualize mode shape"
                >
                    <Eye className="w-4 h-4 text-gray-500 hover:text-blue-500" />
                </button>
            </div>

            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusColor(mode.factor)}`}>
                λ = {mode.factor.toFixed(3)}
            </div>

            {selected && mode.criticalLoad && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 text-xs">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Critical Load:</span>
                        <span className="font-medium">{mode.criticalLoad.toFixed(1)} kN</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Status:</span>
                        <span className={mode.factor > 1 ? 'text-green-500' : 'text-red-500'}>
                            {mode.factor > 1 ? 'Safe' : 'Buckles'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// EULER BUCKLING CALCULATOR
// ============================================

const EulerCalculator: FC = () => {
    const [length, setLength] = useState(3000); // mm
    const [E, setE] = useState(200000); // MPa
    const [I, setI] = useState(10000000); // mm⁴
    const [K, setK] = useState(1.0);

    const Pcr = useMemo(() => {
        const Le = K * length;
        return (Math.PI * Math.PI * E * I) / (Le * Le) / 1000; // kN
    }, [length, E, I, K]);

    return (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-xs font-medium text-gray-500 mb-2">Euler Buckling Calculator</div>

            <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                    <label className="text-xs text-gray-400">Length (mm)</label>
                    <input
                        type="number"
                        value={length}
                        onChange={(e) => setLength(parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-400">K factor</label>
                    <select
                        value={K}
                        onChange={(e) => setK(parseFloat(e.target.value))}
                        className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                    >
                        {EFFECTIVE_LENGTH_FACTORS.map((f) => (
                            <option key={f.K} value={f.K}>
                                {f.K} - {f.case}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-gray-400">E (MPa)</label>
                    <input
                        type="number"
                        value={E}
                        onChange={(e) => setE(parseFloat(e.target.value) || 200000)}
                        className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                    />
                </div>
                <div>
                    <label className="text-xs text-gray-400">I (mm⁴)</label>
                    <input
                        type="number"
                        value={I}
                        onChange={(e) => setI(parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                    />
                </div>
            </div>

            <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500">Critical Load (Pcr):</span>
                <span className="font-bold text-lg text-blue-500">{Pcr.toFixed(1)} kN</span>
            </div>

            <div className="mt-2 text-xs text-gray-400 text-center">
                P_cr = π²EI / (KL)²
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const BucklingAnalysisPanel: FC<BucklingAnalysisPanelProps> = ({ isPro = false }) => {
    const nodes = useModelStore((s) => s.nodes);
    const members = useModelStore((s) => s.members);
    const analysisResults = useModelStore((s) => s.analysisResults);
    // Derive supports from nodes with restraints
    const supportsArray = useMemo(() => {
        return Array.from(nodes.values())
            .filter(n => n.restraints && (n.restraints.fx || n.restraints.fy || n.restraints.fz))
            .map(n => ({
                nodeId: n.id,
                type: n.restraints?.fx && n.restraints?.fy && n.restraints?.fz &&
                    n.restraints?.mx && n.restraints?.my && n.restraints?.mz ? 'fixed' :
                    n.restraints?.fx && n.restraints?.fy && n.restraints?.fz ? 'pinned' : 'roller'
            }));
    }, [nodes]);

    const [selectedMode, setSelectedMode] = useState<number>(1);
    const [showCalculator, setShowCalculator] = useState(false);
    const [numModes, setNumModes] = useState(5);

    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Get model data
    const loads = useModelStore((state) => state.loads);
    const memberLoads = useModelStore((state) => state.memberLoads);
    const { getToken } = useAuth();

    // Convert buckling result to display format
    const modes = useMemo<BucklingMode[]>(() => {
        if (!result) return [];

        return result.modes.map((m: any) => ({
            modeNumber: m.mode,
            factor: m.factor,
            isStable: m.factor > 1.0,
            criticalLoad: m.factor * 100, // Assuming 100 kN reference load
        }));
    }, [result]);

    // Run buckling analysis
    const handleRunAnalysis = async () => {
        setIsRunning(true);
        setError(null);
        setResult(null);

        try {
            const token = await getToken();
            const PYTHON_API = import.meta.env['VITE_PYTHON_API_URL'] || 'https://api.beamlabultimate.tech';

            // Prepare payload
            const payload = {
                nodes: Array.from(nodes.values()).map(n => ({
                    id: n.id,
                    x: n.x, y: n.y, z: n.z,
                    support: n.restraints ? (
                        n.restraints.fx && n.restraints.fy && n.restraints.fz && n.restraints.mx && n.restraints.my && n.restraints.mz ? 'fixed' :
                            n.restraints.fx && n.restraints.fy && n.restraints.fz ? 'pinned' :
                                n.restraints.fy ? 'roller' : 'none'
                    ) : 'none'
                })),
                members: Array.from(members.values()).map(m => ({
                    id: m.id,
                    startNodeId: m.startNodeId,
                    endNodeId: m.endNodeId,
                    E: m.E, G: (m.E || 200e6) / 2.6,
                    A: m.A, Iy: m.I, Iz: m.I, J: (m.I || 1e-4) * 2
                })),
                node_loads: loads.map(l => ({
                    nodeId: l.nodeId,
                    fx: l.fx, fy: l.fy, fz: l.fz,
                    mx: l.mx, my: l.my, mz: l.mz
                })),
                distributed_loads: memberLoads.map(l => ({
                    memberId: l.memberId,
                    direction: l.direction === 'local_y' ? 'Fy' : 'Fz',
                    w1: l.w1, w2: l.w2 ?? l.w1
                })),
                num_modes: numModes,
                load_case: 'LC1'
            };

            const res = await fetch(`${PYTHON_API}/analyze/buckling`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errJson = await res.json();
                throw new Error(errJson.detail || 'Analysis failed');
            }

            const data = await res.json();
            setResult(data);

        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsRunning(false);
        }
    };

    // Visualize mode shape
    const handleVisualize = (modeNum: number) => {
        // This would trigger 3D visualization
        console.log('Visualize buckling mode:', modeNum);
    };

    // ============================================
    // RENDER
    // ============================================

    if (!isPro) {
        return (
            <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-5 h-5 text-red-500" />
                    <h3 className="font-semibold text-red-700 dark:text-red-400">
                        Buckling Analysis - Pro Feature
                    </h3>
                </div>
                <p className="text-sm text-red-600 dark:text-red-300">
                    Upgrade to Pro to access linear buckling analysis, critical load factors,
                    buckling mode shapes, and stability checks.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Buckling Analysis
                    </h3>
                    <button
                        onClick={() => setShowCalculator(!showCalculator)}
                        className="text-xs text-blue-500 hover:text-blue-600"
                    >
                        {showCalculator ? 'Hide' : 'Show'} Calculator
                    </button>
                </div>

                {/* Settings */}
                <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-2">
                        <span className="text-gray-500">Modes:</span>
                        <input
                            type="number"
                            min={1}
                            max={20}
                            value={numModes}
                            onChange={(e) => setNumModes(parseInt(e.target.value) || 5)}
                            className="w-16 px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-600"
                        />
                    </label>
                    <button
                        onClick={handleRunAnalysis}
                        disabled={isLoading || !analysisResults}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded transition-colors"
                        title={!analysisResults ? 'Run linear analysis first' : 'Run buckling analysis'}
                    >
                        <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                        {isLoading ? 'Running...' : 'Run'}
                    </button>
                </div>
            </div>

            {/* Calculator */}
            {showCalculator && (
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                    <EulerCalculator />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto p-3">
                {modes.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                        <TrendingDown className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Run buckling analysis to see critical load factors.</p>
                        {!analysisResults && (
                            <p className="text-xs text-yellow-500 mt-2">
                                ⚠️ Run linear analysis first
                            </p>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Overall Stability */}
                        <div className="mb-4">
                            <StabilityIndicator factor={modes[0]?.factor || 0} />
                        </div>

                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
                            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                <div className="text-lg font-bold">{modes[0]?.factor.toFixed(3) || '—'}</div>
                                <div className="text-gray-500">1st Factor (λ₁)</div>
                            </div>
                            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                <div className="text-lg font-bold">{modes[0]?.criticalLoad?.toFixed(0) || '—'}</div>
                                <div className="text-gray-500">Pcr (kN)</div>
                            </div>
                            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                <div className="text-lg font-bold">{modes.length}</div>
                                <div className="text-gray-500">Modes</div>
                            </div>
                        </div>

                        {/* Mode Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {modes.map((mode) => (
                                <ModeCard
                                    key={mode.modeNumber}
                                    mode={mode}
                                    selected={selectedMode === mode.modeNumber}
                                    onSelect={() => setSelectedMode(mode.modeNumber)}
                                    onVisualize={() => handleVisualize(mode.modeNumber)}
                                />
                            ))}
                        </div>

                        {/* Effective Length Reference */}
                        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="text-xs font-medium text-gray-500 mb-2">
                                Effective Length Factors (K)
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                                {EFFECTIVE_LENGTH_FACTORS.map((f) => (
                                    <div key={f.K} className="flex justify-between">
                                        <span className="text-gray-400">{f.case}</span>
                                        <span className="font-medium">{f.K}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Footer */}
            {modes.length > 0 && (
                <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                    <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
                        <Download className="w-4 h-4" />
                        Export Results
                    </button>
                    <div className="text-xs text-gray-400">
                        {result?.is_stable ? '✓ Structure is stable' : '✗ Buckling detected'}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BucklingAnalysisPanel;
