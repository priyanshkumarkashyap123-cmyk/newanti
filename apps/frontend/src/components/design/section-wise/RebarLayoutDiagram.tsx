/**
 * RebarLayoutDiagram.tsx
 *
 * Elevation view with rebar zones, curtailment points, Ld annotations, stirrup spacing.
 * For RC: bar zones + curtailment. For steel: stiffener locations.
 */

import { FC, useState, useMemo } from 'react';
import type { SectionWiseResult, SteelSectionWiseResult } from '@/api/design';

interface Props {
  rcResult?: SectionWiseResult;
  steelResult?: SteelSectionWiseResult;
  spanMm: number;
  /** Beam depth mm */
  depthMm?: number;
  width?: number;
  height?: number;
}

export const RebarLayoutDiagram: FC<Props> = ({
  rcResult,
  steelResult,
  spanMm,
  depthMm = 500,
  width = 600,
  height = 200,
}) => {
  const [hoveredZone, setHoveredZone] = useState<number | null>(null);

  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const xScale = (mm: number) => pad.left + (mm / spanMm) * plotW;
  const beamTop = pad.top + 10;
  const beamH = plotH - 20;

  if (rcResult) {
    return (
      <svg width={width} height={height} className="font-mono text-xs">
        {/* Beam outline */}
        <rect x={pad.left} y={beamTop} width={plotW} height={beamH}
          fill="#f8fafc" stroke="#64748b" strokeWidth={1.5} rx={2} />

        {/* Rebar zones */}
        {rcResult.rebar_zones.map((zone, i) => {
          const fallbackStart = (i / rcResult.rebar_zones.length) * spanMm;
          const fallbackEnd = ((i + 1) / rcResult.rebar_zones.length) * spanMm;
          const xStartMm = Number.isFinite(zone.x_start) ? zone.x_start : fallbackStart;
          const xEndMm = Number.isFinite(zone.x_end) ? zone.x_end : fallbackEnd;

          const x1 = xScale(Math.max(0, Math.min(spanMm, xStartMm)));
          const x2 = xScale(Math.max(0, Math.min(spanMm, xEndMm)));
          const isBottom = !zone.note?.toLowerCase().includes('top');
          const barY = isBottom ? beamTop + beamH - 8 : beamTop + 8;

          return (
            <g key={i}
              onMouseEnter={() => setHoveredZone(i)}
              onMouseLeave={() => setHoveredZone(null)}
              className="cursor-pointer"
            >
              {/* Zone background */}
              <rect x={x1} y={beamTop + 1} width={Math.max(x2 - x1, 2)} height={beamH - 2}
                fill={hoveredZone === i ? 'rgba(99,102,241,0.12)' : 'transparent'} />
              {/* Bar line */}
              <line x1={x1 + 2} y1={barY} x2={x2 - 2} y2={barY}
                stroke={isBottom ? '#dc2626' : '#2563eb'} strokeWidth={3}
                strokeLinecap="round" />
              {/* Label */}
              <text x={(x1 + x2) / 2} y={barY + (isBottom ? 12 : -6)}
                textAnchor="middle" className="fill-slate-600 text-[8px]">
                {zone.Ast_bottom?.toFixed(0) ?? zone.stirrup_spec ?? ''}mm²
              </text>
            </g>
          );
        })}

        {/* Curtailment points */}
        {rcResult.curtailment_points.map((cp, i) => {
          const cx = xScale(cp.x);
          return (
            <g key={`cp-${i}`}>
              <line x1={cx} y1={beamTop - 4} x2={cx} y2={beamTop + beamH + 4}
                stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 2" />
              <circle cx={cx} cy={beamTop + beamH + 8} r={3}
                fill={cp.is_valid ? '#22c55e' : '#ef4444'} />
              <text x={cx} y={beamTop + beamH + 20} textAnchor="middle"
                className="fill-slate-500 text-[7px]">
                Ld={cp.Ld_required.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Stirrup spacing indicators (simplified) */}
        {rcResult.section_checks.filter((_, i) => i % 4 === 0).map((sc, i) => {
          const cx = xScale(sc.x_ratio * spanMm);
          return (
            <g key={`st-${i}`}>
              <line x1={cx} y1={beamTop + 2} x2={cx} y2={beamTop + beamH - 2}
                stroke="#94a3b8" strokeWidth={0.5} />
              <text x={cx} y={beamTop - 2} textAnchor="middle"
                className="fill-slate-400 text-[7px]">
                @{sc.stirrup_spacing.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Span dimension */}
        <line x1={pad.left} y1={height - 10} x2={pad.left + plotW} y2={height - 10}
          stroke="#94a3b8" strokeWidth={0.5} markerEnd="url(#arrowhead)" />
        <text x={pad.left + plotW / 2} y={height - 2} textAnchor="middle"
          className="fill-slate-500 text-[9px]">
          L = {(spanMm / 1000).toFixed(2)} m
        </text>

        {/* Legend */}
        <line x1={pad.left + 2} y1={8} x2={pad.left + 18} y2={8}
          stroke="#dc2626" strokeWidth={3} strokeLinecap="round" />
        <text x={pad.left + 22} y={11} className="fill-slate-600 text-[8px]">Bottom steel</text>
        <line x1={pad.left + 90} y1={8} x2={pad.left + 106} y2={8}
          stroke="#2563eb" strokeWidth={3} strokeLinecap="round" />
        <text x={pad.left + 110} y={11} className="fill-slate-600 text-[8px]">Top steel</text>
      </svg>
    );
  }

  // Steel variant: show stiffener locations
  if (steelResult) {
    const checks = steelResult.section_checks;
    const highShearStations = checks.filter(s => s.utilization_v > 0.6);

    return (
      <svg width={width} height={height} className="font-mono text-xs">
        {/* I-beam profile (simplified) */}
        <rect x={pad.left} y={beamTop} width={plotW} height={4}
          fill="#94a3b8" /> {/* top flange */}
        <rect x={pad.left} y={beamTop + beamH - 4} width={plotW} height={4}
          fill="#94a3b8" /> {/* bottom flange */}
        <rect x={pad.left} y={beamTop + 4} width={plotW} height={beamH - 8}
          fill="#e2e8f0" stroke="#94a3b8" strokeWidth={0.5} /> {/* web */}

        {/* Station utilization bars */}
        {checks.map((s, i) => {
          const cx = xScale(s.location.x_ratio * spanMm);
          const gov = Math.max(s.utilization_m, s.utilization_v);
          const barH = gov * (beamH - 16);
          const color = gov > 1 ? '#ef4444'
            : gov > 0.8 ? '#f59e0b' : '#22c55e';
          return (
            <rect key={i}
              x={cx - 3} y={beamTop + 8 + (beamH - 16 - barH)}
              width={6} height={barH}
              fill={color} opacity={0.5} rx={1} />
          );
        })}

        {/* Stiffener zones (high shear) */}
        {highShearStations.map((s, i) => {
          const cx = xScale(s.location.x_ratio * spanMm);
          return (
            <g key={`stiff-${i}`}>
              <line x1={cx} y1={beamTop} x2={cx} y2={beamTop + beamH}
                stroke="#7c3aed" strokeWidth={2} />
              <text x={cx} y={beamTop - 4} textAnchor="middle"
                className="fill-purple-600 text-[7px]">▲</text>
            </g>
          );
        })}

        {/* Span dimension */}
        <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle"
          className="fill-slate-500 text-[9px]">
          L = {(spanMm / 1000).toFixed(2)} m
        </text>
      </svg>
    );
  }

  return null;
};
