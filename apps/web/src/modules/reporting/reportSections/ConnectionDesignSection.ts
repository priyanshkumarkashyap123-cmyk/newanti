import type { DetailedReportEngine } from '../DetailedReportEngine';
import { applyStatusCellStyle } from './reportSectionHelpers';

export function renderConnectionDesignSection(engine: DetailedReportEngine): void {
    const e = engine as any;
    e.sectionNumber++;
    e.addTocEntry(`${e.sectionNumber}. CONNECTION DESIGN`, 1);
    e.renderSectionHeader('CONNECTION DESIGN');
    
    e.renderSubsectionHeader('Connection Summary');
    const connSummary = (e.data.connectionDesigns || []).map((c: any) => [
        c.id,
        c.type,
        (c.members || []).join(' - '),
        c.category,
        c.overallStatus
    ]);
    e.autoTable(e.doc, {
        startY: e.currentY,
        head: [['Connection', 'Type', 'Members', 'Category', 'Status']],
        body: connSummary,
        theme: 'striped',
        headStyles: { fillColor: [e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b] },
        margin: { left: e.margins.left, right: e.margins.right },
        styles: { fontSize: 9 },
        didParseCell: applyStatusCellStyle,
    });
    e.currentY = (e.doc as any).lastAutoTable.finalY + 10;
}
