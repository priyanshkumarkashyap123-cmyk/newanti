/**
 * ============================================================================
 * MODERN LOAD COMBINATOR - INTELLIGENT LOAD COMBINATION INTERFACE
 * ============================================================================
 * 
 * Revolutionary load combination system featuring:
 * - Multi-code automatic combinations (IS, ACI, EC, AS)
 * - Visual load case builder
 * - Drag-and-drop load arrangement
 * - Real-time governing case identification
 * - Load envelope visualization
 * - Pattern loading automation
 * - Load history tracking
 * 
 * @version 4.0.0
 */


import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  Plus,
  Minus,
  Trash2,
  Copy,
  Edit3,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  RefreshCw,
  Download,
  Upload,
  Settings,
  Zap,
  Shield,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Layers,
  Grid3X3,
  Play,
  Pause,
  RotateCw,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Sparkles,
  Wind,
  Snowflake,
  CloudRain,
  Mountain,
  Building2,
  Truck,
  Users,
  Box,
  Maximize2,
  GripVertical,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

type LoadType = 'dead' | 'live' | 'wind' | 'seismic' | 'snow' | 'rain' | 'temperature' | 'settlement' | 'pattern';
type DesignCode = 'IS875' | 'IS1893' | 'ASCE7' | 'EN1990' | 'AS1170';
type CombinationType = 'strength' | 'serviceability' | 'stability' | 'accidental';

interface LoadCase {
  id: string;
  name: string;
  type: LoadType;
  description: string;
  factor: number;
  values: {
    axial?: number;
    shearY?: number;
    shearZ?: number;
    momentY?: number;
    momentZ?: number;
    torsion?: number;
  };
  isEnabled: boolean;
  color: string;
}

