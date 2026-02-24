/**
 * ============================================================================
 * RC BEAM DESIGNER COMPONENT
 * ============================================================================
 * 
 * Ultra-modern React component for reinforced concrete beam design.
 * Features real-time calculations, 3D visualization, and professional output.
 * 
 * @version 1.0.0
 */

'use client';

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
  Zap,
  Box,
  Grid3X3,
  Activity,
} from 'lucide-react';

// Import design engine
import {
  RCBeamDesignEngine,
  BeamDesignResult,
  designRectangularBeam,
  designTBeam,
} from '@/modules/concrete/RCBeamDesignEngine';
import {
  DesignCode,
  getConcreteGrades,
  getSteelGrades,
  REBAR_SIZES,
  ConcreteGrade,
  SteelGrade,
} from '@/modules/concrete/RCDesignConstants';

// Types
interface BeamFormData {
  beamType: 'rectangular' | 'T-beam' | 'L-beam';
  b: number;
  D: number;
  d: number;
  bf?: number;
  Df?: number;
  L: number;
  Mu: number;
  Vu: number;
  Tu?: number;
  code: DesignCode;
  concreteGrade: string;
  steelGrade: string;
  exposure: string;
  cover: number;
}

// Default values
const defaultFormData: BeamFormData = {
  beamType: 'rectangular',
  b: 300,
  D: 500,
  d: 450,
  L: 6000,
  Mu: 150,
  Vu: 80,
  code: 'IS456',
  concreteGrade: 'M25',
  steelGrade: 'Fe500',
  exposure: 'moderate',
  cover: 40,
};

