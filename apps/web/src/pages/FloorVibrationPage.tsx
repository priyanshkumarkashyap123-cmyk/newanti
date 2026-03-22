/**
 * FloorVibrationPage.tsx - Floor Vibration Serviceability Analysis
 *
 * Walking-induced vibration assessment per:
 * - AISC Design Guide 11
 * - SCI P354
 * - Eurocode 5 / EN 1990 Annex A2
 * - ISO 10137
 *
 * Uses VibrationServiceabilityEngine for calculations.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Home, Building2, Play, AlertTriangle, CheckCircle, Info, Download } from 'lucide-react';
import { FloorFrequency, type FloorSystem, type VibrationResult } from '../modules/analysis/VibrationServiceabilityEngine';
import { exportRowsToCsv, exportObjectToPdf } from '../utils/designExport';

type OccupancyType = 'office' | 'residential' | 'shopping' | 'hospital' | 'gym';

const OCCUPANCY_LIMITS: Record<OccupancyType, { limit: number; unit: string; source: string }> = {
  office:      { limit: 0.5,  unit: '%g', source: 'AISC DG11 – Office' },
  residential: { limit: 0.5,  unit: '%g', source: 'AISC DG11 – Residential' },
  shopping:    { limit: 1.5,  unit: '%g', source: 'AISC DG11 – Shopping Mall' },
  hospital:    { limit: 0.25, unit: '%g', source: 'AISC DG11 – Sensitive (OR)' },
  gym:         { limit: 5.0,  unit: '%g', source: 'AISC DG11 – Rhythmic' },
};

function getPerception(ratio: number): string {
  if (ratio < 0.3) return 'Imperceptible';
  if (ratio < 0.6) return 'Barely Perceptible';
  if (ratio < 0.9) return 'Perceptible';
  if (ratio < 1.2) return 'Annoying';
  return 'Intolerable';
}

export function FloorVibrationPage() {
  useEffect(() => { document.title = 'Floor Vibration | BeamLab'; }, []);

  // ── Input state ──
  const [beamSpan, setBeamSpan] = useState(8);
  const [beamSpacing, setBeamSpacing] = useState(3);
  const [girderSpan, setGirderSpan] = useState(9);
  const [slabThickness, setSlab] = useState(130);
  const [beamI, setBeamI] = useState(3.5e8);   // mm⁴
  const [beamDepth, setBeamDepth] = useState(400);
  const [girderI, setGirderI] = useState(6.0e8);
  const [girderDepth, setGirderDepth] = useState(500);
  const [deadLoad, setDeadLoad] = useState(3.5);  // kN/m²
  const [superimposed, setSuperimposed] = useState(1.0);
  const [liveLoad, setLiveLoad] = useState(3.0);
  const [dampingRatio, setDampingRatio] = useState(0.03);
  const [occupancy, setOccupancy] = useState<OccupancyType>('office');
  const [walkerWeight, setWalkerWeight] = useState(750); // N

  // ── Results ──
  const [result, setResult] = useState<{
    beamFreq: number; girderFreq: number; combinedFreq: number;
    peakAccel: number; ratio: number; pass: boolean; perception: string;
    effectiveMass: number;
  } | null>(null);

    const handleExportCsv = () => {
      if (!result) return;
      exportRowsToCsv(`floor_vibration_${new Date().toISOString().slice(0, 10)}.csv`, [
        { parameter: 'Beam Frequency (Hz)',       value: result.beamFreq.toFixed(3) },
        { parameter: 'Girder Frequency (Hz)',     value: result.girderFreq.toFixed(3) },
        { parameter: 'Combined Frequency (Hz)',   value: result.combinedFreq.toFixed(3) },
        { parameter: 'Peak Acceleration (%g)',    value: result.peakAccel.toFixed(4) },
        { parameter: 'Allowable Acceleration (%g)', value: String(OCCUPANCY_LIMITS[occupancy].limit) },
        { parameter: 'Demand / Capacity Ratio',   value: result.ratio.toFixed(3) },
        { parameter: 'Perception',                value: result.perception },
        { parameter: 'Effective Mass (kg)',        value: result.effectiveMass.toFixed(0) },
        { parameter: 'Status',                    value: result.pass ? 'PASS' : 'FAIL' },
      ]);
    };

    const handleExportPdf = async () => {
      if (!result) return;
      await exportObjectToPdf(
        `floor_vibration_${new Date().toISOString().slice(0, 10)}.pdf`,
        'Floor Vibration Serviceability Report — AISC DG11',
        {
          occupancy,
          beamFreq_Hz:        result.beamFreq.toFixed(3),
          girderFreq_Hz:      result.girderFreq.toFixed(3),
          combinedFreq_Hz:    result.combinedFreq.toFixed(3),
          peakAcceleration_pctg: result.peakAccel.toFixed(4),
          allowableAccel_pctg: OCCUPANCY_LIMITS[occupancy].limit,
          demandCapacityRatio: result.ratio.toFixed(3),
          perception:         result.perception,
          effectiveMass_kg:   result.effectiveMass.toFixed(0),
          status:             result.pass ? 'PASS' : 'FAIL',
          codeReference:      OCCUPANCY_LIMITS[occupancy].source,
          generatedAt:        new Date().toISOString(),
        },
      );
    };
  const [error, setError] = useState('');

  const runAnalysis = () => {
    setError('');
    setResult(null);

    // ── Input validation ──
    const checks: [boolean, string][] = [
      [beamSpan <= 0, 'Beam span must be > 0'],
      [beamSpacing <= 0, 'Beam spacing must be > 0'],
      [girderSpan <= 0, 'Girder span must be > 0'],
      [slabThickness <= 0, 'Slab thickness must be > 0'],
      [beamI <= 0, 'Beam moment of inertia must be > 0'],
      [beamDepth <= 0, 'Beam depth must be > 0'],
      [girderI <= 0, 'Girder moment of inertia must be > 0'],
      [girderDepth <= 0, 'Girder depth must be > 0'],
      [deadLoad < 0, 'Dead load cannot be negative'],
      [liveLoad < 0, 'Live load cannot be negative'],
      [dampingRatio <= 0 || dampingRatio > 1, 'Damping ratio must be between 0 (exclusive) and 1'],
      [walkerWeight <= 0, 'Walker weight must be > 0'],
    ];
    const firstFail = checks.find(([cond]) => cond);
    if (firstFail) { setError(firstFail[1]); return; }

    try {
      const floor: FloorSystem = {
        type: 'steel-composite',
        bay: { length: beamSpan, width: beamSpacing },
        beam: {
          spacing: beamSpacing,
          momentOfInertia: beamI,
          effectiveWidth: beamSpacing * 1000,
          depth: beamDepth,
          elasticModulus: 200000,
        },
        girder: {
          span: girderSpan,
          momentOfInertia: girderI,
          effectiveWidth: beamSpan * 1000,
          depth: girderDepth,
          elasticModulus: 200000,
        },
        slab: {
          thickness: slabThickness,
          density: 2400,
          elasticModulus: 25000,
          dampingRatio,
        },
        loads: { dead: deadLoad, superimposed, live: liveLoad },
      };

      // Compute natural frequencies
      const freq = FloorFrequency.compositeFloor(floor);

      // Simplified AISC DG11 peak-acceleration estimate
      // a_p/g = P₀ exp(−0.35 fₙ) / (β W)
      // P₀ = 0.29 kN for walking (AISC DG11 Table 4.1)
      const P0 = 290; // N
      const fn = freq.combinedFrequency;
      const ap_over_g = (P0 * Math.exp(-0.35 * fn)) / (dampingRatio * freq.effectiveMass * 9.81);
      const peakAccelPctG = ap_over_g * 100;

      const limit = OCCUPANCY_LIMITS[occupancy];
      const ratio = peakAccelPctG / limit.limit;
      const pass = ratio <= 1.0;

      setResult({
        beamFreq: freq.beamFrequency,
        girderFreq: freq.girderFrequency,
        combinedFreq: fn,
        peakAccel: peakAccelPctG,
        ratio,
        pass,
        perception: getPerception(ratio),
        effectiveMass: freq.effectiveMass,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd]">
      {/* Header */}
      <div className="border-b border-[#1a2333] bg-gradient-to-r from-slate-50 dark:from-slate-900 via-amber-900/20 to-slate-50 dark:to-slate-900">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            <Link to="/analysis/dynamic" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-[#869ab8]" />
            </Link>
            <div className="h-5 w-px bg-slate-300 dark:bg-slate-700" />
            <Link to="/" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
              <Home className="w-5 h-5 text-[#869ab8]" />
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                Floor Vibration Assessment
              </h1>
              <p className="text-sm text-[#869ab8]">
                AISC Design Guide 11 &bull; SCI P354 &bull; ISO 10137
              </p>
            </div>
            <span className="ml-auto text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 dark:text-amber-300 font-medium tracking-wide">
              Beta
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Input Panel ── */}
        <div className="space-y-6">
          {/* Bay Geometry */}
          <section className="bg-[#0b1326] border border-[#1a2333] rounded-xl p-5">
            <h2 className="font-semibold text-lg mb-4">Bay Geometry</h2>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Beam Span (m)" value={beamSpan} onChange={setBeamSpan} />
              <InputField label="Beam Spacing (m)" value={beamSpacing} onChange={setBeamSpacing} />
              <InputField label="Girder Span (m)" value={girderSpan} onChange={setGirderSpan} />
              <InputField label="Slab Thickness (mm)" value={slabThickness} onChange={setSlab} />
            </div>
          </section>

          {/* Section Properties */}
          <section className="bg-[#0b1326] border border-[#1a2333] rounded-xl p-5">
            <h2 className="font-semibold text-lg mb-4">Section Properties</h2>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Beam I (mm⁴)" value={beamI} onChange={setBeamI} sci />
              <InputField label="Beam Depth (mm)" value={beamDepth} onChange={setBeamDepth} />
              <InputField label="Girder I (mm⁴)" value={girderI} onChange={setGirderI} sci />
              <InputField label="Girder Depth (mm)" value={girderDepth} onChange={setGirderDepth} />
            </div>
          </section>

          {/* Loading */}
          <section className="bg-[#0b1326] border border-[#1a2333] rounded-xl p-5">
            <h2 className="font-semibold text-lg mb-4">Loading &amp; Damping</h2>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Dead Load (kN/m²)" value={deadLoad} onChange={setDeadLoad} />
              <InputField label="Superimposed (kN/m²)" value={superimposed} onChange={setSuperimposed} />
              <InputField label="Live Load (kN/m²)" value={liveLoad} onChange={setLiveLoad} />
              <InputField label="Damping Ratio" value={dampingRatio} onChange={setDampingRatio} step={0.005} />
              <InputField label="Walker Weight (N)" value={walkerWeight} onChange={setWalkerWeight} />
              <div>
                <label className="block text-xs text-[#869ab8] mb-1">Occupancy</label>
                <select
                  value={occupancy}
                  onChange={e => setOccupancy(e.target.value as OccupancyType)}
                  className="w-full p-2 rounded-lg bg-[#131b2e] border border-[#1a2333] text-sm"
                >
                  <option value="office">Office</option>
                  <option value="residential">Residential</option>
                  <option value="shopping">Shopping Mall</option>
                  <option value="hospital">Hospital / Sensitive</option>
                  <option value="gym">Gym / Rhythmic</option>
                </select>
              </div>
            </div>
          </section>

          <button
            type="button"
            onClick={runAnalysis}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 transition-all shadow-lg"
          >
            <Play className="w-5 h-5" />
            Run Vibration Check
          </button>
        </div>

        {/* ── Results Panel ── */}
        <div className="space-y-6">
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-[#1a2333] text-red-700 dark:text-red-300 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {result && (
            <>
              {/* Pass / Fail Banner */}
              <div className={`flex items-center gap-3 p-4 rounded-xl border text-sm font-medium tracking-wide ${
                result.pass
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-[#1a2333] text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-900/20 border-[#1a2333] text-red-700 dark:text-red-300'
              }`}>
                {result.pass ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                {result.pass ? 'Floor vibration is ACCEPTABLE' : 'Floor vibration EXCEEDS limit'}
                <span className="ml-auto font-bold">{(result.ratio * 100).toFixed(0)}% of limit</span>
              </div>

              {/* Natural Frequencies */}
              <section className="bg-[#0b1326] border border-[#1a2333] rounded-xl p-5">
                <h3 className="font-semibold mb-3">Natural Frequencies</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <FreqCard label="Beam" value={result.beamFreq} />
                  <FreqCard label="Girder" value={result.girderFreq} />
                  <FreqCard label="Combined" value={result.combinedFreq} highlight />
                </div>
                <p className="text-xs text-[#869ab8] mt-3 flex items-start gap-1">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Combined frequency via Dunkerley's equation. Floors above ~9 Hz are typically non-susceptible.
                </p>
              </section>

              {/* Peak Acceleration */}
              <section className="bg-[#0b1326] border border-[#1a2333] rounded-xl p-5">
                <h3 className="font-semibold mb-3">Walking Response</h3>
                <div className="grid grid-cols-2 gap-4">
                  <ResultRow label="Peak Acceleration" value={`${result.peakAccel.toFixed(3)} %g`} />
                  <ResultRow label="Limit" value={`${OCCUPANCY_LIMITS[occupancy].limit} %g`} />
                  <ResultRow label="Demand / Capacity" value={`${result.ratio.toFixed(2)}`} warn={result.ratio > 1} />
                  <ResultRow label="Perception" value={result.perception} />
                  <ResultRow label="Effective Mass" value={`${result.effectiveMass.toFixed(0)} kg`} />
                  <ResultRow label="Code" value={OCCUPANCY_LIMITS[occupancy].source} />
                </div>
              </section>

              {/* Recommendations */}
              <section className="bg-[#0b1326] border border-[#1a2333] rounded-xl p-5">
                <h3 className="font-semibold mb-3">Recommendations</h3>
                <ul className="text-sm text-[#869ab8] space-y-2">
                  {result.combinedFreq < 3 && <li className="flex gap-2"><AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" /> Very low frequency — consider stiffening the floor system.</li>}
                  {result.combinedFreq < 6 && <li className="flex gap-2"><Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" /> Frequency below 6 Hz — susceptible to walking resonance.</li>}
                  {result.ratio > 1 && <li className="flex gap-2"><AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" /> Increase beam/girder stiffness or add damping (TMD).</li>}
                  {result.ratio <= 1 && result.ratio > 0.7 && <li className="flex gap-2"><Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" /> Marginal pass — consider sensitivity study for heavier walkers.</li>}
                  {result.ratio <= 0.7 && <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> Comfortable margin — floor is likely imperceptible to occupants.</li>}
                  <li className="flex gap-2"><Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" /> Damping ratio {dampingRatio} assumed ({(dampingRatio * 100).toFixed(1)}%). Bare steel: 0.01, Composite: 0.02–0.03, Fit-out: 0.03–0.05.</li>
                </ul>

                            {/* Export */}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={handleExportCsv}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium tracking-wide hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <Download className="w-4 h-4" /> Export CSV
                              </button>
                              <button
                                type="button"
                                onClick={() => { void handleExportPdf(); }}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium tracking-wide transition-colors"
                              >
                                <Download className="w-4 h-4" /> PDF Report
                              </button>
                            </div>
              </section>
            </>
          )}

          {!result && !error && (
            <div className="flex flex-col items-center justify-center h-64 text-[#424754] text-center">
              <Building2 className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-sm">Enter floor system parameters and click <strong>Run Vibration Check</strong>.</p>
              <p className="text-xs mt-1 opacity-60">Results will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function InputField({ label, value, onChange, step, sci, min }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; sci?: boolean; min?: number;
}) {
  const id = `fvp-${label.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-[#869ab8] mb-1">{label}</label>
      <input
        id={id}
        type="number"
        value={sci ? value.toExponential(1) : value}
        step={step}
        min={min ?? 0}
        aria-label={label}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full p-2 rounded-lg bg-[#131b2e] border border-[#1a2333] text-sm"
      />
    </div>
  );
}

function FreqCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? 'bg-amber-50 dark:bg-amber-900/20 border border-[#1a2333]' : 'bg-[#131b2e]'}`}>
      <div className={`text-xl font-bold ${highlight ? 'text-amber-600 dark:text-amber-400' : 'text-[#dae2fd]'}`}>
        {value.toFixed(2)} Hz
      </div>
      <div className="text-xs text-[#869ab8]">{label}</div>
    </div>
  );
}

function ResultRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0 text-sm">
      <span className="text-[#869ab8]">{label}</span>
      <span className={warn ? 'text-red-500 font-semibold' : 'text-[#dae2fd] font-medium tracking-wide'}>{value}</span>
    </div>
  );
}

export default FloorVibrationPage;
