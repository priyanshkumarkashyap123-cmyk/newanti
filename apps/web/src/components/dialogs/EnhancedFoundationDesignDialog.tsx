/**
 * ============================================================================
 * ENHANCED FOUNDATION DESIGN DIALOG V3.0
 * ============================================================================
 * 
 * Enterprise-grade UI for foundation design with:
 * - Real-time validation and feedback
 * - Clear visual hierarchy
 * - Comprehensive design checks display
 * - Interactive soil selection
 * - Detailed calculation breakdown
 * - Professional reporting
 * 
 * @version 3.0.0
 */

import React, { FC, useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, Calculator, Check, AlertTriangle, Info, Download,
  ChevronDown, ChevronRight, Settings, FileText, Zap, Shield,
  Target, TrendingUp, AlertCircle, CheckCircle2, XCircle,
  RefreshCw, Eye, Maximize2, Building2, Ruler, Wrench
} from 'lucide-react';
import { useModelStore } from '../../store/model';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import {
  AdvancedFoundationDesignEngine,
  createAdvancedFoundationEngine,
  FoundationType,
  DesignCode,
  SoilProperties,
  FoundationLoads,
  FootingDesignResult,
  DesignCheck,
  BearingCapacityMethod
} from '../../modules/foundation/AdvancedFoundationDesignEngine';

// Counter for generating unique foundation IDs without using Date.now()
let foundationIdCounter = 0;

// ============================================================================
// TYPES
// ============================================================================

interface EnhancedFoundationDesignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialColumnId?: string;
}

interface SoilTypeOption {
  id: string;
  name: string;
  category: string;
  description: string;
  bearingCapacity: number;
  frictionAngle: number;
  cohesion: number;
  unitWeight: number;
  elasticModulus: number;
  color: string;
  icon: string;
}

interface ValidationState {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SOIL_TYPES: SoilTypeOption[] = [
  {
    id: 'soft_clay',
    name: 'Soft Clay',
    category: 'Cohesive',
    description: 'Low bearing capacity, high compressibility. Requires careful settlement analysis.',
    bearingCapacity: 75,
    frictionAngle: 0,
    cohesion: 25,
    unitWeight: 16,
    elasticModulus: 3,
    color: 'from-amber-700 to-amber-900',
    icon: '🟤'
  },
  {
    id: 'medium_clay',
    name: 'Medium Clay',
    category: 'Cohesive',
    description: 'Moderate strength. Suitable for light to medium structures.',
    bearingCapacity: 150,
    frictionAngle: 0,
    cohesion: 50,
    unitWeight: 18,
    elasticModulus: 8,
    color: 'from-amber-600 to-amber-800',
    icon: '🟫'
  },
  {
    id: 'stiff_clay',
    name: 'Stiff Clay',
    category: 'Cohesive',
    description: 'Good bearing capacity. Reliable for multi-story buildings.',
    bearingCapacity: 250,
    frictionAngle: 0,
    cohesion: 100,
    unitWeight: 19,
    elasticModulus: 15,
    color: 'from-amber-500 to-amber-700',
    icon: '🟧'
  },
  {
    id: 'loose_sand',
    name: 'Loose Sand',
    category: 'Granular',
    description: 'Low density, may require compaction or deep foundations.',
    bearingCapacity: 100,
    frictionAngle: 28,
    cohesion: 0,
    unitWeight: 16,
    elasticModulus: 10,
    color: 'from-yellow-500 to-yellow-700',
    icon: '🟡'
  },
  {
    id: 'medium_sand',
    name: 'Medium Dense Sand',
    category: 'Granular',
    description: 'Good for shallow foundations. Well-suited for most structures.',
    bearingCapacity: 200,
    frictionAngle: 32,
    cohesion: 0,
    unitWeight: 18,
    elasticModulus: 25,
    color: 'from-yellow-400 to-yellow-600',
    icon: '⭐'
  },
  {
    id: 'dense_sand',
    name: 'Dense Sand/Gravel',
    category: 'Granular',
    description: 'Excellent bearing capacity. Ideal for heavy structures.',
    bearingCapacity: 400,
    frictionAngle: 38,
    cohesion: 0,
    unitWeight: 20,
    elasticModulus: 50,
    color: 'from-orange-400 to-orange-600',
    icon: '🔶'
  },
  {
    id: 'weathered_rock',
    name: 'Weathered Rock',
    category: 'Rock',
    description: 'High capacity with some variability. Verify with site investigation.',
    bearingCapacity: 600,
    frictionAngle: 40,
    cohesion: 50,
    unitWeight: 22,
    elasticModulus: 100,
    color: 'from-slate-500 to-slate-700',
    icon: '🪨'
  },
  {
    id: 'hard_rock',
    name: 'Hard Rock',
    category: 'Rock',
    description: 'Maximum bearing capacity. Excellent for any structure.',
    bearingCapacity: 1500,
    frictionAngle: 45,
    cohesion: 200,
    unitWeight: 25,
    elasticModulus: 500,
    color: 'from-slate-400 to-slate-600',
    icon: '💎'
  },
];

const FOUNDATION_TYPES: { value: FoundationType; label: string; description: string; icon: string }[] = [
  { value: 'isolated_square', label: 'Isolated Square', description: 'Single column, square footing', icon: '⬛' },
  { value: 'isolated_rectangular', label: 'Isolated Rectangular', description: 'Single column, rectangular', icon: '▬' },
  { value: 'isolated_circular', label: 'Isolated Circular', description: 'Single column, circular footing', icon: '⚫' },
  { value: 'combined_rectangular', label: 'Combined Footing', description: 'Two or more columns', icon: '▬▬' },
  { value: 'strip_continuous', label: 'Strip Footing', description: 'Continuous under wall', icon: '━━━' },
  { value: 'raft_flat', label: 'Raft Foundation', description: 'Full building coverage', icon: '▓▓▓' },
];

const DESIGN_CODES: { value: DesignCode; label: string; region: string }[] = [
  { value: 'IS456', label: 'IS 456:2000', region: 'India' },
  { value: 'IS2950', label: 'IS 2950', region: 'India' },
  { value: 'ACI318', label: 'ACI 318-19', region: 'USA' },
  { value: 'EN1992', label: 'Eurocode 2', region: 'Europe' },
  { value: 'BS8110', label: 'BS 8110', region: 'UK' },
];

const CONCRETE_GRADES = [
  { value: 20, label: 'M20', fck: 20 },
  { value: 25, label: 'M25', fck: 25 },
  { value: 30, label: 'M30', fck: 30 },
  { value: 35, label: 'M35', fck: 35 },
  { value: 40, label: 'M40', fck: 40 },
  { value: 45, label: 'M45', fck: 45 },
  { value: 50, label: 'M50', fck: 50 },
];

const STEEL_GRADES = [
  { value: 415, label: 'Fe415', fy: 415 },
  { value: 500, label: 'Fe500', fy: 500 },
  { value: 550, label: 'Fe550', fy: 550 },
];

// ============================================================================
// COMPONENTS
// ============================================================================

// Status Badge Component
const StatusBadge: FC<{ status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_CHECKED' | 'REVIEW_REQUIRED'; size?: 'sm' | 'md' | 'lg' }> = ({ status, size = 'md' }) => {
  const configs = {
    PASS: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: CheckCircle2, label: 'Pass' },
    FAIL: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: XCircle, label: 'Fail' },
    WARNING: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', icon: AlertTriangle, label: 'Warning' },
    NOT_CHECKED: { bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-[#869ab8]', icon: Info, label: 'Not Checked' },
    REVIEW_REQUIRED: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', icon: AlertTriangle, label: 'Review Required' },
  };

  const config = configs[status];
  const Icon = config.icon;
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
    lg: 'px-4 py-2 text-base gap-2',
  };

