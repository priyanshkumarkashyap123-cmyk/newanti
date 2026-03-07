/**
 * InspectorPanel — Collapsible right-side properties panel.
 * Extracted from ModernModeler.tsx.
 */
import { FC, memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useModelStore } from "../../store/model";
import { PropertiesPanel } from "../PropertiesPanel";

export const InspectorPanel: FC<{ collapsed: boolean; onToggle: () => void }> = memo(
  ({ collapsed, onToggle }) => {
    const selectedIds = useModelStore((state) => state.selectedIds);

    if (collapsed) {
      return (
        <div className="w-10 h-full bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800/60 flex flex-col items-center py-2 absolute right-0 z-20 md:relative shadow-lg md:shadow-none transition-all duration-200 ease-in">
          <button type="button"
            onClick={onToggle}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Show Properties"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      );
    }

    return (
      <div className="w-[280px] h-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-l border-slate-200 dark:border-slate-700/60 flex flex-col flex-shrink-0 absolute right-0 z-20 md:relative shadow-xl md:shadow-none transition-all duration-250 ease-out animate-[slideInRight_250ms_ease-out]">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800/60">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Properties
          </h3>
          <button type="button"
            onClick={onToggle}
            className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
            title="Hide Properties"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto eng-scroll p-2">
          <PropertiesPanel />
        </div>
        <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800/60">
          <p className="text-[10px] text-slate-600 text-center">
            {selectedIds.size === 0
              ? "Select an element to inspect"
              : `${selectedIds.size} item(s) selected`}
          </p>
        </div>
      </div>
    );
  },
);
InspectorPanel.displayName = "InspectorPanel";
