
import { AnalysisResults, Node, Member, NodeLoad, MemberLoad } from '../store/model';
import { SteelDesignResults } from './SteelDesignService';
import { API_CONFIG } from '../config/env';

interface ProjectInfo {
    name: string;
    engineer: string;
    date: string;
    description: string;
}

const PYTHON_API_URL = API_CONFIG.pythonUrl;

export const generateProfessionalReport = async (
    project: ProjectInfo,
    members: Member[],
    nodes: Node[],
    analysisResults: AnalysisResults | null,
    designResults: Map<string, SteelDesignResults>,
    nodeLoads?: NodeLoad[],
    memberLoads?: MemberLoad[],
): Promise<void> => {
    try {
        // Format input data
        const inputNodes = nodes.map(n => ({
            id: n.id,
            x: n.x, y: n.y, z: n.z,
            support: n.restraints ? (
                Object.values(n.restraints).every(v => v) ? 'Fixed' :
                    Object.values(n.restraints).some(v => v) ? 'Pinned/Roller' : 'Free'
            ) : 'Free'
        }));

        const inputMembers = members.map(m => ({
            id: m.id,
            startNodeId: m.startNodeId,
            endNodeId: m.endNodeId,
            section: m.sectionId || 'Default',
            material: 'Steel'
        }));

        // Format results
        let resultsData: Record<string, unknown> = { success: false };
        if (analysisResults) {
            let maxDisp = 0;
            let maxMoment = 0;
            let maxShear = 0;
            let maxAxial = 0;

            const dispDict: Record<string, { dx: number; dy: number; dz: number }> = {};
            analysisResults.displacements.forEach((disp: { dx: number; dy: number; dz: number }, nodeId: string) => {
                const total = Math.sqrt(disp.dx ** 2 + disp.dy ** 2 + disp.dz ** 2);
                maxDisp = Math.max(maxDisp, total * 1000); // Convert to mm
                dispDict[nodeId] = { dx: disp.dx, dy: disp.dy, dz: disp.dz };
            });

            const forcesDict: Record<string, { moment: number[]; shear: number[]; axial: number }> = {};
            analysisResults.memberForces.forEach((forces: { momentY?: number; momentZ?: number; shearY?: number; shearZ?: number; axial: number }, memberId: string) => {
                maxMoment = Math.max(maxMoment, Math.abs(forces.momentY || 0), Math.abs(forces.momentZ || 0));
                maxShear = Math.max(maxShear, Math.abs(forces.shearY || 0), Math.abs(forces.shearZ || 0));
                maxAxial = Math.max(maxAxial, Math.abs(forces.axial || 0));
                forcesDict[memberId] = {
                    moment: [0, Math.max(Math.abs(forces.momentZ || 0), Math.abs(forces.momentY || 0))], // Simplify for now
                    shear: [0, Math.max(Math.abs(forces.shearZ || 0), Math.abs(forces.shearY || 0))],
                    axial: forces.axial
                };
            });

            resultsData = {
                success: true,
                max_displacement: maxDisp,
                max_moment: maxMoment,
                max_shear: maxShear,
                max_axial: maxAxial,
                displacements: dispDict,
                memberForces: forcesDict
            };
        }

        // Format checks
        const checksList = Array.from(designResults.values()).map(r => ({
            id: r.memberId,
            section: r.section.name,
            utilization: r.criticalRatio,
            status: r.overallStatus
        }));

        // Prepare payload
        const payload = {
            settings: {
                project_name: project.name,
                engineer_name: project.engineer,
                company_name: "BeamLab",
                include_diagrams: true
            },
            analysis_data: {
                input: {
                    nodes: inputNodes,
                    members: inputMembers,
                    loads: [
                        ...(nodeLoads || []).map(nl => ({
                            type: 'nodal',
                            nodeId: nl.nodeId,
                            fx: nl.fx || 0, fy: nl.fy || 0, fz: nl.fz || 0,
                            mx: nl.mx || 0, my: nl.my || 0, mz: nl.mz || 0,
                        })),
                        ...(memberLoads || []).map(ml => ({
                            type: ml.type,
                            memberId: ml.memberId,
                            direction: ml.direction,
                            w1: ml.w1 ?? 0,
                            w2: ml.w2 ?? ml.w1 ?? 0,
                            P: ml.P ?? 0,
                            M: ml.M ?? 0,
                            ...(ml.a !== undefined && { a: ml.a }),
                            ...(ml.startPos !== undefined && { startPos: ml.startPos }),
                            ...(ml.endPos !== undefined && { endPos: ml.endPos }),
                        })),
                    ]
                },
                results: resultsData,
                design_checks: {
                    members: checksList
                },
                diagrams: {
                    nodes: inputNodes,
                    members: inputMembers
                }
            }
        };

        // Call API
        const response = await fetch(`${PYTHON_API_URL}/reports/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Report generation failed');

        const data = await response.json();
        if (data.success && data.pdf_base64) {
            // Decode base64 and download
            const binaryString = window.atob(data.pdf_base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = data.filename || 'Report.pdf';
            link.click();
            window.URL.revokeObjectURL(url);
        } else {
            throw new Error(data.error || 'Unknown error');
        }

    } catch (error) {
        console.error('Professional Report Error:', error);
        // Fallback or just re-throw
        throw error;
    }
};

/**
 * Professional PDF report generator using jsPDF directly (fallback)
 * Styled to match the ReportsPage's ARUP/WSP-grade engineering report quality
 */
export const generateBasicPDFReport = async (
    project: ProjectInfo,
    members: Member[],
    nodes: Node[],
    analysisResults: AnalysisResults | null,
    designResults: Map<string, SteelDesignResults>
) => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // Professional theme colors (matches ReportGenerator.ts THEME)
    const NAVY: [number, number, number] = [18, 55, 106];
    const GOLD: [number, number, number] = [191, 155, 48];
    const SLATE_700: [number, number, number] = [51, 65, 85];
    const SLATE_500: [number, number, number] = [100, 116, 139];
    const SLATE_200: [number, number, number] = [226, 232, 240];
    const SLATE_50: [number, number, number] = [248, 250, 252];
    const GREEN: [number, number, number] = [22, 163, 74];
    const RED: [number, number, number] = [220, 38, 38];
    const AMBER: [number, number, number] = [217, 119, 6];

    // Helper for formatting
    const formatNumber = (n: number, decimals = 2) => n.toFixed(decimals);
    const docRef = `BL-${String((nodes.length * 37 + members.length * 53 + 1000) % 99999).padStart(5, '0')}`;
    const dateStr = project.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // ============================================
    // COVER PAGE
    // ============================================
    // Top accent bars
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageWidth, 6, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(0, 6, pageWidth, 3, 'F');

    // Company branding
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text('BeamLab', 20, 30);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_500);
    doc.text('STRUCTURAL ENGINEERING', 20, 36);

    // Right side branding
    doc.setFontSize(8);
    doc.setTextColor(...SLATE_500);
    doc.text('beamlab.app', pageWidth - 20, 26, { align: 'right' });
    doc.text('support@beamlab.app', pageWidth - 20, 31, { align: 'right' });

    // Divider
    doc.setDrawColor(...SLATE_200);
    doc.setLineWidth(0.5);
    doc.line(20, 42, pageWidth - 20, 42);

    // Centre title block
    const centerY = pageHeight / 2 - 20;
    doc.setDrawColor(...SLATE_200);
    doc.line(pageWidth / 2 - 30, centerY - 25, pageWidth / 2 + 30, centerY - 25);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE_500);
    doc.text('STRUCTURAL ANALYSIS REPORT', pageWidth / 2, centerY - 15, { align: 'center' });

    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(project.name || 'BeamLab Project', pageWidth / 2, centerY + 2, { align: 'center', maxWidth: pageWidth - 60 });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_500);
    doc.text(`Document Ref: ${docRef}`, pageWidth / 2, centerY + 16, { align: 'center' });
    doc.text(`Revision 00 \u2014 ${dateStr}`, pageWidth / 2, centerY + 23, { align: 'center' });

    doc.setDrawColor(...SLATE_200);
    doc.line(pageWidth / 2 - 30, centerY + 32, pageWidth / 2 + 30, centerY + 32);

    // Document control mini-table
    autoTable(doc, {
        startY: pageHeight - 65,
        margin: { left: 20, right: 20 },
        head: [],
        body: [
            ['Project', project.name, 'Document No.', docRef],
            ['Prepared by', project.engineer, 'Date', dateStr],
            ['Status', analysisResults ? 'Issued for Review' : 'DRAFT', 'Revision', '00'],
        ],
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 3, textColor: SLATE_700 },
        columnStyles: {
            0: { fontStyle: 'bold', textColor: SLATE_500, cellWidth: 30 },
            2: { fontStyle: 'bold', textColor: SLATE_500, cellWidth: 30 },
        },
        tableLineColor: SLATE_200,
        tableLineWidth: 0.3,
        didDrawCell: (data) => {
            // Draw cell borders
            doc.setDrawColor(...SLATE_200);
            doc.setLineWidth(0.3);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'S');
        }
    });

    // Bottom accent bar
    doc.setFillColor(...NAVY);
    doc.rect(0, pageHeight - 6, pageWidth, 6, 'F');

    // ============================================
    // PAGE 2: MODEL SUMMARY
    // ============================================
    doc.addPage();

    // Running header
    const addRunningHeader = () => {
        doc.setFillColor(...NAVY);
        doc.rect(0, 0, pageWidth, 1.5, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...SLATE_500);
        doc.text(`BeamLab \u2014 ${docRef}`, 14, 8);
        doc.text(`Rev 00  |  ${dateStr}`, pageWidth - 14, 8, { align: 'right' });
        doc.setDrawColor(...NAVY);
        doc.setLineWidth(0.5);
        doc.line(14, 10, pageWidth - 14, 10);
    };

    addRunningHeader();

    // Section heading helper
    const addSectionHeading = (num: string, title: string, y: number) => {
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...NAVY);
        doc.text(`${num}  ${title}`, 14, y);
        doc.setDrawColor(...SLATE_200);
        doc.setLineWidth(0.5);
        doc.line(14, y + 2, pageWidth - 14, y + 2);
    };

    addSectionHeading('1.0', 'Model Summary', 20);

    const supportCount = nodes.filter((n: Node) => n.restraints && Object.values(n.restraints).some(Boolean)).length;

    const summaryData = [
        ['Total Nodes', String(nodes.length)],
        ['Total Members', String(members.length)],
        ['Support Nodes', String(supportCount)],
        ['Free Nodes', String(nodes.length - supportCount)],
        ['Analysis Status', analysisResults ? 'Completed' : 'Pending'],
        ['Design Check Status', designResults.size > 0 ? `Completed (${designResults.size} members)` : 'Not Run']
    ];

    autoTable(doc, {
        startY: 27,
        margin: { left: 14, right: 14 },
        head: [['Item', 'Value']],
        body: summaryData,
        theme: 'plain',
        headStyles: {
            fillColor: SLATE_50,
            textColor: SLATE_700,
            fontStyle: 'bold',
            fontSize: 9,
            lineColor: SLATE_200,
            lineWidth: 0.3,
        },
        bodyStyles: { fontSize: 9, textColor: SLATE_700 },
        alternateRowStyles: { fillColor: SLATE_50 },
        tableLineColor: SLATE_200,
        tableLineWidth: 0.3,
        styles: { cellPadding: 4, lineColor: SLATE_200, lineWidth: 0.3 },
    });

    // ============================================
    // ANALYSIS RESULTS (FORCES)
    // ============================================
    if (analysisResults) {
        let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

        // Key results summary
        let maxAxial = 0, maxMoment = 0, maxShear = 0, maxDisp = 0;
        analysisResults.memberForces.forEach((f) => {
            maxAxial = Math.max(maxAxial, Math.abs(f.axial ?? 0));
            maxMoment = Math.max(maxMoment, Math.abs(f.momentY ?? 0), Math.abs(f.momentZ ?? 0));
            maxShear = Math.max(maxShear, Math.abs(f.shearY ?? 0), Math.abs(f.shearZ ?? 0));
        });
        analysisResults.displacements?.forEach((d: { dx: number; dy: number; dz: number }) => {
            maxDisp = Math.max(maxDisp, Math.abs(d.dx ?? 0), Math.abs(d.dy ?? 0), Math.abs(d.dz ?? 0));
        });

        addSectionHeading('2.0', 'Analysis Results \u2014 Summary', finalY);

        autoTable(doc, {
            startY: finalY + 7,
            margin: { left: 14, right: 14 },
            head: [['Peak Result', 'Value', 'Unit']],
            body: [
                ['Maximum Axial Force', formatNumber(maxAxial), 'kN'],
                ['Maximum Bending Moment', formatNumber(maxMoment), 'kN\u00b7m'],
                ['Maximum Shear Force', formatNumber(maxShear), 'kN'],
                ['Maximum Displacement', formatNumber(maxDisp, 4), 'mm'],
            ],
            theme: 'plain',
            headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { fontSize: 9, textColor: SLATE_700 },
            alternateRowStyles: { fillColor: SLATE_50 },
            styles: { cellPadding: 4, lineColor: SLATE_200, lineWidth: 0.3 },
        });

        finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
        if (finalY > 240) { doc.addPage(); addRunningHeader(); finalY = 20; }

        addSectionHeading('3.0', 'Internal Member Forces', finalY);

        const forcesBody = Array.from(analysisResults.memberForces.entries()).map(([id, f]) => [
            id,
            formatNumber(f.axial),
            formatNumber(f.shearY),
            formatNumber(f.shearZ),
            formatNumber(f.momentY),
            formatNumber(f.momentZ)
        ]);

        autoTable(doc, {
            startY: finalY + 7,
            margin: { left: 14, right: 14 },
            head: [['Member', 'N (kN)', 'Vy (kN)', 'Vz (kN)', 'My (kN\u00b7m)', 'Mz (kN\u00b7m)']],
            body: forcesBody,
            theme: 'plain',
            headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8, textColor: SLATE_700, font: 'courier' },
            alternateRowStyles: { fillColor: SLATE_50 },
            styles: { cellPadding: 3, lineColor: SLATE_200, lineWidth: 0.3, halign: 'right' },
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold', font: 'courier' } },
        });
    }

    // ============================================
    // DESIGN CHECKS
    // ============================================
    if (designResults.size > 0) {
        let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
        if (finalY > 240) { doc.addPage(); addRunningHeader(); finalY = 20; }

        addSectionHeading('4.0', 'Steel Design Verification', finalY);

        const designBody = Array.from(designResults.values()).map(r => [
            r.memberId,
            r.section.name,
            formatNumber(r.criticalRatio, 3),
            r.overallStatus,
            r.governingCheck
        ]);

        autoTable(doc, {
            startY: finalY + 7,
            margin: { left: 14, right: 14 },
            head: [['Member', 'Section', 'D/C Ratio', 'Status', 'Governing Check']],
            body: designBody,
            theme: 'plain',
            headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8, textColor: SLATE_700 },
            alternateRowStyles: { fillColor: SLATE_50 },
            styles: { cellPadding: 3, lineColor: SLATE_200, lineWidth: 0.3 },
            columnStyles: { 2: { halign: 'right', font: 'courier' }, 3: { fontStyle: 'bold' } },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 3) {
                    const status = data.cell.raw;
                    if (status === 'FAIL') data.cell.styles.textColor = RED;
                    else if (status === 'WARNING') data.cell.styles.textColor = AMBER;
                    else data.cell.styles.textColor = GREEN;
                }
                // Color D/C ratio based on value
                if (data.section === 'body' && data.column.index === 2) {
                    const ratio = parseFloat(String(data.cell.raw));
                    if (ratio > 1.0) data.cell.styles.textColor = RED;
                    else if (ratio > 0.85) data.cell.styles.textColor = AMBER;
                    else data.cell.styles.textColor = GREEN;
                }
            }
        });
    }

    // ============================================
    // PROFESSIONAL FOOTER ON ALL PAGES
    // ============================================
    const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        // Bottom accent line
        doc.setDrawColor(...NAVY);
        doc.setLineWidth(0.5);
        doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
        // Footer text
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...SLATE_500);
        doc.text(`BeamLab  \u2014  ${docRef}  Rev 00`, 14, pageHeight - 11);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 11, { align: 'center' });
        doc.text('beamlab.app', pageWidth - 14, pageHeight - 11, { align: 'right' });
        doc.setFontSize(6);
        doc.setTextColor(180, 180, 180);
        doc.text('CONFIDENTIAL \u2014 Computer-generated document. Results should be independently verified.', pageWidth / 2, pageHeight - 7, { align: 'center' });
    }

    // Save
    doc.save(`BeamLab_Report_${project.name.replace(/\s+/g, '_')}.pdf`);
};

export const generateCivilReport = async (
    title: string,
    inputs: Record<string, string | number>,
    results: Record<string, string | number>,
    sections: Array<{ title: string; data: Array<[string, string | number]> }> = []
) => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // Professional theme colors
    const NAVY: [number, number, number] = [18, 55, 106];
    const GOLD: [number, number, number] = [191, 155, 48];
    const SLATE_700: [number, number, number] = [51, 65, 85];
    const SLATE_500: [number, number, number] = [100, 116, 139];
    const SLATE_200: [number, number, number] = [226, 232, 240];
    const SLATE_50: [number, number, number] = [248, 250, 252];

    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // ============================================
    // COVER PAGE  
    // ============================================
    // Top accent bars
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageWidth, 6, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(0, 6, pageWidth, 3, 'F');

    // Company branding
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text('BeamLab', 20, 30);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_500);
    doc.text('CIVIL ENGINEERING DESIGN', 20, 36);

    doc.setFontSize(8);
    doc.text('beamlab.app', pageWidth - 20, 26, { align: 'right' });
    doc.text('support@beamlab.app', pageWidth - 20, 31, { align: 'right' });

    // Centre title
    const centerY = pageHeight / 2 - 15;
    doc.setDrawColor(...SLATE_200);
    doc.line(pageWidth / 2 - 30, centerY - 25, pageWidth / 2 + 30, centerY - 25);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE_500);
    doc.text('CIVIL ENGINEERING DESIGN REPORT', pageWidth / 2, centerY - 15, { align: 'center' });

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NAVY);
    doc.text(title, pageWidth / 2, centerY + 2, { align: 'center', maxWidth: pageWidth - 60 });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_500);
    doc.text(dateStr, pageWidth / 2, centerY + 16, { align: 'center' });

    doc.setDrawColor(...SLATE_200);
    doc.line(pageWidth / 2 - 30, centerY + 25, pageWidth / 2 + 30, centerY + 25);

    // Bottom accent bar
    doc.setFillColor(...NAVY);
    doc.rect(0, pageHeight - 6, pageWidth, 6, 'F');

    // ============================================
    // PAGE 2+: CONTENT
    // ============================================
    doc.addPage();

    // Running header
    const addHeader = () => {
        doc.setFillColor(...NAVY);
        doc.rect(0, 0, pageWidth, 1.5, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...SLATE_500);
        doc.text(`BeamLab  \u2014  ${title}`, 14, 8);
        doc.text(dateStr, pageWidth - 14, 8, { align: 'right' });
        doc.setDrawColor(...NAVY);
        doc.setLineWidth(0.5);
        doc.line(14, 10, pageWidth - 14, 10);
    };

    const addHeading = (num: string, heading: string, y: number) => {
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...NAVY);
        doc.text(`${num}  ${heading}`, 14, y);
        doc.setDrawColor(...SLATE_200);
        doc.setLineWidth(0.5);
        doc.line(14, y + 2, pageWidth - 14, y + 2);
    };

    addHeader();

    let finalY = 20;

    // Inputs Section
    addHeading('1.0', 'Design Inputs', finalY);

    const inputsBody = Object.entries(inputs).map(([key, val]) => [key, String(val)]);
    autoTable(doc, {
        startY: finalY + 7,
        margin: { left: 14, right: 14 },
        head: [['Parameter', 'Value']],
        body: inputsBody,
        theme: 'plain',
        headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: SLATE_700 },
        alternateRowStyles: { fillColor: SLATE_50 },
        styles: { cellPadding: 4, lineColor: SLATE_200, lineWidth: 0.3 },
    });

    finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
    if (finalY > 240) { doc.addPage(); addHeader(); finalY = 20; }

    // Results Section
    addHeading('2.0', 'Calculation Results', finalY);

    const resultsBody = Object.entries(results).map(([key, val]) => [key, String(val)]);
    autoTable(doc, {
        startY: finalY + 7,
        margin: { left: 14, right: 14 },
        head: [['Result Item', 'Value']],
        body: resultsBody,
        theme: 'plain',
        headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: SLATE_700, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: SLATE_50 },
        styles: { cellPadding: 4, lineColor: SLATE_200, lineWidth: 0.3 },
    });

    finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

    // Additional Sections
    sections.forEach((section, idx) => {
        if (finalY > 240) { doc.addPage(); addHeader(); finalY = 20; }

        addHeading(`${3 + idx}.0`, section.title, finalY);

        autoTable(doc, {
            startY: finalY + 7,
            margin: { left: 14, right: 14 },
            head: [['Item', 'Details']],
            body: section.data.map(([k, v]) => [k, String(v)]),
            theme: 'plain',
            headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { fontSize: 9, textColor: SLATE_700 },
            alternateRowStyles: { fillColor: SLATE_50 },
            styles: { cellPadding: 4, lineColor: SLATE_200, lineWidth: 0.3 },
        });

        finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
    });

    // Professional footer on all pages
    const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(...NAVY);
        doc.setLineWidth(0.5);
        doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...SLATE_500);
        doc.text('BeamLab  \u2014  Civil Engineering Design', 14, pageHeight - 11);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 11, { align: 'center' });
        doc.text('beamlab.app', pageWidth - 14, pageHeight - 11, { align: 'right' });
        doc.setFontSize(6);
        doc.setTextColor(180, 180, 180);
        doc.text('CONFIDENTIAL \u2014 Computer-generated document. Results should be independently verified.', pageWidth / 2, pageHeight - 7, { align: 'center' });
    }

    doc.save(`${title.replace(/\s+/g, '_')}_Report.pdf`);
};

// Alias for backward compatibility
export const generateDesignReport = generateBasicPDFReport;
