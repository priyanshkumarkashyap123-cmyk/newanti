import { FC, memo, ReactNode, useCallback, useMemo } from "react";
import {
  MousePointer2,
  Box,
  Spline,
  Table2,
  Save,
  FolderOpen,
  Undo,
  Redo,
  Play,
  Settings,
  Download,
  FileText,
  Grid,
  Database,
  Crown,
  Activity,
  Cpu,
  Anchor,
  Weight,
  Ruler,
  Building2,
  Columns,
  Link2,
  Landmark,
  CheckSquare,
  FileCheck,
  Layers,
  SquareStack,
  Globe,
  Sparkles,
  BarChart3,
  Copy,
  Menu,
  FlipHorizontal,
  RotateCcw,
  Scissors,
  Trash2,
  Move,
  Wind,
  Zap,
  Target,
  ArrowDown,
  TrendingUp,
  Eye,
  Maximize2,
  Workflow,
  Search,
  Calculator,
  Check,
  GitMerge,
  SplitSquareVertical,
  Thermometer,
  FileSpreadsheet,
  Command,
  // ── NEW ICONS for parity ──
  Cable,
  CircleDot,
  Repeat,
  Repeat2,
  AlignVerticalJustifyCenter,
  Import,
  FileUp,
  Triangle,
  Hexagon,
  PanelTopClose,
  Scan,
  Navigation,
  Gauge,
  Snowflake,
  BookOpen,
  ListOrdered,
  Shapes,
  Waves,
  Lock,
  Unlock,
  ArrowUpDown,
  TreePine,
  LayoutGrid,
} from "lucide-react";
import { motion } from "framer-motion";
import { useComputePreference } from "../../hooks/useComputePreference";
import { ComputeModeIndicator } from "./ComputeModeIndicator";
import { Link, useNavigate } from "react-router-dom";
import { useModelStore, useModelStoreTemporal } from "../../store/model";
import { useUIStore, Category } from "../../store/uiStore";
import { Tooltip } from "../ui/Tooltip";
import { MODELING_ACTIONS } from "../../data/modelingActionRegistry";
import { TierGate } from "../TierGate";

/* ─── Stable sub-components (extracted to avoid re-mounting every render) ─── */

interface ToolButtonProps {
  icon: FC<{ className?: string }>;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  size?: 'normal' | 'large' | 'compact';
  className?: string;
  tooltip?: string;
  shortcut?: string;
  accent?: string;
}

const ToolButton = memo<ToolButtonProps>(
  ({
    icon: Icon,
    label,
    onClick,
    isActive = false,
    disabled = false,
    size = 'normal',
    className = "",
    tooltip,
    shortcut,
    accent,
  }) => {
    const sizeClasses = {
      large: "h-[56px] w-[56px] min-w-[56px]",
      normal: "h-[50px] w-[50px] min-w-[50px]",
      compact: "flex-row h-8 px-2.5 w-auto gap-1.5 min-w-0",
    };

    const iconSize = {
      large: "w-6 h-6",
      normal: "w-4 h-4",
      compact: "w-3.5 h-3.5",
    };

    return (
      <Tooltip content={tooltip || label} shortcut={shortcut}>
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClick}
          disabled={disabled}
          aria-pressed={isActive}
          className={`
                  flex flex-col items-center justify-center gap-0.5 px-1.5 py-1 rounded-md
                  border border-transparent transition-all duration-150
                  hover:bg-slate-200/50 dark:hover:bg-slate-700/50 hover:border-slate-300/50 dark:hover:border-slate-600/30
                  ${isActive
              ? "bg-blue-600/15 border-blue-500/30 text-blue-600 dark:text-blue-300 shadow-sm shadow-blue-500/5"
              : accent
                ? `${accent}`
                : "text-slate-500 hover:text-slate-700 dark:text-slate-200"
            }
                  ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                  ${sizeClasses[size]}
                  ${className}
              `}
        >
          <Icon className={`${iconSize[size]} flex-shrink-0`} aria-hidden="true" />
          {size !== 'compact' && (
            <span className="text-[10px] whitespace-nowrap text-center leading-tight max-w-[48px] truncate font-medium tracking-wide tracking-wide">
              {label}
            </span>
          )}
          {size === 'compact' && (
            <span className="text-[10px] whitespace-nowrap font-medium tracking-wide tracking-wide">{label}</span>
          )}
        </motion.button>
      </Tooltip>
    );
  },
);
ToolButton.displayName = "ToolButton";

const ToolGroup = memo<{ label: string; children: ReactNode; className?: string }>(
  ({ label, children, className = "" }) => (
    <div className={`flex flex-col h-full border-r border-slate-200/30 dark:border-slate-700/30 px-1.5 pb-2.5 pt-1 last:border-r-0 ${className}`}>
      <div className="flex-1 flex items-center gap-0.5">{children}</div>
      <div className="text-[9px] text-[#869ab8] text-center uppercase tracking-[0.08em] mt-0.5 select-none font-medium tracking-wide tracking-wide">
        {label}
      </div>
    </div>
  ),
);
ToolGroup.displayName = "ToolGroup";

