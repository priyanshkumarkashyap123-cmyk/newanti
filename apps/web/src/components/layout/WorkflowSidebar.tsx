import { FC } from "react";
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
} from "lucide-react";
import { Category, useUIStore } from "../../store/uiStore";

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

  return (
    <div className="h-full w-full bg-slate-950 flex flex-col border-r border-slate-800/60">
      {/* Header */}
      <div className="px-3 py-3 border-b border-slate-800/60 bg-slate-950">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Workflow
        </h2>
        <div className="text-[9px] text-slate-600 mt-0.5 font-mono">
          ANALYTICAL MODELING
        </div>
      </div>

      {/* Workflow Steps */}
      <div className="flex-1 overflow-y-auto py-1.5 eng-scroll">
        <div className="flex flex-col gap-0.5 px-1.5">
          {workflowItems.map((item, index) => {
            const isActive = activeStep === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleClick(item.id)}
                aria-label={item.label}
                aria-current={isActive ? "step" : undefined}
                className={`
                    relative group flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-left transition-all
                    ${
                      isActive
                        ? "bg-blue-600/90 text-white shadow-lg shadow-blue-900/30"
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                    }
                `}
              >
                {/* Step number */}
                <div
                  className={`
                    w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-colors flex-shrink-0
                    ${isActive ? "bg-blue-500 text-white" : "bg-slate-800/80 text-slate-500 group-hover:bg-slate-700 group-hover:text-slate-300"}
                  `}
                  aria-hidden="true"
                >
                  {index + 1}
                </div>
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-[12px] font-semibold leading-none truncate">
                    {item.label}
                  </span>
                  <span
                    className={`text-[9px] mt-1 leading-none truncate ${isActive ? "text-blue-200" : "text-slate-600"}`}
                  >
                    {item.subtext}
                  </span>
                </div>

                {/* Active Indicator Bar */}
                {isActive && (
                  <div
                    className="absolute left-0 w-[3px] h-7 bg-blue-400 rounded-r-full"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="px-3 py-2.5 bg-slate-950 border-t border-slate-800/60">
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
      </div>
    </div>
  );
};
