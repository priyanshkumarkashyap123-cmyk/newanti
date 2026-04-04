/**
 * ParetoScatterPlot — SVG scatter plot for Pareto front visualization
 * Feature: space-planning-accuracy-and-tools
 * Requirements: 6.2, 6.3, 6.5
 */
import React from 'react';
import type { ParetoPoint } from '../../pages/SensitivityOptimizationDashboard';

interface ParetoScatterPlotProps {
  points: ParetoPoint[];
  xAxis: 'weight' | 'displacement' | 'cost' | 'stiffness';
  yAxis: 'weight' | 'displacement' | 'cost' | 'stiffness';
  selectedPointId: string | null;
  onPointClick: (pointId: string) => void;
  width?: number;
  height?: number;
}

const AXIS_UNITS: Record<string, string> = {
  weight: 'kg',
  displacement: 'mm',
  cost: 'index',
  stiffness: 'kN/mm',
};

export const ParetoScatterPlot: React.FC<ParetoScatterPlotProps> = ({
  points,
  xAxis,
  yAxis,
  selectedPointId,
  onPointClick,
  width = 400,
  height = 300,
}) => {
  const margin = { top: 20, right: 20, bottom: 50, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  if (points.length === 0) {
    return (
      <svg width={width} height={height} aria-label="Pareto scatter plot — no data">
        <text x={width / 2} y={height / 2} textAnchor="middle" fill="#94a3b8" fontSize={12}>
          No feasible solutions — try relaxing constraints
        </text>
      </svg>
    );
  }

  const xVals = points.map(p => p[xAxis]);
  const yVals = points.map(p => p[yAxis]);
  const xMin = Math.min(...xVals);
  const xMax = Math.max(...xVals);
  const yMin = Math.min(...yVals);
  const yMax = Math.max(...yVals);

  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  const toSvgX = (v: number) => ((v - xMin) / xRange) * innerWidth;
  const toSvgY = (v: number) => innerHeight - ((v - yMin) / yRange) * innerHeight;

  // Axis ticks (5 ticks)
  const xTicks = Array.from({ length: 5 }, (_, i) => xMin + (i / 4) * xRange);
  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (i / 4) * yRange);

  return (
    <svg
      width={width}
      height={height}
      aria-label={`Pareto scatter plot: ${xAxis} vs ${yAxis}`}
      style={{ overflow: 'visible' }}
    >
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* Grid lines */}
        {xTicks.map((t, i) => (
          <line key={`xg${i}`} x1={toSvgX(t)} y1={0} x2={toSvgX(t)} y2={innerHeight}
            stroke="#334155" strokeWidth={0.5} strokeDasharray="4,4" />
        ))}
        {yTicks.map((t, i) => (
          <line key={`yg${i}`} x1={0} y1={toSvgY(t)} x2={innerWidth} y2={toSvgY(t)}
            stroke="#334155" strokeWidth={0.5} strokeDasharray="4,4" />
        ))}

        {/* Axes */}
        <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="#64748b" strokeWidth={1} />
        <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="#64748b" strokeWidth={1} />

        {/* X axis ticks and labels */}
        {xTicks.map((t, i) => (
          <g key={`xt${i}`} transform={`translate(${toSvgX(t)},${innerHeight})`}>
            <line y2={4} stroke="#64748b" />
            <text y={16} textAnchor="middle" fill="#94a3b8" fontSize={9}>
              {t.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Y axis ticks and labels */}
        {yTicks.map((t, i) => (
          <g key={`yt${i}`} transform={`translate(0,${toSvgY(t)})`}>
            <line x2={-4} stroke="#64748b" />
            <text x={-8} textAnchor="end" dominantBaseline="middle" fill="#94a3b8" fontSize={9}>
              {t.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Axis labels */}
        <text x={innerWidth / 2} y={innerHeight + 38} textAnchor="middle" fill="#94a3b8" fontSize={11}>
          {xAxis} ({AXIS_UNITS[xAxis]})
        </text>
        <text
          x={-innerHeight / 2} y={-44} textAnchor="middle" fill="#94a3b8" fontSize={11}
          transform="rotate(-90)"
        >
          {yAxis} ({AXIS_UNITS[yAxis]})
        </text>

        {/* Points */}
        {points.map((p) => {
          const cx = toSvgX(p[xAxis]);
          const cy = toSvgY(p[yAxis]);
          const isSelected = p.id === selectedPointId;
          const isPareto = !p.dominated;
          return (
            <g key={p.id} onClick={() => onPointClick(p.id)} style={{ cursor: 'pointer' }}>
              <circle
                cx={cx} cy={cy} r={isSelected ? 8 : 6}
                fill={isPareto ? (isSelected ? '#22c55e' : '#4ade80') : 'none'}
                stroke={isPareto ? '#16a34a' : '#64748b'}
                strokeWidth={isSelected ? 2.5 : 1.5}
                opacity={p.dominated ? 0.5 : 1}
              />
              {/* Label: weight (kg) and displacement (mm) per Req 6.5 */}
              {isPareto && (
                <text x={cx + 8} y={cy - 4} fill="#94a3b8" fontSize={8}>
                  {p.weight.toFixed(0)}kg / {p.displacement.toFixed(1)}mm
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
};

export default ParetoScatterPlot;
