/**
 * ============================================================================
 * RC COLUMN DESIGNER COMPONENT
 * ============================================================================
 *
 * Ultra-modern React component for reinforced concrete column design.
 * Features biaxial bending, interaction diagrams, and slenderness analysis.
 *
 * @version 1.0.0
 */

"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator,
  Settings,
  FileText,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Columns,
  ArrowRight,
  Download,
  RefreshCw,
  Zap,
  Box,
  Target,
  Activity,
  TrendingUp,
  Circle,
  Square,
} from "lucide-react";

// Import design engine
import {
  RCColumnDesignEngine,
  ColumnDesignResult,
  ReinforcementLayout,
  SlendernessResult,
  InteractionPoint,
  designRectangularColumn,
} from "@/modules/concrete/RCColumnDesignEngine";
import {
  DesignCode,
  getConcreteGrades,
  getSteelGrades,
  REBAR_SIZES,
} from "@/modules/concrete/RCDesignConstants";

// Types
interface ColumnFormData {
  columnType: "rectangular" | "circular";
  b: number;
  D: number;
  diameter?: number;
  L: number;
  Pu: number;
  Mux: number;
  Muy: number;
  endConditionX:
    | "fixed-fixed"
    | "fixed-pinned"
    | "pinned-pinned"
    | "fixed-free";
  endConditionY:
    | "fixed-fixed"
    | "fixed-pinned"
    | "pinned-pinned"
    | "fixed-free";
  braced: boolean;
  code: DesignCode;
  concreteGrade: string;
  steelGrade: string;
  cover: number;
}

// Default values
const defaultFormData: ColumnFormData = {
  columnType: "rectangular",
  b: 400,
  D: 400,
  L: 3500,
  Pu: 2000,
  Mux: 120,
  Muy: 80,
  endConditionX: "fixed-fixed",
  endConditionY: "fixed-fixed",
  braced: true,
  code: "IS456",
  concreteGrade: "M30",
  steelGrade: "Fe500",
  cover: 40,
};

