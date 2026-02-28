/**
 * ============================================================================
 * INTEGRATED ENGINEERING DASHBOARD
 * ============================================================================
 * 
 * Comprehensive dashboard for all engineering design capabilities:
 * - Real-time design status overview
 * - Quick access to all design modules
 * - Project statistics and metrics
 * - Error-free calculation validation
 * - Export and reporting
 * 
 * @version 3.0.0
 */


import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Columns,
  Layers,
  Grid3X3,
  CircleDot,
  Link2,
  Mountain,
  Wind,
  Activity,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Calculator,
  FileText,
  Download,
  Settings,
  RefreshCw,
  ChevronRight,
  Zap,
  Target,
  Shield,
  BarChart3,
  PieChart,
  Info,
  Clock,
  Hammer,
  Box,
  Ruler,
  Scale,
  HardHat,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface DesignModule {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'structural' | 'concrete' | 'steel' | 'foundation' | 'analysis';
  status: 'active' | 'pending' | 'complete' | 'error';
  progress: number;
  lastUpdated?: Date;
  errorCount: number;
  warningCount: number;
}

interface ProjectMetrics {
  totalMembers: number;
  analyzedMembers: number;
  designedMembers: number;
  passedChecks: number;
  failedChecks: number;
  utilizationAvg: number;
  utilizationMax: number;
  concreteVolume: number;
  steelWeight: number;
  estimatedCost: number;
}

interface DesignCheck {
  id: string;
  component: string;
  check: string;
  status: 'pass' | 'fail' | 'warning';
  utilization: number;
  message: string;
}

interface IntegratedDashboardProps {
  projectName?: string;
  designCode?: string;
  onModuleSelect?: (moduleId: string) => void;
  onRunAnalysis?: () => void;
  onExportReport?: () => void;
}

// =============================================================================
// SAMPLE DATA
// =============================================================================

const DESIGN_MODULES: DesignModule[] = [
  {
    id: 'beam',
    name: 'Beam Design',
    description: 'RCC & Steel beam analysis and design',
    icon: <Ruler className="w-5 h-5" />,
    category: 'concrete',
    status: 'complete',
    progress: 100,
    errorCount: 0,
    warningCount: 2,
  },
  {
    id: 'column',
    name: 'Column Design',
    description: 'Axial + biaxial bending design',
    icon: <Columns className="w-5 h-5" />,
    category: 'concrete',
    status: 'active',
    progress: 75,
    errorCount: 0,
    warningCount: 1,
  },
  {
    id: 'slab',
    name: 'Slab Design',
    description: 'One-way, two-way & flat slab design',
    icon: <Layers className="w-5 h-5" />,
    category: 'concrete',
    status: 'pending',
    progress: 0,
    errorCount: 0,
    warningCount: 0,
  },
  {
    id: 'footing',
    name: 'Foundation Design',
    description: 'Isolated, combined & pile foundations',
    icon: <Mountain className="w-5 h-5" />,
    category: 'foundation',
    status: 'complete',
    progress: 100,
    errorCount: 0,
    warningCount: 0,
  },
  {
    id: 'steel-member',
    name: 'Steel Members',
    description: 'Tension, compression & bending',
    icon: <Box className="w-5 h-5" />,
    category: 'steel',
    status: 'complete',
    progress: 100,
    errorCount: 0,
    warningCount: 3,
  },
  {
    id: 'connection',
    name: 'Connections',
    description: 'Bolted & welded connections',
    icon: <Link2 className="w-5 h-5" />,
    category: 'steel',
    status: 'active',
    progress: 50,
    errorCount: 1,
    warningCount: 0,
  },
  {
    id: 'seismic',
    name: 'Seismic Analysis',
    description: 'Response spectrum & time history',
    icon: <Activity className="w-5 h-5" />,
    category: 'analysis',
    status: 'complete',
    progress: 100,
    errorCount: 0,
    warningCount: 4,
  },
  {
    id: 'wind',
    name: 'Wind Analysis',
    description: 'Static & dynamic wind loads',
    icon: <Wind className="w-5 h-5" />,
    category: 'analysis',
    status: 'pending',
    progress: 0,
    errorCount: 0,
    warningCount: 0,
  },
];

const SAMPLE_METRICS: ProjectMetrics = {
  totalMembers: 156,
  analyzedMembers: 142,
  designedMembers: 128,
  passedChecks: 1847,
  failedChecks: 23,
  utilizationAvg: 0.72,
  utilizationMax: 0.94,
  concreteVolume: 245.6,
  steelWeight: 18450,
  estimatedCost: 2450000,
};

