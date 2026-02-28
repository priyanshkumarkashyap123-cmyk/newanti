/**
 * CivilEngineeringDialog.tsx — Comprehensive Civil Engineering Tools Hub
 *
 * Unified dialog providing access to all civil engineering modules:
 * - Geotechnical Engineering (Bearing Capacity, Settlement, etc.)
 * - Hydraulics Engineering (Open Channel Flow, Pipe Flow, etc.)
 * - Transportation Engineering (Highway Design, Pavement, Traffic)
 * - Construction Management (CPM/PERT, Cost Estimation)
 * - Surveying & Leveling
 * - Environmental Engineering
 *
 * Triggered by sidebar button in CIVIL category: openModal('civilEngineering')
 */

import { FC, useState, lazy, Suspense } from "react";
import {
  X,
  Mountain,
  Droplets,
  Car,
  HardHat,
  Globe,
  Loader2,
  Compass,
} from "lucide-react";

// Lazy-load the heavy civil components
const BearingCapacityCalculator = lazy(() =>
  import("../../modules/civil-engine/components/GeotechnicalUI").then((m) => ({
    default: m.BearingCapacityCalculator,
  })),
);
const HydraulicsDesigner = lazy(() =>
  import("../../modules/civil-engine/components/HydraulicsDesigner").then(
    (m) => ({ default: m.HydraulicsDesigner }),
  ),
);
const TransportationDesigner = lazy(() =>
  import("../../modules/civil-engine/components/TransportationDesigner").then(
    (m) => ({ default: m.TransportationDesigner }),
  ),
);
const ConstructionManager = lazy(() =>
  import("../../modules/civil-engine/components/ConstructionManager").then(
    (m) => ({ default: m.ConstructionManager }),
  ),
);

type CivilTab =
  | "geotechnical"
  | "hydraulics"
  | "transportation"
  | "construction";

const TABS: { id: CivilTab; label: string; icon: any; desc: string }[] = [
  {
    id: "geotechnical",
    label: "Geotechnical",
    icon: Mountain,
    desc: "Bearing capacity, settlement, earth pressure, slope stability",
  },
  {
    id: "hydraulics",
    label: "Hydraulics",
    icon: Droplets,
    desc: "Open channel flow, pipe networks, Manning's equation",
  },
  {
    id: "transportation",
    label: "Transportation",
    icon: Car,
    desc: "Highway design, pavement, traffic analysis",
  },
  {
    id: "construction",
    label: "Construction Mgmt",
    icon: HardHat,
    desc: "CPM/PERT scheduling, cost estimation, Gantt charts",
  },
];

interface CivilEngineeringDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CivilEngineeringDialog: FC<CivilEngineeringDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<CivilTab>("geotechnical");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-[95vw] max-w-6xl h-[90vh] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-green-600/10 to-teal-600/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
              <Globe className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                Civil Engineering Hub
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Geotechnical · Hydraulics · Transportation · Construction
                Management
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap
                  ${
                    isActive
                      ? "text-green-400 border-b-2 border-green-500 bg-green-600/10"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                  }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content — light-bg wrapper for civil components that use white backgrounds */}
        <div className="flex-1 overflow-auto p-4">
          <div className="bg-gray-50 rounded-xl p-4 min-h-full">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                  <span className="ml-3 text-gray-500">
                    Loading civil engineering module...
                  </span>
                </div>
              }
            >
              {activeTab === "geotechnical" && <BearingCapacityCalculator />}
              {activeTab === "hydraulics" && <HydraulicsDesigner />}
              {activeTab === "transportation" && <TransportationDesigner />}
              {activeTab === "construction" && <ConstructionManager />}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CivilEngineeringDialog;
