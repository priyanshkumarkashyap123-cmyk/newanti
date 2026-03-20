/**
 * RCBeamTab — RC Beam design tab with member sidebar, parameter inputs,
 * flexure/shear design results, and cross-section SVG.
 * Extracted from PostProcessingDesignStudio for modularity.
 */

import React, { FC, useState, useMemo } from "react";
import { Building2 } from "lucide-react";
import type { MemberDesignRow } from "./postProcessingTypes";
import RCBeamCrossSection from "./RCBeamCrossSection";
import {
  RCBeamDesigner,
  type BeamDesignResult,
  type BeamInputs,
} from "../../utils/RCBeamDesigner";

interface RCBeamTabProps {
  rows: MemberDesignRow[];
  selectedId: string | null;
  onSelectMember: (id: string) => void;
}

const RCBeamTab: FC<RCBeamTabProps> = ({
  rows,
  selectedId,
  onSelectMember,
}) => {
  const concreteRows = useMemo(
    () => rows.filter((r) => r.materialType === "concrete"),
    [rows],
  );
  const [designCode, setDesignCode] = useState<"IS456" | "ACI318">("IS456");
  const [fck, setFck] = useState(25);
  const [fy, setFy] = useState(415);
  const [cover, setCover] = useState(40);
  const [beamB, setBeamB] = useState(300);
  const [beamD, setBeamD] = useState(500);

  const activeMember =
    concreteRows.find((r) => r.id === selectedId) ?? concreteRows[0];

  const rcResult = useMemo((): BeamDesignResult | null => {
    if (!activeMember) return null;
    const b = beamB;
    const d = beamD - cover - 25; // effective depth
    const inputs: BeamInputs = {
      Mu: Math.abs(activeMember.maxMomentZ),
      Vu: Math.abs(activeMember.maxShearY),
      b,
      d,
      fc: fck,
      fy,
      cover,
      units: "SI",
    };
    try {
      return RCBeamDesigner.design(inputs);
    } catch {
      return null;
    }
  }, [activeMember, fck, fy, cover, designCode, beamB, beamD]);

  if (concreteRows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <div className="text-center space-y-3 max-w-xs">
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-100/60 dark:bg-slate-800/60 flex items-center justify-center">
            <Building2 className="w-8 h-8 text-slate-500 opacity-50" />
          </div>
          <p className="text-sm font-medium tracking-wide tracking-wide text-[#869ab8]">No Concrete Members Found</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            This model does not contain any members with concrete material properties.
            Assign a concrete material type (e.g., M20, M25) to one or more members to enable RC beam design.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Member Sidebar */}
      <div className="w-56 border-r border-slate-300/60 dark:border-slate-700/60 bg-slate-100/40 dark:bg-slate-800/40 flex flex-col">
        <div className="px-3 py-2 border-b border-slate-300/40 dark:border-slate-700/40 text-xs font-semibold text-[#869ab8] uppercase tracking-wider">
          Concrete Members ({concreteRows.length})
        </div>
        <div className="flex-1 overflow-auto scroll-smooth">
          {concreteRows.map((r) => (
            <button type="button"
              key={r.id}
              onClick={() => onSelectMember(r.id)}
              className={`w-full text-left px-3 py-2 text-sm border-b border-slate-200/60 dark:border-slate-800/60 transition-colors ${
                r.id === activeMember?.id
                  ? "bg-blue-900/30 text-blue-300 border-l-2 border-l-blue-400"
                  : "text-[#adc6ff] hover:bg-slate-200/40 dark:hover:bg-slate-700/40 border-l-2 border-l-transparent"
              }`}
            >
              <div className="font-mono font-medium tracking-wide tracking-wide truncate">{r.label}</div>
              <div className="text-xs text-slate-500 truncate">
                M = {Math.abs(r.maxMomentZ).toFixed(1)} kN·m, V ={" "}
                {Math.abs(r.maxShearY).toFixed(1)} kN
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Design Panel */}
      <div className="flex-1 overflow-auto p-5 space-y-5">
        {activeMember && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  RC Beam Design — Member {activeMember.label}
                </h3>
                <p className="text-xs text-[#869ab8]">
                  L = {activeMember.length.toFixed(2)} m
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={designCode}
                  onChange={(e) => setDesignCode(e.target.value as any)}
                  className="text-sm bg-[#131b2e] border border-[#1a2333] rounded px-2 py-1 text-[#adc6ff]"
                >
                  <option value="IS456">IS 456:2000</option>
                  <option value="ACI318">ACI 318-19</option>
                </select>
              </div>
            </div>

            {/* Input Parameters */}
            <div className="bg-slate-100/60 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-300/40 dark:border-slate-700/40">
              <h4 className="text-xs font-semibold text-[#869ab8] uppercase tracking-wider mb-3">
                Material & Section Parameters
              </h4>
              <div className="grid grid-cols-5 gap-4">
                <div>
                  <label className="text-xs text-slate-500">
                    f'c / fck (MPa)
                  </label>
                  <input
                    type="number"
                    value={fck}
                    min={15}
                    max={100}
                    onChange={(e) => setFck(+e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 text-sm bg-[#0b1326] border border-[#1a2333] rounded text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">fy (MPa)</label>
                  <input
                    type="number"
                    value={fy}
                    min={250}
                    max={600}
                    onChange={(e) => setFy(+e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 text-sm bg-[#0b1326] border border-[#1a2333] rounded text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">
                    Clear cover (mm)
                  </label>
                  <input
                    type="number"
                    value={cover}
                    min={20}
                    max={75}
                    onChange={(e) => setCover(+e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 text-sm bg-[#0b1326] border border-[#1a2333] rounded text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Width b (mm)</label>
                  <input
                    type="number"
                    value={beamB}
                    min={150}
                    max={1000}
                    onChange={(e) => setBeamB(+e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 text-sm bg-[#0b1326] border border-[#1a2333] rounded text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">
                    Total Depth D (mm)
                  </label>
                  <input
                    type="number"
                    value={beamD}
                    min={200}
                    max={2000}
                    onChange={(e) => setBeamD(+e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 text-sm bg-[#0b1326] border border-[#1a2333] rounded text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Applied Forces */}
            <div className="bg-slate-100/60 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-300/40 dark:border-slate-700/40">
              <h4 className="text-xs font-semibold text-[#869ab8] uppercase tracking-wider mb-3">
                Applied Forces (Factored)
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#0b1326] rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500 mb-1">Mu (Moment)</div>
                  <div className="text-xl font-bold font-mono text-purple-400">
                    {Math.abs(activeMember.maxMomentZ).toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500">kN·m</div>
                </div>
                <div className="bg-[#0b1326] rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500 mb-1">Vu (Shear)</div>
                  <div className="text-xl font-bold font-mono text-blue-400">
                    {Math.abs(activeMember.maxShearY).toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500">kN</div>
                </div>
                <div className="bg-[#0b1326] rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500 mb-1">Nu (Axial)</div>
                  <div
                    className={`text-xl font-bold font-mono ${activeMember.maxAxial >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {activeMember.maxAxial.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500">kN</div>
                </div>
              </div>
            </div>

            {rcResult && (
              <>
                {/* Flexure Design Results */}
                <div className="bg-slate-100/60 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-300/40 dark:border-slate-700/40">
                  <h4 className="text-xs font-semibold text-[#869ab8] uppercase tracking-wider mb-3 flex items-center gap-2">
                    Flexure Design
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        rcResult.flexure.status === "OK"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {rcResult.flexure.status}
                    </span>
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#869ab8]">
                          A<sub>s,required</sub>
                        </span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {rcResult.flexure.As_required.toFixed(1)} mm²
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#869ab8]">
                          A<sub>s,provided</sub>
                        </span>
                        <span className="font-mono text-blue-400 font-bold">
                          {rcResult.flexure.As_provided.toFixed(1)} mm²
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#869ab8]">
                          A<sub>s,min</sub>
                        </span>
                        <span className="font-mono text-[#adc6ff]">
                          {rcResult.flexure.As_min.toFixed(1)} mm²
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#869ab8]">
                          A<sub>s,max</sub>
                        </span>
                        <span className="font-mono text-[#adc6ff]">
                          {rcResult.flexure.As_max.toFixed(1)} mm²
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#869ab8]">Reinforcement</span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {rcResult.flexure.numBars} – Ø
                          {rcResult.flexure.barSize}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#869ab8]">Steel ratio ρ</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {(rcResult.flexure.rho * 100).toFixed(3)} %
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#869ab8]">N.A. depth c</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {rcResult.flexure.c.toFixed(1)} mm
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#869ab8]">Comp. block a</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {rcResult.flexure.a.toFixed(1)} mm
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm border-t border-slate-300/40 dark:border-slate-700/40 pt-2">
                        <span className="text-[#869ab8]">
                          φM<sub>n</sub> (Capacity)
                        </span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {rcResult.flexure.phi_Mn.toFixed(2)} kN·m
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#869ab8]">
                          M<sub>u</sub> / φM<sub>n</sub>
                        </span>
                        <span
                          className={`font-mono font-bold ${Math.abs(activeMember.maxMomentZ) / rcResult.flexure.phi_Mn <= 1 ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {rcResult.flexure.phi_Mn > 0
                            ? (
                                (Math.abs(activeMember.maxMomentZ) /
                                  rcResult.flexure.phi_Mn) *
                                100
                              ).toFixed(1) + "%"
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                    {/* Cross-section SVG */}
                    <div className="flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 rounded-lg p-2">
                      <RCBeamCrossSection
                        b={beamB}
                        d={beamD}
                        cover={cover}
                        mainBars={{
                          count: rcResult.flexure.numBars,
                          diameter: parseInt(rcResult.flexure.barSize) || 16,
                        }}
                        stirrupDia={parseInt(rcResult.shear.stirrupSize) || 8}
                        topBars={{ count: 2, diameter: 12 }}
                      />
                      <div className="text-xs text-slate-500 mt-1 text-center">
                        Cross-Section Detail
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shear Design Results */}
                <div className="bg-slate-100/60 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-300/40 dark:border-slate-700/40">
                  <h4 className="text-xs font-semibold text-[#869ab8] uppercase tracking-wider mb-3 flex items-center gap-2">
                    Shear Design
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        rcResult.shear.status === "OK" ||
                        rcResult.shear.status === "MIN_STIRRUPS"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {rcResult.shear.status}
                    </span>
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#869ab8]">
                          V<sub>u</sub> (Applied)
                        </span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {rcResult.shear.Vu.toFixed(2)} kN
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#869ab8]">
                          φV<sub>c</sub> (Concrete)
                        </span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {rcResult.shear.phi_Vc.toFixed(2)} kN
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#869ab8]">
                          V<sub>s,required</sub>
                        </span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {rcResult.shear.Vs_required.toFixed(2)} kN
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm border-t border-slate-300/40 dark:border-slate-700/40 pt-2">
                        <span className="text-[#869ab8]">Stirrup Size</span>
                        <span className="font-mono text-blue-400 font-bold">
                          Ø{rcResult.shear.stirrupSize}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#869ab8]">Spacing</span>
                        <span className="font-mono text-blue-400 font-bold">
                          {rcResult.shear.spacing} mm c/c
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#869ab8]">Max Spacing</span>
                        <span className="font-mono text-[#adc6ff]">
                          {rcResult.shear.maxSpacing} mm
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#869ab8]">No. of Legs</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {rcResult.shear.numLegs}
                        </span>
                      </div>
                    </div>
                    {/* Shear capacity visual */}
                    <div className="bg-white/50 dark:bg-slate-900/50 rounded-lg p-4 flex flex-col justify-center">
                      <div className="text-xs text-[#869ab8] mb-2 uppercase tracking-wider">
                        Shear Capacity Breakdown
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs text-[#869ab8] mb-1">
                            <span>Concrete (φVc)</span>
                            <span className="font-mono">
                              {rcResult.shear.phi_Vc.toFixed(1)} kN
                            </span>
                          </div>
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cyan-500 rounded-full"
                              style={{
                                width: `${Math.min((rcResult.shear.phi_Vc / Math.max(rcResult.shear.Vu, 0.01)) * 100, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-[#869ab8] mb-1">
                            <span>Steel (φVs)</span>
                            <span className="font-mono">
                              {(rcResult.shear.Vs_required * 0.75).toFixed(1)}{" "}
                              kN
                            </span>
                          </div>
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{
                                width: `${Math.min(((rcResult.shear.Vs_required * 0.75) / Math.max(rcResult.shear.Vu, 0.01)) * 100, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="border-t border-slate-300/60 dark:border-slate-700/60 pt-2">
                          <div className="flex justify-between text-xs text-[#869ab8] mb-1">
                            <span>Demand (Vu)</span>
                            <span className="font-mono text-amber-400">
                              {rcResult.shear.Vu.toFixed(1)} kN
                            </span>
                          </div>
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500/60 rounded-full w-full"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reinforcement Summary (IS 456 / ACI notation) */}
                <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">
                    Reinforcement Summary
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">
                        IS 456 Notation
                      </div>
                      <div className="font-mono text-slate-900 dark:text-slate-100 bg-slate-50/60 dark:bg-slate-900/60 rounded px-3 py-2">
                        {rcResult.summaryIS}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">
                        ACI Notation
                      </div>
                      <div className="font-mono text-slate-900 dark:text-slate-100 bg-slate-50/60 dark:bg-slate-900/60 rounded px-3 py-2">
                        {rcResult.summaryACI}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm font-mono text-emerald-400 bg-slate-50/60 dark:bg-slate-900/60 rounded px-3 py-2">
                    {rcResult.reinforcementString}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

RCBeamTab.displayName = "RCBeamTab";

export default React.memo(RCBeamTab);
