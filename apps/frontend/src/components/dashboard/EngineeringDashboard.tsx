/**
 * ============================================================================
 * ENGINEERING DASHBOARD V3.0
 * ============================================================================
 * 
 * A comprehensive, real-time dashboard for structural engineering analysis.
 * 
 * Features:
 * - Live calculation status
 * - Project overview
 * - Design code compliance
 * - Error monitoring
 * - Performance metrics
 * 
 * @version 3.0.0
 */


import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Building2,
  Calculator,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Compass,
  Database,
  FileText,
  Layers,
  LineChart,
  RefreshCw,
  Settings,
  Target,
  TrendingUp,
  XCircle,
  Zap,
  Shield,
  Info,
  HelpCircle,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface ProjectSummary {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: Date;
  lastModified: Date;
  designCode: string;
  buildingType: string;
  location: string;
  members: {
    beams: number;
    columns: number;
    slabs: number;
    foundations: number;
    walls: number;
  };
  analysisStatus: {
    structural: 'pending' | 'running' | 'completed' | 'failed';
    seismic: 'pending' | 'running' | 'completed' | 'failed' | 'not_applicable';
    foundation: 'pending' | 'running' | 'completed' | 'failed';
  };
}

export interface DesignCheck {
  id: string;
  name: string;
  category: 'strength' | 'serviceability' | 'stability' | 'detailing';
  status: 'pass' | 'fail' | 'warning' | 'pending';
  utilizationRatio?: number;
  reference: string;
  message?: string;
}

export interface CalculationMetrics {
  totalCalculations: number;
  successfulCalculations: number;
  failedCalculations: number;
  averageTime: number; // ms
  lastCalculation?: Date;
}

export interface SystemHealth {
  cpu: number;
  memory: number;
  activeEngines: string[];
  errors: Array<{
    code: string;
    message: string;
    timestamp: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

export interface DashboardProps {
  project?: ProjectSummary;
  designChecks?: DesignCheck[];
  metrics?: CalculationMetrics;
  systemHealth?: SystemHealth;
  onRefresh?: () => void;
  onProjectSelect?: (projectId: string) => void;
  onSettingsClick?: () => void;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const Card: React.FC<{
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}> = ({ title, icon, children, className = '', action }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`bg-[#131b2e] rounded-xl shadow-sm border border-[#1a2333] overflow-hidden ${className}`}
  >
    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {icon && <span className="text-blue-500">{icon}</span>}
        <h3 className="font-semibold text-[#dae2fd]">{title}</h3>
      </div>
      {action}
    </div>
    <div className="p-6">{children}</div>
  </motion.div>
);

const StatusBadge: React.FC<{
  status: 'pass' | 'fail' | 'warning' | 'pending' | 'running' | 'completed' | 'not_applicable';
  size?: 'sm' | 'md';
}> = ({ status, size = 'md' }) => {
  const config = {
    pass: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: CheckCircle },
    completed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: CheckCircle },
    fail: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: XCircle },
    failed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: XCircle },
    warning: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', icon: AlertTriangle },
    pending: { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-[#869ab8]', icon: Clock },
    running: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: RefreshCw },
    not_applicable: { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-500 dark:text-slate-500', icon: Info },
  };

  const { bg, text, icon: Icon } = config[status] || config.pending;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium tracking-wide ${bg} ${text} ${sizeClasses}`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      {status.replace('_', ' ').toUpperCase()}
    </span>
  );
};

const ProgressRing: React.FC<{
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}> = ({ value, max = 100, size = 80, strokeWidth = 8, color = '#3B82F6', label }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.min(value / max, 1);
  const offset = circumference - progress * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="text-slate-700 dark:text-slate-700"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <motion.circle
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-[#dae2fd]">
          {Math.round(value)}%
        </span>
        {label && <span className="text-xs text-slate-500">{label}</span>}
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: string;
}> = ({ title, value, unit, icon, trend, trendValue, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-500',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-500',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-500',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-500',
  };

  return (
    <div className="bg-[#131b2e] rounded-xl p-4 border border-[#1a2333]">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${
            trend === 'up' ? 'text-green-500' : 
            trend === 'down' ? 'text-red-500' : 'text-slate-500'
          }`}>
            <TrendingUp className={`w-4 h-4 ${trend === 'down' ? 'rotate-180' : ''}`} />
            {trendValue}
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-[#dae2fd]">{value}</span>
          {unit && <span className="text-sm text-slate-500">{unit}</span>}
        </div>
        <p className="text-sm text-[#869ab8] mt-1">{title}</p>
      </div>
    </div>
  );
};

