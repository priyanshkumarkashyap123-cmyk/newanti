/**
 * Shared types and helpers for PostProcessingDesignStudio components
 */

import type { Member } from "../../store/model";
import type { DesignResult as MemberDesignResult } from "../../services/MemberDesignService";

// ============================================
// TYPES
// ============================================

export interface DesignStudioProps {
  onClose: () => void;
}

export type TabId =
  | "summary"
  | "rcBeam"
  | "rcColumn"
  | "steel"
  | "section"
  | "deflection";

export interface IS800DesignResult {
  checks: Array<{ name: string; utilization: number; status: 'PASS' | 'FAIL' | 'WARNING'; description?: string }>;
  governingCheck: string;
  utilization: number;
}

/** Python backend RC beam result fields */
export interface PythonRCBeamResult {
  momentCapacity: number;
  shearCapacity: number;
  /** Main reinforcement area in mm² */
  mainReinforcement: number;
  stirrupSpacing: number;
  utilizationRatio: number;
  status: 'PASS' | 'FAIL' | 'WARNING';
}

export interface MemberDesignRow {
  id: string;
  label: string;
  length: number;
  materialType: "steel" | "concrete" | "custom";
  sectionType: string;
  /** Design code used for primary checks */
  designCode?: 'AISC360' | 'IS800' | 'EC3';
  /** IS 800:2007 design results when available from Python backend */
  is800Result?: IS800DesignResult;
  /** Python backend RC beam result — overrides local design when present */
  pythonRCResult?: PythonRCBeamResult;
  // forces (max envelope)
  maxAxial: number;
  maxShearY: number;
  maxMomentZ: number;
  // design result
  utilization: number;
  status: "PASS" | "FAIL" | "WARNING";
  governing: string;
  designResult: MemberDesignResult;
}

export type SortKey =
  | "id"
  | "length"
  | "utilization"
  | "maxMomentZ"
  | "maxShearY"
  | "maxAxial";

// ============================================
// HELPERS
// ============================================

/** Compute member length from node coordinates */
export function memberLength(
  m: Member,
  nodes: Map<string, { x: number; y: number; z?: number }>,
): number {
  const n1 = nodes.get(m.startNodeId);
  const n2 = nodes.get(m.endNodeId);
  if (!n1 || !n2) return 5;
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const dz = (n2.z ?? 0) - (n1.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
}

/** Status badge colors */
export const statusColors = {
  PASS: {
    bg: "bg-emerald-500/20",
    text: "text-emerald-400",
    border: "border-emerald-500",
    dot: "bg-emerald-500",
  },
  FAIL: {
    bg: "bg-red-500/20",
    text: "text-red-400",
    border: "border-red-500",
    dot: "bg-red-500",
  },
  WARNING: {
    bg: "bg-amber-500/20",
    text: "text-amber-400",
    border: "border-amber-500",
    dot: "bg-amber-500",
  },
};

/** Utilization bar color */
export function utilizationColor(u: number): string {
  if (u <= 0.6) return "bg-emerald-500";
  if (u <= 0.8) return "bg-lime-500";
  if (u <= 0.9) return "bg-amber-500";
  if (u <= 1.0) return "bg-orange-500";
  return "bg-red-500";
}

export function utilizationTextColor(u: number): string {
  if (u <= 0.6) return "text-emerald-400";
  if (u <= 0.8) return "text-lime-400";
  if (u <= 0.9) return "text-amber-400";
  if (u <= 1.0) return "text-orange-400";
  return "text-red-400";
}

/** Format kN with sign */
export function fmtForce(v: number): string {
  return v.toFixed(2);
}
