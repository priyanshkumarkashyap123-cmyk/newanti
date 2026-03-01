/**
 * IS456DesignPanel.tsx - IS 456:2000 Concrete Design Checks
 *
 * Pro Feature: Design code compliance checks
 * Shows utilization ratios for concrete members
 *
 * Enhanced with Self-Learning Design:
 *   - "Smart Optimize" uses IterativeSectionOptimizer to find optimal sections
 *   - Knowledge base caches every design for instant future lookups
 *   - Extra Factor of Safety slider lets users add safety margin above code FoS
 */

import { FC, useMemo, useState } from "react";
import {
  Check,
  X,
  AlertTriangle,
  ChevronDown,
  Crown,
  Brain,
  Zap,
  Database,
  Trash2,
  Sliders,
} from "lucide-react";
import { useModelStore } from "../store/model";
import {
  IS456_Design,
  IS456_CONCRETE_GRADES,
  IS456_REBAR_GRADES,
} from "../utils/ISCodeDesign";
import {
  useSmartDesign,
  type OptimizeResult,
} from "../services/design-learning";

// ============================================
// TYPES
// ============================================

interface DesignCheck {
  name: string;
  demand: number;
  capacity: number;
  ratio: number;
  unit: string;
  status: "pass" | "warning" | "fail";
}

interface MemberDesignResult {
  memberId: string;
  memberName: string;
  checks: DesignCheck[];
  overallUtilization: number;
  status: "pass" | "warning" | "fail";
}

interface IS456DesignPanelProps {
  isPro?: boolean;
}

// ============================================
// COMPONENT
// ============================================

