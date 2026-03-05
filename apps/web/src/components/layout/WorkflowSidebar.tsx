import { FC, useState, useMemo } from "react";
import {
  Box,
  Layers,
  Database,
  Settings,
  Anchor,
  Download,
  BarChart3,
  Ruler,
  Globe,
  ChevronsLeft,
  ChevronsRight,
  Check,
  MousePointer,
  Plus,
  Copy,
  RotateCcw,
  FlipHorizontal,
  Scissors,
  Move,
  Trash2,
  Grid3X3,
  Merge,
  File,
  Upload,
  ArrowDownUp,
  Crosshair,
  Maximize2,
  Circle,
  Square,
  ChevronDown,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { Category, useUIStore } from "../../store/uiStore";
import { useShallow } from 'zustand/react/shallow';
import { useModelStore } from "../../store/model";

// --- Context-sensitive sub-tools per workflow step (STAAD Pro-style) ---
interface SubTool {
  id: string;
  label: string;
  icon: FC<{ className?: string }>;
  action?: string; // modal/tool to trigger
  shortcut?: string;
}

const GEOMETRY_TOOLS: SubTool[] = [
  { id: 'select', label: 'Select', icon: MousePointer, shortcut: 'V' },
  { id: 'select-node', label: 'Select Node', icon: Crosshair },
  { id: 'select-beam', label: 'Select Beam', icon: Maximize2 },
  { id: 'select-parallel', label: 'Select Parallel To', icon: ArrowDownUp },
  { id: 'select-by-level', label: 'Select by Level', icon: Layers },
  { id: 'select-by-material', label: 'Select by Material', icon: Database },
  { id: 'add-node', label: 'Add Node', icon: Plus, shortcut: 'N' },
  { id: 'add-beam', label: 'Add Beam', icon: Box, shortcut: 'M' },
  { id: 'add-plate', label: 'Add Plate', icon: Square, shortcut: 'P' },
  { id: 'copy', label: 'Copy', icon: Copy, shortcut: '⌘C' },
  { id: 'paste', label: 'Paste', icon: File, shortcut: '⌘V' },
  { id: 'move', label: 'Move', icon: Move },
  { id: 'rotate', label: 'Rotate', icon: RotateCcw },
  { id: 'mirror', label: 'Mirror', icon: FlipHorizontal },
  { id: 'ortho', label: 'Ortho Mode', icon: Grid3X3 },
  { id: 'split', label: 'Split Member', icon: Scissors },
  { id: 'divide', label: 'Divide Member', icon: ArrowDownUp },
  { id: 'merge', label: 'Merge Nodes', icon: Merge },
  { id: 'delete', label: 'Delete', icon: Trash2, shortcut: 'Del' },
];

const PROPERTIES_TOOLS: SubTool[] = [
  { id: 'section-library', label: 'Section Database', icon: Database, action: 'sectionBrowserDialog' },
  { id: 'assign-section', label: 'Assign Section', icon: Layers },
  { id: 'assign-parallel', label: 'Assign Parallel To', icon: ArrowDownUp },
  { id: 'material-library', label: 'Material Library', icon: Database, action: 'materialLibraryDialog' },
  { id: 'assign-material', label: 'Assign Material', icon: Layers },
  { id: 'beta-angle', label: 'Beta Angle', icon: RotateCcw },
  { id: 'releases', label: 'Member Releases', icon: Settings },
  { id: 'offsets', label: 'Member Offsets', icon: Move },
  { id: 'custom-section', label: 'Custom Section', icon: Square, action: 'sectionDesignerDialog' },
];

const LOADING_TOOLS: SubTool[] = [
  { id: 'define-load', label: 'Define Load Cases', icon: File },
  { id: 'dead-load', label: 'Dead Load (DL)', icon: Download },
  { id: 'live-load', label: 'Live Load (LL)', icon: Download },
  { id: 'wind-load', label: 'Wind Load (WL)', icon: Download, action: 'windLoadDialog' },
  { id: 'earthquake-load', label: 'Earthquake Load (EQ)', icon: Download, action: 'seismicLoadDialog' },
  { id: 'point-load', label: 'Point Load', icon: ArrowRight, shortcut: 'L' },
  { id: 'udl', label: 'UDL (Distributed)', icon: ArrowDownUp, shortcut: 'U' },
  { id: 'self-weight', label: 'Self Weight', icon: Download },
  { id: 'load-combos', label: 'Load Combinations', icon: Layers, action: 'loadCombinationsDialog' },
  { id: 'codal-loads', label: 'Codal Load Cases', icon: Ruler },
];

const ANALYSIS_TOOLS: SubTool[] = [
  { id: 'run-analysis', label: 'Run Analysis', icon: BarChart3, shortcut: 'F5' },
  { id: 'view-results', label: 'View Results', icon: BarChart3 },
  { id: 'deformed-shape', label: 'Deformed Shape', icon: Box },
  { id: 'reactions', label: 'Support Reactions', icon: Anchor },
  { id: 'sfd', label: 'Shear Force Diagram', icon: BarChart3 },
  { id: 'bmd', label: 'Bending Moment Diagram', icon: BarChart3 },
  { id: 'afd', label: 'Axial Force Diagram', icon: BarChart3 },
  { id: 'deflection', label: 'Deflection Diagram', icon: BarChart3 },
  { id: 'pdelta', label: 'P-Delta Analysis', icon: BarChart3, action: 'pDeltaDialog' },
  { id: 'buckling', label: 'Buckling Analysis', icon: BarChart3, action: 'bucklingDialog' },
  { id: 'modal', label: 'Modal Analysis', icon: BarChart3, action: 'modalAnalysisDialog' },
  { id: 'response-spectrum', label: 'Response Spectrum', icon: BarChart3 },
  { id: 'nonlinear', label: 'Non-linear Analysis', icon: BarChart3 },
  { id: 'pushover', label: 'Pushover Analysis', icon: BarChart3 },
  { id: 'export-results', label: 'Export Results', icon: Upload },
];

const DESIGN_TOOLS: SubTool[] = [
  { id: 'design-check', label: 'Design Code Check', icon: Check },
  { id: 'member-forces', label: 'Member Force Diagrams', icon: BarChart3 },
  { id: 'results-dashboard', label: 'Full Results Dashboard', icon: BarChart3 },
  { id: 'advanced-analysis', label: 'Advanced Analysis', icon: Settings, action: 'advancedAnalysisDialog' },
  { id: 'post-processing', label: 'Post-Processing Studio', icon: Ruler },
  { id: 'design-hub', label: 'Open Design Hub', icon: Globe },
  { id: 'steel-design', label: 'Steel Design (IS 800)', icon: Ruler },
  { id: 'rc-design', label: 'RC Design (IS 456)', icon: Square },
  { id: 'connection-design', label: 'Connection Design', icon: Settings },
  { id: 'foundation-design', label: 'Foundation Design', icon: Anchor },
  { id: 'optimize', label: 'Auto-Optimize Sections', icon: BarChart3 },
  { id: 'detail-drawing', label: 'Detail Drawing', icon: File },
];

const CONTEXT_TOOLS: Record<string, SubTool[]> = {
  MODELING: GEOMETRY_TOOLS,
  PROPERTIES: PROPERTIES_TOOLS,
  MATERIALS: PROPERTIES_TOOLS,
  SPECS: PROPERTIES_TOOLS,
  LOADING: LOADING_TOOLS,
  ANALYSIS: ANALYSIS_TOOLS,
  DESIGN: DESIGN_TOOLS,
};

interface WorkflowSidebarProps {
  activeCategory: Category;
  onCategoryChange: (category: Category) => void;
  currentStep?: string;
}

export const WorkflowSidebar: FC<WorkflowSidebarProps> = ({
  activeCategory,
  onCategoryChange,
}) => {
  const { openModal, activeStep, setActiveStep, setActiveTool } = useUIStore(
    useShallow((s) => ({ openModal: s.openModal, activeStep: s.activeStep, setActiveStep: s.setActiveStep, setActiveTool: s.setActiveTool }))
  );
  const [collapsed, setCollapsed] = useState(false);
  const [showSubTools, setShowSubTools] = useState(true);

  const workflowItems = [
    { id: "MODELING", label: "Geometry", icon: Box, subtext: "Nodes & Beams" },
    { id: "PROPERTIES", label: "Properties", icon: Layers, subtext: "Sections" },
    { id: "MATERIALS", label: "Materials", icon: Database, subtext: "Concrete/Steel" },
    { id: "SPECS", label: "Specifications", icon: Settings, subtext: "Releases" },
    { id: "SUPPORTS", label: "Supports", icon: Anchor, subtext: "Restraints" },
    { id: "LOADING", label: "Loading", icon: Download, subtext: "Load Cases" },
    { id: "ANALYSIS", label: "Analysis", icon: BarChart3, subtext: "Run Solver" },
    { id: "DESIGN", label: "Design", icon: Ruler, subtext: "Code Check" },
    { id: "CIVIL", label: "Civil Engg", icon: Globe, subtext: "Geo/Hydro/Trans" },
  ];

  const handleClick = (id: string) => {
    if (id === "SUPPORTS") {
      openModal("boundaryConditionsDialog");
      return;
    }

    let category: Category = "MODELING";
    switch (id) {
      case "MODELING": category = "MODELING"; break;
      case "PROPERTIES": case "MATERIALS": case "SPECS": category = "PROPERTIES"; break;
      case "LOADING": category = "LOADING"; break;
      case "ANALYSIS": category = "ANALYSIS"; break;
      case "DESIGN": category = "DESIGN"; break;
      case "CIVIL": category = "CIVIL"; break;
    }

    onCategoryChange(category);
    setActiveStep(id);
    setShowSubTools(true);
  };

  const handleSubToolClick = (tool: SubTool) => {
    if (tool.action) {
      openModal(tool.action);
    } else if (tool.id === 'select') {
      setActiveTool('select');
    } else if (tool.id === 'add-node') {
      setActiveTool('node');
    } else if (tool.id === 'add-beam') {
      setActiveTool('member');
    } else if (tool.id === 'add-plate') {
      setActiveTool('plate');
    } else if (tool.id === 'point-load') {
      setActiveTool('nodeLoad');
    } else if (tool.id === 'udl') {
      setActiveTool('memberLoad');
    } else if (tool.id === 'delete') {
      // Trigger delete of selection
      const store = useModelStore.getState();
      store.deleteSelection();
    }
  };

  const nodes = useModelStore((s) => s.nodes);
  const members = useModelStore((s) => s.members);
  const loads = useModelStore((s) => s.loads);
  const memberLoads = useModelStore((s) => s.memberLoads);
  const analysisResults = useModelStore((s) => s.analysisResults);

  const completedSteps = useMemo(() => {
    const done = new Set<string>();
    if (nodes.size > 0 || members.size > 0) done.add("MODELING");
    if (members.size > 0) { done.add("PROPERTIES"); done.add("MATERIALS"); }
    if (members.size > 0) done.add("SPECS");
    const hasSupports = Array.from(nodes.values()).some((n: any) => n.support || n.constraint || n.restraint);
    if (hasSupports) done.add("SUPPORTS");
    if (loads.length > 0 || memberLoads.length > 0) done.add("LOADING");
    if (analysisResults) { done.add("ANALYSIS"); done.add("DESIGN"); }
    return done;
  }, [nodes, members, loads, memberLoads, analysisResults]);

  // Get current context tools
  const currentSubTools = CONTEXT_TOOLS[activeStep || 'MODELING'] || GEOMETRY_TOOLS;

  return (
    <div className={`h-full bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 flex flex-col border-r border-slate-800/60 transition-all duration-300 ease-in-out ${collapsed ? 'w-12' : 'w-52'}`}>
      {/* Header */}
      <div className={`border-b border-slate-800/60 bg-white dark:bg-slate-950 flex items-center ${collapsed ? 'px-1.5 py-3 justify-center' : 'px-3 py-3 justify-between'}`}>
        {!collapsed && (
          <div>
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Workflow</h2>
            <div className="text-[9px] text-slate-600 mt-0.5 font-mono">ANALYTICAL MODELING</div>
          </div>
        )}
        <button type="button" onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronsRight className="w-3.5 h-3.5" /> : <ChevronsLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Workflow Steps */}
      <div className={`${collapsed ? 'flex-1' : ''} overflow-y-auto py-1.5 eng-scroll ${collapsed ? '' : 'border-b border-slate-800/40'}`}>
        <div className={`flex flex-col gap-0.5 ${collapsed ? 'px-0.5 items-center' : 'px-1.5'}`}>
          {workflowItems.map((item, index) => {
            const isActive = activeStep === item.id;
            const Icon = item.icon;
            return (
              <button type="button" key={item.id} onClick={() => handleClick(item.id)}
                aria-label={item.label} aria-current={isActive ? "step" : undefined}
                title={collapsed ? `${item.label} — ${item.subtext}` : undefined}
                className={`
                  relative group flex items-center ${collapsed ? 'justify-center w-9 h-9' : 'gap-2.5 px-2.5 h-8'} rounded-md text-left transition-all duration-150 ease-in-out
                  ${isActive
                    ? "bg-blue-500/10 text-blue-400 border-l-2 border-blue-500"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-700 dark:hover:text-slate-200"
                  }
                `}>
                {collapsed ? (
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500 dark:text-slate-400'}`} />
                ) : (
                  <>
                    <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-colors flex-shrink-0
                      ${completedSteps.has(item.id) && !isActive
                        ? "bg-emerald-500/20 text-emerald-400"
                        : isActive ? "bg-blue-500/20 text-blue-400" : "bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 group-hover:bg-slate-700 group-hover:text-slate-300"}
                    `} aria-hidden="true">
                      {completedSteps.has(item.id) && !isActive ? <Check className="w-3.5 h-3.5" /> : index + 1}
                    </div>
                    <div className="flex flex-col items-start min-w-0 flex-1">
                      <span className="text-[12px] font-semibold leading-none truncate">{item.label}</span>
                      <span className={`text-[10px] mt-1 leading-none truncate pl-0.5 ${isActive ? "text-blue-300/70" : "text-slate-500 dark:text-slate-600"}`}>
                        {item.subtext}
                      </span>
                    </div>
                    {isActive && <ChevronRight className="w-3 h-3 text-blue-400 flex-shrink-0" />}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Context-Sensitive Sub-Tools Panel (left side tools for active category) */}
      {!collapsed && showSubTools && currentSubTools.length > 0 && (
        <div className="flex-1 overflow-y-auto eng-scroll">
          <div className="px-2 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                {activeStep || 'Geometry'} Tools
              </span>
              <button type="button" onClick={() => setShowSubTools(false)}
                className="text-slate-500 hover:text-slate-300 p-0.5 rounded hover:bg-slate-800/40">
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
            <div className="flex flex-col gap-px">
              {currentSubTools.map((tool) => {
                const ToolIcon = tool.icon;
                return (
                  <button key={tool.id} type="button"
                    onClick={() => handleSubToolClick(tool)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-left text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors group"
                    title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}>
                    <ToolIcon className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 flex-shrink-0" />
                    <span className="text-[11px] truncate flex-1">{tool.label}</span>
                    {tool.shortcut && (
                      <span className="text-[9px] text-slate-600 font-mono">{tool.shortcut}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Show sub-tools toggle when collapsed */}
      {!collapsed && !showSubTools && (
        <div className="flex-1 flex items-start px-2 pt-2">
          <button type="button" onClick={() => setShowSubTools(true)}
            className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1">
            <ChevronRight className="w-3 h-3" /> Show Tools
          </button>
        </div>
      )}

      {/* Bottom Section */}
      <div className={`bg-white dark:bg-slate-950 border-t border-slate-800/60 ${collapsed ? 'px-1.5 py-2.5 flex justify-center' : 'px-3 py-2.5'}`}>
        {collapsed ? (
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Online" aria-label="Connection: Online" />
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-600">Connection</span>
            <span className="text-[10px] text-emerald-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
              Online
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
