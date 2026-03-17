/**
 * LoadCombosView — Load Combination Reference Tables (IS/ASCE/EC)
 * Extracted from AnalysisResultsDashboard.tsx
 */

import React from "react";
import { AlertTriangle, FileText } from "lucide-react";
import type { LoadCombination } from "../../hooks/useAnalysis";
import {
  IS_COMBINATIONS,
  ASCE_COMBINATIONS,
  EC_COMBINATIONS,
} from "../../services/loads/LoadCombinationsService";

const CODES = [
  { key: "IS", label: "IS 875 / IS 456", combos: IS_COMBINATIONS },
  { key: "ASCE", label: "ASCE 7-22 / ACI 318", combos: ASCE_COMBINATIONS },
  { key: "EC", label: "Eurocode EN 1990", combos: EC_COMBINATIONS },
] as const;

interface LoadCombosViewProps {
  loadCombos?: LoadCombination[];
}

const LoadCombosView: React.FC<LoadCombosViewProps> = React.memo(({ loadCombos }) => {
  // If live load combinations are available from analysis, show them
  if (loadCombos && loadCombos.length > 0) {
    return (
      <div key="loadCombos" className="space-y-6 animate-slideUp">
        <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="text-sm font-medium text-slate-900 dark:text-white">Analysis Load Combinations</span>
            <span className="ml-auto text-xs text-slate-500">{loadCombos.length} combinations</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 text-xs">ID</th>
                  <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 text-xs">Name</th>
                  <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 text-xs">Factors</th>
                </tr>
              </thead>
              <tbody>
                {loadCombos.map((combo) => (
                  <tr key={combo.id} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-200/50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">{combo.id}</td>
                    <td className="px-3 py-1.5 font-mono text-slate-900 dark:text-white text-xs">{combo.name}</td>
                    <td className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">
                      {Object.entries(combo.factors).map(([k, v]) => `${k}×${v}`).join(' + ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Empty state when no load combinations available
  if (loadCombos !== undefined && loadCombos.length === 0) {
    return (
      <div key="loadCombos" className="space-y-6 animate-slideUp">
        <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
          <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">No load combinations available for this analysis.</p>
          <p className="text-xs text-slate-400 mt-1">Configure multiple load cases to enable load combination analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div key="loadCombos" className="space-y-6 animate-slideUp">
      {/* Info notice */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-200">
          <strong>Load Combination Reference</strong> — Current analysis uses a single load case.
          Below are the standard code combinations that would apply when multi-case analysis is
          configured. Each combination shows the load factors per code provision.
        </div>
      </div>

      {/* Code tables */}
      <div className="space-y-4">
        {CODES.map((codeGroup) => (
          <div
            key={codeGroup.key}
            className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
          >
            <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                {codeGroup.label}
              </span>
              <span className="ml-auto text-xs text-slate-500">
                {codeGroup.combos.length} combinations
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 text-xs">ID</th>
                    <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 text-xs">Combination</th>
                    <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 text-xs">Type</th>
                    <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 text-xs">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {codeGroup.combos.map((combo) => (
                    <tr
                      key={combo.id}
                      className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-3 py-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {combo.id}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-slate-900 dark:text-white text-xs">
                        {combo.name}
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            combo.type === "strength"
                              ? "bg-red-500/20 text-red-400"
                              : combo.type === "service"
                                ? "bg-green-500/20 text-green-400"
                                : combo.type === "seismic"
                                  ? "bg-purple-500/20 text-purple-400"
                                  : "bg-cyan-500/20 text-cyan-400"
                          }`}
                        >
                          {combo.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">
                        {combo.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Factor summary */}
      <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">
          Typical Load Factors
        </h4>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <div className="text-slate-500 dark:text-slate-400 mb-1">Dead Load (D/Gk)</div>
            <div className="space-y-0.5 text-slate-600 dark:text-slate-300">
              <div>IS: 1.5 (strength) / 1.0 (service)</div>
              <div>ASCE: 1.2–1.4 (strength)</div>
              <div>EC: 1.35 (unfavourable)</div>
            </div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400 mb-1">Live Load (L/Qk)</div>
            <div className="space-y-0.5 text-slate-600 dark:text-slate-300">
              <div>IS: 1.5 (strength)</div>
              <div>ASCE: 1.6 (strength)</div>
              <div>EC: 1.5 (strength)</div>
            </div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400 mb-1">Wind / Seismic</div>
            <div className="space-y-0.5 text-slate-600 dark:text-slate-300">
              <div>IS: 1.2–1.5 (combined)</div>
              <div>ASCE: 1.0 (W or E)</div>
              <div>EC: 1.5W / 1.0AEd</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

LoadCombosView.displayName = "LoadCombosView";

export default LoadCombosView;
