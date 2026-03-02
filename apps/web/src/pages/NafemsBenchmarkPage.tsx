/**
 * NafemsBenchmarkPage.tsx - NAFEMS Benchmark Validation Dashboard
 *
 * Two tabs:
 *   1. REAL Benchmarks — calls actual FEA solvers (3D frame, thermal Quad4, Hex8 solid)
 *      and compares against analytical solutions.
 *   2. Legacy (Reference) — the original 31-test suite that compares target-to-target
 *      (provided for reference only; clearly marked as non-solver validation).
 */

import { FC, useState, useEffect, useCallback } from 'react';
import {
  run_real_benchmarks,
  run_nafems_all_benchmarks,
  run_nafems_le_benchmarks,
  run_nafems_fv_benchmarks,
  run_nafems_nl_benchmarks,
  run_nafems_thermal_benchmarks,
  run_nafems_contact_benchmarks,
} from 'backend-rust';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Play,
  BarChart3,
  Flame,
  Waves,
  Zap,
  ShieldCheck,
  Loader2,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  FlaskConical,
  AlertTriangle,
  Cpu,
} from 'lucide-react';

// ===================== Types =====================

/** Real benchmark entry (from run_real_benchmarks) */
interface RealBenchmarkEntry {
  id: string;
  name: string;
  category: string;
  solver_used: string;
  expected_value: number;
  computed_value: number;
  unit: string;
  error_percent: number;
  passed: boolean;
  description: string;
}

interface RealBenchmarkReport {
  success: boolean;
  report_title: string;
  total_tests: number;
  passed_tests: number;
  pass_rate: number;
  is_real_solver: boolean;
  results: RealBenchmarkEntry[];
}

/** Legacy benchmark entry (from run_nafems_*) */
interface LegacyBenchmarkEntry {
  name: string;
  category: string;
  target_value: number;
  computed_value: number;
  unit: string;
  error_percent: number;
  tolerance_percent: number;
  passed: boolean;
  notes: string;
}

interface LegacyBenchmarkReport {
  success: boolean;
  suite_name: string;
  total_tests: number;
  passed_tests: number;
  pass_rate: number;
  results: LegacyBenchmarkEntry[];
}

type TabKey = 'real' | 'legacy';
type LegacyCategoryKey = 'all' | 'le' | 'fv' | 'nl' | 'thermal' | 'contact';

interface LegacyCategoryInfo {
  key: LegacyCategoryKey;
  label: string;
  description: string;
  icon: FC<{ className?: string }>;
  color: string;
  runner: () => unknown;
}

// ===================== Helpers =====================

const LEGACY_CATEGORIES: LegacyCategoryInfo[] = [
  { key: 'all', label: 'All Benchmarks', description: 'Full 31-test suite (reference only)', icon: ShieldCheck, color: 'emerald', runner: run_nafems_all_benchmarks },
  { key: 'le', label: 'Linear Elastic', description: 'LE1–LE11', icon: BarChart3, color: 'blue', runner: run_nafems_le_benchmarks },
  { key: 'fv', label: 'Free Vibration', description: 'FV12–FV72', icon: Waves, color: 'purple', runner: run_nafems_fv_benchmarks },
  { key: 'nl', label: 'Nonlinear', description: 'NL1–NL7', icon: Zap, color: 'amber', runner: run_nafems_nl_benchmarks },
  { key: 'thermal', label: 'Thermal', description: 'T1–T5', icon: Flame, color: 'red', runner: run_nafems_thermal_benchmarks },
  { key: 'contact', label: 'Contact', description: 'IC1, IC3, IC5', icon: Activity, color: 'cyan', runner: run_nafems_contact_benchmarks },
];

