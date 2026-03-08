import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AdvancedAnalysisService, TimeHistoryRequest, TimeHistoryResponse } from '../../services/AdvancedAnalysisService';
import { getErrorMessage } from '../../lib/errorHandling';

export const TimeHistoryPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TimeHistoryResponse | null>(null);

  const [integrationMethod, setIntegrationMethod] = useState<'newmark' | 'central_difference' | 'wilson'>('newmark');
  const [dampingAlpha, setDampingAlpha] = useState(0.1);
  const [dampingBeta, setDampingBeta] = useState(0.01);
  const [dt, setDt] = useState(0.1);

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
        dt,
        integration_method: integrationMethod,
        damping: { type: 'rayleigh', alpha: dampingAlpha, beta: dampingBeta },
        output_interval: 1,
      };
      const res = await service.timeHistoryAnalysis(req);
      setResult(res);
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Time-history analysis failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200/50 dark:border-slate-700/50 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Time-History Analysis</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Newmark-beta / Wilson-theta integration for dynamic response</p>
          </div>
        </div>
      </div>

      {/* Parameters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Integration Method</label>
          <select
            value={integrationMethod}
            onChange={(e) => setIntegrationMethod(e.target.value as 'newmark' | 'central_difference' | 'wilson')}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="newmark">Newmark-Beta</option>
            <option value="wilson_theta">Wilson-Theta</option>
            <option value="central_difference">Central Difference</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Time Step (s)</label>
          <input
            type="number"
            value={dt}
            onChange={(e) => setDt(parseFloat(e.target.value) || 0.1)}
            step="0.01"
            min="0.001"
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Damping Alpha</label>
          <input
            type="number"
            value={dampingAlpha}
            onChange={(e) => setDampingAlpha(parseFloat(e.target.value) || 0)}
            step="0.01"
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Damping Beta</label>
          <input
            type="number"
            value={dampingBeta}
            onChange={(e) => setDampingBeta(parseFloat(e.target.value) || 0)}
            step="0.001"
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Run Button */}
      <button
        onClick={runAnalysis}
        disabled={loading}
        className={`w-full py-3 px-6 rounded-lg font-semibold text-zinc-900 dark:text-white transition-all duration-200 ${
          loading
            ? 'bg-slate-200 dark:bg-slate-700 cursor-not-allowed opacity-60'
            : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-900/30 hover:shadow-blue-800/40'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Analyzing...
          </span>
        ) : (
          'Run Time-History Analysis'
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
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white border-b border-slate-200/50 dark:border-slate-700/50 pb-2">Dynamic Response Results</h3>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-lg p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Max Displacement</p>
              <p className="text-2xl font-bold text-blue-400">{result.max_displacement.toFixed(4)} <span className="text-sm text-slate-500 dark:text-slate-400">m</span></p>
            </div>
            <div className="bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-lg p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Max Velocity</p>
              <p className="text-2xl font-bold text-cyan-400">{result.max_velocity.toFixed(4)} <span className="text-sm text-slate-500 dark:text-slate-400">m/s</span></p>
            </div>
            <div className="bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 rounded-lg p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Max Acceleration</p>
              <p className="text-2xl font-bold text-emerald-400">{result.max_acceleration.toFixed(4)} <span className="text-sm text-slate-500 dark:text-slate-400">m/s²</span></p>
            </div>
          </div>

          {/* Time Step Table */}
          <div className="bg-slate-100/40 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100/80 dark:bg-slate-800/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Step</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Time (s)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {result.time.slice(0, 10).map((t, i) => (
                  <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">Step {i + 1}</td>
                    <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-200 font-mono">{t.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.time.length > 10 && (
              <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-300/30 dark:border-slate-700/30">
                Showing first 10 of {result.time.length} time steps
              </div>
            )}
          </div>

          {/* Performance */}
          <p className="text-xs text-slate-500 text-right">Computed in {result.performance_ms.toFixed(2)} ms</p>
        </div>
      )}
    </div>
  );
};
