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
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
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

import type { BeamFormData } from "./rcBeamTypes";
import BeamPreview from "./BeamPreview";
import ResultsPanel from "./ResultsPanel";
import ReinforcementDrawing from "./ReinforcementDrawing";



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
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
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
                <button type="button"
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab
                      ? "bg-blue-500 text-white shadow-lg"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-600/50"
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
                        <button type="button"
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
                      <button type="button"
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
                        className="w-full bg-slate-200/50 dark:bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full bg-slate-200/50 dark:bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full py-4 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 rounded-xl text-slate-900 dark:text-white font-bold text-lg shadow-lg shadow-blue-500/25 flex items-center justify-center gap-3 disabled:opacity-50"
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
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
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
      <button type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 hover:bg-slate-700/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-blue-400">{icon}</div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
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
          className={`w-full bg-slate-200/50 dark:bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 pr-16 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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

function QuickSummary({ formData }: { formData: BeamFormData }) {
  // Quick checks
  const spanDepthRatio = formData.L / formData.D;
  const isRatioOk = spanDepthRatio <= 20;

  return (
    <div className="bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Quick Checks</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
          <span className="text-slate-500 dark:text-slate-400">Span/Depth Ratio</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-900 dark:text-white font-medium">
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
          <span className="text-slate-900 dark:text-white font-medium">{formData.code}</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
          <span className="text-slate-500 dark:text-slate-400">Beam Type</span>
          <span className="text-slate-900 dark:text-white font-medium capitalize">
            {formData.beamType}
          </span>
        </div>
      </div>
    </div>
  );
}

