/**
 * StabilityView — Euler Buckling, P-M Interaction, Modal Estimates, Design Spectrum
 * Extracted from AnalysisResultsDashboard.tsx
 */

import React from "react";
import type { MemberResult, NodeResult } from "./dashboardTypes";
import { formatNumber } from "./dashboardTypes";

interface StabilityViewProps {
  members: MemberResult[];
  nodes: NodeResult[];
}

const StabilityView: React.FC<StabilityViewProps> = React.memo(({ members, nodes }) => {
  return (
    <div key="stability" className="space-y-6 animate-slideUp">
      {/* ── Euler Buckling Check ── */}
      <div>
        <h3 className="text-sm font-medium tracking-wide text-[#869ab8] uppercase tracking-wide mb-3">
          Euler Buckling Check (Elastic Critical Load)
        </h3>
        <div className="overflow-x-auto max-h-[250px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#0b1326]">
              <tr className="border-b border-[#1a2333]">
                <th className="px-3 py-2 text-left text-[#869ab8] text-xs">Member</th>
                <th className="px-3 py-2 text-left text-[#869ab8] text-xs">L (m)</th>
                <th className="px-3 py-2 text-left text-[#869ab8] text-xs">P (kN)</th>
                <th className="px-3 py-2 text-left text-[#869ab8] text-xs">Pcr (kN)</th>
                <th className="px-3 py-2 text-left text-[#869ab8] text-xs">λ (slenderness)</th>
                <th className="px-3 py-2 text-left text-[#869ab8] text-xs">P/Pcr</th>
                <th className="px-3 py-2 text-left text-[#869ab8] text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...members]
                .filter((m) => m.maxAxial > 0.01)
                .sort((a, b) => {
                  const pcrA =
                    a.sectionProps?.I && a.sectionProps.E && a.length > 0
                      ? (Math.PI ** 2 * a.sectionProps.E * a.sectionProps.I) / a.length ** 2
                      : Infinity;
                  const pcrB =
                    b.sectionProps?.I && b.sectionProps.E && b.length > 0
                      ? (Math.PI ** 2 * b.sectionProps.E * b.sectionProps.I) / b.length ** 2
                      : Infinity;
                  return b.maxAxial / pcrB - a.maxAxial / pcrA;
                })
                .map((m) => {
                  const sp = m.sectionProps;
                  const E_kNm2 = sp?.E ?? 200000000;
                  const I_m4 = sp?.I ?? 1e-4;
                  const A_m2 = sp?.A ?? 0.01;
                  const L = m.length || 1;
                  const Pcr = (Math.PI ** 2 * E_kNm2 * I_m4) / L ** 2;
                  const r = Math.sqrt(I_m4 / A_m2);
                  const slenderness = L / r;
                  const ratio = m.maxAxial / Pcr;
                  const pass = ratio < 1.0;
                  return (
                    <tr key={m.id} className="border-b border-[#1a2333] hover:bg-slate-200/50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-1.5 font-medium tracking-wide text-[#dae2fd] text-xs">M{m.id}</td>
                      <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300 text-xs">{L.toFixed(2)}</td>
                      <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300 text-xs">{formatNumber(m.maxAxial)}</td>
                      <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300 text-xs">{formatNumber(Pcr)}</td>
                      <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300 text-xs">{slenderness.toFixed(1)}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">
                        <span className={ratio > 0.8 ? "text-red-400" : ratio > 0.5 ? "text-yellow-400" : "text-green-400"}>
                          {ratio.toFixed(3)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-xs">
                        <span className={`px-2 py-0.5 rounded ${pass ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                          {pass ? "SAFE" : "BUCKLE"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {members.filter((m) => m.maxAxial > 0.01).length === 0 && (
            <div className="text-sm text-slate-500 p-4 text-center">
              No compression members — buckling check not applicable.
            </div>
          )}
        </div>
      </div>

      {/* ── P-M Interaction Diagram ── */}
      <div>
        <h3 className="text-sm font-medium tracking-wide text-[#869ab8] uppercase tracking-wide mb-3">
          P-M Interaction — Demand vs Capacity
        </h3>
        <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-[#1a2333] p-4">
          {(() => {
            const critical = [...members]
              .filter((m) => m.maxAxial > 0.01 || m.maxMoment > 0.01)
              .sort((a, b) => b.utilization - a.utilization)
              .slice(0, 10);

            const refMember = critical[0] || members[0];
            const sp = refMember?.sectionProps;
            const A = sp?.A ?? 0.01;
            const I_m4 = sp?.I ?? 1e-4;
            const fy = sp?.fy ?? 250;
            const c = Math.sqrt((12 * I_m4) / A) / 2 || 0.15;
            const Pcap = fy * A * 1000;
            const Zcap = I_m4 / c;
            const Mcap = fy * Zcap * 1000;

            return (
              <div className="space-y-3">
                <svg viewBox="0 0 320 240" className="w-full max-w-lg mx-auto max-h-[240px]">
                  <defs>
                    <pattern id="grid" width="32" height="24" patternUnits="userSpaceOnUse">
                      <path d="M 32 0 L 0 0 0 24" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="320" height="240" fill="url(#grid)" />
                  <line x1="40" y1="220" x2="300" y2="220" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                  <line x1="40" y1="220" x2="40" y2="10" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                  <text x="170" y="238" fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="middle">M / Mcap</text>
                  <text x="12" y="120" fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="middle" transform="rotate(-90,12,120)">P / Pcap</text>
                  <polygon points="40,220 300,220 300,24.4 40,24.4" fill="rgba(34,197,94,0.08)" stroke="none" />
                  <path
                    d={(() => {
                      const pts: string[] = [];
                      for (let i = 0; i <= 40; i++) {
                        const mRatio = i / 40;
                        const pRatio = Math.max(0, 1 - Math.pow(mRatio, 1.2));
                        const x = 40 + mRatio * 260;
                        const y = 220 - pRatio * 196;
                        pts.push(`${x},${y}`);
                      }
                      return `M ${pts.join(" L ")}`;
                    })()}
                    fill="none" stroke="rgba(34,197,94,0.7)" strokeWidth="2" strokeDasharray="4,3"
                  />
                  <text x="240" y="40" fill="rgba(34,197,94,0.6)" fontSize="8">Capacity envelope</text>
                  <line x1="40" y1="24.4" x2="300" y2="220" stroke="rgba(59,130,246,0.5)" strokeWidth="1" strokeDasharray="3,3" />
                  <text x="180" y="100" fill="rgba(59,130,246,0.5)" fontSize="8" transform="rotate(-37,180,100)">Linear (H1-1a)</text>
                  {critical.map((m) => {
                    const mRatio = Mcap > 0 ? Math.min(m.maxMoment / Mcap, 1.5) : 0;
                    const pRatio = Pcap > 0 ? Math.min(m.maxAxial / Pcap, 1.5) : 0;
                    const x = 40 + (mRatio / 1.5) * 260;
                    const y = 220 - (pRatio / 1.5) * 196;
                    const interaction = mRatio + pRatio;
                    const color = interaction > 1 ? "#ef4444" : interaction > 0.8 ? "#eab308" : "#22c55e";
                    return (
                      <g key={m.id}>
                        <circle cx={x} cy={y} r={4} fill={color} stroke="white" strokeWidth="0.8" />
                        <text x={x + 6} y={y - 4} fill="white" fontSize="7">M{m.id}</text>
                      </g>
                    );
                  })}
                  <text x="40" y="16" fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="middle">1.0</text>
                  <text x="300" y="232" fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="middle">1.0</text>
                  <text x="170" y="232" fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="middle">0.5</text>
                  <text x="40" y="122" fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="end">0.5</text>
                </svg>
                <div className="flex items-center justify-center gap-4 text-xs text-[#869ab8]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Safe</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Warning (&gt;0.8)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Exceeds (&gt;1.0)</span>
                </div>
                <div className="text-xs text-slate-500 text-center">
                  Ref capacity: Pcap = {formatNumber(Pcap)} kN | Mcap = {formatNumber(Mcap)} kNm (fy={fy} MPa, A={(A * 1e4).toFixed(1)} cm², I={I_m4.toExponential(2)} m⁴)
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Approximate Natural Frequency Estimates ── */}
      <div>
        <h3 className="text-sm font-medium tracking-wide text-[#869ab8] uppercase tracking-wide mb-3">
          Approximate Natural Frequency Estimates
        </h3>
        <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-[#1a2333] p-4">
          {(() => {
            const freqs = members
              .map((m) => {
                const sp = m.sectionProps;
                const E = sp?.E ?? 200000000;
                const I_m4 = sp?.I ?? 1e-4;
                const A = sp?.A ?? 0.01;
                const L = m.length || 1;
                const rho = 7850;
                const massPerLength = rho * A;
                const EI_Nm2 = E * I_m4 * 1000;
                const f1 = (Math.PI / (2 * L * L)) * Math.sqrt(EI_Nm2 / massPerLength);
                return { id: m.id, length: L, f1, T: 1 / f1, sectionType: m.sectionType };
              })
              .sort((a, b) => a.f1 - b.f1);

            const lowest = freqs[0];
            const storyLevels = new Set(nodes.map((n) => Math.round(n.y * 10) / 10));
            const numStories = Math.max(storyLevels.size - 1, 1);
            const Tapprox = 0.1 * numStories;

            return (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-[#0b1326] rounded-lg">
                    <div className="text-[10px] text-slate-500 uppercase">Lowest Member f₁</div>
                    <div className="text-xl font-bold font-mono text-blue-400">{lowest ? lowest.f1.toFixed(2) : "—"}</div>
                    <div className="text-xs text-[#869ab8]">Hz (T={lowest ? lowest.T.toFixed(3) : "—"}s)</div>
                  </div>
                  <div className="text-center p-3 bg-[#0b1326] rounded-lg">
                    <div className="text-[10px] text-slate-500 uppercase">Est. Building Period</div>
                    <div className="text-xl font-bold font-mono text-purple-400">{Tapprox.toFixed(2)}</div>
                    <div className="text-xs text-[#869ab8]">sec (T≈0.1N, N={numStories})</div>
                  </div>
                  <div className="text-center p-3 bg-[#0b1326] rounded-lg">
                    <div className="text-[10px] text-slate-500 uppercase"># Members Analyzed</div>
                    <div className="text-xl font-bold font-mono text-cyan-400">{members.length}</div>
                    <div className="text-xs text-[#869ab8]">beam approximation</div>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[150px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[#0b1326]">
                      <tr className="border-b border-[#1a2333]">
                        <th className="px-3 py-1.5 text-left text-[#869ab8] text-xs">Member</th>
                        <th className="px-3 py-1.5 text-left text-[#869ab8] text-xs">Section</th>
                        <th className="px-3 py-1.5 text-left text-[#869ab8] text-xs">Length (m)</th>
                        <th className="px-3 py-1.5 text-left text-[#869ab8] text-xs">f₁ (Hz)</th>
                        <th className="px-3 py-1.5 text-left text-[#869ab8] text-xs">T (sec)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {freqs.slice(0, 8).map((f) => (
                        <tr key={f.id} className="border-b border-[#1a2333]">
                          <td className="px-3 py-1 font-medium tracking-wide text-[#dae2fd] text-xs">M{f.id}</td>
                          <td className="px-3 py-1 text-xs text-[#869ab8]">{f.sectionType || "—"}</td>
                          <td className="px-3 py-1 font-mono text-slate-600 dark:text-slate-300 text-xs">{f.length.toFixed(2)}</td>
                          <td className="px-3 py-1 font-mono text-blue-300 text-xs">{f.f1.toFixed(2)}</td>
                          <td className="px-3 py-1 font-mono text-slate-600 dark:text-slate-300 text-xs">{f.T.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-[10px] text-slate-500 text-center">
                  Note: These are beam-element approximations (f₁ = π/(2L²)√(EI/ρA)). Full eigenvalue modal analysis requires the global stiffness/mass matrices.
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Code Design Spectrum ── */}
      <div>
        <h3 className="text-sm font-medium tracking-wide text-[#869ab8] uppercase tracking-wide mb-3">
          Code Design Response Spectrum (Sa/g vs T)
        </h3>
        <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-[#1a2333] p-4">
          <svg viewBox="0 0 400 200" className="w-full max-h-[200px]">
            <defs>
              <pattern id="specGrid" width="40" height="20" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="400" height="200" fill="url(#specGrid)" />
            <line x1="50" y1="180" x2="380" y2="180" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            <line x1="50" y1="180" x2="50" y2="10" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
            <text x="215" y="198" fill="rgba(255,255,255,0.5)" fontSize="9" textAnchor="middle">Period T (sec)</text>
            <text x="14" y="100" fill="rgba(255,255,255,0.5)" fontSize="9" textAnchor="middle" transform="rotate(-90,14,100)">Sa/g</text>
            {[0, 0.5, 1, 2, 3, 4].map((t) => {
              const x = 50 + (t / 4) * 330;
              return (<text key={t} x={x} y={192} fill="rgba(255,255,255,0.4)" fontSize="7" textAnchor="middle">{t}</text>);
            })}
            {[0, 0.5, 1.0, 1.5, 2.0, 2.5].map((v) => {
              const y = 180 - (v / 2.5) * 170;
              return (<text key={v} x="46" y={y + 3} fill="rgba(255,255,255,0.4)" fontSize="7" textAnchor="end">{v}</text>);
            })}
            {/* IS 1893:2016 */}
            <path
              d={(() => {
                const pts: string[] = [];
                for (let i = 0; i <= 80; i++) {
                  const T = (i / 80) * 4;
                  let Sa: number;
                  if (T <= 0.1) Sa = 1 + 15 * T;
                  else if (T <= 0.55) Sa = 2.5;
                  else Sa = 1.36 / T;
                  const x = 50 + (T / 4) * 330;
                  const y = 180 - (Sa / 2.5) * 170;
                  pts.push(`${x},${Math.max(y, 10)}`);
                }
                return `M ${pts.join(" L ")}`;
              })()}
              fill="none" stroke="#f59e0b" strokeWidth="1.5"
            />
            <text x="260" y="55" fill="#f59e0b" fontSize="7">IS 1893 (Zone IV, Soil II)</text>
            {/* ASCE 7-22 */}
            <path
              d={(() => {
                const SDS = 1.0, SD1 = 0.5, TL = 3.0;
                const T0 = (0.2 * SD1) / SDS;
                const Ts = SD1 / SDS;
                const pts: string[] = [];
                for (let i = 0; i <= 80; i++) {
                  const T = (i / 80) * 4;
                  let Sa: number;
                  if (T < T0) Sa = SDS * (0.4 + (0.6 * T) / T0);
                  else if (T <= Ts) Sa = SDS;
                  else if (T <= TL) Sa = SD1 / T;
                  else Sa = (SD1 * TL) / (T * T);
                  const x = 50 + (T / 4) * 330;
                  const y = 180 - (Sa / 2.5) * 170;
                  pts.push(`${x},${Math.max(y, 10)}`);
                }
                return `M ${pts.join(" L ")}`;
              })()}
              fill="none" stroke="#3b82f6" strokeWidth="1.5"
            />
            <text x="260" y="70" fill="#3b82f6" fontSize="7">ASCE 7-22 (SDS=1.0, SD1=0.5)</text>
            {/* Eurocode 8 */}
            <path
              d={(() => {
                const ag = 0.25, S = 1.2, TB = 0.15, TC = 0.5, TD = 2.0;
                const pts: string[] = [];
                for (let i = 0; i <= 80; i++) {
                  const T = (i / 80) * 4;
                  let Sa: number;
                  if (T < TB) Sa = ag * S * (1 + (T / TB) * (2.5 - 1));
                  else if (T <= TC) Sa = ag * S * 2.5;
                  else if (T <= TD) Sa = (ag * S * 2.5 * TC) / T;
                  else Sa = (ag * S * 2.5 * TC * TD) / (T * T);
                  const x = 50 + (T / 4) * 330;
                  const y = 180 - (Sa / 2.5) * 170;
                  pts.push(`${x},${Math.max(y, 10)}`);
                }
                return `M ${pts.join(" L ")}`;
              })()}
              fill="none" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="4,2"
            />
            <text x="260" y="85" fill="#a855f7" fontSize="7">EC8 Type 1 (ag=0.25g, Soil B)</text>
          </svg>
          <div className="text-[10px] text-slate-500 text-center mt-2">
            Standard design spectra for reference. Actual spectrum parameters should be set per project site conditions.
          </div>
        </div>
      </div>
    </div>
  );
});

StabilityView.displayName = "StabilityView";

export default StabilityView;
