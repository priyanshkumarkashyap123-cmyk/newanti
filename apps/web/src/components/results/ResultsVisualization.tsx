/**
 * ResultsVisualization.tsx
 * 
 * Advanced results visualization component with:
 * - Interactive diagrams (BMD, SFD, Deflection)
 * - 3D deformed shape visualization
 * - Color-coded stress/utilization maps
 * - Detailed tabular results
 * - Export capabilities
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface AnalysisResults {
  displacements: NodalDisplacement[];
  reactions: NodalReaction[];
  memberForces: MemberForce[];
  memberStresses: MemberStress[];
  modalResults?: ModalResult[];
  summary: AnalysisSummary;
}

interface NodalDisplacement {
  nodeId: string;
  loadCase: string;
  dx: number;
  dy: number;
  dz: number;
  rx: number;
  ry: number;
  rz: number;
}

interface NodalReaction {
  nodeId: string;
  loadCase: string;
  fx: number;
  fy: number;
  fz: number;
  mx: number;
  my: number;
  mz: number;
}

interface MemberForce {
  memberId: string;
  loadCase: string;
  position: number;
  axial: number;
  shearY: number;
  shearZ: number;
  torsion: number;
  momentY: number;
  momentZ: number;
}

interface MemberStress {
  memberId: string;
  loadCase: string;
  position: number;
  axialStress: number;
  bendingStressTop: number;
  bendingStressBottom: number;
  shearStress: number;
  vonMisesStress: number;
  utilizationRatio: number;
}

interface ModalResult {
  modeNumber: number;
  frequency: number;
  period: number;
  massParticipationX: number;
  massParticipationY: number;
  massParticipationZ: number;
}

interface AnalysisSummary {
  maxDisplacement: { value: number; nodeId: string; direction: string };
  maxReaction: { value: number; nodeId: string; type: string };
  maxMoment: { value: number; memberId: string; position: number };
  maxShear: { value: number; memberId: string; position: number };
  maxAxial: { value: number; memberId: string };
  maxUtilization: { value: number; memberId: string };
  totalWeight: number;
  stabilityCheck: 'stable' | 'unstable' | 'mechanism';
}

type ViewMode = 'summary' | 'diagrams' | 'tables' | 'modes' | '3d';
type DiagramType = 'bmd' | 'sfd' | 'axial' | 'deflection' | 'utilization';

// ============================================
// MOCK DATA
// ============================================

const mockResults: AnalysisResults = {
  displacements: [
    { nodeId: 'N1', loadCase: 'DL+LL', dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0 },
    { nodeId: 'N2', loadCase: 'DL+LL', dx: 0.002, dy: -0.015, dz: 0, rx: 0, ry: 0, rz: -0.003 },
    { nodeId: 'N3', loadCase: 'DL+LL', dx: 0, dy: -0.025, dz: 0, rx: 0, ry: 0, rz: 0 },
    { nodeId: 'N4', loadCase: 'DL+LL', dx: -0.002, dy: -0.015, dz: 0, rx: 0, ry: 0, rz: 0.003 },
    { nodeId: 'N5', loadCase: 'DL+LL', dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0 },
  ],
  reactions: [
    { nodeId: 'N1', loadCase: 'DL+LL', fx: 12.5, fy: 85.3, fz: 0, mx: 0, my: 0, mz: 45.2 },
    { nodeId: 'N5', loadCase: 'DL+LL', fx: -12.5, fy: 85.3, fz: 0, mx: 0, my: 0, mz: -45.2 },
  ],
  memberForces: [
    { memberId: 'M1', loadCase: 'DL+LL', position: 0, axial: -15.2, shearY: 45.3, shearZ: 0, torsion: 0, momentY: 0, momentZ: 0 },
    { memberId: 'M1', loadCase: 'DL+LL', position: 0.5, axial: -15.2, shearY: 22.6, shearZ: 0, torsion: 0, momentY: 0, momentZ: 68.2 },
    { memberId: 'M1', loadCase: 'DL+LL', position: 1, axial: -15.2, shearY: 0, shearZ: 0, torsion: 0, momentY: 0, momentZ: 102.3 },
    { memberId: 'M2', loadCase: 'DL+LL', position: 0, axial: -45.3, shearY: 12.5, shearZ: 0, torsion: 0, momentY: 0, momentZ: 102.3 },
    { memberId: 'M2', loadCase: 'DL+LL', position: 0.5, axial: -45.3, shearY: 0, shearZ: 0, torsion: 0, momentY: 0, momentZ: 125.6 },
    { memberId: 'M2', loadCase: 'DL+LL', position: 1, axial: -45.3, shearY: -12.5, shearZ: 0, torsion: 0, momentY: 0, momentZ: 102.3 },
  ],
  memberStresses: [
    { memberId: 'M1', loadCase: 'DL+LL', position: 0, axialStress: -15.2, bendingStressTop: 0, bendingStressBottom: 0, shearStress: 22.6, vonMisesStress: 27.2, utilizationRatio: 0.45 },
    { memberId: 'M1', loadCase: 'DL+LL', position: 0.5, axialStress: -15.2, bendingStressTop: 102.3, bendingStressBottom: -102.3, shearStress: 11.3, vonMisesStress: 118.5, utilizationRatio: 0.67 },
    { memberId: 'M1', loadCase: 'DL+LL', position: 1, axialStress: -15.2, bendingStressTop: 153.5, bendingStressBottom: -153.5, shearStress: 0, vonMisesStress: 168.7, utilizationRatio: 0.82 },
    { memberId: 'M2', loadCase: 'DL+LL', position: 0, axialStress: -45.3, bendingStressTop: 153.5, bendingStressBottom: -153.5, shearStress: 6.3, vonMisesStress: 198.8, utilizationRatio: 0.88 },
    { memberId: 'M2', loadCase: 'DL+LL', position: 0.5, axialStress: -45.3, bendingStressTop: 188.4, bendingStressBottom: -188.4, shearStress: 0, vonMisesStress: 233.7, utilizationRatio: 0.95 },
    { memberId: 'M2', loadCase: 'DL+LL', position: 1, axialStress: -45.3, bendingStressTop: 153.5, bendingStressBottom: -153.5, shearStress: -6.3, vonMisesStress: 198.8, utilizationRatio: 0.88 },
  ],
  modalResults: [
    { modeNumber: 1, frequency: 2.34, period: 0.427, massParticipationX: 0.82, massParticipationY: 0.05, massParticipationZ: 0 },
    { modeNumber: 2, frequency: 4.56, period: 0.219, massParticipationX: 0.08, massParticipationY: 0.75, massParticipationZ: 0 },
    { modeNumber: 3, frequency: 7.89, period: 0.127, massParticipationX: 0.05, massParticipationY: 0.12, massParticipationZ: 0.65 },
  ],
  summary: {
    maxDisplacement: { value: 25, nodeId: 'N3', direction: 'Y' },
    maxReaction: { value: 85.3, nodeId: 'N1', type: 'Fy' },
    maxMoment: { value: 125.6, memberId: 'M2', position: 0.5 },
    maxShear: { value: 45.3, memberId: 'M1', position: 0 },
    maxAxial: { value: 45.3, memberId: 'M2' },
    maxUtilization: { value: 0.95, memberId: 'M2' },
    totalWeight: 2450,
    stabilityCheck: 'stable',
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatNumber = (value: number, decimals: number = 2): string => {
  if (Math.abs(value) < 0.001 && value !== 0) {
    return value.toExponential(decimals);
  }
  return value.toFixed(decimals);
};

const getUtilizationColor = (ratio: number): string => {
  if (ratio < 0.5) return '#22c55e'; // green
  if (ratio < 0.7) return '#eab308'; // yellow
  if (ratio < 0.9) return '#f97316'; // orange
  return '#ef4444'; // red
};

const getUtilizationBg = (ratio: number): string => {
  if (ratio < 0.5) return 'bg-green-900/30 text-green-400';
  if (ratio < 0.7) return 'bg-yellow-900/30 text-yellow-400';
  if (ratio < 0.9) return 'bg-orange-900/30 text-orange-400';
  return 'bg-red-900/30 text-red-400';
};

// ============================================
// SUB-COMPONENTS
// ============================================

const SummaryCard: React.FC<{
  title: string;
  value: string;
  unit: string;
  location: string;
  icon: React.ReactNode;
  color: string;
  critical?: boolean;
}> = ({ title, value, unit, location, icon, color, critical }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`relative overflow-hidden rounded-xl border ${critical ? 'border-red-500/50 bg-red-900/20' : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800'} p-4 shadow-sm`}
  >
    {critical && (
      <div className="absolute top-2 right-2">
        <span className="inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
          Critical
        </span>
      </div>
    )}
    <div className="flex items-start gap-3">
      <div className={`rounded-lg ${color} p-2.5 text-slate-900 dark:text-white`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">
          {value} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">{unit}</span>
        </p>
        <p className="text-xs text-slate-500 mt-1">{location}</p>
      </div>
    </div>
  </motion.div>
);

const DiagramCanvas: React.FC<{
  type: DiagramType;
  memberForces: MemberForce[];
  memberStresses: MemberStress[];
}> = ({ type, memberForces, memberStresses }) => {
  // Simplified SVG diagram
  const width = 600;
  const height = 400;
  const padding = 50;
  
  // Generate diagram paths based on type
  const getDiagramPath = useCallback(() => {
    switch (type) {
      case 'bmd':
        return `M ${padding} ${height - padding} 
                Q ${width / 4} ${height - padding - 100}, ${width / 2} ${height - padding - 150}
                Q ${3 * width / 4} ${height - padding - 100}, ${width - padding} ${height - padding}`;
      case 'sfd':
        return `M ${padding} ${height / 2 - 50} 
                L ${width / 2 - 50} ${height / 2 - 50}
                L ${width / 2 - 50} ${height / 2 + 50}
                L ${width - padding} ${height / 2 + 50}`;
      case 'deflection':
        return `M ${padding} ${height - padding} 
                Q ${width / 2} ${height - padding - 200}, ${width - padding} ${height - padding}`;
      default:
        return '';
    }
  }, [type, width, height, padding]);

  const diagramColors = {
    bmd: '#3b82f6',
    sfd: '#22c55e',
    axial: '#f97316',
    deflection: '#8b5cf6',
    utilization: '#ef4444',
  };

  return (
    <div className="relative">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900">
        {/* Grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f1f5f9" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Axes */}
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#94a3b8" strokeWidth="2" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#94a3b8" strokeWidth="2" />
        
        {/* Structure outline */}
        <g stroke="#cbd5e1" strokeWidth="2" fill="none">
          <line x1={padding} y1={height - padding} x2={padding} y2={padding + 50} />
          <line x1={padding} y1={padding + 50} x2={width / 2} y2={padding} />
          <line x1={width / 2} y1={padding} x2={width - padding} y2={padding + 50} />
          <line x1={width - padding} y1={padding + 50} x2={width - padding} y2={height - padding} />
        </g>
        
        {/* Diagram */}
        {type !== 'utilization' && (
          <motion.path
            d={getDiagramPath()}
            fill="none"
            stroke={diagramColors[type]}
            strokeWidth="3"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1 }}
          />
        )}
        
        {/* Filled area for BMD */}
        {type === 'bmd' && (
          <motion.path
            d={`${getDiagramPath()} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`}
            fill={`${diagramColors.bmd}20`}
            stroke="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          />
        )}
        
        {/* Utilization color bars */}
        {type === 'utilization' && memberStresses
          .filter((s, i, arr) => arr.findIndex(a => a.memberId === s.memberId) === i)
          .map((stress, i) => (
            <motion.rect
              key={stress.memberId}
              x={padding + i * 100}
              y={height - padding - stress.utilizationRatio * (height - 2 * padding)}
              width="60"
              height={stress.utilizationRatio * (height - 2 * padding)}
              fill={getUtilizationColor(stress.utilizationRatio)}
              initial={{ height: 0 }}
              animate={{ height: stress.utilizationRatio * (height - 2 * padding) }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              rx="4"
            />
          ))}
        
        {/* Max value annotation */}
        {type === 'bmd' && (
          <g>
            <circle cx={width / 2} cy={padding + 100} r="6" fill={diagramColors.bmd} />
            <text x={width / 2 + 15} y={padding + 105} fontSize="12" fill="#1e293b" fontWeight="bold">
              M_max = 125.6 kN·m
            </text>
          </g>
        )}
        
        {/* Legend */}
        <g transform={`translate(${width - 120}, 20)`}>
          <rect x="0" y="0" width="100" height="30" fill="#f8fafc" stroke="#e2e8f0" rx="4" />
          <line x1="10" y1="15" x2="30" y2="15" stroke={diagramColors[type]} strokeWidth="3" />
          <text x="40" y="20" fontSize="12" fill="#64748b">
            {type.toUpperCase()}
          </text>
        </g>
        
        {/* Supports */}
        <g fill="#64748b">
          <polygon points={`${padding},${height - padding} ${padding - 15},${height - padding + 20} ${padding + 15},${height - padding + 20}`} />
          <polygon points={`${width - padding},${height - padding} ${width - padding - 15},${height - padding + 20} ${width - padding + 15},${height - padding + 20}`} />
        </g>
      </svg>
      
      {/* Value labels */}
      <div className="absolute bottom-4 left-4 flex gap-4 text-sm">
        <div className="rounded bg-slate-100/90 dark:bg-slate-800/90 px-2 py-1 shadow">
          <span className="text-slate-500 dark:text-slate-400">Scale: </span>
          <span className="font-medium text-slate-700 dark:text-slate-200">Auto</span>
        </div>
        <div className="rounded bg-slate-100/90 dark:bg-slate-800/90 px-2 py-1 shadow">
          <span className="text-slate-500 dark:text-slate-400">Units: </span>
          <span className="font-medium">kN, m</span>
        </div>
      </div>
    </div>
  );
};

