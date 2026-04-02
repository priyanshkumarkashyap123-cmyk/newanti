/**
 * ReportGenerator - Professional PDF Report Generator for BeamLab Ultimate
 * Generates analysis reports with project info, 3D snapshots, and results tables
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { LOGO_BASE64 } from "../utils/LogoData";
import { THEME } from "./reporting/reportTheme";
import { safeAbsMax, hexToRgb } from "./reporting/reportUtils";
import type { DesignResult, MemberForceRow, NodeDisplacementRow, ProjectData, ReactionRow } from "./reporting/reportTypes";
import {
  addCombinedStructureDiagram as addCombinedStructureDiagramUtil,
  type CombinedStructureDiagramState,
} from "./reporting/generators/CombinedStructureDiagramUtils";
import {
  addDetailedReactionsTable as addDetailedReactionsTableUtil,
  addFreeBodyDiagram as addFreeBodyDiagramUtil,
  type FreeBodyState,
} from "./reporting/generators/FreeBodyAndReactionUtils";
import {
  addCrossSectionalDetails as addCrossSectionalDetailsUtil,
  type CrossSectionState,
} from "./reporting/generators/CrossSectionUtils";
import {
  addCoverPage as addCoverPageUtil,
  addDocumentControlPage as addDocumentControlPageUtil,
  addTableOfContents as addTableOfContentsUtil,
  type DocumentSectionsState,
} from "./reporting/generators/DocumentSectionsUtils";
import {
  addDetailedMemberDiagrams as addDetailedMemberDiagramsUtil,
  type DetailedDiagramState,
} from "./reporting/generators/DetailedDiagramUtils";
import {
  addAllMemberDiagrams as addAllMemberDiagramsUtil,
  addMemberDiagram as addMemberDiagramUtil,
  type DiagramState,
  type DiagramType,
} from "./reporting/generators/DiagramUtils";
import {
  add3DSnapshot as add3DSnapshotUtil,
  addProjectInfo as addProjectInfoUtil,
  type ReportContentState,
} from "./reporting/generators/ReportContentUtils";
import {
  addFooter as addFooterUtil,
  addHeader as addHeaderUtil,
  addWatermark as addWatermarkUtil,
  type HeaderFooterState,
} from "./reporting/generators/HeaderFooterUtils";
import {
  addDeflectionSummary as addDeflectionSummaryUtil,
  addLoadCombinations as addLoadCombinationsUtil,
  addMaterialProperties as addMaterialPropertiesUtil,
  addMemberForcesTable as addMemberForcesTableUtil,
  addMembersTable as addMembersTableUtil,
  addNodeDisplacementsTable as addNodeDisplacementsTableUtil,
  addNodesTable as addNodesTableUtil,
  addReactionsTable as addReactionsTableUtil,
  addResultsTable as addResultsTableUtil,
  addSectionProperties as addSectionPropertiesUtil,
  getReportBlob,
  getReportDataUrl,
  saveReport,
  type TableAndExportState,
} from "./reporting/generators/TableAndExportUtils";

// ============================================
// REPORT GENERATOR CLASS
// ============================================

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

  private getTableState(): TableAndExportState {
    return {
      doc: this.doc,
      pageWidth: this.pageWidth,
      pageHeight: this.pageHeight,
      margin: this.margin,
      footerHeight: this.footerHeight,
      contentTop: this.contentTop,
      usableBottom: this.usableBottom,
      tableCount: this.tableCount,
      projectTitle: this.projectTitle,
      revision: this.revision,
    };
  }

  private syncFromTableState(state: TableAndExportState): void {
    this.contentTop = state.contentTop;
    this.tableCount = state.tableCount;
  }

  private getHeaderFooterState(): HeaderFooterState {
    return {
      doc: this.doc,
      margin: this.margin,
      pageWidth: this.pageWidth,
      pageHeight: this.pageHeight,
      projectTitle: this.projectTitle,
      revision: this.revision,
      documentRef: this.documentRef,
    };
  }

  private getContentState(): ReportContentState {
    return {
      doc: this.doc,
      margin: this.margin,
      pageWidth: this.pageWidth,
      contentTop: this.contentTop,
      figureCount: this.figureCount,
    };
  }

  private syncFromContentState(state: ReportContentState): void {
    this.contentTop = state.contentTop;
    this.figureCount = state.figureCount;
  }

  private getDiagramState(): DiagramState {
    return {
      doc: this.doc,
      margin: this.margin,
      pageWidth: this.pageWidth,
      contentTop: this.contentTop,
      figureCount: this.figureCount,
    };
  }

  private syncFromDiagramState(state: DiagramState): void {
    this.contentTop = state.contentTop;
    this.figureCount = state.figureCount;
  }

  private getDetailedDiagramState(): DetailedDiagramState {
    return {
      doc: this.doc,
      margin: this.margin,
      pageWidth: this.pageWidth,
      usableBottom: this.usableBottom,
      contentTop: this.contentTop,
    };
  }

  private syncFromDetailedDiagramState(state: DetailedDiagramState): void {
    this.contentTop = state.contentTop;
  }

  private getCombinedStructureDiagramState(): CombinedStructureDiagramState {
    return {
      doc: this.doc,
      margin: this.margin,
      pageWidth: this.pageWidth,
      contentTop: this.contentTop,
    };
  }

  private syncFromCombinedStructureDiagramState(state: CombinedStructureDiagramState): void {
    this.contentTop = state.contentTop;
  }

  private getFreeBodyState(): FreeBodyState {
    return {
      doc: this.doc,
      margin: this.margin,
      pageWidth: this.pageWidth,
      contentTop: this.contentTop,
      tableCount: this.tableCount,
    };
  }

  private syncFromFreeBodyState(state: FreeBodyState): void {
    this.contentTop = state.contentTop;
    this.tableCount = state.tableCount;
  }

  private getCrossSectionState(): CrossSectionState {
    return {
      doc: this.doc,
      margin: this.margin,
      pageWidth: this.pageWidth,
      contentTop: this.contentTop,
      tableCount: this.tableCount,
    };
  }

  private syncFromCrossSectionState(state: CrossSectionState): void {
    this.contentTop = state.contentTop;
    this.tableCount = state.tableCount;
  }

  private getDocumentSectionsState(): DocumentSectionsState {
    return {
      doc: this.doc,
      margin: this.margin,
      pageWidth: this.pageWidth,
      pageHeight: this.pageHeight,
      headerHeight: this.headerHeight,
      contentTop: this.contentTop,
      revision: this.revision,
      documentRef: this.documentRef,
      projectTitle: this.projectTitle,
      preparedBy: this.preparedBy,
    };
  }

  private syncFromDocumentSectionsState(state: DocumentSectionsState): void {
    this.contentTop = state.contentTop;
    this.revision = state.revision;
    this.documentRef = state.documentRef;
    this.projectTitle = state.projectTitle;
    this.preparedBy = state.preparedBy;
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
    const state = this.getDocumentSectionsState();
    addCoverPageUtil(state, options);
    this.syncFromDocumentSectionsState(state);
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
    const state = this.getDocumentSectionsState();
    addDocumentControlPageUtil(state, options, {
      addHeader: (title?: string) => this.addHeader(title),
      syncYAfterTable: (fallbackGap?: number) => this.syncYAfterTable(fallbackGap),
      getContentTop: () => this.contentTop,
    });
    this.syncFromDocumentSectionsState(state);
  }

  // ============================================
  // TABLE OF CONTENTS
  // ============================================

  addTableOfContents(): void {
    const state = this.getDocumentSectionsState();
    addTableOfContentsUtil(state);
    this.syncFromDocumentSectionsState(state);
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
    const state = this.getHeaderFooterState();
    addHeaderUtil(state, title);

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
    const state = this.getHeaderFooterState();
    addFooterUtil(state);
  }

  // ============================================
  // PROJECT INFORMATION
  // ============================================

  /**
   * Add project information section with professional two-column key-value layout.
   */
  addProjectInfo(project: ProjectData): void {
    this.addNumberedSectionHeading('', 'PROJECT INFORMATION');

    const state = this.getContentState();
    addProjectInfoUtil(state, project);
    this.syncFromContentState(state);
  }

  // ============================================
  // 3D SNAPSHOT
  // ============================================

  /**
   * Add a 3D model snapshot image with professional figure frame,
   * numbered caption, and navy border.
   */
  add3DSnapshot(imageDataUrl: string, caption?: string): void {
    const maxHeight = 120;
    const frameH = maxHeight + 20;
    this.syncYAfterTable(10);
    this.ensureSpace(frameH + 5, 'Analysis Results');

    const state = this.getContentState();
    add3DSnapshotUtil(state, imageDataUrl, caption);
    this.syncFromContentState(state);
  }

  // ============================================
  // RESULTS TABLES
  // ============================================

  /**
   * Add node displacements table
   */
  addNodeDisplacementsTable(data: NodeDisplacementRow[], title?: string): void {
    const state = this.getTableState();
    addNodeDisplacementsTableUtil(state, data, title);
    this.syncFromTableState(state);
  }

  /**
   * Add member forces table
   */
  addMemberForcesTable(data: MemberForceRow[], title?: string): void {
    const state = this.getTableState();
    addMemberForcesTableUtil(state, data, title);
    this.syncFromTableState(state);
  }

  /**
   * Add reactions table
   */
  addReactionsTable(data: ReactionRow[], title?: string): void {
    const state = this.getTableState();
    addReactionsTableUtil(state, data, title);
    this.syncFromTableState(state);
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
    const state = this.getTableState();
    addResultsTableUtil(state, title, headers, data);
    this.syncFromTableState(state);
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
    const state = this.getDiagramState();
    addMemberDiagramUtil(
      state,
      { ensureSpace: (neededMM, headerTitle) => this.ensureSpace(neededMM, headerTitle) },
      memberId,
      diagramType,
      data,
      maxValue,
    );
    this.syncFromDiagramState(state);
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
    const state = this.getDiagramState();
    addAllMemberDiagramsUtil(
      state,
      {
        ensureSpace: (neededMM, headerTitle) => this.ensureSpace(neededMM, headerTitle),
        addPage: (title?: string) => this.addPage(title),
        addNumberedSectionHeading: (number: string, title: string) =>
          this.addNumberedSectionHeading(number, title),
        addMemberDiagram: (
          memberId: string,
          diagramType: DiagramType,
          data: { x_values: number[]; values: number[] },
          maxValue: number,
        ) => this.addMemberDiagram(memberId, diagramType, data, maxValue),
      },
      members,
      diagramTypes,
    );
    this.syncFromDiagramState(state);
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
    const state = this.getDetailedDiagramState();
    addDetailedMemberDiagramsUtil(
      state,
      {
        addPage: (title?: string) => this.addPage(title),
        ensureSpace: (neededMM: number, headerTitle?: string) =>
          this.ensureSpace(neededMM, headerTitle),
      },
      members,
    );
    this.syncFromDetailedDiagramState(state);
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
      const state = this.getCombinedStructureDiagramState();
      addCombinedStructureDiagramUtil(
        state,
        {
          addPage: (title?: string) => this.addPage(title),
          addSectionHeading: (text: string) => this.addSectionHeading(text),
          ensureSpace: (neededMM: number, headerTitle?: string) => this.ensureSpace(neededMM, headerTitle),
        },
        nodes,
        members,
        diagramType,
      );
      this.syncFromCombinedStructureDiagramState(state);
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
    const state = this.getCrossSectionState();
    addCrossSectionalDetailsUtil(
      state,
      {
        addPage: (title?: string) => this.addPage(title),
        addSectionHeading: (text: string) => this.addSectionHeading(text),
        ensureSpace: (neededMM: number, headerTitle?: string) => this.ensureSpace(neededMM, headerTitle),
        syncYAfterTable: (fallbackGap?: number) => this.syncYAfterTable(fallbackGap),
        getContentTop: () => this.contentTop,
        addResultsTable: (title: string, headers: string[], data: (string | number)[][]) =>
          this.addResultsTable(title, headers, data),
      },
      members,
    );
    this.syncFromCrossSectionState(state);
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
    const state = this.getFreeBodyState();
    addFreeBodyDiagramUtil(
      state,
      {
        addPage: (title?: string) => this.addPage(title),
        addSectionHeading: (text: string) => this.addSectionHeading(text),
        syncYAfterTable: (fallbackGap?: number) => this.syncYAfterTable(fallbackGap),
        ensureSpace: (neededMM: number, headerTitle?: string) => this.ensureSpace(neededMM, headerTitle),
      },
      nodes,
      members,
      loads,
      reactions,
      supports,
    );
    this.syncFromFreeBodyState(state);
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
    const state = this.getFreeBodyState();
    addDetailedReactionsTableUtil(
      state,
      {
        addPage: (title?: string) => this.addPage(title),
        addSectionHeading: (text: string) => this.addSectionHeading(text),
        syncYAfterTable: (fallbackGap?: number) => this.syncYAfterTable(fallbackGap),
        ensureSpace: (neededMM: number, headerTitle?: string) => this.ensureSpace(neededMM, headerTitle),
        addResultsTable: (title: string, headers: string[], data: (string | number)[][]) =>
          this.addResultsTable(title, headers, data),
      },
      reactions,
      loads,
    );
    this.syncFromFreeBodyState(state);
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
    saveReport(this.doc, filename, this.projectTitle, this.revision, this.preparedBy);
  }

  /**
   * Get the PDF as a Blob (for uploading)
   */
  getBlob(): Blob {
    this.addFooter();
    return getReportBlob(this.doc);
  }

  /**
   * Get the PDF as a data URL (for preview)
   */
  getDataUrl(): string {
    this.addFooter();
    return getReportDataUrl(this.doc);
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
    const state = this.getTableState();
    addNodesTableUtil(state, nodes);
    this.syncFromTableState(state);
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
    const state = this.getTableState();
    addMembersTableUtil(state, members);
    this.syncFromTableState(state);
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
    const state = this.getHeaderFooterState();
    addWatermarkUtil(state);
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
    const state = this.getTableState();
    addDeflectionSummaryUtil(state, data);
    this.syncFromTableState(state);
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
    const state = this.getTableState();
    addLoadCombinationsUtil(state, combinations);
    this.syncFromTableState(state);
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
    const state = this.getTableState();
    addMaterialPropertiesUtil(state, materials);
    this.syncFromTableState(state);
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
    const state = this.getTableState();
    addSectionPropertiesUtil(state, sections);
    this.syncFromTableState(state);
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
