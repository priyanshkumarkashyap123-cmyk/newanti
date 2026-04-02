import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { THEME } from '../reportTheme';
import type { ProjectData } from '../reportTypes';

export interface ReportContentState {
  doc: jsPDF;
  margin: number;
  pageWidth: number;
  contentTop: number;
  figureCount: number;
}

/**
 * Add project information section with two-column key-value layout.
 */
export function addProjectInfo(state: ReportContentState, project: ProjectData): void {
  const projectData = [
    ['Project Name', project.projectName || 'Untitled Project'],
    ['Project Number', project.projectNumber || 'N/A'],
    ['Client', project.clientName || 'N/A'],
    ['Design Engineer', project.engineerName || 'N/A'],
    ['Description', project.description || 'Structural Analysis Report'],
    ['Software', 'BeamLab — Structural Analysis Platform'],
    ['Analysis Method', 'Direct Stiffness Method (3-D Frame)'],
  ];

  autoTable(state.doc, {
    startY: state.contentTop,
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
    margin: { left: state.margin, right: state.margin },
  });

  try {
    const finalY = (state.doc as any).lastAutoTable?.finalY;
    if (typeof finalY === 'number' && finalY > 0) {
      state.contentTop = finalY + 8;
      return;
    }
  } catch {
    // Ignore finalY access issues.
  }

  state.contentTop += 8;
}

/**
 * Render a framed 3D snapshot panel with caption and figure tag.
 */
export function add3DSnapshot(state: ReportContentState, imageDataUrl: string, caption?: string): void {
  state.figureCount += 1;

  const maxWidth = state.pageWidth - 2 * state.margin;
  const maxHeight = 120;
  const frameH = maxHeight + 20;
  const y = state.contentTop;

  state.doc.setDrawColor(...THEME.border);
  state.doc.setLineWidth(0.4);
  state.doc.roundedRect(state.margin, y, maxWidth, frameH, 1.5, 1.5, 'S');

  state.doc.setFillColor(...THEME.primary);
  state.doc.rect(state.margin + 0.2, y + 0.2, maxWidth - 0.4, 1.5, 'F');

  try {
    state.doc.addImage(
      imageDataUrl,
      'PNG',
      state.margin + 2,
      y + 3,
      maxWidth - 4,
      maxHeight - 3,
    );
  } catch {
    state.doc.setFillColor(...THEME.rowAlt);
    state.doc.rect(state.margin + 2, y + 3, maxWidth - 4, maxHeight - 3, 'F');
    state.doc.setFontSize(12);
    state.doc.setTextColor(...THEME.textMuted);
    state.doc.text('3D Model Preview', state.margin + maxWidth / 2, y + maxHeight / 2, { align: 'center' });
  }

  const captionText = caption || `Figure ${state.figureCount} — 3D Structural Model`;
  state.doc.setFontSize(8);
  state.doc.setFont('helvetica', 'italic');
  state.doc.setTextColor(...THEME.textSecondary);
  state.doc.text(captionText, state.pageWidth / 2, y + maxHeight + 6, { align: 'center' });

  state.doc.setFontSize(6.5);
  state.doc.setFont('helvetica', 'normal');
  state.doc.setTextColor(...THEME.textMuted);
  state.doc.text(`Fig. ${state.figureCount}`, state.margin + maxWidth - 2, y + maxHeight + 12, { align: 'right' });

  state.doc.setFont('helvetica', 'normal');
  state.doc.setTextColor(...THEME.text);
  state.contentTop = y + frameH + 4;
}
