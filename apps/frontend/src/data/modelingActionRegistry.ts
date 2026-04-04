import type { FC } from "react";
import {
  MousePointer,
  Maximize2,
  Plus,
  Box,
  Square,
  Copy,
  Move,
  RotateCcw,
  FlipHorizontal,
  Scissors,
  ArrowDownUp,
  Merge,
  Grid3X3,
  Trash2,
  Layers,
  Database,
  Settings,
  Anchor,
  File,
  ArrowRight,
  Download,
  Wind,
  Zap,
  Activity,
  Play,
  Eye,
  BarChart3,
  Building2,
  Columns,
  Link2,
  Landmark,
  FileText,
  Ruler,
  Target,
  FileCheck,
  CheckSquare,
  Globe,
  // NEW icons for parity actions
  Triangle,
  Navigation,
  Repeat,
  Repeat2,
  Scan,
  FileUp,
  Import,
  LayoutGrid,
  TrendingUp,
  Weight,
  CircleDot,
  Lock,
  Unlock,
  Waves,
  Snowflake,
  Shapes,
  ListOrdered,
  BookOpen,
  Cable,
  Hexagon,
  Gauge,
  TreePine,
  ArrowDown,
} from "lucide-react";

export type SidebarActionHandler = "setTool" | "openModal" | "dispatch" | "storeAction";
export type SidebarCategory = "MODELING" | "PROPERTIES" | "SUPPORTS" | "LOADING" | "ANALYSIS" | "DESIGN";

export interface SidebarAction {
  id: string;
  label: string;
  icon: FC<{ className?: string }>;
  shortcut?: string;
  handler: SidebarActionHandler;
  target: string;
  categories: SidebarCategory[];
  quick?: boolean;
  quickGroup?: "cursor" | "geometry" | "properties" | "loading" | "analysis" | "view";
}

