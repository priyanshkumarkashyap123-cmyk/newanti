/**
 * ============================================================================
 * DETAILED REPORT ENGINE
 * ============================================================================
 * 
 * Professional structural engineering report generation engine with:
 * - Comprehensive calculation sheets
 * - Code compliance documentation
 * - Member-by-member design checks
 * - Load path verification
 * - Connection design summaries
 * - Foundation design details
 * - Quality assurance checklists
 * - Digital signatures
 * - Revision control
 * 
 * @version 3.0.0
 */

import type { jsPDF as JsPDFType } from 'jspdf';
import { format } from 'date-fns';
import {
    REPORT_DISCLAIMER,
    REASONABLE_CARE_STATEMENT,
    applyStatusCellStyle,
} from './reportSections/reportSectionHelpers';
import { renderCoverSection } from './reportSections/CoverSection';
import { renderExecutiveSummarySection } from './reportSections/ExecutiveSummarySection';
import { renderDesignCriteriaSection } from './reportSections/DesignCriteriaSection';
import { renderMaterialsSection } from './reportSections/MaterialsSection';
import { renderLoadingSection } from './reportSections/LoadingSection';
import { renderAnalysisResultsSection } from './reportSections/AnalysisResultsSection';
import { renderMemberDesignSection } from './reportSections/MemberDesignSection';
import { renderConnectionDesignSection } from './reportSections/ConnectionDesignSection';
import { renderFoundationDesignSection } from './reportSections/FoundationDesignSection';
import { renderQualityAssuranceSection } from './reportSections/QualityAssuranceSection';
import { renderConclusionsSection } from './reportSections/ConclusionsSection';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type DesignCode = 
    | 'IS 800:2007' 
    | 'IS 456:2000' 
    | 'IS 1893:2016'
    | 'IS 13920:2016'
    | 'AISC 360-16' 
    | 'ACI 318-19'
    | 'ASCE 7-22'
    | 'Eurocode 3'
    | 'Eurocode 2'
    | 'BS 5950'
    | 'CSA S16-19'
    | 'AS 4100';

export type CheckStatus = 'PASS' | 'FAIL' | 'WARNING' | 'NOT_APPLICABLE';

export interface ProjectDetails {
    name: string;
    number: string;
    client: string;
    location: string;
    structureType: string;
    occupancy: string;
    designLife: number;
    importanceFactor: number;
    seismicZone?: string;
    windZone?: string;
    description: string;
}

export interface EngineerDetails {
    designEngineer: {
        name: string;
        license?: string;
        email?: string;
    };
    checker?: {
        name: string;
        license?: string;
        date?: Date;
    };
    approver?: {
        name: string;
        license?: string;
        date?: Date;
    };
}

export interface CompanyDetails {
    name: string;
    address: string;
    phone: string;
    email: string;
    website?: string;
    logo?: string;
    license?: string;
}

export interface DesignCriteria {
    codes: DesignCode[];
    loadFactors: Record<string, number>;
    materialFactors: Record<string, number>;
    deflectionLimits: {
        live: string;
        total: string;
        drift: string;
    };
    serviceabilityLimits: {
        vibration?: string;
        cracking?: string;
    };
}

export interface MaterialData {
    steel: {
        grade: string;
        fy: number;
        fu: number;
        E: number;
        density: number;
    }[];
    concrete: {
        grade: string;
        fck: number;
        Ec: number;
        density: number;
    }[];
    rebar: {
        grade: string;
        fy: number;
    }[];
}

export interface LoadSummary {
    deadLoads: {
        description: string;
        value: number;
        unit: string;
        location: string;
    }[];
    liveLoads: {
        description: string;
        value: number;
        unit: string;
        occupancy: string;
    }[];
    windLoads?: {
        basicSpeed: number;
        exposure: string;
        pressures: { zone: string; pressure: number }[];
    };
    seismicLoads?: {
        zone: string;
        soilType: string;
        R: number;
        I: number;
        baseShear: number;
        storyForces: { level: string; force: number; height: number }[];
    };
}

export interface MemberDesignResult {
    id: string;
    name: string;
    type: 'beam' | 'column' | 'brace' | 'slab' | 'wall' | 'footing';
    section: string;
    material: string;
    length: number;
    
