/**
 * ResultsControlPanel.tsx - STAAD-like Results Control Panel
 *
 * Professional control panel for analysis results visualization:
 * - Diagram toggles (BMD, SFD, AFD, Deflected Shape)
 * - Scale controls
 * - Animation controls for mode shapes
 * - Display options
 * - Quick summary cards
 *
 * Designed to match STAAD.Pro, SAP2000, ETABS interface patterns
 */

import React, { FC, useState, useCallback, useMemo } from "react";
import { useModelStore } from "../../store/model";
import {
  BarChart3,
  BarChart2,
  Activity,
  TrendingDown,
  Move,
  Eye,
  EyeOff,
  Settings,
  Maximize2,
  RotateCw,
  Play,
  Pause,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Info,
  Sliders,
  SlidersHorizontal,
  Palette,
  Grid3X3,
  Box,
  Layers,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Waves,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

type DiagramType =
  | "none"
  | "SFD"
  | "BMD"
  | "AFD"
  | "TORSION"
  | "DEFLECTION"
  | "BMD_MY"
  | "SFD_VZ";
type ColorMode = "default" | "stress" | "utilization" | "force";

interface DiagramOption {
  id: DiagramType;
  label: string;
  shortLabel: string;
  color: string;
  icon: React.ReactNode;
  description: string;
}

interface DisplaySettings {
  showDiagram: DiagramType;
  diagramScale: number;
  showLabels: boolean;
  showCriticalPoints: boolean;
  showFill: boolean;
  showBaseline: boolean;
  colorMode: ColorMode;
  deflectedShapeScale: number;
  showOriginalShape: boolean;
  animateDeflection: boolean;
  animationSpeed: number;
}

// ============================================
// CONSTANTS
// ============================================

const diagramOptions: DiagramOption[] = [
  {
    id: "none",
    label: "No Diagram",
    shortLabel: "Off",
    color: "#666666",
    icon: <EyeOff size={16} />,
    description: "Hide all force diagrams",
  },
  {
    id: "SFD",
    label: "Shear Force Diagram",
    shortLabel: "SFD",
    color: "#f97316",
    icon: <Activity size={16} />,
    description: "Display shear force (Fy, Fz) along members",
  },
  {
    id: "BMD",
    label: "Bending Moment Diagram",
    shortLabel: "BMD",
    color: "#22c55e",
    icon: <BarChart2 size={16} />,
    description: "Display bending moment (My, Mz) along members",
  },
  {
    id: "AFD",
    label: "Axial Force Diagram",
    shortLabel: "AFD",
    color: "#ef4444",
    icon: <SlidersHorizontal size={16} />,
    description: "Display axial force (Fx) along members",
  },
  {
    id: "TORSION",
    label: "Torsion Diagram",
    shortLabel: "TOR",
    color: "#a855f7",
    icon: <RotateCw size={16} />,
    description: "Display torsion (Mx) along members",
  },
  {
    id: "DEFLECTION",
    label: "Deflected Shape",
    shortLabel: "DEF",
    color: "#3b82f6",
    icon: <TrendingDown size={16} />,
    description: "Display deflected shape of structure",
  },
  {
    id: "BMD_MY",
    label: "Moment My (Weak Axis)",
    shortLabel: "My",
    color: "#14b8a6",
    icon: <BarChart3 size={16} />,
    description: "Display weak-axis bending moment (My) in XZ-plane",
  },
  {
    id: "SFD_VZ",
    label: "Shear Vz (Weak Axis)",
    shortLabel: "Vz",
    color: "#06b6d4",
    icon: <Waves size={16} />,
    description: "Display weak-axis shear force (Vz) in XZ-plane",
  },
];

// ============================================
// SCALE SLIDER COMPONENT
// ============================================

interface ScaleSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  unit?: string;
  logarithmic?: boolean;
}

const ScaleSlider: FC<ScaleSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  unit = "",
  logarithmic = false,
}) => {
  const displayValue = logarithmic
    ? Math.pow(10, value).toFixed(2)
    : value.toFixed(2);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
        <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
          {displayValue}
          {unit}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button type="button"
          onClick={() => onChange(Math.max(min, value - step * 5))}
          className="p-1 text-slate-500 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
        >
          <ZoomOut size={14} />
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer
                             accent-blue-500"
        />
        <button type="button"
          onClick={() => onChange(Math.min(max, value + step * 5))}
          className="p-1 text-slate-500 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
        >
          <ZoomIn size={14} />
        </button>
      </div>
    </div>
  );
};

// ============================================
// TOGGLE BUTTON COMPONENT
// ============================================

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}

