/**
 * UtilizationProfile.tsx
 *
 * UR_moment(x) + UR_shear(x) line chart with 1.0 threshold, color zones, economy indicator.
 * Works for both RC and Steel section-wise results.
 */

import { FC, useState, useMemo } from 'react';
import type { SectionWiseResult, SteelSectionWiseResult } from '@/api/design';

interface StationUR {
  x_ratio: number;
  x_mm: number;
  ur_m: number;
  ur_v: number;
  status: string;
}

interface Props {
  rcResult?: SectionWiseResult;
  steelResult?: SteelSectionWiseResult;
  spanMm: number;
  width?: number;
  height?: number;
}

export const UtilizationProfile: FC<Props> = ({
  rcResult,
  steelResult,
  spanMm,
  width = 600,
  height = 250,
}) => {
  const [hovered, setHovered] = useState<number | null>(null);

  const stations: StationUR[] = useMemo(() => {
    if (steelResult) {
      return steelResult.section_checks.map(s => ({
        x_ratio: s.location.x_ratio,
        x_mm: s.location.x_mm,
        ur_m: s.utilization_m,
        ur_v: s.utilization_v,
        status: s.passed ? 'SAFE' : 'FAIL',
      }));
    }
    if (rcResult) {
      return rcResult.section_checks.map(s => ({
        x_ratio: s.x_ratio,
        x_mm: s.x_ratio * spanMm,
        ur_m: s.utilization_M,
        ur_v: s.utilization_V,
        status: s.status,
      }));
    }
    return [];
  }, [rcResult, steelResult, spanMm]);

  if (stations.length === 0) return null;

  const pad = { top: 24, right: 20, bottom: 36, left: 50 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxUR = Math.max(1.2, ...stations.map(s => Math.max(s.ur_m, s.ur_v))) * 1.05;

  const xScale = (ratio: number) => pad.left + ratio * plotW;
  const yScale = (ur: number) => pad.top + plotH - (ur / maxUR) * plotH;

  const momentPath = stations.map((s, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(s.x_ratio).toFixed(1)} ${yScale(s.ur_m).toFixed(1)}`
  ).join(' ');

  const shearPath = stations.map((s, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(s.x_ratio).toFixed(1)} ${yScale(s.ur_v).toFixed(1)}`
  ).join(' ');

  const maxMomentUR = Math.max(...stations.map(s => s.ur_m));
  const avgMomentUR = stations.reduce((sum, s) => sum + s.ur_m, 0) / stations.length;
  const economy = avgMomentUR > 0 ? maxMomentUR / avgMomentUR : 1;

  return (
    <div className="relative">
      {/* Economy badge */}
      <div className="absolute top-1 right-4 text-[10px] text-slate-500 font-mono">
        Economy ratio: <span className="font-semibold text-indigo-600">{economy.toFixed(2)}</span>
        {economy > 2.5 && <span className="ml-1 text-amber-500">(consider curtailment)</span>}
      </div>

      <svg width={width} height={height} className="font-mono text-xs">
        {/* 1.0 threshold line */}
        <line
          x1={pad.left} y1={yScale(1.0)} x2={pad.left + plotW} y2={yScale(1.0)}
          stroke="#ef4444" strokeWidth={1} strokeDasharray="4 2"
        />
        <text x={pad.left - 6} y={yScale(1.0) + 3} textAnchor="end"
          className="fill-red-500 text-[9px] font-semibold">1.0</text>

        {/* Danger zone above 1.0 */}
        <rect x={pad.left} y={pad.top} width={plotW}
          height={Math.max(0, yScale(1.0) - pad.top)}
          fill="rgba(239,68,68,0.04)" />

        {/* Axes */}
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH}
          stroke="currentColor" className="text-slate-400" strokeWidth={1} />
        <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH}
          stroke="currentColor" className="text-slate-400" strokeWidth={1} />

        {/* Y-axis label */}
        <text x={10} y={pad.top + plotH / 2} textAnchor="middle"
          transform={`rotate(-90 10 ${pad.top + plotH / 2})`}
          className="fill-slate-500 text-[10px]">
          Utilization Ratio
        </text>

        {/* X-axis label */}
        <text x={pad.left + plotW / 2} y={height - 6} textAnchor="middle"
          className="fill-slate-500 text-[10px]">
          x / L
        </text>

        {/* Y ticks */}
        {[0, 0.25, 0.5, 0.75].map(frac => {
          const val = maxUR * frac;
          const y = yScale(val);
          return (
            <g key={frac}>
              <line x1={pad.left - 3} y1={y} x2={pad.left} y2={y}
                stroke="currentColor" className="text-slate-300" />
              <text x={pad.left - 6} y={y + 3} textAnchor="end"
                className="fill-slate-500 text-[9px]">
                {val.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Shear UR curve */}
        <path d={shearPath} fill="none" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" />
        {/* Moment UR curve */}
        <path d={momentPath} fill="none" stroke="#f97316" strokeWidth={2} />

        {/* Station dots */}
        {stations.map((s, i) => {
          const gov = Math.max(s.ur_m, s.ur_v);
          return (
            <circle key={i}
              cx={xScale(s.x_ratio)} cy={yScale(gov)}
              r={hovered === i ? 5 : 2.5}
              fill={gov > 1 ? '#ef4444' : gov > 0.8 ? '#f59e0b' : '#22c55e'}
              className="cursor-pointer"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}

        {/* Hover */}
        {hovered !== null && (() => {
          const s = stations[hovered];
          const tx = Math.min(xScale(s.x_ratio), width - 90);
          const ty = yScale(Math.max(s.ur_m, s.ur_v)) - 10;
          return (
            <g>
              <rect x={tx - 55} y={ty - 36} width={110} height={40} rx={4}
                fill="white" stroke="#94a3b8" strokeWidth={0.5} />
              <text x={tx} y={ty - 20} textAnchor="middle" className="fill-slate-700 text-[9px]">
                x/L = {s.x_ratio.toFixed(2)}
              </text>
              <text x={tx} y={ty - 10} textAnchor="middle" className="fill-orange-600 text-[9px]">
                UR(M) = {(s.ur_m * 100).toFixed(0)}%
              </text>
              <text x={tx} y={ty} textAnchor="middle" className="fill-blue-600 text-[9px]">
                UR(V) = {(s.ur_v * 100).toFixed(0)}%
              </text>
            </g>
          );
        })()}

        {/* Legend */}
        <line x1={pad.left + 10} y1={12} x2={pad.left + 26} y2={12}
          stroke="#f97316" strokeWidth={2} />
        <text x={pad.left + 30} y={15} className="fill-slate-600 text-[9px]">Moment</text>
        <line x1={pad.left + 80} y1={12} x2={pad.left + 96} y2={12}
          stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" />
        <text x={pad.left + 100} y={15} className="fill-slate-600 text-[9px]">Shear</text>
      </svg>
    </div>
  );
};
