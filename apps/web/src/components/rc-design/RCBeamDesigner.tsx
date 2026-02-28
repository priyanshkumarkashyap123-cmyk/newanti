/**
 * ============================================================================
 * RC BEAM DESIGNER COMPONENT
 * ============================================================================
 *
 * Ultra-modern React component for reinforced concrete beam design.
 * Features real-time calculations, 3D visualization, and professional output.
 *
 * @version 1.0.0
 */

"use client";

import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator,
  Settings,
  FileText,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowRight,
  Download,
  RefreshCw,
  Zap,
  Box,
  Grid3X3,
  Activity,
} from "lucide-react";

// Import design engine
import {
  RCBeamDesignEngine,
  BeamDesignResult,
  designRectangularBeam,
  designTBeam,
} from "@/modules/concrete/RCBeamDesignEngine";
import {
  DesignCode,
  getConcreteGrades,
  getSteelGrades,
  REBAR_SIZES,
  ConcreteGrade,
  SteelGrade,
} from "@/modules/concrete/RCDesignConstants";

// Types
interface BeamFormData {
  beamType: "rectangular" | "T-beam" | "L-beam";
  b: number;
  D: number;
  d: number;
  bf?: number;
  Df?: number;
  L: number;
  Mu: number;
  Vu: number;
  Tu?: number;
  code: DesignCode;
  concreteGrade: string;
  steelGrade: string;
  exposure: string;
  cover: number;
}

// Default values
const defaultFormData: BeamFormData = {
  beamType: "rectangular",
  b: 300,
  D: 500,
  d: 450,
  L: 6000,
  Mu: 150,
  Vu: 80,
  code: "IS456",
  concreteGrade: "M25",
  steelGrade: "Fe500",
  exposure: "moderate",
  cover: 40,
};

