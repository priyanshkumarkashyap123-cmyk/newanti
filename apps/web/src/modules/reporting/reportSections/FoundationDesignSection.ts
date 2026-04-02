import type { DetailedReportEngine } from '../DetailedReportEngine';
import { applyStatusCellStyle } from './reportSectionHelpers';

export function renderFoundationDesignSection(engine: DetailedReportEngine): void {
    const e = engine as any;
    e.sectionNumber++;
    e.addTocEntry(`${e.sectionNumber}. FOUNDATION DESIGN`, 1);
    e.renderSectionHeader('FOUNDATION DESIGN');
    
    e.renderSubsectionHeader('Foundation Summary');
    const foundSummary = (e.data.foundationDesigns || []).map((f: any) => [
        f.id,
        f.type,
        f.column,
        `${f.geometry.length} x ${f.geometry.width} x ${f.geometry.depth}`,
        `${f.loads.axial.toFixed(1)} kN`,
        f.overallStatus
    ]);
    e.autoTable(e.doc, {
        startY: e.currentY,
        head: [['Footing', 'Type', 'Column', 'Size (L×W×D) m', 'Axial Load', 'Status']],
        body: foundSummary,
        theme: 'striped',
        headStyles: { fillColor: [e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b] },
        margin: { left: e.margins.left, right: e.margins.right },
        styles: { fontSize: 9 },
        didParseCell: applyStatusCellStyle,
    });
    e.currentY = (e.doc as any).lastAutoTable.finalY + 10;
}