    // Forces
    axial: { max: number; min: number; loadCase: string };
    shear: { maxY: number; maxZ: number; loadCase: string };
    moment: { maxY: number; maxZ: number; loadCase: string };
    torsion?: { max: number; loadCase: string };
    
    // Design checks
    checks: {
        name: string;
        clause: string;
        capacity: number;
        demand: number;
        ratio: number;
        status: CheckStatus;
        governing: boolean;
    }[];
    
    // Summary
    criticalRatio: number;
    criticalCheck: string;
    overallStatus: CheckStatus;
    notes?: string;
}

export interface ConnectionDesignResult {
    id: string;
    type: string;
    members: string[];
    category: 'moment' | 'shear' | 'axial' | 'combined';
    
    design: {
        bolts?: { size: string; grade: string; quantity: number; pattern: string };
        welds?: { type: string; size: number; length: number };
        plates?: { thickness: number; grade: string }[];
    };
    
    checks: {
        name: string;
        capacity: number;
        demand: number;
        ratio: number;
        status: CheckStatus;
    }[];
    
    overallStatus: CheckStatus;
    sketch?: string;
}

export interface FoundationDesignResult {
    id: string;
    type: 'isolated' | 'combined' | 'mat' | 'pile' | 'strip';
    column: string;
    
    geometry: {
        length: number;
        width: number;
        depth: number;
        pedestal?: { length: number; width: number; height: number };
    };
    
    loads: {
        axial: number;
        momentX: number;
        momentY: number;
        shear: number;
    };
    
    soilParameters: {
        bearingCapacity: number;
        soilType: string;
        waterTable?: number;
    };
    
    reinforcement: {
        bottomX: string;
        bottomY: string;
        topX?: string;
        topY?: string;
    };
    
    checks: {
        name: string;
        allowable: number;
        actual: number;
        ratio: number;
        status: CheckStatus;
    }[];
    
    overallStatus: CheckStatus;
}

export interface AnalysisResultsSummary {
    maxDisplacement: { value: number; node: string; direction: string; loadCase: string };
    maxDrift: { value: number; story: string; loadCase: string };
    maxReaction: { value: number; support: string; direction: string; loadCase: string };
    fundamentalPeriod?: { T1: number; T2: number; T3: number };
    massParticipation?: { x: number; y: number; rz: number };
    basesShear?: { x: number; y: number };
}

export interface QualityCheckItem {
    category: string;
    item: string;
    requirement: string;
    actual: string;
    status: CheckStatus;
    reference: string;
}

export interface ReportData {
    project: ProjectDetails;
    engineer: EngineerDetails;
    company: CompanyDetails;
    criteria: DesignCriteria;
    materials: MaterialData;
    loads: LoadSummary;
    analysisSummary: AnalysisResultsSummary;
    memberDesigns: MemberDesignResult[];
    connectionDesigns: ConnectionDesignResult[];
    foundationDesigns: FoundationDesignResult[];
    qualityChecks: QualityCheckItem[];
    images: {
        model3D?: string;
        plans?: string[];
        elevations?: string[];
        diagrams?: { type: string; image: string; caption: string }[];
    };
}

export interface ReportSettings {
    title: string;
    subtitle?: string;
    revision: string;
    date: Date;
    confidential: boolean;
    watermark?: string;
    includeCalculations: boolean;
    includeDrawings: boolean;
    pageSize: 'A4' | 'Letter';
    orientation: 'portrait' | 'landscape';
    primaryColor: string;
    accentColor: string;
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
};

// ============================================================================
// DETAILED REPORT ENGINE CLASS
// ============================================================================

export class DetailedReportEngine {
    private doc!: JsPDFType;
    private data: ReportData;
    private settings: ReportSettings;
    
    private pageWidth!: number;
    private pageHeight!: number;
    private margins = { top: 25, bottom: 25, left: 20, right: 20 };
    private contentWidth!: number;
    private currentY!: number;
    private pageNumber: number = 0;
    private sectionNumber: number = 0;
    private tableNumber: number = 0;
    private figureNumber: number = 0;
    
    private tocEntries: { title: string; page: number; level: number }[] = [];
    private primaryRgb: { r: number; g: number; b: number };
    private accentRgb: { r: number; g: number; b: number };
    private autoTable!: (doc: any, options: any) => void;

    constructor(data: ReportData, settings: ReportSettings) {
        this.data = data;
        this.settings = settings;
        
        this.primaryRgb = hexToRgb(settings.primaryColor);
        this.accentRgb = hexToRgb(settings.accentColor);
    }

