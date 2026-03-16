import React, { useMemo, useState } from 'react';

type GeotechCase = {
  id: string;
  label: string;
  endpoint: string;
  sample: Record<string, unknown>;
  description: string;
};

const CASES: GeotechCase[] = [
  {
    id: 'spt',
    label: 'SPT Correlation',
    endpoint: '/api/design/geotech/spt-correlation',
    description: 'Estimate φ, Es, and Dr from corrected SPT N60 for sandy soils.',
    sample: { n60: 20, fines_percent: 10, groundwater_depth_m: 2.5 },
  },
  {
    id: 'infinite_slope',
    label: 'Infinite Slope Stability',
    endpoint: '/api/design/geotech/slope/infinite',
    description: 'Check drained infinite slope factor of safety with ru ratio.',
    sample: {
      slope_angle_deg: 26,
      friction_angle_deg: 34,
      cohesion_kpa: 8,
      unit_weight_kn_m3: 19,
      depth_m: 2.5,
      ru: 0.2,
      required_fs: 1.3,
    },
  },
  {
    id: 'bearing_capacity',
    label: 'Bearing Capacity (Terzaghi Strip)',
    endpoint: '/api/design/geotech/foundation/bearing-capacity',
    description: 'Compute ultimate and allowable strip footing pressure.',
    sample: {
      cohesion_kpa: 0,
      friction_angle_deg: 32,
      unit_weight_kn_m3: 18,
      footing_width_m: 2,
      embedment_depth_m: 1.5,
      applied_pressure_kpa: 220,
      safety_factor: 3,
    },
  },
  {
    id: 'retaining_wall',
    label: 'Retaining Wall Stability',
    endpoint: '/api/design/geotech/retaining-wall/stability',
    description: 'External stability checks: sliding, overturning, and bearing.',
    sample: {
      wall_height_m: 5,
      backfill_unit_weight_kn_m3: 18,
      backfill_friction_angle_deg: 32,
      surcharge_kpa: 10,
      base_width_m: 3.5,
      total_vertical_load_kn_per_m: 320,
      stabilizing_moment_knm_per_m: 430,
      base_friction_coeff: 0.55,
      allowable_bearing_kpa: 260,
      required_fs_overturning: 1.5,
      required_fs_sliding: 1.5,
    },
  },
  {
    id: 'settlement',
    label: 'Consolidation Settlement',
    endpoint: '/api/design/geotech/settlement/consolidation',
    description: 'Estimate primary consolidation settlement and time-rate.',
    sample: {
      layer_thickness_m: 4,
      initial_void_ratio: 0.9,
      compression_index: 0.28,
      initial_effective_stress_kpa: 100,
      stress_increment_kpa: 60,
      drainage_path_m: 2,
      cv_m2_per_year: 1.2,
      time_years: 2,
      required_max_settlement_mm: 75,
    },
  },
  {
    id: 'liquefaction',
    label: 'Liquefaction Screening',
    endpoint: '/api/design/geotech/liquefaction/screening',
    description: 'SPT-based CSR/CRR screening with magnitude scaling.',
    sample: {
      magnitude_mw: 7.5,
      pga_g: 0.2,
      depth_m: 7,
      total_stress_kpa: 130,
      effective_stress_kpa: 75,
      n1_60cs: 16,
      rd: 0.9,
      required_fs: 1.1,
    },
  },
  {
    id: 'pile_axial',
    label: 'Pile Axial Capacity',
    endpoint: '/api/design/geotech/foundation/pile-axial-capacity',
    description: 'Static axial compressive capacity from shaft + base resistance.',
    sample: {
      diameter_m: 0.6,
      length_m: 18,
      unit_skin_friction_kpa: 55,
      unit_end_bearing_kpa: 1800,
      applied_load_kn: 900,
      safety_factor: 2.5,
    },
  },
  {
    id: 'earth_rankine',
    label: 'Earth Pressure (Rankine)',
    endpoint: '/api/design/geotech/earth-pressure/rankine',
    description: 'Compute Ka, K0, Kp and thrust resultants for level backfill.',
    sample: {
      friction_angle_deg: 30,
      unit_weight_kn_m3: 18,
      retained_height_m: 5,
      surcharge_kpa: 10,
    },
  },
  {
    id: 'earth_seismic',
    label: 'Earth Pressure (Seismic)',
    endpoint: '/api/design/geotech/earth-pressure/seismic',
    description: 'Pseudo-static seismic increment and combined resultant.',
    sample: {
      unit_weight_kn_m3: 18,
      retained_height_m: 6,
      kh: 0.15,
      kv: 0,
      static_active_thrust_kn_per_m: 120,
    },
  },
];

export default function GeotechnicalDesignPage() {
  const [selectedId, setSelectedId] = useState(CASES[0].id);
  const selected = useMemo(
    () => CASES.find((c) => c.id === selectedId) ?? CASES[0],
    [selectedId],
  );

  const [payloadText, setPayloadText] = useState(
    JSON.stringify(CASES[0].sample, null, 2),
  );
  const [resultText, setResultText] = useState('');
  const [errorText, setErrorText] = useState('');
  const [loading, setLoading] = useState(false);

  const onCaseChange = (id: string) => {
    const item = CASES.find((c) => c.id === id);
    if (!item) return;
    setSelectedId(item.id);
    setPayloadText(JSON.stringify(item.sample, null, 2));
    setResultText('');
    setErrorText('');
  };

  const runCheck = async () => {
    setLoading(true);
    setErrorText('');
    setResultText('');

    try {
      let payload: unknown;
      try {
        payload = JSON.parse(payloadText);
      } catch {
        throw new Error('Invalid JSON payload. Please fix JSON and retry.');
      }

      const response = await fetch(selected.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok || json?.success === false) {
        const firstDetail = Array.isArray((json as { details?: unknown }).details)
          ? (json as { details: Array<{ message?: string; path?: string }> }).details[0]
          : undefined;
        const detailMsg = firstDetail?.path
          ? `${firstDetail.path}: ${firstDetail.message ?? 'invalid value'}`
          : firstDetail?.message;
        const msg = detailMsg || json?.error || `Request failed with status ${response.status}`;
        throw new Error(msg);
      }

      const display = json?.result ?? json;
      setResultText(JSON.stringify(display, null, 2));
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">Geotechnical Design Center</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Phase-based geotech checks powered by Rust API endpoints. All units are SI (kN, m, kPa, MPa).
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <aside className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3">Design Checks</h2>
            <div className="space-y-2">
              {CASES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onCaseChange(item.id)}
                  className={`w-full text-left rounded-lg px-3 py-2 border transition ${
                    selected.id === item.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-blue-400'
                  }`}
                >
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {item.endpoint}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <h2 className="text-base font-semibold">{selected.label}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{selected.description}</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Request Payload (JSON)</h3>
                <button
                  type="button"
                  onClick={() => setPayloadText(JSON.stringify(selected.sample, null, 2))}
                  className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 hover:border-blue-500"
                >
                  Reset Sample
                </button>
              </div>
              <textarea
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                rows={16}
                className="w-full font-mono text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={runCheck}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium"
                >
                  {loading ? 'Running…' : 'Run Check'}
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Endpoint: <code>{selected.endpoint}</code>
                </span>
              </div>
            </div>

            {(errorText || resultText) && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-2">Response</h3>
                {errorText ? (
                  <div className="text-sm text-red-600 dark:text-red-400">{errorText}</div>
                ) : (
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
                    {resultText}
                  </pre>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
