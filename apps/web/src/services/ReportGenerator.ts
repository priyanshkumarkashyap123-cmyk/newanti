/**
 * ReportGenerator - Professional PDF Report Generator for BeamLab
 * Generates analysis reports with project info, 3D snapshots, and results tables
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { LOGO_BASE64 } from "../utils/LogoData";

// ============================================
// TYPES
// ============================================

export interface ProjectData {
  projectName: string;
  clientName?: string;
  engineerName?: string;
  projectNumber?: string;
  description?: string;
}

export interface NodeDisplacementRow {
  nodeId: string;
  dx: number;
  dy: number;
  dz: number;
  rx?: number;
  ry?: number;
  rz?: number;
}

export interface MemberForceRow {
  memberId: string;
  axial: number;
  shearY: number;
  shearZ?: number;
  momentY?: number;
  momentZ: number;
  torsion?: number;
}

export interface ReactionRow {
  nodeId: string;
  fx: number;
  fy: number;
  fz?: number;
  mx?: number;
  my?: number;
  mz?: number;
}

export interface DesignResult {
  memberId: string;
  section: string;
  criticalRatio: number;
  status: "PASS" | "FAIL";
  clause: string;
  designCode: "IS 800:2007" | "AISC 360-16" | "IS 456:2000" | "ACI 318-19";
  checkType: string; // e.g., 'Tension', 'Compression', 'Flexure', 'Combined'
  failureReason?: string; // Explanation if failed
}

function safeAbsMax(values: number[] | undefined, fallback: number): number {
  if (!values || values.length === 0) return fallback;
  const m = Math.max(...values.map((v) => Math.abs(v)));
  return Number.isFinite(m) && m > 0 ? m : fallback;
}

// ============================================
// REPORT GENERATOR CLASS
// ============================================

// ============================================
// PROFESSIONAL REPORT THEME CONSTANTS
// ============================================
const THEME = {
  // Primary brand colors
  primary:      [18,  55, 106] as [number, number, number],  // Deep navy
  primaryLight: [41,  98, 168] as [number, number, number],  // Medium blue
  accent:       [0,  133, 202] as [number, number, number],  // Bright accent
  accentGold:   [191, 155,  48] as [number, number, number], // Gold accent

  // Status colors
  pass:    [21, 128,  61] as [number, number, number],
  fail:    [185, 28,  28] as [number, number, number],
  warn:    [180, 120,  10] as [number, number, number],

  // Neutrals
  text:         [30,  30,  35] as [number, number, number],
  textSecondary:[100, 105, 115] as [number, number, number],
  textMuted:    [150, 155, 165] as [number, number, number],
  headerBg:     [18,  55, 106] as [number, number, number],
  headerText:   [255, 255, 255] as [number, number, number],
  rowAlt:       [243, 246, 251] as [number, number, number],
  border:       [210, 215, 225] as [number, number, number],
  borderDark:   [170, 175, 185] as [number, number, number],
  white:        [255, 255, 255] as [number, number, number],
  coverBg:      [18,  55, 106] as [number, number, number],
  coverText:    [255, 255, 255] as [number, number, number],
  coverAccent:  [0,  133, 202] as [number, number, number],
  calcBoxBg:    [250, 251, 254] as [number, number, number],
  calcBoxBorder:[180, 195, 220] as [number, number, number],
};

export class ReportGenerator {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;
  private headerHeight: number = 18;
  private footerHeight: number = 14;
  private contentTop: number;
  private figureCount: number = 0;
  private tableCount: number = 0;
  private sectionNumber: number = 0;
  private headerOpCountByPage: Map<number, number> = new Map();
  private documentRef: string = '';
  private projectTitle: string = 'Structural Analysis Report';
  private revision: string = '00';
  private preparedBy: string = '';
  private tocEntries: Array<{ level: number; number: string; title: string; page: number }> = [];

  /** Maximum Y position before content would overlap the footer. */
  private get usableBottom(): number {
    return this.pageHeight - this.footerHeight - this.margin;
  }

  /** Remaining vertical space (mm) on the current page. */
  private get remainingSpace(): number {
    return this.usableBottom - this.contentTop;
  }

  constructor() {
    this.doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    this.doc.setFont("helvetica");
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.contentTop = this.margin + this.headerHeight;
  }

  // ============================================
  // COVER PAGE — Industry Standard
  // ============================================

  /**
   * Generate a professional full-page cover following
   * ARUP / WSP / Buro Happold engineering report standards.
   */
  addCoverPage(options: {
    projectName: string;
    subtitle?: string;
    clientName?: string;
    projectNumber?: string;
    engineerName?: string;
    checkedBy?: string;
    approvedBy?: string;
    revision?: string;
    classification?: string;
    date?: Date;
    companyName?: string;
    companyAddress?: string;
  }): void {
    const {
      projectName,
      subtitle = 'Structural Analysis Report',
      clientName = '',
      projectNumber = '',
      engineerName = '',
      checkedBy = '',
      approvedBy = '',
      revision = '00',
      classification = 'CONFIDENTIAL',
      date = new Date(),
      companyName = 'BeamLab',
      companyAddress = 'beamlab.app',
    } = options;

    // Store metadata for headers/footers
    this.projectTitle = projectName;
    this.revision = revision;
    this.preparedBy = engineerName;
    this.documentRef = `BL-${String((projectName.length * 37) + (projectNumber.length * 53) + 1000).padStart(5, '0')}`;

    const pw = this.pageWidth;
    const ph = this.pageHeight;

    // — Full-page navy background —
    this.doc.setFillColor(...THEME.coverBg);
    this.doc.rect(0, 0, pw, ph, 'F');

    // — Accent stripe at top —
    this.doc.setFillColor(...THEME.accent);
    this.doc.rect(0, 0, pw, 4, 'F');

    // — Gold accent bar —
    this.doc.setFillColor(...THEME.accentGold);
    this.doc.rect(0, 4, pw, 2, 'F');

    // — Company branding area (top-left) —
    const brandY = 28;
    // Add logo icon
    try {
      this.doc.addImage(LOGO_BASE64, 'PNG', this.margin, brandY - 16, 16, 16);
    } catch (e) {
      console.error('Could not add logo to cover page', e);
    }
    this.doc.setFontSize(22);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.coverText);
    this.doc.text('BeamLab', this.margin + 20, brandY);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...THEME.coverAccent);
    this.doc.text('STRUCTURAL ANALYSIS', this.margin + 20, brandY + 7);

    // — Classification badge (top-right) —
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(200, 200, 200);
    this.doc.text(classification, pw - this.margin, brandY - 8, { align: 'right' });

    // — Decorative divider line —
    this.doc.setDrawColor(...THEME.accent);
    this.doc.setLineWidth(0.8);
    this.doc.line(this.margin, 50, pw - this.margin, 50);

    // — Main title block (centred) —
    const titleY = ph * 0.30;
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.coverAccent);
    const letterSpaced = 'S T R U C T U R A L   A N A L Y S I S   R E P O R T';
    this.doc.text(letterSpaced, pw / 2, titleY - 10, { align: 'center' });

    // — Accent line above title —
    this.doc.setDrawColor(...THEME.accentGold);
    this.doc.setLineWidth(1);
    this.doc.line(pw / 2 - 40, titleY - 4, pw / 2 + 40, titleY - 4);

    // — Project name (large) —
    this.doc.setFontSize(28);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.coverText);
    const titleLines = this.doc.splitTextToSize(projectName, pw - 2 * this.margin - 20);
    this.doc.text(titleLines, pw / 2, titleY + 8, { align: 'center' });

    // — Subtitle —
    const subtitleY = titleY + 8 + titleLines.length * 12 + 5;
    this.doc.setFontSize(13);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(180, 200, 230);
    this.doc.text(subtitle, pw / 2, subtitleY, { align: 'center' });

    // — Accent line below subtitle —
    this.doc.setDrawColor(...THEME.accentGold);
    this.doc.setLineWidth(1);
    this.doc.line(pw / 2 - 40, subtitleY + 8, pw / 2 + 40, subtitleY + 8);

    // — Document reference and revision —
    const refY = subtitleY + 22;
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(170, 190, 220);
    this.doc.text(`Document Ref: ${this.documentRef}`, pw / 2, refY, { align: 'center' });
    this.doc.text(`Revision ${revision}  |  ${format(date, 'dd MMMM yyyy')}`, pw / 2, refY + 6, { align: 'center' });

    // — Document Control mini-table at bottom —
    const tableTop = ph - 95;
    const colW = (pw - 2 * this.margin) / 4;

    // Table border
    this.doc.setDrawColor(80, 120, 170);
    this.doc.setLineWidth(0.5);
    this.doc.setFillColor(15, 45, 85);
    this.doc.rect(this.margin, tableTop, pw - 2 * this.margin, 60, 'FD');

    // Table header row
    this.doc.setFillColor(12, 38, 72);
    this.doc.rect(this.margin, tableTop, pw - 2 * this.margin, 12, 'F');
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.coverAccent);
    const colHeaders = ['PROJECT', 'CLIENT', 'DOCUMENT NO.', 'REVISION'];
    colHeaders.forEach((h, i) => {
      this.doc.text(h, this.margin + colW * i + colW / 2, tableTop + 8, { align: 'center' });
    });

    // Table value row
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...THEME.coverText);
    const colValues = [projectName.slice(0, 22), clientName || '—', this.documentRef, revision];
    colValues.forEach((v, i) => {
      this.doc.text(v, this.margin + colW * i + colW / 2, tableTop + 20, { align: 'center' });
    });

    // Horizontal divider
    this.doc.setDrawColor(80, 120, 170);
    this.doc.line(this.margin, tableTop + 26, pw - this.margin, tableTop + 26);

    // Second row headers
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.coverAccent);
    const row2Headers = ['PREPARED BY', 'CHECKED BY', 'APPROVED BY', 'DATE'];
    row2Headers.forEach((h, i) => {
      this.doc.text(h, this.margin + colW * i + colW / 2, tableTop + 34, { align: 'center' });
    });

    // Second row values
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...THEME.coverText);
    const row2Values = [engineerName || '—', checkedBy || '—', approvedBy || '—', format(date, 'dd/MM/yyyy')];
    row2Values.forEach((v, i) => {
      this.doc.text(v, this.margin + colW * i + colW / 2, tableTop + 44, { align: 'center' });
    });

    // — Status line —
    const statusY = tableTop + 55;
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.accentGold);
    this.doc.text('STATUS: ISSUED FOR REVIEW', this.margin + 5, statusY);

    // — Bottom accent bar —
    this.doc.setFillColor(...THEME.accent);
    this.doc.rect(0, ph - 6, pw, 4, 'F');
    this.doc.setFillColor(...THEME.accentGold);
    this.doc.rect(0, ph - 2, pw, 2, 'F');

    // — Footer text —
    this.doc.setFontSize(7);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(120, 150, 190);
    this.doc.text(`© ${new Date().getFullYear()} ${companyName}. All rights reserved.`, this.margin, ph - 10);
    this.doc.text(companyAddress, pw - this.margin, ph - 10, { align: 'right' });
  }

  // ============================================
  // DOCUMENT CONTROL PAGE
  // ============================================

  addDocumentControlPage(options: {
    engineerName?: string;
    checkedBy?: string;
    approvedBy?: string;
    date?: Date;
  }): void {
    const { engineerName = '', checkedBy = '', approvedBy = '', date = new Date() } = options;

    this.doc.addPage();
    this.addHeader('Document Control');
    let y = this.margin + this.headerHeight + 5;

    // Revision History title
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.primary);
    this.doc.text('REVISION HISTORY', this.margin, y);
    y += 2;

    autoTable(this.doc, {
      startY: y,
      head: [['Rev', 'Date', 'Description', 'Author', 'Checked', 'Approved']],
      body: [
        [this.revision, format(date, 'dd/MM/yyyy'), 'Initial issue for review', engineerName || '—', checkedBy || '—', approvedBy || '—'],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: THEME.headerBg,
        textColor: THEME.headerText,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        cellPadding: 3,
      },
      bodyStyles: { fontSize: 8, halign: 'center', cellPadding: 3 },
      margin: { left: this.margin, right: this.margin },
      tableLineColor: THEME.border,
      tableLineWidth: 0.3,
    });

    this.syncYAfterTable(12);

    // Distribution table
    y = this.contentTop;
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.primary);
    this.doc.text('DISTRIBUTION', this.margin, y);
    y += 2;

    autoTable(this.doc, {
      startY: y,
      head: [['Name', 'Role', 'Organisation', 'Copies']],
      body: [
        [engineerName || '—', 'Structural Engineer', 'BeamLab', '1 (electronic)'],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: THEME.headerBg,
        textColor: THEME.headerText,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        cellPadding: 3,
      },
      bodyStyles: { fontSize: 8, halign: 'center', cellPadding: 3 },
      margin: { left: this.margin, right: this.margin },
      tableLineColor: THEME.border,
      tableLineWidth: 0.3,
    });

    this.syncYAfterTable(15);
  }

  // ============================================
  // TABLE OF CONTENTS
  // ============================================

  addTableOfContents(): void {
    // NOTE: Caller is responsible for page positioning and header.
    // This method only renders TOC content starting from contentTop.
    let y = this.contentTop + 5;

    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.primary);
    this.doc.text('TABLE OF CONTENTS', this.margin, y);

    // Decorative underline
    this.doc.setDrawColor(...THEME.accent);
    this.doc.setLineWidth(1);
    this.doc.line(this.margin, y + 3, this.margin + 60, y + 3);
    y += 14;

    const tocItems = [
      { num: '1.0', title: 'Executive Summary' },
      { num: '2.0', title: 'Design Basis' },
      { num: '2.1', title: 'Applicable Codes & Standards', indent: true },
      { num: '2.2', title: 'Material Properties', indent: true },
      { num: '2.3', title: 'Units & Sign Convention', indent: true },
      { num: '2.4', title: 'Key Assumptions', indent: true },
      { num: '3.0', title: 'Structural Model' },
      { num: '3.1', title: 'Node Coordinates', indent: true },
      { num: '3.2', title: 'Member Connectivity', indent: true },
      { num: '3.3', title: 'Section Properties', indent: true },
      { num: '3.4', title: 'Applied Loads', indent: true },
      { num: '4.0', title: 'Analysis Results' },
      { num: '4.1', title: 'Internal Member Forces', indent: true },
      { num: '4.2', title: 'Support Reactions', indent: true },
      { num: '4.3', title: 'Nodal Displacements', indent: true },
      { num: '4.4', title: 'Critical Members Summary', indent: true },
      { num: '5.0', title: 'Force & Moment Diagrams' },
      { num: '6.0', title: 'Design Verification' },
      { num: '7.0', title: 'Conclusions & Recommendations' },
      { num: '', title: 'Appendix A — Signatures & Approval' },
      { num: '', title: 'Appendix B — Legal Disclaimer' },
    ];

    this.doc.setFontSize(10);

    tocItems.forEach((item) => {
      const indent = (item as any).indent ? 8 : 0;
      const isMain = !indent && item.num;

      // Number
      this.doc.setFont('helvetica', isMain ? 'bold' : 'normal');
      if (isMain) {
        this.doc.setTextColor(...THEME.primary);
      } else {
        this.doc.setTextColor(...THEME.textSecondary);
      }
      this.doc.text(item.num, this.margin + indent, y);

      // Title
      const titleX = this.margin + indent + 14;
      this.doc.text(item.title, titleX, y);

      // Dotted leader line
      const titleEnd = titleX + this.doc.getTextWidth(item.title) + 2;
      const lineEnd = this.pageWidth - this.margin;
      this.doc.setDrawColor(...THEME.border);
      this.doc.setLineWidth(0.2);
      this.doc.setLineDashPattern([0.5, 1.5], 0);
      if (titleEnd + 5 < lineEnd) {
        this.doc.line(titleEnd, y - 0.3, lineEnd, y - 0.3);
      }
      this.doc.setLineDashPattern([], 0);

      y += isMain ? 7 : 5.5;
    });

    this.contentTop = y;
  }

  // ============================================
  // DESIGN BASIS SECTION
  // ============================================

  addDesignBasisSection(): void {
    // NOTE: Caller is responsible for page management.
    this.addNumberedSectionHeading('2.0', 'DESIGN BASIS');

    // 2.1 Codes & Standards
    this.addSubSectionHeading('2.1', 'Applicable Codes & Standards');

    autoTable(this.doc, {
      startY: this.contentTop,
      head: [['Code / Standard', 'Description']],
      body: [
        ['IS 800:2007', 'General Construction in Steel — Code of Practice'],
        ['IS 456:2000', 'Plain and Reinforced Concrete — Code of Practice'],
        ['IS 1893:2016 (Part 1)', 'Criteria for Earthquake Resistant Design'],
        ['IS 875 (Part 1–5)', 'Code of Practice for Design Loads'],
        ['AISC 360-22', 'Specification for Structural Steel Buildings'],
        ['ASCE 7-22', 'Minimum Design Loads and Associated Criteria'],
      ],
      theme: 'grid',
      headStyles: { fillColor: THEME.headerBg, textColor: THEME.headerText, fontStyle: 'bold', fontSize: 8, halign: 'left', cellPadding: 3 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 48, textColor: THEME.primary } },
      alternateRowStyles: { fillColor: THEME.rowAlt },
      margin: { left: this.margin, right: this.margin },
      tableLineColor: THEME.border,
      tableLineWidth: 0.2,
    });
    this.syncYAfterTable(8);

    // 2.2 Material Properties
    this.addSubSectionHeading('2.2', 'Material Properties');

    autoTable(this.doc, {
      startY: this.contentTop,
      head: [['Material', 'E (GPa)', 'fy / fck (MPa)', 'Density (kN/m³)']],
      body: [
        ['Structural Steel (Fe 250)', '200.00', '250.00 (fy)', '78.50'],
        ['Structural Steel (Fe 345)', '200.00', '345.00 (fy)', '78.50'],
        ['Concrete (M25)', '25.00', '25.00 (fck)', '25.00'],
        ['Concrete (M30)', '27.39', '30.00 (fck)', '25.00'],
      ],
      theme: 'grid',
      headStyles: { fillColor: THEME.headerBg, textColor: THEME.headerText, fontStyle: 'bold', fontSize: 8, halign: 'center', cellPadding: 3 },
      bodyStyles: { fontSize: 8, halign: 'center', cellPadding: 3 },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
      alternateRowStyles: { fillColor: THEME.rowAlt },
      margin: { left: this.margin, right: this.margin },
      tableLineColor: THEME.border,
      tableLineWidth: 0.2,
    });
    this.syncYAfterTable(8);

    // 2.3 Units & Sign Convention
    this.addSubSectionHeading('2.3', 'Units & Sign Convention');

    autoTable(this.doc, {
      startY: this.contentTop,
      head: [['Quantity', 'Unit', 'Symbol']],
      body: [
        ['Length', 'metres', 'm'],
        ['Force', 'kilonewtons', 'kN'],
        ['Moment', 'kilonewton-metres', 'kN·m'],
        ['Stress / Pressure', 'megapascals (N/mm²)', 'MPa'],
        ['Displacement', 'millimetres', 'mm'],
        ['Rotation', 'radians', 'rad'],
        ['Temperature', 'degrees Celsius', '°C'],
      ],
      theme: 'grid',
      headStyles: { fillColor: THEME.headerBg, textColor: THEME.headerText, fontStyle: 'bold', fontSize: 8, halign: 'center', cellPadding: 3 },
      bodyStyles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold', halign: 'center' } },
      alternateRowStyles: { fillColor: THEME.rowAlt },
      margin: { left: this.margin, right: this.margin },
      tableLineColor: THEME.border,
      tableLineWidth: 0.2,
    });
    this.syncYAfterTable(6);

    // Sign convention note
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.primary);
    this.doc.text('Sign Convention (Right-Hand Rule):', this.margin, this.contentTop);
    this.contentTop += 4;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(7.5);
    this.doc.setTextColor(...THEME.text);
    const conventions = [
      'Axial (N): Tension (+), Compression (−)',
      'Shear (V): Positive in positive local axis direction at member start',
      'Moment (M): Positive sagging (tension on bottom fibre), negative hogging',
      'Displacements (δ): Positive in positive global axis direction',
      'Global axes: X = horizontal (right), Y = vertical (up), Z = out-of-plane',
    ];
    conventions.forEach(c => {
      this.doc.text(`  •  ${c}`, this.margin, this.contentTop);
      this.contentTop += 3.5;
    });

    // 2.4 Assumptions
    this.contentTop += 3;
    this.addSubSectionHeading('2.4', 'Key Assumptions');
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...THEME.text);
    const assumptions = [
      'Linear elastic analysis; small displacement theory.',
      'Members are prismatic with uniform cross-section along length.',
      'Connections are assumed rigid (moment-resisting) unless noted otherwise.',
      'Self-weight is included based on assigned cross-section properties.',
      'Soil–structure interaction effects are not considered in this model.',
    ];
    assumptions.forEach(a => {
      this.doc.text(`  •  ${a}`, this.margin, this.contentTop);
      this.contentTop += 4;
    });
  }

  // ============================================
  // NUMBERED SECTION HEADINGS
  // ============================================

  addNumberedSectionHeading(number: string, title: string): void {
    this.syncYAfterTable(10);
    this.ensureSpace(18);
    const y = this.contentTop;

    // Accent bar
    this.doc.setFillColor(...THEME.primary);
    this.doc.rect(this.margin, y - 3, 3, 10, 'F');

    // Number
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.textSecondary);
    this.doc.text(number, this.margin + 6, y + 4);

    // Title
    this.doc.setFontSize(13);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.primary);
    this.doc.text(title, this.margin + 18, y + 4);

    // Underline
    this.doc.setDrawColor(...THEME.primary);
    this.doc.setLineWidth(0.8);
    this.doc.line(this.margin, y + 8, this.pageWidth - this.margin, y + 8);

    this.doc.setTextColor(...THEME.text);
    this.contentTop = y + 14;
  }

  addSubSectionHeading(number: string, title: string): void {
    this.syncYAfterTable(6);
    this.ensureSpace(12);
    const y = this.contentTop;

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.primaryLight);
    this.doc.text(number, this.margin, y);
    this.doc.text(title, this.margin + 10, y);

    // Thin underline
    this.doc.setDrawColor(...THEME.border);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.margin, y + 2, this.pageWidth - this.margin, y + 2);

    this.doc.setTextColor(...THEME.text);
    this.contentTop = y + 7;
  }

  // ============================================
  // LAYOUT HELPERS
  // ============================================

  /**
   * Ensure at least `neededMM` millimetres of usable space remain on the
   * current page.  If not, start a new page with a header.
   * Returns the Y position where content can start writing.
   */
  private ensureSpace(neededMM: number, headerTitle?: string): number {
    if (this.contentTop + neededMM > this.usableBottom) {
      this.addPage(headerTitle);
      this.contentTop = this.margin + this.headerHeight + 5;
    }
    return this.contentTop;
  }

  /**
   * Synchronise `contentTop` with jspdf-autotable's finalY when available,
   * so that subsequent content doesn't overlap or leave a gap.
   */
  private syncYAfterTable(fallbackGap: number = 10): void {
    try {
      const finalY = (this.doc as any).lastAutoTable?.finalY;
      if (typeof finalY === "number" && finalY > 0) {
        this.contentTop = finalY + fallbackGap;
        return;
      }
    } catch {
      /* ignore */
    }
    this.contentTop += fallbackGap;
  }

  // ============================================
  // HEADER & FOOTER
  // ============================================

  /**
   * Add professional running header to current page.
   * Features: left — branding + doc ref, centre — section title, right — revision + date.
   */
  addHeader(title?: string): void {
    const y = this.margin - 6;
    const pw = this.pageWidth;

    // — Left: BeamLab branding + doc ref —
    // Add small logo icon in header
    try {
      this.doc.addImage(LOGO_BASE64, 'PNG', this.margin, y - 5, 6, 6);
    } catch (e) {
      // Fallback: no logo
    }
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.primary);
    this.doc.text('BeamLab', this.margin + 8, y);
    this.doc.setFontSize(6);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...THEME.textMuted);
    this.doc.text(this.documentRef || 'STRUCTURAL ENGINEERING', this.margin, y + 4);

    // — Centre: Section title —
    if (title) {
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...THEME.textSecondary);
      this.doc.text(title.toUpperCase(), pw / 2, y + 1, { align: 'center' });
    }

    // — Right: Revision + date —
    this.doc.setFontSize(7);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...THEME.textMuted);
    const dateStr = format(new Date(), 'dd MMM yyyy');
    this.doc.text(`Rev ${this.revision}  |  ${dateStr}`, pw - this.margin, y, { align: 'right' });

    // — Horizontal rules (double-line style) —
    this.doc.setDrawColor(...THEME.primary);
    this.doc.setLineWidth(0.8);
    this.doc.line(this.margin, y + 7, pw - this.margin, y + 7);
    this.doc.setDrawColor(...THEME.accent);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.margin, y + 9, pw - this.margin, y + 9);

    // Reset
    this.doc.setTextColor(...THEME.text);

    // Track operations for blank-page detection
    const page = this.doc.getCurrentPageInfo().pageNumber;
    const pageOps = (this.doc as any).internal?.pages?.[page];
    const opCount = Array.isArray(pageOps) ? pageOps.length : 0;
    this.headerOpCountByPage.set(page, opCount);
  }

  /**
   * Add professional footer to all pages.
   * Features: left — project title + confidential, centre — page X of Y, right — copyright.
   */
  addFooter(): void {
    const totalPages = this.doc.getNumberOfPages();
    const pw = this.pageWidth;

    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);

      // Skip footer on cover page (page 1)
      if (i === 1) continue;

      const y = this.pageHeight - this.margin + 3;

      // Double-line above footer (mirrors header)
      this.doc.setDrawColor(...THEME.accent);
      this.doc.setLineWidth(0.3);
      this.doc.line(this.margin, y - 7, pw - this.margin, y - 7);
      this.doc.setDrawColor(...THEME.primary);
      this.doc.setLineWidth(0.6);
      this.doc.line(this.margin, y - 5, pw - this.margin, y - 5);

      // Left: Project + classification
      this.doc.setFontSize(6.5);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...THEME.textMuted);
      const projLabel = this.projectTitle ? `${this.projectTitle.slice(0, 35)} — CONFIDENTIAL` : 'CONFIDENTIAL';
      this.doc.text(projLabel, this.margin, y);

      // Centre: Page number
      this.doc.setFontSize(7.5);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...THEME.textSecondary);
      this.doc.text(`Page ${i - 1} of ${totalPages - 1}`, pw / 2, y, { align: 'center' });

      // Right: Copyright
      this.doc.setFontSize(6.5);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...THEME.textMuted);
      this.doc.text(`© ${new Date().getFullYear()} BeamLab`, pw - this.margin, y, { align: 'right' });
    }
  }

  // ============================================
  // PROJECT INFORMATION
  // ============================================

  /**
   * Add project information section with professional two-column key-value layout.
   */
  addProjectInfo(project: ProjectData): void {
    this.addNumberedSectionHeading('', 'PROJECT INFORMATION');

    const projectData = [
      ['Project Name', project.projectName || 'Untitled Project'],
      ['Project Number', project.projectNumber || 'N/A'],
      ['Client', project.clientName || 'N/A'],
      ['Design Engineer', project.engineerName || 'N/A'],
      ['Description', project.description || 'Structural Analysis Report'],
      ['Software', 'BeamLab — Structural Analysis Platform'],
      ['Analysis Method', 'Direct Stiffness Method (3-D Frame)'],
    ];

    autoTable(this.doc, {
      startY: this.contentTop,
      head: [],
      body: projectData,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3.5,
        lineColor: THEME.border,
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 45, textColor: THEME.primary, fillColor: THEME.rowAlt },
        1: { cellWidth: 'auto', textColor: THEME.text },
      },
      margin: { left: this.margin, right: this.margin },
    });
    this.syncYAfterTable(8);
  }

  // ============================================
  // 3D SNAPSHOT
  // ============================================

  /**
   * Add a 3D model snapshot image with professional figure frame,
   * numbered caption, and navy border.
   */
  add3DSnapshot(imageDataUrl: string, caption?: string): void {
    this.figureCount++;

    const maxWidth = this.pageWidth - 2 * this.margin;
    const maxHeight = 120;
    const frameH = maxHeight + 20;  // image + caption

    this.syncYAfterTable(10);
    this.ensureSpace(frameH + 5, 'Analysis Results');
    const y = this.contentTop;

    // ---- Outer frame ----
    this.doc.setDrawColor(...THEME.border);
    this.doc.setLineWidth(0.4);
    this.doc.roundedRect(this.margin, y, maxWidth, frameH, 1.5, 1.5, 'S');

    // ---- Top accent bar ----
    this.doc.setFillColor(...THEME.primary);
    this.doc.rect(this.margin + 0.2, y + 0.2, maxWidth - 0.4, 1.5, 'F');

    // ---- Image ----
    try {
      this.doc.addImage(
        imageDataUrl,
        'PNG',
        this.margin + 2,
        y + 3,
        maxWidth - 4,
        maxHeight - 3,
      );
    } catch {
      // Placeholder if image fails
      this.doc.setFillColor(...THEME.rowAlt);
      this.doc.rect(this.margin + 2, y + 3, maxWidth - 4, maxHeight - 3, 'F');
      this.doc.setFontSize(12);
      this.doc.setTextColor(...THEME.textMuted);
      this.doc.text('3D Model Preview', this.margin + maxWidth / 2, y + maxHeight / 2, { align: 'center' });
    }

    // ---- Figure caption ----
    const captionText = caption || `Figure ${this.figureCount} — 3D Structural Model`;
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'italic');
    this.doc.setTextColor(...THEME.textSecondary);
    this.doc.text(captionText, this.pageWidth / 2, y + maxHeight + 6, { align: 'center' });

    // ---- Figure number reference (small, right-aligned) ----
    this.doc.setFontSize(6.5);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...THEME.textMuted);
    this.doc.text(`Fig. ${this.figureCount}`, this.margin + maxWidth - 2, y + maxHeight + 12, { align: 'right' });

    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...THEME.text);
    this.contentTop = y + frameH + 4;
  }

  // ============================================
  // RESULTS TABLES
  // ============================================

  /**
   * Add node displacements table
   */
  addNodeDisplacementsTable(data: NodeDisplacementRow[], title?: string): void {
    this.tableCount++;
    this.addResultsTable(
      title || `Table ${this.tableCount}: Node Displacements`,
      [
        "Node ID",
        "dx (mm)",
        "dy (mm)",
        "dz (mm)",
        "rx (rad)",
        "ry (rad)",
        "rz (rad)",
      ],
      data.map((row) => [
        row.nodeId.slice(0, 8),
        (row.dx * 1000).toFixed(4),
        (row.dy * 1000).toFixed(4),
        (row.dz * 1000).toFixed(4),
        (row.rx ?? 0).toFixed(6),
        (row.ry ?? 0).toFixed(6),
        (row.rz ?? 0).toFixed(6),
      ]),
    );
  }

  /**
   * Add member forces table
   */
  addMemberForcesTable(data: MemberForceRow[], title?: string): void {
    this.tableCount++;
    this.addResultsTable(
      title || `Table ${this.tableCount}: Member Forces`,
      [
        "Member",
        "N (kN)",
        "Vy (kN)",
        "Vz (kN)",
        "My (kN·m)",
        "Mz (kN·m)",
        "T (kN·m)",
      ],
      data.map((row) => [
        row.memberId.slice(0, 8),
        row.axial.toFixed(2),
        row.shearY.toFixed(2),
        (row.shearZ ?? 0).toFixed(2),
        (row.momentY ?? 0).toFixed(2),
        row.momentZ.toFixed(2),
        (row.torsion ?? 0).toFixed(2),
      ]),
    );
  }

  /**
   * Add reactions table
   */
  addReactionsTable(data: ReactionRow[], title?: string): void {
    this.tableCount++;
    this.addResultsTable(
      title || `Table ${this.tableCount}: Support Reactions`,
      [
        "Node ID",
        "Fx (kN)",
        "Fy (kN)",
        "Fz (kN)",
        "Mx (kN·m)",
        "My (kN·m)",
        "Mz (kN·m)",
      ],
      data.map((row) => [
        row.nodeId.slice(0, 8),
        row.fx.toFixed(2),
        row.fy.toFixed(2),
        (row.fz ?? 0).toFixed(2),
        (row.mx ?? 0).toFixed(2),
        (row.my ?? 0).toFixed(2),
        (row.mz ?? 0).toFixed(2),
      ]),
    );
  }

  /**
   * Professional results table with industry-standard formatting.
   * Dark navy header, alternating row bands, thin grid lines.
   */
  addResultsTable(
    title: string,
    headers: string[],
    data: (string | number)[][],
  ): void {
    this.syncYAfterTable(12);
    this.ensureSpace(40, 'Analysis Results');
    const startY = this.contentTop;

    // Table title with figure/table reference styling
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.primary);
    this.doc.text(title, this.margin, startY);
    this.doc.setTextColor(...THEME.text);

    autoTable(this.doc, {
      startY: startY + 3,
      head: [headers],
      body: data,
      theme: 'grid',
      headStyles: {
        fillColor: THEME.headerBg,
        textColor: THEME.headerText,
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'center',
        cellPadding: 2.5,
      },
      bodyStyles: {
        fontSize: 7.5,
        halign: 'center',
        cellPadding: 2,
        textColor: THEME.text,
      },
      alternateRowStyles: {
        fillColor: THEME.rowAlt,
      },
      tableLineColor: THEME.border,
      tableLineWidth: 0.2,
      margin: { left: this.margin, right: this.margin },
      tableWidth: 'auto',
    });
  }

  // ============================================
  // DESIGN CHECKS SECTION
  // ============================================

  /**
   * Add design checks section with professional utilisation ratio formatting.
   * Features: summary badge, D/C ratio column, colour-coded status, clause references.
   */
  addDesignSection(designResults: DesignResult[]): void {
    this.tableCount++;

    this.syncYAfterTable(12);
    this.ensureSpace(65, 'Design Verification');

    // Section heading
    this.addNumberedSectionHeading('6.0', 'DESIGN VERIFICATION');

    // Summary badges
    const passCount = designResults.filter((r) => r.status === 'PASS').length;
    const failCount = designResults.filter((r) => r.status === 'FAIL').length;
    const total = designResults.length;
    const overallPass = failCount === 0;

    // Overall status badge
    this.doc.setFillColor(...(overallPass ? THEME.pass : THEME.fail));
    this.doc.roundedRect(this.margin, this.contentTop, 42, 8, 2, 2, 'F');
    this.doc.setTextColor(...THEME.white);
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(overallPass ? 'ALL CHECKS PASS' : 'CHECKS FAILED', this.margin + 21, this.contentTop + 5.5, { align: 'center' });

    // Pass/fail counts
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...THEME.pass);
    this.doc.text(`\u2713 ${passCount} Passed`, this.margin + 50, this.contentTop + 5.5);
    this.doc.setTextColor(...THEME.fail);
    this.doc.text(`\u2717 ${failCount} Failed`, this.margin + 78, this.contentTop + 5.5);
    this.doc.setTextColor(...THEME.textSecondary);
    this.doc.text(`(${total} total checks)`, this.margin + 106, this.contentTop + 5.5);

    this.contentTop += 14;

    // Design checks table
    const headers = ['Member ID', 'Section', 'Check Type', 'D/C Ratio', 'Status', 'Code Clause'];
    const tableData = designResults.map((result) => [
      result.memberId.slice(0, 10),
      result.section,
      result.checkType,
      result.criticalRatio.toFixed(3),
      result.status,
      result.clause,
    ]);

    autoTable(this.doc, {
      startY: this.contentTop,
      head: [headers],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: THEME.headerBg,
        textColor: THEME.headerText,
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'center',
        cellPadding: 2.5,
      },
      bodyStyles: {
        fontSize: 7.5,
        halign: 'center',
        cellPadding: 2,
      },
      tableLineColor: THEME.border,
      tableLineWidth: 0.2,
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index !== undefined) {
          const result = designResults[data.row.index];
          if (!result) return;

          // Row background based on status
          if (result.status === 'FAIL') {
            data.cell.styles.fillColor = [255, 235, 235];
          } else {
            data.cell.styles.fillColor = data.row.index % 2 === 0 ? [255, 255, 255] : THEME.rowAlt;
          }

          // D/C ratio column (index 3) — colour-coded
          if (data.column.index === 3) {
            const ratio = result.criticalRatio;
            if (ratio > 1.0) {
              data.cell.styles.textColor = THEME.fail;
            } else if (ratio > 0.85) {
              data.cell.styles.textColor = THEME.warn;
            } else {
              data.cell.styles.textColor = THEME.pass;
            }
            data.cell.styles.fontStyle = 'bold';
          }

          // Status column (index 4)
          if (data.column.index === 4) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = result.status === 'PASS' ? THEME.pass : THEME.fail;
          }

          // Code clause column (index 5)
          if (data.column.index === 5) {
            data.cell.styles.textColor = THEME.textMuted;
            data.cell.styles.fontSize = 7;
          }
        }
      },
      margin: { left: this.margin, right: this.margin },
      tableWidth: 'auto',
    });

    // Failed member details
    const failedResults = designResults.filter((r) => r.status === 'FAIL' && r.failureReason);

    if (failedResults.length > 0) {
      this.syncYAfterTable(8);
      this.ensureSpace(30, 'Design Verification — Details');
      let detailY = this.contentTop;

      // Box with left border
      const boxHeight = Math.min(failedResults.length * 14 + 10, 60);
      this.doc.setFillColor(255, 245, 245);
      this.doc.rect(this.margin, detailY - 2, this.pageWidth - 2 * this.margin, boxHeight, 'F');
      this.doc.setDrawColor(...THEME.fail);
      this.doc.setLineWidth(1.5);
      this.doc.line(this.margin, detailY - 2, this.margin, detailY - 2 + boxHeight);

      detailY += 4;
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...THEME.fail);
      this.doc.text('FAILED MEMBER DETAILS', this.margin + 5, detailY);
      detailY += 6;

      for (const result of failedResults.slice(0, 4)) {
        this.doc.setFontSize(8);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(...THEME.text);
        this.doc.text(`\u2022 Member ${result.memberId.slice(0, 10)} (${result.section})`, this.margin + 5, detailY);
        detailY += 4;

        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(...THEME.textSecondary);
        const reason = result.failureReason || `Failed in ${result.checkType} check (D/C = ${result.criticalRatio.toFixed(3)} > 1.0)`;
        const lines = this.doc.splitTextToSize(reason, this.pageWidth - 2 * this.margin - 15);
        this.doc.text(lines, this.margin + 8, detailY);
        detailY += lines.length * 3.5 + 3;
      }

      this.contentTop = detailY + 4;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Add a new page with header — but only if the current page already has content.
   * Prevents blank pages when back-to-back addPage calls happen.
   */
  addPage(title?: string): void {
    // Reuse the current page only when no body content has been added since the header.
    // This prevents accidental blank pages from consecutive addPage() calls.
    const currentPage = this.doc.getCurrentPageInfo().pageNumber;
    const pageOps = (this.doc as any).internal?.pages?.[currentPage];
    const currentOpCount = Array.isArray(pageOps) ? pageOps.length : 0;
    const headerOpCount = this.headerOpCountByPage.get(currentPage) ?? 0;
    const hasBodyContent = currentOpCount > headerOpCount;

    if (hasBodyContent) {
      this.doc.addPage();
    }
    this.addHeader(title);
  }

  /**
   * Add a section heading with accent bar.
   */
  addSectionHeading(text: string): void {
    this.syncYAfterTable(12);
    this.ensureSpace(16);
    const y = this.contentTop;

    // Accent bar
    this.doc.setFillColor(...THEME.primary);
    this.doc.rect(this.margin, y - 2, 3, 8, 'F');

    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.primary);
    this.doc.text(text, this.margin + 6, y + 4);

    // Full-width underline
    this.doc.setDrawColor(...THEME.primary);
    this.doc.setLineWidth(0.6);
    this.doc.line(this.margin, y + 7, this.pageWidth - this.margin, y + 7);

    this.doc.setTextColor(...THEME.text);
    this.contentTop = y + 13;
  }

  /**
   * Add paragraph text
   */
  addParagraph(text: string): void {
    this.syncYAfterTable(10);

    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");

    const lines = this.doc.splitTextToSize(
      text,
      this.pageWidth - 2 * this.margin,
    );
    const blockHeight = lines.length * 4.5;
    this.ensureSpace(blockHeight + 5);

    this.doc.text(lines, this.margin, this.contentTop);
    this.contentTop += blockHeight + 5;
  }

  // ============================================
  // CONCLUSIONS & RECOMMENDATIONS PAGE
  // ============================================

  /**
   * Professional conclusions page with structural assessment summary,
   * recommendations, and caveats – ARUP / Buro Happold style.
   */
  addConclusionsPage(options: {
    overallStatus: 'PASS' | 'FAIL' | 'WARNING';
    passCount: number;
    failCount: number;
    totalMembers: number;
    criticalMembers: string[];
    maxStress: number;
  }): void {
    const { overallStatus, passCount, failCount, totalMembers, criticalMembers, maxStress } = options;
    const sectionNum = this.tocEntries.length > 0
      ? this.tocEntries[this.tocEntries.length - 1].number
      : '7';

    let y = this.contentTop + 5;
    this.addNumberedSectionHeading(sectionNum + '.0', 'CONCLUSIONS & RECOMMENDATIONS');
    y = this.contentTop;

    // ---- Overall Assessment Box ----
    const boxX = this.margin;
    const boxW = this.pageWidth - 2 * this.margin;
    const boxH = 32;
    const isPass = overallStatus === 'PASS';

    // Border
    this.doc.setDrawColor(...(isPass ? THEME.pass : THEME.fail));
    this.doc.setLineWidth(0.6);
    this.doc.roundedRect(boxX, y, boxW, boxH, 2, 2, 'S');

    // Left accent bar
    this.doc.setFillColor(...(isPass ? THEME.pass : THEME.fail));
    this.doc.rect(boxX, y, 4, boxH, 'F');

    // Title
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    if (isPass) {
      this.doc.setTextColor(...THEME.pass);
    } else {
      this.doc.setTextColor(...THEME.fail);
    }
    this.doc.text('OVERALL STRUCTURAL ASSESSMENT', boxX + 8, y + 7);

    // Status badge
    const badgeW = 28;
    const badgeH = 8;
    const badgeX = boxX + boxW - badgeW - 6;
    const badgeY = y + 3;
    this.doc.setFillColor(...(isPass ? THEME.pass : THEME.fail));
    this.doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2, 2, 'F');
    this.doc.setTextColor(...THEME.white);
    this.doc.setFontSize(9);
    this.doc.text(overallStatus, badgeX + badgeW / 2, badgeY + 5.5, { align: 'center' });

    // Summary text
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...THEME.text);
    const summaryText = isPass
      ? `All ${passCount} of ${totalMembers} members satisfy the design requirements. No remedial action is required.`
      : `${failCount} of ${totalMembers} members do not satisfy the design requirements. Remedial action is recommended.`;
    this.doc.text(summaryText, boxX + 8, y + 15);

    // Key metrics line
    this.doc.setFontSize(8);
    this.doc.setTextColor(...THEME.textSecondary);
    this.doc.text(`Members checked: ${totalMembers}  |  Pass: ${passCount}  |  Fail: ${failCount}  |  Peak stress: ${maxStress.toFixed(1)} MPa`, boxX + 8, y + 22);
    this.doc.text(`Utilisation: ${totalMembers > 0 ? ((passCount / totalMembers) * 100).toFixed(0) : 0}% pass rate`, boxX + 8, y + 27);

    y += boxH + 10;
    this.contentTop = y;

    // ---- Recommendations ----
    this.addSubSectionHeading(sectionNum + '.1', 'Recommendations');
    y = this.contentTop;

    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...THEME.text);

    const recommendations: string[] = [];
    if (isPass) {
      recommendations.push('All structural members are adequate for the applied loading. Proceed to detailed design and fabrication drawings.');
      recommendations.push('Verify connection design separately — member checks only cover overall capacity.');
      recommendations.push('Confirm loading assumptions with the project architect and services engineer.');
    } else {
      recommendations.push('Revise failed members with increased section sizes or alternative profiles.');
      recommendations.push('Re-run analysis after modifications to verify adequacy.');
      recommendations.push('Consider alternative load paths or bracing arrangements to reduce demand.');
    }
    recommendations.push('This report covers static analysis only. Dynamic, seismic, and fatigue analysis should be performed where applicable.');
    recommendations.push('All connections shall be designed to transfer the forces indicated in Section 5.');

    for (let i = 0; i < recommendations.length; i++) {
      this.ensureSpace(10);
      y = this.contentTop;
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...THEME.text);

      const bullet = `${i + 1}.`;
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(bullet, this.margin + 2, y);
      this.doc.setFont('helvetica', 'normal');
      const textLines = this.doc.splitTextToSize(recommendations[i], this.pageWidth - 2 * this.margin - 12);
      this.doc.text(textLines, this.margin + 10, y);
      this.contentTop = y + textLines.length * 4.5 + 2;
    }

    // ---- Critical members list (if any) ----
    if (criticalMembers.length > 0) {
      this.contentTop += 5;
      this.addSubSectionHeading(sectionNum + '.2', 'Critical Members');
      y = this.contentTop;

      this.doc.setFillColor(255, 245, 245);
      this.doc.setDrawColor(...THEME.fail);
      this.doc.setLineWidth(0.3);
      const listH = Math.min(criticalMembers.length, 8) * 5 + 8;
      this.doc.roundedRect(this.margin, y, this.pageWidth - 2 * this.margin, listH, 1.5, 1.5, 'FD');

      y += 5;
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...THEME.fail);

      for (const member of criticalMembers.slice(0, 8)) {
        this.doc.text(`▸  ${member}`, this.margin + 4, y);
        y += 5;
      }
      if (criticalMembers.length > 8) {
        this.doc.setTextColor(...THEME.textMuted);
        this.doc.text(`  … and ${criticalMembers.length - 8} additional members`, this.margin + 4, y);
      }
    }

    this.doc.setTextColor(...THEME.text);
  }

  // ============================================
  // SIGNATURE & CERTIFICATION PAGE
  // ============================================

  /**
   * Professional signature page with engineer certification block
   * and three-column Prepared / Checked / Approved layout.
   */
  addSignaturePage(options: {
    engineerName: string;
    checkedBy: string;
    approvedBy: string;
    projectName: string;
    projectNumber: string;
  }): void {
    const { engineerName, checkedBy, approvedBy, projectName, projectNumber } = options;

    let y = this.contentTop + 5;

    // Section heading
    this.addNumberedSectionHeading('A', 'CERTIFICATION & SIGNATURES');
    y = this.contentTop;

    // ---- Certification statement ----
    this.doc.setFillColor(...THEME.calcBoxBg);
    this.doc.setDrawColor(...THEME.primary);
    this.doc.setLineWidth(0.5);
    const certH = 28;
    this.doc.roundedRect(this.margin, y, this.pageWidth - 2 * this.margin, certH, 2, 2, 'FD');

    // Left navy bar
    this.doc.setFillColor(...THEME.primary);
    this.doc.rect(this.margin, y, 4, certH, 'F');

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.primary);
    this.doc.text('ENGINEER\'S CERTIFICATION', this.margin + 8, y + 7);

    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...THEME.text);
    const certText = `I certify that the structural analysis and design presented in this report for "${projectName}" `
      + `(Ref: ${this.documentRef}) has been carried out in accordance with the applicable codes of practice `
      + `and represents a true record of the analysis undertaken.`;
    const certLines = this.doc.splitTextToSize(certText, this.pageWidth - 2 * this.margin - 16);
    this.doc.text(certLines, this.margin + 8, y + 13);

    y += certH + 12;

    // ---- Three-column signature blocks ----
    const colW = (this.pageWidth - 2 * this.margin - 10) / 3;  // 3 columns with 5mm gaps
    const sigH = 50;
    const signatories = [
      { role: 'PREPARED BY', name: engineerName || '—', title: 'Design Engineer' },
      { role: 'CHECKED BY', name: checkedBy || '—', title: 'Senior Engineer' },
      { role: 'APPROVED BY', name: approvedBy || '—', title: 'Principal Engineer' },
    ];

    for (let i = 0; i < 3; i++) {
      const x = this.margin + i * (colW + 5);
      const sig = signatories[i];

      // Box
      this.doc.setDrawColor(...THEME.border);
      this.doc.setLineWidth(0.3);
      this.doc.roundedRect(x, y, colW, sigH, 1.5, 1.5, 'S');

      // Header bar
      this.doc.setFillColor(...THEME.primary);
      this.doc.rect(x, y, colW, 8, 'F');
      // Round top corners
      this.doc.setFillColor(...THEME.primary);
      this.doc.roundedRect(x, y, colW, 8, 1.5, 1.5, 'F');
      this.doc.rect(x, y + 4, colW, 4, 'F'); // Fill bottom of header

      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...THEME.white);
      this.doc.text(sig.role, x + colW / 2, y + 5.5, { align: 'center' });

      // Name
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...THEME.text);
      this.doc.text(sig.name, x + colW / 2, y + 16, { align: 'center' });

      // Title
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...THEME.textSecondary);
      this.doc.text(sig.title, x + colW / 2, y + 21, { align: 'center' });

      // Signature line
      this.doc.setDrawColor(...THEME.borderDark);
      this.doc.setLineWidth(0.3);
      this.doc.line(x + 6, y + 36, x + colW - 6, y + 36);
      this.doc.setFontSize(7);
      this.doc.setTextColor(...THEME.textMuted);
      this.doc.text('Signature', x + colW / 2, y + 40, { align: 'center' });

      // Date line
      this.doc.line(x + 6, y + 45, x + colW - 6, y + 45);
      this.doc.text('Date', x + colW / 2, y + 49, { align: 'center' });
    }

    y += sigH + 10;
    this.contentTop = y;

    // ---- Notes ----
    this.doc.setFontSize(7);
    this.doc.setFont('helvetica', 'italic');
    this.doc.setTextColor(...THEME.textMuted);
    const notes = [
      'Note 1: This document shall not be reproduced in part without the written approval of the issuing organisation.',
      'Note 2: All dimensions are in millimetres and forces in kilonewtons unless stated otherwise.',
      `Note 3: Document Reference: ${this.documentRef}  |  Project Number: ${projectNumber || 'N/A'}`,
    ];
    for (const note of notes) {
      this.doc.text(note, this.margin, y);
      y += 4;
    }

    this.doc.setTextColor(...THEME.text);
    this.contentTop = y;
  }

  /**
   * Add a professional legal disclaimer page with bordered sections
   * and clear hierarchy.
   */
  addLegalDisclaimer(): void {
    this.addPage('Legal Disclaimer');

    let y = this.contentTop + 5;

    // ---- Title block ----
    this.doc.setFillColor(...THEME.primary);
    this.doc.roundedRect(this.margin, y, this.pageWidth - 2 * this.margin, 10, 1.5, 1.5, 'F');
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.white);
    this.doc.text('IMPORTANT LEGAL NOTICE AND DISCLAIMER', this.pageWidth / 2, y + 7, { align: 'center' });
    y += 16;

    // ---- Disclaimer clauses ----
    const clauses = [
      {
        heading: '1.  PROFESSIONAL USE ONLY',
        body: 'BeamLab is a computational aid intended for use by qualified professional engineers. It is not a substitute for professional engineering judgment, independent analysis, or verification.',
      },
      {
        heading: '2.  NO WARRANTY',
        body: 'The software is provided "as is" without any warranty of any kind, express or implied. The developers and operators of BeamLab make no representations regarding the accuracy, reliability, or completeness of the analysis results.',
      },
      {
        heading: '3.  LIMITATION OF LIABILITY',
        body: 'The user assumes full responsibility for the use of this software and the interpretation of its results. BeamLab shall not be liable for any direct, indirect, incidental, special, or consequential damages arising out of the use or inability to use this software.',
      },
      {
        heading: '4.  VERIFICATION REQUIRED',
        body: 'All results generated by this software must be independently verified by a licensed Professional Engineer (PE/SE) using alternative methods or hand calculations before being used for construction or design purposes.',
      },
    ];

    for (const clause of clauses) {
      this.ensureSpace(22);
      y = this.contentTop;

      // Clause heading
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...THEME.primary);
      this.doc.text(clause.heading, this.margin, y);
      y += 5;

      // Clause body
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...THEME.text);
      const bodyLines = this.doc.splitTextToSize(clause.body, this.pageWidth - 2 * this.margin - 4);
      this.doc.text(bodyLines, this.margin + 2, y);
      y += bodyLines.length * 3.8 + 4;
      this.contentTop = y;
    }

    // ---- Acceptance statement ----
    this.ensureSpace(18);
    y = this.contentTop + 4;
    const boxW = this.pageWidth - 2 * this.margin;

    this.doc.setFillColor(250, 251, 254);
    this.doc.setDrawColor(...THEME.primary);
    this.doc.setLineWidth(0.3);
    this.doc.roundedRect(this.margin, y, boxW, 14, 1.5, 1.5, 'FD');

    this.doc.setFontSize(7.5);
    this.doc.setFont('helvetica', 'italic');
    this.doc.setTextColor(...THEME.textSecondary);
    const acceptText = 'By using this report, you acknowledge that you have read and understood these terms and agree to use the data herein at your own professional risk.';
    const acceptLines = this.doc.splitTextToSize(acceptText, boxW - 8);
    this.doc.text(acceptLines, this.margin + 4, y + 6);

    y += 22;
    this.contentTop = y;

    // ---- Signature lines ----
    this.doc.setDrawColor(...THEME.borderDark);
    this.doc.setLineWidth(0.3);

    // Engineer signature
    this.doc.line(this.margin, y, this.margin + 80, y);
    this.doc.setFontSize(7);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...THEME.textSecondary);
    this.doc.text('Professional Engineer Signature', this.margin, y + 4);

    // Date
    this.doc.line(this.pageWidth - this.margin - 50, y, this.pageWidth - this.margin, y);
    this.doc.text('Date', this.pageWidth - this.margin - 50, y + 4);

    this.doc.setTextColor(...THEME.text);
  }

  // ============================================
  // DIAGRAM METHODS  —  Professional Plotting
  // ============================================

  /**
   * Add a member diagram (BMD, SFD, AFD) with professional figure frame,
   * labelled axes, and numbered figure caption.
   */
  addMemberDiagram(
    memberId: string,
    diagramType: "BMD" | "SFD" | "AFD",
    data: { x_values: number[]; values: number[] },
    maxValue: number,
  ): void {
    const diagramHeight = 60;
    const frameH = diagramHeight + 18;  // frame + caption space
    this.ensureSpace(frameH + 10);

    this.figureCount++;
    const typeLabel = diagramType === 'BMD' ? 'Bending Moment' : diagramType === 'SFD' ? 'Shear Force' : 'Axial Force';
    const unitLabel = diagramType === 'BMD' ? 'kN·m' : 'kN';

    const width = this.pageWidth - 2 * this.margin;
    let y = this.contentTop;

    // ---- Figure frame ----
    this.doc.setDrawColor(...THEME.border);
    this.doc.setLineWidth(0.3);
    this.doc.roundedRect(this.margin, y, width, frameH, 1, 1, 'S');

    // ---- Title bar inside frame ----
    this.doc.setFillColor(...THEME.rowAlt);
    this.doc.rect(this.margin + 0.15, y + 0.15, width - 0.3, 8, 'F');
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.primary);
    this.doc.text(`Member ${memberId}  —  ${typeLabel} Diagram  (${unitLabel})`, this.margin + 4, y + 5.5);

    // ---- Draw diagram on canvas ----
    const canvas = document.createElement("canvas");
    canvas.width = width * 3.78;
    canvas.height = diagramHeight * 3.78;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      this.drawDiagramOnCanvas(
        ctx,
        data.x_values,
        data.values,
        maxValue,
        canvas.width,
        canvas.height,
      );

      const imgData = canvas.toDataURL("image/png");
      this.doc.addImage(
        imgData,
        "PNG",
        this.margin + 1,
        y + 9,
        width - 2,
        diagramHeight,
      );
    }

    // ---- Figure caption ----
    const captionY = y + 9 + diagramHeight + 4;
    this.doc.setFontSize(7);
    this.doc.setFont('helvetica', 'italic');
    this.doc.setTextColor(...THEME.textSecondary);
    this.doc.text(
      `Figure ${this.figureCount} — ${typeLabel} diagram for Member ${memberId}`,
      this.margin + width / 2,
      captionY,
      { align: 'center' },
    );

    this.contentTop = captionY + 6;
    this.doc.setTextColor(...THEME.text);
  }

  /**
   * Helper: Draw professional diagram on canvas with grid, axes, fill, and value labels.
   */
  private drawDiagramOnCanvas(
    ctx: CanvasRenderingContext2D,
    xValues: number[],
    values: number[],
    maxValue: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    const padding = 50;
    const graphWidth = canvasWidth - 2 * padding;
    const graphHeight = canvasHeight - 2 * padding;

    // Clear background
    ctx.fillStyle = '#FAFBFE';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Border
    ctx.strokeStyle = '#D2D7E1';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvasWidth, canvasHeight);

    // Draw grid (light)
    ctx.strokeStyle = '#E8ECF2';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 8; i++) {
      const x = padding + (graphWidth / 8) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, canvasHeight - padding);
      ctx.stroke();
    }
    for (let i = 0; i <= 6; i++) {
      const y = padding + (graphHeight / 6) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvasWidth - padding, y);
      ctx.stroke();
    }

    // Zero axis (baseline) — dashed
    const zeroY = canvasHeight / 2;
    ctx.strokeStyle = '#AAB0BA';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(padding, zeroY);
    ctx.lineTo(canvasWidth - padding, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw axes (solid)
    ctx.strokeStyle = `rgb(${THEME.primary.join(',')})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvasHeight - padding);
    ctx.lineTo(canvasWidth - padding, canvasHeight - padding);
    ctx.stroke();

    const maxAbsValue = Math.max(Math.abs(maxValue), 1e-9);

    // Draw data line and fill
    if (values.length > 0 && xValues.length > 0) {
      const xRange = xValues[xValues.length - 1] || 1;

      // Fill under curve
      ctx.fillStyle = 'rgba(0, 133, 202, 0.08)';
      ctx.beginPath();
      ctx.moveTo(padding, zeroY);
      for (let i = 0; i < values.length; i++) {
        const x = padding + (xValues[i] / xRange) * graphWidth;
        const y = zeroY - (values[i] / maxAbsValue) * (graphHeight / 2);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(padding + (xValues[xValues.length - 1] / xRange) * graphWidth, zeroY);
      ctx.closePath();
      ctx.fill();

      // Data line
      ctx.strokeStyle = `rgb(${THEME.accent.join(',')})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < values.length; i++) {
        const x = padding + (xValues[i] / xRange) * graphWidth;
        const y = zeroY - (values[i] / maxAbsValue) * (graphHeight / 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Peak value markers
      let peakIdx = 0;
      let peakAbs = 0;
      for (let i = 0; i < values.length; i++) {
        if (Math.abs(values[i]) > peakAbs) { peakAbs = Math.abs(values[i]); peakIdx = i; }
      }
      if (peakAbs > 0) {
        const px = padding + (xValues[peakIdx] / xRange) * graphWidth;
        const py = zeroY - (values[peakIdx] / maxAbsValue) * (graphHeight / 2);
        ctx.fillStyle = `rgb(${THEME.fail.join(',')})`;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgb(${THEME.primary.join(',')})`;
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${values[peakIdx].toFixed(2)}`, px, py - 8);
      }
    }

    // Axis labels
    ctx.fillStyle = `rgb(${THEME.textSecondary.join(',')})`;
    ctx.font = 'bold 11px Arial';

    // X-axis labels
    ctx.textAlign = 'center';
    ctx.fillText('0', padding, canvasHeight - padding + 18);
    ctx.fillText('L', canvasWidth - padding, canvasHeight - padding + 18);
    ctx.fillText('Position along member', canvasWidth / 2, canvasHeight - 8);

    // Y-axis labels
    ctx.textAlign = 'right';
    ctx.fillText(`+${maxAbsValue.toFixed(1)}`, padding - 5, padding + 5);
    ctx.fillText(`-${maxAbsValue.toFixed(1)}`, padding - 5, canvasHeight - padding + 5);
    ctx.fillText('0', padding - 5, zeroY + 4);
  }

  /**
   * Add multiple member diagrams for all members with professional layout.
   * Each member gets its own section; diagrams have figure numbers and captions.
   */
  addAllMemberDiagrams(
    members: Array<{
      id: string;
      maxShear?: number;
      maxMoment?: number;
      maxAxial?: number;
      diagramData?: {
        x_values: number[];
        shear_values: number[];
        moment_values: number[];
        axial_values: number[];
        deflection_values: number[];
      };
    }>,
    diagramTypes: ("BMD" | "SFD" | "AFD")[] = ["SFD", "BMD"],
  ): void {
    if (members.length === 0) return;

    this.addPage('Force & Moment Diagrams');
    this.addNumberedSectionHeading('', 'FORCE & MOMENT DIAGRAMS');

    // Introductory note
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...THEME.textSecondary);
    this.doc.text(
      'The following diagrams show the distribution of internal forces along each member. Positive values follow the adopted sign convention.',
      this.margin,
      this.contentTop,
    );
    this.contentTop += 6;

    members.forEach((member) => {
      if (!member.diagramData) return;

      diagramTypes.forEach((type) => {
        const values =
          type === "SFD"
            ? member.diagramData!.shear_values
            : type === "BMD"
              ? member.diagramData!.moment_values
              : member.diagramData!.axial_values;
        const maxVal =
          type === "SFD"
            ? member.maxShear || 10
            : type === "BMD"
              ? member.maxMoment || 10
              : member.maxAxial || 10;

        this.addMemberDiagram(
          member.id,
          type,
          {
            x_values: member.diagramData!.x_values,
            values,
          },
          maxVal,
        );
      });
    });
  }

  /**
   * Add detailed individual member diagrams with calculations
   * Each member gets its own page with SFD, BMD, AFD and detailed calculations
   */
  addDetailedMemberDiagrams(
    members: Array<{
      id: string;
      startNodeId: string;
      endNodeId: string;
      length: number;
      sectionId?: string;
      E?: number;
      I?: number;
      A?: number;
      maxShear?: number;
      maxMoment?: number;
      maxAxial?: number;
      startReactions?: { shear: number; moment: number; axial: number };
      endReactions?: { shear: number; moment: number; axial: number };
      diagramData?: {
        x_values: number[];
        shear_values: number[];
        moment_values: number[];
        axial_values: number[];
        deflection_values: number[];
      };
    }>,
  ): void {
    if (members.length === 0) return;

    members.forEach((member, index) => {
      // New page for each member
      this.addPage(`Member ${index + 1} Analysis`);

      // Member header
      this.doc.setFontSize(14);
      this.doc.setFont("helvetica", "bold");
      this.doc.setTextColor(...THEME.primary);
      this.doc.text(`Member: ${member.id}`, this.margin, this.contentTop);
      this.contentTop += 8;

      // Member info box
      this.doc.setFillColor(...THEME.calcBoxBg);
      this.doc.roundedRect(
        this.margin,
        this.contentTop,
        this.pageWidth - 2 * this.margin,
        25,
        2,
        2,
        "F",
      );

      this.doc.setFontSize(9);
      this.doc.setFont("helvetica", "normal");
      this.doc.setTextColor(...THEME.text);

      const infoY = this.contentTop + 6;
      this.doc.text(
        `Start Node: ${member.startNodeId}`,
        this.margin + 5,
        infoY,
      );
      this.doc.text(`End Node: ${member.endNodeId}`, this.margin + 55, infoY);
      this.doc.text(
        `Length: ${member.length.toFixed(3)} m`,
        this.margin + 105,
        infoY,
      );
      this.doc.text(
        `Section: ${member.sectionId || "Default"}`,
        this.margin + 5,
        infoY + 8,
      );
      this.doc.text(
        `E: ${member.E ? (member.E / 1e6).toFixed(0) : "200"} GPa`,
        this.margin + 55,
        infoY + 8,
      );
      this.doc.text(
        `I: ${member.I ? (member.I * 1e8).toFixed(2) : "—"} cm⁴`,
        this.margin + 105,
        infoY + 8,
      );
      this.doc.text(
        `A: ${member.A ? (member.A * 1e4).toFixed(2) : "—"} cm²`,
        this.margin + 155,
        infoY + 8,
      );

      this.contentTop += 30;
      this.doc.setTextColor(...THEME.text);

      if (!member.diagramData) {
        this.doc.setFontSize(10);
        this.doc.text(
          "No diagram data available for this member.",
          this.margin,
          this.contentTop,
        );
        return;
      }

      const diagrams: Array<{
        type: string;
        values: number[];
        maxVal: number;
        unit: string;
        color: string;
      }> = [
        {
          type: "Shear Force Diagram (SFD)",
          values: member.diagramData.shear_values,
          maxVal: Math.max(
            member.maxShear ?? safeAbsMax(member.diagramData.shear_values, 10),
            0.01,
          ),
          unit: "kN",
          color: "#dc2626",
        },
        {
          type: "Bending Moment Diagram (BMD)",
          values: member.diagramData.moment_values,
          maxVal: Math.max(
            member.maxMoment ??
              safeAbsMax(member.diagramData.moment_values, 10),
            0.01,
          ),
          unit: "kN·m",
          color: "#2563eb",
        },
        {
          type: "Axial Force Diagram (AFD)",
          values: member.diagramData.axial_values,
          maxVal: Math.max(
            member.maxAxial ?? safeAbsMax(member.diagramData.axial_values, 10),
            0.01,
          ),
          unit: "kN",
          color: "#16a34a",
        },
      ];

      diagrams.forEach((diagram) => {
        // Each diagram block: 5mm title + 50mm canvas + 8mm spacing = 63mm
        const DIAGRAM_BLOCK_HEIGHT = 65;
        this.ensureSpace(
          DIAGRAM_BLOCK_HEIGHT,
          `Member ${member.id} - Continued`,
        );

        // Diagram title
        this.doc.setFontSize(11);
        this.doc.setFont("helvetica", "bold");
        this.doc.setTextColor(...THEME.primary);
        this.doc.text(diagram.type, this.margin, this.contentTop);
        this.contentTop += 5;

        // Draw enhanced diagram — use remaining space, but at least 35mm
        const availableHeight = Math.max(
          Math.min(this.usableBottom - this.contentTop - 5, 50),
          35,
        );
        this.drawEnhancedDiagram(
          member.diagramData!.x_values,
          diagram.values,
          diagram.maxVal,
          diagram.unit,
          diagram.color,
          member.length,
          availableHeight,
        );

        this.contentTop += 5;
      });

      // Add calculations section
      this.addMemberCalculations(member);
    });
  }

  /**
   * Draw enhanced diagram with better visualization
   */
  private drawEnhancedDiagram(
    xValues: number[],
    values: number[],
    maxValue: number,
    unit: string,
    color: string,
    memberLength: number,
    heightMM: number = 50,
  ): void {
    const width = this.pageWidth - 2 * this.margin;
    const height = heightMM;
    const canvas = document.createElement("canvas");
    canvas.width = width * 3.78;
    canvas.height = height * 3.78;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const padding = { left: 45, right: 20, top: 15, bottom: 20 };
    const graphWidth = canvas.width - padding.left - padding.right;
    const graphHeight = canvas.height - padding.top - padding.bottom;

    // Clear background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "#f0f0f0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = padding.left + (graphWidth / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, canvas.height - padding.bottom);
      ctx.stroke();
    }
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (graphHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvas.width - padding.right, y);
      ctx.stroke();
    }

    // Draw baseline (zero line)
    const zeroY = padding.top + graphHeight / 2;
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(canvas.width - padding.right, zeroY);
    ctx.stroke();

    // Draw member representation
    ctx.fillStyle = "#6b7280";
    ctx.fillRect(padding.left, zeroY - 3, graphWidth, 6);

    // Draw diagram curve with fill
    if (values.length > 0 && xValues.length > 0) {
      const maxX = xValues[xValues.length - 1] || memberLength || 1;
      const scale = graphHeight / 2 / Math.max(Math.abs(maxValue), 1e-9);

      ctx.beginPath();
      ctx.moveTo(padding.left, zeroY);

      for (let i = 0; i < values.length; i++) {
        const x = padding.left + (xValues[i] / maxX) * graphWidth;
        const y = zeroY - values[i] * scale;
        if (i === 0) {
          ctx.lineTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.lineTo(canvas.width - padding.right, zeroY);
      ctx.closePath();

      // Fill
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
          ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
            }
          : { r: 0, g: 0, b: 0 };
      };
      const rgb = hexToRgb(color);
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
      ctx.fill();

      // Stroke
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < values.length; i++) {
        const x = padding.left + (xValues[i] / maxX) * graphWidth;
        const y = zeroY - values[i] * scale;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Mark max/min values
      const maxVal = Math.max(...values);
      const minVal = Math.min(...values);
      const maxIdx = values.indexOf(maxVal);
      const minIdx = values.indexOf(minVal);

      ctx.font = "bold 11px Arial";
      ctx.fillStyle = color;

      if (Math.abs(maxVal) > 0.01) {
        const maxX =
          padding.left +
          (xValues[maxIdx] / (xValues[xValues.length - 1] || 1)) * graphWidth;
        const maxY = zeroY - maxVal * scale;
        ctx.beginPath();
        ctx.arc(maxX, maxY, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillText(`${maxVal.toFixed(2)} ${unit}`, maxX + 5, maxY - 5);
      }

      if (Math.abs(minVal) > 0.01 && minIdx !== maxIdx) {
        const minX =
          padding.left +
          (xValues[minIdx] / (xValues[xValues.length - 1] || 1)) * graphWidth;
        const minY = zeroY - minVal * scale;
        ctx.beginPath();
        ctx.arc(minX, minY, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillText(`${minVal.toFixed(2)} ${unit}`, minX + 5, minY + 15);
      }
    }

    // Draw axis labels
    ctx.fillStyle = "#374151";
    ctx.font = "10px Arial";
    ctx.textAlign = "right";
    ctx.fillText(
      `+${maxValue.toFixed(1)} ${unit}`,
      padding.left - 5,
      padding.top + 10,
    );
    ctx.fillText(
      `-${maxValue.toFixed(1)} ${unit}`,
      padding.left - 5,
      canvas.height - padding.bottom - 5,
    );
    ctx.fillText("0", padding.left - 5, zeroY + 4);

    ctx.textAlign = "center";
    ctx.fillText("0", padding.left, canvas.height - 5);
    ctx.fillText(
      `${memberLength.toFixed(2)} m`,
      canvas.width - padding.right,
      canvas.height - 5,
    );

    // Convert to image and add to PDF
    const imgData = canvas.toDataURL("image/png");
    this.doc.addImage(
      imgData,
      "PNG",
      this.margin,
      this.contentTop,
      width,
      height,
    );
    this.contentTop += height + 3;
  }

  /**
   * Add professional calculation sheet for a member.
   * Styled as an engineering calculation pad with structured layout.
   */
  private addMemberCalculations(member: {
    id: string;
    length: number;
    E?: number;
    I?: number;
    A?: number;
    maxShear?: number;
    maxMoment?: number;
    maxAxial?: number;
    diagramData?: {
      x_values: number[];
      shear_values: number[];
      moment_values: number[];
      axial_values: number[];
      deflection_values: number[];
    };
  }): void {
    this.ensureSpace(90, `Member ${member.id} — Calculations`);

    const L = member.length;
    const E = member.E || 200e6;
    const I = member.I || 1e-4;
    const A = member.A || 1e-2;

    const shearValues = member.diagramData?.shear_values || [];
    const momentValues = member.diagramData?.moment_values || [];
    const axialValues = member.diagramData?.axial_values || [];
    const deflectionValues = member.diagramData?.deflection_values || [];

    const Vmax = shearValues.length > 0 ? Math.max(...shearValues.map(Math.abs)) : member.maxShear || 0;
    const Mmax = momentValues.length > 0 ? Math.max(...momentValues.map(Math.abs)) : member.maxMoment || 0;
    const Nmax = axialValues.length > 0 ? Math.max(...axialValues.map(Math.abs)) : member.maxAxial || 0;
    const deltaMax = deflectionValues.length > 0 ? Math.max(...deflectionValues.map(Math.abs)) : 0;

    const V_start = shearValues[0] || 0;
    const V_end = shearValues[shearValues.length - 1] || 0;
    const M_start = momentValues[0] || 0;
    const M_end = momentValues[momentValues.length - 1] || 0;
    const N_start = axialValues[0] || 0;
    const N_end = axialValues[axialValues.length - 1] || 0;

    // Calculation box
    const boxWidth = this.pageWidth - 2 * this.margin;
    const boxHeight = 78;

    // Box background
    this.doc.setFillColor(...THEME.calcBoxBg);
    this.doc.roundedRect(this.margin, this.contentTop, boxWidth, boxHeight, 2, 2, 'F');

    // Left accent bar
    this.doc.setFillColor(...THEME.primary);
    this.doc.rect(this.margin, this.contentTop, 2.5, boxHeight, 'F');

    // Border
    this.doc.setDrawColor(...THEME.calcBoxBorder);
    this.doc.setLineWidth(0.3);
    this.doc.roundedRect(this.margin, this.contentTop, boxWidth, boxHeight, 2, 2, 'S');

    let calcY = this.contentTop + 6;
    const col1 = this.margin + 7;
    const col2 = this.margin + 95;

    // Title inside box
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.primary);
    this.doc.text('CALCULATION SHEET', col1, calcY);
    this.doc.setFontSize(7);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...THEME.textMuted);
    this.doc.text(`Ref: Member ${member.id.slice(0, 12)}  |  L = ${L.toFixed(3)} m`, col2, calcY);

    this.doc.setDrawColor(...THEME.calcBoxBorder);
    this.doc.setLineWidth(0.2);
    this.doc.line(col1, calcY + 2, this.margin + boxWidth - 5, calcY + 2);
    calcY += 7;

    this.doc.setFontSize(7.5);
    this.doc.setTextColor(...THEME.text);

    // Shear Force
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.primaryLight);
    this.doc.text('Shear Force:', col1, calcY);
    calcY += 4;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...THEME.text);
    this.doc.text(`V\u1D62 = ${V_start.toFixed(3)} kN`, col1, calcY);
    this.doc.text(`V\u2C7C = ${V_end.toFixed(3)} kN`, col1 + 50, calcY);
    this.doc.text(`V(max) = ${Vmax.toFixed(3)} kN`, col2, calcY);
    calcY += 5;

    // Bending Moment
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.primaryLight);
    this.doc.text('Bending Moment:', col1, calcY);
    calcY += 4;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...THEME.text);
    this.doc.text(`M\u1D62 = ${M_start.toFixed(3)} kN\u00B7m`, col1, calcY);
    this.doc.text(`M\u2C7C = ${M_end.toFixed(3)} kN\u00B7m`, col1 + 50, calcY);
    this.doc.text(`M(max) = ${Mmax.toFixed(3)} kN\u00B7m`, col2, calcY);
    calcY += 4;
    const y_max = 0.15;
    const sigma_b = I > 1e-12 ? (Mmax * y_max) / I / 1000 : 0;
    this.doc.setTextColor(...THEME.textSecondary);
    this.doc.text(`\u03C3b \u2248 M\u00B7y/I = ${sigma_b.toFixed(2)} MPa`, col2, calcY);
    calcY += 5;

    // Axial Force
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.primaryLight);
    this.doc.text('Axial Force:', col1, calcY);
    calcY += 4;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...THEME.text);
    this.doc.text(`N\u1D62 = ${N_start.toFixed(3)} kN`, col1, calcY);
    this.doc.text(`N\u2C7C = ${N_end.toFixed(3)} kN`, col1 + 50, calcY);
    this.doc.text(`N(max) = ${Nmax.toFixed(3)} kN`, col2, calcY);
    calcY += 4;
    const sigma_a = A > 1e-12 ? Nmax / A / 1000 : 0;
    this.doc.setTextColor(...THEME.textSecondary);
    this.doc.text(`\u03C3a = N/A = ${sigma_a.toFixed(2)} MPa`, col2, calcY);
    calcY += 5;

    // Deflection
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(...THEME.primaryLight);
    this.doc.text('Deflection:', col1, calcY);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...THEME.text);
    this.doc.text(`\u03B4(max) = ${(deltaMax * 1000).toFixed(3)} mm`, col1 + 40, calcY);
    this.doc.text(`L/\u03B4 = ${deltaMax > 0 ? (L / deltaMax).toFixed(0) : "\u221E"}`, col2, calcY);

    // Deflection status indicator
    const lOverDelta = deltaMax > 0 ? L / deltaMax : Infinity;
    const deflStatus = lOverDelta >= 300 ? 'OK' : 'REVIEW';
    const deflColor = deflStatus === 'OK' ? THEME.pass : THEME.fail;
    this.doc.setFillColor(...deflColor);
    this.doc.roundedRect(col2 + 40, calcY - 3, 14, 5, 1, 1, 'F');
    this.doc.setTextColor(...THEME.white);
    this.doc.setFontSize(6);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(deflStatus, col2 + 47, calcY + 0.5, { align: 'center' });

    this.doc.setTextColor(...THEME.text);
    this.contentTop += boxHeight + 5;
  }

  /**
   * Add combined structure diagram showing all members
   */
  addCombinedStructureDiagram(
    nodes: Array<{ id: string; x: number; y: number; z: number }>,
    members: Array<{
      id: string;
      startNodeId: string;
      endNodeId: string;
      diagramData?: {
        x_values: number[];
        shear_values: number[];
        moment_values: number[];
        axial_values: number[];
      };
    }>,
    diagramType: "SFD" | "BMD" | "AFD",
  ): void {
    this.addPage(`Combined ${diagramType} - Entire Structure`);
    this.addSectionHeading(
      `Combined ${diagramType === "SFD" ? "Shear Force" : diagramType === "BMD" ? "Bending Moment" : "Axial Force"} Diagram`,
    );

    // Calculate bounds
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs);
    const minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    // Canvas dimensions
    const canvasWidth = this.pageWidth - 2 * this.margin;
    const canvasHeight = 140;
    const padding = 35;
    const drawWidth = canvasWidth - 2 * padding;
    const drawHeight = canvasHeight - 2 * padding;

    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth * 3.78;
    canvas.height = canvasHeight * 3.78;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const scale = 3.78;
    const pxPadding = padding * scale;
    const pxDrawWidth = drawWidth * scale;
    const pxDrawHeight = drawHeight * scale;

    // Clear background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Coordinate transform
    const toCanvasX = (x: number) =>
      pxPadding + ((x - minX) / rangeX) * pxDrawWidth;
    const toCanvasY = (y: number) =>
      canvas.height - pxPadding - ((y - minY) / rangeY) * pxDrawHeight;

    // Draw grid
    ctx.strokeStyle = "#f0f0f0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = pxPadding + (pxDrawWidth / 10) * i;
      const y = pxPadding + (pxDrawHeight / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, pxPadding);
      ctx.lineTo(x, canvas.height - pxPadding);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pxPadding, y);
      ctx.lineTo(canvas.width - pxPadding, y);
      ctx.stroke();
    }

    // Draw members (baseline)
    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 4;
    for (const member of members) {
      const startNode = nodes.find((n) => n.id === member.startNodeId);
      const endNode = nodes.find((n) => n.id === member.endNodeId);
      if (startNode && endNode) {
        ctx.beginPath();
        ctx.moveTo(toCanvasX(startNode.x), toCanvasY(startNode.y));
        ctx.lineTo(toCanvasX(endNode.x), toCanvasY(endNode.y));
        ctx.stroke();
      }
    }

    // Diagram colors
    const colors: Record<string, string> = {
      SFD: "#dc2626",
      BMD: "#2563eb",
      AFD: "#16a34a",
    };
    const color = colors[diagramType];

    // Find global max for scaling
    let globalMax = 1;
    for (const member of members) {
      if (member.diagramData) {
        const values =
          diagramType === "SFD"
            ? member.diagramData.shear_values
            : diagramType === "BMD"
              ? member.diagramData.moment_values
              : member.diagramData.axial_values;
        const maxVal = Math.max(...values.map(Math.abs));
        if (maxVal > globalMax) globalMax = maxVal;
      }
    }

    // Scale factor for diagram offset from member (in pixels)
    const diagramScale = 30 / globalMax;

    // Draw diagram for each member
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.fillStyle = color.replace(")", ", 0.15)").replace("rgb", "rgba");

    for (const member of members) {
      const startNode = nodes.find((n) => n.id === member.startNodeId);
      const endNode = nodes.find((n) => n.id === member.endNodeId);
      if (!startNode || !endNode || !member.diagramData) continue;

      const values =
        diagramType === "SFD"
          ? member.diagramData.shear_values
          : diagramType === "BMD"
            ? member.diagramData.moment_values
            : member.diagramData.axial_values;
      const xValues = member.diagramData.x_values;

      if (values.length === 0) continue;

      // Calculate member direction
      const dx = endNode.x - startNode.x;
      const dy = endNode.y - startNode.y;
      const memberLen = Math.sqrt(dx * dx + dy * dy) || 1;
      const perpX = -dy / memberLen;
      const perpY = dx / memberLen;

      const startPx = toCanvasX(startNode.x);
      const startPy = toCanvasY(startNode.y);
      const endPx = toCanvasX(endNode.x);
      const endPy = toCanvasY(endNode.y);

      // Draw diagram polygon
      ctx.beginPath();
      ctx.moveTo(startPx, startPy);

      for (let i = 0; i < values.length; i++) {
        const t = xValues[i] / (xValues[xValues.length - 1] || 1);
        const basePx = startPx + t * (endPx - startPx);
        const basePy = startPy + t * (endPy - startPy);
        const offset = values[i] * diagramScale;
        ctx.lineTo(basePx + perpX * offset, basePy - perpY * offset);
      }

      ctx.lineTo(endPx, endPy);
      ctx.closePath();

      // Fill and stroke
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
          ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
            }
          : { r: 0, g: 0, b: 0 };
      };
      const rgb = hexToRgb(color);
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.stroke();

      // Add max value label
      const maxVal = Math.max(...values);
      const minVal = Math.min(...values);
      const maxIdx = values.indexOf(
        Math.abs(maxVal) > Math.abs(minVal) ? maxVal : minVal,
      );
      const t = xValues[maxIdx] / (xValues[xValues.length - 1] || 1);
      const labelPx = startPx + t * (endPx - startPx);
      const labelPy = startPy + t * (endPy - startPy);
      const labelOffset =
        (Math.abs(maxVal) > Math.abs(minVal) ? maxVal : minVal) * diagramScale;

      ctx.font = "bold 11px Arial";
      ctx.fillStyle = color;
      const labelValue = Math.abs(maxVal) > Math.abs(minVal) ? maxVal : minVal;
      ctx.fillText(
        `${labelValue.toFixed(1)}`,
        labelPx + perpX * labelOffset + 5,
        labelPy - perpY * labelOffset,
      );
    }

    // Draw nodes
    ctx.fillStyle = "#374151";
    for (const node of nodes) {
      const px = toCanvasX(node.x);
      const py = toCanvasY(node.y);
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Convert to image and add to PDF
    const imgData = canvas.toDataURL("image/png");
    this.ensureSpace(canvasHeight + 20);
    this.doc.addImage(
      imgData,
      "PNG",
      this.margin,
      this.contentTop,
      canvasWidth,
      canvasHeight,
    );

    // Add legend
    const legendY = this.contentTop + canvasHeight + 8;
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16),
    );
    const unit = diagramType === "BMD" ? "kN·m" : "kN";
    this.doc.text(
      `${diagramType} values in ${unit} | Max scale: ±${globalMax.toFixed(2)} ${unit}`,
      this.margin,
      legendY,
    );
    this.doc.setTextColor(...THEME.text);

    this.contentTop = legendY + 10;
  }

  // ============================================
  // CROSS-SECTIONAL DETAILS
  // ============================================

  /**
   * Add detailed cross-sectional properties for all members
   */
  addCrossSectionalDetails(
    members: Array<{
      id: string;
      sectionId: string;
      E?: number; // Young's Modulus (kN/m² or MPa)
      A?: number; // Cross-sectional Area (m² or mm²)
      Iy?: number; // Moment of Inertia about Y (m⁴ or mm⁴)
      Iz?: number; // Moment of Inertia about Z (m⁴ or mm⁴)
      J?: number; // Torsional constant
      length?: number; // Member length (m)
    }>,
  ): void {
    if (members.length === 0) return;

    this.addPage("Cross-Sectional Properties");
    this.addSectionHeading("Member Cross-Section Details");

    this.tableCount++;
    const headers = [
      "Member ID",
      "Section",
      "E (GPa)",
      "A (cm²)",
      "Iy (cm⁴)",
      "Iz (cm⁴)",
      "J (cm⁴)",
      "Length (m)",
    ];

    const data = members.map((m) => [
      m.id.slice(0, 10),
      m.sectionId || "Custom",
      m.E ? (m.E / 1e6).toFixed(0) : "200", // Convert kN/m² to GPa
      m.A ? (m.A * 1e4).toFixed(2) : "—", // Convert m² to cm²
      m.Iy ? (m.Iy * 1e8).toFixed(2) : "—", // Convert m⁴ to cm⁴
      m.Iz ? (m.Iz * 1e8).toFixed(2) : "—",
      m.J ? (m.J * 1e8).toFixed(2) : "—",
      m.length?.toFixed(3) || "—",
    ]);

    this.addResultsTable(
      `Table ${this.tableCount}: Cross-Sectional Properties`,
      headers,
      data,
    );

    // Add cross-section diagrams for each unique section
    const uniqueSections = [...new Set(members.map((m) => m.sectionId))];
    if (uniqueSections.length > 0 && uniqueSections.length <= 6) {
      this.addCrossSectionVisualizations(
        uniqueSections.filter((s) => s && s !== "Custom"),
      );
    }
  }

  /**
   * Draw cross-section visualization for common section types
   */
  private addCrossSectionVisualizations(sectionIds: string[]): void {
    this.syncYAfterTable(15);
    this.ensureSpace(80, "Cross-Section Details");
    let y = this.contentTop;

    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Section Profiles", this.margin, y);
    y += 8;

    const sectionWidth = 50;
    const sectionHeight = 40;
    let x = this.margin;

    for (const sectionId of sectionIds) {
      if (x + sectionWidth > this.pageWidth - this.margin) {
        x = this.margin;
        y += sectionHeight + 20;
      }

      // Draw section box
      this.doc.setDrawColor(100, 100, 100);
      this.doc.setLineWidth(0.3);
      this.doc.rect(x, y, sectionWidth, sectionHeight);

      // Draw section shape based on type
      this.drawSectionProfile(
        x + sectionWidth / 2,
        y + sectionHeight / 2,
        sectionId,
      );

      // Add section label
      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(
        sectionId.slice(0, 12),
        x + sectionWidth / 2,
        y + sectionHeight + 5,
        { align: "center" },
      );

      x += sectionWidth + 10;
    }
  }

  /**
   * Draw a section profile (I-beam, rectangular, circular, etc.)
   */
  private drawSectionProfile(cx: number, cy: number, sectionId: string): void {
    this.doc.setDrawColor(50, 50, 50);
    this.doc.setFillColor(200, 200, 200);
    this.doc.setLineWidth(0.5);

    const sectionType = sectionId.toLowerCase();

    if (
      sectionType.includes("ismb") ||
      sectionType.includes("w") ||
      sectionType.includes("ipe")
    ) {
      // I-section (wide flange)
      const w = 18,
        h = 24,
        tf = 3,
        tw = 2;
      // Top flange
      this.doc.rect(cx - w / 2, cy - h / 2, w, tf, "FD");
      // Web
      this.doc.rect(cx - tw / 2, cy - h / 2 + tf, tw, h - 2 * tf, "FD");
      // Bottom flange
      this.doc.rect(cx - w / 2, cy + h / 2 - tf, w, tf, "FD");
    } else if (
      sectionType.includes("ismc") ||
      sectionType.includes("c") ||
      sectionType.includes("channel")
    ) {
      // Channel section
      const w = 14,
        h = 24,
        tf = 3,
        tw = 2;
      // Top flange
      this.doc.rect(cx - w / 2, cy - h / 2, w, tf, "FD");
      // Web
      this.doc.rect(cx - w / 2, cy - h / 2 + tf, tw, h - 2 * tf, "FD");
      // Bottom flange
      this.doc.rect(cx - w / 2, cy + h / 2 - tf, w, tf, "FD");
    } else if (
      sectionType.includes("isa") ||
      sectionType.includes("angle") ||
      sectionType.includes("l")
    ) {
      // Angle section
      const w = 16,
        t = 3;
      // Vertical leg
      this.doc.rect(cx - w / 2, cy - w / 2, t, w, "FD");
      // Horizontal leg
      this.doc.rect(cx - w / 2, cy + w / 2 - t, w, t, "FD");
    } else if (sectionType.includes("rect") || sectionType.includes("rhs")) {
      // Rectangular hollow section
      const w = 16,
        h = 20,
        t = 2;
      this.doc.setFillColor(200, 200, 200);
      this.doc.rect(cx - w / 2, cy - h / 2, w, h, "FD");
      this.doc.setFillColor(255, 255, 255);
      this.doc.rect(cx - w / 2 + t, cy - h / 2 + t, w - 2 * t, h - 2 * t, "FD");
    } else if (
      sectionType.includes("chs") ||
      sectionType.includes("pipe") ||
      sectionType.includes("circular")
    ) {
      // Circular hollow section
      const r = 10,
        t = 2;
      this.doc.setFillColor(200, 200, 200);
      this.doc.circle(cx, cy, r, "FD");
      this.doc.setFillColor(255, 255, 255);
      this.doc.circle(cx, cy, r - t, "FD");
    } else {
      // Default: solid rectangle
      const w = 12,
        h = 20;
      this.doc.rect(cx - w / 2, cy - h / 2, w, h, "FD");
    }
  }

  // ============================================
  // FREE BODY DIAGRAM (FBD)
  // ============================================

  /**
   * Add Free Body Diagram showing structure with loads and reactions
   */
  addFreeBodyDiagram(
    nodes: Array<{ id: string; x: number; y: number; z: number }>,
    members: Array<{ id: string; startNodeId: string; endNodeId: string }>,
    loads: Array<{ nodeId: string; fx?: number; fy?: number; fz?: number }>,
    reactions: Array<{
      nodeId: string;
      fx: number;
      fy: number;
      fz?: number;
      mx?: number;
      my?: number;
      mz?: number;
    }>,
    supports: Array<{ nodeId: string; type: "fixed" | "pinned" | "roller" }>,
  ): void {
    this.addPage("Free Body Diagram");
    this.addSectionHeading("Structural Free Body Diagram (FBD)");

    // Calculate bounds
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs);
    const minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    // Canvas dimensions
    const canvasWidth = this.pageWidth - 2 * this.margin;
    const canvasHeight = 120;
    const padding = 30;
    const drawWidth = canvasWidth - 2 * padding;
    const drawHeight = canvasHeight - 2 * padding;

    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth * 3.78;
    canvas.height = canvasHeight * 3.78;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const scale = 3.78;
    const pxPadding = padding * scale;
    const pxDrawWidth = drawWidth * scale;
    const pxDrawHeight = drawHeight * scale;

    // Clear background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Coordinate transform
    const toCanvasX = (x: number) =>
      pxPadding + ((x - minX) / rangeX) * pxDrawWidth;
    const toCanvasY = (y: number) =>
      canvas.height - pxPadding - ((y - minY) / rangeY) * pxDrawHeight;

    // Draw grid
    ctx.strokeStyle = "#f0f0f0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = pxPadding + (pxDrawWidth / 10) * i;
      const y = pxPadding + (pxDrawHeight / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, pxPadding);
      ctx.lineTo(x, canvas.height - pxPadding);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pxPadding, y);
      ctx.lineTo(canvas.width - pxPadding, y);
      ctx.stroke();
    }

    // Draw members
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 4;
    for (const member of members) {
      const startNode = nodes.find((n) => n.id === member.startNodeId);
      const endNode = nodes.find((n) => n.id === member.endNodeId);
      if (startNode && endNode) {
        ctx.beginPath();
        ctx.moveTo(toCanvasX(startNode.x), toCanvasY(startNode.y));
        ctx.lineTo(toCanvasX(endNode.x), toCanvasY(endNode.y));
        ctx.stroke();
      }
    }

    // Draw supports
    for (const support of supports) {
      const node = nodes.find((n) => n.id === support.nodeId);
      if (!node) continue;

      const px = toCanvasX(node.x);
      const py = toCanvasY(node.y);

      if (support.type === "fixed") {
        // Fixed support - hatched rectangle
        ctx.fillStyle = "#6b7280";
        ctx.fillRect(px - 15, py, 30, 15);
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(px - 15 + i * 8, py);
          ctx.lineTo(px - 15 + i * 8 + 8, py + 15);
          ctx.stroke();
        }
      } else if (support.type === "pinned") {
        // Pinned support - triangle
        ctx.fillStyle = "#10b981";
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - 12, py + 20);
        ctx.lineTo(px + 12, py + 20);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#064e3b";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (support.type === "roller") {
        // Roller support - triangle with circle
        ctx.fillStyle = "#3b82f6";
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - 10, py + 15);
        ctx.lineTo(px + 10, py + 15);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py + 20, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // Draw applied loads (red arrows pointing down/direction)
    ctx.fillStyle = "#ef4444";
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    for (const load of loads) {
      const node = nodes.find((n) => n.id === load.nodeId);
      if (!node) continue;

      const px = toCanvasX(node.x);
      const py = toCanvasY(node.y);

      if (load.fy && load.fy !== 0) {
        const arrowLen = Math.min(40, Math.abs(load.fy) * 2);
        const dir = load.fy < 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(px, py - dir * 10);
        ctx.lineTo(px, py - dir * (10 + arrowLen));
        ctx.stroke();
        // Arrow head
        ctx.beginPath();
        ctx.moveTo(px, py - dir * 10);
        ctx.lineTo(px - 6, py - dir * 20);
        ctx.lineTo(px + 6, py - dir * 20);
        ctx.closePath();
        ctx.fill();
        // Label
        ctx.font = "bold 12px Arial";
        ctx.fillText(
          `${Math.abs(load.fy).toFixed(1)} kN`,
          px + 8,
          py - dir * 25,
        );
      }

      if (load.fx && load.fx !== 0) {
        const arrowLen = Math.min(40, Math.abs(load.fx) * 2);
        const dir = load.fx > 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(px + dir * 10, py);
        ctx.lineTo(px + dir * (10 + arrowLen), py);
        ctx.stroke();
        // Arrow head
        ctx.beginPath();
        ctx.moveTo(px + dir * 10, py);
        ctx.lineTo(px + dir * 20, py - 6);
        ctx.lineTo(px + dir * 20, py + 6);
        ctx.closePath();
        ctx.fill();
        // Label
        ctx.font = "bold 12px Arial";
        ctx.fillText(
          `${Math.abs(load.fx).toFixed(1)} kN`,
          px + dir * 45,
          py + 5,
        );
      }
    }

    // Draw reaction forces (green arrows)
    ctx.fillStyle = "#22c55e";
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 3;
    for (const reaction of reactions) {
      const node = nodes.find((n) => n.id === reaction.nodeId);
      if (!node) continue;

      const px = toCanvasX(node.x);
      const py = toCanvasY(node.y);

      if (Math.abs(reaction.fy) > 0.01) {
        const arrowLen = Math.min(40, Math.abs(reaction.fy) * 2);
        const dir = reaction.fy > 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(px, py + dir * 25);
        ctx.lineTo(px, py + dir * (25 + arrowLen));
        ctx.stroke();
        // Arrow head
        ctx.beginPath();
        ctx.moveTo(px, py + dir * 25);
        ctx.lineTo(px - 6, py + dir * 35);
        ctx.lineTo(px + 6, py + dir * 35);
        ctx.closePath();
        ctx.fill();
        // Label
        ctx.font = "bold 11px Arial";
        ctx.fillText(
          `R=${Math.abs(reaction.fy).toFixed(2)} kN`,
          px + 10,
          py + dir * 50,
        );
      }

      if (Math.abs(reaction.fx) > 0.01) {
        const arrowLen = Math.min(40, Math.abs(reaction.fx) * 2);
        const dir = reaction.fx > 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(px + dir * 25, py);
        ctx.lineTo(px + dir * (25 + arrowLen), py);
        ctx.stroke();
        // Arrow head
        ctx.beginPath();
        ctx.moveTo(px + dir * 25, py);
        ctx.lineTo(px + dir * 35, py - 6);
        ctx.lineTo(px + dir * 35, py + 6);
        ctx.closePath();
        ctx.fill();
        // Label
        ctx.font = "bold 11px Arial";
        ctx.fillText(
          `H=${Math.abs(reaction.fx).toFixed(2)} kN`,
          px + dir * 50,
          py - 8,
        );
      }
    }

    // Draw nodes
    ctx.fillStyle = "#1f2937";
    for (const node of nodes) {
      const px = toCanvasX(node.x);
      const py = toCanvasY(node.y);
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Node label
      ctx.font = "10px Arial";
      ctx.fillStyle = "#374151";
      ctx.fillText(node.id.slice(0, 8), px + 10, py - 10);
      ctx.fillStyle = "#1f2937";
    }

    // Convert to image and add to PDF
    const imgData = canvas.toDataURL("image/png");
    this.syncYAfterTable(10);
    this.ensureSpace(canvasHeight + 20);
    const y = this.contentTop;
    this.doc.addImage(
      imgData,
      "PNG",
      this.margin,
      y,
      canvasWidth,
      canvasHeight,
    );

    // Add legend
    const legendY = y + canvasHeight + 8;
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(...THEME.fail);
    this.doc.text("● Applied Loads (Red)", this.margin, legendY);
    this.doc.setTextColor(...THEME.pass);
    this.doc.text("● Reaction Forces (Green)", this.margin + 50, legendY);
    this.doc.setTextColor(...THEME.textSecondary);
    this.doc.text("● Members (Grey)", this.margin + 110, legendY);
    this.doc.setTextColor(...THEME.text);

    this.contentTop = legendY + 10;
  }

  // ============================================
  // DETAILED REACTIONS TABLE
  // ============================================

  /**
   * Add comprehensive reactions summary with totals and equilibrium check
   */
  addDetailedReactionsTable(
    reactions: ReactionRow[],
    loads: Array<{ nodeId: string; fx?: number; fy?: number; fz?: number }>,
  ): void {
    this.addPage("Reaction Forces");
    this.addSectionHeading("Support Reactions Summary");

    // Calculate totals
    const totalRx = reactions.reduce((sum, r) => sum + r.fx, 0);
    const totalRy = reactions.reduce((sum, r) => sum + r.fy, 0);
    const totalRz = reactions.reduce((sum, r) => sum + (r.fz ?? 0), 0);
    const totalMx = reactions.reduce((sum, r) => sum + (r.mx ?? 0), 0);
    const totalMy = reactions.reduce((sum, r) => sum + (r.my ?? 0), 0);
    const totalMz = reactions.reduce((sum, r) => sum + (r.mz ?? 0), 0);

    const totalLoadFx = loads.reduce((sum, l) => sum + (l.fx ?? 0), 0);
    const totalLoadFy = loads.reduce((sum, l) => sum + (l.fy ?? 0), 0);
    const totalLoadFz = loads.reduce((sum, l) => sum + (l.fz ?? 0), 0);

    // Reactions table
    this.tableCount++;
    const headers = [
      "Support",
      "Rx (kN)",
      "Ry (kN)",
      "Rz (kN)",
      "Mx (kN·m)",
      "My (kN·m)",
      "Mz (kN·m)",
    ];
    const data = reactions.map((r) => [
      r.nodeId.slice(0, 10),
      r.fx.toFixed(3),
      r.fy.toFixed(3),
      (r.fz ?? 0).toFixed(3),
      (r.mx ?? 0).toFixed(3),
      (r.my ?? 0).toFixed(3),
      (r.mz ?? 0).toFixed(3),
    ]);

    // Add totals row
    data.push([
      "TOTAL",
      totalRx.toFixed(3),
      totalRy.toFixed(3),
      totalRz.toFixed(3),
      totalMx.toFixed(3),
      totalMy.toFixed(3),
      totalMz.toFixed(3),
    ]);

    this.addResultsTable(
      `Table ${this.tableCount}: Reaction Forces`,
      headers,
      data,
    );

    // Equilibrium check
    this.syncYAfterTable(15);
    this.ensureSpace(30);
    let checkY = this.contentTop;

    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Equilibrium Check", this.margin, checkY);
    checkY += 6;

    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "normal");

    const equilibriumX = Math.abs(totalRx + totalLoadFx) < 0.01;
    const equilibriumY = Math.abs(totalRy + totalLoadFy) < 0.01;
    const equilibriumZ = Math.abs(totalRz + totalLoadFz) < 0.01;

    if (equilibriumX) {
      this.doc.setTextColor(...THEME.pass);
    } else {
      this.doc.setTextColor(...THEME.fail);
    }
    this.doc.text(
      `ΣFx = ${(totalRx + totalLoadFx).toFixed(4)} kN ${equilibriumX ? "✓" : "✗"}`,
      this.margin,
      checkY,
    );

    if (equilibriumY) {
      this.doc.setTextColor(...THEME.pass);
    } else {
      this.doc.setTextColor(...THEME.fail);
    }
    this.doc.text(
      `ΣFy = ${(totalRy + totalLoadFy).toFixed(4)} kN ${equilibriumY ? "✓" : "✗"}`,
      this.margin + 60,
      checkY,
    );

    if (equilibriumZ) {
      this.doc.setTextColor(...THEME.pass);
    } else {
      this.doc.setTextColor(...THEME.fail);
    }
    this.doc.text(
      `ΣFz = ${(totalRz + totalLoadFz).toFixed(4)} kN ${equilibriumZ ? "✓" : "✗"}`,
      this.margin + 120,
      checkY,
    );

    this.doc.setTextColor(...THEME.text);
  }

  // ============================================
  // SAVE
  // ============================================

  /**
   * Save the PDF report
   */
  save(filename: string): void {
    // Add footers to all pages
    this.addFooter();

    // Generate filename
    const cleanFilename = filename.replace(/[^a-zA-Z0-9]/g, "_");
    const timestamp = format(new Date(), "yyyyMMdd_HHmm");
    const fullFilename = `${cleanFilename}_Report_${timestamp}.pdf`;

    // Save
    this.doc.save(fullFilename);
  }

  /**
   * Get the PDF as a Blob (for uploading)
   */
  getBlob(): Blob {
    this.addFooter();
    return this.doc.output("blob");
  }

  /**
   * Get the PDF as a data URL (for preview)
   */
  getDataUrl(): string {
    this.addFooter();
    return this.doc.output("dataurlstring");
  }

  // ============================================
  // INPUT DATA TABLES
  // ============================================

  /**
   * Add node coordinates table
   */
  addNodesTable(
    nodes: Array<{ id: string; x: number; y: number; z: number }>,
  ): void {
    this.tableCount++;
    this.addResultsTable(
      `Table ${this.tableCount}: Node Coordinates`,
      ["Node ID", "X (m)", "Y (m)", "Z (m)"],
      nodes.map((node) => [
        node.id.slice(0, 10),
        node.x.toFixed(3),
        node.y.toFixed(3),
        node.z.toFixed(3),
      ]),
    );
  }

  /**
   * Add members table
   */
  addMembersTable(
    members: Array<{
      id: string;
      startNodeId: string;
      endNodeId: string;
      sectionId: string;
    }>,
  ): void {
    this.tableCount++;
    this.addResultsTable(
      `Table ${this.tableCount}: Member Properties`,
      ["Member ID", "Start Node", "End Node", "Section"],
      members.map((member) => [
        member.id.slice(0, 10),
        member.startNodeId.slice(0, 10),
        member.endNodeId.slice(0, 10),
        member.sectionId,
      ]),
    );
  }

  // ============================================
  // HAND CALCULATION STEPS
  // ============================================

  /**
   * Add hand calculation steps from backend analysis
   */
  addHandCalcSteps(steps: string[], title?: string): void {
    this.syncYAfterTable(15);
    this.ensureSpace(40, "Analysis Calculations");
    const startY = this.contentTop;

    // Section Title
    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...THEME.primary);
    this.doc.text(title || "Hand Calculation Steps", this.margin, startY);
    this.doc.setTextColor(...THEME.text);

    let y = startY + 8;

    // Add each step
    for (const step of steps) {
      // Check for page break — ensure at least 20mm for a wrapped line
      if (y > this.usableBottom - 20) {
        this.doc.addPage();
        this.addHeader("Analysis Calculations (continued)");
        y = this.margin + this.headerHeight + 5;
      }

      // Format step text
      this.doc.setFontSize(9);
      this.doc.setFont("helvetica", "normal");

      // Check if it's a step number line
      if (step.startsWith("Step")) {
        this.doc.setFont("helvetica", "bold");
        this.doc.setTextColor(...THEME.textSecondary);
      } else {
        this.doc.setTextColor(...THEME.text);
      }

      // Wrap long lines
      const lines = this.doc.splitTextToSize(
        step,
        this.pageWidth - 2 * this.margin - 5,
      );
      this.doc.text(lines, this.margin + 3, y);

      y += lines.length * 4 + 2;
      this.doc.setTextColor(...THEME.text);
    }
  }

  // ============================================
  // COMPLETE REPORT GENERATION
  // ============================================

  /**
   * Generate a complete industry-standard structural analysis report.
   *
   * Report structure (ARUP / WSP / Buro Happold style):
   *   Cover → Document Control → Table of Contents → Executive Summary →
   *   Design Basis → Structural Model → Input Data → Analysis Results →
   *   Design Verification → Conclusions → Signatures → Legal Disclaimer
   */
  generateFullReport(options: {
    project: ProjectData;
    canvasImage?: string;
    nodes: Array<{ id: string; x: number; y: number; z: number }>;
    members: Array<{
      id: string;
      startNodeId: string;
      endNodeId: string;
      sectionId: string;
    }>;
    handCalcSteps?: string[];
    reactions?: ReactionRow[];
    memberForces?: MemberForceRow[];
    designResults?: DesignResult[];
    checkedBy?: string;
    approvedBy?: string;
    revision?: string;
    classification?: string;
  }): void {
    const {
      project,
      canvasImage,
      nodes,
      members,
      handCalcSteps,
      reactions,
      memberForces,
      designResults,
      checkedBy = '',
      approvedBy = '',
      revision = '00',
      classification = 'CONFIDENTIAL',
    } = options;

    // Reset section counter for fresh numbering
    this.sectionNumber = 0;
    this.tocEntries = [];

    // ================================================================
    // COVER PAGE  (page 1 — no header/footer)
    // ================================================================
    this.addCoverPage({
      projectName: project.projectName,
      subtitle: 'Structural Analysis Report',
      clientName: project.clientName,
      projectNumber: project.projectNumber,
      engineerName: project.engineerName,
      checkedBy,
      approvedBy,
      revision,
      classification,
    });

    // ================================================================
    // DOCUMENT CONTROL  (page 2)
    // ================================================================
    this.addDocumentControlPage({
      engineerName: project.engineerName,
      checkedBy,
      approvedBy,
    });

    // ================================================================
    // TABLE OF CONTENTS  (page 3 — placeholder, updated at end)
    // ================================================================
    const tocPageNumber = this.doc.getNumberOfPages() + 1;
    this.doc.addPage();
    // We will render the TOC at the end once we know page numbers

    // ================================================================
    // SECTION 1: EXECUTIVE SUMMARY
    // ================================================================
    this.doc.addPage();
    this.addHeader('Executive Summary');

    // Compute summary statistics
    const maxDisp = nodes.length > 0 ? 0 : 0; // Will be overridden by actual data if available
    const maxStress = memberForces && memberForces.length > 0
      ? safeAbsMax(memberForces.map(mf => Math.abs(mf.axial)), 0)
      : 0;
    const passCount = designResults ? designResults.filter(d => d.status === 'PASS').length : 0;
    const failCount = designResults ? designResults.filter(d => d.status === 'FAIL').length : 0;
    const overallStatus: 'PASS' | 'FAIL' | 'WARNING' = failCount > 0 ? 'FAIL' : (designResults && designResults.length > 0 ? 'PASS' : 'WARNING');
    const criticalMembers = designResults ? designResults.filter(d => d.status === 'FAIL').map(d => `Member ${d.memberId} — ${d.checkType} (D/C = ${d.criticalRatio.toFixed(2)})`) : [];

    this.tocEntries.push({ level: 1, number: '1', title: 'Executive Summary', page: this.doc.getNumberOfPages() });
    this.addNumberedSectionHeading('1.0', 'EXECUTIVE SUMMARY');

    this.addExecutiveSummary({
      totalNodes: nodes.length,
      totalMembers: members.length,
      totalLoads: 1,
      maxDisplacement: maxDisp,
      maxStress,
      overallStatus,
      criticalMembers,
      analysisTime: 0,
    });

    // ================================================================
    // SECTION 2: DESIGN BASIS
    // ================================================================
    this.doc.addPage();
    this.addHeader('Design Basis');
    this.tocEntries.push({ level: 1, number: '2', title: 'Design Basis', page: this.doc.getNumberOfPages() });
    this.addDesignBasisSection();

    // ================================================================
    // SECTION 3: STRUCTURAL MODEL
    // ================================================================
    this.doc.addPage();
    this.addHeader('Structural Model');
    this.tocEntries.push({ level: 1, number: '3', title: 'Structural Model', page: this.doc.getNumberOfPages() });
    this.addNumberedSectionHeading('3.0', 'STRUCTURAL MODEL');

    // Project information
    this.addSubSectionHeading('3.1', 'Project Information');
    this.addProjectInfo(project);

    // 3D Model snapshot
    if (canvasImage) {
      this.ensureSpace(90);
      this.add3DSnapshot(canvasImage, 'Figure 1 — 3D Structural Model View');
    }

    // Model statistics summary
    this.ensureSpace(30);
    let statsY = this.contentTop;
    this.addSubSectionHeading('3.2', 'Model Summary');
    statsY = this.contentTop;
    autoTable(this.doc, {
      startY: statsY,
      head: [['Parameter', 'Value']],
      body: [
        ['Total Nodes', nodes.length.toString()],
        ['Total Members', members.length.toString()],
        ['Total Load Cases', '1'],
        ['Analysis Type', 'Linear Static'],
        ['Design Code', designResults && designResults.length > 0 ? designResults[0].designCode : 'N/A'],
      ],
      theme: 'grid',
      headStyles: { fillColor: THEME.primary, textColor: THEME.headerText, fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: THEME.rowAlt },
      margin: { left: this.margin, right: this.margin },
    });
    this.syncYAfterTable(5);

    // ================================================================
    // SECTION 4: INPUT DATA
    // ================================================================
    this.doc.addPage();
    this.addHeader('Input Data');
    this.tocEntries.push({ level: 1, number: '4', title: 'Input Data', page: this.doc.getNumberOfPages() });
    this.addNumberedSectionHeading('4.0', 'INPUT DATA');

    // 4.1 Node coordinates
    if (nodes.length > 0) {
      this.addSubSectionHeading('4.1', 'Node Coordinates');
      this.addNodesTable(nodes);
    }

    // 4.2 Member connectivity
    if (members.length > 0) {
      this.addSubSectionHeading('4.2', 'Member Connectivity');
      this.addMembersTable(members);
    }

    // ================================================================
    // SECTION 5: ANALYSIS RESULTS
    // ================================================================
    this.doc.addPage();
    this.addHeader('Analysis Results');
    this.tocEntries.push({ level: 1, number: '5', title: 'Analysis Results', page: this.doc.getNumberOfPages() });
    this.addNumberedSectionHeading('5.0', 'ANALYSIS RESULTS');

    // 5.1 Hand calculation verification
    if (handCalcSteps && handCalcSteps.length > 0) {
      this.addSubSectionHeading('5.1', 'Calculation Verification');
      this.addHandCalcSteps(handCalcSteps, 'Calculation Steps');
    }

    // 5.2 Support reactions
    if (reactions && reactions.length > 0) {
      const subNum = handCalcSteps && handCalcSteps.length > 0 ? '5.2' : '5.1';
      this.addSubSectionHeading(subNum, 'Support Reactions');
      this.addReactionsTable(reactions, 'Table — Support Reactions');
    }

    // 5.3 Member internal forces
    if (memberForces && memberForces.length > 0) {
      let subNum = '5.2';
      if (handCalcSteps && handCalcSteps.length > 0 && reactions && reactions.length > 0) subNum = '5.3';
      else if (handCalcSteps && handCalcSteps.length > 0 || (reactions && reactions.length > 0)) subNum = '5.2';
      this.addSubSectionHeading(subNum, 'Member Internal Forces');
      this.addMemberForcesTable(memberForces, 'Table — Member Internal Forces');
    }

    // ================================================================
    // SECTION 6: DESIGN VERIFICATION
    // ================================================================
    if (designResults && designResults.length > 0) {
      this.doc.addPage();
      this.addHeader('Design Verification');
      this.tocEntries.push({ level: 1, number: '6', title: 'Design Verification', page: this.doc.getNumberOfPages() });
      // addDesignSection renders its own section heading internally
      this.addSubSectionHeading('6.1', 'Member Design Checks');
      this.addDesignSection(designResults);
    }

    // ================================================================
    // SECTION 7: CONCLUSIONS & RECOMMENDATIONS
    // ================================================================
    const conclusionSection = designResults && designResults.length > 0 ? 7 : 6;
    this.doc.addPage();
    this.addHeader('Conclusions');
    this.tocEntries.push({ level: 1, number: conclusionSection.toString(), title: 'Conclusions & Recommendations', page: this.doc.getNumberOfPages() });
    this.addConclusionsPage({
      overallStatus,
      passCount,
      failCount,
      totalMembers: members.length,
      criticalMembers,
      maxStress,
    });

    // ================================================================
    // APPENDIX: SIGNATURE & CERTIFICATION
    // ================================================================
    this.doc.addPage();
    this.addHeader('Certification');
    this.tocEntries.push({ level: 1, number: 'A', title: 'Certification & Signatures', page: this.doc.getNumberOfPages() });
    this.addSignaturePage({
      engineerName: project.engineerName || '',
      checkedBy,
      approvedBy,
      projectName: project.projectName,
      projectNumber: project.projectNumber || '',
    });

    // ================================================================
    // LEGAL DISCLAIMER (final page)
    // ================================================================
    this.addLegalDisclaimer();

    // ================================================================
    // BACK-FILL: Render the Table of Contents on the reserved page
    // ================================================================
    this.doc.setPage(tocPageNumber);
    this.contentTop = this.margin + this.headerHeight;
    this.addHeader('Table of Contents');
    this.addTableOfContents();
  }

  // ============================================
  // WATERMARK  —  Subtle professional branding
  // ============================================

  /**
   * Add a subtle watermark to all pages (skips the cover page).
   * Uses a faint diagonal "BeamLab" text and a thin
   * document-reference stamp at the bottom-right.
   */
  addWatermark(): void {
    const totalPages = this.doc.getNumberOfPages();

    for (let i = 2; i <= totalPages; i++) {   // Skip cover (page 1)
      this.doc.setPage(i);

      // ---- Diagonal centre watermark ----
      this.doc.setFontSize(48);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(230, 235, 240);   // Very faint grey-blue
      this.doc.text('BEAMLAB', this.pageWidth / 2, this.pageHeight / 2, {
        align: 'center',
        angle: 35,
      });

      // ---- Small doc reference stamp (bottom-right) ----
      this.doc.setFontSize(6);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(200, 205, 215);
      this.doc.text(
        `Ref: ${this.documentRef}  |  Rev ${this.revision}`,
        this.pageWidth - this.margin,
        this.pageHeight - 4,
        { align: 'right' },
      );
    }

    this.doc.setTextColor(...THEME.text);
  }

  // ============================================
  // ENHANCED SAVE  —  Watermark + Footer + Metadata
  // ============================================

  /**
   * Finalise and save the PDF report.
   * Applies watermarks, footers across all pages and sets PDF metadata.
   */
  saveWithWatermark(filename: string): void {
    // Apply watermark to all pages
    this.addWatermark();

    // Apply footers to all pages (footer skips cover internally)
    this.addFooter();

    // Set PDF document properties
    this.doc.setProperties({
      title: `${this.projectTitle} — Structural Analysis Report`,
      subject: 'Structural Engineering Analysis Report',
      author: this.preparedBy || 'BeamLab',
      creator: 'BeamLab',
      keywords: 'structural analysis, engineering, report, BeamLab',
    });

    // Generate professional filename
    const cleanFilename = filename.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
    const fullFilename = `${cleanFilename}_Report_${timestamp}.pdf`;

    // Save
    this.doc.save(fullFilename);
  }
  addExecutiveSummary(options: {
    totalNodes: number;
    totalMembers: number;
    totalLoads: number;
    maxDisplacement: number;
    maxStress: number;
    overallStatus: "PASS" | "FAIL" | "WARNING";
    criticalMembers: string[];
    analysisTime: number;
  }): void {
    const {
      totalNodes,
      totalMembers,
      totalLoads,
      maxDisplacement,
      maxStress,
      overallStatus,
      criticalMembers,
    } = options;

    let y = this.contentTop + 2;

    // ---- Overall Status Banner ----
    const bannerW = this.pageWidth - 2 * this.margin;
    const bannerH = 14;
    const statusMeta: Record<string, { bg: [number, number, number]; label: string }> = {
      PASS:    { bg: THEME.pass, label: 'ALL CHECKS PASSED' },
      FAIL:    { bg: THEME.fail, label: 'DESIGN CHECKS FAILED' },
      WARNING: { bg: THEME.warn, label: 'REVIEW REQUIRED' },
    };
    const sm = statusMeta[overallStatus] || statusMeta['WARNING'];

    this.doc.setFillColor(...sm.bg);
    this.doc.roundedRect(this.margin, y, bannerW, bannerH, 2, 2, 'F');
    this.doc.setTextColor(...THEME.white);
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(sm.label, this.margin + bannerW / 2, y + 9.5, { align: 'center' });

    y += bannerH + 8;

    // ---- KPI Cards (4 across) ----
    const cardCount = 4;
    const gap = 4;
    const cardW = (bannerW - (cardCount - 1) * gap) / cardCount;
    const cardH = 22;
    const kpis = [
      { label: 'NODES', value: totalNodes.toString(), color: THEME.accent },
      { label: 'MEMBERS', value: totalMembers.toString(), color: THEME.accent },
      { label: 'LOAD CASES', value: totalLoads.toString(), color: THEME.primaryLight },
      { label: 'PEAK STRESS', value: `${maxStress.toFixed(1)} MPa`, color: THEME.primary },
    ];

    for (let i = 0; i < cardCount; i++) {
      const cx = this.margin + i * (cardW + gap);
      const kpi = kpis[i];

      // Card background
      this.doc.setFillColor(245, 248, 254);
      this.doc.setDrawColor(...kpi.color);
      this.doc.setLineWidth(0.4);
      this.doc.roundedRect(cx, y, cardW, cardH, 1.5, 1.5, 'FD');

      // Top accent bar
      this.doc.setFillColor(...kpi.color);
      this.doc.rect(cx, y, cardW, 2, 'F');

      // Value
      this.doc.setFontSize(13);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...THEME.primary);
      this.doc.text(kpi.value, cx + cardW / 2, y + 12, { align: 'center' });

      // Label
      this.doc.setFontSize(6.5);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...THEME.textSecondary);
      this.doc.text(kpi.label, cx + cardW / 2, y + 18, { align: 'center' });
    }

    y += cardH + 8;

    // ---- Summary Statistics Table ----
    autoTable(this.doc, {
      startY: y,
      head: [['Parameter', 'Value', 'Unit']],
      body: [
        ['Total Nodes', totalNodes.toString(), '—'],
        ['Total Members', totalMembers.toString(), '—'],
        ['Total Load Cases', totalLoads.toString(), '—'],
        ['Max. Displacement', maxDisplacement.toFixed(4), 'mm'],
        ['Max. Axial Stress', maxStress.toFixed(2), 'MPa'],
        ['Overall Status', overallStatus, '—'],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: THEME.primary,
        textColor: THEME.headerText,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        cellPadding: 3,
      },
      bodyStyles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: THEME.text, cellWidth: 55 },
        1: { halign: 'right', cellWidth: 40 },
        2: { halign: 'center', cellWidth: 20, textColor: THEME.textSecondary },
      },
      alternateRowStyles: { fillColor: THEME.rowAlt },
      margin: { left: this.margin, right: this.margin },
      tableLineColor: THEME.border,
      tableLineWidth: 0.2,
      didParseCell: (data) => {
        // Color the status cell
        if (data.section === 'body' && data.row.index === 5 && data.column.index === 1) {
          if (overallStatus === 'PASS') {
            data.cell.styles.textColor = THEME.pass;
          } else if (overallStatus === 'FAIL') {
            data.cell.styles.textColor = THEME.fail;
          } else {
            data.cell.styles.textColor = THEME.warn;
          }
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    this.syncYAfterTable(8);

    // ---- Critical Members Warning Box ----
    if (criticalMembers.length > 0) {
      this.ensureSpace(35);
      y = this.contentTop;

      const boxH = Math.min(criticalMembers.length, 5) * 5 + 16;
      this.doc.setFillColor(255, 245, 245);
      this.doc.setDrawColor(...THEME.fail);
      this.doc.setLineWidth(0.4);
      this.doc.roundedRect(this.margin, y, bannerW, boxH, 2, 2, 'FD');

      // Left red accent bar
      this.doc.setFillColor(...THEME.fail);
      this.doc.rect(this.margin, y, 4, boxH, 'F');

      // Warning title
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...THEME.fail);
      this.doc.text('CRITICAL MEMBERS REQUIRING ATTENTION', this.margin + 8, y + 6);

      // Member list
      let ly = y + 12;
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(...THEME.text);

      for (const member of criticalMembers.slice(0, 5)) {
        this.doc.text(`▸  ${member}`, this.margin + 8, ly);
        ly += 5;
      }

      if (criticalMembers.length > 5) {
        this.doc.setTextColor(...THEME.textMuted);
        this.doc.text(`  … and ${criticalMembers.length - 5} additional members`, this.margin + 8, ly);
      }

      this.contentTop = y + boxH + 5;
    }

    // Reset text color
    this.doc.setTextColor(...THEME.text);
  }

  // ============================================
  // DEFLECTION SUMMARY
  // ============================================

  /**
   * Add deflection check summary
   */
  addDeflectionSummary(
    data: Array<{
      nodeId: string;
      displacement: number;
      limit: number;
      ratio: number;
      status: "OK" | "EXCESSIVE";
    }>,
  ): void {
    this.tableCount++;

    this.syncYAfterTable(15);
    this.ensureSpace(40, "Deflection Checks");
    const startY = this.contentTop;

    // Title
    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Deflection Summary", this.margin, startY);

    const passCount = data.filter((d) => d.status === "OK").length;
    const failCount = data.filter((d) => d.status === "EXCESSIVE").length;

    // Summary
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "normal");
    const summaryY = startY + 6;
    this.doc.setTextColor(...THEME.pass);
    this.doc.text(`✓ ${passCount} OK`, this.margin, summaryY);
    this.doc.setTextColor(...THEME.fail);
    this.doc.text(`✗ ${failCount} Excessive`, this.margin + 30, summaryY);
    this.doc.setTextColor(...THEME.text);

    // Table
    autoTable(this.doc, {
      startY: summaryY + 5,
      head: [["Node", "Displacement (mm)", "Limit (mm)", "Ratio", "Status"]],
      body: data.map((d) => [
        d.nodeId.slice(0, 8),
        d.displacement.toFixed(4),
        d.limit.toFixed(2),
        `L/${(1 / d.ratio).toFixed(0)}`,
        d.status,
      ]),
      theme: "grid",
      headStyles: {
        fillColor: THEME.headerBg,
        textColor: THEME.headerText,
        fontStyle: "bold",
        fontSize: 8,
        halign: "center",
        cellPadding: 2.5,
      },
      bodyStyles: {
        fontSize: 8,
        halign: "center",
        cellPadding: 2,
      },
      alternateRowStyles: { fillColor: THEME.rowAlt },
      tableLineColor: THEME.border,
      tableLineWidth: 0.2,
      didParseCell: (cellData) => {
        if (cellData.section === "body" && cellData.column.index === 4) {
          const status = cellData.cell.text[0];
          if (status === "EXCESSIVE") {
            cellData.cell.styles.textColor = THEME.fail;
            cellData.cell.styles.fontStyle = "bold";
          } else {
            cellData.cell.styles.textColor = THEME.pass;
          }
        }
      },
      margin: { left: this.margin, right: this.margin },
    });
  }

  // ============================================
  // LOAD COMBINATION TABLE
  // ============================================

  /**
   * Add load combinations table
   */
  addLoadCombinations(
    combinations: Array<{
      name: string;
      type: string;
      factors: Record<string, number>;
    }>,
  ): void {
    this.tableCount++;

    this.syncYAfterTable(15);
    this.ensureSpace(40, "Load Combinations");
    const startY = this.contentTop;

    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Load Combinations", this.margin, startY);

    const allLoadNames = [
      ...new Set(combinations.flatMap((c) => Object.keys(c.factors))),
    ];
    const headers = [
      "Combination",
      "Type",
      ...allLoadNames.map((n) => n.slice(0, 6)),
    ];

    const rows = combinations.map((c) => [
      c.name,
      c.type,
      ...allLoadNames.map((n) => (c.factors[n] ?? 0).toFixed(2)),
    ]);

    autoTable(this.doc, {
      startY: startY + 5,
      head: [headers],
      body: rows,
      theme: "grid",
      headStyles: {
        fillColor: THEME.headerBg,
        textColor: THEME.headerText,
        fontStyle: "bold",
        fontSize: 7,
        halign: "center",
        cellPadding: 2.5,
      },
      bodyStyles: {
        fontSize: 7,
        halign: "center",
        cellPadding: 2,
      },
      alternateRowStyles: { fillColor: THEME.rowAlt },
      tableLineColor: THEME.border,
      tableLineWidth: 0.2,
      margin: { left: this.margin, right: this.margin },
    });
  }

  // ============================================
  // MATERIAL PROPERTIES TABLE
  // ============================================

  /**
   * Add material properties table
   */
  addMaterialProperties(
    materials: Array<{
      name: string;
      E: number; // GPa
      fy: number; // MPa
      fu?: number; // MPa
      density: number; // kg/m³
      type: string;
    }>,
  ): void {
    this.tableCount++;

    this.syncYAfterTable(15);
    this.ensureSpace(40);
    const startY = this.contentTop;

    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...THEME.primary);
    this.doc.text("Material Properties", this.margin, startY);
    this.doc.setTextColor(...THEME.text);

    autoTable(this.doc, {
      startY: startY + 5,
      head: [
        ["Material", "Type", "E (GPa)", "fy (MPa)", "fu (MPa)", "ρ (kg/m³)"],
      ],
      body: materials.map((m) => [
        m.name,
        m.type,
        m.E.toFixed(0),
        m.fy.toFixed(0),
        (m.fu ?? "-").toString(),
        m.density.toFixed(0),
      ]),
      theme: "grid",
      headStyles: {
        fillColor: THEME.headerBg,
        textColor: THEME.headerText,
        fontStyle: "bold",
        fontSize: 9,
        halign: "center",
        cellPadding: 2.5,
      },
      bodyStyles: {
        fontSize: 9,
        halign: "center",
        cellPadding: 2,
      },
      alternateRowStyles: { fillColor: THEME.rowAlt },
      tableLineColor: THEME.border,
      tableLineWidth: 0.2,
      margin: { left: this.margin, right: this.margin },
    });
  }

  // ============================================
  // SECTION PROPERTIES TABLE
  // ============================================

  /**
   * Add section properties table
   */
  addSectionProperties(
    sections: Array<{
      name: string;
      type: string;
      A: number; // mm²
      Iy: number; // mm⁴ × 10⁶
      Iz: number; // mm⁴ × 10⁶
      J: number; // mm⁴ × 10⁶
      Zy: number; // mm³ × 10³
      Zz: number; // mm³ × 10³
    }>,
  ): void {
    this.tableCount++;

    this.syncYAfterTable(15);
    this.ensureSpace(40, "Section Properties");
    const startY = this.contentTop;

    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(...THEME.primary);
    this.doc.text("Section Properties", this.margin, startY);
    this.doc.setTextColor(...THEME.text);

    autoTable(this.doc, {
      startY: startY + 5,
      head: [
        [
          "Section",
          "Type",
          "A (mm²)",
          "Iy (×10⁶)",
          "Iz (×10⁶)",
          "J (×10⁶)",
          "Zy (×10³)",
          "Zz (×10³)",
        ],
      ],
      body: sections.map((s) => [
        s.name,
        s.type,
        s.A.toFixed(0),
        s.Iy.toFixed(2),
        s.Iz.toFixed(2),
        s.J.toFixed(2),
        s.Zy.toFixed(2),
        s.Zz.toFixed(2),
      ]),
      theme: "grid",
      headStyles: {
        fillColor: THEME.headerBg,
        textColor: THEME.headerText,
        fontStyle: "bold",
        fontSize: 8,
        halign: "center",
        cellPadding: 2.5,
      },
      bodyStyles: {
        fontSize: 8,
        halign: "center",
        cellPadding: 2,
      },
      alternateRowStyles: { fillColor: THEME.rowAlt },
      tableLineColor: THEME.border,
      tableLineWidth: 0.2,
      margin: { left: this.margin, right: this.margin },
    });
  }
}

