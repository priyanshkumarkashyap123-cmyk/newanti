/**
 * ReportGenerator - Professional PDF Report Generator for BeamLab Ultimate
 * Generates analysis reports with project info, 3D snapshots, and results tables
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

// ============================================
// TYPES
// ============================================

export interface ProjectData {
    projectName: string;
    clientName?: string;
    engineerName?: string;
    projectNumber?: string;
    description?: string;
}

export interface NodeDisplacementRow {
    nodeId: string;
    dx: number;
    dy: number;
    dz: number;
    rx?: number;
    ry?: number;
    rz?: number;
}

export interface MemberForceRow {
    memberId: string;
    axial: number;
    shearY: number;
    shearZ?: number;
    momentY?: number;
    momentZ: number;
    torsion?: number;
}

export interface ReactionRow {
    nodeId: string;
    fx: number;
    fy: number;
    fz?: number;
    mx?: number;
    my?: number;
    mz?: number;
}

export interface DesignResult {
    memberId: string;
    section: string;
    criticalRatio: number;
    status: 'PASS' | 'FAIL';
    clause: string;
    designCode: 'IS 800:2007' | 'AISC 360-16' | 'IS 456:2000' | 'ACI 318-19';
    checkType: string; // e.g., 'Tension', 'Compression', 'Flexure', 'Combined'
    failureReason?: string; // Explanation if failed
}

// ============================================
// REPORT GENERATOR CLASS
// ============================================

export class ReportGenerator {
    private doc: jsPDF;
    private pageWidth: number;
    private pageHeight: number;
    private margin: number = 15;
    private headerHeight: number = 20;
    private footerHeight: number = 15;
    private contentTop: number;
    private figureCount: number = 0;
    private tableCount: number = 0;

    constructor() {
        this.doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        this.doc.setFont('helvetica');
        this.pageWidth = this.doc.internal.pageSize.getWidth();
        this.pageHeight = this.doc.internal.pageSize.getHeight();
        this.contentTop = this.margin + this.headerHeight;
    }

    // ============================================
    // HEADER & FOOTER
    // ============================================

    /**
     * Add header to current page
     */
    addHeader(title?: string): void {
        const y = this.margin;

        // Left: BeamLab Ultimate branding
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(59, 130, 246); // Blue
        this.doc.text('BeamLab Ultimate', this.margin, y);

        // Right: Generation timestamp
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(100, 100, 100);
        const timestamp = format(new Date(), "MMM dd, yyyy, hh:mm a");
        this.doc.text(`Generated: ${timestamp}`, this.pageWidth - this.margin, y, { align: 'right' });

        // Optional title (centered, below branding)
        if (title) {
            this.doc.setFontSize(14);
            this.doc.setFont('helvetica', 'bold');
            this.doc.setTextColor(0, 0, 0);
            this.doc.text(title, this.pageWidth / 2, y + 8, { align: 'center' });
        }

        // Horizontal line under header
        this.doc.setDrawColor(200, 200, 200);
        this.doc.setLineWidth(0.5);
        this.doc.line(this.margin, y + 12, this.pageWidth - this.margin, y + 12);

        // Reset text color
        this.doc.setTextColor(0, 0, 0);
    }

    /**
     * Add footer with page numbers
     */
    addFooter(): void {
        const totalPages = this.doc.getNumberOfPages();

        for (let i = 1; i <= totalPages; i++) {
            this.doc.setPage(i);

            const y = this.pageHeight - this.margin;

            // Horizontal line above footer
            this.doc.setDrawColor(200, 200, 200);
            this.doc.setLineWidth(0.3);
            this.doc.line(this.margin, y - 5, this.pageWidth - this.margin, y - 5);

            // Page number centered
            this.doc.setFontSize(9);
            this.doc.setFont('helvetica', 'normal');
            this.doc.setTextColor(100, 100, 100);
            this.doc.text(`Page ${i} of ${totalPages}`, this.pageWidth / 2, y, { align: 'center' });

            // Left: Copyright
            this.doc.setFontSize(8);
            this.doc.text('© BeamLab Ultimate', this.margin, y);

            // Right: Confidential notice
            this.doc.text('Confidential', this.pageWidth - this.margin, y, { align: 'right' });
        }
    }

    // ============================================
    // PROJECT INFORMATION
    // ============================================

    /**
     * Add project information section
     */
    addProjectInfo(project: ProjectData): void {
        const startY = this.contentTop + 5;

        // Section title
        this.doc.setFontSize(14);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(0, 0, 0);
        this.doc.text('Project Information', this.margin, startY);

        // Project info table
        const projectData = [
            ['Project Name', project.projectName || 'Untitled Project'],
            ['Project Number', project.projectNumber || 'N/A'],
            ['Client', project.clientName || 'N/A'],
            ['Engineer', project.engineerName || 'N/A'],
            ['Description', project.description || 'Structural Analysis Report'],
        ];

        autoTable(this.doc, {
            startY: startY + 5,
            head: [],
            body: projectData,
            theme: 'plain',
            styles: {
                fontSize: 10,
                cellPadding: 3,
            },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 40, textColor: [80, 80, 80] },
                1: { cellWidth: 'auto' },
            },
            margin: { left: this.margin, right: this.margin },
        });
    }

    // ============================================
    // 3D SNAPSHOT
    // ============================================

    /**
     * Add a 3D model snapshot image
     */
    add3DSnapshot(imageDataUrl: string, caption?: string): void {
        this.figureCount++;

        // Calculate dimensions
        const maxWidth = this.pageWidth - (2 * this.margin);
        const maxHeight = 120; // mm

        // Add the image centered
        const imgWidth = maxWidth;
        const imgHeight = maxHeight;
        const x = this.margin;

        // Get current Y position (use getFinalY from autoTable if available)
        let y = 80; // Default start position

        try {
            // Add some spacing
            y = (this.doc as any).lastAutoTable?.finalY + 15 || y;
        } catch {
            // Use default
        }

        // Check if we need a new page
        if (y + imgHeight + 20 > this.pageHeight - this.footerHeight) {
            this.doc.addPage();
            this.addHeader('Analysis Results');
            y = this.contentTop + 5;
        }

        // Add border around image area
        this.doc.setDrawColor(220, 220, 220);
        this.doc.setLineWidth(0.5);
        this.doc.rect(x, y, imgWidth, imgHeight);

        // Add the image
        try {
            this.doc.addImage(imageDataUrl, 'PNG', x + 1, y + 1, imgWidth - 2, imgHeight - 2);
        } catch (error) {
            // If image fails, add placeholder text
            this.doc.setFontSize(12);
            this.doc.setTextColor(150, 150, 150);
            this.doc.text('3D Model Preview', x + imgWidth / 2, y + imgHeight / 2, { align: 'center' });
            this.doc.setTextColor(0, 0, 0);
        }

        // Add caption
        const captionText = caption || `Figure ${this.figureCount}: 3D Structural Model`;
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'italic');
        this.doc.setTextColor(80, 80, 80);
        this.doc.text(captionText, this.pageWidth / 2, y + imgHeight + 6, { align: 'center' });
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(0, 0, 0);
    }

    // ============================================
    // RESULTS TABLES
    // ============================================

    /**
     * Add node displacements table
     */
    addNodeDisplacementsTable(data: NodeDisplacementRow[], title?: string): void {
        this.tableCount++;
        this.addResultsTable(
            title || `Table ${this.tableCount}: Node Displacements`,
            ['Node ID', 'dx (mm)', 'dy (mm)', 'dz (mm)', 'rx (rad)', 'ry (rad)', 'rz (rad)'],
            data.map(row => [
                row.nodeId.slice(0, 8),
                (row.dx * 1000).toFixed(4),
                (row.dy * 1000).toFixed(4),
                (row.dz * 1000).toFixed(4),
                (row.rx ?? 0).toFixed(6),
                (row.ry ?? 0).toFixed(6),
                (row.rz ?? 0).toFixed(6),
            ])
        );
    }

    /**
     * Add member forces table
     */
    addMemberForcesTable(data: MemberForceRow[], title?: string): void {
        this.tableCount++;
        this.addResultsTable(
            title || `Table ${this.tableCount}: Member Forces`,
            ['Member ID', 'Axial (kN)', 'Shear Y (kN)', 'Shear Z (kN)', 'Moment Y (kN·m)', 'Moment Z (kN·m)', 'Torsion (kN·m)'],
            data.map(row => [
                row.memberId.slice(0, 8),
                row.axial.toFixed(2),
                row.shearY.toFixed(2),
                (row.shearZ ?? 0).toFixed(2),
                (row.momentY ?? 0).toFixed(2),
                row.momentZ.toFixed(2),
                (row.torsion ?? 0).toFixed(2),
            ])
        );
    }

    /**
     * Add reactions table
     */
    addReactionsTable(data: ReactionRow[], title?: string): void {
        this.tableCount++;
        this.addResultsTable(
            title || `Table ${this.tableCount}: Support Reactions`,
            ['Node ID', 'Fx (kN)', 'Fy (kN)', 'Fz (kN)', 'Mx (kN·m)', 'My (kN·m)', 'Mz (kN·m)'],
            data.map(row => [
                row.nodeId.slice(0, 8),
                row.fx.toFixed(2),
                row.fy.toFixed(2),
                (row.fz ?? 0).toFixed(2),
                (row.mx ?? 0).toFixed(2),
                (row.my ?? 0).toFixed(2),
                (row.mz ?? 0).toFixed(2),
            ])
        );
    }

    /**
     * Generic results table using autoTable
     */
    addResultsTable(title: string, headers: string[], data: (string | number)[][]): void {
        // Get starting Y position
        let startY = 60;
        try {
            startY = (this.doc as any).lastAutoTable?.finalY + 15 || startY;
        } catch {
            // Use default
        }

        // Check if we need a new page
        if (startY > this.pageHeight - 60) {
            this.doc.addPage();
            this.addHeader('Analysis Results');
            startY = this.contentTop + 5;
        }

        // Table title
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(title, this.margin, startY);

        // Create table
        autoTable(this.doc, {
            startY: startY + 3,
            head: [headers],
            body: data,
            theme: 'striped',
            headStyles: {
                fillColor: [75, 85, 99], // Grey
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8,
                halign: 'center',
            },
            bodyStyles: {
                fontSize: 8,
                halign: 'center',
                cellPadding: 2,
            },
            alternateRowStyles: {
                fillColor: [245, 247, 250],
            },
            margin: { left: this.margin, right: this.margin },
            tableWidth: 'auto',
        });
    }

    // ============================================
    // DESIGN CHECKS SECTION
    // ============================================

    /**
     * Add design checks section with pass/fail highlighting
     */
    addDesignSection(designResults: DesignResult[]): void {
        this.tableCount++;

        // Get starting Y position
        let startY = 60;
        try {
            startY = (this.doc as any).lastAutoTable?.finalY + 15 || startY;
        } catch {
            // Use default
        }

        // Check if we need a new page
        if (startY > this.pageHeight - 80) {
            this.doc.addPage();
            this.addHeader('Design Checks');
            startY = this.contentTop + 5;
        }

        // Section Title
        this.doc.setFontSize(14);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(0, 0, 0);
        this.doc.text('Design Checks (IS 800:2007 / AISC 360)', this.margin, startY);

        // Count pass/fail
        const passCount = designResults.filter(r => r.status === 'PASS').length;
        const failCount = designResults.filter(r => r.status === 'FAIL').length;

        // Summary line
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        const summaryY = startY + 8;
        this.doc.setTextColor(34, 197, 94); // Green
        this.doc.text(`✓ ${passCount} Passed`, this.margin, summaryY);
        this.doc.setTextColor(239, 68, 68); // Red
        this.doc.text(`✗ ${failCount} Failed`, this.margin + 40, summaryY);
        this.doc.setTextColor(0, 0, 0);

        // Prepare table data
        const headers = ['Member ID', 'Section', 'Check Type', 'Ratio', 'Status', 'Clause'];
        const tableData = designResults.map(result => [
            result.memberId.slice(0, 8),
            result.section,
            result.checkType,
            result.criticalRatio.toFixed(3),
            result.status,
            result.clause,
        ]);

        // Create table with conditional row styling
        autoTable(this.doc, {
            startY: summaryY + 5,
            head: [headers],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [75, 85, 99], // Grey header
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8,
                halign: 'center',
            },
            bodyStyles: {
                fontSize: 8,
                halign: 'center',
                cellPadding: 2,
            },
            // Conditional row coloring based on status
            didParseCell: (data) => {
                if (data.section === 'body' && data.row.index !== undefined) {
                    const result = designResults[data.row.index];
                    if (result && result.status === 'FAIL') {
                        // Light red background for failed rows
                        data.cell.styles.fillColor = [255, 204, 204]; // #ffcccc
                        data.cell.styles.textColor = [180, 0, 0];
                    } else if (result && result.status === 'PASS') {
                        // White/light green for passed
                        data.cell.styles.fillColor = [240, 255, 240];
                        data.cell.styles.textColor = [0, 100, 0];
                    }
                }
                // Highlight the Status column
                if (data.section === 'body' && data.column.index === 4) {
                    data.cell.styles.fontStyle = 'bold';
                }
            },
            margin: { left: this.margin, right: this.margin },
            tableWidth: 'auto',
        });

        // Detailed breakdown for failed members
        const failedResults = designResults.filter(r => r.status === 'FAIL' && r.failureReason);

        if (failedResults.length > 0) {
            // Get Y after table
            let detailY = (this.doc as any).lastAutoTable?.finalY + 10 || startY + 100;

            // Check if we need a new page
            if (detailY > this.pageHeight - 60) {
                this.doc.addPage();
                this.addHeader('Design Checks - Details');
                detailY = this.contentTop + 5;
            }

            // Section heading
            this.doc.setFontSize(11);
            this.doc.setFont('helvetica', 'bold');
            this.doc.setTextColor(239, 68, 68);
            this.doc.text('Failed Member Details', this.margin, detailY);
            this.doc.setTextColor(0, 0, 0);

            detailY += 6;

            // List each failure
            for (const result of failedResults) {
                if (detailY > this.pageHeight - 30) {
                    this.doc.addPage();
                    this.addHeader('Design Checks - Details');
                    detailY = this.contentTop + 5;
                }

                // Member ID
                this.doc.setFontSize(9);
                this.doc.setFont('helvetica', 'bold');
                this.doc.text(`• Member ${result.memberId.slice(0, 8)} (${result.section})`, this.margin + 2, detailY);

                detailY += 4;

                // Failure reason
                this.doc.setFont('helvetica', 'normal');
                this.doc.setTextColor(80, 80, 80);
                const reasonText = result.failureReason || `Failed in ${result.checkType} check (Ratio: ${result.criticalRatio.toFixed(3)} > 1.0)`;
                const lines = this.doc.splitTextToSize(reasonText, this.pageWidth - 2 * this.margin - 10);
                this.doc.text(lines, this.margin + 6, detailY);
                this.doc.setTextColor(0, 0, 0);

                detailY += lines.length * 4 + 4;
            }
        }
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    /**
     * Add a new page with header
     */
    addPage(title?: string): void {
        this.doc.addPage();
        this.addHeader(title);
    }

    /**
     * Add a section heading
     */
    addSectionHeading(text: string): void {
        let y = 60;
        try {
            y = (this.doc as any).lastAutoTable?.finalY + 15 || y;
        } catch {
            // Use default
        }

        if (y > this.pageHeight - 40) {
            this.doc.addPage();
            this.addHeader();
            y = this.contentTop + 5;
        }

        this.doc.setFontSize(13);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(59, 130, 246);
        this.doc.text(text, this.margin, y);
        this.doc.setTextColor(0, 0, 0);

        // Underline
        this.doc.setDrawColor(59, 130, 246);
        this.doc.setLineWidth(0.5);
        this.doc.line(this.margin, y + 2, this.margin + this.doc.getTextWidth(text), y + 2);
    }

    /**
     * Add paragraph text
     */
    addParagraph(text: string): void {
        let y = 60;
        try {
            y = (this.doc as any).lastAutoTable?.finalY + 10 || y;
        } catch {
            // Use default
        }

        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');

        const lines = this.doc.splitTextToSize(text, this.pageWidth - 2 * this.margin);
        this.doc.text(lines, this.margin, y);
    }

    /**
     * Add legal disclaimer to report
     */
    addLegalDisclaimer(): void {
        this.addPage('Legal Disclaimer');

        const disclaimerText = `
IMPORTANT LEGAL NOTICE AND DISCLAIMER

1. PROFESSIONAL USE ONLY
BeamLab Ultimate is a computational aid intended for use by qualified professional engineers. It is not a substitute for professional engineering judgment, independent analysis, or verification.

2. NO WARRANTY
The software is provided "as is" without any warranty of any kind, express or implied. The developers and operators of BeamLab Ultimate make no representations regarding the accuracy, reliability, or completeness of the analysis results.

3. LIMITATION OF LIABILITY
The user assumes full responsibility for the use of this software and the interpretation of its results. BeamLab Ultimate shall not be liable for any direct, indirect, incidental, special, or consequential damages arising out of the use or inability to use this software, including but not limited to structural failures, property damage, or financial loss.

4. VERIFICATION REQUIRED
All results generated by this software must be independently verified by a licensed Professional Engineer (PE/SE) using alternative methods or hand calculations before being used for construction or design purposes.

By using this report, you acknowledge that you have read and understood these terms and agree to use the data herein at your own professional risk.
`;

        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(60, 60, 60);

        const y = this.contentTop + 10;
        const lines = this.doc.splitTextToSize(disclaimerText.trim(), this.pageWidth - 2 * this.margin);

        this.doc.text(lines, this.margin, y);

        // Add signature line
        const sigY = y + (lines.length * 5) + 30;

        this.doc.setDrawColor(0, 0, 0);
        this.doc.line(this.margin, sigY, this.margin + 80, sigY);
        this.doc.text('Professional Engineer Signature', this.margin, sigY + 5);

        this.doc.line(this.pageWidth - this.margin - 50, sigY, this.pageWidth - this.margin, sigY);
        this.doc.text('Date', this.pageWidth - this.margin - 50, sigY + 5);

        this.doc.setTextColor(0, 0, 0);
    }

    // ============================================
    // DIAGRAM METHODS
    // ============================================

    /**
     * Add a diagram (BMD, SFD, AFD) visualization to the PDF
     */
    addMemberDiagram(memberId: string, diagramType: 'BMD' | 'SFD' | 'AFD', 
                     data: { x_values: number[]; values: number[] }, 
                     maxValue: number): void {
        // Check if we need a new page
        if (this.contentTop > this.pageHeight - 80) {
            this.addPage();
        }

        // Title
        this.doc.setFontSize(10);
        this.doc.setTextColor(0, 0, 0);
        this.doc.text(`Member ${memberId} - ${diagramType}`, this.margin, this.contentTop);

        // Draw canvas diagram
        const width = this.pageWidth - 2 * this.margin;
        const height = 60;
        const canvas = document.createElement('canvas');
        canvas.width = width * 3.78; // Convert mm to pixels (72 DPI)
        canvas.height = height * 3.78;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Draw diagram
            this.drawDiagramOnCanvas(ctx, data.x_values, data.values, maxValue, canvas.width, canvas.height);
            
            // Convert canvas to image
            const imgData = canvas.toDataURL('image/png');
            
            // Add to PDF
            this.contentTop += 2;
            this.doc.addImage(imgData, 'PNG', this.margin, this.contentTop, width, height);
            this.contentTop += height + 8;
        }
    }

    /**
     * Helper: Draw diagram on canvas
     */
    private drawDiagramOnCanvas(ctx: CanvasRenderingContext2D, 
                               xValues: number[], values: number[], 
                               maxValue: number, 
                               canvasWidth: number, canvasHeight: number): void {
        const padding = 40;
        const graphWidth = canvasWidth - 2 * padding;
        const graphHeight = canvasHeight - 2 * padding;

        // Clear background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Draw axes
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, canvasHeight - padding);
        ctx.lineTo(canvasWidth - padding, canvasHeight - padding);
        ctx.stroke();

        // Draw grid
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 5; i++) {
            const x = padding + (graphWidth / 5) * i;
            ctx.beginPath();
            ctx.moveTo(x, padding);
            ctx.lineTo(x, canvasHeight - padding);
            ctx.stroke();

            const y = padding + (graphHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(canvasWidth - padding, y);
            ctx.stroke();
        }

        // Draw data line
        if (values.length > 0 && xValues.length > 0) {
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 2;
            ctx.beginPath();

            for (let i = 0; i < values.length; i++) {
                const x = padding + (xValues[i] / (xValues[xValues.length - 1] || 1)) * graphWidth;
                const y = canvasHeight - padding - ((values[i] + maxValue) / (2 * maxValue)) * graphHeight;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();

            // Fill under curve
            ctx.fillStyle = 'rgba(37, 99, 235, 0.1)';
            ctx.lineTo(canvasWidth - padding, canvasHeight - padding);
            ctx.lineTo(padding, canvasHeight - padding);
            ctx.fill();
        }

        // Draw labels
        ctx.fillStyle = '#666666';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`0`, padding - 20, canvasHeight - padding + 15);
        ctx.textAlign = 'center';
        ctx.fillText(`L`, canvasWidth - padding + 5, canvasHeight - padding + 15);
        
        ctx.textAlign = 'right';
        ctx.fillText(`+${maxValue.toFixed(1)}`, padding - 10, padding + 10);
        ctx.fillText(`-${maxValue.toFixed(1)}`, padding - 10, canvasHeight - padding - 10);
    }

    /**
     * Add multiple member diagrams for all members
     */
    addAllMemberDiagrams(members: Array<{
        id: string;
        maxShear?: number;
        maxMoment?: number;
        maxAxial?: number;
        diagramData?: {
            x_values: number[];
            shear_values: number[];
            moment_values: number[];
            axial_values: number[];
            deflection_values: number[];
        };
    }>, diagramTypes: ('BMD' | 'SFD' | 'AFD')[] = ['SFD', 'BMD']): void {
        if (members.length === 0) return;

        this.addPage('Member Diagrams');
        this.addSectionHeading('Force and Moment Diagrams');

        members.forEach(member => {
            if (!member.diagramData) return;

            diagramTypes.forEach(type => {
                const values = type === 'SFD' ? member.diagramData!.shear_values :
                             type === 'BMD' ? member.diagramData!.moment_values :
                             member.diagramData!.axial_values;
                const maxVal = type === 'SFD' ? (member.maxShear || 10) :
                              type === 'BMD' ? (member.maxMoment || 10) :
                              (member.maxAxial || 10);

                this.addMemberDiagram(member.id, type, {
                    x_values: member.diagramData!.x_values,
                    values
                }, maxVal);
            });
        });
    }

    /**
     * Add detailed individual member diagrams with calculations
     * Each member gets its own page with SFD, BMD, AFD and detailed calculations
     */
    addDetailedMemberDiagrams(members: Array<{
        id: string;
        startNodeId: string;
        endNodeId: string;
        length: number;
        sectionId?: string;
        E?: number;
        I?: number;
        A?: number;
        maxShear?: number;
        maxMoment?: number;
        maxAxial?: number;
        startReactions?: { shear: number; moment: number; axial: number };
        endReactions?: { shear: number; moment: number; axial: number };
        diagramData?: {
            x_values: number[];
            shear_values: number[];
            moment_values: number[];
            axial_values: number[];
            deflection_values: number[];
        };
    }>): void {
        if (members.length === 0) return;

        members.forEach((member, index) => {
            // New page for each member
            this.addPage(`Member ${index + 1} Analysis`);
            
            // Member header
            this.doc.setFontSize(14);
            this.doc.setFont('helvetica', 'bold');
            this.doc.setTextColor(30, 64, 175);
            this.doc.text(`Member: ${member.id}`, this.margin, this.contentTop);
            this.contentTop += 8;

            // Member info box
            this.doc.setFillColor(249, 250, 251);
            this.doc.roundedRect(this.margin, this.contentTop, this.pageWidth - 2 * this.margin, 25, 2, 2, 'F');
            
            this.doc.setFontSize(9);
            this.doc.setFont('helvetica', 'normal');
            this.doc.setTextColor(55, 65, 81);
            
            const infoY = this.contentTop + 6;
            this.doc.text(`Start Node: ${member.startNodeId}`, this.margin + 5, infoY);
            this.doc.text(`End Node: ${member.endNodeId}`, this.margin + 55, infoY);
            this.doc.text(`Length: ${member.length.toFixed(3)} m`, this.margin + 105, infoY);
            this.doc.text(`Section: ${member.sectionId || 'Default'}`, this.margin + 5, infoY + 8);
            this.doc.text(`E: ${member.E ? (member.E / 1e6).toFixed(0) : '200'} GPa`, this.margin + 55, infoY + 8);
            this.doc.text(`I: ${member.I ? (member.I * 1e8).toFixed(2) : '—'} cm⁴`, this.margin + 105, infoY + 8);
            this.doc.text(`A: ${member.A ? (member.A * 1e4).toFixed(2) : '—'} cm²`, this.margin + 155, infoY + 8);
            
            this.contentTop += 30;
            this.doc.setTextColor(0, 0, 0);

            if (!member.diagramData) {
                this.doc.setFontSize(10);
                this.doc.text('No diagram data available for this member.', this.margin, this.contentTop);
                return;
            }

            const diagrams: Array<{ type: string; values: number[]; maxVal: number; unit: string; color: string }> = [
                { 
                    type: 'Shear Force Diagram (SFD)', 
                    values: member.diagramData.shear_values, 
                    maxVal: member.maxShear || Math.max(...member.diagramData.shear_values.map(Math.abs)) || 10,
                    unit: 'kN',
                    color: '#dc2626'
                },
                { 
                    type: 'Bending Moment Diagram (BMD)', 
                    values: member.diagramData.moment_values, 
                    maxVal: member.maxMoment || Math.max(...member.diagramData.moment_values.map(Math.abs)) || 10,
                    unit: 'kN·m',
                    color: '#2563eb'
                },
                { 
                    type: 'Axial Force Diagram (AFD)', 
                    values: member.diagramData.axial_values, 
                    maxVal: member.maxAxial || Math.max(...member.diagramData.axial_values.map(Math.abs)) || 10,
                    unit: 'kN',
                    color: '#16a34a'
                }
            ];

            diagrams.forEach(diagram => {
                if (this.contentTop > this.pageHeight - 80) {
                    this.doc.addPage();
                    this.addHeader(`Member ${member.id} - Continued`);
                    this.contentTop = 45;
                }

                // Diagram title
                this.doc.setFontSize(11);
                this.doc.setFont('helvetica', 'bold');
                this.doc.setTextColor(0, 0, 0);
                this.doc.text(diagram.type, this.margin, this.contentTop);
                this.contentTop += 5;

                // Draw enhanced diagram
                this.drawEnhancedDiagram(
                    member.diagramData!.x_values,
                    diagram.values,
                    diagram.maxVal,
                    diagram.unit,
                    diagram.color,
                    member.length
                );

                this.contentTop += 5;
            });

            // Add calculations section
            this.addMemberCalculations(member);
        });
    }

    /**
     * Draw enhanced diagram with better visualization
     */
    private drawEnhancedDiagram(
        xValues: number[],
        values: number[],
        maxValue: number,
        unit: string,
        color: string,
        memberLength: number
    ): void {
        const width = this.pageWidth - 2 * this.margin;
        const height = 50;
        const canvas = document.createElement('canvas');
        canvas.width = width * 3.78;
        canvas.height = height * 3.78;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const padding = { left: 45, right: 20, top: 15, bottom: 20 };
        const graphWidth = canvas.width - padding.left - padding.right;
        const graphHeight = canvas.height - padding.top - padding.bottom;

        // Clear background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            const x = padding.left + (graphWidth / 10) * i;
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, canvas.height - padding.bottom);
            ctx.stroke();
        }
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (graphHeight / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(canvas.width - padding.right, y);
            ctx.stroke();
        }

        // Draw baseline (zero line)
        const zeroY = padding.top + graphHeight / 2;
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, zeroY);
        ctx.lineTo(canvas.width - padding.right, zeroY);
        ctx.stroke();

        // Draw member representation
        ctx.fillStyle = '#6b7280';
        ctx.fillRect(padding.left, zeroY - 3, graphWidth, 6);

        // Draw diagram curve with fill
        if (values.length > 0 && xValues.length > 0) {
            const maxX = xValues[xValues.length - 1] || memberLength || 1;
            const scale = maxValue > 0 ? (graphHeight / 2) / maxValue : 1;

            ctx.beginPath();
            ctx.moveTo(padding.left, zeroY);

            for (let i = 0; i < values.length; i++) {
                const x = padding.left + (xValues[i] / maxX) * graphWidth;
                const y = zeroY - values[i] * scale;
                if (i === 0) {
                    ctx.lineTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }

            ctx.lineTo(canvas.width - padding.right, zeroY);
            ctx.closePath();

            // Fill
            const hexToRgb = (hex: string) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                } : { r: 0, g: 0, b: 0 };
            };
            const rgb = hexToRgb(color);
            ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
            ctx.fill();

            // Stroke
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let i = 0; i < values.length; i++) {
                const x = padding.left + (xValues[i] / maxX) * graphWidth;
                const y = zeroY - values[i] * scale;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();

            // Mark max/min values
            const maxVal = Math.max(...values);
            const minVal = Math.min(...values);
            const maxIdx = values.indexOf(maxVal);
            const minIdx = values.indexOf(minVal);

            ctx.font = 'bold 11px Arial';
            ctx.fillStyle = color;
            
            if (Math.abs(maxVal) > 0.01) {
                const maxX = padding.left + (xValues[maxIdx] / (xValues[xValues.length - 1] || 1)) * graphWidth;
                const maxY = zeroY - maxVal * scale;
                ctx.beginPath();
                ctx.arc(maxX, maxY, 4, 0, 2 * Math.PI);
                ctx.fill();
                ctx.fillText(`${maxVal.toFixed(2)} ${unit}`, maxX + 5, maxY - 5);
            }
            
            if (Math.abs(minVal) > 0.01 && minIdx !== maxIdx) {
                const minX = padding.left + (xValues[minIdx] / (xValues[xValues.length - 1] || 1)) * graphWidth;
                const minY = zeroY - minVal * scale;
                ctx.beginPath();
                ctx.arc(minX, minY, 4, 0, 2 * Math.PI);
                ctx.fill();
                ctx.fillText(`${minVal.toFixed(2)} ${unit}`, minX + 5, minY + 15);
            }
        }

        // Draw axis labels
        ctx.fillStyle = '#374151';
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`+${maxValue.toFixed(1)} ${unit}`, padding.left - 5, padding.top + 10);
        ctx.fillText(`-${maxValue.toFixed(1)} ${unit}`, padding.left - 5, canvas.height - padding.bottom - 5);
        ctx.fillText('0', padding.left - 5, zeroY + 4);

        ctx.textAlign = 'center';
        ctx.fillText('0', padding.left, canvas.height - 5);
        ctx.fillText(`${memberLength.toFixed(2)} m`, canvas.width - padding.right, canvas.height - 5);

        // Convert to image and add to PDF
        const imgData = canvas.toDataURL('image/png');
        this.doc.addImage(imgData, 'PNG', this.margin, this.contentTop, width, height);
        this.contentTop += height + 3;
    }

    /**
     * Add detailed calculations for a member
     */
    private addMemberCalculations(member: {
        id: string;
        length: number;
        E?: number;
        I?: number;
        A?: number;
        maxShear?: number;
        maxMoment?: number;
        maxAxial?: number;
        diagramData?: {
            x_values: number[];
            shear_values: number[];
            moment_values: number[];
            axial_values: number[];
            deflection_values: number[];
        };
    }): void {
        if (this.contentTop > this.pageHeight - 80) {
            this.doc.addPage();
            this.addHeader(`Member ${member.id} - Calculations`);
            this.contentTop = 45;
        }

        // Calculations header
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(30, 64, 175);
        this.doc.text('Detailed Calculations', this.margin, this.contentTop);
        this.contentTop += 6;

        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(0, 0, 0);

        const L = member.length;
        const E = member.E || 200e6; // kN/m²
        const I = member.I || 1e-4;  // m⁴
        const A = member.A || 1e-2;  // m²

        // Extract key values
        const shearValues = member.diagramData?.shear_values || [];
        const momentValues = member.diagramData?.moment_values || [];
        const axialValues = member.diagramData?.axial_values || [];
        const deflectionValues = member.diagramData?.deflection_values || [];

        const Vmax = shearValues.length > 0 ? Math.max(...shearValues.map(Math.abs)) : (member.maxShear || 0);
        const Mmax = momentValues.length > 0 ? Math.max(...momentValues.map(Math.abs)) : (member.maxMoment || 0);
        const Nmax = axialValues.length > 0 ? Math.max(...axialValues.map(Math.abs)) : (member.maxAxial || 0);
        const deltaMax = deflectionValues.length > 0 ? Math.max(...deflectionValues.map(Math.abs)) : 0;

        const V_start = shearValues[0] || 0;
        const V_end = shearValues[shearValues.length - 1] || 0;
        const M_start = momentValues[0] || 0;
        const M_end = momentValues[momentValues.length - 1] || 0;
        const N_start = axialValues[0] || 0;
        const N_end = axialValues[axialValues.length - 1] || 0;

        // Create calculation box
        this.doc.setFillColor(254, 252, 232);
        this.doc.roundedRect(this.margin, this.contentTop, this.pageWidth - 2 * this.margin, 70, 2, 2, 'F');
        this.doc.setDrawColor(202, 138, 4);
        this.doc.setLineWidth(0.3);
        this.doc.roundedRect(this.margin, this.contentTop, this.pageWidth - 2 * this.margin, 70, 2, 2, 'S');

        let calcY = this.contentTop + 6;
        const col1 = this.margin + 5;
        const col2 = this.margin + 95;

        // Section 1: Shear Force
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Shear Force Analysis:', col1, calcY);
        calcY += 5;
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(`V_start = ${V_start.toFixed(3)} kN`, col1, calcY);
        this.doc.text(`V_end = ${V_end.toFixed(3)} kN`, col2, calcY);
        calcY += 5;
        this.doc.text(`V_max = ${Vmax.toFixed(3)} kN`, col1, calcY);
        this.doc.text(`ΔV = ${Math.abs(V_end - V_start).toFixed(3)} kN (change along member)`, col2, calcY);
        calcY += 7;

        // Section 2: Bending Moment
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Bending Moment Analysis:', col1, calcY);
        calcY += 5;
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(`M_start = ${M_start.toFixed(3)} kN·m`, col1, calcY);
        this.doc.text(`M_end = ${M_end.toFixed(3)} kN·m`, col2, calcY);
        calcY += 5;
        this.doc.text(`M_max = ${Mmax.toFixed(3)} kN·m`, col1, calcY);
        
        // Calculate bending stress
        const y_max = 0.15; // Assume 150mm half-depth (typical)
        const sigma_b = (Mmax * 1000 * y_max) / (I * 1e8); // MPa (approximate)
        this.doc.text(`σ_b ≈ M·y/I = ${sigma_b.toFixed(2)} MPa (approx)`, col2, calcY);
        calcY += 7;

        // Section 3: Axial Force
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Axial Force Analysis:', col1, calcY);
        calcY += 5;
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(`N_start = ${N_start.toFixed(3)} kN`, col1, calcY);
        this.doc.text(`N_end = ${N_end.toFixed(3)} kN`, col2, calcY);
        calcY += 5;
        this.doc.text(`N_max = ${Nmax.toFixed(3)} kN`, col1, calcY);
        
        // Calculate axial stress
        const sigma_a = (Nmax * 1000) / (A * 1e4); // MPa
        this.doc.text(`σ_a = N/A = ${sigma_a.toFixed(2)} MPa`, col2, calcY);
        calcY += 7;

        // Section 4: Deflection
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Deflection:', col1, calcY);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(`δ_max = ${(deltaMax * 1000).toFixed(3)} mm`, col1 + 40, calcY);
        this.doc.text(`L/δ = ${deltaMax > 0 ? (L / deltaMax).toFixed(0) : '∞'}`, col2, calcY);

        this.contentTop += 75;
    }

    /**
     * Add combined structure diagram showing all members
     */
    addCombinedStructureDiagram(
        nodes: Array<{ id: string; x: number; y: number; z: number }>,
        members: Array<{
            id: string;
            startNodeId: string;
            endNodeId: string;
            diagramData?: {
                x_values: number[];
                shear_values: number[];
                moment_values: number[];
                axial_values: number[];
            };
        }>,
        diagramType: 'SFD' | 'BMD' | 'AFD'
    ): void {
        this.addPage(`Combined ${diagramType} - Entire Structure`);
        this.addSectionHeading(`Combined ${diagramType === 'SFD' ? 'Shear Force' : diagramType === 'BMD' ? 'Bending Moment' : 'Axial Force'} Diagram`);

        // Calculate bounds
        const xs = nodes.map(n => n.x);
        const ys = nodes.map(n => n.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const rangeX = (maxX - minX) || 1;
        const rangeY = (maxY - minY) || 1;

        // Canvas dimensions
        const canvasWidth = this.pageWidth - 2 * this.margin;
        const canvasHeight = 140;
        const padding = 35;
        const drawWidth = canvasWidth - 2 * padding;
        const drawHeight = canvasHeight - 2 * padding;

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth * 3.78;
        canvas.height = canvasHeight * 3.78;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        const scale = 3.78;
        const pxPadding = padding * scale;
        const pxDrawWidth = drawWidth * scale;
        const pxDrawHeight = drawHeight * scale;

        // Clear background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Coordinate transform
        const toCanvasX = (x: number) => pxPadding + ((x - minX) / rangeX) * pxDrawWidth;
        const toCanvasY = (y: number) => canvas.height - pxPadding - ((y - minY) / rangeY) * pxDrawHeight;

        // Draw grid
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            const x = pxPadding + (pxDrawWidth / 10) * i;
            const y = pxPadding + (pxDrawHeight / 10) * i;
            ctx.beginPath();
            ctx.moveTo(x, pxPadding);
            ctx.lineTo(x, canvas.height - pxPadding);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(pxPadding, y);
            ctx.lineTo(canvas.width - pxPadding, y);
            ctx.stroke();
        }

        // Draw members (baseline)
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 4;
        for (const member of members) {
            const startNode = nodes.find(n => n.id === member.startNodeId);
            const endNode = nodes.find(n => n.id === member.endNodeId);
            if (startNode && endNode) {
                ctx.beginPath();
                ctx.moveTo(toCanvasX(startNode.x), toCanvasY(startNode.y));
                ctx.lineTo(toCanvasX(endNode.x), toCanvasY(endNode.y));
                ctx.stroke();
            }
        }

        // Diagram colors
        const colors: Record<string, string> = {
            'SFD': '#dc2626',
            'BMD': '#2563eb',
            'AFD': '#16a34a'
        };
        const color = colors[diagramType];

        // Find global max for scaling
        let globalMax = 1;
        for (const member of members) {
            if (member.diagramData) {
                const values = diagramType === 'SFD' ? member.diagramData.shear_values :
                             diagramType === 'BMD' ? member.diagramData.moment_values :
                             member.diagramData.axial_values;
                const maxVal = Math.max(...values.map(Math.abs));
                if (maxVal > globalMax) globalMax = maxVal;
            }
        }

        // Scale factor for diagram offset from member (in pixels)
        const diagramScale = 30 / globalMax;

        // Draw diagram for each member
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.fillStyle = color.replace(')', ', 0.15)').replace('rgb', 'rgba');

        for (const member of members) {
            const startNode = nodes.find(n => n.id === member.startNodeId);
            const endNode = nodes.find(n => n.id === member.endNodeId);
            if (!startNode || !endNode || !member.diagramData) continue;

            const values = diagramType === 'SFD' ? member.diagramData.shear_values :
                         diagramType === 'BMD' ? member.diagramData.moment_values :
                         member.diagramData.axial_values;
            const xValues = member.diagramData.x_values;

            if (values.length === 0) continue;

            // Calculate member direction
            const dx = endNode.x - startNode.x;
            const dy = endNode.y - startNode.y;
            const memberLen = Math.sqrt(dx * dx + dy * dy) || 1;
            const perpX = -dy / memberLen;
            const perpY = dx / memberLen;

            const startPx = toCanvasX(startNode.x);
            const startPy = toCanvasY(startNode.y);
            const endPx = toCanvasX(endNode.x);
            const endPy = toCanvasY(endNode.y);

            // Draw diagram polygon
            ctx.beginPath();
            ctx.moveTo(startPx, startPy);

            for (let i = 0; i < values.length; i++) {
                const t = xValues[i] / (xValues[xValues.length - 1] || 1);
                const basePx = startPx + t * (endPx - startPx);
                const basePy = startPy + t * (endPy - startPy);
                const offset = values[i] * diagramScale;
                ctx.lineTo(basePx + perpX * offset, basePy - perpY * offset);
            }

            ctx.lineTo(endPx, endPy);
            ctx.closePath();

            // Fill and stroke
            const hexToRgb = (hex: string) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                } : { r: 0, g: 0, b: 0 };
            };
            const rgb = hexToRgb(color);
            ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.stroke();

            // Add max value label
            const maxVal = Math.max(...values);
            const minVal = Math.min(...values);
            const maxIdx = values.indexOf(Math.abs(maxVal) > Math.abs(minVal) ? maxVal : minVal);
            const t = xValues[maxIdx] / (xValues[xValues.length - 1] || 1);
            const labelPx = startPx + t * (endPx - startPx);
            const labelPy = startPy + t * (endPy - startPy);
            const labelOffset = (Math.abs(maxVal) > Math.abs(minVal) ? maxVal : minVal) * diagramScale;

            ctx.font = 'bold 11px Arial';
            ctx.fillStyle = color;
            const labelValue = Math.abs(maxVal) > Math.abs(minVal) ? maxVal : minVal;
            ctx.fillText(
                `${labelValue.toFixed(1)}`,
                labelPx + perpX * labelOffset + 5,
                labelPy - perpY * labelOffset
            );
        }

        // Draw nodes
        ctx.fillStyle = '#374151';
        for (const node of nodes) {
            const px = toCanvasX(node.x);
            const py = toCanvasY(node.y);
            ctx.beginPath();
            ctx.arc(px, py, 5, 0, 2 * Math.PI);
            ctx.fill();
        }

        // Convert to image and add to PDF
        const imgData = canvas.toDataURL('image/png');
        const y = (this.doc as any).lastAutoTable?.finalY + 10 || this.contentTop;
        this.doc.addImage(imgData, 'PNG', this.margin, y, canvasWidth, canvasHeight);

        // Add legend
        const legendY = y + canvasHeight + 8;
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16));
        const unit = diagramType === 'BMD' ? 'kN·m' : 'kN';
        this.doc.text(`${diagramType} values in ${unit} | Max scale: ±${globalMax.toFixed(2)} ${unit}`, this.margin, legendY);
        this.doc.setTextColor(0, 0, 0);

        this.contentTop = legendY + 10;
    }

    // ============================================
    // CROSS-SECTIONAL DETAILS
    // ============================================

    /**
     * Add detailed cross-sectional properties for all members
     */
    addCrossSectionalDetails(members: Array<{
        id: string;
        sectionId: string;
        E?: number;      // Young's Modulus (kN/m² or MPa)
        A?: number;      // Cross-sectional Area (m² or mm²)
        Iy?: number;     // Moment of Inertia about Y (m⁴ or mm⁴)
        Iz?: number;     // Moment of Inertia about Z (m⁴ or mm⁴)
        J?: number;      // Torsional constant
        length?: number; // Member length (m)
    }>): void {
        if (members.length === 0) return;

        this.addPage('Cross-Sectional Properties');
        this.addSectionHeading('Member Cross-Section Details');

        this.tableCount++;
        const headers = ['Member ID', 'Section', 'E (GPa)', 'A (cm²)', 'Iy (cm⁴)', 'Iz (cm⁴)', 'J (cm⁴)', 'Length (m)'];
        
        const data = members.map(m => [
            m.id.slice(0, 10),
            m.sectionId || 'Custom',
            m.E ? (m.E / 1e6).toFixed(0) : '200',  // Convert kN/m² to GPa
            m.A ? (m.A * 1e4).toFixed(2) : '—',    // Convert m² to cm²
            m.Iy ? (m.Iy * 1e8).toFixed(2) : '—',  // Convert m⁴ to cm⁴
            m.Iz ? (m.Iz * 1e8).toFixed(2) : '—',
            m.J ? (m.J * 1e8).toFixed(2) : '—',
            m.length?.toFixed(3) || '—'
        ]);

        this.addResultsTable(`Table ${this.tableCount}: Cross-Sectional Properties`, headers, data);

        // Add cross-section diagrams for each unique section
        const uniqueSections = [...new Set(members.map(m => m.sectionId))];
        if (uniqueSections.length > 0 && uniqueSections.length <= 6) {
            this.addCrossSectionVisualizations(uniqueSections.filter(s => s && s !== 'Custom'));
        }
    }

    /**
     * Draw cross-section visualization for common section types
     */
    private addCrossSectionVisualizations(sectionIds: string[]): void {
        let y = (this.doc as any).lastAutoTable?.finalY + 15 || this.contentTop + 50;

        if (y > this.pageHeight - 100) {
            this.doc.addPage();
            this.addHeader('Cross-Section Details');
            y = this.contentTop + 5;
        }

        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Section Profiles', this.margin, y);
        y += 8;

        const sectionWidth = 50;
        const sectionHeight = 40;
        let x = this.margin;

        for (const sectionId of sectionIds) {
            if (x + sectionWidth > this.pageWidth - this.margin) {
                x = this.margin;
                y += sectionHeight + 20;
            }

            // Draw section box
            this.doc.setDrawColor(100, 100, 100);
            this.doc.setLineWidth(0.3);
            this.doc.rect(x, y, sectionWidth, sectionHeight);

            // Draw section shape based on type
            this.drawSectionProfile(x + sectionWidth / 2, y + sectionHeight / 2, sectionId);

            // Add section label
            this.doc.setFontSize(8);
            this.doc.setFont('helvetica', 'normal');
            this.doc.text(sectionId.slice(0, 12), x + sectionWidth / 2, y + sectionHeight + 5, { align: 'center' });

            x += sectionWidth + 10;
        }
    }

    /**
     * Draw a section profile (I-beam, rectangular, circular, etc.)
     */
    private drawSectionProfile(cx: number, cy: number, sectionId: string): void {
        this.doc.setDrawColor(50, 50, 50);
        this.doc.setFillColor(200, 200, 200);
        this.doc.setLineWidth(0.5);

        const sectionType = sectionId.toLowerCase();

        if (sectionType.includes('ismb') || sectionType.includes('w') || sectionType.includes('ipe')) {
            // I-section (wide flange)
            const w = 18, h = 24, tf = 3, tw = 2;
            // Top flange
            this.doc.rect(cx - w/2, cy - h/2, w, tf, 'FD');
            // Web
            this.doc.rect(cx - tw/2, cy - h/2 + tf, tw, h - 2*tf, 'FD');
            // Bottom flange
            this.doc.rect(cx - w/2, cy + h/2 - tf, w, tf, 'FD');
        } else if (sectionType.includes('ismc') || sectionType.includes('c') || sectionType.includes('channel')) {
            // Channel section
            const w = 14, h = 24, tf = 3, tw = 2;
            // Top flange
            this.doc.rect(cx - w/2, cy - h/2, w, tf, 'FD');
            // Web
            this.doc.rect(cx - w/2, cy - h/2 + tf, tw, h - 2*tf, 'FD');
            // Bottom flange
            this.doc.rect(cx - w/2, cy + h/2 - tf, w, tf, 'FD');
        } else if (sectionType.includes('isa') || sectionType.includes('angle') || sectionType.includes('l')) {
            // Angle section
            const w = 16, t = 3;
            // Vertical leg
            this.doc.rect(cx - w/2, cy - w/2, t, w, 'FD');
            // Horizontal leg
            this.doc.rect(cx - w/2, cy + w/2 - t, w, t, 'FD');
        } else if (sectionType.includes('rect') || sectionType.includes('rhs')) {
            // Rectangular hollow section
            const w = 16, h = 20, t = 2;
            this.doc.setFillColor(200, 200, 200);
            this.doc.rect(cx - w/2, cy - h/2, w, h, 'FD');
            this.doc.setFillColor(255, 255, 255);
            this.doc.rect(cx - w/2 + t, cy - h/2 + t, w - 2*t, h - 2*t, 'FD');
        } else if (sectionType.includes('chs') || sectionType.includes('pipe') || sectionType.includes('circular')) {
            // Circular hollow section
            const r = 10, t = 2;
            this.doc.setFillColor(200, 200, 200);
            this.doc.circle(cx, cy, r, 'FD');
            this.doc.setFillColor(255, 255, 255);
            this.doc.circle(cx, cy, r - t, 'FD');
        } else {
            // Default: solid rectangle
            const w = 12, h = 20;
            this.doc.rect(cx - w/2, cy - h/2, w, h, 'FD');
        }
    }

    // ============================================
    // FREE BODY DIAGRAM (FBD)
    // ============================================

    /**
     * Add Free Body Diagram showing structure with loads and reactions
     */
    addFreeBodyDiagram(
        nodes: Array<{ id: string; x: number; y: number; z: number }>,
        members: Array<{ id: string; startNodeId: string; endNodeId: string }>,
        loads: Array<{ nodeId: string; fx?: number; fy?: number; fz?: number }>,
        reactions: Array<{ nodeId: string; fx: number; fy: number; fz?: number; mx?: number; my?: number; mz?: number }>,
        supports: Array<{ nodeId: string; type: 'fixed' | 'pinned' | 'roller' }>
    ): void {
        this.addPage('Free Body Diagram');
        this.addSectionHeading('Structural Free Body Diagram (FBD)');

        // Calculate bounds
        const xs = nodes.map(n => n.x);
        const ys = nodes.map(n => n.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;

        // Canvas dimensions
        const canvasWidth = this.pageWidth - 2 * this.margin;
        const canvasHeight = 120;
        const padding = 30;
        const drawWidth = canvasWidth - 2 * padding;
        const drawHeight = canvasHeight - 2 * padding;

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth * 3.78;
        canvas.height = canvasHeight * 3.78;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        const scale = 3.78;
        const pxPadding = padding * scale;
        const pxDrawWidth = drawWidth * scale;
        const pxDrawHeight = drawHeight * scale;

        // Clear background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Coordinate transform
        const toCanvasX = (x: number) => pxPadding + ((x - minX) / rangeX) * pxDrawWidth;
        const toCanvasY = (y: number) => canvas.height - pxPadding - ((y - minY) / rangeY) * pxDrawHeight;

        // Draw grid
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            const x = pxPadding + (pxDrawWidth / 10) * i;
            const y = pxPadding + (pxDrawHeight / 10) * i;
            ctx.beginPath();
            ctx.moveTo(x, pxPadding);
            ctx.lineTo(x, canvas.height - pxPadding);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(pxPadding, y);
            ctx.lineTo(canvas.width - pxPadding, y);
            ctx.stroke();
        }

        // Draw members
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 4;
        for (const member of members) {
            const startNode = nodes.find(n => n.id === member.startNodeId);
            const endNode = nodes.find(n => n.id === member.endNodeId);
            if (startNode && endNode) {
                ctx.beginPath();
                ctx.moveTo(toCanvasX(startNode.x), toCanvasY(startNode.y));
                ctx.lineTo(toCanvasX(endNode.x), toCanvasY(endNode.y));
                ctx.stroke();
            }
        }

        // Draw supports
        for (const support of supports) {
            const node = nodes.find(n => n.id === support.nodeId);
            if (!node) continue;

            const px = toCanvasX(node.x);
            const py = toCanvasY(node.y);

            if (support.type === 'fixed') {
                // Fixed support - hatched rectangle
                ctx.fillStyle = '#6b7280';
                ctx.fillRect(px - 15, py, 30, 15);
                ctx.strokeStyle = '#374151';
                ctx.lineWidth = 2;
                for (let i = 0; i < 5; i++) {
                    ctx.beginPath();
                    ctx.moveTo(px - 15 + i * 8, py);
                    ctx.lineTo(px - 15 + i * 8 + 8, py + 15);
                    ctx.stroke();
                }
            } else if (support.type === 'pinned') {
                // Pinned support - triangle
                ctx.fillStyle = '#10b981';
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(px - 12, py + 20);
                ctx.lineTo(px + 12, py + 20);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#064e3b';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else if (support.type === 'roller') {
                // Roller support - triangle with circle
                ctx.fillStyle = '#3b82f6';
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(px - 10, py + 15);
                ctx.lineTo(px + 10, py + 15);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.arc(px, py + 20, 5, 0, 2 * Math.PI);
                ctx.fill();
            }
        }

        // Draw applied loads (red arrows pointing down/direction)
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        for (const load of loads) {
            const node = nodes.find(n => n.id === load.nodeId);
            if (!node) continue;

            const px = toCanvasX(node.x);
            const py = toCanvasY(node.y);

            if (load.fy && load.fy !== 0) {
                const arrowLen = Math.min(40, Math.abs(load.fy) * 2);
                const dir = load.fy < 0 ? 1 : -1;
                ctx.beginPath();
                ctx.moveTo(px, py - dir * 10);
                ctx.lineTo(px, py - dir * (10 + arrowLen));
                ctx.stroke();
                // Arrow head
                ctx.beginPath();
                ctx.moveTo(px, py - dir * 10);
                ctx.lineTo(px - 6, py - dir * 20);
                ctx.lineTo(px + 6, py - dir * 20);
                ctx.closePath();
                ctx.fill();
                // Label
                ctx.font = 'bold 12px Arial';
                ctx.fillText(`${Math.abs(load.fy).toFixed(1)} kN`, px + 8, py - dir * 25);
            }

            if (load.fx && load.fx !== 0) {
                const arrowLen = Math.min(40, Math.abs(load.fx) * 2);
                const dir = load.fx > 0 ? 1 : -1;
                ctx.beginPath();
                ctx.moveTo(px + dir * 10, py);
                ctx.lineTo(px + dir * (10 + arrowLen), py);
                ctx.stroke();
                // Arrow head
                ctx.beginPath();
                ctx.moveTo(px + dir * 10, py);
                ctx.lineTo(px + dir * 20, py - 6);
                ctx.lineTo(px + dir * 20, py + 6);
                ctx.closePath();
                ctx.fill();
                // Label
                ctx.font = 'bold 12px Arial';
                ctx.fillText(`${Math.abs(load.fx).toFixed(1)} kN`, px + dir * 45, py + 5);
            }
        }

        // Draw reaction forces (green arrows)
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        for (const reaction of reactions) {
            const node = nodes.find(n => n.id === reaction.nodeId);
            if (!node) continue;

            const px = toCanvasX(node.x);
            const py = toCanvasY(node.y);

            if (Math.abs(reaction.fy) > 0.01) {
                const arrowLen = Math.min(40, Math.abs(reaction.fy) * 2);
                const dir = reaction.fy > 0 ? -1 : 1;
                ctx.beginPath();
                ctx.moveTo(px, py + dir * 25);
                ctx.lineTo(px, py + dir * (25 + arrowLen));
                ctx.stroke();
                // Arrow head
                ctx.beginPath();
                ctx.moveTo(px, py + dir * 25);
                ctx.lineTo(px - 6, py + dir * 35);
                ctx.lineTo(px + 6, py + dir * 35);
                ctx.closePath();
                ctx.fill();
                // Label
                ctx.font = 'bold 11px Arial';
                ctx.fillText(`R=${Math.abs(reaction.fy).toFixed(2)} kN`, px + 10, py + dir * 50);
            }

            if (Math.abs(reaction.fx) > 0.01) {
                const arrowLen = Math.min(40, Math.abs(reaction.fx) * 2);
                const dir = reaction.fx > 0 ? -1 : 1;
                ctx.beginPath();
                ctx.moveTo(px + dir * 25, py);
                ctx.lineTo(px + dir * (25 + arrowLen), py);
                ctx.stroke();
                // Arrow head
                ctx.beginPath();
                ctx.moveTo(px + dir * 25, py);
                ctx.lineTo(px + dir * 35, py - 6);
                ctx.lineTo(px + dir * 35, py + 6);
                ctx.closePath();
                ctx.fill();
                // Label
                ctx.font = 'bold 11px Arial';
                ctx.fillText(`H=${Math.abs(reaction.fx).toFixed(2)} kN`, px + dir * 50, py - 8);
            }
        }

        // Draw nodes
        ctx.fillStyle = '#1f2937';
        for (const node of nodes) {
            const px = toCanvasX(node.x);
            const py = toCanvasY(node.y);
            ctx.beginPath();
            ctx.arc(px, py, 6, 0, 2 * Math.PI);
            ctx.fill();

            // Node label
            ctx.font = '10px Arial';
            ctx.fillStyle = '#374151';
            ctx.fillText(node.id.slice(0, 8), px + 10, py - 10);
            ctx.fillStyle = '#1f2937';
        }

        // Convert to image and add to PDF
        const imgData = canvas.toDataURL('image/png');
        const y = (this.doc as any).lastAutoTable?.finalY + 10 || this.contentTop + 10;
        this.doc.addImage(imgData, 'PNG', this.margin, y, canvasWidth, canvasHeight);

        // Add legend
        const legendY = y + canvasHeight + 8;
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(239, 68, 68);
        this.doc.text('● Applied Loads (Red)', this.margin, legendY);
        this.doc.setTextColor(34, 197, 94);
        this.doc.text('● Reaction Forces (Green)', this.margin + 50, legendY);
        this.doc.setTextColor(55, 65, 81);
        this.doc.text('● Members (Grey)', this.margin + 110, legendY);
        this.doc.setTextColor(0, 0, 0);
    }

    // ============================================
    // DETAILED REACTIONS TABLE
    // ============================================

    /**
     * Add comprehensive reactions summary with totals and equilibrium check
     */
    addDetailedReactionsTable(
        reactions: ReactionRow[],
        loads: Array<{ nodeId: string; fx?: number; fy?: number; fz?: number }>
    ): void {
        this.addPage('Reaction Forces');
        this.addSectionHeading('Support Reactions Summary');

        // Calculate totals
        const totalRx = reactions.reduce((sum, r) => sum + r.fx, 0);
        const totalRy = reactions.reduce((sum, r) => sum + r.fy, 0);
        const totalRz = reactions.reduce((sum, r) => sum + (r.fz ?? 0), 0);
        const totalMx = reactions.reduce((sum, r) => sum + (r.mx ?? 0), 0);
        const totalMy = reactions.reduce((sum, r) => sum + (r.my ?? 0), 0);
        const totalMz = reactions.reduce((sum, r) => sum + (r.mz ?? 0), 0);

        const totalLoadFx = loads.reduce((sum, l) => sum + (l.fx ?? 0), 0);
        const totalLoadFy = loads.reduce((sum, l) => sum + (l.fy ?? 0), 0);
        const totalLoadFz = loads.reduce((sum, l) => sum + (l.fz ?? 0), 0);

        // Reactions table
        this.tableCount++;
        const headers = ['Support Node', 'Rx (kN)', 'Ry (kN)', 'Rz (kN)', 'Mx (kN·m)', 'My (kN·m)', 'Mz (kN·m)'];
        const data = reactions.map(r => [
            r.nodeId.slice(0, 10),
            r.fx.toFixed(3),
            r.fy.toFixed(3),
            (r.fz ?? 0).toFixed(3),
            (r.mx ?? 0).toFixed(3),
            (r.my ?? 0).toFixed(3),
            (r.mz ?? 0).toFixed(3),
        ]);

        // Add totals row
        data.push([
            'TOTAL',
            totalRx.toFixed(3),
            totalRy.toFixed(3),
            totalRz.toFixed(3),
            totalMx.toFixed(3),
            totalMy.toFixed(3),
            totalMz.toFixed(3),
        ]);

        this.addResultsTable(`Table ${this.tableCount}: Reaction Forces`, headers, data);

        // Equilibrium check
        let checkY = (this.doc as any).lastAutoTable?.finalY + 15 || this.contentTop + 80;

        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Equilibrium Check', this.margin, checkY);
        checkY += 6;

        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');

        const equilibriumX = Math.abs(totalRx + totalLoadFx) < 0.01;
        const equilibriumY = Math.abs(totalRy + totalLoadFy) < 0.01;
        const equilibriumZ = Math.abs(totalRz + totalLoadFz) < 0.01;

        this.doc.setTextColor(equilibriumX ? 34 : 239, equilibriumX ? 197 : 68, equilibriumX ? 94 : 68);
        this.doc.text(`ΣFx = ${(totalRx + totalLoadFx).toFixed(4)} kN ${equilibriumX ? '✓' : '✗'}`, this.margin, checkY);
        
        this.doc.setTextColor(equilibriumY ? 34 : 239, equilibriumY ? 197 : 68, equilibriumY ? 94 : 68);
        this.doc.text(`ΣFy = ${(totalRy + totalLoadFy).toFixed(4)} kN ${equilibriumY ? '✓' : '✗'}`, this.margin + 60, checkY);
        
        this.doc.setTextColor(equilibriumZ ? 34 : 239, equilibriumZ ? 197 : 68, equilibriumZ ? 94 : 68);
        this.doc.text(`ΣFz = ${(totalRz + totalLoadFz).toFixed(4)} kN ${equilibriumZ ? '✓' : '✗'}`, this.margin + 120, checkY);

        this.doc.setTextColor(0, 0, 0);
    }

    // ============================================
    // SAVE
    // ============================================

    /**
     * Save the PDF report
     */
    save(filename: string): void {
        // Add footers to all pages
        this.addFooter();

        // Generate filename
        const cleanFilename = filename.replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
        const fullFilename = `${cleanFilename}_Report_${timestamp}.pdf`;

        // Save
        this.doc.save(fullFilename);
    }

    /**
     * Get the PDF as a Blob (for uploading)
     */
    getBlob(): Blob {
        this.addFooter();
        return this.doc.output('blob');
    }

    /**
     * Get the PDF as a data URL (for preview)
     */
    getDataUrl(): string {
        this.addFooter();
        return this.doc.output('dataurlstring');
    }

    // ============================================
    // INPUT DATA TABLES
    // ============================================

    /**
     * Add node coordinates table
     */
    addNodesTable(nodes: Array<{ id: string; x: number; y: number; z: number }>): void {
        this.tableCount++;
        this.addResultsTable(
            `Table ${this.tableCount}: Node Coordinates`,
            ['Node ID', 'X (m)', 'Y (m)', 'Z (m)'],
            nodes.map(node => [
                node.id.slice(0, 10),
                node.x.toFixed(3),
                node.y.toFixed(3),
                node.z.toFixed(3),
            ])
        );
    }

    /**
     * Add members table
     */
    addMembersTable(members: Array<{ id: string; startNodeId: string; endNodeId: string; sectionId: string }>): void {
        this.tableCount++;
        this.addResultsTable(
            `Table ${this.tableCount}: Member Properties`,
            ['Member ID', 'Start Node', 'End Node', 'Section'],
            members.map(member => [
                member.id.slice(0, 10),
                member.startNodeId.slice(0, 10),
                member.endNodeId.slice(0, 10),
                member.sectionId,
            ])
        );
    }

    // ============================================
    // HAND CALCULATION STEPS
    // ============================================

    /**
     * Add hand calculation steps from backend analysis
     */
    addHandCalcSteps(steps: string[], title?: string): void {
        // Get starting Y position
        let startY = 60;
        try {
            startY = (this.doc as any).lastAutoTable?.finalY + 15 || startY;
        } catch {
            // Use default
        }

        // Check if we need a new page
        if (startY > this.pageHeight - 80) {
            this.doc.addPage();
            this.addHeader('Analysis Calculations');
            startY = this.contentTop + 5;
        }

        // Section Title
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(59, 130, 246);
        this.doc.text(title || 'Hand Calculation Steps', this.margin, startY);
        this.doc.setTextColor(0, 0, 0);

        let y = startY + 8;

        // Add each step
        for (const step of steps) {
            // Check for page break
            if (y > this.pageHeight - 30) {
                this.doc.addPage();
                this.addHeader('Analysis Calculations (continued)');
                y = this.contentTop + 5;
            }

            // Format step text
            this.doc.setFontSize(9);
            this.doc.setFont('helvetica', 'normal');

            // Check if it's a step number line
            if (step.startsWith('Step')) {
                this.doc.setFont('helvetica', 'bold');
                this.doc.setTextColor(75, 85, 99);
            } else {
                this.doc.setTextColor(60, 60, 60);
            }

            // Wrap long lines
            const lines = this.doc.splitTextToSize(step, this.pageWidth - 2 * this.margin - 5);
            this.doc.text(lines, this.margin + 3, y);

            y += lines.length * 4 + 2;
            this.doc.setTextColor(0, 0, 0);
        }
    }

    // ============================================
    // COMPLETE REPORT GENERATION
    // ============================================

    /**
     * Generate a complete 4-page analysis report
     */
    generateFullReport(options: {
        project: ProjectData;
        canvasImage?: string;
        nodes: Array<{ id: string; x: number; y: number; z: number }>;
        members: Array<{ id: string; startNodeId: string; endNodeId: string; sectionId: string }>;
        handCalcSteps?: string[];
        reactions?: ReactionRow[];
        memberForces?: MemberForceRow[];
        designResults?: DesignResult[];
    }): void {
        const {
            project,
            canvasImage,
            nodes,
            members,
            handCalcSteps,
            reactions,
            memberForces,
            designResults
        } = options;

        // ========== PAGE 1: Title & Model ==========
        this.addHeader('Structural Analysis Report');
        this.addProjectInfo(project);

        if (canvasImage) {
            this.add3DSnapshot(canvasImage, 'Figure 1: 3D Structural Model View');
        }

        // ========== PAGE 2: Input Data ==========
        this.addPage('Input Data');

        // Add model summary
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(`Total Nodes: ${nodes.length}`, this.margin, this.contentTop + 5);
        this.doc.text(`Total Members: ${members.length}`, this.margin + 50, this.contentTop + 5);

        // Nodes table
        if (nodes.length > 0) {
            this.addNodesTable(nodes);
        }

        // Members table
        if (members.length > 0) {
            this.addMembersTable(members);
        }

        // ========== PAGE 3: Analysis Results ==========
        this.addPage('Analysis Results');

        // Hand calculation steps
        if (handCalcSteps && handCalcSteps.length > 0) {
            this.addHandCalcSteps(handCalcSteps, 'Hand Calculation Steps');
        }

        // Reactions table
        if (reactions && reactions.length > 0) {
            this.addReactionsTable(reactions, 'Support Reactions');
        }

        // Member forces (optional on same or new page)
        if (memberForces && memberForces.length > 0) {
            this.addMemberForcesTable(memberForces, 'Member Internal Forces');
        }

        // ========== PAGE 4: Pass/Fail Checks ==========
        if (designResults && designResults.length > 0) {
            this.addPage('Design Checks');
            this.addDesignSection(designResults);
        }

        // ========== PAGE 5: Legal Disclaimer ==========
        this.addLegalDisclaimer();
    }

    // ============================================
    // WATERMARK
    // ============================================

    /**
     * Add watermark to all pages
     */
    addWatermark(): void {
        const totalPages = this.doc.getNumberOfPages();

        for (let i = 1; i <= totalPages; i++) {
            this.doc.setPage(i);

            // Watermark at top right
            this.doc.setFontSize(10);
            this.doc.setFont('helvetica', 'bold');
            this.doc.setTextColor(200, 200, 200);

            // Diagonal watermark
            this.doc.text(
                'BeamLab Ultimate',
                this.pageWidth - this.margin - 5,
                this.margin + 5,
                { align: 'right', angle: 0 }
            );
        }

        this.doc.setTextColor(0, 0, 0);
    }

    // ============================================
    // ENHANCED SAVE WITH WATERMARK
    // ============================================

    /**
     * Save the PDF report with watermark
     */
    saveWithWatermark(filename: string): void {
        // Add watermark to all pages
        this.addWatermark();

        // Add footers to all pages
        this.addFooter();

        // Generate filename
        const cleanFilename = filename.replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
        const fullFilename = `${cleanFilename}_Report_${timestamp}.pdf`;

        // Save
        this.doc.save(fullFilename);
    }
    addExecutiveSummary(options: {
        totalNodes: number;
        totalMembers: number;
        totalLoads: number;
        maxDisplacement: number;
        maxStress: number;
        overallStatus: 'PASS' | 'FAIL' | 'WARNING';
        criticalMembers: string[];
        analysisTime: number;
    }): void {
        const { totalNodes, totalMembers, totalLoads, maxDisplacement, maxStress, overallStatus, criticalMembers, analysisTime } = options;

        let startY = this.contentTop + 5;

        // Section title
        this.doc.setFontSize(14);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Executive Summary', this.margin, startY);
        startY += 10;

        // Status badge
        const statusColors: Record<string, [number, number, number]> = {
            'PASS': [34, 197, 94],
            'FAIL': [239, 68, 68],
            'WARNING': [234, 179, 8]
        };

        const statusColor = statusColors[overallStatus] || statusColors['WARNING'];
        this.doc.setFillColor(...statusColor);
        this.doc.roundedRect(this.margin, startY, 40, 8, 2, 2, 'F');
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(overallStatus, this.margin + 20, startY + 5.5, { align: 'center' });
        this.doc.setTextColor(0, 0, 0);

        startY += 15;

        // Summary statistics table
        const summaryData = [
            ['Model Statistics', ''],
            ['Total Nodes', totalNodes.toString()],
            ['Total Members', totalMembers.toString()],
            ['Total Load Cases', totalLoads.toString()],
            ['', ''],
            ['Analysis Results', ''],
            ['Max Displacement', `${maxDisplacement.toFixed(4)} mm`],
            ['Max Stress', `${maxStress.toFixed(2)} MPa`],
            ['Analysis Time', `${analysisTime.toFixed(2)} ms`],
        ];

        autoTable(this.doc, {
            startY: startY,
            head: [],
            body: summaryData,
            theme: 'plain',
            styles: {
                fontSize: 10,
                cellPadding: 2,
            },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 50, textColor: [80, 80, 80] },
                1: { cellWidth: 40, halign: 'right' },
            },
            margin: { left: this.margin, right: this.margin },
            didParseCell: (data) => {
                // Make section headers bold and colored
                if (data.row.index === 0 || data.row.index === 5) {
                    data.cell.styles.textColor = [59, 130, 246];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        // Critical members warning
        if (criticalMembers.length > 0) {
            let y = (this.doc as any).lastAutoTable?.finalY + 10 || startY + 60;

            this.doc.setFontSize(11);
            this.doc.setFont('helvetica', 'bold');
            this.doc.setTextColor(239, 68, 68);
            this.doc.text('⚠ Critical Members Requiring Attention:', this.margin, y);
            this.doc.setTextColor(0, 0, 0);

            y += 5;
            this.doc.setFontSize(9);
            this.doc.setFont('helvetica', 'normal');

            for (const member of criticalMembers.slice(0, 5)) {
                y += 4;
                this.doc.text(`• ${member}`, this.margin + 3, y);
            }

            if (criticalMembers.length > 5) {
                y += 4;
                this.doc.setTextColor(100, 100, 100);
                this.doc.text(`... and ${criticalMembers.length - 5} more`, this.margin + 3, y);
                this.doc.setTextColor(0, 0, 0);
            }
        }
    }

    // ============================================
    // DEFLECTION SUMMARY
    // ============================================

    /**
     * Add deflection check summary
     */
    addDeflectionSummary(data: Array<{
        nodeId: string;
        displacement: number;
        limit: number;
        ratio: number;
        status: 'OK' | 'EXCESSIVE';
    }>): void {
        this.tableCount++;

        let startY = 60;
        try {
            startY = (this.doc as any).lastAutoTable?.finalY + 15 || startY;
        } catch {
            // Use default
        }

        if (startY > this.pageHeight - 80) {
            this.doc.addPage();
            this.addHeader('Deflection Checks');
            startY = this.contentTop + 5;
        }

        // Title
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Deflection Summary', this.margin, startY);

        const passCount = data.filter(d => d.status === 'OK').length;
        const failCount = data.filter(d => d.status === 'EXCESSIVE').length;

        // Summary
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        const summaryY = startY + 6;
        this.doc.setTextColor(34, 197, 94);
        this.doc.text(`✓ ${passCount} OK`, this.margin, summaryY);
        this.doc.setTextColor(239, 68, 68);
        this.doc.text(`✗ ${failCount} Excessive`, this.margin + 30, summaryY);
        this.doc.setTextColor(0, 0, 0);

        // Table
        autoTable(this.doc, {
            startY: summaryY + 5,
            head: [['Node', 'Displacement (mm)', 'Limit (mm)', 'Ratio', 'Status']],
            body: data.map(d => [
                d.nodeId.slice(0, 8),
                d.displacement.toFixed(4),
                d.limit.toFixed(2),
                `L/${(1 / d.ratio).toFixed(0)}`,
                d.status
            ]),
            theme: 'striped',
            headStyles: {
                fillColor: [75, 85, 99],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8,
                halign: 'center',
            },
            bodyStyles: {
                fontSize: 8,
                halign: 'center',
            },
            didParseCell: (cellData) => {
                if (cellData.section === 'body' && cellData.column.index === 4) {
                    const status = cellData.cell.text[0];
                    if (status === 'EXCESSIVE') {
                        cellData.cell.styles.textColor = [239, 68, 68];
                        cellData.cell.styles.fontStyle = 'bold';
                    } else {
                        cellData.cell.styles.textColor = [34, 197, 94];
                    }
                }
            },
            margin: { left: this.margin, right: this.margin },
        });
    }

    // ============================================
    // LOAD COMBINATION TABLE
    // ============================================

    /**
     * Add load combinations table
     */
    addLoadCombinations(combinations: Array<{
        name: string;
        type: string;
        factors: Record<string, number>;
    }>): void {
        this.tableCount++;

        let startY = 60;
        try {
            startY = (this.doc as any).lastAutoTable?.finalY + 15 || startY;
        } catch {
            // Use default
        }

        if (startY > this.pageHeight - 60) {
            this.doc.addPage();
            this.addHeader('Load Combinations');
            startY = this.contentTop + 5;
        }

        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Load Combinations', this.margin, startY);

        const allLoadNames = [...new Set(combinations.flatMap(c => Object.keys(c.factors)))];
        const headers = ['Combination', 'Type', ...allLoadNames.map(n => n.slice(0, 6))];

        const rows = combinations.map(c => [
            c.name,
            c.type,
            ...allLoadNames.map(n => (c.factors[n] ?? 0).toFixed(2))
        ]);

        autoTable(this.doc, {
            startY: startY + 5,
            head: [headers],
            body: rows,
            theme: 'grid',
            headStyles: {
                fillColor: [75, 85, 99],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 7,
                halign: 'center',
            },
            bodyStyles: {
                fontSize: 7,
                halign: 'center',
            },
            margin: { left: this.margin, right: this.margin },
        });
    }

    // ============================================
    // MATERIAL PROPERTIES TABLE
    // ============================================

    /**
     * Add material properties table
     */
    addMaterialProperties(materials: Array<{
        name: string;
        E: number;  // GPa
        fy: number; // MPa
        fu?: number; // MPa
        density: number; // kg/m³
        type: string;
    }>): void {
        this.tableCount++;

        let startY = 60;
        try {
            startY = (this.doc as any).lastAutoTable?.finalY + 15 || startY;
        } catch {
            // Use default
        }

        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Material Properties', this.margin, startY);

        autoTable(this.doc, {
            startY: startY + 5,
            head: [['Material', 'Type', 'E (GPa)', 'fy (MPa)', 'fu (MPa)', 'ρ (kg/m³)']],
            body: materials.map(m => [
                m.name,
                m.type,
                m.E.toFixed(0),
                m.fy.toFixed(0),
                (m.fu ?? '-').toString(),
                m.density.toFixed(0)
            ]),
            theme: 'striped',
            headStyles: {
                fillColor: [59, 130, 246],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9,
                halign: 'center',
            },
            bodyStyles: {
                fontSize: 9,
                halign: 'center',
            },
            margin: { left: this.margin, right: this.margin },
        });
    }

    // ============================================
    // SECTION PROPERTIES TABLE
    // ============================================

    /**
     * Add section properties table
     */
    addSectionProperties(sections: Array<{
        name: string;
        type: string;
        A: number;      // mm²
        Iy: number;     // mm⁴ × 10⁶
        Iz: number;     // mm⁴ × 10⁶
        J: number;      // mm⁴ × 10⁶
        Zy: number;     // mm³ × 10³
        Zz: number;     // mm³ × 10³
    }>): void {
        this.tableCount++;

        let startY = 60;
        try {
            startY = (this.doc as any).lastAutoTable?.finalY + 15 || startY;
        } catch {
            // Use default
        }

        if (startY > this.pageHeight - 60) {
            this.doc.addPage();
            this.addHeader('Section Properties');
            startY = this.contentTop + 5;
        }

        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Section Properties', this.margin, startY);

        autoTable(this.doc, {
            startY: startY + 5,
            head: [['Section', 'Type', 'A (mm²)', 'Iy (×10⁶)', 'Iz (×10⁶)', 'J (×10⁶)', 'Zy (×10³)', 'Zz (×10³)']],
            body: sections.map(s => [
                s.name,
                s.type,
                s.A.toFixed(0),
                s.Iy.toFixed(2),
                s.Iz.toFixed(2),
                s.J.toFixed(2),
                s.Zy.toFixed(2),
                s.Zz.toFixed(2)
            ]),
            theme: 'striped',
            headStyles: {
                fillColor: [59, 130, 246],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8,
                halign: 'center',
            },
            bodyStyles: {
                fontSize: 8,
                halign: 'center',
            },
            margin: { left: this.margin, right: this.margin },
        });
    }
}

// ============================================
// CONVENIENCE FUNCTION
// ============================================

/**
 * Quick function to generate a complete report
 */
export async function generateAnalysisReport(options: {
    projectName: string;
    clientName?: string;
    engineerName?: string;
    canvasElement?: HTMLCanvasElement;
    nodes: Array<{ id: string; x: number; y: number; z: number }>;
    members: Array<{ id: string; startNodeId: string; endNodeId: string; sectionId: string }>;
    handCalcSteps?: string[];
    reactions?: ReactionRow[];
    memberForces?: MemberForceRow[];
    designResults?: DesignResult[];
    executiveSummary?: {
        totalNodes: number;
        totalMembers: number;
        totalLoads: number;
        maxDisplacement: number;
        maxStress: number;
        overallStatus: 'PASS' | 'FAIL' | 'WARNING';
        criticalMembers: string[];
        analysisTime: number;
    };
}): Promise<void> {
    const {
        projectName,
        clientName,
        engineerName,
        canvasElement,
        nodes,
        members,
        handCalcSteps,
        reactions,
        memberForces,
        designResults,
        executiveSummary
    } = options;

    // Get canvas screenshot if available
    let canvasImage: string | undefined;
    if (canvasElement) {
        canvasImage = canvasElement.toDataURL('image/png');
    }

    // Create report generator
    const report = new ReportGenerator();

    // Generate full report
    report.generateFullReport({
        project: {
            projectName,
            clientName,
            engineerName,
            description: 'Structural Analysis Report generated by BeamLab Ultimate'
        },
        canvasImage,
        nodes,
        members,
        handCalcSteps,
        reactions,
        memberForces,
        designResults
    });

    // Add executive summary if provided
    if (executiveSummary) {
        report.addPage('Executive Summary');
        report.addExecutiveSummary(executiveSummary);
    }

    // Save with watermark
    report.saveWithWatermark(projectName);
}

/**
 * Generate quick summary report (1-2 pages)
 */
export function generateQuickReport(options: {
    projectName: string;
    maxDisplacement: { nodeId: string; value: number };
    maxStress: { memberId: string; value: number };
    designStatus: 'PASS' | 'FAIL';
    criticalRatio: number;
}): void {
    const report = new ReportGenerator();

    report.addHeader('Quick Analysis Summary');
    report.addProjectInfo({ projectName: options.projectName });

    // Add summary text
    report.addParagraph(`
        Analysis completed successfully.
        
        Maximum Displacement: ${options.maxDisplacement.value.toFixed(4)} mm at Node ${options.maxDisplacement.nodeId}
        Maximum Stress: ${options.maxStress.value.toFixed(2)} MPa in Member ${options.maxStress.memberId}
        
        Overall Design Status: ${options.designStatus}
        Critical Utilization Ratio: ${options.criticalRatio.toFixed(3)}
    `);

    report.saveWithWatermark(options.projectName + '_Quick');
}

export default ReportGenerator;
