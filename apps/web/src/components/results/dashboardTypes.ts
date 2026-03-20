/**
 * Shared types, constants, and utilities for the AnalysisResultsDashboard
 */

import {
  BarChart2,
  Activity,
  TrendingDown,
  ArrowUpDown,
  Flame,
  FileText,
  Grid3X3,
  ArrowDown,
  Layers,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import type { LoadCombination } from "../../hooks/useAnalysis";

// ============================================
// TYPES
// ============================================

export interface NodeResult {
  id: string;
  x: number;
  y: number;
  z: number;
  displacement: {
    dx: number;
    dy: number;
    dz: number;
    rx?: number;
    ry?: number;
    rz?: number;
  };
  reaction?: {
    fx: number;
    fy: number;
    fz: number;
    mx?: number;
    my?: number;
    mz?: number;
  };
}

export interface MemberResult {
  id: string;
  startNodeId: string;
  endNodeId: string;
  length: number;
  sectionType?: string;
  /** Material type for DC ratio display — steel uses Rust/WASM, concrete uses Python */
  materialType?: 'steel' | 'concrete';
  maxShear: number;
  minShear: number;
  maxMoment: number;
  minMoment: number;
  maxAxial: number;
  minAxial: number;
  maxDeflection: number;
  maxShearZ?: number;
  maxMomentY?: number;
  torsion?: number;
  sectionProps?: {
    A?: number;
    I?: number;
    Iy?: number;
    E?: number;
    fy?: number;
    c?: number;
  };
  stress: number;
  utilization: number;
  diagramData?: {
    x_values: number[];
    shear_values: number[];
    moment_values: number[];
    axial_values: number[];
    deflection_values: number[];
    shear_z_values?: number[];
    moment_y_values?: number[];
    deflection_z_values?: number[];
  };
}

export interface AnalysisResultsData {
  nodes: NodeResult[];
  members: MemberResult[];
  /** Load combination results from analysis — populated when multi-case analysis is run */
  loadCombos?: LoadCombination[];
  summary: {
    totalNodes: number;
    totalMembers: number;
    totalDOF: number;
    maxDisplacement: number;
    maxStress: number;
    maxForce?: number;
    maxUtilization: number;
    analysisTime: number;
    status: "success" | "warning" | "error";
  };
  equilibriumCheck?: {
    applied_forces: number[];
    reaction_forces: number[];
    residual: number[];
    error_percent: number;
    pass: boolean;
  };
  conditionNumber?: number;
  serviceabilityChecks?: Array<{
    memberId: string;
    length: number;
    maxDeflection: number;
    ratios: Array<{
      limit: string;
      code: string;
      allowable: number;
      actual: number;
      ratio: number;
      pass: boolean;
    }>;
    worstRatio: number;
    pass: boolean;
  }>;
}

export type ViewMode =
  | "overview"
  | "diagrams"
  | "heatmap"
  | "reactions"
  | "detailed"
  | "dcRatio"
  | "loadCombos"
  | "stability";

export type DiagramType = "SFD" | "BMD" | "AFD" | "DEFLECTION" | "BMD_MY" | "SFD_VZ";

export interface AnalysisResultsDashboardProps {
  results: AnalysisResultsData;
  onClose?: () => void;
  onExport?: (format: "pdf" | "excel" | "json") => void;
  onMemberSelect?: (memberId: string) => void;
  isLoading?: boolean;
  progress?: import('../../hooks/useAnalysis').AnalysisProgressStep[];
}

// ============================================
// CONSTANTS
// ============================================

export const VIEW_MODES = [
  { id: "overview" as const, label: "Overview", icon: Grid3X3 },
  { id: "diagrams" as const, label: "Force Diagrams", icon: BarChart2 },
  { id: "heatmap" as const, label: "Heat Map", icon: Flame },
  { id: "reactions" as const, label: "Reactions", icon: ArrowDown },
  { id: "dcRatio" as const, label: "D/C Summary", icon: ArrowUpDown },
  { id: "stability" as const, label: "Stability", icon: Activity },
  { id: "loadCombos" as const, label: "Load Combos", icon: Layers },
  { id: "detailed" as const, label: "Detailed", icon: FileText },
];

export const DEFLECTION_LIMITS: { label: string; ratio: number; code: string }[] = [
  { label: "Floor beams (L/240)", ratio: 240, code: "ASCE 7 / IS 800" },
  { label: "Roof beams (L/180)", ratio: 180, code: "ASCE 7 / IS 800" },
  { label: "Cantilevers (L/120)", ratio: 120, code: "General" },
  { label: "Sensitive finishes (L/360)", ratio: 360, code: "ACI 318 / IS 456" },
];

export const STATUS_COLORS = {
  success: {
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    text: "text-green-400",
    icon: CheckCircle,
  },
  warning: {
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
    icon: AlertTriangle,
  },
  error: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    icon: XCircle,
  },
};

export const DIAGRAM_COLORS: Record<
  DiagramType,
  { line: string; fill: string; fillNeg: string; label: string }
> = {
  SFD: {
    line: "#f97316",
    fill: "rgba(249,115,22,0.25)",
    fillNeg: "rgba(59,130,246,0.25)",
    label: "Shear Vy (kN)",
  },
  BMD: {
    line: "#22c55e",
    fill: "rgba(34,197,94,0.25)",
    fillNeg: "rgba(239,68,68,0.25)",
    label: "Moment Mz (kNm)",
  },
  AFD: {
    line: "#ef4444",
    fill: "rgba(239,68,68,0.25)",
    fillNeg: "rgba(59,130,246,0.25)",
    label: "Axial (kN)",
  },
  DEFLECTION: {
    line: "#3b82f6",
    fill: "rgba(59,130,246,0.25)",
    fillNeg: "rgba(59,130,246,0.15)",
    label: "Defl. (mm)",
  },
  BMD_MY: {
    line: "#14b8a6",
    fill: "rgba(20,184,166,0.25)",
    fillNeg: "rgba(239,68,68,0.25)",
    label: "Moment My (kNm)",
  },
  SFD_VZ: {
    line: "#0891b2",
    fill: "rgba(8,145,178,0.25)",
    fillNeg: "rgba(59,130,246,0.25)",
    label: "Shear Vz (kN)",
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

export const formatNumber = (value: number, precision: number = 2): string => {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs < 1e-10) return "0";
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return `${(value / 1e3).toFixed(1)}k`;
  if (abs >= 1) return value.toFixed(precision);
  if (abs >= 0.001) return value.toFixed(4);
  return value.toExponential(1);
};

export const formatEngineering = (value: number): string => {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs < 1e-10) return "0";
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}k`;
  if (abs >= 1) return value.toFixed(3);
  if (abs >= 0.001) return value.toFixed(4);
  return value.toExponential(2);
};

export const getUtilizationStatus = (
  util: number,
): "safe" | "warning" | "critical" | "failed" => {
  if (util <= 0.7) return "safe";
  if (util <= 0.9) return "warning";
  if (util <= 1.0) return "critical";
  return "failed";
};
