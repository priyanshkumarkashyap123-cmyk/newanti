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
