/**
 * HeatmapView — Stress/Utilization Heat Map
 * Extracted from AnalysisResultsDashboard.tsx
 */

import React from "react";
import type { MemberResult, NodeResult } from "./dashboardTypes";
import { formatNumber, getUtilizationStatus } from "./dashboardTypes";

interface HeatmapViewProps {
  members: MemberResult[];
  nodes: NodeResult[];
  onMemberSelect: (memberId: string) => void;
}

const HeatmapView: React.FC<HeatmapViewProps> = React.memo(({ members, nodes, onMemberSelect }) => {
  return (
    <div key="heatmap" className="space-y-4 animate-slideUp">
      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        Stress / Utilization Heat Map
      </h3>

      {/* Spatial Structure View — SVG wireframe colored by utilization */}
      {(() => {
        const nodeCoords = new Map<string, { x: number; y: number; z: number }>();
        nodes.forEach((n) => nodeCoords.set(n.id, { x: n.x, y: n.y, z: n.z }));
        const hasCoords = [...nodeCoords.values()].some((c) => c.x !== 0 || c.y !== 0 || c.z !== 0);

        if (!hasCoords) return null;

        const allPts = [...nodeCoords.values()];
        const xMin = Math.min(...allPts.map((p) => p.x));
        const xMax = Math.max(...allPts.map((p) => p.x));
        const yMin = Math.min(...allPts.map((p) => p.y));
        const yMax = Math.max(...allPts.map((p) => p.y));
        const zMin = Math.min(...allPts.map((p) => p.z));
        const zMax = Math.max(...allPts.map((p) => p.z));
        const ySpan = yMax - yMin;
        const zSpan = zMax - zMin;
        const useZ = zSpan > ySpan;
        const vMin2 = useZ ? zMin : yMin;
        const vMax2 = useZ ? zMax : yMax;
        const hSpan = Math.max(xMax - xMin, 1e-6);
        const vSpan = Math.max(vMax2 - vMin2, 1e-6);

        const svgW = 600;
        const svgH = Math.max(250, Math.min(400, Math.round(svgW * (vSpan / hSpan))));
        const pad = 40;
        const scale = Math.min((svgW - 2 * pad) / hSpan, (svgH - 2 * pad) / vSpan);
        const ofsX = pad + (svgW - 2 * pad - hSpan * scale) / 2;
        const ofsY = pad + (svgH - 2 * pad - vSpan * scale) / 2;

        const px = (x: number) => ofsX + (x - xMin) * scale;
        const py = (v: number) => svgH - ofsY - (v - vMin2) * scale;

        const utilColor = (u: number) => {
          const hue = Math.max(0, 120 - u * 120);
          return `hsl(${hue}, 85%, 50%)`;
        };

        return (
          <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Structural Layout — Utilization
              </span>
              <span className="text-[10px] text-slate-500">
                {members.length} members, {nodes.length} nodes
              </span>
            </div>
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="w-full rounded bg-white/60 dark:bg-slate-900/60 max-h-[400px]"
            >
              {/* Members as colored lines */}
              {members.map((m) => {
                const sn = nodeCoords.get(m.startNodeId ?? "");
                const en = nodeCoords.get(m.endNodeId ?? "");
                if (!sn || !en) return null;
                const x1 = px(sn.x);
                const y1 = py(useZ ? sn.z : sn.y);
                const x2 = px(en.x);
                const y2 = py(useZ ? en.z : en.y);
                const col = utilColor(m.utilization);
                return (
                  <g key={m.id}>
                    <line
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={col}
                      strokeWidth={Math.max(3, 6 * m.utilization)}
                      strokeLinecap="round"
                      opacity={0.9}
                    />
                    <title>
                      M{m.id}: {(m.utilization * 100).toFixed(1)}% — {m.sectionType || "General"}
                    </title>
                    <text
                      x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6}
                      fill="rgba(255,255,255,0.5)" fontSize="8" textAnchor="middle"
                    >
                      M{m.id}
                    </text>
                  </g>
                );
              })}
              {/* Nodes */}
              {[...nodeCoords.entries()].map(([id, c]) => {
                const cx = px(c.x);
                const cy2 = py(useZ ? c.z : c.y);
                const n = nodes.find((n2) => n2.id === id);
                const isSupport =
                  n?.reaction &&
                  (Math.abs(n.reaction.fx) > 0.01 ||
                    Math.abs(n.reaction.fy) > 0.01 ||
                    Math.abs(n.reaction.fz) > 0.01);
                return (
                  <g key={id}>
                    {isSupport ? (
                      <polygon
                        points={`${cx},${cy2 + 4} ${cx - 6},${cy2 + 12} ${cx + 6},${cy2 + 12}`}
                        fill="rgba(59,130,246,0.5)" stroke="#3B82F6" strokeWidth="1"
                      />
                    ) : null}
                    <circle cx={cx} cy={cy2} r={3.5} fill="#fff" stroke="#3B82F6" strokeWidth="1.5" />
                    <text
                      x={cx} y={cy2 - 7}
                      fill="rgba(255,255,255,0.4)" fontSize="7" textAnchor="middle"
                    >
                      {id}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );
      })()}

      {/* Section-Type Group Summary */}
      {(() => {
        const groups = new Map<string, { count: number; maxUtil: number; avgUtil: number; maxStress: number }>();
        members.forEach((m) => {
          const sType = m.sectionType || "General";
          const prev = groups.get(sType) || { count: 0, maxUtil: 0, avgUtil: 0, maxStress: 0 };
          groups.set(sType, {
            count: prev.count + 1,
            maxUtil: Math.max(prev.maxUtil, m.utilization),
            avgUtil: (prev.avgUtil * prev.count + m.utilization) / (prev.count + 1),
            maxStress: Math.max(prev.maxStress, m.stress),
          });
        });
        if (groups.size <= 1) return null;
        return (
          <div className="grid grid-cols-3 gap-3 mb-2">
            {[...groups.entries()]
              .sort((a, b) => b[1].maxUtil - a[1].maxUtil)
              .map(([sType, g]) => {
                const st = getUtilizationStatus(g.maxUtil);
                return (
                  <div
                    key={sType}
                    className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-900 dark:text-white">{sType}</span>
                      <span className="text-[10px] text-slate-500">{g.count} members</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-white dark:bg-slate-900 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            st === "safe" ? "bg-green-500"
                            : st === "warning" ? "bg-yellow-500"
                            : st === "critical" ? "bg-orange-500"
                            : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(g.maxUtil * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                        {(g.maxUtil * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Avg: {(g.avgUtil * 100).toFixed(0)}% | Max σ: {formatNumber(g.maxStress)} MPa
                    </div>
                  </div>
                );
              })}
          </div>
        );
      })()}

      {/* Color legend */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-slate-500 dark:text-slate-400">Low</span>
        <div className="flex-1 h-3 rounded-full bg-[linear-gradient(to_right,#22d3ee,#22c55e,#eab308,#f97316,#ef4444)]" />
        <span className="text-slate-500 dark:text-slate-400">High</span>
      </div>

      {/* Member bars sorted by utilization */}
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-2">
        {[...members]
          .sort((a, b) => b.utilization - a.utilization)
          .map((m) => {
            const pct = (Math.min(m.utilization, 1.5) / 1.5) * 100;
            const hue = Math.max(0, 120 - m.utilization * 120);
            const status = getUtilizationStatus(m.utilization);
            return (
              <div
                key={m.id}
                onClick={() => onMemberSelect(m.id)}
                className="flex items-center gap-3 p-2 rounded-lg bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <span className="text-xs font-medium text-slate-900 dark:text-white w-12">M{m.id}</span>
                <div className="flex-1 h-4 bg-white dark:bg-slate-900 rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: `hsl(${hue}, 85%, 50%)` }}
                  />
                </div>
                <span
                  className={`text-xs font-mono w-14 text-right ${
                    status === "safe" ? "text-green-400"
                    : status === "warning" ? "text-yellow-400"
                    : status === "critical" ? "text-orange-400"
                    : "text-red-400"
                  }`}
                >
                  {(m.utilization * 100).toFixed(1)}%
                </span>
                <span className="text-xs text-slate-500 w-20 text-right">
                  {formatNumber(m.stress)} MPa
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
});

HeatmapView.displayName = "HeatmapView";

export default HeatmapView;
