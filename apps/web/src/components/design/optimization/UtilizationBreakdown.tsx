/**
 * UtilizationBreakdown — Horizontal bar chart of all UR values per member
 * with IS 800 clause references. Governing check highlighted.
 */

import React from 'react';

export interface UtilizationData {
  flexure_ur: number;
  shear_ur: number;
  compression_ur: number;
  interaction_ur: number;
  ltb_ur: number;
  deflection_ur: number;
  web_crippling_ur: number;
  connection_adequate: boolean;
  governing_check: string;
  governing_ur: number;
  passed: boolean;
}

const CHECK_META: Record<string, { label: string; clause: string }> = {
  flexure: { label: 'Flexure', clause: 'IS 800 Cl. 8.2.1' },
  shear: { label: 'Shear', clause: 'IS 800 Cl. 8.4' },
  compression: { label: 'Compression', clause: 'IS 800 Cl. 7.1.2' },
  interaction: { label: 'P-M Interaction', clause: 'IS 800 Cl. 9.3' },
  ltb: { label: 'Lateral Torsional Buckling', clause: 'IS 800 Cl. 8.2.2' },
  deflection: { label: 'Deflection', clause: 'IS 800 Table 6' },
  web_crippling: { label: 'Web Crippling', clause: 'IS 800 Cl. 8.7.4' },
};

const barColor = (ur: number): string => {
  if (ur > 1.0) return '#ef4444';  // red — failing
  if (ur > 0.9) return '#f97316';  // orange — critical
  if (ur > 0.7) return '#eab308';  // yellow — moderate
  return '#22c55e';                // green — safe
};

interface Props {
  data: UtilizationData;
  memberLabel: string;
}

export const UtilizationBreakdown: React.FC<Props> = ({ data, memberLabel }) => {
  const checks = [
    { key: 'flexure', ur: data.flexure_ur },
    { key: 'shear', ur: data.shear_ur },
    { key: 'compression', ur: data.compression_ur },
    { key: 'interaction', ur: data.interaction_ur },
    { key: 'ltb', ur: data.ltb_ur },
    { key: 'deflection', ur: data.deflection_ur },
    { key: 'web_crippling', ur: data.web_crippling_ur },
  ];

  return (
    <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-200">{memberLabel}</h4>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium tracking-wide tracking-wide ${
          data.passed ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {data.passed ? 'PASS' : 'FAIL'}
        </span>
      </div>

      <div className="space-y-2">
        {checks.map(({ key, ur }) => {
          const meta = CHECK_META[key];
          const isGoverning = data.governing_check.toLowerCase().includes(key);
          const pct = Math.min(ur * 100, 120);
          return (
            <div key={key} className={`rounded p-1.5 ${isGoverning ? 'bg-slate-800 ring-1 ring-blue-500/50' : ''}`}>
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-xs ${isGoverning ? 'text-blue-300 font-semibold' : 'text-slate-400'}`}>
                  {meta?.label ?? key}
                  {isGoverning && <span className="ml-1.5 text-[10px] text-blue-400">GOVERNING</span>}
                </span>
                <span className="text-xs text-slate-500">{meta?.clause}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor(ur) }}
                  />
                </div>
                <span className="text-xs font-mono w-12 text-right" style={{ color: barColor(ur) }}>
                  {(ur * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Connection adequacy badge */}
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="text-slate-500">Connection:</span>
        <span className={`px-2 py-0.5 rounded ${
          data.connection_adequate ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
        }`}>
          {data.connection_adequate ? 'Adequate' : 'Review Required'}
        </span>
      </div>
    </div>
  );
};

export default UtilizationBreakdown;
