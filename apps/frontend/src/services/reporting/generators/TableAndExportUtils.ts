/**
 * TableAndExportUtils.ts — Table generation and export utilities for ReportGenerator
 * Extracted to reduce ReportGenerator.ts from 4268 → ~1500 LOC
 *
 * Handles:
 * - All table rendering (nodes, members, results, design, load combinations, materials, sections)
 * - All export methods (save, getBlob, getDataUrl)
 * - Table state management (counts and synchronization)
 */

import autoTable from 'jspdf-autotable';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { THEME } from '../reportTheme';
import type { DesignResult, MemberForceRow, NodeDisplacementRow, ReactionRow } from '../reportTypes';
import { safeAbsMax } from '../reportUtils';

export interface TableAndExportState {
  doc: jsPDF;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  footerHeight: number;
  contentTop: number;
  usableBottom: number;
  tableCount: number;
  projectTitle: string;
  revision: string;
}

/**
 * Add node displacements table
 */
export function addNodeDisplacementsTable(
  state: TableAndExportState,
  data: NodeDisplacementRow[],
  title?: string,
): void {
  state.tableCount++;
  addResultsTable(state, title || `Table ${state.tableCount}: Node Displacements`, [
    'Node ID',
    'dx (mm)',
    'dy (mm)',
    'dz (mm)',
    'rx (rad)',
    'ry (rad)',
    'rz (rad)',
  ], data.map((row) => [
    row.nodeId.slice(0, 8),
    (row.dx * 1000).toFixed(4),
    (row.dy * 1000).toFixed(4),
    (row.dz * 1000).toFixed(4),
    (row.rx ?? 0).toFixed(6),
    (row.ry ?? 0).toFixed(6),
    (row.rz ?? 0).toFixed(6),
  ]));
}

/**
 * Add member forces table
 */
export function addMemberForcesTable(
  state: TableAndExportState,
  data: MemberForceRow[],
  title?: string,
): void {
  state.tableCount++;
  addResultsTable(state, title || `Table ${state.tableCount}: Member Forces`, [
    'Member',
    'N (kN)',
    'Vy (kN)',
    'Vz (kN)',
    'My (kN·m)',
    'Mz (kN·m)',
    'T (kN·m)',
  ], data.map((row) => [
    row.memberId.slice(0, 8),
    row.axial.toFixed(2),
    row.shearY.toFixed(2),
    (row.shearZ ?? 0).toFixed(2),
    (row.momentY ?? 0).toFixed(2),
    row.momentZ.toFixed(2),
    (row.torsion ?? 0).toFixed(2),
  ]));
}

/**
 * Add reactions table
 */
export function addReactionsTable(
  state: TableAndExportState,
  data: ReactionRow[],
  title?: string,
): void {
  state.tableCount++;
  addResultsTable(state, title || `Table ${state.tableCount}: Support Reactions`, [
    'Node ID',
    'Fx (kN)',
    'Fy (kN)',
    'Fz (kN)',
    'Mx (kN·m)',
    'My (kN·m)',
    'Mz (kN·m)',
  ], data.map((row) => [
    row.nodeId.slice(0, 8),
    row.fx.toFixed(2),
    row.fy.toFixed(2),
    (row.fz ?? 0).toFixed(2),
    (row.mx ?? 0).toFixed(2),
    (row.my ?? 0).toFixed(2),
    (row.mz ?? 0).toFixed(2),
  ]));
}

/**
 * Professional results table with industry-standard formatting
 */
export function addResultsTable(
  state: TableAndExportState,
  title: string,
  headers: string[],
  data: (string | number)[][],
): void {
  state.contentTop += 12;
  const startY = state.contentTop;

  // Table title
  state.doc.setFontSize(9);
  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(...THEME.primary);
  state.doc.text(title, state.margin, startY);
  state.doc.setTextColor(...THEME.text);

  autoTable(state.doc, {
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
    margin: { left: state.margin, right: state.margin },
    tableWidth: 'auto',
  });

  // Sync position after table
  try {
    const finalY = (state.doc as any).lastAutoTable?.finalY;
    if (typeof finalY === 'number' && finalY > 0) {
      state.contentTop = finalY + 10;
    }
  } catch {
    state.contentTop += 10;
  }
}

