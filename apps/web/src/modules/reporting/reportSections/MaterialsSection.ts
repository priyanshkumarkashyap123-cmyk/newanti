import type { DetailedReportEngine } from '../DetailedReportEngine';

export function renderMaterialsSection(engine: DetailedReportEngine): void {
    const e = engine as any;
    e.sectionNumber++;
    e.addTocEntry(`${e.sectionNumber}. MATERIALS`, 1);
    e.renderSectionHeader('MATERIALS');
    
    if (e.data.materials.steel?.length > 0) {
        e.renderSubsectionHeader('Structural Steel');
        const steelData = e.data.materials.steel.map((s: any) => [s.grade, String(s.fy), String(s.fu), String(s.E / 1000), String(s.density)]);
        e.autoTable(e.doc, {
            startY: e.currentY,
            head: [['Grade', 'fy (MPa)', 'fu (MPa)', 'E (GPa)', 'Density (kg/m³)']],
            body: steelData,
            theme: 'striped',
            headStyles: { fillColor: [e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b] },
            margin: { left: e.margins.left, right: e.margins.right },
            styles: { fontSize: 9 },
        });
        e.currentY = (e.doc as any).lastAutoTable.finalY + 10;
    }
    
    if (e.data.materials.concrete?.length > 0) {
        e.renderSubsectionHeader('Concrete');
        const concreteData = e.data.materials.concrete.map((c: any) => [c.grade, String(c.fck), String((c.Ec / 1000).toFixed(1)), String(c.density)]);
        e.autoTable(e.doc, {
            startY: e.currentY,
            head: [['Grade', 'fck (MPa)', 'Ec (GPa)', 'Density (kg/m³)']],
            body: concreteData,
            theme: 'striped',
            headStyles: { fillColor: [e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b] },
            margin: { left: e.margins.left, right: e.margins.right },
            styles: { fontSize: 9 },
        });
        e.currentY = (e.doc as any).lastAutoTable.finalY + 10;
    }
    
    if (e.data.materials.rebar?.length > 0) {
        e.renderSubsectionHeader('Reinforcing Steel');
        const rebarData = e.data.materials.rebar.map((r: any) => [r.grade, String(r.fy)]);
        e.autoTable(e.doc, {
            startY: e.currentY,
            head: [['Grade', 'fy (MPa)']],
            body: rebarData,
            theme: 'striped',
            headStyles: { fillColor: [e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b] },
            margin: { left: e.margins.left, right: e.margins.right },
            styles: { fontSize: 9 },
            columnStyles: { 0: { cellWidth: 80 } },
        });
        e.currentY = (e.doc as any).lastAutoTable.finalY + 10;
    }
}
