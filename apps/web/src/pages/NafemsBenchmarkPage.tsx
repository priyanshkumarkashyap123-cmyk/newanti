/**
 * NafemsBenchmarkPage.tsx - NAFEMS Benchmark Validation Dashboard
 *
 * Runs industry-standard NAFEMS (National Agency for Finite Element Methods and Standards)
 * benchmark tests against the BeamLab solver engine via Rust WASM and displays pass/fail
 * results with detailed metrics.
 *
 * Categories:
 *  - LE (Linear Elastic): LE1–LE11
 *  - FV (Free Vibration): FV12, FV22, FV32, FV42, FV52, FV72
 *  - NL (Nonlinear): NL1–NL7
 *  - T  (Thermal): T1–T5
 *  - IC (Contact): IC1, IC3, IC5
 */

import { FC, useState, useEffect, useCallback } from 'react';
import {
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
} from 'lucide-react';

// ---------- Types ----------

interface BenchmarkEntry {
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

interface BenchmarkReport {
  success: boolean;
  suite_name: string;
  total_tests: number;
  passed_tests: number;
  pass_rate: number;
  results: BenchmarkEntry[];
}

type CategoryKey = 'all' | 'le' | 'fv' | 'nl' | 'thermal' | 'contact';

interface CategoryInfo {
  key: CategoryKey;
  label: string;
  description: string;
  icon: FC<{ className?: string }>;
  color: string;
  runner: () => unknown;
}

// ---------- Helpers ----------

const CATEGORIES: CategoryInfo[] = [
  {
    key: 'all',
    label: 'All Benchmarks',
    description: 'Run complete NAFEMS validation suite (31+ tests)',
    icon: ShieldCheck,
    color: 'emerald',
    runner: run_nafems_all_benchmarks,
  },
  {
    key: 'le',
    label: 'Linear Elastic (LE)',
    description: 'LE1–LE11: Membranes, shells, plates, cylinders',
    icon: BarChart3,
    color: 'blue',
    runner: run_nafems_le_benchmarks,
  },
  {
    key: 'fv',
    label: 'Free Vibration (FV)',
    description: 'FV12–FV72: Modal analysis of plates, beams, disks',
    icon: Waves,
    color: 'purple',
    runner: run_nafems_fv_benchmarks,
  },
  {
    key: 'nl',
    label: 'Nonlinear (NL)',
    description: 'NL1–NL7: Plasticity, large deflection, snap-through',
    icon: Zap,
    color: 'amber',
    runner: run_nafems_nl_benchmarks,
  },
  {
    key: 'thermal',
    label: 'Thermal (T)',
    description: 'T1–T5: Conduction, convection, transient, heat gen',
    icon: Flame,
    color: 'red',
    runner: run_nafems_thermal_benchmarks,
  },
  {
    key: 'contact',
    label: 'Contact (IC)',
    description: 'IC1, IC3, IC5: Hertzian, friction, impact',
    icon: Activity,
    color: 'cyan',
    runner: run_nafems_contact_benchmarks,
  },
];

function formatValue(value: number, unit: string): string {
  const abs = Math.abs(value);
  if (abs === 0) return `0 ${unit}`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(3)} G${unit}`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(3)} M${unit}`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(3)} k${unit}`;
  if (abs < 0.001) return `${(value * 1e3).toFixed(4)} m${unit}`;
  return `${value.toFixed(4)} ${unit}`;
}

function colorForCategory(cat: string): string {
  switch (cat) {
    case 'LinearElastic': return 'blue';
    case 'FreeVibration': return 'purple';
    case 'Nonlinear': return 'amber';
    case 'Thermal': return 'red';
    case 'Contact': return 'cyan';
    default: return 'slate';
  }
}

// ---------- Sub-components ----------

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

const ResultRow: FC<{ entry: BenchmarkEntry }> = ({ entry }) => {
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

// ---------- Main Page ----------

export const NafemsBenchmarkPage: FC = () => {
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [running, setRunning] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  useEffect(() => {
    document.title = 'NAFEMS Benchmarks | BeamLab';
  }, []);

  const runBenchmark = useCallback(async (catKey: CategoryKey) => {
    setRunning(true);
    setError(null);
    setActiveCategory(catKey);
    const t0 = performance.now();
    try {
      const category = CATEGORIES.find((c) => c.key === catKey)!;
      const raw = category.runner();
      const result = raw as BenchmarkReport;
      if (!result || !result.success) {
        setError('Benchmark returned an error. Check WASM build.');
        setReport(null);
      } else {
        setReport(result);
        // auto-expand all categories in result
        const cats = new Set(result.results.map((r) => r.category));
        setExpandedCategories(cats);
      }
    } catch (e: unknown) {
      setError(`WASM Error: ${e instanceof Error ? e.message : String(e)}`);
      setReport(null);
    } finally {
      setElapsedMs(performance.now() - t0);
      setRunning(false);
    }
  }, []);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Group results by category
  const groupedResults: Record<string, BenchmarkEntry[]> = {};
  if (report) {
    for (const r of report.results) {
      if (!groupedResults[r.category]) groupedResults[r.category] = [];
      groupedResults[r.category].push(r);
    }
  }

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
                Industry-standard finite element validation — 31+ tests across 5 categories
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
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Category Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.key && report !== null;
            return (
              <button
                key={cat.key}
                disabled={running}
                onClick={() => runBenchmark(cat.key)}
                className={`group relative text-left p-5 rounded-xl border transition-all duration-200 ${
                  isActive
                    ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 ring-2 ring-emerald-400/30'
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
                  <Play className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors flex-shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Loading indicator */}
        {running && (
          <div className="flex items-center justify-center gap-3 py-12">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Running NAFEMS benchmarks via WASM…</span>
          </div>
        )}

        {/* Error */}
        {error && !running && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-red-700 dark:text-red-400">
            <p className="font-semibold">Benchmark Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Results */}
        {report && !running && (
          <div className="space-y-6">
            {/* Summary bar */}
            <div className="bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <ProgressRing percent={report.pass_rate} />
                <div className="flex-1 space-y-3 text-center md:text-left">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">{report.suite_name}</h2>
                  <div className="flex flex-wrap justify-center md:justify-start gap-6 text-sm">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Total tests </span>
                      <span className="font-bold text-slate-900 dark:text-white">{report.total_tests}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Passed </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{report.passed_tests}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Failed </span>
                      <span className="font-bold text-red-600 dark:text-red-400">{report.total_tests - report.passed_tests}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Time </span>
                      <span className="font-bold text-slate-900 dark:text-white">{elapsedMs.toFixed(1)} ms</span>
                    </div>
                  </div>
                  {/* Mini bar */}
                  <div className="w-full max-w-md mx-auto md:mx-0 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-700"
                      style={{ width: `${report.pass_rate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Grouped result tables */}
            {Object.entries(groupedResults).map(([category, entries]) => {
              const isExpanded = expandedCategories.has(category);
              const passed = entries.filter((e) => e.passed).length;
              const catColor = colorForCategory(category);
              return (
                <div key={category} className="bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category)}
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
                            <ResultRow key={idx} entry={entry} />
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

        {/* Initial state */}
        {!report && !running && !error && (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500">
            <ShieldCheck className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Select a benchmark category above to begin validation</p>
            <p className="text-sm mt-2">
              Tests run entirely in your browser via Rust → WASM. No server required.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NafemsBenchmarkPage;