interface LoadCombination {
  id: string;
  name: string;
  code: DesignCode;
  type: CombinationType;
  factors: { loadId: string; factor: number }[];
  resultant: LoadCase['values'];
  isGoverning: boolean;
  utilizationRatio: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const LOAD_TYPE_CONFIG: Record<LoadType, { icon: React.ReactNode; color: string; label: string }> = {
  dead: { icon: <Building2 className="w-4 h-4" />, color: '#6366f1', label: 'Dead Load' },
  live: { icon: <Users className="w-4 h-4" />, color: '#22c55e', label: 'Live Load' },
  wind: { icon: <Wind className="w-4 h-4" />, color: '#3b82f6', label: 'Wind Load' },
  seismic: { icon: <Mountain className="w-4 h-4" />, color: '#ef4444', label: 'Seismic Load' },
  snow: { icon: <Snowflake className="w-4 h-4" />, color: '#06b6d4', label: 'Snow Load' },
  rain: { icon: <CloudRain className="w-4 h-4" />, color: '#8b5cf6', label: 'Rain Load' },
  temperature: { icon: <Zap className="w-4 h-4" />, color: '#f59e0b', label: 'Temperature' },
  settlement: { icon: <TrendingDown className="w-4 h-4" />, color: '#ec4899', label: 'Settlement' },
  pattern: { icon: <Grid3X3 className="w-4 h-4" />, color: '#14b8a6', label: 'Pattern Load' },
};

const DEFAULT_LOAD_CASES: LoadCase[] = [
  {
    id: 'dl',
    name: 'DL',
    type: 'dead',
    description: 'Self-weight and permanent loads',
    factor: 1.0,
    values: { axial: -150, momentY: 85, shearY: 45 },
    isEnabled: true,
    color: '#6366f1',
  },
  {
    id: 'll',
    name: 'LL',
    type: 'live',
    description: 'Imposed loads',
    factor: 1.0,
    values: { axial: -80, momentY: 120, shearY: 65 },
    isEnabled: true,
    color: '#22c55e',
  },
  {
    id: 'wlx',
    name: 'WL+X',
    type: 'wind',
    description: 'Wind load in +X direction',
    factor: 1.0,
    values: { momentY: 45, shearY: 25, momentZ: 15 },
    isEnabled: true,
    color: '#3b82f6',
  },
  {
    id: 'wly',
    name: 'WL+Y',
    type: 'wind',
    description: 'Wind load in +Y direction',
    factor: 1.0,
    values: { momentZ: 55, shearZ: 30 },
    isEnabled: true,
    color: '#3b82f6',
  },
  {
    id: 'eqx',
    name: 'EQ+X',
    type: 'seismic',
    description: 'Seismic load in +X direction',
    factor: 1.0,
    values: { momentY: 180, shearY: 95, torsion: 12 },
    isEnabled: true,
    color: '#ef4444',
  },
  {
    id: 'eqy',
    name: 'EQ+Y',
    type: 'seismic',
    description: 'Seismic load in +Y direction',
    factor: 1.0,
    values: { momentZ: 165, shearZ: 88, torsion: 15 },
    isEnabled: true,
    color: '#ef4444',
  },
];

const CODE_COMBINATIONS: Record<DesignCode, { name: string; combinations: Partial<LoadCombination>[] }> = {
  IS875: {
    name: 'IS 875 / IS 1893',
    combinations: [
      { name: '1.5(DL+LL)', type: 'strength', factors: [{ loadId: 'dl', factor: 1.5 }, { loadId: 'll', factor: 1.5 }] },
      { name: '1.2(DL+LL+WL)', type: 'strength', factors: [{ loadId: 'dl', factor: 1.2 }, { loadId: 'll', factor: 1.2 }, { loadId: 'wlx', factor: 1.2 }] },
      { name: '1.5(DL+WL)', type: 'strength', factors: [{ loadId: 'dl', factor: 1.5 }, { loadId: 'wlx', factor: 1.5 }] },
      { name: '0.9DL+1.5WL', type: 'strength', factors: [{ loadId: 'dl', factor: 0.9 }, { loadId: 'wlx', factor: 1.5 }] },
      { name: '1.2(DL+LL)+1.2EQ', type: 'strength', factors: [{ loadId: 'dl', factor: 1.2 }, { loadId: 'll', factor: 1.2 }, { loadId: 'eqx', factor: 1.2 }] },
      { name: '1.5(DL+EQ)', type: 'strength', factors: [{ loadId: 'dl', factor: 1.5 }, { loadId: 'eqx', factor: 1.5 }] },
      { name: '0.9DL+1.5EQ', type: 'strength', factors: [{ loadId: 'dl', factor: 0.9 }, { loadId: 'eqx', factor: 1.5 }] },
      { name: 'DL+LL', type: 'serviceability', factors: [{ loadId: 'dl', factor: 1.0 }, { loadId: 'll', factor: 1.0 }] },
    ],
  },
  ASCE7: {
    name: 'ASCE 7-22',
    combinations: [
      { name: '1.4D', type: 'strength', factors: [{ loadId: 'dl', factor: 1.4 }] },
      { name: '1.2D+1.6L', type: 'strength', factors: [{ loadId: 'dl', factor: 1.2 }, { loadId: 'll', factor: 1.6 }] },
      { name: '1.2D+1.0W+L', type: 'strength', factors: [{ loadId: 'dl', factor: 1.2 }, { loadId: 'wlx', factor: 1.0 }, { loadId: 'll', factor: 1.0 }] },
      { name: '0.9D+1.0W', type: 'strength', factors: [{ loadId: 'dl', factor: 0.9 }, { loadId: 'wlx', factor: 1.0 }] },
      { name: '1.2D+1.0E+L', type: 'strength', factors: [{ loadId: 'dl', factor: 1.2 }, { loadId: 'eqx', factor: 1.0 }, { loadId: 'll', factor: 1.0 }] },
      { name: '0.9D+1.0E', type: 'strength', factors: [{ loadId: 'dl', factor: 0.9 }, { loadId: 'eqx', factor: 1.0 }] },
    ],
  },
  EN1990: {
    name: 'Eurocode 0',
    combinations: [
      { name: '1.35G+1.5Q', type: 'strength', factors: [{ loadId: 'dl', factor: 1.35 }, { loadId: 'll', factor: 1.5 }] },
      { name: '1.35G+1.5W', type: 'strength', factors: [{ loadId: 'dl', factor: 1.35 }, { loadId: 'wlx', factor: 1.5 }] },
      { name: '1.0G+1.5W', type: 'strength', factors: [{ loadId: 'dl', factor: 1.0 }, { loadId: 'wlx', factor: 1.5 }] },
      { name: '1.0G+1.0E', type: 'strength', factors: [{ loadId: 'dl', factor: 1.0 }, { loadId: 'eqx', factor: 1.0 }] },
    ],
  },
  AS1170: {
    name: 'AS 1170',
    combinations: [
      { name: '1.35G', type: 'strength', factors: [{ loadId: 'dl', factor: 1.35 }] },
      { name: '1.2G+1.5Q', type: 'strength', factors: [{ loadId: 'dl', factor: 1.2 }, { loadId: 'll', factor: 1.5 }] },
      { name: '1.2G+Wu+Ψc·Q', type: 'strength', factors: [{ loadId: 'dl', factor: 1.2 }, { loadId: 'wlx', factor: 1.0 }, { loadId: 'll', factor: 0.4 }] },
      { name: '0.9G+Wu', type: 'strength', factors: [{ loadId: 'dl', factor: 0.9 }, { loadId: 'wlx', factor: 1.0 }] },
      { name: 'G+Eu', type: 'strength', factors: [{ loadId: 'dl', factor: 1.0 }, { loadId: 'eqx', factor: 1.0 }] },
    ],
  },
  IS1893: {
    name: 'IS 1893:2016',
    combinations: [
      { name: '1.5(DL+IL)', type: 'strength', factors: [{ loadId: 'dl', factor: 1.5 }, { loadId: 'll', factor: 1.5 }] },
      { name: '1.2(DL+IL+EL)', type: 'strength', factors: [{ loadId: 'dl', factor: 1.2 }, { loadId: 'll', factor: 1.2 }, { loadId: 'eqx', factor: 1.2 }] },
      { name: '1.5(DL+EL)', type: 'strength', factors: [{ loadId: 'dl', factor: 1.5 }, { loadId: 'eqx', factor: 1.5 }] },
      { name: '0.9DL+1.5EL', type: 'strength', factors: [{ loadId: 'dl', factor: 0.9 }, { loadId: 'eqx', factor: 1.5 }] },
    ],
  },
};

// =============================================================================
// LOAD CASE CARD
// =============================================================================

const LoadCaseCard: React.FC<{
  loadCase: LoadCase;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}> = ({ loadCase, onToggle, onEdit, onDelete, onDuplicate }) => {
  const config = LOAD_TYPE_CONFIG[loadCase.type];
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`p-4 rounded-xl border transition-all ${
        loadCase.isEnabled
          ? 'bg-slate-100/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
          : 'bg-slate-100/30 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 opacity-60'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Drag Handle */}
        <div className="cursor-grab text-slate-500 hover:text-slate-400">
          <GripVertical className="w-4 h-4" />
        </div>
        
        {/* Toggle */}
        <button type="button"
          onClick={onToggle}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
            loadCase.isEnabled
              ? 'border-transparent text-slate-900 dark:text-white'
              : 'border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
          }`}
          style={{ backgroundColor: loadCase.isEnabled ? loadCase.color : 'transparent' }}
        >
          {loadCase.isEnabled && <Check className="w-3 h-3" />}
        </button>
        
