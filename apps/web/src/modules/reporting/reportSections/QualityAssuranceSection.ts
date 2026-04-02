import type { DetailedReportEngine } from '../DetailedReportEngine';
import { applyStatusCellStyle, REASONABLE_CARE_STATEMENT } from './reportSectionHelpers';

export function renderQualityAssuranceSection(engine: DetailedReportEngine): void {
    const e = engine as any;
    e.sectionNumber++;
    e.addTocEntry(`${e.sectionNumber}. QUALITY ASSURANCE`, 1);
    e.renderSectionHeader('QUALITY ASSURANCE');
    
    e.renderSubsectionHeader('Design Verification Checklist');
    const qaData = (e.data.qualityChecks || []).map((q: any) => [q.category, q.item, q.requirement, q.actual, q.status]);
    e.autoTable(e.doc, {
        startY: e.currentY,
        head: [['Category', 'Item', 'Requirement', 'Actual', 'Status']],
        body: qaData,
        theme: 'striped',
        headStyles: { fillColor: [e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b] },
        margin: { left: e.margins.left, right: e.margins.right },
        styles: { fontSize: 8 },
        didParseCell: applyStatusCellStyle,
    });
    e.currentY = (e.doc as any).lastAutoTable.finalY + 15;
    
    e.checkPageBreak(60);
    e.renderSubsectionHeader('Approval Signatures');
    const sigY = e.currentY + 5;
    const sigWidth = (e.contentWidth - 20) / 3;
    ['Designed By', 'Checked By', 'Approved By'].forEach((role: string, i: number) => {
        const x = e.margins.left + i * (sigWidth + 10);
        e.doc.setDrawColor(180, 180, 180);
        e.doc.line(x, sigY + 25, x + sigWidth, sigY + 25);
        e.doc.setFontSize(9);
        e.doc.setFont('helvetica', 'bold');
        e.doc.setTextColor(0, 0, 0);
        e.doc.text(role, x, sigY);
        e.doc.setFont('helvetica', 'normal');
        e.doc.setTextColor(100, 100, 100);
        e.doc.text('Name: ____________________', x, sigY + 32);
        e.doc.text('Date: ____________________', x, sigY + 40);
        e.doc.text('License: _________________', x, sigY + 48);
    });
    e.currentY = sigY + 55;
}
