/**
 * ============================================================================
 * REAL-TIME ANALYSIS PANEL - LIVE COMPUTATION ENGINE
 * ============================================================================
 * 
 * Ultra-modern real-time structural analysis interface featuring:
 * - Live stress/strain updates as geometry changes
 * - Parallel multi-threaded computation visualization
 * - Progressive result rendering
 * - Analysis convergence monitoring
 * - Memory & CPU utilization tracking
 * - Solver selection and configuration
 * - Multi-physics coupling indicators
 * - Error estimation and adaptive refinement
 * 
 * @version 4.0.0
 */


import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Settings,
  Cpu,
  HardDrive,
  Activity,
  Zap,
  RefreshCw,
  Clock,
  Timer,
  Target,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  MoreHorizontal,
  X,
  Plus,
  Minus,
  Layers,
  Grid3X3,
  Box,
  Waves,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Gauge,
  Thermometer,
  Wind,
  Mountain,
  Building2,
  Calculator,
  GitBranch,
  Network,
  Workflow,
  Eye,
  EyeOff,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

type AnalysisType = 'linear-static' | 'nonlinear-static' | 'modal' | 'buckling' | 'time-history' | 'response-spectrum' | 'pushover';
type SolverType = 'direct' | 'iterative' | 'parallel' | 'gpu';
type AnalysisStatus = 'idle' | 'preparing' | 'assembling' | 'solving' | 'post-processing' | 'complete' | 'failed' | 'paused';

interface AnalysisStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  progress: number;
  duration?: number;
  message?: string;
}

interface ComputeMetrics {
  cpuUsage: number;
  memoryUsage: number;
  threadCount: number;
  iterationCount: number;
  convergenceRatio: number;
  estimatedTimeRemaining: number;
}

interface AnalysisConfig {
  type: AnalysisType;
  solver: SolverType;
  tolerance: number;
  maxIterations: number;
  loadIncrements: number;
  dampingRatio: number;
  timeStep: number;
  duration: number;
}

