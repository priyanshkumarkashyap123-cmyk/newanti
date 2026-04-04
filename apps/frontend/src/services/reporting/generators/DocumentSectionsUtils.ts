import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

import { LOGO_BASE64 } from '../../../utils/LogoData';
import { THEME } from '../reportTheme';

export interface DocumentSectionsState {
  doc: jsPDF;
  margin: number;
  pageWidth: number;
  pageHeight: number;
  headerHeight: number;
  contentTop: number;
  revision: string;
  documentRef: string;
  projectTitle: string;
  preparedBy: string;
}

export interface CoverPageOptions {
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
}

export function addCoverPage(state: DocumentSectionsState, options: CoverPageOptions): void {
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
    companyAddress = 'beamlabultimate.tech',
  } = options;

  state.projectTitle = projectName;
  state.revision = revision;
  state.preparedBy = engineerName;
  state.documentRef = `BL-${String(projectName.length * 37 + projectNumber.length * 53 + 1000).padStart(5, '0')}`;

  const pw = state.pageWidth;
  const ph = state.pageHeight;

  state.doc.setFillColor(...THEME.coverBg);
  state.doc.rect(0, 0, pw, ph, 'F');

  state.doc.setFillColor(...THEME.accent);
  state.doc.rect(0, 0, pw, 4, 'F');

  state.doc.setFillColor(...THEME.accentGold);
  state.doc.rect(0, 4, pw, 2, 'F');

  const brandY = 28;
  try {
    state.doc.addImage(LOGO_BASE64, 'PNG', state.margin, brandY - 16, 16, 16);
  } catch {
    // Ignore logo load failures.
  }

  state.doc.setFontSize(22);
  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(...THEME.coverText);
  state.doc.text('BeamLab', state.margin + 20, brandY);

  state.doc.setFontSize(10);
  state.doc.setFont('helvetica', 'normal');
  state.doc.setTextColor(...THEME.coverAccent);
  state.doc.text('STRUCTURAL ANALYSIS', state.margin + 20, brandY + 7);

  state.doc.setFontSize(8);
  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(200, 200, 200);
  state.doc.text(classification, pw - state.margin, brandY - 8, { align: 'right' });

  state.doc.setDrawColor(...THEME.accent);
  state.doc.setLineWidth(0.8);
  state.doc.line(state.margin, 50, pw - state.margin, 50);

  const titleY = ph * 0.3;
  state.doc.setFontSize(9);
  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(...THEME.coverAccent);
  state.doc.text('S T R U C T U R A L   A N A L Y S I S   R E P O R T', pw / 2, titleY - 10, {
    align: 'center',
  });

  state.doc.setDrawColor(...THEME.accentGold);
  state.doc.setLineWidth(1);
  state.doc.line(pw / 2 - 40, titleY - 4, pw / 2 + 40, titleY - 4);

  state.doc.setFontSize(28);
  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(...THEME.coverText);
  const titleLines = state.doc.splitTextToSize(projectName, pw - 2 * state.margin - 20);
  state.doc.text(titleLines, pw / 2, titleY + 8, { align: 'center' });

  const subtitleY = titleY + 8 + titleLines.length * 12 + 5;
  state.doc.setFontSize(13);
  state.doc.setFont('helvetica', 'normal');
  state.doc.setTextColor(180, 200, 230);
  state.doc.text(subtitle, pw / 2, subtitleY, { align: 'center' });

  state.doc.setDrawColor(...THEME.accentGold);
  state.doc.setLineWidth(1);
  state.doc.line(pw / 2 - 40, subtitleY + 8, pw / 2 + 40, subtitleY + 8);

  const refY = subtitleY + 22;
  state.doc.setFontSize(10);
  state.doc.setFont('helvetica', 'normal');
  state.doc.setTextColor(170, 190, 220);
  state.doc.text(`Document Ref: ${state.documentRef}`, pw / 2, refY, { align: 'center' });
  state.doc.text(`Revision ${revision}  |  ${format(date, 'dd MMMM yyyy')}`, pw / 2, refY + 6, {
    align: 'center',
  });

  const tableTop = ph - 95;
  const colW = (pw - 2 * state.margin) / 4;

  state.doc.setDrawColor(80, 120, 170);
  state.doc.setLineWidth(0.5);
  state.doc.setFillColor(15, 45, 85);
  state.doc.rect(state.margin, tableTop, pw - 2 * state.margin, 60, 'FD');

  state.doc.setFillColor(12, 38, 72);
  state.doc.rect(state.margin, tableTop, pw - 2 * state.margin, 12, 'F');
  state.doc.setFontSize(8);
  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(...THEME.coverAccent);

  const colHeaders = ['PROJECT', 'CLIENT', 'DOCUMENT NO.', 'REVISION'];
  colHeaders.forEach((h, i) => {
    state.doc.text(h, state.margin + colW * i + colW / 2, tableTop + 8, { align: 'center' });
  });

  state.doc.setFontSize(9);
  state.doc.setFont('helvetica', 'normal');
  state.doc.setTextColor(...THEME.coverText);
  const colValues = [projectName.slice(0, 22), clientName || '—', state.documentRef, revision];
  colValues.forEach((v, i) => {
    state.doc.text(v, state.margin + colW * i + colW / 2, tableTop + 20, { align: 'center' });
  });

  state.doc.setDrawColor(80, 120, 170);
  state.doc.line(state.margin, tableTop + 26, pw - state.margin, tableTop + 26);

  state.doc.setFontSize(8);
  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(...THEME.coverAccent);
  const row2Headers = ['PREPARED BY', 'CHECKED BY', 'APPROVED BY', 'DATE'];
  row2Headers.forEach((h, i) => {
    state.doc.text(h, state.margin + colW * i + colW / 2, tableTop + 34, { align: 'center' });
  });

  state.doc.setFontSize(9);
  state.doc.setFont('helvetica', 'normal');
  state.doc.setTextColor(...THEME.coverText);
  const row2Values = [engineerName || '—', checkedBy || '—', approvedBy || '—', format(date, 'dd/MM/yyyy')];
  row2Values.forEach((v, i) => {
    state.doc.text(v, state.margin + colW * i + colW / 2, tableTop + 44, { align: 'center' });
  });

  state.doc.setFontSize(8);
  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(...THEME.accentGold);
  state.doc.text('STATUS: ISSUED FOR REVIEW', state.margin + 5, tableTop + 55);

  state.doc.setFillColor(...THEME.accent);
  state.doc.rect(0, ph - 6, pw, 4, 'F');
  state.doc.setFillColor(...THEME.accentGold);
  state.doc.rect(0, ph - 2, pw, 2, 'F');

  state.doc.setFontSize(7);
  state.doc.setFont('helvetica', 'normal');
  state.doc.setTextColor(120, 150, 190);
  state.doc.text(`© ${new Date().getFullYear()} ${companyName}. All rights reserved.`, state.margin, ph - 10);
  state.doc.text(companyAddress, pw - state.margin, ph - 10, { align: 'right' });
}

