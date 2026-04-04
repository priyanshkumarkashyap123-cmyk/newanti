/**
 * ============================================================================
 * CALCULATION SHEET GENERATOR
 * ============================================================================
 * 
 * Generates professional step-by-step calculation sheets for:
 * - Steel beam design
 * - Steel column design
 * - Bolted connections
 * - Welded connections
 * - Foundation design
 * - Seismic analysis
 * - Wind load calculations
 * 
 * @version 2.0.0
 */

import type { jsPDF as JsPDFType } from 'jspdf';
import { format } from 'date-fns';

// ============================================================================
// TYPES
// ============================================================================

export type CalculationType = 
    | 'steel_beam'
    | 'steel_column'
    | 'composite_beam'
    | 'bolted_connection'
    | 'welded_connection'
    | 'base_plate'
    | 'isolated_footing'
    | 'combined_footing'
    | 'seismic_analysis'
    | 'wind_analysis'
    | 'deflection_check';

export interface CalculationStep {
    stepNumber: number;
    title: string;
    description?: string;
    reference?: string;
    formula?: string;
    variables?: { symbol: string; description: string; value: string; unit?: string }[];
    calculation?: string;
    result: string;
    resultUnit?: string;
    status?: 'OK' | 'NG' | 'INFO' | 'WARNING';
    notes?: string[];
}

export interface CalculationSection {
    title: string;
    subtitle?: string;
    steps: CalculationStep[];
    conclusion?: {
        status: 'PASS' | 'FAIL' | 'WARNING';
        message: string;
    };
}

export interface CalculationSheetData {
    calculationType: CalculationType;
    title: string;
    projectName: string;
    projectNumber: string;
    calculatedBy: string;
    checkedBy?: string;
    date: Date;
    revision: string;
    
    inputData: {
        category: string;
        items: { label: string; value: string; unit?: string }[];
    }[];
    
    sections: CalculationSection[];
    
    finalResult: {
        status: 'ADEQUATE' | 'INADEQUATE' | 'MARGINAL';
        criticalRatio: number;
        summary: string;
    };
    
    references?: string[];
    assumptions?: string[];
    sketches?: { image: string; caption: string }[];
}

export interface SheetSettings {
    companyName: string;
    companyLogo?: string;
    pageSize: 'A4' | 'Letter';
    showGridLines: boolean;
    primaryColor: string;
    showStepNumbers: boolean;
}

// ============================================================================
// CALCULATION SHEET GENERATOR CLASS
// ============================================================================

export class CalculationSheetGenerator {
    private doc!: JsPDFType;
    private data: CalculationSheetData;
    private settings: SheetSettings;
    
    private pageWidth!: number;
    private pageHeight!: number;
    private margins = { top: 35, bottom: 20, left: 15, right: 15 };
    private contentWidth!: number;
    private currentY: number = 0;
    private pageNumber: number = 0;
    
    private primaryRgb: { r: number; g: number; b: number };
    
    constructor(data: CalculationSheetData, settings: Partial<SheetSettings> = {}) {
        this.data = data;
        this.settings = {
            companyName: 'Structural Engineering',
            pageSize: 'A4',
            showGridLines: true,
            primaryColor: '#1e3a8a',
            showStepNumbers: true,
            ...settings
        };
        
        this.primaryRgb = this.hexToRgb(this.settings.primaryColor);
    }
    
