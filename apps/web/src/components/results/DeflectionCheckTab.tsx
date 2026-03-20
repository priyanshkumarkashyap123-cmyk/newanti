/**
 * DeflectionCheckTab — Deflection compliance check (span/depth ratio vs code limit)
 * with L/δ ratio, pass/fail status per member.
 * Extracted from PostProcessingDesignStudio for modularity.
 */

import React, { FC, useState, useMemo } from "react";
import { Ruler, CheckCircle, XCircle } from "lucide-react";
import type { AnalysisResults, Member } from "../../store/model";
import {
  type MemberDesignRow,
  statusColors,
  utilizationColor,
  utilizationTextColor,
} from "./postProcessingTypes";

interface DeflectionCheckTabProps {
  rows: MemberDesignRow[];
  analysisResults: AnalysisResults;
  members: Map<string, Member>;
  nodes: Map<string, { x: number; y: number; z?: number }>;
}

const DeflectionCheckTab: FC<DeflectionCheckTabProps> = ({
  rows,
  analysisResults,
  members,
  nodes,
}) => {
  const [limitRatio, setLimitRatio] = useState(250); // L/250 (IS 800) or L/360 (AISC)

  const deflectionData = useMemo(() => {
    return rows
      .map((row) => {
        const mf = analysisResults.memberForces.get(row.id);
        const member = members.get(row.id);
        if (!mf || !member) return null;

        const dd = mf.diagramData;
        let maxDeflY = 0;
        let maxDeflZ = 0;
        if (dd?.deflection_y) {
          maxDeflY = Math.max(...dd.deflection_y.map(Math.abs));
        }
        if (dd?.deflection_z) {
          maxDeflZ = Math.max(...dd.deflection_z.map(Math.abs));
        }
        const maxDefl = Math.max(maxDeflY, maxDeflZ);
        const len = row.length;
        // Convert to mm (deflection from solver is in m)
        const deflMM = maxDefl * 1000;
        const allowable = (len * 1000) / limitRatio;
        const ratio = allowable > 0 ? deflMM / allowable : 0;

        return {
          ...row,
          deflMM,
          allowableMM: allowable,
          ratio,
          actualSpanRatio: deflMM > 0 ? (len * 1000) / deflMM : Infinity,
          status: ratio <= 1 ? ("PASS" as const) : ("FAIL" as const),
        };
      })
      .filter(Boolean) as Array<
      MemberDesignRow & {
        deflMM: number;
        allowableMM: number;
        ratio: number;
        actualSpanRatio: number;
        status: "PASS" | "FAIL";
      }
    >;
  }, [rows, analysisResults, members, nodes, limitRatio]);

  const passCount = deflectionData.filter((d) => d.status === "PASS").length;
  const failCount = deflectionData.filter((d) => d.status === "FAIL").length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 px-5 py-3 border-b border-slate-300/60 dark:border-slate-700/60 bg-slate-100/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Ruler className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Deflection Compliance
          </span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-[#869ab8]">Limit: L /</label>
          <select
            value={limitRatio}
            onChange={(e) => setLimitRatio(+e.target.value)}
            className="text-sm bg-[#0b1326] border border-[#1a2333] rounded px-2 py-1 text-[#adc6ff]"
          >
            <option value={180}>180 (floor, live)</option>
            <option value={240}>240 (floor, total)</option>
            <option value={250}>250 (IS 800)</option>
            <option value={300}>300 (roof, snow)</option>
            <option value={325}>325 (IS 456)</option>
            <option value={360}>360 (AISC floor)</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-emerald-400">{passCount} Pass</span>
          <span className="text-sm text-red-400">{failCount} Fail</span>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#131b2e] z-10">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[#869ab8] uppercase">
                Member
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-[#869ab8] uppercase">
                Span (m)
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-[#869ab8] uppercase">
                Max Defl (mm)
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-[#869ab8] uppercase">
                Allowable (mm)
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-[#869ab8] uppercase">
                Actual L/δ
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-[#869ab8] uppercase min-w-[140px]">
                Ratio
              </th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-[#869ab8] uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {deflectionData.map((d) => {
              const sc = statusColors[d.status];
              return (
                <tr
                  key={d.id}
                  className="hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <td className="px-3 py-2.5 font-mono text-slate-800 dark:text-slate-200">
                    {d.label}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-[#adc6ff]">
                    {d.length.toFixed(3)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-[#adc6ff]">
                    {d.deflMM.toFixed(3)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-[#adc6ff]">
                    {d.allowableMM.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-[#adc6ff]">
                    {d.actualSpanRatio === Infinity
                      ? "∞"
                      : `L/${d.actualSpanRatio.toFixed(0)}`}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${utilizationColor(d.ratio)}`}
                          style={{ width: `${Math.min(d.ratio * 100, 100)}%` }}
                        />
                      </div>
                      <span
                        className={`text-xs font-bold font-mono w-12 text-right ${utilizationTextColor(d.ratio)}`}
                      >
                        {(d.ratio * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${sc.bg} ${sc.text}`}
                    >
                      {d.status === "PASS" ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {d.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

DeflectionCheckTab.displayName = "DeflectionCheckTab";

export default React.memo(DeflectionCheckTab);
