import jsPDF from 'jspdf';
import { format } from 'date-fns';

import { LOGO_BASE64 } from '../../../utils/LogoData';
import { THEME } from '../reportTheme';

export interface HeaderFooterState {
  doc: jsPDF;
  margin: number;
  pageWidth: number;
  pageHeight: number;
  projectTitle: string;
  revision: string;
  documentRef: string;
}

/**
 * Add professional running header to current page.
 */
export function addHeader(state: HeaderFooterState, title?: string): void {
  const y = state.margin - 6;
  const pw = state.pageWidth;

  try {
    state.doc.addImage(LOGO_BASE64, 'PNG', state.margin, y - 5, 6, 6);
  } catch {
    // Ignore logo rendering failures.
  }

  state.doc.setFontSize(9);
  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(...THEME.primary);
  state.doc.text('BeamLab', state.margin + 8, y);

  state.doc.setFontSize(6);
  state.doc.setFont('helvetica', 'normal');
  state.doc.setTextColor(...THEME.textMuted);
  state.doc.text(state.documentRef || 'STRUCTURAL ENGINEERING', state.margin, y + 4);

  if (title) {
    state.doc.setFontSize(8);
    state.doc.setFont('helvetica', 'bold');
    state.doc.setTextColor(...THEME.textSecondary);
    state.doc.text(title.toUpperCase(), pw / 2, y + 1, { align: 'center' });
  }

  state.doc.setFontSize(7);
  state.doc.setFont('helvetica', 'normal');
  state.doc.setTextColor(...THEME.textMuted);
  const dateStr = format(new Date(), 'dd MMM yyyy');
  state.doc.text(`Rev ${state.revision}  |  ${dateStr}`, pw - state.margin, y, { align: 'right' });

  state.doc.setDrawColor(...THEME.primary);
  state.doc.setLineWidth(0.8);
  state.doc.line(state.margin, y + 7, pw - state.margin, y + 7);

  state.doc.setDrawColor(...THEME.accent);
  state.doc.setLineWidth(0.3);
  state.doc.line(state.margin, y + 9, pw - state.margin, y + 9);

  state.doc.setTextColor(...THEME.text);
}

/**
 * Add professional footer to report pages.
 */
export function addFooter(state: HeaderFooterState): void {
  const totalPages = state.doc.getNumberOfPages();
  const pw = state.pageWidth;

  for (let i = 1; i <= totalPages; i++) {
    state.doc.setPage(i);

    if (i === 1) continue;

    const y = state.pageHeight - state.margin + 3;

    state.doc.setDrawColor(...THEME.accent);
    state.doc.setLineWidth(0.3);
    state.doc.line(state.margin, y - 7, pw - state.margin, y - 7);

    state.doc.setDrawColor(...THEME.primary);
    state.doc.setLineWidth(0.6);
    state.doc.line(state.margin, y - 5, pw - state.margin, y - 5);

    state.doc.setFontSize(6.5);
    state.doc.setFont('helvetica', 'normal');
    state.doc.setTextColor(...THEME.textMuted);
    const projLabel = state.projectTitle
      ? `${state.projectTitle.slice(0, 35)} — CONFIDENTIAL`
      : 'CONFIDENTIAL';
    state.doc.text(projLabel, state.margin, y);

    state.doc.setFontSize(7.5);
    state.doc.setFont('helvetica', 'bold');
    state.doc.setTextColor(...THEME.textSecondary);
    state.doc.text(`Page ${i - 1} of ${totalPages - 1}`, pw / 2, y, { align: 'center' });

    state.doc.setFontSize(6.5);
    state.doc.setFont('helvetica', 'normal');
    state.doc.setTextColor(...THEME.textMuted);
    state.doc.text(`© ${new Date().getFullYear()} BeamLab Ultimate`, pw - state.margin, y, {
      align: 'right',
    });
  }
}

/**
 * Add subtle watermark to all pages except cover.
 */
export function addWatermark(state: HeaderFooterState): void {
  const totalPages = state.doc.getNumberOfPages();

  for (let i = 2; i <= totalPages; i++) {
    state.doc.setPage(i);

    state.doc.setFontSize(48);
    state.doc.setFont('helvetica', 'bold');
    state.doc.setTextColor(230, 235, 240);
    state.doc.text('BEAMLAB', state.pageWidth / 2, state.pageHeight / 2, {
      align: 'center',
      angle: 35,
    });

    state.doc.setFontSize(6);
    state.doc.setFont('helvetica', 'normal');
    state.doc.setTextColor(200, 205, 215);
    state.doc.text(
      `Ref: ${state.documentRef}  |  Rev ${state.revision}`,
      state.pageWidth - state.margin,
      state.pageHeight - 4,
      { align: 'right' },
    );
  }

  state.doc.setTextColor(...THEME.text);
}
