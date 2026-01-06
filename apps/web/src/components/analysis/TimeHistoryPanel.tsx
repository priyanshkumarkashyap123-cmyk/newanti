import React, { useState } from 'react';
import { AdvancedAnalysisService, TimeHistoryRequest, TimeHistoryResponse } from '../../services/AdvancedAnalysisService';

export const TimeHistoryPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TimeHistoryResponse | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const service = new AdvancedAnalysisService();
      const req: TimeHistoryRequest = {
        stiffness_matrix: [100],
        mass_matrix: [10],
        dimension: 1,
        force_history: [[0], [10], [0], [-10], [0]],
        dt: 0.1,
        integration_method: 'newmark',
        damping: { type: 'rayleigh', alpha: 0.1, beta: 0.01 },
        output_interval: 1,
      };
      const res = await service.timeHistoryAnalysis(req);
      setResult(res);
    } catch (e: any) {
      setError(e.message || 'Time-history analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Time-History Analysis</h2>
      <p>Run a simple SDOF Newmark integration with a small force history.</p>
      <button onClick={runAnalysis} disabled={loading}>
        {loading ? 'Analyzing...' : 'Run Time-History'}
      </button>
      {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}
      {result && (
        <div style={{ marginTop: 20 }}>
          <h3>Results</h3>
          <div>
            <strong>Time (s):</strong> {result.time.map(t => t.toFixed(2)).join(', ')}
          </div>
          <div>
            <strong>Max Displacement:</strong> {result.max_displacement.toFixed(4)}
          </div>
          <div>
            <strong>Max Velocity:</strong> {result.max_velocity.toFixed(4)}
          </div>
          <div>
            <strong>Max Acceleration:</strong> {result.max_acceleration.toFixed(4)}
          </div>
          <div>
            <em>Computed in {result.performance_ms.toFixed(2)} ms</em>
          </div>
        </div>
      )}
    </div>
  );
};
