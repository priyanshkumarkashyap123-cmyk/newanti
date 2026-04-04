/**
 * ParameterStudyPanel — Variable selector and chart for parameter studies
 * Feature: space-planning-accuracy-and-tools
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
import React, { useState, useCallback } from 'react';
import type { Member, Node as ModelNode } from '../../store/model';
import type {
  DesignVariable,
  ParameterStudyConfig,
  ParameterStudyResult,
} from '../../pages/SensitivityOptimizationDashboard';
import { runParameterStudy } from '../../pages/SensitivityOptimizationDashboard';

interface ParameterStudyPanelProps {
  variables: DesignVariable[];
  members: Map<string, Member>;
  analysisResults: import('../../store/model').AnalysisResults | null;
  nodes: Map<string, ModelNode>;
  onResultsReady: (results: ParameterStudyResult[], config: ParameterStudyConfig) => void;
}

export const ParameterStudyPanel: React.FC<ParameterStudyPanelProps> = ({
  variables,
  members,
  analysisResults,
  nodes,
  onResultsReady,
}) => {
  const [var1Id, setVar1Id] = useState<string>(variables[0]?.id ?? '');
  const [var2Id, setVar2Id] = useState<string>('');
  const [lb1, setLb1] = useState<number>(variables[0]?.lowerBound ?? 100);
  const [ub1, setUb1] = useState<number>(variables[0]?.upperBound ?? 900);
  const [steps1, setSteps1] = useState<number>(10);
  const [lb2, setLb2] = useState<number>(100);
  const [ub2, setUb2] = useState<number>(900);
  const [steps2, setSteps2] = useState<number>(5);
  const [results, setResults] = useState<ParameterStudyResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = useCallback(() => {
    setError(null);
    setIsRunning(true);
    try {
      const config: ParameterStudyConfig = {
        variable1: { variableId: var1Id, lowerBound: lb1, upperBound: ub1, steps: steps1 },
        objective: 'minimize-weight',
      };
      if (var2Id) {
        config.variable2 = { variableId: var2Id, lowerBound: lb2, upperBound: ub2, steps: steps2 };
      }
      const res = runParameterStudy(config, variables, members, analysisResults, nodes);
      setResults(res);
      onResultsReady(res, config);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRunning(false);
    }
  }, [var1Id, var2Id, lb1, ub1, steps1, lb2, ub2, steps2, variables, members, analysisResults, nodes, onResultsReady]);

  const is2D = !!var2Id;
  const minResult = results.find(r => r.isMinimum);

  // Simple 1D line chart
  const renderLineChart = () => {
    if (results.length === 0) return null;
    const w = 360, h = 160;
    const margin = { top: 10, right: 10, bottom: 30, left: 50 };
    const iw = w - margin.left - margin.right;
    const ih = h - margin.top - margin.bottom;
    const xVals = results.map(r => r.v1Value);
    const yVals = results.map(r => r.objectiveValue);
    const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
    const yMin = Math.min(...yVals), yMax = Math.max(...yVals);
    const xR = xMax - xMin || 1, yR = yMax - yMin || 1;
    const tx = (v: number) => ((v - xMin) / xR) * iw;
    const ty = (v: number) => ih - ((v - yMin) / yR) * ih;
    const pts = results.map(r => `${tx(r.v1Value)},${ty(r.objectiveValue)}`).join(' ');
    return (
      <svg width={w} height={h} aria-label="Parameter study line chart">
        <g transform={`translate(${margin.left},${margin.top})`}>
          <line x1={0} y1={ih} x2={iw} y2={ih} stroke="#64748b" />
          <line x1={0} y1={0} x2={0} y2={ih} stroke="#64748b" />
          <polyline points={pts} fill="none" stroke="#4ade80" strokeWidth={1.5} />
          {minResult && (
            <circle cx={tx(minResult.v1Value)} cy={ty(minResult.objectiveValue)} r={5}
              fill="#f59e0b" stroke="#d97706" strokeWidth={1.5} />
          )}
          <text x={iw / 2} y={ih + 22} textAnchor="middle" fill="#94a3b8" fontSize={9}>
            Variable value
          </text>
        </g>
      </svg>
    );
  };

  // Simple 2D heat map
  const renderHeatMap = () => {
    if (results.length === 0 || !is2D) return null;
    const v1Vals = [...new Set(results.map(r => r.v1Value))].sort((a, b) => a - b);
    const v2Vals = [...new Set(results.map(r => r.v2Value ?? 0))].sort((a, b) => a - b);
    const objVals = results.map(r => r.objectiveValue);
    const minObj = Math.min(...objVals), maxObj = Math.max(...objVals);
    const cellW = Math.max(20, Math.floor(300 / v1Vals.length));
    const cellH = Math.max(20, Math.floor(120 / v2Vals.length));
    const w = cellW * v1Vals.length + 60, h = cellH * v2Vals.length + 40;

    const colorForVal = (v: number) => {
      const t = maxObj === minObj ? 0.5 : (v - minObj) / (maxObj - minObj);
      const r = Math.round(255 * t);
      const g = Math.round(255 * (1 - t));
      return `rgb(${r},${g},50)`;
    };

    return (
      <svg width={w} height={h} aria-label="Parameter study heat map">
        <g transform="translate(50,10)">
          {results.map((res, i) => {
            const xi = v1Vals.indexOf(res.v1Value);
            const yi = v2Vals.indexOf(res.v2Value ?? 0);
            return (
              <rect key={i} x={xi * cellW} y={yi * cellH} width={cellW} height={cellH}
                fill={colorForVal(res.objectiveValue)} stroke="#1e293b" strokeWidth={0.5} />
            );
          })}
          {minResult && (
            <circle
              cx={v1Vals.indexOf(minResult.v1Value) * cellW + cellW / 2}
              cy={v2Vals.indexOf(minResult.v2Value ?? 0) * cellH + cellH / 2}
              r={4} fill="#f59e0b" />
          )}
        </g>
      </svg>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Variable 1</label>
          <select
            value={var1Id}
            onChange={e => setVar1Id(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
          >
            {variables.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <div className="flex gap-2 mt-1">
            <input type="number" value={lb1} onChange={e => setLb1(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
              placeholder="Lower bound" />
            <input type="number" value={ub1} onChange={e => setUb1(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
              placeholder="Upper bound" />
            <input type="number" value={steps1} min={2} onChange={e => setSteps1(Number(e.target.value))}
              className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
              placeholder="Steps" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Variable 2 (optional)</label>
          <select
            value={var2Id}
            onChange={e => setVar2Id(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
          >
            <option value="">— None (1D study) —</option>
            {variables.filter(v => v.id !== var1Id).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          {var2Id && (
            <div className="flex gap-2 mt-1">
              <input type="number" value={lb2} onChange={e => setLb2(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                placeholder="Lower bound" />
              <input type="number" value={ub2} onChange={e => setUb2(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                placeholder="Upper bound" />
              <input type="number" value={steps2} min={2} onChange={e => setSteps2(Number(e.target.value))}
                className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                placeholder="Steps" />
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleRun}
        disabled={isRunning || !var1Id}
        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm disabled:opacity-50"
      >
        {isRunning ? 'Running...' : 'Run Study'}
      </button>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {results.length > 0 && (
        <div>
          {is2D ? renderHeatMap() : renderLineChart()}
          {minResult && (
            <p className="text-xs text-amber-400 mt-2">
              Minimum at v1={minResult.v1Value.toFixed(1)}{minResult.v2Value !== undefined ? `, v2=${minResult.v2Value.toFixed(1)}` : ''}: {minResult.objectiveValue.toFixed(2)}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ParameterStudyPanel;
