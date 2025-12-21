import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useModelStore, type AnalysisResults } from '../store/model';

// ============================================
// REPORT GENERATOR
// ============================================
// Generates professional PDF reports for structural analysis

export interface ReportConfig {
    projectName?: string;
    projectNumber?: string;
    engineer?: string;
    company?: string;
    includeScreenshot?: boolean;
    includeSummary?: boolean;
    includeDisplacements?: boolean;
    includeReactions?: boolean;
    includeMemberForces?: boolean;
}

const DEFAULT_CONFIG: ReportConfig = {
    projectName: 'Structural Analysis',
    projectNumber: '',
    engineer: '',
    company: 'BeamLab Ultimate',
    includeScreenshot: true,
    includeSummary: true,
    includeDisplacements: true,
    includeReactions: true,
    includeMemberForces: true
};

// Format number to 3 decimal places
const fmt = (val: number): string => val.toFixed(3);

// Format date
const formatDate = (): string => {
    return new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

export class ReportGenerator {
    private doc: jsPDF;
    private pageWidth: number;
    private pageHeight: number;
    private margin: number = 20;
    private currentY: number = 20;
    private config: ReportConfig;

    constructor(config: Partial<ReportConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.doc = new jsPDF('p', 'mm', 'a4');
        this.pageWidth = this.doc.internal.pageSize.getWidth();
        this.pageHeight = this.doc.internal.pageSize.getHeight();
    }

    /**
     * Capture the 3D canvas as a data URL
     */
    static captureCanvas(canvas: HTMLCanvasElement | null): string | null {
        if (!canvas) return null;
        try {
            return canvas.toDataURL('image/png', 1.0);
        } catch (e) {
            console.error('Failed to capture canvas:', e);
            return null;
        }
    }

    /**
     * Add header section with company info and project details
     */
    private addHeader(): void {
        const { projectName, projectNumber, company, engineer } = this.config;

        // Title bar
        this.doc.setFillColor(30, 58, 138); // Dark blue
        this.doc.rect(0, 0, this.pageWidth, 25, 'F');

        // Company name
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFontSize(16);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(company || 'BeamLab', this.margin, 15);

        // Report title on right
        this.doc.setFontSize(12);
        this.doc.text('Structural Analysis Report', this.pageWidth - this.margin, 15, { align: 'right' });

        this.currentY = 35;

        // Project info box
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');

        const projectInfo = [
            ['Project:', projectName || 'Untitled Project'],
            ['Project No:', projectNumber || 'N/A'],
            ['Engineer:', engineer || 'N/A'],
            ['Date:', formatDate()]
        ];

        projectInfo.forEach((info, i) => {
            const label = info[0]!;
            const value = info[1]!;
            this.doc.setFont('helvetica', 'bold');
            this.doc.text(label, this.margin, this.currentY + (i * 6));
            this.doc.setFont('helvetica', 'normal');
            this.doc.text(value, this.margin + 25, this.currentY + (i * 6));
        });

        this.currentY += 30;
    }

    /**
     * Add section title
     */
    private addSectionTitle(title: string): void {
        if (this.currentY > this.pageHeight - 40) {
            this.doc.addPage();
            this.currentY = 20;
        }

        this.doc.setFillColor(241, 245, 249); // Light gray
        this.doc.rect(this.margin, this.currentY - 5, this.pageWidth - 2 * this.margin, 10, 'F');

        this.doc.setTextColor(30, 58, 138);
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(title, this.margin + 3, this.currentY + 2);

        this.currentY += 12;
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFont('helvetica', 'normal');
    }

    /**
     * Add model statistics section
     */
    private addModelStatistics(): void {
        const state = useModelStore.getState();
        const nodeCount = state.nodes.size;
        const memberCount = state.members.size;
        const loadCount = state.loads.length;

        // Count supports
        let supportCount = 0;
        for (const node of state.nodes.values()) {
            if (node.restraints && (node.restraints.fx || node.restraints.fy || node.restraints.mz)) {
                supportCount++;
            }
        }

        this.addSectionTitle('1. Model Summary');

        const statsData = [
            ['Total Nodes', nodeCount.toString()],
            ['Total Members', memberCount.toString()],
            ['Support Points', supportCount.toString()],
            ['Applied Loads', loadCount.toString()]
        ];

        autoTable(this.doc, {
            startY: this.currentY,
            head: [['Property', 'Value']],
            body: statsData,
            margin: { left: this.margin, right: this.margin },
            styles: { fontSize: 9 },
            headStyles: { fillColor: [30, 58, 138] },
            alternateRowStyles: { fillColor: [248, 250, 252] }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
    }

    /**
     * Add load cases section
     */
    private addLoadCases(): void {
        const state = useModelStore.getState();

        if (state.loads.length === 0) return;

        this.addSectionTitle('2. Applied Loads');

        const loadData = state.loads.map((load, i) => [
            `L${i + 1}`,
            load.nodeId.substring(0, 8) + '...',
            fmt(load.fx ?? 0),
            fmt(load.fy ?? 0),
            fmt(load.fz ?? 0),
            fmt(load.mx ?? 0),
            fmt(load.my ?? 0),
            fmt(load.mz ?? 0)
        ]);

        autoTable(this.doc, {
            startY: this.currentY,
            head: [['ID', 'Node', 'Fx (kN)', 'Fy (kN)', 'Fz (kN)', 'Mx (kN·m)', 'My (kN·m)', 'Mz (kN·m)']],
            body: loadData,
            margin: { left: this.margin, right: this.margin },
            styles: { fontSize: 8 },
            headStyles: { fillColor: [30, 58, 138] },
            alternateRowStyles: { fillColor: [248, 250, 252] }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
    }

    /**
     * Add reaction summary section
     */
    private addReactionSummary(results: AnalysisResults): void {
        const state = useModelStore.getState();

        this.addSectionTitle('3. Support Reactions');

        const reactionData: string[][] = [];

        for (const [nodeId, reaction] of results.reactions.entries()) {
            const node = state.nodes.get(nodeId);
            if (node?.restraints && (node.restraints.fx || node.restraints.fy || node.restraints.mz)) {
                reactionData.push([
                    nodeId.substring(0, 8) + '...',
                    fmt(reaction.fx),
                    fmt(reaction.fy),
                    fmt(reaction.fz),
                    fmt(reaction.mx),
                    fmt(reaction.my),
                    fmt(reaction.mz)
                ]);
            }
        }

        if (reactionData.length === 0) {
            this.doc.setFontSize(9);
            this.doc.text('No reactions available.', this.margin, this.currentY);
            this.currentY += 10;
            return;
        }

        autoTable(this.doc, {
            startY: this.currentY,
            head: [['Node', 'Rx (kN)', 'Ry (kN)', 'Rz (kN)', 'Mx (kN·m)', 'My (kN·m)', 'Mz (kN·m)']],
            body: reactionData,
            margin: { left: this.margin, right: this.margin },
            styles: { fontSize: 8 },
            headStyles: { fillColor: [30, 58, 138] },
            alternateRowStyles: { fillColor: [248, 250, 252] }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
    }

    /**
     * Add member forces section
     */
    private addMemberForces(results: AnalysisResults): void {
        if (!this.config.includeMemberForces) return;

        this.addSectionTitle('4. Member Forces');

        const forceData: string[][] = [];

        for (const [memberId, forces] of results.memberForces.entries()) {
            forceData.push([
                memberId.substring(0, 8) + '...',
                fmt(forces.axial),
                fmt(forces.shearY),
                fmt(forces.shearZ),
                fmt(forces.momentY),
                fmt(forces.momentZ),
                fmt(forces.torsion)
            ]);
        }

        if (forceData.length === 0) {
            this.doc.setFontSize(9);
            this.doc.text('No member forces available.', this.margin, this.currentY);
            this.currentY += 10;
            return;
        }

        autoTable(this.doc, {
            startY: this.currentY,
            head: [['Member', 'N (kN)', 'Vy (kN)', 'Vz (kN)', 'My (kN·m)', 'Mz (kN·m)', 'T (kN·m)']],
            body: forceData,
            margin: { left: this.margin, right: this.margin },
            styles: { fontSize: 8 },
            headStyles: { fillColor: [30, 58, 138] },
            alternateRowStyles: { fillColor: [248, 250, 252] }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
    }

    /**
     * Add 3D view screenshot
     */
    private addScreenshot(imageData: string): void {
        this.addSectionTitle('5. 3D Model View');

        // Check if we need a new page
        if (this.currentY > this.pageHeight - 100) {
            this.doc.addPage();
            this.currentY = 20;
        }

        const imgWidth = this.pageWidth - 2 * this.margin;
        const imgHeight = imgWidth * 0.6; // 16:10 aspect ratio

        this.doc.addImage(imageData, 'PNG', this.margin, this.currentY, imgWidth, imgHeight);
        this.currentY += imgHeight + 10;
    }

    /**
     * Add footer to all pages
     */
    private addFooter(): void {
        const pageCount = this.doc.getNumberOfPages();

        for (let i = 1; i <= pageCount; i++) {
            this.doc.setPage(i);

            // Footer line
            this.doc.setDrawColor(200, 200, 200);
            this.doc.line(this.margin, this.pageHeight - 15, this.pageWidth - this.margin, this.pageHeight - 15);

            // Footer text
            this.doc.setFontSize(8);
            this.doc.setTextColor(128, 128, 128);
            this.doc.text(
                `Generated by BeamLab Ultimate | Page ${i} of ${pageCount}`,
                this.pageWidth / 2,
                this.pageHeight - 10,
                { align: 'center' }
            );
        }
    }

    /**
     * Generate the complete PDF report
     */
    generateReport(canvasScreenshot?: string | null): void {
        const state = useModelStore.getState();
        const results = state.analysisResults;

        // Header
        this.addHeader();

        // Model statistics
        if (this.config.includeSummary) {
            this.addModelStatistics();
        }

        // Load cases
        this.addLoadCases();

        // Analysis results
        if (results) {
            if (this.config.includeReactions) {
                this.addReactionSummary(results);
            }
            if (this.config.includeMemberForces) {
                this.addMemberForces(results);
            }
        } else {
            this.doc.setFontSize(10);
            this.doc.setTextColor(200, 100, 100);
            this.doc.text('Note: Analysis has not been run. Run analysis to include results.', this.margin, this.currentY);
            this.currentY += 15;
        }

        // Screenshot
        if (this.config.includeScreenshot && canvasScreenshot) {
            this.addScreenshot(canvasScreenshot);
        }

        // Add footer to all pages
        this.addFooter();

        // Save the PDF
        const filename = `${this.config.projectName?.replace(/\s+/g, '_') || 'Report'}_${Date.now()}.pdf`;
        this.doc.save(filename);
    }
}

export default ReportGenerator;
