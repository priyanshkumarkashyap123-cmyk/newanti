
import { AnalysisResults, Node, Member, NodeLoad, MemberLoad } from '../store/model';
import { SteelDesignResults } from './SteelDesignService';
import { API_CONFIG } from '../config/env';

import { BEAMLAB_COMPANY, BEAMLAB_COLORS_RGB } from '../constants/BrandingConstants';

interface ProjectInfo {
    name: string;
    engineer: string;
    date: string;
    description: string;
    licenseNumber?: string;
}

// Re-export so callers can type project info without a separate import
export type { ProjectInfo };

// Centralized branding — these override any locally hardcoded strings
const _CO_NAME      = BEAMLAB_COMPANY.name;
const _CO_WEBSITE   = BEAMLAB_COMPANY.website;
const _CO_EMAIL     = BEAMLAB_COMPANY.email;
const _CO_DISCLAIMER = BEAMLAB_COMPANY.disclaimer;
// Silence lint warnings on unused aliases until full adoption
void _CO_NAME; void _CO_WEBSITE; void _CO_EMAIL; void _CO_DISCLAIMER;

// ============================================
// GOVERNING CHECK LABELS & CLAUSE REFERENCES
// ============================================

export const GOVERNING_CHECK_LABELS: Record<string, string> = {
    COMPRESSION_FLEXURE_COMBINED: 'Combined Compression + Flexure (AISC H1-1)',
    TENSION_FLEXURE_COMBINED: 'Combined Tension + Flexure (AISC H1-2)',
    SHEAR_CHECK: 'Shear Capacity Check',
    AXIAL_COMPRESSION: 'Axial Compression (Column Buckling)',
    AXIAL_TENSION: 'Axial Tension (Gross/Net Section)',
    FLEXURE_MAJOR: 'Flexure — Major Axis Bending',
    FLEXURE_MINOR: 'Flexure — Minor Axis Bending',
    LATERAL_TORSIONAL_BUCKLING: 'Lateral-Torsional Buckling',
    LOCAL_FLANGE_BUCKLING: 'Local Flange Buckling',
    LOCAL_WEB_BUCKLING: 'Local Web Buckling',
    DEFLECTION_CHECK: 'Deflection Serviceability Check',
    // IS 800:2007 equivalents
    IS800_COMPRESSION_FLEXURE: 'Combined Compression + Flexure (IS 800 §9.3.1)',
    IS800_TENSION_FLEXURE: 'Combined Tension + Flexure (IS 800 §9.3.2)',
    IS800_SHEAR: 'Shear Capacity (IS 800 §8.4)',
    IS800_FLEXURE: 'Flexure Capacity (IS 800 §8.2)',
    IS800_LTB: 'Lateral-Torsional Buckling (IS 800 §8.2.2)',
};

export const CHECK_CLAUSE_REFS: Record<string, string> = {
    COMPRESSION_FLEXURE_COMBINED: 'AISC 360-16 §H1-1',
    TENSION_FLEXURE_COMBINED: 'AISC 360-16 §H1-2',
    SHEAR_CHECK: 'AISC 360-16 §G2',
    AXIAL_COMPRESSION: 'AISC 360-16 §E3',
    AXIAL_TENSION: 'AISC 360-16 §D2',
    FLEXURE_MAJOR: 'AISC 360-16 §F2',
    FLEXURE_MINOR: 'AISC 360-16 §F6',
    LATERAL_TORSIONAL_BUCKLING: 'AISC 360-16 §F2-2',
    LOCAL_FLANGE_BUCKLING: 'AISC 360-16 §F3',
    LOCAL_WEB_BUCKLING: 'AISC 360-16 §F4',
    DEFLECTION_CHECK: 'AISC 360-16 §L3',
    IS800_COMPRESSION_FLEXURE: 'IS 800:2007 §9.3.1',
    IS800_TENSION_FLEXURE: 'IS 800:2007 §9.3.2',
    IS800_SHEAR: 'IS 800:2007 §8.4',
    IS800_FLEXURE: 'IS 800:2007 §8.2',
    IS800_LTB: 'IS 800:2007 §8.2.2',
};

const sanitizeDisplayText = (value: string | undefined | null, fallback: string): string => {
    const withoutControlChars = Array.from(value ?? '')
        .map((ch) => {
            const code = ch.charCodeAt(0);
            return (code >= 0x00 && code <= 0x1f) || code === 0x7f ? ' ' : ch;
        })
        .join('');

    const cleaned = withoutControlChars
        .replace(/\s+/g, ' ')
        .trim();

    // If input is empty or only punctuation/symbols (e.g. ",&"), use fallback.
    if (!cleaned || !/[A-Za-z0-9]/.test(cleaned)) return fallback;
    return cleaned;
};

