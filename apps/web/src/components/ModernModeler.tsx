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

import React from 'react';
import {
  FC,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  Suspense,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";
import {
  Box,
  Circle,
  Wand2,
  LayoutGrid,
  Upload,
} from "lucide-react";
import { useUIStore } from "../store/uiStore";
import { useModelStore, saveProjectToStorage } from "../store/model";
import { useShallow } from 'zustand/react/shallow';
import { ViewportManager } from "./ViewportManager";
// import { Toolbar } from './Toolbar'; // Replaced by Ribbon
// ResultsTable — replaced by AnalysisResultsDashboard

// New industry-grade UI components
import { ViewControlsOverlay } from "./ui/ViewControlsOverlay";
import { KeyboardShortcutsOverlay } from "./ui/KeyboardShortcutsOverlay";

// New layout components
import { WorkflowSidebar } from "./layout/WorkflowSidebar";
import { EngineeringRibbon } from "./layout/EngineeringRibbon";

// New workflow components
// AnalysisWorkflow replaced by AnalysisProgressModal stepper
import {
  AnalysisProgressModal,
} from "./AnalysisProgressModal";
import { QuickStartModal } from "./QuickStartModal";
import { ProjectDetailsDialog } from "./ProjectDetailsDialog";
import { ResultsToolbar } from "./results/ResultsToolbar";
import { ResultsTableDock } from "./results/ResultsTableDock";
import ModalControls from "./ModalControls";
import { AutonomousAIAgent, AIArchitectPanel } from "./ai";
import { LoadInputDialog } from "./ui/LoadInputDialog";
// TutorialOverlay deferred to Phase 2
import { validateStructure } from "../utils/structuralValidation";

// ---- Lazy-loaded dialogs & panels (extracted to modeler/lazyDialogs.ts) ----
// Only import dialogs that need COMPLEX props/callbacks and cannot be in ModalPortal
import {
  StructureWizard,
  ValidationErrorDisplay, ValidationDialog, StressVisualization,
  SplitMemberDialog,
  MemberSpecificationsDialog,
  AdvancedAnalysisDialog, DesignCodesDialog, ModalAnalysisPanel, ExportDialog,
  CloudProjectManager,
  MaterialLibraryDialog,
  GenerativeDesignPanel, SeismicDesignStudio,
  IntegrationDiagnostics,
} from "./modeler/lazyDialogs";
// ModalPortal handles the remaining 41 simple dialogs with isolated subscriptions
import { ModalPortal } from "./modeler/ModalPortal";
import { useToast } from "./ui/ToastSystem";
import { ModelingToolbar } from "./toolbar/ModelingToolbar";
import type { Node, Member } from "../store/model";
import { useAuth } from "../providers/AuthProvider";
import { useSubscription } from "../hooks/useSubscription";

// Production-safe logging
import { modelerLogger, uiLogger } from "../utils/logger";

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

import { usePhonePePayment } from "./PhonePePayment";
import { useTierAccess } from "../hooks/useTierAccess";
import { ProjectService, Project } from "../services/ProjectService";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

// Multiplayer
import {
  MultiplayerProvider,
} from "./collaborators/MultiplayerContext";
import { ServerUpdate } from "../hooks/useMultiplayer";

// Extracted sub-components
import { CategorySwitcher } from "./modeler/CategorySwitcher";
import { InspectorPanel } from "./modeler/InspectorPanel";
import { StatusBar } from "./modeler/StatusBar";
import { MultiplayerUI } from "./modeler/MultiplayerUI";

// Analysis execution hook (extracted ~1,800 lines)
import { useAnalysisExecution } from "../hooks/useAnalysisExecution";

// ============================================
// MAIN MODERN MODELER COMPONENT
// ============================================

export const ModernModeler: FC = () => {
  const { getToken, userId, user } = useAuth();
  const { subscription, refreshSubscription } = useSubscription();
  const { openPayment } = usePhonePePayment();
  const { isFree } = useTierAccess();
  const [searchParams, setSearchParams] = useSearchParams();

  // Warn before leaving with unsaved changes
  const { markClean: markModelClean } = useUnsavedChangesGuard();

  // Auto-trigger upgrade if requested via URL
  useEffect(() => {
    const upgrade = searchParams.get("upgrade");
    if (upgrade === "pro" && isFree && userId && user?.email) {
      (async () => {
        try {
          const success = await openPayment(userId, user.email, "monthly");
          if (success) {
            await refreshSubscription();
          }
        } catch (err) {
          console.error('[ModernModeler] Payment flow error:', err);
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

  const {
    nodes, members, plates, loads, memberLoads, floorLoads,
    settings: modelSettings, analysisResults, setAnalysisResults, setIsAnalyzing
  } = useModelStore(
    useShallow((state) => ({
      nodes: state.nodes,
      members: state.members,
      plates: state.plates,
      loads: state.loads,
      memberLoads: state.memberLoads,
      floorLoads: state.floorLoads,
      settings: state.settings,
      analysisResults: state.analysisResults,
      setAnalysisResults: state.setAnalysisResults,
      setIsAnalyzing: state.setIsAnalyzing,
    }))
  );
  // UI Store — batched selector to prevent whole-store subscription
  const {
    activeCategory,
    setCategory,
    activeTool,
    setActiveTool,
    openModal,
    closeModal,
    notification,
    hideNotification,
    showNotification,
  } = useUIStore(
    useShallow((s) => ({
      activeCategory: s.activeCategory,
      setCategory: s.setCategory,
      activeTool: s.activeTool,
      setActiveTool: s.setActiveTool,
      openModal: s.openModal,
      closeModal: s.closeModal,
      notification: s.notification,
      hideNotification: s.hideNotification,
      showNotification: s.showNotification,
    }))
  );

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

    // Map specific generators to their dedicated dialogs
    const generatorModalMap: Record<string, string> = {
      TRUSS_GENERATOR: "trussGenerator",
      ARCH_GENERATOR: "archGenerator",
      FRAME_GENERATOR: "frameGenerator",
      CABLE_PATTERN: "cablePatternGenerator",
    };

    if (generatorModalMap[activeTool]) {
      openModal(generatorModalMap[activeTool] as any);
      setActiveTool("SELECT");
    } else if (GENERATOR_TOOLS.includes(activeTool)) {
      openModal("structureWizard");
      setActiveTool("SELECT");
    }
  }, [activeTool, openModal, setActiveTool]);

  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [showCloudManager, setShowCloudManager] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [showAIArchitect, setShowAIArchitect] = useState(false);

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
    const onToggleAI = () => setShowAIArchitect(prev => !prev);

    document.addEventListener("trigger-save", onSave);
    document.addEventListener("trigger-cloud-open", onOpen);
    document.addEventListener("toggle-ai-architect", onToggleAI);

    return () => {
      document.removeEventListener("trigger-save", onSave);
      document.removeEventListener("trigger-cloud-open", onOpen);
      document.removeEventListener("toggle-ai-architect", onToggleAI);
    };
  }, [handleCloudSave]);

  // Analysis state & actions — extracted to useAnalysisExecution hook
  const {
    isAnalyzing, analysisProgress, analysisStage, analysisError,
    showProgressModal, analysisStats, showResultsToolbar, showResultsDock,
    validationErrors, showValidationErrors, showValidationDialog,
    structuralValidationErrors, structuralValidationWarnings,
    stressResults, showStressVisualization, currentStressType,
    executeAnalysis, handleRunAnalysis, cancelAnalysis, calculateStresses,
    setShowProgressModal, setShowResultsToolbar, setShowResultsDock,
    setShowValidationErrors, setValidationErrors, setShowValidationDialog,
    setStructuralValidationErrors, setStructuralValidationWarnings,
    setShowStressVisualization, setCurrentStressType, setStressResults,
  } = useAnalysisExecution(getToken);

  // Export state
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Keyboard Shortcuts Overlay state
  const [showShortcuts, setShowShortcuts] = useState(false);

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

  // Save project: localStorage + cloud (if authenticated)
  const handleProjectSave = useCallback(() => {
    saveProjectToStorage();
    markModelClean();
    // Also persist to cloud/database so the project survives logout
    handleCloudSave();
  }, [handleCloudSave, markModelClean]);

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

  // Ribbon Edit & Results Event Listeners — handle trigger-copy/move/split/delete + toggle-deformed/diagrams
  useEffect(() => {
    const onDelete = () => {
      useModelStore.getState().deleteSelection();
    };
    const onCopy = () => {
      // Duplicate selected nodes with a 1m X offset
      const state = useModelStore.getState();
      const sel = state.selectedIds;
      if (sel.size === 0) {
        showNotification("warning", "Select elements to copy first");
        return;
      }
      const nodeIdMap = new Map<string, string>();
      // Copy selected nodes with offset
      for (const id of sel) {
        const node = state.nodes.get(id);
        if (node) {
          const newId = state.getNextNodeId();
          state.addNode({ ...node, id: newId, x: node.x + 1 });
          nodeIdMap.set(id, newId);
        }
      }
      // Copy members between selected nodes
      for (const [, m] of state.members) {
        if (sel.has(m.startNodeId) && sel.has(m.endNodeId)) {
          const newStart = nodeIdMap.get(m.startNodeId);
          const newEnd = nodeIdMap.get(m.endNodeId);
          if (newStart && newEnd) {
            state.addMember({ ...m, id: state.getNextMemberId(), startNodeId: newStart, endNodeId: newEnd });
          }
        }
      }
      showNotification("success", `Duplicated ${nodeIdMap.size} node(s) with 1m X offset`);
    };
    const onMove = () => {
      // Switch to select tool and notify user to drag
      useModelStore.getState().setTool('select');
      showNotification("info", "Select tool activated — drag elements to move them");
    };
    const onSplit = () => {
      // Split selected members at midpoint
      const state = useModelStore.getState();
      const sel = state.selectedIds;
      let splitCount = 0;
      for (const id of sel) {
        const member = state.members.get(id);
        if (!member) continue;
        const n1 = state.nodes.get(member.startNodeId);
        const n2 = state.nodes.get(member.endNodeId);
        if (!n1 || !n2) continue;
        // Create midpoint node
        const midId = state.getNextNodeId();
        state.addNode({
          id: midId,
          x: (n1.x + n2.x) / 2,
          y: (n1.y + n2.y) / 2,
          z: ((n1.z ?? 0) + (n2.z ?? 0)) / 2,
        });
        // Create two new members
        const m1Id = state.getNextMemberId();
        const m2Id = state.getNextMemberId();
        state.addMember({ ...member, id: m1Id, startNodeId: member.startNodeId, endNodeId: midId });
        state.addMember({ ...member, id: m2Id, startNodeId: midId, endNodeId: member.endNodeId });
        // Remove original member
        state.removeMember(id);
        splitCount++;
      }
      if (splitCount > 0) {
        showNotification("success", `Split ${splitCount} member(s) at midpoint`);
      } else {
        showNotification("warning", "Select member(s) to split");
      }
    };
    const onToggleDeformed = () => {
      const s = useModelStore.getState();
      if (s.analysisResults) {
        s.setShowDeflectedShape(!s.showDeflectedShape);
      }
    };
    const onToggleDiagrams = () => {
      const s = useModelStore.getState();
      if (s.analysisResults) {
        // Toggle SFD + BMD together
        const next = !(s.showSFD || s.showBMD);
        s.setShowSFD(next);
        s.setShowBMD(next);
      }
    };

    document.addEventListener("trigger-delete", onDelete);
    document.addEventListener("trigger-copy", onCopy);
    document.addEventListener("trigger-move", onMove);
    document.addEventListener("trigger-split", onSplit);
    document.addEventListener("toggle-deformed", onToggleDeformed);
    document.addEventListener("toggle-diagrams", onToggleDiagrams);

    return () => {
      document.removeEventListener("trigger-delete", onDelete);
      document.removeEventListener("trigger-copy", onCopy);
      document.removeEventListener("trigger-move", onMove);
      document.removeEventListener("trigger-split", onSplit);
      document.removeEventListener("toggle-deformed", onToggleDeformed);
      document.removeEventListener("toggle-diagrams", onToggleDiagrams);
    };
  }, []);

  // Individual diagram toggle + results dock + report event listeners
  useEffect(() => {
    const onToggleSFD = () => {
      const s = useModelStore.getState();
      if (s.analysisResults) s.setShowSFD(!s.showSFD);
    };
    const onToggleBMD = () => {
      const s = useModelStore.getState();
      if (s.analysisResults) s.setShowBMD(!s.showBMD);
    };
    const onToggleAFD = () => {
      const s = useModelStore.getState();
      if (s.analysisResults) s.setShowAFD(!s.showAFD);
    };
    const onToggleDeflection = () => {
      const s = useModelStore.getState();
      if (s.analysisResults) s.setShowDeflectedShape(!s.showDeflectedShape);
    };
    const onToggleReactions = () => {
      const s = useModelStore.getState();
      if (s.analysisResults) {
        // Toggle reactions display — uses existing showReactions flag or falls back to notifications
        if ('setShowReactions' in s && typeof (s as any).setShowReactions === 'function') {
          (s as any).setShowReactions(!(s as any).showReactions);
        } else {
          showNotification("info", "Reactions are shown in the Results Table below");
        }
      }
    };
    const onToggleResultsDock = () => {
      // Toggle results table dock visibility
      const s = useModelStore.getState();
      if (s.analysisResults) {
        showNotification("info", "Results table is visible in the bottom panel");
      } else {
        showNotification("warning", "Run analysis first to view results");
      }
    };
    const onTriggerPdfReport = () => {
      const s = useModelStore.getState();
      if (s.analysisResults) {
        setShowExportDialog(true);
        showNotification("info", "Opening report export dialog");
      } else {
        showNotification("warning", "Run analysis before generating report");
      }
    };
    const onTriggerCsvExport = () => {
      const s = useModelStore.getState();
      if (s.analysisResults) {
        setShowExportDialog(true);
        showNotification("info", "Opening export dialog for CSV");
      } else {
        showNotification("warning", "Run analysis before exporting CSV");
      }
    };
    const onToggleGridSnap = () => {
      showNotification("info", "Grid snap toggled");
    };

    document.addEventListener("toggle-sfd", onToggleSFD);
    document.addEventListener("toggle-bmd", onToggleBMD);
    document.addEventListener("toggle-afd", onToggleAFD);
    document.addEventListener("toggle-deflection", onToggleDeflection);
    document.addEventListener("toggle-reactions", onToggleReactions);
    document.addEventListener("toggle-results-dock", onToggleResultsDock);
    document.addEventListener("trigger-pdf-report", onTriggerPdfReport);
    document.addEventListener("trigger-csv-export", onTriggerCsvExport);
    document.addEventListener("toggle-grid-snap", onToggleGridSnap);

    return () => {
      document.removeEventListener("toggle-sfd", onToggleSFD);
      document.removeEventListener("toggle-bmd", onToggleBMD);
      document.removeEventListener("toggle-afd", onToggleAFD);
      document.removeEventListener("toggle-deflection", onToggleDeflection);
      document.removeEventListener("toggle-reactions", onToggleReactions);
      document.removeEventListener("toggle-results-dock", onToggleResultsDock);
      document.removeEventListener("trigger-pdf-report", onTriggerPdfReport);
      document.removeEventListener("trigger-csv-export", onTriggerCsvExport);
      document.removeEventListener("toggle-grid-snap", onToggleGridSnap);
    };
  }, []);

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

  // Modal states from uiStore (for cross-component access)
  // const modals = useUIStore((s) => s.modals); // Moved to top
  // const openModal = useUIStore((s) => s.openModal); // Moved to top
  // const closeModal = useUIStore((s) => s.closeModal); // Moved to top

  // Individual modal selectors for complex dialogs still rendered here
  // Each selector returns a primitive boolean → no re-render when OTHER modals change
  const showStructureWizard = useUIStore((s) => s.modals.structureWizard);
  const showAdvancedAnalysis = useUIStore((s) => s.modals.advancedAnalysis);
  const showPDeltaAnalysis = useUIStore((s) => s.modals.pDeltaAnalysis);
  const showBucklingAnalysis = useUIStore((s) => s.modals.bucklingAnalysis);
  const showDesignCodes = useUIStore((s) => s.modals.designCodes);
  const showMaterialLibrary = useUIStore((s) => s.modals.materialLibrary);
  const showMaterialAssign = useUIStore((s) => s.modals.materialAssign);
  const showMaterialProperties = useUIStore((s) => s.modals.materialProperties);
  const showGenerativeDesign = useUIStore((s) => s.modals.generativeDesign);
  const showSeismicStudio = useUIStore((s) => s.modals.seismicStudio);

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

  // Quick Commands Toolbar (Spacebar) — memoized to avoid recreating on every render
  const quickCommandActions = useMemo(() => ({
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
  }), [openModal, handleRunAnalysis]);
  const { QuickCommandsToolbar } = useQuickCommands(
    getDefaultQuickCommands(quickCommandActions),
  );

  // Global Keyboard Shortcuts
  useKeyboardShortcuts();

  // Keyboard shortcut: ? → toggle shortcuts overlay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) return;
      // Don't fire shortcuts when inside a contenteditable parent or custom text editor
      if (target.closest('[contenteditable="true"]') || target.getAttribute('role') === 'textbox') return;
      // Don't fire shortcuts when a dialog/modal is open
      if (document.querySelector('[role="dialog"], [role="alertdialog"], .modal-overlay')) return;

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
      // F1 also opens shortcuts help
      if (e.key === 'F1') {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
      // Backspace delete (Delete key is handled by useKeyboardShortcuts)
      if (e.key === 'Backspace') {
        e.preventDefault();
        useModelStore.getState().deleteSelection();
      }
      // F key → Fit View (only when focused on body/canvas, not form elements)
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
        const activeEl = document.activeElement;
        const isCanvas = activeEl === document.body || activeEl?.tagName === 'CANVAS';
        if (isCanvas) {
          document.dispatchEvent(new CustomEvent('fit-view'));
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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

  // Show quick start on first load if model is empty, only if no other overlay is active
  const activeOverlay = useUIStore((s) => s.activeOverlay);
  const setActiveOverlay = useUIStore((s) => s.setActiveOverlay);
  useEffect(() => {
    if (nodes.size === 0 && members.size === 0 && activeOverlay === 'none') {
      const timer = setTimeout(() => {
        setActiveOverlay('quickstart');
        setShowQuickStart(true);
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [nodes.size, members.size, activeOverlay, setActiveOverlay]);

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
      <div className="h-screen w-screen flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden relative">
        {/* Skip to main content — Figma §22.2 accessibility */}
        <a
          href="#main-viewport"
          className="sr-only focus:not-sr-only focus:fixed focus:top-0 focus:left-1/2 focus:-translate-x-1/2 focus:z-[9999] focus:bg-blue-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-b-lg focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        <MultiplayerUI />

        {/* Main Application Layout (Flex Row) */}
        <div className="flex-1 flex overflow-hidden relative min-h-0">
          {/* 1. Workflow Sidebar (Left) */}
          <aside
            className={`
                        w-48 flex-shrink-0 h-full z-30 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm border-r border-slate-800/60
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
              <EngineeringRibbon activeCategory={activeCategory} isSidebarOpen={isSidebarOpen} />
            </div>

            {/* 3D Canvas Area */}
            <div
              id="main-viewport"
              className="flex-1 bg-white dark:bg-slate-950 relative min-h-0"
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
              <div className="absolute top-4 left-4 z-30">
                <ModelingToolbar />
              </div>
              <ViewportManager />

              {/* Empty workspace guidance overlay */}
              {nodes.size === 0 && members.size === 0 && (
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                  <div className="pointer-events-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl p-8 max-w-md text-center shadow-lg">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <Box className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Empty Workspace</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Start building your structural model</p>
                    <div className="grid grid-cols-2 gap-4">
                      <button type="button"
                        onClick={() => { setCategory('MODELING'); useModelStore.getState().setTool('node'); }}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 transition-colors"
                      >
                        <Circle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Draw Nodes</span>
                      </button>
                      <button type="button"
                        onClick={() => openModal('structureWizard')}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800 transition-colors"
                      >
                        <Wand2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Structure Wizard</span>
                      </button>
                      <button type="button"
                        onClick={() => openModal('structureGallery')}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 transition-colors"
                      >
                        <LayoutGrid className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Gallery</span>
                      </button>
                      <button type="button"
                        onClick={() => openModal('interoperability')}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 transition-colors"
                      >
                        <Upload className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Import File</span>
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono">⌘K</kbd> for command palette</p>
                  </div>
                </div>
              )}

              {/* View Controls Overlay (ViewCube + Zoom + Display toggles) */}
              <ViewControlsOverlay />

              {/* Status Bar Overlay */}
              <div className="absolute bottom-0 w-full z-10">
                <StatusBar
                  isAnalyzing={isAnalyzing}
                  onOpenDiagnostics={() => setDiagnosticsOpen(true)}
                />
              </div>
            </div>

            {/* Results Table Dock — Figma §11 post-processing tables */}
            {showResultsDock && analysisResults && (
              <ResultsTableDock
                analysisResults={analysisResults}
                onClose={() => setShowResultsDock(false)}
              />
            )}
          </div>

          {/* 3. Right Inspector Panel (Context Aware) */}
          <InspectorPanel
            collapsed={inspectorCollapsed}
            onToggle={() => setInspectorCollapsed(!inspectorCollapsed)}
          />
        </div>

        {/* Modals & Overlays */}

        {/* Keyboard Shortcuts Overlay (? key) */}
        <KeyboardShortcutsOverlay isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

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
              onCancel={cancelAnalysis}
              stats={analysisStats}
            />
          )}

          {/* Results Toolbar - Shows after successful analysis */}
          {showResultsToolbar && analysisResults && (
            <ResultsToolbar onClose={() => setShowResultsToolbar(false)} />
          )}

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

          {/* Structure Wizard — complex onGenerate callback */}
          <StructureWizard
            isOpen={showStructureWizard}
            onClose={() => closeModal("structureWizard")}
            onGenerate={(structure) => {
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
              loadStructure(nodes, members);

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

          {/* Dialogs with local state (memberId, etc.) */}
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

          <SplitMemberDialog
            isOpen={showSplitDialog}
            onClose={() => setShowSplitDialog(false)}
            memberId={splitMemberId ?? undefined}
          />

          {/* Advanced Analysis — needs subscription & multi-modal state */}
          <AdvancedAnalysisDialog
            isOpen={
              showAdvancedAnalysis ||
              showPDeltaAnalysis ||
              showBucklingAnalysis
            }
            onClose={() => {
              closeModal("advancedAnalysis");
              closeModal("pDeltaAnalysis");
              closeModal("bucklingAnalysis");
            }}
            isPro={
              subscription?.tier === "pro" ||
              subscription?.tier === "enterprise"
            }
            initialTab={
              showBucklingAnalysis
                ? "buckling"
                : showPDeltaAnalysis
                  ? "pdelta"
                  : "pdelta"
            }
          />

          {/* Design Codes — needs subscription */}
          <DesignCodesDialog
            isOpen={showDesignCodes}
            onClose={() => closeModal("designCodes")}
            isPro={
              subscription?.tier === "pro" ||
              subscription?.tier === "enterprise"
            }
          />

          {/* Material Library — 3 modes, rendered 3 times */}
          <MaterialLibraryDialog
            isOpen={showMaterialLibrary}
            onClose={() => closeModal("materialLibrary")}
            mode="library"
          />
          <MaterialLibraryDialog
            isOpen={showMaterialAssign}
            onClose={() => closeModal("materialAssign")}
            mode="assign"
          />
          <MaterialLibraryDialog
            isOpen={showMaterialProperties}
            onClose={() => closeModal("materialProperties")}
            mode="properties"
          />

          {/* Validation Dialog — complex callbacks */}
          <ValidationDialog
            isOpen={showValidationDialog}
            onClose={() => setShowValidationDialog(false)}
            errors={structuralValidationErrors}
            warnings={structuralValidationWarnings}
            onProceedAnyway={() => {
              setShowValidationDialog(false);
              setTimeout(() => executeAnalysis(), 100);
            }}
            onRevalidate={() => {
              const validationResult = validateStructure(nodes, members);
              setStructuralValidationErrors(validationResult.errors);
              setStructuralValidationWarnings(validationResult.warnings);
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
                const result = useModelStore.getState().autoFixModel();
                uiLogger.log("Auto-fix result:", result);
                if (result.fixed.length > 0) {
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
                if (analysisResults?.memberForces) {
                  calculateStresses(analysisResults.memberForces, members);
                }
              }}
            />
          )}

          {/* Modal Analysis Controls */}
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

          {/* AI Architect */}
          <AutonomousAIAgent />
          {showAIArchitect && (
            <div className="fixed right-0 top-0 bottom-0 w-[380px] z-40 shadow-2xl">
              <AIArchitectPanel />
              <button type="button"
                onClick={() => setShowAIArchitect(false)}
                className="absolute top-3 right-3 p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100/80 dark:bg-slate-800/80 rounded-lg z-50"
                title="Close AI Architect"
              >
                ✕
              </button>
            </div>
          )}

          {/* Generative Design — custom wrapper */}
          {showGenerativeDesign && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => closeModal("generativeDesign")}
              />
              <div className="relative w-[95vw] max-w-5xl h-[85vh] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-emerald-600/10 to-cyan-600/10">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Generative Design / Topology Optimization
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      AI-powered structural optimization with density-based topology
                    </p>
                  </div>
                  <button type="button"
                    onClick={() => closeModal("generativeDesign")}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <span className="text-slate-500 dark:text-slate-400 text-xl">&times;</span>
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-6">
                  <GenerativeDesignPanel />
                </div>
              </div>
            </div>
          )}

          {/* Seismic Design Studio — custom wrapper */}
          {showSeismicStudio && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => closeModal("seismicStudio")}
              />
              <div className="relative w-[95vw] max-w-6xl h-[90vh] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-red-600/10 to-orange-600/10">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Seismic Design Studio
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Response Spectrum · Time History · Pushover — IS 1893, ASCE 7, EC8
                    </p>
                  </div>
                  <button type="button"
                    onClick={() => closeModal("seismicStudio")}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <span className="text-slate-500 dark:text-slate-400 text-xl">&times;</span>
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-6">
                  <SeismicDesignStudio />
                </div>
              </div>
            </div>
          )}

          <IntegrationDiagnostics
            open={diagnosticsOpen}
            onClose={() => setDiagnosticsOpen(false)}
          />
        </Suspense>

        {/* ══════════════════════════════════════════════════════
            ModalPortal — 41 simple dialogs, each with ISOLATED
            Zustand subscriptions. Zero cascade re-renders.
            ══════════════════════════════════════════════════════ */}
        <ModalPortal />

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
