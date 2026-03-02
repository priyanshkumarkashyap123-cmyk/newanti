/**
 * DetailedDesignPanel.tsx — Full Section Detail Design Panel
 *
 * Provides actual engineering DETAILING output:
 * - RC Beam: rebar layout, bar selection, curtailment, crack width, deflection
 * - RC Slab: one-way/two-way, main/distribution steel, temperature steel
 * - RC Column: interaction diagram, biaxial check, tie spacing, lap splices
 * - Steel: section classification, LTB, web buckling, stiffener needs
 *
 * This is what STAAD Pro & ETABS provide that was previously missing.
 */

import React from 'react';
import { FC, useState, useMemo, useCallback, Fragment } from "react";
import {
  Ruler,
  BarChart3,
  ArrowDown,
  Columns3,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Square,
} from "lucide-react";
import {
  designRCBeamDetailed,
  designRCSlabDetailed,
  designRCColumnDetailed,
  designSteelSectionDetailed,
  type RCBeamInput,
  type RCSlabInput,
  type RCColumnInput,
  type SteelSectionInput,
  type RCBeamDetailedResult,
  type RCSlabDetailedResult,
  type RCColumnDetailedResult,
  type SteelDetailedResult,
  REBAR_SIZES,
} from "../engines/DetailedSectionDesign";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';

interface DetailedDesignPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type DesignMode = "rc_beam" | "rc_slab" | "rc_column" | "steel";

const TABS: Array<{ id: DesignMode; label: string; icon: any }> = [
  { id: "rc_beam", label: "RC Beam", icon: Ruler },
  { id: "rc_slab", label: "RC Slab", icon: Square },
  { id: "rc_column", label: "RC Column", icon: Columns3 },
  { id: "steel", label: "Steel Section", icon: BarChart3 },
];

