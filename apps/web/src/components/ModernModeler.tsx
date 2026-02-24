/**
 * ModernModeler.tsx - Unified Modeler Component
 *
 * Integrates all modern components:
 * - Flex-based layout with collapsible panels
 * - SmartSidebar for context-aware tools
 * - 3D visualization via ViewportManager
 * - Analysis Workflow with guided steps
 * - Quick Start modal for new users
 */

import {
  FC,
  useState,
  useEffect,
  useCallback,
  useRef,
  lazy,
  Suspense,
  memo,
  useMemo,
} from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Layers,
  Download,
  BarChart3,
  Ruler,
  ChevronLeft,
  ChevronRight,
  Landmark,
} from "lucide-react";
import { useUIStore, Category } from "../store/uiStore";
import { useModelStore, saveProjectToStorage } from "../store/model";
import { ViewportManager } from "./ViewportManager";
// import { Toolbar } from './Toolbar'; // Replaced by Ribbon
import { PropertiesPanel } from "./PropertiesPanel";
// ResultsTable — replaced by AnalysisResultsDashboard

// New layout components
import { WorkflowSidebar } from "./layout/WorkflowSidebar";
import { EngineeringRibbon } from "./layout/EngineeringRibbon";

// New workflow components
// AnalysisWorkflow replaced by AnalysisProgressModal stepper
import {
  AnalysisProgressModal,
  type AnalysisStage,
} from "./AnalysisProgressModal";
import { QuickStartModal } from "./QuickStartModal";
import { ProjectDetailsDialog } from "./ProjectDetailsDialog";
import { ResultsToolbar } from "./results/ResultsToolbar";
import ModalControls from "./ModalControls";
import { AutonomousAIAgent } from "./ai";
import { LoadInputDialog } from "./ui/LoadInputDialog";
// TutorialOverlay deferred to Phase 2
import { validateStructure } from "../utils/structuralValidation";
import { distributeFloorLoads } from "../services/floorLoadDistributor";

// ---- Lazy-loaded dialogs & panels (only fetched when opened) ----
const StructureWizard = lazy(() =>
  import("./StructureWizard").then((m) => ({ default: m.StructureWizard })),
);
const FoundationDesignDialog = lazy(() =>
  import("./FoundationDesignDialog").then((m) => ({
    default: m.FoundationDesignDialog,
  })),
);
const IS875LoadDialog = lazy(() =>
  import("./IS875LoadDialog").then((m) => ({ default: m.IS875LoadDialog })),
);
const GeometryToolsPanel = lazy(() =>
  import("./GeometryToolsPanel").then((m) => ({
    default: m.GeometryToolsPanel,
  })),
);
const ValidationErrorDisplay = lazy(() =>
  import("./ValidationErrorDisplay").then((m) => ({
    default: m.ValidationErrorDisplay,
  })),
);
const ValidationDialog = lazy(() =>
  import("./ValidationDialog").then((m) => ({ default: m.ValidationDialog })),
);
const StressVisualization = lazy(() => import("./StressVisualization"));
const InteroperabilityDialog = lazy(() =>
  import("./InteroperabilityDialog").then((m) => ({
    default: m.InteroperabilityDialog,
  })),
);
const RailwayBridgeDialog = lazy(() =>
  import("./RailwayBridgeDialog").then((m) => ({
    default: m.RailwayBridgeDialog,
  })),
);
const MeshingPanel = lazy(() =>
  import("./MeshingPanel").then((m) => ({ default: m.MeshingPanel })),
);
const AdvancedSelectionPanel = lazy(() =>
  import("./AdvancedSelectionPanel").then((m) => ({
    default: m.AdvancedSelectionPanel,
  })),
);
const LoadDialog = lazy(() =>
  import("./LoadDialog").then((m) => ({ default: m.LoadDialog })),
);
const WindLoadDialog = lazy(() => import("./WindLoadDialog"));
const SeismicLoadDialog = lazy(() => import("./SeismicLoadDialog"));
const MovingLoadDialog = lazy(() => import("./MovingLoadDialog"));
const SplitMemberDialog = lazy(() =>
  import("./geometry/SplitMemberDialog").then((m) => ({
    default: m.SplitMemberDialog,
  })),
);
const MemberSpecificationsDialog = lazy(() =>
  import("./specifications/MemberSpecificationsDialog").then((m) => ({
    default: m.MemberSpecificationsDialog,
  })),
);
const ASCE7SeismicLoadDialog = lazy(() => import("./ASCE7SeismicLoadDialog"));
const ASCE7WindLoadDialog = lazy(() => import("./ASCE7WindLoadDialog"));
const LoadCombinationsDialog = lazy(() => import("./LoadCombinationsDialog"));
const AdvancedAnalysisDialog = lazy(() =>
  import("./AdvancedAnalysisDialog").then((m) => ({
    default: m.AdvancedAnalysisDialog,
  })),
);
const DesignCodesDialog = lazy(() =>
  import("./DesignCodesDialog").then((m) => ({ default: m.DesignCodesDialog })),
);
const ModalAnalysisPanel = lazy(() =>
  import("./analysis/ModalAnalysisPanel").then((m) => ({
    default: m.ModalAnalysisPanel,
  })),
);
const ExportDialog = lazy(() =>
  import("./ExportDialog").then((m) => ({ default: m.ExportDialog })),
);
const CloudProjectManager = lazy(() =>
  import("./CloudProjectManager").then((m) => ({
    default: m.CloudProjectManager,
  })),
);
const StructureGallery = lazy(() =>
  import("./gallery/StructureGallery").then((m) => ({
    default: m.StructureGallery,
  })),
);
const PlateCreationDialog = lazy(() =>
  import("./dialogs/PlateCreationDialog").then((m) => ({
    default: m.PlateCreationDialog,
  })),
);
const FloorSlabDialog = lazy(() =>
  import("./dialogs/FloorSlabDialog").then((m) => ({
    default: m.FloorSlabDialog,
  })),
);
const BoundaryConditionsDialog = lazy(() =>
  import("./BoundaryConditionsDialog").then((m) => ({
    default: m.BoundaryConditionsDialog,
  })),
);
const SelectionToolbar = lazy(() =>
  import("./SelectionToolbar").then((m) => ({ default: m.SelectionToolbar })),
);
const DeadLoadGenerator = lazy(() =>
  import("./DeadLoadGenerator").then((m) => ({ default: m.DeadLoadGenerator })),
);
import { useToast } from "./ui/ToastSystem";
import { ModelingToolbar } from "./toolbar/ModelingToolbar";
import type { Node, Member } from "../store/model";
// ConsentService — consumed via useCheckLegalConsent hook
import { useAuth } from "../providers/AuthProvider";
import { useSubscription } from "../hooks/useSubscription";

// Production-safe logging
import { modelerLogger, stressLogger, uiLogger } from "../utils/logger";

// Command Palette for quick feature access (Cmd+K)
import { CommandPalette, useCommandPalette } from "./CommandPalette";

// Quick Commands and Context Menu (STAAD Pro style)
import {
  useQuickCommands,
  getDefaultQuickCommands,
} from "./QuickCommandsToolbar";
import {
  useContextMenu,
  getNodeContextMenuItems,
  getMemberContextMenuItems,
  getEmptyContextMenuItems,
} from "./ContextMenu";

// Analysis service — lazy-loaded on first analysis run
let _analysisServicePromise: Promise<
  typeof import("../services/AnalysisService")
> | null = null;
function getAnalysisService() {
  if (!_analysisServicePromise)
    _analysisServicePromise = import("../services/AnalysisService");
  return _analysisServicePromise;
}
import { API_CONFIG } from "../config/env";
import { useHealthCheck, type HealthStatus } from "../lib/health-check";
const IntegrationDiagnostics = lazy(() => import("./IntegrationDiagnostics"));
import { useRazorpayPayment } from "./RazorpayPayment";
import { useTierAccess } from "../hooks/useTierAccess";
import { ProjectService, Project } from "../services/ProjectService";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

// Multiplayer
import {
  MultiplayerProvider,
  useMultiplayerContextSafe,
} from "./collaborators/MultiplayerContext";
import { Collaborators } from "./collaborators/Collaborators";
import { ServerUpdate } from "../hooks/useMultiplayer";

// ============================================

interface TabConfig {
  id: Category;
  label: string;
  icon: React.ReactNode;
}

// ============================================
// CATEGORY TABS CONFIGURATION
// ============================================

const CATEGORY_TABS: TabConfig[] = [
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

// Map workflow steps to categories
// Step-to-category mapping now handled by WorkflowSidebar

// ============================================
// CATEGORY SWITCHER
// ============================================

const CategorySwitcher: FC = memo(() => {
  const { activeCategory, setCategory } = useUIStore();

  return (
    <>
      <div className="flex items-center gap-1 px-2">
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCategory(tab.id)}
              className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg
                                text-sm font-medium transition-all duration-200
                                ${
                                  isActive
                                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                                }
                            `}
            >
              {tab.icon}
              <span className="hidden lg:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mx-2 h-6 w-px bg-zinc-800" />

      {/* Direct Structure Gallery Button */}
      <button
        onClick={() => useUIStore.getState().openModal("structureGallery")}
        className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:from-emerald-600/30 hover:to-teal-600/30 transition-all"
        title="Browse Famous Structures"
      >
        <Landmark className="w-4 h-4" />
        <span className="text-sm font-medium">Structure Gallery</span>
      </button>

      {/* Notification Toast */}
    </>
  );
});
CategorySwitcher.displayName = "CategorySwitcher";

// ============================================
// INSPECTOR PANEL
// ============================================

const InspectorPanel: FC<{ collapsed: boolean; onToggle: () => void }> = memo(
  ({ collapsed, onToggle }) => {
    const selectedIds = useModelStore((state) => state.selectedIds);

    if (collapsed) {
      return (
        <div className="w-10 h-full bg-slate-900 border-l border-slate-800 flex flex-col items-center py-2 absolute right-0 z-20 md:relative shadow-lg md:shadow-none">
          <button
            onClick={onToggle}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
            title="Show Properties"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      );
    }

    return (
      <div className="w-72 h-full bg-slate-900/95 backdrop-blur-sm border-l border-slate-800/60 flex flex-col flex-shrink-0 absolute right-0 z-20 md:relative shadow-xl md:shadow-none">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Properties
          </h3>
          <button
            onClick={onToggle}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded"
            title="Hide Properties"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <PropertiesPanel />
        </div>
        <div className="p-3 border-t border-slate-800">
          <p className="text-[10px] text-slate-400 text-center">
            {selectedIds.size === 0
              ? "Select an element to view properties"
              : `${selectedIds.size} item(s) selected`}
          </p>
        </div>
      </div>
    );
  },
);
InspectorPanel.displayName = "InspectorPanel";

// ============================================
// STATUS BAR
// ============================================

const StatusBar: FC<{ isAnalyzing: boolean; onOpenDiagnostics?: () => void }> =
  memo(({ isAnalyzing, onOpenDiagnostics }) => {
    const nodes = useModelStore((state) => state.nodes);
    const members = useModelStore((state) => state.members);
    const analysisResults = useModelStore((state) => state.analysisResults);
    const { activeCategory, activeTool } = useUIStore();

    const backendHealthConfigs = useMemo(
      () => [
        { name: "Node", url: `${API_CONFIG.baseUrl}/health`, timeout: 3500 },
        {
          name: "Python",
          url: `${API_CONFIG.pythonUrl}/health`,
          timeout: 3500,
        },
        { name: "Rust", url: `${API_CONFIG.rustUrl}/health`, timeout: 3500 },
      ],
      [],
    );

    const { health } = useHealthCheck({
      configs: backendHealthConfigs,
      interval: 30000,
      enabled: true,
    });

    const statusDotClass = (status: HealthStatus): string => {
      if (status === "healthy") return "bg-green-400";
      if (status === "degraded") return "bg-yellow-400";
      if (status === "unhealthy") return "bg-red-400";
      return "bg-slate-500";
    };

    const checkByName = new Map(
      (health?.checks || []).map((c) => [c.name, c.status]),
    );

    return (
      <div className="h-7 bg-slate-950 border-t border-slate-800 flex items-center justify-between px-4 text-xs text-slate-400 flex-shrink-0">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${isAnalyzing ? "bg-yellow-500 animate-pulse" : "bg-green-500"}`}
            />
            {isAnalyzing ? "Analyzing..." : "Ready"}
          </span>
          <span className="h-3 w-px bg-slate-700" />
          <span>
            Mode: <span className="text-slate-400">{activeCategory}</span>
          </span>
          <span className="h-3 w-px bg-slate-700" />
          <span>
            Tool: <span className="text-slate-400">{activeTool || "None"}</span>
          </span>
        </div>
        <div className="flex items-center gap-6">
          <span>
            Nodes:{" "}
            <span className="text-slate-400 font-mono">{nodes.size}</span>
          </span>
          <span className="h-3 w-px bg-slate-700" />
          <span>
            Members:{" "}
            <span className="text-slate-400 font-mono">{members.size}</span>
          </span>
          <span className="h-3 w-px bg-slate-700" />
          <span>
            Units: <span className="text-slate-400">kN, m</span>
          </span>
          <span className="h-3 w-px bg-slate-700" />
          <button
            onClick={onOpenDiagnostics}
            className="flex items-center gap-2 hover:bg-slate-800/60 rounded px-1.5 py-0.5 -my-0.5 transition cursor-pointer"
            title="Click for integration diagnostics"
          >
            <span className="text-slate-500">Backends:</span>
            {(["Node", "Python", "Rust"] as const).map((name) => {
              const status = checkByName.get(name) || "unknown";
              return (
                <span
                  key={name}
                  className="flex items-center gap-1"
                  title={`${name}: ${status}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${statusDotClass(status)}`}
                  />
                  <span className="text-slate-400">{name}</span>
                </span>
              );
            })}
          </button>
          {analysisResults && (
            <>
              <span className="h-3 w-px bg-zinc-700" />
              <span className="text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Results Available
              </span>
            </>
          )}
        </div>
      </div>
    );
  });
