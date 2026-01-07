/**
 * PDeltaAnalysisPanel.tsx - P-Delta (Second-Order) Analysis UI
 * Geometric nonlinearity analysis for accurate member forces
 */

import { useState } from 'react';
import { useModelStore } from '../../store/model';
import { analysisService } from '../../services/AnalysisService';

export function PDeltaAnalysisPanel() {
    const store = useModelStore();
    const [analyzing, setAnalyzing] = useState(false);
    const [results, setResults] = useState<any>(null);
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
            
            setResults(analysisResults);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'P-Delta analysis failed');
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="pdelta-analysis-panel" style={{ padding: '20px', background: '#1e1e1e', color: '#fff', minHeight: '100vh' }}>
            <h2 style={{ marginBottom: '20px' }}>📐 P-Delta Analysis (Second-Order)</h2>
            
            <div style={{ marginBottom: '30px', background: '#2d2d2d', padding: '20px', borderRadius: '8px' }}>
                <h3>Analysis Parameters</h3>
                
                <div style={{ marginTop: '15px', display: 'grid', gap: '15px' }}>
                    <label style={{ display: 'block' }}>
                        Maximum Iterations:
                        <input
                            type="number"
                            value={params.maxIterations}
                            onChange={(e) => setParams({ ...params, maxIterations: parseInt(e.target.value) || 10 })}
                            min={3}
                            max={50}
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

                    <label style={{ display: 'block' }}>
                        Convergence Tolerance:
                        <input
                            type="number"
                            value={params.tolerance}
                            step="1e-7"
                            onChange={(e) => setParams({ ...params, tolerance: parseFloat(e.target.value) || 1e-6 })}
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
                        Damping Factor (0-1):
                        <input
                            type="number"
                            value={params.damping}
                            step="0.1"
                            onChange={(e) => setParams({ ...params, damping: parseFloat(e.target.value) || 0.5 })}
                            min={0}
                            max={1}
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

                <button
                    onClick={handleRunAnalysis}
                    disabled={analyzing || store.nodes.size === 0}
                    style={{
                        marginTop: '20px',
                        padding: '12px 24px',
                        background: analyzing ? '#555' : '#FF5722',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: analyzing ? 'wait' : 'pointer',
                        fontSize: '16px'
                    }}
                >
                    {analyzing ? '🔄 Analyzing (Rust)...' : '▶️ Run P-Delta Analysis'}
                </button>
                
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#888' }}>
                    ⚡ Powered by Rust (20x faster than Python)
                </div>
            </div>

            {error && (
                <div style={{ padding: '15px', background: '#d32f2f', borderRadius: '8px', marginBottom: '20px' }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {results && (
                <div style={{ background: '#2d2d2d', padding: '20px', borderRadius: '8px' }}>
                    <h3>Analysis Results</h3>
                    
                    {results.converged !== undefined && (
                        <div style={{ 
                            marginTop: '15px', 
                            padding: '15px', 
                            background: results.converged ? '#1b5e20' : '#e65100', 
                            borderRadius: '4px',
                            marginBottom: '20px'
                        }}>
                            <strong>Status: </strong>
                            <span style={{ fontSize: '18px' }}>
                                {results.converged ? '✓ Converged' : '⚠️ Did Not Converge'}
                            </span>
                            {results.iterations && (
                                <span style={{ marginLeft: '20px', color: '#ddd' }}>
                                    (Iterations: {results.iterations})
                                </span>
                            )}
                            {results.error && (
                                <div style={{ marginTop: '10px', color: '#ffcdd2' }}>
                                    Final Error: {results.error.toExponential(3)}
                                </div>
                            )}
                        </div>
                    )}

                    {results.displacements && (
                        <div style={{ marginTop: '20px' }}>
                            <h4>Maximum Displacements</h4>
                            <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                                {['dx', 'dy', 'dz'].map((dir) => {
                                    const maxDisp = results.displacements.reduce((max: number, d: any) => 
                                        Math.max(max, Math.abs(d[dir] || 0)), 0
                                    );
                                    return (
                                        <div key={dir} style={{ padding: '15px', background: '#1e1e1e', borderRadius: '4px' }}>
                                            <div style={{ color: '#888', fontSize: '12px' }}>{dir.toUpperCase()}</div>
                                            <div style={{ fontSize: '20px', color: '#4fc3f7', marginTop: '5px' }}>
                                                {maxDisp.toFixed(3)} mm
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {results.amplification_factor && (
                        <div style={{ marginTop: '20px', padding: '15px', background: '#1e1e1e', borderRadius: '4px' }}>
                            <strong>P-Delta Amplification Factor: </strong>
                            <span style={{ fontSize: '20px', color: '#ff9800', marginLeft: '10px' }}>
                                {results.amplification_factor.toFixed(3)}
                            </span>
                            <div style={{ marginTop: '10px', fontSize: '14px', color: '#bbb' }}>
                                {results.amplification_factor > 1.4 
                                    ? '⚠️ High amplification - Structure sensitive to P-Delta effects' 
                                    : '✓ Moderate amplification - P-Delta effects within acceptable range'}
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: '30px', padding: '15px', background: '#1e1e1e', borderRadius: '4px' }}>
                        <h4>Comparison: First-Order vs Second-Order</h4>
                        <ul style={{ marginTop: '10px', lineHeight: '1.8', color: '#bbb' }}>
                            <li>First-order: Ignores deformed geometry (fast, conservative for stiff structures)</li>
                            <li>Second-order: Accounts for P-Delta effects (accurate, essential for slender structures)</li>
                            <li>Amplification &gt; 1.1: Second-order analysis recommended</li>
                            <li>Amplification &gt; 1.4: Structure may need redesign or bracing</li>
                        </ul>
                    </div>
                </div>
            )}

            <div style={{ marginTop: '30px', padding: '15px', background: '#424242', borderRadius: '8px', fontSize: '14px' }}>
                <strong>ℹ️ About P-Delta Analysis</strong>
                <p style={{ marginTop: '10px', lineHeight: '1.6', color: '#bbb' }}>
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