export const DetailedDesignPanel: FC<DetailedDesignPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const [mode, setMode] = useState<DesignMode>("rc_beam");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // ── RC Beam inputs ───────────────────────────────────
  const [beamInput, setBeamInput] = useState<RCBeamInput>({
    width: 300,
    depth: 600,
    span: 6000,
    clear_cover: 25,
    fck: 25,
    fy: 500,
    Mu: 180,
    Vu: 120,
    Tu: 0,
    exposureClass: "moderate",
    beamType: "simply_supported",
    code: "IS456",
  });

  // ── RC Slab inputs ───────────────────────────────────
  const [slabInput, setSlabInput] = useState<RCSlabInput>({
    Lx: 4000,
    Ly: 6000,
    thickness: 150,
    clear_cover: 20,
    fck: 25,
    fy: 500,
    liveLoad: 3.0,
    finishLoad: 1.5,
    edgeCondition: "fixed_all",
    code: "IS456",
  });

  // ── RC Column inputs ─────────────────────────────────
  const [columnInput, setColumnInput] = useState<RCColumnInput>({
    width: 400,
    depth: 400,
    height: 3500,
    clear_cover: 40,
    fck: 30,
    fy: 500,
    Pu: 1500,
    Mux: 80,
    Muy: 60,
    endCondition: "fixed_fixed",
  });

  // ── Steel inputs ─────────────────────────────────────
  const [steelInput, setSteelInput] = useState<SteelSectionInput>({
    sectionType: "I-BEAM",
    depth: 500,
    width: 200,
    tw: 10.2,
    tf: 16,
    fy: 250,
    fu: 410,
    E: 200000,
    length: 6000,
    Lb: 3000,
    Cb: 1.0,
    K: 1.0,
    Pu: 200,
    Mu: 150,
    Vu: 80,
    code: "IS800",
  });

  // ── Computed results ─────────────────────────────────
  const beamResult = useMemo(() => {
    try {
      return designRCBeamDetailed(beamInput);
    } catch {
      return null;
    }
  }, [beamInput]);

  const slabResult = useMemo(() => {
    try {
      return designRCSlabDetailed(slabInput);
    } catch {
      return null;
    }
  }, [slabInput]);

  const columnResult = useMemo(() => {
    try {
      return designRCColumnDetailed(columnInput);
    } catch {
      return null;
    }
  }, [columnInput]);

  const steelResult = useMemo(() => {
    try {
      return designSteelSectionDetailed(steelInput);
    } catch {
      return null;
    }
  }, [steelInput]);

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[1050px] max-h-[88vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <Ruler className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Detailed Section Design
              </DialogTitle>
              <DialogDescription className="text-xs">
                Full detailing output — bar layout, curtailment, crack width,
                LTB, interaction diagrams
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 px-4">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = mode === tab.id;
            return (
              <button type="button"
                key={tab.id}
                onClick={() => setMode(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-700 dark:text-slate-200 hover:border-slate-500"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Inputs */}
          <div className="w-[360px] border-r border-slate-200 dark:border-slate-700 p-4 overflow-y-auto space-y-3">
            {mode === "rc_beam" && (
              <BeamInputForm input={beamInput} onChange={setBeamInput} />
            )}
            {mode === "rc_slab" && (
              <SlabInputForm input={slabInput} onChange={setSlabInput} />
            )}
            {mode === "rc_column" && (
              <ColumnInputForm input={columnInput} onChange={setColumnInput} />
            )}
            {mode === "steel" && (
              <SteelInputForm input={steelInput} onChange={setSteelInput} />
            )}
          </div>

          {/* Right: Results */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {mode === "rc_beam" && beamResult && (
              <BeamResults
                result={beamResult}
                expanded={expanded}
                toggle={toggle}
              />
            )}
            {mode === "rc_slab" && slabResult && (
              <SlabResults
                result={slabResult}
                expanded={expanded}
                toggle={toggle}
              />
            )}
            {mode === "rc_column" && columnResult && (
              <ColumnResults
                result={columnResult}
                expanded={expanded}
                toggle={toggle}
              />
            )}
            {mode === "steel" && steelResult && (
              <SteelResults
                result={steelResult}
                expanded={expanded}
                toggle={toggle}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ────────────────────────────────────────────────────────────────
// COMMON UI COMPONENTS
// ────────────────────────────────────────────────────────────────

const InputRow: FC<{
  label: string;
  value: number | string;
  unit?: string;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}> = ({ label, value, unit, onChange, min, max, step }) => (
  <div className="flex items-center gap-2">
    <label className="text-xs text-slate-500 dark:text-slate-400 w-28 shrink-0">{label}</label>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step || 1}
      onChange={(e) => onChange(Number(e.target.value))}
      className="flex-1 px-2 py-1 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white"
    />
    {unit && <span className="text-xs text-slate-500 dark:text-slate-400 w-10">{unit}</span>}
  </div>
);

const SelectRow: FC<{
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div className="flex items-center gap-2">
    <label className="text-xs text-slate-500 dark:text-slate-400 w-28 shrink-0">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 px-2 py-1 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);

const ResultCard: FC<{
  title: string;
  id: string;
  expanded: Record<string, boolean>;
  toggle: (k: string) => void;
  children: React.ReactNode;
}> = ({ title, id, expanded: exp, toggle, children }) => (
  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
    <button type="button"
      onClick={() => toggle(id)}
      className="w-full flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 text-left"
    >
      {exp[id] ? (
        <ChevronDown className="w-3.5 h-3.5" />
      ) : (
        <ChevronRight className="w-3.5 h-3.5" />
      )}
      {title}
    </button>
    {exp[id] !== false && (
      <div className="px-3 py-2 space-y-1 text-xs">{children}</div>
    )}
  </div>
);

const StatusBadge: FC<{ pass: boolean; label: string }> = ({ pass, label }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${pass ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}
  >
    {pass ? (
      <CheckCircle className="w-3 h-3" />
    ) : (
      <XCircle className="w-3 h-3" />
    )}
    {label}
  </span>
);

const KV: FC<{ k: string; v: string | number; unit?: string }> = ({
  k,
  v,
  unit,
}) => (
  <div className="flex justify-between">
    <span className="text-slate-500 dark:text-slate-400">{k}</span>
    <span className="text-slate-900 dark:text-white font-mono">
      {typeof v === "number" ? v.toFixed(2) : v}
      {unit ? ` ${unit}` : ""}
    </span>
  </div>
);

// ────────────────────────────────────────────────────────────────
// RC BEAM
// ────────────────────────────────────────────────────────────────

const BeamInputForm: FC<{
  input: RCBeamInput;
  onChange: (i: RCBeamInput) => void;
}> = ({ input, onChange }) => {
  const u = (key: keyof RCBeamInput, val: number | string) =>
    onChange({ ...input, [key]: val });
  return (
    <>
      <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
        Geometry
      </h3>
      <InputRow
        label="Width (b)"
        value={input.width}
        unit="mm"
        onChange={(v) => u("width", v)}
        min={150}
        max={1000}
      />
      <InputRow
        label="Depth (D)"
        value={input.depth}
        unit="mm"
        onChange={(v) => u("depth", v)}
        min={200}
        max={2000}
      />
      <InputRow
        label="Span"
        value={input.span}
        unit="mm"
        onChange={(v) => u("span", v)}
        min={1000}
        max={20000}
      />
      <InputRow
        label="Clear Cover"
        value={input.clear_cover}
        unit="mm"
        onChange={(v) => u("clear_cover", v)}
        min={20}
        max={75}
      />
      <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mt-3">
        Material
      </h3>
      <InputRow
        label="fck"
        value={input.fck}
        unit="MPa"
        onChange={(v) => u("fck", v)}
        min={15}
        max={80}
      />
      <InputRow
        label="fy"
        value={input.fy}
        unit="MPa"
        onChange={(v) => u("fy", v)}
        min={250}
        max={600}
      />
      <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mt-3">
        Forces (Factored)
      </h3>
      <InputRow
        label="Mu"
        value={input.Mu}
        unit="kN·m"
        onChange={(v) => u("Mu", v)}
        min={0}
      />
      <InputRow
        label="Vu"
        value={input.Vu}
        unit="kN"
        onChange={(v) => u("Vu", v)}
        min={0}
      />
      <InputRow
        label="Tu (torsion)"
        value={input.Tu || 0}
        unit="kN·m"
        onChange={(v) => u("Tu", v)}
        min={0}
      />
      <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mt-3">
        Design Parameters
      </h3>
      <SelectRow
        label="Beam Type"
        value={input.beamType}
        onChange={(v) => u("beamType", v as any)}
        options={[
          { value: "simply_supported", label: "Simply Supported" },
          { value: "continuous", label: "Continuous" },
          { value: "cantilever", label: "Cantilever" },
        ]}
      />
      <SelectRow
        label="Exposure"
        value={input.exposureClass}
        onChange={(v) => u("exposureClass", v as any)}
        options={[
          { value: "mild", label: "Mild" },
          { value: "moderate", label: "Moderate" },
          { value: "severe", label: "Severe" },
          { value: "very_severe", label: "Very Severe" },
          { value: "extreme", label: "Extreme" },
        ]}
      />
    </>
  );
};

const BeamResults: FC<{
  result: RCBeamDetailedResult;
  expanded: Record<string, boolean>;
  toggle: (k: string) => void;
}> = ({ result, expanded, toggle }) => (
  <>
    <ResultCard
      title="Flexure Design"
      id="beam_flex"
      expanded={expanded}
      toggle={toggle}
    >
      <KV k="Effective depth (d)" v={result.d} unit="mm" />
      <KV k="N.A. depth (xu)" v={result.xu} unit="mm" />
      <KV k="xu,max (balanced)" v={result.xu_max} unit="mm" />
      <KV
        k="Type"
        v={
          result.isDoublyReinforced ? "Doubly Reinforced" : "Singly Reinforced"
        }
      />
      <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
      <KV k="Ast required" v={result.Ast_required} unit="mm²" />
      <KV k="Ast provided" v={result.Ast_provided} unit="mm²" />
      <KV k="Ast min" v={result.Ast_min} unit="mm²" />
      <div className="mt-1 text-blue-400 font-medium">
        Tension: {result.tensionBars.count}–{result.tensionBars.size.label}
        {result.tensionBars.layers > 1
          ? ` (${result.tensionBars.layers} layers)`
          : ""}
      </div>
      {result.compressionBars && (
        <div className="text-orange-400 font-medium">
          Compression: {result.compressionBars.count}–
          {result.compressionBars.size.label}
        </div>
      )}
    </ResultCard>

    <ResultCard
      title="Shear Design"
      id="beam_shear"
      expanded={expanded}
      toggle={toggle}
    >
      <KV k="τv (nominal)" v={result.tau_v} unit="MPa" />
      <KV k="τc (concrete)" v={result.tau_c} unit="MPa" />
      <KV k="τc,max" v={result.tau_c_max} unit="MPa" />
      <KV k="Vus" v={result.Vus} unit="kN" />
      <StatusBadge
        pass={result.shearPasses}
        label={result.shearPasses ? "Shear OK" : "Section Inadequate"}
      />
      <div className="mt-1 text-blue-400 font-medium">
        Stirrups: {result.stirrups.legs}-legged {result.stirrups.size.label} @{" "}
        {result.stirrups.spacing}mm c/c
      </div>
    </ResultCard>

    <ResultCard
      title="Development Length & Curtailment"
      id="beam_dev"
      expanded={expanded}
      toggle={toggle}
    >
      <KV k="Ld (tension)" v={result.Ld_tension} unit="mm" />
      <KV k="Ld (compression)" v={result.Ld_compression} unit="mm" />
      <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
      {result.curtailment.map((cp, i) => (
        <div key={i} className="text-slate-600 dark:text-slate-300">
          At {(cp.distanceFromSupport / 1000).toFixed(2)}m: {cp.barsRequired}{" "}
          bars needed (M = {cp.momentAtPoint.toFixed(1)} kN·m)
        </div>
      ))}
    </ResultCard>

    <ResultCard
      title="Crack Width Check"
      id="beam_crack"
      expanded={expanded}
      toggle={toggle}
    >
      <KV k="wk (calc)" v={result.crackWidth.wk} unit="mm" />
      <KV k="wk limit" v={result.crackWidth.wk_limit} unit="mm" />
      <KV k="Bar spacing" v={result.crackWidth.spacing} unit="mm" />
      <StatusBadge
        pass={result.crackWidth.passes}
        label={result.crackWidth.passes ? "Crack Width OK" : "Exceeds Limit"}
      />
    </ResultCard>

    <ResultCard
      title="Deflection Check (IS 456 Cl. 23.2)"
      id="beam_defl"
      expanded={expanded}
      toggle={toggle}
    >
      <KV k="L/d actual" v={result.deflection.spanOverDepthActual} />
      <KV k="L/d permissible" v={result.deflection.spanOverDepthPermissible} />
      <KV k="MF (tension)" v={result.deflection.modificationFactor_tension} />
      <KV
        k="MF (compression)"
        v={result.deflection.modificationFactor_compression}
      />
      <StatusBadge
        pass={result.deflection.passes}
        label={result.deflection.passes ? "Deflection OK" : "Exceeds Limit"}
      />
    </ResultCard>

    <ResultCard
      title="Detailing Notes"
      id="beam_notes"
      expanded={expanded}
      toggle={toggle}
    >
      {result.detailingNotes.map((note, i) => (
        <div key={i} className="text-slate-600 dark:text-slate-300 flex gap-1.5">
          <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0 mt-0.5" />
          {note}
        </div>
      ))}
    </ResultCard>

    {/* Cross-section sketch */}
    <ResultCard
      title="Cross-Section Sketch"
      id="beam_sketch"
      expanded={expanded}
      toggle={toggle}
    >
      <BeamSketchSVG sketch={result.sketch} />
    </ResultCard>
  </>
);

const BeamSketchSVG: FC<{ sketch: RCBeamDetailedResult["sketch"] }> = ({
  sketch,
}) => {
  const scale = 0.4;
  const W = sketch.width * scale + 40;
  const H = sketch.depth * scale + 40;
  const ox = 20,
    oy = 20;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full max-w-[300px] mx-auto"
      style={{ background: "#1a1a2e" }}
    >
      {/* Concrete outline */}
      <rect
        x={ox}
        y={oy}
        width={sketch.width * scale}
        height={sketch.depth * scale}
        fill="none"
        stroke="#6b7280"
        strokeWidth={1.5}
      />
      {/* Stirrup */}
      <rect
        x={ox + sketch.cover * scale}
        y={oy + sketch.cover * scale}
        width={sketch.stirrup.width * scale}
        height={sketch.stirrup.height * scale}
        fill="none"
        stroke="#60a5fa"
        strokeWidth={1}
        strokeDasharray="4 2"
      />
      {/* Tension bars */}
      {sketch.tensionBars.map((bar, i) => (
        <circle
          key={`t${i}`}
          cx={ox + bar.x * scale}
          cy={oy + bar.y * scale}
          r={bar.dia * scale * 0.5}
          fill="#ef4444"
          stroke="#fca5a5"
          strokeWidth={0.5}
        />
      ))}
      {/* Compression bars */}
      {sketch.compressionBars.map((bar, i) => (
        <circle
          key={`c${i}`}
          cx={ox + bar.x * scale}
          cy={oy + bar.y * scale}
          r={bar.dia * scale * 0.5}
          fill="#3b82f6"
          stroke="#93c5fd"
          strokeWidth={0.5}
        />
      ))}
      {/* Dimension lines */}
      <text
        x={ox + (sketch.width * scale) / 2}
        y={H - 2}
        textAnchor="middle"
        fill="#9ca3af"
        fontSize={9}
      >
        {sketch.width} mm
      </text>
      <text
        x={4}
        y={oy + (sketch.depth * scale) / 2}
        textAnchor="middle"
        fill="#9ca3af"
        fontSize={9}
        transform={`rotate(-90, 4, ${oy + (sketch.depth * scale) / 2})`}
      >
        {sketch.depth} mm
      </text>
    </svg>
  );
};

// ────────────────────────────────────────────────────────────────
// RC SLAB
// ────────────────────────────────────────────────────────────────

const SlabInputForm: FC<{
  input: RCSlabInput;
  onChange: (i: RCSlabInput) => void;
}> = ({ input, onChange }) => {
  const u = (key: keyof RCSlabInput, val: number | string) =>
    onChange({ ...input, [key]: val });
  return (
    <>
      <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
        Geometry
      </h3>
      <InputRow
        label="Lx (short)"
        value={input.Lx}
        unit="mm"
        onChange={(v) => u("Lx", v)}
        min={1000}
      />
      <InputRow
        label="Ly (long)"
        value={input.Ly}
        unit="mm"
        onChange={(v) => u("Ly", v)}
        min={1000}
      />
      <InputRow
        label="Thickness"
        value={input.thickness}
        unit="mm"
        onChange={(v) => u("thickness", v)}
        min={75}
        max={500}
      />
      <InputRow
        label="Clear Cover"
        value={input.clear_cover}
        unit="mm"
        onChange={(v) => u("clear_cover", v)}
        min={15}
        max={50}
      />
      <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mt-3">
        Material
      </h3>
      <InputRow
        label="fck"
        value={input.fck}
        unit="MPa"
        onChange={(v) => u("fck", v)}
        min={15}
        max={80}
      />
      <InputRow
        label="fy"
        value={input.fy}
        unit="MPa"
        onChange={(v) => u("fy", v)}
        min={250}
        max={600}
      />
      <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mt-3">
        Loading
      </h3>
      <InputRow
        label="Live Load"
        value={input.liveLoad}
        unit="kN/m²"
        onChange={(v) => u("liveLoad", v)}
        min={0}
        step={0.5}
      />
      <InputRow
        label="Finish Load"
        value={input.finishLoad}
        unit="kN/m²"
        onChange={(v) => u("finishLoad", v)}
        min={0}
        step={0.25}
      />
      <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mt-3">
        Edge Condition
      </h3>
      <SelectRow
        label="Edges"
        value={input.edgeCondition}
        onChange={(v) => u("edgeCondition", v as any)}
        options={[
          { value: "ss_all", label: "All Edges Simply Supported" },
          { value: "fixed_all", label: "All Edges Fixed" },
          { value: "one_long_fixed", label: "One Long Edge Fixed" },
          { value: "adjacent_fixed", label: "Two Adjacent Fixed" },
          { value: "three_fixed", label: "Three Edges Fixed" },
        ]}
      />
    </>
  );
};

const SlabResults: FC<{
  result: RCSlabDetailedResult;
  expanded: Record<string, boolean>;
  toggle: (k: string) => void;
}> = ({ result, expanded, toggle }) => (
  <>
    <ResultCard
      title="Slab Classification & Loads"
      id="slab_class"
      expanded={expanded}
      toggle={toggle}
    >
      <KV
        k="Slab Type"
        v={result.slabType === "one_way" ? "ONE-WAY" : "TWO-WAY"}
      />
      <KV k="Ly/Lx" v={result.ratio} />
      <KV k="d (short dir)" v={result.d_short} unit="mm" />
      <KV k="d (long dir)" v={result.d_long} unit="mm" />
      <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
      <KV k="Self weight" v={result.selfWeight} unit="kN/m²" />
      <KV k="Total factored wu" v={result.totalFactoredLoad} unit="kN/m²" />
    </ResultCard>

    <ResultCard
      title="Design Moments (per m width)"
      id="slab_moments"
      expanded={expanded}
      toggle={toggle}
    >
      <KV k="Mx (+) midspan" v={result.Mx_pos} unit="kN·m" />
      <KV k="Mx (−) support" v={result.Mx_neg} unit="kN·m" />
      <KV k="My (+) midspan" v={result.My_pos} unit="kN·m" />
      <KV k="My (−) support" v={result.My_neg} unit="kN·m" />
    </ResultCard>

    <ResultCard
      title="Reinforcement"
      id="slab_rebar"
      expanded={expanded}
      toggle={toggle}
    >
      <KV k="Ast min (0.12%)" v={result.Ast_min} unit="mm²/m" />
      <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
      <div className="font-medium text-blue-400 mb-1">Main Steel:</div>
      {result.mainSteel.map((s, i) => (
        <div key={i} className="text-slate-600 dark:text-slate-300">
          {s.direction}: {s.bar.label} @ {s.spacing}mm c/c
        </div>
      ))}
      {result.distSteel.length > 0 && (
        <>
          <div className="font-medium text-orange-400 mt-1 mb-1">
            Distribution Steel:
          </div>
          {result.distSteel.map((s, i) => (
            <div key={i} className="text-slate-600 dark:text-slate-300">
              {s.direction}: {s.bar.label} @ {s.spacing}mm c/c
            </div>
          ))}
        </>
      )}
    </ResultCard>

    <ResultCard
      title="Deflection Check"
      id="slab_defl"
      expanded={expanded}
      toggle={toggle}
    >
      <KV k="L/d actual" v={result.deflection.spanOverDepthActual} />
      <KV k="L/d permissible" v={result.deflection.spanOverDepthPermissible} />
      <StatusBadge
        pass={result.deflection.passes}
        label={result.deflection.passes ? "Deflection OK" : "Fails"}
      />
    </ResultCard>

    <ResultCard
      title="Detailing Notes"
      id="slab_notes"
      expanded={expanded}
      toggle={toggle}
    >
      {result.detailingNotes.map((note, i) => (
        <div key={i} className="text-slate-600 dark:text-slate-300 flex gap-1.5">
          <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0 mt-0.5" />
          {note}
        </div>
      ))}
    </ResultCard>
  </>
);

// ────────────────────────────────────────────────────────────────
// RC COLUMN
// ────────────────────────────────────────────────────────────────

const ColumnInputForm: FC<{
  input: RCColumnInput;
  onChange: (i: RCColumnInput) => void;
}> = ({ input, onChange }) => {
  const u = (key: keyof RCColumnInput, val: number | string) =>
    onChange({ ...input, [key]: val });
  return (
    <>
      <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
        Geometry
      </h3>
      <InputRow
        label="Width (B)"
        value={input.width}
        unit="mm"
        onChange={(v) => u("width", v)}
        min={200}
      />
      <InputRow
        label="Depth (D)"
        value={input.depth}
        unit="mm"
        onChange={(v) => u("depth", v)}
        min={200}
      />
      <InputRow
        label="Height"
        value={input.height}
        unit="mm"
        onChange={(v) => u("height", v)}
        min={1000}
      />
      <InputRow
        label="Clear Cover"
        value={input.clear_cover}
        unit="mm"
        onChange={(v) => u("clear_cover", v)}
        min={30}
        max={75}
      />
      <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mt-3">
        Material
      </h3>
      <InputRow
        label="fck"
        value={input.fck}
        unit="MPa"
        onChange={(v) => u("fck", v)}
        min={15}
        max={80}
      />
      <InputRow
        label="fy"
        value={input.fy}
        unit="MPa"
        onChange={(v) => u("fy", v)}
        min={250}
        max={600}
      />
      <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mt-3">
        Forces (Factored)
      </h3>
      <InputRow
        label="Pu (axial)"
        value={input.Pu}
        unit="kN"
        onChange={(v) => u("Pu", v)}
        min={0}
      />
      <InputRow
        label="Mux"
        value={input.Mux}
        unit="kN·m"
        onChange={(v) => u("Mux", v)}
        min={0}
      />
      <InputRow
        label="Muy"
        value={input.Muy}
        unit="kN·m"
        onChange={(v) => u("Muy", v)}
        min={0}
      />
      <SelectRow
        label="End Condition"
        value={input.endCondition}
        onChange={(v) => u("endCondition", v as any)}
        options={[
          { value: "fixed_fixed", label: "Fixed-Fixed" },
          { value: "fixed_hinged", label: "Fixed-Hinged" },
          { value: "hinged_hinged", label: "Hinged-Hinged" },
          { value: "fixed_free", label: "Fixed-Free (Cantilever)" },
        ]}
      />
    </>
  );
};

const ColumnResults: FC<{
  result: RCColumnDetailedResult;
  expanded: Record<string, boolean>;
  toggle: (k: string) => void;
}> = ({ result, expanded, toggle }) => (
  <>
    <ResultCard
      title="Column Classification"
      id="col_class"
      expanded={expanded}
      toggle={toggle}
    >
      <KV k="Slenderness λ" v={result.slendernessRatio} />
      <KV k="Type" v={result.isShort ? "Short Column" : "Slender Column"} />
      <KV k="Effective Length" v={result.effectiveLength / 1000} unit="m" />
      <KV k="Pu capacity" v={result.Pu_capacity} unit="kN" />
    </ResultCard>

    <ResultCard
      title="Steel Design"
      id="col_steel"
      expanded={expanded}
      toggle={toggle}
    >
      <KV k="pt" v={result.pt} unit="%" />
      <KV k="Ast required" v={result.Ast_required} unit="mm²" />
      <KV k="Ast provided" v={result.Ast_provided} unit="mm²" />
      <KV k="Ast min (0.8%)" v={result.Ast_min} unit="mm²" />
      <div className="mt-1 text-blue-400 font-medium">
        Main: {result.mainBars.count}–{result.mainBars.size.label} @{" "}
        {result.mainBars.spacing}mm c/c
      </div>
      <div className="text-orange-400 font-medium">
        Ties: {result.ties.size.label} @ {result.ties.spacing}mm c/c (
        {result.ties.legCount} legs)
      </div>
    </ResultCard>

    <ResultCard
      title="Biaxial Check (IS 456 Cl. 39.6)"
      id="col_biaxial"
      expanded={expanded}
      toggle={toggle}
    >
      <KV k="P/Puz" v={result.biaxialCheck.P_ratio} />
      <KV k="Mux/Mux1" v={result.biaxialCheck.Mux_ratio} />
      <KV k="Muy/Muy1" v={result.biaxialCheck.Muy_ratio} />
      <KV k="αn" v={result.biaxialCheck.alpha_n} />
      <KV k="Interaction value" v={result.biaxialCheck.interactionValue} />
      <StatusBadge
        pass={result.biaxialCheck.passes}
        label={result.biaxialCheck.passes ? "Biaxial OK" : "FAILS"}
      />
    </ResultCard>

    <ResultCard
      title="Interaction Diagram"
      id="col_interaction"
      expanded={expanded}
      toggle={toggle}
    >
      <InteractionDiagramSVG points={result.interactionDiagram} Pu={0} Mu={0} />
    </ResultCard>

    <ResultCard
      title="Detailing Notes"
      id="col_notes"
      expanded={expanded}
      toggle={toggle}
    >
      {result.detailingNotes.map((note, i) => (
        <div key={i} className="text-slate-600 dark:text-slate-300 flex gap-1.5">
          <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0 mt-0.5" />
          {note}
        </div>
      ))}
    </ResultCard>
  </>
);

const InteractionDiagramSVG: FC<{
  points: Array<{ Pu: number; Mu: number }>;
  Pu: number;
  Mu: number;
}> = ({ points }) => {
  if (points.length === 0) return null;
  const maxP = Math.max(...points.map((p) => Math.abs(p.Pu)), 1);
  const maxM = Math.max(...points.map((p) => Math.abs(p.Mu)), 1);
  const W = 280,
    H = 200,
    pad = 30;

  const scaleX = (m: number) => pad + (m / maxM) * (W - 2 * pad);
  const scaleY = (p: number) => H - pad - (p / maxP) * (H - 2 * pad);

  const pathD = points
    .map(
      (pt, i) =>
        `${i === 0 ? "M" : "L"} ${scaleX(pt.Mu).toFixed(1)} ${scaleY(pt.Pu).toFixed(1)}`,
    )
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full max-w-[300px] mx-auto"
      style={{ background: "#111827" }}
    >
      {/* Axes */}
      <line
        x1={pad}
        y1={H - pad}
        x2={W - pad}
        y2={H - pad}
        stroke="#4b5563"
        strokeWidth={1}
      />
      <line
        x1={pad}
        y1={pad}
        x2={pad}
        y2={H - pad}
        stroke="#4b5563"
        strokeWidth={1}
      />
      {/* Curve */}
      <path
        d={pathD}
        fill="rgba(59,130,246,0.15)"
        stroke="#3b82f6"
        strokeWidth={2}
      />
      {/* Points */}
      {points.map((pt, i) => (
        <circle
          key={i}
          cx={scaleX(pt.Mu)}
          cy={scaleY(pt.Pu)}
          r={3}
          fill="#3b82f6"
        />
      ))}
      {/* Labels */}
      <text x={W / 2} y={H - 5} textAnchor="middle" fill="#9ca3af" fontSize={9}>
        Mu (kN·m)
      </text>
      <text
        x={5}
        y={H / 2}
        textAnchor="middle"
        fill="#9ca3af"
        fontSize={9}
        transform={`rotate(-90, 5, ${H / 2})`}
      >
        Pu (kN)
      </text>
    </svg>
  );
};

// ────────────────────────────────────────────────────────────────
// STEEL SECTION
// ────────────────────────────────────────────────────────────────

const SteelInputForm: FC<{
  input: SteelSectionInput;
  onChange: (i: SteelSectionInput) => void;
}> = ({ input, onChange }) => {
  const u = (key: keyof SteelSectionInput, val: number | string) =>
    onChange({ ...input, [key]: val });
  return (
    <>
      <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
        Section
      </h3>
      <InputRow
        label="Depth (d)"
        value={input.depth}
        unit="mm"
        onChange={(v) => u("depth", v)}
        min={100}
      />
      <InputRow
        label="Width (bf)"
        value={input.width}
        unit="mm"
        onChange={(v) => u("width", v)}
        min={50}
      />
      <InputRow
        label="Web (tw)"
        value={input.tw}
        unit="mm"
        onChange={(v) => u("tw", v)}
        min={3}
        step={0.1}
      />
      <InputRow
        label="Flange (tf)"
        value={input.tf}
        unit="mm"
        onChange={(v) => u("tf", v)}
        min={4}
        step={0.1}
      />
      <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mt-3">
        Material
      </h3>
      <InputRow
        label="fy"
        value={input.fy}
        unit="MPa"
        onChange={(v) => u("fy", v)}
        min={230}
        max={550}
      />
      <InputRow
        label="fu"
        value={input.fu}
        unit="MPa"
        onChange={(v) => u("fu", v)}
        min={350}
        max={700}
      />
      <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mt-3">
        Member
      </h3>
      <InputRow
        label="Length"
        value={input.length}
        unit="mm"
        onChange={(v) => u("length", v)}
        min={500}
      />
      <InputRow
        label="Lb (unbraced)"
        value={input.Lb}
        unit="mm"
        onChange={(v) => u("Lb", v)}
        min={200}
      />
      <InputRow
        label="Cb (gradient)"
        value={input.Cb}
        unit=""
        onChange={(v) => u("Cb", v)}
        min={1.0}
        max={2.5}
        step={0.05}
      />
      <InputRow
        label="K (eff. length)"
        value={input.K}
        unit=""
        onChange={(v) => u("K", v)}
        min={0.5}
        max={2.5}
        step={0.05}
      />
      <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mt-3">
        Forces (Factored)
      </h3>
      <InputRow
        label="Pu (axial)"
        value={input.Pu}
        unit="kN"
        onChange={(v) => u("Pu", v)}
      />
      <InputRow
        label="Mu (moment)"
        value={input.Mu}
        unit="kN·m"
        onChange={(v) => u("Mu", v)}
        min={0}
      />
      <InputRow
        label="Vu (shear)"
        value={input.Vu}
        unit="kN"
        onChange={(v) => u("Vu", v)}
        min={0}
      />
      <SelectRow
        label="Design Code"
        value={input.code}
        onChange={(v) => u("code", v as any)}
        options={[
          { value: "IS800", label: "IS 800:2007" },
          { value: "AISC360", label: "AISC 360-22" },
        ]}
      />
    </>
  );
};

const SteelResults: FC<{
  result: SteelDetailedResult;
  expanded: Record<string, boolean>;
  toggle: (k: string) => void;
}> = ({ result, expanded, toggle }) => (
  <>
    <ResultCard
      title="Section Classification"
      id="steel_class"
      expanded={expanded}
      toggle={toggle}
    >
      <KV k="Overall Class" v={result.sectionClass} />
      <KV k="Flange Class" v={result.flangeClass} />
      <KV k="Web Class" v={result.webClass} />
      <KV k="Flange b/tf" v={result.flangeSlenderness} />
      <KV k="Web d/tw" v={result.webSlenderness} />
    </ResultCard>

    <ResultCard
      title="Member Capacities"
      id="steel_cap"
      expanded={expanded}
      toggle={toggle}
    >
      <KV k="Tension (Td)" v={result.tensionCapacity} unit="kN" />
      <KV k="Compression (Pd)" v={result.compressionCapacity} unit="kN" />
      <KV k="Moment (Md)" v={result.momentCapacity} unit="kN·m" />
      <KV k="Shear (Vd)" v={result.shearCapacity} unit="kN" />
      <div className="mt-1">
        <StatusBadge
          pass={result.utilization <= 1.0}
          label={`Utilization: ${(result.utilization * 100).toFixed(1)}%`}
        />
      </div>
    </ResultCard>

    <ResultCard
      title="Lateral-Torsional Buckling"
      id="steel_ltb"
      expanded={expanded}
      toggle={toggle}
    >
      <KV k="Mcr (elastic critical)" v={result.ltb.Mcr} unit="kN·m" />
      <KV k="λLT" v={result.ltb.lambda_LT} />
      <KV k="χLT (reduction)" v={result.ltb.chi_LT} />
      <KV k="Md (design strength)" v={result.ltb.Md} unit="kN·m" />
    </ResultCard>

    <ResultCard
      title="Interaction Check"
      id="steel_interact"
      expanded={expanded}
      toggle={toggle}
    >
      <KV k="N/Nd" v={result.interaction.N_ratio} />
      <KV k="M/Md" v={result.interaction.M_ratio} />
      <KV k="Combined" v={result.interaction.combined} />
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        {result.interaction.formula}
      </div>
      <StatusBadge
        pass={result.interaction.passes}
        label={result.interaction.passes ? "Interaction OK" : "FAILS"}
      />
    </ResultCard>

    <ResultCard
      title="Web Checks & Stiffeners"
      id="steel_web"
      expanded={expanded}
      toggle={toggle}
    >
      <KV k="Web bearing" v={result.webBearing.bearingCapacity} unit="kN" />
      <StatusBadge
        pass={result.webBearing.passes}
        label={result.webBearing.passes ? "Bearing OK" : "Fails"}
      />
      <KV k="Web buckling" v={result.webBuckling.bucklingCapacity} unit="kN" />
      <StatusBadge
        pass={result.webBuckling.passes}
        label={result.webBuckling.passes ? "Buckling OK" : "Fails"}
      />
      {result.stiffenerRequired && (
        <div className="text-yellow-400 text-xs mt-1">
          ⚠ {result.stiffenerReason}
        </div>
      )}
    </ResultCard>

    <ResultCard
      title="Connection Force Demands"
      id="steel_conn"
      expanded={expanded}
      toggle={toggle}
    >
      <KV
        k="Bolt shear/bolt"
        v={result.connectionDemands.boltShearForce}
        unit="kN"
      />
      <KV
        k="Weld force/mm"
        v={result.connectionDemands.weldForcePerMm}
        unit="kN/mm"
      />
      <KV
        k="End plate thickness"
        v={result.connectionDemands.endPlateThickness}
        unit="mm"
      />
    </ResultCard>

    <ResultCard
      title="Detailing Notes"
      id="steel_notes"
      expanded={expanded}
      toggle={toggle}
    >
      {result.detailingNotes.map((note, i) => (
        <div key={i} className="text-slate-600 dark:text-slate-300 flex gap-1.5">
          <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0 mt-0.5" />
          {note}
        </div>
      ))}
    </ResultCard>
  </>
);

export default DetailedDesignPanel;
