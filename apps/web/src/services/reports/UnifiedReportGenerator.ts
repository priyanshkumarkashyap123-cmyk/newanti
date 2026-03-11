/**
 * UnifiedReportGenerator.ts
 *
 * Generates a single structural engineering PDF from `UnifiedReportData`.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  ConnectionDetail,
  DesignCheck,
  ProjectMetadata,
  ReinforcementDetail,
  UnifiedAnalysisResult,
  UnifiedDesignResult,
  UnifiedDetailingResult,
  UnifiedReportData,
} from '../../data/UnifiedResultsModel';

export interface UnifiedReportConfig {
  includeAnalysisSummary?: boolean;
  includeDesignTables?: boolean;
  includeDetailing?: boolean;
  includeSchedules?: boolean;
  includeSignatureBlock?: boolean;
  logoImageB64?: string;
}

export class UnifiedReportGenerator {
  private readonly margin = 15;
  private readonly headerColor: [number, number, number] = [0, 51, 102];
  private readonly accentColor: [number, number, number] = [191, 155, 48];
  private readonly textColor: [number, number, number] = [33, 33, 33];
  private readonly mutedColor: [number, number, number] = [120, 120, 120];

  async generateReport(
    reportData: UnifiedReportData,
    config: UnifiedReportConfig = {},
  ): Promise<Uint8Array> {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const cfg = {
      includeAnalysisSummary: true,
      includeDesignTables: true,
      includeDetailing: true,
      includeSchedules: true,
      includeSignatureBlock: true,
      ...config,
    };

    this.renderCoverPage(doc, reportData.project, cfg.logoImageB64);
    doc.addPage();
    this.renderExecutiveSummary(doc, reportData);

    if (cfg.includeAnalysisSummary) {
      doc.addPage();
      this.renderAnalysisSection(doc, reportData.analysis);
    }

    if (cfg.includeDesignTables) {
      doc.addPage();
      this.renderDesignSection(doc, reportData.design);
    }

    if (cfg.includeDetailing) {
      doc.addPage();
      this.renderDetailingSection(doc, reportData.detailing);
    }

    if (cfg.includeSchedules) {
      doc.addPage();
      this.renderScheduleSection(doc, reportData.detailing);
    }

    if (cfg.includeSignatureBlock) {
      doc.addPage();
      this.renderSignatureSection(doc, reportData.project);
    }

    this.renderPageFooters(doc, reportData.project.projectName);
    return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);
  }

  private renderCoverPage(doc: jsPDF, metadata: ProjectMetadata, logoB64?: string): void {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const m = this.margin;

    doc.setFillColor(...this.headerColor);
    doc.rect(0, 0, pageW, 55, 'F');
    doc.setFillColor(...this.accentColor);
    doc.rect(0, 55, pageW, 4, 'F');

    if (logoB64) {
      try {
        doc.addImage(logoB64, 'PNG', m, 10, 24, 24);
      } catch {
        // Ignore logo rendering errors.
      }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('STRUCTURAL ENGINEERING REPORT', pageW / 2, 28, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(metadata.projectName, pageW / 2, 39, { align: 'center' });

    autoTable(doc, {
      startY: 90,
      margin: { left: m, right: m },
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, textColor: this.textColor },
      body: [
        ['Project', metadata.projectName],
        ['Client', metadata.clientName || '—'],
        ['Engineer', metadata.engineerName || '—'],
        ['Location', metadata.location || '—'],
        ['Date', metadata.date.toLocaleDateString()],
        ['Revision', metadata.revision],
      ],
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 40 },
        1: { cellWidth: 130 },
      },
    });

    doc.setFontSize(8);
    doc.setTextColor(...this.mutedColor);
    doc.text('Prepared in BeamLab — values should be reviewed by the responsible engineer.', m, pageH - 20);
  }

  private renderExecutiveSummary(doc: jsPDF, reportData: UnifiedReportData): void {
    const m = this.margin;
    let y = m;

    this.renderSectionTitle(doc, '1. Executive Summary', y);
    y += 12;

    const summaryText = [
      `Total members in model: ${reportData.summary.totalMembers}`,
      `Members analysed: ${reportData.summary.analyzedMembers}`,
      `Members designed: ${reportData.summary.designedMembers}`,
      `Critical members: ${reportData.summary.criticalCount}`,
      `Failed members: ${reportData.summary.failedCount}`,
      `Recommended action: ${reportData.summary.recommendedAction}`,
    ].join('\n');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...this.textColor);
    doc.text(doc.splitTextToSize(summaryText, 180), m, y);
    y += 40;

    autoTable(doc, {
      startY: y,
      margin: { left: m, right: m },
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 3, textColor: this.textColor },
      head: [['Metric', 'Value']],
      body: [
        ['Maximum displacement', `${(reportData.analysis.maxDisplacement.value * 1000).toFixed(2)} mm`],
        ['Maximum member force', `${reportData.analysis.maxMemberForce.value.toFixed(2)} kN / kN·m`],
        ['Maximum stress', `${reportData.analysis.maxStress.value.toFixed(2)} MPa`],
        ['Design status', reportData.design.overallStatus.toUpperCase()],
      ],
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
    });
  }

  private renderAnalysisSection(doc: jsPDF, analysis: UnifiedAnalysisResult): void {
    const m = this.margin;
    let y = m;

    this.renderSectionTitle(doc, '2. Analysis Results', y);
    y += 12;

    autoTable(doc, {
      startY: y,
      margin: { left: m, right: m },
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, textColor: this.textColor },
      head: [['Metric', 'Value', 'Unit']],
      body: [
        ['Analysis type', analysis.analysisType.toUpperCase(), '—'],
        ['Load case', analysis.loadCase, '—'],
        ['Nodes analysed', `${analysis.nodeResults.size}`, '—'],
        ['Members analysed', `${analysis.memberResults.size}`, '—'],
        ['Maximum displacement', `${(analysis.maxDisplacement.value * 1000).toFixed(2)}`, 'mm'],
        ['Maximum member force', `${analysis.maxMemberForce.value.toFixed(2)}`, 'kN / kN·m'],
        ['Maximum stress', `${analysis.maxStress.value.toFixed(2)}`, 'MPa'],
        ['Maximum reaction', `${analysis.reactions.maxReaction.toFixed(2)}`, 'kN'],
      ],
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 65 } },
    });

    const reactionRows = analysis.reactions.reactions.slice(0, 12).map((row) => [
      row.nodeid,
      (row.reactions?.fx ?? 0).toFixed(2),
      (row.reactions?.fy ?? 0).toFixed(2),
      (row.reactions?.fz ?? 0).toFixed(2),
      (row.reactions?.mx ?? 0).toFixed(2),
      (row.reactions?.my ?? 0).toFixed(2),
      (row.reactions?.mz ?? 0).toFixed(2),
    ]);

    if (reactionRows.length > 0) {
      autoTable(doc, {
        startY: ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y) + 10,
        margin: { left: m, right: m },
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2, textColor: this.textColor },
        head: [['Support', 'Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz']],
        body: reactionRows,
      });
    }
  }

  private renderDesignSection(doc: jsPDF, design: UnifiedDesignResult): void {
    const m = this.margin;
    let y = m;

    this.renderSectionTitle(doc, '3. Design Checks', y);
    y += 12;

    autoTable(doc, {
      startY: y,
      margin: { left: m, right: m },
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, textColor: this.textColor },
      head: [['Metric', 'Value']],
      body: [
        ['Design code', design.designCode],
        ['Material type', design.materialType],
        ['Members designed', `${design.memberDesigns.size}`],
        ['Average utilization', `${(design.averageUtilization * 100).toFixed(1)} %`],
        ['Maximum utilization', `${(design.maxUtilization * 100).toFixed(1)} %`],
        ['Critical members', `${design.criticalMembers.length}`],
        ['Failed members', `${design.failedMembers.length}`],
        ['Overall status', design.overallStatus.toUpperCase()],
      ],
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
    });

    const designRows = Array.from(design.memberDesigns.values())
      .sort((a, b) => b.utilization - a.utilization)
      .slice(0, 15)
      .map((check: DesignCheck) => [
        check.memberId,
        check.sectionId,
        `${check.utilization.toFixed(3)}`,
        check.status.toUpperCase(),
        `${(check.bendingCheck.utilization * 100).toFixed(1)}% / ${check.bendingCheck.clause}`,
        `${(check.shearCheck.utilization * 100).toFixed(1)}% / ${check.shearCheck.clause}`,
        `${(check.axialCheck.utilization * 100).toFixed(1)}% / ${check.axialCheck.clause}`,
      ]);

    if (designRows.length > 0) {
      autoTable(doc, {
        startY: ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y) + 10,
        margin: { left: m, right: m },
        theme: 'striped',
        styles: { fontSize: 7.5, cellPadding: 2, textColor: this.textColor },
        head: [['Member', 'Section', 'D/C', 'Status', 'Bending', 'Shear', 'Axial']],
        body: designRows,
      });
    }
  }

  private renderDetailingSection(doc: jsPDF, detailing: UnifiedDetailingResult): void {
    const m = this.margin;
    let y = m;

    this.renderSectionTitle(doc, '4. Detailing', y);
    y += 12;

    const rcRows = detailing.rcReinforcement
      ? Array.from(detailing.rcReinforcement.values()).slice(0, 10).map((detail: ReinforcementDetail) => [
          detail.memberId,
          `${detail.mainBars.count}T${detail.mainBars.diameter}`,
          `${detail.stirrups.legsPerHoop}-leg T${detail.stirrups.diameter} @ ${detail.stirrups.spacing} mm`,
          `${detail.anchorageLength} mm ${detail.anchorageType}`,
        ])
      : [];

    const steelRows = detailing.steelConnections
      ? Array.from(detailing.steelConnections.values()).slice(0, 10).map((detail: ConnectionDetail) => [
          detail.memberId,
          detail.connectionType,
          detail.bolts ? `${detail.bolts.count} × M${detail.bolts.diameter} (${detail.bolts.grade})` : '—',
          detail.basePlate
            ? `${detail.basePlate.sizeX} × ${detail.basePlate.sizeY} × ${detail.basePlate.thickness} mm`
            : '—',
        ])
      : [];

    if (rcRows.length === 0 && steelRows.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...this.textColor);
      doc.text('No detailing results were available at the time of report generation.', m, y);
      return;
    }

    if (rcRows.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: m, right: m },
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2, textColor: this.textColor },
        head: [['Member', 'Main Bars', 'Stirrups', 'Anchorage']],
        body: rcRows,
      });
      y = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y) + 8;
    }

    if (steelRows.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: m, right: m },
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2, textColor: this.textColor },
        head: [['Member', 'Connection', 'Bolts / Welds', 'Base Plate']],
        body: steelRows,
      });
    }
  }

  private renderScheduleSection(doc: jsPDF, detailing: UnifiedDetailingResult): void {
    const m = this.margin;
    const y = m;

    this.renderSectionTitle(doc, '5. Material Schedules', y);

    const scheduleRows: string[][] = [];

    if (detailing.schedules.reinforcement) {
      scheduleRows.push([
        'Reinforcement',
        detailing.schedules.reinforcement.barType,
        `${detailing.schedules.reinforcement.totalWeight.toFixed(3)} t`,
      ]);
    }

    if (detailing.schedules.connections) {
      scheduleRows.push([
        'Connections',
        `${detailing.schedules.connections.totalBolts} bolts`,
        `${detailing.schedules.connections.totalBasePlateArea.toFixed(3)} m² base plate area`,
      ]);
    }

    if (scheduleRows.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...this.textColor);
      doc.text('No schedule data available.', m, y + 12);
      return;
    }

    autoTable(doc, {
      startY: y + 12,
      margin: { left: m, right: m },
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, textColor: this.textColor },
      head: [['Schedule', 'Primary Quantity', 'Notes']],
      body: scheduleRows,
    });
  }

  private renderSignatureSection(doc: jsPDF, metadata: ProjectMetadata): void {
    const m = this.margin;
    let y = m;

    this.renderSectionTitle(doc, '6. Approval & Certification', y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...this.textColor);
    const certLines = doc.splitTextToSize(
      'This report has been generated from the project model and summarises analysis, design, and detailing outputs. Final engineering responsibility remains with the reviewing professional engineer.',
      180,
    );
    doc.text(certLines, m, y);
    y += 30;

    autoTable(doc, {
      startY: y,
      margin: { left: m, right: m },
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 5, textColor: this.textColor },
      body: [
        ['Prepared by', metadata.engineerName || '________________', 'Date', metadata.date.toLocaleDateString()],
        ['Checked by', '________________', 'Revision', metadata.revision],
        ['Approved by', '________________', 'Client', metadata.clientName || '________________'],
      ],
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 30 },
        1: { cellWidth: 60 },
        2: { fontStyle: 'bold', cellWidth: 25 },
        3: { cellWidth: 60 },
      },
    });
  }

  private renderSectionTitle(doc: jsPDF, title: string, y: number): void {
    const m = this.margin;
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...this.headerColor);
    doc.text(title, m, y);
    doc.setDrawColor(...this.accentColor);
    doc.setLineWidth(0.6);
    doc.line(m, y + 2, pageW - m, y + 2);
  }

  private renderPageFooters(doc: jsPDF, projectName: string): void {
    const totalPages = doc.getNumberOfPages();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const m = this.margin;
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    for (let i = 1; i <= totalPages; i += 1) {
      doc.setPage(i);
      doc.setDrawColor(...this.headerColor);
      doc.setLineWidth(0.4);
      doc.line(m, pageH - 12, pageW - m, pageH - 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...this.mutedColor);
      doc.text(`BeamLab  |  ${projectName}`, m, pageH - 7);
      doc.text(dateStr, pageW / 2, pageH - 7, { align: 'center' });
      doc.text(`Page ${i} of ${totalPages}`, pageW - m, pageH - 7, { align: 'right' });
    }
  }
}
