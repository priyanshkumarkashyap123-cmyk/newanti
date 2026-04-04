/**
 * ReportTypes.ts
 *
 * Centralized TypeScript interfaces and enums for all BeamLab report types.
 * Imported by report pages, services, and template components.
 */

// ─── Branding ──────────────────────────────────────────────────────────────

/**
 * Branding configuration injected into every report.
 * Defaults come from BrandingConstants — override per-report if needed.
 */
export interface BrandingConfig {
  /** Company / platform name shown in header */
  companyName: string;
  /** Tagline shown below company name */
  tagline: string;
  /** Website URL shown in header */
  website: string;
  /** Contact e-mail shown in header */
  email: string;
  /** Logo image path (SVG or PNG, must be publicly accessible) */
  logoSrc: string;
  /** Primary brand color (hex) — navy accent bar */
  primaryColor: string;
  /** Accent color (hex) — gold stripe */
  accentColor: string;
  /** Disclaimer shown in footer */
  disclaimer: string;
}

// ─── Report Metadata ───────────────────────────────────────────────────────

/** Project-level metadata shown on cover page and running header */
export interface ReportMetadata {
  /** Project name / title */
  projectName: string;
  /** Short document reference number (e.g. BL-01234) */
  docRef: string;
  /** Revision code (e.g. R0, 00, A) */
  revision: string;
  /** Prepared by — engineer name */
  preparedBy: string;
  /** Checked by — checker name */
  checkedBy?: string;
  /** Approved by — approver name */
  approvedBy?: string;
  /** Client name */
  client?: string;
  /** Project location */
  location?: string;
  /** Project number / job number */
  projectNumber?: string;
  /** Issue date string (pre-formatted) */
  date: string;
  /** Report status — drives cover page status chip */
  status: 'Draft' | 'Issued for Review' | 'Issued for Construction' | 'Superseded';
  /** Report type label on cover page */
  reportType: string;
  /** Design code(s) applied */
  designCodes?: string;
}

// ─── Sections ──────────────────────────────────────────────────────────────

export type ReportSectionType =
  | 'cover'
  | 'toc'
  | 'summary'
  | 'geometry'
  | 'materials'
  | 'loads'
  | 'combinations'
  | 'analysis'
  | 'reactions'
  | 'memberForces'
  | 'displacements'
  | 'steelDesign'
  | 'concreteDesign'
  | 'foundationDesign'
  | 'connectionDesign'
  | 'codeCheck'
  | 'appendix'
  | 'custom';

export interface ReportSection {
  id: string;
  type: ReportSectionType;
  title: string;
  /** Whether this section is included in the output */
  enabled: boolean;
  /** Whether the on-screen accordion is expanded */
  expanded: boolean;
  /** Section-specific options (design code, include diagrams, etc.) */
  options: Record<string, boolean | string | number>;
}

// ─── KPI / Status ──────────────────────────────────────────────────────────

export type KpiStatus = 'pass' | 'warn' | 'fail' | 'info';

export interface KpiCardData {
  label: string;
  value: string | number;
  unit?: string;
  status?: KpiStatus;
}

export type StatusPillValue = 'PASS' | 'FAIL' | 'WARN' | 'N/A';

// ─── Export Settings ───────────────────────────────────────────────────────

export type ExportFormat = 'pdf' | 'xlsx' | 'html' | 'dxf' | 'ifc' | 'csv' | 'docx';
export type PaperSize = 'A4' | 'A3' | 'A2' | 'A1' | 'Letter' | 'Legal';
export type PaperOrientation = 'portrait' | 'landscape';

export interface ReportSettings {
  format: ExportFormat;
  paperSize: PaperSize;
  orientation: PaperOrientation;
  /** Include company logo in header */
  includeLogo: boolean;
  /** Include running page header/footer */
  includeHeaderFooter: boolean;
  /** Include page numbers */
  includePageNumbers: boolean;
  /** Include branding watermark (for draft status) */
  includeDraftWatermark: boolean;
}

// ─── Result Helpers ────────────────────────────────────────────────────────

/** Utilization ratio thresholds */
export const UTILIZATION_THRESHOLDS = {
  pass: 1.0,
  warn: 0.85,
} as const;

/** Map utilization ratio to KPI status */
export function utilizationToStatus(ratio: number): KpiStatus {
  if (ratio > UTILIZATION_THRESHOLDS.pass) return 'fail';
  if (ratio > UTILIZATION_THRESHOLDS.warn) return 'warn';
  return 'pass';
}

/** Map utilization to StatusPill value */
export function utilizationToStatusPill(ratio: number): StatusPillValue {
  if (ratio > 1.0) return 'FAIL';
  if (ratio > 0.85) return 'WARN';
  return 'PASS';
}
