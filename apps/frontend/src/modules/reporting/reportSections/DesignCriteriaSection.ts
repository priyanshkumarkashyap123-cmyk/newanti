import type { DetailedReportEngine } from '../DetailedReportEngine';

export function renderDesignCriteriaSection(engine: DetailedReportEngine): void {
    const e = engine as any;
    e.sectionNumber++;
    e.addTocEntry(`${e.sectionNumber}. DESIGN CRITERIA`, 1);
    e.renderSectionHeader('DESIGN CRITERIA');
    
    // Design Codes
    e.renderSubsectionHeader('Design Codes and Standards');
    const codeTable = e.data.criteria.codes.map((code: string, i: number) => [String(i + 1), code, getCodeDescription(code)]);
    e.autoTable(e.doc, {
        startY: e.currentY,
        head: [['#', 'Code', 'Description']],
        body: codeTable,
        theme: 'striped',
        headStyles: { fillColor: [e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b] },
        margin: { left: e.margins.left, right: e.margins.right },
        styles: { fontSize: 9 },
    });
    e.currentY = (e.doc as any).lastAutoTable.finalY + 10;
    
    // Load Factors
    e.renderSubsectionHeader('Load Factors');
    const loadFactorData = Object.entries(e.data.criteria.loadFactors || {}).map(([load, factor]) => [load, String(factor)]);
    e.autoTable(e.doc, {
        startY: e.currentY,
        head: [['Load Type', 'Factor']],
        body: loadFactorData,
        theme: 'striped',
        headStyles: { fillColor: [e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b] },
        margin: { left: e.margins.left, right: e.margins.right },
        styles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 80 } },
    });
    e.currentY = (e.doc as any).lastAutoTable.finalY + 10;
    
    // Serviceability Limits
    e.renderSubsectionHeader('Serviceability Limits');
    const limits = e.data.criteria.deflectionLimits || {};
    const limitData = [['Live Load Deflection', limits.live || '-'], ['Total Deflection', limits.total || '-'], ['Story Drift', limits.drift || '-']];
    if (e.data.criteria.serviceabilityLimits?.vibration) limitData.push(['Floor Vibration', e.data.criteria.serviceabilityLimits.vibration]);
    e.renderKeyValueTable(limitData);
}

function getCodeDescription(code: string): string {
    const descriptions: Record<string, string> = {
        'IS 800:2007': 'General Construction in Steel',
        'IS 456:2000': 'Plain and Reinforced Concrete',
        'IS 1893:2016': 'Earthquake Resistant Design',
        'IS 13920:2016': 'Ductile Design and Detailing',
        'AISC 360-16': 'Specification for Structural Steel Buildings',
        'ACI 318-19': 'Building Code Requirements for Structural Concrete',
        'ASCE 7-22': 'Minimum Design Loads for Buildings',
        'Eurocode 3': 'Design of Steel Structures',
        'Eurocode 2': 'Design of Concrete Structures',
        'BS 5950': 'Structural Use of Steelwork in Building',
        'CSA S16-19': 'Design of Steel Structures',
        'AS 4100': 'Steel Structures',
    };
    return descriptions[code] || code;
}