export const MODELING_ACTIONS: SidebarAction[] = [
  // ─── MODELING ───
  { id: "select", label: "Select", icon: MousePointer, shortcut: "V", handler: "setTool", target: "select", categories: ["MODELING"], quick: true, quickGroup: "cursor" },
  { id: "select-range", label: "Box Select", icon: Maximize2, shortcut: "B", handler: "setTool", target: "select_range", categories: ["MODELING"] },
  { id: "add-node", label: "Add Node", icon: Plus, shortcut: "N", handler: "setTool", target: "node", categories: ["MODELING"], quick: true, quickGroup: "geometry" },
  { id: "add-beam", label: "Add Beam", icon: Box, shortcut: "M", handler: "setTool", target: "member", categories: ["MODELING"], quick: true, quickGroup: "geometry" },
  { id: "add-plate", label: "Add Plate", icon: Square, shortcut: "P", handler: "openModal", target: "plateDialog", categories: ["MODELING"] },
  { id: "copy", label: "Copy / Duplicate", icon: Copy, shortcut: "⌘C", handler: "dispatch", target: "trigger-copy", categories: ["MODELING"] },
  { id: "move", label: "Move", icon: Move, shortcut: "M", handler: "dispatch", target: "trigger-move", categories: ["MODELING"], quick: true, quickGroup: "cursor" },
  { id: "rotate", label: "Rotate", icon: RotateCcw, handler: "openModal", target: "geometryTools", categories: ["MODELING"] },
  { id: "mirror", label: "Mirror", icon: FlipHorizontal, handler: "openModal", target: "geometryTools", categories: ["MODELING"] },
  { id: "split", label: "Split Member", icon: Scissors, handler: "dispatch", target: "trigger-split", categories: ["MODELING"] },
  { id: "divide", label: "Divide Member", icon: ArrowDownUp, handler: "openModal", target: "divideMember", categories: ["MODELING"] },
  { id: "merge", label: "Merge Nodes", icon: Merge, handler: "openModal", target: "mergeNodes", categories: ["MODELING"] },
  { id: "ortho", label: "Ortho / Grid Snap", icon: Grid3X3, shortcut: "G", handler: "dispatch", target: "toggle-grid-snap", categories: ["MODELING"], quick: true, quickGroup: "view" },
  { id: "delete", label: "Delete Selection", icon: Trash2, shortcut: "Del", handler: "dispatch", target: "trigger-delete", categories: ["MODELING"] },
  // Geometry — Generators
  { id: "truss-generator", label: "Truss Generator", icon: Triangle, handler: "openModal", target: "trussGenerator", categories: ["MODELING"] },
  { id: "arch-generator", label: "Arch Generator", icon: RotateCcw, handler: "openModal", target: "archGenerator", categories: ["MODELING"] },
  { id: "frame-generator", label: "Frame Generator", icon: Building2, handler: "openModal", target: "frameGenerator", categories: ["MODELING"] },
  { id: "cable-generator", label: "Cable Pattern", icon: Cable, handler: "openModal", target: "cablePatternGenerator", categories: ["MODELING"] },
  { id: "tower-generator", label: "Tower Generator", icon: Navigation, handler: "openModal", target: "towerGenerator", categories: ["MODELING"] },
  { id: "staircase-generator", label: "Staircase Generator", icon: Building2, handler: "openModal", target: "staircaseGenerator", categories: ["MODELING"] },
  // Geometry — Arrays
  { id: "linear-array", label: "Linear Array", icon: Repeat, handler: "openModal", target: "linearArrayDialog", categories: ["MODELING"] },
  { id: "polar-array", label: "Polar Array", icon: Repeat2, handler: "openModal", target: "polarArrayDialog", categories: ["MODELING"] },
  { id: "scale", label: "Scale", icon: Maximize2, handler: "dispatch", target: "trigger-scale", categories: ["MODELING"] },
  { id: "extrude", label: "Extrude", icon: ArrowDownUp, handler: "openModal", target: "geometryTools", categories: ["MODELING"] },
  // Geometry — Measurement
  { id: "measure-distance", label: "Measure Distance", icon: Ruler, handler: "openModal", target: "measureDistanceDialog", categories: ["MODELING"] },
  { id: "measure-angle", label: "Measure Angle", icon: Scan, handler: "openModal", target: "measureAngleDialog", categories: ["MODELING"] },
  { id: "measure-area", label: "Measure Area", icon: Square, handler: "openModal", target: "measureAreaDialog", categories: ["MODELING"] },
  // Geometry — Import
  { id: "import-dxf", label: "Import DXF", icon: FileUp, handler: "openModal", target: "importDxfDialog", categories: ["MODELING"] },
  { id: "import-ifc", label: "Import IFC/BIM", icon: Import, handler: "openModal", target: "importIfcDialog", categories: ["MODELING"] },

  // ─── PROPERTIES ───
  { id: "section-library", label: "Section Database", icon: Database, handler: "openModal", target: "sectionBrowserDialog", categories: ["PROPERTIES"] },
  { id: "assign-section", label: "Assign Section", icon: Layers, shortcut: "S", handler: "openModal", target: "sectionAssign", categories: ["PROPERTIES"], quick: true, quickGroup: "properties" },
  { id: "material-library", label: "Material Library", icon: Database, handler: "openModal", target: "materialLibrary", categories: ["PROPERTIES"] },
  { id: "assign-material", label: "Assign Material", icon: Layers, handler: "openModal", target: "materialAssign", categories: ["PROPERTIES"] },
  { id: "custom-section", label: "Section Builder", icon: Square, handler: "openModal", target: "sectionBuilder", categories: ["PROPERTIES"] },
  { id: "material-props", label: "Material Properties", icon: Settings, handler: "openModal", target: "materialProperties", categories: ["PROPERTIES"] },
  { id: "beta-angle", label: "Beta Angle", icon: RotateCcw, handler: "openModal", target: "betaAngle", categories: ["PROPERTIES"] },
  { id: "releases", label: "Member Releases", icon: Settings, handler: "openModal", target: "memberReleases", categories: ["PROPERTIES"] },
  { id: "offsets", label: "Member Offsets", icon: Move, handler: "openModal", target: "memberOffsets", categories: ["PROPERTIES"] },
  // Properties — Advanced Sections & Properties
  { id: "plate-thickness", label: "Plate Thickness", icon: LayoutGrid, handler: "openModal", target: "plateThicknessDialog", categories: ["PROPERTIES"] },
  { id: "tapered-section", label: "Tapered Section", icon: TrendingUp, handler: "openModal", target: "taperedSectionDialog", categories: ["PROPERTIES"] },
  { id: "composite-section", label: "Composite Section", icon: Layers, handler: "openModal", target: "compositeSectionDialog", categories: ["PROPERTIES"] },
  { id: "import-section", label: "Import Section Table", icon: FileUp, handler: "openModal", target: "importSectionTableDialog", categories: ["PROPERTIES"] },
  { id: "cable-props", label: "Cable Properties", icon: Cable, handler: "openModal", target: "cablePropsDialog", categories: ["PROPERTIES"] },
  { id: "spring-constants", label: "Spring Constants", icon: Activity, handler: "openModal", target: "springConstantsDialog", categories: ["PROPERTIES"] },
  { id: "lumped-mass", label: "Lumped Mass", icon: Weight, handler: "openModal", target: "lumpedMassDialog", categories: ["PROPERTIES"] },
  { id: "member-hinges", label: "Member Hinges", icon: CircleDot, handler: "openModal", target: "memberHingesDialog", categories: ["PROPERTIES"] },

  // ─── SUPPORTS ───
  { id: "boundary", label: "Define Supports", icon: Anchor, handler: "openModal", target: "boundaryConditionsDialog", categories: ["SUPPORTS"] },
  { id: "support-tool", label: "Add Support (Click)", icon: Target, shortcut: "U", handler: "setTool", target: "support", categories: ["SUPPORTS"], quick: true, quickGroup: "properties" },
  { id: "fixed-support", label: "Fixed Support", icon: Lock, handler: "openModal", target: "fixedSupportDialog", categories: ["SUPPORTS"] },
  { id: "pinned-support", label: "Pinned Support", icon: CircleDot, handler: "openModal", target: "pinnedSupportDialog", categories: ["SUPPORTS"] },
  { id: "roller-support", label: "Roller Support", icon: Move, handler: "openModal", target: "rollerSupportDialog", categories: ["SUPPORTS"] },
  { id: "custom-support", label: "Custom DOF Support", icon: Settings, handler: "openModal", target: "customSupportDialog", categories: ["SUPPORTS"] },
  { id: "fixed-release-support", label: "Fixed with Releases", icon: Unlock, handler: "openModal", target: "fixedWithReleasesDialog", categories: ["SUPPORTS"] },
  { id: "inclined-support", label: "Inclined Support", icon: Navigation, handler: "openModal", target: "inclinedSupportDialog", categories: ["SUPPORTS"] },
  { id: "trans-spring", label: "Translational Spring", icon: Activity, handler: "openModal", target: "translationalSpringDialog", categories: ["SUPPORTS"] },
  { id: "rot-spring", label: "Rotational Spring", icon: RotateCcw, handler: "openModal", target: "rotationalSpringDialog", categories: ["SUPPORTS"] },
  { id: "multilinear-spring", label: "Multi-linear Spring", icon: Waves, handler: "openModal", target: "multilinearSpringDialog", categories: ["SUPPORTS"] },
  { id: "elastic-foundation", label: "Elastic Foundation", icon: Landmark, handler: "openModal", target: "elasticFoundationDialog", categories: ["SUPPORTS"] },
  { id: "batch-support", label: "Batch Assign", icon: CheckSquare, handler: "openModal", target: "batchSupportAssignDialog", categories: ["SUPPORTS"] },

  // ─── LOADING ───
  { id: "define-load", label: "Define Load Cases", icon: File, handler: "openModal", target: "is875Load", categories: ["LOADING"] },
  { id: "load-combos", label: "Load Combinations", icon: Layers, handler: "openModal", target: "loadCombinationsDialog", categories: ["LOADING"] },
  { id: "point-load", label: "Nodal Force / Moment", icon: ArrowRight, shortcut: "L", handler: "setTool", target: "load", categories: ["LOADING"], quick: true, quickGroup: "loading" },
  { id: "udl", label: "Member Load (UDL)", icon: ArrowDownUp, shortcut: "U", handler: "setTool", target: "memberLoad", categories: ["LOADING"] },
  { id: "self-weight", label: "Self Weight", icon: Download, handler: "openModal", target: "deadLoadGenerator", categories: ["LOADING"] },
  { id: "wind-load", label: "Wind Load", icon: Wind, handler: "openModal", target: "windLoadDialog", categories: ["LOADING"] },
  { id: "earthquake", label: "Seismic Load", icon: Zap, handler: "openModal", target: "seismicLoadDialog", categories: ["LOADING"] },
  { id: "temperature", label: "Temperature Load", icon: Activity, handler: "openModal", target: "temperatureLoad", categories: ["LOADING"] },
  { id: "floor-load", label: "Floor / Area Load", icon: Square, handler: "openModal", target: "floorSlabDialog", categories: ["LOADING"] },
  // Loading — Additional
  { id: "moving-load", label: "Moving / Vehicle Load", icon: Move, handler: "openModal", target: "movingLoadDialog", categories: ["LOADING"] },
  { id: "snow-load", label: "Snow Load", icon: Snowflake, handler: "openModal", target: "snowLoadDialog", categories: ["LOADING"] },
  { id: "reference-loads", label: "Reference Loads", icon: BookOpen, handler: "openModal", target: "referenceLoadsDialog", categories: ["LOADING"] },
  { id: "load-envelopes", label: "Load Envelopes", icon: Shapes, handler: "openModal", target: "loadEnvelopesDialog", categories: ["LOADING"] },
  { id: "notional-loads", label: "Notional Loads", icon: ArrowDown, handler: "openModal", target: "notionalLoadsDialog", categories: ["LOADING"] },
  { id: "load-manager", label: "Load Case Manager", icon: ListOrdered, handler: "openModal", target: "loadCaseManagerDialog", categories: ["LOADING"] },

  // ─── ANALYSIS ───
  { id: "run-analysis", label: "Run Analysis", icon: Play, shortcut: "F5", handler: "dispatch", target: "trigger-analysis", categories: ["ANALYSIS"], quick: true, quickGroup: "analysis" },
  { id: "deformed-shape", label: "Deformed Shape", icon: Activity, handler: "dispatch", target: "toggle-deformed", categories: ["ANALYSIS"] },
  { id: "sfd", label: "Shear Force Diagram", icon: BarChart3, handler: "dispatch", target: "toggle-sfd", categories: ["ANALYSIS"] },
  { id: "bmd", label: "Bending Moment Diagram", icon: BarChart3, handler: "dispatch", target: "toggle-bmd", categories: ["ANALYSIS"] },
  { id: "afd", label: "Axial Force Diagram", icon: BarChart3, handler: "dispatch", target: "toggle-afd", categories: ["ANALYSIS"] },
  { id: "deflection", label: "Deflection Diagram", icon: BarChart3, handler: "dispatch", target: "toggle-deflection", categories: ["ANALYSIS"] },
  { id: "reactions", label: "Support Reactions", icon: Anchor, handler: "dispatch", target: "toggle-reactions", categories: ["ANALYSIS"] },
  { id: "view-results", label: "Results Table", icon: Eye, handler: "dispatch", target: "toggle-results-dock", categories: ["ANALYSIS"] },
  { id: "pdelta", label: "P-Delta Analysis", icon: BarChart3, handler: "openModal", target: "pDeltaAnalysis", categories: ["ANALYSIS"] },
  { id: "buckling", label: "Buckling Analysis", icon: BarChart3, handler: "openModal", target: "bucklingAnalysis", categories: ["ANALYSIS"] },
  { id: "modal", label: "Modal Analysis", icon: BarChart3, handler: "dispatch", target: "trigger-modal-analysis", categories: ["ANALYSIS"] },
  { id: "export-results", label: "Export Results", icon: Download, handler: "dispatch", target: "trigger-export", categories: ["ANALYSIS"] },
  { id: "open-results-hub", label: "Results Hub", icon: Eye, handler: "dispatch", target: "open-results-hub", categories: ["ANALYSIS", "DESIGN"], quick: true, quickGroup: "analysis" },
  // Analysis — Additional
  { id: "cable-analysis", label: "Cable Analysis", icon: Cable, handler: "openModal", target: "cableAnalysisDialog", categories: ["ANALYSIS"] },
  { id: "stress-contour", label: "Stress Contour", icon: Hexagon, handler: "openModal", target: "stressContourDialog", categories: ["ANALYSIS"] },
  { id: "steady-state", label: "Steady-State Dynamic", icon: Gauge, handler: "openModal", target: "steadyStateDialog", categories: ["ANALYSIS"] },

  // ─── DESIGN ───
  { id: "design-codes", label: "Select Design Code", icon: Settings, handler: "openModal", target: "designCodes", categories: ["DESIGN"] },
  { id: "design-check", label: "Run Design Check", icon: Ruler, handler: "dispatch", target: "trigger-design-check", categories: ["DESIGN"] },
  { id: "design-results", label: "View Design Results", icon: Eye, handler: "dispatch", target: "toggle-results-dock", categories: ["DESIGN"] },
  { id: "steel-design", label: "Steel Design", icon: Building2, handler: "openModal", target: "steelDesign", categories: ["DESIGN"] },
  { id: "rc-design", label: "RC Design", icon: Columns, handler: "openModal", target: "concreteDesign", categories: ["DESIGN"] },
  { id: "connection-design", label: "Connection Design", icon: Link2, handler: "openModal", target: "connectionDesign", categories: ["DESIGN"] },
  { id: "foundation-design", label: "Foundation Design", icon: Landmark, handler: "openModal", target: "foundationDesign", categories: ["DESIGN"] },
  { id: "rc-detailing", label: "RC Detailing", icon: FileText, handler: "openModal", target: "rcDetailing", categories: ["DESIGN"] },
  { id: "steel-detailing", label: "Steel Detailing", icon: FileText, handler: "openModal", target: "steelDetailing", categories: ["DESIGN"] },
  { id: "section-optimize", label: "Optimize Sections", icon: Ruler, handler: "openModal", target: "sectionOptimization", categories: ["DESIGN"] },
  { id: "design-hub", label: "Full Design Hub", icon: Ruler, handler: "openModal", target: "designHub", categories: ["DESIGN"] },
  { id: "full-report", label: "Generate Report", icon: FileText, handler: "dispatch", target: "trigger-pdf-report", categories: ["DESIGN"] },
  // Design — Additional
  { id: "timber-design", label: "Timber Design", icon: TreePine, handler: "openModal", target: "timberDesignDialog", categories: ["DESIGN"] },
  { id: "composite-design", label: "Composite Design", icon: Layers, handler: "openModal", target: "compositeDesignDialog", categories: ["DESIGN"] },
  { id: "aluminum-design", label: "Aluminum Design", icon: Hexagon, handler: "openModal", target: "aluminumDesignDialog", categories: ["DESIGN"] },
];

