import type { DetailedReportEngine } from '../DetailedReportEngine';
import { REASONABLE_CARE_STATEMENT } from './reportSectionHelpers';

export function renderConclusionsSection(engine: DetailedReportEngine): void {
    const e = engine as any;
    e.sectionNumber++;
    e.addTocEntry(`${e.sectionNumber}. CONCLUSIONS & RECOMMENDATIONS`, 1);
    e.renderSectionHeader('CONCLUSIONS & RECOMMENDATIONS');
    
    e.renderSubsectionHeader('Conclusions');
    const memberCount = (e.data.memberDesigns || []).length;
    const stats = calculateMemberStats(e.data.memberDesigns || []);
    const conclusions = [
        `The structural analysis and design of ${e.data.project.name} has been completed in accordance with the applicable design codes.`,
        `A total of ${memberCount} structural members have been designed and verified.`,
        `${stats.passed} members (${((stats.passed / memberCount) * 100).toFixed(1)}%) satisfy all design requirements.`,
        `The maximum member utilization ratio is ${(stats.maxUtilization * 100).toFixed(1)}%.`,
        `The average member utilization ratio is ${(stats.avgUtilization * 100).toFixed(1)}%.`,
    ];
    conclusions.forEach((c: string, i: number) => {
        e.doc.setFontSize(10);
        e.doc.setFont('helvetica', 'normal');
        e.doc.setTextColor(0, 0, 0);
        e.doc.text(`${i + 1}. ${c}`, e.margins.left, e.currentY, { maxWidth: e.contentWidth - 10 });
        e.currentY += 10;
    });
    
    e.currentY += 5;
    e.renderSubsectionHeader('Recommendations');
    const recommendations = [
        'All structural connections should be designed and detailed as per the applicable code requirements.',
        'Shop drawings should be reviewed and approved by the Engineer of Record before fabrication.',
        'Field inspections should be conducted to ensure construction matches the design intent.',
        'Any modifications to the structure should be reviewed and approved by the structural engineer.',
    ];
    recommendations.forEach((r: string, i: number) => {
        e.doc.setFontSize(10);
        e.doc.setFont('helvetica', 'normal');
        e.doc.setTextColor(0, 0, 0);
        e.doc.text(`${i + 1}. ${r}`, e.margins.left, e.currentY, { maxWidth: e.contentWidth - 10 });
        e.currentY += 10;
    });
    
    e.currentY += 10;
    e.doc.setFillColor(240, 249, 255);
    e.doc.setDrawColor(e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b);
    e.doc.setLineWidth(0.5);
    e.doc.roundedRect(e.margins.left, e.currentY, e.contentWidth, 25, 2, 2, 'FD');
    e.doc.setFontSize(10);
    e.doc.setFont('helvetica', 'italic');
    e.doc.setTextColor(e.primaryRgb.r, e.primaryRgb.g, e.primaryRgb.b);
    e.doc.text(REASONABLE_CARE_STATEMENT, e.pageWidth / 2, e.currentY + 10, { align: 'center', maxWidth: e.contentWidth - 10 });
}

function calculateMemberStats(members: any[]) {
    let passed = 0, warnings = 0, failed = 0;
    let totalUtilization = 0;
    let maxUtilization = 0;
    members.forEach((member: any) => {
        if (member.overallStatus === 'PASS') passed++;
        else if (member.overallStatus === 'WARNING') warnings++;
        else if (member.overallStatus === 'FAIL') failed++;
        totalUtilization += member.criticalRatio;
        maxUtilization = Math.max(maxUtilization, member.criticalRatio);
    });
    return { passed, warnings, failed, avgUtilization: totalUtilization / (members.length || 1), maxUtilization };
}
