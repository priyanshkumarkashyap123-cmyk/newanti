/**
 * SteelDesignDialog.tsx — Comprehensive Steel Design Dialog
 *
 * Hub dialog for all steel design tools:
 * - Steel Beam Design (IS 800 / AISC 360 / EN 1993) — rendered inline
 * - Steel Column Design — opens as sub-dialog
 * - Steel Composite Slab — opens as sub-dialog
 * - Code Compliance Check — rendered inline
 *
 * Triggered by sidebar button: openModal('steelDesign')
 */

import { FC, useState, lazy, Suspense } from "react";
import { X, Columns3, Ruler, LayoutGrid, Shield, Loader2 } from "lucide-react";

// Lazy-load the heavy design components
const SteelMemberDesigner = lazy(() =>
  import("../steel-design/SteelMemberDesigner"),
);
const EnhancedColumnDesignDialog = lazy(() =>
  import("../design/EnhancedColumnDesignDialog").then((m) => ({
    default: m.EnhancedColumnDesignDialog,
  })),
);
const EnhancedSlabDesignDialog = lazy(() =>
  import("../design/EnhancedSlabDesignDialog").then((m) => ({
    default: m.EnhancedSlabDesignDialog,
  })),
);
const CodeCompliancePanel = lazy(() =>
  import("../ai/CodeCompliancePanel").then((m) => ({
    default: m.CodeCompliancePanel,
  })),
);

type SteelTab = "beam" | "column" | "slab" | "compliance";

const TABS: { id: SteelTab; label: string; icon: any; desc: string }[] = [
  {
    id: "beam",
    label: "Beam Design",
    icon: Ruler,
    desc: "IS 800 / AISC 360 / EN 1993 beam checks",
  },
  {
    id: "column",
    label: "Column Design",
    icon: Columns3,
    desc: "Steel column capacity & interaction checks",
  },
  {
    id: "slab",
    label: "Composite Slab",
    icon: LayoutGrid,
    desc: "Composite slab & deck design",
  },
  {
    id: "compliance",
    label: "Code Compliance",
    icon: Shield,
    desc: "Automated code compliance verification",
  },
];

interface SteelDesignDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SteelDesignDialog: FC<SteelDesignDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<SteelTab>("beam");
  // Sub-dialog states for column & slab (they are full dialog components with their own overlay)
  const [showColumnDialog, setShowColumnDialog] = useState(false);
  const [showSlabDialog, setShowSlabDialog] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Dialog */}
        <div className="relative w-[95vw] max-w-6xl h-[90vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-gradient-to-r from-blue-600/10 to-purple-600/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <Columns3 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Steel Design Studio
                </h2>
                <p className="text-xs text-slate-400">
                  IS 800 · AISC 360 · Eurocode 3 — Beam, Column & Composite
                  Design
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-700 bg-slate-800/50">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === "column") setShowColumnDialog(true);
                    if (tab.id === "slab") setShowSlabDialog(true);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all
                    ${
                      isActive
                        ? "text-blue-400 border-b-2 border-blue-500 bg-blue-600/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                  <span className="ml-3 text-slate-400">
                    Loading design module...
                  </span>
                </div>
              }
            >
              {activeTab === "beam" && <SteelMemberDesigner />}
              {activeTab === "column" && (
                <div className="text-center py-12 space-y-4">
                  <Columns3 className="w-16 h-16 text-blue-400 mx-auto opacity-60" />
                  <h3 className="text-lg font-semibold text-white">
                    Steel Column Design
                  </h3>
                  <p className="text-sm text-slate-400 max-w-md mx-auto">
                    Full interactive column design with axial-moment interaction
                    diagrams, slenderness checks, and multi-code support.
                  </p>
                  <button
                    onClick={() => setShowColumnDialog(true)}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Open Column Designer
                  </button>
                </div>
              )}
              {activeTab === "slab" && (
                <div className="text-center py-12 space-y-4">
                  <LayoutGrid className="w-16 h-16 text-blue-400 mx-auto opacity-60" />
                  <h3 className="text-lg font-semibold text-white">
                    Composite Slab Design
                  </h3>
                  <p className="text-sm text-slate-400 max-w-md mx-auto">
                    Composite slab and deck design with profiled steel sheeting,
                    reinforcement detailing, and deflection checks.
                  </p>
                  <button
                    onClick={() => setShowSlabDialog(true)}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Open Slab Designer
                  </button>
                </div>
              )}
              {activeTab === "compliance" && <CodeCompliancePanel />}
            </Suspense>
          </div>
        </div>
      </div>

      {/* Sub-dialogs: Column and Slab are full dialogs with their own overlays */}
      <Suspense fallback={null}>
        <EnhancedColumnDesignDialog
          isOpen={showColumnDialog}
          onClose={() => setShowColumnDialog(false)}
        />
        <EnhancedSlabDesignDialog
          isOpen={showSlabDialog}
          onClose={() => setShowSlabDialog(false)}
        />
      </Suspense>
    </>
  );
};

export default SteelDesignDialog;
