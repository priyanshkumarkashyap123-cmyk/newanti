'use client';

/**
 * ============================================================================
 * PRESTRESSED CONCRETE DESIGNER COMPONENT
 * ============================================================================
 * 
 * Ultra-modern UI for prestressed concrete beam design
 * Supports pre-tensioned and post-tensioned systems
 * 
 * @version 1.0.0
 * @author Head of Engineering
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import {
  PrestressedConcreteEngine,
  PRESTRESSING_STRANDS,
  type DesignCode,
  type PrestressType,
  type TendonProfile,
  type StressClass,
  type PrestressedSectionGeometry,
  type PrestressedDesignInput,
  type PrestressedDesignResult,
} from '@/modules/concrete';

// =============================================================================
// TYPES
// =============================================================================

interface FormState {
  // System
  prestressType: PrestressType;
  code: DesignCode;
  stressClass: StressClass;
  
  // Section
  sectionType: 'rectangular' | 'I-section' | 'T-section' | 'box';
  h: number;
  b: number;
  bw: number;
  hf_top: number;
  bf_top: number;
  hf_bot: number;
  bf_bot: number;
  
  // Span and Loading
  span: number;
  deadLoad: number;
  liveLoad: number;
  
  // Prestressing
  strandIndex: number;
  numStrands: number;
  profile: TendonProfile;
  e_end: number;
  e_mid: number;
  initialStress: number;
  
  // Materials
  fci: number;
  fc28: number;
  
  // Post-tensioned specific
  frictionCoeff: number;
  wobbleCoeff: number;
  anchorageSlip: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DESIGN_CODES: { value: DesignCode; label: string }[] = [
  { value: 'IS456', label: 'IS 1343:2012' },
  { value: 'ACI318', label: 'ACI 318-19' },
  { value: 'EN1992', label: 'Eurocode 2' },
  { value: 'AS3600', label: 'AS 3600:2018' },
];

const STRESS_CLASSES: { value: StressClass; label: string; description: string }[] = [
  { value: 'Class1', label: 'Class 1', description: 'No tensile stress (Uncracked)' },
  { value: 'Class2', label: 'Class 2', description: 'Limited tensile stress' },
  { value: 'Class3', label: 'Class 3', description: 'Cracking permitted' },
];

const SECTION_TYPES = [
  { value: 'rectangular', label: 'Rectangular', icon: '▭' },
  { value: 'I-section', label: 'I-Section', icon: 'I' },
  { value: 'T-section', label: 'T-Section', icon: 'T' },
  { value: 'box', label: 'Box', icon: '☐' },
];

const TENDON_PROFILES: { value: TendonProfile; label: string }[] = [
  { value: 'straight', label: 'Straight' },
  { value: 'parabolic', label: 'Parabolic' },
  { value: 'harped', label: 'Harped' },
  { value: 'draped', label: 'Draped' },
];

// =============================================================================
// INITIAL STATE
// =============================================================================

const INITIAL_STATE: FormState = {
  prestressType: 'post-tensioned',
  code: 'IS456',
  stressClass: 'Class2',
  sectionType: 'I-section',
  h: 1200,
  b: 600,
  bw: 200,
  hf_top: 150,
  bf_top: 600,
  hf_bot: 250,
  bf_bot: 400,
  span: 20000,
  deadLoad: 15,
  liveLoad: 20,
  strandIndex: 3, // 15.24mm strand
  numStrands: 12,
  profile: 'parabolic',
  e_end: 100,
  e_mid: 450,
  initialStress: 0.75,
  fci: 35,
  fc28: 50,
  frictionCoeff: 0.20,
  wobbleCoeff: 0.002,
  anchorageSlip: 6,
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const PrestressedDesigner: React.FC = () => {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [result, setResult] = useState<PrestressedDesignResult | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'results' | 'losses' | 'stresses'>('input');

  // Update form field
  const updateField = useCallback(<K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  // Selected strand
  const selectedStrand = PRESTRESSING_STRANDS[form.strandIndex];

  // Calculate design
  const handleCalculate = useCallback(() => {
    const section: PrestressedSectionGeometry = {
      type: form.sectionType,
      h: form.h,
      b: form.b,
      bw: form.sectionType !== 'rectangular' ? form.bw : undefined,
      hf_top: form.sectionType !== 'rectangular' ? form.hf_top : undefined,
      bf_top: form.sectionType !== 'rectangular' ? form.bf_top : undefined,
      hf_bot: form.sectionType === 'I-section' || form.sectionType === 'box' ? form.hf_bot : undefined,
      bf_bot: form.sectionType === 'I-section' ? form.bf_bot : undefined,
    };

    const input: PrestressedDesignInput = {
      prestressType: form.prestressType,
      section,
      materials: {
        concrete: {
          grade: { grade: `M${form.fc28}`, fck: form.fc28, Ec: 5000 * Math.sqrt(form.fc28) } as any,
          fci: form.fci,
          fc28: form.fc28,
          Eci: 5000 * Math.sqrt(form.fci),
          Ec28: 5000 * Math.sqrt(form.fc28),
          creepCoeff: 2.0,
          shrinkageStrain: 0.0003,
        },
        prestressing: {
          profile: form.profile,
          numStrands: form.numStrands,
          strandType: selectedStrand,
          e_end: form.e_end,
          e_mid: form.e_mid,
          ductDiameter: form.prestressType === 'post-tensioned' ? 70 : undefined,
          bondType: 'bonded',
        },
        code: form.code,
      },
      span: form.span,
      deadLoad: form.deadLoad,
      liveLoad: form.liveLoad,
      initialJackingStress: form.initialStress,
      stressClass: form.stressClass,
      frictionCoeff: form.prestressType === 'post-tensioned' ? form.frictionCoeff : undefined,
      wobbleCoeff: form.prestressType === 'post-tensioned' ? form.wobbleCoeff : undefined,
      anchorageSlip: form.prestressType === 'post-tensioned' ? form.anchorageSlip : undefined,
    };

    const engine = new PrestressedConcreteEngine(input);
    const designResult = engine.design();
    setResult(designResult);
    setActiveTab('results');
  }, [form, selectedStrand]);

  // Reset form
  const handleReset = useCallback(() => {
    setForm(INITIAL_STATE);
    setResult(null);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
          Prestressed Concrete Designer
        </h1>
        <p className="text-slate-400 mt-2">
          Complete prestressed beam design • IS 1343 • ACI 318 • EN 1992 • AS 3600
        </p>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        {['input', 'results', 'losses', 'stresses'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${
              activeTab === tab
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30'
                : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <AnimatePresence mode="wait">
          {activeTab === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="lg:col-span-2 space-y-6"
            >
              {/* System Settings */}
              <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">⚙</span>
                  System Settings
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Prestress Type */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Prestress Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['pre-tensioned', 'post-tensioned'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => updateField('prestressType', type)}
                          className={`p-3 rounded-xl text-sm transition-all ${
                            form.prestressType === type
                              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                              : 'bg-slate-700/50 text-slate-400 hover:text-white'
                          }`}
                        >
                          {type === 'pre-tensioned' ? 'Pre-tensioned' : 'Post-tensioned'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Design Code */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Design Code</label>
                    <select
                      value={form.code}
                      onChange={(e) => updateField('code', e.target.value as DesignCode)}
                      className="w-full p-3 rounded-xl bg-slate-700/50 text-white border border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    >
                      {DESIGN_CODES.map((code) => (
                        <option key={code.value} value={code.value}>{code.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Stress Class */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Stress Class</label>
                    <select
                      value={form.stressClass}
                      onChange={(e) => updateField('stressClass', e.target.value as StressClass)}
                      className="w-full p-3 rounded-xl bg-slate-700/50 text-white border border-white/10 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    >
                      {STRESS_CLASSES.map((cls) => (
                        <option key={cls.value} value={cls.value}>{cls.label} - {cls.description}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section Geometry */}
              <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">📐</span>
                  Section Geometry
                </h2>
                
                {/* Section Type Selection */}
                <div className="grid grid-cols-4 gap-3 mb-6">
                  {SECTION_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => updateField('sectionType', type.value as any)}
                      className={`p-4 rounded-xl text-center transition-all ${
                        form.sectionType === type.value
                          ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                          : 'bg-slate-700/50 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="text-2xl mb-1">{type.icon}</div>
                      <div className="text-sm">{type.label}</div>
                    </button>
                  ))}
                </div>

                {/* Dimensions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Height h (mm)</label>
                    <input
                      type="number"
                      value={form.h}
                      onChange={(e) => updateField('h', Number(e.target.value))}
                      className="w-full p-3 rounded-xl bg-slate-700/50 text-white border border-white/10 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Width b (mm)</label>
                    <input
                      type="number"
                      value={form.b}
                      onChange={(e) => updateField('b', Number(e.target.value))}
                      className="w-full p-3 rounded-xl bg-slate-700/50 text-white border border-white/10 focus:border-blue-500"
                    />
                  </div>
                  {form.sectionType !== 'rectangular' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Web bw (mm)</label>
                        <input
                          type="number"
                          value={form.bw}
                          onChange={(e) => updateField('bw', Number(e.target.value))}
                          className="w-full p-3 rounded-xl bg-slate-700/50 text-white border border-white/10 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Top Flange hf (mm)</label>
                        <input
                          type="number"
                          value={form.hf_top}
                          onChange={(e) => updateField('hf_top', Number(e.target.value))}
                          className="w-full p-3 rounded-xl bg-slate-700/50 text-white border border-white/10 focus:border-blue-500"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Loading */}
              <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">⚖</span>
                  Span & Loading
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Span (mm)</label>
                    <input
                      type="number"
                      value={form.span}
                      onChange={(e) => updateField('span', Number(e.target.value))}
                      className="w-full p-3 rounded-xl bg-slate-700/50 text-white border border-white/10 focus:border-amber-500"
                    />
                    <div className="text-xs text-slate-400 mt-1">{(form.span / 1000).toFixed(1)} m</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Dead Load (kN/m)</label>
                    <input
                      type="number"
                      value={form.deadLoad}
                      onChange={(e) => updateField('deadLoad', Number(e.target.value))}
                      className="w-full p-3 rounded-xl bg-slate-700/50 text-white border border-white/10 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Live Load (kN/m)</label>
                    <input
                      type="number"
                      value={form.liveLoad}
                      onChange={(e) => updateField('liveLoad', Number(e.target.value))}
                      className="w-full p-3 rounded-xl bg-slate-700/50 text-white border border-white/10 focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Prestressing System */}
              <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center text-pink-400">🔗</span>
                  Prestressing System
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Strand Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Strand Type</label>
                    <select
                      value={form.strandIndex}
                      onChange={(e) => updateField('strandIndex', Number(e.target.value))}
                      className="w-full p-3 rounded-xl bg-slate-700/50 text-white border border-white/10 focus:border-pink-500"
                    >
                      {PRESTRESSING_STRANDS.map((strand, idx) => (
                        <option key={idx} value={idx}>
                          {strand.designation} - fpu={strand.fpu} MPa, Area={strand.area} mm²
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Number of Strands */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Number of Strands</label>
                    <input
                      type="number"
                      value={form.numStrands}
                      onChange={(e) => updateField('numStrands', Number(e.target.value))}
                      className="w-full p-3 rounded-xl bg-slate-700/50 text-white border border-white/10 focus:border-pink-500"
                    />
                    <div className="text-xs text-slate-400 mt-1">
                      Total Aps = {(form.numStrands * selectedStrand.area).toFixed(0)} mm²
                    </div>
                  </div>

                  {/* Profile */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Tendon Profile</label>
                    <div className="grid grid-cols-2 gap-2">
                      {TENDON_PROFILES.map((profile) => (
                        <button
                          key={profile.value}
                          onClick={() => updateField('profile', profile.value)}
                          className={`p-2 rounded-lg text-sm transition-all ${
                            form.profile === profile.value
                              ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'
                              : 'bg-slate-700/50 text-slate-400 hover:text-white'
                          }`}
                        >
                          {profile.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Initial Stress */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Initial Stress (% of fpu)
                    </label>
                    <input
                      type="number"
                      value={form.initialStress * 100}
                      onChange={(e) => updateField('initialStress', Number(e.target.value) / 100)}
                      step={5}
                      min={60}
                      max={80}
                      className="w-full p-3 rounded-xl bg-slate-700/50 text-white border border-white/10 focus:border-pink-500"
                    />
                    <div className="text-xs text-slate-400 mt-1">
                      fpi = {(form.initialStress * selectedStrand.fpu).toFixed(0)} MPa
                    </div>
                  </div>

                  {/* Eccentricities */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Eccentricity at End e₁ (mm)</label>
                    <input
                      type="number"
                      value={form.e_end}
                      onChange={(e) => updateField('e_end', Number(e.target.value))}
                      className="w-full p-3 rounded-xl bg-slate-700/50 text-white border border-white/10 focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Eccentricity at Mid e₂ (mm)</label>
                    <input
                      type="number"
                      value={form.e_mid}
                      onChange={(e) => updateField('e_mid', Number(e.target.value))}
                      className="w-full p-3 rounded-xl bg-slate-700/50 text-white border border-white/10 focus:border-pink-500"
                    />
                  </div>
                </div>

                {/* Post-tensioned specific */}
                {form.prestressType === 'post-tensioned' && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <h3 className="text-sm font-medium text-slate-300 mb-3">Post-Tensioning Parameters</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Friction μ</label>
                        <input
                          type="number"
                          value={form.frictionCoeff}
                          onChange={(e) => updateField('frictionCoeff', Number(e.target.value))}
                          step={0.01}
                          className="w-full p-2 rounded-lg bg-slate-700/50 text-white border border-white/10 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Wobble K (1/m)</label>
                        <input
                          type="number"
                          value={form.wobbleCoeff}
                          onChange={(e) => updateField('wobbleCoeff', Number(e.target.value))}
                          step={0.001}
                          className="w-full p-2 rounded-lg bg-slate-700/50 text-white border border-white/10 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Anchor Slip (mm)</label>
                        <input
                          type="number"
                          value={form.anchorageSlip}
                          onChange={(e) => updateField('anchorageSlip', Number(e.target.value))}
                          className="w-full p-2 rounded-lg bg-slate-700/50 text-white border border-white/10 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Materials */}
              <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400">🧱</span>
                  Concrete Properties
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">f'ci at Transfer (MPa)</label>
                    <input
                      type="number"
                      value={form.fci}
                      onChange={(e) => updateField('fci', Number(e.target.value))}
                      className="w-full p-3 rounded-xl bg-slate-700/50 text-white border border-white/10 focus:border-green-500"
                    />
                    <div className="text-xs text-slate-400 mt-1">
                      Eci = {(5000 * Math.sqrt(form.fci)).toFixed(0)} MPa
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">f'c at 28 days (MPa)</label>
                    <input
                      type="number"
                      value={form.fc28}
                      onChange={(e) => updateField('fc28', Number(e.target.value))}
                      className="w-full p-3 rounded-xl bg-slate-700/50 text-white border border-white/10 focus:border-green-500"
                    />
                    <div className="text-xs text-slate-400 mt-1">
                      Ec = {(5000 * Math.sqrt(form.fc28)).toFixed(0)} MPa
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCalculate}
                  className="flex-1 py-4 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 text-white font-semibold text-lg shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-shadow"
                >
                  🚀 Calculate Design
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleReset}
                  className="px-8 py-4 rounded-xl bg-slate-700/50 text-slate-300 font-medium hover:bg-slate-600/50 transition-colors"
                >
                  Reset
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview Panel */}
        <div className="space-y-6">
          {/* Section Preview */}
          <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Section Preview</h3>
            <SectionPreview form={form} />
          </div>

          {/* Tendon Profile Preview */}
          <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Tendon Profile</h3>
            <TendonProfilePreview form={form} />
          </div>

          {/* Quick Summary */}
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-2xl border p-6 ${
                result.summary.status === 'safe'
                  ? 'bg-green-500/10 border-green-500/30'
                  : result.summary.status === 'marginal'
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`text-4xl ${
                  result.summary.status === 'safe' ? 'text-green-400' :
                  result.summary.status === 'marginal' ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {result.summary.status === 'safe' ? '✓' : result.summary.status === 'marginal' ? '⚠' : '✗'}
                </div>
                <div>
                  <div className={`text-xl font-bold ${
                    result.summary.status === 'safe' ? 'text-green-400' :
                    result.summary.status === 'marginal' ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {result.summary.status.toUpperCase()}
                  </div>
                  <div className="text-slate-400 text-sm">
                    Utilization: {(result.summary.utilizationRatio * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Effective Prestress:</span>
                  <span className="text-white font-medium">{result.losses.effectiveForce.toFixed(0)} kN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Loss:</span>
                  <span className="text-white font-medium">{result.losses.totalPercentLoss.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">φMn:</span>
                  <span className="text-white font-medium">{result.ultimateCapacity.phiMn.toFixed(0)} kN-m</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Results Panels */}
        {result && activeTab !== 'input' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 space-y-6"
          >
            {activeTab === 'results' && <ResultsPanel result={result} />}
            {activeTab === 'losses' && <LossesPanel result={result} />}
            {activeTab === 'stresses' && <StressesPanel result={result} />}
          </motion.div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const SectionPreview: React.FC<{ form: FormState }> = ({ form }) => {
  const width = 200;
  const height = 200;
  const scale = Math.min(width / form.b, height / form.h) * 0.7;

  const drawSection = () => {
    const cX = width / 2;
    const cY = height / 2;
    const h = form.h * scale;
    const b = form.b * scale;
    
    if (form.sectionType === 'rectangular') {
      return (
        <rect
          x={cX - b/2}
          y={cY - h/2}
          width={b}
          height={h}
          fill="rgba(139, 92, 246, 0.3)"
          stroke="rgb(139, 92, 246)"
          strokeWidth={2}
        />
      );
    } else if (form.sectionType === 'I-section') {
      const bw = form.bw * scale;
      const hf_top = form.hf_top * scale;
      const hf_bot = form.hf_bot * scale;
      const bf_top = form.bf_top * scale;
      const bf_bot = form.bf_bot * scale;
      
      return (
        <path
          d={`
            M ${cX - bf_top/2} ${cY - h/2}
            L ${cX + bf_top/2} ${cY - h/2}
            L ${cX + bf_top/2} ${cY - h/2 + hf_top}
            L ${cX + bw/2} ${cY - h/2 + hf_top}
            L ${cX + bw/2} ${cY + h/2 - hf_bot}
            L ${cX + bf_bot/2} ${cY + h/2 - hf_bot}
            L ${cX + bf_bot/2} ${cY + h/2}
            L ${cX - bf_bot/2} ${cY + h/2}
            L ${cX - bf_bot/2} ${cY + h/2 - hf_bot}
            L ${cX - bw/2} ${cY + h/2 - hf_bot}
            L ${cX - bw/2} ${cY - h/2 + hf_top}
            L ${cX - bf_top/2} ${cY - h/2 + hf_top}
            Z
          `}
          fill="rgba(139, 92, 246, 0.3)"
          stroke="rgb(139, 92, 246)"
          strokeWidth={2}
        />
      );
    } else if (form.sectionType === 'T-section') {
      const bw = form.bw * scale;
      const hf_top = form.hf_top * scale;
      const bf_top = form.bf_top * scale;
      
      return (
        <path
          d={`
            M ${cX - bf_top/2} ${cY - h/2}
            L ${cX + bf_top/2} ${cY - h/2}
            L ${cX + bf_top/2} ${cY - h/2 + hf_top}
            L ${cX + bw/2} ${cY - h/2 + hf_top}
            L ${cX + bw/2} ${cY + h/2}
            L ${cX - bw/2} ${cY + h/2}
            L ${cX - bw/2} ${cY - h/2 + hf_top}
            L ${cX - bf_top/2} ${cY - h/2 + hf_top}
            Z
          `}
          fill="rgba(139, 92, 246, 0.3)"
          stroke="rgb(139, 92, 246)"
          strokeWidth={2}
        />
      );
    } else if (form.sectionType === 'box') {
      const bw = form.bw * scale;
      const hf_top = form.hf_top * scale;
      const hf_bot = form.hf_bot * scale;
      
      return (
        <>
          <rect
            x={cX - b/2}
            y={cY - h/2}
            width={b}
            height={h}
            fill="rgba(139, 92, 246, 0.3)"
            stroke="rgb(139, 92, 246)"
            strokeWidth={2}
          />
          {/* Inner void */}
          <rect
            x={cX - b/2 + bw}
            y={cY - h/2 + hf_top}
            width={b - 2*bw}
            height={h - hf_top - hf_bot}
            fill="rgb(15, 23, 42)"
            stroke="rgb(139, 92, 246)"
            strokeWidth={1}
            strokeDasharray="4 2"
          />
        </>
      );
    }
    return null;
  };

  return (
    <svg width={width} height={height} className="mx-auto">
      {drawSection()}
      {/* Tendon position indicator */}
      <circle
        cx={width/2}
        cy={height/2 + form.e_mid * scale / 2}
        r={4}
        fill="rgb(236, 72, 153)"
        stroke="white"
        strokeWidth={1}
      />
      <text x={width/2 + 10} y={height/2 + form.e_mid * scale / 2 + 4} fill="rgb(236, 72, 153)" fontSize={10}>
        Tendon
      </text>
    </svg>
  );
};

const TendonProfilePreview: React.FC<{ form: FormState }> = ({ form }) => {
  const width = 280;
  const height = 100;
  const margin = 20;
  
  const drawProfile = () => {
    const scaleX = (width - 2*margin) / form.span;
    const maxE = Math.max(form.e_end, form.e_mid);
    const scaleY = (height - 2*margin) / (2 * maxE);
    
    const baseline = height / 2;
    
    if (form.profile === 'straight') {
      return (
        <line
          x1={margin}
          y1={baseline + form.e_mid * scaleY}
          x2={width - margin}
          y2={baseline + form.e_mid * scaleY}
          stroke="rgb(236, 72, 153)"
          strokeWidth={2}
        />
      );
    } else if (form.profile === 'parabolic') {
      const points: string[] = [];
      for (let i = 0; i <= 20; i++) {
        const x = i / 20;
        const e = form.e_end + (form.e_mid - form.e_end) * (4 * x * (1 - x));
        const px = margin + x * (width - 2*margin);
        const py = baseline + e * scaleY;
        points.push(`${px},${py}`);
      }
      return (
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="rgb(236, 72, 153)"
          strokeWidth={2}
        />
      );
    } else if (form.profile === 'harped') {
      const harpX = margin + 0.33 * (width - 2*margin);
      return (
        <path
          d={`
            M ${margin} ${baseline + form.e_end * scaleY}
            L ${harpX} ${baseline + form.e_mid * scaleY}
            L ${width - harpX + margin} ${baseline + form.e_mid * scaleY}
            L ${width - margin} ${baseline + form.e_end * scaleY}
          `}
          fill="none"
          stroke="rgb(236, 72, 153)"
          strokeWidth={2}
        />
      );
    }
    return null;
  };

  return (
    <svg width={width} height={height} className="mx-auto">
      {/* Beam outline */}
      <rect
        x={margin}
        y={20}
        width={width - 2*margin}
        height={height - 40}
        fill="rgba(139, 92, 246, 0.1)"
        stroke="rgb(139, 92, 246)"
        strokeWidth={1}
        strokeDasharray="4 2"
      />
      {/* Centroid line */}
      <line
        x1={margin}
        y1={height/2}
        x2={width - margin}
        y2={height/2}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      {/* Tendon profile */}
      {drawProfile()}
      {/* Labels */}
      <text x={margin} y={height - 5} fill="rgb(148, 163, 184)" fontSize={8}>0</text>
      <text x={width - margin - 20} y={height - 5} fill="rgb(148, 163, 184)" fontSize={8}>L={form.span/1000}m</text>
    </svg>
  );
};

const ResultsPanel: React.FC<{ result: PrestressedDesignResult }> = ({ result }) => {
  return (
    <div className="space-y-6">
      {/* Ultimate Capacity */}
      <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Ultimate Moment Capacity</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="fps" value={result.ultimateCapacity.fps.toFixed(0)} unit="MPa" />
          <StatCard label="c (NA depth)" value={result.ultimateCapacity.c.toFixed(0)} unit="mm" />
          <StatCard label="φMn" value={result.ultimateCapacity.phiMn.toFixed(0)} unit="kN-m" color="green" />
          <StatCard label="Mu" value={result.ultimateCapacity.Mu.toFixed(0)} unit="kN-m" color="amber" />
        </div>
        <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-4">
          <div className={`px-4 py-2 rounded-full text-sm font-medium ${
            result.ultimateCapacity.tensionControlled 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-red-500/20 text-red-400'
          }`}>
            {result.ultimateCapacity.tensionControlled ? '✓ Tension Controlled' : '✗ Not Tension Controlled'}
          </div>
          <div className={`px-4 py-2 rounded-full text-sm font-medium ${
            result.ultimateCapacity.minReinforcementOk
              ? 'bg-green-500/20 text-green-400'
              : 'bg-amber-500/20 text-amber-400'
          }`}>
            {result.ultimateCapacity.minReinforcementOk ? '✓ Min Reinf OK' : '⚠ Min Reinf Check'}
          </div>
        </div>
      </div>

      {/* Shear Design */}
      <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Shear Design</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Vu" value={result.shearDesign.Vu.toFixed(0)} unit="kN" color="amber" />
          <StatCard label="Vci" value={result.shearDesign.Vci.toFixed(0)} unit="kN" />
          <StatCard label="Vcw" value={result.shearDesign.Vcw.toFixed(0)} unit="kN" />
          <StatCard label="Vc" value={result.shearDesign.Vc.toFixed(0)} unit="kN" color="blue" />
        </div>
        <div className="mt-4 p-4 bg-slate-700/30 rounded-xl">
          <div className="text-slate-300">
            <span className="font-medium">Stirrups Required:</span>{' '}
            <span className="text-pink-400 font-semibold">{result.shearDesign.stirrupsProvided}</span>
          </div>
        </div>
      </div>

      {/* Deflection */}
      <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Deflection</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard 
            label="Initial Camber" 
            value={result.deflection.camber_initial.toFixed(1)} 
            unit="mm ↑" 
            color="green"
          />
          <StatCard 
            label="Net Initial" 
            value={result.deflection.net_initial.toFixed(1)} 
            unit="mm"
          />
          <StatCard 
            label="Net Long-term" 
            value={result.deflection.net_longterm.toFixed(1)} 
            unit="mm"
            color={Math.abs(result.deflection.net_longterm) <= result.deflection.limit_total ? 'green' : 'red'}
          />
        </div>
        <div className="mt-4 pt-4 border-t border-white/10 text-sm text-slate-400">
          <div>Live Load Limit: L/360 = {result.deflection.limit_LL.toFixed(1)} mm</div>
          <div>Total Limit: L/240 = {result.deflection.limit_total.toFixed(1)} mm</div>
        </div>
      </div>

      {/* Warnings & Recommendations */}
      {(result.summary.warnings.length > 0 || result.summary.recommendations.length > 0) && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6">
          {result.summary.warnings.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-amber-400 mb-2">⚠ Warnings</h4>
              <ul className="space-y-1">
                {result.summary.warnings.map((w, i) => (
                  <li key={i} className="text-amber-300/80 text-sm">• {w}</li>
                ))}
              </ul>
            </div>
          )}
          {result.summary.recommendations.length > 0 && (
            <div>
              <h4 className="font-semibold text-blue-400 mb-2">💡 Recommendations</h4>
              <ul className="space-y-1">
                {result.summary.recommendations.map((r, i) => (
                  <li key={i} className="text-blue-300/80 text-sm">• {r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const LossesPanel: React.FC<{ result: PrestressedDesignResult }> = ({ result }) => {
  const { losses } = result;
  
  const lossData = [
    { label: 'Elastic Shortening', value: losses.immediate.elasticShortening, color: '#8b5cf6' },
    { label: 'Anchorage Slip', value: losses.immediate.anchorageSlip, color: '#a855f7' },
    { label: 'Friction', value: losses.immediate.frictionLoss, color: '#c084fc' },
    { label: 'Creep', value: losses.timeDependent.creep, color: '#ec4899' },
    { label: 'Shrinkage', value: losses.timeDependent.shrinkage, color: '#f472b6' },
    { label: 'Relaxation', value: losses.timeDependent.relaxation, color: '#fb7185' },
  ].filter(d => d.value > 0);

  const maxLoss = Math.max(...lossData.map(d => d.value));

  return (
    <div className="space-y-6">
      {/* Loss Summary */}
      <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Prestress Losses Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Initial fpi" value={losses.initialStress.toFixed(0)} unit="MPa" color="purple" />
          <StatCard label="Effective fpe" value={losses.effectiveStress.toFixed(0)} unit="MPa" color="green" />
          <StatCard label="Total Loss" value={losses.totalLoss.toFixed(0)} unit="MPa" color="red" />
          <StatCard label="Loss %" value={losses.totalPercentLoss.toFixed(1)} unit="%" color="amber" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Initial Force Pi" value={losses.initialForce.toFixed(0)} unit="kN" />
          <StatCard label="Effective Force Pe" value={losses.effectiveForce.toFixed(0)} unit="kN" color="green" />
        </div>
      </div>

      {/* Loss Breakdown */}
      <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Loss Breakdown</h3>
        
        <div className="space-y-4">
          {lossData.map((item, idx) => (
            <div key={idx}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300">{item.label}</span>
                <span className="text-white font-medium">{item.value.toFixed(1)} MPa</span>
              </div>
              <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(item.value / maxLoss) * 100}%` }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: item.color }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Pie Chart */}
        <div className="mt-6 flex justify-center">
          <LossPieChart losses={losses} />
        </div>
      </div>

      {/* Immediate vs Time-Dependent */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-6">
          <h4 className="font-semibold text-purple-400 mb-3">Immediate Losses</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Elastic Shortening:</span>
              <span className="text-white">{losses.immediate.elasticShortening.toFixed(1)} MPa</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Anchorage Slip:</span>
              <span className="text-white">{losses.immediate.anchorageSlip.toFixed(1)} MPa</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Friction:</span>
              <span className="text-white">{losses.immediate.frictionLoss.toFixed(1)} MPa</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-purple-500/30 font-medium">
              <span className="text-purple-300">Total:</span>
              <span className="text-purple-400">{losses.immediate.totalImmediate.toFixed(1)} MPa ({losses.immediate.percentLoss.toFixed(1)}%)</span>
            </div>
          </div>
        </div>

        <div className="bg-pink-500/10 border border-pink-500/30 rounded-2xl p-6">
          <h4 className="font-semibold text-pink-400 mb-3">Time-Dependent Losses</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Creep:</span>
              <span className="text-white">{losses.timeDependent.creep.toFixed(1)} MPa</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Shrinkage:</span>
              <span className="text-white">{losses.timeDependent.shrinkage.toFixed(1)} MPa</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Relaxation:</span>
              <span className="text-white">{losses.timeDependent.relaxation.toFixed(1)} MPa</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-pink-500/30 font-medium">
              <span className="text-pink-300">Total:</span>
              <span className="text-pink-400">{losses.timeDependent.totalTimeDep.toFixed(1)} MPa ({losses.timeDependent.percentLoss.toFixed(1)}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StressesPanel: React.FC<{ result: PrestressedDesignResult }> = ({ result }) => {
  const { stressChecks } = result;

  return (
    <div className="space-y-6">
      {/* Transfer Stresses */}
      <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">Stresses at Transfer</h3>
          <div className={`px-4 py-2 rounded-full text-sm font-medium ${
            stressChecks.transfer.status === 'pass'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {stressChecks.transfer.status === 'pass' ? '✓ PASS' : '✗ FAIL'}
          </div>
        </div>
        
        <StressDiagram check={stressChecks.transfer} stage="transfer" />
      </div>

      {/* Service Stresses */}
      <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">Stresses at Service</h3>
          <div className={`px-4 py-2 rounded-full text-sm font-medium ${
            stressChecks.service.status === 'pass'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {stressChecks.service.status === 'pass' ? '✓ PASS' : '✗ FAIL'}
          </div>
        </div>
        
        <StressDiagram check={stressChecks.service} stage="service" />
      </div>

      {/* Messages */}
      {(stressChecks.transfer.messages.length > 0 || stressChecks.service.messages.length > 0) && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6">
          <h4 className="font-semibold text-amber-400 mb-2">⚠ Stress Check Messages</h4>
          <ul className="space-y-1">
            {[...stressChecks.transfer.messages, ...stressChecks.service.messages].map((m, i) => (
              <li key={i} className="text-amber-300/80 text-sm">• {m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const StressDiagram: React.FC<{ 
  check: PrestressedDesignResult['stressChecks']['transfer'];
  stage: 'transfer' | 'service';
}> = ({ check, stage }) => {
  const width = 400;
  const height = 200;
  const margin = { left: 80, right: 40, top: 20, bottom: 20 };
  
  const maxStress = Math.max(
    Math.abs(check.ft_top),
    Math.abs(check.ft_bottom),
    Math.abs(check.ft_top_limit),
    Math.abs(check.ft_bottom_limit)
  );
  
  const scaleX = (width - margin.left - margin.right) / (2 * maxStress);
  const centerX = margin.left + (width - margin.left - margin.right) / 2;

  return (
    <div className="flex items-center gap-8">
      {/* Stress Diagram */}
      <svg width={width} height={height}>
        {/* Section outline */}
        <rect
          x={margin.left}
          y={margin.top}
          width={10}
          height={height - margin.top - margin.bottom}
          fill="rgba(139, 92, 246, 0.3)"
          stroke="rgb(139, 92, 246)"
          strokeWidth={2}
        />
        
        {/* Center line (zero stress) */}
        <line
          x1={centerX}
          y1={margin.top}
          x2={centerX}
          y2={height - margin.bottom}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
        
        {/* Stress distribution trapezoid */}
        <path
          d={`
            M ${margin.left + 10} ${margin.top}
            L ${centerX + check.ft_top * scaleX} ${margin.top}
            L ${centerX + check.ft_bottom * scaleX} ${height - margin.bottom}
            L ${margin.left + 10} ${height - margin.bottom}
            Z
          `}
          fill={check.status === 'pass' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}
          stroke={check.status === 'pass' ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}
          strokeWidth={2}
        />
        
        {/* Labels */}
        <text x={centerX - 30} y={height - 5} fill="rgb(148, 163, 184)" fontSize={10}>Tension</text>
        <text x={centerX + 10} y={height - 5} fill="rgb(148, 163, 184)" fontSize={10}>Compression</text>
        
        {/* Top stress value */}
        <text 
          x={centerX + check.ft_top * scaleX + 5} 
          y={margin.top + 15} 
          fill="white" 
          fontSize={11}
          fontWeight="bold"
        >
          {check.ft_top.toFixed(1)} MPa
        </text>
        
        {/* Bottom stress value */}
        <text 
          x={centerX + check.ft_bottom * scaleX + 5} 
          y={height - margin.bottom - 5} 
          fill="white" 
          fontSize={11}
          fontWeight="bold"
        >
          {check.ft_bottom.toFixed(1)} MPa
        </text>
      </svg>

      {/* Stress table */}
      <div className="flex-1 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="text-slate-400">Location</div>
          <div className="text-slate-400">Actual</div>
          <div className="text-slate-400">Limit</div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="text-slate-300">Top Fiber</div>
          <div className={check.ft_top_status === 'pass' ? 'text-green-400' : 'text-red-400'}>
            {check.ft_top.toFixed(2)} MPa
          </div>
          <div className="text-slate-400">{check.ft_top_limit.toFixed(2)} MPa</div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="text-slate-300">Bottom Fiber</div>
          <div className={check.ft_bottom_status === 'pass' ? 'text-green-400' : 'text-red-400'}>
            {check.ft_bottom.toFixed(2)} MPa
          </div>
          <div className="text-slate-400">{check.ft_bottom_limit.toFixed(2)} MPa</div>
        </div>
      </div>
    </div>
  );
};

const LossPieChart: React.FC<{ losses: PrestressedDesignResult['losses'] }> = ({ losses }) => {
  const data = [
    { label: 'Elastic Short.', value: losses.immediate.elasticShortening, color: '#8b5cf6' },
    { label: 'Anchor Slip', value: losses.immediate.anchorageSlip, color: '#a855f7' },
    { label: 'Friction', value: losses.immediate.frictionLoss, color: '#c084fc' },
    { label: 'Creep', value: losses.timeDependent.creep, color: '#ec4899' },
    { label: 'Shrinkage', value: losses.timeDependent.shrinkage, color: '#f472b6' },
    { label: 'Relaxation', value: losses.timeDependent.relaxation, color: '#fb7185' },
  ].filter(d => d.value > 0);

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = 60;
  const cx = 80;
  const cy = 80;

  let currentAngle = -90;

  return (
    <div className="flex items-center gap-6">
      <svg width={160} height={160}>
        {data.map((item, idx) => {
          const angle = (item.value / total) * 360;
          const startAngle = currentAngle;
          const endAngle = currentAngle + angle;
          currentAngle = endAngle;

          const x1 = cx + radius * Math.cos((startAngle * Math.PI) / 180);
          const y1 = cy + radius * Math.sin((startAngle * Math.PI) / 180);
          const x2 = cx + radius * Math.cos((endAngle * Math.PI) / 180);
          const y2 = cy + radius * Math.sin((endAngle * Math.PI) / 180);

          const largeArc = angle > 180 ? 1 : 0;

          return (
            <path
              key={idx}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={item.color}
              stroke="rgb(15, 23, 42)"
              strokeWidth={2}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={30} fill="rgb(15, 23, 42)" />
        <text x={cx} y={cy + 5} textAnchor="middle" fill="white" fontSize={12} fontWeight="bold">
          {total.toFixed(0)}
        </text>
        <text x={cx} y={cy + 17} textAnchor="middle" fill="rgb(148, 163, 184)" fontSize={9}>
          MPa
        </text>
      </svg>

      <div className="space-y-1">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-slate-400">{item.label}:</span>
            <span className="text-white">{((item.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  label: string;
  value: string;
  unit: string;
  color?: 'purple' | 'blue' | 'green' | 'amber' | 'red' | 'pink';
}> = ({ label, value, unit, color }) => {
  const colorClasses = {
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/20 border-green-500/30',
    amber: 'from-amber-500/20 to-amber-600/20 border-amber-500/30',
    red: 'from-red-500/20 to-red-600/20 border-red-500/30',
    pink: 'from-pink-500/20 to-pink-600/20 border-pink-500/30',
  };

  return (
    <div className={`p-4 rounded-xl bg-gradient-to-br ${color ? colorClasses[color] : 'from-slate-700/30 to-slate-800/30'} border ${color ? '' : 'border-white/5'}`}>
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400">{unit}</div>
    </div>
  );
};

export default PrestressedDesigner;