function formatValue(value: number, unit: string): string {
  const abs = Math.abs(value);
  if (abs === 0) return `0 ${unit}`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(3)} G${unit}`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(3)} M${unit}`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(3)} k${unit}`;
  if (abs < 0.001 && abs > 0) return `${(value * 1e3).toFixed(4)} m${unit}`;
  return `${value.toFixed(4)} ${unit}`;
}

function colorForCategory(cat: string): string {
  switch (cat) {
    case 'Structural': return 'blue';
    case 'Thermal': return 'red';
    case 'Solid': return 'violet';
    case 'LinearElastic': return 'blue';
    case 'FreeVibration': return 'purple';
    case 'Nonlinear': return 'amber';
    case 'Contact': return 'cyan';
    default: return 'slate';
  }
}

// ===================== Sub-components =====================

const PassFailBadge: FC<{ passed: boolean }> = ({ passed }) =>
  passed ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
      <CheckCircle2 className="w-3 h-3" /> PASS
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
      <XCircle className="w-3 h-3" /> FAIL
    </span>
  );

const ProgressRing: FC<{ percent: number; size?: number }> = ({ percent, size = 120 }) => {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const ringColor = percent === 100 ? '#10b981' : percent >= 80 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-200 dark:text-slate-700" />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={ringColor} strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" className="fill-slate-900 dark:fill-white text-lg font-bold transform rotate-90 origin-center">
        {percent.toFixed(0)}%
      </text>
    </svg>
  );
};

// ===================== Real Benchmark Row =====================

const RealResultRow: FC<{ entry: RealBenchmarkEntry }> = ({ entry }) => {
  const catColor = colorForCategory(entry.category);
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <PassFailBadge passed={entry.passed} />
          <div>
            <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">{entry.id}</span>
            <span className="text-slate-400 mx-1.5">·</span>
            <span className="text-slate-600 dark:text-slate-300 text-sm">{entry.name}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium bg-${catColor}-100 text-${catColor}-700 dark:bg-${catColor}-900/30 dark:text-${catColor}-400`}>
          {entry.category}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <Cpu className="w-3 h-3" />
          {entry.solver_used}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm text-slate-700 dark:text-slate-300">
        {formatValue(entry.expected_value, entry.unit)}
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm text-slate-700 dark:text-slate-300">
        {formatValue(entry.computed_value, entry.unit)}
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`font-mono text-sm font-semibold ${entry.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {entry.error_percent.toFixed(4)}%
        </span>
      </td>
      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs max-w-[220px]" title={entry.description}>
        {entry.description || '—'}
      </td>
    </tr>
  );
};

// ===================== Legacy Benchmark Row =====================

const LegacyResultRow: FC<{ entry: LegacyBenchmarkEntry }> = ({ entry }) => {
  const catColor = colorForCategory(entry.category);
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <PassFailBadge passed={entry.passed} />
          <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">{entry.name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium bg-${catColor}-100 text-${catColor}-700 dark:bg-${catColor}-900/30 dark:text-${catColor}-400`}>
          {entry.category}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm text-slate-700 dark:text-slate-300">
        {formatValue(entry.target_value, entry.unit)}
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm text-slate-700 dark:text-slate-300">
        {formatValue(entry.computed_value, entry.unit)}
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`font-mono text-sm font-semibold ${entry.error_percent <= entry.tolerance_percent ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {entry.error_percent.toFixed(2)}%
        </span>
        <span className="text-slate-400 text-xs ml-1">/ {entry.tolerance_percent}%</span>
      </td>
      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs max-w-[180px] truncate" title={entry.notes}>
        {entry.notes || '—'}
      </td>
    </tr>
  );
};

// ===================== Main Page =====================

export const NafemsBenchmarkPage: FC = () => {
  // Tab
  const [activeTab, setActiveTab] = useState<TabKey>('real');

  // Real benchmarks state
  const [realReport, setRealReport] = useState<RealBenchmarkReport | null>(null);
  const [realRunning, setRealRunning] = useState(false);
  const [realError, setRealError] = useState<string | null>(null);
  const [realElapsedMs, setRealElapsedMs] = useState(0);
  const [realExpandedCategories, setRealExpandedCategories] = useState<Set<string>>(new Set());

  // Legacy benchmarks state
  const [legacyReport, setLegacyReport] = useState<LegacyBenchmarkReport | null>(null);
  const [legacyRunning, setLegacyRunning] = useState(false);
  const [legacyActiveCategory, setLegacyActiveCategory] = useState<LegacyCategoryKey>('all');
  const [legacyExpandedCategories, setLegacyExpandedCategories] = useState<Set<string>>(new Set());
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const [legacyElapsedMs, setLegacyElapsedMs] = useState(0);

  useEffect(() => {
    document.title = 'NAFEMS Benchmarks | BeamLab';
  }, []);

  // ---- Real benchmarks runner ----
  const runRealBenchmarks = useCallback(async () => {
    setRealRunning(true);
    setRealError(null);
    const t0 = performance.now();
    try {
      const raw = run_real_benchmarks();
      const result = raw as RealBenchmarkReport;
      if (!result || !result.success) {
        setRealError('Real benchmark returned an error. Check WASM build.');
        setRealReport(null);
      } else {
        setRealReport(result);
        const cats = new Set(result.results.map((r) => r.category));
        setRealExpandedCategories(cats);
      }
    } catch (e: unknown) {
      setRealError(`WASM Error: ${e instanceof Error ? e.message : String(e)}`);
      setRealReport(null);
    } finally {
      setRealElapsedMs(performance.now() - t0);
      setRealRunning(false);
    }
  }, []);

  // ---- Legacy benchmarks runner ----
  const runLegacyBenchmark = useCallback(async (catKey: LegacyCategoryKey) => {
    setLegacyRunning(true);
    setLegacyError(null);
    setLegacyActiveCategory(catKey);
    const t0 = performance.now();
    try {
      const category = LEGACY_CATEGORIES.find((c) => c.key === catKey)!;
      const raw = category.runner();
      const result = raw as LegacyBenchmarkReport;
      if (!result || !result.success) {
        setLegacyError('Legacy benchmark returned an error.');
        setLegacyReport(null);
      } else {
        setLegacyReport(result);
        const cats = new Set(result.results.map((r) => r.category));
        setLegacyExpandedCategories(cats);
      }
    } catch (e: unknown) {
      setLegacyError(`WASM Error: ${e instanceof Error ? e.message : String(e)}`);
      setLegacyReport(null);
    } finally {
      setLegacyElapsedMs(performance.now() - t0);
      setLegacyRunning(false);
    }
  }, []);

  const toggleRealCategory = (cat: string) => {
    setRealExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const toggleLegacyCategory = (cat: string) => {
    setLegacyExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  // Group helpers
  const groupRealResults: Record<string, RealBenchmarkEntry[]> = {};
  if (realReport) {
    for (const r of realReport.results) {
      if (!groupRealResults[r.category]) groupRealResults[r.category] = [];
      groupRealResults[r.category].push(r);
    }
  }

  const groupLegacyResults: Record<string, LegacyBenchmarkEntry[]> = {};
  if (legacyReport) {
    for (const r of legacyReport.results) {
      if (!groupLegacyResults[r.category]) groupLegacyResults[r.category] = [];
      groupLegacyResults[r.category].push(r);
    }
  }

  const isRunning = realRunning || legacyRunning;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white dark:from-slate-950 via-slate-50 dark:via-slate-900 to-white dark:to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <ShieldCheck className="w-7 h-7 text-emerald-500" />
                NAFEMS Benchmark Validation
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                Industry-standard FEA solver verification — real solvers, real results
              </p>
            </div>
            <a
              href="/rust-wasm-demo"
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-lg transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              WASM Demo
            </a>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 mt-4">
            <button
              type="button"
              onClick={() => setActiveTab('real')}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                activeTab === 'real'
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-b-0 border-emerald-200 dark:border-emerald-800'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <FlaskConical className="w-4 h-4" />
              Real Solver Benchmarks
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('legacy')}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                activeTab === 'legacy'
                  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-b-0 border-amber-200 dark:border-amber-800'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Legacy (Reference Only)
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* ========== REAL TAB ========== */}
        {activeTab === 'real' && (
          <>
            {/* Explanation card */}
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <FlaskConical className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-emerald-800 dark:text-emerald-300">
                  <p className="font-semibold mb-1">Real Solver Verification</p>
                  <p>
                    These benchmarks build actual finite element models in-browser, call the real Rust solvers
                    (Direct Stiffness Method for frames, Galerkin FEM for thermal, Hex8 isoparametric for solids),
                    and compare computed results against known analytical solutions. Nothing is hard-coded.
                  </p>
                </div>
              </div>
            </div>

            {/* Run button */}
            <div className="flex justify-center">
              <button
                type="button"
                disabled={isRunning}
                onClick={runRealBenchmarks}
                className="flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold text-base shadow-lg shadow-emerald-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-wait"
              >
                {realRunning ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                {realRunning ? 'Running solvers…' : 'Run Real Benchmarks'}
              </button>
            </div>

            {/* Error */}
            {realError && !realRunning && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-red-700 dark:text-red-400">
                <p className="font-semibold">Benchmark Error</p>
                <p className="text-sm mt-1">{realError}</p>
              </div>
            )}

            {/* Real Results */}
            {realReport && !realRunning && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <ProgressRing percent={realReport.pass_rate} />
                    <div className="flex-1 space-y-3 text-center md:text-left">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        {realReport.report_title}
                        {realReport.is_real_solver && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" /> REAL SOLVER
                          </span>
                        )}
                      </h2>
                      <div className="flex flex-wrap justify-center md:justify-start gap-6 text-sm">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Tests </span>
                          <span className="font-bold text-slate-900 dark:text-white">{realReport.total_tests}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Passed </span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{realReport.passed_tests}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Failed </span>
                          <span className="font-bold text-red-600 dark:text-red-400">{realReport.total_tests - realReport.passed_tests}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Time </span>
                          <span className="font-bold text-slate-900 dark:text-white">{realElapsedMs.toFixed(1)} ms</span>
                        </div>
                      </div>
                      <div className="w-full max-w-md mx-auto md:mx-0 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-700"
                          style={{ width: `${realReport.pass_rate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grouped tables */}
                {Object.entries(groupRealResults).map(([category, entries]) => {
                  const isExpanded = realExpandedCategories.has(category);
                  const passed = entries.filter((e) => e.passed).length;
                  const catColor = colorForCategory(category);
                  return (
                    <div key={category} className="bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleRealCategory(category)}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <span className={`inline-block px-2.5 py-1 rounded text-xs font-semibold bg-${catColor}-100 text-${catColor}-700 dark:bg-${catColor}-900/30 dark:text-${catColor}-400`}>
                            {category}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-white text-sm">
                            {passed}/{entries.length} passed
                          </span>
                        </div>
                        <span className={`text-xs font-medium ${passed === entries.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {((passed / entries.length) * 100).toFixed(0)}%
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                <th className="px-4 py-2 font-medium">Benchmark</th>
                                <th className="px-4 py-2 font-medium">Category</th>
                                <th className="px-4 py-2 font-medium">Solver</th>
                                <th className="px-4 py-2 font-medium text-right">Expected</th>
                                <th className="px-4 py-2 font-medium text-right">Computed</th>
                                <th className="px-4 py-2 font-medium text-right">Error</th>
                                <th className="px-4 py-2 font-medium">Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entries.map((entry, idx) => (
                                <RealResultRow key={idx} entry={entry} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {!realReport && !realRunning && !realError && (
              <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                <FlaskConical className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Click "Run Real Benchmarks" to verify solvers</p>
                <p className="text-sm mt-2">
                  Builds actual FE models in-browser and solves them via Rust WASM. No server required.
                </p>
              </div>
            )}
          </>
        )}

        {/* ========== LEGACY TAB ========== */}
        {activeTab === 'legacy' && (
          <>
            {/* Warning */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <p className="font-semibold mb-1">Reference Only — Not Real Solver Validation</p>
                  <p>
                    These legacy benchmarks compare NAFEMS target values against themselves (target == computed).
                    They demonstrate the benchmark catalogue implementation but do <strong>not</strong> validate
                    actual FEA solver computation. Use the "Real Solver Benchmarks" tab for genuine verification.
                  </p>
                </div>
              </div>
            </div>

            {/* Category cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {LEGACY_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = legacyActiveCategory === cat.key && legacyReport !== null;
                return (
                  <button
                    type="button"
                    key={cat.key}
                    disabled={isRunning}
                    onClick={() => runLegacyBenchmark(cat.key)}
                    className={`group relative text-left p-5 rounded-xl border transition-all duration-200 ${
                      isActive
                        ? 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-400/30'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md'
                    } disabled:opacity-50 disabled:cursor-wait`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg bg-${cat.color}-100 dark:bg-${cat.color}-900/30`}>
                        <Icon className={`w-5 h-5 text-${cat.color}-600 dark:text-${cat.color}-400`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{cat.label}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{cat.description}</p>
                      </div>
                      <Play className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors flex-shrink-0 mt-1" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Loading */}
            {legacyRunning && (
              <div className="flex items-center justify-center gap-3 py-12">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-slate-600 dark:text-slate-400 font-medium">Running legacy benchmarks…</span>
              </div>
            )}

            {/* Error */}
            {legacyError && !legacyRunning && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-red-700 dark:text-red-400">
                <p className="font-semibold">Benchmark Error</p>
                <p className="text-sm mt-1">{legacyError}</p>
              </div>
            )}

            {/* Legacy Results */}
            {legacyReport && !legacyRunning && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <ProgressRing percent={legacyReport.pass_rate} />
                    <div className="flex-1 space-y-3 text-center md:text-left">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        {legacyReport.suite_name}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3" /> REFERENCE ONLY
                        </span>
                      </h2>
                      <div className="flex flex-wrap justify-center md:justify-start gap-6 text-sm">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Tests </span>
                          <span className="font-bold text-slate-900 dark:text-white">{legacyReport.total_tests}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Passed </span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{legacyReport.passed_tests}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Failed </span>
                          <span className="font-bold text-red-600 dark:text-red-400">{legacyReport.total_tests - legacyReport.passed_tests}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Time </span>
                          <span className="font-bold text-slate-900 dark:text-white">{legacyElapsedMs.toFixed(1)} ms</span>
                        </div>
                      </div>
                      <div className="w-full max-w-md mx-auto md:mx-0 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-700"
                          style={{ width: `${legacyReport.pass_rate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {Object.entries(groupLegacyResults).map(([category, entries]) => {
                  const isExpanded = legacyExpandedCategories.has(category);
                  const passed = entries.filter((e) => e.passed).length;
                  const catColor = colorForCategory(category);
                  return (
                    <div key={category} className="bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleLegacyCategory(category)}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <span className={`inline-block px-2.5 py-1 rounded text-xs font-semibold bg-${catColor}-100 text-${catColor}-700 dark:bg-${catColor}-900/30 dark:text-${catColor}-400`}>
                            {category}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-white text-sm">
                            {passed}/{entries.length} passed
                          </span>
                        </div>
                        <span className={`text-xs font-medium ${passed === entries.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {((passed / entries.length) * 100).toFixed(0)}%
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                <th className="px-4 py-2 font-medium">Benchmark</th>
                                <th className="px-4 py-2 font-medium">Category</th>
                                <th className="px-4 py-2 font-medium text-right">Target</th>
                                <th className="px-4 py-2 font-medium text-right">Computed</th>
                                <th className="px-4 py-2 font-medium text-right">Error</th>
                                <th className="px-4 py-2 font-medium">Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entries.map((entry, idx) => (
                                <LegacyResultRow key={idx} entry={entry} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty legacy state */}
            {!legacyReport && !legacyRunning && !legacyError && (
              <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                <ShieldCheck className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Select a category above to run legacy benchmarks</p>
                <p className="text-sm mt-2">Reference results (target == computed). Not solver verification.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NafemsBenchmarkPage;
