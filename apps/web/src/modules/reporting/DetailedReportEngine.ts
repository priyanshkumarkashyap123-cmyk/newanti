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

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

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
    private doc: jsPDF;
    private data: ReportData;
    private settings: ReportSettings;
    
    private pageWidth: number;
    private pageHeight: number;
    private margins = { top: 25, bottom: 25, left: 20, right: 20 };
    private contentWidth: number;
    private currentY: number;
    private pageNumber: number = 0;
    private sectionNumber: number = 0;
    private tableNumber: number = 0;
    private figureNumber: number = 0;
    
    private tocEntries: { title: string; page: number; level: number }[] = [];
    private primaryRgb: { r: number; g: number; b: number };
    private accentRgb: { r: number; g: number; b: number };

    constructor(data: ReportData, settings: ReportSettings) {
        this.data = data;
        this.settings = settings;
        
        this.doc = new jsPDF({
            orientation: settings.orientation,
            unit: 'mm',
            format: settings.pageSize.toLowerCase() as 'a4' | 'letter'
        });
        
        this.pageWidth = this.doc.internal.pageSize.getWidth();
        this.pageHeight = this.doc.internal.pageSize.getHeight();
        this.contentWidth = this.pageWidth - this.margins.left - this.margins.right;
        this.currentY = this.margins.top;
        
        this.primaryRgb = hexToRgb(settings.primaryColor);
        this.accentRgb = hexToRgb(settings.accentColor);
    }

    // ========================================================================
    // MAIN GENERATION
    // ========================================================================

    async generate(): Promise<Blob> {
        // Cover page
        this.renderCoverPage();
        
        // Table of Contents placeholder
        this.addPage();
        const tocPage = this.pageNumber;
        this.renderTableOfContentsPlaceholder();
        
        // Executive Summary
        this.addPage();
        this.renderExecutiveSummary();
        
        // Design Criteria
        this.addPage();
        this.renderDesignCriteria();
        
        // Materials
        this.addPage();
        this.renderMaterialsSection();
        
        // Loading
        this.addPage();
        this.renderLoadingSection();
        
        // Analysis Results
        this.addPage();
        this.renderAnalysisResults();
        
        // Member Design
        this.addPage();
        this.renderMemberDesign();
        
        // Connection Design
        if (this.data.connectionDesigns.length > 0) {
            this.addPage();
            this.renderConnectionDesign();
        }
        
        // Foundation Design
        if (this.data.foundationDesigns.length > 0) {
            this.addPage();
            this.renderFoundationDesign();
        }
        
        // Quality Assurance
        this.addPage();
        this.renderQualityAssurance();
        
        // Conclusions & Recommendations
        this.addPage();
        this.renderConclusions();
        
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

    // ========================================================================
    // COVER PAGE
    // ========================================================================

    private renderCoverPage(): void {
        this.pageNumber = 1;
        
        // Header band
        this.doc.setFillColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.rect(0, 0, this.pageWidth, 70, 'F');
        
        // Company info
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFontSize(16);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(this.data.company.name, this.margins.left, 25);
        
        this.doc.setFontSize(9);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(this.data.company.address, this.margins.left, 35);
        this.doc.text(`Tel: ${this.data.company.phone} | Email: ${this.data.company.email}`, this.margins.left, 42);
        
        if (this.data.company.license) {
            this.doc.text(`License: ${this.data.company.license}`, this.margins.left, 49);
        }
        
        // Report title
        this.doc.setFontSize(28);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(this.settings.title.toUpperCase(), this.pageWidth / 2, 90, { align: 'center' });
        
        if (this.settings.subtitle) {
            this.doc.setFontSize(16);
            this.doc.setFont('helvetica', 'normal');
            this.doc.text(this.settings.subtitle, this.pageWidth / 2, 100, { align: 'center' });
        }
        
        // Project info box
        this.doc.setDrawColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.setLineWidth(1);
        this.doc.roundedRect(this.margins.left, 115, this.contentWidth, 60, 3, 3, 'S');
        
        this.doc.setTextColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('PROJECT INFORMATION', this.margins.left + 5, 125);
        
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFontSize(10);
        
        const projectInfo = [
            ['Project Name:', this.data.project.name],
            ['Project Number:', this.data.project.number],
            ['Client:', this.data.project.client],
            ['Location:', this.data.project.location],
            ['Structure Type:', this.data.project.structureType],
        ];
        
        let infoY = 135;
        projectInfo.forEach(([label, value]) => {
            this.doc.setFont('helvetica', 'bold');
            this.doc.text(label, this.margins.left + 5, infoY);
            this.doc.setFont('helvetica', 'normal');
            this.doc.text(value, this.margins.left + 45, infoY);
            infoY += 7;
        });
        
        // Document control box
        this.doc.roundedRect(this.margins.left, 185, this.contentWidth, 50, 3, 3, 'S');
        
        this.doc.setTextColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('DOCUMENT CONTROL', this.margins.left + 5, 195);
        
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFontSize(10);
        
        const docControl = [
            ['Revision:', this.settings.revision],
            ['Date:', format(this.settings.date, 'MMMM dd, yyyy')],
            ['Prepared By:', this.data.engineer.designEngineer.name],
            ['Checked By:', this.data.engineer.checker?.name || '-'],
        ];
        
        let docY = 205;
        docControl.forEach(([label, value]) => {
            this.doc.setFont('helvetica', 'bold');
            this.doc.text(label, this.margins.left + 5, docY);
            this.doc.setFont('helvetica', 'normal');
            this.doc.text(value, this.margins.left + 35, docY);
            docY += 7;
        });
        
        // Confidentiality notice
        if (this.settings.confidential) {
            this.doc.setFillColor(220, 38, 38);
            this.doc.roundedRect(this.pageWidth / 2 - 40, 250, 80, 12, 2, 2, 'F');
            this.doc.setTextColor(255, 255, 255);
            this.doc.setFontSize(10);
            this.doc.setFont('helvetica', 'bold');
            this.doc.text('CONFIDENTIAL', this.pageWidth / 2, 258, { align: 'center' });
        }
        
        // Footer disclaimer
        this.doc.setTextColor(100, 100, 100);
        this.doc.setFontSize(8);
        this.doc.setFont('helvetica', 'italic');
        const disclaimer = 'This document is prepared for the exclusive use of the client. Any reproduction or distribution without written permission is prohibited.';
        this.doc.text(disclaimer, this.pageWidth / 2, this.pageHeight - 20, { align: 'center', maxWidth: this.contentWidth });
    }

    // ========================================================================
    // TABLE OF CONTENTS
    // ========================================================================

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
    // EXECUTIVE SUMMARY
    // ========================================================================

    private renderExecutiveSummary(): void {
        this.sectionNumber++;
        this.addTocEntry(`${this.sectionNumber}. EXECUTIVE SUMMARY`, 1);
        
        this.renderSectionHeader('EXECUTIVE SUMMARY');
        
        // Project Overview
        this.renderSubsectionHeader('Project Overview');
        
        const overview = `This report presents the structural analysis and design of ${this.data.project.name} ` +
            `located at ${this.data.project.location}. The structure is a ${this.data.project.structureType} ` +
            `designed for ${this.data.project.occupancy} occupancy with a design life of ${this.data.project.designLife} years.`;
        
        this.renderParagraph(overview);
        this.currentY += 5;
        
        // Design Codes
        this.renderSubsectionHeader('Applicable Design Codes');
        
        const codeList = this.data.criteria.codes.map(code => `• ${code}`).join('\n');
        this.renderParagraph(codeList);
        this.currentY += 5;
        
        // Key Results Summary
        this.renderSubsectionHeader('Key Results Summary');
        
        const summary = this.data.analysisSummary;
        const keyResults = [
            ['Maximum Displacement', `${summary.maxDisplacement.value.toFixed(2)} mm at ${summary.maxDisplacement.node}`],
            ['Maximum Story Drift', `${(summary.maxDrift.value * 100).toFixed(3)}% at ${summary.maxDrift.story}`],
            ['Maximum Reaction', `${summary.maxReaction.value.toFixed(1)} kN at ${summary.maxReaction.support}`],
        ];
        
        if (summary.fundamentalPeriod) {
            keyResults.push(['Fundamental Period', `T1 = ${summary.fundamentalPeriod.T1.toFixed(3)} s`]);
        }
        
        this.renderKeyValueTable(keyResults);
        this.currentY += 10;
        
        // Design Status
        this.renderSubsectionHeader('Design Status Summary');
        
        const memberStats = this.calculateMemberStats();
        const statusData = [
            ['Members Designed', String(this.data.memberDesigns.length)],
            ['Members Passed', String(memberStats.passed)],
            ['Members with Warnings', String(memberStats.warnings)],
            ['Members Failed', String(memberStats.failed)],
            ['Average Utilization', `${(memberStats.avgUtilization * 100).toFixed(1)}%`],
            ['Maximum Utilization', `${(memberStats.maxUtilization * 100).toFixed(1)}%`],
        ];
        
        this.renderKeyValueTable(statusData);
        
        // Overall conclusion
        this.currentY += 10;
        if (memberStats.failed === 0) {
            this.doc.setFillColor(220, 252, 231);
        } else {
            this.doc.setFillColor(254, 226, 226);
        }
        this.doc.roundedRect(this.margins.left, this.currentY, this.contentWidth, 20, 2, 2, 'F');
        
        if (memberStats.failed === 0) {
            this.doc.setTextColor(22, 163, 74);
        } else {
            this.doc.setTextColor(220, 38, 38);
        }
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        
        const conclusion = memberStats.failed === 0 
            ? '✓ ALL STRUCTURAL ELEMENTS MEET DESIGN REQUIREMENTS'
            : `✗ ${memberStats.failed} MEMBER(S) REQUIRE REDESIGN`;
        
        this.doc.text(conclusion, this.pageWidth / 2, this.currentY + 12, { align: 'center' });
        this.currentY += 25;
    }

    private calculateMemberStats(): { passed: number; warnings: number; failed: number; avgUtilization: number; maxUtilization: number } {
        let passed = 0, warnings = 0, failed = 0;
        let totalUtilization = 0;
        let maxUtilization = 0;
        
        this.data.memberDesigns.forEach(member => {
            if (member.overallStatus === 'PASS') passed++;
            else if (member.overallStatus === 'WARNING') warnings++;
            else if (member.overallStatus === 'FAIL') failed++;
            
            totalUtilization += member.criticalRatio;
            maxUtilization = Math.max(maxUtilization, member.criticalRatio);
        });
        
        return {
            passed,
            warnings,
            failed,
            avgUtilization: totalUtilization / this.data.memberDesigns.length,
            maxUtilization
        };
    }

    // ========================================================================
    // DESIGN CRITERIA
    // ========================================================================

    private renderDesignCriteria(): void {
        this.sectionNumber++;
        this.addTocEntry(`${this.sectionNumber}. DESIGN CRITERIA`, 1);
        
        this.renderSectionHeader('DESIGN CRITERIA');
        
        // Design Codes
        this.renderSubsectionHeader('Design Codes and Standards');
        
        const codeTable = this.data.criteria.codes.map((code, i) => [String(i + 1), code, this.getCodeDescription(code)]);
        
        autoTable(this.doc, {
            startY: this.currentY,
            head: [['#', 'Code', 'Description']],
            body: codeTable,
            theme: 'striped',
            headStyles: { fillColor: [this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b] },
            margin: { left: this.margins.left, right: this.margins.right },
            styles: { fontSize: 9 },
        });
        
        this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
        
        // Load Factors
        this.renderSubsectionHeader('Load Factors');
        
        const loadFactorData = Object.entries(this.data.criteria.loadFactors).map(([load, factor]) => [load, String(factor)]);
        
        autoTable(this.doc, {
            startY: this.currentY,
            head: [['Load Type', 'Factor']],
            body: loadFactorData,
            theme: 'striped',
            headStyles: { fillColor: [this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b] },
            margin: { left: this.margins.left, right: this.margins.right },
            styles: { fontSize: 9 },
            columnStyles: { 0: { cellWidth: 80 } },
        });
        
        this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
        
        // Serviceability Limits
        this.renderSubsectionHeader('Serviceability Limits');
        
        const limits = this.data.criteria.deflectionLimits;
        const limitData = [
            ['Live Load Deflection', limits.live],
            ['Total Deflection', limits.total],
            ['Story Drift', limits.drift],
        ];
        
        if (this.data.criteria.serviceabilityLimits.vibration) {
            limitData.push(['Floor Vibration', this.data.criteria.serviceabilityLimits.vibration]);
        }
        
        this.renderKeyValueTable(limitData);
    }

    private getCodeDescription(code: DesignCode): string {
        const descriptions: Record<DesignCode, string> = {
            'IS 800:2007': 'General Construction in Steel',
            'IS 456:2000': 'Plain and Reinforced Concrete',
            'IS 1893:2016': 'Earthquake Resistant Design',
            'IS 13920:2016': 'Ductile Design and Detailing',
            'AISC 360-16': 'Specification for Structural Steel Buildings',
            'ACI 318-19': 'Building Code Requirements for Structural Concrete',
            'ASCE 7-22': 'Minimum Design Loads for Buildings',
            'Eurocode 3': 'Design of Steel Structures',
            'Eurocode 2': 'Design of Concrete Structures',
            'BS 5950': 'Structural Use of Steelwork in Building',
            'CSA S16-19': 'Design of Steel Structures',
            'AS 4100': 'Steel Structures',
        };
        return descriptions[code] || code;
    }

    // ========================================================================
    // MATERIALS SECTION
    // ========================================================================

    private renderMaterialsSection(): void {
        this.sectionNumber++;
        this.addTocEntry(`${this.sectionNumber}. MATERIALS`, 1);
        
        this.renderSectionHeader('MATERIALS');
        
        // Structural Steel
        if (this.data.materials.steel.length > 0) {
            this.renderSubsectionHeader('Structural Steel');
            
            const steelData = this.data.materials.steel.map(s => [
                s.grade,
                String(s.fy),
                String(s.fu),
                String(s.E / 1000),
                String(s.density)
            ]);
            
            autoTable(this.doc, {
                startY: this.currentY,
                head: [['Grade', 'fy (MPa)', 'fu (MPa)', 'E (GPa)', 'Density (kg/m³)']],
                body: steelData,
                theme: 'striped',
                headStyles: { fillColor: [this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b] },
                margin: { left: this.margins.left, right: this.margins.right },
                styles: { fontSize: 9 },
            });
            
            this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
        }
        
        // Concrete
        if (this.data.materials.concrete.length > 0) {
            this.renderSubsectionHeader('Concrete');
            
            const concreteData = this.data.materials.concrete.map(c => [
                c.grade,
                String(c.fck),
                String((c.Ec / 1000).toFixed(1)),
                String(c.density)
            ]);
            
            autoTable(this.doc, {
                startY: this.currentY,
                head: [['Grade', 'fck (MPa)', 'Ec (GPa)', 'Density (kg/m³)']],
                body: concreteData,
                theme: 'striped',
                headStyles: { fillColor: [this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b] },
                margin: { left: this.margins.left, right: this.margins.right },
                styles: { fontSize: 9 },
            });
            
            this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
        }
        
        // Reinforcement
        if (this.data.materials.rebar.length > 0) {
            this.renderSubsectionHeader('Reinforcing Steel');
            
            const rebarData = this.data.materials.rebar.map(r => [r.grade, String(r.fy)]);
            
            autoTable(this.doc, {
                startY: this.currentY,
                head: [['Grade', 'fy (MPa)']],
                body: rebarData,
                theme: 'striped',
                headStyles: { fillColor: [this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b] },
                margin: { left: this.margins.left, right: this.margins.right },
                styles: { fontSize: 9 },
                columnStyles: { 0: { cellWidth: 80 } },
            });
            
            this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
        }
    }

    // ========================================================================
    // LOADING SECTION
    // ========================================================================

    private renderLoadingSection(): void {
        this.sectionNumber++;
        this.addTocEntry(`${this.sectionNumber}. LOADING`, 1);
        
        this.renderSectionHeader('LOADING');
        
        // Dead Loads
        this.renderSubsectionHeader('Dead Loads');
        
        const deadLoadData = this.data.loads.deadLoads.map(l => [
            l.description,
            `${l.value} ${l.unit}`,
            l.location
        ]);
        
        autoTable(this.doc, {
            startY: this.currentY,
            head: [['Description', 'Value', 'Location']],
            body: deadLoadData,
            theme: 'striped',
            headStyles: { fillColor: [this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b] },
            margin: { left: this.margins.left, right: this.margins.right },
            styles: { fontSize: 9 },
        });
        
        this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
        
        // Live Loads
        this.renderSubsectionHeader('Live Loads');
        
        const liveLoadData = this.data.loads.liveLoads.map(l => [
            l.description,
            `${l.value} ${l.unit}`,
            l.occupancy
        ]);
        
        autoTable(this.doc, {
            startY: this.currentY,
            head: [['Description', 'Value', 'Occupancy Type']],
            body: liveLoadData,
            theme: 'striped',
            headStyles: { fillColor: [this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b] },
            margin: { left: this.margins.left, right: this.margins.right },
            styles: { fontSize: 9 },
        });
        
        this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
        
        // Wind Loads
        if (this.data.loads.windLoads) {
            this.checkPageBreak(60);
            this.renderSubsectionHeader('Wind Loads');
            
            const wind = this.data.loads.windLoads;
            this.renderParagraph(`Basic Wind Speed: ${wind.basicSpeed} m/s\nExposure Category: ${wind.exposure}`);
            
            const windPressureData = wind.pressures.map(p => [p.zone, `${p.pressure.toFixed(2)} kN/m²`]);
            
            autoTable(this.doc, {
                startY: this.currentY,
                head: [['Zone', 'Design Pressure']],
                body: windPressureData,
                theme: 'striped',
                headStyles: { fillColor: [this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b] },
                margin: { left: this.margins.left, right: this.margins.right },
                styles: { fontSize: 9 },
            });
            
            this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
        }
        
        // Seismic Loads
        if (this.data.loads.seismicLoads) {
            this.checkPageBreak(80);
            this.renderSubsectionHeader('Seismic Loads');
            
            const seismic = this.data.loads.seismicLoads;
            
            const seismicParams = [
                ['Seismic Zone', seismic.zone],
                ['Soil Type', seismic.soilType],
                ['Response Reduction Factor (R)', String(seismic.R)],
                ['Importance Factor (I)', String(seismic.I)],
                ['Design Base Shear', `${seismic.baseShear.toFixed(1)} kN`],
            ];
            
            this.renderKeyValueTable(seismicParams);
            this.currentY += 10;
            
            // Story Forces
            const storyForceData = seismic.storyForces.map(s => [
                s.level,
                `${s.height.toFixed(1)} m`,
                `${s.force.toFixed(1)} kN`
            ]);
            
            autoTable(this.doc, {
                startY: this.currentY,
                head: [['Level', 'Height', 'Lateral Force']],
                body: storyForceData,
                theme: 'striped',
                headStyles: { fillColor: [this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b] },
                margin: { left: this.margins.left, right: this.margins.right },
                styles: { fontSize: 9 },
            });
            
            this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
        }
    }

    // ========================================================================
    // ANALYSIS RESULTS
    // ========================================================================

    private renderAnalysisResults(): void {
        this.sectionNumber++;
        this.addTocEntry(`${this.sectionNumber}. ANALYSIS RESULTS`, 1);
        
        this.renderSectionHeader('ANALYSIS RESULTS');
        
        const summary = this.data.analysisSummary;
        
        // Displacement Results
        this.renderSubsectionHeader('Displacement Summary');
        
        const dispData = [
            ['Maximum Total Displacement', `${summary.maxDisplacement.value.toFixed(2)} mm`, summary.maxDisplacement.node, summary.maxDisplacement.loadCase],
            ['Maximum Story Drift', `${(summary.maxDrift.value * 100).toFixed(3)}%`, summary.maxDrift.story, summary.maxDrift.loadCase],
        ];
        
        autoTable(this.doc, {
            startY: this.currentY,
            head: [['Parameter', 'Value', 'Location', 'Load Case']],
            body: dispData,
            theme: 'striped',
            headStyles: { fillColor: [this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b] },
            margin: { left: this.margins.left, right: this.margins.right },
            styles: { fontSize: 9 },
        });
        
        this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
        
        // Modal Analysis Results
        if (summary.fundamentalPeriod) {
            this.renderSubsectionHeader('Modal Analysis Results');
            
            const modalData = [
                ['Mode 1 (T1)', `${summary.fundamentalPeriod.T1.toFixed(3)} s`, `${(1/summary.fundamentalPeriod.T1).toFixed(2)} Hz`],
                ['Mode 2 (T2)', `${summary.fundamentalPeriod.T2.toFixed(3)} s`, `${(1/summary.fundamentalPeriod.T2).toFixed(2)} Hz`],
                ['Mode 3 (T3)', `${summary.fundamentalPeriod.T3.toFixed(3)} s`, `${(1/summary.fundamentalPeriod.T3).toFixed(2)} Hz`],
            ];
            
            autoTable(this.doc, {
                startY: this.currentY,
                head: [['Mode', 'Period', 'Frequency']],
                body: modalData,
                theme: 'striped',
                headStyles: { fillColor: [this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b] },
                margin: { left: this.margins.left, right: this.margins.right },
                styles: { fontSize: 9 },
            });
            
            this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
        }
        
        // Add 3D model image if available
        if (this.data.images.model3D) {
            this.checkPageBreak(100);
            this.figureNumber++;
            
            try {
                this.doc.addImage(this.data.images.model3D, 'PNG', this.margins.left, this.currentY, this.contentWidth, 80);
                this.currentY += 85;
                
                this.doc.setFontSize(9);
                this.doc.setFont('helvetica', 'italic');
                this.doc.setTextColor(100, 100, 100);
                this.doc.text(`Figure ${this.figureNumber}: 3D Structural Model`, this.pageWidth / 2, this.currentY, { align: 'center' });
                this.currentY += 10;
            } catch (e) {
                // Image loading failed
            }
        }
    }

    // ========================================================================
    // MEMBER DESIGN
    // ========================================================================

    private renderMemberDesign(): void {
        this.sectionNumber++;
        this.addTocEntry(`${this.sectionNumber}. MEMBER DESIGN`, 1);
        
        this.renderSectionHeader('MEMBER DESIGN');
        
        // Summary Table
        this.renderSubsectionHeader('Member Design Summary');
        
        const memberSummary = this.data.memberDesigns.map(m => [
            m.name,
            m.type,
            m.section,
            `${(m.criticalRatio * 100).toFixed(1)}%`,
            m.criticalCheck,
            m.overallStatus
        ]);
        
        autoTable(this.doc, {
            startY: this.currentY,
            head: [['Member', 'Type', 'Section', 'Utilization', 'Critical Check', 'Status']],
            body: memberSummary,
            theme: 'striped',
            headStyles: { fillColor: [this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b] },
            margin: { left: this.margins.left, right: this.margins.right },
            styles: { fontSize: 8 },
            bodyStyles: {
                valign: 'middle',
            },
            didParseCell: (data) => {
                if (data.column.index === 5 && data.section === 'body') {
                    const status = data.cell.raw as string;
                    if (status === 'PASS') {
                        data.cell.styles.textColor = [22, 163, 74];
                        data.cell.styles.fontStyle = 'bold';
                    } else if (status === 'FAIL') {
                        data.cell.styles.textColor = [220, 38, 38];
                        data.cell.styles.fontStyle = 'bold';
                    } else if (status === 'WARNING') {
                        data.cell.styles.textColor = [217, 119, 6];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            },
        });
        
        this.currentY = (this.doc as any).lastAutoTable.finalY + 15;
        
        // Detailed checks for critical members
        const criticalMembers = this.data.memberDesigns
            .filter(m => m.criticalRatio > 0.85 || m.overallStatus !== 'PASS')
            .slice(0, 5);
        
        if (criticalMembers.length > 0) {
            this.checkPageBreak(50);
            this.renderSubsectionHeader('Critical Member Details');
            
            criticalMembers.forEach((member, index) => {
                this.checkPageBreak(40);
                
                this.doc.setFontSize(10);
                this.doc.setFont('helvetica', 'bold');
                this.doc.setTextColor(0, 0, 0);
                this.doc.text(`${member.name} (${member.section})`, this.margins.left, this.currentY);
                this.currentY += 6;
                
                const checkData = member.checks.map(c => [
                    c.name,
                    c.clause,
                    c.capacity.toFixed(1),
                    c.demand.toFixed(1),
                    `${(c.ratio * 100).toFixed(1)}%`,
                    c.status
                ]);
                
                autoTable(this.doc, {
                    startY: this.currentY,
                    head: [['Check', 'Clause', 'Capacity', 'Demand', 'Ratio', 'Status']],
                    body: checkData,
                    theme: 'grid',
                    headStyles: { fillColor: [100, 100, 100], fontSize: 8 },
                    margin: { left: this.margins.left + 5, right: this.margins.right },
                    styles: { fontSize: 8 },
                    didParseCell: (data) => {
                        if (data.column.index === 5 && data.section === 'body') {
                            const status = data.cell.raw as string;
                            if (status === 'PASS') {
                                data.cell.styles.textColor = [22, 163, 74];
                            } else if (status === 'FAIL') {
                                data.cell.styles.textColor = [220, 38, 38];
                                data.cell.styles.fillColor = [254, 226, 226];
                            }
                        }
                    },
                });
                
                this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
            });
        }
    }

    // ========================================================================
    // CONNECTION DESIGN
    // ========================================================================

    private renderConnectionDesign(): void {
        this.sectionNumber++;
        this.addTocEntry(`${this.sectionNumber}. CONNECTION DESIGN`, 1);
        
        this.renderSectionHeader('CONNECTION DESIGN');
        
        this.renderSubsectionHeader('Connection Summary');
        
        const connSummary = this.data.connectionDesigns.map(c => [
            c.id,
            c.type,
            c.members.join(' - '),
            c.category,
            c.overallStatus
        ]);
        
        autoTable(this.doc, {
            startY: this.currentY,
            head: [['Connection', 'Type', 'Members', 'Category', 'Status']],
            body: connSummary,
            theme: 'striped',
            headStyles: { fillColor: [this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b] },
            margin: { left: this.margins.left, right: this.margins.right },
            styles: { fontSize: 9 },
            didParseCell: (data) => {
                if (data.column.index === 4 && data.section === 'body') {
                    const status = data.cell.raw as string;
                    if (status === 'PASS') {
                        data.cell.styles.textColor = [22, 163, 74];
                        data.cell.styles.fontStyle = 'bold';
                    } else if (status === 'FAIL') {
                        data.cell.styles.textColor = [220, 38, 38];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            },
        });
        
        this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
    }

    // ========================================================================
    // FOUNDATION DESIGN
    // ========================================================================

    private renderFoundationDesign(): void {
        this.sectionNumber++;
        this.addTocEntry(`${this.sectionNumber}. FOUNDATION DESIGN`, 1);
        
        this.renderSectionHeader('FOUNDATION DESIGN');
        
        this.renderSubsectionHeader('Foundation Summary');
        
        const foundSummary = this.data.foundationDesigns.map(f => [
            f.id,
            f.type,
            f.column,
            `${f.geometry.length} x ${f.geometry.width} x ${f.geometry.depth}`,
            `${f.loads.axial.toFixed(1)} kN`,
            f.overallStatus
        ]);
        
        autoTable(this.doc, {
            startY: this.currentY,
            head: [['Footing', 'Type', 'Column', 'Size (L×W×D) m', 'Axial Load', 'Status']],
            body: foundSummary,
            theme: 'striped',
            headStyles: { fillColor: [this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b] },
            margin: { left: this.margins.left, right: this.margins.right },
            styles: { fontSize: 9 },
            didParseCell: (data) => {
                if (data.column.index === 5 && data.section === 'body') {
                    const status = data.cell.raw as string;
                    if (status === 'PASS') {
                        data.cell.styles.textColor = [22, 163, 74];
                        data.cell.styles.fontStyle = 'bold';
                    } else if (status === 'FAIL') {
                        data.cell.styles.textColor = [220, 38, 38];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            },
        });
        
        this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
    }

    // ========================================================================
    // QUALITY ASSURANCE
    // ========================================================================

    private renderQualityAssurance(): void {
        this.sectionNumber++;
        this.addTocEntry(`${this.sectionNumber}. QUALITY ASSURANCE`, 1);
        
        this.renderSectionHeader('QUALITY ASSURANCE');
        
        this.renderSubsectionHeader('Design Verification Checklist');
        
        const qaData = this.data.qualityChecks.map(q => [
            q.category,
            q.item,
            q.requirement,
            q.actual,
            q.status
        ]);
        
        autoTable(this.doc, {
            startY: this.currentY,
            head: [['Category', 'Item', 'Requirement', 'Actual', 'Status']],
            body: qaData,
            theme: 'striped',
            headStyles: { fillColor: [this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b] },
            margin: { left: this.margins.left, right: this.margins.right },
            styles: { fontSize: 8 },
            didParseCell: (data) => {
                if (data.column.index === 4 && data.section === 'body') {
                    const status = data.cell.raw as string;
                    if (status === 'PASS') {
                        data.cell.styles.textColor = [22, 163, 74];
                        data.cell.styles.fontStyle = 'bold';
                    } else if (status === 'FAIL') {
                        data.cell.styles.textColor = [220, 38, 38];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            },
        });
        
        this.currentY = (this.doc as any).lastAutoTable.finalY + 15;
        
        // Signature block
        this.checkPageBreak(60);
        this.renderSubsectionHeader('Approval Signatures');
        
        const sigY = this.currentY + 5;
        const sigWidth = (this.contentWidth - 20) / 3;
        
        ['Designed By', 'Checked By', 'Approved By'].forEach((role, i) => {
            const x = this.margins.left + i * (sigWidth + 10);
            
            this.doc.setDrawColor(180, 180, 180);
            this.doc.line(x, sigY + 25, x + sigWidth, sigY + 25);
            
            this.doc.setFontSize(9);
            this.doc.setFont('helvetica', 'bold');
            this.doc.setTextColor(0, 0, 0);
            this.doc.text(role, x, sigY);
            
            this.doc.setFont('helvetica', 'normal');
            this.doc.setTextColor(100, 100, 100);
            this.doc.text('Name: ____________________', x, sigY + 32);
            this.doc.text('Date: ____________________', x, sigY + 40);
            this.doc.text('License: _________________', x, sigY + 48);
        });
        
        this.currentY = sigY + 55;
    }

    // ========================================================================
    // CONCLUSIONS
    // ========================================================================

    private renderConclusions(): void {
        this.sectionNumber++;
        this.addTocEntry(`${this.sectionNumber}. CONCLUSIONS & RECOMMENDATIONS`, 1);
        
        this.renderSectionHeader('CONCLUSIONS & RECOMMENDATIONS');
        
        this.renderSubsectionHeader('Conclusions');
        
        const stats = this.calculateMemberStats();
        
        const conclusions = [
            `The structural analysis and design of ${this.data.project.name} has been completed in accordance with the applicable design codes.`,
            `A total of ${this.data.memberDesigns.length} structural members have been designed and verified.`,
            `${stats.passed} members (${((stats.passed / this.data.memberDesigns.length) * 100).toFixed(1)}%) satisfy all design requirements.`,
            `The maximum member utilization ratio is ${(stats.maxUtilization * 100).toFixed(1)}%.`,
            `The average member utilization ratio is ${(stats.avgUtilization * 100).toFixed(1)}%.`,
        ];
        
        conclusions.forEach((c, i) => {
            this.doc.setFontSize(10);
            this.doc.setFont('helvetica', 'normal');
            this.doc.setTextColor(0, 0, 0);
            this.doc.text(`${i + 1}. ${c}`, this.margins.left, this.currentY, { maxWidth: this.contentWidth - 10 });
            this.currentY += 10;
        });
        
        this.currentY += 5;
        this.renderSubsectionHeader('Recommendations');
        
        const recommendations = [
            'All structural connections should be designed and detailed as per the applicable code requirements.',
            'Shop drawings should be reviewed and approved by the Engineer of Record before fabrication.',
            'Field inspections should be conducted to ensure construction matches the design intent.',
            'Any modifications to the structure should be reviewed and approved by the structural engineer.',
        ];
        
        recommendations.forEach((r, i) => {
            this.doc.setFontSize(10);
            this.doc.setFont('helvetica', 'normal');
            this.doc.setTextColor(0, 0, 0);
            this.doc.text(`${i + 1}. ${r}`, this.margins.left, this.currentY, { maxWidth: this.contentWidth - 10 });
            this.currentY += 10;
        });
        
        // Final statement box
        this.currentY += 10;
        this.doc.setFillColor(240, 249, 255);
        this.doc.setDrawColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.setLineWidth(0.5);
        this.doc.roundedRect(this.margins.left, this.currentY, this.contentWidth, 25, 2, 2, 'FD');
        
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'italic');
        this.doc.setTextColor(this.primaryRgb.r, this.primaryRgb.g, this.primaryRgb.b);
        this.doc.text(
            'This report has been prepared with reasonable skill and care. The conclusions and recommendations are based on the information available at the time of the analysis.',
            this.pageWidth / 2, this.currentY + 10,
            { align: 'center', maxWidth: this.contentWidth - 10 }
        );
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
        autoTable(this.doc, {
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
        
        this.currentY = (this.doc as any).lastAutoTable.finalY + 5;
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
