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

  { id: "section-library", label: "Section Database", icon: Database, handler: "openModal", target: "sectionBrowserDialog", categories: ["PROPERTIES"] },
  { id: "assign-section", label: "Assign Section", icon: Layers, shortcut: "S", handler: "openModal", target: "sectionAssign", categories: ["PROPERTIES"], quick: true, quickGroup: "properties" },
  { id: "material-library", label: "Material Library", icon: Database, handler: "openModal", target: "materialLibrary", categories: ["PROPERTIES"] },
  { id: "assign-material", label: "Assign Material", icon: Layers, handler: "openModal", target: "materialAssign", categories: ["PROPERTIES"] },
  { id: "custom-section", label: "Section Builder", icon: Square, handler: "openModal", target: "sectionBuilder", categories: ["PROPERTIES"] },
  { id: "material-props", label: "Material Properties", icon: Settings, handler: "openModal", target: "materialProperties", categories: ["PROPERTIES"] },
  { id: "beta-angle", label: "Beta Angle", icon: RotateCcw, handler: "openModal", target: "betaAngle", categories: ["PROPERTIES"] },
  { id: "releases", label: "Member Releases", icon: Settings, handler: "openModal", target: "memberReleases", categories: ["PROPERTIES"] },
  { id: "offsets", label: "Member Offsets", icon: Move, handler: "openModal", target: "memberOffsets", categories: ["PROPERTIES"] },

  { id: "boundary", label: "Define Supports", icon: Anchor, handler: "openModal", target: "boundaryConditionsDialog", categories: ["SUPPORTS"] },
  { id: "support-tool", label: "Add Support (Click)", icon: Target, shortcut: "U", handler: "setTool", target: "support", categories: ["SUPPORTS"], quick: true, quickGroup: "properties" },

  { id: "define-load", label: "Define Load Cases", icon: File, handler: "openModal", target: "is875Load", categories: ["LOADING"] },
  { id: "load-combos", label: "Load Combinations", icon: Layers, handler: "openModal", target: "loadCombinationsDialog", categories: ["LOADING"] },
  { id: "point-load", label: "Nodal Force / Moment", icon: ArrowRight, shortcut: "L", handler: "setTool", target: "load", categories: ["LOADING"], quick: true, quickGroup: "loading" },
  { id: "udl", label: "Member Load (UDL)", icon: ArrowDownUp, shortcut: "U", handler: "setTool", target: "memberLoad", categories: ["LOADING"] },
  { id: "self-weight", label: "Self Weight", icon: Download, handler: "openModal", target: "deadLoadGenerator", categories: ["LOADING"] },
  { id: "wind-load", label: "Wind Load", icon: Wind, handler: "openModal", target: "windLoadDialog", categories: ["LOADING"] },
  { id: "earthquake", label: "Seismic Load", icon: Zap, handler: "openModal", target: "seismicLoadDialog", categories: ["LOADING"] },
  { id: "temperature", label: "Temperature Load", icon: Activity, handler: "openModal", target: "temperatureLoad", categories: ["LOADING"] },
  { id: "floor-load", label: "Floor / Area Load", icon: Square, handler: "openModal", target: "floorSlabDialog", categories: ["LOADING"] },

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

  { id: "design-codes", label: "Select Design Code", icon: Settings, handler: "openModal", target: "designCodes", categories: ["DESIGN"] },
  { id: "design-check", label: "Run Design Check", icon: Ruler, handler: "dispatch", target: "trigger-analysis", categories: ["DESIGN"] },
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
];

const SIDEBAR_CURATED_ACTION_IDS: Record<SidebarCategory, string[]> = {
  MODELING: ["select", "add-node", "add-beam", "add-plate", "copy", "move", "delete"],
  PROPERTIES: ["assign-section", "assign-material", "releases", "offsets"],
  SUPPORTS: ["boundary", "support-tool"],
  LOADING: ["define-load", "point-load", "udl", "load-combos", "self-weight"],
  ANALYSIS: ["run-analysis", "deformed-shape", "sfd", "bmd", "view-results"],
  DESIGN: ["steel-design", "rc-design", "foundation-design", "pdf-report", "design-hub"],
};

export const getActionsForSidebarCategory = (category: SidebarCategory): SidebarAction[] => {
  const actionIds = new Set(SIDEBAR_CURATED_ACTION_IDS[category] || []);
  return MODELING_ACTIONS.filter(
    (action) => action.categories.includes(category) && actionIds.has(action.id),
  );
};

export const getQuickActionIds = (): SidebarAction[] =>
  MODELING_ACTIONS.filter((action) => action.quick);
