import { MutableRefObject, useEffect } from "react";
import { useUIStore } from "../../store/uiStore";
import { useModelStore } from "../../store/model";

type NotificationApi = {
  showNotification: (type: "info" | "success" | "warning" | "error", message: string) => void;
  handleRunAnalysis: () => void;
  handleGenerateUnifiedReport: () => void | Promise<void>;
  openModal: ReturnType<typeof useUIStore.getState>["openModal"];
  setCategory: ReturnType<typeof useUIStore.getState>["setCategory"];
  setShowModalAnalysis: (value: boolean) => void;
  setShowExportDialog: (value: boolean) => void;
  setShowResultsHub: (value: boolean) => void;
  setShowProgressModal: (value: boolean) => void;
  handleCloudSave: () => void | Promise<void>;
  setShowAIArchitect: (value: boolean | ((prev: boolean) => boolean)) => void;
  setShowStaadCommandExplorer: (value: boolean) => void;
  setShowShortcuts: (value: boolean | ((prev: boolean) => boolean)) => void;
  setShowCloudManager: (value: boolean) => void;
  setIsSidebarOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
};

export function useModernModelerEventListeners({
  showNotification,
  handleRunAnalysis,
  handleGenerateUnifiedReport,
  openModal,
  setCategory,
  setShowModalAnalysis,
  setShowExportDialog,
  setShowResultsHub,
  setShowProgressModal,
  handleCloudSave,
  setShowAIArchitect,
  setShowStaadCommandExplorer,
  setShowShortcuts,
  setShowCloudManager,
  setIsSidebarOpen,
}: NotificationApi) {
  useEffect(() => {
    const onSave = () => handleCloudSave();
    const onOpen = () => setShowCloudManager(true);
    const onToggleAI = () => setShowAIArchitect((prev) => !prev);
    const onOpenStaadCommands = () => setShowStaadCommandExplorer(true);

    document.addEventListener("trigger-save", onSave);
    document.addEventListener("trigger-cloud-open", onOpen);
    document.addEventListener("toggle-ai-architect", onToggleAI);
    document.addEventListener("open-staad-command-explorer", onOpenStaadCommands);

    return () => {
      document.removeEventListener("trigger-save", onSave);
      document.removeEventListener("trigger-cloud-open", onOpen);
      document.removeEventListener("toggle-ai-architect", onToggleAI);
      document.removeEventListener("open-staad-command-explorer", onOpenStaadCommands);
    };
  }, [handleCloudSave, setShowAIArchitect, setShowCloudManager, setShowStaadCommandExplorer]);

  useEffect(() => {
    const onAnalysis = () => {
      const state = useModelStore.getState();
      if (state.nodes.size === 0 || state.members.size === 0) {
        showNotification('warning', 'Create model geometry first (nodes and members).');
        return;
      }
      if (state.loads.length === 0 && state.memberLoads.length === 0 && state.floorLoads.length === 0) {
        showNotification('warning', 'Define loads first before analysis.');
        return;
      }
      void handleRunAnalysis();
    };

    const onModal = () => {
      const state = useModelStore.getState();
      if (state.nodes.size === 0 || state.members.size === 0) {
        showNotification('warning', 'Create model geometry first (nodes and members).');
        return;
      }
      if (state.loads.length === 0 && state.memberLoads.length === 0 && state.floorLoads.length === 0) {
        showNotification('warning', 'Define loads first before advanced analysis.');
        return;
      }
      setShowModalAnalysis(true);
    };
    const onExport = () => setShowExportDialog(true);
    const onDesignCheck = () => {
      const state = useModelStore.getState();
      if (state.nodes.size === 0 || state.members.size === 0) {
        showNotification('warning', 'Create model geometry first (nodes and members).');
        return;
      }
      if (state.loads.length === 0 && state.memberLoads.length === 0 && state.floorLoads.length === 0) {
        showNotification('warning', 'Define loads first before design checks.');
        return;
      }
      setCategory('DESIGN');
    };
    const onOpenResultsHub = () => setShowResultsHub(true);

    document.addEventListener("trigger-analysis", onAnalysis);
    document.addEventListener("trigger-modal-analysis", onModal);
    document.addEventListener("trigger-export", onExport);
    document.addEventListener("trigger-design-check", onDesignCheck);
    document.addEventListener("open-results-hub", onOpenResultsHub);

    return () => {
      document.removeEventListener("trigger-analysis", onAnalysis);
      document.removeEventListener("trigger-modal-analysis", onModal);
      document.removeEventListener("trigger-export", onExport);
      document.removeEventListener("trigger-design-check", onDesignCheck);
      document.removeEventListener("open-results-hub", onOpenResultsHub);
    };
  }, [handleRunAnalysis, setCategory, setShowModalAnalysis, setShowExportDialog, setShowResultsHub, showNotification]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) return;
      if (target.closest('[contenteditable="true"]') || target.getAttribute('role') === 'textbox') return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], .modal-overlay')) return;

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
      if (e.key === 'F1') {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        useModelStore.getState().deleteSelection();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setShowShortcuts]);

  useEffect(() => {
    const handleToggle = () => setIsSidebarOpen((prev) => !prev);
    document.addEventListener("toggle-sidebar", handleToggle);
    return () => document.removeEventListener("toggle-sidebar", handleToggle);
  }, [setIsSidebarOpen]);
}