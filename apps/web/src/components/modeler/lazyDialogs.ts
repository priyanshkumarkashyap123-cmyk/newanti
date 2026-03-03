/**
 * lazyDialogs.ts — Lazy-loaded dialog & panel imports
 * Extracted from ModernModeler.tsx to reduce file size.
 * Each component is only fetched when first rendered.
 */
import { lazy } from "react";

export const StructureWizard = lazy(() =>
  import("../StructureWizard").then((m) => ({ default: m.StructureWizard })),
);
export const FoundationDesignDialog = lazy(() =>
  import("../FoundationDesignDialog").then((m) => ({
    default: m.FoundationDesignDialog,
  })),
);
export const IS875LoadDialog = lazy(() =>
  import("../IS875LoadDialog").then((m) => ({ default: m.IS875LoadDialog })),
);
export const GeometryToolsPanel = lazy(() =>
  import("../GeometryToolsPanel").then((m) => ({
    default: m.GeometryToolsPanel,
  })),
);
export const ValidationErrorDisplay = lazy(() =>
  import("../ValidationErrorDisplay").then((m) => ({
    default: m.ValidationErrorDisplay,
  })),
);
export const ValidationDialog = lazy(() =>
  import("../ValidationDialog").then((m) => ({ default: m.ValidationDialog })),
);
export const StressVisualization = lazy(() => import("../StressVisualization"));
export const InteroperabilityDialog = lazy(() =>
  import("../InteroperabilityDialog").then((m) => ({
    default: m.InteroperabilityDialog,
  })),
);
export const RailwayBridgeDialog = lazy(() =>
  import("../RailwayBridgeDialog").then((m) => ({
    default: m.RailwayBridgeDialog,
  })),
);
export const MeshingPanel = lazy(() =>
  import("../MeshingPanel").then((m) => ({ default: m.MeshingPanel })),
);
export const AdvancedSelectionPanel = lazy(() =>
  import("../AdvancedSelectionPanel").then((m) => ({
    default: m.AdvancedSelectionPanel,
  })),
);
export const LoadDialog = lazy(() =>
  import("../LoadDialog").then((m) => ({ default: m.LoadDialog })),
);
export const WindLoadDialog = lazy(() => import("../WindLoadDialog"));
export const SeismicLoadDialog = lazy(() => import("../SeismicLoadDialog"));
export const MovingLoadDialog = lazy(() => import("../MovingLoadDialog"));
export const SplitMemberDialog = lazy(() =>
  import("../geometry/SplitMemberDialog").then((m) => ({
    default: m.SplitMemberDialog,
  })),
);
export const MemberSpecificationsDialog = lazy(() =>
  import("../specifications/MemberSpecificationsDialog").then((m) => ({
    default: m.MemberSpecificationsDialog,
  })),
);
export const ASCE7SeismicLoadDialog = lazy(() => import("../ASCE7SeismicLoadDialog"));
export const ASCE7WindLoadDialog = lazy(() => import("../ASCE7WindLoadDialog"));
export const LoadCombinationsDialog = lazy(() => import("../LoadCombinationsDialog"));
export const IS1893SeismicLoadDialog = lazy(() => import("../IS1893SeismicLoadDialog"));
export const SectionBrowserDialog = lazy(() => import("../SectionBrowserDialog"));
export const AdvancedAnalysisDialog = lazy(() =>
  import("../AdvancedAnalysisDialog").then((m) => ({
    default: m.AdvancedAnalysisDialog,
  })),
);
export const DesignCodesDialog = lazy(() =>
  import("../DesignCodesDialog").then((m) => ({ default: m.DesignCodesDialog })),
);
export const ModalAnalysisPanel = lazy(() =>
  import("../analysis/ModalAnalysisPanel").then((m) => ({
    default: m.ModalAnalysisPanel,
  })),
);
export const ExportDialog = lazy(() =>
  import("../ExportDialog").then((m) => ({ default: m.ExportDialog })),
);
export const CloudProjectManager = lazy(() =>
  import("../CloudProjectManager").then((m) => ({
    default: m.CloudProjectManager,
  })),
);
export const StructureGallery = lazy(() =>
  import("../gallery/StructureGallery").then((m) => ({
    default: m.StructureGallery,
  })),
);
export const PlateCreationDialog = lazy(() =>
  import("../dialogs/PlateCreationDialog").then((m) => ({
    default: m.PlateCreationDialog,
  })),
);
export const FloorSlabDialog = lazy(() =>
  import("../dialogs/FloorSlabDialog").then((m) => ({
    default: m.FloorSlabDialog,
  })),
);
export const BoundaryConditionsDialog = lazy(() =>
  import("../BoundaryConditionsDialog").then((m) => ({
    default: m.BoundaryConditionsDialog,
  })),
);
export const SelectionToolbar = lazy(() =>
  import("../SelectionToolbar").then((m) => ({ default: m.SelectionToolbar })),
);
export const DeadLoadGenerator = lazy(() =>
  import("../DeadLoadGenerator").then((m) => ({ default: m.DeadLoadGenerator })),
);
export const CurvedStructureDialog = lazy(() =>
  import("../CurvedStructureDialog").then((m) => ({
    default: m.CurvedStructureDialog,
  })),
);
export const DetailedDesignPanel = lazy(() =>
  import("../DetailedDesignPanel").then((m) => ({
    default: m.DetailedDesignPanel,
  })),
);
export const SteelDesignDialog = lazy(() =>
  import("../dialogs/SteelDesignDialog").then((m) => ({
    default: m.SteelDesignDialog,
  })),
);
export const ConcreteDesignDialog = lazy(() =>
  import("../dialogs/ConcreteDesignDialog").then((m) => ({
    default: m.ConcreteDesignDialog,
  })),
);
export const ConnectionDesignDialog = lazy(() =>
  import("../dialogs/ConnectionDesignDialog").then((m) => ({
    default: m.ConnectionDesignDialog,
  })),
);
export const CivilEngineeringDialog = lazy(() =>
  import("../dialogs/CivilEngineeringDialog").then((m) => ({
    default: m.CivilEngineeringDialog,
  })),
);
export const GenerativeDesignPanel = lazy(() =>
  import("../ai/GenerativeDesignPanel").then((m) => ({
    default: m.GenerativeDesignPanel,
  })),
);
export const SeismicDesignStudio = lazy(() =>
  import("../enhanced/SeismicDesignStudio").then((m) => ({
    default: m.SeismicDesignStudio,
  })),
);
// ── Industry-standard Properties / Editing / Load dialogs ──
export const SectionAssignDialog = lazy(() =>
  import("../dialogs/SectionAssignDialog").then((m) => ({
    default: m.SectionAssignDialog,
  })),
);
export const MaterialLibraryDialog = lazy(() =>
  import("../dialogs/MaterialLibraryDialog").then((m) => ({
    default: m.MaterialLibraryDialog,
  })),
);
export const SectionDesignerDialog = lazy(() =>
  import("../SectionDesignerDialog").then((m) => ({
    default: m.SectionDesignerDialog,
  })),
);
export const BetaAngleDialog = lazy(() =>
  import("../dialogs/BetaAngleDialog").then((m) => ({
    default: m.BetaAngleDialog,
  })),
);
export const MemberReleasesDialog = lazy(() =>
  import("../dialogs/MemberReleasesDialog").then((m) => ({
    default: m.MemberReleasesDialog,
  })),
);
export const MemberOffsetsDialog = lazy(() =>
  import("../dialogs/MemberOffsetsDialog").then((m) => ({
    default: m.MemberOffsetsDialog,
  })),
);
export const TemperatureLoadDialog = lazy(() =>
  import("../dialogs/TemperatureLoadDialog").then((m) => ({
    default: m.TemperatureLoadDialog,
  })),
);
export const DivideMemberDialog = lazy(() =>
  import("../dialogs/DivideMemberDialog").then((m) => ({
    default: m.DivideMemberDialog,
  })),
);
export const MergeNodesDialog = lazy(() =>
  import("../dialogs/MergeNodesDialog").then((m) => ({
    default: m.MergeNodesDialog,
  })),
);
export const TimeHistoryDialog = lazy(() =>
  import("../dialogs/TimeHistoryDialog").then((m) => ({
    default: m.TimeHistoryDialog,
  })),
);
export const IntegrationDiagnostics = lazy(() => import("../IntegrationDiagnostics"));

// Structure Generator Dialogs
export const TrussGeneratorDialog = lazy(() =>
  import("../toolbar/GeneratorDialogs").then((m) => ({
    default: m.TrussGeneratorDialog,
  })),
);
export const ArchGeneratorDialog = lazy(() =>
  import("../toolbar/GeneratorDialogs").then((m) => ({
    default: m.ArchGeneratorDialog,
  })),
);
export const FrameGeneratorDialog = lazy(() =>
  import("../toolbar/GeneratorDialogs").then((m) => ({
    default: m.FrameGeneratorDialog,
  })),
);
export const CablePatternDialog = lazy(() =>
  import("../toolbar/GeneratorDialogs").then((m) => ({
    default: m.CablePatternDialog,
  })),
);