    private hexToRgb(hex: string): { r: number; g: number; b: number } {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 30, g: 58, b: 138 };
    }

    // ========================================================================
    // MAIN GENERATION
    // ========================================================================

    async generate(): Promise<Blob> {
        const { jsPDF } = await import('jspdf');
        await import('jspdf-autotable');

        this.doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: this.settings.pageSize.toLowerCase() as 'a4' | 'letter'
        });
        this.pageWidth = this.doc.internal.pageSize.getWidth();
        this.pageHeight = this.doc.internal.pageSize.getHeight();
        this.contentWidth = this.pageWidth - this.margins.left - this.margins.right;

        // First page
        this.addPage();
        this.renderHeader();
        this.renderInputData();
        
        // Assumptions if any
        if (this.data.assumptions && this.data.assumptions.length > 0) {
            this.renderAssumptions();
        }
        
        // Calculation sections
        this.data.sections.forEach((section, index) => {
            this.renderCalculationSection(section, index);
        });
        
        // Final result
        this.renderFinalResult();
        
        // References
        if (this.data.references && this.data.references.length > 0) {
            this.renderReferences();
        }
        
        // Add headers/footers to all pages
        this.addHeadersToAllPages();
        
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
        this.currentY = this.margins.top + 5;
        
        // Add grid lines if enabled
        if (this.settings.showGridLines) {
            this.addGridLines();
        }
    }

    private checkPageBreak(requiredHeight: number): void {
        if (this.currentY + requiredHeight > this.pageHeight - this.margins.bottom) {
            this.addPage();
        }
    }

    private addGridLines(): void {
        this.doc.setDrawColor(230, 230, 230);
        this.doc.setLineWidth(0.1);
        
        // Horizontal lines
        for (let y = 40; y < this.pageHeight - 20; y += 5) {
            this.doc.line(this.margins.left, y, this.pageWidth - this.margins.right, y);
        }
        
        // Vertical margin lines
        this.doc.setDrawColor(200, 200, 200);
        this.doc.line(this.margins.left, this.margins.top, this.margins.left, this.pageHeight - this.margins.bottom);
        this.doc.line(this.pageWidth - this.margins.right, this.margins.top, this.pageWidth - this.margins.right, this.pageHeight - this.margins.bottom);
    }

    // ========================================================================
    // HEADER SECTION
    // ========================================================================

    private renderHeader(): void {
        // Title block
        this.doc.setFillColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.rect(this.margins.left, this.margins.top - 25, this.contentWidth, 20, 'F');
        
        // Title
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('CALCULATION SHEET', this.margins.left + 5, this.margins.top - 15);
        
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(this.data.title.toUpperCase(), this.margins.left + 5, this.margins.top - 8);
        
        // Info box on right
        const infoBoxX = this.pageWidth - this.margins.right - 60;
        this.doc.setFillColor(255, 255, 255);
        this.doc.rect(infoBoxX, this.margins.top - 24, 58, 18, 'F');
        
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFontSize(7);
        this.doc.text(`Project: ${this.data.projectName}`, infoBoxX + 2, this.margins.top - 20);
        this.doc.text(`Job No: ${this.data.projectNumber}`, infoBoxX + 2, this.margins.top - 16);
        this.doc.text(`Calc By: ${this.data.calculatedBy}`, infoBoxX + 2, this.margins.top - 12);
        this.doc.text(`Date: ${format(this.data.date, 'dd/MM/yyyy')}`, infoBoxX + 2, this.margins.top - 8);
    }

    // ========================================================================
    // INPUT DATA
    // ========================================================================

    private renderInputData(): void {
        this.doc.setTextColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('INPUT DATA', this.margins.left, this.currentY);
        this.currentY += 5;
        
        this.data.inputData.forEach(category => {
            this.checkPageBreak(15 + category.items.length * 5);
            
            // Category header
            this.doc.setFillColor(240, 240, 250);
            this.doc.rect(this.margins.left, this.currentY - 3, this.contentWidth, 6, 'F');
            
            this.doc.setTextColor(60, 60, 60);
            this.doc.setFontSize(8);
            this.doc.setFont('helvetica', 'bold');
            this.doc.text(category.category.toUpperCase(), this.margins.left + 2, this.currentY);
            this.currentY += 5;
            
            // Items in two columns
            const halfWidth = this.contentWidth / 2;
            const items = category.items;
            
            for (let i = 0; i < items.length; i += 2) {
                this.doc.setFont('helvetica', 'normal');
                this.doc.setTextColor(0, 0, 0);
                this.doc.setFontSize(8);
                
                // Left column
                const item1 = items[i];
                this.doc.text(`${item1.label}:`, this.margins.left + 5, this.currentY);
                const value1 = item1.unit ? `${item1.value} ${item1.unit}` : item1.value;
                this.doc.setFont('helvetica', 'bold');
                this.doc.text(value1, this.margins.left + 50, this.currentY);
                
                // Right column
                if (items[i + 1]) {
                    const item2 = items[i + 1];
                    this.doc.setFont('helvetica', 'normal');
                    this.doc.text(`${item2.label}:`, this.margins.left + halfWidth + 5, this.currentY);
                    const value2 = item2.unit ? `${item2.value} ${item2.unit}` : item2.value;
                    this.doc.setFont('helvetica', 'bold');
                    this.doc.text(value2, this.margins.left + halfWidth + 50, this.currentY);
                }
                
                this.currentY += 4;
            }
            
            this.currentY += 3;
        });
        
        this.currentY += 5;
    }

    // ========================================================================
    // ASSUMPTIONS
    // ========================================================================

    private renderAssumptions(): void {
        this.checkPageBreak(20 + this.data.assumptions!.length * 4);
        
        this.doc.setFillColor(255, 250, 240);
        this.doc.setDrawColor(230, 180, 100);
        this.doc.setLineWidth(0.3);
        
        const height = 8 + this.data.assumptions!.length * 4;
        this.doc.roundedRect(this.margins.left, this.currentY, this.contentWidth, height, 2, 2, 'FD');
        
        this.doc.setTextColor(180, 120, 0);
        this.doc.setFontSize(8);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('ASSUMPTIONS:', this.margins.left + 3, this.currentY + 4);
        
        this.doc.setTextColor(80, 80, 80);
        this.doc.setFont('helvetica', 'normal');
        this.data.assumptions!.forEach((assumption, i) => {
            this.doc.text(`${i + 1}. ${assumption}`, this.margins.left + 5, this.currentY + 8 + i * 4);
        });
        
        this.currentY += height + 5;
    }

    // ========================================================================
    // CALCULATION SECTION
    // ========================================================================

    private renderCalculationSection(section: CalculationSection, sectionIndex: number): void {
        this.checkPageBreak(30);
        
        // Section header
        this.doc.setFillColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.rect(this.margins.left, this.currentY, this.contentWidth, 8, 'F');
        
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(`${sectionIndex + 1}. ${section.title.toUpperCase()}`, this.margins.left + 3, this.currentY + 5);
        
        if (section.subtitle) {
            this.doc.setFontSize(8);
            this.doc.setFont('helvetica', 'normal');
            this.doc.text(section.subtitle, this.margins.left + 80, this.currentY + 5);
        }
        
        this.currentY += 12;
        
        // Render each step
        section.steps.forEach(step => {
            this.renderCalculationStep(step);
        });
        
        // Section conclusion
        if (section.conclusion) {
            this.renderSectionConclusion(section.conclusion);
        }
        
        this.currentY += 5;
    }

    private renderCalculationStep(step: CalculationStep): void {
        const stepHeight = this.estimateStepHeight(step);
        this.checkPageBreak(stepHeight);
        
        const startY = this.currentY;
        
        // Step number and title
        if (this.settings.showStepNumbers) {
            this.doc.setFillColor(230, 240, 255);
            this.doc.circle(this.margins.left + 4, this.currentY + 1, 3, 'F');
            
            this.doc.setTextColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
            this.doc.setFontSize(7);
            this.doc.setFont('helvetica', 'bold');
            this.doc.text(String(step.stepNumber), this.margins.left + 2.5, this.currentY + 2);
        }
        
        // Title
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(step.title, this.margins.left + 10, this.currentY + 2);
        
        // Reference (right aligned)
        if (step.reference) {
            this.doc.setTextColor(100, 100, 100);
            this.doc.setFontSize(7);
            this.doc.setFont('helvetica', 'italic');
            this.doc.text(`[Ref: ${step.reference}]`, this.pageWidth - this.margins.right, this.currentY + 2, { align: 'right' });
        }
        
        this.currentY += 6;
        
        // Description
        if (step.description) {
            this.doc.setTextColor(80, 80, 80);
            this.doc.setFontSize(8);
            this.doc.setFont('helvetica', 'normal');
            const descLines = this.doc.splitTextToSize(step.description, this.contentWidth - 15);
            this.doc.text(descLines, this.margins.left + 10, this.currentY);
            this.currentY += descLines.length * 3.5 + 2;
        }
        
        // Formula (if any)
        if (step.formula) {
            this.doc.setFillColor(250, 250, 255);
            this.doc.setDrawColor(200, 200, 220);
            this.doc.setLineWidth(0.2);
            this.doc.roundedRect(this.margins.left + 10, this.currentY - 1, this.contentWidth - 20, 8, 1, 1, 'FD');
            
            this.doc.setTextColor(60, 60, 100);
            this.doc.setFontSize(9);
            this.doc.setFont('helvetica', 'bold');
            this.doc.text(step.formula, this.margins.left + 15, this.currentY + 4);
            this.currentY += 10;
        }
        
        // Variables table
        if (step.variables && step.variables.length > 0) {
            this.doc.setFontSize(7);
            this.doc.setFont('helvetica', 'normal');
            this.doc.setTextColor(60, 60, 60);
            
            this.doc.text('Where:', this.margins.left + 12, this.currentY);
            this.currentY += 3;
            
            step.variables.forEach(v => {
                const valueText = v.unit ? `${v.value} ${v.unit}` : v.value;
                this.doc.setFont('helvetica', 'bold');
                this.doc.text(v.symbol, this.margins.left + 18, this.currentY);
                this.doc.setFont('helvetica', 'normal');
                this.doc.text(`= ${v.description} = ${valueText}`, this.margins.left + 28, this.currentY);
                this.currentY += 3.5;
            });
            
            this.currentY += 2;
        }
        
        // Calculation line
        if (step.calculation) {
            this.doc.setTextColor(0, 0, 0);
            this.doc.setFontSize(8);
            this.doc.setFont('helvetica', 'normal');
            this.doc.text(step.calculation, this.margins.left + 10, this.currentY);
            this.currentY += 5;
        }
        
        // Result with status indicator
        this.doc.setFillColor(240, 248, 240);
        this.doc.setDrawColor(100, 180, 100);
        
        if (step.status === 'NG') {
            this.doc.setFillColor(255, 240, 240);
            this.doc.setDrawColor(220, 100, 100);
        } else if (step.status === 'WARNING') {
            this.doc.setFillColor(255, 250, 230);
            this.doc.setDrawColor(220, 180, 50);
        } else if (step.status === 'INFO') {
            this.doc.setFillColor(240, 248, 255);
            this.doc.setDrawColor(100, 150, 220);
        }
        
        this.doc.setLineWidth(0.3);
        this.doc.roundedRect(this.margins.left + 10, this.currentY, this.contentWidth - 20, 7, 1, 1, 'FD');
        
        // Result text
        const resultText = step.resultUnit ? `= ${step.result} ${step.resultUnit}` : `= ${step.result}`;
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(0, 0, 0);
        this.doc.text(resultText, this.margins.left + 15, this.currentY + 4.5);
        
        // Status badge
        if (step.status && step.status !== 'INFO') {
            const statusColors: Record<string, { bg: number[]; text: number[] }> = {
                'OK': { bg: [34, 197, 94], text: [255, 255, 255] },
                'NG': { bg: [239, 68, 68], text: [255, 255, 255] },
                'WARNING': { bg: [234, 179, 8], text: [255, 255, 255] }
            };
            
            const colors = statusColors[step.status];
            this.doc.setFillColor(colors.bg[0], colors.bg[1], colors.bg[2]);
            this.doc.roundedRect(this.pageWidth - this.margins.right - 25, this.currentY + 1, 15, 5, 1, 1, 'F');
            
            this.doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
            this.doc.setFontSize(6);
            this.doc.text(step.status, this.pageWidth - this.margins.right - 17.5, this.currentY + 4.5, { align: 'center' });
        }
        
        this.currentY += 10;
        
        // Notes
        if (step.notes && step.notes.length > 0) {
            this.doc.setTextColor(100, 100, 100);
            this.doc.setFontSize(7);
            this.doc.setFont('helvetica', 'italic');
            step.notes.forEach(note => {
                this.doc.text(`Note: ${note}`, this.margins.left + 12, this.currentY);
                this.currentY += 3;
            });
            this.currentY += 2;
        }
        
        // Separator line
        this.doc.setDrawColor(220, 220, 220);
        this.doc.setLineWidth(0.1);
        this.doc.line(this.margins.left + 10, this.currentY, this.pageWidth - this.margins.right - 10, this.currentY);
        this.currentY += 3;
    }

    private estimateStepHeight(step: CalculationStep): number {
        let height = 20; // Base height
        if (step.description) height += 10;
        if (step.formula) height += 12;
        if (step.variables) height += step.variables.length * 4;
        if (step.calculation) height += 6;
        if (step.notes) height += step.notes.length * 4;
        return height;
    }

    private renderSectionConclusion(conclusion: { status: 'PASS' | 'FAIL' | 'WARNING'; message: string }): void {
        this.checkPageBreak(15);
        
        const colors = {
            'PASS': { bg: [220, 252, 231], border: [34, 197, 94], text: [22, 101, 52] },
            'FAIL': { bg: [254, 226, 226], border: [239, 68, 68], text: [153, 27, 27] },
            'WARNING': { bg: [254, 249, 195], border: [234, 179, 8], text: [113, 63, 18] }
        };
        
        const c = colors[conclusion.status];
        
        this.doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
        this.doc.setDrawColor(c.border[0], c.border[1], c.border[2]);
        this.doc.setLineWidth(0.5);
        this.doc.roundedRect(this.margins.left + 10, this.currentY, this.contentWidth - 20, 10, 2, 2, 'FD');
        
        // Status icon
        const icon = conclusion.status === 'PASS' ? '✓' : conclusion.status === 'FAIL' ? '✗' : '⚠';
        this.doc.setTextColor(c.text[0], c.text[1], c.text[2]);
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(icon, this.margins.left + 15, this.currentY + 7);
        
        // Message
        this.doc.setFontSize(9);
        this.doc.text(conclusion.message, this.margins.left + 25, this.currentY + 6.5);
        
        this.currentY += 15;
    }

    // ========================================================================
    // FINAL RESULT
    // ========================================================================

    private renderFinalResult(): void {
        this.checkPageBreak(35);
        
        // Header
        this.doc.setFillColor(30, 30, 30);
        this.doc.rect(this.margins.left, this.currentY, this.contentWidth, 8, 'F');
        
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('DESIGN VERIFICATION SUMMARY', this.margins.left + 3, this.currentY + 5.5);
        this.currentY += 12;
        
        // Result box
        const statusColors = {
            'ADEQUATE': { bg: [220, 252, 231], border: [34, 197, 94], text: [22, 101, 52] },
            'INADEQUATE': { bg: [254, 226, 226], border: [239, 68, 68], text: [153, 27, 27] },
            'MARGINAL': { bg: [254, 249, 195], border: [234, 179, 8], text: [113, 63, 18] }
        };
        
        const c = statusColors[this.data.finalResult.status];
        
        this.doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
        this.doc.setDrawColor(c.border[0], c.border[1], c.border[2]);
        this.doc.setLineWidth(1);
        this.doc.roundedRect(this.margins.left, this.currentY, this.contentWidth, 22, 3, 3, 'FD');
        
        // Status text
        this.doc.setTextColor(c.text[0], c.text[1], c.text[2]);
        this.doc.setFontSize(14);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(`DESIGN ${this.data.finalResult.status}`, this.margins.left + 10, this.currentY + 8);
        
        // Utilization
        const utilizationPercent = (this.data.finalResult.criticalRatio * 100).toFixed(1);
        this.doc.setFontSize(10);
        this.doc.text(`Critical Utilization: ${utilizationPercent}%`, this.margins.left + 10, this.currentY + 15);
        
        // Utilization bar
        const barWidth = 60;
        const barX = this.margins.left + this.contentWidth - barWidth - 10;
        
        this.doc.setFillColor(220, 220, 220);
        this.doc.roundedRect(barX, this.currentY + 6, barWidth, 6, 1, 1, 'F');
        
        const fillWidth = Math.min(barWidth * this.data.finalResult.criticalRatio, barWidth);
        const barColor = this.data.finalResult.criticalRatio <= 0.85 ? [34, 197, 94] : 
                        this.data.finalResult.criticalRatio <= 1.0 ? [234, 179, 8] : [239, 68, 68];
        this.doc.setFillColor(barColor[0], barColor[1], barColor[2]);
        this.doc.roundedRect(barX, this.currentY + 6, fillWidth, 6, 1, 1, 'F');
        
        this.doc.setTextColor(50, 50, 50);
        this.doc.setFontSize(8);
        this.doc.text(`${utilizationPercent}%`, barX + barWidth / 2, this.currentY + 18, { align: 'center' });
        
        this.currentY += 28;
        
        // Summary
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        const summaryLines = this.doc.splitTextToSize(this.data.finalResult.summary, this.contentWidth - 10);
        this.doc.text(summaryLines, this.margins.left + 5, this.currentY);
        this.currentY += summaryLines.length * 4 + 10;
    }

    // ========================================================================
    // REFERENCES
    // ========================================================================

    private renderReferences(): void {
        this.checkPageBreak(20 + this.data.references!.length * 4);
        
        this.doc.setTextColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('REFERENCES:', this.margins.left, this.currentY);
        this.currentY += 5;
        
        this.doc.setTextColor(60, 60, 60);
        this.doc.setFontSize(8);
        this.doc.setFont('helvetica', 'normal');
        
        this.data.references!.forEach((ref, i) => {
            this.doc.text(`[${i + 1}] ${ref}`, this.margins.left + 5, this.currentY);
            this.currentY += 4;
        });
    }

    // ========================================================================
    // PAGE HEADERS/FOOTERS
    // ========================================================================

    private addHeadersToAllPages(): void {
        const totalPages = this.doc.getNumberOfPages();
        
        for (let i = 1; i <= totalPages; i++) {
            this.doc.setPage(i);
            
            // Only add continuation header for pages after first
            if (i > 1) {
                // Top header bar
                this.doc.setFillColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
                this.doc.rect(this.margins.left, 10, this.contentWidth, 15, 'F');
                
                this.doc.setTextColor(255, 255, 255);
                this.doc.setFontSize(9);
                this.doc.setFont('helvetica', 'bold');
                this.doc.text(`${this.data.title} (Continued)`, this.margins.left + 5, 19);
                
                this.doc.setFontSize(7);
                this.doc.setFont('helvetica', 'normal');
                this.doc.text(`Project: ${this.data.projectName} | Job: ${this.data.projectNumber}`, this.pageWidth - this.margins.right, 19, { align: 'right' });
            }
            
            // Footer
            this.doc.setDrawColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
            this.doc.setLineWidth(0.5);
            this.doc.line(this.margins.left, this.pageHeight - 15, this.pageWidth - this.margins.right, this.pageHeight - 15);
            
            this.doc.setTextColor(100, 100, 100);
            this.doc.setFontSize(7);
            this.doc.setFont('helvetica', 'normal');
            
            this.doc.text(this.settings.companyName, this.margins.left, this.pageHeight - 10);
            this.doc.text(`Page ${i} of ${totalPages}`, this.pageWidth / 2, this.pageHeight - 10, { align: 'center' });
            this.doc.text(`Rev. ${this.data.revision}`, this.pageWidth - this.margins.right, this.pageHeight - 10, { align: 'right' });
        }
    }
}