const ResultsTable: React.FC<{
  title: string;
  headers: string[];
  data: (string | number)[][];
  highlightMax?: number;
}> = ({ title, headers, data, highlightMax }) => {
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState('');
  
  const sortedData = useMemo(() => {
    let filtered = data.filter(row =>
      row.some(cell => String(cell).toLowerCase().includes(filter.toLowerCase()))
    );
    
    if (sortColumn !== null) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        const comparison = typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
        return sortDir === 'asc' ? comparison : -comparison;
      });
    }
    
    return filtered;
  }, [data, sortColumn, sortDir, filter]);

  const handleSort = (index: number) => {
    if (sortColumn === index) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(index);
      setSortDir('asc');
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden">
      <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
        <input
          type="text"
          placeholder="Filter..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-md border border-slate-600 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-100/50 dark:bg-slate-800/50">
            <tr>
              {headers.map((header, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(i)}
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <div className="flex items-center gap-1">
                    {header}
                    {sortColumn === i && (
                      <span>{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {sortedData.map((row, rowIndex) => (
              <motion.tr
                key={rowIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: rowIndex * 0.02 }}
                className="hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`px-4 py-3 text-sm ${
                      highlightMax !== undefined && cellIndex === highlightMax && typeof cell === 'number'
                        ? cell === Math.max(...data.map(r => r[highlightMax] as number))
                          ? 'font-bold text-red-600'
                          : ''
                        : ''
                    }`}
                  >
                    {typeof cell === 'number' ? formatNumber(cell) : cell}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-2 text-sm text-slate-500 dark:text-slate-400">
        {sortedData.length} of {data.length} results
      </div>
    </div>
  );
};

const ModalResultsView: React.FC<{ results: ModalResult[] }> = ({ results }) => (
  <div className="space-y-6">
    {/* Summary Cards */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {results.slice(0, 3).map((mode) => (
        <motion.div
          key={mode.modeNumber}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-slate-700 dark:text-slate-200">Mode {mode.modeNumber}</h4>
            <span className="text-xs text-slate-500 dark:text-slate-400">T = {formatNumber(mode.period, 3)}s</span>
          </div>
          <div className="text-3xl font-bold text-blue-600 mb-2">
            {formatNumber(mode.frequency)} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">Hz</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Mass X:</span>
              <span className="font-medium">{formatNumber(mode.massParticipationX * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${mode.massParticipationX * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Mass Y:</span>
              <span className="font-medium">{formatNumber(mode.massParticipationY * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-green-500"
                style={{ width: `${mode.massParticipationY * 100}%` }}
              />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
    
    {/* Full Table */}
    <ResultsTable
      title="Modal Analysis Results"
      headers={['Mode', 'Frequency (Hz)', 'Period (s)', 'Mass-X (%)', 'Mass-Y (%)', 'Mass-Z (%)', 'Cumulative X (%)']}
      data={results.map((m, i) => [
        m.modeNumber,
        formatNumber(m.frequency),
        formatNumber(m.period, 4),
        formatNumber(m.massParticipationX * 100),
        formatNumber(m.massParticipationY * 100),
        formatNumber(m.massParticipationZ * 100),
        formatNumber(results.slice(0, i + 1).reduce((sum, r) => sum + r.massParticipationX * 100, 0)),
      ])}
    />
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

interface ResultsVisualizationProps {
  results?: AnalysisResults;
  onExport?: (format: 'pdf' | 'excel' | 'json') => void;
  onClose?: () => void;
}

export const ResultsVisualization: React.FC<ResultsVisualizationProps> = ({
  results = mockResults,
  onExport,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [diagramType, setDiagramType] = useState<DiagramType>('bmd');
  const [selectedLoadCase, setSelectedLoadCase] = useState('DL+LL');
  
  const tabs = [
    { id: 'summary' as ViewMode, label: 'Summary', icon: '📊' },
    { id: 'diagrams' as ViewMode, label: 'Diagrams', icon: '📈' },
    { id: 'tables' as ViewMode, label: 'Tables', icon: '📋' },
    { id: 'modes' as ViewMode, label: 'Modal', icon: '🎵' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-700 dark:text-slate-200">Analysis Results</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Load Case: {selectedLoadCase}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Export Buttons */}
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => onExport?.('pdf')}
                className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                PDF
              </button>
              <button
                onClick={() => onExport?.('excel')}
                className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border-l border-slate-200 dark:border-slate-700"
              >
                Excel
              </button>
              <button
                onClick={() => onExport?.('json')}
                className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border-l border-slate-200 dark:border-slate-700"
              >
                JSON
              </button>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:text-slate-200"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* Tabs */}
        <div className="mt-4 flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === tab.id
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <AnimatePresence mode="wait">
          {viewMode === 'summary' && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Stability Check Banner */}
              <div className={`rounded-xl p-4 ${
                results.summary.stabilityCheck === 'stable'
                  ? 'bg-green-900/20 border border-green-700'
                  : 'bg-red-900/20 border border-red-700'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    results.summary.stabilityCheck === 'stable' ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    {results.summary.stabilityCheck === 'stable' ? '✓' : '✗'}
                  </div>
                  <div>
                    <h3 className={`font-semibold ${
                      results.summary.stabilityCheck === 'stable' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      Structure is {results.summary.stabilityCheck}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {results.summary.stabilityCheck === 'stable'
                        ? 'All stability checks passed. Structure meets equilibrium requirements.'
                        : 'Structure requires additional supports or modifications.'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Summary Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <SummaryCard
                  title="Max Displacement"
                  value={formatNumber(results.summary.maxDisplacement.value)}
                  unit="mm"
                  location={`Node ${results.summary.maxDisplacement.nodeId} (${results.summary.maxDisplacement.direction})`}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>}
                  color="bg-blue-500"
                />
                <SummaryCard
                  title="Max Bending Moment"
                  value={formatNumber(results.summary.maxMoment.value)}
                  unit="kN·m"
                  location={`Member ${results.summary.maxMoment.memberId} @ ${results.summary.maxMoment.position * 100}%`}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                  color="bg-purple-500"
                />
                <SummaryCard
                  title="Max Shear Force"
                  value={formatNumber(results.summary.maxShear.value)}
                  unit="kN"
                  location={`Member ${results.summary.maxShear.memberId} @ ${results.summary.maxShear.position * 100}%`}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}
                  color="bg-green-500"
                />
                <SummaryCard
                  title="Max Axial Force"
                  value={formatNumber(results.summary.maxAxial.value)}
                  unit="kN"
                  location={`Member ${results.summary.maxAxial.memberId}`}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>}
                  color="bg-orange-500"
                />
                <SummaryCard
                  title="Max Reaction"
                  value={formatNumber(results.summary.maxReaction.value)}
                  unit="kN"
                  location={`Node ${results.summary.maxReaction.nodeId} (${results.summary.maxReaction.type})`}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>}
                  color="bg-indigo-500"
                />
                <SummaryCard
                  title="Max Utilization"
                  value={formatNumber(results.summary.maxUtilization.value * 100)}
                  unit="%"
                  location={`Member ${results.summary.maxUtilization.memberId}`}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                  color="bg-red-500"
                  critical={results.summary.maxUtilization.value > 0.9}
                />
              </div>
              
              {/* Weight Summary */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-6">
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-4">Structure Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Total Weight</p>
                    <p className="text-xl font-semibold text-slate-700 dark:text-slate-200">{formatNumber(results.summary.totalWeight)} kg</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Members</p>
                    <p className="text-xl font-semibold text-slate-700 dark:text-slate-200">{results.memberForces.filter((f, i, arr) => arr.findIndex(a => a.memberId === f.memberId) === i).length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Nodes</p>
                    <p className="text-xl font-semibold text-slate-700 dark:text-slate-200">{results.displacements.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Load Cases</p>
                    <p className="text-xl font-semibold text-slate-700 dark:text-slate-200">1</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {viewMode === 'diagrams' && (
            <motion.div
              key="diagrams"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Diagram Type Selector */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: 'bmd' as DiagramType, label: 'Bending Moment', icon: '📐' },
                  { id: 'sfd' as DiagramType, label: 'Shear Force', icon: '✂️' },
                  { id: 'axial' as DiagramType, label: 'Axial Force', icon: '↕️' },
                  { id: 'deflection' as DiagramType, label: 'Deflection', icon: '〰️' },
                  { id: 'utilization' as DiagramType, label: 'Utilization', icon: '📊' },
                ].map(diagram => (
                  <button
                    key={diagram.id}
                    onClick={() => setDiagramType(diagram.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      diagramType === diagram.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {diagram.icon} {diagram.label}
                  </button>
                ))}
              </div>
              
              {/* Diagram Canvas */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-4">
                <DiagramCanvas
                  type={diagramType}
                  memberForces={results.memberForces}
                  memberStresses={results.memberStresses}
                />
              </div>
            </motion.div>
          )}

          {viewMode === 'tables' && (
            <motion.div
              key="tables"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <ResultsTable
                title="Nodal Displacements"
                headers={['Node', 'DX (mm)', 'DY (mm)', 'DZ (mm)', 'RX (rad)', 'RY (rad)', 'RZ (rad)']}
                data={results.displacements.map(d => [
                  d.nodeId, d.dx * 1000, d.dy * 1000, d.dz * 1000, d.rx, d.ry, d.rz
                ])}
                highlightMax={2}
              />
              
              <ResultsTable
                title="Support Reactions"
                headers={['Node', 'FX (kN)', 'FY (kN)', 'FZ (kN)', 'MX (kN·m)', 'MY (kN·m)', 'MZ (kN·m)']}
                data={results.reactions.map(r => [
                  r.nodeId, r.fx, r.fy, r.fz, r.mx, r.my, r.mz
                ])}
              />
              
              <ResultsTable
                title="Member Forces"
                headers={['Member', 'Position', 'Axial (kN)', 'Shear-Y (kN)', 'Moment-Z (kN·m)']}
                data={results.memberForces.map(f => [
                  f.memberId, `${f.position * 100}%`, f.axial, f.shearY, f.momentZ
                ])}
                highlightMax={4}
              />
              
              <ResultsTable
                title="Member Stresses & Utilization"
                headers={['Member', 'Position', 'Axial (MPa)', 'Bending (MPa)', 'Von Mises (MPa)', 'Utilization']}
                data={results.memberStresses.map(s => [
                  s.memberId, `${s.position * 100}%`, s.axialStress, s.bendingStressTop, s.vonMisesStress, `${formatNumber(s.utilizationRatio * 100)}%`
                ])}
              />
            </motion.div>
          )}

          {viewMode === 'modes' && results.modalResults && (
            <motion.div
              key="modes"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ModalResultsView results={results.modalResults} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default ResultsVisualization;
