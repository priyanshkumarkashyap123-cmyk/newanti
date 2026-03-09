/**
 * TimberDesignPage.tsx — Timber Beam Design
 * Uses TimberDesignEngine (NDS 2018 / EN 1995 / IS 883)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Play, ArrowLeft, CheckCircle2, XCircle, AlertTriangle, TreePine,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useToast } from '../components/ui/ToastSystem';
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
            <h2 className="font-semibold mb-3 text-gray-800 dark:text-gray-200">Applied Loads (Factored)</h2>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Mu (kN·m)" value={loads.Mu} onChange={v => setLoads(p => ({ ...p, Mu: +v }))} />
              <InputField label="Vu (kN)" value={loads.Vu} onChange={v => setLoads(p => ({ ...p, Vu: +v }))} />
            </div>
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
