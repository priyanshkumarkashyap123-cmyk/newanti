/**
 * ColorLegend Component - Reusable gradient legend for engineering visualizations
 * Matches Figma spec 02_COMPONENT_LIBRARY §23
 * 
 * Consolidates duplicate legend implementations from:
 * - StressContourRenderer.tsx
 * - EnhancedHeatMap.tsx
 * - StressVisualization.tsx
 */

import React from 'react';
import { cn } from '../../lib/utils';

interface ColorStop {
  color: string;
  value: number;
  label?: string;
}

interface ColorLegendProps {
  /** Legend title (e.g., "Von Mises Stress") */
  title: string;
  /** Unit label (e.g., "MPa", "mm") */
  unit?: string;
  /** Min value */
  min: number;
  /** Max value */
  max: number;
  /** Color stops for the gradient (at least 2) */
  colorStops?: ColorStop[];
  /** Predefined color scale */
  colorScale?: 'stress' | 'displacement' | 'thermal' | 'utilization';
  /** Orientation */
  orientation?: 'vertical' | 'horizontal';
  /** Number of intermediate tick marks */
  ticks?: number;
  /** Size of the gradient bar */
  barWidth?: number;
  barHeight?: number;
  /** Additional class names */
  className?: string;
  /** Number precision for labels */
  precision?: number;
}

const PREDEFINED_SCALES: Record<string, string[]> = {
  stress: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#dc2626'],
  displacement: ['#3b82f6', '#8b5cf6', '#a855f7', '#ec4899', '#ef4444'],
  thermal: ['#3b82f6', '#22d3ee', '#22c55e', '#f59e0b', '#ef4444'],
  utilization: ['#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444'],
};

export const ColorLegend: React.FC<ColorLegendProps> = ({
  title,
  unit,
  min,
  max,
  colorStops,
  colorScale = 'stress',
  orientation = 'vertical',
  ticks = 5,
  barWidth = 32,
  barHeight = 200,
  className,
  precision = 2,
}) => {
  const scaleColors = colorStops
    ? colorStops.map(s => s.color)
    : PREDEFINED_SCALES[colorScale] || PREDEFINED_SCALES.stress;

  const gradientDirection = orientation === 'vertical' ? 'to top' : 'to right';
  const gradientString = `linear-gradient(${gradientDirection}, ${scaleColors.join(', ')})`;

  const tickValues: number[] = [];
  for (let i = 0; i <= ticks; i++) {
    tickValues.push(min + (max - min) * (i / ticks));
  }
  if (orientation === 'vertical') tickValues.reverse();

  const formatValue = (v: number) => {
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return v.toFixed(precision);
  };

  if (orientation === 'horizontal') {
    return (
      <div className={cn(
        'inline-flex flex-col gap-1.5 p-3 rounded-lg',
        'bg-slate-900/85 backdrop-blur-sm border border-white/10',
        className
      )}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium tracking-wide text-slate-200">{title}</span>
          {unit && <span className="text-[10px] text-slate-400">({unit})</span>}
        </div>
        <div
          className="rounded-sm"
          style={{
            width: barHeight,
            height: barWidth / 2,
            background: gradientString,
          }}
        />
        <div className="flex justify-between" style={{ width: barHeight }}>
          {tickValues.map((v, i) => (
            <span key={i} className="text-[10px] text-slate-400 font-mono tabular-nums">
              {formatValue(v)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'inline-flex gap-2 p-3 rounded-lg',
      'bg-slate-900/85 backdrop-blur-sm border border-white/10',
      className
    )}>
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-xs font-medium tracking-wide text-slate-200 whitespace-nowrap">{title}</span>
        {unit && <span className="text-[10px] text-slate-400">({unit})</span>}
        <div
          className="rounded-sm"
          style={{
            width: barWidth,
            height: barHeight,
            background: gradientString,
          }}
        />
      </div>
      <div className="flex flex-col justify-between py-1" style={{ height: barHeight }}>
        {tickValues.map((v, i) => (
          <span key={i} className="text-[10px] text-slate-400 font-mono tabular-nums leading-none">
            {formatValue(v)}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ColorLegend;
