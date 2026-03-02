/**
 * ============================================================================
 * COMPREHENSIVE STRUCTURAL ENGINEERING DASHBOARD
 * ============================================================================
 * 
 * Complete structural engineering calculation interface with all element types:
 * - RC Design: Beams, Columns, Slabs, Footings (IS 456:2000)
 * - Steel Design: Beams, Connections, Base Plates (IS 800:2007)
 * - Seismic Analysis: Equivalent Static, Response Spectrum (IS 1893:2016)
 * 
 * @version 2.0.0
 * @author BeamLab Engineering
 */


import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator,
  FileText,
  BarChart3,
  Settings,
  HelpCircle,
  BookOpen,
  Layers,
  Box,
  Columns,
  Building2,
  ChevronRight,
  ChevronDown,
  Search,
  Star,
  Clock,
  TrendingUp,
  Grid3X3,
  CircleDot,
  Wrench,
  Activity,
  Shield,
  Download,
  Share2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Wind,
  Ruler,
  LayoutGrid,
  ArrowDownUp,
  LineChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Import structural components
import { StructuralCalculator } from '@/components/structural/StructuralCalculator';
import type { CalculationType, DesignCodeType, CalculationResult, CalculationInput } from '@/components/structural/StructuralCalculator';
import { BeamCrossSection, MomentDiagram, ShearDiagram, InteractionDiagram } from '@/components/structural/StructuralDiagrams';
import { CalculationReport } from '@/components/structural/CalculationReport';
import type { ReportData } from '@/components/structural/CalculationReport';

// Import calculation functions for direct use
import { AVAILABLE_CALCULATIONS } from '@/components/structural/CalculationEngine';

// ============================================================================
// TYPES
// ============================================================================

interface RecentCalculation {
  id: string;
  type: string;
  code: DesignCodeType;
  timestamp: Date;
  status: 'OK' | 'WARNING' | 'FAIL';
  utilization: number;
  projectName?: string;
}

interface NavItem {
  type: string;
  label: string;
  code: DesignCodeType;
  description?: string;
}

interface NavCategory {
  category: string;
  icon: React.ElementType;
  color: string;
  items: NavItem[];
}

// ============================================================================
// NAVIGATION STRUCTURE
// ============================================================================

const NAVIGATION_ITEMS: NavCategory[] = [
  {
    category: 'RC Design (IS 456)',
    icon: Box,
    color: 'blue',
    items: [
      { type: 'beam_design', label: 'Beam Design', code: 'IS_456', description: 'Flexure, shear, deflection' },
      { type: 'column_design', label: 'Column Design', code: 'IS_456', description: 'Axial, biaxial bending' },
      { type: 'slab_design', label: 'Slab Design', code: 'IS_456', description: 'One-way / two-way slabs' },
      { type: 'isolated_footing', label: 'Isolated Footing', code: 'IS_456', description: 'Single column footing' },
      { type: 'combined_footing', label: 'Combined Footing', code: 'IS_456', description: 'Multi-column footing' },
    ],
  },
  {
    category: 'Steel Design (IS 800)',
    icon: Columns,
    color: 'orange',
    items: [
      { type: 'steel_beam', label: 'Steel Beam', code: 'IS_800', description: 'Section classification, LTB' },
      { type: 'bolted_connection', label: 'Bolted Connection', code: 'IS_800', description: 'Bearing / friction type' },
      { type: 'welded_connection', label: 'Welded Connection', code: 'IS_800', description: 'Fillet / butt weld' },
      { type: 'base_plate', label: 'Base Plate', code: 'IS_800', description: 'Column base plate' },
    ],
  },
  {
    category: 'Seismic Analysis (IS 1893)',
    icon: Activity,
    color: 'red',
    items: [
      { type: 'seismic_equivalent_static', label: 'Equivalent Static', code: 'IS_1893', description: 'Base shear, storey forces' },
      { type: 'seismic_response_spectrum', label: 'Response Spectrum', code: 'IS_1893', description: 'Modal analysis (SRSS/CQC)' },
    ],
  },
  {
    category: 'Load Analysis (IS 875)',
    icon: Wind,
    color: 'cyan',
    items: [
      { type: 'wind_load', label: 'Wind Load', code: 'IS_875' as DesignCodeType, description: 'Design wind pressure, Vb, k-factors' },
      { type: 'load_combination', label: 'Load Combinations', code: 'IS_875' as DesignCodeType, description: 'ULS & SLS per IS 875 Part 5' },
    ],
  },
  {
    category: 'Frame Analysis',
    icon: LayoutGrid,
    color: 'purple',
    items: [
      { type: 'continuous_beam', label: 'Continuous Beam', code: 'IS_456', description: '2-5 span moment distribution' },
      { type: 'portal_frame', label: 'Portal Frame', code: 'IS_456', description: 'Portal/cantilever method' },
      { type: 'deflection', label: 'Deflection Analysis', code: 'IS_456', description: 'Short-term & long-term' },
      { type: 'influence_line', label: 'Influence Lines', code: 'IS_456', description: 'For moving loads' },
    ],
  },
];