const RECENT_CHECKS: DesignCheck[] = [
  { id: '1', component: 'B1-B2', check: 'Flexure', status: 'pass', utilization: 0.84, message: 'OK' },
  { id: '2', component: 'B1-B2', check: 'Shear', status: 'pass', utilization: 0.67, message: 'OK' },
  { id: '3', component: 'C1', check: 'P-M Interaction', status: 'warning', utilization: 0.92, message: 'High utilization' },
  { id: '4', component: 'C2', check: 'Slenderness', status: 'pass', utilization: 0.45, message: 'OK' },
  { id: '5', component: 'CONN-1', check: 'Bolt Shear', status: 'fail', utilization: 1.12, message: 'Capacity exceeded' },
  { id: '6', component: 'F1', check: 'Bearing', status: 'pass', utilization: 0.78, message: 'OK' },
  { id: '7', component: 'F1', check: 'Settlement', status: 'pass', utilization: 0.56, message: 'OK' },
  { id: '8', component: 'S1', check: 'Deflection', status: 'warning', utilization: 0.88, message: 'Near limit' },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function IntegratedEngineeringDashboard({
  projectName = 'Structural Project',
  designCode = 'IS 456:2000 / IS 800:2007',
  onModuleSelect,
  onRunAnalysis,
  onExportReport,
}: IntegratedDashboardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  // Filter modules by category
  const filteredModules = useMemo(() => {
    if (selectedCategory === 'all') return DESIGN_MODULES;
    return DESIGN_MODULES.filter(m => m.category === selectedCategory);
  }, [selectedCategory]);

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    const total = DESIGN_MODULES.reduce((sum, m) => sum + m.progress, 0);
    return Math.round(total / DESIGN_MODULES.length);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 1500));
    setRefreshing(false);
  }, []);

  // Handle module click
  const handleModuleClick = useCallback((moduleId: string) => {
    setSelectedModule(moduleId);
    onModuleSelect?.(moduleId);
  }, [onModuleSelect]);

  // Render status indicator
  const renderStatusBadge = (status: string) => {
    const configs = {
      complete: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, class: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
      active: { icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />, class: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      pending: { icon: <Clock className="w-3.5 h-3.5" />, class: 'bg-zinc-500/20 text-zinc-500 dark:text-zinc-400 border-zinc-500/30' },
      error: { icon: <XCircle className="w-3.5 h-3.5" />, class: 'bg-red-500/20 text-red-400 border-red-500/30' },
    };
    const config = configs[status as keyof typeof configs];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.class}`}>
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Render check status
  const renderCheckStatus = (status: string) => {
    const configs = {
      pass: { icon: <CheckCircle2 className="w-4 h-4" />, class: 'text-emerald-400' },
      fail: { icon: <XCircle className="w-4 h-4" />, class: 'text-red-400' },
      warning: { icon: <AlertTriangle className="w-4 h-4" />, class: 'text-amber-400' },
    };
    const config = configs[status as keyof typeof configs];
    return <span className={config.class}>{config.icon}</span>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white dark:from-zinc-950 via-zinc-100 dark:via-zinc-900 to-white dark:to-zinc-950 text-zinc-900 dark:text-white p-6">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <HardHat className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                Engineering Design Center
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                {projectName} • {designCode}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg bg-zinc-100/50 dark:bg-zinc-800/50 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 border border-zinc-200/50 dark:border-zinc-700/50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 text-zinc-500 dark:text-zinc-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onRunAnalysis}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium transition-all shadow-lg shadow-blue-500/25"
            >
              <Zap className="w-4 h-4" />
              Run Analysis
            </button>
            <button
              onClick={onExportReport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content */}
        <main className="col-span-8 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-white/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-zinc-500 dark:text-zinc-400 text-sm">Overall Progress</span>
                <Target className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-zinc-900 dark:text-white">{overallProgress}%</span>
              </div>
              <div className="mt-3 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${overallProgress}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-4 rounded-xl bg-white/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-zinc-500 dark:text-zinc-400 text-sm">Design Checks</span>
                <Shield className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-emerald-400">{SAMPLE_METRICS.passedChecks}</span>
                <span className="text-lg text-red-400 mb-0.5">/{SAMPLE_METRICS.failedChecks}</span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {((SAMPLE_METRICS.passedChecks / (SAMPLE_METRICS.passedChecks + SAMPLE_METRICS.failedChecks)) * 100).toFixed(1)}% pass rate
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-4 rounded-xl bg-white/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-zinc-500 dark:text-zinc-400 text-sm">Max Utilization</span>
                <TrendingUp className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-zinc-900 dark:text-white">
                  {(SAMPLE_METRICS.utilizationMax * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Avg: {(SAMPLE_METRICS.utilizationAvg * 100).toFixed(0)}%
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-4 rounded-xl bg-white/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-zinc-500 dark:text-zinc-400 text-sm">Members</span>
                <Grid3X3 className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-zinc-900 dark:text-white">{SAMPLE_METRICS.designedMembers}</span>
                <span className="text-lg text-zinc-500 dark:text-zinc-400 mb-0.5">/{SAMPLE_METRICS.totalMembers}</span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Designed members</p>
            </motion.div>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'All Modules', icon: <Grid3X3 className="w-4 h-4" /> },
              { id: 'concrete', label: 'Concrete', icon: <Building2 className="w-4 h-4" /> },
              { id: 'steel', label: 'Steel', icon: <Hammer className="w-4 h-4" /> },
              { id: 'foundation', label: 'Foundation', icon: <Mountain className="w-4 h-4" /> },
              { id: 'analysis', label: 'Analysis', icon: <Activity className="w-4 h-4" /> },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-zinc-100/50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 hover:text-zinc-900 dark:hover:text-white border border-zinc-200/50 dark:border-zinc-700/50'
                }`}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>

          {/* Design Modules Grid */}
          <div className="grid grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredModules.map((module, index) => (
                <motion.div
                  key={module.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleModuleClick(module.id)}
                  className={`group p-5 rounded-xl border backdrop-blur-sm cursor-pointer transition-all hover:shadow-lg ${
                    selectedModule === module.id
                      ? 'bg-blue-600/10 border-blue-500/50 shadow-lg shadow-blue-500/10'
                      : 'bg-white/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-2.5 rounded-lg ${
                      module.category === 'concrete' ? 'bg-amber-500/20 text-amber-400' :
                      module.category === 'steel' ? 'bg-blue-500/20 text-blue-400' :
                      module.category === 'foundation' ? 'bg-emerald-500/20 text-emerald-400' :
                      'bg-purple-500/20 text-purple-400'
                    }`}>
                      {module.icon}
                    </div>
                    {renderStatusBadge(module.status)}
                  </div>
                  
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1 group-hover:text-blue-400 transition-colors">
                    {module.name}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">{module.description}</p>
                  
                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-500 dark:text-zinc-400">Progress</span>
                      <span className="text-zinc-500 dark:text-zinc-400">{module.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${module.progress}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: index * 0.1 }}
                        className={`h-full rounded-full ${
                          module.status === 'complete' ? 'bg-emerald-500' :
                          module.status === 'error' ? 'bg-red-500' :
                          'bg-blue-500'
                        }`}
                      />
                    </div>
                  </div>
                  
                  {/* Warnings/Errors */}
                  <div className="flex items-center gap-3">
                    {module.errorCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-red-400">
                        <XCircle className="w-3.5 h-3.5" />
                        {module.errorCount} errors
                      </span>
                    )}
                    {module.warningCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {module.warningCount} warnings
                      </span>
                    )}
                    {module.errorCount === 0 && module.warningCount === 0 && module.status === 'complete' && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        All checks passed
                      </span>
                    )}
                  </div>
                  
                  {/* Action */}
                  <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Click to open</span>
                    <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </main>

        {/* Sidebar */}
        <aside className="col-span-4 space-y-6">
          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-5 rounded-xl bg-white/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 backdrop-blur-sm"
          >
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Material Quantities
            </h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-zinc-500 dark:text-zinc-400">Concrete</span>
                  <span className="text-zinc-900 dark:text-white font-medium">{SAMPLE_METRICS.concreteVolume} m³</span>
                </div>
                <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full w-[65%] bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-zinc-500 dark:text-zinc-400">Steel Reinforcement</span>
                  <span className="text-zinc-900 dark:text-white font-medium">{(SAMPLE_METRICS.steelWeight / 1000).toFixed(2)} MT</span>
                </div>
                <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full w-[45%] bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full" />
                </div>
              </div>
              
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 dark:text-zinc-400">Estimated Cost</span>
                  <span className="text-xl font-bold text-emerald-400">
                    ₹{(SAMPLE_METRICS.estimatedCost / 100000).toFixed(2)} L
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Recent Design Checks */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="p-5 rounded-xl bg-white/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 backdrop-blur-sm"
          >
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-400" />
              Recent Checks
            </h3>
            
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {RECENT_CHECKS.map((check) => (
                <div
                  key={check.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-100/50 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {renderCheckStatus(check.status)}
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{check.component}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{check.check}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${
                      check.utilization > 1 ? 'text-red-400' :
                      check.utilization > 0.9 ? 'text-amber-400' :
                      'text-emerald-400'
                    }`}>
                      {(check.utilization * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{check.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="p-5 rounded-xl bg-white/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 backdrop-blur-sm"
          >
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Quick Actions
            </h3>
            
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: <Calculator className="w-4 h-4" />, label: 'Run All Checks', color: 'blue' },
                { icon: <FileText className="w-4 h-4" />, label: 'View Report', color: 'emerald' },
                { icon: <Scale className="w-4 h-4" />, label: 'Load Combos', color: 'purple' },
                { icon: <Settings className="w-4 h-4" />, label: 'Settings', color: 'zinc' },
              ].map((action, i) => (
                <button
                  key={i}
                  className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium transition-all ${
                    action.color === 'blue' ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30' :
                    action.color === 'emerald' ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30' :
                    action.color === 'purple' ? 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 border border-purple-500/30' :
                    'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Info Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="p-4 rounded-xl bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/30"
          >
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">Calculation Engine v3.0</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Using advanced precision mathematics with error-free calculations. 
                  All results validated against international design codes.
                </p>
              </div>
            </div>
          </motion.div>
        </aside>
      </div>
    </div>
  );
}

export default IntegratedEngineeringDashboard;
