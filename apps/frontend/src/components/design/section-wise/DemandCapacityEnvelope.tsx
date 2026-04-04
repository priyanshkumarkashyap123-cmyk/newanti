/**
 * DemandCapacityEnvelope.tsx
 *
 * SVG overlay: Mu_demand(x) vs Mu_capacity(x), green/red regions, hover detail.
 * Works for both RC (SectionWiseResult) and Steel (SteelSectionWiseResult).
 */

import { FC, useState, useMemo } from 'react';
import type { SectionWiseResult, SteelSectionWiseResult } from '@/api/design';

interface StationData {
  x_ratio: number;
  x_mm: number;
  mu_demand: number;
  mu_capacity: number;
  vu_demand: number;
  vu_capacity: number;
  utilization_m: number;
  utilization_v: number;
  status: string;
}

interface Props {
  /** RC section-wise result */
  rcResult?: SectionWiseResult;
  /** Steel section-wise result */
  steelResult?: SteelSectionWiseResult;
  /** Span in mm */
  spanMm: number;
  /** Show shear envelope as well */
  showShear?: boolean;
  /** Chart width px */
  width?: number;
  /** Chart height px */
  height?: number;
}

export const DemandCapacityEnvelope: FC<Props> = ({
  rcResult,
  steelResult,
  spanMm,
  showShear = false,
  width = 600,
  height = 300,
}) => {
  const [hovered, setHovered] = useState<number | null>(null);

  const stations: StationData[] = useMemo(() => {
    if (steelResult) {
      return steelResult.section_checks.map(s => ({
        x_ratio: s.location.x_ratio,
        x_mm: s.location.x_mm,
        mu_demand: Math.abs(s.mu_demand_knm),
        mu_capacity: s.md_knm,
        vu_demand: s.vu_demand_kn,
        vu_capacity: s.vd_kn,
        utilization_m: s.utilization_m,
        utilization_v: s.utilization_v,
        status: s.passed ? 'SAFE' : 'FAIL',
      }));
    }
    if (rcResult) {
      return rcResult.section_checks.map(s => ({
        x_ratio: s.x_ratio,
        x_mm: s.x_ratio * spanMm,
        mu_demand: Math.abs(s.utilization_M * s.Mu_capacity),
        mu_capacity: s.Mu_capacity,
        vu_demand: Math.abs(s.utilization_V * s.Vu_capacity),
        vu_capacity: s.Vu_capacity,
        utilization_m: s.utilization_M,
        utilization_v: s.utilization_V,
        status: s.status,
      }));
    }
    return [];
  }, [rcResult, steelResult, spanMm]);

  if (stations.length === 0) return null;

  const pad = { top: 30, right: 20, bottom: 40, left: 60 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxCapacity = Math.max(...stations.map(s => s.mu_capacity), 1);
  const maxDemand = Math.max(...stations.map(s => s.mu_demand), 1);
  const yMax = Math.max(maxCapacity, maxDemand) * 1.1;

  const xScale = (ratio: number) => pad.left + ratio * plotW;
  const yScale = (val: number) => pad.top + plotH - (val / yMax) * plotH;

  const capacityPath = stations.map((s, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(s.x_ratio).toFixed(1)} ${yScale(s.mu_capacity).toFixed(1)}`
  ).join(' ');

  const demandPath = stations.map((s, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(s.x_ratio).toFixed(1)} ${yScale(s.mu_demand).toFixed(1)}`
  ).join(' ');

  return (
    <div className="relative">
      <svg width={width} height={height} className="font-mono text-xs">
        {/* Axes */}
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH}
          stroke="currentColor" className="text-slate-400" strokeWidth={1} />
        <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH}
          stroke="currentColor" className="text-slate-400" strokeWidth={1} />

        {/* Y-axis label */}
        <text x={12} y={pad.top + plotH / 2} textAnchor="middle"
          transform={`rotate(-90 12 ${pad.top + plotH / 2})`}
          className="fill-slate-500 text-[10px]">
          Moment (kN·m)
        </text>

        {/* X-axis label */}
        <text x={pad.left + plotW / 2} y={height - 6} textAnchor="middle"
          className="fill-slate-500 text-[10px]">
          Span position (x/L)
        </text>

        {/* Y ticks */}
        {[0, 0.25, 0.5, 0.75, 1.0].map(frac => {
          const val = yMax * frac;
          const y = yScale(val);
          return (
            <g key={frac}>
              <line x1={pad.left - 4} y1={y} x2={pad.left} y2={y}
                stroke="currentColor" className="text-slate-400" />
              <text x={pad.left - 8} y={y + 3} textAnchor="end"
                className="fill-slate-500 text-[9px]">
                {val.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Capacity curve */}
        <path d={capacityPath} fill="none" stroke="#22c55e" strokeWidth={2} strokeDasharray="6 3" />
        {/* Demand curve */}
        <path d={demandPath} fill="none" stroke="#ef4444" strokeWidth={2} />

        {/* Regions: red where demand > capacity */}
        {stations.map((s, i) => {
          if (i === 0) return null;
          const prev = stations[i - 1];
          const overPrev = prev.mu_demand > prev.mu_capacity;
          const overCurr = s.mu_demand > s.mu_capacity;
          if (!overPrev && !overCurr) return null;
          return (
            <rect key={i}
              x={xScale(prev.x_ratio)}
              y={pad.top}
              width={xScale(s.x_ratio) - xScale(prev.x_ratio)}
              height={plotH}
              fill="rgba(239,68,68,0.08)"
            />
          );
        })}

        {/* Station markers */}
        {stations.map((s, i) => (
          <circle key={i}
            cx={xScale(s.x_ratio)} cy={yScale(s.mu_demand)}
            r={hovered === i ? 5 : 3}
            fill={s.utilization_m > 1 ? '#ef4444' : '#3b82f6'}
            className="cursor-pointer"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}

        {/* Hover tooltip */}
        {hovered !== null && (() => {
          const s = stations[hovered];
          const tx = xScale(s.x_ratio);
          const ty = yScale(s.mu_demand) - 14;
          return (
            <g>
              <rect x={tx - 70} y={ty - 40} width={140} height={48} rx={4}
                fill="white" stroke="#94a3b8" strokeWidth={0.5}
                className="drop-shadow-sm" />
              <text x={tx} y={ty - 24} textAnchor="middle" className="fill-slate-700 text-[9px] font-medium tracking-wide">
                x/L = {s.x_ratio.toFixed(2)} ({(s.x_mm / 1000).toFixed(2)} m)
              </text>
              <text x={tx} y={ty - 12} textAnchor="middle" className="fill-red-600 text-[9px]">
                Demand: {s.mu_demand.toFixed(1)} kN·m
              </text>
              <text x={tx} y={ty} textAnchor="middle" className="fill-green-600 text-[9px]">
                Capacity: {s.mu_capacity.toFixed(1)} kN·m (UR: {(s.utilization_m * 100).toFixed(0)}%)
              </text>
            </g>
          );
        })()}

        {/* Legend */}
        <line x1={pad.left + 10} y1={14} x2={pad.left + 30} y2={14}
          stroke="#ef4444" strokeWidth={2} />
        <text x={pad.left + 34} y={18} className="fill-slate-600 text-[9px]">Demand</text>
        <line x1={pad.left + 80} y1={14} x2={pad.left + 100} y2={14}
          stroke="#22c55e" strokeWidth={2} strokeDasharray="6 3" />
        <text x={pad.left + 104} y={18} className="fill-slate-600 text-[9px]">Capacity</text>
      </svg>
    </div>
  );
};