// Component
export default function RCColumnDesigner() {
  const [formData, setFormData] = useState<ColumnFormData>(defaultFormData);
  const [result, setResult] = useState<ColumnDesignResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "input" | "results" | "interaction"
  >("input");
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    geometry: true,
    loading: true,
    boundary: false,
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
    (field: keyof ColumnFormData, value: number | string | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  // Toggle section
  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // Calculate slenderness preview
  const slendernessPreview = useMemo(() => {
    const Le = formData.L * getEffectiveLengthFactor(formData.endConditionX);
    const lambda =
      Le /
      (formData.columnType === "rectangular"
        ? formData.D / Math.sqrt(12)
        : (formData.diameter || 400) / 4);
    return {
      lambda: lambda.toFixed(1),
      isSlender: lambda > 12,
      type: lambda > 12 ? "Slender" : "Short",
    };
  }, [
    formData.L,
    formData.D,
    formData.diameter,
    formData.endConditionX,
    formData.columnType,
  ]);

  // Run design calculation
  const runDesign = useCallback(async () => {
    setIsCalculating(true);

    await new Promise((resolve) => setTimeout(resolve, 600));

    const selectedConcrete =
      concreteGrades.find((g) => g.grade === formData.concreteGrade) ||
      concreteGrades[2];
    const selectedSteel =
      steelGrades.find((g) => g.grade === formData.steelGrade) ||
      steelGrades[1];

    try {
      const designResult = designRectangularColumn(
        formData.b,
        formData.D,
        formData.L,
        formData.Pu,
        formData.Mux,
        formData.Muy,
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                <Columns className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  RC Column Designer
                </h1>
                <p className="text-sm text-slate-400">
                  Uniaxial & biaxial bending with slenderness analysis
                </p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 bg-slate-700/50 rounded-xl p-1">
              {(["input", "results", "interaction"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab
                      ? "bg-purple-500 text-white shadow-lg"
                      : "text-slate-400 hover:text-white hover:bg-slate-600/50"
                  }`}
                >
                  {tab === "interaction"
                    ? "P-M Diagram"
                    : tab.charAt(0).toUpperCase() + tab.slice(1)}
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
                              ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                              : "bg-slate-700/50 text-slate-300 hover:bg-slate-600/50"
                          }`}
                        >
                          {code}
                        </button>
                      ),
                    )}
                  </div>
                </InputCard>

                {/* Column Type */}
                <InputCard
                  title="Column Shape"
                  icon={<Box className="w-5 h-5" />}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleChange("columnType", "rectangular")}
                      className={`py-6 rounded-xl text-sm font-medium transition-all flex flex-col items-center gap-3 ${
                        formData.columnType === "rectangular"
                          ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                          : "bg-slate-700/50 text-slate-300 hover:bg-slate-600/50"
                      }`}
                    >
                      <Square className="w-10 h-10" />
                      Rectangular
                    </button>
                    <button
                      onClick={() => handleChange("columnType", "circular")}
                      className={`py-6 rounded-xl text-sm font-medium transition-all flex flex-col items-center gap-3 ${
                        formData.columnType === "circular"
                          ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                          : "bg-slate-700/50 text-slate-300 hover:bg-slate-600/50"
                      }`}
                    >
                      <Circle className="w-10 h-10" />
                      Circular
                    </button>
                  </div>
                </InputCard>

                {/* Geometry */}
                <CollapsibleSection
                  title="Geometry"
                  icon={<Box className="w-5 h-5" />}
                  isExpanded={expandedSections.geometry}
                  onToggle={() => toggleSection("geometry")}
                >
                  <div className="grid grid-cols-2 gap-4">
                    {formData.columnType === "rectangular" ? (
                      <>
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
                      </>
                    ) : (
                      <div className="col-span-2">
                        <InputField
                          label="Diameter"
                          value={formData.diameter || 450}
                          onChange={(v) => handleChange("diameter", v)}
                          unit="mm"
                        />
                      </div>
                    )}
                    <InputField
                      label="Unsupported Length (L)"
                      value={formData.L}
                      onChange={(v) => handleChange("L", v)}
                      unit="mm"
                    />
                    <InputField
                      label="Clear Cover"
                      value={formData.cover}
                      onChange={(v) => handleChange("cover", v)}
                      unit="mm"
                    />
                  </div>
                </CollapsibleSection>

                {/* Loading */}
                <CollapsibleSection
                  title="Loading (Factored)"
                  icon={<Activity className="w-5 h-5" />}
                  isExpanded={expandedSections.loading}
                  onToggle={() => toggleSection("loading")}
                >
                  <div className="grid grid-cols-1 gap-4">
                    <InputField
                      label="Axial Load (Pu)"
                      value={formData.Pu}
                      onChange={(v) => handleChange("Pu", v)}
                      unit="kN"
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <InputField
                        label="Moment about X (Mux)"
                        value={formData.Mux}
                        onChange={(v) => handleChange("Mux", v)}
                        unit="kN-m"
                      />
                      <InputField
                        label="Moment about Y (Muy)"
                        value={formData.Muy}
                        onChange={(v) => handleChange("Muy", v)}
                        unit="kN-m"
                      />
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Boundary Conditions */}
                <CollapsibleSection
                  title="Boundary Conditions"
                  icon={<Target className="w-5 h-5" />}
                  isExpanded={expandedSections.boundary}
                  onToggle={() => toggleSection("boundary")}
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">
                        End Condition (X-axis)
                      </label>
                      <select
                        value={formData.endConditionX}
                        onChange={(e) =>
                          handleChange("endConditionX", e.target.value)
                        }
                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="fixed-fixed">
                          Fixed-Fixed (k=0.65)
                        </option>
                        <option value="fixed-pinned">
                          Fixed-Pinned (k=0.80)
                        </option>
                        <option value="pinned-pinned">
                          Pinned-Pinned (k=1.00)
                        </option>
                        <option value="fixed-free">Fixed-Free (k=2.00)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">
                        End Condition (Y-axis)
                      </label>
                      <select
                        value={formData.endConditionY}
                        onChange={(e) =>
                          handleChange("endConditionY", e.target.value)
                        }
                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="fixed-fixed">
                          Fixed-Fixed (k=0.65)
                        </option>
                        <option value="fixed-pinned">
                          Fixed-Pinned (k=0.80)
                        </option>
                        <option value="pinned-pinned">
                          Pinned-Pinned (k=1.00)
                        </option>
                        <option value="fixed-free">Fixed-Free (k=2.00)</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-slate-700/30 rounded-lg">
                      <input
                        type="checkbox"
                        id="braced"
                        checked={formData.braced}
                        onChange={(e) =>
                          handleChange("braced", e.target.checked)
                        }
                        className="w-5 h-5 rounded bg-slate-600 border-slate-500 text-purple-500 focus:ring-purple-500"
                      />
                      <label htmlFor="braced" className="text-white">
                        Braced Column (No lateral sway)
                      </label>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Materials */}
                <CollapsibleSection
                  title="Materials"
                  icon={<Zap className="w-5 h-5" />}
                  isExpanded={expandedSections.materials}
                  onToggle={() => toggleSection("materials")}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">
                        Concrete Grade
                      </label>
                      <select
                        value={formData.concreteGrade}
                        onChange={(e) =>
                          handleChange("concreteGrade", e.target.value)
                        }
                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {concreteGrades.map((grade) => (
                          <option key={grade.grade} value={grade.grade}>
                            {grade.grade} (fck = {grade.fck} MPa)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">
                        Steel Grade
                      </label>
                      <select
                        value={formData.steelGrade}
                        onChange={(e) =>
                          handleChange("steelGrade", e.target.value)
                        }
                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {steelGrades.map((grade) => (
                          <option key={grade.grade} value={grade.grade}>
                            {grade.grade} (fy = {grade.fy} MPa)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Design Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={runDesign}
                  disabled={isCalculating}
                  className="w-full py-4 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 rounded-xl text-white font-bold text-lg shadow-lg shadow-purple-500/25 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isCalculating ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Calculator className="w-5 h-5" />
                      Design Column
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </motion.button>
              </div>

              {/* Preview Panel */}
              <div className="space-y-6">
                <ColumnPreview formData={formData} result={result} />
                <SlendernessPreview data={slendernessPreview} />
                <LoadingSummary formData={formData} />
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
              <ColumnResultsPanel result={result} />
            </motion.div>
          )}

          {activeTab === "interaction" && result && (
            <motion.div
              key="interaction"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <InteractionDiagram result={result} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// Helper function
function getEffectiveLengthFactor(condition: string): number {
  const factors: Record<string, number> = {
    "fixed-fixed": 0.65,
    "fixed-pinned": 0.8,
    "pinned-pinned": 1.0,
    "fixed-free": 2.0,
  };
  return factors[condition] || 1.0;
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
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-purple-400">{icon}</div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
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
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 hover:bg-slate-700/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-purple-400">{icon}</div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
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
      <label className="block text-sm text-slate-400 mb-2">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          disabled={disabled}
          className={`w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 pr-16 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 ${
            disabled ? "opacity-50 cursor-not-allowed" : ""
          }`}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
          {unit}
        </span>
      </div>
    </div>
  );
}

function ColumnPreview({
  formData,
  result,
}: {
  formData: ColumnFormData;
  result?: ColumnDesignResult | null;
}) {
  const svgW = 380;
  const svgH = 380;
  const margin = { top: 30, right: 65, bottom: 55, left: 65 };
  const drawW = svgW - margin.left - margin.right;
  const drawH = svgH - margin.top - margin.bottom;

  // Actual bar count from result or default
  const nBars =
    result?.reinforcement?.numberOfBars ||
    (formData.columnType === "rectangular" ? 8 : 6);
  const barDia = result?.reinforcement?.barDiameter || 20;
  const tieDia = result?.ties?.diameter || 8;
  const tieSpacing = result?.ties?.spacing || 200;
  const cover = formData.cover || 40;

  const isRect = formData.columnType === "rectangular";

  if (isRect) {
    const b = formData.b;
    const D = formData.D;
    const aspect = b / D;
    let colW: number, colH: number;
    if (aspect > drawW / drawH) {
      colW = drawW;
      colH = drawW / aspect;
    } else {
      colH = drawH;
      colW = drawH * aspect;
    }
    const ox = margin.left + (drawW - colW) / 2;
    const oy = margin.top + (drawH - colH) / 2;
    const pxMM = colW / b;
    const coverPx = cover * pxMM;
    const barR = Math.max(3, (barDia * pxMM) / 2);

    // Bar positions: distribute around perimeter with intermediate face bars
    // IS 456 Cl. 26.5.3.1 — spacing of bars along face ≤ 300mm
    const insideW = colW - 2 * coverPx;
    const insideH = colH - 2 * coverPx;

    // Determine bar layout: corners + intermediate
    const nCorner = 4;
    const perimeter = 2 * (b - 2 * cover) + 2 * (D - 2 * cover);
    const nFace = Math.max(0, nBars - nCorner);
    // Distribute face bars equally to long and short faces based on proportions
    const nPerLongFace = Math.ceil(nFace / 4); // per face
    const nPerShortFace = Math.floor(nFace / 4);

    // Corner positions
    const corners = [
      { cx: ox + coverPx + barR, cy: oy + coverPx + barR },
      { cx: ox + colW - coverPx - barR, cy: oy + coverPx + barR },
      { cx: ox + colW - coverPx - barR, cy: oy + colH - coverPx - barR },
      { cx: ox + coverPx + barR, cy: oy + colH - coverPx - barR },
    ];

    // Face bar positions
    const faceBars: { cx: number; cy: number }[] = [];
    for (let face = 0; face < 4; face++) {
      const n = face % 2 === 0 ? nPerLongFace : nPerShortFace;
      if (n <= 0) continue;
      const c1 = corners[face];
      const c2 = corners[(face + 1) % 4];
      for (let i = 1; i <= n; i++) {
        const t = i / (n + 1);
        faceBars.push({
          cx: c1.cx + t * (c2.cx - c1.cx),
          cy: c1.cy + t * (c2.cy - c1.cy),
        });
      }
    }

    const allBars = [...corners, ...faceBars];

    return (
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Square className="w-4 h-4 text-purple-400" /> Column Cross-Section
        </h3>
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-72 bg-slate-900/50 rounded-xl"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          <defs>
            <pattern
              id="col-hatch"
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
              id="col-arrow-c"
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

          {/* Concrete body */}
          <rect
            x={ox}
            y={oy}
            width={colW}
            height={colH}
            fill="url(#col-hatch)"
          />
          <rect
            x={ox}
            y={oy}
            width={colW}
            height={colH}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
          />

          {/* Tie with 135° hooks */}
          <rect
            x={ox + coverPx}
            y={oy + coverPx}
            width={colW - 2 * coverPx}
            height={colH - 2 * coverPx}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.8"
            rx="3"
          />
          {/* 135° hooks at top corners */}
          <line
            x1={ox + coverPx + 10}
            y1={oy + coverPx}
            x2={ox + coverPx + 10 + 10 * Math.cos(Math.PI * 0.75)}
            y2={oy + coverPx + 10 * Math.sin(Math.PI * 0.75)}
            stroke="#3b82f6"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <line
            x1={ox + colW - coverPx - 10}
            y1={oy + coverPx}
            x2={ox + colW - coverPx - 10 - 10 * Math.cos(Math.PI * 0.75)}
            y2={oy + coverPx + 10 * Math.sin(Math.PI * 0.75)}
            stroke="#3b82f6"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Cross-tie (if width > 300mm in either direction) */}
          {b > 300 && (
            <line
              x1={ox + colW / 2}
              y1={oy + coverPx}
              x2={ox + colW / 2}
              y2={oy + colH - coverPx}
              stroke="#3b82f6"
              strokeWidth="1"
              strokeDasharray="3,2"
            />
          )}
          {D > 300 && (
            <line
              x1={ox + coverPx}
              y1={oy + colH / 2}
              x2={ox + colW - coverPx}
              y2={oy + colH / 2}
              stroke="#3b82f6"
              strokeWidth="1"
              strokeDasharray="3,2"
            />
          )}

          {/* All bars */}
          {allBars.map((bar, i) => (
            <g key={`bar-${i}`}>
              <circle
                cx={bar.cx}
                cy={bar.cy}
                r={barR}
                fill="#a855f7"
                stroke="#7c3aed"
                strokeWidth="0.8"
              />
            </g>
          ))}

          {/* Cover annotations */}
          {/* Bottom cover */}
          <line
            x1={ox - 6}
            y1={oy + colH}
            x2={ox - 6}
            y2={oy + colH - coverPx}
            stroke="#22d3ee"
            strokeWidth="0.8"
            markerStart="url(#col-arrow-c)"
            markerEnd="url(#col-arrow-c)"
          />
          <text
            x={ox - 10}
            y={oy + colH - coverPx / 2 + 3}
            textAnchor="end"
            fontSize="7"
            fill="#22d3ee"
            fontWeight="600"
          >
            {cover}
          </text>

          {/* Side cover */}
          <line
            x1={ox}
            y1={oy + colH + 6}
            x2={ox + coverPx}
            y2={oy + colH + 6}
            stroke="#22d3ee"
            strokeWidth="0.8"
          />
          <line
            x1={ox}
            y1={oy + colH + 3}
            x2={ox}
            y2={oy + colH + 9}
            stroke="#22d3ee"
            strokeWidth="0.6"
          />
          <line
            x1={ox + coverPx}
            y1={oy + colH + 3}
            x2={ox + coverPx}
            y2={oy + colH + 9}
            stroke="#22d3ee"
            strokeWidth="0.6"
          />
          <text
            x={ox + coverPx / 2}
            y={oy + colH + 17}
            textAnchor="middle"
            fontSize="7"
            fill="#22d3ee"
          >
            {cover}
          </text>

          {/* Width dimension */}
          {(() => {
            const dy = oy + colH + 26;
            return (
              <g>
                <line
                  x1={ox}
                  y1={oy + colH + 10}
                  x2={ox}
                  y2={dy + 4}
                  stroke="#a1a1aa"
                  strokeWidth="0.5"
                />
                <line
                  x1={ox + colW}
                  y1={oy + colH + 10}
                  x2={ox + colW}
                  y2={dy + 4}
                  stroke="#a1a1aa"
                  strokeWidth="0.5"
                />
                <line
                  x1={ox}
                  y1={dy}
                  x2={ox + colW}
                  y2={dy}
                  stroke="#a1a1aa"
                  strokeWidth="0.6"
                />
                <line
                  x1={ox - 3}
                  y1={dy + 3}
                  x2={ox + 3}
                  y2={dy - 3}
                  stroke="#a1a1aa"
                  strokeWidth="0.8"
                />
                <line
                  x1={ox + colW - 3}
                  y1={dy + 3}
                  x2={ox + colW + 3}
                  y2={dy - 3}
                  stroke="#a1a1aa"
                  strokeWidth="0.8"
                />
                <text
                  x={ox + colW / 2}
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
            const dx = ox + colW + 26;
            return (
              <g>
                <line
                  x1={ox + colW + 5}
                  y1={oy}
                  x2={dx + 4}
                  y2={oy}
                  stroke="#a1a1aa"
                  strokeWidth="0.5"
                />
                <line
                  x1={ox + colW + 5}
                  y1={oy + colH}
                  x2={dx + 4}
                  y2={oy + colH}
                  stroke="#a1a1aa"
                  strokeWidth="0.5"
                />
                <line
                  x1={dx}
                  y1={oy}
                  x2={dx}
                  y2={oy + colH}
                  stroke="#a1a1aa"
                  strokeWidth="0.6"
                />
                <line
                  x1={dx - 3}
                  y1={oy + 3}
                  x2={dx + 3}
                  y2={oy - 3}
                  stroke="#a1a1aa"
                  strokeWidth="0.8"
                />
                <line
                  x1={dx - 3}
                  y1={oy + colH + 3}
                  x2={dx + 3}
                  y2={oy + colH - 3}
                  stroke="#a1a1aa"
                  strokeWidth="0.8"
                />
                <text
                  x={dx + 14}
                  y={oy + colH / 2}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#a1a1aa"
                  fontWeight="500"
                  transform={`rotate(-90, ${dx + 14}, ${oy + colH / 2})`}
                >
                  {D} mm
                </text>
              </g>
            );
          })()}

          {/* Bar info callout */}
          <line
            x1={allBars[0]?.cx || ox + 30}
            y1={allBars[0]?.cy || oy + 30}
            x2={ox - 16}
            y2={oy + 16}
            stroke="#71717a"
            strokeWidth="0.5"
          />
          <text
            x={ox - 18}
            y={oy + 14}
            textAnchor="end"
            fontSize="7"
            fill="#e2e8f0"
          >
            {nBars}-T{barDia}
          </text>

          {/* Tie info callout */}
          <line
            x1={ox + coverPx + 2}
            y1={oy + colH / 2}
            x2={ox - 16}
            y2={oy + colH / 2 + 20}
            stroke="#71717a"
            strokeWidth="0.5"
          />
          <text
            x={ox - 18}
            y={oy + colH / 2 + 23}
            textAnchor="end"
            fontSize="7"
            fill="#e2e8f0"
          >
            T{tieDia}@{tieSpacing}c/c
          </text>

          {/* Legend */}
          <g transform={`translate(${margin.left}, ${svgH - 14})`}>
            <circle
              cx="6"
              cy="-2"
              r="4"
              fill="#a855f7"
              stroke="#7c3aed"
              strokeWidth="0.5"
            />
            <text x="14" y="2" fontSize="7" fill="#94a3b8">
              {nBars}-T{barDia}
            </text>
            <rect
              x="75"
              y="-5"
              width="10"
              height="6"
              rx="1"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1"
            />
            <text x="90" y="2" fontSize="7" fill="#94a3b8">
              Tie T{tieDia}
            </text>
            <line
              x1="145"
              y1="-2"
              x2="155"
              y2="-2"
              stroke="#22d3ee"
              strokeWidth="1"
            />
            <text x="160" y="2" fontSize="7" fill="#94a3b8">
              Cover
            </text>
          </g>
        </svg>
      </div>
    );
  } else {
    // Circular column
    const dia = formData.diameter || 450;
    const maxDrawDim = Math.min(drawW, drawH);
    const colR = maxDrawDim / 2;
    const cx = svgW / 2;
    const cy = svgH / 2;
    const pxMM = (colR * 2) / dia;
    const coverPx = cover * pxMM;
    const barR = Math.max(3, (barDia * pxMM) / 2);
    const rebarRing = colR - coverPx - barR;

    return (
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Circle className="w-4 h-4 text-purple-400" /> Column Cross-Section
        </h3>
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-72 bg-slate-900/50 rounded-xl"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          <defs>
            <pattern
              id="col-circ-hatch"
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
          </defs>

          {/* Concrete circle with hatch */}
          <circle cx={cx} cy={cy} r={colR} fill="url(#col-circ-hatch)" />
          <circle
            cx={cx}
            cy={cy}
            r={colR}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
          />

          {/* Spiral (heavier dashed) */}
          <circle
            cx={cx}
            cy={cy}
            r={colR - coverPx}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.5"
            strokeDasharray="6,4"
          />

          {/* Column bars equally spaced */}
          {Array.from({ length: nBars }).map((_, i) => {
            const angle = (((i * 360) / nBars - 90) * Math.PI) / 180;
            const bx = cx + rebarRing * Math.cos(angle);
            const by = cy + rebarRing * Math.sin(angle);
            return (
              <circle
                key={i}
                cx={bx}
                cy={by}
                r={barR}
                fill="#a855f7"
                stroke="#7c3aed"
                strokeWidth="0.8"
              />
            );
          })}

          {/* Diameter dimension */}
          <line
            x1={cx - colR}
            y1={cy + colR + 22}
            x2={cx + colR}
            y2={cy + colR + 22}
            stroke="#a1a1aa"
            strokeWidth="0.6"
          />
          <line
            x1={cx - colR}
            y1={cy + colR + 5}
            x2={cx - colR}
            y2={cy + colR + 26}
            stroke="#a1a1aa"
            strokeWidth="0.5"
          />
          <line
            x1={cx + colR}
            y1={cy + colR + 5}
            x2={cx + colR}
            y2={cy + colR + 26}
            stroke="#a1a1aa"
            strokeWidth="0.5"
          />
          <line
            x1={cx - colR - 3}
            y1={cy + colR + 25}
            x2={cx - colR + 3}
            y2={cy + colR + 19}
            stroke="#a1a1aa"
            strokeWidth="0.8"
          />
          <line
            x1={cx + colR - 3}
            y1={cy + colR + 25}
            x2={cx + colR + 3}
            y2={cy + colR + 19}
            stroke="#a1a1aa"
            strokeWidth="0.8"
          />
          <text
            x={cx}
            y={cy + colR + 36}
            textAnchor="middle"
            fontSize="10"
            fill="#a1a1aa"
            fontWeight="500"
          >
            {dia} mm dia
          </text>

          {/* Cover annotation */}
          <line
            x1={cx + colR}
            y1={cy}
            x2={cx + colR - coverPx}
            y2={cy}
            stroke="#22d3ee"
            strokeWidth="0.8"
          />
          <line
            x1={cx + colR}
            y1={cy - 4}
            x2={cx + colR}
            y2={cy + 4}
            stroke="#22d3ee"
            strokeWidth="0.6"
          />
          <line
            x1={cx + colR - coverPx}
            y1={cy - 4}
            x2={cx + colR - coverPx}
            y2={cy + 4}
            stroke="#22d3ee"
            strokeWidth="0.6"
          />
          <text
            x={cx + colR - coverPx / 2}
            y={cy - 6}
            textAnchor="middle"
            fontSize="7"
            fill="#22d3ee"
          >
            {cover}
          </text>

          {/* Bar callout */}
          <text
            x={cx}
            y={cy + colR + 48}
            textAnchor="middle"
            fontSize="8"
            fill="#e2e8f0"
          >
            {nBars}-T{barDia} | Spiral T{tieDia}@{tieSpacing}c/c
          </text>

          {/* Legend */}
          <g transform={`translate(${margin.left}, ${svgH - 14})`}>
            <circle
              cx="6"
              cy="-2"
              r="4"
              fill="#a855f7"
              stroke="#7c3aed"
              strokeWidth="0.5"
            />
            <text x="14" y="2" fontSize="7" fill="#94a3b8">
              Bars
            </text>
            <circle
              cx="60"
              cy="-2"
              r="6"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1"
              strokeDasharray="3,2"
            />
            <text x="72" y="2" fontSize="7" fill="#94a3b8">
              Spiral
            </text>
          </g>
        </svg>
      </div>
    );
  }
}

function SlendernessPreview({
  data,
}: {
  data: { lambda: string; isSlender: boolean; type: string };
}) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        Slenderness Check
      </h3>
      <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
        <div>
          <p className="text-slate-400 text-sm">Slenderness Ratio (λ)</p>
          <p className="text-3xl font-bold text-white">{data.lambda}</p>
        </div>
        <div
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            data.isSlender
              ? "bg-yellow-500/20 text-yellow-400"
              : "bg-green-500/20 text-green-400"
          }`}
        >
          {data.type} Column
        </div>
      </div>
      <div className="mt-4 relative h-3 bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{
            width: `${Math.min((parseFloat(data.lambda) / 30) * 100, 100)}%`,
          }}
          className={`h-full ${
            data.isSlender
              ? "bg-gradient-to-r from-yellow-500 to-orange-500"
              : "bg-gradient-to-r from-green-500 to-emerald-500"
          }`}
        />
        <div className="absolute left-[40%] top-0 bottom-0 w-0.5 bg-slate-400" />
      </div>
      <div className="flex justify-between mt-2 text-xs text-slate-400">
        <span>0</span>
        <span className="text-yellow-400">12 (Limit)</span>
        <span>30</span>
      </div>
    </div>
  );
}

function LoadingSummary({ formData }: { formData: ColumnFormData }) {
  const area =
    formData.columnType === "rectangular"
      ? formData.b * formData.D
      : (Math.PI * (formData.diameter || 450) ** 2) / 4;
  const stress = (formData.Pu * 1000) / area;

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Quick Summary</h3>
      <div className="space-y-3">
        <div className="flex justify-between p-3 bg-slate-700/30 rounded-lg">
          <span className="text-slate-400">Cross-sectional Area</span>
          <span className="text-white font-medium">
            {(area / 1e6).toFixed(4)} m²
          </span>
        </div>
        <div className="flex justify-between p-3 bg-slate-700/30 rounded-lg">
          <span className="text-slate-400">Axial Stress</span>
          <span className="text-white font-medium">
            {stress.toFixed(2)} MPa
          </span>
        </div>
        <div className="flex justify-between p-3 bg-slate-700/30 rounded-lg">
          <span className="text-slate-400">Eccentricity (ex)</span>
          <span className="text-white font-medium">
            {formData.Pu !== 0
              ? ((formData.Mux / formData.Pu) * 1000).toFixed(1)
              : "∞"}{" "}
            mm
          </span>
        </div>
        <div className="flex justify-between p-3 bg-slate-700/30 rounded-lg">
          <span className="text-slate-400">Eccentricity (ey)</span>
          <span className="text-white font-medium">
            {formData.Pu !== 0
              ? ((formData.Muy / formData.Pu) * 1000).toFixed(1)
              : "∞"}{" "}
            mm
          </span>
        </div>
      </div>
    </div>
  );
}

function ColumnResultsPanel({ result }: { result: ColumnDesignResult }) {
  const isDesignOk = result.status === "safe";

  // Get max values from interaction diagram
  const Pu_max = result.interactionDiagram?.length
    ? Math.max(...result.interactionDiagram.map((p) => p.Pn))
    : result.axialCapacity;
  const Mu_max = result.interactionDiagram?.length
    ? Math.max(...result.interactionDiagram.map((p) => p.Mn))
    : result.momentCapacity_X;

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
            <h2 className="text-2xl font-bold text-white">
              {isDesignOk ? "Design OK" : "Design Needs Revision"}
            </h2>
            <p className="text-slate-300">
              {result.slenderness.isSlender
                ? "Slender column - second order effects considered"
                : "Short column - direct design"}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm text-slate-400">Utilization Ratio</p>
            <p className="text-3xl font-bold text-white">
              {(result.utilizationRatio * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Slenderness Results */}
      <ResultCard
        title="Slenderness Analysis"
        status={result.slenderness.isSlender ? "warning" : "pass"}
      >
        <div className="space-y-2">
          <ResultRow
            label="λ (about X)"
            value={result.slenderness.slendernessRatio_X?.toFixed(1) || "-"}
          />
          <ResultRow
            label="λ (about Y)"
            value={result.slenderness.slendernessRatio_Y?.toFixed(1) || "-"}
          />
          <ResultRow
            label="Column Type"
            value={result.slenderness.isSlender ? "Slender" : "Short"}
          />
          {result.slenderness.momentMagnifier_X && (
            <ResultRow
              label="Magnification Factor (X)"
              value={result.slenderness.momentMagnifier_X.toFixed(3)}
            />
          )}
        </div>
      </ResultCard>

      {/* Design Moments */}
      <ResultCard title="Design Moments" status="pass">
        <div className="space-y-2">
          <ResultRow
            label="Design Mux"
            value={`${result.slenderness.magnifiedMoment_X?.toFixed(1) || result.loading.Mux.toFixed(1)} kN-m`}
          />
          <ResultRow
            label="Design Muy"
            value={`${result.slenderness.magnifiedMoment_Y?.toFixed(1) || result.loading.Muy.toFixed(1)} kN-m`}
          />
          <ResultRow
            label="Capacity Mux1"
            value={`${result.momentCapacity_X?.toFixed(1) || "-"} kN-m`}
          />
          <ResultRow
            label="Capacity Muy1"
            value={`${result.momentCapacity_Y?.toFixed(1) || "-"} kN-m`}
          />
        </div>
      </ResultCard>

      {/* Reinforcement */}
      <ResultCard title="Reinforcement" status="pass">
        <div className="space-y-2">
          <ResultRow
            label="Steel Area"
            value={`${result.reinforcement.totalArea.toFixed(0)} mm²`}
          />
          <ResultRow
            label="Steel Ratio"
            value={`${(result.reinforcement.steelRatio * 100).toFixed(2)}%`}
          />
          <ResultRow
            label="Main Bars"
            value={`${result.reinforcement.numberOfBars} - ${result.reinforcement.barDiameter}ø`}
          />
          <ResultRow
            label="Ties/Spirals"
            value={`${result.ties.diameter}ø @ ${result.ties.spacing}mm c/c`}
          />
        </div>
      </ResultCard>

      {/* Export Button */}
      <div className="col-span-1 lg:col-span-3 flex justify-end gap-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-3 bg-slate-700 rounded-xl text-white font-medium flex items-center gap-2"
        >
          <FileText className="w-5 h-5" />
          Export Report
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-medium flex items-center gap-2"
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
  status: "pass" | "fail" | "warning";
  children: React.ReactNode;
}) {
  const statusColors = {
    pass: "bg-emerald-500/20 text-emerald-400",
    fail: "bg-red-500/20 text-red-400",
    warning: "bg-yellow-500/20 text-yellow-400",
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}
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
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

function InteractionDiagram({ result }: { result: ColumnDesignResult }) {
  // Generate P-M interaction curve points
  const svgWidth = 600;
  const svgHeight = 500;
  const padding = 60;

  // Calculate max values from interaction diagram
  const Pu_max = result.interactionDiagram?.length
    ? Math.max(...result.interactionDiagram.map((p) => p.Pn))
    : result.axialCapacity;
  const Mu_max = result.interactionDiagram?.length
    ? Math.max(...result.interactionDiagram.map((p) => p.Mn))
    : result.momentCapacity_X;

  // Sample interaction curve (simplified)
  const points = useMemo(() => {
    const pts: { P: number; M: number }[] = [];

    // Use actual interaction diagram points if available
    if (result.interactionDiagram?.length) {
      return result.interactionDiagram.map((p) => ({ P: p.Pn, M: p.Mn }));
    }

    // Fallback to synthetic curve
    for (let i = 0; i <= 20; i++) {
      const P = Pu_max * (1 - i / 20);
      const M = Mu_max * Math.sin((Math.PI * i) / 20);
      pts.push({ P, M });
    }

    return pts;
  }, [result, Pu_max, Mu_max]);

  const maxP = Math.max(...points.map((p) => p.P));
  const maxM = Math.max(...points.map((p) => p.M));

  const scaleP = (P: number) =>
    padding + (1 - P / maxP) * (svgHeight - 2 * padding);
  const scaleM = (M: number) => padding + (M / maxM) * (svgWidth - 2 * padding);

  // Applied load point
  const appliedP = result.loading.Pu;
  const appliedM = Math.sqrt(result.loading.Mux ** 2 + result.loading.Muy ** 2);

  const isDesignOk = result.status === "safe";

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6">
      <h3 className="text-xl font-bold text-white mb-6">
        P-M Interaction Diagram
      </h3>

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto bg-slate-900/50 rounded-xl"
      >
        {/* Grid */}
        <defs>
          <pattern
            id="grid-pm"
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 50 0 L 0 0 0 50"
              fill="none"
              stroke="#334155"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect
          x={padding}
          y={padding}
          width={svgWidth - 2 * padding}
          height={svgHeight - 2 * padding}
          fill="url(#grid-pm)"
        />

        {/* Axes */}
        <line
          x1={padding}
          y1={svgHeight - padding}
          x2={svgWidth - padding}
          y2={svgHeight - padding}
          stroke="#94a3b8"
          strokeWidth="2"
        />
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={svgHeight - padding}
          stroke="#94a3b8"
          strokeWidth="2"
        />

        {/* Axis labels */}
        <text
          x={svgWidth / 2}
          y={svgHeight - 15}
          textAnchor="middle"
          className="fill-slate-400 text-sm"
        >
          Moment M (kN-m)
        </text>
        <text
          x="20"
          y={svgHeight / 2}
          textAnchor="middle"
          className="fill-slate-400 text-sm"
          transform={`rotate(-90, 20, ${svgHeight / 2})`}
        >
          Axial Load P (kN)
        </text>

        {/* Interaction curve */}
        <path
          d={`M ${points.map((p) => `${scaleM(p.M)},${scaleP(p.P)}`).join(" L ")}`}
          fill="none"
          stroke="#a855f7"
          strokeWidth="3"
        />

        {/* Fill under curve */}
        <path
          d={`M ${padding},${scaleP(points[0].P)} ${points.map((p) => `L ${scaleM(p.M)},${scaleP(p.P)}`).join(" ")} L ${padding},${svgHeight - padding} Z`}
          fill="rgba(168, 85, 247, 0.1)"
        />

        {/* Applied load point */}
        <circle
          cx={scaleM(appliedM)}
          cy={scaleP(appliedP)}
          r="10"
          fill="#ef4444"
          stroke="white"
          strokeWidth="2"
        />
        <text
          x={scaleM(appliedM) + 15}
          y={scaleP(appliedP)}
          className="fill-white text-sm font-medium"
        >
          Applied Load
        </text>

        {/* Legend */}
        <g transform={`translate(${svgWidth - 180}, 30)`}>
          <rect x="0" y="0" width="160" height="60" fill="#1e293b" rx="8" />
          <line
            x1="10"
            y1="20"
            x2="40"
            y2="20"
            stroke="#a855f7"
            strokeWidth="3"
          />
          <text x="50" y="25" className="fill-slate-300 text-xs">
            Capacity Curve
          </text>
          <circle cx="25" cy="45" r="6" fill="#ef4444" />
          <text x="50" y="50" className="fill-slate-300 text-xs">
            Applied Load
          </text>
        </g>

        {/* Status indicator */}
        <g transform={`translate(${padding + 10}, ${padding + 10})`}>
          <rect
            x="0"
            y="0"
            width="120"
            height="30"
            fill={isDesignOk ? "#10b981" : "#ef4444"}
            rx="6"
          />
          <text
            x="60"
            y="20"
            textAnchor="middle"
            className="fill-white text-sm font-bold"
          >
            {isDesignOk ? "✓ SAFE" : "✗ UNSAFE"}
          </text>
        </g>
      </svg>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="p-4 bg-slate-700/30 rounded-lg text-center">
          <p className="text-slate-400 text-sm">Max Axial Capacity</p>
          <p className="text-xl font-bold text-white">{Pu_max.toFixed(0)} kN</p>
        </div>
        <div className="p-4 bg-slate-700/30 rounded-lg text-center">
          <p className="text-slate-400 text-sm">Max Moment Capacity</p>
          <p className="text-xl font-bold text-white">
            {Mu_max.toFixed(0)} kN-m
          </p>
        </div>
        <div className="p-4 bg-slate-700/30 rounded-lg text-center">
          <p className="text-slate-400 text-sm">Safety Factor</p>
          <p className="text-xl font-bold text-white">
            {result.utilizationRatio > 0
              ? (1 / result.utilizationRatio).toFixed(2)
              : "∞"}
          </p>
        </div>
      </div>
    </div>
  );
}
