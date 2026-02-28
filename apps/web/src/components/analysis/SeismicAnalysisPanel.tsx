import React, { useState } from 'react';
import { AdvancedAnalysisService, SeismicAnalysisRequest, SeismicAnalysisResponse } from '../../services/AdvancedAnalysisService';
import { getErrorMessage } from '../../lib/errorHandling';

export const SeismicAnalysisPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SeismicAnalysisResponse | null>(null);

  const [zone, setZone] = useState('Zone3');
  const [soilType, setSoilType] = useState('TypeII');
  const [importance, setImportance] = useState('Ordinary');
  const [rFactor, setRFactor] = useState('SMRF');
  const [combMethod, setCombMethod] = useState<'CQC' | 'SRSS' | 'ABS'>('CQC');

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
        zone,
        soil_type: soilType,
        importance,
        response_reduction: rFactor,
        damping_ratio: 0.05,
        combination_method: combMethod,
        story_heights: [3.0, 6.0, 9.0],
        story_masses: [100000, 100000, 100000]
      };
      const res = await service.seismicAnalysis(req);
      setResult(res);
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Seismic analysis failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200/50 dark:border-slate-700/50 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Seismic Response Spectrum</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">IS 1893 / Eurocode 8 code-based seismic response analysis</p>
          </div>
        </div>
      </div>

      {/* Parameters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Seismic Zone</label>
          <select
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="Zone2">Zone II (Low)</option>
            <option value="Zone3">Zone III (Moderate)</option>
            <option value="Zone4">Zone IV (Severe)</option>
            <option value="Zone5">Zone V (Very Severe)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Soil Type</label>
          <select
            value={soilType}
            onChange={(e) => setSoilType(e.target.value)}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="TypeI">Type I (Rock/Hard Soil)</option>
            <option value="TypeII">Type II (Medium Soil)</option>
            <option value="TypeIII">Type III (Soft Soil)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Importance</label>
          <select
            value={importance}
            onChange={(e) => setImportance(e.target.value)}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="Ordinary">Ordinary (I=1.0)</option>
            <option value="Important">Important (I=1.2)</option>
            <option value="Essential">Essential (I=1.5)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Response Reduction</label>
          <select
            value={rFactor}
            onChange={(e) => setRFactor(e.target.value)}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="SMRF">SMRF (R=5.0)</option>
            <option value="OMRF">OMRF (R=3.0)</option>
            <option value="BracedFrame">Braced Frame (R=4.0)</option>
            <option value="ShearWall">Shear Wall (R=4.0)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Combination Method</label>
          <select
            value={combMethod}
            onChange={(e) => setCombMethod(e.target.value as 'CQC' | 'SRSS' | 'ABS')}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="CQC">CQC (Complete Quadratic)</option>
            <option value="SRSS">SRSS (Square Root Sum)</option>
            <option value="ABS">ABS (Absolute Sum)</option>
          </select>
        </div>
      </div>

      {/* Run Button */}
      <button
        onClick={runAnalysis}
        disabled={loading}
        className={`w-full py-3 px-6 rounded-lg font-semibold text-zinc-900 dark:text-white transition-all duration-200 ${
          loading
            ? 'bg-slate-200 dark:bg-slate-700 cursor-not-allowed opacity-60'
            : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 shadow-lg shadow-red-900/30 hover:shadow-red-800/40'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analyzing...
          </span>
        ) : (
          'Run Seismic Response Analysis'
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-400">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white border-b border-slate-200/50 dark:border-slate-700/50 pb-2">Analysis Results</h3>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-lg p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Max Base Shear</p>
              <p className="text-2xl font-bold text-red-400">{result.max_base_shear_kn.toFixed(1)} <span className="text-sm text-slate-500 dark:text-slate-400">kN</span></p>
            </div>
            <div className="bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-lg p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Code Base Shear</p>
              <p className="text-2xl font-bold text-orange-400">{result.code_base_shear_kn.toFixed(1)} <span className="text-sm text-slate-500 dark:text-slate-400">kN</span></p>
            </div>
            <div className="bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-lg p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Max Displacement</p>
              <p className="text-2xl font-bold text-amber-400">{result.max_displacement_m.toFixed(4)} <span className="text-sm text-slate-500 dark:text-slate-400">m</span></p>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="bg-slate-100/40 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100/80 dark:bg-slate-800/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mode</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Period (s)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sa/g</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Base Shear (kN)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {result.periods_s.map((T, i) => (
                  <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">Mode {i + 1}</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">{T.toFixed(3)}</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">{result.spectral_accelerations_g[i]?.toFixed(3) ?? '-'}</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200 font-mono">{result.modal_base_shears_kn[i]?.toFixed(1) ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Performance */}
          <p className="text-xs text-slate-500 text-right">Computed in {result.performance_ms.toFixed(2)} ms</p>
        </div>
      )}
    </div>
  );
};