export const IS456DesignPanel: FC<IS456DesignPanelProps> = ({
  isPro = false,
}) => {
  const members = useModelStore((s) => s.members);
  const nodes = useModelStore((s) => s.nodes);
  const analysisResults = useModelStore((s) => s.analysisResults);

  // Default concrete and rebar grades
  const concreteGrade = IS456_CONCRETE_GRADES.find((g) => g.grade === "M25")!;
  const rebarGrade = IS456_REBAR_GRADES.find((g) => g.grade === "Fe500")!;

  // State for results
  const [apiResults, setApiResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Smart Design hook ──
  const {
    optimize,
    autoDesignAll,
    allResults: smartResults,
    isOptimizing,
    userPrefs,
    setUserPrefs,
    kbStats,
    clearKB,
  } = useSmartDesign();

  const [extraFoS, setExtraFoS] = useState<number>(userPrefs?.extraFoS ?? 1.0);
  const [showSmartPanel, setShowSmartPanel] = useState(false);

  const handleRunCheck = async () => {
    if (!analysisResults) return;
    setIsLoading(true);
    try {
      const designInputs = Array.from(members.keys())
        .map((id: string) => {
          const member = members.get(id)!;
          const startNode = nodes.get(member.startNodeId)!;
          const endNode = nodes.get(member.endNodeId)!;
          const dx = endNode.x - startNode.x;
          const dy = endNode.y - startNode.y;
          const dz = endNode.z - startNode.z;
          const length = Math.sqrt(dx * dx + dy * dy + dz * dz) * 1000; // mm

          const forces = analysisResults.memberForces.get(id);
          const width = (member.dimensions?.rectWidth ?? 0.3) * 1000;
          const depth = (member.dimensions?.rectHeight ?? 0.5) * 1000;

          return {
            id,
            type:
              Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > Math.abs(dz)
                ? "column"
                : "beam", // Simple heuristic
            width,
            depth,
            length,
            forces: {
              axial: forces?.axial ?? 0,
              shearY: forces?.shearY ?? 0,
              shearZ: forces?.shearZ ?? 0,
              torsion: forces?.torsion ?? 0,
              momentY: forces?.momentY ?? 0,
              momentZ: forces?.momentZ ?? 0,
            },
            fck: concreteGrade.fck,
            fy: rebarGrade.fy,
            cover: 25,
          };
        })
        .filter(Boolean);

      // Design each member individually
      const designModule = await import("../api/design");
      const results: any[] = [];

      for (const input of designInputs) {
        try {
          if (designModule.designConcreteBeam) {
            const result = await designModule.designConcreteBeam({
              section: {
                width: input.width,
                depth: input.depth,
                effectiveDepth: input.depth - input.cover - 10, // Approx effective depth
                cover: input.cover,
              },
              forces: {
                Mu: Math.abs(input.forces.momentY),
                Vu: Math.abs(input.forces.shearY),
              },
              material: {
                fck: input.fck,
                fy: input.fy,
              },
            });
            results.push({ id: input.id, ...result });
          }
        } catch (e) {
          console.warn(`Failed to design member ${input.id}:`, e);
        }
      }

      setApiResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Smart Optimize handler ──
  const handleSmartOptimize = async () => {
    // Persist user FoS preference first
    await setUserPrefs({ extraFoS });
    // Run auto-design on all beam members
    await autoDesignAll();
    setShowSmartPanel(true);
  };

  const handleExtraFoSChange = async (value: number) => {
    const clamped = Math.max(1.0, Math.min(2.0, value));
    setExtraFoS(clamped);
    await setUserPrefs({ extraFoS: clamped });
  };

  // Use API results instead of local calculation
  const designResults = useMemo(() => {
    if (apiResults.length > 0) return apiResults;
    return [];
  }, [apiResults]);

  // ... (keep existing summary logic)
  // Summary stats
  const summary = useMemo(() => {
    const total = designResults.length;
    const passing = designResults.filter(
      (r: any) => r.status === "pass",
    ).length;
    const warnings = designResults.filter(
      (r: any) => r.status === "warning",
    ).length;
    const failing = designResults.filter(
      (r: any) => r.status === "fail",
    ).length;
    return { total, passing, warnings, failing };
  }, [designResults]);

  if (!isPro) {
    return (
      <div className="p-6 bg-white dark:bg-slate-900 rounded-xl text-center">
        <Crown className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Pro Feature</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
          IS 456:2000 design checks are available with Pro
        </p>
        <button className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-white font-medium">
          Upgrade to Pro
        </button>
      </div>
    );
  }

  if (!analysisResults) {
    return (
      <div className="p-6 bg-white dark:bg-slate-900 rounded-xl text-center">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
          Run Analysis First
        </h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Design checks require analysis results
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-orange-600 to-red-600">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">
              IS 456:2000 Design Check
            </h2>
            <p className="text-sm text-slate-900/70 dark:text-white/70">
              {concreteGrade.grade} Concrete • {rebarGrade.grade} Rebar
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSmartOptimize}
              disabled={isOptimizing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 text-slate-900 dark:text-white rounded-md text-sm font-medium hover:bg-white/30 disabled:opacity-50 border border-white/30"
              title="Find optimal RCC sections (self-learning)"
            >
              <Brain className="w-4 h-4" />
              {isOptimizing ? "Optimizing..." : "Smart Optimize"}
            </button>
            <button
              onClick={handleRunCheck}
              disabled={isLoading}
              className="px-4 py-1.5 bg-orange-600 text-white rounded-md text-sm font-bold hover:bg-orange-500 disabled:opacity-50"
            >
              {isLoading ? "Checking..." : "Run Check"}
            </button>
          </div>
        </div>
      </div>

      {/* Extra Factor of Safety + Knowledge Base Stats */}
      <div className="px-4 py-3 bg-slate-100/60 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Sliders className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
          <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Extra FoS
          </label>
          <input
            type="range"
            min="1.0"
            max="2.0"
            step="0.05"
            value={extraFoS}
            onChange={(e) => handleExtraFoSChange(parseFloat(e.target.value))}
            className="flex-1 h-1.5 accent-orange-500"
          />
          <span className="text-sm font-mono text-slate-900 dark:text-white min-w-[2.5rem] text-right">
            {extraFoS.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span
            className="flex items-center gap-1"
            title="Cached designs in knowledge base"
          >
            <Database className="w-3 h-3" /> {kbStats.cacheSize} cached
          </span>
          <button
            onClick={clearKB}
            className="flex items-center gap-1 text-slate-500 hover:text-red-400 transition-colors"
            title="Clear knowledge base"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Smart Design Suggestions */}
      {showSmartPanel && smartResults.size > 0 && (
        <div className="border-b border-slate-200 dark:border-slate-700">
          <div className="px-4 py-2 bg-gradient-to-r from-purple-900/40 to-blue-900/40 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              Optimal Sections — {smartResults.size} members
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
            {Array.from(smartResults.entries()).map(([memberId, result]) => (
              <div
                key={memberId}
                className="px-4 py-2 flex items-center justify-between text-sm hover:bg-slate-200/30 dark:hover:bg-slate-800/30"
              >
                <span className="text-slate-600 dark:text-slate-300 font-medium">{memberId}</span>
                <div className="flex items-center gap-4">
                  <span className="text-slate-500 dark:text-slate-400">
                    {result.b} × {result.D} mm
                  </span>
                  <span className="text-blue-400 font-mono text-xs">
                    Ast {result.Ast.toFixed(0)} mm²
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      result.source === "cache"
                        ? "bg-green-900/40 text-green-400"
                        : result.source === "interpolation"
                          ? "bg-yellow-900/40 text-yellow-400"
                          : "bg-blue-900/40 text-blue-400"
                    }`}
                  >
                    {result.source === "cache"
                      ? "⚡ cached"
                      : result.source === "interpolation"
                        ? "≈ interpolated"
                        : "🔧 computed"}
                  </span>
                  <span
                    className={`text-xs font-mono ${
                      result.utilization > 1
                        ? "text-red-400"
                        : result.utilization > 0.9
                          ? "text-yellow-400"
                          : "text-green-400"
                    }`}
                  >
                    {(result.utilization * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{summary.total}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Total</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">
            {summary.passing}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Passing</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-400">
            {summary.warnings}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Warnings</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-400">
            {summary.failing}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Failing</div>
        </div>
      </div>

      {/* Results List */}
      <div className="max-h-96 overflow-y-auto">
        {designResults.map((result: any) => (
          <details
            key={result.memberId}
            className="border-b border-slate-200 dark:border-slate-800 group"
          >
            <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50">
              <div className="flex items-center gap-3">
                {result.status === "pass" ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : result.status === "warning" ? (
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                ) : (
                  <X className="w-5 h-5 text-red-400" />
                )}
                <span className="font-medium text-slate-900 dark:text-white">
                  {result.memberId}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-sm ${
                    result.overallRatio > 1
                      ? "text-red-400"
                      : result.overallRatio > 0.9
                        ? "text-yellow-400"
                        : "text-green-400"
                  }`}
                >
                  {(result.overallRatio * 100).toFixed(0)}%
                </span>
                <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400 group-open:rotate-180 transition-transform" />
              </div>
            </summary>
            <div className="px-4 pb-4 space-y-2">
              {/* Rebar Details */}
              <div className="grid grid-cols-2 gap-4 mb-4 p-2 bg-slate-100/50 dark:bg-slate-800/50 rounded text-xs border border-slate-200 dark:border-slate-700">
                {Object.entries(result.details || {}).map(([key, value]) => (
                  <div key={key}>
                    <div className="text-slate-500 dark:text-slate-400 capitalize">
                      {key.replace("_", " ")}
                    </div>
                    <div className="text-slate-900 dark:text-white font-mono">{String(value)}</div>
                  </div>
                ))}
              </div>

              {result.checks.map((check: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm py-2 border-t border-slate-800/50"
                >
                  <span className="text-slate-500 dark:text-slate-400">{check.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-500 dark:text-slate-400">
                      {check.demand.toFixed(1)} / {check.capacity.toFixed(1)}{" "}
                      {check.unit}
                    </span>
                    <span
                      className={`w-16 text-right font-medium ${
                        check.status === "pass"
                          ? "text-green-400"
                          : check.status === "warning"
                            ? "text-yellow-400"
                            : "text-red-400"
                      }`}
                    >
                      {(check.ratio * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
        {designResults.length === 0 && !isLoading && (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
            Click "Run Check" to verify member capacities
          </div>
        )}
      </div>
    </div>
  );
};

export default IS456DesignPanel;