// ============================================================================
// PRESET CALCULATION TEMPLATES
// ============================================================================

export class CalculationTemplates {
    
    /**
     * Steel Beam Design Calculation
     */
    static steelBeamDesign(params: {
        beamId: string;
        section: string;
        span: number;
        fy: number;
        factored_moment: number;
        factored_shear: number;
        Zp: number;
        Av: number;
        deflection_actual: number;
        deflection_limit: number;
    }): CalculationSection {
        const { beamId, section, span, fy, factored_moment, factored_shear, Zp, Av, deflection_actual, deflection_limit } = params;
        
        // Calculations
        const gamma_m0 = 1.1;
        const Md = (Zp * fy) / (gamma_m0 * 1e6);
        const moment_ratio = factored_moment / Md;
        
        const fyw = fy;
        const Vd = (Av * fyw) / (Math.sqrt(3) * gamma_m0 * 1e3);
        const shear_ratio = factored_shear / Vd;
        
        const deflection_ratio = deflection_actual / deflection_limit;
        
        return {
            title: `BEAM DESIGN - ${beamId}`,
            subtitle: section,
            steps: [
                {
                    stepNumber: 1,
                    title: 'Moment Capacity Check',
                    reference: 'IS 800:2007, Cl. 8.2.1',
                    formula: 'Md = βb × Zp × fy / γm0',
                    variables: [
                        { symbol: 'βb', description: 'Beam factor', value: '1.0' },
                        { symbol: 'Zp', description: 'Plastic section modulus', value: Zp.toFixed(0), unit: 'mm³' },
                        { symbol: 'fy', description: 'Yield strength', value: String(fy), unit: 'MPa' },
                        { symbol: 'γm0', description: 'Partial safety factor', value: String(gamma_m0) },
                    ],
                    calculation: `Md = 1.0 × ${Zp.toFixed(0)} × ${fy} / (${gamma_m0} × 10⁶)`,
                    result: Md.toFixed(2),
                    resultUnit: 'kN·m',
                    status: moment_ratio <= 1.0 ? 'OK' : 'NG',
                    notes: [`Utilization: ${(moment_ratio * 100).toFixed(1)}% (Mu = ${factored_moment.toFixed(2)} kN·m)`]
                },
                {
                    stepNumber: 2,
                    title: 'Shear Capacity Check',
                    reference: 'IS 800:2007, Cl. 8.4.1',
                    formula: 'Vd = Av × fyw / (√3 × γm0)',
                    variables: [
                        { symbol: 'Av', description: 'Shear area', value: Av.toFixed(0), unit: 'mm²' },
                        { symbol: 'fyw', description: 'Yield strength of web', value: String(fyw), unit: 'MPa' },
                    ],
                    calculation: `Vd = ${Av.toFixed(0)} × ${fyw} / (√3 × ${gamma_m0} × 10³)`,
                    result: Vd.toFixed(2),
                    resultUnit: 'kN',
                    status: shear_ratio <= 1.0 ? 'OK' : 'NG',
                    notes: [`Utilization: ${(shear_ratio * 100).toFixed(1)}% (Vu = ${factored_shear.toFixed(2)} kN)`]
                },
                {
                    stepNumber: 3,
                    title: 'Deflection Check',
                    reference: 'IS 800:2007, Cl. 5.6',
                    description: 'Check serviceability limit for deflection',
                    calculation: `δ_actual / δ_allowable = ${deflection_actual.toFixed(2)} / ${deflection_limit.toFixed(2)}`,
                    result: `${deflection_actual.toFixed(2)} mm ≤ ${deflection_limit.toFixed(2)} mm`,
                    status: deflection_ratio <= 1.0 ? 'OK' : 'NG',
                    notes: [`Span/Deflection ratio: L/${Math.floor(span * 1000 / deflection_actual)}`]
                }
            ],
            conclusion: {
                status: (moment_ratio <= 1.0 && shear_ratio <= 1.0 && deflection_ratio <= 1.0) ? 'PASS' : 'FAIL',
                message: `${section} beam is ${(moment_ratio <= 1.0 && shear_ratio <= 1.0 && deflection_ratio <= 1.0) ? 'ADEQUATE' : 'INADEQUATE'} for the applied loads`
            }
        };
    }
    
