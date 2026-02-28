/**
 * CurvedStructureDialog.tsx — Parametric Curved/Circular Structure Generator UI
 *
 * Provides an interactive dialog for generating curved structures:
 * Geodesic Domes, Ribbed Domes, Barrel Vaults, Arches, Tunnels,
 * Spheres, Cylindrical Tanks, Cooling Towers, Helical Staircases,
 * Hyperbolic Paraboloids
 */

import { FC, useState, useMemo, useCallback } from "react";
import {
  Sparkles,
  Globe2,
  Building2,
  Warehouse,
  ArrowBigUp,
  CircleDot,
  Cylinder,
  Wind,
  Heater,
  Layers2,
  ChevronRight,
  RotateCcw,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  CURVED_TEMPLATES,
  generateCurvedStructure,
  type CurvedTemplate,
} from "../services/CurvedStructureGenerator";
import { useModelStore } from "../store/model";

interface CurvedStructureDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_ICONS: Record<string, any> = {
  dome: Globe2,
  vault: Warehouse,
  arch: ArrowBigUp,
  tunnel: Building2,
  sphere: CircleDot,
  tank: Cylinder,
  tower: Wind,
  staircase: Heater,
  shell: Layers2,
};

const CATEGORY_LABELS: Record<string, string> = {
  dome: "Domes",
  vault: "Vaults",
  arch: "Arches",
  tunnel: "Tunnels",
  sphere: "Spheres",
  tank: "Tanks & Silos",
  tower: "Towers",
  staircase: "Staircases",
  shell: "Shell Structures",
};