// ============================================
// CONVENIENCE FUNCTION
// ============================================

/**
 * Quick function to generate a complete report
 */
export async function generateAnalysisReport(options: {
  projectName: string;
  clientName?: string;
  engineerName?: string;
  canvasElement?: HTMLCanvasElement;
  nodes: Array<{ id: string; x: number; y: number; z: number }>;
  members: Array<{
    id: string;
    startNodeId: string;
    endNodeId: string;
    sectionId: string;
  }>;
  handCalcSteps?: string[];
  reactions?: ReactionRow[];
  memberForces?: MemberForceRow[];
  designResults?: DesignResult[];
  executiveSummary?: {
    totalNodes: number;
    totalMembers: number;
    totalLoads: number;
    maxDisplacement: number;
    maxStress: number;
    overallStatus: "PASS" | "FAIL" | "WARNING";
    criticalMembers: string[];
    analysisTime: number;
  };
}): Promise<void> {
  const {
    projectName,
    clientName,
    engineerName,
    canvasElement,
    nodes,
    members,
    handCalcSteps,
    reactions,
    memberForces,
    designResults,
    executiveSummary,
  } = options;

  // Get canvas screenshot if available
  let canvasImage: string | undefined;
  if (canvasElement) {
    canvasImage = canvasElement.toDataURL("image/png");
  }

  // Create report generator
  const report = new ReportGenerator();

  // Generate full report
  report.generateFullReport({
    project: {
      projectName,
      clientName,
      engineerName,
      description: "Structural Analysis Report generated by BeamLab",
    },
    canvasImage,
    nodes,
    members,
    handCalcSteps,
    reactions,
    memberForces,
    designResults,
  });

  // Add executive summary if provided (note: generateFullReport already includes
  // an auto-computed executive summary — only override if caller provides one)
  // Removed duplicate: generateFullReport() now handles this internally.

  // Save with watermark
  report.saveWithWatermark(projectName);
}

/**
 * Generate quick summary report (1-2 pages)
 */
export function generateQuickReport(options: {
  projectName: string;
  maxDisplacement: { nodeId: string; value: number };
  maxStress: { memberId: string; value: number };
  designStatus: "PASS" | "FAIL";
  criticalRatio: number;
}): void {
  const report = new ReportGenerator();

  report.addHeader("Quick Analysis Summary");
  report.addProjectInfo({ projectName: options.projectName });

  // Add summary text
  report.addParagraph(`
        Analysis completed successfully.
        
        Maximum Displacement: ${options.maxDisplacement.value.toFixed(4)} mm at Node ${options.maxDisplacement.nodeId}
        Maximum Stress: ${options.maxStress.value.toFixed(2)} MPa in Member ${options.maxStress.memberId}
        
        Overall Design Status: ${options.designStatus}
        Critical Utilization Ratio: ${options.criticalRatio.toFixed(3)}
    `);

  report.saveWithWatermark(options.projectName + "_Quick");
}

export default ReportGenerator;