  return (
    <span className={`inline-flex items-center rounded-full border ${config.bg} ${config.border} ${config.text} ${sizeClasses[size]}`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5'} />
      <span className="font-medium tracking-wide tracking-wide">{config.label}</span>
    </span>
  );
};

// Utilization Bar Component
const UtilizationBar: FC<{ value: number; max?: number; showLabel?: boolean }> = ({ value, max = 100, showLabel = true }) => {
  const percentage = Math.min((value / max) * 100, 150);
  const getColor = () => {
    if (percentage <= 70) return 'bg-emerald-500';
    if (percentage <= 90) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`h-full ${getColor()} rounded-full`}
        />
      </div>
      {showLabel && (
        <span className={`text-sm font-medium tracking-wide tracking-wide tabular-nums ${percentage > 100 ? 'text-red-400' : 'text-[#adc6ff]'}`}>
          {percentage.toFixed(0)}%
        </span>
      )}
    </div>
  );
};

// Number Input Component
const EnhancedNumberInput: FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
  warning?: string;
  info?: string;
}> = ({ label, value, onChange, unit, min, max, step = 1, error, warning, info }) => {
  const hasError = !!error;
  const hasWarning = !error && !!warning;

  return (
    <div className="space-y-1.5">
      <label className="text-[#869ab8] text-sm font-medium tracking-wide tracking-wide flex items-center justify-between">
        <span>{label}</span>
        {info && (
          <span className="text-[#869ab8] text-xs flex items-center gap-1">
            <Info className="w-3 h-3" />
            {info}
          </span>
        )}
      </label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          className={`w-full rounded-lg border bg-[#131b2e] text-[#dae2fd] h-11 px-4 pr-14 
            focus:outline-none focus:ring-2 transition-all text-sm font-medium tracking-wide tracking-wide
            ${hasError
              ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
              : hasWarning
                ? 'border-amber-500/50 focus:border-amber-500 focus:ring-amber-500/20'
                : 'border-[#1a2333] focus:border-blue-500 focus:ring-blue-500/20'
            }`}
        />
        {unit && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#869ab8] text-sm font-medium tracking-wide tracking-wide">
            {unit}
          </span>
        )}
      </div>
      {error && (
        <p className="text-red-400 text-xs flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          {error}
        </p>
      )}
      {warning && !error && (
        <p className="text-amber-400 text-xs flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {warning}
        </p>
      )}
    </div>
  );
};