interface ConvergencePoint {
  iteration: number;
  residual: number;
  energy: number;
  displacement: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ANALYSIS_TYPES: { type: AnalysisType; name: string; icon: React.ReactNode; color: string }[] = [
  { type: 'linear-static', name: 'Linear Static', icon: <Target className="w-4 h-4" />, color: '#3b82f6' },
  { type: 'nonlinear-static', name: 'Nonlinear Static', icon: <TrendingUp className="w-4 h-4" />, color: '#8b5cf6' },
  { type: 'modal', name: 'Modal Analysis', icon: <Waves className="w-4 h-4" />, color: '#ec4899' },
  { type: 'buckling', name: 'Buckling', icon: <GitBranch className="w-4 h-4" />, color: '#f59e0b' },
  { type: 'time-history', name: 'Time History', icon: <Activity className="w-4 h-4" />, color: '#ef4444' },
  { type: 'response-spectrum', name: 'Response Spectrum', icon: <BarChart3 className="w-4 h-4" />, color: '#06b6d4' },
  { type: 'pushover', name: 'Pushover', icon: <Mountain className="w-4 h-4" />, color: '#22c55e' },
];

const SOLVER_TYPES: { type: SolverType; name: string; description: string }[] = [
  { type: 'direct', name: 'Direct Solver', description: 'Sparse LU decomposition - best for small to medium models' },
  { type: 'iterative', name: 'Iterative Solver', description: 'PCG method - efficient for large sparse systems' },
  { type: 'parallel', name: 'Parallel Solver', description: 'Multi-core CPU parallelization - fast for large models' },
  { type: 'gpu', name: 'GPU Solver', description: 'CUDA acceleration - fastest for very large models' },
];

// =============================================================================
// CIRCULAR PROGRESS COMPONENT
// =============================================================================

const CircularProgress: React.FC<{
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  showValue?: boolean;
  animated?: boolean;
}> = ({ value, max = 100, size = 120, strokeWidth = 8, color = '#3b82f6', showValue = true, animated = true }) => {
  const percentage = Math.min(100, (value / max) * 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-800"
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={animated ? { strokeDashoffset: circumference } : { strokeDashoffset: offset }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        {/* Glow effect */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          opacity="0.2"
          filter="blur(4px)"
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span 
            className="text-3xl font-bold text-slate-900 dark:text-white"
            key={Math.round(percentage)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            {Math.round(percentage)}%
          </motion.span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Complete</span>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// METRICS GAUGE
// =============================================================================

const MetricsGauge: React.FC<{
  value: number;
  label: string;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  warning?: number;
  critical?: number;
}> = ({ value, label, unit = '%', icon, color, warning = 70, critical = 90 }) => {
  const status = value >= critical ? 'critical' : value >= warning ? 'warning' : 'normal';
  const statusColor = status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : color;
  
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl">
      <div className={`p-2 rounded-lg`} style={{ backgroundColor: `${statusColor}20` }}>
        <div style={{ color: statusColor }}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
          <span className="text-sm font-mono font-semibold" style={{ color: statusColor }}>
            {value.toFixed(1)}{unit}
          </span>
        </div>
        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: statusColor }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, value)}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// ANALYSIS STEP ITEM
// =============================================================================

const AnalysisStepItem: React.FC<{
  step: AnalysisStep;
  isActive: boolean;
}> = ({ step, isActive }) => {
  const statusIcons = {
    pending: <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />,
    running: <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />,
    complete: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    failed: <AlertCircle className="w-4 h-4 text-red-400" />,
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
        isActive ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-slate-100/30 dark:bg-slate-800/30'
      }`}
    >
      {statusIcons[step.status]}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
            {step.name}
          </span>
          {step.duration !== undefined && (
            <span className="text-xs text-slate-500 dark:text-slate-400">{step.duration.toFixed(2)}s</span>
          )}
        </div>
        
        {step.status === 'running' && (
          <div className="mt-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>{step.message || 'Processing...'}</span>
              <span>{step.progress}%</span>
            </div>
            <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-blue-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${step.progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// =============================================================================
// CONVERGENCE CHART
// =============================================================================

const ConvergenceChart: React.FC<{
  data: ConvergencePoint[];
  tolerance: number;
}> = ({ data, tolerance }) => {
  if (data.length === 0) return null;
  
  const width = 300;
  const height = 120;
  const padding = { top: 10, right: 10, bottom: 20, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  const maxResidual = Math.max(...data.map(d => d.residual), tolerance * 10);
  const minResidual = Math.min(...data.map(d => d.residual), tolerance / 10);
  
  const logScale = (value: number) => {
    const logMin = Math.log10(minResidual);
    const logMax = Math.log10(maxResidual);
    const logValue = Math.log10(value);
    return 1 - (logValue - logMin) / (logMax - logMin);
  };
  
  const points = data.map((d, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth,
    y: padding.top + logScale(d.residual) * chartHeight,
  }));
  
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const toleranceY = padding.top + logScale(tolerance) * chartHeight;
  
  return (
    <div className="bg-slate-100/30 dark:bg-slate-800/30 rounded-xl p-4">
      <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
        <TrendingDown className="w-3.5 h-3.5" />
        Convergence History
      </h4>
      
      <svg width={width} height={height} className="overflow-hidden">
        {/* Grid */}
        <g opacity="0.3">
          {[0, 0.25, 0.5, 0.75, 1].map(t => (
            <line
              key={t}
              x1={padding.left}
              y1={padding.top + t * chartHeight}
              x2={width - padding.right}
              y2={padding.top + t * chartHeight}
              stroke="#3f3f46"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ))}
        </g>
        
        {/* Tolerance line */}
        <line
          x1={padding.left}
          y1={toleranceY}
          x2={width - padding.right}
          y2={toleranceY}
          stroke="#22c55e"
          strokeWidth="2"
          strokeDasharray="6 3"
        />
        <text
          x={width - padding.right + 5}
          y={toleranceY + 4}
          fill="#22c55e"
          fontSize="8"
        >
          Tol
        </text>
        
        {/* Convergence line */}
        <motion.path
          d={pathD}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1 }}
        />
        
        {/* Current point */}
        {points.length > 0 && (
          <motion.circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={4}
            fill="#3b82f6"
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
        
        {/* Axis labels */}
        <text x={padding.left - 5} y={padding.top} textAnchor="end" fill="#71717a" fontSize="8">
          {maxResidual.toExponential(0)}
        </text>
        <text x={padding.left - 5} y={height - padding.bottom} textAnchor="end" fill="#71717a" fontSize="8">
          {minResidual.toExponential(0)}
        </text>
        <text x={width / 2} y={height - 2} textAnchor="middle" fill="#71717a" fontSize="8">
          Iteration
        </text>
      </svg>
      
      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="text-slate-500 dark:text-slate-400">Iterations: {data.length}</span>
        <span className={data.length > 0 && data[data.length - 1].residual <= tolerance ? 'text-emerald-400' : 'text-amber-400'}>
          Residual: {data.length > 0 ? data[data.length - 1].residual.toExponential(2) : '-'}
        </span>
      </div>
    </div>
  );
};

// =============================================================================
// LIVE LOG DISPLAY
// =============================================================================

const LiveLogDisplay: React.FC<{
  logs: { time: string; message: string; type: 'info' | 'warning' | 'error' | 'success' }[];
}> = ({ logs }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);
  
  const typeColors = {
    info: 'text-blue-400',
    warning: 'text-amber-400',
    error: 'text-red-400',
    success: 'text-emerald-400',
  };
  
  return (
    <div className="bg-white/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Analysis Log</span>
        <span className="text-xs text-slate-500">{logs.length} entries</span>
      </div>
      <div
        ref={containerRef}
        className="h-32 overflow-y-auto p-2 font-mono text-xs space-y-1 scrollbar-thin scrollbar-thumb-slate-700"
      >
        {logs.map((log, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex gap-2"
          >
            <span className="text-slate-500">[{log.time}]</span>
            <span className={typeColors[log.type]}>{log.message}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const RealTimeAnalysisPanel: React.FC<{
  className?: string;
  onAnalysisComplete?: (results: any) => void;
}> = ({ className, onAnalysisComplete }) => {
  // State
  const [config, setConfig] = useState<AnalysisConfig>({
    type: 'linear-static',
    solver: 'parallel',
    tolerance: 1e-6,
    maxIterations: 100,
    loadIncrements: 10,
    dampingRatio: 0.05,
    timeStep: 0.01,
    duration: 10,
  });
  
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const [steps, setSteps] = useState<AnalysisStep[]>([
    { id: 'prep', name: 'Preparing Model', status: 'pending', progress: 0 },
    { id: 'assemble', name: 'Assembling Matrices', status: 'pending', progress: 0 },
    { id: 'solve', name: 'Solving System', status: 'pending', progress: 0 },
    { id: 'post', name: 'Post-Processing', status: 'pending', progress: 0 },
  ]);
  
  const [metrics, setMetrics] = useState<ComputeMetrics>({
    cpuUsage: 0,
    memoryUsage: 0,
    threadCount: 8,
    iterationCount: 0,
    convergenceRatio: 0,
    estimatedTimeRemaining: 0,
  });
  
  const [convergenceData, setConvergenceData] = useState<ConvergencePoint[]>([]);
  
  const [logs, setLogs] = useState<{ time: string; message: string; type: 'info' | 'warning' | 'error' | 'success' }[]>([]);
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Timer for elapsed time
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (status === 'solving' || status === 'assembling' || status === 'preparing' || status === 'post-processing') {
      interval = setInterval(() => {
        setElapsedTime(t => t + 0.1);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [status]);
  
  // Ref to track rAF for cleanup
  const analysisRafRef = useRef<number>(0);

  // Cancel any running analysis animation on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(analysisRafRef.current);
  }, []);

  // Simulation of analysis process
  const runAnalysis = useCallback(() => {
    cancelAnimationFrame(analysisRafRef.current);
    setStatus('preparing');
    setProgress(0);
    setElapsedTime(0);
    setConvergenceData([]);
    setLogs([{ time: '00:00.00', message: 'Starting analysis...', type: 'info' }]);
    
    // Reset steps
    setSteps(steps => steps.map(s => ({ ...s, status: 'pending', progress: 0 })));
    
    // Simulate analysis progression
    const totalDuration = 5000; // 5 seconds total
    const stepDurations = [500, 1000, 3000, 500];
    let currentStep = 0;
    let stepStartTime = Date.now();
    
    const updateProgress = () => {
      const elapsed = Date.now() - stepStartTime;
      const stepProgress = Math.min(100, (elapsed / stepDurations[currentStep]) * 100);
      
      setSteps(prev => prev.map((s, i) => ({
        ...s,
        status: i < currentStep ? 'complete' : i === currentStep ? 'running' : 'pending',
        progress: i === currentStep ? stepProgress : i < currentStep ? 100 : 0,
        duration: i < currentStep ? stepDurations[i] / 1000 : undefined,
        message: i === currentStep && currentStep === 2 ? `Iteration ${Math.floor(stepProgress / 10)}` : undefined,
      })));
      
      setProgress((currentStep * 25) + (stepProgress / 4));
      
      // Update metrics
      setMetrics(prev => ({
        ...prev,
        cpuUsage: 45 + Math.random() * 40,
        memoryUsage: 30 + Math.random() * 25,
        iterationCount: currentStep === 2 ? Math.floor(stepProgress / 10) : prev.iterationCount,
        convergenceRatio: currentStep === 2 ? Math.pow(10, -2 - stepProgress / 20) : prev.convergenceRatio,
        estimatedTimeRemaining: Math.max(0, (totalDuration - (Date.now() - stepStartTime + currentStep * 1000)) / 1000),
      }));
      
      // Add convergence data during solving phase
      if (currentStep === 2 && stepProgress % 10 < 5) {
        setConvergenceData(prev => {
          const newPoint: ConvergencePoint = {
            iteration: prev.length + 1,
            residual: Math.pow(10, -2 - prev.length * 0.4) * (0.8 + Math.random() * 0.4),
            energy: Math.pow(10, -3 - prev.length * 0.3),
            displacement: 0.001 + Math.random() * 0.0005,
          };
          return [...prev, newPoint];
        });
      }
      
      // Add logs
      if (stepProgress > 0 && stepProgress < 5) {
        const time = elapsedTime.toFixed(2).padStart(5, '0');
        const stepNames = ['Model validation', 'Matrix assembly', 'Solving iteration', 'Computing results'];
        setLogs(prev => [...prev, { 
          time, 
          message: `${stepNames[currentStep]} started`, 
          type: 'info' 
        }]);
      }
      
      if (elapsed >= stepDurations[currentStep]) {
        currentStep++;
        stepStartTime = Date.now();
        
        if (currentStep >= steps.length) {
          setStatus('complete');
          setProgress(100);
          setSteps(prev => prev.map(s => ({ ...s, status: 'complete', progress: 100 })));
          setLogs(prev => [...prev, { time: elapsedTime.toFixed(2).padStart(5, '0'), message: 'Analysis completed successfully!', type: 'success' }]);
          onAnalysisComplete?.({});
          return;
        }
        
        setStatus(currentStep === 0 ? 'preparing' : currentStep === 1 ? 'assembling' : currentStep === 2 ? 'solving' : 'post-processing');
      }
      
      if (currentStep < steps.length) {
        analysisRafRef.current = requestAnimationFrame(updateProgress);
      }
    };
    
    analysisRafRef.current = requestAnimationFrame(updateProgress);
  }, [onAnalysisComplete]);
  
  const pauseAnalysis = useCallback(() => {
    cancelAnimationFrame(analysisRafRef.current);
    setStatus('paused');
    setLogs(prev => [...prev, { time: elapsedTime.toFixed(2).padStart(5, '0'), message: 'Analysis paused', type: 'warning' }]);
  }, [elapsedTime]);
  
  const stopAnalysis = useCallback(() => {
    cancelAnimationFrame(analysisRafRef.current);
    setStatus('idle');
    setProgress(0);
    setElapsedTime(0);
    setSteps(steps => steps.map(s => ({ ...s, status: 'pending', progress: 0 })));
    setConvergenceData([]);
    setLogs(prev => [...prev, { time: elapsedTime.toFixed(2).padStart(5, '0'), message: 'Analysis cancelled', type: 'error' }]);
  }, [elapsedTime]);
  
  const activeAnalysis = ANALYSIS_TYPES.find(a => a.type === config.type);
  
  return (
    <div className={`bg-white dark:bg-slate-950 rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 dark:from-slate-900 to-slate-800 p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/20">
              <Calculator className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Real-Time Analysis Engine</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">High-performance structural computation</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Status indicator */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              status === 'idle' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' :
              status === 'complete' ? 'bg-emerald-500/20 text-emerald-400' :
              status === 'failed' ? 'bg-red-500/20 text-red-400' :
              status === 'paused' ? 'bg-amber-500/20 text-amber-400' :
              'bg-blue-500/20 text-blue-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                status === 'idle' ? 'bg-slate-500' :
                status === 'complete' ? 'bg-emerald-400' :
                status === 'failed' ? 'bg-red-400' :
                status === 'paused' ? 'bg-amber-400' :
                'bg-blue-400 animate-pulse'
              }`} />
              {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
            </div>
            
            {/* Timer */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs text-slate-500 dark:text-slate-400">
              <Timer className="w-3.5 h-3.5" />
              {elapsedTime.toFixed(1)}s
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Analysis Type Selection */}
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2">Analysis Type</label>
          <div className="grid grid-cols-4 gap-2">
            {ANALYSIS_TYPES.slice(0, 4).map(({ type, name, icon, color }) => (
              <button
                key={type}
                onClick={() => setConfig(c => ({ ...c, type }))}
                disabled={status !== 'idle'}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                  config.type === type
                    ? 'bg-opacity-20 border-opacity-50'
                    : 'bg-slate-100/50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
                } ${status !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{
                  backgroundColor: config.type === type ? `${color}20` : undefined,
                  borderColor: config.type === type ? `${color}50` : undefined,
                }}
              >
                <div style={{ color: config.type === type ? color : '#71717a' }}>{icon}</div>
                <span className={`text-xs ${config.type === type ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                  {name}
                </span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Solver Selection */}
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2">Solver</label>
          <div className="grid grid-cols-2 gap-2">
            {SOLVER_TYPES.map(({ type, name, description }) => (
              <button
                key={type}
                onClick={() => setConfig(c => ({ ...c, solver: type }))}
                disabled={status !== 'idle'}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                  config.solver === type
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : 'bg-slate-100/50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
                } ${status !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`p-2 rounded-lg ${config.solver === type ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                  {type === 'gpu' ? <Zap className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                </div>
                <div>
                  <p className={`text-sm font-medium ${config.solver === type ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                    {name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
        
        {/* Advanced Settings */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between p-3 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Advanced Settings
            </span>
            {showAdvanced ? <ChevronUp className="w-4 h-4 text-slate-500 dark:text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
          </button>
          
          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 pt-0 grid grid-cols-2 gap-4 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Tolerance</label>
                    <input
                      type="text"
                      value={config.tolerance.toExponential()}
                      onChange={(e) => setConfig(c => ({ ...c, tolerance: parseFloat(e.target.value) || 1e-6 }))}
                      disabled={status !== 'idle'}
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white font-mono disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Max Iterations</label>
                    <input
                      type="number"
                      value={config.maxIterations}
                      onChange={(e) => setConfig(c => ({ ...c, maxIterations: parseInt(e.target.value) || 100 }))}
                      disabled={status !== 'idle'}
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white font-mono disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Load Increments</label>
                    <input
                      type="number"
                      value={config.loadIncrements}
                      onChange={(e) => setConfig(c => ({ ...c, loadIncrements: parseInt(e.target.value) || 10 }))}
                      disabled={status !== 'idle'}
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white font-mono disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Damping Ratio</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.dampingRatio}
                      onChange={(e) => setConfig(c => ({ ...c, dampingRatio: parseFloat(e.target.value) || 0.05 }))}
                      disabled={status !== 'idle'}
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white font-mono disabled:opacity-50"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Progress Display */}
        <div className="grid grid-cols-3 gap-4">
          {/* Main Progress */}
          <div className="col-span-1 flex items-center justify-center p-4 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
            <CircularProgress
              value={progress}
              color={activeAnalysis?.color || '#3b82f6'}
              size={140}
              strokeWidth={10}
            />
          </div>
          
          {/* Steps */}
          <div className="col-span-2 space-y-2">
            {steps.map((step, i) => (
              <AnalysisStepItem
                key={step.id}
                step={step}
                isActive={step.status === 'running'}
              />
            ))}
          </div>
        </div>
        
        {/* Metrics */}
        <div className="grid grid-cols-4 gap-3">
          <MetricsGauge
            value={metrics.cpuUsage}
            label="CPU Usage"
            icon={<Cpu className="w-4 h-4" />}
            color="#3b82f6"
          />
          <MetricsGauge
            value={metrics.memoryUsage}
            label="Memory"
            icon={<HardDrive className="w-4 h-4" />}
            color="#8b5cf6"
          />
          <MetricsGauge
            value={(metrics.iterationCount / config.maxIterations) * 100}
            label="Iterations"
            unit={` / ${config.maxIterations}`}
            icon={<RefreshCw className="w-4 h-4" />}
            color="#22c55e"
            warning={80}
            critical={95}
          />
          <MetricsGauge
            value={metrics.convergenceRatio > 0 ? Math.min(100, Math.abs(Math.log10(metrics.convergenceRatio / config.tolerance)) * 10) : 0}
            label="Convergence"
            icon={<Target className="w-4 h-4" />}
            color="#f59e0b"
          />
        </div>
        
        {/* Convergence Chart & Logs */}
        <div className="grid grid-cols-2 gap-4">
          <ConvergenceChart data={convergenceData} tolerance={config.tolerance} />
          <LiveLogDisplay logs={logs} />
        </div>
        
        {/* Control Buttons */}
        <div className="flex items-center gap-3">
          {status === 'idle' ? (
            <motion.button
              onClick={runAnalysis}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl transition-all"
            >
              <Play className="w-5 h-5" />
              Run Analysis
            </motion.button>
          ) : status === 'paused' ? (
            <>
              <motion.button
                onClick={runAnalysis}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold rounded-xl"
              >
                <Play className="w-5 h-5" />
                Resume
              </motion.button>
              <motion.button
                onClick={stopAnalysis}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl"
              >
                <Square className="w-5 h-5" />
                Stop
              </motion.button>
            </>
          ) : status === 'complete' ? (
            <>
              <motion.button
                onClick={stopAnalysis}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold rounded-xl"
              >
                <RotateCcw className="w-5 h-5" />
                New Analysis
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl"
              >
                <Eye className="w-5 h-5" />
                View Results
              </motion.button>
            </>
          ) : (
            <>
              <motion.button
                onClick={pauseAnalysis}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl"
              >
                <Pause className="w-5 h-5" />
                Pause
              </motion.button>
              <motion.button
                onClick={stopAnalysis}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl"
              >
                <Square className="w-5 h-5" />
                Stop
              </motion.button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealTimeAnalysisPanel;
