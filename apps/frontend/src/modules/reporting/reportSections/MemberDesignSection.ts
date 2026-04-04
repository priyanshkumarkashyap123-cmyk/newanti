import type { DetailedReportEngine } from '../DetailedReportEngine';
import { applyStatusCellStyle } from './reportSectionHelpers';

export function renderMemberDesignSection(engine: DetailedReportEngine): void {
    const e = engine as any;
    e.sectionNumber++;
    e.addTocEntry(`${e.sectionNumber}. MEMBER DESIGN`, 1);
    e.renderSectionHeader('MEMBER DESIGN');
    
    e.renderSubsectionHeader('Member Design Summary');
    const memberSummary = (e.data.memberDesigns || []).map((m: any) => [
        m.name,
        m.type,
        m.section,
        `${(m.criticalRatio * 100).toFixed(1)}%`,
        m.criticalCheck,
        m.overallStatus
    ]);
    e.autoTable(e.doc, {
        startY: e.currentY,
        head: [['Member', 'Type', 'Section', 'Utilization', 'Critical Check', 'Status']],
        body: memberSummary,
        theme: 'striped',
        headStyles: { fillColor: [e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b] },
        margin: { left: e.margins.left, right: e.margins.right },
        styles: { fontSize: 8 },
        bodyStyles: { valign: 'middle' },
        didParseCell: applyStatusCellStyle,
    });
    e.currentY = (e.doc as any).lastAutoTable.finalY + 15;
    
    const criticalMembers = (e.data.memberDesigns || []).filter((m: any) => m.criticalRatio > 0.85 || m.overallStatus !== 'PASS').slice(0, 5);
    if (criticalMembers.length > 0) {
        e.checkPageBreak(50);
        e.renderSubsectionHeader('Critical Member Details');
        criticalMembers.forEach((member: any) => {
            e.checkPageBreak(40);
            e.doc.setFontSize(10);
            e.doc.setFont('helvetica', 'bold');
            e.doc.setTextColor(0, 0, 0);
            e.doc.text(`${member.name} (${member.section})`, e.margins.left, e.currentY);
            e.currentY += 6;
            const checkData = (member.checks || []).map((c: any) => [
                c.name,
                c.clause,
                c.capacity.toFixed(1),
                c.demand.toFixed(1),
                `${(c.ratio * 100).toFixed(1)}%`,
                c.status
            ]);
            e.autoTable(e.doc, {
                startY: e.currentY,
                head: [['Check', 'Clause', 'Capacity', 'Demand', 'Ratio', 'Status']],
                body: checkData,
                theme: 'grid',
                headStyles: { fillColor: [100, 100, 100], fontSize: 8 },
                margin: { left: e.margins.left + 5, right: e.margins.right },
                styles: { fontSize: 8 },
                didParseCell: applyStatusCellStyle,
            });
            e.currentY = (e.doc as any).lastAutoTable.finalY + 10;
        });
    }
}
