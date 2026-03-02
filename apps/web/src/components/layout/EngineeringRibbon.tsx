import { FC, memo, ReactNode } from "react";
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
  Mountain,
  Droplets,
  Car,
  HardHat,
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
  Maximize2,
  Wind,
  Zap,
  Target,
  ArrowDown,
  TrendingUp,
  Eye,
  Workflow,
  Search,
  Calculator,
  Check,
  GitMerge,
  SplitSquareVertical,
  Thermometer,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useModelStore } from "../../store/model";
import { useUIStore, Category } from "../../store/uiStore";
import { Tooltip } from "../ui/Tooltip";

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
        <button
          onClick={onClick}
          disabled={disabled}
          aria-pressed={isActive}
          className={`
                  flex flex-col items-center justify-center gap-0.5 px-1.5 py-1 rounded-md
                  border border-transparent transition-all duration-150
                  hover:bg-slate-200/50 dark:hover:bg-slate-700/50 hover:border-slate-600/30
                  active:scale-[0.96] active:bg-slate-700/70
                  ${isActive
                    ? "bg-blue-600/15 border-blue-500/30 text-blue-300 shadow-sm shadow-blue-500/5"
                    : accent
                      ? `${accent}`
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-200"
                  }
                  ${disabled ? "opacity-40 cursor-not-allowed active:scale-100" : "cursor-pointer"}
                  ${sizeClasses[size]}
                  ${className}
              `}
        >
          <Icon className={`${iconSize[size]} flex-shrink-0`} />
          {size !== 'compact' && (
            <span className="text-[10px] whitespace-nowrap text-center leading-tight max-w-[48px] truncate font-medium">
              {label}
            </span>
          )}
          {size === 'compact' && (
            <span className="text-[10px] whitespace-nowrap font-medium">{label}</span>
          )}
        </button>
      </Tooltip>
    );
  },
);
ToolButton.displayName = "ToolButton";