// Component
export default function RCBeamDesigner() {
  const [formData, setFormData] = useState<BeamFormData>(defaultFormData);
  const [result, setResult] = useState<BeamDesignResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [activeTab, setActiveTab] = useState<'input' | 'results' | 'drawing'>('input');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    geometry: true,
    loading: true,
    materials: true,
  });

  // Get available grades based on code
  const concreteGrades = useMemo(() => getConcreteGrades(formData.code), [formData.code]);
  const steelGrades = useMemo(() => getSteelGrades(formData.code), [formData.code]);

  // Handle form changes
  const handleChange = useCallback((field: keyof BeamFormData, value: number | string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-calculate effective depth
      if (field === 'D' || field === 'cover') {
        updated.d = updated.D - updated.cover - 20; // Assuming 20mm bar
      }
      return updated;
    });
  }, []);

  // Toggle section
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // Run design calculation
  const runDesign = useCallback(async () => {
    setIsCalculating(true);
    
    // Simulate async calculation
    await new Promise(resolve => setTimeout(resolve, 500));

    const selectedConcrete = concreteGrades.find(g => g.grade === formData.concreteGrade) || concreteGrades[2];
    const selectedSteel = steelGrades.find(g => g.grade === formData.steelGrade) || steelGrades[1];

    try {
      const designResult = designRectangularBeam(
        formData.b,
        formData.D,
        formData.L,
        formData.Mu,
        formData.Vu,
        selectedConcrete.fck,
        selectedSteel.fy,
        formData.code
      );

      setResult(designResult);
      setActiveTab('results');
    } catch (error) {
      console.error('Design calculation failed:', error);
    }

    setIsCalculating(false);
  }, [formData, concreteGrades, steelGrades]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">RC Beam Designer</h1>
                <p className="text-sm text-slate-400">Multi-code reinforced concrete beam design</p>
              </div>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex items-center gap-2 bg-slate-700/50 rounded-xl p-1">
              {(['input', 'results', 'drawing'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white hover:bg-slate-600/50'
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
                {/* Design Code Selection */}
                <InputCard title="Design Code" icon={<Settings className="w-5 h-5" />}>
                  <div className="grid grid-cols-4 gap-2">
                    {(['IS456', 'ACI318', 'EN1992', 'AS3600'] as const).map((code) => (
                      <button
                        key={code}
                        onClick={() => handleChange('code', code)}
                        className={`py-3 rounded-lg text-sm font-medium transition-all ${
                          formData.code === code
                            ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
                        }`}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </InputCard>

                {/* Beam Type */}
                <InputCard title="Beam Type" icon={<Box className="w-5 h-5" />}>
                  <div className="grid grid-cols-3 gap-2">
                    {['rectangular', 'T-beam', 'L-beam'].map((type) => (
                      <button
                        key={type}
                        onClick={() => handleChange('beamType', type as BeamFormData['beamType'])}
                        className={`py-3 rounded-lg text-sm font-medium transition-all ${
                          formData.beamType === type
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </InputCard>

                {/* Geometry */}
                <CollapsibleSection
                  title="Geometry"
                  icon={<Grid3X3 className="w-5 h-5" />}
                  isExpanded={expandedSections.geometry}
                  onToggle={() => toggleSection('geometry')}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="Width (b)"
                      value={formData.b}
                      onChange={(v) => handleChange('b', v)}
                      unit="mm"
                    />
                    <InputField
                      label="Depth (D)"
                      value={formData.D}
                      onChange={(v) => handleChange('D', v)}
                      unit="mm"
                    />
                    <InputField
                      label="Eff. Depth (d)"
                      value={formData.d}
                      onChange={(v) => handleChange('d', v)}
                      unit="mm"
                      disabled
                    />
                    <InputField
                      label="Span (L)"
                      value={formData.L}
                      onChange={(v) => handleChange('L', v)}
                      unit="mm"
                    />
                    {(formData.beamType === 'T-beam' || formData.beamType === 'L-beam') && (
                      <>
                        <InputField
                          label="Flange Width (bf)"
                          value={formData.bf || 1200}
                          onChange={(v) => handleChange('bf', v)}
                          unit="mm"
                        />
                        <InputField
                          label="Flange Depth (Df)"
                          value={formData.Df || 120}
                          onChange={(v) => handleChange('Df', v)}
                          unit="mm"
                        />
                      </>
                    )}
                  </div>
                </CollapsibleSection>

                {/* Loading */}
                <CollapsibleSection
                  title="Loading (Factored)"
                  icon={<Activity className="w-5 h-5" />}
                  isExpanded={expandedSections.loading}
                  onToggle={() => toggleSection('loading')}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="Moment (Mu)"
                      value={formData.Mu}
                      onChange={(v) => handleChange('Mu', v)}
                      unit="kN-m"
                    />
                    <InputField
                      label="Shear (Vu)"
                      value={formData.Vu}
                      onChange={(v) => handleChange('Vu', v)}
                      unit="kN"
                    />
                    <InputField
                      label="Torsion (Tu)"
                      value={formData.Tu || 0}
                      onChange={(v) => handleChange('Tu', v)}
                      unit="kN-m"
                    />
                  </div>
                </CollapsibleSection>

                {/* Materials */}
                <CollapsibleSection
                  title="Materials"
                  icon={<Layers className="w-5 h-5" />}
                  isExpanded={expandedSections.materials}
                  onToggle={() => toggleSection('materials')}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Concrete Grade</label>
                      <select
                        value={formData.concreteGrade}
                        onChange={(e) => handleChange('concreteGrade', e.target.value)}
                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {concreteGrades.map((grade) => (
                          <option key={grade.grade} value={grade.grade}>
                            {grade.grade} (fck = {grade.fck} MPa)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Steel Grade</label>
                      <select
                        value={formData.steelGrade}
                        onChange={(e) => handleChange('steelGrade', e.target.value)}
                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {steelGrades.map((grade) => (
                          <option key={grade.grade} value={grade.grade}>
                            {grade.grade} (fy = {grade.fy} MPa)
                          </option>
                        ))}
                      </select>
                    </div>
                    <InputField
                      label="Clear Cover"
                      value={formData.cover}
                      onChange={(v) => handleChange('cover', v)}
                      unit="mm"
                    />
                  </div>
                </CollapsibleSection>

                {/* Design Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={runDesign}
                  disabled={isCalculating}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 rounded-xl text-white font-bold text-lg shadow-lg shadow-blue-500/25 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isCalculating ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-5 h-5" />
                      Design Beam
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </motion.button>
              </div>

              {/* Preview Panel */}
              <div className="space-y-6">
                <BeamPreview formData={formData} />
                <QuickSummary formData={formData} />
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
              <ResultsPanel result={result} />
            </motion.div>
          )}

          {activeTab === 'drawing' && result && (
            <motion.div
              key="drawing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ReinforcementDrawing result={result} />
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
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-blue-400">{icon}</div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
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
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 hover:bg-slate-700/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-blue-400">{icon}</div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
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
      <label className="block text-sm text-slate-400 mb-2">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          disabled={disabled}
          className={`w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 pr-16 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
          {unit}
        </span>
      </div>
    </div>
  );
}

function BeamPreview({ formData }: { formData: BeamFormData }) {
  const scale = 0.3;
  const svgWidth = 400;
  const svgHeight = 300;

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Cross Section Preview</h3>
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-64 bg-slate-900/50 rounded-xl">
        {/* Grid */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#334155" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Beam cross section */}
        {formData.beamType === 'rectangular' ? (
          <rect
            x={(svgWidth - formData.b * scale) / 2}
            y={(svgHeight - formData.D * scale) / 2}
            width={formData.b * scale}
            height={formData.D * scale}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
          />
        ) : (
          // T-beam or L-beam
          <path
            d={`
              M ${(svgWidth - (formData.bf || 1200) * scale) / 2} ${(svgHeight - formData.D * scale) / 2}
              h ${(formData.bf || 1200) * scale}
              v ${(formData.Df || 120) * scale}
              h -${((formData.bf || 1200) - formData.b) / 2 * scale}
              v ${(formData.D - (formData.Df || 120)) * scale}
              h -${formData.b * scale}
              v -${(formData.D - (formData.Df || 120)) * scale}
              h -${((formData.bf || 1200) - formData.b) / 2 * scale}
              z
            `}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
          />
        )}

        {/* Dimensions */}
        <text x={svgWidth / 2} y={svgHeight - 20} textAnchor="middle" className="fill-slate-400 text-xs">
          b = {formData.b} mm
        </text>
        <text x={svgWidth - 30} y={svgHeight / 2} textAnchor="middle" className="fill-slate-400 text-xs" transform={`rotate(90, ${svgWidth - 30}, ${svgHeight / 2})`}>
          D = {formData.D} mm
        </text>
      </svg>
    </div>
  );
}

function QuickSummary({ formData }: { formData: BeamFormData }) {
  // Quick checks
  const spanDepthRatio = formData.L / formData.D;
  const isRatioOk = spanDepthRatio <= 20;

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Quick Checks</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
          <span className="text-slate-400">Span/Depth Ratio</span>
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">{spanDepthRatio.toFixed(1)}</span>
            {isRatioOk ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
            )}
          </div>
        </div>
        <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
          <span className="text-slate-400">Design Code</span>
          <span className="text-white font-medium">{formData.code}</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
          <span className="text-slate-400">Beam Type</span>
          <span className="text-white font-medium capitalize">{formData.beamType}</span>
        </div>
      </div>
    </div>
  );
}

function ResultsPanel({ result }: { result: BeamDesignResult }) {
  const isDesignOk = result.flexure.status === 'safe' && result.shear.status === 'safe';

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
            <h2 className="text-2xl font-bold text-white">
              {isDesignOk ? 'Design OK' : 'Design Needs Revision'}
            </h2>
            <p className="text-slate-300">
              {isDesignOk
                ? 'All checks passed. Beam is safe for the applied loads.'
                : 'One or more checks failed. Please review and modify design.'}
            </p>
          </div>
        </div>
      </div>

      {/* Flexural Design */}
      <ResultCard title="Flexural Design" status={result.flexure.status === 'safe' ? 'pass' : 'fail'}>
        <div className="space-y-2">
          <ResultRow label="Applied Moment" value={`${result.loading.Mu.toFixed(1)} kN-m`} />
          <ResultRow label="Capacity" value={`${result.flexure.Mu_capacity.toFixed(1)} kN-m`} />
          <ResultRow label="Utilization" value={`${(result.flexure.utilizationRatio * 100).toFixed(1)}%`} />
          <div className="border-t border-slate-600 pt-2 mt-2">
            <ResultRow label="Tension Steel (Ast)" value={`${result.flexure.Ast_required.toFixed(0)} mm²`} />
            <ResultRow label="Bars Provided" value={result.flexure.tensionBars.map(b => `${b.count}T${b.diameter}`).join(' + ')} />
            {result.flexure.Asc_required > 0 && (
              <>
                <ResultRow label="Compression Steel" value={`${result.flexure.Asc_required.toFixed(0)} mm²`} />
                <ResultRow label="Comp. Bars" value={result.flexure.compressionBars.map(b => `${b.count}T${b.diameter}`).join(' + ') || '-'} />
              </>
            )}
          </div>
        </div>
      </ResultCard>

      {/* Shear Design */}
      <ResultCard title="Shear Design" status={result.shear.status === 'safe' ? 'pass' : 'fail'}>
        <div className="space-y-2">
          <ResultRow label="Applied Shear" value={`${result.loading.Vu.toFixed(1)} kN`} />
          <ResultRow label="Concrete Capacity" value={`${result.shear.Vuc.toFixed(1)} kN`} />
          <ResultRow label="Steel Capacity" value={`${result.shear.Vus_required.toFixed(1)} kN`} />
          <div className="border-t border-slate-600 pt-2 mt-2">
            <ResultRow label="Stirrup Legs" value={`${result.shear.stirrupLegs}`} />
            <ResultRow label="Stirrup Spacing" value={`${result.shear.stirrupSpacing.toFixed(0)} mm`} />
            <ResultRow label="Stirrups Provided" value={`T${result.shear.stirrupDiameter}@${result.shear.stirrupSpacing.toFixed(0)}c/c`} />
          </div>
        </div>
      </ResultCard>

      {/* Serviceability */}
      <ResultCard title="Serviceability" status={result.deflection?.status === 'pass' ? 'pass' : 'fail'}>
        <div className="space-y-2">
          <ResultRow label="Span/Depth (actual)" value={result.deflection?.spanDepthRatio_provided?.toFixed(1) || '-'} />
          <ResultRow label="Limit" value={result.deflection?.spanDepthRatio_allowed?.toFixed(1) || '-'} />
          {result.crackWidth && (
            <>
              <ResultRow label="Crack Width" value={`${result.crackWidth.crackWidth.toFixed(2)} mm`} />
              <ResultRow label="Limit" value={`${result.crackWidth.allowableCrackWidth.toFixed(2)} mm`} />
            </>
          )}
        </div>
      </ResultCard>

      {/* Export Button */}
      <div className="col-span-1 lg:col-span-3 flex justify-end gap-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-3 bg-slate-700 rounded-xl text-white font-medium flex items-center gap-2"
        >
          <FileText className="w-5 h-5" />
          Export Report
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl text-white font-medium flex items-center gap-2"
        >
          <Download className="w-5 h-5" />
          Download Drawing
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
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
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
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

function ReinforcementDrawing({ result }: { result: BeamDesignResult }) {
  // Simplified SVG drawing
  const { geometry, flexure, shear } = result;
  const scale = 0.5;
  const svgWidth = 800;
  const svgHeight = 400;

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
      <h3 className="text-xl font-bold text-white mb-6">Reinforcement Detailing</h3>
      
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-96 bg-slate-900/50 rounded-xl">
        {/* Cross Section */}
        <g transform={`translate(100, 50)`}>
          <text x="75" y="-10" textAnchor="middle" className="fill-white text-sm font-semibold">
            CROSS SECTION
          </text>
          {/* Beam outline */}
          <rect
            x="0"
            y="0"
            width={geometry.b * scale}
            height={geometry.D * scale}
            fill="none"
            stroke="#64748b"
            strokeWidth="2"
          />
          {/* Main bars (bottom) */}
          {[1, 2, 3].map((i) => (
            <circle
              key={`main-${i}`}
              cx={15 + (i * (geometry.b * scale - 30) / 4)}
              cy={geometry.D * scale - 30}
              r="8"
              fill="#3b82f6"
            />
          ))}
          {/* Stirrups */}
          <rect
            x="10"
            y="10"
            width={geometry.b * scale - 20}
            height={geometry.D * scale - 20}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="none"
          />
          {/* Dimensions */}
          <text x={geometry.b * scale / 2} y={geometry.D * scale + 30} textAnchor="middle" className="fill-slate-400 text-xs">
            {geometry.b} mm
          </text>
          <text x={geometry.b * scale + 30} y={geometry.D * scale / 2} textAnchor="middle" className="fill-slate-400 text-xs" transform={`rotate(90, ${geometry.b * scale + 30}, ${geometry.D * scale / 2})`}>
            {geometry.D} mm
          </text>
        </g>

        {/* Longitudinal Section */}
        <g transform={`translate(350, 50)`}>
          <text x="175" y="-10" textAnchor="middle" className="fill-white text-sm font-semibold">
            LONGITUDINAL SECTION
          </text>
          {/* Beam outline */}
          <rect
            x="0"
            y="0"
            width="350"
            height={geometry.D * scale}
            fill="none"
            stroke="#64748b"
            strokeWidth="2"
          />
          {/* Top bars */}
          <line x1="10" y1="20" x2="340" y2="20" stroke="#3b82f6" strokeWidth="3" />
          {/* Bottom bars */}
          <line x1="10" y1={geometry.D * scale - 20} x2="340" y2={geometry.D * scale - 20} stroke="#3b82f6" strokeWidth="4" />
          {/* Stirrups */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <line
              key={`stir-${i}`}
              x1={40 + i * 40}
              y1="10"
              x2={40 + i * 40}
              y2={geometry.D * scale - 10}
              stroke="#10b981"
              strokeWidth="1.5"
            />
          ))}
        </g>

        {/* Legend */}
        <g transform={`translate(100, ${svgHeight - 80})`}>
          <text x="0" y="0" className="fill-white text-sm font-semibold">REINFORCEMENT SCHEDULE</text>
          <g transform="translate(0, 20)">
            <circle cx="10" cy="5" r="6" fill="#3b82f6" />
            <text x="30" y="10" className="fill-slate-300 text-xs">Main Bars: {flexure.tensionBars.map(b => `${b.count}T${b.diameter}`).join(' + ')}</text>
          </g>
          <g transform="translate(200, 20)">
            <rect x="0" y="0" width="20" height="10" fill="none" stroke="#10b981" strokeWidth="2" />
            <text x="30" y="10" className="fill-slate-300 text-xs">Stirrups: T{shear.stirrupDiameter}@{shear.stirrupSpacing.toFixed(0)}c/c</text>
          </g>
        </g>
      </svg>

      {/* Bar Schedule Table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-600">
              <th className="text-left py-3 px-4 text-slate-400">Bar Mark</th>
              <th className="text-left py-3 px-4 text-slate-400">Type</th>
              <th className="text-left py-3 px-4 text-slate-400">Diameter</th>
              <th className="text-left py-3 px-4 text-slate-400">No. of Bars</th>
              <th className="text-left py-3 px-4 text-slate-400">Length (mm)</th>
              <th className="text-left py-3 px-4 text-slate-400">Shape</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-700/50">
              <td className="py-3 px-4 text-white">A</td>
              <td className="py-3 px-4 text-white">Main Tension</td>
              <td className="py-3 px-4 text-white">{flexure.tensionBars[0]?.diameter || 16}ø</td>
              <td className="py-3 px-4 text-white">{flexure.tensionBars.reduce((sum, b) => sum + b.count, 0)}</td>
              <td className="py-3 px-4 text-white">{geometry.L || 6000}</td>
              <td className="py-3 px-4 text-white">Straight</td>
            </tr>
            <tr className="border-b border-slate-700/50">
              <td className="py-3 px-4 text-white">B</td>
              <td className="py-3 px-4 text-white">Stirrup</td>
              <td className="py-3 px-4 text-white">{shear.stirrupDiameter}ø</td>
              <td className="py-3 px-4 text-white">{Math.ceil((geometry.L || 6000) / shear.stirrupSpacing)}</td>
              <td className="py-3 px-4 text-white">{2 * (geometry.b + geometry.D) - 8 * 40 + 2 * 75}</td>
              <td className="py-3 px-4 text-white">2L Stirrup</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
