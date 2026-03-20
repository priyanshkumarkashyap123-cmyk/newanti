/**
 * PDeltaAnalysisPanel.tsx - P-Delta (Geometric Nonlinear) Analysis
 * 
 * Second-order geometric nonlinear analysis per:
 *   - IS 800:2007 Cl.4.4.2 — Second-order effects (P-Δ and P-δ)
 *   - AISC 360-22 Appendix 8 — Approximate Second-Order Analysis
 *   - Amplification factor B₂ = 1 / (1 − ΣP_story / P_e_story)
 *   
 * Displays:
 *   - Convergence history (log-scale residual)
 *   - Amplification factors per IS 800 / AISC
 *   - 1st vs 2nd order displacement & moment comparison
 */

import { FC, useState, useMemo } from 'react';
import {
    Maximize2,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    RefreshCw,
    Download,
    BarChart3,
    Crown,
    Layers,
} from 'lucide-react';
import { useModelStore } from '../store/model';
import { useAdvancedAnalysis } from '../hooks/useAdvancedAnalysis';
import { getSectionById, STEEL_SECTIONS } from '../data/SectionDatabase';

// ============================================
// TYPES
// ============================================

interface PDeltaAnalysisPanelProps {
    isPro?: boolean;
}

// ============================================
// CONVERGENCE CHART COMPONENT
// ============================================

const ConvergenceChart: FC<{ history: number[] }> = ({ history }) => {
    if (history.length === 0) return null;

    const maxResidual = Math.max(...history);
    const minResidual = Math.min(...history.filter(r => r > 0));

    return (
        <div className="h-24 bg-[#131b2e] rounded-lg p-2 relative">
            <div className="absolute top-1 left-2 text-xs text-[#869ab8]">Convergence</div>
            <svg width="100%" height="100%" viewBox="0 0 100 60" preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="0" y1="30" x2="100" y2="30" stroke="#ddd" strokeDasharray="2" />

                {/* Convergence curve */}
                <polyline
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    points={history.map((r, i) => {
                        const x = (i / (history.length - 1)) * 100;
                        // Log scale for better visualization
                        const logR = Math.log10(r + 1e-10);
                        const logMax = Math.log10(maxResidual + 1e-10);
                        const logMin = Math.log10(minResidual);
                        const y = 55 - ((logR - logMin) / (logMax - logMin)) * 50;
                        return `${x},${Math.max(5, Math.min(55, y))}`;
                    }).join(' ')}
                />

                {/* Final point */}
                {history.length > 0 && (
                    <circle
                        cx="100"
                        cy={55 - ((Math.log10(history[history.length - 1] + 1e-10) - Math.log10(minResidual)) /
                            (Math.log10(maxResidual + 1e-10) - Math.log10(minResidual))) * 50}
                        r="3"
                        fill={history[history.length - 1]! < 1e-4 ? '#22c55e' : '#ef4444'}
                    />
                )}
            </svg>
            <div className="absolute bottom-1 left-2 text-xs text-[#869ab8]">
                {history.length} iterations
            </div>
            <div className="absolute bottom-1 right-2 text-xs text-[#869ab8]">
                Final: {history[history.length - 1]?.toExponential(2) || '—'}
            </div>
        </div>
    );
};

// ============================================
// COMPARISON BAR COMPONENT
// ============================================