const UtilizationBar: React.FC<{
  value: number;
  label: string;
  showValue?: boolean;
}> = ({ value, label, showValue = true }) => {
  const getColor = (v: number) => {
    if (v <= 0.6) return 'bg-green-500';
    if (v <= 0.8) return 'bg-yellow-500';
    if (v <= 1.0) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#869ab8]">{label}</span>
        {showValue && (
          <span className="font-medium tracking-wide text-[#dae2fd]">
            {(value * 100).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(value * 100, 100)}%` }}
          transition={{ duration: 0.5 }}
          className={`h-full rounded-full ${getColor(value)}`}
        />
      </div>
    </div>
  );
};

// ============================================================================
// DASHBOARD SECTIONS
// ============================================================================

const ProjectOverview: React.FC<{ project: ProjectSummary }> = ({ project }) => (
  <Card 
    title="Project Overview" 
    icon={<Building2 className="w-5 h-5" />}
    action={
      <button type="button" className="text-sm text-blue-500 hover:text-blue-600 font-medium tracking-wide">
        Edit
      </button>
    }
  >
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-[#869ab8]">Project Name</p>
          <p className="font-medium tracking-wide text-[#dae2fd]">{project.name}</p>
        </div>
        <div>
          <p className="text-sm text-[#869ab8]">Design Code</p>
          <p className="font-medium tracking-wide text-[#dae2fd]">{project.designCode}</p>
        </div>
        <div>
          <p className="text-sm text-[#869ab8]">Building Type</p>
          <p className="font-medium tracking-wide text-[#dae2fd]">{project.buildingType}</p>
        </div>
        <div>
          <p className="text-sm text-[#869ab8]">Location</p>
          <p className="font-medium tracking-wide text-[#dae2fd]">{project.location}</p>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
        <p className="text-sm font-medium tracking-wide text-[#adc6ff] mb-3">Structural Members</p>
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(project.members).map(([type, count]) => (
            <div key={type} className="text-center p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <p className="text-lg font-bold text-[#dae2fd]">{count}</p>
              <p className="text-xs text-slate-500 capitalize">{type}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
        <p className="text-sm font-medium tracking-wide text-[#adc6ff] mb-3">Analysis Status</p>
        <div className="space-y-2">
          {Object.entries(project.analysisStatus).map(([type, status]) => (
            <div key={type} className="flex items-center justify-between">
              <span className="text-sm text-[#869ab8] capitalize">
                {type.replace('_', ' ')} Analysis
              </span>
              <StatusBadge status={status as any} size="sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </Card>
);

const DesignChecksPanel: React.FC<{ checks: DesignCheck[] }> = ({ checks }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  
  const categories = ['strength', 'serviceability', 'stability', 'detailing'] as const;
  const groupedChecks = useMemo(() => {
    return categories.reduce((acc, cat) => {
      acc[cat] = checks.filter(c => c.category === cat);
      return acc;
    }, {} as Record<string, DesignCheck[]>);
  }, [checks]);

  const overallStatus = useMemo(() => {
    const hasFailed = checks.some(c => c.status === 'fail');
    const hasWarning = checks.some(c => c.status === 'warning');
    const hasPending = checks.some(c => c.status === 'pending');
    
    if (hasFailed) return { status: 'fail', text: 'Failed', color: 'red' };
    if (hasWarning) return { status: 'warning', text: 'Warnings', color: 'yellow' };
    if (hasPending) return { status: 'pending', text: 'Pending', color: 'gray' };
    return { status: 'pass', text: 'All Passed', color: 'green' };
  }, [checks]);

  return (
    <Card 
      title="Design Checks" 
      icon={<Shield className="w-5 h-5" />}
      action={
        <StatusBadge status={overallStatus.status as any} size="sm" />
      }
    >
      <div className="space-y-4">
        {categories.map(category => {
          const categoryChecks = groupedChecks[category] || [];
          const passed = categoryChecks.filter(c => c.status === 'pass').length;
          const total = categoryChecks.length;
          const isExpanded = expanded === category;

          return (
            <div key={category} className="border border-[#1a2333] rounded-lg overflow-hidden">
              <button type="button"
                onClick={() => setExpanded(isExpanded ? null : category)}
                className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="capitalize font-medium tracking-wide text-[#dae2fd]">
                    {category}
                  </span>
                  <span className={`text-sm px-2 py-0.5 rounded-full ${
                    passed === total 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {passed}/{total}
                  </span>
                </div>
                <ChevronRight className={`w-5 h-5 text-[#869ab8] transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </button>
              
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 space-y-3">
                      {categoryChecks.map(check => (
                        <div key={check.id} className="flex items-start justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium tracking-wide text-[#dae2fd]">
                                {check.name}
                              </span>
                              <span className="text-xs text-slate-500">({check.reference})</span>
                            </div>
                            {check.utilizationRatio !== undefined && (
                              <div className="mt-1 w-48">
                                <UtilizationBar value={check.utilizationRatio} label="" showValue />
                              </div>
                            )}
                            {check.message && (
                              <p className="text-xs text-slate-500 mt-1">{check.message}</p>
                            )}
                          </div>
                          <StatusBadge status={check.status} size="sm" />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

const CalculationMetricsPanel: React.FC<{ metrics: CalculationMetrics }> = ({ metrics }) => {
  const successRate = metrics.totalCalculations > 0
    ? (metrics.successfulCalculations / metrics.totalCalculations) * 100
    : 0;

  return (
    <Card title="Calculation Metrics" icon={<Calculator className="w-5 h-5" />}>
      <div className="flex items-center justify-between mb-6">
        <ProgressRing
          value={successRate}
          color={successRate >= 95 ? '#22C55E' : successRate >= 80 ? '#EAB308' : '#EF4444'}
          label="Success"
        />
        <div className="flex-1 ml-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Total Calculations</span>
            <span className="font-medium tracking-wide text-[#dae2fd]">{metrics.totalCalculations}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Successful</span>
            <span className="font-medium tracking-wide text-green-600">{metrics.successfulCalculations}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Failed</span>
            <span className="font-medium tracking-wide text-red-600">{metrics.failedCalculations}</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-700">
        <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div className="flex items-center justify-center gap-1 text-blue-500">
            <Clock className="w-4 h-4" />
            <span className="font-bold">{metrics.averageTime.toFixed(0)}</span>
            <span className="text-sm">ms</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Avg. Calc Time</p>
        </div>
        <div className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div className="text-sm text-[#869ab8]">
            {metrics.lastCalculation 
              ? new Date(metrics.lastCalculation).toLocaleTimeString()
              : 'N/A'
            }
          </div>
          <p className="text-xs text-slate-500 mt-1">Last Calculation</p>
        </div>
      </div>
    </Card>
  );
};

const SystemHealthPanel: React.FC<{ health: SystemHealth }> = ({ health }) => (
  <Card title="System Health" icon={<Activity className="w-5 h-5" />}>
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-slate-500 mb-2">CPU Usage</p>
          <UtilizationBar value={health.cpu / 100} label="" />
        </div>
        <div>
          <p className="text-sm text-slate-500 mb-2">Memory</p>
          <UtilizationBar value={health.memory / 100} label="" />
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
        <p className="text-sm font-medium tracking-wide text-[#adc6ff] mb-2">Active Engines</p>
        <div className="flex flex-wrap gap-2">
          {health.activeEngines.length > 0 ? (
            health.activeEngines.map(engine => (
              <span 
                key={engine}
                className="px-2 py-1 text-xs font-medium tracking-wide bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded"
              >
                {engine}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">No active engines</span>
          )}
        </div>
      </div>

      {health.errors.length > 0 && (
        <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <p className="text-sm font-medium tracking-wide text-red-600">Recent Errors ({health.errors.length})</p>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {health.errors.slice(0, 5).map((error, idx) => (
              <div 
                key={idx}
                className={`px-3 py-2 rounded text-sm ${
                  error.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30' :
                  error.severity === 'high' ? 'bg-orange-100 dark:bg-orange-900/30' :
                  'bg-yellow-100 dark:bg-yellow-900/30'
                }`}
              >
                <div className="font-medium tracking-wide text-[#dae2fd]">[{error.code}] {error.message}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {new Date(error.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </Card>
);

const QuickActions: React.FC<{
  onNewProject?: () => void;
  onRunAnalysis?: () => void;
  onGenerateReport?: () => void;
  onExport?: () => void;
}> = ({ onNewProject, onRunAnalysis, onGenerateReport, onExport }) => {
  const actions = [
    { icon: Building2, label: 'New Project', onClick: onNewProject, color: 'blue' },
    { icon: Zap, label: 'Run Analysis', onClick: onRunAnalysis, color: 'green' },
    { icon: FileText, label: 'Generate Report', onClick: onGenerateReport, color: 'purple' },
    { icon: Database, label: 'Export Data', onClick: onExport, color: 'orange' },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {actions.map(({ icon: Icon, label, onClick, color }) => (
        <motion.button
          key={label}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onClick}
          className={`p-4 rounded-xl border-2 border-dashed transition-colors hover:border-${color}-400 dark:hover:border-${color}-500
            border-[#1a2333] hover:bg-${color}-50 dark:hover:bg-${color}-900/20`}
        >
          <Icon className={`w-6 h-6 mx-auto mb-2 text-${color}-500`} />
          <span className="text-sm font-medium tracking-wide text-[#adc6ff]">{label}</span>
        </motion.button>
      ))}
    </div>
  );
};

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export const EngineeringDashboard: React.FC<DashboardProps> = ({
  project,
  designChecks = [],
  metrics,
  systemHealth,
  onRefresh,
  onProjectSelect,
  onSettingsClick,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return;
      setCurrentTime(new Date());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [onRefresh]);

  // Default data for demo
  const defaultProject: ProjectSummary = project || {
    id: 'demo-1',
    name: 'Commercial Office Building',
    status: 'active',
    createdAt: new Date('2025-01-01'),
    lastModified: new Date(),
    designCode: 'IS 456:2000 + IS 800:2007',
    buildingType: 'G+5 Commercial',
    location: 'Mumbai, India',
    members: { beams: 156, columns: 48, slabs: 36, foundations: 48, walls: 24 },
    analysisStatus: {
      structural: 'completed',
      seismic: 'completed',
      foundation: 'running',
    },
  };

  const defaultMetrics: CalculationMetrics = metrics || {
    totalCalculations: 2847,
    successfulCalculations: 2834,
    failedCalculations: 13,
    averageTime: 127,
    lastCalculation: new Date(),
  };

  const defaultHealth: SystemHealth = systemHealth || {
    cpu: 45,
    memory: 62,
    activeEngines: ['Foundation', 'Steel', 'Concrete', 'Seismic'],
    errors: [],
  };

  const defaultChecks: DesignCheck[] = designChecks.length > 0 ? designChecks : [
    { id: '1', name: 'Beam Flexural Capacity', category: 'strength', status: 'pass', utilizationRatio: 0.76, reference: 'IS 456 Cl. 38' },
    { id: '2', name: 'Column Axial + Bending', category: 'strength', status: 'pass', utilizationRatio: 0.82, reference: 'IS 456 Cl. 39' },
    { id: '3', name: 'Shear Capacity', category: 'strength', status: 'warning', utilizationRatio: 0.91, reference: 'IS 456 Cl. 40', message: 'Near capacity limit' },
    { id: '4', name: 'Deflection Limit', category: 'serviceability', status: 'pass', utilizationRatio: 0.65, reference: 'IS 456 Cl. 23.2' },
    { id: '5', name: 'Crack Width', category: 'serviceability', status: 'pass', utilizationRatio: 0.58, reference: 'IS 456 Cl. 35.3' },
    { id: '6', name: 'Story Drift', category: 'stability', status: 'pass', utilizationRatio: 0.72, reference: 'IS 1893 Cl. 7.11' },
    { id: '7', name: 'P-Delta Effects', category: 'stability', status: 'pass', utilizationRatio: 0.45, reference: 'IS 1893 Cl. 7.10' },
    { id: '8', name: 'Reinforcement Spacing', category: 'detailing', status: 'pass', utilizationRatio: 0.88, reference: 'IS 456 Cl. 26.3' },
    { id: '9', name: 'Cover Requirements', category: 'detailing', status: 'pass', utilizationRatio: 0.5, reference: 'IS 456 Cl. 26.4' },
  ];

  return (
    <div className="min-h-screen bg-[#0b1326]">
      {/* Header */}
      <header className="bg-[#131b2e] border-b border-[#1a2333] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#dae2fd]">
                  StructuralAI Dashboard
                </h1>
                <p className="text-sm text-slate-500">
                  Real-time structural engineering analysis
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">
                {currentTime.toLocaleTimeString()}
              </span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRefresh}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <RefreshCw className={`w-5 h-5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
              </motion.button>
              <button type="button"
                onClick={onSettingsClick}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <Settings className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick Actions */}
        <section className="mb-8">
          <QuickActions />
        </section>

        {/* Metrics Row */}
        <section className="grid grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Members"
            value={Object.values(defaultProject.members).reduce((a, b) => a + b, 0)}
            icon={<Layers className="w-5 h-5" />}
            color="blue"
          />
          <MetricCard
            title="Design Checks Passed"
            value={`${defaultChecks.filter(c => c.status === 'pass').length}/${defaultChecks.length}`}
            icon={<CheckCircle className="w-5 h-5" />}
            color="green"
          />
          <MetricCard
            title="Avg. Utilization"
            value={(defaultChecks.reduce((acc, c) => acc + (c.utilizationRatio || 0), 0) / defaultChecks.length * 100).toFixed(0)}
            unit="%"
            icon={<Target className="w-5 h-5" />}
            color="yellow"
          />
          <MetricCard
            title="Calculation Time"
            value={defaultMetrics.averageTime}
            unit="ms"
            icon={<Zap className="w-5 h-5" />}
            color="purple"
            trend="down"
            trendValue="-12%"
          />
        </section>

        {/* Main Grid */}
        <section className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <ProjectOverview project={defaultProject} />
            <DesignChecksPanel checks={defaultChecks} />
          </div>
          <div className="space-y-6">
            <CalculationMetricsPanel metrics={defaultMetrics} />
            <SystemHealthPanel health={defaultHealth} />
          </div>
        </section>
      </main>
    </div>
  );
};

export default EngineeringDashboard;