    // ========================================================================
    // MAIN GENERATION
    // ========================================================================

    async generate(): Promise<Blob> {
        const { jsPDF } = await import('jspdf');
        this.autoTable = (await import('jspdf-autotable')).default;

        this.doc = new jsPDF({
            orientation: this.settings.orientation,
            unit: 'mm',
            format: this.settings.pageSize.toLowerCase() as 'a4' | 'letter'
        });
        this.pageWidth = this.doc.internal.pageSize.getWidth();
        this.pageHeight = this.doc.internal.pageSize.getHeight();
        this.contentWidth = this.pageWidth - this.margins.left - this.margins.right;
        this.currentY = this.margins.top;

        // Cover page
        renderCoverSection(this);
        
        // Table of Contents placeholder
        this.addPage();
        const tocPage = this.pageNumber;
        this.renderTableOfContentsPlaceholder();
        
        // Executive Summary
        this.addPage();
        renderExecutiveSummarySection(this);
        
        // Design Criteria
        this.addPage();
        renderDesignCriteriaSection(this);
        
        // Materials
        this.addPage();
        renderMaterialsSection(this);
        
        // Loading
        this.addPage();
        renderLoadingSection(this);
        
        // Analysis Results
        this.addPage();
        renderAnalysisResultsSection(this);
        
        // Member Design
        this.addPage();
        renderMemberDesignSection(this);
        
        // Connection Design
        if (this.data.connectionDesigns.length > 0) {
            this.addPage();
            renderConnectionDesignSection(this);
        }
        
        // Foundation Design
        if (this.data.foundationDesigns.length > 0) {
            this.addPage();
            renderFoundationDesignSection(this);
        }
        
        // Quality Assurance
        this.addPage();
        renderQualityAssuranceSection(this);
        
        // Conclusions & Recommendations
        this.addPage();
        renderConclusionsSection(this);
        
        // Update TOC
        this.updateTableOfContents(tocPage);
        
        // Add watermark if needed
        if (this.settings.watermark) {
            this.addWatermarkToAllPages();
        }
        
        // Add headers and footers to all pages
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
        this.currentY = this.margins.top + 15; // Leave space for header
    }

    private checkPageBreak(requiredHeight: number): void {
        const availableHeight = this.pageHeight - this.margins.bottom - this.currentY;
        if (availableHeight < requiredHeight) {
            this.addPage();
        }
    }

    private renderTableOfContentsPlaceholder(): void {
        this.sectionNumber = 0;
        this.addTocEntry('TABLE OF CONTENTS', 0);
        
        this.doc.setTextColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.setFontSize(18);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('TABLE OF CONTENTS', this.margins.left, this.currentY);
        this.currentY += 15;
        
        // Will be updated after all sections are rendered
        this.doc.setTextColor(150, 150, 150);
        this.doc.setFontSize(10);
        this.doc.text('(Page numbers will be updated)', this.margins.left, this.currentY);
    }

    private addTocEntry(title: string, level: number): void {
        this.tocEntries.push({ title, page: this.pageNumber, level });
    }