// ============================================================================
// QUICK STATS COMPONENT
// ============================================================================

function QuickStats({ recentCalculations }: { recentCalculations: RecentCalculation[] }) {
  const passCount = recentCalculations.filter(c => c.status === 'OK').length;
  const warningCount = recentCalculations.filter(c => c.status === 'WARNING').length;
  const failCount = recentCalculations.filter(c => c.status === 'FAIL').length;
  const avgUtilization = recentCalculations.length > 0
    ? recentCalculations.reduce((sum, c) => sum + c.utilization, 0) / recentCalculations.length
    : 0;
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Calculations</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{recentCalculations.length}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Calculator className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Passed</p>
            <p className="text-2xl font-bold text-green-600">{passCount}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Warnings</p>
            <p className="text-2xl font-bold text-yellow-600">{warningCount}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Avg. Utilization</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{(avgUtilization * 100).toFixed(0)}%</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-purple-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CALCULATION TYPE SELECTOR
// ============================================================================

function CalculationTypeSelector({
  selectedType,
  selectedCode,
  onSelect,
}: {
  selectedType: string;
  selectedCode: DesignCodeType;
  onSelect: (type: string, code: DesignCodeType) => void;
}) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(NAVIGATION_ITEMS.map(c => c.category));
  
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };
  
  return (
    <div className="space-y-2">
      {NAVIGATION_ITEMS.map(category => {
        const Icon = category.icon;
        const isExpanded = expandedCategories.includes(category.category);
        
        return (
          <div key={category.category} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category.category)}
              className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center",
                  category.color === 'blue' && "bg-blue-100 dark:bg-blue-900/30",
                  category.color === 'orange' && "bg-orange-100 dark:bg-orange-900/30",
                  category.color === 'red' && "bg-red-100 dark:bg-red-900/30",
                )}>
                  <Icon className={cn(
                    "h-4 w-4",
                    category.color === 'blue' && "text-blue-600",
                    category.color === 'orange' && "text-orange-600",
                    category.color === 'red' && "text-red-600",
                  )} />
                </div>
                <span className="font-medium text-slate-900 dark:text-white text-sm">
                  {category.category}
                </span>
              </div>
              <ChevronDown className={cn(
                "h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform",
                isExpanded && "rotate-180"
              )} />
            </button>
            
            {/* Category Items */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-slate-100 dark:border-slate-700"
                >
                  <div className="p-2 space-y-1">
                    {category.items.map(item => {
                      const isSelected = selectedType === item.type && selectedCode === item.code;
                      
                      return (
                        <button
                          key={item.type}
                          onClick={() => onSelect(item.type, item.code)}
                          className={cn(
                            "w-full flex items-start gap-3 p-2 rounded-lg text-left transition-colors",
                            isSelected
                              ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
                              : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                          )}
                        >
                          <CircleDot className={cn(
                            "h-4 w-4 mt-0.5 flex-shrink-0",
                            isSelected ? "text-blue-600" : "text-slate-500 dark:text-slate-400"
                          )} />
                          <div>
                            <p className={cn(
                              "font-medium text-sm",
                              isSelected ? "text-blue-600" : "text-slate-700 dark:text-slate-300"
                            )}>
                              {item.label}
                            </p>
                            {item.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// STATUS ICON COMPONENT (moved outside to prevent re-creation on each render)
// ============================================================================

function CalculationStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'OK':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'WARNING':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'FAIL':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
}

// Helper function for formatting relative time (pure function - avoids impure Date.now() in render)
function formatRelativeTime(date: Date, now: number): string {
  const diff = now - date.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ============================================================================
// RECENT CALCULATIONS LIST
// ============================================================================

// Static timestamp for relative time formatting (captured at module load)
const STATIC_REFERENCE_TIME = Date.now();

function RecentCalculationsList({
  calculations,
  onSelect,
}: {
  calculations: RecentCalculation[];
  onSelect: (calc: RecentCalculation) => void;
}) {
  // Use static reference time to avoid impure function during render
  const formatTime = React.useCallback((date: Date) => {
    return formatRelativeTime(date, STATIC_REFERENCE_TIME);
  }, []);
  
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Recent Calculations
        </h3>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[300px] overflow-y-auto">
        {calculations.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No calculations yet</p>
          </div>
        ) : (
          calculations.map(calc => (
            <button
              key={calc.id}
              onClick={() => onSelect(calc)}
              className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
            >
              <CalculationStatusIcon status={calc.status} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                  {calc.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {calc.code} • {formatTime(calc.timestamp)}
                </p>
              </div>
              <div className="text-right">
                <p className={cn(
                  "text-sm font-medium",
                  calc.utilization > 1 ? "text-red-600" :
                  calc.utilization > 0.9 ? "text-yellow-600" :
                  "text-green-600"
                )}>
                  {(calc.utilization * 100).toFixed(0)}%
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export default function StructuralDashboard() {
  // State
  const [selectedType, setSelectedType] = useState<string>('beam_design');
  const [selectedCode, setSelectedCode] = useState<DesignCodeType>('IS_456');
  const [activeView, setActiveView] = useState<'calculator' | 'diagrams' | 'report'>('calculator');
  const [currentResult, setCurrentResult] = useState<CalculationResult | null>(null);
  const [currentInputs, setCurrentInputs] = useState<CalculationInput | null>(null);
  const [recentCalculations, setRecentCalculations] = useState<RecentCalculation[]>([]);
  
  // Handle calculation selection
  const handleSelectCalculation = useCallback((type: string, code: DesignCodeType) => {
    setSelectedType(type);
    setSelectedCode(code);
    setCurrentResult(null);
    setCurrentInputs(null);
    setActiveView('calculator');
  }, []);
  
  // Handle calculation complete
  const handleCalculationComplete = useCallback((inputs: CalculationInput, result: CalculationResult) => {
    setCurrentResult(result);
    setCurrentInputs(inputs);
    
    // Add to recent calculations
    const newCalc: RecentCalculation = {
      id: Date.now().toString(),
      type: selectedType,
      code: selectedCode,
      timestamp: new Date(),
      status: result.status,
      utilization: result.utilization,
    };
    setRecentCalculations(prev => [newCalc, ...prev.slice(0, 19)]);
  }, [selectedType, selectedCode]);
  
  // Generate report data
  const reportData: ReportData | null = currentResult && currentInputs ? {
    projectInfo: {
      projectName: 'Structural Design Project',
      projectNumber: 'PRJ-' + new Date().getFullYear() + '-001',
      clientName: 'Client Name',
      engineer: 'Design Engineer',
      checker: 'Checking Engineer',
      date: new Date().toLocaleDateString(),
      revision: 'R0',
    },
    calculationType: selectedType as CalculationType,
    designCode: selectedCode,
    inputs: currentInputs,
    result: currentResult,
  } : null;
  
  // Get selected item name
  const selectedItemName = NAVIGATION_ITEMS
    .flatMap(c => c.items)
    .find(i => i.type === selectedType)?.label || 'Calculation';
  
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                <Calculator className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg text-slate-900 dark:text-white">BeamLab</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">Structural Engineering Suite</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              aria-label="Help and documentation"
              className="p-3 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center">
              <HelpCircle className="h-5 w-5 text-slate-500" />
            </button>
            <button 
              aria-label="Settings"
              className="p-3 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center">
              <Settings className="h-5 w-5 text-slate-500" />
            </button>
            <button 
              aria-label="Documentation"
              className="p-3 min-h-[44px] min-w-[44px] rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-[1920px] mx-auto p-6">
        {/* Stats */}
        <div className="mb-6">
          <QuickStats recentCalculations={recentCalculations} />
        </div>
        
        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Calculation Types */}
          <div className="lg:col-span-3 space-y-4">
            <CalculationTypeSelector
              selectedType={selectedType}
              selectedCode={selectedCode}
              onSelect={handleSelectCalculation}
            />
            
            <RecentCalculationsList
              calculations={recentCalculations}
              onSelect={(calc) => handleSelectCalculation(calc.type, calc.code)}
            />
          </div>
          
          {/* Center - Calculator */}
          <div className="lg:col-span-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Tabs */}
              <div className="border-b border-slate-200 dark:border-slate-700 px-4">
                <div className="flex gap-1">
                  {[
                    { id: 'calculator', label: 'Calculator', icon: Calculator },
                    { id: 'diagrams', label: 'Diagrams', icon: BarChart3 },
                    { id: 'report', label: 'Report', icon: FileText },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveView(tab.id as any)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                        activeView === tab.id
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      )}
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Content */}
              <div className="p-4">
                <AnimatePresence mode="wait">
                  {activeView === 'calculator' && (
                    <motion.div
                      key="calculator"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                        {selectedItemName}
                        <span className="ml-2 text-sm font-normal text-slate-500">({selectedCode.replace('_', ' ')})</span>
                      </h2>
                      <StructuralCalculator
                        defaultType={selectedType as CalculationType}
                        defaultCode={selectedCode}
                        onCalculate={handleCalculationComplete}
                      />
                    </motion.div>
                  )}
                  
                  {activeView === 'diagrams' && (
                    <motion.div
                      key="diagrams"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      {currentResult ? (
                        <div className="space-y-6">
                          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Design Diagrams
                          </h2>
                          
                          {(selectedType === 'beam_design' || selectedType === 'slab_design') && currentInputs && (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                                  Cross Section
                                </h3>
                                <BeamCrossSection
                                  width={Number(currentInputs.width) || 300}
                                  depth={Number(currentInputs.depth) || 500}
                                  cover={Number(currentInputs.clear_cover) || 40}
                                  reinforcement={[
                                    {
                                      y: Number(currentInputs.clear_cover) || 40,
                                      count: 2,
                                      diameter: 12,
                                      type: 'compression'
                                    },
                                    {
                                      y: (Number(currentInputs.depth) || 500) - (Number(currentInputs.clear_cover) || 40),
                                      count: Number(currentInputs.main_bar_count) || 3,
                                      diameter: Number(currentInputs.main_bar_dia) || 16,
                                      type: 'tension'
                                    }
                                  ]}
                                />
                              </div>
                              
                              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                                  P-M Interaction
                                </h3>
                                <InteractionDiagram
                                  points={[
                                    { M: 0, P: currentResult.capacity || 0 },
                                    { M: currentResult.capacity * 0.3, P: currentResult.capacity * 0.9 },
                                    { M: currentResult.capacity * 0.5, P: currentResult.capacity * 0.7 },
                                    { M: currentResult.capacity * 0.6, P: currentResult.capacity * 0.4 },
                                    { M: currentResult.capacity * 0.55, P: 0 },
                                    { M: currentResult.capacity * 0.4, P: -currentResult.capacity * 0.2 },
                                    { M: 0, P: -currentResult.capacity * 0.3 },
                                  ]}
                                  Pu={currentResult.demand * 0.5}
                                  Mu={currentResult.demand}
                                  Po={currentResult.capacity || 0}
                                  Mo={currentResult.capacity * 0.6}
                                />
                              </div>
                            </div>
                          )}
                          
                          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                              Utilization Summary
                            </h3>
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  currentResult.utilization > 1 ? "bg-red-500" :
                                  currentResult.utilization > 0.9 ? "bg-yellow-500" :
                                  "bg-green-500"
                                )}
                                style={{ width: `${Math.min(currentResult.utilization * 100, 100)}%` }}
                              />
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                              Utilization: {(currentResult.utilization * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Complete a calculation to view diagrams</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                  
                  {activeView === 'report' && (
                    <motion.div
                      key="report"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      {reportData ? (
                        <CalculationReport
                          data={reportData}
                        />
                      ) : (
                        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Complete a calculation to generate a report</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          
          {/* Right Sidebar - Result Summary */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden lg:sticky lg:top-24">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Result Summary
                </h3>
              </div>
              
              {currentResult ? (
                <div className="p-4 space-y-4">
                  {/* Status Badge */}
                  <div className={cn(
                    "p-4 rounded-lg",
                    currentResult.status === 'OK' && "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800",
                    currentResult.status === 'WARNING' && "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800",
                    currentResult.status === 'FAIL' && "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800",
                  )}>
                    <div className="flex items-center gap-3">
                      {currentResult.status === 'OK' && <CheckCircle className="h-6 w-6 text-green-600" />}
                      {currentResult.status === 'WARNING' && <AlertTriangle className="h-6 w-6 text-yellow-600" />}
                      {currentResult.status === 'FAIL' && <XCircle className="h-6 w-6 text-red-600" />}
                      <div>
                        <p className={cn(
                          "font-semibold",
                          currentResult.status === 'OK' && "text-green-700 dark:text-green-400",
                          currentResult.status === 'WARNING' && "text-yellow-700 dark:text-yellow-400",
                          currentResult.status === 'FAIL' && "text-red-700 dark:text-red-400",
                        )}>
                          {currentResult.status === 'OK' && 'Design Adequate'}
                          {currentResult.status === 'WARNING' && 'Review Required'}
                          {currentResult.status === 'FAIL' && 'Design Failed'}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {currentResult.message}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Key Metrics */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Utilization</span>
                      <span className={cn(
                        "font-mono font-medium",
                        currentResult.utilization > 1 ? "text-red-600" :
                        currentResult.utilization > 0.9 ? "text-yellow-600" :
                        "text-green-600"
                      )}>
                        {(currentResult.utilization * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Capacity</span>
                      <span className="font-mono text-slate-900 dark:text-white">
                        {currentResult.capacity.toFixed(2)} kN·m
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Demand</span>
                      <span className="font-mono text-slate-900 dark:text-white">
                        {currentResult.demand.toFixed(2)} kN·m
                      </span>
                    </div>
                  </div>
                  
                  {/* Code Checks Summary */}
                  {currentResult.codeChecks && currentResult.codeChecks.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Code Checks ({currentResult.codeChecks.filter(c => c.status === 'PASS').length}/{currentResult.codeChecks.length})
                      </h4>
                      <div className="space-y-1 max-h-[200px] overflow-y-auto">
                        {currentResult.codeChecks.map((check, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "flex items-center gap-2 text-xs p-2 rounded",
                              check.status === 'PASS' && "bg-green-50 dark:bg-green-900/20",
                              check.status === 'WARNING' && "bg-yellow-50 dark:bg-yellow-900/20",
                              check.status === 'FAIL' && "bg-red-50 dark:bg-red-900/20",
                            )}
                          >
                            {check.status === 'PASS' && <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />}
                            {check.status === 'WARNING' && <AlertTriangle className="h-3 w-3 text-yellow-600 flex-shrink-0" />}
                            {check.status === 'FAIL' && <XCircle className="h-3 w-3 text-red-600 flex-shrink-0" />}
                            <span className="text-slate-700 dark:text-slate-300 truncate">
                              {check.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Warnings */}
                  {currentResult.warnings && currentResult.warnings.length > 0 && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                      <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-400 mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Warnings
                      </h4>
                      <ul className="space-y-1">
                        {currentResult.warnings.map((warning, idx) => (
                          <li key={idx} className="text-xs text-yellow-700 dark:text-yellow-300">
                            • {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                      <Download className="h-4 w-4" />
                      Export PDF
                    </button>
                    <button className="flex items-center justify-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm">
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Run a calculation to see results</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mt-8">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <p>BeamLab Structural Engineering Suite v2.0</p>
            <div className="flex items-center gap-4">
              <span>IS 456:2000</span>
              <span>IS 800:2007</span>
              <span>IS 1893:2016</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