    /**
     * Steel Column Design Calculation
     */
    static steelColumnDesign(params: {
        columnId: string;
        section: string;
        height: number;
        fy: number;
        axial_load: number;
        moment_x: number;
        moment_y: number;
        A: number;
        Zx: number;
        Zy: number;
        rx: number;
        ry: number;
        Kx: number;
        Ky: number;
    }): CalculationSection {
        const { columnId, section, height, fy, axial_load, moment_x, moment_y, A, Zx, Zy, rx, ry, Kx, Ky } = params;
        
        const gamma_m0 = 1.1;
        const E = 200000; // MPa
        
        // Slenderness
        const lambda_x = (Kx * height * 1000) / rx;
        const lambda_y = (Ky * height * 1000) / ry;
        const lambda_max = Math.max(lambda_x, lambda_y);
        
        // Euler buckling
        const lambda_1 = Math.PI * Math.sqrt(E / fy);
        const lambda_bar = lambda_max / lambda_1;
        
        // Compression capacity (simplified)
        const alpha = 0.49; // Buckling curve 'b'
        const phi = 0.5 * (1 + alpha * (lambda_bar - 0.2) + lambda_bar * lambda_bar);
        const chi = 1 / (phi + Math.sqrt(phi * phi - lambda_bar * lambda_bar));
        const Pd = (chi * A * fy) / (gamma_m0 * 1000);
        
        // Moment capacity
        const Mdx = (Zx * fy) / (gamma_m0 * 1e6);
        const Mdy = (Zy * fy) / (gamma_m0 * 1e6);
        
        // Combined check
        const combined_ratio = (axial_load / Pd) + (moment_x / Mdx) + (moment_y / Mdy);
        
        return {
            title: `COLUMN DESIGN - ${columnId}`,
            subtitle: section,
            steps: [
                {
                    stepNumber: 1,
                    title: 'Slenderness Ratio Check',
                    reference: 'IS 800:2007, Cl. 7.2',
                    formula: 'λ = KL / r',
                    variables: [
                        { symbol: 'Kx', description: 'Effective length factor (major)', value: String(Kx) },
                        { symbol: 'Ky', description: 'Effective length factor (minor)', value: String(Ky) },
                        { symbol: 'L', description: 'Column height', value: String(height), unit: 'm' },
                        { symbol: 'rx', description: 'Radius of gyration (major)', value: rx.toFixed(1), unit: 'mm' },
                        { symbol: 'ry', description: 'Radius of gyration (minor)', value: ry.toFixed(1), unit: 'mm' },
                    ],
                    calculation: `λx = ${Kx} × ${height * 1000} / ${rx.toFixed(1)} = ${lambda_x.toFixed(1)}\nλy = ${Ky} × ${height * 1000} / ${ry.toFixed(1)} = ${lambda_y.toFixed(1)}`,
                    result: `λmax = ${lambda_max.toFixed(1)}`,
                    status: lambda_max <= 180 ? 'OK' : 'NG',
                    notes: ['Maximum slenderness limit = 180 for compression members']
                },
                {
                    stepNumber: 2,
                    title: 'Axial Compression Capacity',
                    reference: 'IS 800:2007, Cl. 7.1',
                    formula: 'Pd = χ × A × fy / γm0',
                    variables: [
                        { symbol: 'χ', description: 'Buckling reduction factor', value: chi.toFixed(3) },
                        { symbol: 'A', description: 'Cross-sectional area', value: A.toFixed(0), unit: 'mm²' },
                        { symbol: 'λ̄', description: 'Non-dimensional slenderness', value: lambda_bar.toFixed(3) },
                    ],
                    calculation: `Pd = ${chi.toFixed(3)} × ${A.toFixed(0)} × ${fy} / (${gamma_m0} × 1000)`,
                    result: Pd.toFixed(2),
                    resultUnit: 'kN',
                    status: axial_load / Pd <= 1.0 ? 'OK' : 'NG',
                    notes: [`Axial utilization: ${((axial_load / Pd) * 100).toFixed(1)}%`]
                },
                {
                    stepNumber: 3,
                    title: 'Combined Axial + Bending Check',
                    reference: 'IS 800:2007, Cl. 9.3',
                    formula: 'N/Nd + Mx/Mdx + My/Mdy ≤ 1.0',
                    variables: [
                        { symbol: 'N', description: 'Factored axial load', value: axial_load.toFixed(1), unit: 'kN' },
                        { symbol: 'Mx', description: 'Factored moment (major)', value: moment_x.toFixed(1), unit: 'kN·m' },
                        { symbol: 'My', description: 'Factored moment (minor)', value: moment_y.toFixed(1), unit: 'kN·m' },
                    ],
                    calculation: `${axial_load.toFixed(1)}/${Pd.toFixed(1)} + ${moment_x.toFixed(1)}/${Mdx.toFixed(1)} + ${moment_y.toFixed(1)}/${Mdy.toFixed(1)}`,
                    result: combined_ratio.toFixed(3),
                    status: combined_ratio <= 1.0 ? 'OK' : 'NG',
                    notes: [`Combined utilization: ${(combined_ratio * 100).toFixed(1)}%`]
                }
            ],
            conclusion: {
                status: combined_ratio <= 1.0 ? 'PASS' : 'FAIL',
                message: `${section} column is ${combined_ratio <= 1.0 ? 'ADEQUATE' : 'INADEQUATE'} for combined loading`
            }
        };
    }
    
