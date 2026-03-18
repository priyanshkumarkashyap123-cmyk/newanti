/**
 * ConvergenceChart — SVG line chart for optimization convergence
 * Feature: space-planning-accuracy-and-tools
 * Requirements: 7.1, 7.2
 */
import React, { useEffect, useRef, useState } from 'react';
import type { ConvergenceEntry } from '../../pages/SensitivityOptimizationDashboard';

interface ConvergenceChartProps {
  history: ConvergenceEntry[];
  convergenceTolerance: number;
  isRunning: boolean;
  width?: number;
  height?: number;
}

export const ConvergenceChart: React.FC<ConvergenceChartProps> = ({
  history,
  convergenceTolerance: _convergenceTolerance,
  isRunning,
  width = 400,
  height = 200,
}) => {
  const rafRef = useRef<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (isRunning) {
      const animate = () => {
        setTick(t => t + 1);
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isRunning]);

  // Suppress unused variable warning
  void tick;

  const margin = { top: 16, right: 20, bottom: 40, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  if (history.length === 0) {
    return (
      <svg width={width} height={height} aria-label="Convergence chart — no data">
        <text x={width / 2} y={height / 2} textAnchor="middle" fill="#94a3b8" fontSize={12}>
          Run optimization to see convergence
        </text>
      </svg>
    );
  }

  const xVals = history.map(e => e.iteration);
  const yVals = history.map(e => e.objectiveValue);
  const xMin = Math.min(...xVals);
  const xMax = Math.max(...xVals);
  const yMin = Math.min(...yVals);
  const yMax = Math.max(...yVals);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  const toSvgX = (v: number) => ((v - xMin) / xRange) * innerWidth;
  const toSvgY = (v: number) => innerHeight - ((v - yMin) / yRange) * innerHeight;

  const polyline = history.map(e => `${toSvgX(e.iteration)},${toSvgY(e.objectiveValue)}`).join(' ');
  const bestVal = yMin;
  const bestY = toSvgY(bestVal);
  const lastEntry = history[history.length - 1];

  return (
    <svg width={width} height={height} aria-label="Convergence chart">
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* Axes */}
        <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="#64748b" strokeWidth={1} />
        <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="#64748b" strokeWidth={1} />

        {/* Best value dashed line */}
        <line x1={0} y1={bestY} x2={innerWidth} y2={bestY}
          stroke="#22c55e" strokeWidth={1} strokeDasharray="6,3" opacity={0.7} />
        <text x={innerWidth - 2} y={bestY - 4} textAnchor="end" fill="#22c55e" fontSize={9}>
          best: {bestVal.toFixed(1)}
        </text>

        {/* Line chart */}
        <polyline points={polyline} fill="none" stroke="#4ade80" strokeWidth={1.5} />

        {/* Final value annotation when not running */}
        {!isRunning && lastEntry && (
          <g transform={`translate(${toSvgX(lastEntry.iteration)},${toSvgY(lastEntry.objectiveValue)})`}>
            <circle r={4} fill="#22c55e" />
            <text x={6} y={-4} fill="#94a3b8" fontSize={9}>
              {lastEntry.objectiveValue.toFixed(1)}
            </text>
          </g>
        )}

        {/* Axis labels */}
        <text x={innerWidth / 2} y={innerHeight + 30} textAnchor="middle" fill="#94a3b8" fontSize={10}>
          Iteration
        </text>
        <text x={-innerHeight / 2} y={-44} textAnchor="middle" fill="#94a3b8" fontSize={10}
          transform="rotate(-90)">
          Objective Value
        </text>
      </g>
    </svg>
  );
};

export default ConvergenceChart;