// Component
export default function RCBeamDesigner() {
  const [formData, setFormData] = useState<BeamFormData>(defaultFormData);
  const [result, setResult] = useState<BeamDesignResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [activeTab, setActiveTab] = useState<"input" | "results" | "drawing">(
    "input",
  );
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    geometry: true,
    loading: true,
    materials: true,
  });

  // Get available grades based on code
  const concreteGrades = useMemo(
    () => getConcreteGrades(formData.code),
    [formData.code],
  );
  const steelGrades = useMemo(
    () => getSteelGrades(formData.code),
    [formData.code],
  );

  // Handle form changes
  const handleChange = useCallback(
    (field: keyof BeamFormData, value: number | string) => {
      setFormData((prev) => {
        const updated = { ...prev, [field]: value };
        // Auto-calculate effective depth
        if (field === "D" || field === "cover") {
          updated.d = updated.D - updated.cover - 20; // Assuming 20mm bar
        }
        return updated;
      });
    },
    [],
  );

  // Toggle section
  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // Run design calculation
  const runDesign = useCallback(async () => {
    setIsCalculating(true);

    // Simulate async calculation
    await new Promise((resolve) => setTimeout(resolve, 500));

    const selectedConcrete =
      concreteGrades.find((g) => g.grade === formData.concreteGrade) ||
      concreteGrades[2];
    const selectedSteel =
      steelGrades.find((g) => g.grade === formData.steelGrade) ||
      steelGrades[1];

    try {
      const designResult = designRectangularBeam(
        formData.b,
        formData.D,
        formData.L,
        formData.Mu,
        formData.Vu,
        selectedConcrete.fck,
        selectedSteel.fy,
        formData.code,
      );

      setResult(designResult);
      setActiveTab("results");
    } catch (error) {
      console.error("Design calculation failed:", error);
    }

    setIsCalculating(false);
  }, [formData, concreteGrades, steelGrades]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 dark:from-slate-900 via-slate-100 dark:via-slate-800 to-slate-50 dark:to-slate-900">
      {/* Header */}
      <header className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                  RC Beam Designer
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Multi-code reinforced concrete beam design
                </p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 bg-slate-200/50 dark:bg-slate-700/50 rounded-xl p-1">
              {(["input", "results", "drawing"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab
                      ? "bg-blue-500 text-white shadow-lg"
                      : "text-slate-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white hover:bg-slate-600/50"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {activeTab === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8"
            >
              {/* Input Form */}
              <div className="space-y-6">
                {/* Design Code Selection */}
                <InputCard
                  title="Design Code"
                  icon={<Settings className="w-5 h-5" />}
                >
                  <div className="grid grid-cols-4 gap-2">
                    {(["IS456", "ACI318", "EN1992", "AS3600"] as const).map(
                      (code) => (
                        <button
                          key={code}
                          onClick={() => handleChange("code", code)}
                          className={`py-3 rounded-lg text-sm font-medium transition-all ${
                            formData.code === code
                              ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                              : "bg-slate-200/50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-600/50"
                          }`}
                        >
                          {code}
                        </button>
                      ),
                    )}
                  </div>
                </InputCard>

                {/* Beam Type */}
                <InputCard title="Beam Type" icon={<Box className="w-5 h-5" />}>
                  <div className="grid grid-cols-3 gap-2">
                    {["rectangular", "T-beam", "L-beam"].map((type) => (
                      <button
                        key={type}
                        onClick={() =>
                          handleChange(
                            "beamType",
                            type as BeamFormData["beamType"],
                          )
                        }
                        className={`py-3 rounded-lg text-sm font-medium transition-all ${
                          formData.beamType === type
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                            : "bg-slate-200/50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-600/50"
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </InputCard>

                {/* Geometry */}
                <CollapsibleSection
                  title="Geometry"
                  icon={<Grid3X3 className="w-5 h-5" />}
                  isExpanded={expandedSections.geometry}
                  onToggle={() => toggleSection("geometry")}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="Width (b)"
                      value={formData.b}
                      onChange={(v) => handleChange("b", v)}
                      unit="mm"
                    />
                    <InputField
                      label="Depth (D)"
                      value={formData.D}
                      onChange={(v) => handleChange("D", v)}
                      unit="mm"
                    />
                    <InputField
                      label="Eff. Depth (d)"
                      value={formData.d}
                      onChange={(v) => handleChange("d", v)}
                      unit="mm"
                      disabled
                    />
                    <InputField
                      label="Span (L)"
                      value={formData.L}
                      onChange={(v) => handleChange("L", v)}
                      unit="mm"
                    />
                    {(formData.beamType === "T-beam" ||
                      formData.beamType === "L-beam") && (
                      <>
                        <InputField
                          label="Flange Width (bf)"
                          value={formData.bf || 1200}
                          onChange={(v) => handleChange("bf", v)}
                          unit="mm"
                        />
                        <InputField
                          label="Flange Depth (Df)"
                          value={formData.Df || 120}
                          onChange={(v) => handleChange("Df", v)}
                          unit="mm"
                        />
                      </>
                    )}
                  </div>
                </CollapsibleSection>

                {/* Loading */}
                <CollapsibleSection
                  title="Loading (Factored)"
                  icon={<Activity className="w-5 h-5" />}
                  isExpanded={expandedSections.loading}
                  onToggle={() => toggleSection("loading")}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="Moment (Mu)"
                      value={formData.Mu}
                      onChange={(v) => handleChange("Mu", v)}
                      unit="kN-m"
                    />
                    <InputField
                      label="Shear (Vu)"
                      value={formData.Vu}
                      onChange={(v) => handleChange("Vu", v)}
                      unit="kN"
                    />
                    <InputField
                      label="Torsion (Tu)"
                      value={formData.Tu || 0}
                      onChange={(v) => handleChange("Tu", v)}
                      unit="kN-m"
                    />
                  </div>
                </CollapsibleSection>

                {/* Materials */}
                <CollapsibleSection
                  title="Materials"
                  icon={<Layers className="w-5 h-5" />}
                  isExpanded={expandedSections.materials}
                  onToggle={() => toggleSection("materials")}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">
                        Concrete Grade
                      </label>
                      <select
                        value={formData.concreteGrade}
                        onChange={(e) =>
                          handleChange("concreteGrade", e.target.value)
                        }
                        className="w-full bg-slate-200/50 dark:bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {concreteGrades.map((grade) => (
                          <option key={grade.grade} value={grade.grade}>
                            {grade.grade} (fck = {grade.fck} MPa)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">
                        Steel Grade
                      </label>
                      <select
                        value={formData.steelGrade}
                        onChange={(e) =>
                          handleChange("steelGrade", e.target.value)
                        }
                        className="w-full bg-slate-200/50 dark:bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {steelGrades.map((grade) => (
                          <option key={grade.grade} value={grade.grade}>
                            {grade.grade} (fy = {grade.fy} MPa)
                          </option>
                        ))}
                      </select>
                    </div>
                    <InputField
                      label="Clear Cover"
                      value={formData.cover}
                      onChange={(v) => handleChange("cover", v)}
                      unit="mm"
                    />
                  </div>
                </CollapsibleSection>

                {/* Design Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={runDesign}
                  disabled={isCalculating}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 rounded-xl text-zinc-900 dark:text-white font-bold text-lg shadow-lg shadow-blue-500/25 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isCalculating ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-5 h-5" />
                      Design Beam
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </motion.button>
              </div>

              {/* Preview Panel */}
              <div className="space-y-6">
                <BeamPreview formData={formData} />
                <QuickSummary formData={formData} />
              </div>
            </motion.div>
          )}

          {activeTab === "results" && result && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ResultsPanel result={result} />
            </motion.div>
          )}

          {activeTab === "drawing" && result && (
            <motion.div
              key="drawing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ReinforcementDrawing result={result} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// Sub-components
function InputCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-blue-400">{icon}</div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 hover:bg-slate-700/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-blue-400">{icon}</div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        )}
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-6 pb-6"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  unit,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          disabled={disabled}
          className={`w-full bg-slate-200/50 dark:bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 pr-16 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            disabled ? "opacity-50 cursor-not-allowed" : ""
          }`}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 text-sm">
          {unit}
        </span>
      </div>
    </div>
  );
}

function BeamPreview({ formData }: { formData: BeamFormData }) {
  const svgW = 440;
  const svgH = 340;
  const margin = { top: 30, right: 60, bottom: 50, left: 60 };
  const drawW = svgW - margin.left - margin.right;
  const drawH = svgH - margin.top - margin.bottom;

  // Scale to fit while preserving aspect ratio
  const aspectRatio = formData.b / formData.D;
  let beamW: number, beamH: number;
  if (aspectRatio > drawW / drawH) {
    beamW = drawW;
    beamH = drawW / aspectRatio;
  } else {
    beamH = drawH;
    beamW = drawH * aspectRatio;
  }
  const ox = margin.left + (drawW - beamW) / 2;
  const oy = margin.top + (drawH - beamH) / 2;
  const pxPerMM = beamW / formData.b;

  // Cover in px
  const coverPx = formData.cover * pxPerMM;
  const barRadius = Math.max(3, 10 * pxPerMM);
  const stirrupInset = coverPx;

  // Assume 4 bottom bars, 2 top bars for preview
  const nBot: number = 4;
  const nTop: number = 2;

  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
        <svg className="w-4 h-4" viewBox="0 0 16 16">
          <rect
            x="2"
            y="2"
            width="12"
            height="12"
            rx="1"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.5"
          />
        </svg>
        Cross-Section Preview
      </h3>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full h-72 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <defs>
          <pattern
            id="preview-hatch"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              stroke="#475569"
              strokeWidth="0.4"
            />
          </pattern>
        </defs>

        {formData.beamType === "rectangular" ? (
          <g>
            {/* Concrete section with hatch */}
            <rect
              x={ox}
              y={oy}
              width={beamW}
              height={beamH}
              fill="url(#preview-hatch)"
            />
            <rect
              x={ox}
              y={oy}
              width={beamW}
              height={beamH}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
            />
          </g>
        ) : (
          <g>
            {/* T-beam / L-beam */}
            {(() => {
              const bf = formData.bf || 1200;
              const Df = formData.Df || 120;
              const flangeW = Math.min(bf * pxPerMM, drawW);
              const flangeH = Df * pxPerMM;
              const webW = beamW;
              const webH = beamH - flangeH;
              const fox = margin.left + (drawW - flangeW) / 2;
              const foy = oy;
              const wox = ox;
              const woy = oy + flangeH;
              const path = `M${fox},${foy} h${flangeW} v${flangeH} h-${(flangeW - webW) / 2} v${webH} h-${webW} v-${webH} h-${(flangeW - webW) / 2} Z`;
              return (
                <>
                  <path d={path} fill="url(#preview-hatch)" />
                  <path d={path} fill="none" stroke="#94a3b8" strokeWidth="2" />
                </>
              );
            })()}
          </g>
        )}

        {/* Stirrup rectangle (inside cover) */}
        <rect
          x={ox + stirrupInset}
          y={oy + stirrupInset}
          width={beamW - 2 * stirrupInset}
          height={beamH - 2 * stirrupInset}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
          rx="3"
        />
        {/* 135° hooks on stirrup */}
        <line
          x1={ox + stirrupInset + 8}
          y1={oy + stirrupInset}
          x2={ox + stirrupInset}
          y2={oy + stirrupInset + 10}
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1={ox + beamW - stirrupInset - 8}
          y1={oy + stirrupInset}
          x2={ox + beamW - stirrupInset}
          y2={oy + stirrupInset + 10}
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Bottom bars */}
        {Array.from({ length: nBot }).map((_, i) => {
          const startX = ox + stirrupInset + barRadius + 4;
          const endX = ox + beamW - stirrupInset - barRadius - 4;
          const cx =
            nBot === 1
              ? (startX + endX) / 2
              : startX + (i * (endX - startX)) / (nBot - 1);
          const cy = oy + beamH - stirrupInset - barRadius - 2;
          return (
            <circle
              key={`b${i}`}
              cx={cx}
              cy={cy}
              r={barRadius}
              fill="#ef4444"
              stroke="#991b1b"
              strokeWidth="0.8"
            />
          );
        })}

        {/* Top bars */}
        {Array.from({ length: nTop }).map((_, i) => {
          const startX = ox + stirrupInset + barRadius + 4;
          const endX = ox + beamW - stirrupInset - barRadius - 4;
          const cx =
            nTop === 1
              ? (startX + endX) / 2
              : startX + (i * (endX - startX)) / (nTop - 1);
          const cy = oy + stirrupInset + barRadius + 2;
          return (
            <circle
              key={`t${i}`}
              cx={cx}
              cy={cy}
              r={barRadius * 0.8}
              fill="#f97316"
              stroke="#9a3412"
              strokeWidth="0.8"
            />
          );
        })}

        {/* Cover annotation — bottom */}
        <line
          x1={ox}
          y1={oy + beamH}
          x2={ox}
          y2={oy + beamH - coverPx}
          stroke="#22d3ee"
          strokeWidth="0.8"
        />
        <line
          x1={ox - 8}
          y1={oy + beamH}
          x2={ox + 8}
          y2={oy + beamH}
          stroke="#22d3ee"
          strokeWidth="0.6"
        />
        <line
          x1={ox - 8}
          y1={oy + beamH - coverPx}
          x2={ox + 8}
          y2={oy + beamH - coverPx}
          stroke="#22d3ee"
          strokeWidth="0.6"
        />
        <text
          x={ox - 12}
          y={oy + beamH - coverPx / 2 + 3}
          textAnchor="end"
          fontSize="8"
          fill="#22d3ee"
        >
          {formData.cover}
        </text>

        {/* Dimension: width (bottom) */}
        {/* Extension lines */}
        <line
          x1={ox}
          y1={oy + beamH + 5}
          x2={ox}
          y2={oy + beamH + 22}
          stroke="#a1a1aa"
          strokeWidth="0.5"
        />
        <line
          x1={ox + beamW}
          y1={oy + beamH + 5}
          x2={ox + beamW}
          y2={oy + beamH + 22}
          stroke="#a1a1aa"
          strokeWidth="0.5"
        />
        <line
          x1={ox}
          y1={oy + beamH + 18}
          x2={ox + beamW}
          y2={oy + beamH + 18}
          stroke="#a1a1aa"
          strokeWidth="0.6"
        />
        {/* Ticks */}
        <line
          x1={ox - 3}
          y1={oy + beamH + 21}
          x2={ox + 3}
          y2={oy + beamH + 15}
          stroke="#a1a1aa"
          strokeWidth="0.8"
        />
        <line
          x1={ox + beamW - 3}
          y1={oy + beamH + 21}
          x2={ox + beamW + 3}
          y2={oy + beamH + 15}
          stroke="#a1a1aa"
          strokeWidth="0.8"
        />
        <text
          x={ox + beamW / 2}
          y={oy + beamH + 35}
          textAnchor="middle"
          fontSize="10"
          fill="#a1a1aa"
          fontWeight="500"
        >
          {formData.b} mm
        </text>

        {/* Dimension: depth (right) */}
        <line
          x1={ox + beamW + 5}
          y1={oy}
          x2={ox + beamW + 22}
          y2={oy}
          stroke="#a1a1aa"
          strokeWidth="0.5"
        />
        <line
          x1={ox + beamW + 5}
          y1={oy + beamH}
          x2={ox + beamW + 22}
          y2={oy + beamH}
          stroke="#a1a1aa"
          strokeWidth="0.5"
        />
        <line
          x1={ox + beamW + 18}
          y1={oy}
          x2={ox + beamW + 18}
          y2={oy + beamH}
          stroke="#a1a1aa"
          strokeWidth="0.6"
        />
        <line
          x1={ox + beamW + 15}
          y1={oy - 3}
          x2={ox + beamW + 21}
          y2={oy + 3}
          stroke="#a1a1aa"
          strokeWidth="0.8"
        />
        <line
          x1={ox + beamW + 15}
          y1={oy + beamH - 3}
          x2={ox + beamW + 21}
          y2={oy + beamH + 3}
          stroke="#a1a1aa"
          strokeWidth="0.8"
        />
        <text
          x={ox + beamW + 35}
          y={oy + beamH / 2}
          textAnchor="middle"
          fontSize="10"
          fill="#a1a1aa"
          fontWeight="500"
          transform={`rotate(-90, ${ox + beamW + 35}, ${oy + beamH / 2})`}
        >
          {formData.D} mm
        </text>

        {/* Legend */}
        <g transform={`translate(${margin.left}, ${svgH - 12})`}>
          <circle
            cx="6"
            cy="-2"
            r="4"
            fill="#ef4444"
            stroke="#991b1b"
            strokeWidth="0.5"
          />
          <text x="14" y="2" fontSize="8" fill="#94a3b8">
            Tension bars
          </text>
          <circle
            cx="80"
            cy="-2"
            r="3"
            fill="#f97316"
            stroke="#9a3412"
            strokeWidth="0.5"
          />
          <text x="88" y="2" fontSize="8" fill="#94a3b8">
            Hanger bars
          </text>
          <rect
            x="150"
            y="-5"
            width="12"
            height="6"
            rx="1"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1"
          />
          <text x="166" y="2" fontSize="8" fill="#94a3b8">
            Stirrup
          </text>
        </g>
      </svg>
    </div>
  );
}

function QuickSummary({ formData }: { formData: BeamFormData }) {
  // Quick checks
  const spanDepthRatio = formData.L / formData.D;
  const isRatioOk = spanDepthRatio <= 20;

  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Quick Checks</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
          <span className="text-slate-500 dark:text-slate-400">Span/Depth Ratio</span>
          <div className="flex items-center gap-2">
            <span className="text-zinc-900 dark:text-white font-medium">
              {spanDepthRatio.toFixed(1)}
            </span>
            {isRatioOk ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
            )}
          </div>
        </div>
        <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
          <span className="text-slate-500 dark:text-slate-400">Design Code</span>
          <span className="text-zinc-900 dark:text-white font-medium">{formData.code}</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
          <span className="text-slate-500 dark:text-slate-400">Beam Type</span>
          <span className="text-zinc-900 dark:text-white font-medium capitalize">
            {formData.beamType}
          </span>
        </div>
      </div>
    </div>
  );
}

function ResultsPanel({ result }: { result: BeamDesignResult }) {
  const isDesignOk =
    result.flexure.status === "safe" && result.shear.status === "safe";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Status Card */}
      <div
        className={`col-span-1 lg:col-span-3 p-6 rounded-2xl ${
          isDesignOk
            ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30"
            : "bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30"
        }`}
      >
        <div className="flex items-center gap-4">
          {isDesignOk ? (
            <CheckCircle className="w-12 h-12 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-12 h-12 text-red-400" />
          )}
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {isDesignOk ? "Design OK" : "Design Needs Revision"}
            </h2>
            <p className="text-slate-600 dark:text-slate-300">
              {isDesignOk
                ? "All checks passed. Beam is safe for the applied loads."
                : "One or more checks failed. Please review and modify design."}
            </p>
          </div>
        </div>
      </div>

      {/* Flexural Design */}
      <ResultCard
        title="Flexural Design"
        status={result.flexure.status === "safe" ? "pass" : "fail"}
      >
        <div className="space-y-2">
          <ResultRow
            label="Applied Moment"
            value={`${result.loading.Mu.toFixed(1)} kN-m`}
          />
          <ResultRow
            label="Capacity"
            value={`${result.flexure.Mu_capacity.toFixed(1)} kN-m`}
          />
          <ResultRow
            label="Utilization"
            value={`${(result.flexure.utilizationRatio * 100).toFixed(1)}%`}
          />
          <div className="border-t border-slate-600 pt-2 mt-2">
            <ResultRow
              label="Tension Steel (Ast)"
              value={`${result.flexure.Ast_required.toFixed(0)} mm²`}
            />
            <ResultRow
              label="Bars Provided"
              value={result.flexure.tensionBars
                .map((b) => `${b.count}T${b.diameter}`)
                .join(" + ")}
            />
            {result.flexure.Asc_required > 0 && (
              <>
                <ResultRow
                  label="Compression Steel"
                  value={`${result.flexure.Asc_required.toFixed(0)} mm²`}
                />
                <ResultRow
                  label="Comp. Bars"
                  value={
                    result.flexure.compressionBars
                      .map((b) => `${b.count}T${b.diameter}`)
                      .join(" + ") || "-"
                  }
                />
              </>
            )}
          </div>
        </div>
      </ResultCard>

      {/* Shear Design */}
      <ResultCard
        title="Shear Design"
        status={result.shear.status === "safe" ? "pass" : "fail"}
      >
        <div className="space-y-2">
          <ResultRow
            label="Applied Shear"
            value={`${result.loading.Vu.toFixed(1)} kN`}
          />
          <ResultRow
            label="Concrete Capacity"
            value={`${result.shear.Vuc.toFixed(1)} kN`}
          />
          <ResultRow
            label="Steel Capacity"
            value={`${result.shear.Vus_required.toFixed(1)} kN`}
          />
          <div className="border-t border-slate-600 pt-2 mt-2">
            <ResultRow
              label="Stirrup Legs"
              value={`${result.shear.stirrupLegs}`}
            />
            <ResultRow
              label="Stirrup Spacing"
              value={`${result.shear.stirrupSpacing.toFixed(0)} mm`}
            />
            <ResultRow
              label="Stirrups Provided"
              value={`T${result.shear.stirrupDiameter}@${result.shear.stirrupSpacing.toFixed(0)}c/c`}
            />
          </div>
        </div>
      </ResultCard>

      {/* Serviceability */}
      <ResultCard
        title="Serviceability"
        status={result.deflection?.status === "pass" ? "pass" : "fail"}
      >
        <div className="space-y-2">
          <ResultRow
            label="Span/Depth (actual)"
            value={
              result.deflection?.spanDepthRatio_provided?.toFixed(1) || "-"
            }
          />
          <ResultRow
            label="Limit"
            value={result.deflection?.spanDepthRatio_allowed?.toFixed(1) || "-"}
          />
          {result.crackWidth && (
            <>
              <ResultRow
                label="Crack Width"
                value={`${result.crackWidth.crackWidth.toFixed(2)} mm`}
              />
              <ResultRow
                label="Limit"
                value={`${result.crackWidth.allowableCrackWidth.toFixed(2)} mm`}
              />
            </>
          )}
        </div>
      </ResultCard>

      {/* Export Button */}
      <div className="col-span-1 lg:col-span-3 flex justify-end gap-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-3 bg-slate-200 dark:bg-slate-700 rounded-xl text-zinc-900 dark:text-white font-medium flex items-center gap-2"
        >
          <FileText className="w-5 h-5" />
          Export Report
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl text-white font-medium flex items-center gap-2"
        >
          <Download className="w-5 h-5" />
          Download Drawing
        </motion.button>
      </div>
    </div>
  );
}

function ResultCard({
  title,
  status,
  children,
}: {
  title: string;
  status: "pass" | "fail";
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h3>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            status === "pass"
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {status.toUpperCase()}
        </span>
      </div>
      {children}
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 dark:text-slate-400 text-sm">{label}</span>
      <span className="text-zinc-900 dark:text-white font-medium">{value}</span>
    </div>
  );
}

function ReinforcementDrawing({ result }: { result: BeamDesignResult }) {
  const { geometry, flexure, shear } = result;
  const b = geometry.b;
  const D = geometry.D;
  const d = geometry.d || D - (geometry.cover || 40) - 25;
  const cover = geometry.cover || 40;
  const L = geometry.L || 6000;

  // Tension bars
  const tensionBars = flexure.tensionBars;
  const totalTensionCount = tensionBars.reduce((s, tb) => s + tb.count, 0);
  const mainDia = tensionBars[0]?.diameter || 16;
  // Compression bars
  const compBars = flexure.compressionBars;
  const totalCompCount = compBars.reduce((s, cb) => s + cb.count, 0);
  const compDia = compBars[0]?.diameter || 12;
  // Stirrups
  const stirDia = shear.stirrupDiameter || 8;
  const stirSpacing = shear.stirrupSpacing || 150;
  const stirLegs = shear.stirrupLegs || 2;
  // Derived
  const stirrupPerimeter =
    2 * (b - 2 * cover + 2 * stirDia + (D - 2 * cover + 2 * stirDia)) +
    2 * (10 * stirDia) +
    2 * (6 * stirDia); // Total bar length approx

  // ========= CROSS SECTION (left) =========
  const csW = 280;
  const csH = 420;
  const csMargin = { top: 40, right: 60, bottom: 60, left: 60 };
  const csDrawW = csW - csMargin.left - csMargin.right;
  const csDrawH = csH - csMargin.top - csMargin.bottom;
  const csAspect = b / D;
  let csBW: number, csBH: number;
  if (csAspect > csDrawW / csDrawH) {
    csBW = csDrawW;
    csBH = csDrawW / csAspect;
  } else {
    csBH = csDrawH;
    csBW = csDrawH * csAspect;
  }
  const csOX = csMargin.left + (csDrawW - csBW) / 2;
  const csOY = csMargin.top + (csDrawH - csBH) / 2;
  const csPx = csBW / b; // px per mm
  const coverPx = cover * csPx;
  const barR = Math.max(3, (mainDia * csPx) / 2);
  const compBarR = Math.max(2.5, (compDia * csPx) / 2);
  const stirInset = coverPx;

  // Multi-layer check: if > 4 bars per row, use 2 layers
  const maxPerRow = 4;
  const needsSecondLayer = totalTensionCount > maxPerRow;
  const layer1Count = needsSecondLayer ? maxPerRow : totalTensionCount;
  const layer2Count = needsSecondLayer ? totalTensionCount - maxPerRow : 0;
  const layerSpacing = barR * 3;

  // ========= LONGITUDINAL SECTION (right) =========
  const lsW = 520;
  const lsH = 420;
  const lsMargin = { top: 40, right: 30, bottom: 60, left: 30 };
  const lsDrawW = lsW - lsMargin.left - lsMargin.right;
  const lsDrawH = lsH - lsMargin.top - lsMargin.bottom;
  const beamDrawW = lsDrawW;
  const beamDrawH = lsDrawH;
  const lsOX = lsMargin.left;
  const lsOY = lsMargin.top;
  const lsPxMM = beamDrawH / D;
  const lsCoverPx = cover * lsPxMM;

  // Stirrup zones: IS 456 Cl. 26.5.1.6 — close spacing near supports for 2d distance
  const twoD = 2 * d; // mm
  const twoDpx = (twoD / L) * beamDrawW;
  const closeSpacingMM = Math.min(stirSpacing, 0.75 * d, 300);
  const normalSpacingMM = stirSpacing;
  const closeCount = Math.max(2, Math.ceil(twoD / closeSpacingMM));
  const normalCount = Math.max(4, Math.ceil((L - 2 * twoD) / normalSpacingMM));

  // SVG total
  const totalW = csW + lsW + 20;
  const totalH = Math.max(csH, lsH) + 200; // extra for bar schedule

  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
      <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
        Reinforcement Detailing
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        IS 456:2000 / SP 34:1987 compliant detailing
      </p>

      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        className="w-full bg-slate-50/50 dark:bg-slate-900/50 rounded-xl"
        style={{
          fontFamily: "'JetBrains Mono', 'Consolas', monospace",
          minHeight: "500px",
        }}
      >
        <defs>
          <pattern
            id="rd-hatch"
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="5"
              stroke="#475569"
              strokeWidth="0.35"
            />
          </pattern>
          <marker
            id="rd-arrow"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#a1a1aa" />
          </marker>
          <marker
            id="rd-arrow-cyan"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="3"
            markerHeight="3"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#22d3ee" />
          </marker>
        </defs>

        {/* ==================== CROSS SECTION ==================== */}
        <g>
          <text
            x={csW / 2}
            y={18}
            textAnchor="middle"
            fontSize="12"
            fill="#e2e8f0"
            fontWeight="700"
          >
            CROSS SECTION
          </text>

          {/* Concrete body with hatch */}
          <rect
            x={csOX}
            y={csOY}
            width={csBW}
            height={csBH}
            fill="url(#rd-hatch)"
          />
          <rect
            x={csOX}
            y={csOY}
            width={csBW}
            height={csBH}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
          />

          {/* Stirrup with 135° hooks (IS 13920 Fig. 7A) */}
          <rect
            x={csOX + stirInset}
            y={csOY + stirInset}
            width={csBW - 2 * stirInset}
            height={csBH - 2 * stirInset}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.8"
            rx="3"
          />
          {/* Top-left 135° hook */}
          <line
            x1={csOX + stirInset + 10}
            y1={csOY + stirInset}
            x2={csOX + stirInset + 10 + 12 * Math.cos(Math.PI * 0.75)}
            y2={csOY + stirInset + 12 * Math.sin(Math.PI * 0.75)}
            stroke="#3b82f6"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {/* Top-right 135° hook */}
          <line
            x1={csOX + csBW - stirInset - 10}
            y1={csOY + stirInset}
            x2={csOX + csBW - stirInset - 10 - 12 * Math.cos(Math.PI * 0.75)}
            y2={csOY + stirInset + 12 * Math.sin(Math.PI * 0.75)}
            stroke="#3b82f6"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Cross-tie for 4+ leg stirrup */}
          {stirLegs >= 4 && (
            <line
              x1={csOX + csBW / 2}
              y1={csOY + stirInset}
              x2={csOX + csBW / 2}
              y2={csOY + csBH - stirInset}
              stroke="#3b82f6"
              strokeWidth="1.2"
              strokeDasharray="3,2"
            />
          )}

          {/* Tension bars — Layer 1 */}
          {Array.from({ length: layer1Count }).map((_, i) => {
            const sx = csOX + stirInset + barR + 4;
            const ex = csOX + csBW - stirInset - barR - 4;
            const cx =
              layer1Count === 1
                ? (sx + ex) / 2
                : sx + (i * (ex - sx)) / (layer1Count - 1);
            const cy = csOY + csBH - stirInset - barR - 3;
            return (
              <circle
                key={`t1-${i}`}
                cx={cx}
                cy={cy}
                r={barR}
                fill="#ef4444"
                stroke="#991b1b"
                strokeWidth="0.8"
              />
            );
          })}

          {/* Tension bars — Layer 2 (if needed) */}
          {layer2Count > 0 &&
            Array.from({ length: layer2Count }).map((_, i) => {
              const sx = csOX + stirInset + barR + 4;
              const ex = csOX + csBW - stirInset - barR - 4;
              const cx =
                layer2Count === 1
                  ? (sx + ex) / 2
                  : sx + (i * (ex - sx)) / (layer2Count - 1);
              const cy = csOY + csBH - stirInset - barR - 3 - layerSpacing;
              return (
                <circle
                  key={`t2-${i}`}
                  cx={cx}
                  cy={cy}
                  r={barR}
                  fill="#ef4444"
                  stroke="#991b1b"
                  strokeWidth="0.8"
                />
              );
            })}

          {/* Compression bars (top) */}
          {(() => {
            const nComp = totalCompCount > 0 ? totalCompCount : 2; // At least 2 hanger bars
            const isHanger = totalCompCount === 0;
            const r = isHanger ? compBarR * 0.85 : compBarR;
            const fillC = isHanger ? "#f97316" : "#f97316";
            const strokeC = isHanger ? "#9a3412" : "#9a3412";
            return Array.from({ length: nComp }).map((_, i) => {
              const sx = csOX + stirInset + r + 4;
              const ex = csOX + csBW - stirInset - r - 4;
              const cx =
                nComp === 1
                  ? (sx + ex) / 2
                  : sx + (i * (ex - sx)) / (nComp - 1);
              const cy = csOY + stirInset + r + 3;
              return (
                <circle
                  key={`c-${i}`}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={fillC}
                  stroke={strokeC}
                  strokeWidth="0.8"
                />
              );
            });
          })()}

          {/* Neutral Axis indicator */}
          {(() => {
            const xuPx = (flexure.xu || d * 0.4) * csPx;
            const naY = csOY + Math.min(xuPx, csBH * 0.6);
            return (
              <g>
                <line
                  x1={csOX - 5}
                  y1={naY}
                  x2={csOX + csBW + 5}
                  y2={naY}
                  stroke="#facc15"
                  strokeWidth="0.8"
                  strokeDasharray="5,3"
                />
                <text
                  x={csOX + csBW + 8}
                  y={naY + 3}
                  fontSize="7"
                  fill="#facc15"
                >
                  N.A.
                </text>
              </g>
            );
          })()}

          {/* Clear cover annotation — bottom */}
          {(() => {
            const ax = csOX - 6;
            const y1 = csOY + csBH;
            const y2 = csOY + csBH - coverPx;
            return (
              <g>
                <line
                  x1={ax}
                  y1={y1}
                  x2={ax}
                  y2={y2}
                  stroke="#22d3ee"
                  strokeWidth="0.8"
                  markerStart="url(#rd-arrow-cyan)"
                  markerEnd="url(#rd-arrow-cyan)"
                />
                <text
                  x={ax - 4}
                  y={(y1 + y2) / 2 + 3}
                  textAnchor="end"
                  fontSize="7"
                  fill="#22d3ee"
                  fontWeight="600"
                >
                  {cover}
                </text>
              </g>
            );
          })()}

          {/* Clear cover annotation — side */}
          {(() => {
            const ay = csOY + csBH + 6;
            const x1 = csOX;
            const x2 = csOX + coverPx;
            return (
              <g>
                <line
                  x1={x1}
                  y1={ay}
                  x2={x2}
                  y2={ay}
                  stroke="#22d3ee"
                  strokeWidth="0.8"
                />
                <line
                  x1={x1}
                  y1={ay - 3}
                  x2={x1}
                  y2={ay + 3}
                  stroke="#22d3ee"
                  strokeWidth="0.6"
                />
                <line
                  x1={x2}
                  y1={ay - 3}
                  x2={x2}
                  y2={ay + 3}
                  stroke="#22d3ee"
                  strokeWidth="0.6"
                />
                <text
                  x={(x1 + x2) / 2}
                  y={ay + 10}
                  textAnchor="middle"
                  fontSize="7"
                  fill="#22d3ee"
                >
                  {cover}
                </text>
              </g>
            );
          })()}

          {/* Width dimension */}
          {(() => {
            const dy = csOY + csBH + 24;
            return (
              <g>
                <line
                  x1={csOX}
                  y1={csOY + csBH + 3}
                  x2={csOX}
                  y2={dy + 4}
                  stroke="#a1a1aa"
                  strokeWidth="0.5"
                />
                <line
                  x1={csOX + csBW}
                  y1={csOY + csBH + 3}
                  x2={csOX + csBW}
                  y2={dy + 4}
                  stroke="#a1a1aa"
                  strokeWidth="0.5"
                />
                <line
                  x1={csOX}
                  y1={dy}
                  x2={csOX + csBW}
                  y2={dy}
                  stroke="#a1a1aa"
                  strokeWidth="0.6"
                />
                <line
                  x1={csOX - 3}
                  y1={dy + 3}
                  x2={csOX + 3}
                  y2={dy - 3}
                  stroke="#a1a1aa"
                  strokeWidth="0.8"
                />
                <line
                  x1={csOX + csBW - 3}
                  y1={dy + 3}
                  x2={csOX + csBW + 3}
                  y2={dy - 3}
                  stroke="#a1a1aa"
                  strokeWidth="0.8"
                />
                <text
                  x={csOX + csBW / 2}
                  y={dy + 14}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#a1a1aa"
                  fontWeight="500"
                >
                  {b} mm
                </text>
              </g>
            );
          })()}

          {/* Depth dimension */}
          {(() => {
            const dx = csOX + csBW + 24;
            return (
              <g>
                <line
                  x1={csOX + csBW + 3}
                  y1={csOY}
                  x2={dx + 4}
                  y2={csOY}
                  stroke="#a1a1aa"
                  strokeWidth="0.5"
                />
                <line
                  x1={csOX + csBW + 3}
                  y1={csOY + csBH}
                  x2={dx + 4}
                  y2={csOY + csBH}
                  stroke="#a1a1aa"
                  strokeWidth="0.5"
                />
                <line
                  x1={dx}
                  y1={csOY}
                  x2={dx}
                  y2={csOY + csBH}
                  stroke="#a1a1aa"
                  strokeWidth="0.6"
                />
                <line
                  x1={dx - 3}
                  y1={csOY + 3}
                  x2={dx + 3}
                  y2={csOY - 3}
                  stroke="#a1a1aa"
                  strokeWidth="0.8"
                />
                <line
                  x1={dx - 3}
                  y1={csOY + csBH + 3}
                  x2={dx + 3}
                  y2={csOY + csBH - 3}
                  stroke="#a1a1aa"
                  strokeWidth="0.8"
                />
                <text
                  x={dx + 14}
                  y={csOY + csBH / 2}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#a1a1aa"
                  fontWeight="500"
                  transform={`rotate(-90, ${dx + 14}, ${csOY + csBH / 2})`}
                >
                  {D} mm
                </text>
              </g>
            );
          })()}

          {/* Effective depth dim (d) */}
          {(() => {
            const dx = csOX + csBW + 40;
            const dPx = d * csPx;
            return (
              <g>
                <line
                  x1={csOX + csBW + 3}
                  y1={csOY}
                  x2={dx + 4}
                  y2={csOY}
                  stroke="#6366f1"
                  strokeWidth="0.4"
                  strokeDasharray="2,2"
                />
                <line
                  x1={csOX + csBW + 3}
                  y1={csOY + dPx}
                  x2={dx + 4}
                  y2={csOY + dPx}
                  stroke="#6366f1"
                  strokeWidth="0.4"
                  strokeDasharray="2,2"
                />
                <line
                  x1={dx}
                  y1={csOY}
                  x2={dx}
                  y2={csOY + dPx}
                  stroke="#6366f1"
                  strokeWidth="0.6"
                />
                <text
                  x={dx + 10}
                  y={csOY + dPx / 2}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#6366f1"
                  transform={`rotate(-90, ${dx + 10}, ${csOY + dPx / 2})`}
                >
                  d = {Math.round(d)} mm
                </text>
              </g>
            );
          })()}

          {/* Bar labels callout */}
          {(() => {
            const botCY = csOY + csBH - stirInset - barR - 3;
            const topCY = csOY + stirInset + compBarR + 3;
            return (
              <g>
                {/* Bottom bar label */}
                <line
                  x1={csOX + csBW - stirInset - barR - 4}
                  y1={botCY}
                  x2={csOX + csBW + 10}
                  y2={botCY - 15}
                  stroke="#71717a"
                  strokeWidth="0.5"
                />
                <line
                  x1={csOX + csBW + 10}
                  y1={botCY - 15}
                  x2={csOX + csBW + 40}
                  y2={botCY - 15}
                  stroke="#71717a"
                  strokeWidth="0.5"
                />
                <text
                  x={csOX + csBW + 42}
                  y={botCY - 12}
                  fontSize="7"
                  fill="#e2e8f0"
                >
                  {tensionBars
                    .map((tb) => `${tb.count}-T${tb.diameter}`)
                    .join(" + ")}
                </text>
                {/* Top bar label */}
                <line
                  x1={csOX + csBW - stirInset - compBarR - 4}
                  y1={topCY}
                  x2={csOX + csBW + 10}
                  y2={topCY + 15}
                  stroke="#71717a"
                  strokeWidth="0.5"
                />
                <line
                  x1={csOX + csBW + 10}
                  y1={topCY + 15}
                  x2={csOX + csBW + 40}
                  y2={topCY + 15}
                  stroke="#71717a"
                  strokeWidth="0.5"
                />
                <text
                  x={csOX + csBW + 42}
                  y={topCY + 18}
                  fontSize="7"
                  fill="#e2e8f0"
                >
                  {totalCompCount > 0
                    ? compBars
                        .map((cb) => `${cb.count}-T${cb.diameter}`)
                        .join(" + ")
                    : `2-T${compDia} (hanger)`}
                </text>
              </g>
            );
          })()}
        </g>

        {/* ==================== LONGITUDINAL SECTION ==================== */}
        <g transform={`translate(${csW + 20}, 0)`}>
          <text
            x={lsW / 2}
            y={18}
            textAnchor="middle"
            fontSize="12"
            fill="#e2e8f0"
            fontWeight="700"
          >
            LONGITUDINAL SECTION
          </text>

          {/* Beam outline */}
          <rect
            x={lsOX}
            y={lsOY}
            width={beamDrawW}
            height={beamDrawH}
            fill="url(#rd-hatch)"
            opacity="0.3"
          />
          <rect
            x={lsOX}
            y={lsOY}
            width={beamDrawW}
            height={beamDrawH}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
          />

          {/* Supports — left (fixed/pinned) */}
          <polygon
            points={`${lsOX},${lsOY + beamDrawH} ${lsOX - 8},${lsOY + beamDrawH + 14} ${lsOX + 8},${lsOY + beamDrawH + 14}`}
            fill="none"
            stroke="#a1a1aa"
            strokeWidth="1"
          />
          <line
            x1={lsOX - 12}
            y1={lsOY + beamDrawH + 16}
            x2={lsOX + 12}
            y2={lsOY + beamDrawH + 16}
            stroke="#a1a1aa"
            strokeWidth="1"
          />

          {/* Supports — right (roller) */}
          <polygon
            points={`${lsOX + beamDrawW},${lsOY + beamDrawH} ${lsOX + beamDrawW - 8},${lsOY + beamDrawH + 14} ${lsOX + beamDrawW + 8},${lsOY + beamDrawH + 14}`}
            fill="none"
            stroke="#a1a1aa"
            strokeWidth="1"
          />
          <circle
            cx={lsOX + beamDrawW - 4}
            cy={lsOY + beamDrawH + 17}
            r="2"
            fill="none"
            stroke="#a1a1aa"
            strokeWidth="0.8"
          />
          <circle
            cx={lsOX + beamDrawW + 4}
            cy={lsOY + beamDrawH + 17}
            r="2"
            fill="none"
            stroke="#a1a1aa"
            strokeWidth="0.8"
          />

          {/* Top bars (continuous) */}
          <line
            x1={lsOX + 6}
            y1={lsOY + lsCoverPx + 6}
            x2={lsOX + beamDrawW - 6}
            y2={lsOY + lsCoverPx + 6}
            stroke="#f97316"
            strokeWidth="2.5"
          />
          <text
            x={lsOX + beamDrawW - 4}
            y={lsOY + lsCoverPx + 3}
            fontSize="7"
            fill="#f97316"
            textAnchor="start"
          >
            {totalCompCount > 0
              ? compBars.map((cb) => `${cb.count}T${cb.diameter}`).join("+")
              : `2T${compDia}`}
          </text>

          {/* Bottom bars (main tension — continuous) */}
          <line
            x1={lsOX + 6}
            y1={lsOY + beamDrawH - lsCoverPx - 6}
            x2={lsOX + beamDrawW - 6}
            y2={lsOY + beamDrawH - lsCoverPx - 6}
            stroke="#ef4444"
            strokeWidth="3.5"
          />
          <text
            x={lsOX + beamDrawW - 4}
            y={lsOY + beamDrawH - lsCoverPx - 3}
            fontSize="7"
            fill="#ef4444"
            textAnchor="start"
          >
            {tensionBars.map((tb) => `${tb.count}T${tb.diameter}`).join("+")}
          </text>

          {/* Curtailment bars – bent up at L/7 from support (IS 456 Cl. 26.2.3) */}
          {totalTensionCount > 2 &&
            (() => {
              const curtailFrac = 1 / 7;
              const cLeftPx = curtailFrac * beamDrawW;
              const cRightPx = (1 - curtailFrac) * beamDrawW;
              const topY = lsOY + lsCoverPx + 6;
              const botY = lsOY + beamDrawH - lsCoverPx - 6;
              return (
                <g>
                  {/* Left bent-up bar */}
                  <polyline
                    points={`${lsOX + 6},${botY} ${lsOX + cLeftPx},${botY} ${lsOX + cLeftPx + 15},${topY}`}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.2"
                    strokeDasharray="4,2"
                  />
                  {/* Right bent-up bar */}
                  <polyline
                    points={`${lsOX + beamDrawW - 6},${botY} ${lsOX + cRightPx},${botY} ${lsOX + cRightPx - 15},${topY}`}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.2"
                    strokeDasharray="4,2"
                  />
                  {/* Annotations */}
                  <text
                    x={lsOX + cLeftPx}
                    y={lsOY + beamDrawH / 2}
                    fontSize="6"
                    fill="#ef4444"
                    textAnchor="middle"
                    transform={`rotate(-60, ${lsOX + cLeftPx + 8}, ${lsOY + beamDrawH / 2})`}
                  >
                    L/7
                  </text>
                  <text
                    x={lsOX + cRightPx}
                    y={lsOY + beamDrawH / 2}
                    fontSize="6"
                    fill="#ef4444"
                    textAnchor="middle"
                    transform={`rotate(60, ${lsOX + cRightPx - 8}, ${lsOY + beamDrawH / 2})`}
                  >
                    L/7
                  </text>
                </g>
              );
            })()}

          {/* Stirrups — close spacing zone (2d from support) */}
          {Array.from({ length: closeCount }).map((_, i) => {
            const xPos = lsOX + 8 + i * (twoDpx / closeCount);
            return (
              <line
                key={`csl-${i}`}
                x1={xPos}
                y1={lsOY + 4}
                x2={xPos}
                y2={lsOY + beamDrawH - 4}
                stroke="#3b82f6"
                strokeWidth="1"
              />
            );
          })}
          {/* Right close spacing zone */}
          {Array.from({ length: closeCount }).map((_, i) => {
            const xPos = lsOX + beamDrawW - 8 - i * (twoDpx / closeCount);
            return (
              <line
                key={`csr-${i}`}
                x1={xPos}
                y1={lsOY + 4}
                x2={xPos}
                y2={lsOY + beamDrawH - 4}
                stroke="#3b82f6"
                strokeWidth="1"
              />
            );
          })}
          {/* Normal spacing zone (mid-span) */}
          {Array.from({ length: normalCount }).map((_, i) => {
            const midStart = lsOX + twoDpx + 10;
            const midEnd = lsOX + beamDrawW - twoDpx - 10;
            const xPos =
              midStart +
              (i * (midEnd - midStart)) / Math.max(1, normalCount - 1);
            return (
              <line
                key={`ns-${i}`}
                x1={xPos}
                y1={lsOY + 4}
                x2={xPos}
                y2={lsOY + beamDrawH - 4}
                stroke="#3b82f6"
                strokeWidth="0.8"
                strokeDasharray="none"
              />
            );
          })}

          {/* Stirrup spacing annotations */}
          {(() => {
            const annY = lsOY - 8;
            return (
              <g>
                {/* Close zone left */}
                <line
                  x1={lsOX + 4}
                  y1={annY}
                  x2={lsOX + twoDpx}
                  y2={annY}
                  stroke="#3b82f6"
                  strokeWidth="0.6"
                />
                <text
                  x={lsOX + twoDpx / 2}
                  y={annY - 3}
                  textAnchor="middle"
                  fontSize="6"
                  fill="#3b82f6"
                >
                  T{stirDia}@{Math.round(closeSpacingMM)}c/c
                </text>
                {/* Normal zone center */}
                <line
                  x1={lsOX + twoDpx + 5}
                  y1={annY}
                  x2={lsOX + beamDrawW - twoDpx - 5}
                  y2={annY}
                  stroke="#3b82f6"
                  strokeWidth="0.6"
                />
                <text
                  x={lsOX + beamDrawW / 2}
                  y={annY - 3}
                  textAnchor="middle"
                  fontSize="6"
                  fill="#3b82f6"
                >
                  T{stirDia}@{Math.round(normalSpacingMM)}c/c
                </text>
                {/* Close zone right */}
                <line
                  x1={lsOX + beamDrawW - twoDpx}
                  y1={annY}
                  x2={lsOX + beamDrawW - 4}
                  y2={annY}
                  stroke="#3b82f6"
                  strokeWidth="0.6"
                />
                <text
                  x={lsOX + beamDrawW - twoDpx / 2}
                  y={annY - 3}
                  textAnchor="middle"
                  fontSize="6"
                  fill="#3b82f6"
                >
                  T{stirDia}@{Math.round(closeSpacingMM)}c/c
                </text>
              </g>
            );
          })()}

          {/* Span dimension below */}
          {(() => {
            const dy = lsOY + beamDrawH + 30;
            return (
              <g>
                <line
                  x1={lsOX}
                  y1={lsOY + beamDrawH + 5}
                  x2={lsOX}
                  y2={dy + 4}
                  stroke="#a1a1aa"
                  strokeWidth="0.5"
                />
                <line
                  x1={lsOX + beamDrawW}
                  y1={lsOY + beamDrawH + 5}
                  x2={lsOX + beamDrawW}
                  y2={dy + 4}
                  stroke="#a1a1aa"
                  strokeWidth="0.5"
                />
                <line
                  x1={lsOX}
                  y1={dy}
                  x2={lsOX + beamDrawW}
                  y2={dy}
                  stroke="#a1a1aa"
                  strokeWidth="0.6"
                />
                <line
                  x1={lsOX - 3}
                  y1={dy + 3}
                  x2={lsOX + 3}
                  y2={dy - 3}
                  stroke="#a1a1aa"
                  strokeWidth="0.8"
                />
                <line
                  x1={lsOX + beamDrawW - 3}
                  y1={dy + 3}
                  x2={lsOX + beamDrawW + 3}
                  y2={dy - 3}
                  stroke="#a1a1aa"
                  strokeWidth="0.8"
                />
                <text
                  x={lsOX + beamDrawW / 2}
                  y={dy + 14}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#a1a1aa"
                  fontWeight="500"
                >
                  {L} mm
                </text>
              </g>
            );
          })()}

          {/* Section cut markers — "A-A" */}
          {(() => {
            const cutX = lsOX + beamDrawW * 0.45;
            const r = 7;
            return (
              <g>
                <line
                  x1={cutX}
                  y1={lsOY - 16}
                  x2={cutX}
                  y2={lsOY + beamDrawH + 16}
                  stroke="#f43f5e"
                  strokeWidth="0.8"
                  strokeDasharray="8,3,2,3"
                />
                <circle
                  cx={cutX}
                  cy={lsOY - 16}
                  r={r}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="1"
                />
                <text
                  x={cutX}
                  y={lsOY - 12.5}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#f43f5e"
                  fontWeight="700"
                >
                  A
                </text>
                <circle
                  cx={cutX}
                  cy={lsOY + beamDrawH + 16}
                  r={r}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="1"
                />
                <text
                  x={cutX}
                  y={lsOY + beamDrawH + 19.5}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#f43f5e"
                  fontWeight="700"
                >
                  A
                </text>
              </g>
            );
          })()}
        </g>

        {/* ==================== LEGEND ==================== */}
        <g transform={`translate(20, ${Math.max(csH, lsH) + 10})`}>
          <text x="0" y="0" fontSize="11" fill="#e2e8f0" fontWeight="700">
            REINFORCEMENT SCHEDULE
          </text>
          <g transform="translate(0, 18)">
            <circle
              cx="8"
              cy="4"
              r="5"
              fill="#ef4444"
              stroke="#991b1b"
              strokeWidth="0.8"
            />
            <text x="20" y="8" fontSize="9" fill="#94a3b8">
              Main tension:{" "}
              {tensionBars
                .map((tb) => `${tb.count}-T${tb.diameter}`)
                .join(" + ")}
            </text>
          </g>
          <g transform="translate(200, 18)">
            <circle
              cx="8"
              cy="4"
              r="4"
              fill="#f97316"
              stroke="#9a3412"
              strokeWidth="0.8"
            />
            <text x="20" y="8" fontSize="9" fill="#94a3b8">
              Comp/hanger:{" "}
              {totalCompCount > 0
                ? compBars
                    .map((cb) => `${cb.count}-T${cb.diameter}`)
                    .join(" + ")
                : `2-T${compDia}`}
            </text>
          </g>
          <g transform="translate(430, 18)">
            <rect
              x="0"
              y="-1"
              width="16"
              height="10"
              rx="2"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1.5"
            />
            <text x="22" y="8" fontSize="9" fill="#94a3b8">
              Stirrup: T{stirDia}@{Math.round(stirSpacing)}c/c ({stirLegs}L)
            </text>
          </g>
          <g transform="translate(630, 18)">
            <line
              x1="0"
              y1="4"
              x2="16"
              y2="4"
              stroke="#facc15"
              strokeWidth="1"
              strokeDasharray="4,2"
            />
            <text x="22" y="8" fontSize="9" fill="#94a3b8">
              Neutral axis
            </text>
          </g>
          <g transform="translate(0, 38)">
            <line
              x1="0"
              y1="4"
              x2="16"
              y2="4"
              stroke="#22d3ee"
              strokeWidth="1"
            />
            <text x="22" y="8" fontSize="9" fill="#94a3b8">
              Clear cover = {cover} mm
            </text>
          </g>
          <g transform="translate(200, 38)">
            <line
              x1="0"
              y1="4"
              x2="16"
              y2="4"
              stroke="#ef4444"
              strokeWidth="1"
              strokeDasharray="4,2"
            />
            <text x="22" y="8" fontSize="9" fill="#94a3b8">
              Bent-up bar (curtailment)
            </text>
          </g>
          <g transform="translate(430, 38)">
            <line
              x1="0"
              y1="4"
              x2="16"
              y2="4"
              stroke="#f43f5e"
              strokeWidth="0.8"
              strokeDasharray="8,3,2,3"
            />
            <text x="22" y="8" fontSize="9" fill="#94a3b8">
              Section cut
            </text>
          </g>
        </g>

        {/* Design notes */}
        <g transform={`translate(20, ${Math.max(csH, lsH) + 72})`}>
          <text x="0" y="0" fontSize="8" fill="#64748b">
            Notes:
          </text>
          <text x="0" y="12" fontSize="7" fill="#64748b">
            1. All dimensions in mm. Cover as per IS 456 Cl. 26.4.
          </text>
          <text x="0" y="22" fontSize="7" fill="#64748b">
            2. Stirrup hooks: 135° per IS 13920 for seismic detailing.
          </text>
          <text x="0" y="32" fontSize="7" fill="#64748b">
            3. Curtailment per IS 456 Cl. 26.2.3. Close stirrup spacing within
            2d from support face.
          </text>
          <text x="0" y="42" fontSize="7" fill="#64748b">
            4. Lap length ={" "}
            {flexure.sectionType === "singly-reinforced" ? "40" : "50"}d per IS
            456 Cl. 26.2.5.
          </text>
        </g>
      </svg>

      {/* Bar Bend Schedule Table */}
      <div className="mt-6 overflow-x-auto">
        <h4 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">
          Bar Bending Schedule
        </h4>
        <table className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-slate-700/60">
              <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                Bar Mark
              </th>
              <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                Type
              </th>
              <th className="text-center py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                Dia (mm)
              </th>
              <th className="text-center py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                No.
              </th>
              <th className="text-center py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                Cutting Length (mm)
              </th>
              <th className="text-center py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                Shape (IS 2502)
              </th>
              <th className="text-center py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                Total Wt (kg)
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Mark A — Main tension bars */}
            <tr className="border-b border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-700/30">
              <td className="py-3 px-4 font-bold text-red-400">A</td>
              <td className="py-3 px-4 text-zinc-900 dark:text-white">Main Tension</td>
              <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">{mainDia}</td>
              <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">
                {totalTensionCount}
              </td>
              <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">
                {L + 2 * (40 * mainDia) - 2 * cover}
              </td>
              <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">Straight</td>
              <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">
                {(
                  (((totalTensionCount *
                    (L + 2 * 40 * mainDia - 2 * cover) *
                    Math.PI *
                    mainDia *
                    mainDia) /
                    4) *
                    7850) /
                  1e9
                ).toFixed(1)}
              </td>
            </tr>
            {/* Mark B — Compression / hanger bars */}
            <tr className="border-b border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-700/30">
              <td className="py-3 px-4 font-bold text-orange-400">B</td>
              <td className="py-3 px-4 text-zinc-900 dark:text-white">
                {totalCompCount > 0 ? "Compression" : "Hanger"}
              </td>
              <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">{compDia}</td>
              <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">
                {totalCompCount > 0 ? totalCompCount : 2}
              </td>
              <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">
                {L - 2 * cover}
              </td>
              <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">Straight</td>
              <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">
                {(
                  ((((totalCompCount || 2) *
                    (L - 2 * cover) *
                    Math.PI *
                    compDia *
                    compDia) /
                    4) *
                    7850) /
                  1e9
                ).toFixed(1)}
              </td>
            </tr>
            {/* Mark C — Stirrups */}
            <tr className="border-b border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-700/30">
              <td className="py-3 px-4 font-bold text-blue-400">C</td>
              <td className="py-3 px-4 text-zinc-900 dark:text-white">{stirLegs}L Stirrup</td>
              <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">{stirDia}</td>
              <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">
                {Math.ceil(L / stirSpacing) + 1}
              </td>
              <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">
                {Math.round(
                  2 * (b - 2 * cover + 2 * stirDia) +
                    2 * (D - 2 * cover + 2 * stirDia) +
                    2 * 10 * stirDia,
                )}
              </td>
              <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">
                2L Stirrup (135° hooks)
              </td>
              <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">
                {(
                  ((((Math.ceil(L / stirSpacing) + 1) *
                    (2 * (b - 2 * cover + 2 * stirDia) +
                      2 * (D - 2 * cover + 2 * stirDia) +
                      2 * 10 * stirDia) *
                    Math.PI *
                    stirDia *
                    stirDia) /
                    4) *
                    7850) /
                  1e9
                ).toFixed(1)}
              </td>
            </tr>
            {/* Bent-up bars if any */}
            {totalTensionCount > 2 && (
              <tr className="border-b border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-700/30">
                <td className="py-3 px-4 font-bold text-red-300">D</td>
                <td className="py-3 px-4 text-zinc-900 dark:text-white">Bent-up Bar</td>
                <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">{mainDia}</td>
                <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">2</td>
                <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">
                  {Math.round(L * 0.75)}
                </td>
                <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">
                  Bent-up (45°)
                </td>
                <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">
                  {(
                    (((2 * L * 0.75 * Math.PI * mainDia * mainDia) / 4) *
                      7850) /
                    1e9
                  ).toFixed(1)}
                </td>
              </tr>
            )}
            {/* Total row */}
            <tr className="bg-slate-700/40 font-semibold">
              <td colSpan={6} className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">
                Total Steel Weight
              </td>
              <td className="py-3 px-4 text-center text-zinc-900 dark:text-white">
                {(() => {
                  const Abar = (dia: number) => (Math.PI * dia * dia) / 4;
                  const rho = 7850 / 1e9; // kg/mm³
                  const lDev = 40 * mainDia;
                  const mainWt =
                    totalTensionCount *
                    (L + 2 * lDev - 2 * cover) *
                    Abar(mainDia) *
                    rho;
                  const compWt =
                    (totalCompCount || 2) *
                    (L - 2 * cover) *
                    Abar(compDia) *
                    rho;
                  const nStir = Math.ceil(L / stirSpacing) + 1;
                  const stirLen =
                    2 * (b - 2 * cover + 2 * stirDia) +
                    2 * (D - 2 * cover + 2 * stirDia) +
                    2 * 10 * stirDia;
                  const stirWt = nStir * stirLen * Abar(stirDia) * rho;
                  const bentWt =
                    totalTensionCount > 2
                      ? 2 * L * 0.75 * Abar(mainDia) * rho
                      : 0;
                  return (mainWt + compWt + stirWt + bentWt).toFixed(1);
                })()}{" "}
                kg
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