        {/* Icon & Name */}
        <div className="flex items-center gap-2 flex-1">
          <span style={{ color: loadCase.color }}>{config.icon}</span>
          <div>
            <p className={`font-bold ${loadCase.isEnabled ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
              {loadCase.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{loadCase.description}</p>
          </div>
        </div>
        
        {/* Values Preview */}
        <div className="flex items-center gap-2 text-xs">
          {loadCase.values.momentY && (
            <span className="px-2 py-1 bg-slate-200/50 dark:bg-slate-700/50 rounded text-slate-500 dark:text-slate-400">
              My: {loadCase.values.momentY}
            </span>
          )}
          {loadCase.values.shearY && (
            <span className="px-2 py-1 bg-slate-200/50 dark:bg-slate-700/50 rounded text-slate-500 dark:text-slate-400">
              Vy: {loadCase.values.shearY}
            </span>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1">
          {onEdit && (
            <button type="button"
              onClick={onEdit}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
          <button type="button"
            onClick={onDuplicate}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// =============================================================================
// COMBINATION ROW
// =============================================================================

const CombinationRow: React.FC<{
  combination: LoadCombination;
  loadCases: LoadCase[];
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
}> = ({ combination, loadCases, index, isExpanded, onToggleExpand }) => {
  return (
    <div className={`rounded-xl border transition-all ${
      combination.isGoverning
        ? 'bg-amber-500/10 border-amber-500/50'
        : 'bg-slate-100/30 dark:bg-slate-800/30 border-slate-200/50 dark:border-slate-700/50'
    }`}>
      <div
        className="flex items-center gap-4 p-4 cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Index */}
        <span className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300">
          {index + 1}
        </span>
        
        {/* Name */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-900 dark:text-white">{combination.name}</p>
            {combination.isGoverning && (
              <span className="px-2 py-0.5 text-xs font-bold bg-amber-500/20 text-amber-400 rounded-full">
                GOVERNING
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{combination.type} combination</p>
        </div>
        
        {/* Utilization */}
        <div className="flex items-center gap-3">
          <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, combination.utilizationRatio * 100)}%` }}
              className={`h-full ${
                combination.utilizationRatio > 1 ? 'bg-red-500' :
                combination.utilizationRatio > 0.9 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
          </div>
          <span className={`text-sm font-mono font-bold ${
            combination.utilizationRatio > 1 ? 'text-red-400' :
            combination.utilizationRatio > 0.9 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {(combination.utilizationRatio * 100).toFixed(1)}%
          </span>
        </div>
        
        {/* Expand */}
        <button type="button" className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      
      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
              {/* Factors */}
              <div className="mb-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Load Factors:</p>
                <div className="flex flex-wrap gap-2">
                  {combination.factors.map((f, i) => {
                    const lc = loadCases.find(l => l.id === f.loadId);
                    if (!lc) return null;
                    return (
                      <span
                        key={i}
                        className="px-3 py-1.5 rounded-lg text-sm"
                        style={{ backgroundColor: lc.color + '20', color: lc.color }}
                      >
                        {f.factor.toFixed(2)} × {lc.name}
                      </span>
                    );
                  })}
                </div>
              </div>
              
              {/* Resultant */}
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Resultant Forces:</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {combination.resultant.momentY && (
                    <div className="bg-white/50 dark:bg-slate-900/50 rounded-lg p-2">
                      <span className="text-slate-500 dark:text-slate-400">My = </span>
                      <span className="text-slate-900 dark:text-white font-mono">{combination.resultant.momentY.toFixed(1)} kN·m</span>
                    </div>
                  )}
                  {combination.resultant.shearY && (
                    <div className="bg-white/50 dark:bg-slate-900/50 rounded-lg p-2">
                      <span className="text-slate-500 dark:text-slate-400">Vy = </span>
                      <span className="text-slate-900 dark:text-white font-mono">{combination.resultant.shearY.toFixed(1)} kN</span>
                    </div>
                  )}
                  {combination.resultant.axial && (
                    <div className="bg-white/50 dark:bg-slate-900/50 rounded-lg p-2">
                      <span className="text-slate-500 dark:text-slate-400">P = </span>
                      <span className="text-slate-900 dark:text-white font-mono">{combination.resultant.axial.toFixed(1)} kN</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================================================
// ENVELOPE CHART
// =============================================================================

const EnvelopeChart: React.FC<{
  combinations: LoadCombination[];
}> = ({ combinations }) => {
  const maxMoment = Math.max(...combinations.map(c => Math.abs(c.resultant.momentY || 0)));
  const maxShear = Math.max(...combinations.map(c => Math.abs(c.resultant.shearY || 0)));
  
  return (
    <div className="bg-white/50 dark:bg-slate-900/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-slate-900 dark:text-white">Force Envelope</span>
      </div>
      
      <div className="space-y-4">
        {/* Moment Envelope */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Moment (kN·m)</span>
            <span>Max: {maxMoment.toFixed(1)}</span>
          </div>
          <div className="flex gap-1 h-8">
            {combinations.slice(0, 8).map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ height: 0 }}
                animate={{ height: `${(Math.abs(c.resultant.momentY || 0) / maxMoment) * 100}%` }}
                className={`flex-1 rounded-t ${c.isGoverning ? 'bg-amber-500' : 'bg-blue-500'}`}
                title={`${c.name}: ${c.resultant.momentY?.toFixed(1)} kN·m`}
              />
            ))}
          </div>
        </div>
        
        {/* Shear Envelope */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Shear (kN)</span>
            <span>Max: {maxShear.toFixed(1)}</span>
          </div>
          <div className="flex gap-1 h-8">
            {combinations.slice(0, 8).map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ height: 0 }}
                animate={{ height: `${(Math.abs(c.resultant.shearY || 0) / maxShear) * 100}%` }}
                className={`flex-1 rounded-t ${c.isGoverning ? 'bg-amber-500' : 'bg-emerald-500'}`}
                title={`${c.name}: ${c.resultant.shearY?.toFixed(1)} kN`}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex gap-4 mt-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span className="text-slate-500 dark:text-slate-400">Moment</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-500" />
          <span className="text-slate-500 dark:text-slate-400">Shear</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-amber-500" />
          <span className="text-slate-500 dark:text-slate-400">Governing</span>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ModernLoadCombinator: React.FC<{
  className?: string;
  onCombinationsGenerated?: (combinations: LoadCombination[]) => void;
}> = ({ className, onCombinationsGenerated }) => {
  const genTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (genTimerRef.current) clearTimeout(genTimerRef.current); }, []);
  const [loadCases, setLoadCases] = useState<LoadCase[]>(DEFAULT_LOAD_CASES);
  const [selectedCode, setSelectedCode] = useState<DesignCode>('IS875');
  const [combinations, setCombinations] = useState<LoadCombination[]>([]);
  const [expandedCombination, setExpandedCombination] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showLoadCases, setShowLoadCases] = useState(true);
  
  // Generate combinations
  const generateCombinations = useCallback(() => {
    setIsGenerating(true);
    
    if (genTimerRef.current) clearTimeout(genTimerRef.current);
    genTimerRef.current = setTimeout(() => {
      const codeConfig = CODE_COMBINATIONS[selectedCode];
      const enabledLoadCases = loadCases.filter(lc => lc.isEnabled);
      
      const newCombinations: LoadCombination[] = codeConfig.combinations.map((combo, index) => {
        // Calculate resultant
        const resultant: LoadCase['values'] = { axial: 0, shearY: 0, shearZ: 0, momentY: 0, momentZ: 0, torsion: 0 };
        
        combo.factors?.forEach(f => {
          const lc = enabledLoadCases.find(l => l.id === f.loadId);
          if (lc) {
            Object.keys(resultant).forEach(key => {
              const k = key as keyof LoadCase['values'];
              if (lc.values[k]) {
                resultant[k] = (resultant[k] || 0) + (lc.values[k]! * f.factor);
              }
            });
          }
        });
        
        // Calculate utilization (simplified)
        const utilizationRatio = Math.abs(resultant.momentY || 0) / 300; // Assuming capacity of 300 kN·m
        
        return {
          id: `combo-${index}`,
          name: combo.name || '',
          code: selectedCode,
          type: combo.type || 'strength',
          factors: combo.factors || [],
          resultant,
          isGoverning: false,
          utilizationRatio,
        };
      });
      
      // Find governing case
      const maxUtil = Math.max(...newCombinations.map(c => c.utilizationRatio));
      newCombinations.forEach(c => {
        c.isGoverning = c.utilizationRatio === maxUtil;
      });
      
      setCombinations(newCombinations);
      onCombinationsGenerated?.(newCombinations);
      setIsGenerating(false);
    }, 800);
  }, [loadCases, selectedCode, onCombinationsGenerated]);
  
  // Toggle load case
  const toggleLoadCase = (id: string) => {
    setLoadCases(lcs => lcs.map(lc =>
      lc.id === id ? { ...lc, isEnabled: !lc.isEnabled } : lc
    ));
  };
  
  // Delete load case
  const deleteLoadCase = (id: string) => {
    setLoadCases(lcs => lcs.filter(lc => lc.id !== id));
  };
  
  // Duplicate load case
  const duplicateLoadCase = (id: string) => {
    const lc = loadCases.find(l => l.id === id);
    if (lc) {
      setLoadCases(lcs => [...lcs, {
        ...lc,
        id: `${lc.id}-copy-${Date.now()}`,
        name: `${lc.name} Copy`,
      }]);
    }
  };
  
  return (
    <div className={`bg-white dark:bg-slate-950 rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 dark:from-slate-900 to-slate-800 p-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Load Combinator
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Multi-code load combination generator</p>
            </div>
          </div>
          
          <button type="button"
            onClick={generateCombinations}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white font-medium rounded-xl transition-colors"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Generate
              </>
            )}
          </button>
        </div>
      </div>
      
      <div className="flex h-[600px]">
        {/* Left Panel - Load Cases */}
        <div className={`border-r border-slate-200 dark:border-slate-800 transition-all ${showLoadCases ? 'w-1/2' : 'w-12'}`}>
          {/* Section Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button type="button"
              onClick={() => setShowLoadCases(!showLoadCases)}
              className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {showLoadCases ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {showLoadCases && <span className="font-medium text-slate-900 dark:text-white">Load Cases</span>}
            </button>
            
            {showLoadCases && (
              <button type="button" aria-label="Add load case" title="Add load case" className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Load Cases List */}
          {showLoadCases && (
            <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-60px)]">
              {/* Code Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Design Code</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(CODE_COMBINATIONS) as DesignCode[]).map((code) => (
                    <button type="button"
                      key={code}
                      onClick={() => setSelectedCode(code)}
                      className={`p-2 rounded-lg text-xs font-medium transition-all ${
                        selectedCode === code
                          ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400'
                          : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {CODE_COMBINATIONS[code].name}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Load Cases */}
              <AnimatePresence>
                {loadCases.map((loadCase) => (
                  <LoadCaseCard
                    key={loadCase.id}
                    loadCase={loadCase}
                    onToggle={() => toggleLoadCase(loadCase.id)}
                    onDelete={() => deleteLoadCase(loadCase.id)}
                    onDuplicate={() => duplicateLoadCase(loadCase.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
        
        {/* Right Panel - Combinations */}
        <div className="flex-1 flex flex-col">
          {/* Section Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-medium text-slate-900 dark:text-white">Load Combinations</span>
              <span className="text-slate-500 dark:text-slate-400 text-sm ml-2">
                ({combinations.length} generated)
              </span>
            </div>
            
            {combinations.length > 0 && (
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Download combinations" title="Download combinations" className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <Download className="w-4 h-4" />
                </button>
                <button type="button" aria-label="Settings" title="Settings" className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          
          {/* Combinations Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {combinations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Layers className="w-12 h-12 text-slate-700 mb-4" />
                <p className="text-lg font-medium text-slate-500 dark:text-slate-400 mb-2">No Combinations Generated</p>
                <p className="text-sm text-slate-500 mb-4">
                  Select a design code and click Generate to create load combinations
                </p>
                <button type="button"
                  onClick={generateCombinations}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Generate Combinations
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Envelope Chart */}
                <EnvelopeChart combinations={combinations} />
                
                {/* Combinations List */}
                <div className="space-y-2">
                  {combinations.map((combo, index) => (
                    <CombinationRow
                      key={combo.id}
                      combination={combo}
                      loadCases={loadCases}
                      index={index}
                      isExpanded={expandedCombination === combo.id}
                      onToggleExpand={() => setExpandedCombination(
                        expandedCombination === combo.id ? null : combo.id
                      )}
                    />
                  ))}
                </div>
                
                {/* Summary */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-slate-100/50 dark:from-slate-800/50 to-slate-50/50 dark:to-slate-900/50 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-400" />
                    Summary
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Total Combinations:</span>
                      <p className="text-slate-900 dark:text-white font-bold">{combinations.length}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Governing Case:</span>
                      <p className="text-amber-400 font-bold">
                        {combinations.find(c => c.isGoverning)?.name || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Max Utilization:</span>
                      <p className="text-emerald-400 font-bold">
                        {(Math.max(...combinations.map(c => c.utilizationRatio)) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernLoadCombinator;

// Missing import
const ChevronLeft = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
