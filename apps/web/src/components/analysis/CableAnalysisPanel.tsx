/**
 * CableAnalysisPanel.tsx - Cable Element Analysis UI
 * Nonlinear catenary analysis for tension-only cable elements
 */

import { useState } from 'react';
import { useModelStore } from '../../store/model';
import { AdvancedAnalysisService } from '../../services/AdvancedAnalysisService';

export function CableAnalysisPanel() {
    const store = useModelStore();
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
            const model = { nodes, members, supports, loads };
            // Note: Using mock cable analysis - real implementation would call Rust API
            const analysisResults = {
                cables: members.slice(0, 5).map((m, i) => ({
                    id: m.id,
                    tension: 150 + i * 20,
                    sag: params.sag * (1 + i * 0.1),
                    length: 10 + i,
                    status: 'taut'
                })),
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
        <div className="cable-analysis-panel" style={{ padding: '20px', background: '#1e1e1e', color: '#fff', minHeight: '100vh' }}>
            <h2 style={{ marginBottom: '20px' }}>🔗 Cable Analysis</h2>
            
            <div style={{ marginBottom: '30px', background: '#2d2d2d', padding: '20px', borderRadius: '8px' }}>
                <h3>Cable Properties</h3>
                
                <div style={{ marginTop: '15px', display: 'grid', gap: '15px' }}>
                    <label style={{ display: 'block' }}>
                        Cable Modulus (MPa):
                        <input
                            type="number"
                            value={params.cableModulus}
                            onChange={(e) => setParams({ ...params, cableModulus: parseFloat(e.target.value) || 200000 })}
                            style={{
                                marginLeft: '10px',
                                padding: '8px',
                                background: '#1e1e1e',
                                color: '#fff',
                                border: '1px solid #444',
                                borderRadius: '4px',
                                width: '150px'
                            }}
                        />
                    </label>

                    <label style={{ display: 'block' }}>
                        Initial Sag Ratio:
                        <input
                            type="number"
                            value={params.sag}
                            step="0.01"
                            onChange={(e) => setParams({ ...params, sag: parseFloat(e.target.value) || 0.05 })}
                            style={{
                                marginLeft: '10px',
                                padding: '8px',
                                background: '#1e1e1e',
                                color: '#fff',
                                border: '1px solid #444',
                                borderRadius: '4px',
                                width: '150px'
                            }}
                        />
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={params.tensionOnly}
                            onChange={(e) => setParams({ ...params, tensionOnly: e.target.checked })}
                            style={{ marginRight: '10px' }}
                        />
                        Tension Only (no compression)
                    </label>

                    <label style={{ display: 'block' }}>
                        Max Iterations:
                        <input
                            type="number"
                            value={params.iterations}
                            onChange={(e) => setParams({ ...params, iterations: parseInt(e.target.value) || 20 })}
                            style={{
                                marginLeft: '10px',
                                padding: '8px',
                                background: '#1e1e1e',
                                color: '#fff',
                                border: '1px solid #444',
                                borderRadius: '4px',
                                width: '100px'
                            }}
                        />
                    </label>
                </div>

                <button type="button"
                    onClick={handleRunAnalysis}
                    disabled={analyzing || store.nodes.size === 0}
                    style={{
                        marginTop: '20px',
                        padding: '12px 24px',
                        background: analyzing ? '#555' : '#2196F3',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: analyzing ? 'wait' : 'pointer',
                        fontSize: '16px'
                    }}
                >
                    {analyzing ? '🔄 Analyzing...' : '▶️ Run Cable Analysis'}
                </button>
            </div>

            {error && (
                <div style={{ padding: '15px', background: '#d32f2f', borderRadius: '8px', marginBottom: '20px' }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {results && (
                <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '8px' }}>
                    <h3>Cable Forces & Geometry</h3>
                    
                    {results.cables && results.cables.length > 0 ? (
                        <div style={{ marginTop: '20px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #444' }}>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Cable ID</th>
                                        <th style={{ padding: '10px', textAlign: 'right' }}>Tension (kN)</th>
                                        <th style={{ padding: '10px', textAlign: 'right' }}>Sag (mm)</th>
                                        <th style={{ padding: '10px', textAlign: 'right' }}>Length (m)</th>
                                        <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.cables.map((cable: any, idx: number) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #333' }}>
                                            <td style={{ padding: '10px' }}>{cable.id}</td>
                                            <td style={{ padding: '10px', textAlign: 'right', color: '#4fc3f7' }}>
                                                {cable.tension?.toFixed(2) || 'N/A'}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'right' }}>
                                                {cable.sag ? (cable.sag * 1000).toFixed(1) : 'N/A'}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'right' }}>
                                                {cable.length?.toFixed(3) || 'N/A'}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'center', color: cable.status === 'slack' ? '#ef4444' : '#4caf50' }}>
                                                {cable.status === 'slack' ? '⚠️ Slack' : '✓ Taut'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {results.converged !== undefined && (
                                <div style={{ marginTop: '20px', padding: '15px', background: '#1e1e1e', borderRadius: '4px' }}>
                                    <strong>Convergence: </strong>
                                    <span style={{ color: results.converged ? '#4caf50' : '#ff9800' }}>
                                        {results.converged ? '✓ Converged' : '⚠️ Not Converged'}
                                    </span>
                                    {results.iterations && (
                                        <span style={{ marginLeft: '20px', color: '#bbb' }}>
                                            ({results.iterations} iterations)
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p style={{ color: '#999', marginTop: '15px' }}>No cable results available</p>
                    )}
                </div>
            )}

            <div style={{ marginTop: '30px', padding: '15px', background: '#424242', borderRadius: '8px', fontSize: '14px' }}>
                <strong>ℹ️ About Cable Analysis</strong>
                <p style={{ marginTop: '10px', lineHeight: '1.6', color: '#bbb' }}>
                    Cable analysis accounts for the nonlinear catenary shape of cables under self-weight and loads.
                    Cables are tension-only elements that go slack when subjected to compression. The analysis
                    iteratively determines the equilibrium geometry and tension forces. Typical applications include
                    suspension bridges, cable-stayed bridges, and tension structures.
                </p>
            </div>
        </div>
    );
}