/* ─── Quick Stacked buttons (two small buttons vertically) ─── */
const StackedButtons = memo<{ children: ReactNode }>(({ children }) => (
  <div className="flex flex-col gap-0.5 justify-center">{children}</div>
));
StackedButtons.displayName = "StackedButtons";

const MiniButton = memo<{
  icon: FC<{ className?: string }>;
  label: string;
  onClick: () => void;
  shortcut?: string;
  className?: string;
}>(({ icon: Icon, label, onClick, shortcut, className = "" }) => (
  <Tooltip content={label} shortcut={shortcut}>
    <button type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-1.5 py-1 rounded text-slate-500 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-all text-[9px] ${className}`}
    >
      <Icon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
      <span className="font-medium tracking-wide tracking-wide">{label}</span>
    </button>
  </Tooltip>
));
MiniButton.displayName = "MiniButton";

/* ─── Ribbon categories (tabs) ─── */

const RIBBON_TABS: { id: Category; label: string; color: string }[] = [
  { id: "MODELING", label: "Geometry", color: "blue" },
  { id: "PROPERTIES", label: "Properties", color: "purple" },
  { id: "SUPPORTS", label: "Supports", color: "cyan" },
  { id: "LOADING", label: "Loading", color: "orange" },
  { id: "ANALYSIS", label: "Analysis", color: "emerald" },
  { id: "DESIGN", label: "Design", color: "rose" },
  { id: "CIVIL", label: "Civil Engg", color: "amber" },
];

const TAB_ACTIVE_COLORS: Record<string, string> = {
  blue: "bg-blue-50 dark:bg-slate-800/60 text-blue-600 dark:text-blue-400 border-t-2 border-t-blue-500",
  purple: "bg-purple-50 dark:bg-slate-800/60 text-purple-600 dark:text-purple-400 border-t-2 border-t-purple-500",
  cyan: "bg-cyan-50 dark:bg-slate-800/60 text-cyan-600 dark:text-cyan-400 border-t-2 border-t-cyan-500",
  orange: "bg-orange-50 dark:bg-slate-800/60 text-orange-600 dark:text-orange-400 border-t-2 border-t-orange-500",
  emerald: "bg-emerald-50 dark:bg-slate-800/60 text-emerald-600 dark:text-emerald-400 border-t-2 border-t-emerald-500",
  rose: "bg-rose-50 dark:bg-slate-800/60 text-rose-600 dark:text-rose-400 border-t-2 border-t-rose-500",
  amber: "bg-amber-50 dark:bg-slate-800/60 text-amber-600 dark:text-amber-400 border-t-2 border-t-amber-500",
};

/* ─── Main ribbon component ─── */

interface RibbonProps {
  activeCategory: Category;
  isSidebarOpen?: boolean;
}

type RibbonModalKey = keyof ReturnType<typeof useUIStore.getState>['modals'];

export const EngineeringRibbon: FC<RibbonProps> = memo(({ activeCategory, isSidebarOpen }) => {
  const navigate = useNavigate();
  const activeTool = useModelStore((s) => s.activeTool);
  const setTool = useModelStore((s) => s.setTool);
  const isAnalyzing = useModelStore((s) => s.isAnalyzing);
  const computePreference = useComputePreference();
  const hasResults = useModelStore((s) => s.analysisResults !== null);
  const openModal = useUIStore((s) => s.openModal);
  const setCategory = useUIStore((s) => s.setCategory);
  const setDesignCodePreset = useUIStore((s) => s.setDesignCodePreset);
  const setDesignTabPreset = useUIStore((s) => s.setDesignTabPreset);
  const workflowCompletion = useUIStore((s) => s.workflowCompletion);
  const { undo, redo } = useModelStoreTemporal.getState();

  const executeSharedAction = useCallback((actionId: string) => {
    const action = MODELING_ACTIONS.find((item) => item.id === actionId);
    if (!action) return;

    const designRedirectByModal: Record<string, string> = {
      rcDetailing: "/design/detailing",
      steelDetailing: "/design/connections",
      sectionOptimization: "/design-hub",
      designHub: "/design-hub",
    };

    switch (action.handler) {
      case "setTool":
        setTool(action.target as Parameters<typeof setTool>[0]);
        break;
      case "openModal":
        if (action.target in designRedirectByModal) {
          navigate(designRedirectByModal[action.target]);
          break;
        }
        if (action.target in useUIStore.getState().modals) {
          openModal(action.target as RibbonModalKey);
        } else {
          useUIStore
            .getState()
            .showNotification("info", `${action.label} opened in guided mode for this build.`);
        }
        break;
      case "dispatch":
        document.dispatchEvent(new CustomEvent(action.target));
        break;
      case "storeAction":
        if (action.target === "deleteSelection") {
          useModelStore.getState().deleteSelection();
        }
        break;
      default:
        break;
    }
  }, [navigate, openModal, setTool]);

  const renderGeometryTab = useMemo(() => (
    <>
      <ToolGroup label="File">
        <ToolButton
          icon={Save}
          label="Save"
          onClick={() => document.dispatchEvent(new CustomEvent("trigger-save"))}
          shortcut="Ctrl+S"
        />
        <StackedButtons>
          <MiniButton icon={FolderOpen} label="Open" onClick={() => document.dispatchEvent(new CustomEvent("trigger-cloud-open"))} shortcut="Ctrl+O" />
          <MiniButton icon={Download} label="Export" onClick={() => document.dispatchEvent(new CustomEvent("trigger-export"))} />
        </StackedButtons>
        <StackedButtons>
          <MiniButton icon={Undo} label="Undo" onClick={() => undo()} shortcut="Ctrl+Z" />
          <MiniButton icon={Redo} label="Redo" onClick={() => redo()} shortcut="Ctrl+Shift+Z" />
        </StackedButtons>
      </ToolGroup>

      <ToolGroup label="Structure">
        <ToolButton
          icon={Grid}
          label="Wizard"
          onClick={() => openModal("structureWizard")}
          tooltip="Structure Generation Wizard"
          shortcut="Ctrl+Shift+W"
          size="large"
        />
        <ToolButton
          icon={Database}
          label="Gallery"
          onClick={() => openModal("structureGallery")}
          tooltip="Load Pre-built Structures (Bridges, Trusses, Frames)"
        />
      </ToolGroup>

      <ToolGroup label="Create">
        <ToolButton
          icon={Box}
          label="Node"
          onClick={() => executeSharedAction("add-node")}
          isActive={activeTool === "node"}
          tooltip="Create Node — Click to place"
          shortcut="N"
        />
        <ToolButton
          icon={Spline}
          label="Beam"
          onClick={() => executeSharedAction("add-beam")}
          isActive={activeTool === "member"}
          tooltip="Create Beam/Column Member"
          shortcut="M"
        />
        <ToolButton
          icon={Grid}
          label="Plate"
          onClick={() => openModal("plateDialog")}
          tooltip="Create Plate/Shell Element"
          shortcut="P"
        />
        <ToolButton
          icon={Layers}
          label="Slab"
          onClick={() => openModal("floorSlabDialog")}
          tooltip="Add Floor/Roof Slab — auto-detect panels"
        />
      </ToolGroup>

      <ToolGroup label="Select">
        <ToolButton
          icon={MousePointer2}
          label="Select"
          onClick={() => executeSharedAction("select")}
          isActive={activeTool === "select"}
          shortcut="V"
        />
        <ToolButton
          icon={Search}
          label="Advanced"
          onClick={() => openModal("selectionToolbar")}
          tooltip="Advanced Selection — By ID, Level, Property"
        />
      </ToolGroup>

      <ToolGroup label="Edit">
        <StackedButtons>
          <MiniButton icon={Copy} label="Copy" onClick={() => executeSharedAction("copy")} shortcut="Ctrl+C" />
          <MiniButton icon={Move} label="Move" onClick={() => executeSharedAction("move")} />
        </StackedButtons>
        <StackedButtons>
          <MiniButton icon={FlipHorizontal} label="Mirror" onClick={() => executeSharedAction("mirror")} />
          <MiniButton icon={RotateCcw} label="Rotate" onClick={() => executeSharedAction("rotate")} />
        </StackedButtons>
        <StackedButtons>
          <MiniButton icon={Scissors} label="Split" onClick={() => executeSharedAction("split")} />
          <MiniButton icon={Trash2} label="Delete" onClick={() => executeSharedAction("delete")} shortcut="Del" />
        </StackedButtons>
        <StackedButtons>
          <MiniButton icon={SplitSquareVertical} label="Divide" onClick={() => executeSharedAction("divide")} />
          <MiniButton icon={GitMerge} label="Merge" onClick={() => executeSharedAction("merge")} />
        </StackedButtons>
      </ToolGroup>

      <ToolGroup label="Supports">
        <ToolButton
          icon={Anchor}
          label="Boundary"
          onClick={() => openModal("boundaryConditionsDialog")}
          tooltip="Assign Supports — Fixed, Pinned, Roller, Custom"
        />
      </ToolGroup>

      <ToolGroup label="Generators">
        <StackedButtons>
          <MiniButton icon={Triangle} label="Truss" onClick={() => openModal("trussGenerator")} />
          <MiniButton icon={Spline} label="Arch" onClick={() => openModal("archGenerator")} />
        </StackedButtons>
        <StackedButtons>
          <MiniButton icon={Building2} label="Frame" onClick={() => openModal("frameGenerator")} />
          <MiniButton icon={Cable} label="Cable" onClick={() => openModal("cablePatternGenerator")} />
        </StackedButtons>
        <StackedButtons>
          <MiniButton icon={Navigation} label="Tower" onClick={() => openModal("towerGenerator")} />
          <MiniButton icon={Building2} label="Staircase" onClick={() => openModal("staircaseGenerator")} />
        </StackedButtons>
      </ToolGroup>

      <ToolGroup label="Array">
        <StackedButtons>
          <MiniButton icon={Repeat} label="Linear" onClick={() => openModal("linearArrayDialog")} />
          <MiniButton icon={Repeat2} label="Polar" onClick={() => openModal("polarArrayDialog")} />
        </StackedButtons>
        <StackedButtons>
          <MiniButton icon={Maximize2} label="Scale" onClick={() => executeSharedAction("scale")} />
          <MiniButton icon={ArrowUpDown} label="Extrude" onClick={() => executeSharedAction("extrude")} />
        </StackedButtons>
      </ToolGroup>

      <ToolGroup label="Advanced Draw">
        <StackedButtons>
          <MiniButton icon={Cable} label="Cable" onClick={() => { setTool("member"); openModal("curvedStructure"); }} />
          <MiniButton icon={Spline} label="Arch" onClick={() => openModal("curvedStructure")} />
        </StackedButtons>
        <MiniButton icon={Link2} label="Rigid Link" onClick={() => setTool("member")} />
      </ToolGroup>

      <ToolGroup label="Measure">
        <StackedButtons>
          <MiniButton icon={Ruler} label="Distance" onClick={() => openModal("measureDistanceDialog")} />
          <MiniButton icon={Scan} label="Angle" onClick={() => openModal("measureAngleDialog")} />
        </StackedButtons>
        <MiniButton icon={SquareStack} label="Area" onClick={() => openModal("measureAreaDialog")} />
      </ToolGroup>

      <ToolGroup label="Import">
        <StackedButtons>
          <MiniButton icon={FileUp} label="DXF" onClick={() => openModal("importDxfDialog")} />
          <MiniButton icon={Import} label="IFC/BIM" onClick={() => openModal("importIfcDialog")} />
        </StackedButtons>
      </ToolGroup>
    </>
  ), [activeTool, executeSharedAction, openModal, undo, redo, setTool]);

  const renderPropertiesTab = useMemo(() => (
    <>
      <ToolGroup label="Section">
        <ToolButton
          icon={Layers}
          label="Library"
          onClick={() => executeSharedAction("section-library")}
          tooltip="Section Database — ISMB, ISMC, W-Shapes, Custom (Rust Backend)"
          size="large"
        />
        <StackedButtons>
          <MiniButton icon={Settings} label="Assign" onClick={() => executeSharedAction("assign-section")} />
          <MiniButton icon={Calculator} label="Section Builder" onClick={() => executeSharedAction("custom-section")} />
        </StackedButtons>
      </ToolGroup>
      <ToolGroup label="Material">
        <ToolButton
          icon={Database}
          label="Material"
          onClick={() => executeSharedAction("material-library")}
          tooltip="Material Library — Steel, Concrete, Timber, Custom"
        />
        <StackedButtons>
          <MiniButton icon={Settings} label="Assign" onClick={() => executeSharedAction("assign-material")} />
          <MiniButton icon={Table2} label="Properties" onClick={() => executeSharedAction("material-props")} />
        </StackedButtons>
      </ToolGroup>
      <ToolGroup label="Specifications">
        <ToolButton icon={Table2} label="Beta Angle" onClick={() => executeSharedAction("beta-angle")} tooltip="Member Orientation / Beta Angle" />
        <ToolButton icon={Link2} label="Releases" onClick={() => executeSharedAction("releases")} tooltip="Member End Releases — Pinned, Partial" />
        <ToolButton icon={Ruler} label="Offsets" onClick={() => executeSharedAction("offsets")} tooltip="Member End Offsets" />
      </ToolGroup>
      <ToolGroup label="Plate">
        <ToolButton icon={LayoutGrid} label="Thickness" onClick={() => openModal("plateThicknessDialog")} tooltip="Assign Plate Element Thickness" />
        <MiniButton icon={Grid} label="Meshing" onClick={() => openModal("meshing")} />
      </ToolGroup>
      <ToolGroup label="Advanced Section">
        <StackedButtons>
          <MiniButton icon={TrendingUp} label="Tapered" onClick={() => openModal("taperedSectionDialog")} />
          <MiniButton icon={Layers} label="Composite" onClick={() => openModal("compositeSectionDialog")} />
        </StackedButtons>
        <MiniButton icon={FileUp} label="Import Table" onClick={() => openModal("importSectionTableDialog")} />
      </ToolGroup>
      <ToolGroup label="Advanced Props">
        <StackedButtons>
          <MiniButton icon={Cable} label="Cable Props" onClick={() => openModal("cablePropsDialog")} />
          <MiniButton icon={Activity} label="Spring" onClick={() => openModal("springConstantsDialog")} />
        </StackedButtons>
        <StackedButtons>
          <MiniButton icon={Weight} label="Mass" onClick={() => openModal("lumpedMassDialog")} />
          <MiniButton icon={CircleDot} label="Hinge" onClick={() => openModal("memberHingesDialog")} />
        </StackedButtons>
      </ToolGroup>
    </>
  ), [executeSharedAction, openModal]);

  const renderLoadingTab = useMemo(() => (
    <>
      <ToolGroup label="Load Cases">
        <ToolButton
          icon={Layers}
          label="Define"
          onClick={() => executeSharedAction("define-load")}
          tooltip="Create/Manage Load Cases (DL, LL, WL, EQ)"
          size="large"
        />
        <ToolButton
          icon={Workflow}
          label="Combos"
          onClick={() => executeSharedAction("load-combos")}
          tooltip="Load Combinations — IS 875 / ASCE 7 / EN 1990"
        />
        <ToolButton
          icon={Layers}
          label="Auto Combos"
          onClick={() => executeSharedAction("load-combos")}
          tooltip="Auto-generate Load Combinations per Code"
        />
      </ToolGroup>
      <ToolGroup label="Nodal Loads">
        <ToolButton
          icon={ArrowDown}
          label="Force"
          onClick={() => executeSharedAction("point-load")}
          isActive={activeTool === "load"}
          tooltip="Apply Nodal Force (Fx, Fy, Fz) — click on node"
          shortcut="L"
        />
        <ToolButton
          icon={RotateCcw}
          label="Moment"
          onClick={() => { executeSharedAction("point-load"); openModal("momentLoadDialog"); }}
          tooltip="Apply Nodal Moment (Mx, My, Mz)"
        />
        <ToolButton
          icon={Anchor}
          label="Settlement"
          onClick={() => openModal("supportDisplacement")}
          tooltip="Support Settlement / Prescribed Displacement"
        />
      </ToolGroup>
      <ToolGroup label="Member Loads">
        <ToolButton
          icon={Spline}
          label="UDL"
          onClick={() => executeSharedAction("udl")}
          isActive={activeTool === "memberLoad"}
          tooltip="Uniformly Distributed Load — select member first"
          shortcut="U"
        />
        <ToolButton
          icon={TrendingUp}
          label="Trapezoidal"
          onClick={() => { setTool("memberLoad"); openModal("trapezoidalLoadDialog"); }}
          tooltip="Trapezoidal / Triangular Load — specify start & end values"
        />
        <ToolButton
          icon={Target}
          label="Point"
          onClick={() => { setTool("memberLoad"); openModal("pointLoadDialog"); }}
          tooltip="Concentrated Point Load at specific position on member"
        />
        <ToolButton
          icon={Activity}
          label="Pre-stress"
          onClick={() => openModal("prestressLoad")}
          tooltip="Pre-stress / Post-tension Load"
        />
      </ToolGroup>
      <ToolGroup label="Area Loads">
        <ToolButton
          icon={SquareStack}
          label="Floor Load"
          onClick={() => openModal("loadDialog")}
          tooltip="Floor / Roof Area Load"
        />
        <ToolButton
          icon={SquareStack}
          label="Pressure"
          onClick={() => openModal("pressureLoad")}
          tooltip="Hydrostatic / Earth Pressure Load"
        />
      </ToolGroup>
      <ToolGroup label="Codal Generators">
        <ToolButton
          icon={Weight}
          label="Self Weight"
          onClick={() => executeSharedAction("self-weight")}
          tooltip="Auto-generate Dead Load from self-weight"
        />
        <ToolButton
          icon={Wind}
          label="Wind"
          onClick={() => executeSharedAction("wind-load")}
          tooltip="Wind Load Generator — IS 875-III / ASCE 7-22 / EN 1991-1-4"
        />
        <StackedButtons>
          <MiniButton icon={Zap} label="IS 1893 Seismic" onClick={() => openModal("is1893SeismicDialog")} />
          <MiniButton icon={Zap} label="ASCE 7 Seismic" onClick={() => openModal("asce7SeismicDialog")} />
        </StackedButtons>
        <StackedButtons>
          <MiniButton icon={Zap} label="EN 1998 Seismic" onClick={() => openModal("en1998SeismicDialog")} />
          <MiniButton icon={Weight} label="IS 875-II Live" onClick={() => openModal("is875LiveLoad")} />
        </StackedButtons>
        <ToolButton
          icon={Thermometer}
          label="Thermal"
          onClick={() => executeSharedAction("temperature")}
          tooltip="Temperature Load — Uniform ΔT / Gradient"
        />
      </ToolGroup>
      <ToolGroup label="Advanced">
        <ToolButton
          icon={Move}
          label="Moving"
          onClick={() => openModal("movingLoadDialog")}
          tooltip="Moving / Vehicle Load — Define load path"
        />
        <ToolButton
          icon={Snowflake}
          label="Snow"
          onClick={() => openModal("snowLoadDialog")}
          tooltip="Snow Load Generator by Code"
        />
      </ToolGroup>
      <ToolGroup label="Load Mgmt">
        <StackedButtons>
          <MiniButton icon={BookOpen} label="Reference" onClick={() => openModal("referenceLoadsDialog")} />
          <MiniButton icon={Shapes} label="Envelopes" onClick={() => openModal("loadEnvelopesDialog")} />
        </StackedButtons>
        <StackedButtons>
          <MiniButton icon={ArrowDown} label="Notional" onClick={() => openModal("notionalLoadsDialog")} />
          <MiniButton icon={ListOrdered} label="Manager" onClick={() => openModal("loadCaseManagerDialog")} />
        </StackedButtons>
      </ToolGroup>
    </>
  ), [activeTool, executeSharedAction, setTool, openModal]);

  const renderAnalysisTab = useMemo(() => (
    <>
      <ToolGroup label="Run">
        <div className="flex flex-col gap-1.5 items-center justify-center mr-1">
          <ToolButton
            icon={Play}
            label="RUN ANALYSIS"
            onClick={() => executeSharedAction("run-analysis")}
            isActive={isAnalyzing}
            tooltip="Run Linear Static Analysis"
            shortcut="F5"
            size="large"
            accent={isAnalyzing ? "text-yellow-400" : "bg-gradient-to-br from-emerald-600 to-teal-700 text-white hover:from-emerald-500 hover:to-teal-600 shadow-lg shadow-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]"}
            className={isAnalyzing ? "animate-pulse" : ""}
          />
          <ComputeModeIndicator mode={computePreference} />
        </div>
        <StackedButtons>
          <MiniButton
            icon={Activity}
            label="Modal"
            onClick={() => executeSharedAction("modal")}
          />
          <MiniButton
            icon={TrendingUp}
            label="P-Delta"
            onClick={() => executeSharedAction("pdelta")}
          />
        </StackedButtons>
      </ToolGroup>
      <ToolGroup label="Advanced">
        <ToolButton
          icon={Activity}
          label="Buckling"
          onClick={() => executeSharedAction("buckling")}
          tooltip="Linear Buckling Analysis"
        />
        <ToolButton
          icon={BarChart3}
          label="Response"
          onClick={() => openModal("advancedAnalysis")}
          tooltip="Response Spectrum Analysis — IS 1893 / ASCE 7 / EC8"
        />
        <ToolButton
          icon={Workflow}
          label="Pushover"
          onClick={() => openModal("advancedAnalysis")}
          tooltip="Nonlinear Static Pushover Analysis"
        />
        <ToolButton
          icon={Activity}
          label="Time History"
          onClick={() => openModal("timeHistoryAnalysis")}
          tooltip="Nonlinear Dynamic Time History Analysis"
        />
        <ToolButton
          icon={TrendingUp}
          label="Non-linear"
          onClick={() => openModal("nonlinearAnalysis")}
          tooltip="Nonlinear Static Analysis (Material & Geometric)"
        />
      </ToolGroup>
      <ToolGroup label="Results">
        <ToolButton
          icon={Eye}
          label="Deformed"
          onClick={() => executeSharedAction("deformed-shape")}
          tooltip="View Deformed Shape"
          isActive={hasResults}
        />
        <StackedButtons>
          <MiniButton icon={BarChart3} label="SFD" onClick={() => executeSharedAction("sfd")} />
          <MiniButton icon={BarChart3} label="BMD" onClick={() => executeSharedAction("bmd")} />
        </StackedButtons>
        <StackedButtons>
          <MiniButton icon={BarChart3} label="AFD" onClick={() => executeSharedAction("afd")} />
          <MiniButton icon={Activity} label="Deflection" onClick={() => executeSharedAction("deflection")} />
        </StackedButtons>
        <ToolButton
          icon={Anchor}
          label="Reactions"
          onClick={() => executeSharedAction("reactions")}
          tooltip="View Support Reactions Table"
        />
        <ToolButton
          icon={Maximize2}
          label="Results Hub"
          onClick={() => executeSharedAction("open-results-hub")}
          tooltip="Unified analysis, design, detailing, and report hub"
        />
      </ToolGroup>
      <ToolGroup label="Export">
        <StackedButtons>
          <MiniButton icon={FileText} label="PDF Report" onClick={() => document.dispatchEvent(new CustomEvent("trigger-pdf-report"))} />
          <MiniButton icon={FileSpreadsheet} label="CSV Export" onClick={() => executeSharedAction("export-results")} />
        </StackedButtons>
        <ToolButton
          icon={Download}
          label="Full Export"
          onClick={() => document.dispatchEvent(new CustomEvent("trigger-export"))}
          tooltip="Export Results to PDF / CSV / Excel / DXF"
        />
      </ToolGroup>
      <ToolGroup label="Additional">
        <ToolButton
          icon={Cable}
          label="Cable"
          onClick={() => openModal("cableAnalysisDialog")}
          tooltip="Nonlinear Cable / Catenary Analysis"
        />
        <ToolButton
          icon={Hexagon}
          label="Stress Map"
          onClick={() => openModal("stressContourDialog")}
          tooltip="Plate/Shell Stress Contour Visualization"
        />
        <ToolButton
          icon={Gauge}
          label="Steady-State"
          onClick={() => openModal("steadyStateDialog")}
          tooltip="Steady-State Dynamic / Vibration Analysis"
        />
      </ToolGroup>
    </>
  ), [isAnalyzing, executeSharedAction, openModal, hasResults, computePreference]);

  return (
    <div
      className="w-full bg-white/98 dark:bg-slate-900/98 backdrop-blur-md border-b border-slate-200/40 dark:border-slate-700/40 flex flex-col select-none"
      role="toolbar"
      aria-label="Engineering Ribbon"
    >
      {/* Title Bar */}
      <div className="h-8 flex items-center justify-between px-3 border-b border-[#1a2333]/60 bg-white/90 dark:bg-slate-950/90">
        <div className="flex items-center gap-2">
          {/* Mobile sidebar toggle */}
          <button type="button"
            className="md:hidden text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded p-0.5 transition-colors"
            onClick={() => document.dispatchEvent(new CustomEvent('toggle-sidebar'))}
            aria-label="Toggle sidebar navigation"
            aria-expanded={isSidebarOpen ?? false}
          >
            <Menu className="w-4 h-4" />
          </button>
          <Link
            to="/stream"
            className="flex items-center gap-2 group hover:opacity-90 transition-opacity"
          >
            <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[4px] flex items-center justify-center shadow-sm shadow-blue-500/20">
              <Cpu className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200 tracking-tight">BeamLab</span>
            <span className="px-1.5 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold rounded flex items-center gap-1">
              ULTIMATE
            </span>
          </Link>
        </div>

        {/* Category Tabs */}
        <div
          className="flex items-center gap-0.5 bg-slate-50/50 dark:bg-slate-900/50 rounded-lg p-0.5 overflow-x-auto scrollbar-none"
          role="tablist"
          aria-label="Ribbon categories"
        >
          {RIBBON_TABS.map((tab) => {
            const isActive = activeCategory === tab.id;
            const isComplete = workflowCompletion[tab.id];
            return (
              <button type="button"
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setCategory(tab.id)}
                className={`
                  px-3 py-1 rounded-md text-[13px] font-medium tracking-wide tracking-wide tracking-normal transition-all duration-150 border whitespace-nowrap flex-shrink-0 relative
                  ${isActive
                    ? `${TAB_ACTIVE_COLORS[tab.color]} shadow-sm`
                    : "text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/40 dark:hover:bg-slate-800/40 border-transparent"
                  }
                `}
              >
                {tab.label.toUpperCase()}
                {isComplete && !isActive && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border border-white dark:border-slate-900" title="Step completed" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <button type="button"
            onClick={() => document.dispatchEvent(new CustomEvent("open-staad-command-explorer"))}
            aria-label="Open STAAD command explorer"
            className="flex items-center gap-1 px-2 py-0.5 text-blue-600 dark:text-blue-400/90 hover:text-blue-500 dark:hover:text-blue-300 text-[9px] font-semibold transition-colors"
          >
            <Command className="w-3 h-3" aria-hidden="true" />
            Commands
          </button>
          <button type="button"
            onClick={() => document.dispatchEvent(new CustomEvent("trigger-upgrade"))}
            aria-label="Upgrade to premium plan"
            className="flex items-center gap-1 px-2 py-0.5 text-amber-600 dark:text-amber-400/80 hover:text-amber-500 dark:hover:text-amber-300 text-[9px] font-semibold transition-colors"
          >
            <Crown className="w-3 h-3" aria-hidden="true" />
            Upgrade
          </button>
          <span className="text-[9px] text-[#869ab8] font-mono flex items-center gap-1" role="status" aria-live="polite">
            <Check className="w-3 h-3 text-green-500" aria-hidden="true" />
            Auto-Saved
          </span>
        </div>
      </div>

      {/* Tools Area */}
      <div
        className="h-[100px] flex items-center px-1 py-0.5 gap-0 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent"
        role="group"
        aria-label={`${activeCategory} tools`}
      >
        {activeCategory === "MODELING" && renderGeometryTab}
        {activeCategory === "PROPERTIES" && renderPropertiesTab}
        {activeCategory === "SUPPORTS" && (
          <>
            <ToolGroup label="Standard">
              <ToolButton
                icon={Lock}
                label="Fixed"
                onClick={() => openModal("fixedSupportDialog")}
                tooltip="Fixed Support — All DOFs restrained"
                size="large"
              />
              <ToolButton
                icon={CircleDot}
                label="Pinned"
                onClick={() => openModal("pinnedSupportDialog")}
                tooltip="Pinned Support — Translations restrained, rotations free"
                size="large"
              />
              <ToolButton
                icon={Move}
                label="Roller"
                onClick={() => openModal("rollerSupportDialog")}
                tooltip="Roller Support — One translation free"
                size="large"
              />
            </ToolGroup>
            <ToolGroup label="Custom">
              <ToolButton
                icon={Settings}
                label="Custom DOF"
                onClick={() => openModal("customSupportDialog")}
                tooltip="Custom Support — Select individual DOFs to restrain"
              />
              <ToolButton
                icon={Unlock}
                label="Fixed+Release"
                onClick={() => openModal("fixedWithReleasesDialog")}
                tooltip="Fixed with Releases — Fixed support with specific DOFs released"
              />
              <ToolButton
                icon={Navigation}
                label="Inclined"
                onClick={() => openModal("inclinedSupportDialog")}
                tooltip="Inclined Support — Support at angle to global axes"
              />
            </ToolGroup>
            <ToolGroup label="Spring">
              <ToolButton
                icon={Activity}
                label="Trans. Spring"
                onClick={() => openModal("translationalSpringDialog")}
                tooltip="Translational Spring — Kx, Ky, Kz (force/displacement)"
              />
              <ToolButton
                icon={RotateCcw}
                label="Rot. Spring"
                onClick={() => openModal("rotationalSpringDialog")}
                tooltip="Rotational Spring — KRx, KRy, KRz (moment/rotation)"
              />
              <ToolButton
                icon={Waves}
                label="Multi-linear"
                onClick={() => openModal("multilinearSpringDialog")}
                tooltip="Multi-linear Spring — Non-linear soil spring (force-displacement curve)"
              />
            </ToolGroup>
            <ToolGroup label="Foundation">
              <ToolButton
                icon={Landmark}
                label="Elastic Found."
                onClick={() => openModal("elasticFoundationDialog")}
                tooltip="Elastic Foundation / Winkler Model — Mat foundation on elastic soil"
                size="large"
              />
            </ToolGroup>
            <ToolGroup label="Assign">
              <ToolButton
                icon={Anchor}
                label="Boundary"
                onClick={() => openModal("boundaryConditionsDialog")}
                tooltip="Full Boundary Conditions Dialog"
              />
              <ToolButton
                icon={CheckSquare}
                label="Batch Assign"
                onClick={() => openModal("batchSupportAssignDialog")}
                tooltip="Assign Support to All / Selected Nodes"
              />
            </ToolGroup>
          </>
        )}
        {activeCategory === "LOADING" && renderLoadingTab}
        {activeCategory === "ANALYSIS" && renderAnalysisTab}
        {activeCategory === "DESIGN" && (
          <>
            <ToolGroup label="Code Check">
              <ToolButton
                icon={FileCheck}
                label="Design Codes"
                onClick={() => executeSharedAction("design-codes")}
                tooltip="Select Design Code — IS / AISC / Eurocode / BS / AS"
                size="large"
              />
              <ToolButton
                icon={CheckSquare}
                label="D/C Ratios"
                onClick={() => executeSharedAction("design-check")}
                tooltip="Run Analysis & View Demand/Capacity Ratios"
              />
            </ToolGroup>
            <ToolGroup label="Steel Design">
              <ToolButton
                icon={Crown}
                label="Steel Hub"
                onClick={() => executeSharedAction("steel-design")}
                tooltip="Full Steel Design Studio — Code Checks, Member Design"
                size="large"
              />
              <StackedButtons>
                <MiniButton icon={Settings} label="IS 800" onClick={() => { setDesignCodePreset("IS800"); executeSharedAction("steel-design"); }} />
                <MiniButton icon={Settings} label="AISC 360" onClick={() => { setDesignCodePreset("AISC360"); executeSharedAction("steel-design"); }} />
              </StackedButtons>
            </ToolGroup>
            <ToolGroup label="RC Design">
              <ToolButton
                icon={Columns}
                label="RC Studio"
                onClick={() => executeSharedAction("rc-design")}
                tooltip="Reinforced Concrete Design — IS 456 / ACI 318 / EN 1992"
                size="large"
              />
              <StackedButtons>
                <MiniButton icon={Ruler} label="Beam" onClick={() => { setDesignTabPreset("beam"); executeSharedAction("rc-design"); }} />
                <MiniButton icon={Columns} label="Column" onClick={() => { setDesignTabPreset("column"); executeSharedAction("rc-design"); }} />
              </StackedButtons>
              <StackedButtons>
                <MiniButton icon={SquareStack} label="Slab" onClick={() => { setDesignTabPreset("slab"); executeSharedAction("rc-design"); }} />
                <MiniButton icon={Landmark} label="Foundation" onClick={() => executeSharedAction("foundation-design")} />
              </StackedButtons>
            </ToolGroup>
            <ToolGroup label="Detailing">
              <ToolButton icon={FileText} label="RC Detail" onClick={() => executeSharedAction("rc-detailing")} />
              <ToolButton icon={FileText} label="Steel Detail" onClick={() => executeSharedAction("steel-detailing")} />
            </ToolGroup>
            <ToolGroup label="Reports">
              <ToolButton icon={FileText} label="PDF Report" onClick={() => executeSharedAction("full-report")} />
              <ToolButton icon={Globe} label="Design Hub" onClick={() => executeSharedAction("design-hub")} />
            </ToolGroup>
          </>
        )}
        {activeCategory === "CIVIL" && (
          <>
            <ToolGroup label="Civil Hub">
              <ToolButton
                icon={Globe}
                label="Civil Center"
                onClick={() => openModal("civilEngineering")}
                tooltip="Civil Engineering Design Center"
                size="large"
              />
            </ToolGroup>
            <ToolGroup label="Advanced AI">
              <TierGate feature="aiAssistant">
                <ToolButton
                  icon={Sparkles}
                  label="AI Architect"
                  onClick={() => document.dispatchEvent(new CustomEvent("toggle-ai-architect"))}
                />
              </TierGate>
              <ToolButton icon={Sparkles} label="Generative" onClick={() => openModal("generativeDesign")} />
              <ToolButton icon={BarChart3} label="Seismic Studio" onClick={() => openModal("seismicStudio")} />
            </ToolGroup>
          </>
        )}
      </div>
    </div>
  );
});
EngineeringRibbon.displayName = "EngineeringRibbon";
