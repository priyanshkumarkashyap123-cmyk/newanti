import { FC, useState, useMemo, useCallback } from "react";
import {
  Box,
  Layers,
  Database,
  Settings,
  Anchor,
  Download,
  BarChart3,
  Ruler,
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
  Square,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Play,
  Eye,
  Activity,
  FileText,
  Shield,
  Columns,
  Building2,
  Link2,
  Landmark,
  Wind,
  Zap,
} from "lucide-react";
import { Category, useUIStore } from "../../store/uiStore";
import { useShallow } from 'zustand/react/shallow';
import { useModelStore } from "../../store/model";

// ─── Types ───
interface SubTool {
  id: string;
  label: string;
  icon: FC<{ className?: string }>;
  shortcut?: string;
  /** How this tool connects to the backend */
  handler: 'setTool' | 'openModal' | 'dispatch' | 'storeAction';
  /** tool name / modal name / event name / store method */
  target: string;
}

// ─── GEOMETRY TOOLS ─── Connected to modelStore.setTool() and CustomEvents
const GEOMETRY_TOOLS: SubTool[] = [
  { id: 'select', label: 'Select', icon: MousePointer, shortcut: 'V', handler: 'setTool', target: 'select' },
  { id: 'select-range', label: 'Box Select', icon: Maximize2, shortcut: 'B', handler: 'setTool', target: 'select_range' },
  { id: 'add-node', label: 'Add Node', icon: Plus, shortcut: 'N', handler: 'setTool', target: 'node' },
  { id: 'add-beam', label: 'Add Beam', icon: Box, shortcut: 'M', handler: 'setTool', target: 'member' },
  { id: 'add-plate', label: 'Add Plate', icon: Square, shortcut: 'P', handler: 'openModal', target: 'plateDialog' },
  { id: 'copy', label: 'Copy / Duplicate', icon: Copy, shortcut: '⌘C', handler: 'dispatch', target: 'trigger-copy' },
  { id: 'move', label: 'Move', icon: Move, handler: 'dispatch', target: 'trigger-move' },
  { id: 'rotate', label: 'Rotate', icon: RotateCcw, handler: 'openModal', target: 'geometryTools' },
  { id: 'mirror', label: 'Mirror', icon: FlipHorizontal, handler: 'openModal', target: 'geometryTools' },
  { id: 'split', label: 'Split Member', icon: Scissors, handler: 'dispatch', target: 'trigger-split' },
  { id: 'divide', label: 'Divide Member', icon: ArrowDownUp, handler: 'openModal', target: 'divideMember' },
  { id: 'merge', label: 'Merge Nodes', icon: Merge, handler: 'openModal', target: 'mergeNodes' },
  { id: 'ortho', label: 'Ortho / Grid Snap', icon: Grid3X3, handler: 'dispatch', target: 'toggle-grid-snap' },
  { id: 'delete', label: 'Delete Selection', icon: Trash2, shortcut: 'Del', handler: 'dispatch', target: 'trigger-delete' },
];

// ─── PROPERTIES TOOLS ─── Connected to modal dialogs
const PROPERTIES_TOOLS: SubTool[] = [
  { id: 'section-library', label: 'Section Database', icon: Database, handler: 'openModal', target: 'sectionBrowserDialog' },
  { id: 'assign-section', label: 'Assign Section', icon: Layers, handler: 'openModal', target: 'sectionAssign' },
  { id: 'material-library', label: 'Material Library', icon: Database, handler: 'openModal', target: 'materialLibrary' },
  { id: 'assign-material', label: 'Assign Material', icon: Layers, handler: 'openModal', target: 'materialAssign' },
  { id: 'custom-section', label: 'Section Builder', icon: Square, handler: 'openModal', target: 'sectionBuilder' },
  { id: 'material-props', label: 'Material Properties', icon: Settings, handler: 'openModal', target: 'materialProperties' },
  { id: 'beta-angle', label: 'Beta Angle', icon: RotateCcw, handler: 'openModal', target: 'betaAngle' },
  { id: 'releases', label: 'Member Releases', icon: Settings, handler: 'openModal', target: 'memberReleases' },
  { id: 'offsets', label: 'Member Offsets', icon: Move, handler: 'openModal', target: 'memberOffsets' },
];

// ─── SUPPORT TOOLS ─── Connected to boundary conditions
const SUPPORT_TOOLS: SubTool[] = [
  { id: 'boundary', label: 'Define Supports', icon: Anchor, handler: 'openModal', target: 'boundaryConditionsDialog' },
  { id: 'support-tool', label: 'Add Support (Click)', icon: Crosshair, handler: 'setTool', target: 'support' },
];

