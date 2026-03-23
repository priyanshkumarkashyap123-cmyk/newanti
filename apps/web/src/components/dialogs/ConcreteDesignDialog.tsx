/**
 * ConcreteDesignDialog.tsx — Comprehensive RC/Concrete Design Dialog
 *
 * Wraps existing RC design components into a unified modal dialog:
 * - RC Beam Designer (IS 456 / ACI 318 / EN 1992)
 * - RC Column Designer
 * - RC Slab Designer (One-way & Two-way)
 * - RC Footing Designer
 * - Prestressed Concrete Designer
 *
 * Triggered by sidebar button: openModal('concreteDesign')
 */

import { FC, useState, lazy, Suspense } from "react";
import {
  X,
  Building2,
  Ruler,
  LayoutGrid,
  Landmark,
  Zap,
  Loader2,
} from "lucide-react";

// Lazy-load the heavy design components
const RCBeamDesigner = lazy(() => import("../rc-design/RCBeamDesigner"));
const RCColumnDesigner = lazy(() => import("../rc-design/RCColumnDesigner"));
const RCSlabDesigner = lazy(() => import("../rc-design/RCSlabDesigner"));
const RCFootingDesigner = lazy(() => import("../rc-design/RCFootingDesigner"));
const PrestressedDesigner = lazy(() =>
  import("../rc-design/PrestressedDesigner").then((m) => ({
    default: m.PrestressedDesigner,
  })),
);

type ConcreteTab = "beam" | "column" | "slab" | "footing" | "prestressed";

const TABS: { id: ConcreteTab; label: string; icon: any; desc: string }[] = [
  {
    id: "beam",
    label: "RC Beam",
    icon: Ruler,
    desc: "Reinforced concrete beam design & detailing",
  },
  {
    id: "column",
    label: "RC Column",
    icon: Building2,
    desc: "Short & slender column design with interaction",
  },
  {
    id: "slab",
    label: "RC Slab",
    icon: LayoutGrid,
    desc: "One-way, two-way & flat slab design",
  },
  {
    id: "footing",
    label: "Footing",
    icon: Landmark,
    desc: "Isolated & combined footing design",
  },
  {
    id: "prestressed",
    label: "Prestressed",
    icon: Zap,
    desc: "Pre-tension & post-tension design",
  },
];

interface ConcreteDesignDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConcreteDesignDialog: FC<ConcreteDesignDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<ConcreteTab>("beam");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-[95vw] max-w-6xl h-[90vh] bg-[#0b1326] border border-[#1a2333] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2333] bg-gradient-to-r from-orange-600/10 to-amber-600/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-600/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#dae2fd]">
                Concrete Design Studio
              </h2>
              <p className="text-xs text-[#869ab8]">
                IS 456 · ACI 318 · Eurocode 2 — RC Beam, Column, Slab, Footing &
                Prestressed
              </p>
            </div>
          </div>
          <button type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[#869ab8]" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#1a2333] bg-slate-100/50 dark:bg-slate-800/50 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium tracking-wide transition-all whitespace-nowrap
                  ${
                    isActive
                      ? "text-orange-400 border-b-2 border-orange-500 bg-orange-600/10"
                      : "text-[#869ab8] hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
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
                <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
                <span className="ml-3 text-[#869ab8]">
                  Loading design module...
                </span>
              </div>
            }
          >
            {activeTab === "beam" && <RCBeamDesigner />}
            {activeTab === "column" && <RCColumnDesigner />}
            {activeTab === "slab" && <RCSlabDesigner />}
            {activeTab === "footing" && <RCFootingDesigner />}
            {activeTab === "prestressed" && <PrestressedDesigner />}
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default ConcreteDesignDialog;
