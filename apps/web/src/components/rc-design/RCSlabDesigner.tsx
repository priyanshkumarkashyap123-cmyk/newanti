/**
 * ============================================================================
 * RC SLAB DESIGNER COMPONENT
 * ============================================================================
 * 
 * Ultra-modern React component for reinforced concrete slab design.
 * Features one-way, two-way, and flat slab design with visualization.
 * 
 * @version 1.0.0
 */


import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator,
  Settings,
  FileText,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowRight,
  Download,
  RefreshCw,
  Grid,
  Maximize,
  Activity,
  Square,
} from 'lucide-react';

// Import design engine
import {
  RCSlabDesignEngine,
  SlabDesignResult,
  SlabType as EngineSlabType,
  SupportCondition as EngineSupportCondition,
  designTwoWaySlab,
  designFlatSlab,
} from '@/modules/concrete/RCSlabDesignEngine';
import {
  DesignCode,
  getConcreteGrades,
  getSteelGrades,
} from '@/modules/concrete/RCDesignConstants';

// Types
type SlabType = 'one-way' | 'two-way' | 'flat-slab' | 'ribbed';
type SupportCondition = 'interior' | 'one-edge-disc' | 'two-edges-disc-adj' | 'two-edges-disc-opp' | 'three-edges-disc' | 'corner' | 'one-long-edge-disc' | 'one-short-edge-disc';

interface SlabFormData {
  slabType: SlabType;
  Lx: number;
  Ly: number;
  D: number;
  support: SupportCondition;
  LL: number;
  finishes: number;
  partitions: number;
  code: DesignCode;
  concreteGrade: string;
  steelGrade: string;
  cover: number;
  // For flat slab
  columnSizeX?: number;
  columnSizeY?: number;
  dropPanelX?: number;
  dropPanelY?: number;
  dropThickness?: number;
}

// Default values
const defaultFormData: SlabFormData = {
  slabType: 'two-way',
  Lx: 4000,
  Ly: 5000,
  D: 150,
  support: 'interior',
  LL: 3.0,
  finishes: 1.0,
  partitions: 1.5,
  code: 'IS456',
  concreteGrade: 'M25',
  steelGrade: 'Fe500',
  cover: 20,
  columnSizeX: 400,
  columnSizeY: 400,
};

// Support condition labels
const SUPPORT_CONDITIONS: Record<SupportCondition, string> = {
  'interior': 'Interior Panel (All edges continuous)',
  'one-edge-disc': 'One Edge Discontinuous',
  'two-edges-disc-adj': 'Two Adjacent Edges Discontinuous',
  'two-edges-disc-opp': 'Two Opposite Edges Discontinuous',
  'three-edges-disc': 'Three Edges Discontinuous',
  'corner': 'Corner Panel (Two adjacent edges + corner)',
  'one-long-edge-disc': 'One Long Edge Discontinuous',
  'one-short-edge-disc': 'One Short Edge Discontinuous',
};