// ─── LOADING TOOLS ─── Connected to load system
const LOADING_TOOLS: SubTool[] = [
  { id: 'define-load', label: 'Define Load Cases', icon: File, handler: 'openModal', target: 'is875Load' },
  { id: 'load-combos', label: 'Load Combinations', icon: Layers, handler: 'openModal', target: 'loadCombinationsDialog' },
  { id: 'point-load', label: 'Nodal Force / Moment', icon: ArrowRight, shortcut: 'L', handler: 'setTool', target: 'load' },
  { id: 'udl', label: 'Member Load (UDL)', icon: ArrowDownUp, shortcut: 'U', handler: 'setTool', target: 'memberLoad' },
  { id: 'self-weight', label: 'Self Weight', icon: Download, handler: 'openModal', target: 'deadLoadGenerator' },
  { id: 'wind-load', label: 'Wind Load', icon: Wind, handler: 'openModal', target: 'windLoadDialog' },
  { id: 'earthquake', label: 'Seismic Load', icon: Zap, handler: 'openModal', target: 'seismicLoadDialog' },
  { id: 'temperature', label: 'Temperature Load', icon: Activity, handler: 'openModal', target: 'temperatureLoad' },
  { id: 'floor-load', label: 'Floor / Area Load', icon: Square, handler: 'openModal', target: 'floorSlabDialog' },
];

// ─── ANALYSIS TOOLS ─── Connected to analysis engine via CustomEvents & store
const ANALYSIS_TOOLS: SubTool[] = [
  { id: 'run-analysis', label: 'Run Analysis', icon: Play, shortcut: 'F5', handler: 'dispatch', target: 'trigger-analysis' },
  { id: 'deformed-shape', label: 'Deformed Shape', icon: Activity, handler: 'dispatch', target: 'toggle-deformed' },
  { id: 'sfd', label: 'Shear Force Diagram', icon: BarChart3, handler: 'dispatch', target: 'toggle-sfd' },
  { id: 'bmd', label: 'Bending Moment Diagram', icon: BarChart3, handler: 'dispatch', target: 'toggle-bmd' },
  { id: 'afd', label: 'Axial Force Diagram', icon: BarChart3, handler: 'dispatch', target: 'toggle-afd' },
  { id: 'deflection', label: 'Deflection Diagram', icon: BarChart3, handler: 'dispatch', target: 'toggle-deflection' },
  { id: 'reactions', label: 'Support Reactions', icon: Anchor, handler: 'dispatch', target: 'toggle-reactions' },
  { id: 'view-results', label: 'Results Table', icon: Eye, handler: 'dispatch', target: 'toggle-results-dock' },
  { id: 'pdelta', label: 'P-Delta Analysis', icon: BarChart3, handler: 'openModal', target: 'pDeltaAnalysis' },
  { id: 'buckling', label: 'Buckling Analysis', icon: BarChart3, handler: 'openModal', target: 'bucklingAnalysis' },
  { id: 'modal', label: 'Modal Analysis', icon: BarChart3, handler: 'dispatch', target: 'trigger-modal-analysis' },
  { id: 'export-results', label: 'Export Results', icon: Upload, handler: 'dispatch', target: 'trigger-export' },
];

// ─── DESIGN TOOLS ─── Connected to design dialogs & hub
const DESIGN_TOOLS: SubTool[] = [
  { id: 'design-codes', label: 'Select Design Code', icon: Shield, handler: 'openModal', target: 'designCodes' },
  { id: 'design-check', label: 'Run Design Check', icon: Check, handler: 'dispatch', target: 'trigger-analysis' },
  { id: 'steel-design', label: 'Steel Design', icon: Building2, handler: 'openModal', target: 'steelDesign' },
  { id: 'rc-design', label: 'RC Design', icon: Columns, handler: 'openModal', target: 'concreteDesign' },
  { id: 'connection-design', label: 'Connection Design', icon: Link2, handler: 'openModal', target: 'connectionDesign' },
  { id: 'foundation-design', label: 'Foundation Design', icon: Landmark, handler: 'openModal', target: 'foundationDesign' },
  { id: 'design-hub', label: 'Full Design Hub', icon: Ruler, handler: 'openModal', target: 'designHub' },
  { id: 'pdf-report', label: 'Generate Report', icon: FileText, handler: 'dispatch', target: 'trigger-pdf-report' },
  { id: 'csv-export', label: 'CSV Export', icon: File, handler: 'dispatch', target: 'trigger-csv-export' },
];

