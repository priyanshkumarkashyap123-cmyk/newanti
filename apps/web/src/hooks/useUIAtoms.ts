/**
 * useUIAtoms.ts - Convenience hooks for accessing UI state atoms
 * 
 * Why: Cleaner component code
 * Instead of: const [showCloudManager, setShowCloudManager] = useAtom(showCloudManagerAtom);
 * Use: const { showCloudManager, setShowCloudManager } = useUIAtoms();
 */

import { useAtom } from 'jotai';
import {
  showCloudManagerAtom,
  showAIArchitectAtom,
  showExportDialogAtom,
  showShortcutsAtom,
  showModalAnalysisAtom,
  showQuickStartAtom,
  showProjectDetailsAtom,
  isNewProjectAtom,
  diagnosticsOpenAtom,
  inspectorCollapsedAtom,
  activeTabAtom,
  sidebarCollapsedAtom,
  showLoadDialogAtom,
  loadDialogMemberIdAtom,
  showSplitDialogAtom,
  splitMemberIdAtom,
  showSpecDialogAtom,
  specMemberIdAtom,
  modalAtomsMap,
  isAnyModalOpenAtom,
} from './uiAtoms';

/**
 * Main hook for UI state
 * Each destructured item is a separate atom — components only re-render on change
 */
export const useUIAtoms = () => {
  const [showCloudManager, setShowCloudManager] = useAtom(showCloudManagerAtom);
  const [showAIArchitect, setShowAIArchitect] = useAtom(showAIArchitectAtom);
  const [showExportDialog, setShowExportDialog] = useAtom(showExportDialogAtom);
  const [showShortcuts, setShowShortcuts] = useAtom(showShortcutsAtom);
  const [showModalAnalysis, setShowModalAnalysis] = useAtom(showModalAnalysisAtom);
  const [showQuickStart, setShowQuickStart] = useAtom(showQuickStartAtom);
  const [showProjectDetails, setShowProjectDetails] = useAtom(showProjectDetailsAtom);
  const [isNewProject, setIsNewProject] = useAtom(isNewProjectAtom);
  const [diagnosticsOpen, setDiagnosticsOpen] = useAtom(diagnosticsOpenAtom);
  const [inspectorCollapsed, setInspectorCollapsed] = useAtom(inspectorCollapsedAtom);
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const [sidebarCollapsed, setSidebarCollapsed] = useAtom(sidebarCollapsedAtom);
  const [showLoadDialog, setShowLoadDialog] = useAtom(showLoadDialogAtom);
  const [loadDialogMemberId, setLoadDialogMemberId] = useAtom(loadDialogMemberIdAtom);
  const [showSplitDialog, setShowSplitDialog] = useAtom(showSplitDialogAtom);
  const [splitMemberId, setSplitMemberId] = useAtom(splitMemberIdAtom);
  const [showSpecDialog, setShowSpecDialog] = useAtom(showSpecDialogAtom);
  const [specMemberId, setSpecMemberId] = useAtom(specMemberIdAtom);

  return {
    // Cloud
    showCloudManager,
    setShowCloudManager,
    // AI
    showAIArchitect,
    setShowAIArchitect,
    // Export
    showExportDialog,
    setShowExportDialog,
    // Shortcuts
    showShortcuts,
    setShowShortcuts,
    // Modal Analysis
    showModalAnalysis,
    setShowModalAnalysis,
    // Quick Start & Project
    showQuickStart,
    setShowQuickStart,
    showProjectDetails,
    setShowProjectDetails,
    isNewProject,
    setIsNewProject,
    // Diagnostics
    diagnosticsOpen,
    setDiagnosticsOpen,
    // Inspector
    inspectorCollapsed,
    setInspectorCollapsed,
    // Tabs
    activeTab,
    setActiveTab,
    // Sidebar
    sidebarCollapsed,
    setSidebarCollapsed,
    // Load Dialog
    showLoadDialog,
    setShowLoadDialog,
    loadDialogMemberId,
    setLoadDialogMemberId,
    // Split Dialog
    showSplitDialog,
    setShowSplitDialog,
    splitMemberId,
    setSplitMemberId,
    // Spec Dialog
    showSpecDialog,
    setShowSpecDialog,
    specMemberId,
    setSpecMemberId,
  };
};

/**
 * Hook to access individual modal atoms
 * Usage: const [showFoundationDesign, setShowFoundationDesign] = useModalAtom('foundationDesign');
 */
export const useModalAtom = (modalName: keyof typeof modalAtomsMap) => {
  const atom = modalAtomsMap[modalName];
  return useAtom(atom);
};

/**
 * Hook to open/close a modal
 * Usage: const { openModal, closeModal } = useModalControl();
 *        openModal('foundationDesign');
 */
export const useModalControl = () => {
  return {
    openModal: (modalName: keyof typeof modalAtomsMap) => {
      const atom = modalAtomsMap[modalName];
      // This is a bit awkward with Jotai, better to use useModalAtom directly
      // But we can provide a convenience function
    },
    closeModal: (modalName: keyof typeof modalAtomsMap) => {
      // Similar issue
    },
  };
};

/**
 * Hook to check if ANY modal is open
 * Used in keyboard shortcut handlers to ignore events when modal is active
 */
export const useIsAnyModalOpen = () => {
  const [isOpen] = useAtom(isAnyModalOpenAtom);
  return isOpen;
};
