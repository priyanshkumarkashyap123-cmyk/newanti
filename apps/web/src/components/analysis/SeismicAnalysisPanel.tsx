import React, { useState } from 'react';
import { AdvancedAnalysisService, SeismicAnalysisRequest, SeismicAnalysisResponse } from '../../services/AdvancedAnalysisService';

export const SeismicAnalysisPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SeismicAnalysisResponse | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const service = new AdvancedAnalysisService();
      const req: SeismicAnalysisRequest = {
        frequencies_rad_s: [10.0, 17.32, 22.36],
        mode_shapes: [
          [0.5, 0.5, 0.5],
          [0.707, 0.0, -0.707],
          [0.5, -0.707, 0.5]
        ],
        modal_masses: [300000, 200000, 100000],
        participation_factors: [1.2, 0.3, 0.1],
        seismic_code: 'IS1893',
        zone: 'Zone3',
        soil_type: 'TypeII',
        importance: 'Ordinary',
        response_reduction: 'SMRF',
        damping_ratio: 0.05,
        combination_method: 'CQC',
        story_heights: [3.0, 6.0, 9.0],
        story_masses: [100000, 100000, 100000]
      };
      const res = await service.seismicAnalysis(req);
      setResult(res);
    } catch (e: any) {
      setError(e.message || 'Seismic analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Seismic Response Spectrum</h2>
      <p>Compute code-based seismic response using simple 3-mode input.</p>
      <button onClick={runAnalysis} disabled={loading}>
        {loading ? 'Analyzing...' : 'Run Seismic Response'}
      </button>
      {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}
      {result && (
        <div style={{ marginTop: 20 }}>
          <h3>Results</h3>
          <div>
            <strong>Periods (s):</strong> {result.periods_s.map(T => T.toFixed(3)).join(', ')}
          </div>
          <div>
            <strong>Spectral Accelerations (g):</strong> {result.spectral_accelerations_g.map(a => a.toFixed(3)).join(', ')}
          </div>
          <div>
            <strong>Modal Base Shears (kN):</strong> {result.modal_base_shears_kn.map(V => V.toFixed(1)).join(', ')}
          </div>
          <div>
            <strong>Max Displacement (m):</strong> {result.max_displacement_m.toFixed(4)}
          </div>
          <div>
            <strong>Max Base Shear (kN):</strong> {result.max_base_shear_kn.toFixed(1)}
          </div>
          <div>
            <strong>Code Base Shear (kN):</strong> {result.code_base_shear_kn.toFixed(1)}
          </div>
          <div>
            <em>Computed in {result.performance_ms.toFixed(2)} ms</em>
          </div>
        </div>
      )}
    </div>
  );
};
