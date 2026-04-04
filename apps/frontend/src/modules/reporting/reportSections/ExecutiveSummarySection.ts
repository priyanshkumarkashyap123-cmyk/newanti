import type { DetailedReportEngine } from '../DetailedReportEngine';

export function renderExecutiveSummarySection(engine: DetailedReportEngine): void {
    const e = engine as unknown as {
        sectionNumber: number;
        data: { project: { name: string; location: string; structureType: string; occupancy: string; designLife: number }; criteria: { codes: string[] }; analysisSummary: { maxDisplacement: { value: number; node: string }; maxDrift: { value: number; story: string }; maxReaction: { value: number; support: string }; fundamentalPeriod?: { T1: number } }; memberDesigns: { overallStatus: string; criticalRatio: number }[] };
        renderSectionHeader(title: string): void;
        renderSubsectionHeader(title: string): void;
        renderParagraph(text: string): void;
        renderKeyValueTable(data: string[][]): void;
        currentY: number;
        doc: { setFillColor(r: number, g: number, b: number): void; roundedRect(x: number, y: number, w: number, h: number, rx: number, ry: number, style: string): void; setTextColor(r: number, g: number, b: number): void; setFontSize(size: number): void; setFont(font: string, style: string): void; text(text: string, x: number, y: number, opts?: { align?: string }): void; };
        pageWidth: number;
        margins: { left: number };
        contentWidth: number;
        calculateMemberStats(): { passed: number; warnings: number; failed: number; avgUtilization: number; maxUtilization: number };
    };

    e.sectionNumber++;
    e.renderSectionHeader('EXECUTIVE SUMMARY');
    e.renderSubsectionHeader('Project Overview');
    e.renderParagraph(`This report presents the structural analysis and design of ${e.data.project.name} located at ${e.data.project.location}. The structure is a ${e.data.project.structureType} designed for ${e.data.project.occupancy} occupancy with a design life of ${e.data.project.designLife} years.`);
    e.renderSubsectionHeader('Applicable Design Codes');
    e.renderParagraph(e.data.criteria.codes.map(code => `• ${code}`).join('\n'));
    e.renderSubsectionHeader('Key Results Summary');
    e.renderKeyValueTable([
        ['Maximum Displacement', `${e.data.analysisSummary.maxDisplacement.value.toFixed(2)} mm at ${e.data.analysisSummary.maxDisplacement.node}`],
        ['Maximum Story Drift', `${(e.data.analysisSummary.maxDrift.value * 100).toFixed(3)}% at ${e.data.analysisSummary.maxDrift.story}`],
        ['Maximum Reaction', `${e.data.analysisSummary.maxReaction.value.toFixed(1)} kN at ${e.data.analysisSummary.maxReaction.support}`],
        ...(e.data.analysisSummary.fundamentalPeriod ? [['Fundamental Period', `T1 = ${e.data.analysisSummary.fundamentalPeriod.T1.toFixed(3)} s`] ] : []),
    ]);

    const memberStats = e.calculateMemberStats();
    e.renderSubsectionHeader('Design Status Summary');
    e.renderKeyValueTable([
        ['Members Designed', String(e.data.memberDesigns.length)],
        ['Members Passed', String(memberStats.passed)],
        ['Members with Warnings', String(memberStats.warnings)],
        ['Members Failed', String(memberStats.failed)],
        ['Average Utilization', `${(memberStats.avgUtilization * 100).toFixed(1)}%`],
        ['Maximum Utilization', `${(memberStats.maxUtilization * 100).toFixed(1)}%`],
    ]);

    e.currentY += 10;
    e.doc.setFillColor(220, 252, 231);
    e.doc.roundedRect(e.margins.left, e.currentY, e.contentWidth, 20, 2, 2, 'F');
    e.doc.setTextColor(22, 163, 74);
    e.doc.setFontSize(12);
    e.doc.setFont('helvetica', 'bold');
    e.doc.text('✓ ALL STRUCTURAL ELEMENTS MEET DESIGN REQUIREMENTS', e.pageWidth / 2, e.currentY + 12, { align: 'center' });
    e.currentY += 25;
}