    /**
     * Bolted Connection Design
     */
    static boltedConnectionDesign(params: {
        connectionId: string;
        bolt_dia: number;
        bolt_grade: string;
        num_bolts: number;
        plate_thick: number;
        fy_plate: number;
        fu_bolt: number;
        applied_shear: number;
        applied_tension?: number;
    }): CalculationSection {
        const { connectionId, bolt_dia, bolt_grade, num_bolts, plate_thick, fy_plate, fu_bolt, applied_shear, applied_tension = 0 } = params;
        
        const gamma_mb = 1.25;
        const gamma_m0 = 1.1;
        
        // Bolt calculations
        const Ab = Math.PI * bolt_dia * bolt_dia / 4; // Gross area
        const An = 0.78 * Ab; // Net tensile area
        
        // Shear capacity per bolt (single shear)
        const Vdsb = (fu_bolt * An) / (Math.sqrt(3) * gamma_mb * 1000);
        const Vds_total = Vdsb * num_bolts;
        
        // Bearing capacity per bolt
        const kb = Math.min(2.5 * bolt_dia / (3 * bolt_dia), 2.5 * bolt_dia / bolt_dia - 0.5, fu_bolt / 410, 1.0);
        const Vdpb = (2.5 * kb * bolt_dia * plate_thick * fu_bolt) / (gamma_mb * 1000);
        const Vdp_total = Vdpb * num_bolts;
        
        // Governing shear capacity
        const Vd = Math.min(Vds_total, Vdp_total);
        const shear_ratio = applied_shear / Vd;
        
        // Tension capacity per bolt
        const Tdb = (0.9 * fu_bolt * An) / (gamma_mb * 1000);
        const Td_total = Tdb * num_bolts;
        const tension_ratio = applied_tension / Td_total;
        
        // Combined shear + tension
        const combined = Math.pow(applied_shear / Vd, 2) + Math.pow(applied_tension / Td_total, 2);
        
        return {
            title: `BOLTED CONNECTION - ${connectionId}`,
            subtitle: `${num_bolts} × M${bolt_dia} Grade ${bolt_grade}`,
            steps: [
                {
                    stepNumber: 1,
                    title: 'Bolt Shear Capacity',
                    reference: 'IS 800:2007, Cl. 10.3.3',
                    formula: 'Vdsb = fu × Anb / (√3 × γmb)',
                    variables: [
                        { symbol: 'fu', description: 'Ultimate strength of bolt', value: String(fu_bolt), unit: 'MPa' },
                        { symbol: 'Anb', description: 'Net tensile area', value: An.toFixed(1), unit: 'mm²' },
                        { symbol: 'γmb', description: 'Partial safety factor', value: String(gamma_mb) },
                    ],
                    calculation: `Vdsb = ${fu_bolt} × ${An.toFixed(1)} / (√3 × ${gamma_mb} × 1000) = ${Vdsb.toFixed(2)} kN\nTotal = ${num_bolts} × ${Vdsb.toFixed(2)} = ${Vds_total.toFixed(2)} kN`,
                    result: Vds_total.toFixed(2),
                    resultUnit: 'kN',
                    status: 'INFO'
                },
                {
                    stepNumber: 2,
                    title: 'Bearing Capacity',
                    reference: 'IS 800:2007, Cl. 10.3.4',
                    formula: 'Vdpb = 2.5 × kb × d × t × fu / γmb',
                    variables: [
                        { symbol: 'kb', description: 'Bearing factor', value: kb.toFixed(3) },
                        { symbol: 'd', description: 'Bolt diameter', value: String(bolt_dia), unit: 'mm' },
                        { symbol: 't', description: 'Plate thickness', value: String(plate_thick), unit: 'mm' },
                    ],
                    calculation: `Vdpb = 2.5 × ${kb.toFixed(3)} × ${bolt_dia} × ${plate_thick} × ${fu_bolt} / ${gamma_mb}`,
                    result: Vdp_total.toFixed(2),
                    resultUnit: 'kN',
                    status: 'INFO'
                },
                {
                    stepNumber: 3,
                    title: 'Shear Check',
                    description: 'Governing shear capacity (minimum of bolt shear and bearing)',
                    calculation: `Vd = min(${Vds_total.toFixed(2)}, ${Vdp_total.toFixed(2)}) = ${Vd.toFixed(2)} kN`,
                    result: `${applied_shear.toFixed(2)} kN ≤ ${Vd.toFixed(2)} kN`,
                    status: shear_ratio <= 1.0 ? 'OK' : 'NG',
                    notes: [`Shear utilization: ${(shear_ratio * 100).toFixed(1)}%`]
                },
                ...(applied_tension > 0 ? [{
                    stepNumber: 4,
                    title: 'Combined Shear + Tension',
                    reference: 'IS 800:2007, Cl. 10.3.6',
                    formula: '(V/Vd)² + (T/Td)² ≤ 1.0',
                    calculation: `(${applied_shear.toFixed(2)}/${Vd.toFixed(2)})² + (${applied_tension.toFixed(2)}/${Td_total.toFixed(2)})²`,
                    result: combined.toFixed(3),
                    status: combined <= 1.0 ? 'OK' as const : 'NG' as const,
                    notes: [`Combined utilization: ${(Math.sqrt(combined) * 100).toFixed(1)}%`]
                }] : [])
            ],
            conclusion: {
                status: (shear_ratio <= 1.0 && combined <= 1.0) ? 'PASS' : 'FAIL',
                message: `Connection is ${(shear_ratio <= 1.0 && combined <= 1.0) ? 'ADEQUATE' : 'INADEQUATE'} for applied forces`
            }
        };
    }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createCalculationSheet(data: CalculationSheetData, settings?: Partial<SheetSettings>): CalculationSheetGenerator {
    return new CalculationSheetGenerator(data, settings);
}

export default CalculationSheetGenerator;