/**
 * Add node coordinates table
 */
export function addNodesTable(
  state: TableAndExportState,
  nodes: Array<{ id: string; x: number; y: number; z: number }>,
): void {
  state.tableCount++;
  addResultsTable(state, `Table ${state.tableCount}: Node Coordinates`, [
    'Node ID',
    'X (m)',
    'Y (m)',
    'Z (m)',
  ], nodes.map((node) => [
    node.id.slice(0, 10),
    node.x.toFixed(3),
    node.y.toFixed(3),
    node.z.toFixed(3),
  ]));
}

/**
 * Add members table
 */
export function addMembersTable(
  state: TableAndExportState,
  members: Array<{
    id: string;
    startNodeId: string;
    endNodeId: string;
    sectionId: string;
  }>,
): void {
  state.tableCount++;
  addResultsTable(state, `Table ${state.tableCount}: Member Properties`, [
    'Member ID',
    'Start Node',
    'End Node',
    'Section',
  ], members.map((member) => [
    member.id.slice(0, 10),
    member.startNodeId.slice(0, 10),
    member.endNodeId.slice(0, 10),
    member.sectionId,
  ]));
}

/**
 * Add deflection summary table
 */
export function addDeflectionSummary(
  state: TableAndExportState,
  data: Array<{
    nodeId: string;
    displacement: number;
    limit: number;
    ratio: number;
    status: 'OK' | 'EXCESSIVE';
  }>,
): void {
  state.tableCount++;
  state.contentTop += 15;
  const startY = state.contentTop;

  state.doc.setFontSize(12);
  state.doc.setFont('helvetica', 'bold');
  state.doc.text('Deflection Summary', state.margin, startY);

  const passCount = data.filter((d) => d.status === 'OK').length;
  const failCount = data.filter((d) => d.status === 'EXCESSIVE').length;

  const summaryY = startY + 6;
  state.doc.setFontSize(9);
  state.doc.setFont('helvetica', 'normal');
  state.doc.setTextColor(...THEME.pass);
  state.doc.text(`✓ ${passCount} OK`, state.margin, summaryY);
  state.doc.setTextColor(...THEME.fail);
  state.doc.text(`✗ ${failCount} Excessive`, state.margin + 30, summaryY);
  state.doc.setTextColor(...THEME.text);

  autoTable(state.doc, {
    startY: summaryY + 5,
    head: [['Node', 'Displacement (mm)', 'Limit (mm)', 'Ratio', 'Status']],
    body: data.map((d) => [
      d.nodeId.slice(0, 8),
      d.displacement.toFixed(4),
      d.limit.toFixed(2),
      `L/${(1 / d.ratio).toFixed(0)}`,
      d.status,
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: THEME.headerBg,
      textColor: THEME.headerText,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      halign: 'center',
      cellPadding: 2,
    },
    alternateRowStyles: { fillColor: THEME.rowAlt },
    tableLineColor: THEME.border,
    tableLineWidth: 0.2,
    didParseCell: (cellData) => {
      if (cellData.section === 'body' && cellData.column.index === 4) {
        const status = cellData.cell.text[0];
        if (status === 'EXCESSIVE') {
          cellData.cell.styles.textColor = THEME.fail;
          cellData.cell.styles.fontStyle = 'bold';
        } else {
          cellData.cell.styles.textColor = THEME.pass;
        }
      }
    },
    margin: { left: state.margin, right: state.margin },
  });
}

/**
 * Add load combinations table
 */
export function addLoadCombinations(
  state: TableAndExportState,
  combinations: Array<{
    name: string;
    type: string;
    factors: Record<string, number>;
  }>,
): void {
  state.tableCount++;
  state.contentTop += 15;
  const startY = state.contentTop;

  state.doc.setFontSize(12);
  state.doc.setFont('helvetica', 'bold');
  state.doc.text('Load Combinations', state.margin, startY);

  const allLoadNames = [
    ...new Set(combinations.flatMap((c) => Object.keys(c.factors))),
  ];
  const headers = [
    'Combination',
    'Type',
    ...allLoadNames.map((n) => n.slice(0, 6)),
  ];

  const rows = combinations.map((c) => [
    c.name,
    c.type,
    ...allLoadNames.map((n) => (c.factors[n] ?? 0).toFixed(2)),
  ]);

  autoTable(state.doc, {
    startY: startY + 5,
    head: [headers],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: THEME.headerBg,
      textColor: THEME.headerText,
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 7,
      halign: 'center',
      cellPadding: 2,
    },
    alternateRowStyles: { fillColor: THEME.rowAlt },
    tableLineColor: THEME.border,
    tableLineWidth: 0.2,
    margin: { left: state.margin, right: state.margin },
  });
}