const sanitizeFileComponent = (value: string, fallback: string): string => {
    const slug = value
        .replace(/[^A-Za-z0-9._-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    return slug || fallback;
};

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

            const forcesDict: Record<string, {
                momentY_start: number; momentY_end: number;
                momentZ_start: number; momentZ_end: number;
                shear: number[]; axial: number
            }> = {};
            analysisResults.memberForces.forEach((forces: { momentY?: number; momentYEnd?: number; momentZ?: number; momentZEnd?: number; shearY?: number; shearZ?: number; axial: number }, memberId: string) => {
                maxMoment = Math.max(maxMoment, Math.abs(forces.momentY || 0), Math.abs(forces.momentZ || 0));
                maxShear = Math.max(maxShear, Math.abs(forces.shearY || 0), Math.abs(forces.shearZ || 0));
                maxAxial = Math.max(maxAxial, Math.abs(forces.axial || 0));
                // Preserve actual end forces from analysis
                // Note: For members with loads, start and end moments differ.
                // The analysis solver provides correct values at both ends.
                forcesDict[memberId] = {
                    momentY_start: forces.momentY || 0,
                    momentY_end: forces.momentYEnd ?? -(forces.momentY || 0),
                    momentZ_start: forces.momentZ || 0,
                    momentZ_end: forces.momentZEnd ?? -(forces.momentZ || 0),
                    shear: [forces.shearY || 0, forces.shearZ || 0],
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
                company_name: BEAMLAB_COMPANY.name,
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

        // Call API (route through Node gateway for auth + orchestration)
        const response = await fetch(`${API_CONFIG.baseUrl}/report/generate`, {
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
    designResults: Map<string, SteelDesignResults>,
    options: { rcDesignResults?: any[] } = {}
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

    const safeProjectName = sanitizeDisplayText(project.name, 'BeamLab Project');
    const safeEngineerName = sanitizeDisplayText(project.engineer, 'Engineer');
    const safeProjectFile = sanitizeFileComponent(safeProjectName, 'BeamLab_Project');

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
    doc.text(BEAMLAB_COMPANY.name, 20, 30);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_500);
    doc.text('STRUCTURAL ENGINEERING', 20, 36);

    // Right side branding
    doc.setFontSize(8);
    doc.setTextColor(...SLATE_500);
    doc.text(BEAMLAB_COMPANY.website, pageWidth - 20, 26, { align: 'right' });
    doc.text(BEAMLAB_COMPANY.email, pageWidth - 20, 31, { align: 'right' });

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
    doc.text(safeProjectName, pageWidth / 2, centerY + 2, { align: 'center', maxWidth: pageWidth - 60 });

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
            ['Project', safeProjectName, 'Document No.', docRef],
            ['Prepared by', safeEngineerName, 'Date', dateStr],
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

    // PE Stamp block — after document control table
    autoTable(doc, {
        startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4,
        margin: { left: 20, right: 20 },
        head: [['Engineer of Record', 'License No.', 'Date', 'Signature']],
        body: [[
            safeEngineerName || '_______________',
            project.licenseNumber ?? '_______________',
            dateStr,
            '_______________',
        ]],
        theme: 'plain',
        headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 9, textColor: SLATE_700, cellPadding: 5 },
        tableLineColor: SLATE_200,
        tableLineWidth: 0.3,
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
        doc.text(`${BEAMLAB_COMPANY.name} \u2014 ${docRef}`, 14, 8);
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
            // Convert from meters to mm (* 1000) — Bug Condition C2 fix
            maxDisp = Math.max(maxDisp, Math.abs(d.dx ?? 0) * 1000, Math.abs(d.dy ?? 0) * 1000, Math.abs(d.dz ?? 0) * 1000);
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

        // ============================================
        // LOAD CASES SECTION
        // ============================================
        finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
        if (finalY > 240) { doc.addPage(); addRunningHeader(); finalY = 20; }
        addSectionHeading('3.1', 'Load Cases', finalY);

        const loadCasesBody = (analysisResults as any).loadCases && (analysisResults as any).loadCases.length > 0
            ? (analysisResults as any).loadCases.map((lc: { id: string; name: string; type?: string }) => [lc.id, lc.name, lc.type ?? 'Static'])
            : [['—', 'No load cases defined', '—']];

        autoTable(doc, {
            startY: finalY + 7,
            margin: { left: 14, right: 14 },
            head: [['ID', 'Name', 'Type']],
            body: loadCasesBody,
            theme: 'plain',
            headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8, textColor: SLATE_700 },
            alternateRowStyles: { fillColor: SLATE_50 },
            styles: { cellPadding: 3, lineColor: SLATE_200, lineWidth: 0.3 },
        });

        // ============================================
        // SUPPORT REACTIONS SECTION
        // ============================================
        finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
        if (finalY > 240) { doc.addPage(); addRunningHeader(); finalY = 20; }
        addSectionHeading('3.2', 'Support Reactions', finalY);

        const reactionsBody = analysisResults.reactions && analysisResults.reactions.size > 0
            ? Array.from(analysisResults.reactions.entries()).map(([nodeId, r]: [string, { fx?: number; fy?: number; fz?: number; mx?: number; my?: number; mz?: number }]) => [
                nodeId,
                formatNumber(r.fx ?? 0),
                formatNumber(r.fy ?? 0),
                formatNumber(r.fz ?? 0),
                formatNumber(r.mx ?? 0),
                formatNumber(r.my ?? 0),
                formatNumber(r.mz ?? 0),
            ])
            : [['—', '—', '—', '—', '—', '—', '—']];

        autoTable(doc, {
            startY: finalY + 7,
            margin: { left: 14, right: 14 },
            head: [['Node', 'Fx (kN)', 'Fy (kN)', 'Fz (kN)', 'Mx (kN\u00b7m)', 'My (kN\u00b7m)', 'Mz (kN\u00b7m)']],
            body: reactionsBody,
            theme: 'plain',
            headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8, textColor: SLATE_700, font: 'courier' },
            alternateRowStyles: { fillColor: SLATE_50 },
            styles: { cellPadding: 3, lineColor: SLATE_200, lineWidth: 0.3, halign: 'right' },
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold', font: 'courier' } },
        });

        // ============================================
        // NODE DISPLACEMENT TABLE
        // ============================================
        finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
        if (finalY > 240) { doc.addPage(); addRunningHeader(); finalY = 20; }
        addSectionHeading('3.3', 'Nodal Displacements', finalY);

        const dispBody = analysisResults.displacements && analysisResults.displacements.size > 0
            ? Array.from(analysisResults.displacements.entries()).map(([nodeId, d]: [string, { dx?: number; dy?: number; dz?: number; rx?: number; ry?: number; rz?: number }]) => [
                nodeId,
                formatNumber((d.dx ?? 0) * 1000, 4),
                formatNumber((d.dy ?? 0) * 1000, 4),
                formatNumber((d.dz ?? 0) * 1000, 4),
                formatNumber((d.rx ?? 0) * 1000, 6),
                formatNumber((d.ry ?? 0) * 1000, 6),
                formatNumber((d.rz ?? 0) * 1000, 6),
            ])
            : [['—', '—', '—', '—', '—', '—', '—']];

        autoTable(doc, {
            startY: finalY + 7,
            margin: { left: 14, right: 14 },
            head: [['Node', 'dx (mm)', 'dy (mm)', 'dz (mm)', 'rx (mrad)', 'ry (mrad)', 'rz (mrad)']],
            body: dispBody,
            theme: 'plain',
            headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8, textColor: SLATE_700, font: 'courier' },
            alternateRowStyles: { fillColor: SLATE_50 },
            styles: { cellPadding: 3, lineColor: SLATE_200, lineWidth: 0.3, halign: 'right' },
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold', font: 'courier' } },
        });
    }

    // ============================================
    // NODE COORDINATE TABLE
    // ============================================
    {
        let finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
        if (finalY > 240) { doc.addPage(); addRunningHeader(); finalY = 20; }
        addSectionHeading('3.4', 'Node Coordinates', finalY);

        const getSupportCondition = (n: Node): string => {
            if (!n.restraints) return 'Free';
            const r = n.restraints as any;
            const dofs = [r.dx, r.dy, r.dz, r.rx, r.ry, r.rz];
            const fixedCount = dofs.filter(Boolean).length;
            if (fixedCount === 6) return 'Fixed';
            if (fixedCount === 3 && r.dx && r.dy && r.dz) return 'Pinned';
            if (fixedCount === 1 && r.dy) return 'Roller';
            if (fixedCount > 0) return 'Partial';
            return 'Free';
        };

        const nodeBody = nodes.map((n: Node) => [
            n.id,
            formatNumber(n.x ?? 0, 3),
            formatNumber(n.y ?? 0, 3),
            formatNumber(n.z ?? 0, 3),
            getSupportCondition(n),
        ]);

        autoTable(doc, {
            startY: finalY + 7,
            margin: { left: 14, right: 14 },
            head: [['Node ID', 'X (m)', 'Y (m)', 'Z (m)', 'Support']],
            body: nodeBody,
            theme: 'plain',
            headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8, textColor: SLATE_700, font: 'courier' },
            alternateRowStyles: { fillColor: SLATE_50 },
            styles: { cellPadding: 3, lineColor: SLATE_200, lineWidth: 0.3, halign: 'right' },
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold', font: 'courier' }, 4: { halign: 'left' } },
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
            GOVERNING_CHECK_LABELS[r.governingCheck] ?? r.governingCheck,
            CHECK_CLAUSE_REFS[r.governingCheck] ?? '—',
        ]);

        autoTable(doc, {
            startY: finalY + 7,
            margin: { left: 14, right: 14 },
            head: [['Member', 'Section', 'D/C Ratio', 'Status', 'Governing Check', 'Clause']],
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
    // 7. RC DESIGN RESULTS SECTION (IS 456)
    // ============================================
    const rcDesignResults = options.rcDesignResults;
    if (rcDesignResults && rcDesignResults.length > 0) {
        doc.addPage();
        let rcY = 20;
        // Section header
        doc.setFillColor(...NAVY);
        doc.rect(14, rcY, pageWidth - 28, 8, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('7. RC DESIGN RESULTS — IS 456:2000', 17, rcY + 6);
        rcY += 12;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...SLATE_700);
        doc.text('Reinforced concrete design checks per IS 456:2000 limit state method.', 14, rcY);
        rcY += 5;

        // RC design table
        const rcBody = rcDesignResults.map((r: any) => [
            r.memberId || '-',
            `${r.b || 0}×${r.D || 0}`,
            r.checkType || 'Flexure',
            typeof r.Ast_required === 'number' ? r.Ast_required.toFixed(0) : '-',
            typeof r.Ast_provided === 'number' ? r.Ast_provided.toFixed(0) : '-',
            typeof r.ratio === 'number' ? r.ratio.toFixed(3) : '-',
            r.status || '-',
            r.code || 'IS 456',
        ]);

        autoTable(doc, {
            startY: rcY + 2,
            margin: { left: 14, right: 14 },
            head: [['Member', 'Section (mm)', 'Check', 'Ast Reqd (mm²)', 'Ast Prov (mm²)', 'Ratio', 'Status', 'Code Ref']],
            body: rcBody,
            theme: 'plain',
            headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
            bodyStyles: { fontSize: 7, textColor: SLATE_700 },
            alternateRowStyles: { fillColor: SLATE_50 },
            styles: { cellPadding: 2.5, lineColor: SLATE_200, lineWidth: 0.3 },
            columnStyles: { 5: { halign: 'right', font: 'courier' }, 6: { fontStyle: 'bold' } },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 6) {
                    const status = data.cell.raw;
                    if (status === 'FAIL') data.cell.styles.textColor = RED;
                    else if (status === 'WARNING') data.cell.styles.textColor = AMBER;
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
        doc.text(`${BEAMLAB_COMPANY.name}  \u2014  ${docRef}  Rev 00`, 14, pageHeight - 11);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 11, { align: 'center' });
        doc.text(BEAMLAB_COMPANY.website, pageWidth - 14, pageHeight - 11, { align: 'right' });
        doc.setFontSize(6);
        doc.setTextColor(180, 180, 180);
        doc.text('CONFIDENTIAL \u2014 Computer-generated document. Results should be independently verified.', pageWidth / 2, pageHeight - 7, { align: 'center' });
    }

    // Save
    doc.save(`BeamLab_Report_${safeProjectFile}.pdf`);
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
    doc.text(BEAMLAB_COMPANY.name, 20, 30);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_500);
    doc.text('CIVIL ENGINEERING DESIGN', 20, 36);

    doc.setFontSize(8);
    doc.text(BEAMLAB_COMPANY.website, pageWidth - 20, 26, { align: 'right' });
    doc.text(BEAMLAB_COMPANY.email, pageWidth - 20, 31, { align: 'right' });

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
        doc.text(`${BEAMLAB_COMPANY.name}  \u2014  Civil Engineering Design`, 14, pageHeight - 11);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 11, { align: 'center' });
        doc.text(BEAMLAB_COMPANY.website, pageWidth - 14, pageHeight - 11, { align: 'right' });
        doc.setFontSize(6);
        doc.setTextColor(180, 180, 180);
        doc.text('CONFIDENTIAL \u2014 Computer-generated document. Results should be independently verified.', pageWidth / 2, pageHeight - 7, { align: 'center' });
    }

    const safeTitle = sanitizeDisplayText(title, 'Civil_Engineering');
    const safeTitleFile = sanitizeFileComponent(safeTitle, 'Civil_Engineering');
    doc.save(`${safeTitleFile}_Report.pdf`);
};

// Alias for backward compatibility
export const generateDesignReport = generateBasicPDFReport;
