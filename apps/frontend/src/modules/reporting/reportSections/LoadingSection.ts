import type { DetailedReportEngine } from '../DetailedReportEngine';

export function renderLoadingSection(engine: DetailedReportEngine): void {
    const e = engine as any;
    e.sectionNumber++;
    e.addTocEntry(`${e.sectionNumber}. LOADING`, 1);
    e.renderSectionHeader('LOADING');
    
    e.renderSubsectionHeader('Dead Loads');
    const deadLoadData = (e.data.loads.deadLoads || []).map((l: any) => [l.description, `${l.value} ${l.unit}`, l.location]);
    e.autoTable(e.doc, {
        startY: e.currentY,
        head: [['Description', 'Value', 'Location']],
        body: deadLoadData,
        theme: 'striped',
        headStyles: { fillColor: [e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b] },
        margin: { left: e.margins.left, right: e.margins.right },
        styles: { fontSize: 9 },
    });
    e.currentY = (e.doc as any).lastAutoTable.finalY + 10;
    
    e.renderSubsectionHeader('Live Loads');
    const liveLoadData = (e.data.loads.liveLoads || []).map((l: any) => [l.description, `${l.value} ${l.unit}`, l.occupancy]);
    e.autoTable(e.doc, {
        startY: e.currentY,
        head: [['Description', 'Value', 'Occupancy Type']],
        body: liveLoadData,
        theme: 'striped',
        headStyles: { fillColor: [e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b] },
        margin: { left: e.margins.left, right: e.margins.right },
        styles: { fontSize: 9 },
    });
    e.currentY = (e.doc as any).lastAutoTable.finalY + 10;
    
    if (e.data.loads.windLoads) {
        e.checkPageBreak(60);
        e.renderSubsectionHeader('Wind Loads');
        const wind = e.data.loads.windLoads;
        e.renderParagraph(`Basic Wind Speed: ${wind.basicSpeed} m/s\nExposure Category: ${wind.exposure}`);
        const windPressureData = (wind.pressures || []).map((p: any) => [p.zone, `${p.pressure.toFixed(2)} kN/m²`]);
        e.autoTable(e.doc, {
            startY: e.currentY,
            head: [['Zone', 'Design Pressure']],
            body: windPressureData,
            theme: 'striped',
            headStyles: { fillColor: [e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b] },
            margin: { left: e.margins.left, right: e.margins.right },
            styles: { fontSize: 9 },
        });
        e.currentY = (e.doc as any).lastAutoTable.finalY + 10;
    }
    
    if (e.data.loads.seismicLoads) {
        e.checkPageBreak(80);
        e.renderSubsectionHeader('Seismic Loads');
        const seismic = e.data.loads.seismicLoads;
        e.renderKeyValueTable([['Seismic Zone', seismic.zone], ['Soil Type', seismic.soilType], ['Response Reduction Factor (R)', String(seismic.R)], ['Importance Factor (I)', String(seismic.I)], ['Design Base Shear', `${seismic.baseShear.toFixed(1)} kN`]]);
        e.currentY += 10;
        const storyForceData = (seismic.storyForces || []).map((s: any) => [s.level, `${s.height.toFixed(1)} m`, `${s.force.toFixed(1)} kN`]);
        e.autoTable(e.doc, {
            startY: e.currentY,
            head: [['Level', 'Height', 'Lateral Force']],
            body: storyForceData,
            theme: 'striped',
            headStyles: { fillColor: [e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b] },
            margin: { left: e.margins.left, right: e.margins.right },
            styles: { fontSize: 9 },
        });
        e.currentY = (e.doc as any).lastAutoTable.finalY + 10;
    }
}
