/**
 * Report Schema — Structured report generation contract
 *
 * Defines the JSON schema for design reports with:
 * - Code-clause traceability (every result links to a specific clause)
 * - Governing check identification
 * - Section-wise and member-wise tabulation
 * - Export-ready structure (PDF, CSV, DXF)
 */

import type { CheckResult, ClauseRef, EngineResult } from './resultContract';

// ─── Report Metadata ───────────────────────────────────────────────────

export interface ReportMetadata {
  projectName: string;
  projectId: string;
  engineer: string;
  checker?: string;
  date: string;             // ISO 8601
  designCode: string;       // e.g. "IS 456:2000", "IS 800:2007"
  analysisMethod: string;   // e.g. "Direct Stiffness Method (3D)"
  softwareVersion: string;
  notes?: string;
}

// ─── Member Design Report ──────────────────────────────────────────────

export interface MemberDesignReport {
  memberId: string;
  memberLabel?: string;
  startNode: string;
  endNode: string;
  length: number;        // m
  lengthUnit: string;

  /** Section assignment */
  section: {
    name: string;        // e.g. "ISMB 400", "300×600 RC"
    type: string;        // e.g. "I-beam", "rectangular", "pipe"
    area: number;        // mm²
    iy: number;          // mm⁴
    iz: number;          // mm⁴
    j: number;           // mm⁴
  };

  /** Material assignment */
  material: {
    name: string;        // e.g. "Fe 250", "M25 concrete"
    E: number;           // N/mm²
    fy: number;          // N/mm²
    fck?: number;        // N/mm² (concrete)
    G: number;           // N/mm²
  };

  /** Design demands (governing) */
  demands: {
    axial: number;       // kN
    shearY: number;      // kN
    shearZ: number;      // kN
    momentY: number;     // kN·m
    momentZ: number;     // kN·m
    torsion: number;     // kN·m
    governingCombo: string;
  };

  /** Design checks */
  checks: CheckResult[];

  /** Overall result */
  passed: boolean;
  maxUtilization: number;
  governingCheck: string;
  status: 'ADEQUATE' | 'INADEQUATE' | 'NOT_CHECKED';
}

// ─── Section-Wise Report (for RC beams) ────────────────────────────────

export interface SectionWiseReport {
  memberId: string;
  sections: SectionDesignEntry[];
}

export interface SectionDesignEntry {
  position: number;      // fractional (0–1)
  distance: number;      // mm from start
  label: string;         // e.g. "0.0L", "0.5L", "1.0L"
  moment: number;        // kN·m
  shear: number;         // kN
  momentType: 'sagging' | 'hogging';

  /** Reinforcement provided */
  reinforcement?: {
    tensionBars: string;   // e.g. "4-20φ"
    compressionBars?: string;
    stirrups?: string;     // e.g. "8φ @ 150 c/c"
    astProvided: number;   // mm²
    astRequired: number;   // mm²
  };

  /** Checks at this section */
  checks: CheckResult[];
  utilization: number;
  passed: boolean;
}

// ─── Load Combination Summary ──────────────────────────────────────────

export interface CombinationSummary {
  id: string;
  name: string;
  code: string;
  factors: { loadCaseId: string; loadCaseName: string; factor: number }[];
  isServiceability: boolean;
}

// ─── Full Design Report ────────────────────────────────────────────────

export interface DesignReport {
  metadata: ReportMetadata;
  combinations: CombinationSummary[];
  memberReports: MemberDesignReport[];
  sectionWiseReports?: SectionWiseReport[];

  /** Summary statistics */
  summary: {
    totalMembers: number;
    membersChecked: number;
    membersPassed: number;
    membersFailed: number;
    maxUtilization: number;
    criticalMemberId: string;
    criticalCheck: string;
    criticalClause: ClauseRef;
  };

  /** Engine results from all calculation engines */
  engineResults?: EngineResult[];
}

// ─── Export Contracts ──────────────────────────────────────────────────

/** CSV export row for member forces */
export interface ForceTableCSVRow {
  memberId: string;
  position: number;
  distance: number;
  axial: number;
  shearY: number;
  shearZ: number;
  torsion: number;
  momentY: number;
  momentZ: number;
  combination: string;
}

/** CSV export row for design summary */
export interface DesignSummaryCSVRow {
  memberId: string;
  section: string;
  material: string;
  length: number;
  maxUtilization: number;
  governingCheck: string;
  governingClause: string;
  status: string;
}

/**
 * Generate CSV content from force table rows.
 */
export function forceTableToCSV(rows: ForceTableCSVRow[]): string {
  const header = 'Member,Position,Distance,Axial(kN),ShearY(kN),ShearZ(kN),Torsion(kN·m),MomentY(kN·m),MomentZ(kN·m),Combination';
  const lines = rows.map(
    (r) =>
      `${r.memberId},${r.position.toFixed(3)},${r.distance.toFixed(1)},${r.axial.toFixed(2)},${r.shearY.toFixed(2)},${r.shearZ.toFixed(2)},${r.torsion.toFixed(2)},${r.momentY.toFixed(2)},${r.momentZ.toFixed(2)},${r.combination}`,
  );
  return [header, ...lines].join('\n');
}

/**
 * Generate CSV content from design summary rows.
 */
export function designSummaryToCSV(rows: DesignSummaryCSVRow[]): string {
  const header = 'Member,Section,Material,Length(m),MaxUtilization,GoverningCheck,GoverningClause,Status';
  const lines = rows.map(
    (r) =>
      `${r.memberId},${r.section},${r.material},${r.length.toFixed(3)},${r.maxUtilization.toFixed(3)},${r.governingCheck},${r.governingClause},${r.status}`,
  );
  return [header, ...lines].join('\n');
}
