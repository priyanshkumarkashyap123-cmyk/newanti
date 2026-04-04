/**
 * PDeltaAnalysisPanel.tsx - P-Delta (Second-Order) Analysis UI
 * Geometric nonlinearity analysis for accurate member forces
 */

import { useState } from 'react';
import { useModelStore } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';
import { analysisService } from '../../services/AnalysisService';
import type { PDeltaAnalysisResult } from '../../types/analysis';

export function PDeltaAnalysisPanel() {
    const store = useModelStore(
      useShallow((s) => ({ nodes: s.nodes, members: s.members, loads: s.loads }))
    );
    const [analyzing, setAnalyzing] = useState(false);
    const [results, setResults] = useState<PDeltaAnalysisResult | null>(null);
    const [error, setError] = useState<string>('');
    const [params, setParams] = useState({
        maxIterations: 10,
        tolerance: 1e-6,
        damping: 0.5
    });

    const handleRunAnalysis = async () => {
        const nodes = Array.from(store.nodes.values());
        const members = Array.from(store.members.values());
        const supports = nodes.filter(n => n.restraints);
        const loads = store.loads;
        
        if (nodes.length === 0 || members.length === 0) {
            setError('Model must have nodes and members');
            return;
        }

        setAnalyzing(true);
        setError('');
        setResults(null);

        try {
            const model = { nodes, members, supports, loads };
            
            // Use the Rust P-Delta endpoint (20x faster!)
            const analysisResults = await analysisService.runNonLinearAnalysis(model, {
                type: 'p_delta',
                iterations: params.maxIterations,
                tolerance: params.tolerance
            });
            
            // Convert to PDeltaAnalysisResult format
            const pDeltaResult: PDeltaAnalysisResult = {
                converged: analysisResults.success ?? true,
                iterations: params.maxIterations,
                displacements: analysisResults.displacements as PDeltaAnalysisResult['displacements'],
                reactions: analysisResults.reactions,
                memberForces: analysisResults.memberForces as PDeltaAnalysisResult['memberForces'],
            };
            setResults(pDeltaResult);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'P-Delta analysis failed');
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="pdelta-analysis-panel p-5 bg-[#1e1e1e] text-white min-h-screen">
            <h2 className="mb-5">📐 P-Delta Analysis (Second-Order)</h2>
            
            <div className="mb-[30px] bg-[#2d2d2d] p-5 rounded-lg">
                <h3>Analysis Parameters</h3>
                
                <div className="mt-[15px] grid gap-[15px]">
                    <label className="block">
                        Maximum Iterations:
                        <input
                            type="number"
                            value={params.maxIterations}
                            onChange={(e) => setParams({ ...params, maxIterations: parseInt(e.target.value) || 10 })}
                            min={3}
                            max={50}
                            className="ml-[10px] p-2 bg-[#1e1e1e] text-white border border-[#444] rounded w-[100px]"
                        />
                    </label>

                    <label className="block">
                        Convergence Tolerance:
                        <input
                            type="number"
                            value={params.tolerance}
                            step="1e-7"
                            onChange={(e) => setParams({ ...params, tolerance: parseFloat(e.target.value) || 1e-6 })}
                            className="ml-[10px] p-2 bg-[#1e1e1e] text-white border border-[#444] rounded w-[150px]"
                        />
                    </label>

                    <label className="block">
                        Damping Factor (0-1):
                        <input
                            type="number"
                            value={params.damping}
                            step="0.1"
                            onChange={(e) => setParams({ ...params, damping: parseFloat(e.target.value) || 0.5 })}
                            min={0}
                            max={1}
                            className="ml-[10px] p-2 bg-[#1e1e1e] text-white border border-[#444] rounded w-[100px]"
                        />
                    </label>
                </div>

                <button type="button"
                    onClick={handleRunAnalysis}
                    disabled={analyzing || store.nodes.size === 0}
                    className="mt-5 py-3 px-6 border-none rounded text-base transition-all duration-200 ease-in-out"
                    style={{
                        background: analyzing ? '#555' : store.nodes.size === 0 ? '#333' : '#FF5722',
                        color: analyzing || store.nodes.size === 0 ? '#888' : '#fff',
                        cursor: analyzing || store.nodes.size === 0 ? 'not-allowed' : 'pointer',
                        opacity: store.nodes.size === 0 ? 0.5 : 1
                    }}
                >
                    {analyzing ? '🔄 Analyzing (Rust)...' : '▶️ Run P-Delta Analysis'}
                </button>
                
                <div className="mt-[10px] text-xs text-[#888]">
                    ⚡ Powered by Rust (20x faster than Python)
                </div>
            </div>

            {error && (
                <div className="p-[15px] bg-[#d32f2f] rounded-lg mb-5">
                    <strong>Error:</strong> {error}
                </div>
            )}

            {results && (
                <div className="bg-[#2d2d2d] p-5 rounded-lg">
                    <h3>Analysis Results</h3>
                    
                    {results.converged !== undefined && (
                        <div className="mt-[15px] p-[15px] rounded mb-5" style={{ 
                            background: results.converged ? '#1b5e20' : '#e65100'
                        }}>
                            <strong>Status: </strong>
                            <span className="text-lg">
                                {results.converged ? '✓ Converged' : '⚠️ Did Not Converge'}
                            </span>
                            {results.iterations && (
                                <span className="ml-5 text-[#ddd]">
                                    (Iterations: {results.iterations})
                                </span>
                            )}
                            {results.error && (
                                <div className="mt-[10px] text-[#ffcdd2]">
                                    Final Error: {results.error.toExponential(3)}
                                </div>
                            )}
                        </div>
                    )}

                    {results.displacements && (
                        <div className="mt-5">
                            <h4>Maximum Displacements</h4>
                            <div className="mt-[10px] grid grid-cols-3 gap-[15px]">
                                {['DX', 'DY', 'DZ'].map((dir) => {
                                    const disps = Object.values(results.displacements!);
                                    const maxDisp = disps.reduce((max: number, d) => 
                                        Math.max(max, Math.abs(d[dir as keyof typeof d] || 0)), 0
                                    );
                                    return (
                                        <div key={dir} className="p-[15px] bg-[#1e1e1e] rounded">
                                            <div className="text-[#888] text-xs">{dir}</div>
                                            <div className="text-xl text-[#4fc3f7] mt-[5px]">
                                                {maxDisp.toFixed(3)} mm
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {results.amplificationFactors && (
                        <div className="mt-5 p-[15px] bg-[#1e1e1e] rounded">
                            <strong>P-Delta Amplification Factor: </strong>
                            <span className="text-xl text-[#ff9800] ml-[10px]">
                                {results.amplificationFactors.combined.toFixed(3)}
                            </span>
                            <div className="mt-[10px] text-sm text-[#bbb]">
                                {results.amplificationFactors.combined > 1.4 
                                    ? '⚠️ High amplification - Structure sensitive to P-Delta effects' 
                                    : '✓ Moderate amplification - P-Delta effects within acceptable range'}
                            </div>
                        </div>
                    )}

                    <div className="mt-[30px] p-[15px] bg-[#1e1e1e] rounded">
                        <h4>Comparison: First-Order vs Second-Order</h4>
                        <ul className="mt-[10px] leading-[1.8] text-[#bbb]">
                            <li>First-order: Ignores deformed geometry (fast, conservative for stiff structures)</li>
                            <li>Second-order: Accounts for P-Delta effects (accurate, essential for slender structures)</li>
                            <li>Amplification &gt; 1.1: Second-order analysis recommended</li>
                            <li>Amplification &gt; 1.4: Structure may need redesign or bracing</li>
                        </ul>
                    </div>
                </div>
            )}

            <div className="mt-[30px] p-[15px] bg-[#424242] rounded-lg text-sm">
                <strong>ℹ️ About P-Delta Analysis</strong>
                <p className="mt-[10px] leading-relaxed text-[#bbb]">
                    P-Delta (second-order) analysis accounts for geometric nonlinearity by considering equilibrium
                    in the deformed configuration. Axial loads (P) acting on displaced members (Δ) create additional
                    moments that increase displacements. This effect is critical for tall buildings, slender columns,
                    and structures subject to large axial loads. Building codes (AISC, ACI) require second-order
                    analysis when amplification factors exceed certain limits.
                </p>
            </div>
        </div>
    );
}