/**
 * Add material properties table
 */
export function addMaterialProperties(
  state: TableAndExportState,
  materials: Array<{
    name: string;
    E: number;
    fy: number;
    fu?: number;
    density: number;
    type: string;
  }>,
): void {
  state.tableCount++;
  state.contentTop += 15;
  const startY = state.contentTop;

  state.doc.setFontSize(12);
  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(...THEME.primary);
  state.doc.text('Material Properties', state.margin, startY);
  state.doc.setTextColor(...THEME.text);

  autoTable(state.doc, {
    startY: startY + 5,
    head: [
      ['Material', 'Type', 'E (GPa)', 'fy (MPa)', 'fu (MPa)', 'ρ (kg/m³)'],
    ],
    body: materials.map((m) => [
      m.name,
      m.type,
      m.E.toFixed(0),
      m.fy.toFixed(0),
      (m.fu ?? '-').toString(),
      m.density.toFixed(0),
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: THEME.headerBg,
      textColor: THEME.headerText,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 9,
      halign: 'center',
      cellPadding: 2,
    },
    alternateRowStyles: { fillColor: THEME.rowAlt },
    tableLineColor: THEME.border,
    tableLineWidth: 0.2,
    margin: { left: state.margin, right: state.margin },
  });
}

/**
 * Add section properties table
 */
export function addSectionProperties(
  state: TableAndExportState,
  sections: Array<{
    name: string;
    type: string;
    A: number;
    Iy: number;
    Iz: number;
    J: number;
    Zy: number;
    Zz: number;
  }>,
): void {
  state.tableCount++;
  state.contentTop += 15;
  const startY = state.contentTop;

  state.doc.setFontSize(12);
  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(...THEME.primary);
  state.doc.text('Section Properties', state.margin, startY);
  state.doc.setTextColor(...THEME.text);

  autoTable(state.doc, {
    startY: startY + 5,
    head: [
      [
        'Section',
        'Type',
        'A (mm²)',
        'Iy (×10⁶)',
        'Iz (×10⁶)',
        'J (×10⁶)',
        'Zy (×10³)',
        'Zz (×10³)',
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
    theme: 'grid',
    headStyles: {
      fillColor: THEME.headerBg,
      textColor: THEME.headerText,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      halign: 'center',
      cellPadding: 2,
    },
    alternateRowStyles: { fillColor: THEME.rowAlt },
    tableLineColor: THEME.border,
    tableLineWidth: 0.2,
    margin: { left: state.margin, right: state.margin },
  });
}

/**
 * Save the PDF report
 */
export function saveReport(
  doc: jsPDF,
  filename: string,
  projectTitle: string,
  revision: string,
  preparedBy: string,
): void {
  // Set PDF properties
  doc.setProperties({
    title: `${projectTitle} — Structural Analysis Report`,
    subject: 'Structural Engineering Analysis Report',
    author: preparedBy || 'BeamLab',
    creator: 'BeamLab',
    keywords: 'structural analysis, engineering, report, BeamLab',
  });

  const cleanFilename = filename.replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
  const fullFilename = `${cleanFilename}_Report_${timestamp}.pdf`;

  doc.save(fullFilename);
}

/**
 * Get the PDF as a Blob (for uploading)
 */
export function getReportBlob(doc: jsPDF): Blob {
  return doc.output('blob');
}

/**
 * Get the PDF as a data URL (for preview)
 */
export function getReportDataUrl(doc: jsPDF): string {
  return doc.output('dataurlstring');
}
