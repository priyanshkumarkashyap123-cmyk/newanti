/**
 * SteelDesignTab — Steel member design with AISC 360 / IS 800 checks,
 * utilization bars, and recommendations.
 * Extracted from PostProcessingDesignStudio for modularity.
 */

import React, { FC, useMemo } from "react";
import { Columns3, CheckCircle, AlertTriangle } from "lucide-react";
import {
  type MemberDesignRow,
  statusColors,
  utilizationColor,
  utilizationTextColor,
  fmtForce,
} from "./postProcessingTypes";

interface SteelDesignTabProps {
  rows: MemberDesignRow[];
  selectedId: string | null;
  onSelectMember: (id: string) => void;
}

const SteelDesignTab: FC<SteelDesignTabProps> = ({
  rows,
  selectedId,
  onSelectMember,
}) => {
  const steelRows = useMemo(
    () =>
      rows.filter(
        (r) => r.materialType === "steel" || r.materialType === "custom",
      ),
    [rows],
  );
  const activeMember =
    steelRows.find((r) => r.id === selectedId) ?? steelRows[0];

  if (steelRows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <div className="text-center space-y-2">
          <Columns3 className="w-12 h-12 mx-auto opacity-30" />
          <p>No steel members found in the model.</p>
          <p className="text-xs">
            Assign steel material type to members to use steel design.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Member Sidebar */}
      <div className="w-56 border-r border-slate-300/60 dark:border-slate-700/60 bg-slate-100/40 dark:bg-slate-800/40 flex flex-col">
        <div className="px-3 py-2 border-b border-slate-300/40 dark:border-slate-700/40 text-xs font-semibold text-[#869ab8] uppercase tracking-wider">
          Steel Members ({steelRows.length})
        </div>
        <div className="flex-1 overflow-auto">
          {steelRows.map((r) => {
            const sc = statusColors[r.status];
            return (
              <button type="button"
                key={r.id}
                onClick={() => onSelectMember(r.id)}
                className={`w-full text-left px-3 py-2 text-sm border-b border-slate-200/60 dark:border-slate-800/60 transition-colors ${
                  r.id === activeMember?.id
                    ? "bg-blue-900/30 text-blue-300 border-l-2 border-l-blue-400"
                    : "text-[#adc6ff] hover:bg-slate-200/40 dark:hover:bg-slate-700/40 border-l-2 border-l-transparent"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-medium tracking-wide tracking-wide truncate">{r.label}</span>
                  <span className={`text-xs font-bold ${sc.text}`}>
                    {(r.utilization * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${utilizationColor(r.utilization)}`}
                    style={{ width: `${Math.min(r.utilization * 100, 100)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Design Detail */}
      <div className="flex-1 overflow-auto p-5 space-y-5">
        {activeMember && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Steel Design — Member {activeMember.label}
                </h3>
                <p className="text-xs text-[#869ab8]">
                  L = {activeMember.length.toFixed(2)} m •{" "}
                  {activeMember.sectionType}
                </p>
              </div>
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${statusColors[activeMember.status].bg}`}
              >
                {activeMember.status === "PASS" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}
                <span
                  className={`font-bold text-sm ${statusColors[activeMember.status].text}`}
                >
                  {activeMember.status} —{" "}
                  {(activeMember.utilization * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Forces */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Pu (Axial)",
                  value: activeMember.maxAxial,
                  color:
                    activeMember.maxAxial > 0
                      ? "text-green-400"
                      : "text-red-400",
                },
                {
                  label: "Vu (Shear)",
                  value: activeMember.maxShearY,
                  color: "text-blue-400",
                },
                {
                  label: "Mu (Moment)",
                  value: activeMember.maxMomentZ,
                  color: "text-purple-400",
                },
              ].map((f) => (
                <div
                  key={f.label}
                  className="bg-slate-100/60 dark:bg-slate-800/60 rounded-xl p-3 text-center border border-slate-300/40 dark:border-slate-700/40"
                >
                  <div className="text-xs text-slate-500">{f.label}</div>
                  <div className={`text-xl font-bold font-mono ${f.color}`}>
                    {fmtForce(f.value)}
                  </div>
                  <div className="text-xs text-slate-500">
                    kN{f.label.includes("Moment") ? "·m" : ""}
                  </div>
                </div>
              ))}
            </div>

            {/* Design Checks */}
            <div className="bg-slate-100/60 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-300/40 dark:border-slate-700/40">
              <h4 className="text-xs font-semibold text-[#869ab8] uppercase tracking-wider mb-3">
                Design Checks {activeMember.designCode ? `— ${activeMember.designCode === 'IS800' ? 'IS 800:2007' : activeMember.designCode === 'AISC360' ? 'AISC 360-16' : activeMember.designCode}` : ''}
              </h4>
              <div className="space-y-2">
                {activeMember.designResult.checks.map((check, i) => {
                  const sc = statusColors[check.status];
                  return (
                    <div
                      key={i}
                      className="bg-[#0b1326] rounded-lg p-3 border-l-[3px]"
                      style={{
                        borderLeftColor:
                          check.status === "PASS"
                            ? "#10b981"
                            : check.status === "FAIL"
                              ? "#ef4444"
                              : "#f59e0b",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium tracking-wide tracking-wide text-slate-800 dark:text-slate-200">
                            {check.name}
                          </span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${sc.bg} ${sc.text} font-semibold`}
                          >
                            {check.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-28 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${utilizationColor(check.utilization)}`}
                              style={{
                                width: `${Math.min(check.utilization * 100, 100)}%`,
                              }}
                            />
                          </div>
                          <span
                            className={`text-xs font-bold font-mono w-12 text-right ${utilizationTextColor(check.utilization)}`}
                          >
                            {(check.utilization * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {check.description}
                      </div>
                      {check.formula && (
                        <div className="text-xs text-slate-600 mt-0.5 font-mono">
                          {check.formula}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* IS 800:2007 Checks — shown when Python backend provides IS 800 results */}
            {activeMember.is800Result && (
              <div className="bg-amber-900/10 border border-amber-500/30 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">
                  IS 800:2007 Checks
                </h4>
                <div className="space-y-2">
                  {activeMember.is800Result.checks.map((check, i) => {
                    const sc = statusColors[check.status];
                    return (
                      <div key={i} className="bg-[#0b1326] rounded-lg p-3 border-l-[3px]"
                        style={{ borderLeftColor: check.status === 'PASS' ? '#10b981' : check.status === 'FAIL' ? '#ef4444' : '#f59e0b' }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium tracking-wide tracking-wide text-slate-800 dark:text-slate-200">{check.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${sc.bg} ${sc.text} font-semibold`}>{check.status}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-28 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${utilizationColor(check.utilization)}`}
                                style={{ width: `${Math.min(check.utilization * 100, 100)}%` }} />
                            </div>
                            <span className={`text-xs font-bold font-mono w-12 text-right ${utilizationTextColor(check.utilization)}`}>
                              {(check.utilization * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        {check.description && <div className="text-xs text-slate-500 mt-1">{check.description}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {activeMember.designResult.recommendations &&
              activeMember.designResult.recommendations.length > 0 && (
                <div className="bg-blue-900/15 border border-blue-500/30 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">
                    Recommendations
                  </h4>
                  <ul className="text-sm text-[#adc6ff] space-y-1">
                    {activeMember.designResult.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-blue-400 mt-0.5">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
};

SteelDesignTab.displayName = "SteelDesignTab";

export default React.memo(SteelDesignTab);
