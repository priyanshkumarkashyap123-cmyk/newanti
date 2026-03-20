/**
 * CompositeDesignPage.tsx — Composite Steel-Concrete Beam Design
 * Uses CompositeDesignEngine (AISC 360 Chapter I / EN 1994 / IS 11384)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Play, ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Layers, Download,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useToast } from '../components/ui/ToastSystem';
import { exportRowsToCsv, exportObjectToPdf } from '../utils/designExport';
import { SEO } from '../components/SEO';
import {
  designCompositeBeam,
  type CompositeBeamInput,
  type CompositeBeamResult,
} from '../modules/core/CompositeDesignEngine';

type DesignCode = 'AISC360' | 'EN1994' | 'IS11384';

const DEFAULT_INPUT: CompositeBeamInput = {
  steelSection: 'W14x22',
  As: 4180,       // mm²
  d: 349,         // mm
  tw: 5.8,        // mm
  bf: 127,        // mm
  tf: 8.5,        // mm
  Ix: 82.8e6,     // mm⁴
  Fy: 345,        // MPa
  Fu: 450,        // MPa
  slabWidth: 2000, // mm
  slabThickness: 125, // mm
  fc: 25,          // MPa
  deckType: 'solid',
  studDiameter: 19,  // mm
  studHeight: 100,   // mm
  studFu: 450,       // MPa
  studSpacing: 300,  // mm
  span: 8,           // m
};

export default function CompositeDesignPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [code, setCode] = useState<DesignCode>('AISC360');
  const [input, setInput] = useState<CompositeBeamInput>(DEFAULT_INPUT);
  const [result, setResult] = useState<CompositeBeamResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [Mu, setMu] = useState(120);   // kN·m applied factored moment
  const [Vu, setVu] = useState(60);    // kN applied factored shear

  useEffect(() => { document.title = 'Composite Beam Design | BeamLab'; }, []);

  const set = (field: keyof CompositeBeamInput, value: number | string) =>
    setInput(prev => ({ ...prev, [field]: value }));

  const handleExportCsv = () => {
    if (!result) return;
    exportRowsToCsv(`composite_design_${new Date().toISOString().slice(0, 10)}.csv`, [
      { check: 'Positive Moment Capacity Mn+ (kN·m)', capacity: result.Mn_positive, demand: Mu, utilization: (Mu / result.Mn_positive).toFixed(3) },
      { check: 'Shear Capacity Vn (kN)',              capacity: result.Vn,          demand: Vu, utilization: (Vu / result.Vn).toFixed(3)          },
      { check: 'Composite Ratio',                    capacity: 1,                  demand: result.compositeRatio, utilization: result.compositeRatio.toFixed(3) },
    ]);
  };

  const handleExportPdf = async () => {
    if (!result) return;
    await exportObjectToPdf(
      `composite_design_${new Date().toISOString().slice(0, 10)}.pdf`,
      'Composite Beam Design Report — AISC 360 Chapter I',
      {
        status: result.status,
        governingCheck: result.governingCheck,
        clause: result.clause,
        appliedMoment_kNm:    Mu,
        momentCapacity_kNm:   result.Mn_positive,
        momentUtilization:    (Mu / result.Mn_positive).toFixed(3),
        appliedShear_kN:      Vu,
        shearCapacity_kN:     result.Vn,
        shearUtilization:     (Vu / result.Vn).toFixed(3),
        compositeRatio_pct:   (result.compositeRatio * 100).toFixed(1),
        PNA_location:         result.PNA_location,
        studCapacity_kN:      result.Qn_stud,
        studsRequired:        result.studsRequired,
        ieff_mm4:             result.Ieff,
        deflectionLive_mm:    result.deflection_live,
        deflectionTotal_mm:   result.deflection_total,
        generatedAt:          new Date().toISOString(),
      },
    );
  };

  const handleRun = () => {
    setAnalyzing(true);
    setError('');
    setResult(null);
    try {
      const res = designCompositeBeam(input, code);
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
        title="Composite Beam Design"
        description="Design composite steel-concrete beams per AISC 360 Chapter I, EN 1994, and IS 11384. Stud capacity, PNA location, deflection checks."
        path="/design/composite"
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
          <Layers className="w-7 h-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Composite Beam Design</h1>
            <p className="text-sm text-gray-500">AISC 360 Chapter I / EN 1994 / IS 11384</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Design Code */}
          <section className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h2 className="font-semibold mb-3 text-gray-800 dark:text-gray-200">Design Code</h2>
            <select
              value={code}
              onChange={e => setCode(e.target.value as DesignCode)}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="AISC360">AISC 360-22</option>
              <option value="EN1994">EN 1994-1-1</option>
              <option value="IS11384">IS 11384</option>
            </select>
          </section>

          {/* Steel Section */}
          <section className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h2 className="font-semibold mb-3 text-gray-800 dark:text-gray-200">Steel Section</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <InputField label="Section Label" value={input.steelSection} onChange={v => set('steelSection', v)} type="text" />
              <InputField label="Area As (mm²)" value={input.As} onChange={v => set('As', +v)} />
              <InputField label="Depth d (mm)" value={input.d} onChange={v => set('d', +v)} />
              <InputField label="Web tw (mm)" value={input.tw} onChange={v => set('tw', +v)} />
              <InputField label="Flange bf (mm)" value={input.bf} onChange={v => set('bf', +v)} />
              <InputField label="Flange tf (mm)" value={input.tf} onChange={v => set('tf', +v)} />
              <InputField label="Ix (mm⁴)" value={input.Ix} onChange={v => set('Ix', +v)} />
              <InputField label="Fy (MPa)" value={input.Fy} onChange={v => set('Fy', +v)} />
              <InputField label="Fu (MPa)" value={input.Fu} onChange={v => set('Fu', +v)} />
            </div>
          </section>

          {/* Concrete Slab */}
          <section className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h2 className="font-semibold mb-3 text-gray-800 dark:text-gray-200">Concrete Slab</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <InputField label="Eff. Width (mm)" value={input.slabWidth} onChange={v => set('slabWidth', +v)} />
              <InputField label="Thickness (mm)" value={input.slabThickness} onChange={v => set('slabThickness', +v)} />
              <InputField label="f'c (MPa)" value={input.fc} onChange={v => set('fc', +v)} />
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Deck Type</label>
                <select
                  value={input.deckType}
                  onChange={e => set('deckType', e.target.value as 'solid' | 'metal_deck')}
                  className="w-full border rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="solid">Solid Slab</option>
                  <option value="metal_deck">Metal Deck</option>
                </select>
              </div>
              {input.deckType === 'metal_deck' && (
                <>
                  <InputField label="Rib Height (mm)" value={input.deckRibHeight ?? 75} onChange={v => set('deckRibHeight', +v)} />
                  <InputField label="Rib Width (mm)" value={input.deckRibWidth ?? 150} onChange={v => set('deckRibWidth', +v)} />
                </>
              )}
            </div>
          </section>

          {/* Shear Studs & Span */}
          <section className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h2 className="font-semibold mb-3 text-gray-800 dark:text-gray-200">Shear Studs &amp; Geometry</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <InputField label="Stud Dia (mm)" value={input.studDiameter} onChange={v => set('studDiameter', +v)} />
              <InputField label="Stud Height (mm)" value={input.studHeight} onChange={v => set('studHeight', +v)} />
              <InputField label="Stud Fu (MPa)" value={input.studFu} onChange={v => set('studFu', +v)} />
              <InputField label="Spacing (mm)" value={input.studSpacing} onChange={v => set('studSpacing', +v)} />
              <InputField label="Span (m)" value={input.span} onChange={v => set('span', +v)} />
            </div>
          </section>

          {/* Applied Loads */}
          <section className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h2 className="font-semibold mb-3 text-gray-800 dark:text-gray-200">Applied Loads (Factored)</h2>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Mu (kN·m)" value={Mu} onChange={v => setMu(+v)} />
              <InputField label="Vu (kN)"   value={Vu} onChange={v => setVu(+v)} />
            </div>
          </section>

          {/* Run Button */}
          <Button
            onClick={handleRun}
            disabled={analyzing}
            className="w-full bg-gradient-to-r from-[#4d8eff] to-[#3b72cc] hover:from-[#3b72cc] hover:to-[#2a5599] text-white shadow-[0_0_15px_rgba(77,142,255,0.3)] hover:shadow-[0_0_20px_rgba(77,142,255,0.5)] py-2.5"
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
              <div className={`rounded-lg p-4 shadow-sm ${result.status === 'PASS' ? 'bg-green-50 dark:bg-green-900/20 border border-[#1a2333]' : 'bg-red-50 dark:bg-red-900/20 border border-[#1a2333]'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {result.status === 'PASS' ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                  <span className="font-bold text-lg">{result.status}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {result.governingCheck} — {result.clause}
                </p>
              </div>

              {/* Capacities */}
              <ResultCard title="Moment Capacity">
                <ResultRow label="M⁺ (positive)" value={`${result.Mn_positive} kN·m`} />
                <ResultRow label="M⁻ (negative)" value={`${result.Mn_negative} kN·m`} />
                <ResultRow label="Shear Vn" value={`${result.Vn} kN`} />
              </ResultCard>

              {/* Composite Action */}
              <ResultCard title="Composite Action">
                <ResultRow label="Composite Ratio" value={`${(result.compositeRatio * 100).toFixed(1)}%`} />
                <ResultRow label="PNA Location" value={result.PNA_location} />
                <ResultRow label="Stud Capacity Qn" value={`${result.Qn_stud} kN`} />
                <ResultRow label="Studs Required" value={`${result.studsRequired} per half-span`} />
              </ResultCard>

              {/* Serviceability */}
              <ResultCard title="Serviceability">
                <ResultRow label="Ieff" value={`${(result.Ieff / 1e6).toFixed(1)} ×10⁶ mm⁴`} />
                <ResultRow label="δ live" value={`${result.deflection_live} mm`} />
                <ResultRow label="δ total" value={`${result.deflection_total} mm`} />

                            {/* Utilization */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm space-y-3">
                              <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Utilization Ratios</h3>
                              {([
                                { label: 'Mu / Mn+ (moment)', demand: Mu, capacity: result.Mn_positive, unit: 'kN·m' },
                                { label: 'Vu / Vn (shear)',   demand: Vu, capacity: result.Vn,          unit: 'kN'   },
                              ] as const).map(({ label, demand, capacity, unit }) => {
                                const ratio = Math.min(demand / capacity, 1.5);
                                const pct   = Math.min(ratio * 100, 100);
                                const clr   = ratio > 1 ? 'bg-red-500' : ratio > 0.85 ? 'bg-amber-500' : 'bg-emerald-500';
                                return (
                                  <div key={label}>
                                    <div className="flex justify-between text-xs mb-1">
                                      <span className="text-gray-500 dark:text-gray-400">{label}</span>
                                      <span className={`font-bold ${ratio > 1 ? 'text-red-500' : ratio > 0.85 ? 'text-amber-500' : 'text-emerald-600'}`}>
                                        {(demand / capacity).toFixed(2)} ({demand}/{capacity} {unit})
                                      </span>
                                    </div>
                                    <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                      <div className={`h-full rounded-full transition-all ${clr}`} style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Export */}
                            <div className="flex gap-2">
                              <button type="button" onClick={handleExportCsv}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium tracking-wide tracking-wide hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                <Download className="w-4 h-4" /> CSV
                              </button>
                              <button type="button" onClick={() => { void handleExportPdf(); }}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-[#4d8eff] to-[#3b72cc] hover:from-[#3b72cc] hover:to-[#2a5599] text-white shadow-[0_0_15px_rgba(77,142,255,0.3)] hover:shadow-[0_0_20px_rgba(77,142,255,0.5)] text-sm font-medium tracking-wide tracking-wide transition-colors">
                                <Download className="w-4 h-4" /> PDF Report
                              </button>
                            </div>
              </ResultCard>
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm text-center text-gray-400">
              <Layers className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Enter parameters and run design check to see results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Reusable helpers ─────────────────────────────────────────── */

function InputField({ label, value, onChange, type = 'number' }: {
  label: string; value: string | number; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 dark:text-gray-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      />
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