StatusBar.displayName = "StatusBar";

// ============================================
// MULTIPLAYER UI (outside ModernModeler to avoid re-creation every render)
// ============================================

const MultiplayerUI: FC = memo(() => {
  const mp = useMultiplayerContextSafe();
  if (!mp) return null;
  return (
    <Collaborators
      users={mp.remoteUsers}
      currentUserColor={mp.userColor}
      isConnected={mp.isConnected}
    />
  );
});
MultiplayerUI.displayName = "MultiplayerUI";

// ============================================
// MAIN MODERN MODELER COMPONENT
// ============================================

export const ModernModeler: FC = () => {
  const { getToken, userId, user } = useAuth();
  const { subscription, refreshSubscription } = useSubscription();
  const { openPayment } = useRazorpayPayment();
  const { isFree } = useTierAccess();
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-trigger upgrade if requested via URL
  useEffect(() => {
    const upgrade = searchParams.get("upgrade");
    if (upgrade === "pro" && isFree && userId && user?.email) {
      (async () => {
        const success = await openPayment(userId, user.email, "monthly");
        if (success) {
          await refreshSubscription();
        }
      })();
      // Clean URL
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.delete("upgrade");
        return newParams;
      });
    }
  }, [
    searchParams,
    isFree,
    userId,
    user,
    openPayment,
    setSearchParams,
    refreshSubscription,
  ]);

  // Listen for manual upgrade trigger from Ribbon
  useEffect(() => {
    const handleUpgradeTrigger = async () => {
      if (userId && user?.email) {
        const success = await openPayment(userId, user.email, "monthly");
        if (success) {
          await refreshSubscription();
        }
      }
    };
    document.addEventListener("trigger-upgrade", handleUpgradeTrigger);
    return () =>
      document.removeEventListener("trigger-upgrade", handleUpgradeTrigger);
  }, [userId, user, openPayment, refreshSubscription]);

  // Clean up analysis worker when leaving the modeler
  useEffect(() => {
    return () => {
      getAnalysisService().then((m) => m.analysisService.dispose());
    };
  }, []);

  const nodes = useModelStore((state) => state.nodes);
  const members = useModelStore((state) => state.members);
  const loads = useModelStore((state) => state.loads);
  const memberLoads = useModelStore((state) => state.memberLoads);
  const floorLoads = useModelStore((state) => state.floorLoads);
  const modelSettings = useModelStore((state) => state.settings);
  const analysisResults = useModelStore((state) => state.analysisResults);
  const setAnalysisResults = useModelStore((state) => state.setAnalysisResults);
  const setIsAnalyzing = useModelStore((state) => state.setIsAnalyzing);
  // UI Store
  const {
    activeCategory,
    setCategory,
    activeTool,
    setActiveTool,
    modals,
    openModal,
    closeModal,
    notification,
    hideNotification,
    showNotification,
  } = useUIStore();

  const toastSystem = useToast();

  // Handle notifications from UIStore via ToastSystem
  useEffect(() => {
    if (notification?.show) {
      const method =
        notification.type === "success"
          ? toastSystem.success
          : notification.type === "error"
            ? toastSystem.error
            : toastSystem.info;
      method(notification.message, { duration: 3000 });
      hideNotification();
    }
  }, [notification, toastSystem, hideNotification]);

  // Wiring for Generator Tools
  useEffect(() => {
    if (!activeTool) return;

    const GENERATOR_TOOLS = [
      "GRID_GENERATE",
      "GRID_3D",
      "CIRCULAR_GRID",
      "TRUSS_GENERATOR",
      "ARCH_GENERATOR",
      "PIER_GENERATOR",
      "TOWER_GENERATOR",
      "DECK_GENERATOR",
      "CABLE_PATTERN",
      "FRAME_GENERATOR",
      "STAIRCASE_GENERATOR",
    ];

    if (GENERATOR_TOOLS.includes(activeTool)) {
      openModal("structureWizard");
      setActiveTool("SELECT"); // Reset to select after opening wizard
    }
  }, [activeTool, openModal, setActiveTool]);

  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [showCloudManager, setShowCloudManager] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  // ============================================
  // CLOUD PROJECT MANAGEMENT
  // ============================================

  // Cloud Save Handler
  const handleCloudSave = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      showNotification("error", "Please log in to save to cloud");
      return;
    }

    const state = useModelStore.getState();

    // Serialize Maps to Array
    const projectData = {
      projectInfo: state.projectInfo,
      nodes: Array.from(state.nodes.entries()),
      members: Array.from(state.members.entries()),
      loads: state.loads,
      memberLoads: state.memberLoads,
      analysisResults: null, // Don't save large results
    };

    try {
      let savedProject: Project;
      if (state.projectInfo.cloudId) {
        // Update existing
        savedProject = await ProjectService.updateProject(
          state.projectInfo.cloudId,
          {
            name: state.projectInfo.name,
            description: state.projectInfo.description,
            data: projectData,
          },
          token,
        );
        showNotification("success", "Project updated in cloud");
      } else {
        // Create new
        savedProject = await ProjectService.createProject(
          {
            name: state.projectInfo.name || "Untitled Project",
            description: state.projectInfo.description,
            data: projectData,
          },
          token,
        );

        // Update local state with new cloud ID
        useModelStore.setState((s) => ({
          projectInfo: { ...s.projectInfo, cloudId: savedProject._id },
        }));
        showNotification("success", "Project saved to cloud");
      }
    } catch (error) {
      modelerLogger.error("Failed to save project:", error);
      showNotification(
        "error",
        "Failed to save project. Ensure you are logged in.",
      );
    }
  }, [getToken, showNotification]);

  // Cloud Load Handler
  const handleCloudLoad = useCallback(
    (project: Project) => {
      try {
        const data = project.data;
        if (!data) return;

        // Reconstruct Maps
        const nodesMap = new Map(data.nodes as [string, Node][]);
        const membersMap = new Map(data.members as [string, Member][]);

        // Update store
        useModelStore.setState({
          projectInfo: { ...data.projectInfo, cloudId: project._id },
          nodes: nodesMap,
          members: membersMap,
          loads: data.loads || [],
          memberLoads: data.memberLoads || [],
          analysisResults: null,
          selectedIds: new Set(),
          isAnalyzing: false,
        });

        showNotification("success", `Loaded project: ${project.name}`);
      } catch (error) {
        modelerLogger.error("Failed to parse project data:", error);
        showNotification("error", "Failed to parse project data");
      }
    },
    [showNotification],
  );

  // Ribbon Event Listeners
  useEffect(() => {
    const onSave = () => handleCloudSave();
    const onOpen = () => setShowCloudManager(true);

    document.addEventListener("trigger-save", onSave);
    document.addEventListener("trigger-cloud-open", onOpen);

    return () => {
      document.removeEventListener("trigger-save", onSave);
      document.removeEventListener("trigger-cloud-open", onOpen);
    };
  }, [handleCloudSave]);

  // Analysis state
  const [isAnalyzing, setIsAnalyzingLocal] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] =
    useState<AnalysisStage>("validating");
  const [analysisError, setAnalysisError] = useState<string | undefined>();
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [analysisStats, setAnalysisStats] = useState<
    { nodes: number; members: number; dof: number; timeMs: number } | undefined
  >();
  const [showResultsToolbar, setShowResultsToolbar] = useState(false);

  // Validation state
  const [validationErrors, setValidationErrors] = useState<any | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [structuralValidationErrors, setStructuralValidationErrors] = useState<
    any[]
  >([]);
  const [structuralValidationWarnings, setStructuralValidationWarnings] =
    useState<any[]>([]);
  const [stressResults, setStressResults] = useState<any[] | null>(null);
  const [showStressVisualization, setShowStressVisualization] = useState(false);
  const [currentStressType, setCurrentStressType] = useState("von_mises");

  // Export state
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Modal Analysis state
  const [showModalAnalysis, setShowModalAnalysis] = useState(false);

  // Command Palette state (Cmd+K)
  const commandPalette = useCommandPalette();

  // Open structure gallery from anywhere
  useEffect(() => {
    const handleOpenGallery = () => {
      openModal("structureGallery");
    };
    document.addEventListener("open-structure-gallery", handleOpenGallery);
    return () =>
      document.removeEventListener("open-structure-gallery", handleOpenGallery);
  }, [openModal]);

  // Feedback state

  // Quick start modal
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [isNewProject, setIsNewProject] = useState(false);

  // Handler for new project from QuickStart
  const handleNewProject = useCallback(() => {
    setShowQuickStart(false);
    setIsNewProject(true);
    setShowProjectDetails(true);
  }, []);

  // Auto-save project after analysis completes
  const handleProjectSave = useCallback(() => {
    saveProjectToStorage();
    showNotification("success", "Project saved successfully!");
  }, [showNotification]);

  // Import new layout components handled at top of file

  // Calculate stresses from analysis results
  const calculateStresses = useCallback(
    async (memberForces: Map<string, any>, members: Map<string, Member>) => {
      try {
        stressLogger.log("Calculating stresses for members...");

        // Prepare stress calculation request
        const membersData = Array.from(members.values())
          .map((member) => {
            const forces = memberForces.get(member.id);
            if (!forces) return null;

            // Extract diagram data or use single values
            const axialArray = forces.diagramData?.axial || [forces.axial || 0];
            const shearYArray = forces.diagramData?.shear_y || [
              forces.shearY || 0,
            ];
            const shearZArray = forces.diagramData?.shear_z || [
              forces.shearZ || 0,
            ];
            const momentYArray = forces.diagramData?.moment_y || [
              forces.momentY || 0,
            ];
            const momentZArray = forces.diagramData?.moment_z || [
              forces.momentZ || 0,
            ];

            // Get section properties from member
            // Use member's A and I properties, with defaults
            const area = member.A || 0.01; // m²
            const I = member.I || 1e-4; // m⁴

            // Estimate depth and width from section area/inertia
            // For rectangular section: I = bd³/12, A = bd
            // Assume depth = 2*width for typical beam proportion
            const estimatedDepth = Math.pow(((12 * I) / area) * 2, 1 / 2);
            const estimatedWidth = estimatedDepth / 2;

            const section = {
              area: area,
              Ixx: I, // m⁴
              Iyy: I / 10, // m⁴ (approximate for typical I-beam)
              depth: estimatedDepth || 0.3, // m
              width: estimatedWidth || 0.15, // m
            };

            // Calculate member length
            const startNode = nodes.get(member.startNodeId);
            const endNode = nodes.get(member.endNodeId);
            if (!startNode || !endNode) return null;

            const dx = endNode.x - startNode.x;
            const dy = endNode.y - startNode.y;
            const dz = endNode.z - startNode.z;
            const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

            return {
              id: member.id,
              forces: {
                axial: axialArray,
                moment_x: momentZArray, // Convention: Mx = Mz in local coords
                moment_y: momentYArray,
                shear_y: shearYArray,
                shear_z: shearZArray,
              },
              section,
              length,
            };
          })
          .filter((m) => m !== null);

        if (membersData.length === 0) {
          stressLogger.log("No member force data available");
          return;
        }

        // Call stress calculation API
        const PYTHON_API = API_CONFIG.pythonUrl;
        const response = await fetch(`${PYTHON_API}/stress/calculate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            members: membersData,
            stress_type: currentStressType,
            fy: 250.0, // Default yield strength for steel (MPa)
            safety_factor: 1.5,
          }),
        });

        if (!response.ok) {
          throw new Error(`Stress calculation failed: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success && data.results) {
          setStressResults(data.results);
          setShowStressVisualization(true);
          stressLogger.log(
            `Stress calculation completed: ${data.results.length} members`,
          );
        }
      } catch (error) {
        stressLogger.error("Error calculating stresses:", error);
        // Don't show error to user - stress visualization is optional enhancement
      }
    },
    [currentStressType, nodes],
  );

  // Actual analysis execution (called after consent)
  const executeAnalysis = useCallback(async () => {
    setIsAnalyzingLocal(true);
    setIsAnalyzing(true);
    setShowProgressModal(true);
    setAnalysisStage("validating");
    setAnalysisProgress(10);
    setAnalysisError(undefined);

    const startTime = Date.now();

    try {
      // Build model data for analysis
      const nodesArray = Array.from(nodes.values()).map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        z: n.z,
        restraints: n.restraints,
        // Convert restraints to support type for Python API
        support: n.restraints
          ? n.restraints.fx &&
            n.restraints.fy &&
            n.restraints.fz &&
            n.restraints.mx &&
            n.restraints.my &&
            n.restraints.mz
            ? "fixed"
            : n.restraints.fx && n.restraints.fy && n.restraints.fz
              ? "pinned"
              : n.restraints.fy
                ? "roller_x"
                : "none"
          : "none",
      }));

      const membersArray = Array.from(members.values()).map((m) => {
        const E = m.E ?? 200e6; // 200 GPa in kN/m²
        const G = m.G ?? E / 2.6; // Shear modulus (kN/m²) — use store value or approximate from E
        const I = m.I ?? 1e-4; // Legacy single I (m⁴)
        const Iy = m.Iy ?? I; // Use store Iy, fallback to legacy I
        const Iz = m.Iz ?? I; // Use store Iz, fallback to legacy I
        const J = m.J ?? Iy + Iz; // Use store J, fallback to Iy+Iz (exact for circular)
        return {
          id: m.id,
          startNodeId: m.startNodeId,
          endNodeId: m.endNodeId,
          E,
          G,
          A: m.A ?? 0.01,
          Iy,
          Iz,
          J,
          I, // keep legacy I for diagram generation
          betaAngle: m.betaAngle ?? 0, // degrees
          rho: m.rho ?? 7850, // Material density (kg/m³), default steel
          releases: m.releases,
        };
      });

      let result: {
        success: boolean;
        displacements?: Record<string, number[]>;
        reactions?: Record<string, number[]>;
        memberForces?: Record<string, any>;
        equilibriumCheck?: {
          applied_forces: number[];
          reaction_forces: number[];
          residual: number[];
          error_percent: number;
          pass: boolean;
        };
        conditionNumber?: number;
        stats?: any;
        error?: string;
      };

      // Always try WASM solver first (handles both with and without member loads)
      {
        setAnalysisStage("assembling");
        setAnalysisProgress(30);

        // Direction format - Rust WASM expects strings like "local_y", "global_y"
        // The Rust code checks for "local" AND "y" in the string
        const convertDirection = (dir: string): string => {
          // Already in correct format
          if (dir.includes("_")) return dir;

          // Convert from older formats
          switch (dir) {
            case "Fy":
              return "local_y";
            case "Fz":
              return "local_z";
            case "Fx":
              return "local_x";
            case "FX":
              return "global_x";
            case "FY":
              return "global_y";
            case "FZ":
              return "global_z";
            case "axial":
              return "local_x";
            case "projected":
              return "global_y";
            default:
              return dir || "global_y";
          }
        };

        // Build distributed_loads from memberLoads in WASM format
        // WASM MemberLoad struct: { element_id, w1, w2, direction, start_pos, end_pos, is_projected }
        const wasmMemberLoads = memberLoads
          .filter((ml) => ml.type === "UDL" || ml.type === "UVL")
          .map((ml) => ({
            element_id: ml.memberId, // String ID — Rust deserializes strings natively
            w1: (ml.w1 ?? 0) * 1000, // Convert kN/m to N/m for WASM
            w2:
              ml.type === "UDL"
                ? (ml.w1 ?? 0) * 1000
                : (ml.w2 ?? ml.w1 ?? 0) * 1000,
            direction: convertDirection(ml.direction),
            start_pos: ml.startPos ?? 0,
            end_pos: ml.endPos ?? 1,
            is_projected: false, // Default to false, could be extended later
          }));

        // ── Floor Load → Member UDL Distribution ──────────────────────────
        // Convert area/floor loads to equivalent beam UDLs using yield-line method
        if (floorLoads && floorLoads.length > 0) {
          const floorResult = distributeFloorLoads(
            floorLoads,
            nodesArray.map((n) => ({ id: n.id, x: n.x, y: n.y, z: n.z ?? 0 })),
            membersArray.map((m) => ({
              id: m.id,
              startNodeId: m.startNodeId,
              endNodeId: m.endNodeId,
            })),
          );
          if (floorResult.loads.length > 0) {
            modelerLogger.log(
              `[Analysis] Floor loads: ${floorLoads.length} area loads → ${floorResult.panels.length} panels → ${floorResult.loads.length} beam UDLs`,
            );
            // Merge floor-generated UDLs into wasmMemberLoads
            for (const fl of floorResult.loads) {
              wasmMemberLoads.push({
                element_id: fl.element_id,
                w1: fl.w1,
                w2: fl.w2,
                direction: fl.direction,
                start_pos: fl.start_pos,
                end_pos: fl.end_pos,
                is_projected: fl.is_projected,
              });
            }
          } else {
            modelerLogger.log(
              `[Analysis] Floor loads: ${floorLoads.length} defined but no panels detected — check beam geometry at Y levels`,
            );
          }
        }

        // Convert member point loads and moments to equivalent nodal loads
        // (Rust solver only supports distributed loads, not concentrated member loads)
        const memberPointLoads = memberLoads.filter(
          (ml) => ml.type === "point" || ml.type === "moment",
        );
        const equivalentNodalFromMemberPt: Array<{
          node_id: string;
          fx: number;
          fy: number;
          fz: number;
          mx: number;
          my: number;
          mz: number;
        }> = [];
        for (const mpl of memberPointLoads) {
          const mInfo = membersArray.find((m) => m.id === mpl.memberId);
          if (!mInfo) continue;
          const nd1 = nodesArray.find((n) => n.id === mInfo.startNodeId);
          const nd2 = nodesArray.find((n) => n.id === mInfo.endNodeId);
          if (!nd1 || !nd2) continue;
          const dx = nd2.x - nd1.x,
            dy = nd2.y - nd1.y;
          const dz = (nd2.z ?? 0) - (nd1.z ?? 0);
          const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (L < 1e-12) continue;
          // Distance from start node (convert ratio to actual if <= 1)
          const aRaw = mpl.a ?? 0.5;
          const a = aRaw <= 1.0 ? aRaw * L : aRaw; // ratio or absolute
          const b = L - a;
          if (mpl.type === "point" && mpl.P) {
            // Fixed-end reactions for concentrated load P at distance a from start
            // R1 = Pb²(3a+b)/L³, R2 = Pa²(a+3b)/L³
            // M1 = Pab²/L², M2 = -Pa²b/L²
            const P = mpl.P * 1000; // kN → N
            const R1 = (P * b * b * (3 * a + b)) / (L * L * L);
            const R2 = (P * a * a * (a + 3 * b)) / (L * L * L);
            const M1 = (P * a * b * b) / (L * L);
            const M2 = (-P * a * a * b) / (L * L);
            // Determine load direction in global coordinates
            const dir = mpl.direction || "global_y";
            if (dir === "local_y" || dir === "global_y") {
              equivalentNodalFromMemberPt.push(
                {
                  node_id: mInfo.startNodeId,
                  fx: 0,
                  fy: R1,
                  fz: 0,
                  mx: 0,
                  my: 0,
                  mz: M1,
                },
                {
                  node_id: mInfo.endNodeId,
                  fx: 0,
                  fy: R2,
                  fz: 0,
                  mx: 0,
                  my: 0,
                  mz: M2,
                },
              );
            } else if (dir === "local_z" || dir === "global_z") {
              equivalentNodalFromMemberPt.push(
                {
                  node_id: mInfo.startNodeId,
                  fx: 0,
                  fy: 0,
                  fz: R1,
                  mx: 0,
                  my: -M1,
                  mz: 0,
                },
                {
                  node_id: mInfo.endNodeId,
                  fx: 0,
                  fy: 0,
                  fz: R2,
                  mx: 0,
                  my: -M2,
                  mz: 0,
                },
              );
            } else if (dir === "global_x" || dir === "axial") {
              // Axial point load
              const R1x = (P * b) / L;
              const R2x = (P * a) / L;
              equivalentNodalFromMemberPt.push(
                {
                  node_id: mInfo.startNodeId,
                  fx: R1x,
                  fy: 0,
                  fz: 0,
                  mx: 0,
                  my: 0,
                  mz: 0,
                },
                {
                  node_id: mInfo.endNodeId,
                  fx: R2x,
                  fy: 0,
                  fz: 0,
                  mx: 0,
                  my: 0,
                  mz: 0,
                },
              );
            }
          } else if (mpl.type === "moment" && mpl.M) {
            // Fixed-end reactions for concentrated moment M at distance a from start
            // R1 = 6M·a·b / L³ (upward), R2 = -6M·a·b / L³ (downward)
            // M1 = M·b·(2a - b)/L², M2 = M·a·(2b - a)/L²
            const Mo = mpl.M * 1000; // kN·m → N·m
            const R1 = (6 * Mo * a * b) / (L * L * L);
            const R2 = -R1;
            const M1 = (Mo * b * (2 * a - b)) / (L * L);
            const M2 = (Mo * a * (2 * b - a)) / (L * L);
            // Moment loads typically about Z axis
            equivalentNodalFromMemberPt.push(
              {
                node_id: mInfo.startNodeId,
                fx: 0,
                fy: R1,
                fz: 0,
                mx: 0,
                my: 0,
                mz: M1,
              },
              {
                node_id: mInfo.endNodeId,
                fx: 0,
                fy: R2,
                fz: 0,
                mx: 0,
                my: 0,
                mz: M2,
              },
            );
          }
        }

        // Build point loads from nodal loads in WASM format
        // WASM NodalLoad struct: { node_id, fx, fy, fz, mx, my, mz }
        const wasmPointLoads = [
          ...loads.map((l) => ({
            node_id: l.nodeId,
            fx: (l.fx ?? 0) * 1000, // Convert kN to N for WASM
            fy: (l.fy ?? 0) * 1000,
            fz: (l.fz ?? 0) * 1000,
            mx: (l.mx ?? 0) * 1000, // Convert kN·m to N·m
            my: (l.my ?? 0) * 1000,
            mz: (l.mz ?? 0) * 1000,
          })),
          // Merge equivalent nodal loads from member point loads
          ...equivalentNodalFromMemberPt,
        ];

        modelerLogger.log(
          `[Analysis] Member loads: ${wasmMemberLoads.length}, Point loads: ${wasmPointLoads.length}`,
        );
        if (wasmMemberLoads.length > 0) {
          modelerLogger.log(
            `[Analysis] First member load:`,
            JSON.stringify(wasmMemberLoads[0]),
          );
        }
        if (wasmPointLoads.length > 0) {
          modelerLogger.log(
            `[Analysis] First point load:`,
            JSON.stringify(wasmPointLoads[0]),
          );
        }

        // Use Rust WASM solver (client-side) for frame analysis
        try {
          setAnalysisStage("solving");
          setAnalysisProgress(50);

          modelerLogger.log(
            "[Analysis] Using Rust WASM solver - client-side computation",
          );
          const { analyzeStructure, initSolver } =
            await import("../services/wasmSolverService");

          // Initialize WASM module
          await initSolver();

          // Detect 2D structure (all nodes coplanar in XY plane)
          // For 2D, auto-constrain out-of-plane DOFs (fz, mx, my) at ALL nodes
          // to prevent singular stiffness matrix in the 3D solver
          const allZValues = nodesArray.map((n) => n.z ?? 0);
          const zRange = Math.max(...allZValues) - Math.min(...allZValues);
          const is2DPlanar = zRange < 0.001; // 1mm tolerance

          if (is2DPlanar) {
            modelerLogger.log(
              "[Analysis] 2D planar structure detected — constraining out-of-plane DOFs",
            );
          }

          // Convert nodes to WASM format with full 6 DOF restraints for 3D analysis
          // DOF order: [Fx, Fy, Fz, Mx, My, Mz] = [dx, dy, dz, rx, ry, rz]
          const wasmNodes = nodesArray.map((n) => ({
            id: n.id, // Pass string ID directly — Rust accepts string or number
            x: n.x,
            y: n.y,
            z: n.z ?? 0, // Include Z coordinate for 3D
            // Use full 6 DOF restraints array (Rust deserializer accepts this format)
            restraints: [
              n.restraints?.fx || false, // Translation X
              n.restraints?.fy || false, // Translation Y
              is2DPlanar ? true : n.restraints?.fz || false, // Translation Z (auto-restrained for 2D)
              is2DPlanar ? true : n.restraints?.mx || false, // Rotation X (auto-restrained for 2D)
              is2DPlanar ? true : n.restraints?.my || false, // Rotation Y (auto-restrained for 2D)
              n.restraints?.mz || false, // Rotation Z
            ],
          }));

          // Convert members to WASM format with full 3D section properties
          // CRITICAL: Store uses kN/m² for E, but WASM expects Pa (N/m²)
          // Multiply E and G by 1000 to convert kN/m² → Pa
          const wasmElements = membersArray.map((m) => {
            // Convert releases from store format to Rust [bool;6] arrays
            const rel = m.releases;
            const releases_i = rel
              ? [
                  rel.fxStart || false,
                  rel.fyStart || false,
                  rel.fzStart || false,
                  rel.mxStart || false,
                  rel.myStart || false,
                  rel.mzStart || rel.startMoment || false,
                ]
              : [false, false, false, false, false, false];
            const releases_j = rel
              ? [
                  rel.fxEnd || false,
                  rel.fyEnd || false,
                  rel.fzEnd || false,
                  rel.mxEnd || false,
                  rel.myEnd || false,
                  rel.mzEnd || rel.endMoment || false,
                ]
              : [false, false, false, false, false, false];
            return {
              id: m.id,
              node_i: m.startNodeId,
              node_j: m.endNodeId,
              E: (m.E || 200e6) * 1000, // kN/m² → Pa
              G: (m.G || 76.9e6) * 1000, // kN/m² → Pa
              A: m.A || 0.01, // m²
              Iy: m.Iy || 1e-4, // m⁴
              Iz: m.Iz || 1e-4, // m⁴
              J: m.J || 2e-4, // m⁴
              beta: ((m.betaAngle || 0) * Math.PI) / 180, // degrees → radians
              releases_i,
              releases_j,
            };
          });

          // Run WASM analysis WITH LOADS
          modelerLogger.log(
            `[Analysis] Calling WASM solver with ${wasmNodes.length} nodes, ${wasmElements.length} members`,
          );
          const wasmResult = await analyzeStructure(
            wasmNodes,
            wasmElements,
            wasmPointLoads,
            wasmMemberLoads,
          );

          if (!wasmResult.success) {
            throw new Error(wasmResult.error || "WASM analysis failed");
          }

          modelerLogger.log("[Analysis] WASM Result received");

          // ──── Diagnostic: dump raw WASM result structure ────
          {
            const mfRaw = wasmResult.member_forces;
            const mfType = mfRaw instanceof Map ? "Map" : typeof mfRaw;
            const mfKeys =
              mfRaw instanceof Map
                ? Array.from(mfRaw.keys()).slice(0, 3)
                : mfRaw
                  ? Object.keys(mfRaw).slice(0, 3)
                  : [];
            modelerLogger.log(
              `[Analysis][Debug] member_forces type=${mfType}, keys(first 3)=${JSON.stringify(mfKeys)}`,
            );
            if (mfKeys.length > 0) {
              const firstKey = mfKeys[0];
              const firstVal =
                mfRaw instanceof Map
                  ? mfRaw.get(firstKey)
                  : mfRaw?.[firstKey as any];
              modelerLogger.log(
                `[Analysis][Debug] First member force entry:`,
                JSON.stringify(firstVal, (_, v) =>
                  ArrayBuffer.isView(v) ? Array.from(v as any) : v,
                ),
              );
            }
          }

          // Convert WASM result to expected format
          // WASM 3D solver returns HashMaps serialized by serde-wasm-bindgen v0.6
          // as JS Map objects (not plain Objects), so we need to handle both types.
          const mapEntries = (obj: any): [string, any][] => {
            if (!obj) return [];
            if (obj instanceof Map) return Array.from(obj.entries());
            if (typeof obj === "object") return Object.entries(obj);
            return [];
          };

          // Parse displacements - 6 DOF for 3D analysis
          const nodesDict: Record<string, any> = {};
          const displacements = wasmResult.displacements;
          for (const [nodeId, disp] of mapEntries(displacements)) {
            const dispArray = disp as number[];
            // 3D solver always returns 6 DOF: [dx, dy, dz, rx, ry, rz]
            nodesDict[nodeId] = {
              nodeId,
              DX: dispArray[0] ?? 0, // Already in meters from Rust
              DY: dispArray[1] ?? 0,
              DZ: dispArray[2] ?? 0,
              RX: dispArray[3] ?? 0, // Rotation about X in radians
              RY: dispArray[4] ?? 0, // Rotation about Y in radians
              RZ: dispArray[5] ?? 0, // Rotation about Z in radians
            };
          }
          modelerLogger.log(
            `[Analysis] Parsed ${Object.keys(nodesDict).length} displacements`,
          );

          // Parse reactions - 6 DOF for 3D analysis
          const reactionsDict: Record<string, number[]> = {};
          const reactions = wasmResult.reactions;
          for (const [nodeId, rxn] of mapEntries(reactions)) {
            const rxnArray = rxn as number[];
            // 3D solver always returns 6 DOF: [Fx, Fy, Fz, Mx, My, Mz]
            reactionsDict[nodeId] = [
              (rxnArray[0] ?? 0) / 1000, // Fx: Convert N to kN
              (rxnArray[1] ?? 0) / 1000, // Fy
              (rxnArray[2] ?? 0) / 1000, // Fz
              (rxnArray[3] ?? 0) / 1000, // Mx: Convert N·m to kN·m
              (rxnArray[4] ?? 0) / 1000, // My
              (rxnArray[5] ?? 0) / 1000, // Mz
            ];
          }
          modelerLogger.log(
            `[Analysis] Parsed ${Object.keys(reactionsDict).length} reactions`,
          );

          // Parse member forces - 3D MemberForces with full 6 DOF at each end
          // ─── FEF correction for point/moment loads pre-converted to nodal ───
          // The WASM solver only subtracts FEF for distributed loads.
          // Point and moment loads were converted to equivalent nodal loads
          // (lines above), so their FEF is missing from f_total = k*u - FEF.
          // Compute the missing FEF per member and subtract it during parsing.
          const { computePointMomentFEF } = await import("../utils/memberLoadFEF");
          const memberFEFMap = new Map<string, { forces_i: number[]; forces_j: number[] }>();
          for (const mpl of memberPointLoads) {
            const mInfo = membersArray.find((m) => m.id === mpl.memberId);
            if (!mInfo) continue;
            const nd1 = nodesArray.find((n) => n.id === mInfo.startNodeId);
            const nd2 = nodesArray.find((n) => n.id === mInfo.endNodeId);
            if (!nd1 || !nd2) continue;
            const ddx = nd2.x - nd1.x, ddy = nd2.y - nd1.y;
            const ddz = (nd2.z ?? 0) - (nd1.z ?? 0);
            const mL = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
            if (mL < 1e-12) continue;
            const aRaw = mpl.a ?? 0.5;
            const aVal = aRaw <= 1.0 ? aRaw * mL : aRaw;
            let val = 0;
            if (mpl.type === "point" && mpl.P) val = mpl.P * 1000; // kN→N
            else if (mpl.type === "moment" && mpl.M) val = mpl.M * 1000; // kN·m→N·m
            if (Math.abs(val) < 1e-12) continue;
            const beta = ((mInfo.betaAngle || 0) * Math.PI) / 180;
            const fef = computePointMomentFEF(
              [{ type: mpl.type as 'point' | 'moment', value: val, a: aVal, direction: mpl.direction || "global_y" }],
              { x: nd1.x, y: nd1.y, z: nd1.z ?? 0 },
              { x: nd2.x, y: nd2.y, z: nd2.z ?? 0 },
              beta,
            );
            const existing = memberFEFMap.get(mpl.memberId);
            if (existing) {
              for (let k = 0; k < 6; k++) {
                existing.forces_i[k] += fef.forces_i[k];
                existing.forces_j[k] += fef.forces_j[k];
              }
            } else {
              memberFEFMap.set(mpl.memberId, { forces_i: [...fef.forces_i], forces_j: [...fef.forces_j] });
            }
          }
          if (memberFEFMap.size > 0) {
            modelerLogger.log(
              `[Analysis] FEF correction: ${memberFEFMap.size} member(s) have point/moment loads requiring force recovery correction`,
            );
          }
          // ─── End FEF correction setup ───

          const membersDict: Record<string, any> = {};
          const memberForcesMap = wasmResult.member_forces;
          for (const [elemId, forces] of mapEntries(memberForcesMap)) {
            const mf = forces as {
              // 2D format (backward compatibility)
              axial?: number;
              shear_start?: number;
              moment_start?: number;
              shear_end?: number;
              moment_end?: number;
              // 3D format (full Rust MemberForces struct)
              forces_i?: number[]; // [Fx, Fy, Fz, Mx, My, Mz]
              forces_j?: number[]; // [Fx, Fy, Fz, Mx, My, Mz]
              max_shear_y?: number;
              max_shear_z?: number;
              max_moment_y?: number;
              max_moment_z?: number;
              max_axial?: number;
              max_torsion?: number;
            };

            // Helper: generate SFD/BMD/deflection diagram arrays from TOTAL member end forces
            // The Rust solver returns f = k_local * T * u + FEF (total forces including all load effects).
            // We reconstruct the internal force variation using equilibrium:
            //   V_i + V_j = w*L  →  w = (V_i + V_j) / L  (equivalent distributed load intensity)
            //   V(x) = V_i - w*x
            //   M_internal(x) = -M_i + V_i*x - w*x²/2
            //   (Note: FEM returns Mz_i as nodal applied moment [CCW+], but internal
            //    bending moment convention [sagging+] requires negation of the end moment)
            // This is EXACT for any combination of UDL/UVL/point loads and is self-consistent
            // with the solver output. No need to re-read store loads (which would double-count).
            const genDiagram = (
              axF: number, // Axial force at node i (kN)
              v1: number, // Shear Y at node i (kN)
              m1: number, // Moment Z at node i (kN·m)
              v2: number, // Shear Y at node j (kN) — sign per beam convention
              m2: number, // Moment Z at node j (kN·m)
              memberElemId: string,
              // Z-direction forces for 3D (optional)
              vz1 = 0, // Shear Z at node i (kN)
              my1 = 0, // Moment Y at node i (kN·m)
              vz2 = 0, // Shear Z at node j (kN)
              my2 = 0, // Moment Y at node j (kN·m)
            ) => {
              const mInfo = membersArray.find((m) => m.id === memberElemId);
              if (!mInfo) return undefined;
              const nd1 = nodesArray.find((n) => n.id === mInfo.startNodeId);
              const nd2 = nodesArray.find((n) => n.id === mInfo.endNodeId);
              if (!nd1 || !nd2) return undefined;
              const ddx = nd2.x - nd1.x,
                ddy = nd2.y - nd1.y;
              const ddz = (nd2.z ?? 0) - (nd1.z ?? 0);
              const L = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) || 1;
              const EIz = (mInfo.E || 200e6) * (mInfo.I || mInfo.Iz || 1e-4);
              const EIy = (mInfo.E || 200e6) * (mInfo.Iy || mInfo.I || 1e-4);

              // Back-calculate equivalent distributed loads from equilibrium
              const wy = (v1 + v2) / L; // Y-direction UDL (kN/m)
              const wz = (vz1 + vz2) / L; // Z-direction UDL (kN/m)

              const ST = 51;
              const xv: number[] = [],
                sy: number[] = [],
                sz: number[] = [],
                mzArr: number[] = [],
                myArr: number[] = [];
              const ax: number[] = [],
                dy: number[] = [],
                dz: number[] = [];

              for (let s = 0; s < ST; s++) {
                const x = (s / (ST - 1)) * L;
                xv.push(x);
                ax.push(axF);

                // Shear Y: V(x) = V1 - wy·x
                sy.push(v1 - wy * x);

                // Moment about Z (primary BMD): Mz_internal(x) = -M1 + V1·x - wy·x²/2
                mzArr.push(-m1 + v1 * x - (wy * x * x) / 2);

                // Shear Z: Vz(x) = Vz1 - wz·x
                sz.push(vz1 - wz * x);

                // Moment about Y (weak-axis BMD): My_internal(x) = My1 + Vz1·x - wz·x²/2
                myArr.push(my1 + vz1 * x - (wz * x * x) / 2);
              }

              // ─── Compute local axes & solver displacements for deflection BCs ───
              // The old code always forced y(L)=0 (simply-supported assumption).
              // This is WRONG for cantilevers where the free end has non-zero deflection.
              // Fix: use actual solver displacements at end nodes as boundary conditions.
              const cx_m = ddx / L, cy_m = ddy / L, cz_m = ddz / L;
              // Local y-axis (perpendicular to member in primary bending plane)
              let ly_x = -cy_m, ly_y = cx_m, ly_z = 0.0; // 2D default
              if (Math.abs(cz_m) > 0.001) {
                // 3D member: compute via cross product with reference vector
                const isVert = Math.abs(cx_m) < 0.01 && Math.abs(cz_m) < 0.01;
                const refx = isVert ? 1 : 0, refy = isVert ? 0 : 1;
                let zx = cy_m * 0 - cz_m * refy;
                let zy = cz_m * refx - cx_m * 0;
                let zzc = cx_m * refy - cy_m * refx;
                const zLen = Math.sqrt(zx * zx + zy * zy + zzc * zzc) || 1;
                zx /= zLen; zy /= zLen; zzc /= zLen;
                ly_x = zy * cz_m - zzc * cy_m;
                ly_y = zzc * cx_m - zx * cz_m;
                ly_z = zx * cy_m - zy * cx_m;
              }
              // Local z-axis = localX × localY
              const lz_x = cy_m * ly_z - cz_m * ly_y;
              const lz_y = cz_m * ly_x - cx_m * ly_z;
              const lz_z = cx_m * ly_y - cy_m * ly_x;

              // Retrieve actual solver displacements at end nodes (meters)
              const disp_nd_i = nodesDict[mInfo.startNodeId];
              const disp_nd_j = nodesDict[mInfo.endNodeId];
              // Local y displacement at each end (dot product with local y-axis)
              const dy_i_loc = disp_nd_i
                ? (ly_x * (disp_nd_i.DX ?? 0) + ly_y * (disp_nd_i.DY ?? 0) + ly_z * (disp_nd_i.DZ ?? 0))
                : 0;
              const dy_j_loc = disp_nd_j
                ? (ly_x * (disp_nd_j.DX ?? 0) + ly_y * (disp_nd_j.DY ?? 0) + ly_z * (disp_nd_j.DZ ?? 0))
                : 0;
              // Local z displacement at each end
              const dz_i_loc = disp_nd_i
                ? (lz_x * (disp_nd_i.DX ?? 0) + lz_y * (disp_nd_i.DY ?? 0) + lz_z * (disp_nd_i.DZ ?? 0))
                : 0;
              const dz_j_loc = disp_nd_j
                ? (lz_x * (disp_nd_j.DX ?? 0) + lz_y * (disp_nd_j.DY ?? 0) + lz_z * (disp_nd_j.DZ ?? 0))
                : 0;

              // Deflection Y via double integration of Mz(x)/EIz
              // BCs from actual solver: EI·y(x) = ∫∫M dx² + C1·x + C2
              //   y(0) = dy_i → C2 = dy_i · EI
              //   y(L) = dy_j → C1 = (dy_j · EI − defl(L) − C2) / L
              if (EIz > 0) {
                const dx = L / (ST - 1);
                const slopeY: number[] = [0];
                for (let s = 1; s < ST; s++) {
                  const dArea = ((mzArr[s - 1] + mzArr[s]) / 2) * dx;
                  slopeY.push(slopeY[s - 1] + dArea);
                }
                const deflY: number[] = [0];
                for (let s = 1; s < ST; s++) {
                  const dArea = ((slopeY[s - 1] + slopeY[s]) / 2) * dx;
                  deflY.push(deflY[s - 1] + dArea);
                }
                const C2_y = dy_i_loc * EIz;
                const yL = deflY[ST - 1];
                const C1_y = L > 1e-12 ? (dy_j_loc * EIz - yL - C2_y) / L : 0;
                for (let s = 0; s < ST; s++) {
                  const x = (s / (ST - 1)) * L;
                  const yy = (deflY[s] + C1_y * x + C2_y) / EIz;
                  dy.push(yy * 1000); // m → mm
                }
              } else {
                for (let s = 0; s < ST; s++) dy.push(0);
              }

              // Deflection Z via double integration of My(x)/EIy
              // Same approach: use solver displacements for BCs
              if (EIy > 0) {
                const dx = L / (ST - 1);
                const slopeZ: number[] = [0];
                for (let s = 1; s < ST; s++) {
                  const dArea = ((myArr[s - 1] + myArr[s]) / 2) * dx;
                  slopeZ.push(slopeZ[s - 1] + dArea);
                }
                const deflZ: number[] = [0];
                for (let s = 1; s < ST; s++) {
                  const dArea = ((slopeZ[s - 1] + slopeZ[s]) / 2) * dx;
                  deflZ.push(deflZ[s - 1] + dArea);
                }
                const C2_z = dz_i_loc * EIy;
                const zL = deflZ[ST - 1];
                const C1_z = L > 1e-12 ? (dz_j_loc * EIy - zL - C2_z) / L : 0;
                for (let s = 0; s < ST; s++) {
                  const x = (s / (ST - 1)) * L;
                  const zz = (deflZ[s] + C1_z * x + C2_z) / EIy;
                  dz.push(zz * 1000); // m → mm
                }
              } else {
                for (let s = 0; s < ST; s++) dz.push(0);
              }

              return {
                x_values: xv,
                shear_y: sy,
                shear_z: sz,
                moment_z: mzArr, // Mz — primary BMD (about Z-axis)
                moment_y: myArr, // My — weak-axis BMD (about Y-axis)
                axial: ax,
                deflection_y: dy,
                deflection_z: dz,
              };
            };

            // Handle both 2D and 3D formats
            if (mf.forces_i && mf.forces_j) {
              // 3D format: Full member end forces [Fx, Fy, Fz, Mx, My, Mz]
              // Apply FEF correction for point/moment loads (subtract in N before /1000)
              const ptFEF = memberFEFMap.get(elemId);
              const fi0 = (mf.forces_i as number[]).map((v, k) =>
                (v ?? 0) - (ptFEF ? ptFEF.forces_i[k] : 0),
              );
              const fj0 = (mf.forces_j as number[]).map((v, k) =>
                (v ?? 0) - (ptFEF ? ptFEF.forces_j[k] : 0),
              );
              const axV = fi0[0] / 1000;
              const syV = fi0[1] / 1000;
              const szV = fi0[2] / 1000;
              const txV = fi0[3] / 1000;
              const myV = fi0[4] / 1000;
              const mzV = fi0[5] / 1000;
              const syE = fj0[1] / 1000;
              const szE = fj0[2] / 1000;
              const myE = fj0[4] / 1000;
              const mzE = fj0[5] / 1000;

              // Diagnostic: Log member end forces to help debug zero-BMD issues
              if (Object.keys(membersDict).length === 0) {
                modelerLogger.log(
                  `[Analysis][Diag] First member ${elemId}: Vy_i=${syV.toFixed(3)} kN, Mz_i=${mzV.toFixed(3)} kN·m, Vy_j=${syE.toFixed(3)} kN, Mz_j=${mzE.toFixed(3)} kN·m`,
                );
              }
              const maxSY =
                mf.max_shear_y != null
                  ? mf.max_shear_y / 1000
                  : Math.max(Math.abs(syV), Math.abs(syE));
              const maxSZ = (mf.max_shear_z ?? 0) / 1000;
              const maxMY = (mf.max_moment_y ?? 0) / 1000;
              const maxMZ =
                mf.max_moment_z != null
                  ? mf.max_moment_z / 1000
                  : Math.max(Math.abs(mzV), Math.abs(mzE));
              const diag3D = genDiagram(axV, syV, mzV, syE, mzE, elemId, szV, myV, szE, myE);

              // Diagnostic: Log first member's BMD sample values
              if (Object.keys(membersDict).length === 0 && diag3D) {
                const mz = diag3D.moment_z;
                const dfy = diag3D.deflection_y;
                modelerLogger.log(
                  `[Analysis][Diag] BMD for ${elemId}: M(0)=${mz[0]?.toFixed(3)}, M(mid)=${mz[Math.floor(mz.length / 2)]?.toFixed(3)}, M(end)=${mz[mz.length - 1]?.toFixed(3)} kN·m`,
                );
                modelerLogger.log(
                  `[Analysis][Diag] Deflection for ${elemId}: dy(0)=${dfy[0]?.toFixed(4)}, dy(mid)=${dfy[Math.floor(dfy.length / 2)]?.toFixed(4)}, dy(end)=${dfy[dfy.length - 1]?.toFixed(4)} mm`,
                );
              } else if (Object.keys(membersDict).length === 0 && !diag3D) {
                modelerLogger.warn(
                  `[Analysis][Diag] genDiagram returned undefined for ${elemId} — member/node lookup failed`,
                );
              }
              membersDict[elemId] = {
                memberId: elemId,
                axial: diag3D?.axial || [axV],
                shearY: syV,
                shearZ: szV,
                torsion: txV,
                momentY: myV,
                momentZ: mzV,
                shearStart: syV,
                shearEnd: syE,
                momentStart: mzV,
                momentEnd: mzE,
                // snake_case max values (needed by generic parser)
                max_shear_y: maxSY,
                max_shear_z: maxSZ,
                max_moment_y: maxMY,
                max_moment_z: maxMZ,
                // diagram arrays
                x_values: diag3D?.x_values,
                shear_y: diag3D?.shear_y,
                shear_z: diag3D?.shear_z || [],
                moment_y: diag3D?.moment_y || [], // My (about Y-axis, weak-axis BMD)
                moment_z: diag3D?.moment_z, // Mz (about Z-axis, primary BMD)
                torsion_arr: [] as number[],
                deflection_y: diag3D?.deflection_y,
                deflection_z: diag3D?.deflection_z || [],
              };
            } else {
              // 2D format: map from Rust field names + generate diagram data
              const axF = (mf.axial ?? 0) / 1000;
              const v1 = (mf.shear_start ?? 0) / 1000;
              const v2 = (mf.shear_end ?? 0) / 1000;
              const m1 = (mf.moment_start ?? 0) / 1000;
              const m2 = (mf.moment_end ?? 0) / 1000;
              const diag2D = genDiagram(axF, v1, m1, v2, m2, elemId);
              membersDict[elemId] = {
                memberId: elemId,
                axial: diag2D?.axial || [axF],
                // snake_case max values (needed by generic parser)
                max_shear_y: Math.max(Math.abs(v1), Math.abs(v2)),
                max_shear_z: 0,
                max_moment_y: 0,
                max_moment_z: Math.max(Math.abs(m1), Math.abs(m2)),
                // diagram arrays
                x_values: diag2D?.x_values,
                shear_y: diag2D?.shear_y,
                shear_z: diag2D?.shear_z || [],
                moment_y: diag2D?.moment_y || [], // My (zeros for 2D)
                moment_z: diag2D?.moment_z, // Mz (primary BMD)
                torsion: [] as number[],
                deflection_y: diag2D?.deflection_y,
                deflection_z: [] as number[],
                // preserve start/end values
                shearStart: v1,
                shearEnd: v2,
                momentStart: m1,
                momentEnd: m2,
              };
            }
          }
          modelerLogger.log(
            `[Analysis] Parsed ${Object.keys(membersDict).length} member forces`,
          );

          const pythonResult = {
            success: true,
            metadata: {
              solver: "Rust WASM",
              computation_time: wasmResult.stats?.solveTimeMs
                ? `${wasmResult.stats.solveTimeMs.toFixed(2)}ms`
                : "< 1ms",
            },
          };

          // Extract equilibrium check from WASM result (industry-standard verification)
          const equilibriumCheck = wasmResult.equilibrium_check
            ? wasmResult.equilibrium_check instanceof Map
              ? Object.fromEntries(wasmResult.equilibrium_check)
              : wasmResult.equilibrium_check
            : undefined;
          const conditionNumber = wasmResult.condition_number ?? undefined;

          if (equilibriumCheck) {
            modelerLogger.log(
              `[Analysis] Equilibrium check: ${equilibriumCheck.pass ? "PASS" : "FAIL"} (error: ${equilibriumCheck.error_percent?.toFixed(6)}%)`,
            );
          }
          if (conditionNumber && conditionNumber > 1e10) {
            modelerLogger.warn(
              `[Analysis] Warning: High condition number (${conditionNumber.toExponential(2)}) — results may have reduced accuracy`,
            );
          }

          if (pythonResult.success) {
            result = {
              success: true,
              displacements: nodesDict,
              reactions: reactionsDict,
              memberForces: membersDict,
              equilibriumCheck,
              conditionNumber,
              stats: {
                ...pythonResult.metadata,
                usedPythonApi: false,
                solver: "Rust WASM",
              },
            };

            modelerLogger.log("[Analysis] Complete:", {
              displacements: Object.keys(nodesDict).length,
              reactions: Object.keys(reactionsDict).length,
              memberForces: Object.keys(membersDict).length,
            });
          } else {
            result = { success: false, error: "WASM analysis failed" };
          }
        } catch (err) {
          // WASM failed — try EnhancedAnalysisEngine first, then Worker fallback
          modelerLogger.warn(
            "[Analysis] WASM solver failed, trying EnhancedAnalysisEngine:",
            err,
          );
          setAnalysisStage("assembling");
          setAnalysisProgress(35);

          try {
            const { analyzeWithEnhancedEngine } = await import(
              "../core/engineAdapter"
            );

            const engineResult = await analyzeWithEnhancedEngine(
              nodesArray,
              membersArray,
              loads,
              memberLoads,
              (stage, progress) => {
                setAnalysisStage(stage as AnalysisStage);
                setAnalysisProgress(progress);
              },
            );

            if (engineResult.success) {
              result = engineResult as typeof result;
              modelerLogger.log(
                "[Analysis] EnhancedAnalysisEngine succeeded",
              );
            } else {
              throw new Error(
                engineResult.error ?? "EnhancedAnalysisEngine failed",
              );
            }
          } catch (engineErr) {
            // Enhanced engine also failed — fall back to TS Worker
            modelerLogger.warn(
              "[Analysis] EnhancedAnalysisEngine failed, falling back to TypeScript Worker:",
              engineErr,
            );

          try {
            const { convertMemberLoadsToNodal, mergeNodalLoads } =
              await import("../utils/loadConversion");

            // Convert member loads (UDL/UVL) to equivalent nodal loads
            const conversionResult = convertMemberLoadsToNodal(
              memberLoads.map((ml) => ({
                id: ml.id,
                memberId: ml.memberId,
                type: ml.type,
                w1: ml.w1 ?? 0,
                w2: ml.w2 ?? 0,
                direction: ml.direction,
                startPos: ml.startPos ?? 0,
                endPos: ml.endPos ?? 1,
              })),
              membersArray.map((m) => ({
                id: m.id,
                startNodeId: m.startNodeId,
                endNodeId: m.endNodeId,
                E: m.E,
                A: m.A,
                I: m.I,
              })),
              nodesArray.map((n) => ({
                id: n.id,
                x: n.x,
                y: n.y,
                z: n.z,
              })),
            );

            // Merge with existing nodal loads (include moment loads)
            const existingLoads = loads.map((l) => ({
              nodeId: l.nodeId,
              fx: l.fx,
              fy: l.fy,
              fz: l.fz,
              mx: l.mx,
              my: l.my,
              mz: l.mz,
            }));
            const allLoads = mergeNodalLoads([
              ...existingLoads,
              ...conversionResult.nodalLoads,
            ]);

            modelerLogger.log(
              `[Analysis] Converted ${memberLoads.length} member loads → ${allLoads.length} nodal loads, using TS solver`,
            );

            const modelData = {
              nodes: nodesArray,
              members: membersArray,
              loads: allLoads,
              memberLoads: [] as any[],
              settings: { selfWeight: modelSettings?.selfWeight ?? false },
              // dofPerNode omitted — AnalysisService auto-detects 2D/3D
            };

            const token = await getToken();
            const { analysisService } = await getAnalysisService();
            result = await analysisService.analyze(
              modelData,
              (stage, progress) => {
                setAnalysisStage(stage as AnalysisStage);
                setAnalysisProgress(progress);
              },
              token,
            );

            if (result.success && result.stats) {
              result.stats = {
                ...result.stats,
                solver: "TypeScript (WASM fallback)",
                usedPythonApi: false,
              };
            }
          } catch (fallbackErr) {
            modelerLogger.error(
              "[Analysis] TypeScript fallback also failed:",
              fallbackErr,
            );
            result = {
              success: false,
              error: `WASM solver: ${err instanceof Error ? err.message : String(err)}\nEnhancedEngine: ${engineErr instanceof Error ? engineErr.message : String(engineErr)}\nWorker fallback: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`,
            };
          }
          } // close catch(engineErr)
        }
      }

      const endTime = Date.now();

      if (result.success) {
        // Convert results to store format
        const displacements = new Map<
          string,
          {
            dx: number;
            dy: number;
            dz: number;
            rx: number;
            ry: number;
            rz: number;
          }
        >();
        const reactions = new Map<
          string,
          {
            fx: number;
            fy: number;
            fz: number;
            mx: number;
            my: number;
            mz: number;
          }
        >();
        const memberForces = new Map<
          string,
          {
            axial: number;
            shearY: number;
            shearZ: number;
            momentY: number;
            momentZ: number;
            torsion: number;
            diagramData?: {
              x_values: number[];
              shear_y: number[];
              shear_z: number[];
              moment_y: number[];
              moment_z: number[];
              axial: number[];
              torsion: number[];
              deflection_y: number[];
              deflection_z: number[];
            };
          }
        >();

        // Parse displacements - handle both PyNite object format and array format
        if (result.displacements) {
          Object.entries(result.displacements).forEach(([nodeId, disp]) => {
            // PyNite returns {displacement: {dx, dy, dz, rx, ry, rz}}, simple solver returns [dx, dy, dz, rx, ry, rz]
            if (Array.isArray(disp)) {
              displacements.set(nodeId, {
                dx: disp[0] ?? 0,
                dy: disp[1] ?? 0,
                dz: disp[2] ?? 0,
                rx: disp[3] ?? 0,
                ry: disp[4] ?? 0,
                rz: disp[5] ?? 0,
              });
            } else if (typeof disp === "object" && disp !== null) {
              const d = disp as Record<string, any>;
              // Check if it has nested displacement object (PyNite format) or direct values
              const displacement = d.displacement ?? d;
              displacements.set(nodeId, {
                dx: displacement.dx ?? displacement.DX ?? 0,
                dy: displacement.dy ?? displacement.DY ?? 0,
                dz: displacement.dz ?? displacement.DZ ?? 0,
                rx: displacement.rx ?? displacement.RX ?? 0,
                ry: displacement.ry ?? displacement.RY ?? 0,
                rz: displacement.rz ?? displacement.RZ ?? 0,
              });
            }
          });
        }

        // Parse reactions
        if (result.reactions) {
          Object.entries(result.reactions).forEach(([nodeId, react]) => {
            const r = react as number[];
            reactions.set(nodeId, {
              fx: r[0] ?? 0,
              fy: r[1] ?? 0,
              fz: r[2] ?? 0,
              mx: r[3] ?? 0,
              my: r[4] ?? 0,
              mz: r[5] ?? 0,
            });
          });
        }

        // Parse member forces - extract from rich PyNite data including diagram arrays
        if (result.memberForces) {
          Object.entries(result.memberForces).forEach(([memberId, forces]) => {
            const f = forces as {
              axial?: number | number[];
              shear_y?: number[];
              shear_z?: number[];
              moment_y?: number[];
              moment_z?: number[];
              torsion?: number[] | number;
              x_values?: number[];
              deflection_y?: number[];
              deflection_z?: number[];
              max_shear_y?: number;
              max_shear_z?: number;
              max_moment_y?: number;
              max_moment_z?: number;
              // WASM format fields (camelCase / scalar)
              shearY?: number;
              shearZ?: number;
              momentY?: number;
              momentZ?: number;
              shearStart?: number;
              shearEnd?: number;
              momentStart?: number;
              momentEnd?: number;
              torsion_arr?: number[];
            };

            // Handle both array (PyNite) and scalar (simple solver) formats
            const getMaxAbs = (arr: number[] | undefined): number => {
              if (!arr || arr.length === 0) return 0;
              return Math.max(
                Math.abs(Math.min(...arr)),
                Math.abs(Math.max(...arr)),
              );
            };

            // Use max values if available, otherwise calculate from arrays, then fall back to WASM scalars
            const axialVal =
              f.max_shear_y !== undefined
                ? Array.isArray(f.axial)
                  ? getMaxAbs(f.axial)
                  : (f.axial ?? 0)
                : typeof f.axial === "number"
                  ? f.axial
                  : getMaxAbs(f.axial as number[] | undefined);
            const shearY =
              f.max_shear_y ??
              (typeof f.shearY === "number"
                ? Math.abs(f.shearY)
                : getMaxAbs(f.shear_y));
            const shearZ =
              f.max_shear_z ??
              (typeof f.shearZ === "number"
                ? Math.abs(f.shearZ)
                : getMaxAbs(f.shear_z));
            const momentY =
              f.max_moment_y ??
              (typeof f.momentY === "number"
                ? Math.abs(f.momentY)
                : getMaxAbs(f.moment_y));
            const momentZ =
              f.max_moment_z ??
              (typeof f.momentZ === "number"
                ? Math.abs(f.momentZ)
                : getMaxAbs(f.moment_z));
            const torsionVal =
              typeof f.torsion === "number"
                ? Math.abs(f.torsion)
                : getMaxAbs(f.torsion as number[] | undefined);

            // Store diagram data arrays if available (from PyNite or WASM-generated)
            const diagramData =
              f.x_values && f.shear_y
                ? {
                    x_values: f.x_values,
                    shear_y: f.shear_y,
                    shear_z: f.shear_z || [],
                    moment_y: f.moment_y || [],
                    moment_z: f.moment_z || [],
                    axial: Array.isArray(f.axial) ? f.axial : [],
                    torsion:
                      f.torsion_arr ||
                      (Array.isArray(f.torsion) ? f.torsion : []),
                    deflection_y: f.deflection_y || [],
                    deflection_z: f.deflection_z || [],
                  }
                : undefined;

            memberForces.set(memberId, {
              axial: axialVal as number,
              shearY,
              shearZ,
              momentY,
              momentZ,
              torsion: torsionVal,
              // Include start/end forces if available
              ...(f.shearStart !== undefined
                ? {
                    startForces: {
                      axial: axialVal as number,
                      shearY: f.shearStart ?? shearY,
                      momentZ: f.momentStart ?? momentZ,
                    },
                    endForces: {
                      axial: -(axialVal as number),
                      shearY: f.shearEnd ?? shearY,
                      momentZ: f.momentEnd ?? momentZ,
                    },
                  }
                : {}),
              diagramData,
            });

            // Diagnostic: log first member's diagramData shape
            if (memberForces.size === 1) {
              const dd = diagramData;
              if (dd) {
                const mzSample = dd.moment_z;
                modelerLogger.log(
                  `[Analysis][Store] First member ${memberId}: diagramData present, moment_z.length=${mzSample?.length}, moment_z[0]=${mzSample?.[0]?.toFixed?.(4)}, moment_z[mid]=${mzSample?.[Math.floor((mzSample?.length || 0) / 2)]?.toFixed?.(4)}`,
                );
              } else {
                modelerLogger.warn(
                  `[Analysis][Store] First member ${memberId}: diagramData=undefined! x_values=${!!f.x_values}, shear_y=${!!f.shear_y}`,
                );
              }
            }
          });
        }

        setAnalysisResults({
          displacements,
          reactions,
          memberForces,
          equilibriumCheck: result.equilibriumCheck,
          conditionNumber: result.conditionNumber,
          completed: true,
          timestamp: Date.now(),
        } as any);

        setAnalysisStage("complete");
        setAnalysisProgress(100);
        setAnalysisStats({
          nodes: nodes.size,
          members: members.size,
          dof: result.stats?.totalDof ?? nodes.size * 3,
          timeMs: endTime - startTime,
        });
        // Show results toolbar after successful analysis
        setShowResultsToolbar(true);
        showNotification("success", "Analysis completed successfully!");

        // Calculate stresses automatically after successful analysis
        calculateStresses(memberForces, members);
        // setActiveStep(4); // Move to results step
      } else {
        setAnalysisStage("error");
        setAnalysisError(result.error || "Analysis failed");
        // showNotification('error', `Analysis failed: ${result.error}`);

        // Trigger AI diagnosis for the error automatically
        // We use a custom event or store update to notify the AI assistant
        const event = new CustomEvent("ai-diagnose-error", {
          detail: { error: result.error || "Unknown analysis error" },
        });
        window.dispatchEvent(event);

        // Open AI assistant via modal system
        openModal("aiAssistant" as any);
        showNotification(
          "error",
          "Analysis failed. AI Architect is analyzing the issue...",
        );
      }
    } catch (err) {
      setAnalysisStage("error");
      setAnalysisError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsAnalyzingLocal(false);
      setIsAnalyzing(false);
    }
  }, [nodes, members, loads, memberLoads, setAnalysisResults, setIsAnalyzing]);

  // Run analysis
  const handleRunAnalysis = useCallback(async () => {
    // STEP 1: Validate structure BEFORE anything else
    const validationResult = validateStructure(nodes, members);

    if (!validationResult.valid || validationResult.errors.length > 0) {
      // Show validation dialog for actual errors — block analysis
      setStructuralValidationErrors(validationResult.errors);
      setStructuralValidationWarnings(validationResult.warnings);
      setShowValidationDialog(true);
      return;
    }

    // Warnings are informational — log them but don't block analysis
    if (validationResult.warnings.length > 0) {
      modelerLogger.log(
        `[Analysis] Proceeding with ${validationResult.warnings.length} warning(s):`,
        validationResult.warnings.map((w) => w.message).join(", "),
      );
    }

    // Run analysis directly (Clerk handles legal consent at sign-up)
    executeAnalysis();
  }, [nodes, members, executeAnalysis]);

  // Analysis Event Listeners - Listen for ribbon triggers
  useEffect(() => {
    const onAnalysis = () => handleRunAnalysis();
    const onModal = () => setShowModalAnalysis(true);
    const onExport = () => setShowExportDialog(true);

    document.addEventListener("trigger-analysis", onAnalysis);
    document.addEventListener("trigger-modal-analysis", onModal);
    document.addEventListener("trigger-export", onExport);

    return () => {
      document.removeEventListener("trigger-analysis", onAnalysis);
      document.removeEventListener("trigger-modal-analysis", onModal);
      document.removeEventListener("trigger-export", onExport);
    };
  }, [handleRunAnalysis]);

  // Close progress modal and show results
  const handleCloseProgressModal = useCallback(() => {
    setShowProgressModal(false);
    if (analysisStage === "complete") {
      setCategory("ANALYSIS");
    }
  }, [analysisStage, setCategory]);
  void handleCloseProgressModal; // referenced via event handlers

  // Workflow state
  // const [activeStep, setActiveStep] = useState(0); // Removed
  // const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Removed

  // Quick start modal
  // const [showQuickStart, setShowQuickStart] = useState(false); // Moved to top

  // Tutorial overlay deferred to Phase 2

  // Legal consent state
  // const { hasConsent } = useCheckLegalConsent(); // Moved to top
  // const [showLegalConsent, setShowLegalConsent] = useState(false); // Moved to top

  // Modal states from uiStore (for cross-component access)
  // const modals = useUIStore((s) => s.modals); // Moved to top
  // const openModal = useUIStore((s) => s.openModal); // Moved to top
  // const closeModal = useUIStore((s) => s.closeModal); // Moved to top

  // Alias modal states for cleaner code
  const _showStructureWizard = modals.structureWizard;
  void _showStructureWizard; // accessed via modals.structureWizard directly
  const showFoundationDesign = modals.foundationDesign;
  const showIS875Load = modals.is875Load;
  const showGeometryTools = modals.geometryTools;
  const showInterop = modals.interoperability;
  const showRailwayBridge = modals.railwayBridge;
  const showLoadingManager = modals.loadDialog;

  const loadStructure = useModelStore((state) => state.loadStructure);

  // UDL Load Dialog state
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [loadDialogMemberId, setLoadDialogMemberId] = useState<
    string | undefined
  >();
  const selectedIds = useModelStore((state) => state.selectedIds);

  // Split Member / Insert Node Dialog
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitMemberId, setSplitMemberId] = useState<string | null>(null);

  // Specifications Dialog State
  const [showSpecDialog, setShowSpecDialog] = useState(false);
  const [specMemberId, setSpecMemberId] = useState<string | null>(null);

  // Quick Commands Toolbar (Spacebar)
  const quickCommandActions = {
    onAddNode: () => useModelStore.getState().setTool("node"),
    onAddBeam: () => useModelStore.getState().setTool("member"),
    onAddLoad: () => openModal("loadDialog"),
    onAssignSection: () => openModal("structureWizard"),
    onAssignSupport: () => useModelStore.getState().setTool("support"),
    onRunAnalysis: handleRunAnalysis,
    onFitView: () => document.dispatchEvent(new CustomEvent("fit-view")),
    onToggleGrid: () => document.dispatchEvent(new CustomEvent("toggle-grid")),
    onSelect: () => useModelStore.getState().setTool("select"),
    onMove: () => useModelStore.getState().setTool("select"),
  };
  const { QuickCommandsToolbar } = useQuickCommands(
    getDefaultQuickCommands(quickCommandActions),
  );

  // Global Keyboard Shortcuts
  useKeyboardShortcuts();

  // Context Menu (Right-click)
  const contextMenu = useContextMenu();

  // Track previous selection to avoid reopening dialog on same member
  const previousSelectionRef = useRef<string | undefined>();

  // Watch for member selection when memberLoad tool is active
  useEffect(() => {
    if (activeTool === "memberLoad" && selectedIds.size === 1) {
      const selectedId = Array.from(selectedIds)[0];
      // Check if it's a member (not a node) and not the same as previous selection
      // Use members.has() to verify it's a member, not a node
      if (
        selectedId &&
        members.has(selectedId) &&
        selectedId !== previousSelectionRef.current
      ) {
        previousSelectionRef.current = selectedId;
        setLoadDialogMemberId(selectedId);
        setShowLoadDialog(true);
      }
    } else {
      // Reset previous selection when tool changes or selection is cleared
      previousSelectionRef.current = undefined;
    }
  }, [selectedIds, activeTool]); // Don't depend on members - it only changes when members are added/removed

  // Show quick start on first load if model is empty
  useEffect(() => {
    if (nodes.size === 0 && members.size === 0) {
      const timer = setTimeout(() => setShowQuickStart(true), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [nodes.size, members.size]);

  // URL Parameter Handling - Connect Capabilities page to dialogs
  // Note: searchParams already declared at top of component

  useEffect(() => {
    const mode = searchParams.get("mode");
    const tool = searchParams.get("tool");
    const code = searchParams.get("code");
    const panel = searchParams.get("panel");
    const exportType = searchParams.get("export");
    const type = searchParams.get("type");

    // Handle tool-specific dialogs
    if (tool === "foundation") {
      openModal("foundationDesign");
      return;
    }
    if (
      mode === "loading" ||
      tool === "wind" ||
      tool === "seismic" ||
      tool === "combinations"
    ) {
      openModal("is875Load");
      return;
    }
    if (panel === "templates" || tool === "architect") {
      openModal("structureWizard");
      return;
    }
    if (tool === "geometry" || mode === "geometry") {
      openModal("geometryTools");
      return;
    }
    if (exportType || tool === "import" || tool === "export") {
      openModal("interoperability");
      return;
    }

    // Handle analysis types - run analysis
    if (mode === "analysis" && type) {
      // Trigger analysis workflow
      setShowProgressModal(true);
      handleRunAnalysis();
    }

    // Handle AI mode
    if (mode === "ai") {
      // Would open AI Command Center
      setShowQuickStart(true);
    }

    // Handle design codes
    if (mode === "design" && code) {
      // Open design panel with specific code
      setShowQuickStart(true);
    }
  }, [searchParams, openModal, handleRunAnalysis]);

  // Handle step click
  // const handleStepClick = useCallback((step: number) => { // Removed
  //     setActiveStep(step);
  //     // Switch to appropriate category
  //     const category = STEP_TO_CATEGORY[step];
  //     if (category) {
  //         setCategory(category);
  //     }
  // }, [setCategory]);

  // Handle sync from server
  const handleServerUpdate = useCallback((update: ServerUpdate) => {
    // Sync logic - apply changes to local store
    const state = useModelStore.getState();

    switch (update.type) {
      case "node_update": {
        const nData = update.data;
        state.addNode({
          id: nData.nodeId,
          x: nData.x,
          y: nData.y,
          z: nData.z,
          restraints: nData.restraints,
        });
        break;
      }
      case "member_update": {
        const mData = update.data;
        state.addMember({
          id: mData.memberId,
          startNodeId: mData.startNodeId,
          endNodeId: mData.endNodeId,
          sectionId: mData.sectionId,
          E: mData.E,
          A: mData.A,
          I: mData.I,
        });
        break;
      }
    }
  }, []);

  // Mobile Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => setIsSidebarOpen((prev) => !prev);
    document.addEventListener("toggle-sidebar", handleToggle);
    return () => document.removeEventListener("toggle-sidebar", handleToggle);
  }, []);

  return (
    <MultiplayerProvider
      projectId={useModelStore.getState().projectInfo.cloudId || "demo-project"}
      userName={user?.firstName || "Guest"}
      onServerUpdate={handleServerUpdate}
    >
      <div className="h-screen w-screen flex flex-col bg-zinc-950 text-white overflow-hidden relative">
        <MultiplayerUI />
        {/* Top Bar - Compact Header */}
        <header className="h-9 bg-slate-950/90 backdrop-blur-sm border-b border-slate-800/60 flex items-center justify-between px-4 flex-shrink-0 select-none">
          {/* Logo Area */}
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <button
              className="md:hidden text-zinc-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded p-1 transition-colors"
              onClick={() =>
                document.dispatchEvent(new CustomEvent("toggle-sidebar"))
              }
              aria-label="Toggle sidebar navigation"
              aria-expanded={isSidebarOpen}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-lg text-blue-500">⬡</span>
              <span className="font-semibold text-sm tracking-tight text-slate-200">
                BeamLab
              </span>
              <span className="text-[9px] font-bold text-slate-500 tracking-wider">
                ULTIMATE
              </span>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-600">v24.01</span>
          </div>
        </header>

        {/* Main Application Layout (Flex Row) */}
        <div className="flex-1 flex overflow-hidden relative min-h-0">
          {/* 1. Workflow Sidebar (Left) */}
          <aside
            className={`
                        w-48 flex-shrink-0 h-full z-30 bg-slate-900/95 backdrop-blur-sm border-r border-slate-800/60
                        transition-transform duration-300 
                        absolute md:relative 
                        ${isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"}
                    `}
            role="navigation"
            aria-label="Workflow sidebar"
          >
            <WorkflowSidebar
              activeCategory={activeCategory}
              onCategoryChange={(cat) => {
                setCategory(cat);
                setIsSidebarOpen(false); // Close on selection on mobile
              }}
            />
          </aside>

          {/* 2. Main Workspace (Ribbon + Canvas) */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top Ribbon */}
            <div className="flex-shrink-0 z-10">
              <EngineeringRibbon activeCategory={activeCategory} />
            </div>

            {/* 3D Canvas Area */}
            <div
              className="flex-1 bg-zinc-950 relative min-h-0"
              onContextMenu={(e) => {
                // Determine what was clicked and show appropriate context menu
                const selectedId =
                  selectedIds.size === 1
                    ? Array.from(selectedIds)[0]
                    : undefined;
                if (selectedId && nodes.has(selectedId)) {
                  contextMenu.show(
                    e,
                    getNodeContextMenuItems(selectedId, {
                      onEdit: () => {},
                      onAddBeamFrom: () =>
                        useModelStore.getState().setTool("member"),
                      onAssignSupport: () =>
                        useModelStore.getState().setTool("support"),
                      onAssignLoad: () => openModal("loadDialog"),
                      onMerge: () => {
                        const nodeIds = Array.from(selectedIds).filter((id) =>
                          id.startsWith("N"),
                        );
                        if (nodeIds.length >= 2 && nodeIds[0] && nodeIds[1]) {
                          useModelStore
                            .getState()
                            .mergeNodes(nodeIds[0], nodeIds[1]);
                        }
                      },
                      canMerge:
                        selectedIds.size > 1 &&
                        Array.from(selectedIds).every((id) =>
                          id.startsWith("N"),
                        ),
                      onDelete: () =>
                        useModelStore.getState().removeNode(selectedId),
                    }),
                  );
                } else if (selectedId && members.has(selectedId)) {
                  contextMenu.show(
                    e,
                    getMemberContextMenuItems(selectedId, {
                      onEdit: () => {},
                      onAssignSection: () => openModal("structureWizard"),
                      onAssignMaterial: () => {},
                      onInsertNode: () => {
                        setSplitMemberId(selectedId);
                        setShowSplitDialog(true);
                      },
                      onSplit: () => {
                        const model = useModelStore.getState();
                        // Simple split at 0.5 for context menu action
                        model.splitMemberById(selectedId, 0.5);
                      },
                      onAssignLoad: () => openModal("loadDialog"),
                      onReleases: () => {
                        setSpecMemberId(selectedId);
                        setShowSpecDialog(true);
                      },
                      onSpecifications: () => {
                        setSpecMemberId(selectedId);
                        setShowSpecDialog(true);
                      },
                      onDelete: () =>
                        useModelStore.getState().removeMember(selectedId),
                    }),
                  );
                } else {
                  contextMenu.show(
                    e,
                    getEmptyContextMenuItems({
                      onAddNodeHere: () =>
                        useModelStore.getState().setTool("node"),
                      onPaste: () => {},
                      onFitView: () =>
                        document.dispatchEvent(new CustomEvent("fit-view")),
                      onToggleGrid: () =>
                        document.dispatchEvent(new CustomEvent("toggle-grid")),
                      onViewSettings: () => {},
                    }),
                  );
                }
              }}
            >
              {/* Modeling Toolbar */}
              <div className="absolute top-3 left-3 z-20">
                <ModelingToolbar />
              </div>
              <ViewportManager />

              {/* Status Bar Overlay */}
              <div className="absolute bottom-0 w-full z-10">
                <StatusBar
                  isAnalyzing={isAnalyzing}
                  onOpenDiagnostics={() => setDiagnosticsOpen(true)}
                />
              </div>
            </div>
          </div>

          {/* 3. Right Inspector Panel (Context Aware) */}
          <InspectorPanel
            collapsed={inspectorCollapsed}
            onToggle={() => setInspectorCollapsed(!inspectorCollapsed)}
          />
        </div>

        {/* Modals & Overlays */}

        {/* Integration Diagnostics Modal */}
        {diagnosticsOpen && (
          <Suspense fallback={null}>
            <IntegrationDiagnostics
              open={diagnosticsOpen}
              onClose={() => setDiagnosticsOpen(false)}
            />
          </Suspense>
        )}

        {/* Quick Commands Toolbar (Spacebar) */}
        {QuickCommandsToolbar}

        <Suspense fallback={null}>
          <ExportDialog
            isOpen={showExportDialog}
            onClose={() => setShowExportDialog(false)}
          />

          {showProgressModal && (
            <AnalysisProgressModal
              isOpen={showProgressModal}
              stage={analysisStage}
              progress={analysisProgress}
              error={analysisError}
              onClose={() => setShowProgressModal(false)}
              stats={analysisStats}
            />
          )}

          {/* Results Toolbar - Shows after successful analysis */}
          {showResultsToolbar && analysisResults && (
            <ResultsToolbar onClose={() => setShowResultsToolbar(false)} />
          )}

          {/* Tools & Dialogs */}
          <AdvancedSelectionPanel />
          <QuickStartModal
            isOpen={showQuickStart}
            onClose={() => setShowQuickStart(false)}
            onNewProject={handleNewProject}
            onOpenWizard={() => openModal("structureWizard")}
            onOpenFoundation={() => openModal("foundationDesign")}
            onOpenLoads={() => openModal("is875Load")}
          />
          {/* Project Details Dialog */}
          <ProjectDetailsDialog
            isOpen={showProjectDetails}
            onClose={() => setShowProjectDetails(false)}
            onSave={handleProjectSave}
            isNewProject={isNewProject}
          />

          {/* Global Dialogs triggered by Ribbon */}
          <StructureWizard
            isOpen={modals.structureWizard}
            onClose={() => closeModal("structureWizard")}
            onGenerate={(structure) => {
              // Convert generated structure to model format with material props
              const nodes: Node[] = structure.nodes.map((n) => ({
                id: n.id,
                x: n.x,
                y: n.y,
                z: n.z,
                restraints: n.restraints,
              }));
              const members: Member[] = structure.members.map((m) => ({
                id: m.id,
                startNodeId: m.startNodeId,
                endNodeId: m.endNodeId,
                sectionId: "ISMB300",
                E: (m as any).E,
                A: (m as any).A,
                I: (m as any).I,
              }));
              // loadStructure clears loads, so we add loads after
              loadStructure(nodes, members);

              // Add wizard-generated loads (nodal + member)
              const store = useModelStore.getState();
              if (structure.loads) {
                for (const l of structure.loads) {
                  if (l.nodeId) {
                    store.addLoad({
                      id: l.id,
                      nodeId: l.nodeId,
                      fx: l.fx ?? 0,
                      fy: l.fy ?? 0,
                      fz: l.fz ?? 0,
                    });
                  }
                }
              }
              if (structure.memberLoads) {
                for (const ml of structure.memberLoads) {
                  if (ml.memberId) {
                    store.addMemberLoad({
                      id: ml.id,
                      memberId: ml.memberId,
                      type: (ml.type as any) ?? "UDL",
                      w1: ml.w1,
                      w2: ml.w2,
                      P: ml.P,
                      a: ml.a,
                      direction: (ml.direction as any) ?? "global_y",
                    });
                  }
                }
              }
              closeModal("structureWizard");
            }}
          />

          {/* Foundation Design Dialog */}
          <FoundationDesignDialog
            isOpen={showFoundationDesign}
            onClose={() => closeModal("foundationDesign")}
          />

          {/* IS 875 Load Generator Dialog */}
          <IS875LoadDialog
            isOpen={showIS875Load}
            onClose={() => closeModal("is875Load")}
          />

          {/* Geometry Tools Panel */}
          <GeometryToolsPanel
            isOpen={showGeometryTools}
            onClose={() => closeModal("geometryTools")}
          />

          {/* Import/Export Dialog */}
          <InteroperabilityDialog
            isOpen={showInterop}
            onClose={() => closeModal("interoperability")}
          />

          {/* Railway Bridge Design Dialog */}
          <RailwayBridgeDialog
            isOpen={showRailwayBridge}
            onClose={() => closeModal("railwayBridge")}
          />

          {/* FEA Meshing Panel */}
          <MeshingPanel
            isOpen={modals.meshing}
            onClose={() => closeModal("meshing")}
          />

          {/* Plate Creation Dialog */}
          <PlateCreationDialog
            isOpen={modals.plateDialog}
            onClose={() => closeModal("plateDialog")}
          />

          {/* Floor Slab Dialog — auto-detect panels & create slabs */}
          <FloorSlabDialog
            isOpen={modals.floorSlabDialog}
            onClose={() => closeModal("floorSlabDialog")}
          />

          {/* Comprehensive Loading Manager */}
          <LoadDialog
            isOpen={showLoadingManager}
            onClose={() => closeModal("loadDialog")}
          />

          {/* Wind / Seismic / Moving Load Generators — only mount when modal is open */}
          {modals.windLoadDialog && <WindLoadDialog />}
          {modals.seismicLoadDialog && <SeismicLoadDialog />}
          {modals.movingLoadDialog && <MovingLoadDialog />}

          {/* Boundary Conditions Dialog */}
          <BoundaryConditionsDialog
            open={modals.boundaryConditionsDialog}
            onClose={() => closeModal("boundaryConditionsDialog")}
          />

          {/* Advanced Selection Toolbar */}
          <SelectionToolbar
            open={modals.selectionToolbar}
            onClose={() => closeModal("selectionToolbar")}
          />

          {/* Dead Load Generator - NEW */}
          <DeadLoadGenerator
            open={modals.deadLoadGenerator}
            onClose={() => closeModal("deadLoadGenerator")}
          />

          {/* UI Dialogs */}
          <MemberSpecificationsDialog
            isOpen={showSpecDialog}
            onClose={() => setShowSpecDialog(false)}
            memberId={specMemberId}
          />

          <LoadInputDialog
            isOpen={showLoadDialog}
            onClose={() => setShowLoadDialog(false)}
            targetMemberId={loadDialogMemberId}
            targetNodeId={
              selectedIds.size === 1 &&
              Array.from(selectedIds)[0]?.startsWith("N")
                ? Array.from(selectedIds)[0]
                : undefined
            }
          />

          {/* Split Member Dialog */}
          <SplitMemberDialog
            isOpen={showSplitDialog}
            onClose={() => setShowSplitDialog(false)}
            memberId={splitMemberId ?? undefined}
          />

          <AdvancedAnalysisDialog
            isOpen={modals.advancedAnalysis}
            onClose={() => closeModal("advancedAnalysis")}
            isPro={
              subscription?.tier === "pro" ||
              subscription?.tier === "enterprise"
            }
          />

          {/* DesignCodes Dialog */}
          <DesignCodesDialog
            isOpen={modals.designCodes}
            onClose={() => closeModal("designCodes")}
            isPro={
              subscription?.tier === "pro" ||
              subscription?.tier === "enterprise"
            }
          />

          {/* ASCE 7 Load Generators — only mount when modal is open */}
          {modals.asce7SeismicDialog && <ASCE7SeismicLoadDialog />}
          {modals.asce7WindDialog && <ASCE7WindLoadDialog />}
          {modals.loadCombinationsDialog && <LoadCombinationsDialog />}

          {/* Structural Validation Dialog - Shows errors BEFORE analysis */}
          <ValidationDialog
            isOpen={showValidationDialog}
            onClose={() => setShowValidationDialog(false)}
            errors={structuralValidationErrors}
            warnings={structuralValidationWarnings}
            onProceedAnyway={() => {
              setShowValidationDialog(false);
              // User wants to proceed despite warnings - run analysis
              setTimeout(() => executeAnalysis(), 100);
            }}
            onRevalidate={() => {
              // Re-run validation after auto-fix
              const validationResult = validateStructure(nodes, members);
              setStructuralValidationErrors(validationResult.errors);
              setStructuralValidationWarnings(validationResult.warnings);

              // If all errors fixed, close dialog and optionally run analysis
              if (
                validationResult.valid &&
                validationResult.errors.length === 0
              ) {
                setShowValidationDialog(false);
                setTimeout(() => executeAnalysis(), 200);
              }
            }}
          />

          {/* Validation Error Display */}
          {showValidationErrors && validationErrors && (
            <ValidationErrorDisplay
              results={validationErrors}
              onDismiss={() => {
                setShowValidationErrors(false);
                setValidationErrors(null);
              }}
              onAutoFix={(_issue) => {
                // Run auto-fix from model store
                const result = useModelStore.getState().autoFixModel();
                uiLogger.log("Auto-fix result:", result);

                if (result.fixed.length > 0) {
                  // Re-validate after fix
                  setValidationErrors(null);
                  setShowValidationErrors(false);
                }
              }}
            />
          )}

          {/* Stress Visualization */}
          {showStressVisualization && stressResults && (
            <StressVisualization
              results={stressResults}
              stressType={currentStressType}
              onClose={() => {
                setShowStressVisualization(false);
              }}
              onStressTypeChange={(type) => {
                setCurrentStressType(type);
                // Recalculate with new stress type
                if (analysisResults?.memberForces) {
                  calculateStresses(analysisResults.memberForces, members);
                }
              }}
            />
          )}

          {/* Modal Analysis Controls - Shows when modal results exist */}
          <ModalControls />

          {/* Modal Analysis Panel */}
          <ModalAnalysisPanel
            isOpen={showModalAnalysis}
            onClose={() => setShowModalAnalysis(false)}
          />

          {/* Cloud Project Manager */}
          <CloudProjectManager
            isOpen={showCloudManager}
            onClose={() => setShowCloudManager(false)}
            onLoad={handleCloudLoad}
          />

          {/* Unified AI Architect - Single Powerful AI Interface */}
          <AutonomousAIAgent />

          {/* Structure Gallery - Iconic Civil Engineering Structures */}
          <StructureGallery
            isOpen={modals.structureGallery}
            onClose={() => closeModal("structureGallery")}
          />
        </Suspense>

        {/* Command Palette - Quick Access (Cmd+K) */}
        <CommandPalette
          isOpen={commandPalette.isOpen}
          onClose={commandPalette.close}
        />
        {/* End of Main UI */}
      </div>
    </MultiplayerProvider>
  );
};

export default ModernModeler;
