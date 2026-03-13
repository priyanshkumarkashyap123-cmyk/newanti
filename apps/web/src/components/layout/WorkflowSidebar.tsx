import { FC, useState, useMemo, useCallback } from "react";
import {
  Box,
  Layers,
  Anchor,
  Download,
  BarChart3,
  Ruler,
  ChevronsLeft,
  ChevronsRight,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Category, useUIStore } from "../../store/uiStore";
import { useShallow } from 'zustand/react/shallow';
import { useModelStore } from "../../store/model";
import { getActionsForSidebarCategory, type SidebarAction, type SidebarCategory } from "../../data/modelingActionRegistry";

interface WorkflowSidebarProps {
  activeCategory: Category;
  onCategoryChange: (category: Category) => void;
  currentStep?: string;
  showActionPanel?: boolean;
}

export const WorkflowSidebar: FC<WorkflowSidebarProps> = ({
  activeCategory,
  onCategoryChange,
  showActionPanel = false,
}) => {
  const { openModal, activeStep, setActiveStep, showNotification } = useUIStore(
    useShallow((s) => ({ openModal: s.openModal, activeStep: s.activeStep, setActiveStep: s.setActiveStep, showNotification: s.showNotification }))
  );
  const [collapsed, setCollapsed] = useState(false);
  const [showSubTools, setShowSubTools] = useState(showActionPanel);

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
  const handleSubToolClick = useCallback((tool: SidebarAction) => {
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
        if (tool.target in useUIStore.getState().modals) {
          openModal(tool.target as any);
        } else {
          showNotification('info', `${tool.label} opened in guided mode for this build.`);
        }
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

  // Get current context tools from shared registry
  const currentCategory: SidebarCategory =
    (activeStep as SidebarCategory) || "MODELING";
  const currentSubTools = showActionPanel ? getActionsForSidebarCategory(currentCategory) : [];

  return (
    <div className={`h-full bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 flex flex-col border-r border-slate-200 dark:border-slate-800/60 transition-all duration-300 ease-in-out ${collapsed ? 'w-12' : 'w-52'}`}>
      {/* Header */}
      <div className={`border-b border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950 flex items-center ${collapsed ? 'px-1.5 py-3 justify-center' : 'px-3 py-3 justify-between'}`}>
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
      <div className={`${collapsed ? 'flex-1' : ''} overflow-y-auto py-1.5 eng-scroll ${collapsed ? '' : 'border-b border-slate-200 dark:border-slate-800/40'}`}>
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
                        : isActive ? "bg-blue-500/20 text-blue-400" : "bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 group-hover:text-slate-700 dark:group-hover:text-slate-300"}
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
      {showActionPanel && !collapsed && showSubTools && currentSubTools.length > 0 && (
        <div className="flex-1 overflow-y-auto eng-scroll">
          <div className="px-2 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                {activeStep || 'Geometry'} Quick Actions
              </span>
              <button type="button" onClick={() => setShowSubTools(false)}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800/40">
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
                        ? 'text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 border-l-2 border-blue-500 dark:border-blue-400'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
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
      {showActionPanel && !collapsed && !showSubTools && (
        <div className="flex-1 flex items-start px-2 pt-2">
          <button type="button" onClick={() => setShowSubTools(true)}
            className="text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1">
            <ChevronRight className="w-3 h-3" /> Show Tools
          </button>
        </div>
      )}

      {/* Bottom Status */}
      <div className={`bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800/60 ${collapsed ? 'px-1.5 py-2.5 flex justify-center' : 'px-3 py-2.5'}`}>
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
