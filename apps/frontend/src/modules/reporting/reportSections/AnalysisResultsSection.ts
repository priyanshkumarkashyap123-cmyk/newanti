import type { DetailedReportEngine } from '../DetailedReportEngine';

export function renderAnalysisResultsSection(engine: DetailedReportEngine): void {
    const e = engine as any;
    e.sectionNumber++;
    e.addTocEntry(`${e.sectionNumber}. ANALYSIS RESULTS`, 1);
    e.renderSectionHeader('ANALYSIS RESULTS');
    
    const summary = e.data.analysisSummary;
    e.renderSubsectionHeader('Displacement Summary');
    const dispData = [
        ['Maximum Total Displacement', `${summary.maxDisplacement.value.toFixed(2)} mm`, summary.maxDisplacement.node, summary.maxDisplacement.loadCase],
        ['Maximum Story Drift', `${(summary.maxDrift.value * 100).toFixed(3)}%`, summary.maxDrift.story, summary.maxDrift.loadCase],
    ];
    e.autoTable(e.doc, {
        startY: e.currentY,
        head: [['Parameter', 'Value', 'Location', 'Load Case']],
        body: dispData,
        theme: 'striped',
        headStyles: { fillColor: [e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b] },
        margin: { left: e.margins.left, right: e.margins.right },
        styles: { fontSize: 9 },
    });
    e.currentY = (e.doc as any).lastAutoTable.finalY + 10;
    
    if (summary.fundamentalPeriod) {
        e.renderSubsectionHeader('Modal Analysis Results');
        const modalData = [
            ['Mode 1 (T1)', `${summary.fundamentalPeriod.T1.toFixed(3)} s`, `${(1 / summary.fundamentalPeriod.T1).toFixed(2)} Hz`],
            ['Mode 2 (T2)', `${summary.fundamentalPeriod.T2?.toFixed(3) || '-'} s`, `${summary.fundamentalPeriod.T2 ? (1 / summary.fundamentalPeriod.T2).toFixed(2) : '-'} Hz`],
            ['Mode 3 (T3)', `${summary.fundamentalPeriod.T3?.toFixed(3) || '-'} s`, `${summary.fundamentalPeriod.T3 ? (1 / summary.fundamentalPeriod.T3).toFixed(2) : '-'} Hz`],
        ];
        e.autoTable(e.doc, {
            startY: e.currentY,
            head: [['Mode', 'Period', 'Frequency']],
            body: modalData,
            theme: 'striped',
            headStyles: { fillColor: [e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b] },
            margin: { left: e.margins.left, right: e.margins.right },
            styles: { fontSize: 9 },
        });
        e.currentY = (e.doc as any).lastAutoTable.finalY + 10;
    }
    
    if (e.data.images?.model3D) {
        e.checkPageBreak(100);
        try {
            e.doc.addImage(e.data.images.model3D, 'PNG', e.margins.left, e.currentY, e.contentWidth, 80);
            e.currentY += 85;
            e.doc.setFontSize(9);
            e.doc.setFont('helvetica', 'italic');
            e.doc.setTextColor(100, 100, 100);
            e.doc.text(`Figure 1: 3D Structural Model`, e.pageWidth / 2, e.currentY, { align: 'center' });
            e.currentY += 10;
        } catch (err) {
            console.warn('Could not add 3D model image');
        }
    }
}
