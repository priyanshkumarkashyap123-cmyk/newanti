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
} from "lucide-react";
import { Category, useUIStore } from "../../store/uiStore";
import { useModelStore } from "../../store/model";

interface WorkflowSidebarProps {
  activeCategory: Category;
  onCategoryChange: (category: Category) => void;
  currentStep?: string; // Fine-grained step control if needed
}

export const WorkflowSidebar: FC<WorkflowSidebarProps> = ({
  activeCategory,
  onCategoryChange,
}) => {
  const { openModal, activeStep, setActiveStep } = useUIStore();
  const [collapsed, setCollapsed] = useState(false);

  const workflowItems = [
    { id: "MODELING", label: "Geometry", icon: Box, subtext: "Nodes & Beams" },
    {
      id: "PROPERTIES",
      label: "Properties",
      icon: Layers,
      subtext: "Sections",
    },
    {
      id: "MATERIALS",
      label: "Materials",
      icon: Database,
      subtext: "Concrete/Steel",
    }, // New category mapping needed
    {
      id: "SPECS",
      label: "Specifications",
      icon: Settings,
      subtext: "Releases",
    }, // New category mapping needed
    { id: "SUPPORTS", label: "Supports", icon: Anchor, subtext: "Restraints" }, // NEW: Opens boundary dialog
    { id: "LOADING", label: "Loading", icon: Download, subtext: "Load Cases" },
    {
      id: "ANALYSIS",
      label: "Analysis",
      icon: BarChart3,
      subtext: "Run Solver",
    },
    { id: "DESIGN", label: "Design", icon: Ruler, subtext: "Code Check" },
    {
      id: "CIVIL",
      label: "Civil Engg",
      icon: Globe,
      subtext: "Geo/Hydro/Trans",
    },
  ];

  // Helper to map UI ID to Store Category
  const handleClick = (id: string) => {
    // Special handling for SUPPORTS - opens boundary conditions dialog
    if (id === "SUPPORTS") {
      openModal("boundaryConditionsDialog");
      return;
    }

    // Map specific workflow steps to general store categories for now
    // This preserves compatibility while giving granular UI
    let category: Category = "MODELING";

    switch (id) {
      case "MODELING":
        category = "MODELING";
        break;
      case "PROPERTIES":
      case "MATERIALS":
      case "SPECS":
        category = "PROPERTIES";
        break;
      case "LOADING":
        category = "LOADING";
        break;
      case "ANALYSIS":
        category = "ANALYSIS";
        break;
      case "DESIGN":
        category = "DESIGN";
        break;
      case "CIVIL":
        category = "CIVIL";
        break;
    }

    onCategoryChange(category);
    setActiveStep(id);
  };

  // Step completion tracking — Figma §3: checkmarks on completed steps
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
    // Supports: check if any node has a constraint
    const hasSupports = Array.from(nodes.values()).some((n: any) => n.support || n.constraint || n.restraint);
    if (hasSupports) done.add("SUPPORTS");
    if (loads.length > 0 || memberLoads.length > 0) done.add("LOADING");
    if (analysisResults) { done.add("ANALYSIS"); done.add("DESIGN"); }
    return done;
  }, [nodes, members, loads, memberLoads, analysisResults]);

  return (
    <div className={`h-full bg-white dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-950 flex flex-col border-r border-slate-800/60 transition-all duration-300 ease-in-out ${collapsed ? 'w-12' : 'w-48'}`}>
      {/* Header */}
      <div className={`border-b border-slate-800/60 bg-white dark:bg-slate-950 flex items-center ${collapsed ? 'px-1.5 py-3 justify-center' : 'px-3 py-3 justify-between'}`}>
        {!collapsed && (
          <div>
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Workflow
            </h2>
            <div className="text-[9px] text-slate-600 mt-0.5 font-mono">
              ANALYTICAL MODELING
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight className="w-3.5 h-3.5" /> : <ChevronsLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Workflow Steps */}
      <div className="flex-1 overflow-y-auto py-1.5 eng-scroll">
        <div className={`flex flex-col gap-0.5 ${collapsed ? 'px-0.5 items-center' : 'px-1.5'}`}>
          {workflowItems.map((item, index) => {
            const isActive = activeStep === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => handleClick(item.id)}
                aria-label={item.label}
                aria-current={isActive ? "step" : undefined}
                title={collapsed ? `${item.label} — ${item.subtext}` : undefined}
                className={`
                    relative group flex items-center ${collapsed ? 'justify-center w-9 h-9' : 'gap-2.5 px-2.5 h-8'} rounded-md text-left transition-all duration-150 ease-in-out
                    ${
                      isActive
                        ? "bg-blue-500/10 text-blue-400 border-l-2 border-blue-500"
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-700 dark:hover:text-slate-200"
                    }
                `}
              >
                {collapsed ? (
                  /* Collapsed: icon only */
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500 dark:text-slate-400'}`} />
                ) : (
                  <>
                    {/* Step number / completion check */}
                    <div
                      className={`
                        w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-colors flex-shrink-0
                        ${completedSteps.has(item.id) && !isActive
                          ? "bg-emerald-500/20 text-emerald-400"
                          : isActive ? "bg-blue-500/20 text-blue-400" : "bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 group-hover:bg-slate-700 group-hover:text-slate-300"}
                      `}
                      aria-hidden="true"
                    >
                      {completedSteps.has(item.id) && !isActive
                        ? <Check className="w-3.5 h-3.5" />
                        : index + 1}
                    </div>
                    <div className="flex flex-col items-start min-w-0">
                      <span className="text-[12px] font-semibold leading-none truncate">
                        {item.label}
                      </span>
                      <span
                        className={`text-[10px] mt-1 leading-none truncate pl-0.5 ${isActive ? "text-blue-300/70" : "text-slate-500 dark:text-slate-600"}`}
                      >
                        {item.subtext}
                      </span>
                    </div>
                  </>
                )}

                {/* Active Indicator Bar */}
                {isActive && (
                  <div
                    className="absolute left-0 w-[2px] h-7 bg-blue-400 rounded-r-full"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Section */}
      <div className={`bg-white dark:bg-slate-950 border-t border-slate-800/60 ${collapsed ? 'px-1.5 py-2.5 flex justify-center' : 'px-3 py-2.5'}`}>
        {collapsed ? (
          <span
            className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"
            title="Online"
            aria-label="Connection: Online"
          />
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-600">Connection</span>
            <span className="text-[10px] text-emerald-500 flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"
                aria-hidden="true"
              />
              Online
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
