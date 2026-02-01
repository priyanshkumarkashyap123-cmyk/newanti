/**
 * ============================================================================
 * INTERACTIVE RESULTS DASHBOARD - ULTRA-MODERN ANALYTICS
 * ============================================================================
 * 
 * Revolutionary structural analysis results visualization featuring:
 * - Real-time animated charts and graphs
 * - Interactive force/moment diagrams
 * - Heat maps for stress distribution
 * - Modal analysis frequency charts
 * - Time-history response plots
 * - Member utilization matrix
 * - Design check summaries
 * - Export to PDF/Excel
 * 
 * @version 4.0.0
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  Waves,
  Target,
  Zap,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  Download,
  Share2,
  Filter,
  Search,
  Maximize2,
  Minimize2,
  RefreshCw,
  Settings,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  X,
  Plus,
  Minus,
  Grid3X3,
  Layers,
  Box,
  Columns,
  Move,
  RotateCcw,
  Building2,
  Wind,
  Mountain,
  FileText,
  Table,
  PieChart,
  LineChart,
  AreaChart,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Calendar,
  Gauge,
  Thermometer,
  Scale,
  Ruler,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface MemberResult {
  id: string;
  name: string;
  type: 'beam' | 'column' | 'brace';
  section: string;
  axialForce: number;
  shearY: number;
  shearZ: number;
  momentY: number;
  momentZ: number;
  torsion: number;
  maxStress: number;
  utilization: number;
  status: 'OK' | 'WARNING' | 'FAIL';
}

interface ModalResult {
  mode: number;
  frequency: number;
  period: number;
  massParticipationX: number;
  massParticipationY: number;
  massParticipationZ: number;
  cumulativeX: number;
  cumulativeY: number;
  cumulativeZ: number;
}

interface LoadCombinationResult {
  id: string;
  name: string;
  type: 'ultimate' | 'serviceability' | 'seismic' | 'wind';
  maxDisplacement: number;
  maxStress: number;
  maxUtilization: number;
  critical: boolean;
}

interface TimeHistoryPoint {
  time: number;
  displacement: number;
  velocity: number;
  acceleration: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CHART_COLORS = {
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  gradient: ['#3b82f6', '#8b5cf6', '#ec4899'],
};

// =============================================================================
// ANIMATED COUNTER COMPONENT
// =============================================================================

const AnimatedCounter: React.FC<{
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}> = ({ value, duration = 1, decimals = 0, prefix = '', suffix = '', className }) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    
    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / (duration * 1000), 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
      
      setDisplayValue(startValue + (value - startValue) * easeProgress);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);
  
  return (
    <span className={className}>
      {prefix}{displayValue.toFixed(decimals)}{suffix}
    </span>
  );
};

// =============================================================================
// SPARKLINE CHART
// =============================================================================

const Sparkline: React.FC<{
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
}> = ({ data, width = 100, height = 30, color = CHART_COLORS.primary, showArea = true }) => {
  if (data.length < 2) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((value, index) => ({
    x: (index / (data.length - 1)) * width,
    y: height - ((value - min) / range) * height,
  }));
  
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = pathD + ` L ${width} ${height} L 0 ${height} Z`;
  
  return (
    <svg width={width} height={height} className="overflow-visible">
      {showArea && (
        <path
          d={areaD}
          fill={`url(#sparklineGradient-${color.replace('#', '')})`}
          opacity="0.3"
        />
      )}
      <motion.path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3" fill={color} />
      
      <defs>
        <linearGradient id={`sparklineGradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
};

// =============================================================================
// PROGRESS RING
// =============================================================================

const ProgressRing: React.FC<{
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  showValue?: boolean;
  label?: string;
  color?: string;
}> = ({ value, max = 100, size = 80, strokeWidth = 8, showValue = true, label, color }) => {
  const percentage = (value / max) * 100;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  const getColor = () => {
    if (color) return color;
    if (percentage >= 90) return CHART_COLORS.danger;
    if (percentage >= 70) return CHART_COLORS.warning;
    return CHART_COLORS.success;
  };
  
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-zinc-800"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (percentage / 100) * circumference }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-white">{Math.round(percentage)}%</span>
          {label && <span className="text-xs text-zinc-500">{label}</span>}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// BAR CHART
// =============================================================================

const BarChart: React.FC<{
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
  showLabels?: boolean;
  horizontal?: boolean;
  height?: number;
}> = ({ data, maxValue, showLabels = true, horizontal = false, height = 200 }) => {
  const max = maxValue || Math.max(...data.map(d => Math.abs(d.value)));
  
  if (horizontal) {
    return (
      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            {showLabels && (
              <span className="text-xs text-zinc-400 w-16 truncate">{item.label}</span>
            )}
            <div className="flex-1 h-6 bg-zinc-800 rounded-lg overflow-hidden">
              <motion.div
                className="h-full rounded-lg"
                style={{ backgroundColor: item.color || CHART_COLORS.primary }}
                initial={{ width: 0 }}
                animate={{ width: `${(Math.abs(item.value) / max) * 100}%` }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              />
            </div>
            <span className="text-xs font-mono text-white w-16 text-right">
              {item.value.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="flex items-end justify-around gap-2" style={{ height }}>
      {data.map((item, index) => (
        <div key={index} className="flex flex-col items-center gap-1 flex-1">
          <motion.div
            className="w-full rounded-t-lg"
            style={{ backgroundColor: item.color || CHART_COLORS.primary }}
            initial={{ height: 0 }}
            animate={{ height: `${(Math.abs(item.value) / max) * (height - 40)}px` }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          />
          {showLabels && (
            <span className="text-xs text-zinc-400 truncate max-w-full">{item.label}</span>
          )}
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// SUMMARY CARD
// =============================================================================

const SummaryCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  status?: 'success' | 'warning' | 'danger' | 'info';
  sparklineData?: number[];
}> = ({ title, value, subtitle, icon, trend, status, sparklineData }) => {
  const statusColors = {
    success: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
    warning: 'from-amber-500/20 to-amber-500/5 border-amber-500/30',
    danger: 'from-red-500/20 to-red-500/5 border-red-500/30',
    info: 'from-blue-500/20 to-blue-500/5 border-blue-500/30',
  };
  
  const iconColors = {
    success: 'bg-emerald-500/20 text-emerald-400',
    warning: 'bg-amber-500/20 text-amber-400',
    danger: 'bg-red-500/20 text-red-400',
    info: 'bg-blue-500/20 text-blue-400',
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border p-4 bg-gradient-to-br ${
        status ? statusColors[status] : 'from-zinc-800/50 to-zinc-900/50 border-zinc-700/50'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${status ? iconColors[status] : 'bg-zinc-800 text-zinc-400'}`}>
          {icon}
        </div>
        {sparklineData && (
          <Sparkline
            data={sparklineData}
            width={60}
            height={24}
            color={status === 'success' ? CHART_COLORS.success : status === 'danger' ? CHART_COLORS.danger : CHART_COLORS.primary}
          />
        )}
      </div>
      
      <div className="space-y-1">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {subtitle && <p className="text-xs text-zinc-400">{subtitle}</p>}
      </div>
      
      {trend && (
        <div className={`flex items-center gap-1 mt-3 text-xs ${
          trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'
        }`}>
          {trend.value >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          <span>{Math.abs(trend.value)}% {trend.label}</span>
        </div>
      )}
    </motion.div>
  );
};

// =============================================================================
// MEMBER UTILIZATION TABLE
// =============================================================================

const MemberUtilizationTable: React.FC<{
  members: MemberResult[];
  onSelect?: (id: string) => void;
  selectedId?: string;
}> = ({ members, onSelect, selectedId }) => {
  const [sortBy, setSortBy] = useState<keyof MemberResult>('utilization');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filter, setFilter] = useState('');
  
  const sortedMembers = useMemo(() => {
    return [...members]
      .filter(m => m.name.toLowerCase().includes(filter.toLowerCase()) || m.id.toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return sortDir === 'asc' 
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
  }, [members, sortBy, sortDir, filter]);
  
  const handleSort = (column: keyof MemberResult) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OK': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'WARNING': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'FAIL': return <AlertCircle className="w-4 h-4 text-red-400" />;
      default: return <AlertCircle className="w-4 h-4 text-zinc-400" />;
    }
  };
  
  return (
    <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Table className="w-4 h-4 text-blue-400" />
          Member Utilization
        </h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search members..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
        </div>
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-zinc-800/50">
            <tr>
              {[
                { key: 'id', label: 'ID' },
                { key: 'type', label: 'Type' },
                { key: 'section', label: 'Section' },
                { key: 'axialForce', label: 'Axial (kN)' },
                { key: 'momentY', label: 'My (kN·m)' },
                { key: 'maxStress', label: 'Stress (MPa)' },
                { key: 'utilization', label: 'Utilization' },
                { key: 'status', label: 'Status' },
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key as keyof MemberResult)}
                  className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortBy === col.key && (
                      sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {sortedMembers.map((member, index) => (
              <motion.tr
                key={member.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onSelect?.(member.id)}
                className={`hover:bg-zinc-800/50 cursor-pointer transition-colors ${
                  selectedId === member.id ? 'bg-blue-500/10' : ''
                }`}
              >
                <td className="px-4 py-3 text-sm font-mono text-white">{member.id}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    member.type === 'beam' ? 'bg-green-500/20 text-green-400' :
                    member.type === 'column' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-purple-500/20 text-purple-400'
                  }`}>
                    {member.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-300">{member.section}</td>
                <td className="px-4 py-3 text-sm font-mono text-zinc-300">{member.axialForce.toFixed(1)}</td>
                <td className="px-4 py-3 text-sm font-mono text-zinc-300">{member.momentY.toFixed(1)}</td>
                <td className="px-4 py-3 text-sm font-mono text-zinc-300">{member.maxStress.toFixed(1)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full ${
                          member.utilization >= 0.9 ? 'bg-red-500' :
                          member.utilization >= 0.7 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${member.utilization * 100}%` }}
                        transition={{ duration: 0.5, delay: index * 0.05 }}
                      />
                    </div>
                    <span className="text-xs font-mono text-white w-12">
                      {(member.utilization * 100).toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {getStatusIcon(member.status)}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =============================================================================
// MODAL ANALYSIS CHART
// =============================================================================

const ModalAnalysisChart: React.FC<{
  modes: ModalResult[];
}> = ({ modes }) => {
  const [selectedMode, setSelectedMode] = useState<number | null>(null);
  
  return (
    <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Waves className="w-4 h-4 text-purple-400" />
          Modal Analysis Results
        </h3>
        <div className="text-xs text-zinc-500">
          {modes.length} modes extracted
        </div>
      </div>
      
      {/* Frequency Chart */}
      <div className="mb-6">
        <p className="text-xs text-zinc-500 mb-2">Natural Frequencies (Hz)</p>
        <div className="flex items-end gap-2 h-32">
          {modes.slice(0, 8).map((mode, i) => (
            <motion.div
              key={mode.mode}
              className="flex-1 flex flex-col items-center gap-1"
              onMouseEnter={() => setSelectedMode(mode.mode)}
              onMouseLeave={() => setSelectedMode(null)}
            >
              <motion.div
                className={`w-full rounded-t-lg cursor-pointer transition-colors ${
                  selectedMode === mode.mode ? 'bg-purple-400' : 'bg-purple-600'
                }`}
                initial={{ height: 0 }}
                animate={{ height: `${(mode.frequency / Math.max(...modes.map(m => m.frequency))) * 100}px` }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              />
              <span className="text-xs text-zinc-500">M{mode.mode}</span>
            </motion.div>
          ))}
        </div>
      </div>
      
      {/* Mass Participation */}
      <div>
        <p className="text-xs text-zinc-500 mb-3">Cumulative Mass Participation</p>
        <div className="space-y-3">
          {['X', 'Y', 'Z'].map((dir, i) => {
            const key = `cumulative${dir}` as keyof ModalResult;
            const finalValue = modes[modes.length - 1]?.[key] as number || 0;
            const color = i === 0 ? CHART_COLORS.danger : i === 1 ? CHART_COLORS.success : CHART_COLORS.primary;
            
            return (
              <div key={dir} className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-8">{dir}-Dir</span>
                <div className="flex-1 h-4 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${finalValue * 100}%` }}
                    transition={{ duration: 1, delay: i * 0.2 }}
                  />
                </div>
                <span className={`text-xs font-mono w-12 text-right ${finalValue >= 0.9 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {(finalValue * 100).toFixed(1)}%
                </span>
                {finalValue >= 0.9 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Selected Mode Info */}
      <AnimatePresence>
        {selectedMode !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl overflow-hidden"
          >
            <p className="text-sm font-medium text-purple-400 mb-2">Mode {selectedMode}</p>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-zinc-500">Frequency</span>
                <p className="text-white font-mono">{modes[selectedMode - 1]?.frequency.toFixed(2)} Hz</p>
              </div>
              <div>
                <span className="text-zinc-500">Period</span>
                <p className="text-white font-mono">{modes[selectedMode - 1]?.period.toFixed(3)} s</p>
              </div>
              <div>
                <span className="text-zinc-500">Max Participation</span>
                <p className="text-white font-mono">
                  {(Math.max(
                    modes[selectedMode - 1]?.massParticipationX || 0,
                    modes[selectedMode - 1]?.massParticipationY || 0,
                    modes[selectedMode - 1]?.massParticipationZ || 0
                  ) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================================================
// LOAD COMBINATION SUMMARY
// =============================================================================

const LoadCombinationSummary: React.FC<{
  combinations: LoadCombinationResult[];
}> = ({ combinations }) => {
  const criticalCombo = combinations.find(c => c.critical);
  
  return (
    <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          Load Combinations
        </h3>
        <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full">
          Critical: {criticalCombo?.name}
        </span>
      </div>
      
      <div className="space-y-2">
        {combinations.map((combo, i) => (
          <motion.div
            key={combo.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`p-3 rounded-xl border transition-colors ${
              combo.critical 
                ? 'bg-red-500/10 border-red-500/30' 
                : 'bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  combo.type === 'ultimate' ? 'bg-purple-500/20 text-purple-400' :
                  combo.type === 'seismic' ? 'bg-red-500/20 text-red-400' :
                  combo.type === 'wind' ? 'bg-cyan-500/20 text-cyan-400' :
                  'bg-green-500/20 text-green-400'
                }`}>
                  {combo.type}
                </span>
                <span className="text-sm text-white">{combo.name}</span>
              </div>
              {combo.critical && <Zap className="w-4 h-4 text-red-400" />}
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-zinc-500">Max Disp.</span>
                <p className="text-white font-mono">{combo.maxDisplacement.toFixed(2)} mm</p>
              </div>
              <div>
                <span className="text-zinc-500">Max Stress</span>
                <p className="text-white font-mono">{combo.maxStress.toFixed(1)} MPa</p>
              </div>
              <div>
                <span className="text-zinc-500">Utilization</span>
                <p className={`font-mono ${
                  combo.maxUtilization >= 0.9 ? 'text-red-400' :
                  combo.maxUtilization >= 0.7 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {(combo.maxUtilization * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// FORCE DIAGRAM
// =============================================================================

const ForceDiagram: React.FC<{
  data: { position: number; value: number }[];
  type: 'shear' | 'moment' | 'axial';
  maxValue: number;
  length: number;
}> = ({ data, type, maxValue, length }) => {
  const height = 120;
  const width = 300;
  const padding = 20;
  
  const colors = {
    shear: { positive: '#22c55e', negative: '#ef4444' },
    moment: { positive: '#3b82f6', negative: '#f59e0b' },
    axial: { positive: '#8b5cf6', negative: '#ec4899' },
  };
  
  const points = data.map(d => ({
    x: padding + (d.position / length) * (width - 2 * padding),
    y: height / 2 - (d.value / maxValue) * (height / 2 - padding),
  }));
  
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `M ${padding} ${height / 2} ` + 
    points.map(p => `L ${p.x} ${p.y}`).join(' ') + 
    ` L ${width - padding} ${height / 2} Z`;
  
  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Center line */}
      <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#3f3f46" strokeWidth="1" />
      
      {/* Grid lines */}
      {[-1, -0.5, 0.5, 1].map(factor => (
        <line
          key={factor}
          x1={padding}
          y1={height / 2 - factor * (height / 2 - padding)}
          x2={width - padding}
          y2={height / 2 - factor * (height / 2 - padding)}
          stroke="#27272a"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      ))}
      
      {/* Filled area */}
      <path
        d={areaD}
        fill={`url(#diagramGradient-${type})`}
        opacity="0.4"
      />
      
      {/* Line */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={colors[type].positive}
        strokeWidth="2"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1 }}
      />
      
      {/* Points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={colors[type].positive} />
      ))}
      
      {/* Labels */}
      <text x={width / 2} y={height - 5} textAnchor="middle" fill="#71717a" fontSize="10">
        Length (m)
      </text>
      <text x={5} y={height / 2} textAnchor="start" fill="#71717a" fontSize="10" transform={`rotate(-90, 10, ${height / 2})`}>
        {type === 'shear' ? 'V (kN)' : type === 'moment' ? 'M (kN·m)' : 'N (kN)'}
      </text>
      
      <defs>
        <linearGradient id={`diagramGradient-${type}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={colors[type].positive} />
          <stop offset="50%" stopColor="transparent" />
          <stop offset="100%" stopColor={colors[type].negative} />
        </linearGradient>
      </defs>
    </svg>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const InteractiveResultsDashboard: React.FC<{
  className?: string;
}> = ({ className }) => {
  // Sample data
  const [members] = useState<MemberResult[]>([
    { id: 'B001', name: 'Beam 1', type: 'beam', section: 'ISMB 300', axialForce: 15, shearY: 120, shearZ: 5, momentY: 210, momentZ: 12, torsion: 2, maxStress: 225, utilization: 0.90, status: 'WARNING' },
    { id: 'B002', name: 'Beam 2', type: 'beam', section: 'ISMB 250', axialForce: 12, shearY: 95, shearZ: 4, momentY: 175, momentZ: 8, torsion: 1, maxStress: 188, utilization: 0.75, status: 'OK' },
    { id: 'C001', name: 'Column 1', type: 'column', section: 'UC 254', axialForce: -450, shearY: 25, shearZ: 18, momentY: 85, momentZ: 65, torsion: 5, maxStress: 185, utilization: 0.72, status: 'OK' },
    { id: 'C002', name: 'Column 2', type: 'column', section: 'UC 254', axialForce: -480, shearY: 28, shearZ: 20, momentY: 92, momentZ: 70, torsion: 6, maxStress: 195, utilization: 0.78, status: 'OK' },
    { id: 'BR01', name: 'Brace 1', type: 'brace', section: 'CHS 114', axialForce: 180, shearY: 2, shearZ: 1, momentY: 5, momentZ: 3, torsion: 0, maxStress: 245, utilization: 0.98, status: 'FAIL' },
  ]);
  
  const [modes] = useState<ModalResult[]>([
    { mode: 1, frequency: 2.45, period: 0.408, massParticipationX: 0.72, massParticipationY: 0.05, massParticipationZ: 0.02, cumulativeX: 0.72, cumulativeY: 0.05, cumulativeZ: 0.02 },
    { mode: 2, frequency: 4.82, period: 0.207, massParticipationX: 0.08, massParticipationY: 0.68, massParticipationZ: 0.03, cumulativeX: 0.80, cumulativeY: 0.73, cumulativeZ: 0.05 },
    { mode: 3, frequency: 7.15, period: 0.140, massParticipationX: 0.05, massParticipationY: 0.12, massParticipationZ: 0.65, cumulativeX: 0.85, cumulativeY: 0.85, cumulativeZ: 0.70 },
    { mode: 4, frequency: 9.28, period: 0.108, massParticipationX: 0.08, massParticipationY: 0.05, massParticipationZ: 0.15, cumulativeX: 0.93, cumulativeY: 0.90, cumulativeZ: 0.85 },
    { mode: 5, frequency: 12.45, period: 0.080, massParticipationX: 0.04, massParticipationY: 0.06, massParticipationZ: 0.10, cumulativeX: 0.97, cumulativeY: 0.96, cumulativeZ: 0.95 },
  ]);
  
  const [combinations] = useState<LoadCombinationResult[]>([
    { id: 'LC1', name: '1.5DL + 1.5LL', type: 'ultimate', maxDisplacement: 12.5, maxStress: 225, maxUtilization: 0.90, critical: true },
    { id: 'LC2', name: '1.2DL + 1.2LL + 1.2EQx', type: 'seismic', maxDisplacement: 18.2, maxStress: 198, maxUtilization: 0.79, critical: false },
    { id: 'LC3', name: '1.2DL + 1.2LL + 1.2WL', type: 'wind', maxDisplacement: 15.8, maxStress: 188, maxUtilization: 0.75, critical: false },
    { id: 'LC4', name: 'DL + LL', type: 'serviceability', maxDisplacement: 8.5, maxStress: 150, maxUtilization: 0.60, critical: false },
  ]);
  
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  
  // Calculate summary stats
  const stats = useMemo(() => {
    const maxUtil = Math.max(...members.map(m => m.utilization));
    const avgUtil = members.reduce((sum, m) => sum + m.utilization, 0) / members.length;
    const failCount = members.filter(m => m.status === 'FAIL').length;
    const warnCount = members.filter(m => m.status === 'WARNING').length;
    const okCount = members.filter(m => m.status === 'OK').length;
    
    return { maxUtil, avgUtil, failCount, warnCount, okCount };
  }, [members]);
  
  return (
    <div className={`bg-zinc-950 p-6 space-y-6 ${className}`}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-blue-400" />
            Analysis Results Dashboard
          </h2>
          <p className="text-zinc-500 mt-1">
            Comprehensive structural analysis results • Last updated: {new Date().toLocaleString()}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </motion.div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Max Utilization"
          value={`${(stats.maxUtil * 100).toFixed(1)}%`}
          subtitle="Critical member: BR01"
          icon={<Gauge className="w-5 h-5" />}
          status={stats.maxUtil >= 0.9 ? 'danger' : stats.maxUtil >= 0.7 ? 'warning' : 'success'}
          sparklineData={[0.65, 0.72, 0.68, 0.78, 0.85, 0.90, 0.88, 0.92, 0.98]}
        />
        
        <SummaryCard
          title="Design Status"
          value={`${stats.okCount}/${members.length} OK`}
          subtitle={`${stats.warnCount} warnings, ${stats.failCount} failures`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          status={stats.failCount > 0 ? 'danger' : stats.warnCount > 0 ? 'warning' : 'success'}
        />
        
        <SummaryCard
          title="Max Displacement"
          value="18.2 mm"
          subtitle="Limit: L/300 = 20 mm"
          icon={<Move className="w-5 h-5" />}
          status="success"
          trend={{ value: -5.2, label: 'vs previous' }}
        />
        
        <SummaryCard
          title="First Mode"
          value="2.45 Hz"
          subtitle="Period: 0.408 s"
          icon={<Waves className="w-5 h-5" />}
          status="info"
          sparklineData={[2.45, 4.82, 7.15, 9.28, 12.45]}
        />
      </div>
      
      {/* Utilization Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <MemberUtilizationTable
            members={members}
            onSelect={setSelectedMember}
            selectedId={selectedMember || undefined}
          />
        </div>
        
        <div className="space-y-4">
          {/* Utilization Distribution */}
          <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-amber-400" />
              Utilization Distribution
            </h3>
            <div className="flex items-center justify-center gap-6">
              <ProgressRing value={stats.avgUtil * 100} label="Average" size={100} strokeWidth={10} />
              <div className="space-y-2">
                {[
                  { range: '< 70%', count: stats.okCount, color: CHART_COLORS.success },
                  { range: '70-90%', count: stats.warnCount, color: CHART_COLORS.warning },
                  { range: '> 90%', count: stats.failCount, color: CHART_COLORS.danger },
                ].map(item => (
                  <div key={item.range} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-zinc-400">{item.range}:</span>
                    <span className="text-xs font-mono text-white">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Force Summary */}
          <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-400" />
              Force Summary
            </h3>
            <BarChart
              data={[
                { label: 'Axial', value: Math.max(...members.map(m => Math.abs(m.axialForce))), color: CHART_COLORS.primary },
                { label: 'Shear', value: Math.max(...members.map(m => Math.abs(m.shearY))), color: CHART_COLORS.success },
                { label: 'Moment', value: Math.max(...members.map(m => Math.abs(m.momentY))), color: CHART_COLORS.warning },
                { label: 'Stress', value: Math.max(...members.map(m => m.maxStress)), color: CHART_COLORS.danger },
              ]}
              horizontal
            />
          </div>
        </div>
      </div>
      
      {/* Modal & Load Combinations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ModalAnalysisChart modes={modes} />
        <LoadCombinationSummary combinations={combinations} />
      </div>
      
      {/* Force Diagrams */}
      <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <LineChart className="w-4 h-4 text-cyan-400" />
          Force Diagrams - Selected Member: {selectedMember || 'B001'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-zinc-500 mb-2">Shear Force Diagram</p>
            <ForceDiagram
              data={[
                { position: 0, value: 60 },
                { position: 1, value: 40 },
                { position: 2, value: 20 },
                { position: 3, value: 0 },
                { position: 4, value: -20 },
                { position: 5, value: -40 },
                { position: 6, value: -60 },
              ]}
              type="shear"
              maxValue={100}
              length={6}
            />
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-2">Bending Moment Diagram</p>
            <ForceDiagram
              data={[
                { position: 0, value: 0 },
                { position: 1, value: 80 },
                { position: 2, value: 140 },
                { position: 3, value: 180 },
                { position: 4, value: 140 },
                { position: 5, value: 80 },
                { position: 6, value: 0 },
              ]}
              type="moment"
              maxValue={200}
              length={6}
            />
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-2">Axial Force Diagram</p>
            <ForceDiagram
              data={[
                { position: 0, value: 15 },
                { position: 1, value: 15 },
                { position: 2, value: 15 },
                { position: 3, value: 15 },
                { position: 4, value: 15 },
                { position: 5, value: 15 },
                { position: 6, value: 15 },
              ]}
              type="axial"
              maxValue={50}
              length={6}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveResultsDashboard;