export const CurvedStructureDialog: FC<CurvedStructureDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedTemplate, setSelectedTemplate] =
    useState<CurvedTemplate | null>(null);
  const [params, setParams] = useState<Record<string, number | string>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [generating, setGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  const loadStructure = useModelStore((s) => s.loadStructure);
  const clearModel = useModelStore((s) => s.clearModel);

  const categories = useMemo(() => {
    const cats = new Set(CURVED_TEMPLATES.map((t) => t.category));
    return ["all", ...Array.from(cats)];
  }, []);

  const filteredTemplates = useMemo(() => {
    if (selectedCategory === "all") return CURVED_TEMPLATES;
    return CURVED_TEMPLATES.filter((t) => t.category === selectedCategory);
  }, [selectedCategory]);

  const handleSelectTemplate = useCallback((template: CurvedTemplate) => {
    setSelectedTemplate(template);
    setParams({ ...template.defaultParams });
    setLastGenerated(null);
  }, []);

  const handleParamChange = useCallback(
    (key: string, value: number | string) => {
      setParams((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleGenerate = useCallback(() => {
    if (!selectedTemplate) return;
    setGenerating(true);

    try {
      const result = generateCurvedStructure(selectedTemplate.id, params);
      if (result) {
        clearModel();
        loadStructure(result.nodes, result.members);
        setLastGenerated(selectedTemplate.name);
      }
    } catch (err) {
      console.error("Failed to generate curved structure:", err);
    } finally {
      setGenerating(false);
    }
  }, [selectedTemplate, params, clearModel, loadStructure]);

  const handleResetParams = useCallback(() => {
    if (selectedTemplate) {
      setParams({ ...selectedTemplate.defaultParams });
    }
  }, [selectedTemplate]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[950px] max-h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-white">
                Curved Structure Generator
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
                Parametric domes, tunnels, arches, shells & more
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Category & Template List */}
          <div className="w-[320px] border-r border-zinc-200 dark:border-zinc-700 flex flex-col">
            {/* Category tabs */}
            <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-1">
              {categories.map((cat) => {
                const Icon =
                  cat === "all" ? Globe2 : CATEGORY_ICONS[cat] || Globe2;
                const label =
                  cat === "all" ? "All" : CATEGORY_LABELS[cat] || cat;
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`text-xs px-2 py-1 rounded-md flex items-center gap-1 transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Template cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredTemplates.map((template) => {
                const isSelected = selectedTemplate?.id === template.id;
                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10"
                        : "border-zinc-200 dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{template.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-zinc-900 dark:text-white truncate">
                          {template.name}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                          {template.category}
                        </div>
                      </div>
                      {isSelected && (
                        <ChevronRight className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Parameter Editor & Preview */}
          <div className="flex-1 flex flex-col">
            {selectedTemplate ? (
              <>
                {/* Template header */}
                <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{selectedTemplate.icon}</span>
                    <div>
                      <h3 className="font-bold text-zinc-900 dark:text-white">
                        {selectedTemplate.name}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Adjust parameters below and generate
                      </p>
                    </div>
                  </div>
                </div>

                {/* Parameter sliders/inputs */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {Object.entries(params).map(([key, value]) => {
                    const isNumeric = typeof value === "number";
                    const isStringSelect = typeof value === "string";
                    const label = key
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (s) => s.toUpperCase());

                    // Determine min/max based on parameter name
                    const ranges = getParamRange(key, selectedTemplate.id);

                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm text-zinc-600 dark:text-zinc-300 font-medium">
                            {label}
                          </Label>
                          {isNumeric && (
                            <span className="text-xs text-blue-400 font-mono">
                              {value}
                              {getUnit(key)}
                            </span>
                          )}
                        </div>
                        {isNumeric ? (
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={ranges.min}
                              max={ranges.max}
                              step={ranges.step}
                              value={value}
                              onChange={(e) =>
                                handleParamChange(key, Number(e.target.value))
                              }
                              className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                            <Input
                              type="number"
                              value={value}
                              step={ranges.step}
                              onChange={(e) =>
                                handleParamChange(key, Number(e.target.value))
                              }
                              className="w-20 px-2 py-1 text-sm text-center"
                            />
                          </div>
                        ) : isStringSelect ? (
                          <select
                            value={value}
                            onChange={(e) =>
                              handleParamChange(key, e.target.value)
                            }
                            className="w-full px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white"
                          >
                            {getStringOptions(key).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                <DialogFooter className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={handleResetParams}
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset Defaults
                  </Button>
                  <div className="flex items-center gap-3">
                    {lastGenerated && (
                      <div className="flex items-center gap-1.5 text-xs text-green-400">
                        <Check className="w-3.5 h-3.5" />
                        Generated: {lastGenerated}
                      </div>
                    )}
                    <Button
                      onClick={handleGenerate}
                      disabled={generating}
                      className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white"
                    >
                      <Sparkles className="w-4 h-4" />
                      {generating ? "Generating..." : "Generate Structure"}
                    </Button>
                  </div>
                </DialogFooter>
              </>
            ) : (
              /* Empty state */
              <div className="flex-1 flex items-center justify-center text-center px-12">
                <div>
                  <Globe2 className="w-16 h-16 text-zinc-400 dark:text-zinc-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                    Select a Template
                  </h3>
                  <p className="text-sm text-zinc-500 max-w-md">
                    Choose a curved structure template from the list on the
                    left. Available: geodesic domes, barrel vaults, parabolic
                    arches, tunnels, spheres, tanks, cooling towers, helical
                    staircases, and hyperbolic paraboloid shells.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Helpers for parameter ranges & units ─────────────────────────────

function getParamRange(key: string, _templateId: string) {
  const rangeMap: Record<string, { min: number; max: number; step: number }> = {
    radius: { min: 5, max: 100, step: 1 },
    span: { min: 5, max: 200, step: 1 },
    rise: { min: 2, max: 80, step: 1 },
    divisions: { min: 4, max: 48, step: 2 },
    rings: { min: 3, max: 24, step: 1 },
    segments: { min: 6, max: 48, step: 2 },
    meridians: { min: 6, max: 36, step: 2 },
    parallels: { min: 4, max: 24, step: 1 },
    length: { min: 10, max: 200, step: 1 },
    height: { min: 5, max: 150, step: 1 },
    width: { min: 5, max: 60, step: 1 },
    turns: { min: 0.5, max: 5, step: 0.5 },
    innerRadius: { min: 1, max: 20, step: 0.5 },
    outerRadius: { min: 2, max: 25, step: 0.5 },
    stepsPerTurn: { min: 8, max: 24, step: 1 },
    topRadius: { min: 10, max: 50, step: 1 },
    bottomRadius: { min: 15, max: 80, step: 1 },
    throatRadius: { min: 5, max: 40, step: 1 },
    liningThickness: { min: 0.2, max: 1.5, step: 0.1 },
    spanX: { min: 10, max: 100, step: 1 },
    spanY: { min: 10, max: 100, step: 1 },
    divisionsX: { min: 4, max: 24, step: 2 },
    divisionsY: { min: 4, max: 24, step: 2 },
    levels: { min: 4, max: 48, step: 2 },
  };

  // Match by key suffix patterns
  for (const [pattern, range] of Object.entries(rangeMap)) {
    if (key.toLowerCase().includes(pattern.toLowerCase())) return range;
  }
  return { min: 1, max: 100, step: 1 };
}

function getUnit(key: string): string {
  const k = key.toLowerCase();
  if (
    k.includes("radius") ||
    k.includes("span") ||
    k.includes("rise") ||
    k.includes("height") ||
    k.includes("width") ||
    k.includes("length") ||
    k.includes("thickness")
  )
    return " m";
  if (k.includes("turn")) return " rev";
  return "";
}

function getStringOptions(key: string): string[] {
  const k = key.toLowerCase();
  if (k.includes("profile"))
    return [
      "parabolic",
      "circular",
      "catenary",
      "circular_profile",
      "horseshoe",
      "d_shape",
    ];
  if (k.includes("support") || k.includes("type"))
    return ["fixed", "pinned", "three_hinged"];
  return ["option_a", "option_b"];
}

export default CurvedStructureDialog;
