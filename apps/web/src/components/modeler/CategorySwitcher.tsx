/**
 * CategorySwitcher — Tab bar for switching between workflow categories.
 * Extracted from ModernModeler.tsx.
 */
import React, { FC, memo } from "react";
import { Box, Layers, Download, BarChart3, Ruler, Landmark } from "lucide-react";
import { useUIStore, type Category } from "../../store/uiStore";

export interface TabConfig {
  id: Category;
  label: string;
  icon: React.ReactNode;
}

export const CATEGORY_TABS: TabConfig[] = [
  { id: "MODELING", label: "Modeling", icon: <Box className="w-4 h-4" /> },
  {
    id: "PROPERTIES",
    label: "Properties",
    icon: <Layers className="w-4 h-4" />,
  },
  { id: "LOADING", label: "Loading", icon: <Download className="w-4 h-4" /> },
  {
    id: "ANALYSIS",
    label: "Analysis",
    icon: <BarChart3 className="w-4 h-4" />,
  },
  { id: "DESIGN", label: "Design", icon: <Ruler className="w-4 h-4" /> },
];

export const CategorySwitcher: FC = memo(() => {
  const activeCategory = useUIStore((s) => s.activeCategory);
  const setCategory = useUIStore((s) => s.setCategory);

  return (
    <>
      <div className="flex items-center gap-1 px-2">
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeCategory === tab.id;
          return (
            <button type="button"
              key={tab.id}
              onClick={() => setCategory(tab.id)}
              className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg
                                text-sm font-medium tracking-wide transition-all duration-200
                                ${
                                  isActive
                                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                                    : "text-[#869ab8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800"
                                }
                            `}
            >
              {tab.icon}
              <span className="hidden lg:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mx-2 h-6 w-px bg-[#131b2e]" />

      {/* Direct Structure Gallery Button */}
      <button type="button"
        onClick={() => useUIStore.getState().openModal("structureGallery")}
        className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:from-emerald-600/30 hover:to-teal-600/30 transition-all"
        title="Browse Famous Structures"
      >
        <Landmark className="w-4 h-4" />
        <span className="text-sm font-medium tracking-wide">Structure Gallery</span>
      </button>

      {/* Notification Toast */}
    </>
  );
});
CategorySwitcher.displayName = "CategorySwitcher";