// Component
export default function RCSlabDesigner() {
  const [formData, setFormData] = useState<SlabFormData>(defaultFormData);
  const [result, setResult] = useState<SlabDesignResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [activeTab, setActiveTab] = useState<'input' | 'results' | 'layout'>('input');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    geometry: true,
    loading: true,
    support: false,
    materials: true,
  });

  // Get available grades based on code
  const concreteGrades = useMemo(() => getConcreteGrades(formData.code), [formData.code]);
  const steelGrades = useMemo(() => getSteelGrades(formData.code), [formData.code]);

  // Aspect ratio calculation
  const aspectRatio = useMemo(() => {
    const ratio = formData.Ly / formData.Lx;
    return {
      ratio: ratio.toFixed(2),
      type: ratio <= 2 ? 'Two-way slab' : 'One-way slab',
      isOneWay: ratio > 2,
    };
  }, [formData.Lx, formData.Ly]);

  // Handle form changes
  const handleChange = useCallback((field: keyof SlabFormData, value: number | string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Toggle section
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // Run design calculation
  const runDesign = useCallback(async () => {
    setIsCalculating(true);
    
    await new Promise(resolve => setTimeout(resolve, 500));

    const selectedConcrete = concreteGrades.find(g => g.grade === formData.concreteGrade) || concreteGrades[2];
    const selectedSteel = steelGrades.find(g => g.grade === formData.steelGrade) || steelGrades[1];

    try {
      let designResult: SlabDesignResult;
      
      if (formData.slabType === 'flat-slab') {
        designResult = designFlatSlab(
          formData.Lx,
          formData.Ly,
          formData.D,
          formData.columnSizeX || 400,  // columnSize
          formData.LL,
          formData.finishes,            // deadLoad (finishes + partition)
          selectedConcrete.fck,
          selectedSteel.fy,
          formData.code
        );
      } else {
        // Map support condition to engine type
        const supportMap: Record<SupportCondition, EngineSupportCondition> = {
          'interior': 'continuous-four-edges',
          'one-edge-disc': 'continuous-three-edges',
          'two-edges-disc-adj': 'continuous-two-adjacent',
          'two-edges-disc-opp': 'continuous-two-opposite',
          'three-edges-disc': 'continuous-one-edge',
          'corner': 'continuous-two-adjacent',
          'one-long-edge-disc': 'continuous-three-edges',
          'one-short-edge-disc': 'continuous-three-edges',
        };
        
        designResult = designTwoWaySlab(
          formData.Lx,
          formData.Ly,
          formData.D,
          formData.finishes,                          // deadLoad
          formData.LL,                                // liveLoad
          selectedConcrete.fck,
          selectedSteel.fy,
          supportMap[formData.support] || 'simply-supported',
          formData.code
        );
      }

      setResult(designResult);
      setActiveTab('results');
    } catch (error) {
      console.error('Design calculation failed:', error);
    }

    setIsCalculating(false);
  }, [formData, concreteGrades, steelGrades]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 dark:from-slate-900 via-teal-100 dark:via-teal-950 to-slate-50 dark:to-slate-900">
      {/* Header */}
      <header className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-xl">
                <Grid className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">RC Slab Designer</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">One-way, two-way & flat slab design</p>
              </div>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex items-center gap-2 bg-slate-200/50 dark:bg-slate-700/50 rounded-xl p-1">
              {(['input', 'results', 'layout'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-teal-500 text-white shadow-lg'
                      : 'text-slate-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white hover:bg-slate-600/50'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8"
            >
              {/* Input Form */}
              <div className="space-y-6">
                {/* Slab Type Selection */}
                <InputCard title="Slab Type" icon={<Layers className="w-5 h-5" />}>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { type: 'one-way', label: 'One-Way Slab', icon: '━━━' },
                      { type: 'two-way', label: 'Two-Way Slab', icon: '╋' },
                      { type: 'flat-slab', label: 'Flat Slab', icon: '▬' },
                      { type: 'ribbed', label: 'Ribbed/Waffle', icon: '⫶' },
                    ] as const).map(({ type, label, icon }) => (
                      <button
                        key={type}
                        onClick={() => handleChange('slabType', type)}
                        className={`py-4 rounded-xl text-sm font-medium transition-all flex flex-col items-center gap-2 ${
                          formData.slabType === type
                            ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white'
                            : 'bg-slate-200/50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-600/50'
                        }`}
                      >
                        <span className="text-xl">{icon}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                </InputCard>

                {/* Design Code Selection */}
                <InputCard title="Design Code" icon={<Settings className="w-5 h-5" />}>
                  <div className="grid grid-cols-4 gap-2">
                    {(['IS456', 'ACI318', 'EN1992', 'AS3600'] as const).map((code) => (
                      <button
                        key={code}
                        onClick={() => handleChange('code', code)}
                        className={`py-3 rounded-lg text-sm font-medium transition-all ${
                          formData.code === code
                            ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white'
                            : 'bg-slate-200/50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-600/50'
                        }`}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </InputCard>

                {/* Geometry */}
                <CollapsibleSection
                  title="Geometry"
                  icon={<Maximize className="w-5 h-5" />}
                  isExpanded={expandedSections.geometry}
                  onToggle={() => toggleSection('geometry')}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="Short Span (Lx)"
                      value={formData.Lx}
                      onChange={(v) => handleChange('Lx', v)}
                      unit="mm"
                    />
                    <InputField
                      label="Long Span (Ly)"
                      value={formData.Ly}
                      onChange={(v) => handleChange('Ly', v)}
                      unit="mm"
                    />
                    <InputField
                      label="Slab Thickness (D)"
                      value={formData.D}
                      onChange={(v) => handleChange('D', v)}
                      unit="mm"
                    />
                    <InputField
                      label="Clear Cover"
                      value={formData.cover}
                      onChange={(v) => handleChange('cover', v)}
                      unit="mm"
                    />
                    {formData.slabType === 'flat-slab' && (
                      <>
                        <InputField
                          label="Column Size (X)"
                          value={formData.columnSizeX || 400}
                          onChange={(v) => handleChange('columnSizeX', v)}
                          unit="mm"
                        />
                        <InputField
                          label="Column Size (Y)"
                          value={formData.columnSizeY || 400}
                          onChange={(v) => handleChange('columnSizeY', v)}
                          unit="mm"
                        />
                      </>
                    )}
                  </div>
                </CollapsibleSection>

                {/* Loading */}
                <CollapsibleSection
                  title="Loading"
                  icon={<Activity className="w-5 h-5" />}
                  isExpanded={expandedSections.loading}
                  onToggle={() => toggleSection('loading')}
                >
                  <div className="grid grid-cols-1 gap-4">
                    <InputField
                      label="Live Load"
                      value={formData.LL}
                      onChange={(v) => handleChange('LL', v)}
                      unit="kN/m²"
                    />
                    <InputField
                      label="Floor Finish"
                      value={formData.finishes}
                      onChange={(v) => handleChange('finishes', v)}
                      unit="kN/m²"
                    />
                    <InputField
                      label="Partitions"
                      value={formData.partitions}
                      onChange={(v) => handleChange('partitions', v)}
                      unit="kN/m²"
                    />
                    <div className="p-4 bg-slate-700/30 rounded-lg">
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Self Weight (auto)</span>
                        <span className="text-zinc-900 dark:text-white font-medium">
                          {(formData.D / 1000 * 25).toFixed(2)} kN/m²
                        </span>
                      </div>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Support Conditions */}
                {formData.slabType !== 'flat-slab' && (
                  <CollapsibleSection
                    title="Support Conditions"
                    icon={<Square className="w-5 h-5" />}
                    isExpanded={expandedSections.support}
                    onToggle={() => toggleSection('support')}
                  >
                    <div className="space-y-2">
                      {(Object.entries(SUPPORT_CONDITIONS) as [SupportCondition, string][]).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => handleChange('support', key)}
                          className={`w-full py-3 px-4 rounded-lg text-left text-sm transition-all ${
                            formData.support === key
                              ? 'bg-teal-500/20 border border-teal-500/50 text-teal-300'
                              : 'bg-slate-700/30 text-slate-600 dark:text-slate-300 hover:bg-slate-600/30'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Materials */}
                <CollapsibleSection
                  title="Materials"
                  icon={<Layers className="w-5 h-5" />}
                  isExpanded={expandedSections.materials}
                  onToggle={() => toggleSection('materials')}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Concrete Grade</label>
                      <select
                        value={formData.concreteGrade}
                        onChange={(e) => handleChange('concreteGrade', e.target.value)}
                        className="w-full bg-slate-200/50 dark:bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        {concreteGrades.map((grade) => (
                          <option key={grade.grade} value={grade.grade}>
                            {grade.grade}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Steel Grade</label>
                      <select
                        value={formData.steelGrade}
                        onChange={(e) => handleChange('steelGrade', e.target.value)}
                        className="w-full bg-slate-200/50 dark:bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        {steelGrades.map((grade) => (
                          <option key={grade.grade} value={grade.grade}>
                            {grade.grade}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Design Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={runDesign}
                  disabled={isCalculating}
                  className="w-full py-4 bg-gradient-to-r from-teal-500 via-emerald-500 to-green-500 rounded-xl text-zinc-900 dark:text-white font-bold text-lg shadow-lg shadow-teal-500/25 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isCalculating ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-5 h-5" />
                      Design Slab
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </motion.button>
              </div>

              {/* Preview Panel */}
              <div className="space-y-6">
                <SlabPreview formData={formData} />
                <AspectRatioCard data={aspectRatio} />
                <LoadSummary formData={formData} />
              </div>
            </motion.div>
          )}

          {activeTab === 'results' && result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <SlabResultsPanel result={result} />
            </motion.div>
          )}

          {activeTab === 'layout' && result && (
            <motion.div
              key="layout"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <SlabReinforcementLayout result={result} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// Sub-components
function InputCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-teal-400">{icon}</div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 hover:bg-slate-700/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-teal-400">{icon}</div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        )}
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-6 pb-6"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  unit,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          disabled={disabled}
          className={`w-full bg-slate-200/50 dark:bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 pr-16 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 text-sm">
          {unit}
        </span>
      </div>
    </div>
  );
}

function SlabPreview({ formData }: { formData: SlabFormData }) {
  const svgSize = 350;
  const padding = 40;
  const maxDim = Math.max(formData.Lx, formData.Ly);
  const scale = (svgSize - 2 * padding) / maxDim;

  const slabWidth = formData.Lx * scale;
  const slabHeight = formData.Ly * scale;
  const startX = (svgSize - slabWidth) / 2;
  const startY = (svgSize - slabHeight) / 2;

  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Slab Plan View</h3>
      <svg viewBox={`0 0 ${svgSize} ${svgSize}`} className="w-full h-64 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl">
        {/* Grid */}
        <defs>
          <pattern id="grid-slab" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#334155" strokeWidth="0.5" />
          </pattern>
          <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#14b8a6" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-slab)" />

        {/* Slab outline */}
        <rect
          x={startX}
          y={startY}
          width={slabWidth}
          height={slabHeight}
          fill="url(#hatch)"
          stroke="#14b8a6"
          strokeWidth="2"
        />

        {/* Span arrows */}
        <g>
          {/* X-direction */}
          <line
            x1={startX}
            y1={startY + slabHeight + 20}
            x2={startX + slabWidth}
            y2={startY + slabHeight + 20}
            stroke="#94a3b8"
            strokeWidth="1"
            markerEnd="url(#arrow)"
            markerStart="url(#arrow)"
          />
          <text
            x={startX + slabWidth / 2}
            y={startY + slabHeight + 35}
            textAnchor="middle"
            className="fill-slate-400 text-xs"
          >
            Lx = {formData.Lx} mm
          </text>

          {/* Y-direction */}
          <line
            x1={startX + slabWidth + 20}
            y1={startY}
            x2={startX + slabWidth + 20}
            y2={startY + slabHeight}
            stroke="#94a3b8"
            strokeWidth="1"
          />
          <text
            x={startX + slabWidth + 35}
            y={startY + slabHeight / 2}
            textAnchor="middle"
            className="fill-slate-400 text-xs"
            transform={`rotate(90, ${startX + slabWidth + 35}, ${startY + slabHeight / 2})`}
          >
            Ly = {formData.Ly} mm
          </text>
        </g>

        {/* Support indicators */}
        <g>
          {/* Bottom support */}
          <line
            x1={startX - 5}
            y1={startY + slabHeight + 5}
            x2={startX + slabWidth + 5}
            y2={startY + slabHeight + 5}
            stroke="#f59e0b"
            strokeWidth="3"
          />
          {/* Top support */}
          <line
            x1={startX - 5}
            y1={startY - 5}
            x2={startX + slabWidth + 5}
            y2={startY - 5}
            stroke="#f59e0b"
            strokeWidth="3"
          />
          {/* Left support */}
          <line
            x1={startX - 5}
            y1={startY - 5}
            x2={startX - 5}
            y2={startY + slabHeight + 5}
            stroke="#f59e0b"
            strokeWidth="3"
          />
          {/* Right support */}
          <line
            x1={startX + slabWidth + 5}
            y1={startY - 5}
            x2={startX + slabWidth + 5}
            y2={startY + slabHeight + 5}
            stroke="#f59e0b"
            strokeWidth="3"
          />
        </g>

        {/* Flat slab columns */}
        {formData.slabType === 'flat-slab' && (
          <g>
            <rect
              x={startX - 10}
              y={startY - 10}
              width={20}
              height={20}
              fill="#64748b"
            />
            <rect
              x={startX + slabWidth - 10}
              y={startY - 10}
              width={20}
              height={20}
              fill="#64748b"
            />
            <rect
              x={startX - 10}
              y={startY + slabHeight - 10}
              width={20}
              height={20}
              fill="#64748b"
            />
            <rect
              x={startX + slabWidth - 10}
              y={startY + slabHeight - 10}
              width={20}
              height={20}
              fill="#64748b"
            />
          </g>
        )}
      </svg>
    </div>
  );
}

function AspectRatioCard({ data }: { data: { ratio: string; type: string; isOneWay: boolean } }) {
  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Aspect Ratio Analysis</h3>
      <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
        <div>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Ly/Lx Ratio</p>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white">{data.ratio}</p>
        </div>
        <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
          data.isOneWay
            ? 'bg-yellow-500/20 text-yellow-400'
            : 'bg-teal-500/20 text-teal-400'
        }`}>
          {data.type}
        </div>
      </div>
      <div className="mt-4 relative h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(parseFloat(data.ratio) / 3 * 100, 100)}%` }}
          className={`h-full ${
            data.isOneWay
              ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
              : 'bg-gradient-to-r from-teal-500 to-emerald-500'
          }`}
        />
        <div className="absolute left-[66%] top-0 bottom-0 w-0.5 bg-slate-400" />
      </div>
      <div className="flex justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
        <span>1.0</span>
        <span className="text-yellow-400">2.0 (Threshold)</span>
        <span>3.0</span>
      </div>
    </div>
  );
}

function LoadSummary({ formData }: { formData: SlabFormData }) {
  const selfWeight = formData.D / 1000 * 25;
  const totalDL = selfWeight + formData.finishes + formData.partitions;
  const totalLoad = totalDL + formData.LL;
  const factoredLoad = 1.5 * totalDL + 1.5 * formData.LL;

  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Load Summary</h3>
      <div className="space-y-3">
        <div className="flex justify-between p-3 bg-slate-700/30 rounded-lg">
          <span className="text-slate-500 dark:text-slate-400">Self Weight</span>
          <span className="text-zinc-900 dark:text-white font-medium">{selfWeight.toFixed(2)} kN/m²</span>
        </div>
        <div className="flex justify-between p-3 bg-slate-700/30 rounded-lg">
          <span className="text-slate-500 dark:text-slate-400">Total Dead Load</span>
          <span className="text-zinc-900 dark:text-white font-medium">{totalDL.toFixed(2)} kN/m²</span>
        </div>
        <div className="flex justify-between p-3 bg-slate-700/30 rounded-lg">
          <span className="text-slate-500 dark:text-slate-400">Live Load</span>
          <span className="text-zinc-900 dark:text-white font-medium">{formData.LL.toFixed(2)} kN/m²</span>
        </div>
        <div className="flex justify-between p-3 bg-teal-500/20 rounded-lg border border-teal-500/30">
          <span className="text-teal-300">Factored Load (wu)</span>
          <span className="text-teal-300 font-bold">{factoredLoad.toFixed(2)} kN/m²</span>
        </div>
      </div>
    </div>
  );
}

function SlabResultsPanel({ result }: { result: SlabDesignResult }) {
  const isDesignOk = result.summary.status === 'safe';

  // Helper to format bar info
  const formatBars = (rebar: { barDiameter: number; spacing: number } | undefined) => {
    if (!rebar) return '-';
    return `${rebar.barDiameter}ø @ ${rebar.spacing}mm c/c`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Status Card */}
      <div className={`col-span-1 lg:col-span-3 p-6 rounded-2xl ${
        isDesignOk
          ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30'
          : 'bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30'
      }`}>
        <div className="flex items-center gap-4">
          {isDesignOk ? (
            <CheckCircle className="w-12 h-12 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-12 h-12 text-red-400" />
          )}
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {isDesignOk ? 'Design OK' : 'Design Needs Revision'}
            </h2>
            <p className="text-slate-600 dark:text-slate-300">
              {result.geometry.type} slab designed per {result.materials.code}
            </p>
          </div>
        </div>
      </div>

      {/* Short Span Reinforcement */}
      <ResultCard title="Short Span (Lx) Reinforcement" status="pass">
        <div className="space-y-2">
          <ResultRow label="Negative Moment" value={`${result.moments?.Mx_negative?.toFixed(1) || '-'} kN-m/m`} />
          <ResultRow label="Positive Moment" value={`${result.moments?.Mx_positive?.toFixed(1) || '-'} kN-m/m`} />
          <div className="border-t border-slate-600 pt-2 mt-2">
            <ResultRow label="Ast (Bottom)" value={`${result.reinforcement?.shortSpan?.bottom?.Ast_provided?.toFixed(0) || '-'} mm²/m`} />
            <ResultRow label="Ast (Top)" value={`${result.reinforcement?.shortSpan?.top?.Ast_provided?.toFixed(0) || '-'} mm²/m`} />
            <ResultRow label="Bottom Bars" value={formatBars(result.reinforcement?.shortSpan?.bottom)} />
          </div>
        </div>
      </ResultCard>

      {/* Long Span Reinforcement */}
      <ResultCard title="Long Span (Ly) Reinforcement" status="pass">
        <div className="space-y-2">
          <ResultRow label="Negative Moment" value={`${result.moments?.My_negative?.toFixed(1) || '-'} kN-m/m`} />
          <ResultRow label="Positive Moment" value={`${result.moments?.My_positive?.toFixed(1) || '-'} kN-m/m`} />
          <div className="border-t border-slate-600 pt-2 mt-2">
            <ResultRow label="Ast (Bottom)" value={`${result.reinforcement?.longSpan?.bottom?.Ast_provided?.toFixed(0) || '-'} mm²/m`} />
            <ResultRow label="Ast (Top)" value={`${result.reinforcement?.longSpan?.top?.Ast_provided?.toFixed(0) || '-'} mm²/m`} />
            <ResultRow label="Bottom Bars" value={formatBars(result.reinforcement?.longSpan?.bottom)} />
          </div>
        </div>
      </ResultCard>

      {/* Serviceability */}
      <ResultCard title="Serviceability Checks" status={result.deflection?.status || 'pass'}>
        <div className="space-y-2">
          <ResultRow label="Span/Depth (actual)" value={result.deflection?.spanDepthRatio_provided?.toFixed(1) || '-'} />
          <ResultRow label="Span/Depth (allowed)" value={result.deflection?.spanDepthRatio_allowed?.toFixed(1) || '-'} />
          <ResultRow label="Deflection Check" value={result.deflection?.status === 'pass' ? '✓ OK' : '✗ FAIL'} />
          {result.punchingShear && (
            <>
              <div className="border-t border-slate-600 pt-2 mt-2">
                <ResultRow label="Punching Shear" value={`${result.punchingShear.shearStress?.toFixed(2) || '-'} MPa`} />
                <ResultRow label="Capacity" value={`${result.punchingShear.allowableStress?.toFixed(2) || '-'} MPa`} />
              </div>
            </>
          )}
        </div>
      </ResultCard>

      {/* Export Button */}
      <div className="col-span-1 lg:col-span-3 flex justify-end gap-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-3 bg-slate-200 dark:bg-slate-700 rounded-xl text-zinc-900 dark:text-white font-medium flex items-center gap-2"
        >
          <FileText className="w-5 h-5" />
          Export Report
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-xl text-white font-medium flex items-center gap-2"
        >
          <Download className="w-5 h-5" />
          Download Layout
        </motion.button>
      </div>
    </div>
  );
}

function ResultCard({
  title,
  status,
  children,
}: {
  title: string;
  status: 'pass' | 'fail';
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h3>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          status === 'pass'
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-red-500/20 text-red-400'
        }`}>
          {status.toUpperCase()}
        </span>
      </div>
      {children}
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 dark:text-slate-400 text-sm">{label}</span>
      <span className="text-zinc-900 dark:text-white font-medium">{value}</span>
    </div>
  );
}

function SlabReinforcementLayout({ result }: { result: SlabDesignResult }) {
  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
      <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-6">Reinforcement Layout</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bottom Reinforcement */}
        <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-4">
          <h4 className="text-lg font-semibold text-teal-400 mb-4">Bottom Reinforcement</h4>
          <svg viewBox="0 0 400 300" className="w-full h-64">
            {/* Slab outline */}
            <rect x="50" y="50" width="300" height="200" fill="none" stroke="#64748b" strokeWidth="2" />
            
            {/* Short span bars (bottom layer) */}
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <line
                key={`x-${i}`}
                x1="50"
                y1={75 + i * 25}
                x2="350"
                y2={75 + i * 25}
                stroke="#14b8a6"
                strokeWidth="2"
              />
            ))}
            
            {/* Long span bars (top layer of bottom) */}
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <line
                key={`y-${i}`}
                x1={80 + i * 45}
                y1="50"
                x2={80 + i * 45}
                y2="250"
                stroke="#10b981"
                strokeWidth="1.5"
              />
            ))}

            {/* Labels */}
            <text x="200" y="280" textAnchor="middle" className="fill-teal-400 text-xs">
              Short span bars: {result.reinforcement?.shortSpan?.bottom ? `${result.reinforcement.shortSpan.bottom.barDiameter}ø @ ${result.reinforcement.shortSpan.bottom.spacing}mm c/c` : '10ø @ 150 c/c'}
            </text>
            <text x="200" y="35" textAnchor="middle" className="fill-emerald-400 text-xs">
              Long span bars: {result.reinforcement?.longSpan?.bottom ? `${result.reinforcement.longSpan.bottom.barDiameter}ø @ ${result.reinforcement.longSpan.bottom.spacing}mm c/c` : '8ø @ 150 c/c'}
            </text>
          </svg>
        </div>

        {/* Top Reinforcement at Supports */}
        <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-4">
          <h4 className="text-lg font-semibold text-orange-400 mb-4">Top Reinforcement (at Supports)</h4>
          <svg viewBox="0 0 400 300" className="w-full h-64">
            {/* Slab outline */}
            <rect x="50" y="50" width="300" height="200" fill="none" stroke="#64748b" strokeWidth="2" />
            
            {/* Support zones - top edges */}
            <rect x="50" y="50" width="300" height="40" fill="rgba(249, 115, 22, 0.2)" />
            <rect x="50" y="210" width="300" height="40" fill="rgba(249, 115, 22, 0.2)" />
            <rect x="50" y="90" width="40" height="120" fill="rgba(249, 115, 22, 0.2)" />
            <rect x="310" y="90" width="40" height="120" fill="rgba(249, 115, 22, 0.2)" />
            
            {/* Top bars at supports */}
            {[0, 1, 2, 3].map((i) => (
              <React.Fragment key={`top-${i}`}>
                <line x1="50" y1={55 + i * 10} x2="350" y2={55 + i * 10} stroke="#f97316" strokeWidth="2" />
                <line x1="50" y1={215 + i * 10} x2="350" y2={215 + i * 10} stroke="#f97316" strokeWidth="2" />
              </React.Fragment>
            ))}

            {/* Labels */}
            <text x="200" y="140" textAnchor="middle" className="fill-slate-400 text-sm">
              L/4 from supports
            </text>
            <text x="200" y="160" textAnchor="middle" className="fill-orange-400 text-xs">
              Top steel: Same as bottom steel
            </text>
          </svg>
        </div>
      </div>

      {/* Bar Bending Schedule */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-600">
              <th className="text-left py-3 px-4 text-slate-500 dark:text-slate-400">Bar Mark</th>
              <th className="text-left py-3 px-4 text-slate-500 dark:text-slate-400">Direction</th>
              <th className="text-left py-3 px-4 text-slate-500 dark:text-slate-400">Position</th>
              <th className="text-left py-3 px-4 text-slate-500 dark:text-slate-400">Diameter</th>
              <th className="text-left py-3 px-4 text-slate-500 dark:text-slate-400">Spacing</th>
              <th className="text-left py-3 px-4 text-slate-500 dark:text-slate-400">Length</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200/50 dark:border-slate-700/50">
              <td className="py-3 px-4 text-zinc-900 dark:text-white">A1</td>
              <td className="py-3 px-4 text-zinc-900 dark:text-white">Short Span (X)</td>
              <td className="py-3 px-4 text-zinc-900 dark:text-white">Bottom</td>
              <td className="py-3 px-4 text-zinc-900 dark:text-white">10ø</td>
              <td className="py-3 px-4 text-zinc-900 dark:text-white">150 mm</td>
              <td className="py-3 px-4 text-zinc-900 dark:text-white">{result.geometry?.Ly || 5000} mm</td>
            </tr>
            <tr className="border-b border-slate-200/50 dark:border-slate-700/50">
              <td className="py-3 px-4 text-zinc-900 dark:text-white">B1</td>
              <td className="py-3 px-4 text-zinc-900 dark:text-white">Long Span (Y)</td>
              <td className="py-3 px-4 text-zinc-900 dark:text-white">Bottom</td>
              <td className="py-3 px-4 text-zinc-900 dark:text-white">8ø</td>
              <td className="py-3 px-4 text-zinc-900 dark:text-white">150 mm</td>
              <td className="py-3 px-4 text-zinc-900 dark:text-white">{result.geometry?.Lx || 4000} mm</td>
            </tr>
            <tr className="border-b border-slate-200/50 dark:border-slate-700/50">
              <td className="py-3 px-4 text-zinc-900 dark:text-white">A2</td>
              <td className="py-3 px-4 text-zinc-900 dark:text-white">Short Span (X)</td>
              <td className="py-3 px-4 text-zinc-900 dark:text-white">Top (Support)</td>
              <td className="py-3 px-4 text-zinc-900 dark:text-white">10ø</td>
              <td className="py-3 px-4 text-zinc-900 dark:text-white">150 mm</td>
              <td className="py-3 px-4 text-zinc-900 dark:text-white">{((result.geometry?.Ly || 5000) * 0.3).toFixed(0)} mm</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