// ─── Category → tools mapping ───
const CONTEXT_TOOLS: Record<string, SubTool[]> = {
  MODELING: GEOMETRY_TOOLS,
  PROPERTIES: PROPERTIES_TOOLS,
  SUPPORTS: SUPPORT_TOOLS,
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
  const { openModal, activeStep, setActiveStep, showNotification } = useUIStore(
    useShallow((s) => ({ openModal: s.openModal, activeStep: s.activeStep, setActiveStep: s.setActiveStep, showNotification: s.showNotification }))
  );
  const [collapsed, setCollapsed] = useState(false);
  const [showSubTools, setShowSubTools] = useState(true);

  // Streamlined workflow — removed redundant MATERIALS/SPECS/CIVIL
  const workflowItems = [
    { id: "MODELING", label: "Geometry", icon: Box, subtext: "Nodes & Beams" },
    { id: "PROPERTIES", label: "Properties", icon: Layers, subtext: "Sections & Materials" },
    { id: "SUPPORTS", label: "Supports", icon: Anchor, subtext: "Restraints" },
    { id: "LOADING", label: "Loading", icon: Download, subtext: "Forces & Loads" },
    { id: "ANALYSIS", label: "Analysis", icon: BarChart3, subtext: "Run Solver" },
    { id: "DESIGN", label: "Design", icon: Ruler, subtext: "Code Check" },
  ];

  const handleClick = useCallback((id: string) => {
    let category: Category = "MODELING";
    switch (id) {
      case "MODELING": category = "MODELING"; break;
      case "PROPERTIES": category = "PROPERTIES"; break;
      case "SUPPORTS": category = "PROPERTIES"; break;
      case "LOADING": category = "LOADING"; break;
      case "ANALYSIS": category = "ANALYSIS"; break;
      case "DESIGN": category = "DESIGN"; break;
    }
    onCategoryChange(category);
    setActiveStep(id);
    setShowSubTools(true);
  }, [onCategoryChange, setActiveStep]);

  // ─── Tool activation feedback messages ───
  const TOOL_MESSAGES: Record<string, string> = {
    select: 'Select tool — click to select elements',
    select_range: 'Box select — drag to select region',
    node: 'Node tool — click on grid to place nodes',
    member: 'Beam tool — click two points to draw a beam',
    support: 'Support tool — click a node to assign restraint',
    load: 'Load tool — click a node to apply force/moment',
    memberLoad: 'Member load — click a member to apply distributed load',
  };

  // ─── THE CORE FIX: Route every tool to its proper backend ───
  const handleSubToolClick = useCallback((tool: SubTool) => {
    switch (tool.handler) {
      case 'setTool':
        // Route directly to modelStore — this is what the canvas reads
        useModelStore.getState().setTool(tool.target as any);
        // Provide user feedback
        if (TOOL_MESSAGES[tool.target]) {
          showNotification('info', TOOL_MESSAGES[tool.target]);
        }
        break;
      case 'openModal':
        openModal(tool.target as any);
        break;
      case 'dispatch':
        // Dispatch CustomEvent — ModernModeler has listeners for all of these
        document.dispatchEvent(new CustomEvent(tool.target));
        break;
      case 'storeAction':
        if (tool.target === 'deleteSelection') {
          useModelStore.getState().deleteSelection();
        }
        break;
    }
  }, [openModal, showNotification]);

  const nodes = useModelStore((s) => s.nodes);
  const members = useModelStore((s) => s.members);
  const loads = useModelStore((s) => s.loads);
  const memberLoads = useModelStore((s) => s.memberLoads);
  const analysisResults = useModelStore((s) => s.analysisResults);

  const completedSteps = useMemo(() => {
    const done = new Set<string>();
    if (nodes.size > 0 || members.size > 0) done.add("MODELING");
    if (members.size > 0) done.add("PROPERTIES");
    const hasSupports = Array.from(nodes.values()).some((n: any) => n.support || n.constraint || n.restraint);
    if (hasSupports) done.add("SUPPORTS");
    if (loads.length > 0 || memberLoads.length > 0) done.add("LOADING");
    if (analysisResults) { done.add("ANALYSIS"); done.add("DESIGN"); }
    return done;
  }, [nodes, members, loads, memberLoads, analysisResults]);

  const activeTool = useModelStore((s) => s.activeTool);

  // Get current context tools
  const currentSubTools = CONTEXT_TOOLS[activeStep || 'MODELING'] || GEOMETRY_TOOLS;

  return (
    <div className={`h-full bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 flex flex-col border-r border-slate-800/60 transition-all duration-300 ease-in-out ${collapsed ? 'w-12' : 'w-52'}`}>
      {/* Header */}
      <div className={`border-b border-slate-800/60 bg-white dark:bg-slate-950 flex items-center ${collapsed ? 'px-1.5 py-3 justify-center' : 'px-3 py-3 justify-between'}`}>
        {!collapsed && (
          <div>
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Workflow</h2>
            <div className="text-[9px] text-slate-600 mt-0.5 font-mono">STRUCTURAL MODELING</div>
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
                const isToolActive = tool.handler === 'setTool' && activeTool === tool.target;
                return (
                  <button key={tool.id} type="button"
                    onClick={() => handleSubToolClick(tool)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors group
                      ${isToolActive
                        ? 'text-blue-300 bg-blue-500/15 border-l-2 border-blue-400'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}>
                    <ToolIcon className={`w-3.5 h-3.5 flex-shrink-0 ${isToolActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-blue-400'}`} />
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

      {/* Show sub-tools toggle when hidden */}
      {!collapsed && !showSubTools && (
        <div className="flex-1 flex items-start px-2 pt-2">
          <button type="button" onClick={() => setShowSubTools(true)}
            className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1">
            <ChevronRight className="w-3 h-3" /> Show Tools
          </button>
        </div>
      )}

      {/* Bottom Status */}
      <div className={`bg-white dark:bg-slate-950 border-t border-slate-800/60 ${collapsed ? 'px-1.5 py-2.5 flex justify-center' : 'px-3 py-2.5'}`}>
        {collapsed ? (
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Online" aria-label="Connection: Online" />
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-600">
              {activeTool ? `Tool: ${activeTool}` : 'Ready'}
            </span>
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