const ToggleButton: FC<ToggleButtonProps> = ({
  active,
  onClick,
  children,
  color = "#3b82f6",
}) => (
  <button type="button"
    onClick={onClick}
    className={`px-3 py-1.5 text-xs font-medium rounded transition-all
                  ${
                    active
                      ? "bg-blue-500 text-white ring-2 ring-blue-400"
                      : "bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
  >
    {children}
  </button>
);

// ============================================
// SUMMARY CARD COMPONENT
// ============================================

interface SummaryCardProps {
  label: string;
  value: string | number;
  unit?: string;
  status?: "ok" | "warning" | "error";
  icon?: React.ReactNode;
}

const SummaryCard: FC<SummaryCardProps> = ({
  label,
  value,
  unit,
  status,
  icon,
}) => {
  const statusColors = {
    ok: "border-emerald-500/50 bg-emerald-900/20",
    warning: "border-amber-500/50 bg-amber-900/20",
    error: "border-red-500/50 bg-red-900/20",
  };
  const statusIcons = {
    ok: <CheckCircle size={14} className="text-emerald-400" />,
    warning: <AlertTriangle size={14} className="text-amber-400" />,
    error: <AlertTriangle size={14} className="text-red-400" />,
  };

  return (
    <div
      className={`p-3 rounded-lg border ${status ? statusColors[status] : "border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50"}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
        {status ? statusIcons[status] : icon}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold text-slate-700 dark:text-slate-200 font-mono">
          {typeof value === "number" ? value.toFixed(3) : value}
        </span>
        {unit && <span className="text-xs text-slate-500 dark:text-slate-400">{unit}</span>}
      </div>
    </div>
  );
};

