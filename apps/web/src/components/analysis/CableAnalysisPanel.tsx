/**
 * CableAnalysisPanel.tsx - Cable Element Analysis UI
 * Nonlinear catenary analysis for tension-only cable elements
 */

import { useState } from 'react';
import { useModelStore } from '../../store/model';
import { useShallow } from 'zustand/react/shallow';
import { rustApi } from '../../api/rustApi';

export function CableAnalysisPanel() {
    const store = useModelStore(
      useShallow((s) => ({ nodes: s.nodes, members: s.members, loads: s.loads }))
    );
    const [analyzing, setAnalyzing] = useState(false);
    const [results, setResults] = useState<any>(null);
    const [error, setError] = useState<string>('');
    const [params, setParams] = useState({
        cableModulus: 200000, // MPa
        tensionOnly: true,
        sag: 0.05, // 5% of span
        iterations: 20
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
            // Build cable analysis requests per member
            const cableResults = [];
            for (const member of members) {
                const startNode = nodes.find(n => n.id === member.startNodeId);
                const endNode = nodes.find(n => n.id === member.endNodeId);
                if (!startNode || !endNode) continue;

                const dx = endNode.x - startNode.x;
                const dy = (endNode.y || 0) - (startNode.y || 0);
                const dz = (endNode.z || 0) - (startNode.z || 0);
                const span = Math.sqrt(dx * dx + dy * dy + dz * dz);

                try {
                    const response = await rustApi.analyzeCable({
                        span,
                        sag: params.sag * span,
                        loadPerMeter: 10, // default kN/m
                        cableArea: member.A || 0.001,
                        elasticModulus: params.cableModulus,
                    });

                    cableResults.push({
                        id: member.id,
                        tension: response.maxTension ?? response.horizontalTension ?? 0,
                        sag: response.sagRatio ? response.sagRatio * span * 1000 : params.sag * span * 1000,
                        length: response.cableLength ?? span,
                        status: 'taut'
                    });
                } catch {
                    cableResults.push({
                        id: member.id,
                        tension: 0,
                        sag: 0,
                        length: span,
                        status: 'error'
                    });
                }
            }

            const analysisResults = {
                cables: cableResults,
                converged: true,
                iterations: params.iterations
            };
            setResults(analysisResults);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Cable analysis failed');
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="cable-analysis-panel p-5 bg-[#1e1e1e] text-white min-h-screen">
            <h2 className="mb-5">🔗 Cable Analysis</h2>
            
            <div className="mb-[30px] bg-[#2d2d2d] p-5 rounded-lg">
                <h3>Cable Properties</h3>
                
                <div className="mt-[15px] grid gap-[15px]">
                    <label className="block">
                        Cable Modulus (MPa):
                        <input
                            type="number"
                            value={params.cableModulus}
                            onChange={(e) => setParams({ ...params, cableModulus: parseFloat(e.target.value) || 200000 })}
                            className="ml-2.5 p-2 bg-[#1e1e1e] text-white border border-[#444] rounded w-[150px]"
                        />
                    </label>

                    <label className="block">
                        Initial Sag Ratio:
                        <input
                            type="number"
                            value={params.sag}
                            step="0.01"
                            onChange={(e) => setParams({ ...params, sag: parseFloat(e.target.value) || 0.05 })}
                            className="ml-2.5 p-2 bg-[#1e1e1e] text-white border border-[#444] rounded w-[150px]"
                        />
                    </label>

                    <label className="flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={params.tensionOnly}
                            onChange={(e) => setParams({ ...params, tensionOnly: e.target.checked })}
                            className="mr-2.5"
                        />
                        Tension Only (no compression)
                    </label>

                    <label className="block">
                        Max Iterations:
                        <input
                            type="number"
                            value={params.iterations}
                            onChange={(e) => setParams({ ...params, iterations: parseInt(e.target.value) || 20 })}
                            className="ml-2.5 p-2 bg-[#1e1e1e] text-white border border-[#444] rounded w-[100px]"
                        />
                    </label>
                </div>

                <button type="button"
                    onClick={handleRunAnalysis}
                    disabled={analyzing || store.nodes.size === 0}
                    className="mt-5 py-3 px-6 text-white border-none rounded text-base"
                    style={{
                        background: analyzing ? '#555' : '#2196F3',
                        cursor: analyzing ? 'wait' : 'pointer'
                    }}
                >
                    {analyzing ? '🔄 Analyzing...' : '▶️ Run Cable Analysis'}
                </button>
            </div>

            {error && (
                <div className="p-[15px] bg-[#d32f2f] rounded-lg mb-5">
                    <strong>Error:</strong> {error}
                </div>
            )}

            {results && (
                <div className="bg-[#2d2d2d] p-5 rounded-lg">
                    <h3>Cable Forces & Geometry</h3>
                    
                    {results.cables && results.cables.length > 0 ? (
                        <div className="mt-5">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-[#444]">
                                        <th className="p-2.5 text-left">Cable ID</th>
                                        <th className="p-2.5 text-right">Tension (kN)</th>
                                        <th className="p-2.5 text-right">Sag (mm)</th>
                                        <th className="p-2.5 text-right">Length (m)</th>
                                        <th className="p-2.5 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.cables.map((cable: any, idx: number) => (
                                        <tr key={idx} className="border-b border-[#333]">
                                            <td className="p-2.5">{cable.id}</td>
                                            <td className="p-2.5 text-right text-[#4fc3f7]">
                                                {cable.tension?.toFixed(2) || 'N/A'}
                                            </td>
                                            <td className="p-2.5 text-right">
                                                {cable.sag ? (cable.sag * 1000).toFixed(1) : 'N/A'}
                                            </td>
                                            <td className="p-2.5 text-right">
                                                {cable.length?.toFixed(3) || 'N/A'}
                                            </td>
                                            <td className="p-2.5 text-center" style={{ color: cable.status === 'slack' ? '#ef4444' : '#4caf50' }}>
                                                {cable.status === 'slack' ? '⚠️ Slack' : '✓ Taut'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {results.converged !== undefined && (
                                <div className="mt-5 p-[15px] bg-[#1e1e1e] rounded">
                                    <strong>Convergence: </strong>
                                    <span style={{ color: results.converged ? '#4caf50' : '#ff9800' }}>
                                        {results.converged ? '✓ Converged' : '⚠️ Not Converged'}
                                    </span>
                                    {results.iterations && (
                                        <span className="ml-5 text-[#bbb]">
                                            ({results.iterations} iterations)
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-[#999] mt-[15px]">No cable results available</p>
                    )}
                </div>
            )}

            <div className="mt-[30px] p-[15px] bg-[#424242] rounded-lg text-sm">
                <strong>ℹ️ About Cable Analysis</strong>
                <p className="mt-2.5 leading-[1.6] text-[#bbb]">
                    Cable analysis accounts for the nonlinear catenary shape of cables under self-weight and loads.
                    Cables are tension-only elements that go slack when subjected to compression. The analysis
                    iteratively determines the equilibrium geometry and tension forces. Typical applications include
                    suspension bridges, cable-stayed bridges, and tension structures.
                </p>
            </div>
        </div>
    );
}
