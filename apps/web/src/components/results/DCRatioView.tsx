/**
 * DCRatioView — Demand/Capacity Ratio, Deflection Limits, Inter-Story Drift
 * Extracted from AnalysisResultsDashboard.tsx
 */

import React from "react";
import { CheckCircle, AlertTriangle } from "lucide-react";
import type { MemberResult, NodeResult } from "./dashboardTypes";
import { formatNumber, getUtilizationStatus, DEFLECTION_LIMITS } from "./dashboardTypes";

interface DCRatioViewProps {
  members: MemberResult[];
  nodes: NodeResult[];
  onMemberSelect: (memberId: string) => void;
}

const DCRatioView: React.FC<DCRatioViewProps> = React.memo(({ members, nodes, onMemberSelect }) => {
  return (
    <div key="dcRatio" className="space-y-6 animate-slideUp">
      {/* Overall summary bar */}
      <div className="grid grid-cols-4 gap-4">
        {(() => {
          const safe = members.filter((m) => m.utilization <= 0.7).length;
          const warn = members.filter((m) => m.utilization > 0.7 && m.utilization <= 0.9).length;
          const crit = members.filter((m) => m.utilization > 0.9 && m.utilization <= 1.0).length;
          const fail = members.filter((m) => m.utilization > 1.0).length;
          return (
            <>
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-400">{safe}</div>
                <div className="text-xs text-[#869ab8]">Safe (&le;70%)</div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-400">{warn}</div>
                <div className="text-xs text-[#869ab8]">Warning (70-90%)</div>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-400">{crit}</div>
                <div className="text-xs text-[#869ab8]">Critical (90-100%)</div>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-400">{fail}</div>
                <div className="text-xs text-[#869ab8]">Failed (&gt;100%)</div>
              </div>
            </>
          );
        })()}
      </div>

      {/* D/C Ratio Table */}
      <div>
        <h3 className="text-sm font-medium tracking-wide text-[#869ab8] uppercase tracking-wide mb-3">
          Demand/Capacity Ratio — All Members
        </h3>
        <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#0b1326]">
              <tr className="border-b border-[#1a2333]">
                <th className="px-3 py-2 text-left text-[#869ab8]">Member</th>
                <th className="px-3 py-2 text-left text-[#869ab8]">Material</th>
                <th className="px-3 py-2 text-left text-[#869ab8]">Length (m)</th>
                <th className="px-3 py-2 text-left text-[#869ab8]">D/C Ratio</th>
                <th className="px-3 py-2 text-left text-[#869ab8]">Stress (MPa)</th>
                <th className="px-3 py-2 text-left text-[#869ab8]">Status</th>
                <th className="px-3 py-2 text-left text-[#869ab8]">Governing</th>
              </tr>
            </thead>
            <tbody>
              {[...members]
                .sort((a, b) => b.utilization - a.utilization)
                .map((m) => {
                  const st = getUtilizationStatus(m.utilization);
                  const governing = (() => {
                    const sp = m.sectionProps;
                    const fy = sp?.fy ?? 250;
                    const A = sp?.A ?? 0.01;
                    const I = sp?.I ?? 1e-4;
                    const c_est = Math.sqrt((12 * I) / A) / 2 || 0.15;
                    const Mcap = fy * (I / c_est) * 1000;
                    const Ncap = fy * A * 1000;
                    const Vcap = 0.6 * fy * A * 1000;
                    const mRatio = Mcap > 0 ? Math.abs(m.maxMoment) / Mcap : 0;
                    const nRatio = Ncap > 0 ? Math.abs(m.maxAxial) / Ncap : 0;
                    const vRatio = Vcap > 0 ? Math.abs(m.maxShear) / Vcap : 0;
                    if (m.materialType === 'concrete') {
                      if (mRatio >= nRatio && mRatio >= vRatio) return "Flexure + Axial (RC)";
                      if (vRatio >= nRatio) return "Shear";
                      return "Bending";
                    }
                    if (mRatio >= nRatio && mRatio >= vRatio) return "Bending";
                    if (vRatio >= nRatio) return "Shear";
                    return "Axial";
                  })();
                  return (
                    <tr
                      key={m.id}
                      onClick={() => onMemberSelect(m.id)}
                      className="border-b border-[#1a2333] hover:bg-slate-200/50 dark:hover:bg-slate-800/50 cursor-pointer"
                    >
                      <td className="px-3 py-1.5 font-medium tracking-wide text-[#dae2fd]">M{m.id}</td>
                      <td className="px-3 py-1.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${m.materialType === 'concrete' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {m.materialType === 'concrete' ? 'RC' : 'Steel'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300">{formatNumber(m.length)}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                st === "safe" ? "bg-green-500" : st === "warning" ? "bg-yellow-500" : st === "critical" ? "bg-orange-500" : "bg-red-500"
                              }`}
                              style={{ width: `${Math.min(m.utilization * 100, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs">{(m.utilization * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300">{formatNumber(m.stress)}</td>
                      <td className="px-3 py-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          st === "safe" ? "bg-green-500/20 text-green-400"
                          : st === "warning" ? "bg-yellow-500/20 text-yellow-400"
                          : st === "critical" ? "bg-orange-500/20 text-orange-400"
                          : "bg-red-500/20 text-red-400"
                        }`}>
                          {st.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-[#869ab8]">{governing}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deflection Limit Checks */}
      <div>
        <h3 className="text-sm font-medium tracking-wide text-[#869ab8] uppercase tracking-wide mb-3">
          Deflection Serviceability Checks
        </h3>
        <div className="space-y-2">
          {DEFLECTION_LIMITS.map((limit) => {
            const violations = members.filter((m) => {
              const allowable = (m.length * 1000) / limit.ratio;
              return m.maxDeflection > allowable;
            });
            const allPass = violations.length === 0;
            return (
              <div
                key={limit.label}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  allPass ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  {allPass ? <CheckCircle className="w-4 h-4 text-green-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
                  <div>
                    <div className="text-sm text-[#dae2fd]">{limit.label}</div>
                    <div className="text-xs text-[#869ab8]">{limit.code}</div>
                  </div>
                </div>
                <div className="text-right">
                  {allPass ? (
                    <span className="text-xs text-green-400 font-medium tracking-wide">ALL PASS</span>
                  ) : (
                    <div>
                      <span className="text-xs text-red-400 font-medium tracking-wide">{violations.length} FAIL</span>
                      <div className="text-[10px] text-slate-500">
                        Worst: M{violations.sort((a, b) => b.maxDeflection - a.maxDeflection)[0]?.id}{" "}
                        ({formatNumber(violations[0]?.maxDeflection ?? 0)} mm &gt;{" "}
                        {formatNumber(((violations[0]?.length ?? 1) * 1000) / limit.ratio)} mm)
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inter-story Drift Check */}
      <div>
        <h3 className="text-sm font-medium tracking-wide text-[#869ab8] uppercase tracking-wide mb-3">
          Inter-Story Drift Check
        </h3>
        {(() => {
          const storyMap = new Map<number, { y: number; nodes: typeof nodes }>();
          nodes.forEach((n) => {
            const roundedY = Math.round(n.y * 10) / 10;
            if (!storyMap.has(roundedY)) storyMap.set(roundedY, { y: roundedY, nodes: [] });
            storyMap.get(roundedY)!.nodes.push(n);
          });
          const stories = [...storyMap.values()].sort((a, b) => a.y - b.y);

          if (stories.length < 2) {
            return (
              <div className="text-sm text-slate-500 p-3 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-[#1a2333]">
                Single-story structure — inter-story drift check not applicable.
              </div>
            );
          }

          const driftResults = stories.slice(1).map((story, idx) => {
            const lowerStory = stories[idx]!;
            const storyHeight = (story.y - lowerStory.y) * 1000;
            const maxDxUpper = story.nodes.length > 0 ? Math.max(...story.nodes.map((n) => Math.abs(n.displacement.dx))) : 0;
            const maxDxLower = lowerStory.nodes.length > 0 ? Math.max(...lowerStory.nodes.map((n) => Math.abs(n.displacement.dx))) : 0;
            const relativeDrift = Math.abs(maxDxUpper - maxDxLower);
            const driftRatio = storyHeight > 0 ? relativeDrift / storyHeight : 0;
            const limitIS = storyHeight / 400;
            const limitASCE = storyHeight / 500;
            return {
              storyLabel: `Level ${idx + 1} → ${idx + 2}`,
              height: storyHeight,
              drift: relativeDrift,
              driftRatio,
              limitIS,
              limitASCE,
              passIS: relativeDrift <= limitIS,
              passASCE: relativeDrift <= limitASCE,
            };
          });

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#0b1326]">
                  <tr className="border-b border-[#1a2333]">
                    <th className="px-3 py-2 text-left text-[#869ab8] text-xs">Story</th>
                    <th className="px-3 py-2 text-left text-[#869ab8] text-xs">Height (mm)</th>
                    <th className="px-3 py-2 text-left text-[#869ab8] text-xs">Drift (mm)</th>
                    <th className="px-3 py-2 text-left text-[#869ab8] text-xs">Δ/H Ratio</th>
                    <th className="px-3 py-2 text-left text-[#869ab8] text-xs">H/400 (IS 1893)</th>
                    <th className="px-3 py-2 text-left text-[#869ab8] text-xs">H/500 (ASCE 7)</th>
                  </tr>
                </thead>
                <tbody>
                  {driftResults.map((dr, i) => (
                    <tr key={i} className="border-b border-[#1a2333] hover:bg-slate-200/50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-1.5 font-medium tracking-wide text-[#dae2fd] text-xs">{dr.storyLabel}</td>
                      <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300 text-xs">{dr.height.toFixed(0)}</td>
                      <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300 text-xs">{dr.drift.toFixed(3)}</td>
                      <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300 text-xs">{dr.driftRatio.toFixed(6)}</td>
                      <td className="px-3 py-1.5 text-xs">
                        <span className={`px-2 py-0.5 rounded ${dr.passIS ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                          {dr.passIS ? "PASS" : "FAIL"} ({dr.drift.toFixed(2)}/{dr.limitIS.toFixed(2)})
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-xs">
                        <span className={`px-2 py-0.5 rounded ${dr.passASCE ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                          {dr.passASCE ? "PASS" : "FAIL"} ({dr.drift.toFixed(2)}/{dr.limitASCE.toFixed(2)})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    </div>
  );
});

DCRatioView.displayName = "DCRatioView";

export default DCRatioView;
