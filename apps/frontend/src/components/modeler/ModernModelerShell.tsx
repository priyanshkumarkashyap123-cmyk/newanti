import { FC, memo } from "react";
import { Box, Circle, Wand2, LayoutGrid, Upload } from "lucide-react";
import { WorkflowSidebar } from "../layout/WorkflowSidebar";
import { EngineeringRibbon } from "../layout/EngineeringRibbon";
import { ViewportManager } from "../ViewportManager";
import { PanelErrorBoundary, CanvasFallback } from "../ui/PanelErrorBoundary";
import { ModelingToolbar } from "../toolbar/ModelingToolbar";
import { ViewControlsOverlay } from "../ui/ViewControlsOverlay";
import { StatusBar } from "./StatusBar";
import { InspectorPanel } from "./InspectorPanel";
import { MultiplayerUI } from "./MultiplayerUI";
import { useModelStore } from "../../store/model";
import { useContextMenu, getNodeContextMenuItems, getMemberContextMenuItems, getEmptyContextMenuItems } from "../ContextMenu";

type Props = {
  activeCategory: any;
  activeTool: string | null;
  hasCompletedAnalysis: boolean;
  hasLoadData: boolean;
  isProTier: boolean;
  isAnalyzing: boolean;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  inspectorCollapsed: boolean;
  setInspectorCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
  setCategory: (value: any) => void;
  openModal: (value: any) => void;
  setShowDiagnostics: (value: boolean) => void;
  showNotification: (type: "info" | "success" | "warning" | "error", message: string) => void;
};

export const ModernModelerShell: FC<Props> = memo((props) => {
  const contextMenu = useContextMenu();
  const selectedIds = useModelStore((state) => state.selectedIds);
  const nodes = useModelStore((state) => state.nodes);
  const members = useModelStore((state) => state.members);

  return (
    <div className="flex-1 flex overflow-hidden relative min-h-0">
      <aside className={`w-56 flex-shrink-0 h-full z-30 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm border-r border-slate-800/60 transition-transform duration-300 absolute md:relative ${props.isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"}`} role="navigation" aria-label="Workflow sidebar">
        <WorkflowSidebar activeCategory={props.activeCategory} showActionPanel={true} onCategoryChange={(cat) => { props.setCategory(cat); props.setIsSidebarOpen(false); }} />
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-shrink-0 z-10 px-6 py-4">
          <EngineeringRibbon activeCategory={props.activeCategory} isSidebarOpen={props.isSidebarOpen} onOpenAdvancedAnalysis={() => {}} analysisCompleted={props.hasCompletedAnalysis} hasLoads={props.hasLoadData} isProTier={props.isProTier} />
        </div>
        <div id="main-viewport" className="flex-1 bg-[#0b1326] relative min-h-0">
          <div className="absolute top-4 left-4 z-30"><ModelingToolbar /></div>
          <PanelErrorBoundary fallback={<CanvasFallback onReload={() => window.location.reload()} />}><ViewportManager /></PanelErrorBoundary>
          <ViewControlsOverlay />
          <div className="absolute bottom-0 w-full z-[15]"><StatusBar isAnalyzing={props.isAnalyzing} onOpenDiagnostics={() => props.setShowDiagnostics(true)} /></div>
        </div>
      </div>
      <InspectorPanel collapsed={props.inspectorCollapsed} onToggle={() => props.setInspectorCollapsed((prev) => !prev)} />
      <MultiplayerUI />
    </div>
  );
});