export function addDocumentControlPage(
  state: DocumentSectionsState,
  options: {
    engineerName?: string;
    checkedBy?: string;
    approvedBy?: string;
    date?: Date;
  },
  callbacks: {
    addHeader: (title?: string) => void;
    syncYAfterTable: (fallbackGap?: number) => void;
    getContentTop: () => number;
  },
): void {
  const { engineerName = '', checkedBy = '', approvedBy = '', date = new Date() } = options;

  state.doc.addPage();
  callbacks.addHeader('Document Control');
  let y = state.margin + state.headerHeight + 5;

  state.doc.setFontSize(12);
  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(...THEME.primary);
  state.doc.text('REVISION HISTORY', state.margin, y);
  y += 2;

  autoTable(state.doc, {
    startY: y,
    head: [['Rev', 'Date', 'Description', 'Author', 'Checked', 'Approved']],
    body: [[state.revision, format(date, 'dd/MM/yyyy'), 'Initial issue for review', engineerName || '—', checkedBy || '—', approvedBy || '—']],
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
    margin: { left: state.margin, right: state.margin },
    tableLineColor: THEME.border,
    tableLineWidth: 0.3,
  });

  callbacks.syncYAfterTable(12);
  y = callbacks.getContentTop();

  state.doc.setFontSize(12);
  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(...THEME.primary);
  state.doc.text('DISTRIBUTION', state.margin, y);
  y += 2;

  autoTable(state.doc, {
    startY: y,
    head: [['Name', 'Role', 'Organisation', 'Copies']],
    body: [[engineerName || '—', 'Structural Engineer', 'BeamLab', '1 (electronic)']],
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
    margin: { left: state.margin, right: state.margin },
    tableLineColor: THEME.border,
    tableLineWidth: 0.3,
  });

  callbacks.syncYAfterTable(15);
}

export function addTableOfContents(state: DocumentSectionsState): void {
  let y = state.contentTop + 5;

  state.doc.setFontSize(16);
  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(...THEME.primary);
  state.doc.text('TABLE OF CONTENTS', state.margin, y);

  state.doc.setDrawColor(...THEME.accent);
  state.doc.setLineWidth(1);
  state.doc.line(state.margin, y + 3, state.margin + 60, y + 3);
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

  state.doc.setFontSize(10);

  tocItems.forEach((item) => {
    const indent = item.indent ? 8 : 0;
    const isMain = !indent && item.num;

    state.doc.setFont('helvetica', isMain ? 'bold' : 'normal');
    if (isMain) {
      state.doc.setTextColor(...THEME.primary);
    } else {
      state.doc.setTextColor(...THEME.textSecondary);
    }
    state.doc.text(item.num, state.margin + indent, y);

    const titleX = state.margin + indent + 14;
    state.doc.text(item.title, titleX, y);

    const titleEnd = titleX + state.doc.getTextWidth(item.title) + 2;
    const lineEnd = state.pageWidth - state.margin;
    state.doc.setDrawColor(...THEME.border);
    state.doc.setLineWidth(0.2);
    state.doc.setLineDashPattern([0.5, 1.5], 0);
    if (titleEnd + 5 < lineEnd) {
      state.doc.line(titleEnd, y - 0.3, lineEnd, y - 0.3);
    }
    state.doc.setLineDashPattern([], 0);

    y += isMain ? 7 : 5.5;
  });

  state.contentTop = y;
}