const ComparisonBar: FC<{
    label: string;
    firstOrder: number;
    secondOrder: number;
    unit: string;
}> = ({ label, firstOrder, secondOrder, unit }) => {
    const amplification = secondOrder > 0 && firstOrder > 0
        ? ((secondOrder / firstOrder) * 100 - 100).toFixed(1)
        : '—';
    const maxValue = Math.max(firstOrder, secondOrder);

    return (
        <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{label}</span>
                <span className={parseFloat(amplification) > 10 ? 'text-yellow-500' : 'text-[#869ab8]'}>
                    +{amplification}%
                </span>
            </div>
            <div className="flex gap-1">
                <div className="flex-1">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
                        <div
                            className="h-full bg-blue-400"
                            style={{ width: `${(firstOrder / maxValue) * 100}%` }}
                        />
                    </div>
                    <div className="text-xs text-[#869ab8] mt-0.5">
                        1st: {firstOrder.toFixed(2)} {unit}
                    </div>
                </div>
                <div className="flex-1">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
                        <div
                            className="h-full bg-orange-400"
                            style={{ width: `${(secondOrder / maxValue) * 100}%` }}
                        />
                    </div>
                    <div className="text-xs text-[#869ab8] mt-0.5">
                        2nd: {secondOrder.toFixed(2)} {unit}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const PDeltaAnalysisPanel: FC<PDeltaAnalysisPanelProps> = ({ isPro = false }) => {
    const nodes = useModelStore((s) => s.nodes);
    const members = useModelStore((s) => s.members);
    const analysisResults = useModelStore((s) => s.analysisResults);

    const [maxIterations, setMaxIterations] = useState(20);
    const [tolerance, setTolerance] = useState(1e-4);
    const [showComparison, setShowComparison] = useState(true);

    const {
        isLoading,
        error,
        pdeltaResult,
        runPDelta,
        convertModelForAdvancedAnalysis,
    } = useAdvancedAnalysis();

    // Run P-Delta analysis using model's actual loads
    const handleRunAnalysis = async () => {
        const nodesArray = Array.from(nodes.values());
        const membersArray = Array.from(members.values()).map((m, idx) => {
            const section = getSectionById(m.sectionId || 'Default') || STEEL_SECTIONS[0];
            return {
                id: `member-${idx}`,
                startNodeId: m.startNodeId,
                endNodeId: m.endNodeId,
                section: section,
            };
        });

        // Derive support types from full restraint data
        const supportsArray = Array.from(nodes.values())
            .filter(n => n.restraints && (n.restraints.fx || n.restraints.fy || n.restraints.fz))
            .map(n => {
                const r = n.restraints!;
                const allFixed = r.fx && r.fy && r.fz && r.mx && r.my && r.mz;
                const allTranslation = r.fx && r.fy && r.fz;
                return {
                    nodeId: n.id,
                    type: allFixed ? 'FIXED' : allTranslation ? 'PINNED' : 'ROLLER'
                };
            });

        const model = convertModelForAdvancedAnalysis(
            nodesArray.map((n) => ({ id: n.id, x: n.x, y: n.y, z: n.z })),
            membersArray,
            supportsArray
        );

        // Use actual nodal loads from the model store
        const storeLoads = useModelStore.getState().loads;
        const actualLoads = storeLoads.length > 0
            ? storeLoads.map(l => ({
                nodeId: parseInt(l.nodeId) || 0,
                fx: l.fx || 0, fy: l.fy || 0, fz: l.fz || 0,
                mx: l.mx || 0, my: l.my || 0, mz: l.mz || 0,
            }))
            : []; // If no loads defined, send empty — backend should handle

        await runPDelta({
            ...model,
            loads: actualLoads,
            options: {
                maxIterations,
                tolerance,
            },
        });
    };

    // Calculate amplification factor display
    const amplificationInfo = useMemo(() => {
        if (!pdeltaResult) return null;

        const factor = pdeltaResult.amplificationFactor;
        let status: 'safe' | 'warning' | 'critical' = 'safe';
        let message = '';

        if (factor > 1.5) {
            status = 'critical';
            message = 'High P-Δ effect — consider increasing lateral stiffness (IS 800 Cl.4.4.2)';
        } else if (factor > 1.1) {
            status = 'warning';
            message = 'Moderate P-Δ effect — review design per AISC 360 App. 8';
        } else {
            status = 'safe';
            message = 'P-Δ effect within acceptable limits (B₂ < 1.1)';
        }

        return { factor, status, message };
    }, [pdeltaResult]);

    // ============================================
    // RENDER
    // ============================================

    if (!isPro) {
        return (
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-[#1a2333]">
                <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-5 h-5 text-blue-500" />
                    <h3 className="font-semibold text-blue-700 dark:text-blue-400">
                        P-Delta Analysis - Pro Feature
                    </h3>
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-300">
                    Upgrade to Pro to access geometric nonlinear analysis, second-order effects,
                    and stability amplification factors.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-3 border-b border-[#1a2333]">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        P-Delta Analysis
                    </h3>
                    <span className="text-xs text-[#869ab8]">Second-Order Effects</span>
                </div>

                {/* Settings */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div>
                        <label className="text-slate-500">Max Iterations</label>
                        <input
                            type="number"
                            min={5}
                            max={100}
                            value={maxIterations}
                            onChange={(e) => setMaxIterations(parseInt(e.target.value) || 20)}
                            className="w-full px-2 py-1 border rounded dark:bg-slate-800 dark:border-slate-600"
                        />
                    </div>
                    <div>
                        <label className="text-slate-500">Tolerance</label>
                        <select
                            value={tolerance}
                            onChange={(e) => setTolerance(parseFloat(e.target.value))}
                            className="w-full px-2 py-1 border rounded dark:bg-slate-800 dark:border-slate-600"
                        >
                            <option value={1e-3}>1e-3 (Coarse)</option>
                            <option value={1e-4}>1e-4 (Standard)</option>
                            <option value={1e-5}>1e-5 (Fine)</option>
                            <option value={1e-6}>1e-6 (Very Fine)</option>
                        </select>
                    </div>
                </div>

                <button type="button"
                    onClick={handleRunAnalysis}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded transition-colors text-sm"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    {isLoading ? 'Analyzing...' : 'Run P-Delta Analysis'}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border-b border-[#1a2333] flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto p-3">
                {!pdeltaResult ? (
                    <div className="text-center text-slate-500 py-8">
                        <Maximize2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Run P-Delta analysis to see second-order effects.</p>
                        <p className="text-xs text-[#869ab8] mt-1">
                            Accounts for geometric nonlinearity due to axial loads
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Convergence Status */}
                        <div className={`
                            flex items-center gap-3 p-3 rounded-lg mb-4
                            ${pdeltaResult.converged
                                ? 'bg-green-100 dark:bg-green-900/30'
                                : 'bg-red-100 dark:bg-red-900/30'}
                        `}>
                            {pdeltaResult.converged ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                            )}
                            <div>
                                <div className={`font-semibold text-sm ${pdeltaResult.converged ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                                    }`}>
                                    {pdeltaResult.converged ? 'Converged' : 'Did Not Converge'}
                                </div>
                                <div className="text-xs opacity-75">
                                    {pdeltaResult.iterations} iterations
                                </div>
                            </div>
                        </div>

                        {/* Convergence History */}
                        {pdeltaResult.convergenceHistory && (
                            <div className="mb-4">
                                <ConvergenceChart history={pdeltaResult.convergenceHistory} />
                            </div>
                        )}

                        {/* Amplification Factor */}
                        {amplificationInfo && (
                            <div className={`
                                p-3 rounded-lg mb-4 border
                                ${amplificationInfo.status === 'safe'
                                    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                                    : amplificationInfo.status === 'warning'
                                        ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
                                        : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'}
                            `}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium tracking-wide tracking-wide">Amplification Factor</span>
                                    <span className={`
                                        text-2xl font-bold
                                        ${amplificationInfo.status === 'safe'
                                            ? 'text-green-500'
                                            : amplificationInfo.status === 'warning'
                                                ? 'text-yellow-500'
                                                : 'text-red-500'}
                                    `}>
                                        {amplificationInfo.factor.toFixed(3)}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500">{amplificationInfo.message}</p>
                            </div>
                        )}

                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 gap-2 mb-4 text-center text-xs">
                            <div className="p-2 bg-[#131b2e] rounded">
                                <div className="text-lg font-bold">
                                    {pdeltaResult.maxDisplacement?.toFixed(2) || '—'}
                                </div>
                                <div className="text-slate-500">Max Disp. (mm)</div>
                            </div>
                            <div className="p-2 bg-[#131b2e] rounded">
                                <div className="text-lg font-bold">
                                    {pdeltaResult.iterations}
                                </div>
                                <div className="text-slate-500">Iterations</div>
                            </div>
                        </div>

                        {/* 1st vs 2nd Order Comparison — use actual analysis results */}
                        {showComparison && analysisResults && (
                            <div className="p-3 bg-[#131b2e] rounded-lg">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-medium tracking-wide tracking-wide text-slate-500">
                                        1st vs 2nd Order Comparison
                                    </span>
                                    <BarChart3 className="w-4 h-4 text-[#869ab8]" />
                                </div>

                                {(() => {
                                    // Compute max displacement from 1st-order results
                                    let maxDisp1st = 0;
                                    analysisResults.displacements.forEach(d => {
                                        const mag = Math.sqrt(d.dx * d.dx + d.dy * d.dy + d.dz * d.dz) * 1000; // mm
                                        if (mag > maxDisp1st) maxDisp1st = mag;
                                    });
                                    // Compute max moment from 1st-order member forces
                                    let maxMom1st = 0;
                                    analysisResults.memberForces.forEach(f => {
                                        const m = Math.max(Math.abs(f.momentY ?? 0), Math.abs(f.momentZ ?? 0));
                                        if (m > maxMom1st) maxMom1st = m;
                                    });
                                    return (
                                        <>
                                            <ComparisonBar
                                                label="Max Displacement"
                                                firstOrder={maxDisp1st || 0.01}
                                                secondOrder={pdeltaResult.maxDisplacement || maxDisp1st * (pdeltaResult.amplificationFactor || 1)}
                                                unit="mm"
                                            />
                                            <ComparisonBar
                                                label="Max Moment (amplified)"
                                                firstOrder={maxMom1st || 0.01}
                                                secondOrder={maxMom1st * (pdeltaResult.amplificationFactor || 1)}
                                                unit="kN·m"
                                            />
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Info Box — P-Delta theory reference */}
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-[#1a2333]">
                            <div className="flex items-start gap-2">
                                <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5" />
                                <div className="text-xs text-blue-600 dark:text-blue-400">
                                    <strong>P-Δ Effect (IS 800 Cl.4.4.2, AISC 360 App. 8):</strong> Second-order
                                    moments arise when axial loads act on the deformed structure.
                                    Amplification factor B₂ = 1 / (1 − ΣP<sub>story</sub>/P<sub>e,story</sub>).
                                    If B₂ &gt; 1.5, sway stability is critical.
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Footer */}
            {pdeltaResult && (
                <div className="p-3 border-t border-[#1a2333] flex justify-between">
                    <button type="button"
                        onClick={() => setShowComparison(!showComparison)}
                        className="text-sm text-slate-500 hover:text-slate-700"
                    >
                        {showComparison ? 'Hide' : 'Show'} Comparison
                    </button>
                    <button type="button" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                </div>
            )}
        </div>
    );
};

export default PDeltaAnalysisPanel;