// Select Component
const EnhancedSelect: FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; description?: string }[];
  icon?: React.ReactNode;
}> = ({ label, value, onChange, options, icon }) => (
  <div className="space-y-1.5">
    <label className="text-[#869ab8] text-sm font-medium tracking-wide tracking-wide">{label}</label>
    <div className="relative">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#869ab8]">
          {icon}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full appearance-none rounded-lg border border-[#1a2333] bg-[#131b2e] text-[#dae2fd] h-11 
          ${icon ? 'pl-10' : 'pl-4'} pr-10 focus:outline-none focus:border-blue-500 focus:ring-2 
          focus:ring-blue-500/20 transition-all text-sm font-medium tracking-wide tracking-wide cursor-pointer`}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#869ab8] pointer-events-none" />
    </div>
  </div>
);

// Section Header Component
const SectionHeader: FC<{ number: number; title: string; subtitle?: string; color: string }> = ({ number, title, subtitle, color }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-[#dae2fd] text-sm font-bold shadow-lg`}>
      {number}
    </div>
    <div>
      <h3 className="text-[#dae2fd] font-semibold text-base">{title}</h3>
      {subtitle && <p className="text-[#869ab8] text-sm">{subtitle}</p>}
    </div>
  </div>
);

// Design Check Card Component
const DesignCheckCard: FC<{ check: DesignCheck; expanded?: boolean; onToggle?: () => void }> = ({ check, expanded = false, onToggle }) => {
  const statusColors = {
    PASS: 'border-emerald-500/30 bg-emerald-500/5',
    FAIL: 'border-red-500/30 bg-red-500/5',
    WARNING: 'border-amber-500/30 bg-amber-500/5',
    NOT_CHECKED: 'border-slate-500/30 bg-slate-500/5',
  };

  return (
    <motion.div
      layout
      className={`rounded-xl border ${statusColors[check.status]} p-4 transition-all`}
    >
      <div
        className="flex items-start justify-between cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-[#dae2fd] font-medium tracking-wide tracking-wide text-sm">{check.name}</h4>
            <StatusBadge status={check.status} size="sm" />
          </div>
          <p className="text-[#869ab8] text-xs">{check.clause}</p>
        </div>
        <div className="text-right">
          <p className="text-[#dae2fd] font-mono text-sm">
            {check.demand.toFixed(1)} / {check.capacity.toFixed(1)}
          </p>
          <p className="text-[#869ab8] text-xs">{check.demandUnit}</p>
        </div>
      </div>

      <div className="mt-3">
        <UtilizationBar value={check.utilizationPercent} />
      </div>

      <AnimatePresence>
        {expanded && check.calculationSteps && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4 pt-4 border-t border-[#1a2333]/50 space-y-2"
          >
            {check.calculationSteps.map((step, idx) => (
              <div key={idx} className="text-xs">
                <p className="text-[#869ab8]">{step.description}</p>
                <p className="text-[#869ab8] font-mono">{step.formula}</p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Results Summary Card
const ResultsSummaryCard: FC<{ result: FootingDesignResult }> = ({ result }) => {
  const { geometry, reinforcement, soilPressure, checksSummary } = result;

  return (
    <div className="bg-gradient-to-br from-slate-100 dark:from-slate-800/50 to-slate-50/50 dark:to-slate-900/50 rounded-2xl border border-[#1a2333]/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-[#dae2fd] flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-400" />
          Design Summary
        </h3>
        <StatusBadge status={result.status} size="md" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#131b2e] rounded-xl p-4">
          <p className="text-[#869ab8] text-xs uppercase tracking-wider mb-1">Dimensions</p>
          <p className="text-[#dae2fd] font-semibold text-lg">
            {geometry.length.toFixed(2)}m × {geometry.width.toFixed(2)}m
          </p>
          <p className="text-[#869ab8] text-sm">Thickness: {(geometry.thickness * 1000).toFixed(0)}mm</p>
        </div>

        <div className="bg-[#131b2e] rounded-xl p-4">
          <p className="text-[#869ab8] text-xs uppercase tracking-wider mb-1">Soil Pressure</p>
          <p className="text-[#dae2fd] font-semibold text-lg">
            {soilPressure.maximum.toFixed(0)} kPa
          </p>
          <p className="text-[#869ab8] text-sm">Allowable: {soilPressure.allowable.toFixed(0)} kPa</p>
        </div>

        <div className="bg-[#131b2e] rounded-xl p-4">
          <p className="text-[#869ab8] text-xs uppercase tracking-wider mb-1">Reinforcement</p>
          <p className="text-[#dae2fd] font-semibold text-lg">
            T{reinforcement.bottomX.diameter}@{reinforcement.bottomX.spacing}
          </p>
          <p className="text-[#869ab8] text-sm">Steel: {reinforcement.totalWeight.toFixed(0)} kg</p>
        </div>

        <div className="bg-[#131b2e] rounded-xl p-4">
          <p className="text-[#869ab8] text-xs uppercase tracking-wider mb-1">Checks</p>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-semibold">{checksSummary.passed}</span>
            <span className="text-slate-500">/</span>
            <span className={checksSummary.failed > 0 ? 'text-red-400' : 'text-[#869ab8]'}>
              {checksSummary.failed}
            </span>
            <span className="text-slate-500">/</span>
            <span className={checksSummary.warnings > 0 ? 'text-amber-400' : 'text-[#869ab8]'}>
              {checksSummary.warnings}
            </span>
          </div>
          <p className="text-[#869ab8] text-sm">Pass/Fail/Warn</p>
        </div>
      </div>

      {/* Concrete and Steel Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3 bg-[#131b2e] rounded-lg p-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Layers className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-[#869ab8] text-xs">Concrete Volume</p>
            <p className="text-[#dae2fd] font-semibold">{result.materialQuantities.concrete.volume.toFixed(2)} m³</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-[#131b2e] rounded-lg p-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <p className="text-[#869ab8] text-xs">Reinforcement Weight</p>
            <p className="text-[#dae2fd] font-semibold">{result.materialQuantities.reinforcement.weight.toFixed(0)} kg</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const EnhancedFoundationDesignDialog: FC<EnhancedFoundationDesignDialogProps> = ({
  isOpen,
  onClose,
  initialColumnId
}) => {
  // Store
  const analysisResults = useModelStore((s) => s.analysisResults);

  // State - Foundation Type & Code
  const [foundationType, setFoundationType] = useState<FoundationType>('isolated_square');
  const [designCode, setDesignCode] = useState<DesignCode>('IS456');

  // State - Soil Properties
  const [selectedSoilId, setSelectedSoilId] = useState<string>('medium_sand');
  const [useCustomSoil, setUseCustomSoil] = useState(false);
  const [customBearingCapacity, setCustomBearingCapacity] = useState(200);
  const [customFrictionAngle, setCustomFrictionAngle] = useState(30);
  const [customCohesion, setCustomCohesion] = useState(0);
  const [customUnitWeight, setCustomUnitWeight] = useState(18);
  const [waterTableDepth, setWaterTableDepth] = useState(5);
  const [foundationDepth, setFoundationDepth] = useState(1.5);

  // State - Loads
  const [axialLoad, setAxialLoad] = useState(800);
  const [momentX, setMomentX] = useState(50);
  const [momentY, setMomentY] = useState(30);
  const [shearX, setShearX] = useState(20);
  const [shearY, setShearY] = useState(15);

  // State - Column
  const [columnWidth, setColumnWidth] = useState(400);
  const [columnDepth, setColumnDepth] = useState(400);

  // State - Materials
  const [concreteGrade, setConcreteGrade] = useState(25);
  const [steelGrade, setSteelGrade] = useState(500);
  const [cover, setCover] = useState(50);

  // State - Options
  const [checkSettlement, setCheckSettlement] = useState(true);
  const [checkSliding, setCheckSliding] = useState(true);
  const [checkOverturning, setCheckOverturning] = useState(true);
  const [bearingCapacityMethod, setBearingCapacityMethod] = useState<BearingCapacityMethod>('meyerhof');

  // State - UI
  const [activeTab, setActiveTab] = useState<'input' | 'results' | 'details'>('input');
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());
  const [isCalculating, setIsCalculating] = useState(false);

  // Get selected soil
  const selectedSoil = useMemo(() => {
    return SOIL_TYPES.find(s => s.id === selectedSoilId) || SOIL_TYPES[4]; // Default to medium sand
  }, [selectedSoilId]);

  // Build soil properties
  const soilProperties: SoilProperties = useMemo(() => {
    if (useCustomSoil) {
      return {
        type: customCohesion > 0 ? 'cohesive' : 'cohesionless',
        classification: 'Custom',
        unitWeight: customUnitWeight,
        saturatedUnitWeight: customUnitWeight + 2,
        cohesion: customCohesion,
        frictionAngle: customFrictionAngle,
        elasticModulus: 25,
        poissonRatio: 0.3,
        allowableBearingCapacity: customBearingCapacity,
        waterTableDepth,
      };
    }

    return {
      type: selectedSoil.cohesion > 0 ? 'cohesive' : 'cohesionless',
      classification: selectedSoil.category,
      unitWeight: selectedSoil.unitWeight,
      saturatedUnitWeight: selectedSoil.unitWeight + 2,
      cohesion: selectedSoil.cohesion,
      frictionAngle: selectedSoil.frictionAngle,
      elasticModulus: selectedSoil.elasticModulus,
      poissonRatio: 0.3,
      allowableBearingCapacity: selectedSoil.bearingCapacity,
      waterTableDepth,
    };
  }, [selectedSoil, useCustomSoil, customBearingCapacity, customFrictionAngle, customCohesion, customUnitWeight, waterTableDepth]);

  // Build loads
  const loads: FoundationLoads[] = useMemo(() => [{
    axial: axialLoad,
    momentX,
    momentY,
    shearX,
    shearY,
    loadCase: 'combination',
    isServiceability: false,
    isUltimate: true,
  }], [axialLoad, momentX, momentY, shearX, shearY]);

  // Generate stable ID for foundation using useRef with counter
  const footingIdRef = React.useRef<string>(`footing-${++foundationIdCounter}`);

  // Calculate design result
  const designResult = useMemo(() => {
    try {
      const engine = createAdvancedFoundationEngine({
        id: footingIdRef.current,
        name: 'Foundation Design',
        type: foundationType,
        code: designCode,
        soil: soilProperties,
        loads,
        concrete: {
          grade: `M${concreteGrade}`,
          fck: concreteGrade,
          Ec: 5000 * Math.sqrt(concreteGrade),
          cover,
        },
        reinforcement: {
          grade: `Fe${steelGrade}`,
          fy: steelGrade,
          Es: 200000,
          minDiameter: 10,
          maxDiameter: 25,
        },
        geometry: {
          depth: foundationDepth,
          shape: foundationType.includes('circular') ? 'circular' : 'rectangular',
        },
        columns: [{
          width: columnWidth,
          depth: columnDepth,
          shape: 'rectangular',
        }],
        options: {
          bearingCapacityMethod,
          includePedestal: false,
          allowUplift: false,
          checkSettlement,
          checkSliding,
          checkOverturning,
          useWinklerModel: false,
          useFiniteElement: false,
          considerCreep: false,
          considerShrinkage: false,
          considerDynamicLoads: false,
          minimumReinforcementRatio: 0.12,
          maximumReinforcementRatio: 4.0,
          crackWidthLimit: 0.3,
          settlementLimit: 25,
          differentialSettlementLimit: 500,
          slidingSafetyFactor: 1.5,
          overturningMomentFactor: 1.5,
        },
      });

      return engine.design();
    } catch (error) {
      console.error('Design calculation error:', error);
      return null;
    }
  }, [
    foundationType, designCode, soilProperties, loads, concreteGrade, steelGrade, cover,
    columnWidth, columnDepth, foundationDepth, bearingCapacityMethod,
    checkSettlement, checkSliding, checkOverturning
  ]);

  // Auto-populate from analysis results
  useEffect(() => {
    if (analysisResults?.reactions) {
      let maxReaction = 0;
      let maxMomentX = 0;
      let maxMomentY = 0;

      analysisResults.reactions.forEach((reaction) => {
        const fy = Math.abs(reaction.fy || 0);
        if (fy > maxReaction) {
          maxReaction = fy;
          maxMomentX = Math.abs(reaction.mx || 0);
          maxMomentY = Math.abs(reaction.mz || 0);
        }
      });

      if (maxReaction > 0) {
        setAxialLoad(Math.round(maxReaction));
        setMomentX(Math.round(maxMomentX) || 50);
        setMomentY(Math.round(maxMomentY) || 30);
      }
    }
  }, [analysisResults]);

  const toggleCheckExpanded = useCallback((checkId: string) => {
    setExpandedChecks(prev => {
      const next = new Set(prev);
      if (next.has(checkId)) {
        next.delete(checkId);
      } else {
        next.add(checkId);
      }
      return next;
    });
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-[#1a2333]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <DialogTitle className="text-xl font-bold">Advanced Foundation Design</DialogTitle>
                {designResult && (
                  <StatusBadge status={designResult.status} size="lg" />
                )}
              </div>
              <DialogDescription>
                {DESIGN_CODES.find(c => c.value === designCode)?.label} • {FOUNDATION_TYPES.find(t => t.value === foundationType)?.label}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

          {/* Tabs */}
          <div className="flex border-b border-[#1a2333] px-6 bg-[#0b1326]">
            {[
              { id: 'input', label: 'Input Parameters', icon: Settings },
              { id: 'results', label: 'Design Results', icon: Target },
              { id: 'details', label: 'Detailed Checks', icon: FileText },
            ].map(tab => (
              <button type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium tracking-wide tracking-wide border-b-2 transition-all ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-[#869ab8] hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              {activeTab === 'input' && (
                <motion.div
                  key="input"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-8"
                >
                  {/* Foundation Type & Code */}
                  <section>
                    <SectionHeader number={1} title="Foundation Type & Design Code" color="from-blue-500 to-blue-600" />
                    <div className="grid grid-cols-2 gap-4">
                      <EnhancedSelect
                        label="Foundation Type"
                        value={foundationType}
                        onChange={(v) => setFoundationType(v as FoundationType)}
                        options={FOUNDATION_TYPES.map(t => ({ value: t.value, label: `${t.icon} ${t.label}` }))}
                        icon={<Building2 className="w-4 h-4" />}
                      />
                      <EnhancedSelect
                        label="Design Code"
                        value={designCode}
                        onChange={(v) => setDesignCode(v as DesignCode)}
                        options={DESIGN_CODES.map(c => ({ value: c.value, label: `${c.label} (${c.region})` }))}
                        icon={<FileText className="w-4 h-4" />}
                      />
                    </div>
                  </section>

                  {/* Soil Properties */}
                  <section>
                    <SectionHeader number={2} title="Soil Properties" subtitle="Select soil type or enter custom values" color="from-amber-500 to-orange-500" />

                    {/* Soil Type Grid */}
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      {SOIL_TYPES.map((soil) => (
                        <button type="button"
                          key={soil.id}
                          onClick={() => {
                            setSelectedSoilId(soil.id);
                            setUseCustomSoil(false);
                          }}
                          className={`relative p-4 rounded-xl border text-left transition-all group ${selectedSoilId === soil.id && !useCustomSoil
                              ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20'
                              : 'border-[#1a2333]/50 hover:border-slate-300 dark:hover:border-slate-600 bg-[#131b2e]'
                            }`}
                        >
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${soil.color} flex items-center justify-center text-lg mb-2`}>
                            {soil.icon}
                          </div>
                          <p className="text-[#dae2fd] text-sm font-medium tracking-wide tracking-wide mb-0.5">{soil.name}</p>
                          <p className="text-blue-400 text-xs font-medium tracking-wide tracking-wide">{soil.bearingCapacity} kPa</p>

                          {/* Tooltip on hover */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#131b2e] rounded-lg border border-[#1a2333] text-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            <p className="text-[#adc6ff]">{soil.description}</p>
                            <div className="mt-2 grid grid-cols-2 gap-1 text-[#869ab8]">
                              <span>φ: {soil.frictionAngle}°</span>
                              <span>c: {soil.cohesion} kPa</span>
                              <span>γ: {soil.unitWeight} kN/m³</span>
                              <span>E: {soil.elasticModulus} MPa</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Custom Soil Toggle */}
                    <div className="p-4 rounded-xl border border-[#1a2333]/50 bg-[#131b2e] space-y-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useCustomSoil}
                          onChange={(e) => setUseCustomSoil(e.target.checked)}
                          className="w-5 h-5 rounded border-slate-600 bg-[#0b1326] text-blue-600 focus:ring-blue-500/20"
                        />
                        <span className="text-[#adc6ff] text-sm font-medium tracking-wide tracking-wide">Use Custom Soil Parameters</span>
                      </label>

                      {useCustomSoil && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          className="grid grid-cols-4 gap-4"
                        >
                          <EnhancedNumberInput
                            label="Bearing Capacity"
                            value={customBearingCapacity}
                            onChange={setCustomBearingCapacity}
                            unit="kPa"
                            min={50}
                            max={3000}
                          />
                          <EnhancedNumberInput
                            label="Friction Angle (φ)"
                            value={customFrictionAngle}
                            onChange={setCustomFrictionAngle}
                            unit="°"
                            min={0}
                            max={45}
                            warning={customFrictionAngle > 40 ? 'Unusually high' : undefined}
                          />
                          <EnhancedNumberInput
                            label="Cohesion (c)"
                            value={customCohesion}
                            onChange={setCustomCohesion}
                            unit="kPa"
                            min={0}
                            max={500}
                          />
                          <EnhancedNumberInput
                            label="Unit Weight (γ)"
                            value={customUnitWeight}
                            onChange={setCustomUnitWeight}
                            unit="kN/m³"
                            min={14}
                            max={25}
                          />
                        </motion.div>
                      )}
                    </div>

                    {/* Foundation Depth & Water Table */}
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <EnhancedNumberInput
                        label="Foundation Depth"
                        value={foundationDepth}
                        onChange={setFoundationDepth}
                        unit="m"
                        min={0.5}
                        max={5}
                        step={0.1}
                        info="Below ground level"
                      />
                      <EnhancedNumberInput
                        label="Water Table Depth"
                        value={waterTableDepth}
                        onChange={setWaterTableDepth}
                        unit="m"
                        min={0}
                        max={20}
                        step={0.5}
                        warning={waterTableDepth < foundationDepth ? 'Below foundation level' : undefined}
                      />
                      <EnhancedSelect
                        label="Bearing Capacity Method"
                        value={bearingCapacityMethod}
                        onChange={(v) => setBearingCapacityMethod(v as BearingCapacityMethod)}
                        options={[
                          { value: 'terzaghi', label: 'Terzaghi (Classic)' },
                          { value: 'meyerhof', label: 'Meyerhof (Recommended)' },
                          { value: 'hansen', label: 'Hansen (Conservative)' },
                          { value: 'vesic', label: 'Vesic (Modern)' },
                        ]}
                      />
                    </div>
                  </section>

                  {/* Loading */}
                  <section>
                    <SectionHeader
                      number={3}
                      title="Column Loading"
                      subtitle={analysisResults ? 'Auto-populated from analysis' : 'Enter load values manually'}
                      color="from-purple-500 to-purple-600"
                    />

                    {analysisResults && (
                      <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400 text-sm">Values loaded from structural analysis</span>
                      </div>
                    )}

                    <div className="grid grid-cols-5 gap-4">
                      <EnhancedNumberInput
                        label="Axial Load (P)"
                        value={axialLoad}
                        onChange={setAxialLoad}
                        unit="kN"
                        min={10}
                        step={10}
                        error={axialLoad < 0 ? 'Negative load (uplift)' : undefined}
                      />
                      <EnhancedNumberInput
                        label="Moment X (Mx)"
                        value={momentX}
                        onChange={setMomentX}
                        unit="kNm"
                        min={0}
                        step={5}
                      />
                      <EnhancedNumberInput
                        label="Moment Y (My)"
                        value={momentY}
                        onChange={setMomentY}
                        unit="kNm"
                        min={0}
                        step={5}
                      />
                      <EnhancedNumberInput
                        label="Shear X (Vx)"
                        value={shearX}
                        onChange={setShearX}
                        unit="kN"
                        min={0}
                        step={5}
                      />
                      <EnhancedNumberInput
                        label="Shear Y (Vy)"
                        value={shearY}
                        onChange={setShearY}
                        unit="kN"
                        min={0}
                        step={5}
                      />
                    </div>
                  </section>

                  {/* Column & Materials */}
                  <section>
                    <SectionHeader number={4} title="Column & Material Properties" color="from-emerald-500 to-emerald-600" />

                    <div className="grid grid-cols-5 gap-4">
                      <EnhancedNumberInput
                        label="Column Width"
                        value={columnWidth}
                        onChange={setColumnWidth}
                        unit="mm"
                        min={200}
                        max={1000}
                        step={50}
                      />
                      <EnhancedNumberInput
                        label="Column Depth"
                        value={columnDepth}
                        onChange={setColumnDepth}
                        unit="mm"
                        min={200}
                        max={1000}
                        step={50}
                      />
                      <EnhancedSelect
                        label="Concrete Grade"
                        value={concreteGrade.toString()}
                        onChange={(v) => setConcreteGrade(parseInt(v))}
                        options={CONCRETE_GRADES.map(g => ({ value: g.value.toString(), label: g.label }))}
                      />
                      <EnhancedSelect
                        label="Steel Grade"
                        value={steelGrade.toString()}
                        onChange={(v) => setSteelGrade(parseInt(v))}
                        options={STEEL_GRADES.map(g => ({ value: g.value.toString(), label: g.label }))}
                      />
                      <EnhancedNumberInput
                        label="Cover"
                        value={cover}
                        onChange={setCover}
                        unit="mm"
                        min={40}
                        max={100}
                        step={5}
                        warning={cover < 50 ? 'Below recommended' : undefined}
                      />
                    </div>
                  </section>

                  {/* Options */}
                  <section>
                    <SectionHeader number={5} title="Design Options" color="from-rose-500 to-rose-600" />

                    <div className="flex flex-wrap gap-3">
                      {[
                        { id: 'settlement', label: 'Check Settlement', checked: checkSettlement, onChange: setCheckSettlement },
                        { id: 'sliding', label: 'Check Sliding', checked: checkSliding, onChange: setCheckSliding },
                        { id: 'overturning', label: 'Check Overturning', checked: checkOverturning, onChange: setCheckOverturning },
                      ].map(option => (
                        <label
                          key={option.id}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all ${option.checked
                              ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                              : 'border-[#1a2333] bg-[#131b2e] text-[#869ab8] hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={option.checked}
                            onChange={(e) => option.onChange(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-600 bg-[#0b1326] text-blue-600"
                          />
                          <span className="text-sm font-medium tracking-wide tracking-wide">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </section>
                </motion.div>
              )}

              {activeTab === 'results' && designResult && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <ResultsSummaryCard result={designResult} />

                  {/* Warnings & Recommendations */}
                  {(designResult.warnings.length > 0 || designResult.recommendations.length > 0) && (
                    <div className="grid grid-cols-2 gap-4">
                      {designResult.warnings.length > 0 && (
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                          <h4 className="text-amber-400 font-medium tracking-wide tracking-wide mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Warnings
                          </h4>
                          <ul className="space-y-1">
                            {designResult.warnings.map((warning, idx) => (
                              <li key={idx} className="text-amber-300/80 text-sm">• {warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {designResult.recommendations.length > 0 && (
                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                          <h4 className="text-blue-400 font-medium tracking-wide tracking-wide mb-2 flex items-center gap-2">
                            <Zap className="w-4 h-4" />
                            Recommendations
                          </h4>
                          <ul className="space-y-1">
                            {designResult.recommendations.map((rec, idx) => (
                              <li key={idx} className="text-blue-300/80 text-sm">• {rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Detailed Dimensions */}
                  <div className="bg-[#131b2e] rounded-xl p-6 border border-[#1a2333]/50">
                    <h3 className="text-[#dae2fd] font-semibold mb-4 flex items-center gap-2">
                      <Ruler className="w-5 h-5 text-blue-400" />
                      Detailed Dimensions
                    </h3>

                    <div className="grid grid-cols-4 gap-6">
                      <div>
                        <p className="text-[#869ab8] text-xs uppercase tracking-wider mb-1">Length (L)</p>
                        <p className="text-[#dae2fd] font-mono text-2xl">{designResult.geometry.length.toFixed(2)}</p>
                        <p className="text-[#869ab8] text-sm">meters</p>
                      </div>
                      <div>
                        <p className="text-[#869ab8] text-xs uppercase tracking-wider mb-1">Width (B)</p>
                        <p className="text-[#dae2fd] font-mono text-2xl">{designResult.geometry.width.toFixed(2)}</p>
                        <p className="text-[#869ab8] text-sm">meters</p>
                      </div>
                      <div>
                        <p className="text-[#869ab8] text-xs uppercase tracking-wider mb-1">Thickness (D)</p>
                        <p className="text-[#dae2fd] font-mono text-2xl">{(designResult.geometry.thickness * 1000).toFixed(0)}</p>
                        <p className="text-[#869ab8] text-sm">mm</p>
                      </div>
                      <div>
                        <p className="text-[#869ab8] text-xs uppercase tracking-wider mb-1">Effective Depth (d)</p>
                        <p className="text-[#dae2fd] font-mono text-2xl">{(designResult.geometry.effectiveDepth * 1000).toFixed(0)}</p>
                        <p className="text-[#869ab8] text-sm">mm</p>
                      </div>
                    </div>
                  </div>

                  {/* Reinforcement Details */}
                  <div className="bg-[#131b2e] rounded-xl p-6 border border-[#1a2333]/50">
                    <h3 className="text-[#dae2fd] font-semibold mb-4 flex items-center gap-2">
                      <Wrench className="w-5 h-5 text-purple-400" />
                      Reinforcement Schedule
                    </h3>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="p-4 bg-[#131b2e] rounded-lg">
                        <p className="text-[#869ab8] text-sm mb-2">Bottom X-Direction</p>
                        <p className="text-[#dae2fd] text-xl font-mono">
                          T{designResult.reinforcement.bottomX.diameter} @ {designResult.reinforcement.bottomX.spacing}mm c/c
                        </p>
                        <p className="text-[#869ab8] text-sm mt-1">
                          Area: {designResult.reinforcement.bottomX.areaProvided.toFixed(0)} mm²/m
                        </p>
                      </div>
                      <div className="p-4 bg-[#131b2e] rounded-lg">
                        <p className="text-[#869ab8] text-sm mb-2">Bottom Y-Direction</p>
                        <p className="text-[#dae2fd] text-xl font-mono">
                          T{designResult.reinforcement.bottomY.diameter} @ {designResult.reinforcement.bottomY.spacing}mm c/c
                        </p>
                        <p className="text-[#869ab8] text-sm mt-1">
                          Area: {designResult.reinforcement.bottomY.areaProvided.toFixed(0)} mm²/m
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-[#0b1326] rounded-lg flex items-center justify-between">
                      <span className="text-[#869ab8] text-sm">Anchorage Length Required</span>
                      <span className="text-[#dae2fd] font-mono">
                        {designResult.reinforcement.bottomX.anchorageLength.toFixed(0)} mm
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'details' && designResult && (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[#dae2fd] font-semibold">Design Checks ({designResult.checks.length})</h3>
                    <div className="flex items-center gap-2">
                      <button type="button"
                        onClick={() => setExpandedChecks(new Set(designResult.checks.map(c => c.id)))}
                        className="px-3 py-1.5 text-xs text-[#869ab8] hover:text-slate-900 dark:hover:text-white bg-[#131b2e] rounded-lg transition-colors"
                      >
                        Expand All
                      </button>
                      <button type="button"
                        onClick={() => setExpandedChecks(new Set())}
                        className="px-3 py-1.5 text-xs text-[#869ab8] hover:text-slate-900 dark:hover:text-white bg-[#131b2e] rounded-lg transition-colors"
                      >
                        Collapse All
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {designResult.checks.map((check) => (
                      <DesignCheckCard
                        key={check.id}
                        check={check}
                        expanded={expandedChecks.has(check.id)}
                        onToggle={() => toggleCheckExpanded(check.id)}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t border-[#1a2333] flex items-center justify-between sm:justify-between">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setActiveTab('results')}
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview Results
              </Button>
              <Button>
                <Download className="w-4 h-4 mr-2" />
                Export Design Report
              </Button>
            </div>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedFoundationDesignDialog;
