import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { deepBeamDesignEngine } from '../components/structural/DeepBeamDesignEngine';
import { designHighwayBridge } from '../modules/bridge/BridgeDeckDesignEngine';

type ResultCard = {
  passed: boolean;
  utilization: number;
  message: string;
};

type TabKey = 'deep-beam' | 'laced-batten' | 'industrial-roof' | 'bridge-deck' | 'aqueduct';

function normalizeTab(value: string | null): TabKey {
  const allowed: TabKey[] = ['deep-beam', 'laced-batten', 'industrial-roof', 'bridge-deck', 'aqueduct'];
  return allowed.includes(value as TabKey) ? (value as TabKey) : 'deep-beam';
}

function clampUtil(value: number): number {
  if (!Number.isFinite(value)) return 9.99;
  return Math.max(0, value);
}

function renderStatus(result: ResultCard) {
  return (
    <div
      className={`rounded-lg border p-3 ${result.passed ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-rose-300 bg-rose-50 text-rose-800'}`}
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold">{result.passed ? 'PASS' : 'CHECK REQUIRED'} · Utilization {result.utilization.toFixed(3)}</p>
      <p className="text-xs mt-1">{result.message}</p>
    </div>
  );
}

export default function AdvancedStructuralModulesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>(() => normalizeTab(searchParams.get('tab')));

  useEffect(() => {
    const routeTab = normalizeTab(searchParams.get('tab'));
    if (routeTab !== activeTab) {
      setActiveTab(routeTab);
    }
  }, [activeTab, searchParams]);

  const updateTab = (nextTab: TabKey) => {
    setActiveTab(nextTab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', nextTab);
    setSearchParams(nextParams, { replace: true });
  };

  // RCC Deep Beam (conservative quick check)
  const [ln_mm, setLnMm] = useState(2500);
  const [d_mm, setDMm] = useState(700);
  const [bw_mm, setBwMm] = useState(300);
  const [fck_mpa, setFckMpa] = useState(30);
  const [vu_kn, setVuKn] = useState(650);

  const deepBeamResult = useMemo<ResultCard>(() => {
    const engineResult = deepBeamDesignEngine.calculate({
      span: ln_mm,
      depth: d_mm,
      width: bw_mm,
      clearCover: 40,
      fck: fck_mpa,
      fy: 500,
      loadType: 'point',
      // Vu is support reaction; convert to an equivalent central point load W ≈ 2Vu
      factoredLoad: 2 * vu_kn,
      loadPosition: ln_mm / 2,
      supportType: 'simple',
      supportWidth: 300,
      designCode: 'IS456',
    });

    return {
      passed: engineResult.isAdequate,
      utilization: clampUtil(engineResult.utilization),
      message: `${engineResult.message} Governing checks include IS 456 Cl. 29.1/29.3 style deep-beam classification and STM capacity verification.`,
    };
  }, [bw_mm, d_mm, fck_mpa, ln_mm, vu_kn]);

  // Steel laced / battened built-up column quick slenderness screen
  const [kFactor, setKFactor] = useState(1);
  const [length_m, setLengthM] = useState(6);
  const [r_mm, setRMm] = useState(85);
  const [allowableLambda, setAllowableLambda] = useState(180);

  const lacedResult = useMemo<ResultCard>(() => {
    const lambda = (kFactor * length_m * 1000) / Math.max(r_mm, 1e-6);
    const util = clampUtil(lambda / allowableLambda);
    return {
      passed: util <= 1,
      utilization: util,
      message: `Global slenderness λ = ${lambda.toFixed(1)}. Screened against limit ${allowableLambda}. For final design, include IS 800 built-up member provisions (lacing/batten geometry, shear transfer, and effective slenderness checks).`,
    };
  }, [allowableLambda, kFactor, length_m, r_mm]);

  // Industrial roof truss load envelope (IS 875 part 2/3 style combinations)
  const [span_m, setSpanM] = useState(20);
  const [spacing_m, setSpacingM] = useState(6);
  const [dl_knm2, setDlKnm2] = useState(0.6);
  const [ll_knm2, setLlKnm2] = useState(0.75);
  const [wl_knm2, setWlKnm2] = useState(0.9);
  const [memberCapacity_knm, setMemberCapacityKnm] = useState(650);

  const roofResult = useMemo<ResultCard>(() => {
    const wdl = dl_knm2 * spacing_m;
    const wll = ll_knm2 * spacing_m;
    const wwl = wl_knm2 * spacing_m;

    const wu1 = 1.5 * (wdl + wll); // IS 875 LSM combo style
    const wu2 = 1.5 * (wdl + wwl);
    const wu3 = 1.2 * (wdl + wll + wwl);
    const wGov = Math.max(wu1, wu2, wu3);
    const mGov = (wGov * span_m * span_m) / 8;

    const util = clampUtil(mGov / Math.max(memberCapacity_knm, 1e-6));
    return {
      passed: util <= 1,
      utilization: util,
      message: `Governing factored line load = ${wGov.toFixed(2)} kN/m, elastic strip moment M = ${mGov.toFixed(1)} kN·m (simply-supported). Compare with section/member capacity ${memberCapacity_knm.toFixed(1)} kN·m and check uplift/load-reversal detailing separately.`,
    };
  }, [dl_knm2, ll_knm2, memberCapacity_knm, spacing_m, span_m, wl_knm2]);

  // Bridge deck strip design quick check
  const [bridgeSpan_m, setBridgeSpanM] = useState(12);
  const [deckLineLoad_knm, setDeckLineLoadKnm] = useState(95);
  const [deckCapacity_knm, setDeckCapacityKnm] = useState(2100);

  const bridgeResult = useMemo<ResultCard>(() => {
    const m = (deckLineLoad_knm * bridgeSpan_m * bridgeSpan_m) / 8;
    const stripUtil = clampUtil(m / Math.max(deckCapacity_knm, 1e-6));

    const baselineBridge = designHighwayBridge(
      bridgeSpan_m,
      9,
      2,
      bridgeSpan_m < 25 ? 'steel-composite' : 'plate-girder',
    );

    const util = Math.max(stripUtil, clampUtil(baselineBridge.maxUtilization));
    return {
      passed: util <= 1,
      utilization: util,
      message: `Deck strip moment M = ${m.toFixed(1)} kN·m (wL²/8). Bridge baseline engine utilization = ${baselineBridge.maxUtilization.toFixed(3)} (${baselineBridge.criticalCheck}). Finalize with moving-load influence surfaces and code-specific impact factors.`,
    };
  }, [bridgeSpan_m, deckCapacity_knm, deckLineLoad_knm]);

  // Aqueduct rectangular channel sizing via Manning
  const [aqWidth_m, setAqWidthM] = useState(2.2);
  const [aqSlope, setAqSlope] = useState(0.0015);
  const [aqManningN, setAqManningN] = useState(0.015);
  const [aqQreq, setAqQreq] = useState(6);

  const aqueductResult = useMemo<ResultCard>(() => {
    const dischargeAtDepth = (y: number) => {
      const area = aqWidth_m * y;
      const wettedPerimeter = aqWidth_m + 2 * y;
      const r = area / Math.max(wettedPerimeter, 1e-9);
      const v = (1 / aqManningN) * Math.pow(r, 2 / 3) * Math.sqrt(aqSlope);
      return area * v;
    };

    let yLow = 0.05;
    let yHigh = 6;
    for (let i = 0; i < 70; i += 1) {
      const yMid = 0.5 * (yLow + yHigh);
      if (dischargeAtDepth(yMid) < aqQreq) yLow = yMid;
      else yHigh = yMid;
    }
    const yNormal = 0.5 * (yLow + yHigh);
    const qCap = dischargeAtDepth(yNormal);
    const util = clampUtil(aqQreq / Math.max(qCap, 1e-6));

    return {
      passed: util <= 1,
      utilization: util,
      message: `Estimated normal depth yₙ ≈ ${yNormal.toFixed(3)} m for rectangular aqueduct section (Manning). Capacity ≈ ${qCap.toFixed(2)} m³/s vs required ${aqQreq.toFixed(2)} m³/s.`,
    };
  }, [aqManningN, aqQreq, aqSlope, aqWidth_m]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h1 className="text-2xl font-bold text-slate-900">Advanced Structural & Hydraulic Modules</h1>
        <p className="text-sm text-slate-600 mt-1">
          Production-facing preliminary calculators for requested workflows: deep beams, laced/batten columns, industrial roof systems, bridge deck checks, and aqueduct sizing.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ['deep-beam', 'RCC Deep Beam'],
          ['laced-batten', 'Laced/Batten Column'],
          ['industrial-roof', 'Industrial Roof'],
          ['bridge-deck', 'Bridge Deck'],
          ['aqueduct', 'Aqueduct'],
        ] as Array<[TabKey, string]>).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => updateTab(key)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border ${activeTab === key ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'deep-beam' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <p className="text-xs text-slate-500">Reference: ACI 318-19 Cl. 9.9.1.1 (deep beam criterion) and Ch. 23 strut-and-tie framework.</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <LabeledNumber label="Clear span ln (mm)" value={ln_mm} setValue={setLnMm} />
            <LabeledNumber label="Effective depth d (mm)" value={d_mm} setValue={setDMm} />
            <LabeledNumber label="Web width bw (mm)" value={bw_mm} setValue={setBwMm} />
            <LabeledNumber label="Concrete fck (MPa)" value={fck_mpa} setValue={setFckMpa} />
            <LabeledNumber label="Factored shear Vu (kN)" value={vu_kn} setValue={setVuKn} />
          </div>
          {renderStatus(deepBeamResult)}
        </div>
      )}

      {activeTab === 'laced-batten' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <p className="text-xs text-slate-500">Reference: IS 800:2007 built-up compression member provisions (screening using global slenderness).</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <LabeledNumber label="Effective length factor K" value={kFactor} setValue={setKFactor} />
            <LabeledNumber label="Member length L (m)" value={length_m} setValue={setLengthM} />
            <LabeledNumber label="Radius of gyration r (mm)" value={r_mm} setValue={setRMm} />
            <LabeledNumber label="Allowable λ" value={allowableLambda} setValue={setAllowableLambda} />
          </div>
          {renderStatus(lacedResult)}
        </div>
      )}

      {activeTab === 'industrial-roof' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <p className="text-xs text-slate-500">Reference: IS 875 load combinations (LSM-style envelope). Uplift/reversal detailing must be checked separately.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <LabeledNumber label="Truss span (m)" value={span_m} setValue={setSpanM} />
            <LabeledNumber label="Truss spacing (m)" value={spacing_m} setValue={setSpacingM} />
            <LabeledNumber label="Roof DL (kN/m²)" value={dl_knm2} setValue={setDlKnm2} />
            <LabeledNumber label="Roof LL (kN/m²)" value={ll_knm2} setValue={setLlKnm2} />
            <LabeledNumber label="Roof WL (kN/m²)" value={wl_knm2} setValue={setWlKnm2} />
            <LabeledNumber label="Member capacity (kN·m)" value={memberCapacity_knm} setValue={setMemberCapacityKnm} />
          </div>
          {renderStatus(roofResult)}
        </div>
      )}

      {activeTab === 'bridge-deck' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <p className="text-xs text-slate-500">Reference: preliminary strip check. Final bridge rating requires moving load + influence surface envelope.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <LabeledNumber label="Effective span (m)" value={bridgeSpan_m} setValue={setBridgeSpanM} />
            <LabeledNumber label="Factored line load (kN/m)" value={deckLineLoad_knm} setValue={setDeckLineLoadKnm} />
            <LabeledNumber label="Moment capacity (kN·m)" value={deckCapacity_knm} setValue={setDeckCapacityKnm} />
          </div>
          {renderStatus(bridgeResult)}
        </div>
      )}

      {activeTab === 'aqueduct' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <p className="text-xs text-slate-500">Reference: Manning open-channel hydraulics for preliminary aqueduct section sizing.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <LabeledNumber label="Channel width b (m)" value={aqWidth_m} setValue={setAqWidthM} />
            <LabeledNumber label="Bed slope S (m/m)" value={aqSlope} setValue={setAqSlope} />
            <LabeledNumber label="Manning n" value={aqManningN} setValue={setAqManningN} />
            <LabeledNumber label="Required flow Q (m³/s)" value={aqQreq} setValue={setAqQreq} />
          </div>
          {renderStatus(aqueductResult)}
        </div>
      )}
    </div>
  );
}

function LabeledNumber({
  label,
  value,
  setValue,
}: {
  label: string;
  value: number;
  setValue: (value: number) => void;
}) {
  return (
    <label className="text-xs text-slate-600 flex flex-col gap-1">
      {label}
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="h-9 rounded-md border border-slate-300 px-2 text-sm text-slate-900"
      />
    </label>
  );
}
