/**
 * PipeNetworkDesigner.tsx
 * =============================================================================
 * Full UI for pipe network analysis using Hardy Cross, Linear Theory,
 * and Newton-Raphson methods. Features:
 *   - Interactive network builder (nodes + pipes + loops)
 *   - Preset example networks
 *   - Method & friction model selection
 *   - SVG network visualization with flow arrows
 *   - Detailed results tables (pipes, nodes, iterations)
 *   - Pipe sizing & economic design
 *   - Convergence chart
 * =============================================================================
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  PipeNetworkAnalysis,
  PipeDesign,
  FrictionCalculator,
  NetworkTopology,
  PIPE_MATERIALS,
  STANDARD_DIAMETERS_MM,
  EXAMPLE_NETWORKS,
  DEFAULT_ANALYSIS_CONFIG,
  type NetworkNode,
  type NetworkPipe,
  type NetworkLoop,
  type AnalysisConfig,
  type AnalysisResult,
  type NetworkDesignResult,
  type AnalysisMethod,
  type FrictionModel,
  type NodeType,
} from '../hydraulics/PipeNetworkEngine';

// =============================================================================
// HELPER COMPONENT: Tooltip-style Info Icon
// =============================================================================
const InfoTip: React.FC<{ text: string }> = ({ text }) => (
  <span className="relative group ml-1 cursor-help">
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold">?</span>
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-50 max-w-xs">
      {text}
    </span>
  </span>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export function PipeNetworkDesigner() {
  // ─── State ─────────────────────────────────────────────────────────────────
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [pipes, setPipes] = useState<NetworkPipe[]>([]);
  const [loops, setLoops] = useState<NetworkLoop[]>([]);
  const [config, setConfig] = useState<AnalysisConfig>({ ...DEFAULT_ANALYSIS_CONFIG });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [designResult, setDesignResult] = useState<NetworkDesignResult | null>(null);
  const [activePanel, setActivePanel] = useState<'network' | 'config' | 'results' | 'design'>('network');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [designMaterial, setDesignMaterial] = useState('PVC');
  const [designMaxVel, setDesignMaxVel] = useState(2.5);
  const [designMaxHl, setDesignMaxHl] = useState(8);
  const svgRef = useRef<SVGSVGElement>(null);

  // ─── New Item Forms ────────────────────────────────────────────────────────
  const [newNode, setNewNode] = useState<Partial<NetworkNode>>({
    id: '', label: '', type: 'junction', x: 200, y: 200, elevation: 0, demand: 0, head: undefined, minPressure: 10,
  });
  const [newPipe, setNewPipe] = useState<Partial<NetworkPipe>>({
    id: '', label: '', startNodeId: '', endNodeId: '', length: 500, diameter: 0.200,
    roughness: 130, minorLossK: 0.3, material: 'CI', initialFlow: 0,
  });
  const [newLoop, setNewLoop] = useState({ id: '', label: '', pipeIdsStr: '', directionsStr: '' });

  // ─── Load Preset Network ──────────────────────────────────────────────────
  const loadPreset = useCallback((key: string) => {
    const preset = EXAMPLE_NETWORKS[key as keyof typeof EXAMPLE_NETWORKS];
    if (!preset) return;
    setNodes(preset.nodes.map(n => ({ ...n })));
    setPipes(preset.pipes.map(p => ({ ...p })));
    setLoops(preset.loops.map(l => ({ ...l })));
    setSelectedPreset(key);
    setResult(null);
    setDesignResult(null);
  }, []);

  // ─── Add Node ──────────────────────────────────────────────────────────────
  const addNode = useCallback(() => {
    if (!newNode.id) return;
    const node: NetworkNode = {
      id: newNode.id!,
      label: newNode.label || newNode.id!,
      type: (newNode.type as NodeType) || 'junction',
      x: newNode.x || 200,
      y: newNode.y || 200,
      elevation: newNode.elevation || 0,
      demand: newNode.demand || 0,
      head: newNode.type === 'reservoir' || newNode.type === 'tank' ? (newNode.head || 50) : undefined,
      minPressure: newNode.minPressure || 10,
    };
    setNodes(prev => [...prev, node]);
    setNewNode({ id: '', label: '', type: 'junction', x: 200, y: 200, elevation: 0, demand: 0, head: undefined, minPressure: 10 });
  }, [newNode]);

  // ─── Remove Node ───────────────────────────────────────────────────────────
  const removeNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setPipes(prev => prev.filter(p => p.startNodeId !== id && p.endNodeId !== id));
  }, []);

  // ─── Add Pipe ──────────────────────────────────────────────────────────────
  const addPipe = useCallback(() => {
    if (!newPipe.id || !newPipe.startNodeId || !newPipe.endNodeId) return;
    const pipe: NetworkPipe = {
      id: newPipe.id!,
      label: newPipe.label || newPipe.id!,
      startNodeId: newPipe.startNodeId!,
      endNodeId: newPipe.endNodeId!,
      length: newPipe.length || 500,
      diameter: newPipe.diameter || 0.200,
      roughness: newPipe.roughness || 130,
      minorLossK: newPipe.minorLossK || 0,
      material: newPipe.material || 'CI',
      initialFlow: newPipe.initialFlow || 0,
    };
    setPipes(prev => [...prev, pipe]);
    setNewPipe({ id: '', label: '', startNodeId: '', endNodeId: '', length: 500, diameter: 0.200, roughness: 130, minorLossK: 0.3, material: 'CI', initialFlow: 0 });
  }, [newPipe]);

  // ─── Remove Pipe ───────────────────────────────────────────────────────────
  const removePipe = useCallback((id: string) => {
    setPipes(prev => prev.filter(p => p.id !== id));
  }, []);

  // ─── Add Loop ──────────────────────────────────────────────────────────────
  const addLoop = useCallback(() => {
    if (!newLoop.id || !newLoop.pipeIdsStr) return;
    const pipeIds = newLoop.pipeIdsStr.split(',').map(s => s.trim()).filter(Boolean);
    const directions = newLoop.directionsStr
      ? newLoop.directionsStr.split(',').map(s => parseInt(s.trim(), 10))
      : pipeIds.map(() => 1);
    
    const loop: NetworkLoop = {
      id: newLoop.id,
      label: newLoop.label || newLoop.id,
      pipeIds,
      directions,
    };
    setLoops(prev => [...prev, loop]);
    setNewLoop({ id: '', label: '', pipeIdsStr: '', directionsStr: '' });
  }, [newLoop]);

  // ─── Auto-detect Loops ─────────────────────────────────────────────────────
  const autoDetectLoops = useCallback(() => {
    const detected = NetworkTopology.detectLoops(nodes, pipes);
    if (detected.length > 0) {
      setLoops(detected);
    }
  }, [nodes, pipes]);

  // ─── Remove Loop ───────────────────────────────────────────────────────────
  const removeLoop = useCallback((id: string) => {
    setLoops(prev => prev.filter(l => l.id !== id));
  }, []);

  // ─── Run Analysis ──────────────────────────────────────────────────────────
  const runAnalysis = useCallback(() => {
    if (nodes.length === 0 || pipes.length === 0) return;
    
    // Auto-detect loops if none defined
    let analysisLoops = loops;
    if (analysisLoops.length === 0) {
      analysisLoops = NetworkTopology.detectLoops(nodes, pipes);
      if (analysisLoops.length > 0) {
        setLoops(analysisLoops);
      }
    }

    const analysisResult = PipeNetworkAnalysis.analyze(nodes, pipes, analysisLoops, config);
    setResult(analysisResult);
    setActivePanel('results');
  }, [nodes, pipes, loops, config]);

  // ─── Run Design ────────────────────────────────────────────────────────────
  const runDesign = useCallback(() => {
    if (!result) return;
    const design = PipeDesign.designNetwork(result, designMaterial, designMaxVel, designMaxHl);
    setDesignResult(design);
    setActivePanel('design');
  }, [result, designMaterial, designMaxVel, designMaxHl]);

  // ─── Clear All ─────────────────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    setNodes([]);
    setPipes([]);
    setLoops([]);
    setResult(null);
    setDesignResult(null);
    setSelectedPreset('');
  }, []);

  // ─── SVG Network Visualization ─────────────────────────────────────────────
  const networkSvg = useMemo(() => {
    if (nodes.length === 0) return null;

    // Compute bounding box
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs) - 60;
    const minY = Math.min(...ys) - 60;
    const maxX = Math.max(...xs) + 60;
    const maxY = Math.max(...ys) + 60;
    const width = maxX - minX;
    const height = maxY - minY;

    const displayPipes = result ? result.pipes : pipes;

    return (
      <svg
        ref={svgRef}
        viewBox={`${minX} ${minY} ${width} ${height}`}
        className="w-full h-full"
        style={{ minHeight: 280 }}
      >
        <defs>
          <marker id="arrowPos" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#2563eb" />
          </marker>
          <marker id="arrowNeg" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
            <polygon points="8 0, 0 3, 8 6" fill="#dc2626" />
          </marker>
        </defs>

        {/* Pipes */}
        {displayPipes.map(pipe => {
          const startN = nodes.find(n => n.id === pipe.startNodeId);
          const endN = nodes.find(n => n.id === pipe.endNodeId);
          if (!startN || !endN) return null;

          const Q = pipe.computedFlow ?? pipe.initialFlow ?? 0;
          const absQ = Math.abs(Q);
          const color = Q >= 0 ? '#2563eb' : '#dc2626';
          const strokeW = Math.max(1.5, Math.min(5, absQ * 80));

          // Midpoint for label
          const mx = (startN.x + endN.x) / 2;
          const my = (startN.y + endN.y) / 2;

          return (
            <g key={pipe.id}>
              <line
                x1={startN.x} y1={startN.y}
                x2={endN.x} y2={endN.y}
                stroke={color}
                strokeWidth={strokeW}
                strokeOpacity={0.7}
                markerEnd={Q >= 0 ? 'url(#arrowPos)' : undefined}
                markerStart={Q < 0 ? 'url(#arrowNeg)' : undefined}
              />
              <rect
                x={mx - 30} y={my - 12}
                width={60} height={24}
                rx={4}
                fill="white"
                fillOpacity={0.9}
                stroke="#d1d5db"
                strokeWidth={0.5}
              />
              <text x={mx} y={my - 1} textAnchor="middle" fontSize={9} fill="#374151" fontWeight="600">
                {pipe.label}
              </text>
              <text x={mx} y={my + 9} textAnchor="middle" fontSize={7.5} fill={color}>
                {absQ > 0.0001 ? `${(absQ * 1000).toFixed(1)} L/s` : '—'}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {(result ? result.nodes : nodes).map(node => {
          const isReservoir = node.type === 'reservoir' || node.type === 'tank';
          const fill = isReservoir ? '#0ea5e9' : '#f59e0b';
          const r = isReservoir ? 16 : 12;

          return (
            <g key={node.id}>
              {isReservoir ? (
                <rect
                  x={node.x - r} y={node.y - r}
                  width={r * 2} height={r * 2}
                  rx={3}
                  fill={fill}
                  stroke="#fff"
                  strokeWidth={2}
                />
              ) : (
                <circle cx={node.x} cy={node.y} r={r} fill={fill} stroke="#fff" strokeWidth={2} />
              )}
              <text x={node.x} y={node.y - r - 4} textAnchor="middle" fontSize={10} fill="#1f2937" fontWeight="700">
                {node.label}
              </text>
              {node.computedPressure !== undefined && (
                <text x={node.x} y={node.y + r + 12} textAnchor="middle" fontSize={8} fill="#6b7280">
                  {node.computedPressure.toFixed(1)} m
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  }, [nodes, pipes, result]);

  // ─── Convergence Chart (simple bar/line) ───────────────────────────────────
  const convergenceChart = useMemo(() => {
    if (!result || result.iterationLog.length === 0) return null;
    const maxVal = Math.max(...result.iterationLog.map(l => l.maxCorrection));
    const logEntries = result.iterationLog.slice(0, 50); // Show max 50 iterations
    const chartH = 120;
    const barW = Math.max(4, Math.min(16, 500 / logEntries.length));

    return (
      <svg viewBox={`0 0 ${logEntries.length * (barW + 2) + 40} ${chartH + 30}`} className="w-full" style={{ maxHeight: 160 }}>
        {/* Y-axis label */}
        <text x={2} y={12} fontSize={8} fill="#6b7280">ΔQ</text>
        {/* Tolerance line */}
        {config.tolerance < maxVal && (
          <>
            <line
              x1={30}
              y1={chartH - (config.tolerance / maxVal) * chartH}
              x2={logEntries.length * (barW + 2) + 30}
              y2={chartH - (config.tolerance / maxVal) * chartH}
              stroke="#ef4444"
              strokeWidth={0.5}
              strokeDasharray="4 2"
            />
            <text x={logEntries.length * (barW + 2) + 32} y={chartH - (config.tolerance / maxVal) * chartH + 3} fontSize={7} fill="#ef4444">tol</text>
          </>
        )}
        {/* Bars */}
        {logEntries.map((entry, i) => {
          const h = maxVal > 0 ? (entry.maxCorrection / maxVal) * chartH : 0;
          return (
            <g key={i}>
              <rect
                x={30 + i * (barW + 2)}
                y={chartH - h}
                width={barW}
                height={Math.max(h, 0.5)}
                fill={entry.converged ? '#22c55e' : '#3b82f6'}
                rx={1}
              />
              {/* Label every 5th */}
              {(i % 5 === 0 || i === logEntries.length - 1) && (
                <text x={30 + i * (barW + 2) + barW / 2} y={chartH + 12} textAnchor="middle" fontSize={7} fill="#6b7280">
                  {entry.iteration}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  }, [result, config.tolerance]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white px-6 py-4">
        <h2 className="text-xl font-bold">Pipe Network Analysis & Design</h2>
        <p className="text-indigo-100 text-sm mt-0.5">
          Hardy Cross · Linear Theory · Newton-Raphson | Darcy-Weisbach · Hazen-Williams · Manning
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-2 bg-gray-50">
        {/* Preset selector */}
        <select
          value={selectedPreset}
          onChange={(e) => loadPreset(e.target.value)}
          className="px-2 py-1.5 border rounded text-sm bg-white"
        >
          <option value="">Load Example Network…</option>
          {Object.entries(EXAMPLE_NETWORKS).map(([key, net]) => (
            <option key={key} value={key}>{net.name}</option>
          ))}
        </select>

        <div className="flex-1" />

        {/* Panel tabs */}
        {(['network', 'config', 'results', 'design'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActivePanel(tab)}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              activePanel === tab
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 border hover:bg-gray-100'
            }`}
          >
            {tab === 'network' ? '🔧 Network' : tab === 'config' ? '⚙️ Settings' : tab === 'results' ? '📊 Results' : '📐 Design'}
          </button>
        ))}

        <button
          onClick={runAnalysis}
          disabled={nodes.length === 0 || pipes.length === 0}
          className="px-4 py-1.5 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed ml-2"
        >
          ▶ Run Analysis
        </button>
        <button onClick={clearAll} className="px-3 py-1.5 bg-red-50 text-red-600 text-sm rounded hover:bg-red-100 border border-red-200">
          Clear
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-0">
        {/* ── Left: Network Visualization ── */}
        <div className="xl:col-span-1 border-r border-gray-100 p-4 bg-gray-50 min-h-[320px]">
          <h3 className="font-semibold text-gray-700 text-sm mb-2">Network Diagram</h3>
          {nodes.length > 0 ? (
            <div className="bg-white rounded-lg border p-2" style={{ minHeight: 280 }}>
              {networkSvg}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
              Load a preset or add nodes & pipes to begin
            </div>
          )}
          {/* Legend */}
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-500 inline-block" /> Reservoir</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Junction</span>
            <span className="flex items-center gap-1"><span className="w-6 h-0.5 bg-blue-600 inline-block" /> Positive Q</span>
            <span className="flex items-center gap-1"><span className="w-6 h-0.5 bg-red-600 inline-block" /> Negative Q</span>
          </div>
          {/* Summary stats */}
          {result && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${result.converged ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
              <div className="font-semibold text-sm mb-1">
                {result.converged ? '✅ Converged' : '⚠️ Not Converged'}
              </div>
              <div className="text-xs text-gray-600 space-y-0.5">
                <div>Method: <strong>{result.method}</strong> | Friction: <strong>{result.frictionModel}</strong></div>
                <div>Iterations: <strong>{result.iterations}</strong> | Max Residual: <strong>{result.maxResidual.toExponential(2)}</strong></div>
                <div>Total Head Loss: <strong>{result.totalHeadLoss.toFixed(3)} m</strong></div>
              </div>
            </div>
          )}
          {/* Convergence chart */}
          {convergenceChart && (
            <div className="mt-3 bg-white rounded-lg border p-2">
              <div className="text-xs font-semibold text-gray-500 mb-1">Convergence History</div>
              {convergenceChart}
            </div>
          )}
        </div>

        {/* ── Right: Panel Content ── */}
        <div className="xl:col-span-2 p-4 overflow-auto" style={{ maxHeight: '80vh' }}>

          {/* ===== NETWORK PANEL ===== */}
          {activePanel === 'network' && (
            <div className="space-y-6">
              {/* ── NODES ── */}
              <div>
                <h3 className="font-bold text-gray-800 mb-2">Nodes ({nodes.length})</h3>
                {nodes.length > 0 && (
                  <div className="overflow-x-auto mb-3">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-2 py-1 text-left">ID</th>
                          <th className="px-2 py-1 text-left">Label</th>
                          <th className="px-2 py-1">Type</th>
                          <th className="px-2 py-1">Elev. (m)</th>
                          <th className="px-2 py-1">Demand (m³/s)</th>
                          <th className="px-2 py-1">Head (m)</th>
                          <th className="px-2 py-1">X</th>
                          <th className="px-2 py-1">Y</th>
                          <th className="px-2 py-1"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {nodes.map(n => (
                          <tr key={n.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-2 py-1 font-mono">{n.id}</td>
                            <td className="px-2 py-1">{n.label}</td>
                            <td className="px-2 py-1 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${n.type === 'reservoir' ? 'bg-sky-100 text-sky-700' : n.type === 'tank' ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700'}`}>
                                {n.type}
                              </span>
                            </td>
                            <td className="px-2 py-1 text-center">{n.elevation}</td>
                            <td className="px-2 py-1 text-center">{n.demand}</td>
                            <td className="px-2 py-1 text-center">{n.head ?? '—'}</td>
                            <td className="px-2 py-1 text-center">{n.x}</td>
                            <td className="px-2 py-1 text-center">{n.y}</td>
                            <td className="px-2 py-1">
                              <button onClick={() => removeNode(n.id)} className="text-red-500 hover:text-red-700 text-[10px]">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* Add Node Form */}
                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                  <div className="text-xs font-semibold text-indigo-700 mb-2">+ Add Node</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                    <input placeholder="ID *" value={newNode.id || ''} onChange={e => setNewNode({ ...newNode, id: e.target.value })} className="px-2 py-1 border rounded text-xs" />
                    <input placeholder="Label" value={newNode.label || ''} onChange={e => setNewNode({ ...newNode, label: e.target.value })} className="px-2 py-1 border rounded text-xs" />
                    <select value={newNode.type || 'junction'} onChange={e => setNewNode({ ...newNode, type: e.target.value as NodeType })} className="px-2 py-1 border rounded text-xs">
                      <option value="junction">Junction</option>
                      <option value="reservoir">Reservoir</option>
                      <option value="tank">Tank</option>
                    </select>
                    <input type="number" placeholder="Elevation" value={newNode.elevation || ''} onChange={e => setNewNode({ ...newNode, elevation: +e.target.value })} className="px-2 py-1 border rounded text-xs" />
                    <input type="number" placeholder="Demand" step="0.001" value={newNode.demand || ''} onChange={e => setNewNode({ ...newNode, demand: +e.target.value })} className="px-2 py-1 border rounded text-xs" />
                    {(newNode.type === 'reservoir' || newNode.type === 'tank') && (
                      <input type="number" placeholder="Head (m)" value={newNode.head || ''} onChange={e => setNewNode({ ...newNode, head: +e.target.value })} className="px-2 py-1 border rounded text-xs" />
                    )}
                    <input type="number" placeholder="X pos" value={newNode.x || ''} onChange={e => setNewNode({ ...newNode, x: +e.target.value })} className="px-2 py-1 border rounded text-xs" />
                    <input type="number" placeholder="Y pos" value={newNode.y || ''} onChange={e => setNewNode({ ...newNode, y: +e.target.value })} className="px-2 py-1 border rounded text-xs" />
                  </div>
                  <button onClick={addNode} disabled={!newNode.id} className="mt-2 px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-40">
                    Add Node
                  </button>
                </div>
              </div>

              {/* ── PIPES ── */}
              <div>
                <h3 className="font-bold text-gray-800 mb-2">Pipes ({pipes.length})</h3>
                {pipes.length > 0 && (
                  <div className="overflow-x-auto mb-3">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-2 py-1 text-left">ID</th>
                          <th className="px-2 py-1 text-left">Label</th>
                          <th className="px-2 py-1">From</th>
                          <th className="px-2 py-1">To</th>
                          <th className="px-2 py-1">L (m)</th>
                          <th className="px-2 py-1">D (m)</th>
                          <th className="px-2 py-1">C/ε/n</th>
                          <th className="px-2 py-1">K</th>
                          <th className="px-2 py-1">Q₀ (m³/s)</th>
                          <th className="px-2 py-1"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pipes.map(p => (
                          <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-2 py-1 font-mono">{p.id}</td>
                            <td className="px-2 py-1">{p.label}</td>
                            <td className="px-2 py-1 text-center">{p.startNodeId}</td>
                            <td className="px-2 py-1 text-center">{p.endNodeId}</td>
                            <td className="px-2 py-1 text-center">{p.length}</td>
                            <td className="px-2 py-1 text-center">{p.diameter}</td>
                            <td className="px-2 py-1 text-center">{p.roughness}</td>
                            <td className="px-2 py-1 text-center">{p.minorLossK}</td>
                            <td className="px-2 py-1 text-center">{p.initialFlow}</td>
                            <td className="px-2 py-1">
                              <button onClick={() => removePipe(p.id)} className="text-red-500 hover:text-red-700 text-[10px]">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* Add Pipe Form */}
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <div className="text-xs font-semibold text-blue-700 mb-2">+ Add Pipe</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                    <input placeholder="ID *" value={newPipe.id || ''} onChange={e => setNewPipe({ ...newPipe, id: e.target.value })} className="px-2 py-1 border rounded text-xs" />
                    <input placeholder="Label" value={newPipe.label || ''} onChange={e => setNewPipe({ ...newPipe, label: e.target.value })} className="px-2 py-1 border rounded text-xs" />
                    <select value={newPipe.startNodeId || ''} onChange={e => setNewPipe({ ...newPipe, startNodeId: e.target.value })} className="px-2 py-1 border rounded text-xs">
                      <option value="">From Node *</option>
                      {nodes.map(n => <option key={n.id} value={n.id}>{n.label} ({n.id})</option>)}
                    </select>
                    <select value={newPipe.endNodeId || ''} onChange={e => setNewPipe({ ...newPipe, endNodeId: e.target.value })} className="px-2 py-1 border rounded text-xs">
                      <option value="">To Node *</option>
                      {nodes.map(n => <option key={n.id} value={n.id}>{n.label} ({n.id})</option>)}
                    </select>
                    <input type="number" placeholder="Length (m)" value={newPipe.length || ''} onChange={e => setNewPipe({ ...newPipe, length: +e.target.value })} className="px-2 py-1 border rounded text-xs" />
                    <input type="number" placeholder="Diameter (m)" step="0.001" value={newPipe.diameter || ''} onChange={e => setNewPipe({ ...newPipe, diameter: +e.target.value })} className="px-2 py-1 border rounded text-xs" />
                    <input type="number" placeholder="C / ε / n" value={newPipe.roughness || ''} onChange={e => setNewPipe({ ...newPipe, roughness: +e.target.value })} className="px-2 py-1 border rounded text-xs" />
                    <input type="number" placeholder="Minor K" step="0.1" value={newPipe.minorLossK || ''} onChange={e => setNewPipe({ ...newPipe, minorLossK: +e.target.value })} className="px-2 py-1 border rounded text-xs" />
                    <select value={newPipe.material || 'CI'} onChange={e => setNewPipe({ ...newPipe, material: e.target.value })} className="px-2 py-1 border rounded text-xs">
                      {Object.entries(PIPE_MATERIALS).map(([k, m]) => <option key={k} value={k}>{m.name}</option>)}
                    </select>
                    <input type="number" placeholder="Init. Flow (m³/s)" step="0.001" value={newPipe.initialFlow || ''} onChange={e => setNewPipe({ ...newPipe, initialFlow: +e.target.value })} className="px-2 py-1 border rounded text-xs" />
                  </div>
                  <button onClick={addPipe} disabled={!newPipe.id || !newPipe.startNodeId || !newPipe.endNodeId} className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-40">
                    Add Pipe
                  </button>
                </div>
              </div>

              {/* ── LOOPS ── */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-gray-800">Loops ({loops.length})</h3>
                  <button onClick={autoDetectLoops} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded hover:bg-purple-200 font-semibold">
                    Auto-detect
                  </button>
                  <InfoTip text="Loops are required for Hardy Cross and loop-based methods. Auto-detect finds independent loops using DFS." />
                </div>
                {loops.length > 0 && (
                  <div className="overflow-x-auto mb-3">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-2 py-1 text-left">ID</th>
                          <th className="px-2 py-1 text-left">Label</th>
                          <th className="px-2 py-1 text-left">Pipes</th>
                          <th className="px-2 py-1 text-left">Directions</th>
                          <th className="px-2 py-1"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {loops.map(l => (
                          <tr key={l.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-2 py-1 font-mono">{l.id}</td>
                            <td className="px-2 py-1">{l.label}</td>
                            <td className="px-2 py-1 font-mono">{l.pipeIds.join(', ')}</td>
                            <td className="px-2 py-1 font-mono">{l.directions.map(d => d > 0 ? '+1' : '-1').join(', ')}</td>
                            <td className="px-2 py-1">
                              <button onClick={() => removeLoop(l.id)} className="text-red-500 hover:text-red-700 text-[10px]">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* Add Loop Form */}
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                  <div className="text-xs font-semibold text-purple-700 mb-2">+ Add Loop (Manual)</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input placeholder="ID *" value={newLoop.id} onChange={e => setNewLoop({ ...newLoop, id: e.target.value })} className="px-2 py-1 border rounded text-xs" />
                    <input placeholder="Label" value={newLoop.label} onChange={e => setNewLoop({ ...newLoop, label: e.target.value })} className="px-2 py-1 border rounded text-xs" />
                    <input placeholder="Pipe IDs (P1,P2,P3)" value={newLoop.pipeIdsStr} onChange={e => setNewLoop({ ...newLoop, pipeIdsStr: e.target.value })} className="px-2 py-1 border rounded text-xs" />
                    <input placeholder="Directions (1,-1,1)" value={newLoop.directionsStr} onChange={e => setNewLoop({ ...newLoop, directionsStr: e.target.value })} className="px-2 py-1 border rounded text-xs" />
                  </div>
                  <button onClick={addLoop} disabled={!newLoop.id || !newLoop.pipeIdsStr} className="mt-2 px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-40">
                    Add Loop
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===== CONFIG PANEL ===== */}
          {activePanel === 'config' && (
            <div className="space-y-6">
              <h3 className="font-bold text-gray-800">Analysis Settings</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Method */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-xs text-gray-500 mb-1 font-semibold">Analysis Method</label>
                  <select
                    value={config.method}
                    onChange={e => setConfig({ ...config, method: e.target.value as AnalysisMethod })}
                    className="w-full px-3 py-2 border rounded text-sm"
                  >
                    <option value="hardy-cross">Hardy Cross (Iterative Loop)</option>
                    <option value="linear-theory">Linear Theory (Simultaneous Loop)</option>
                    <option value="newton-raphson">Newton-Raphson (Global)</option>
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {config.method === 'hardy-cross' && 'Classic iterative method. Corrects flows loop-by-loop. Most intuitive, good for hand checks.'}
                    {config.method === 'linear-theory' && 'Solves all loops simultaneously. Faster convergence for large networks.'}
                    {config.method === 'newton-raphson' && 'Global Newton-Raphson on continuity + energy equations. Most robust for complex networks.'}
                  </p>
                </div>

                {/* Friction Model */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-xs text-gray-500 mb-1 font-semibold">Friction Model</label>
                  <select
                    value={config.frictionModel}
                    onChange={e => setConfig({ ...config, frictionModel: e.target.value as FrictionModel })}
                    className="w-full px-3 py-2 border rounded text-sm"
                  >
                    <option value="hazen-williams">Hazen-Williams (C coefficient)</option>
                    <option value="darcy-weisbach">Darcy-Weisbach (ε roughness)</option>
                    <option value="manning">Manning (n roughness)</option>
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {config.frictionModel === 'hazen-williams' && 'Empirical; C = 130-150 for most pipes. Pipe roughness input is the C value. Most common in water distribution.'}
                    {config.frictionModel === 'darcy-weisbach' && 'Theoretical; uses ε (mm) absolute roughness + Colebrook-White. Pipe roughness input is ε in mm.'}
                    {config.frictionModel === 'manning' && 'Empirical; uses Manning\'s n. Pipe roughness input is n value (e.g., 0.011). Common for open channels & gravity mains.'}
                  </p>
                </div>

                {/* Tolerance */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-xs text-gray-500 mb-1 font-semibold">Convergence Tolerance (m³/s)</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={config.tolerance}
                    onChange={e => setConfig({ ...config, tolerance: +e.target.value })}
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Iteration stops when max flow correction ΔQ falls below this value.</p>
                </div>

                {/* Max Iterations */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-xs text-gray-500 mb-1 font-semibold">Maximum Iterations</label>
                  <input
                    type="number"
                    value={config.maxIterations}
                    onChange={e => setConfig({ ...config, maxIterations: +e.target.value })}
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>
              </div>

              {/* Pipe Material Reference */}
              <div>
                <h4 className="font-semibold text-gray-700 text-sm mb-2">Pipe Material Reference (IS Standards)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-2 py-1 text-left">Material</th>
                        <th className="px-2 py-1">H-W C</th>
                        <th className="px-2 py-1">ε (mm)</th>
                        <th className="px-2 py-1">Manning n</th>
                        <th className="px-2 py-1">Max kPa</th>
                        <th className="px-2 py-1">₹/m/mm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(PIPE_MATERIALS).map(([key, mat]) => (
                        <tr key={key} className="border-t border-gray-100">
                          <td className="px-2 py-1 font-medium">{mat.name}</td>
                          <td className="px-2 py-1 text-center">{mat.hazenWilliamsC}</td>
                          <td className="px-2 py-1 text-center">{mat.roughness}</td>
                          <td className="px-2 py-1 text-center">{mat.manningN}</td>
                          <td className="px-2 py-1 text-center">{mat.maxPressure}</td>
                          <td className="px-2 py-1 text-center">₹{mat.costPerMeterPerMm.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===== RESULTS PANEL ===== */}
          {activePanel === 'results' && (
            <div className="space-y-6">
              {!result ? (
                <div className="text-center text-gray-400 py-12">
                  Run analysis to see results
                </div>
              ) : (
                <>
                  {/* Status Badge */}
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${result.converged ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {result.converged ? '✅' : '⚠️'} {result.message}
                  </div>

                  {/* Warnings */}
                  {result.warnings.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="font-semibold text-yellow-800 text-sm mb-1">Warnings ({result.warnings.length})</div>
                      <ul className="text-xs text-yellow-700 space-y-0.5">
                        {result.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Pipe Results Table */}
                  <div>
                    <h4 className="font-bold text-gray-800 mb-2">Pipe Results</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-indigo-50">
                            <th className="px-2 py-1.5 text-left">Pipe</th>
                            <th className="px-2 py-1.5">From → To</th>
                            <th className="px-2 py-1.5">Flow (L/s)</th>
                            <th className="px-2 py-1.5">Velocity (m/s)</th>
                            <th className="px-2 py-1.5">Head Loss (m)</th>
                            <th className="px-2 py-1.5">hf/km (m/km)</th>
                            <th className="px-2 py-1.5">Re</th>
                            <th className="px-2 py-1.5">f</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.pipes.map(p => {
                            const Q = p.computedFlow || 0;
                            const V = p.computedVelocity || 0;
                            const hl = Math.abs(p.computedHeadLoss || 0);
                            const hlPerKm = hl / (p.length / 1000);
                            const vColor = Math.abs(V) > 3 ? 'text-red-600 font-bold' : Math.abs(V) < 0.3 ? 'text-yellow-600' : '';
                            
                            return (
                              <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                                <td className="px-2 py-1 font-semibold">{p.label}</td>
                                <td className="px-2 py-1 text-center font-mono text-[10px]">
                                  {Q >= 0 ? `${p.startNodeId} → ${p.endNodeId}` : `${p.endNodeId} → ${p.startNodeId}`}
                                </td>
                                <td className={`px-2 py-1 text-center font-bold ${Q >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                  {(Math.abs(Q) * 1000).toFixed(2)}
                                </td>
                                <td className={`px-2 py-1 text-center ${vColor}`}>{Math.abs(V).toFixed(3)}</td>
                                <td className="px-2 py-1 text-center">{hl.toFixed(4)}</td>
                                <td className="px-2 py-1 text-center">{hlPerKm.toFixed(2)}</td>
                                <td className="px-2 py-1 text-center font-mono">{p.reynoldsNumber ? p.reynoldsNumber.toFixed(0) : '—'}</td>
                                <td className="px-2 py-1 text-center font-mono">{p.frictionFactor ? p.frictionFactor.toFixed(5) : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Node Results Table */}
                  <div>
                    <h4 className="font-bold text-gray-800 mb-2">Node Results</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-amber-50">
                            <th className="px-2 py-1.5 text-left">Node</th>
                            <th className="px-2 py-1.5">Type</th>
                            <th className="px-2 py-1.5">Elevation (m)</th>
                            <th className="px-2 py-1.5">Demand (L/s)</th>
                            <th className="px-2 py-1.5">Head (m)</th>
                            <th className="px-2 py-1.5">Pressure (m)</th>
                            <th className="px-2 py-1.5">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.nodes.map(n => {
                            const pressure = n.computedPressure || 0;
                            const adequate = n.type !== 'junction' || pressure >= (n.minPressure || 0);
                            
                            return (
                              <tr key={n.id} className="border-t border-gray-100 hover:bg-gray-50">
                                <td className="px-2 py-1 font-semibold">{n.label}</td>
                                <td className="px-2 py-1 text-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${n.type === 'reservoir' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {n.type}
                                  </span>
                                </td>
                                <td className="px-2 py-1 text-center">{n.elevation.toFixed(1)}</td>
                                <td className="px-2 py-1 text-center">{(n.demand * 1000).toFixed(2)}</td>
                                <td className="px-2 py-1 text-center font-bold">{(n.computedHead || 0).toFixed(2)}</td>
                                <td className={`px-2 py-1 text-center font-bold ${pressure < 0 ? 'text-red-600' : adequate ? 'text-green-600' : 'text-yellow-600'}`}>
                                  {pressure.toFixed(2)}
                                </td>
                                <td className="px-2 py-1 text-center">
                                  {n.type === 'reservoir' ? '—' : adequate
                                    ? <span className="text-green-600 font-bold">OK</span>
                                    : <span className="text-red-600 font-bold">LOW</span>
                                  }
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Iteration Log (collapsed) */}
                  <details className="bg-gray-50 rounded-lg border">
                    <summary className="px-4 py-2 cursor-pointer text-sm font-semibold text-gray-700 hover:bg-gray-100">
                      Iteration Log ({result.iterationLog.length} iterations)
                    </summary>
                    <div className="px-4 pb-3 overflow-x-auto">
                      <table className="w-full text-xs border-collapse mt-2">
                        <thead>
                          <tr className="bg-gray-200">
                            <th className="px-2 py-1">Iter</th>
                            <th className="px-2 py-1">Max ΔQ (m³/s)</th>
                            <th className="px-2 py-1">Loop Corrections</th>
                            <th className="px-2 py-1">Converged</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.iterationLog.map(entry => (
                            <tr key={entry.iteration} className="border-t border-gray-100">
                              <td className="px-2 py-1 text-center font-mono">{entry.iteration}</td>
                              <td className="px-2 py-1 text-center font-mono">{entry.maxCorrection.toExponential(4)}</td>
                              <td className="px-2 py-1 font-mono text-[10px]">
                                {entry.loopCorrections.map(lc => `${lc.loopId}: ${lc.correction.toExponential(3)}`).join(' | ')}
                              </td>
                              <td className="px-2 py-1 text-center">{entry.converged ? '✅' : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>

                  {/* Run Design Button */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={runDesign}
                      className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg font-semibold hover:bg-purple-700"
                    >
                      📐 Run Pipe Sizing & Design
                    </button>
                    <select value={designMaterial} onChange={e => setDesignMaterial(e.target.value)} className="px-2 py-1.5 border rounded text-sm">
                      {Object.entries(PIPE_MATERIALS).map(([k, m]) => <option key={k} value={k}>{m.name}</option>)}
                    </select>
                    <input type="number" step="0.1" value={designMaxVel} onChange={e => setDesignMaxVel(+e.target.value)} className="w-24 px-2 py-1.5 border rounded text-sm" title="Max velocity (m/s)" />
                    <span className="text-xs text-gray-500">Max V</span>
                    <input type="number" step="0.5" value={designMaxHl} onChange={e => setDesignMaxHl(+e.target.value)} className="w-24 px-2 py-1.5 border rounded text-sm" title="Max head loss per km (m/km)" />
                    <span className="text-xs text-gray-500">Max hf/km</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===== DESIGN PANEL ===== */}
          {activePanel === 'design' && (
            <div className="space-y-6">
              {!designResult ? (
                <div className="text-center text-gray-400 py-12">
                  Run analysis first, then pipe design
                </div>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className={`p-3 rounded-lg text-center ${designResult.designAdequate ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      <div className="text-xs text-gray-500">Design Status</div>
                      <div className={`text-lg font-bold ${designResult.designAdequate ? 'text-green-700' : 'text-red-700'}`}>
                        {designResult.designAdequate ? '✅ OK' : '❌ Inadequate'}
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
                      <div className="text-xs text-gray-500">Total Cost</div>
                      <div className="text-lg font-bold text-blue-700">₹{(designResult.totalCost / 100000).toFixed(1)} L</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-200">
                      <div className="text-xs text-gray-500">Max Velocity</div>
                      <div className="text-lg font-bold text-purple-700">{designResult.maxVelocity.toFixed(2)} m/s</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-200">
                      <div className="text-xs text-gray-500">Max hf/km</div>
                      <div className="text-lg font-bold text-amber-700">{designResult.maxHeadLoss.toFixed(1)} m/km</div>
                    </div>
                  </div>

                  {/* Sizing Table */}
                  <div>
                    <h4 className="font-bold text-gray-800 mb-2">Pipe Sizing Results</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-purple-50">
                            <th className="px-2 py-1.5 text-left">Pipe</th>
                            <th className="px-2 py-1.5">Req. Dia (mm)</th>
                            <th className="px-2 py-1.5">Sel. Dia (mm)</th>
                            <th className="px-2 py-1.5">Velocity (m/s)</th>
                            <th className="px-2 py-1.5">hf (m)</th>
                            <th className="px-2 py-1.5">hf/km (m/km)</th>
                            <th className="px-2 py-1.5">Material</th>
                            <th className="px-2 py-1.5">Cost (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {designResult.sizing.map(s => {
                            const pipe = pipes.find(p => p.id === s.pipeId);
                            return (
                              <tr key={s.pipeId} className="border-t border-gray-100 hover:bg-gray-50">
                                <td className="px-2 py-1 font-semibold">{pipe?.label || s.pipeId}</td>
                                <td className="px-2 py-1 text-center">{(s.requiredDiameter * 1000).toFixed(0)}</td>
                                <td className="px-2 py-1 text-center font-bold">{(s.selectedDiameter * 1000).toFixed(0)}</td>
                                <td className={`px-2 py-1 text-center ${s.velocity > designMaxVel ? 'text-red-600 font-bold' : ''}`}>{s.velocity.toFixed(3)}</td>
                                <td className="px-2 py-1 text-center">{s.headLoss.toFixed(4)}</td>
                                <td className={`px-2 py-1 text-center ${s.headLossPerKm > designMaxHl ? 'text-red-600 font-bold' : ''}`}>{s.headLossPerKm.toFixed(2)}</td>
                                <td className="px-2 py-1 text-center">{PIPE_MATERIALS[s.material]?.name || s.material}</td>
                                <td className="px-2 py-1 text-right font-mono">₹{s.costEstimate.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-100 font-bold">
                            <td className="px-2 py-1.5" colSpan={7}>Total</td>
                            <td className="px-2 py-1.5 text-right font-mono">₹{designResult.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h4 className="font-semibold text-blue-800 text-sm mb-2">Design Recommendations</h4>
                    <ul className="text-xs text-blue-700 space-y-1">
                      {designResult.recommendations.map((r, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span>{r.includes('meets all') ? '✅' : '💡'}</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Standard Diameters Reference */}
                  <details className="bg-gray-50 rounded-lg border">
                    <summary className="px-4 py-2 cursor-pointer text-sm font-semibold text-gray-700 hover:bg-gray-100">
                      Standard Pipe Diameters (IS)
                    </summary>
                    <div className="px-4 pb-3">
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {STANDARD_DIAMETERS_MM.map(d => (
                          <span key={d} className="px-2 py-0.5 bg-white border rounded text-xs font-mono">{d} mm</span>
                        ))}
                      </div>
                    </div>
                  </details>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-4 py-2 bg-gray-50 text-[10px] text-gray-400 flex justify-between">
        <span>Hardy Cross (1936) · Linear Theory (Wood & Charles, 1972) · Newton-Raphson | IS 783 · IS 2185</span>
        <span>{nodes.length} nodes · {pipes.length} pipes · {loops.length} loops</span>
      </div>
    </div>
  );
}

export default PipeNetworkDesigner;
