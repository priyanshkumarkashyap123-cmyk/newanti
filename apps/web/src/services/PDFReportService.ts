
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AnalysisResults } from '../store/model';
import { SteelDesignResults } from './SteelDesignService';

interface ProjectInfo {
    name: string;
    engineer: string;
    date: string;
    description: string;
}

const PYTHON_API_URL = import.meta.env.VITE_PYTHON_API_URL || 'https://beamlab-backend-python.azurewebsites.net';

export const generateProfessionalReport = async (
    project: ProjectInfo,
    members: any[],
    nodes: any[],
    analysisResults: AnalysisResults | null,
    designResults: Map<string, SteelDesignResults>
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
            section: m.section || 'Default',
            material: 'Steel'
        }));

        // Format results
        let resultsData: any = { success: false };
        if (analysisResults) {
            let maxDisp = 0;
            let maxMoment = 0;
            let maxShear = 0;
            let maxAxial = 0;

            const dispDict: Record<string, any> = {};
            analysisResults.displacements.forEach((disp: any, nodeId: string) => {
                const total = Math.sqrt(disp.dx ** 2 + disp.dy ** 2 + disp.dz ** 2);
                maxDisp = Math.max(maxDisp, total * 1000); // Convert to mm
                dispDict[nodeId] = { dx: disp.dx, dy: disp.dy, dz: disp.dz };
            });

            const forcesDict: Record<string, any> = {};
            analysisResults.memberForces.forEach((forces: any, memberId: string) => {
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
                company_name: "BeamLab Ultimate",
                include_diagrams: true
            },
            analysis_data: {
                input: {
                    nodes: inputNodes,
                    members: inputMembers,
                    loads: [] // Add loads if available
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
        alert('Failed to generate professional report. Falling back to basic report.');
        // Fallback or just re-throw
        throw error;
    }
};

/**
 * Legacy PDF report generator using jsPDF directly (fallback)
 */
export const generateBasicPDFReport = (
    project: ProjectInfo,
    members: any[],
    nodes: any[],
    analysisResults: AnalysisResults | null,
    designResults: Map<string, SteelDesignResults>
) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Helper for formatting
    const formatNumber = (n: number) => n.toFixed(2);

    // ============================================
    // HEADER
    // ============================================
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text("BeamLab Ultimate", 14, 20);

    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text("Structural Analysis & Design Report", 14, 28);

    // Project Details
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Project: ${project.name}`, 14, 40);
    doc.text(`Engineer: ${project.engineer}`, 14, 45);
    doc.text(`Date: ${project.date}`, 14, 50);
    doc.line(14, 55, pageWidth - 14, 55);

    // ============================================
    // MODEL SUMMARY
    // ============================================
    doc.setFontSize(14);
    doc.text("1. Model Summary", 14, 65);

    const summaryData = [
        ['Nodes', nodes.length],
        ['Members', members.length],
        ['Analysis Status', analysisResults ? 'Completed' : 'Not Run'],
        ['Design Check Status', designResults.size > 0 ? 'Completed' : 'Not Run']
    ];

    autoTable(doc, {
        startY: 70,
        head: [['Item', 'Count/Status']],
        body: summaryData,
        theme: 'striped',
        headStyles: { fillColor: [63, 81, 181] },
        styles: { fontSize: 10 }
    });

    // ============================================
    // ANALYSIS RESULTS (FORCES)
    // ============================================
    if (analysisResults) {
        const finalY = (doc as any).lastAutoTable.finalY + 15;
        doc.setFontSize(14);
        doc.text("2. Analysis Results (Member Forces)", 14, finalY);

        const forcesBody = Array.from(analysisResults.memberForces.entries()).map(([id, f]) => [
            `M${id}`,
            formatNumber(f.axial),
            formatNumber(f.shearY),
            formatNumber(f.shearZ),
            formatNumber(f.momentY),
            formatNumber(f.momentZ)
        ]);

        autoTable(doc, {
            startY: finalY + 5,
            head: [['Member', 'N (kN)', 'Vy (kN)', 'Vz (kN)', 'My (kN\u00b7m)', 'Mz (kN\u00b7m)']],
            body: forcesBody,
            theme: 'grid',
            headStyles: { fillColor: [63, 81, 181] },
            styles: { fontSize: 9 }
        });
    }

    // ============================================
    // DESIGN CHECKS
    // ============================================
    if (designResults.size > 0) {
        let finalY = (doc as any).lastAutoTable.finalY + 15;

        // New page if needed
        if (finalY > 250) {
            doc.addPage();
            finalY = 20;
        }

        doc.setFontSize(14);
        doc.text("3. Steel Design Checks (AISC 360-16)", 14, finalY);

        const designBody = Array.from(designResults.values()).map(r => [
            `M${r.memberId}`,
            r.section.name,
            (r.criticalRatio * 100).toFixed(1) + '%',
            r.overallStatus,
            r.governingCheck
        ]);

        autoTable(doc, {
            startY: finalY + 5,
            head: [['Member', 'Section', 'Ratio', 'Status', 'Critical Check']],
            body: designBody,
            theme: 'grid',
            headStyles: { fillColor: [0, 150, 136] }, // Teal info
            columnStyles: {
                3: { fontStyle: 'bold' }
            },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 3) {
                    const status = data.cell.raw;
                    if (status === 'FAIL') data.cell.styles.textColor = [220, 50, 50];
                    else if (status === 'WARNING') data.cell.styles.textColor = [220, 180, 50];
                    else data.cell.styles.textColor = [50, 180, 50];
                }
            }
        });
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount} - Generated by BeamLab Ultimate`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    // Save
    doc.save(`BeamLab_Report_${project.name.replace(/\s+/g, '_')}.pdf`);
};

export const generateCivilReport = (
    title: string,
    inputs: Record<string, string | number>,
    results: Record<string, string | number>,
    sections: Array<{ title: string; data: Array<[string, string | number]> }> = []
) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text("BeamLab Ultimate", 14, 20);

    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text("Civil Engineering Design Report", 14, 28);

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(title, 14, 45);

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 52);
    doc.line(14, 55, pageWidth - 14, 55);

    let finalY = 65;

    // Inputs Section
    doc.setFontSize(14);
    doc.text("1. Design Inputs", 14, finalY);

    const inputsBody = Object.entries(inputs).map(([key, val]) => [key, val]);
    autoTable(doc, {
        startY: finalY + 5,
        head: [['Parameter', 'Value']],
        body: inputsBody,
        theme: 'striped',
        headStyles: { fillColor: [63, 81, 181] },
        styles: { fontSize: 10 }
    });

    finalY = (doc as any).lastAutoTable.finalY + 15;

    // Results Section
    doc.setFontSize(14);
    doc.text("2. Calculation Results", 14, finalY);

    const resultsBody = Object.entries(results).map(([key, val]) => [key, val]);
    autoTable(doc, {
        startY: finalY + 5,
        head: [['Result Item', 'Value']],
        body: resultsBody,
        theme: 'grid',
        headStyles: { fillColor: [0, 150, 136] }, // Teal
        styles: { fontSize: 10, fontStyle: 'bold' }
    });

    finalY = (doc as any).lastAutoTable.finalY + 15;

    // Additional Sections (e.g., layers, schedules)
    sections.forEach((section, idx) => {
        if (finalY > 250) {
            doc.addPage();
            finalY = 20;
        }

        doc.setFontSize(14);
        doc.text(`${3 + idx}. ${section.title}`, 14, finalY);

        autoTable(doc, {
            startY: finalY + 5,
            head: [['Item', 'Details']],
            body: section.data,
            theme: 'grid',
            headStyles: { fillColor: [100, 100, 100] },
            styles: { fontSize: 9 }
        });

        finalY = (doc as any).lastAutoTable.finalY + 15;
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount} - Generated by BeamLab Ultimate`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    doc.save(`${title.replace(/\s+/g, '_')}_Report.pdf`);
};

// Alias for backward compatibility
export const generateDesignReport = generateBasicPDFReport;