    private updateTableOfContents(tocPage: number): void {
        this.doc.setPage(tocPage);
        
        let y = this.margins.top + 30;
        
        this.tocEntries.forEach((entry, index) => {
            if (index === 0) return; // Skip TOC itself
            
            const indent = entry.level * 10;
            this.doc.setFontSize(entry.level === 1 ? 11 : 10);
            this.doc.setFont('helvetica', entry.level === 1 ? 'bold' : 'normal');
            this.doc.setTextColor(0, 0, 0);
            
            // Title
            this.doc.text(entry.title, this.margins.left + indent, y);
            
            // Dots
            const titleWidth = this.doc.getTextWidth(entry.title);
            const pageNumWidth = this.doc.getTextWidth(String(entry.page));
            const dotsStart = this.margins.left + indent + titleWidth + 2;
            const dotsEnd = this.pageWidth - this.margins.right - pageNumWidth - 2;
            
            this.doc.setTextColor(180, 180, 180);
            let dotX = dotsStart;
            while (dotX < dotsEnd) {
                this.doc.text('.', dotX, y);
                dotX += 2;
            }
            
            // Page number
            this.doc.setTextColor(0, 0, 0);
            this.doc.text(String(entry.page), this.pageWidth - this.margins.right, y, { align: 'right' });
            
            y += entry.level === 1 ? 8 : 6;
        });
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    private renderSectionHeader(title: string): void {
        this.doc.setFillColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.rect(this.margins.left, this.currentY - 5, this.contentWidth, 10, 'F');
        
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFontSize(14);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(`${this.sectionNumber}. ${title}`, this.margins.left + 5, this.currentY + 2);
        
        this.currentY += 15;
    }

    private renderSubsectionHeader(title: string): void {
        this.doc.setTextColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(title, this.margins.left, this.currentY);
        
        this.doc.setDrawColor(this.accentRgb.r, this.accentRgb.g, this.accentRgb.b);
        this.doc.setLineWidth(0.5);
        this.doc.line(this.margins.left, this.currentY + 2, this.margins.left + this.doc.getTextWidth(title), this.currentY + 2);
        
        this.currentY += 8;
    }

    private renderParagraph(text: string): void {
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(0, 0, 0);
        
        const lines = this.doc.splitTextToSize(text, this.contentWidth);
        this.doc.text(lines, this.margins.left, this.currentY);
        this.currentY += lines.length * 5 + 3;
    }

    private renderKeyValueTable(data: string[][]): void {
        this.autoTable(this.doc, {
            startY: this.currentY,
            body: data,
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 2 },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 60, textColor: [80, 80, 80] },
                1: { cellWidth: 'auto' },
            },
            margin: { left: this.margins.left, right: this.margins.right },
        });
        
        this.currentY = (this.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
    }

    private addWatermarkToAllPages(): void {
        const totalPages = this.doc.getNumberOfPages();
        
        for (let i = 1; i <= totalPages; i++) {
            this.doc.setPage(i);
            this.doc.setTextColor(200, 200, 200);
            this.doc.setFontSize(60);
            this.doc.setFont('helvetica', 'bold');
            
            // Rotate and center watermark
            this.doc.text(
                this.settings.watermark!.toUpperCase(),
                this.pageWidth / 2,
                this.pageHeight / 2,
                { align: 'center', angle: 45 }
            );
        }
    }

    private addHeadersAndFooters(): void {
        const totalPages = this.doc.getNumberOfPages();
        
        for (let i = 2; i <= totalPages; i++) { // Skip cover page
            this.doc.setPage(i);
            
            // Header
            this.doc.setDrawColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
            this.doc.setLineWidth(0.5);
            this.doc.line(this.margins.left, 15, this.pageWidth - this.margins.right, 15);
            
            this.doc.setFontSize(8);
            this.doc.setFont('helvetica', 'normal');
            this.doc.setTextColor(100, 100, 100);
            this.doc.text(this.data.project.name, this.margins.left, 12);
            this.doc.text(`Rev. ${this.settings.revision}`, this.pageWidth - this.margins.right, 12, { align: 'right' });
            
            // Footer
            this.doc.line(this.margins.left, this.pageHeight - 15, this.pageWidth - this.margins.right, this.pageHeight - 15);
            
            this.doc.text(this.data.company.name, this.margins.left, this.pageHeight - 10);
            this.doc.text(`Page ${i} of ${totalPages}`, this.pageWidth / 2, this.pageHeight - 10, { align: 'center' });
            this.doc.text(format(this.settings.date, 'MMM dd, yyyy'), this.pageWidth - this.margins.right, this.pageHeight - 10, { align: 'right' });
            
            // Confidential stamp
            if (this.settings.confidential) {
                this.doc.setTextColor(220, 38, 38);
                this.doc.setFontSize(7);
                this.doc.text('CONFIDENTIAL', this.pageWidth / 2, this.pageHeight - 5, { align: 'center' });
            }
        }
    }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createDetailedReport(data: ReportData, settings: Partial<ReportSettings> = {}): DetailedReportEngine {
    const defaultSettings: ReportSettings = {
        title: 'Structural Analysis & Design Report',
        revision: 'A',
        date: new Date(),
        confidential: true,
        includeCalculations: true,
        includeDrawings: true,
        pageSize: 'A4',
        orientation: 'portrait',
        primaryColor: '#1e40af',
        accentColor: '#3b82f6',
    };
    
    return new DetailedReportEngine(data, { ...defaultSettings, ...settings });
}

export default DetailedReportEngine;