// ============================================
// COLLAPSIBLE SECTION
// ============================================

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsibleSection: FC<CollapsibleSectionProps> = ({
  title,
  icon,
  defaultOpen = true,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-200 dark:border-slate-700">
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 
                         hover:bg-slate-700/30 transition-colors"
      >
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {icon}
        <span className="flex-1 text-left">{title}</span>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};

// ============================================
// MAIN RESULTS CONTROL PANEL
// ============================================

interface ResultsControlPanelProps {
  className?: string;
  onSettingsChange?: (settings: DisplaySettings) => void;
}

export const ResultsControlPanel: FC<ResultsControlPanelProps> = React.memo(({
  className = "",
  onSettingsChange,
}) => {
  const analysisResults = useModelStore((state) => state.analysisResults);
  const members = useModelStore((state) => state.members);
  const nodes = useModelStore((state) => state.nodes);

  const [settings, setSettings] = useState<DisplaySettings>({
    showDiagram: "none",
    diagramScale: 0.05,
    showLabels: true,
    showCriticalPoints: true,
    showFill: true,
    showBaseline: true,
    colorMode: "default",
    deflectedShapeScale: 50,
    showOriginalShape: true,
    animateDeflection: false,
    animationSpeed: 1,
  });

  const updateSettings = useCallback(
    (updates: Partial<DisplaySettings>) => {
      setSettings((prev) => {
        const newSettings = { ...prev, ...updates };
        onSettingsChange?.(newSettings);
        return newSettings;
      });
    },
    [onSettingsChange],
  );

  // Compute summary statistics
  const summary = useMemo(() => {
    if (!analysisResults) {
      return {
        maxDisplacement: 0,
        maxShear: 0,
        maxMoment: 0,
        maxAxial: 0,
        maxReaction: 0,
        utilizationStatus: "ok" as const,
      };
    }

    let maxDisplacement = 0;
    let maxShear = 0;
    let maxMoment = 0;
    let maxAxial = 0;
    let maxReaction = 0;

    analysisResults.displacements.forEach((d) => {
      const total =
        Math.sqrt((d.dx || 0) ** 2 + (d.dy || 0) ** 2 + (d.dz || 0) ** 2) *
        1000; // mm
      maxDisplacement = Math.max(maxDisplacement, total);
    });

    analysisResults.memberForces.forEach((f) => {
      maxShear = Math.max(maxShear, Math.abs(f.shearY), Math.abs(f.shearZ));
      maxMoment = Math.max(maxMoment, Math.abs(f.momentY), Math.abs(f.momentZ));
      maxAxial = Math.max(maxAxial, Math.abs(f.axial));
    });

    analysisResults.reactions.forEach((r) => {
      const total = Math.sqrt(
        (r.fx || 0) ** 2 + (r.fy || 0) ** 2 + (r.fz || 0) ** 2,
      );
      maxReaction = Math.max(maxReaction, total);
    });

    // Simple utilization check (would use actual code checks in production)
    const utilizationStatus: "ok" | "warning" | "error" =
      maxMoment > 500 ? "error" : maxMoment > 200 ? "warning" : "ok";

    return {
      maxDisplacement,
      maxShear,
      maxMoment,
      maxAxial,
      maxReaction,
      utilizationStatus,
    };
  }, [analysisResults]);

  return (
    <div
      className={`bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden min-h-0 flex flex-col ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50">
        <Sliders size={18} className="text-blue-400" />
        <h3 className="font-semibold text-slate-700 dark:text-slate-200">Results Display</h3>

        {analysisResults ? (
          <span className="ml-auto px-2 py-0.5 text-xs bg-emerald-900/50 text-emerald-400 rounded-full border border-emerald-500/30">
            ✓ Analyzed
          </span>
        ) : (
          <span className="ml-auto px-2 py-0.5 text-xs bg-amber-900/50 text-amber-400 rounded-full border border-amber-500/30 animate-pulse">
            No Results
          </span>
        )}
      </div>

      <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Quick Summary */}
        {analysisResults && (
          <CollapsibleSection title="Summary" icon={<Info size={14} />}>
            <div className="grid grid-cols-2 gap-2">
              <SummaryCard
                label="Max Displacement"
                value={summary.maxDisplacement}
                unit="mm"
                status={summary.maxDisplacement > 50 ? "warning" : "ok"}
              />
              <SummaryCard
                label="Max Shear"
                value={summary.maxShear}
                unit="kN"
              />
              <SummaryCard
                label="Max Moment"
                value={summary.maxMoment}
                unit="kNm"
                status={summary.utilizationStatus}
              />
              <SummaryCard
                label="Max Axial"
                value={summary.maxAxial}
                unit="kN"
              />
            </div>
          </CollapsibleSection>
        )}

        {/* Diagram Selection */}
        <CollapsibleSection
          title="Force Diagrams"
          icon={<BarChart3 size={14} />}
        >
          <div className="space-y-3">
            {/* Diagram Type Buttons */}
            <div className="grid grid-cols-3 gap-2">
              {diagramOptions.map((opt) => (
                <button type="button"
                  key={opt.id}
                  onClick={() => updateSettings({ showDiagram: opt.id })}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all
                                              ${
                                                settings.showDiagram === opt.id
                                                  ? "border-blue-500/50 bg-blue-900/20 text-blue-300"
                                                  : "border-slate-600 bg-slate-100/30 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400 hover:border-slate-500"
                                              }`}
                  style={
                    settings.showDiagram === opt.id
                      ? {
                          borderColor: opt.color + "80",
                          backgroundColor: opt.color + "15",
                        }
                      : {}
                  }
                  title={opt.description}
                >
                  <div
                    style={{
                      color:
                        settings.showDiagram === opt.id ? opt.color : undefined,
                    }}
                  >
                    {opt.icon}
                  </div>
                  <span className="text-xs font-medium">{opt.shortLabel}</span>
                </button>
              ))}
            </div>

            {/* Scale Control */}
            {settings.showDiagram !== "none" &&
              settings.showDiagram !== "DEFLECTION" && (
                <ScaleSlider
                  label="Diagram Scale"
                  value={settings.diagramScale}
                  min={0.001}
                  max={0.2}
                  step={0.005}
                  onChange={(v) => updateSettings({ diagramScale: v })}
                />
              )}

            {/* Deflection Scale */}
            {settings.showDiagram === "DEFLECTION" && (
              <ScaleSlider
                label="Deflection Magnification"
                value={settings.deflectedShapeScale}
                min={1}
                max={200}
                step={1}
                onChange={(v) => updateSettings({ deflectedShapeScale: v })}
                unit="×"
              />
            )}

            {/* Display Options */}
            {settings.showDiagram !== "none" && (
              <div className="flex flex-wrap gap-2">
                <ToggleButton
                  active={settings.showLabels}
                  onClick={() =>
                    updateSettings({ showLabels: !settings.showLabels })
                  }
                >
                  Labels
                </ToggleButton>
                <ToggleButton
                  active={settings.showCriticalPoints}
                  onClick={() =>
                    updateSettings({
                      showCriticalPoints: !settings.showCriticalPoints,
                    })
                  }
                >
                  Critical Pts
                </ToggleButton>
                <ToggleButton
                  active={settings.showFill}
                  onClick={() =>
                    updateSettings({ showFill: !settings.showFill })
                  }
                >
                  Fill
                </ToggleButton>
                <ToggleButton
                  active={settings.showBaseline}
                  onClick={() =>
                    updateSettings({ showBaseline: !settings.showBaseline })
                  }
                >
                  Baseline
                </ToggleButton>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Color Mode */}
        <CollapsibleSection
          title="Color Scheme"
          icon={<Palette size={14} />}
          defaultOpen={false}
        >
          <div className="space-y-2">
            {[
              {
                id: "default",
                label: "Standard Colors",
                desc: "Classic diagram colors",
              },
              {
                id: "stress",
                label: "Stress Gradient",
                desc: "Blue-White-Red stress scale",
              },
              {
                id: "utilization",
                label: "Utilization",
                desc: "Green-Yellow-Red capacity",
              },
              {
                id: "force",
                label: "Force Intensity",
                desc: "Color by force magnitude",
              },
            ].map((mode) => (
              <label
                key={mode.id}
                className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors
                                          ${
                                            settings.colorMode === mode.id
                                              ? "bg-blue-900/20 border border-blue-500/30"
                                              : "hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent"
                                          }`}
              >
                <input
                  type="radio"
                  name="colorMode"
                  checked={settings.colorMode === mode.id}
                  onChange={() =>
                    updateSettings({ colorMode: mode.id as ColorMode })
                  }
                  className="mt-1 accent-blue-500"
                />
                <div>
                  <div className="text-sm text-slate-700 dark:text-slate-200">{mode.label}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{mode.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </CollapsibleSection>

        {/* Animation Controls */}
        <CollapsibleSection
          title="Animation"
          icon={<Play size={14} />}
          defaultOpen={false}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">Animate Deflection</span>
              <button type="button"
                onClick={() =>
                  updateSettings({
                    animateDeflection: !settings.animateDeflection,
                  })
                }
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.animateDeflection ? "bg-blue-600" : "bg-slate-600"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                    settings.animateDeflection
                      ? "translate-x-6"
                      : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {settings.animateDeflection && (
              <ScaleSlider
                label="Animation Speed"
                value={settings.animationSpeed}
                min={0.1}
                max={3}
                step={0.1}
                onChange={(v) => updateSettings({ animationSpeed: v })}
                unit="×"
              />
            )}

            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Info size={14} />
              <span>Animation shows oscillating deflected shape</span>
            </div>
          </div>
        </CollapsibleSection>

        {/* View Options */}
        <CollapsibleSection
          title="View Options"
          icon={<Eye size={14} />}
          defaultOpen={false}
        >
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showOriginalShape}
                onChange={(e) =>
                  updateSettings({ showOriginalShape: e.target.checked })
                }
                className="accent-blue-500"
              />
              Show original (undeformed) shape
            </label>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">Quick Views</div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-600">
                  <Grid3X3 size={12} className="inline mr-1" />
                  Quad View
                </button>
                <button type="button" className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-600">
                  <Maximize2 size={12} className="inline mr-1" />
                  Full 3D
                </button>
                <button type="button" className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-600">
                  <Box size={12} className="inline mr-1" />
                  Isometric
                </button>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Model Info */}
        <CollapsibleSection
          title="Model Info"
          icon={<Layers size={14} />}
          defaultOpen={false}
        >
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Nodes</span>
              <span className="font-mono text-slate-700 dark:text-slate-200">{nodes.size}</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Members</span>
              <span className="font-mono text-slate-700 dark:text-slate-200">{members.size}</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>DOFs</span>
              <span className="font-mono text-slate-700 dark:text-slate-200">{nodes.size * 6}</span>
            </div>
            {analysisResults && (
              <>
                <div className="border-t border-slate-200 dark:border-slate-700 my-2" />
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Analysis Status</span>
                  <span className="text-emerald-400">Complete</span>
                </div>
              </>
            )}
          </div>
        </CollapsibleSection>
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-100/30 dark:bg-slate-800/30">
        <button type="button"
          onClick={() => {
            setSettings({
              showDiagram: "none",
              diagramScale: 0.05,
              showLabels: true,
              showCriticalPoints: true,
              showFill: true,
              showBaseline: true,
              colorMode: "default",
              deflectedShapeScale: 50,
              showOriginalShape: true,
              animateDeflection: false,
              animationSpeed: 1,
            });
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm
                             bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md hover:bg-slate-600 transition-colors"
        >
          <RefreshCw size={14} />
          Reset Display Settings
        </button>
      </div>
    </div>
  );
});

(ResultsControlPanel as unknown as { displayName: string }).displayName = 'ResultsControlPanel';

export default ResultsControlPanel;
