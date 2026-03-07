/**
 * Advanced Settings Page - Comprehensive Analysis Configuration
 * Industry-standard settings matching STAAD.Pro, SAP2000, ETABS
 * Unified interface for all solver and analysis parameters
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Settings,
  Sliders,
  Cpu,
  Target,
  Shield,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Info,
  Gauge,
  Zap,
  Box,
  Layers,
  Activity,
  GitBranch,
  Database
} from 'lucide-react';
import { Button } from '../components/ui/button';

interface SettingCategory {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
}

interface AnalysisSettings {
  // Solver Settings
  solver: {
    type: 'skyline' | 'sparse' | 'iterative' | 'gpu';
    tolerance: number;
    maxIterations: number;
    preconditioner: 'jacobi' | 'ilu' | 'ssor' | 'amg';
    matrixStorage: 'full' | 'banded' | 'profile' | 'sparse';
    parallelCores: number;
    gpuAcceleration: boolean;
  };
  
  // Static Analysis
  static: {
    pdelta: boolean;
    largeDisplacement: boolean;
    stiffnessReduction: number;
    loadStepFactor: number;
    convergenceTolerance: number;
    maxLoadSteps: number;
  };
  
  // Dynamic Analysis
  dynamic: {
    integrationMethod: 'newmark' | 'hht' | 'wilson' | 'central';
    newmarkBeta: number;
    newmarkGamma: number;
    hhtAlpha: number;
    wilsonTheta: number;
    dampingMethod: 'rayleigh' | 'modal' | 'constant';
    massParticipationCutoff: number;
    frequencyCutoff: number;
    maxModes: number;
  };
  
  // Modal Analysis
  modal: {
    eigenSolver: 'subspace' | 'lanczos' | 'arnoldi' | 'jacobi';
    numModes: number;
    rigidBodyModes: number;
    frequencyRange: [number, number];
    massNormalization: boolean;
    shiftFrequency: number;
  };
  
  // Nonlinear Analysis
  nonlinear: {
    method: 'newton' | 'modified-newton' | 'arc-length' | 'displacement';
    lineSearchEnabled: boolean;
    adaptiveLoadStepping: boolean;
    maxLineSearchIterations: number;
    lineSearchTolerance: number;
    stiffnessUpdate: 'every-iteration' | 'every-step' | 'initial';
    plasticHingeModel: 'lumped' | 'fiber' | 'distributed';
  };
  
  // Design Code Settings
  designCode: {
    concrete: 'IS456' | 'ACI318' | 'EC2' | 'BS8110';
    steel: 'IS800' | 'AISC360' | 'EC3' | 'BS5950';
    seismic: 'IS1893' | 'ASCE7' | 'EC8' | 'IBC';
    loadFactorMethod: 'lsd' | 'wsd' | 'lrfd';
    materialSafetyFactor: number;
    crackingAnalysis: boolean;
    deflectionCheck: boolean;
    ductilityCheck: boolean;
  };
  
  // Output Settings
  output: {
    significantDigits: number;
    outputUnits: 'si' | 'imperial' | 'custom';
    forceUnit: 'kN' | 'N' | 'kgf' | 'lbf' | 'kip';
    lengthUnit: 'mm' | 'm' | 'cm' | 'in' | 'ft';
    stressUnit: 'MPa' | 'N/mm2' | 'ksi' | 'psi';
    detailedOutput: boolean;
    warningLevel: 'strict' | 'moderate' | 'relaxed';
    autoSave: boolean;
    autoSaveInterval: number;
  };
  
  // Performance
  performance: {
    useWebGL: boolean;
    maxElements: number;
    lodLevel: 'high' | 'medium' | 'low' | 'auto';
    antialiasing: boolean;
    shadowsEnabled: boolean;
    animationQuality: 'high' | 'medium' | 'low';
    cacheResults: boolean;
    streamingMode: boolean;
  };
}

const defaultSettings: AnalysisSettings = {
  solver: {
    type: 'sparse',
    tolerance: 1e-8,
    maxIterations: 1000,
    preconditioner: 'ilu',
    matrixStorage: 'sparse',
    parallelCores: 4,
    gpuAcceleration: true
  },
  static: {
    pdelta: true,
    largeDisplacement: false,
    stiffnessReduction: 1.0,
    loadStepFactor: 1.0,
    convergenceTolerance: 0.001,
    maxLoadSteps: 10
  },
  dynamic: {
    integrationMethod: 'newmark',
    newmarkBeta: 0.25,
    newmarkGamma: 0.5,
    hhtAlpha: -0.1,
    wilsonTheta: 1.4,
    dampingMethod: 'rayleigh',
    massParticipationCutoff: 0.90,
    frequencyCutoff: 33.0,
    maxModes: 50
  },
  modal: {
    eigenSolver: 'lanczos',
    numModes: 12,
    rigidBodyModes: 0,
    frequencyRange: [0, 100],
    massNormalization: true,
    shiftFrequency: 0.0
  },
  nonlinear: {
    method: 'newton',
    lineSearchEnabled: true,
    adaptiveLoadStepping: true,
    maxLineSearchIterations: 10,
    lineSearchTolerance: 0.8,
    stiffnessUpdate: 'every-step',
    plasticHingeModel: 'lumped'
  },
  designCode: {
    concrete: 'IS456',
    steel: 'IS800',
    seismic: 'IS1893',
    loadFactorMethod: 'lsd',
    materialSafetyFactor: 1.5,
    crackingAnalysis: true,
    deflectionCheck: true,
    ductilityCheck: true
  },
  output: {
    significantDigits: 4,
    outputUnits: 'si',
    forceUnit: 'kN',
    lengthUnit: 'mm',
    stressUnit: 'MPa',
    detailedOutput: true,
    warningLevel: 'moderate',
    autoSave: true,
    autoSaveInterval: 5
  },
  performance: {
    useWebGL: true,
    maxElements: 100000,
    lodLevel: 'auto',
    antialiasing: true,
    shadowsEnabled: true,
    animationQuality: 'high',
    cacheResults: true,
    streamingMode: false
  }
};

const categories: SettingCategory[] = [
  { id: 'solver', title: 'Solver Configuration', icon: <Cpu className="w-5 h-5" />, description: 'Matrix solver and numerical settings' },
  { id: 'static', title: 'Static Analysis', icon: <Box className="w-5 h-5" />, description: 'Linear and P-Delta analysis options' },
  { id: 'dynamic', title: 'Dynamic Analysis', icon: <Activity className="w-5 h-5" />, description: 'Time integration and damping' },
  { id: 'modal', title: 'Modal Analysis', icon: <Layers className="w-5 h-5" />, description: 'Eigenvalue extraction settings' },
  { id: 'nonlinear', title: 'Nonlinear Analysis', icon: <GitBranch className="w-5 h-5" />, description: 'Newton-Raphson and plasticity' },
  { id: 'designCode', title: 'Design Codes', icon: <Shield className="w-5 h-5" />, description: 'Code compliance settings' },
  { id: 'output', title: 'Output & Units', icon: <Database className="w-5 h-5" />, description: 'Results formatting and units' },
  { id: 'performance', title: 'Performance', icon: <Zap className="w-5 h-5" />, description: 'GPU, rendering, and caching' }
];

export default function AdvancedSettingsPage() {
  const [settings, setSettings] = useState<AnalysisSettings>(defaultSettings);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['solver']));
  const [hasChanges, setHasChanges] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const savedMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => { document.title = 'Advanced Settings | BeamLab'; }, []);

  useEffect(() => {
    return () => {
      if (savedMsgTimerRef.current) clearTimeout(savedMsgTimerRef.current);
    };
  }, []);

  const toggleCategory = useCallback((id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);
  
  const updateSettings = useCallback(<K extends keyof AnalysisSettings>(
    category: K,
    field: keyof AnalysisSettings[K],
    value: AnalysisSettings[K][keyof AnalysisSettings[K]]
  ) => {
    // Guard against NaN from empty number inputs (parseFloat("") → NaN)
    if (typeof value === 'number' && isNaN(value)) return;
    // Guard for arrays containing NaN (e.g., frequencyRange)
    if (Array.isArray(value) && value.some((v: unknown) => typeof v === 'number' && isNaN(v))) return;
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
    setHasChanges(true);
  }, []);
  
  const resetToDefaults = useCallback(() => {
    setSettings(defaultSettings);
    setHasChanges(false);
  }, []);
  
  const saveSettings = useCallback(() => {
    // In production, this would save to backend
    localStorage.setItem('beamlab-settings', JSON.stringify(settings));
    setHasChanges(false);
    setSavedMessage('Settings saved successfully!');
    if (savedMsgTimerRef.current) clearTimeout(savedMsgTimerRef.current);
    savedMsgTimerRef.current = setTimeout(() => setSavedMessage(null), 3000);
  }, [settings]);
  
  const renderSolverSettings = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Solver Type</label>
          <select
            value={settings.solver.type}
            onChange={(e) => updateSettings('solver', 'type', e.target.value as AnalysisSettings['solver']['type'])}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          >
            <option value="skyline">Skyline (Standard)</option>
            <option value="sparse">Sparse Direct (Recommended)</option>
            <option value="iterative">Iterative (PCG)</option>
            <option value="gpu">GPU Accelerated</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Matrix Storage</label>
          <select
            value={settings.solver.matrixStorage}
            onChange={(e) => updateSettings('solver', 'matrixStorage', e.target.value as AnalysisSettings['solver']['matrixStorage'])}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          >
            <option value="full">Full Matrix</option>
            <option value="banded">Banded</option>
            <option value="profile">Profile/Skyline</option>
            <option value="sparse">Sparse (CSR)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Convergence Tolerance</label>
          <input
            type="number"
            value={settings.solver.tolerance}
            onChange={(e) => updateSettings('solver', 'tolerance', parseFloat(e.target.value))}
            step="1e-10"
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Max Iterations</label>
          <input
            type="number"
            value={settings.solver.maxIterations}
            onChange={(e) => updateSettings('solver', 'maxIterations', parseInt(e.target.value))}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Preconditioner</label>
          <select
            value={settings.solver.preconditioner}
            onChange={(e) => updateSettings('solver', 'preconditioner', e.target.value as AnalysisSettings['solver']['preconditioner'])}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          >
            <option value="jacobi">Jacobi</option>
            <option value="ilu">ILU (Incomplete LU)</option>
            <option value="ssor">SSOR</option>
            <option value="amg">AMG (Algebraic Multigrid)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Parallel Cores</label>
          <input
            type="number"
            value={settings.solver.parallelCores}
            onChange={(e) => updateSettings('solver', 'parallelCores', parseInt(e.target.value))}
            min={1}
            max={32}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="gpuAccel"
          checked={settings.solver.gpuAcceleration}
          onChange={(e) => updateSettings('solver', 'gpuAcceleration', e.target.checked)}
          className="w-4 h-4 rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-purple-600"
        />
        <label htmlFor="gpuAccel" className="text-sm text-slate-900 dark:text-white">Enable GPU Acceleration (WebGPU/WebGL Compute)</label>
      </div>
    </div>
  );
  
  const renderStaticSettings = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Stiffness Reduction Factor</label>
          <input
            type="number"
            value={settings.static.stiffnessReduction}
            onChange={(e) => updateSettings('static', 'stiffnessReduction', parseFloat(e.target.value))}
            min={0.1}
            max={1.0}
            step={0.1}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Load Step Factor</label>
          <input
            type="number"
            value={settings.static.loadStepFactor}
            onChange={(e) => updateSettings('static', 'loadStepFactor', parseFloat(e.target.value))}
            min={0.01}
            max={1.0}
            step={0.01}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Convergence Tolerance</label>
          <input
            type="number"
            value={settings.static.convergenceTolerance}
            onChange={(e) => updateSettings('static', 'convergenceTolerance', parseFloat(e.target.value))}
            step={0.0001}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Max Load Steps</label>
          <input
            type="number"
            value={settings.static.maxLoadSteps}
            onChange={(e) => updateSettings('static', 'maxLoadSteps', parseInt(e.target.value))}
            min={1}
            max={100}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="pdelta"
            checked={settings.static.pdelta}
            onChange={(e) => updateSettings('static', 'pdelta', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-purple-600"
          />
          <label htmlFor="pdelta" className="text-sm text-slate-900 dark:text-white">P-Delta Analysis (Geometric Nonlinearity)</label>
        </div>
        
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="largeDisp"
            checked={settings.static.largeDisplacement}
            onChange={(e) => updateSettings('static', 'largeDisplacement', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-purple-600"
          />
          <label htmlFor="largeDisp" className="text-sm text-slate-900 dark:text-white">Large Displacement Analysis</label>
        </div>
      </div>
    </div>
  );
  
  const renderDynamicSettings = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Integration Method</label>
          <select
            value={settings.dynamic.integrationMethod}
            onChange={(e) => updateSettings('dynamic', 'integrationMethod', e.target.value as AnalysisSettings['dynamic']['integrationMethod'])}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          >
            <option value="newmark">Newmark-β (Average Acceleration)</option>
            <option value="hht">HHT-α (Numerical Damping)</option>
            <option value="wilson">Wilson-θ (Unconditional Stability)</option>
            <option value="central">Central Difference (Explicit)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Damping Method</label>
          <select
            value={settings.dynamic.dampingMethod}
            onChange={(e) => updateSettings('dynamic', 'dampingMethod', e.target.value as AnalysisSettings['dynamic']['dampingMethod'])}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          >
            <option value="rayleigh">Rayleigh Damping</option>
            <option value="modal">Modal Damping</option>
            <option value="constant">Constant Damping</option>
          </select>
        </div>
        
        {settings.dynamic.integrationMethod === 'newmark' && (
          <>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Newmark β</label>
              <input
                type="number"
                value={settings.dynamic.newmarkBeta}
                onChange={(e) => updateSettings('dynamic', 'newmarkBeta', parseFloat(e.target.value))}
                step={0.01}
                min={0}
                max={0.5}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Newmark γ</label>
              <input
                type="number"
                value={settings.dynamic.newmarkGamma}
                onChange={(e) => updateSettings('dynamic', 'newmarkGamma', parseFloat(e.target.value))}
                step={0.01}
                min={0}
                max={1.0}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
              />
            </div>
          </>
        )}
        
        {settings.dynamic.integrationMethod === 'hht' && (
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">HHT α</label>
            <input
              type="number"
              value={settings.dynamic.hhtAlpha}
              onChange={(e) => updateSettings('dynamic', 'hhtAlpha', parseFloat(e.target.value))}
              step={0.01}
              min={-0.33}
              max={0}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
            />
          </div>
        )}
        
        {settings.dynamic.integrationMethod === 'wilson' && (
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Wilson θ</label>
            <input
              type="number"
              value={settings.dynamic.wilsonTheta}
              onChange={(e) => updateSettings('dynamic', 'wilsonTheta', parseFloat(e.target.value))}
              step={0.1}
              min={1.0}
              max={2.0}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
            />
          </div>
        )}
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Mass Participation Cutoff</label>
          <input
            type="number"
            value={settings.dynamic.massParticipationCutoff}
            onChange={(e) => updateSettings('dynamic', 'massParticipationCutoff', parseFloat(e.target.value))}
            step={0.01}
            min={0.5}
            max={0.99}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Frequency Cutoff (Hz)</label>
          <input
            type="number"
            value={settings.dynamic.frequencyCutoff}
            onChange={(e) => updateSettings('dynamic', 'frequencyCutoff', parseFloat(e.target.value))}
            min={1}
            max={1000}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Maximum Modes</label>
          <input
            type="number"
            value={settings.dynamic.maxModes}
            onChange={(e) => updateSettings('dynamic', 'maxModes', parseInt(e.target.value))}
            min={1}
            max={500}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
      </div>
    </div>
  );
  
  const renderModalSettings = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Eigenvalue Solver</label>
          <select
            value={settings.modal.eigenSolver}
            onChange={(e) => updateSettings('modal', 'eigenSolver', e.target.value as AnalysisSettings['modal']['eigenSolver'])}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          >
            <option value="subspace">Subspace Iteration</option>
            <option value="lanczos">Lanczos (Recommended)</option>
            <option value="arnoldi">Arnoldi</option>
            <option value="jacobi">Jacobi-Davidson</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Number of Modes</label>
          <input
            type="number"
            value={settings.modal.numModes}
            onChange={(e) => updateSettings('modal', 'numModes', parseInt(e.target.value))}
            min={1}
            max={500}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Rigid Body Modes</label>
          <input
            type="number"
            value={settings.modal.rigidBodyModes}
            onChange={(e) => updateSettings('modal', 'rigidBodyModes', parseInt(e.target.value))}
            min={0}
            max={6}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Shift Frequency (Hz)</label>
          <input
            type="number"
            value={settings.modal.shiftFrequency}
            onChange={(e) => updateSettings('modal', 'shiftFrequency', parseFloat(e.target.value))}
            min={0}
            step={0.1}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Min Frequency (Hz)</label>
          <input
            type="number"
            value={settings.modal.frequencyRange[0]}
            onChange={(e) => updateSettings('modal', 'frequencyRange', [parseFloat(e.target.value), settings.modal.frequencyRange[1]])}
            min={0}
            step={0.1}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Max Frequency (Hz)</label>
          <input
            type="number"
            value={settings.modal.frequencyRange[1]}
            onChange={(e) => updateSettings('modal', 'frequencyRange', [settings.modal.frequencyRange[0], parseFloat(e.target.value)])}
            min={1}
            step={1}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="massNorm"
          checked={settings.modal.massNormalization}
          onChange={(e) => updateSettings('modal', 'massNormalization', e.target.checked)}
          className="w-4 h-4 rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-purple-600"
        />
        <label htmlFor="massNorm" className="text-sm text-slate-900 dark:text-white">Mass Normalization of Mode Shapes</label>
      </div>
    </div>
  );
  
  const renderNonlinearSettings = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Solution Method</label>
          <select
            value={settings.nonlinear.method}
            onChange={(e) => updateSettings('nonlinear', 'method', e.target.value as AnalysisSettings['nonlinear']['method'])}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          >
            <option value="newton">Newton-Raphson</option>
            <option value="modified-newton">Modified Newton-Raphson</option>
            <option value="arc-length">Arc-Length (Riks)</option>
            <option value="displacement">Displacement Control</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Stiffness Update</label>
          <select
            value={settings.nonlinear.stiffnessUpdate}
            onChange={(e) => updateSettings('nonlinear', 'stiffnessUpdate', e.target.value as AnalysisSettings['nonlinear']['stiffnessUpdate'])}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          >
            <option value="every-iteration">Every Iteration</option>
            <option value="every-step">Every Load Step</option>
            <option value="initial">Initial Only</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Plastic Hinge Model</label>
          <select
            value={settings.nonlinear.plasticHingeModel}
            onChange={(e) => updateSettings('nonlinear', 'plasticHingeModel', e.target.value as AnalysisSettings['nonlinear']['plasticHingeModel'])}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          >
            <option value="lumped">Lumped Plasticity</option>
            <option value="fiber">Fiber Section</option>
            <option value="distributed">Distributed Plasticity</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Line Search Tolerance</label>
          <input
            type="number"
            value={settings.nonlinear.lineSearchTolerance}
            onChange={(e) => updateSettings('nonlinear', 'lineSearchTolerance', parseFloat(e.target.value))}
            step={0.01}
            min={0}
            max={1}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Max Line Search Iterations</label>
          <input
            type="number"
            value={settings.nonlinear.maxLineSearchIterations}
            onChange={(e) => updateSettings('nonlinear', 'maxLineSearchIterations', parseInt(e.target.value))}
            min={1}
            max={50}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="lineSearch"
            checked={settings.nonlinear.lineSearchEnabled}
            onChange={(e) => updateSettings('nonlinear', 'lineSearchEnabled', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-purple-600"
          />
          <label htmlFor="lineSearch" className="text-sm text-slate-900 dark:text-white">Enable Line Search</label>
        </div>
        
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="adaptiveLoad"
            checked={settings.nonlinear.adaptiveLoadStepping}
            onChange={(e) => updateSettings('nonlinear', 'adaptiveLoadStepping', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-purple-600"
          />
          <label htmlFor="adaptiveLoad" className="text-sm text-slate-900 dark:text-white">Adaptive Load Stepping</label>
        </div>
      </div>
    </div>
  );
  
  const renderDesignCodeSettings = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Concrete Design Code</label>
          <select
            value={settings.designCode.concrete}
            onChange={(e) => updateSettings('designCode', 'concrete', e.target.value as AnalysisSettings['designCode']['concrete'])}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          >
            <option value="IS456">IS 456:2000 (India)</option>
            <option value="ACI318">ACI 318-19 (USA)</option>
            <option value="EC2">Eurocode 2 (Europe)</option>
            <option value="BS8110">BS 8110 (British)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Steel Design Code</label>
          <select
            value={settings.designCode.steel}
            onChange={(e) => updateSettings('designCode', 'steel', e.target.value as AnalysisSettings['designCode']['steel'])}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          >
            <option value="IS800">IS 800:2007 (India)</option>
            <option value="AISC360">AISC 360-22 (USA)</option>
            <option value="EC3">Eurocode 3 (Europe)</option>
            <option value="BS5950">BS 5950 (British)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Seismic Design Code</label>
          <select
            value={settings.designCode.seismic}
            onChange={(e) => updateSettings('designCode', 'seismic', e.target.value as AnalysisSettings['designCode']['seismic'])}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          >
            <option value="IS1893">IS 1893:2016 (India)</option>
            <option value="ASCE7">ASCE 7-22 (USA)</option>
            <option value="EC8">Eurocode 8 (Europe)</option>
            <option value="IBC">IBC 2021 (International)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Design Philosophy</label>
          <select
            value={settings.designCode.loadFactorMethod}
            onChange={(e) => updateSettings('designCode', 'loadFactorMethod', e.target.value as AnalysisSettings['designCode']['loadFactorMethod'])}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          >
            <option value="lsd">Limit State Design (LSD)</option>
            <option value="wsd">Working Stress Design (WSD)</option>
            <option value="lrfd">LRFD (Load & Resistance Factor)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Material Safety Factor (γm)</label>
          <input
            type="number"
            value={settings.designCode.materialSafetyFactor}
            onChange={(e) => updateSettings('designCode', 'materialSafetyFactor', parseFloat(e.target.value))}
            step={0.05}
            min={1.0}
            max={2.0}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="cracking"
            checked={settings.designCode.crackingAnalysis}
            onChange={(e) => updateSettings('designCode', 'crackingAnalysis', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-purple-600"
          />
          <label htmlFor="cracking" className="text-sm text-slate-900 dark:text-white">Crack Width Analysis</label>
        </div>
        
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="deflection"
            checked={settings.designCode.deflectionCheck}
            onChange={(e) => updateSettings('designCode', 'deflectionCheck', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-purple-600"
          />
          <label htmlFor="deflection" className="text-sm text-slate-900 dark:text-white">Serviceability Deflection Check</label>
        </div>
        
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="ductility"
            checked={settings.designCode.ductilityCheck}
            onChange={(e) => updateSettings('designCode', 'ductilityCheck', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-purple-600"
          />
          <label htmlFor="ductility" className="text-sm text-slate-900 dark:text-white">Ductility Compliance Check</label>
        </div>
      </div>
    </div>
  );
  
  const renderOutputSettings = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Force Unit</label>
          <select
            value={settings.output.forceUnit}
            onChange={(e) => updateSettings('output', 'forceUnit', e.target.value as AnalysisSettings['output']['forceUnit'])}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          >
            <option value="kN">kN</option>
            <option value="N">N</option>
            <option value="kgf">kgf</option>
            <option value="lbf">lbf</option>
            <option value="kip">kip</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Length Unit</label>
          <select
            value={settings.output.lengthUnit}
            onChange={(e) => updateSettings('output', 'lengthUnit', e.target.value as AnalysisSettings['output']['lengthUnit'])}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          >
            <option value="mm">mm</option>
            <option value="m">m</option>
            <option value="cm">cm</option>
            <option value="in">in</option>
            <option value="ft">ft</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Stress Unit</label>
          <select
            value={settings.output.stressUnit}
            onChange={(e) => updateSettings('output', 'stressUnit', e.target.value as AnalysisSettings['output']['stressUnit'])}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          >
            <option value="MPa">MPa</option>
            <option value="N/mm2">N/mm²</option>
            <option value="ksi">ksi</option>
            <option value="psi">psi</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Significant Digits</label>
          <input
            type="number"
            value={settings.output.significantDigits}
            onChange={(e) => updateSettings('output', 'significantDigits', parseInt(e.target.value))}
            min={2}
            max={8}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Warning Level</label>
          <select
            value={settings.output.warningLevel}
            onChange={(e) => updateSettings('output', 'warningLevel', e.target.value as AnalysisSettings['output']['warningLevel'])}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          >
            <option value="strict">Strict (All Warnings)</option>
            <option value="moderate">Moderate</option>
            <option value="relaxed">Relaxed (Critical Only)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Auto-Save Interval (min)</label>
          <input
            type="number"
            value={settings.output.autoSaveInterval}
            onChange={(e) => updateSettings('output', 'autoSaveInterval', parseInt(e.target.value))}
            min={1}
            max={30}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="detailed"
            checked={settings.output.detailedOutput}
            onChange={(e) => updateSettings('output', 'detailedOutput', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-purple-600"
          />
          <label htmlFor="detailed" className="text-sm text-slate-900 dark:text-white">Detailed Analysis Output</label>
        </div>
        
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="autosave"
            checked={settings.output.autoSave}
            onChange={(e) => updateSettings('output', 'autoSave', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-purple-600"
          />
          <label htmlFor="autosave" className="text-sm text-slate-900 dark:text-white">Enable Auto-Save</label>
        </div>
      </div>
    </div>
  );
  
  const renderPerformanceSettings = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Level of Detail</label>
          <select
            value={settings.performance.lodLevel}
            onChange={(e) => updateSettings('performance', 'lodLevel', e.target.value as AnalysisSettings['performance']['lodLevel'])}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          >
            <option value="auto">Auto (Recommended)</option>
            <option value="high">High Quality</option>
            <option value="medium">Medium</option>
            <option value="low">Low (Performance)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Animation Quality</label>
          <select
            value={settings.performance.animationQuality}
            onChange={(e) => updateSettings('performance', 'animationQuality', e.target.value as AnalysisSettings['performance']['animationQuality'])}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          >
            <option value="high">High (60 FPS)</option>
            <option value="medium">Medium (30 FPS)</option>
            <option value="low">Low (15 FPS)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Max Elements</label>
          <input
            type="number"
            value={settings.performance.maxElements}
            onChange={(e) => updateSettings('performance', 'maxElements', parseInt(e.target.value))}
            step={10000}
            min={1000}
            max={1000000}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white"
          />
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="webgl"
            checked={settings.performance.useWebGL}
            onChange={(e) => updateSettings('performance', 'useWebGL', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-purple-600"
          />
          <label htmlFor="webgl" className="text-sm text-slate-900 dark:text-white">Use WebGL Rendering</label>
        </div>
        
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="antialiasing"
            checked={settings.performance.antialiasing}
            onChange={(e) => updateSettings('performance', 'antialiasing', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-purple-600"
          />
          <label htmlFor="antialiasing" className="text-sm text-slate-900 dark:text-white">Antialiasing</label>
        </div>
        
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="shadows"
            checked={settings.performance.shadowsEnabled}
            onChange={(e) => updateSettings('performance', 'shadowsEnabled', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-purple-600"
          />
          <label htmlFor="shadows" className="text-sm text-slate-900 dark:text-white">Enable Shadows</label>
        </div>
        
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="cache"
            checked={settings.performance.cacheResults}
            onChange={(e) => updateSettings('performance', 'cacheResults', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-purple-600"
          />
          <label htmlFor="cache" className="text-sm text-slate-900 dark:text-white">Cache Analysis Results</label>
        </div>
        
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="streaming"
            checked={settings.performance.streamingMode}
            onChange={(e) => updateSettings('performance', 'streamingMode', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-100 dark:bg-slate-800 text-purple-600"
          />
          <label htmlFor="streaming" className="text-sm text-slate-900 dark:text-white">Streaming Mode (Large Models)</label>
        </div>
      </div>
    </div>
  );
  
  const renderSettingsContent = (categoryId: string) => {
    switch (categoryId) {
      case 'solver': return renderSolverSettings();
      case 'static': return renderStaticSettings();
      case 'dynamic': return renderDynamicSettings();
      case 'modal': return renderModalSettings();
      case 'nonlinear': return renderNonlinearSettings();
      case 'designCode': return renderDesignCodeSettings();
      case 'output': return renderOutputSettings();
      case 'performance': return renderPerformanceSettings();
      default: return null;
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2 flex items-center gap-3">
                <Settings className="w-8 h-8 text-purple-400" />
                Advanced Settings
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Configure solver parameters, analysis options, and design preferences
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {hasChanges && (
                <span className="flex items-center gap-2 text-yellow-400 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Unsaved changes
                </span>
              )}
              
              {savedMessage && (
                <span className="flex items-center gap-2 text-green-400 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  {savedMessage}
                </span>
              )}
              
              <Button type="button" onClick={resetToDefaults} variant="outline">
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
              
              <Button type="button"
                onClick={saveSettings}
                disabled={!hasChanges}
                variant={hasChanges ? 'premium' : 'secondary'}
              >
                <Save className="w-4 h-4" />
                Save Settings
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Quick Info */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-lg flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-200">
            <p className="font-medium">Pro Tip</p>
            <p className="text-blue-600 dark:text-blue-300 mt-1">
              These settings affect all analyses. For analysis-specific overrides, use the settings panel in each analysis page.
              Settings are automatically applied to new analyses.
            </p>
          </div>
        </div>
        
        {/* Settings Categories */}
        <div className="space-y-4">
          {categories.map((category) => (
            <div
              key={category.id}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"
            >
              <button type="button"
                onClick={() => toggleCategory(category.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center text-purple-400">
                    {category.icon}
                  </div>
                  <div className="text-left">
                    <h3 className="text-slate-900 dark:text-white font-semibold">{category.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{category.description}</p>
                  </div>
                </div>
                
                {expandedCategories.has(category.id) ? (
                  <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                )}
              </button>
              
              {expandedCategories.has(category.id) && (
                <div className="px-6 pb-6 border-t border-slate-300 dark:border-slate-700 pt-4">
                  {renderSettingsContent(category.id)}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Preset Profiles */}
        <div className="mt-8 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Gauge className="w-5 h-5 text-purple-400" />
            Preset Profiles
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button type="button" className="p-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg text-left transition-colors">
              <div className="font-medium text-slate-900 dark:text-white">High Performance</div>
              <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">Optimized for speed with GPU acceleration</div>
            </button>
            
            <button type="button" className="p-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg text-left transition-colors">
              <div className="font-medium text-slate-900 dark:text-white">High Accuracy</div>
              <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">Maximum precision for critical designs</div>
            </button>
            
            <button type="button" className="p-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg text-left transition-colors">
              <div className="font-medium text-slate-900 dark:text-white">Balanced</div>
              <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">Good balance of speed and accuracy</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
