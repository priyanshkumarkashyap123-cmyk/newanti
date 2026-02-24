/**
 * ============================================================================
 * CODE COMPLIANCE REPORT GENERATOR
 * ============================================================================
 * 
 * Generates detailed code compliance documentation for:
 * - IS 800:2007 (Steel)
 * - IS 456:2000 (Concrete)
 * - IS 1893:2016 (Seismic)
 * - AISC 360-16 (Steel)
 * - ACI 318-19 (Concrete)
 * - ASCE 7-22 (Loads)
 * - Eurocode 3/2
 * 
 * @version 2.0.0
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

// ============================================================================
// TYPES
// ============================================================================

export type DesignCodeType = 
    | 'IS_800_2007'
    | 'IS_456_2000'
    | 'IS_1893_2016'
    | 'IS_13920_2016'
    | 'AISC_360_16'
    | 'ACI_318_19'
    | 'ASCE_7_22'
    | 'EN_1993_1_1'
    | 'EN_1992_1_1';

export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL' | 'NOT_APPLICABLE';

export interface ClauseCheck {
    clause: string;
    title: string;
    requirement: string;
    designValue: string;
    limitValue: string;
    status: ComplianceStatus;
    notes?: string;
    reference?: string;
}

export interface CodeSection {
    sectionNumber: string;
    sectionTitle: string;
    description?: string;
    checks: ClauseCheck[];
    overallStatus: ComplianceStatus;
}

export interface CodeComplianceData {
    code: DesignCodeType;
    codeName: string;
    edition: string;
    sections: CodeSection[];
    
    projectInfo: {
        name: string;
        number: string;
        structure: string;
        location: string;
    };
    
    designParameters: {
        category: string;
        parameters: { name: string; value: string; unit?: string }[];
    }[];
    
    summary: {
        totalChecks: number;
        compliant: number;
        nonCompliant: number;
        partial: number;
        notApplicable: number;
    };
}

export interface ComplianceReportSettings {
    companyName: string;
    preparedBy: string;
    checkedBy?: string;
    date: Date;
    revision: string;
    showDetailedNotes: boolean;
    primaryColor: string;
}

// ============================================================================
// CODE COMPLIANCE REPORT GENERATOR
// ============================================================================

export class CodeComplianceReportGenerator {
    private doc: jsPDF;
    private data: CodeComplianceData;
    private settings: ComplianceReportSettings;
    
    private pageWidth: number;
    private pageHeight: number;
    private margins = { top: 25, bottom: 20, left: 15, right: 15 };
    private contentWidth: number;
    private currentY: number = 0;
    private pageNumber: number = 0;
    
    private primaryRgb: { r: number; g: number; b: number };
    
    private statusColors: Record<ComplianceStatus, { bg: [number, number, number]; text: [number, number, number]; icon: string }> = {
        COMPLIANT: { bg: [220, 252, 231], text: [22, 163, 74], icon: '✓' },
        NON_COMPLIANT: { bg: [254, 226, 226], text: [220, 38, 38], icon: '✗' },
        PARTIAL: { bg: [254, 249, 195], text: [161, 98, 7], icon: '⚠' },
        NOT_APPLICABLE: { bg: [243, 244, 246], text: [107, 114, 128], icon: '-' }
    };

    constructor(data: CodeComplianceData, settings: Partial<ComplianceReportSettings> = {}) {
        this.data = data;
        this.settings = {
            companyName: 'Structural Engineering',
            preparedBy: 'Engineer',
            date: new Date(),
            revision: 'A',
            showDetailedNotes: true,
            primaryColor: '#1e40af',
            ...settings
        };
        
        this.doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        this.pageWidth = this.doc.internal.pageSize.getWidth();
        this.pageHeight = this.doc.internal.pageSize.getHeight();
        this.contentWidth = this.pageWidth - this.margins.left - this.margins.right;
        
        this.primaryRgb = this.hexToRgb(this.settings.primaryColor);
    }
    
    private hexToRgb(hex: string): { r: number; g: number; b: number } {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 30, g: 64, b: 175 };
    }

    // ========================================================================
    // MAIN GENERATION
    // ========================================================================

    async generate(): Promise<Blob> {
        // Cover page
        this.renderCoverPage();
        
        // Compliance Summary
        this.addPage();
        this.renderComplianceSummary();
        
        // Design Parameters
        this.renderDesignParameters();
        
        // Code Sections
        this.data.sections.forEach(section => {
            this.renderCodeSection(section);
        });
        
        // Final certification
        this.addPage();
        this.renderCertification();
        
        // Add headers/footers
        this.addHeadersAndFooters();
        
        return this.doc.output('blob');
    }

    // ========================================================================
    // PAGE MANAGEMENT
    // ========================================================================

    private addPage(): void {
        if (this.pageNumber > 0) {
            this.doc.addPage();
        }
        this.pageNumber++;
        this.currentY = this.margins.top + 10;
    }

    private checkPageBreak(requiredHeight: number): void {
        if (this.currentY + requiredHeight > this.pageHeight - this.margins.bottom) {
            this.addPage();
        }
    }

    // ========================================================================
    // COVER PAGE
    // ========================================================================

    private renderCoverPage(): void {
        this.pageNumber = 1;
        
        // Header band
        this.doc.setFillColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.rect(0, 0, this.pageWidth, 60, 'F');
        
        // Title
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFontSize(22);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('CODE COMPLIANCE REPORT', this.pageWidth / 2, 25, { align: 'center' });
        
        this.doc.setFontSize(16);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(this.data.codeName, this.pageWidth / 2, 38, { align: 'center' });
        
        this.doc.setFontSize(12);
        this.doc.text(`Edition: ${this.data.edition}`, this.pageWidth / 2, 50, { align: 'center' });
        
        // Project info box
        this.doc.setDrawColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.setLineWidth(1);
        this.doc.roundedRect(this.margins.left, 75, this.contentWidth, 50, 3, 3, 'S');
        
        this.doc.setTextColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('PROJECT INFORMATION', this.margins.left + 5, 85);
        
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFontSize(10);
        
        const projectInfo = [
            ['Project:', this.data.projectInfo.name],
            ['Job Number:', this.data.projectInfo.number],
            ['Structure:', this.data.projectInfo.structure],
            ['Location:', this.data.projectInfo.location],
        ];
        
        let y = 95;
        projectInfo.forEach(([label, value]) => {
            this.doc.setFont('helvetica', 'bold');
            this.doc.text(label, this.margins.left + 10, y);
            this.doc.setFont('helvetica', 'normal');
            this.doc.text(value, this.margins.left + 45, y);
            y += 8;
        });
        
        // Compliance summary donut chart (simplified)
        const chartCenterX = this.pageWidth / 2;
        const chartCenterY = 175;
        const chartRadius = 35;
        
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('COMPLIANCE OVERVIEW', this.pageWidth / 2, 140, { align: 'center' });
        
        // Draw segments
        const total = this.data.summary.totalChecks - this.data.summary.notApplicable;
        const compliantAngle = (this.data.summary.compliant / total) * 360;
        const partialAngle = (this.data.summary.partial / total) * 360;
        
        // Background circle
        this.doc.setFillColor(254, 226, 226); // Red for non-compliant
        this.doc.circle(chartCenterX, chartCenterY, chartRadius, 'F');
        
        // Partial (yellow) - if any
        if (this.data.summary.partial > 0) {
            this.doc.setFillColor(254, 249, 195);
            this.drawPieSlice(chartCenterX, chartCenterY, chartRadius, compliantAngle, compliantAngle + partialAngle);
        }
        
        // Compliant (green)
        if (this.data.summary.compliant > 0) {
            this.doc.setFillColor(220, 252, 231);
            this.drawPieSlice(chartCenterX, chartCenterY, chartRadius, 0, compliantAngle);
        }
        
        // Center white circle (donut hole)
        this.doc.setFillColor(255, 255, 255);
        this.doc.circle(chartCenterX, chartCenterY, chartRadius * 0.6, 'F');
        
        // Center text
        const complianceRate = ((this.data.summary.compliant + this.data.summary.partial * 0.5) / total * 100).toFixed(0);
        this.doc.setTextColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.setFontSize(18);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(`${complianceRate}%`, chartCenterX, chartCenterY + 3, { align: 'center' });
        
        this.doc.setFontSize(8);
        this.doc.text('COMPLIANCE', chartCenterX, chartCenterY + 9, { align: 'center' });
        
        // Legend
        const legendY = 220;
        const legendItems = [
            { color: [220, 252, 231], label: `Compliant (${this.data.summary.compliant})` },
            { color: [254, 249, 195], label: `Partial (${this.data.summary.partial})` },
            { color: [254, 226, 226], label: `Non-Compliant (${this.data.summary.nonCompliant})` },
            { color: [243, 244, 246], label: `N/A (${this.data.summary.notApplicable})` },
        ];
        
        legendItems.forEach((item, i) => {
            const x = this.margins.left + (i % 2) * (this.contentWidth / 2);
            const yPos = legendY + Math.floor(i / 2) * 10;
            
            this.doc.setFillColor(item.color[0], item.color[1], item.color[2]);
            this.doc.rect(x, yPos - 3, 8, 5, 'F');
            
            this.doc.setTextColor(0, 0, 0);
            this.doc.setFontSize(9);
            this.doc.setFont('helvetica', 'normal');
            this.doc.text(item.label, x + 12, yPos);
        });
        
        // Document control box
        this.doc.roundedRect(this.margins.left, 250, this.contentWidth, 30, 3, 3, 'S');
        
        this.doc.setTextColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('DOCUMENT CONTROL', this.margins.left + 5, 258);
        
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(`Prepared By: ${this.settings.preparedBy}`, this.margins.left + 10, 268);
        this.doc.text(`Date: ${format(this.settings.date, 'MMMM dd, yyyy')}`, this.margins.left + 10, 275);
        this.doc.text(`Revision: ${this.settings.revision}`, this.margins.left + 100, 268);
        if (this.settings.checkedBy) {
            this.doc.text(`Checked By: ${this.settings.checkedBy}`, this.margins.left + 100, 275);
        }
    }

    private drawPieSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number): void {
        // Simplified pie slice drawing
        const startRad = (startAngle - 90) * Math.PI / 180;
        const endRad = (endAngle - 90) * Math.PI / 180;
        
        // For simplicity, we'll just draw a filled sector using multiple triangles
        const steps = Math.ceil((endAngle - startAngle) / 5);
        const angleStep = (endRad - startRad) / steps;
        
        for (let i = 0; i < steps; i++) {
            const a1 = startRad + i * angleStep;
            const a2 = startRad + (i + 1) * angleStep;
            
            const x1 = cx + r * Math.cos(a1);
            const y1 = cy + r * Math.sin(a1);
            const x2 = cx + r * Math.cos(a2);
            const y2 = cy + r * Math.sin(a2);
            
            this.doc.triangle(cx, cy, x1, y1, x2, y2, 'F');
        }
    }

    // ========================================================================
    // COMPLIANCE SUMMARY
    // ========================================================================

    private renderComplianceSummary(): void {
        // Section header
        this.doc.setFillColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.rect(this.margins.left, this.currentY - 5, this.contentWidth, 10, 'F');
        
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('1. COMPLIANCE SUMMARY', this.margins.left + 5, this.currentY + 2);
        this.currentY += 15;
        
        // Summary table
        const summaryData = [
            ['Total Checks Performed', String(this.data.summary.totalChecks)],
            ['Compliant', String(this.data.summary.compliant), `${((this.data.summary.compliant / this.data.summary.totalChecks) * 100).toFixed(1)}%`],
            ['Partially Compliant', String(this.data.summary.partial), `${((this.data.summary.partial / this.data.summary.totalChecks) * 100).toFixed(1)}%`],
            ['Non-Compliant', String(this.data.summary.nonCompliant), `${((this.data.summary.nonCompliant / this.data.summary.totalChecks) * 100).toFixed(1)}%`],
            ['Not Applicable', String(this.data.summary.notApplicable), `${((this.data.summary.notApplicable / this.data.summary.totalChecks) * 100).toFixed(1)}%`],
        ];
        
        autoTable(this.doc, {
            startY: this.currentY,
            head: [['Category', 'Count', 'Percentage']],
            body: summaryData,
            theme: 'striped',
            headStyles: { fillColor: [80, 80, 80], fontSize: 10 },
            margin: { left: this.margins.left, right: this.margins.right },
            styles: { fontSize: 10 },
            columnStyles: {
                0: { cellWidth: 80 },
                1: { cellWidth: 40, halign: 'center' },
                2: { cellWidth: 40, halign: 'center' },
            },
            didParseCell: (data) => {
                if (data.section === 'body' && data.row.index === 1) {
                    data.cell.styles.textColor = [22, 163, 74];
                    data.cell.styles.fontStyle = 'bold';
                } else if (data.section === 'body' && data.row.index === 3) {
                    data.cell.styles.textColor = [220, 38, 38];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });
        
        this.currentY = (this.doc as any).lastAutoTable.finalY + 15;
        
        // Section-by-section summary
        this.doc.setTextColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Section-wise Compliance Status', this.margins.left, this.currentY);
        this.currentY += 8;
        
        const sectionSummary = this.data.sections.map(s => {
            const compliant = s.checks.filter(c => c.status === 'COMPLIANT').length;
            const total = s.checks.length;
            return [
                s.sectionNumber,
                s.sectionTitle,
                `${compliant}/${total}`,
                s.overallStatus
            ];
        });
        
        autoTable(this.doc, {
            startY: this.currentY,
            head: [['Section', 'Title', 'Score', 'Status']],
            body: sectionSummary,
            theme: 'striped',
            headStyles: { fillColor: [this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b], fontSize: 9 },
            margin: { left: this.margins.left, right: this.margins.right },
            styles: { fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 90 },
                2: { cellWidth: 25, halign: 'center' },
                3: { cellWidth: 35, halign: 'center' },
            },
            didParseCell: (data) => {
                if (data.column.index === 3 && data.section === 'body') {
                    const status = data.cell.raw as string;
                    const colors = this.statusColors[status as ComplianceStatus];
                    if (colors) {
                        data.cell.styles.textColor = colors.text;
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });
        
        this.currentY = (this.doc as any).lastAutoTable.finalY + 15;
    }

    // ========================================================================
    // DESIGN PARAMETERS
    // ========================================================================

    private renderDesignParameters(): void {
        this.checkPageBreak(50);
        
        this.doc.setFillColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.rect(this.margins.left, this.currentY - 5, this.contentWidth, 10, 'F');
        
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('2. DESIGN PARAMETERS', this.margins.left + 5, this.currentY + 2);
        this.currentY += 15;
        
        this.data.designParameters.forEach(category => {
            this.checkPageBreak(20 + category.parameters.length * 5);
            
            // Category header
            this.doc.setFillColor(240, 240, 250);
            this.doc.rect(this.margins.left, this.currentY - 3, this.contentWidth, 7, 'F');
            
            this.doc.setTextColor(60, 60, 60);
            this.doc.setFontSize(10);
            this.doc.setFont('helvetica', 'bold');
            this.doc.text(category.category, this.margins.left + 3, this.currentY + 1);
            this.currentY += 8;
            
            // Parameters
            const paramData = category.parameters.map(p => [
                p.name,
                p.unit ? `${p.value} ${p.unit}` : p.value
            ]);
            
            autoTable(this.doc, {
                startY: this.currentY,
                body: paramData,
                theme: 'plain',
                styles: { fontSize: 9, cellPadding: 2 },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 80, textColor: [80, 80, 80] },
                    1: { cellWidth: 'auto' },
                },
                margin: { left: this.margins.left + 5, right: this.margins.right },
            });
            
            this.currentY = (this.doc as any).lastAutoTable.finalY + 5;
        });
        
        this.currentY += 10;
    }

    // ========================================================================
    // CODE SECTIONS
    // ========================================================================

    private renderCodeSection(section: CodeSection): void {
        this.checkPageBreak(40);
        
        // Section header
        this.doc.setFillColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.rect(this.margins.left, this.currentY - 5, this.contentWidth, 10, 'F');
        
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(`${section.sectionNumber}. ${section.sectionTitle}`, this.margins.left + 5, this.currentY + 2);
        
        // Status badge
        const colors = this.statusColors[section.overallStatus];
        this.doc.setFillColor(colors.bg[0], colors.bg[1], colors.bg[2]);
        this.doc.roundedRect(this.pageWidth - this.margins.right - 30, this.currentY - 4, 28, 8, 2, 2, 'F');
        this.doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
        this.doc.setFontSize(8);
        this.doc.text(section.overallStatus, this.pageWidth - this.margins.right - 16, this.currentY + 1, { align: 'center' });
        
        this.currentY += 12;
        
        // Description
        if (section.description) {
            this.doc.setTextColor(80, 80, 80);
            this.doc.setFontSize(9);
            this.doc.setFont('helvetica', 'italic');
            const descLines = this.doc.splitTextToSize(section.description, this.contentWidth - 10);
            this.doc.text(descLines, this.margins.left + 5, this.currentY);
            this.currentY += descLines.length * 4 + 5;
        }
        
        // Clause checks table
        const checkData = section.checks.map(c => [
            c.clause,
            c.title,
            c.requirement,
            c.designValue,
            c.limitValue,
            c.status
        ]);
        
        autoTable(this.doc, {
            startY: this.currentY,
            head: [['Clause', 'Check', 'Requirement', 'Design', 'Limit', 'Status']],
            body: checkData,
            theme: 'striped',
            headStyles: { 
                fillColor: [100, 100, 100], 
                fontSize: 8,
                textColor: [255, 255, 255]
            },
            margin: { left: this.margins.left, right: this.margins.right },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 40 },
                2: { cellWidth: 35 },
                3: { cellWidth: 25, halign: 'center' },
                4: { cellWidth: 25, halign: 'center' },
                5: { cellWidth: 25, halign: 'center' },
            },
            didParseCell: (data) => {
                if (data.column.index === 5 && data.section === 'body') {
                    const status = data.cell.raw as string;
                    const colors = this.statusColors[status as ComplianceStatus];
                    if (colors) {
                        data.cell.styles.textColor = colors.text;
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });
        
        this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
        
        // Notes for non-compliant items
        if (this.settings.showDetailedNotes) {
            const nonCompliant = section.checks.filter(c => c.status === 'NON_COMPLIANT' || c.status === 'PARTIAL');
            
            if (nonCompliant.length > 0) {
                this.checkPageBreak(15 + nonCompliant.length * 8);
                
                this.doc.setFillColor(255, 245, 245);
                this.doc.setDrawColor(220, 38, 38);
                this.doc.setLineWidth(0.3);
                
                const notesHeight = 10 + nonCompliant.length * 8;
                this.doc.roundedRect(this.margins.left, this.currentY, this.contentWidth, notesHeight, 2, 2, 'FD');
                
                this.doc.setTextColor(180, 0, 0);
                this.doc.setFontSize(9);
                this.doc.setFont('helvetica', 'bold');
                this.doc.text('Non-Compliance Notes:', this.margins.left + 5, this.currentY + 6);
                
                this.doc.setFont('helvetica', 'normal');
                this.doc.setTextColor(100, 0, 0);
                this.doc.setFontSize(8);
                
                nonCompliant.forEach((check, i) => {
                    const note = check.notes || 'Review and address this non-compliance.';
                    this.doc.text(`• ${check.clause}: ${note}`, this.margins.left + 8, this.currentY + 12 + i * 6);
                });
                
                this.currentY += notesHeight + 5;
            }
        }
        
        this.currentY += 5;
    }

    // ========================================================================
    // CERTIFICATION
    // ========================================================================

    private renderCertification(): void {
        // Header
        this.doc.setFillColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.rect(this.margins.left, this.currentY - 5, this.contentWidth, 10, 'F');
        
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('COMPLIANCE CERTIFICATION', this.margins.left + 5, this.currentY + 2);
        this.currentY += 20;
        
        // Certification statement
        const isCompliant = this.data.summary.nonCompliant === 0;
        
        if (isCompliant) {
            this.doc.setFillColor(220, 252, 231);
            this.doc.setDrawColor(34, 197, 94);
        } else {
            this.doc.setFillColor(254, 226, 226);
            this.doc.setDrawColor(220, 38, 38);
        }
        this.doc.setLineWidth(1);
        this.doc.roundedRect(this.margins.left, this.currentY, this.contentWidth, 40, 3, 3, 'FD');
        
        if (isCompliant) {
            this.doc.setTextColor(22, 101, 52);
        } else {
            this.doc.setTextColor(153, 27, 27);
        }
        this.doc.setFontSize(14);
        this.doc.setFont('helvetica', 'bold');
        
        const certText = isCompliant 
            ? '✓ DESIGN COMPLIES WITH CODE REQUIREMENTS'
            : '✗ DESIGN REQUIRES MODIFICATIONS';
        
        this.doc.text(certText, this.pageWidth / 2, this.currentY + 15, { align: 'center' });
        
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        const detailText = isCompliant
            ? `The structural design satisfies all applicable requirements of ${this.data.codeName}.`
            : `The design has ${this.data.summary.nonCompliant} non-compliant item(s) that must be addressed.`;
        
        this.doc.text(detailText, this.pageWidth / 2, this.currentY + 28, { align: 'center' });
        
        this.currentY += 55;
        
        // Signature block
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('ENGINEER\'S CERTIFICATION', this.margins.left, this.currentY);
        this.currentY += 10;
        
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        const certStatement = `I hereby certify that I have reviewed the structural design and analysis for ${this.data.projectInfo.name} ` +
            `and confirm that ${isCompliant ? 'it complies with' : 'it has been checked against'} the requirements of ${this.data.codeName}.`;
        
        const certLines = this.doc.splitTextToSize(certStatement, this.contentWidth - 10);
        this.doc.text(certLines, this.margins.left + 5, this.currentY);
        this.currentY += certLines.length * 5 + 20;
        
        // Signature lines
        const sigWidth = (this.contentWidth - 30) / 2;
        
        // Design engineer
        this.doc.line(this.margins.left, this.currentY, this.margins.left + sigWidth, this.currentY);
        this.doc.setFontSize(9);
        this.doc.text('Design Engineer', this.margins.left, this.currentY + 5);
        this.doc.text('Name: ____________________', this.margins.left, this.currentY + 12);
        this.doc.text('License No: _______________', this.margins.left, this.currentY + 19);
        this.doc.text('Date: ____________________', this.margins.left, this.currentY + 26);
        
        // Checking engineer
        this.doc.line(this.margins.left + sigWidth + 30, this.currentY, this.margins.left + this.contentWidth, this.currentY);
        this.doc.text('Checking Engineer', this.margins.left + sigWidth + 30, this.currentY + 5);
        this.doc.text('Name: ____________________', this.margins.left + sigWidth + 30, this.currentY + 12);
        this.doc.text('License No: _______________', this.margins.left + sigWidth + 30, this.currentY + 19);
        this.doc.text('Date: ____________________', this.margins.left + sigWidth + 30, this.currentY + 26);
        
        this.currentY += 40;
        
        // Official stamp area
        this.doc.setDrawColor(180, 180, 180);
        this.doc.setLineWidth(0.5);
        this.doc.setLineDashPattern([3, 3], 0);
        this.doc.roundedRect(this.pageWidth / 2 - 25, this.currentY, 50, 50, 2, 2, 'S');
        
        this.doc.setFontSize(8);
        this.doc.setTextColor(150, 150, 150);
        this.doc.text('OFFICIAL', this.pageWidth / 2, this.currentY + 22, { align: 'center' });
        this.doc.text('STAMP', this.pageWidth / 2, this.currentY + 28, { align: 'center' });
    }

    // ========================================================================
    // HEADERS AND FOOTERS
    // ========================================================================

    private addHeadersAndFooters(): void {
        const totalPages = this.doc.getNumberOfPages();
        
        for (let i = 2; i <= totalPages; i++) {
            this.doc.setPage(i);
            
            // Header
            this.doc.setDrawColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
            this.doc.setLineWidth(0.5);
            this.doc.line(this.margins.left, 15, this.pageWidth - this.margins.right, 15);
            
            this.doc.setFontSize(8);
            this.doc.setFont('helvetica', 'normal');
            this.doc.setTextColor(100, 100, 100);
            this.doc.text(`Code Compliance Report - ${this.data.codeName}`, this.margins.left, 12);
            this.doc.text(this.data.projectInfo.name, this.pageWidth - this.margins.right, 12, { align: 'right' });
            
            // Footer
            this.doc.line(this.margins.left, this.pageHeight - 15, this.pageWidth - this.margins.right, this.pageHeight - 15);
            
            this.doc.text(this.settings.companyName, this.margins.left, this.pageHeight - 10);
            this.doc.text(`Page ${i} of ${totalPages}`, this.pageWidth / 2, this.pageHeight - 10, { align: 'center' });
            this.doc.text(`Rev. ${this.settings.revision}`, this.pageWidth - this.margins.right, this.pageHeight - 10, { align: 'right' });
        }
    }
}

// ============================================================================
// CODE TEMPLATES
// ============================================================================

export class CodeComplianceTemplates {
    
    /**
     * IS 800:2007 Steel Design Compliance
     */
    static createIS800Compliance(projectInfo: CodeComplianceData['projectInfo']): CodeComplianceData {
        return {
            code: 'IS_800_2007',
            codeName: 'IS 800:2007',
            edition: '2007 (Third Revision)',
            projectInfo,
            designParameters: [
                {
                    category: 'Material Properties',
                    parameters: [
                        { name: 'Steel Grade', value: 'E250 (Fe 410)' },
                        { name: 'Yield Strength (fy)', value: '250', unit: 'MPa' },
                        { name: 'Ultimate Strength (fu)', value: '410', unit: 'MPa' },
                        { name: 'Modulus of Elasticity (E)', value: '200000', unit: 'MPa' },
                    ]
                },
                {
                    category: 'Partial Safety Factors',
                    parameters: [
                        { name: 'γm0 (Yielding)', value: '1.10' },
                        { name: 'γm1 (Ultimate)', value: '1.25' },
                        { name: 'γmb (Bolts)', value: '1.25' },
                        { name: 'γmw (Welds)', value: '1.25' },
                    ]
                },
            ],
            sections: [
                {
                    sectionNumber: '3',
                    sectionTitle: 'General Design Requirements',
                    description: 'General requirements for analysis and design of steel structures',
                    checks: [
                        { clause: '3.7', title: 'Partial Safety Factors', requirement: 'γm0 = 1.10', designValue: '1.10', limitValue: '1.10', status: 'COMPLIANT' },
                        { clause: '3.8', title: 'Load Combinations', requirement: 'Per IS 800 Table 4', designValue: 'As specified', limitValue: '-', status: 'COMPLIANT' },
                    ],
                    overallStatus: 'COMPLIANT'
                },
                {
                    sectionNumber: '7',
                    sectionTitle: 'Design of Compression Members',
                    description: 'Compression members subjected to axial compression',
                    checks: [
                        { clause: '7.1.2', title: 'Slenderness Limit', requirement: 'λ ≤ 180', designValue: '85.2', limitValue: '180', status: 'COMPLIANT' },
                        { clause: '7.1.2.1', title: 'Buckling Class', requirement: 'Class b for welded', designValue: 'Class b', limitValue: '-', status: 'COMPLIANT' },
                        { clause: '7.2', title: 'Effective Length', requirement: 'Per Table 11', designValue: 'K = 1.0', limitValue: '-', status: 'COMPLIANT' },
                    ],
                    overallStatus: 'COMPLIANT'
                },
                {
                    sectionNumber: '8',
                    sectionTitle: 'Design of Members in Bending',
                    description: 'Flexural members subjected to bending',
                    checks: [
                        { clause: '8.2.1', title: 'Moment Capacity', requirement: 'Md ≥ Mu', designValue: '485 kN·m', limitValue: '423 kN·m', status: 'COMPLIANT' },
                        { clause: '8.4.1', title: 'Shear Capacity', requirement: 'Vd ≥ Vu', designValue: '890 kN', limitValue: '312 kN', status: 'COMPLIANT' },
                        { clause: '8.4.2', title: 'High Shear Check', requirement: 'V < 0.6Vd', designValue: '312 kN', limitValue: '534 kN', status: 'COMPLIANT' },
                    ],
                    overallStatus: 'COMPLIANT'
                },
                {
                    sectionNumber: '10',
                    sectionTitle: 'Connections',
                    description: 'Design of bolted and welded connections',
                    checks: [
                        { clause: '10.3.3', title: 'Bolt Shear Capacity', requirement: 'Vdsb ≥ Vsb', designValue: '45.3 kN', limitValue: '38.2 kN', status: 'COMPLIANT' },
                        { clause: '10.3.4', title: 'Bearing Capacity', requirement: 'Vdpb ≥ Vpb', designValue: '78.5 kN', limitValue: '38.2 kN', status: 'COMPLIANT' },
                        { clause: '10.5.7', title: 'Weld Strength', requirement: 'fwd ≥ fw', designValue: '189 MPa', limitValue: '156 MPa', status: 'COMPLIANT' },
                    ],
                    overallStatus: 'COMPLIANT'
                },
            ],
            summary: {
                totalChecks: 12,
                compliant: 12,
                nonCompliant: 0,
                partial: 0,
                notApplicable: 0
            }
        };
    }
    
    /**
     * IS 1893:2016 Seismic Design Compliance
     */
    static createIS1893Compliance(projectInfo: CodeComplianceData['projectInfo']): CodeComplianceData {
        return {
            code: 'IS_1893_2016',
            codeName: 'IS 1893:2016 (Part 1)',
            edition: '2016 (Sixth Revision)',
            projectInfo,
            designParameters: [
                {
                    category: 'Seismic Parameters',
                    parameters: [
                        { name: 'Seismic Zone', value: 'IV' },
                        { name: 'Zone Factor (Z)', value: '0.24' },
                        { name: 'Importance Factor (I)', value: '1.5' },
                        { name: 'Response Reduction (R)', value: '5.0' },
                        { name: 'Soil Type', value: 'Type II (Medium)' },
                    ]
                },
                {
                    category: 'Dynamic Properties',
                    parameters: [
                        { name: 'Fundamental Period (T)', value: '0.85', unit: 's' },
                        { name: 'Spectral Acceleration (Sa/g)', value: '2.5' },
                        { name: 'Design Horizontal Coefficient (Ah)', value: '0.09' },
                    ]
                },
            ],
            sections: [
                {
                    sectionNumber: '6',
                    sectionTitle: 'Design Lateral Forces',
                    description: 'Calculation of seismic design forces',
                    checks: [
                        { clause: '6.4.2', title: 'Design Spectrum', requirement: 'Sa/g per Fig. 2', designValue: '2.5', limitValue: '2.5', status: 'COMPLIANT' },
                        { clause: '6.4.2', title: 'Design Ah', requirement: '(Z/2) × (I/R) × (Sa/g)', designValue: '0.09', limitValue: '-', status: 'COMPLIANT' },
                        { clause: '7.1', title: 'Base Shear', requirement: 'VB = Ah × W', designValue: '1820 kN', limitValue: '-', status: 'COMPLIANT' },
                    ],
                    overallStatus: 'COMPLIANT'
                },
                {
                    sectionNumber: '7',
                    sectionTitle: 'Buildings with Soft Storey',
                    description: 'Special provisions for irregular buildings',
                    checks: [
                        { clause: '7.10', title: 'Soft Storey Check', requirement: 'Ki/Ki+1 ≥ 0.7', designValue: '0.92', limitValue: '0.7', status: 'COMPLIANT' },
                        { clause: '7.10', title: 'Mass Irregularity', requirement: 'Mi/Mi±1 ≤ 1.5', designValue: '1.12', limitValue: '1.5', status: 'COMPLIANT' },
                    ],
                    overallStatus: 'COMPLIANT'
                },
                {
                    sectionNumber: '7.11',
                    sectionTitle: 'Drift Limitations',
                    description: 'Storey drift under seismic loads',
                    checks: [
                        { clause: '7.11.1', title: 'Storey Drift', requirement: 'Δ/h ≤ 0.004', designValue: '0.0028', limitValue: '0.004', status: 'COMPLIANT' },
                        { clause: '7.11.2', title: 'Separation', requirement: 'R × Δmax', designValue: '75 mm', limitValue: '80 mm', status: 'COMPLIANT' },
                    ],
                    overallStatus: 'COMPLIANT'
                },
            ],
            summary: {
                totalChecks: 7,
                compliant: 7,
                nonCompliant: 0,
                partial: 0,
                notApplicable: 0
            }
        };
    }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createCodeComplianceReport(data: CodeComplianceData, settings?: Partial<ComplianceReportSettings>): CodeComplianceReportGenerator {
    return new CodeComplianceReportGenerator(data, settings);
}

export default CodeComplianceReportGenerator;
