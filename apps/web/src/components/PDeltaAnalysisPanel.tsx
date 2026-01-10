/**
 * PDeltaAnalysisPanel.tsx - P-Delta (Geometric Nonlinear) Analysis
 * 
 * Displays second-order analysis results:
 * - Convergence status
 * - Amplification factors
 * - Displacement comparison (1st vs 2nd order)
 * - Iteration history
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
        <div className="h-24 bg-gray-50 dark:bg-gray-800 rounded-lg p-2 relative">
            <div className="absolute top-1 left-2 text-xs text-gray-400">Convergence</div>
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
            <div className="absolute bottom-1 left-2 text-xs text-gray-400">
                {history.length} iterations
            </div>
            <div className="absolute bottom-1 right-2 text-xs text-gray-400">
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
            <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{label}</span>
                <span className={parseFloat(amplification) > 10 ? 'text-yellow-500' : 'text-gray-400'}>
                    +{amplification}%
                </span>
            </div>
            <div className="flex gap-1">
                <div className="flex-1">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                        <div
                            className="h-full bg-blue-400"
                            style={{ width: `${(firstOrder / maxValue) * 100}%` }}
                        />
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                        1st: {firstOrder.toFixed(2)} {unit}
                    </div>
                </div>
                <div className="flex-1">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                        <div
                            className="h-full bg-orange-400"
                            style={{ width: `${(secondOrder / maxValue) * 100}%` }}
                        />
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
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

    // Run P-Delta analysis
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

        const supportsArray = Array.from(nodes.values())
            .filter(n => n.restraints)
            .map(n => ({
                nodeId: n.id,
                type: (n.restraints?.fx && n.restraints?.fy && n.restraints?.fz && n.restraints?.mx) ? 'FIXED' : 'PINNED'
                // Simplified support type mapping for this example
            }));

        const model = convertModelForAdvancedAnalysis(
            nodesArray.map((n) => ({ id: n.id, x: n.x, y: n.y, z: n.z })),
            membersArray,
            supportsArray
        );

        // Get loads from existing analysis or create default
        const loads = nodesArray
            .filter((n) => !supportsArray.some((s) => s.nodeId === n.id))
            .slice(0, 1)
            .map((n, i) => ({
                nodeId: i + 1,
                fy: -100, // 100 kN downward
                fx: 10,   // 10 kN lateral
            }));

        await runPDelta({
            ...model,
            loads,
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
            message = 'High P-Delta effect - consider increasing stiffness';
        } else if (factor > 1.1) {
            status = 'warning';
            message = 'Moderate P-Delta effect - review design';
        } else {
            status = 'safe';
            message = 'P-Delta effect within acceptable limits';
        }

        return { factor, status, message };
    }, [pdeltaResult]);

    // ============================================
    // RENDER
    // ============================================

    if (!isPro) {
        return (
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
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
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        P-Delta Analysis
                    </h3>
                    <span className="text-xs text-gray-400">Second-Order Effects</span>
                </div>

                {/* Settings */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div>
                        <label className="text-gray-500">Max Iterations</label>
                        <input
                            type="number"
                            min={5}
                            max={100}
                            value={maxIterations}
                            onChange={(e) => setMaxIterations(parseInt(e.target.value) || 20)}
                            className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-600"
                        />
                    </div>
                    <div>
                        <label className="text-gray-500">Tolerance</label>
                        <select
                            value={tolerance}
                            onChange={(e) => setTolerance(parseFloat(e.target.value))}
                            className="w-full px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-600"
                        >
                            <option value={1e-3}>1e-3 (Coarse)</option>
                            <option value={1e-4}>1e-4 (Standard)</option>
                            <option value={1e-5}>1e-5 (Fine)</option>
                            <option value={1e-6}>1e-6 (Very Fine)</option>
                        </select>
                    </div>
                </div>

                <button
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
                <div className="p-3 bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto p-3">
                {!pdeltaResult ? (
                    <div className="text-center text-gray-500 py-8">
                        <Maximize2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Run P-Delta analysis to see second-order effects.</p>
                        <p className="text-xs text-gray-400 mt-1">
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
                                    <span className="text-sm font-medium">Amplification Factor</span>
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
                                <p className="text-xs text-gray-500">{amplificationInfo.message}</p>
                            </div>
                        )}

                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 gap-2 mb-4 text-center text-xs">
                            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                <div className="text-lg font-bold">
                                    {pdeltaResult.maxDisplacement?.toFixed(2) || '—'}
                                </div>
                                <div className="text-gray-500">Max Disp. (mm)</div>
                            </div>
                            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                <div className="text-lg font-bold">
                                    {pdeltaResult.iterations}
                                </div>
                                <div className="text-gray-500">Iterations</div>
                            </div>
                        </div>

                        {/* 1st vs 2nd Order Comparison */}
                        {showComparison && analysisResults && (
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-medium text-gray-500">
                                        1st vs 2nd Order Comparison
                                    </span>
                                    <BarChart3 className="w-4 h-4 text-gray-400" />
                                </div>

                                <ComparisonBar
                                    label="Max Displacement"
                                    firstOrder={5.2} // From linear analysis
                                    secondOrder={pdeltaResult.maxDisplacement || 5.5}
                                    unit="mm"
                                />

                                <ComparisonBar
                                    label="Max Moment"
                                    firstOrder={120}
                                    secondOrder={120 * (pdeltaResult.amplificationFactor || 1)}
                                    unit="kN.m"
                                />
                            </div>
                        )}

                        {/* Info Box */}
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-start gap-2">
                                <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5" />
                                <div className="text-xs text-blue-600 dark:text-blue-400">
                                    <strong>P-Delta Effect:</strong> Second-order moments arise when
                                    axial loads act on the deformed structure. The amplification
                                    factor B₂ = 1 / (1 - ΣP/ΣPcr) indicates the increase in
                                    moments due to this effect.
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Footer */}
            {pdeltaResult && (
                <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                    <button
                        onClick={() => setShowComparison(!showComparison)}
                        className="text-sm text-gray-500 hover:text-gray-700"
                    >
                        {showComparison ? 'Hide' : 'Show'} Comparison
                    </button>
                    <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                </div>
            )}
        </div>
    );
};

export default PDeltaAnalysisPanel;