const ToolGroup = memo<{ label: string; children: ReactNode; className?: string }>(
  ({ label, children, className = "" }) => (
    <div className={`flex flex-col h-full border-r border-slate-200/30 dark:border-slate-700/30 px-1.5 pb-2.5 pt-1 last:border-r-0 ${className}`}>
      <div className="flex-1 flex items-center gap-0.5">{children}</div>
      <div className="text-[9px] text-slate-500 dark:text-slate-400 text-center uppercase tracking-[0.08em] mt-0.5 select-none font-medium">
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
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-1.5 py-1 rounded text-slate-500 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-all text-[9px] ${className}`}
    >
      <Icon className="w-3 h-3 flex-shrink-0" />
      <span className="font-medium">{label}</span>
    </button>
  </Tooltip>
));
MiniButton.displayName = "MiniButton";

/* ─── Ribbon categories (tabs) ─── */

const RIBBON_TABS: { id: Category; label: string; color: string }[] = [
  { id: "MODELING", label: "Geometry", color: "blue" },
  { id: "PROPERTIES", label: "Properties", color: "purple" },
  { id: "LOADING", label: "Loading", color: "orange" },
  { id: "ANALYSIS", label: "Analysis", color: "emerald" },
  { id: "DESIGN", label: "Design", color: "rose" },
  { id: "CIVIL", label: "Civil Engg", color: "amber" },
];

const TAB_ACTIVE_COLORS: Record<string, string> = {
  blue: "bg-slate-800/60 text-blue-400 border-t-2 border-t-blue-500",
  purple: "bg-slate-800/60 text-purple-400 border-t-2 border-t-purple-500",
  orange: "bg-slate-800/60 text-orange-400 border-t-2 border-t-orange-500",
  emerald: "bg-slate-800/60 text-emerald-400 border-t-2 border-t-emerald-500",
  rose: "bg-slate-800/60 text-rose-400 border-t-2 border-t-rose-500",
  amber: "bg-slate-800/60 text-amber-400 border-t-2 border-t-amber-500",
};

/* ─── Main ribbon component ─── */

interface RibbonProps {
  activeCategory: Category;
  isSidebarOpen?: boolean;
}

export const EngineeringRibbon: FC<RibbonProps> = memo(({ activeCategory, isSidebarOpen }) => {
  const activeTool = useModelStore((s) => s.activeTool);
  const setTool = useModelStore((s) => s.setTool);
  const isAnalyzing = useModelStore((s) => s.isAnalyzing);
  const analysisResults = useModelStore((s) => s.analysisResults);
  const openModal = useUIStore((s) => s.openModal);
  const setCategory = useUIStore((s) => s.setCategory);
  const { undo, redo } = useModelStore.temporal.getState();

  const renderGeometryTab = () => (
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
          onClick={() => setTool("node")}
          isActive={activeTool === "node"}
          tooltip="Create Node — Click to place"
          shortcut="N"
        />
        <ToolButton
          icon={Spline}
          label="Beam"
          onClick={() => setTool("member")}
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
          onClick={() => setTool("select")}
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
          <MiniButton icon={Copy} label="Copy" onClick={() => document.dispatchEvent(new CustomEvent("trigger-copy"))} shortcut="Ctrl+C" />
          <MiniButton icon={Move} label="Move" onClick={() => document.dispatchEvent(new CustomEvent("trigger-move"))} />
        </StackedButtons>
        <StackedButtons>
          <MiniButton icon={FlipHorizontal} label="Mirror" onClick={() => openModal("geometryTools")} />
          <MiniButton icon={RotateCcw} label="Rotate" onClick={() => openModal("geometryTools")} />
        </StackedButtons>
        <StackedButtons>
          <MiniButton icon={Scissors} label="Split" onClick={() => document.dispatchEvent(new CustomEvent("trigger-split"))} />
          <MiniButton icon={Trash2} label="Delete" onClick={() => document.dispatchEvent(new CustomEvent("trigger-delete"))} shortcut="Del" />
        </StackedButtons>
        <StackedButtons>
          <MiniButton icon={SplitSquareVertical} label="Divide" onClick={() => openModal("divideMember")} />
          <MiniButton icon={GitMerge} label="Merge" onClick={() => openModal("mergeNodes")} />
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
    </>
  );

  const renderPropertiesTab = () => (
    <>
      <ToolGroup label="Section">
        <ToolButton
          icon={Layers}
          label="Library"
          onClick={() => openModal("sectionBrowserDialog")}
          tooltip="Section Database — ISMB, ISMC, W-Shapes, Custom (Rust Backend)"
          size="large"
        />
        <StackedButtons>
          <MiniButton icon={Settings} label="Assign" onClick={() => openModal("sectionAssign")} />
          <MiniButton icon={Calculator} label="Section Builder" onClick={() => openModal("sectionBuilder")} />
        </StackedButtons>
      </ToolGroup>
      <ToolGroup label="Material">
        <ToolButton
          icon={Database}
          label="Material"
          onClick={() => openModal("materialLibrary")}
          tooltip="Material Library — Steel, Concrete, Timber, Custom"
        />
        <StackedButtons>
          <MiniButton icon={Settings} label="Assign" onClick={() => openModal("materialAssign")} />
          <MiniButton icon={Table2} label="Properties" onClick={() => openModal("materialProperties")} />
        </StackedButtons>
      </ToolGroup>
      <ToolGroup label="Specifications">
        <ToolButton icon={Table2} label="Beta Angle" onClick={() => openModal("betaAngle")} tooltip="Member Orientation / Beta Angle" />
        <ToolButton icon={Link2} label="Releases" onClick={() => openModal("memberReleases")} tooltip="Member End Releases — Pinned, Partial" />
        <ToolButton icon={Ruler} label="Offsets" onClick={() => openModal("memberOffsets")} tooltip="Member End Offsets" />
      </ToolGroup>
    </>
  );

  const renderLoadingTab = () => (
    <>
      <ToolGroup label="Load Cases">
        <ToolButton
          icon={Layers}
          label="Define"
          onClick={() => openModal("is875Load")}
          tooltip="Create/Manage Load Cases"
          size="large"
        />
        <ToolButton
          icon={Workflow}
          label="Combos"
          onClick={() => openModal("loadDialog")}
          tooltip="Load Combinations — IS 875 / ASCE 7 / EN 1990"
        />
      </ToolGroup>
      <ToolGroup label="Nodal Loads">
        <ToolButton
          icon={ArrowDown}
          label="Force"
          onClick={() => setTool("load")}
          isActive={activeTool === "load"}
          tooltip="Apply Nodal Force (Fx, Fy, Fz)"
          shortcut="L"
        />
        <ToolButton
          icon={RotateCcw}
          label="Moment"
          onClick={() => setTool("load")}
          tooltip="Apply Nodal Moment (Mx, My, Mz)"
        />
      </ToolGroup>
      <ToolGroup label="Member Loads">
        <ToolButton
          icon={Spline}
          label="UDL"
          onClick={() => setTool("memberLoad")}
          isActive={activeTool === "memberLoad"}
          tooltip="Uniformly Distributed Load"
          shortcut="U"
        />
        <ToolButton
          icon={TrendingUp}
          label="Trapezoidal"
          onClick={() => setTool("memberLoad")}
          tooltip="Trapezoidal / Triangular Load"
        />
        <ToolButton
          icon={Target}
          label="Point"
          onClick={() => setTool("memberLoad")}
          tooltip="Concentrated Point Load on Member"
        />
      </ToolGroup>
      <ToolGroup label="Area Loads">
        <ToolButton
          icon={SquareStack}
          label="Floor Load"
          onClick={() => openModal("loadDialog")}
          tooltip="Floor / Roof Area Load"
        />
      </ToolGroup>
      <ToolGroup label="Generate">
        <ToolButton
          icon={Weight}
          label="Self Weight"
          onClick={() => openModal("deadLoadGenerator")}
          tooltip="Auto-generate Dead Load from self-weight"
        />
        <ToolButton
          icon={Wind}
          label="Wind"
          onClick={() => openModal("windLoadDialog")}
          tooltip="Wind Load Generator — IS 875-III / ASCE 7-22"
        />
        <StackedButtons>
          <MiniButton icon={Zap} label="ASCE 7 Seismic" onClick={() => openModal("asce7SeismicDialog")} />
          <MiniButton icon={Zap} label="IS 1893 Seismic" onClick={() => openModal("is1893SeismicDialog")} />
        </StackedButtons>
        <ToolButton
          icon={Thermometer}
          label="Thermal"
          onClick={() => openModal("temperatureLoad")}
          tooltip="Temperature Load — Uniform ΔT / Gradient"
        />
        <ToolButton
          icon={Layers}
          label="Combinations"
          onClick={() => openModal("loadCombinationsDialog")}
          tooltip="Load Combination Generator — ASCE 7, IS 456"
        />
      </ToolGroup>
    </>
  );

  const renderAnalysisTab = () => (
    <>
      <ToolGroup label="Run">
        <ToolButton
          icon={Play}
          label="RUN ANALYSIS"
          onClick={() => document.dispatchEvent(new CustomEvent("trigger-analysis"))}
          isActive={isAnalyzing}
          tooltip="Run Linear Static Analysis"
          shortcut="F5"
          size="large"
          accent={isAnalyzing ? "text-yellow-400 animate-pulse" : "bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-105 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/40 animate-[pulse-glow_2s_ease-in-out_infinite]"}
        />
        <StackedButtons>
          <MiniButton
            icon={Activity}
            label="Modal"
            onClick={() => document.dispatchEvent(new CustomEvent("trigger-modal-analysis"))}
          />
          <MiniButton
            icon={TrendingUp}
            label="P-Delta"
            onClick={() => openModal("pDeltaAnalysis")}
          />
        </StackedButtons>
      </ToolGroup>
      <ToolGroup label="Advanced">
        <ToolButton
          icon={Activity}
          label="Buckling"
          onClick={() => openModal("bucklingAnalysis")}
          tooltip="Linear Buckling Analysis"
        />
        <ToolButton
          icon={BarChart3}
          label="Response"
          onClick={() => openModal("advancedAnalysis")}
          tooltip="Response Spectrum Analysis"
        />
        <ToolButton
          icon={Workflow}
          label="Pushover"
          onClick={() => openModal("advancedAnalysis")}
          tooltip="Pushover Analysis"
        />
        <ToolButton
          icon={Activity}
          label="Time History"
          onClick={() => openModal("timeHistoryAnalysis")}
          tooltip="Nonlinear Dynamic Time History Analysis"
        />
      </ToolGroup>
      <ToolGroup label="Results">
        <ToolButton
          icon={Eye}
          label="Deformed"
          onClick={() => document.dispatchEvent(new CustomEvent("toggle-deformed"))}
          tooltip="View Deformed Shape"
        />
        <ToolButton
          icon={BarChart3}
          label="Diagrams"
          onClick={() => document.dispatchEvent(new CustomEvent("toggle-diagrams"))}
          tooltip="SFD / BMD / AFD Diagrams"
        />
        <ToolButton icon={FileText} label="Output" onClick={() => {
          const s = useModelStore.getState();
          s.setShowResults(!s.showResults);
        }} tooltip="Tabular Results Output" />
        <ToolButton
          icon={Download}
          label="Export"
          onClick={() => document.dispatchEvent(new CustomEvent("trigger-export"))}
          tooltip="Export Results to PDF / CSV / Excel"
        />
      </ToolGroup>
    </>
  );

  const activeTab = RIBBON_TABS.find(t => t.id === activeCategory);
  const activeColor = activeTab?.color || "blue";

  return (
    <div
      className="w-full bg-white/98 dark:bg-slate-900/98 backdrop-blur-md border-b border-slate-200/40 dark:border-slate-700/40 flex flex-col select-none"
      role="toolbar"
      aria-label="Engineering Ribbon"
    >
      {/* Title Bar */}
      <div className="h-8 flex items-center justify-between px-3 border-b border-slate-800/60 bg-white/90 dark:bg-slate-950/90">
        <div className="flex items-center gap-2">
          {/* Mobile sidebar toggle */}
          <button
            className="md:hidden text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded p-0.5 transition-colors"
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
          <span className="font-bold text-[11px] text-slate-200 tracking-tight">BeamLab</span>
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
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setCategory(tab.id)}
                className={`
                  px-3 py-1 rounded-md text-[13px] font-medium tracking-normal transition-all duration-150 border whitespace-nowrap flex-shrink-0
                  ${isActive
                    ? `${TAB_ACTIVE_COLORS[tab.color]} shadow-sm`
                    : "text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/40 dark:hover:bg-slate-800/40 border-transparent"
                  }
                `}
              >
                {tab.label.toUpperCase()}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => document.dispatchEvent(new CustomEvent("trigger-upgrade"))}
            className="flex items-center gap-1 px-2 py-0.5 text-amber-400/80 hover:text-amber-300 text-[9px] font-semibold transition-colors"
          >
            <Crown className="w-3 h-3" />
            Upgrade
          </button>
          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
            <Check className="w-3 h-3 text-green-500" />
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
        {activeCategory === "MODELING" && renderGeometryTab()}
        {activeCategory === "PROPERTIES" && renderPropertiesTab()}
        {activeCategory === "LOADING" && renderLoadingTab()}
        {activeCategory === "ANALYSIS" && renderAnalysisTab()}
        {activeCategory === "DESIGN" && (
          <>
            <ToolGroup label="Code Check">
              <ToolButton
                icon={FileCheck}
                label="Design Codes"
                onClick={() => openModal("designCodes")}
                tooltip="Select Design Code — IS / AISC / Eurocode"
                size="large"
              />
              <ToolButton
                icon={CheckSquare}
                label="D/C Ratios"
                onClick={() => document.dispatchEvent(new CustomEvent("trigger-analysis"))}
                tooltip="Run Analysis & View Demand/Capacity Ratios"
              />
            </ToolGroup>
            <ToolGroup label="Steel Design">
              <ToolButton
                icon={Building2}
                label="Steel Studio"
                onClick={() => openModal("steelDesign")}
                tooltip="Steel Design — IS 800 / AISC 360 / EN 1993"
                size="large"
              />
            </ToolGroup>
            <ToolGroup label="RC Design">
              <ToolButton
                icon={Columns}
                label="RC Studio"
                onClick={() => openModal("concreteDesign")}
                tooltip="Reinforced Concrete Design — IS 456 / ACI 318 / EN 1992"
                size="large"
              />
            </ToolGroup>
            <ToolGroup label="Connection">
              <ToolButton
                icon={Link2}
                label="Connections"
                onClick={() => openModal("connectionDesign")}
                tooltip="Connection Design — Bolted / Welded / Base Plate"
              />
            </ToolGroup>
            <ToolGroup label="Foundation">
              <ToolButton
                icon={Landmark}
                label="Foundation"
                onClick={() => openModal("foundationDesign")}
                tooltip="Foundation Design — Isolated / Combined / Pile Cap"
              />
            </ToolGroup>
            <ToolGroup label="Advanced">
              <ToolButton
                icon={Ruler}
                label="Detailed"
                onClick={() => openModal("detailedDesign")}
                tooltip="Detailed Section Design & Optimization"
              />
              <ToolButton
                icon={Globe}
                label="Curved"
                onClick={() => openModal("curvedStructure")}
                tooltip="Curved Structure Generator — Domes, Arches, Shells"
              />
            </ToolGroup>
          </>
        )}
        {activeCategory === "CIVIL" && (
          <>
            <ToolGroup label="Civil Engineering">
              <ToolButton
                icon={Globe}
                label="Civil Hub"
                onClick={() => openModal("civilEngineering")}
                tooltip="Civil Engineering Design Center"
                size="large"
              />
              <ToolButton
                icon={Mountain}
                label="Geotech"
                onClick={() => openModal("civilEngineering")}
                tooltip="Geotechnical — Bearing Capacity, Settlement, Slope Stability"
              />
              <ToolButton
                icon={Droplets}
                label="Hydraulics"
                onClick={() => openModal("civilEngineering")}
                tooltip="Hydraulics — Open Channel, Pipe Networks, Culverts"
              />
            </ToolGroup>
            <ToolGroup label="Infrastructure">
              <ToolButton
                icon={Car}
                label="Transport"
                onClick={() => openModal("civilEngineering")}
                tooltip="Transportation — Highway Geometry, Pavement Design, Traffic"
              />
              <ToolButton
                icon={HardHat}
                label="Construction"
                onClick={() => openModal("civilEngineering")}
                tooltip="Construction Mgmt — CPM/PERT, Gantt, Cost Estimation"
              />
            </ToolGroup>
            <ToolGroup label="Design">
              <ToolButton
                icon={Building2}
                label="Steel"
                onClick={() => openModal("steelDesign")}
                tooltip="Steel Design Studio"
              />
              <ToolButton
                icon={Columns}
                label="Concrete"
                onClick={() => openModal("concreteDesign")}
                tooltip="Concrete Design Studio"
              />
              <ToolButton
                icon={Link2}
                label="Connect"
                onClick={() => openModal("connectionDesign")}
                tooltip="Connection Design"
              />
            </ToolGroup>
            <ToolGroup label="Advanced AI">
              <ToolButton
                icon={Sparkles}
                label="AI Architect"
                onClick={() => document.dispatchEvent(new CustomEvent("toggle-ai-architect"))}
                tooltip="AI Architect — Create, modify & analyze structures with AI"
              />
              <ToolButton
                icon={Sparkles}
                label="Generative"
                onClick={() => openModal("generativeDesign")}
                tooltip="AI Generative Design / Topology Optimization"
              />
              <ToolButton
                icon={BarChart3}
                label="Seismic"
                onClick={() => openModal("seismicStudio")}
                tooltip="Seismic Design Studio — IS 1893, ASCE 7, EC8"
              />
            </ToolGroup>
          </>
        )}
      </div>
    </div>
  );
});
EngineeringRibbon.displayName = "EngineeringRibbon";