const SIDEBAR_CURATED_ACTION_IDS: Record<SidebarCategory, string[]> = {
  MODELING: ["select", "add-node", "add-beam", "add-plate", "copy", "move", "delete", "truss-generator", "frame-generator", "measure-distance"],
  PROPERTIES: ["assign-section", "assign-material", "releases", "offsets", "plate-thickness", "cable-props"],
  SUPPORTS: ["boundary", "support-tool", "fixed-support", "pinned-support", "roller-support", "custom-support", "batch-support"],
  LOADING: ["define-load", "point-load", "udl", "load-combos", "self-weight", "moving-load", "snow-load", "load-manager"],
  ANALYSIS: ["run-analysis", "deformed-shape", "sfd", "bmd", "view-results", "open-results-hub", "cable-analysis", "stress-contour"],
  DESIGN: ["steel-design", "rc-design", "foundation-design", "full-report", "open-results-hub", "timber-design", "composite-design"],
};

export const getActionsForSidebarCategory = (category: SidebarCategory): SidebarAction[] => {
  const actionIds = new Set(SIDEBAR_CURATED_ACTION_IDS[category] || []);
  return MODELING_ACTIONS.filter(
    (action) => action.categories.includes(category) && actionIds.has(action.id),
  );
};

export const getQuickActionIds = (): SidebarAction[] =>
  MODELING_ACTIONS.filter((action) => action.quick);
