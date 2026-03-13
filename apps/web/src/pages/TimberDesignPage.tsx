/**
 * TimberDesignPage.tsx — Timber Beam Design
 * Uses TimberDesignEngine (NDS 2018 / EN 1995 / IS 883)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Play, ArrowLeft, CheckCircle2, XCircle, AlertTriangle, TreePine, Download,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useToast } from '../components/ui/ToastSystem';
import { exportRowsToCsv, exportObjectToPdf } from '../utils/designExport';
import { SEO } from '../components/SEO';
import {
  designTimberBeam,
  type TimberMemberInput,
  type TimberBeamResult,
  type TimberGrade,
  type TimberSpecies,
} from '../modules/core/TimberDesignEngine';

type DesignCode = 'NDS' | 'EN1995' | 'IS883';

const DEFAULT_INPUT: TimberMemberInput = {
  type: 'sawn',
  species: 'Douglas_Fir',
  grade: 'No2' as TimberGrade,
  width: 89,          // mm (2×6 nominal)
  depth: 235,         // mm
  length: 4,          // m
  lateralSupport: 'discrete',
  loadDuration: 'medium_term',
  moistureCondition: 'dry',
  temperature: 'normal',
};

const DEFAULT_LOADS = { Mu: 8, Vu: 15 }; // kN·m, kN

export default function TimberDesignPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [code, setCode] = useState<DesignCode>('NDS');
  const [input, setInput] = useState<TimberMemberInput>(DEFAULT_INPUT);
  const [loads, setLoads] = useState(DEFAULT_LOADS);
  const [result, setResult] = useState<TimberBeamResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  // Serviceability: unfactored UDL for deflection (kN/m)
  const [wL, setWL] = useState(5);   // live load UDL
  const [wD, setWD] = useState(3);   // dead load UDL

  const handleExportCsv = () => {
    if (!result) return;
    const span_mm = input.length * 1000;
    const I_mm4 = (input.width * input.depth ** 3) / 12;
    const E_adj = result.E_adj;
    const delta_live  = (5 * (wL / 1000) * span_mm ** 4) / (384 * E_adj * I_mm4);
    const delta_total = (5 * ((wL + wD) / 1000) * span_mm ** 4) / (384 * E_adj * I_mm4);
    exportRowsToCsv(`timber_design_${new Date().toISOString().slice(0, 10)}.csv`, [
      { check: 'Bending Mu/Mn', demand: loads.Mu, capacity: result.M_capacity, utilization: (loads.Mu / result.M_capacity).toFixed(3) },
      { check: 'Shear Vu/Vn',  demand: loads.Vu, capacity: result.V_capacity, utilization: (loads.Vu / result.V_capacity).toFixed(3) },
      { check: 'Deflection Live (mm)',  demand: Number(delta_live.toFixed(2)),  limit: Number((span_mm / 360).toFixed(2)), utilization: (delta_live / (span_mm / 360)).toFixed(3) },
      { check: 'Deflection Total (mm)', demand: Number(delta_total.toFixed(2)), limit: Number((span_mm / 240).toFixed(2)), utilization: (delta_total / (span_mm / 240)).toFixed(3) },
    ]);
  };

  const handleExportPdf = async () => {
    if (!result) return;
    const span_mm = input.length * 1000;
    const I_mm4 = (input.width * input.depth ** 3) / 12;
    const delta_live  = (5 * (wL / 1000) * span_mm ** 4) / (384 * result.E_adj * I_mm4);
    const delta_total = (5 * ((wL + wD) / 1000) * span_mm ** 4) / (384 * result.E_adj * I_mm4);
    await exportObjectToPdf(
      `timber_design_${new Date().toISOString().slice(0, 10)}.pdf`,
      'Timber Beam Design Report — NDS 2018',
      {
        status:              result.status,
        governingCheck:      result.governingCheck,
        clause:              result.clause,
        appliedMoment_kNm:   loads.Mu,
        momentCapacity_kNm:  result.M_capacity,
        momentUtilization:   (loads.Mu / result.M_capacity).toFixed(3),
        appliedShear_kN:     loads.Vu,
        shearCapacity_kN:    result.V_capacity,
        shearUtilization:    (loads.Vu / result.V_capacity).toFixed(3),
        deflectionLive_mm:   delta_live.toFixed(2),
        deflectionLimit_L360: (span_mm / 360).toFixed(1),
        deflectionTotal_mm:  delta_total.toFixed(2),
        deflectionLimit_L240: (span_mm / 240).toFixed(1),
        Fb_adj_MPa:          result.Fb_adj,
        Fv_adj_MPa:          result.Fv_adj,
        E_adj_MPa:           result.E_adj,
        generatedAt:         new Date().toISOString(),
      },
    );
  };

  useEffect(() => { document.title = 'Timber Design | BeamLab'; }, []);

  const set = <K extends keyof TimberMemberInput>(field: K, value: TimberMemberInput[K]) =>
    setInput(prev => ({ ...prev, [field]: value }));

  const handleRun = () => {
    setAnalyzing(true);
    setError('');
    setResult(null);
    try {
      const res = designTimberBeam(input, loads, code);
      setResult(res);
      toast.success(`Design ${res.status === 'PASS' ? 'passed' : 'failed'} — ${res.governingCheck}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Calculation failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <SEO
        title="Timber Beam Design"
        description="Design timber beams per NDS 2018, EN 1995, and IS 883. Adjustment factors, beam stability, shear checks."
        path="/design/timber"
      />

      {/* Header */}
      <div className="max-w-5xl mx-auto mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-3">
          <TreePine className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Timber Beam Design</h1>
            <p className="text-sm text-gray-500">NDS 2018 / EN 1995 / IS 883</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Design Code & Member Type */}
          <section className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h2 className="font-semibold mb-3 text-gray-800 dark:text-gray-200">Design Code &amp; Type</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <SelectField label="Design Code" value={code} onChange={v => setCode(v as DesignCode)}
                options={[['NDS', 'NDS 2018'], ['EN1995', 'EN 1995-1-1'], ['IS883', 'IS 883']]} />
              <SelectField label="Member Type" value={input.type} onChange={v => set('type', v as 'sawn' | 'glulam' | 'clt' | 'lvl')}
                options={[['sawn', 'Sawn Lumber'], ['glulam', 'Glulam'], ['clt', 'CLT'], ['lvl', 'LVL']]} />
              <SelectField label="Species" value={input.species ?? 'Douglas_Fir'} onChange={v => set('species', v as TimberSpecies)}
                options={[
                  ['Douglas_Fir', 'Douglas Fir'], ['Southern_Pine', 'Southern Pine'],
                  ['Hem_Fir', 'Hem-Fir'], ['Spruce_Pine_Fir', 'Spruce-Pine-Fir'],
                  ['Norway_Spruce', 'Norway Spruce'], ['Oak', 'Oak'], ['Teak', 'Teak'],
                ]} />
              <SelectField label="Grade" value={input.grade} onChange={v => set('grade', v as TimberGrade)}
                options={[
                  ['Select_Structural', 'Select Structural'], ['No1', 'No. 1'], ['No2', 'No. 2'],
                  ['C24', 'C24'], ['C30', 'C30'], ['GL28h', 'GL28h'], ['GL32h', 'GL32h'],
                ]} />
            </div>
          </section>

          {/* Geometry */}
          <section className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h2 className="font-semibold mb-3 text-gray-800 dark:text-gray-200">Geometry</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <InputField label="Width b (mm)" value={input.width} onChange={v => set('width', +v)} />
              <InputField label="Depth d (mm)" value={input.depth} onChange={v => set('depth', +v)} />
              <InputField label="Span (m)" value={input.length} onChange={v => set('length', +v)} />
              <SelectField label="Lateral Support" value={input.lateralSupport}
                onChange={v => set('lateralSupport', v as 'continuous' | 'discrete' | 'none')}
                options={[['continuous', 'Continuous'], ['discrete', 'Discrete'], ['none', 'None']]} />
              {input.lateralSupport !== 'continuous' && (
                <InputField label="Unbr. Length (m)" value={input.unbragedLength ?? input.length}
                  onChange={v => set('unbragedLength', +v)} />
              )}
            </div>
          </section>

          {/* Conditions */}
          <section className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h2 className="font-semibold mb-3 text-gray-800 dark:text-gray-200">Service Conditions</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <SelectField label="Load Duration" value={input.loadDuration}
                onChange={v => set('loadDuration', v as TimberMemberInput['loadDuration'])}
                options={[
                  ['permanent', 'Permanent (Dead)'], ['long_term', 'Long-Term (Storage)'],
                  ['medium_term', 'Medium-Term (Live)'], ['short_term', 'Short-Term (Wind)'],
                  ['instantaneous', 'Instantaneous (Seismic)'],
                ]} />
              <SelectField label="Moisture" value={input.moistureCondition}
                onChange={v => set('moistureCondition', v as 'dry' | 'wet')}
                options={[['dry', 'Dry (MC ≤ 19%)'], ['wet', 'Wet (MC > 19%)']]} />
              <SelectField label="Temperature" value={input.temperature}
                onChange={v => set('temperature', v as 'normal' | 'elevated')}
                options={[['normal', 'Normal (≤ 37°C)'], ['elevated', 'Elevated (> 37°C)']]} />
            </div>
          </section>

          {/* Applied Loads */}
          <section className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h2 className="font-semibold mb-3 text-gray-800 dark:text-gray-200">Applied Loads</h2>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Mu factored (kN·m)" value={loads.Mu} onChange={v => setLoads(p => ({ ...p, Mu: +v }))} />
              <InputField label="Vu factored (kN)"   value={loads.Vu} onChange={v => setLoads(p => ({ ...p, Vu: +v }))} />
              <InputField label="wL unfactored UDL (kN/m)" value={wL} onChange={v => setWL(+v)} />
              <InputField label="wD unfactored UDL (kN/m)" value={wD} onChange={v => setWD(+v)} />
            </div>
            <p className="text-xs text-gray-400 mt-2">wL / wD used for deflection serviceability (NDS Cl. 3.5)</p>
          </section>

          {/* Run Button */}
          <Button
            onClick={handleRun}
            disabled={analyzing}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5"
          >
            {analyzing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Calculating...</> : <><Play className="w-4 h-4 mr-2" /> Run Design Check</>}
          </Button>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Status */}
              <div className={`rounded-lg p-4 shadow-sm ${result.status === 'PASS' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {result.status === 'PASS' ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                  <span className="font-bold text-lg">{result.status}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {result.governingCheck} — {result.clause}
                </p>
              </div>

              {/* Capacities */}
              <ResultCard title="Adjusted Capacities">
                <ResultRow label="Fb' (bending)" value={`${result.Fb_adj} MPa`} />
                <ResultRow label="Fv' (shear)" value={`${result.Fv_adj} MPa`} />
                <ResultRow label="Fc⊥' (bearing)" value={`${result.Fc_perp_adj} MPa`} />
                <ResultRow label="E' (modulus)" value={`${result.E_adj} MPa`} />
              </ResultCard>

              <ResultCard title="Member Capacity">
                <ResultRow label="M capacity" value={`${result.M_capacity} kN·m`} />
                <ResultRow label="V capacity" value={`${result.V_capacity} kN`} />
              </ResultCard>

              {/* Adjustment Factors */}
              <ResultCard title="NDS Adjustment Factors">
                <ResultRow label="CD (load duration)" value={`${result.adjustmentFactors.CD}`} />
                <ResultRow label="CM (wet service)" value={`${result.adjustmentFactors.CM}`} />
                <ResultRow label="Ct (temperature)" value={`${result.adjustmentFactors.Ct}`} />
                <ResultRow label="CL (beam stability)" value={`${result.adjustmentFactors.CL}`} />
                <ResultRow label="CF (size)" value={`${result.adjustmentFactors.CF}`} />
                <ResultRow label="Cr (repetitive)" value={`${result.adjustmentFactors.Cr}`} />

                            {/* Utilization Ratios */}
                            {(() => {
                              const span_mm = input.length * 1000;
                              const I_mm4   = (input.width * input.depth ** 3) / 12;
                              const delta_live  = (5 * (wL / 1000) * span_mm ** 4) / (384 * result.E_adj * I_mm4);
                              const delta_total = (5 * ((wL + wD) / 1000) * span_mm ** 4) / (384 * result.E_adj * I_mm4);
                              const checks = [
                                { label: 'Mu / Mn (bending)',      ratio: loads.Mu / result.M_capacity },
                                { label: 'Vu / Vn (shear)',        ratio: loads.Vu / result.V_capacity },
                                { label: `δL / (L/360) — live (${delta_live.toFixed(1)}/${(span_mm/360).toFixed(1)} mm)`, ratio: delta_live / (span_mm / 360) },
                                { label: `δT / (L/240) — total (${delta_total.toFixed(1)}/${(span_mm/240).toFixed(1)} mm)`, ratio: delta_total / (span_mm / 240) },
                              ];
                              return (
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm space-y-3">
                                  <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Utilization Ratios</h3>
                                  {checks.map(({ label, ratio }) => {
                                    const pct = Math.min(ratio * 100, 100);
                                    const clr = ratio > 1 ? 'bg-red-500' : ratio > 0.85 ? 'bg-amber-500' : 'bg-emerald-500';
                                    return (
                                      <div key={label}>
                                        <div className="flex justify-between text-xs mb-1">
                                          <span className="text-gray-500 dark:text-gray-400 truncate mr-2">{label}</span>
                                          <span className={`font-bold shrink-0 ${ratio > 1 ? 'text-red-500' : ratio > 0.85 ? 'text-amber-500' : 'text-emerald-600'}`}>
                                            {ratio.toFixed(2)}
                                          </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                          <div className={`h-full rounded-full transition-all ${clr}`} style={{ width: `${pct}%` }} />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}

                            {/* Export */}
                            <div className="flex gap-2">
                              <button type="button" onClick={handleExportCsv}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                <Download className="w-4 h-4" /> CSV
                              </button>
                              <button type="button" onClick={() => { void handleExportPdf(); }}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors">
                                <Download className="w-4 h-4" /> PDF Report
                              </button>
                            </div>
              </ResultCard>
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm text-center text-gray-400">
              <TreePine className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Enter parameters and run design check to see results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Reusable helpers ─────────────────────────────────────────── */

function InputField({ label, value, onChange }: {
  label: string; value: string | number; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 dark:text-gray-400">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 dark:text-gray-400">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      >
        {options.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
      </select>
    </div>
  );
}

function ResultCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
      <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-mono text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}
