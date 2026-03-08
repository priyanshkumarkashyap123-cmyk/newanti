/**
 * Calculation Sheet PDF Exporter
 *
 * Bridges the CalculationTraceabilityEngine output into a
 * professional PDF calculation sheet using jsPDF + jspdf-autotable.
 *
 * Usage:
 *   const exporter = new CalculationSheetExporter();
 *   const pdf = await exporter.exportTrace(traceReport, projectInfo);
 *   // pdf is Uint8Array — trigger browser download
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { MemberTraceReport, TracedCalculation, CalculationStep as TracedCalcStep } from './CalculationTraceabilityEngine';

export interface CalcSheetProject {
  projectName: string;
  projectNumber: string;
  clientName: string;
  engineerName: string;
  checkedBy?: string;
  date: Date;
  revision: string;
}

export class CalculationSheetExporter {
  private readonly margin = 15;
  private readonly headerColor: [number, number, number] = [0, 51, 102];

  /**
   * Export a single member's traced calculation report to PDF
   */
  async exportTrace(
    report: MemberTraceReport,
    project: CalcSheetProject
  ): Promise<Uint8Array> {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const m = this.margin;
    const contentW = pageW - 2 * m;
    let y = m;

    // ---- Title Block ----
    doc.setFillColor(...this.headerColor);
    doc.rect(m, y, contentW, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('CALCULATION SHEET', pageW / 2, y + 10, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`${report.memberId} — ${report.sectionName}`, pageW / 2, y + 18, { align: 'center' });
    doc.setFontSize(8);
    doc.text(`Design Code: ${report.designCode}`, pageW / 2, y + 25, { align: 'center' });
    y += 35;

    // ---- Project Info Grid ----
    doc.setTextColor(33, 33, 33);
    autoTable(doc, {
      body: [
        ['Project:', project.projectName, 'Project No:', project.projectNumber],
        ['Client:', project.clientName, 'Date:', project.date.toLocaleDateString()],
        ['Design By:', project.engineerName, 'Checked By:', project.checkedBy ?? '—'],
        ['Revision:', project.revision, 'Status:', report.overallVerdict],
      ],
      startY: y,
      margin: { left: m, right: m },
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 25 }, 2: { fontStyle: 'bold', cellWidth: 25 } },
    });
    y = (doc as any).lastAutoTable?.finalY ?? y + 30;
    y += 5;

    // ---- Each traced calculation ----
    for (const calc of report.checks) {
      y = this.renderCalculation(doc, calc, y, m, contentW);
    }

    // ---- Summary verdict ----
    const fy = y + 5;
    if (fy > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = m;
    } else {
      y = fy;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const color: [number, number, number] = report.overallVerdict === 'PASS' ? [0, 128, 0] : [200, 0, 0];
    doc.setTextColor(...color);
    doc.text(`Overall Verdict: ${report.overallVerdict}`, pageW / 2, y, { align: 'center' });

    // ---- Page numbers ----
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(130, 130, 130);
      doc.text(`${project.projectNumber} — ${report.memberId}`, m, doc.internal.pageSize.getHeight() - 5);
      doc.text(`${i} / ${totalPages}`, pageW - m, doc.internal.pageSize.getHeight() - 5, { align: 'right' });
    }

    return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);
  }

  /**
   * Export multiple member reports as a single PDF
   */
  async exportBatch(
    reports: MemberTraceReport[],
    project: CalcSheetProject
  ): Promise<Uint8Array> {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const m = this.margin;
    const contentW = pageW - 2 * m;

    for (let idx = 0; idx < reports.length; idx++) {
      if (idx > 0) doc.addPage();
      const report = reports[idx];
      let y = m;

      // Mini header
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...this.headerColor);
      doc.text(`${report.memberId} — ${report.sectionName} (${report.designCode})`, m, y);
      y += 8;

      for (const calc of report.checks) {
        y = this.renderCalculation(doc, calc, y, m, contentW);
      }
    }

    // Page numbers
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(130, 130, 130);
      doc.text(`${project.projectNumber}`, m, doc.internal.pageSize.getHeight() - 5);
      doc.text(`${i} / ${totalPages}`, pageW - m, doc.internal.pageSize.getHeight() - 5, { align: 'right' });
    }

    return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);
  }

  // ---- Internal Render ----

  private renderCalculation(
    doc: jsPDF,
    calc: TracedCalculation,
    startY: number,
    margin: number,
    contentW: number
  ): number {
    let y = startY;
    const pageH = doc.internal.pageSize.getHeight();

    const ensureSpace = (n: number) => {
      if (y + n > pageH - 20) { doc.addPage(); y = margin; }
    };

    // Check title
    ensureSpace(12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...this.headerColor);
    doc.text(calc.title, margin, y);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text(`Clause: ${calc.governingClause}`, margin + contentW, y, { align: 'right' });
    y += 5;
    doc.setDrawColor(...this.headerColor);
    doc.setLineWidth(0.2);
    doc.line(margin, y, margin + contentW, y);
    y += 4;

    // Steps as table
    const rows = calc.steps.map((step: TracedCalcStep) => [
      step.description,
      step.equation ?? '',
      step.substitution ?? '',
      step.result,
      step.clauseRef ?? '—',
    ]);

    ensureSpace(rows.length * 6 + 10);
    autoTable(doc, {
      head: [['Step', 'Formula', 'Values', 'Result', 'Check']],
      body: rows,
      startY: y,
      margin: { left: margin, right: margin },
      headStyles: { fillColor: this.headerColor, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        1: { fontStyle: 'italic', cellWidth: 40 },
        4: { halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: (data: any) => {
        if (data.column.index === 4 && data.section === 'body') {
          const val = String(data.cell.raw).toUpperCase();
          if (val === 'OK' || val === 'PASS') data.cell.styles.textColor = [0, 128, 0];
          if (val === 'FAIL' || val === 'NG') data.cell.styles.textColor = [200, 0, 0];
        }
      },
    });
    y = (doc as any).lastAutoTable?.finalY ?? y + 20;

    // Verdict line
    y += 3;
    ensureSpace(8);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const vColor: [number, number, number] = calc.verdict === 'PASS' ? [0, 128, 0] : [200, 0, 0];
    doc.setTextColor(...vColor);
    doc.text(`${calc.title}: ${calc.verdict}  (Utilization: ${(calc.utilization * 100).toFixed(1)}%)`, margin, y);
    y += 8;
    doc.setTextColor(33, 33, 33);

    return y;
  }
}

/** Trigger browser download of PDF bytes */
export function downloadPdf(data: Uint8Array, filename: string): void {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
