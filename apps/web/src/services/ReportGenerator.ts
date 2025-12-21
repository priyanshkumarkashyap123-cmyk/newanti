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
}

export default ReportGenerator;
