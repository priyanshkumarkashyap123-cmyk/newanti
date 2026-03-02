/**
 * ExportService - Comprehensive Results Export for BeamLab
 * 
 * Supports multiple export formats:
 * - CSV: Spreadsheet-compatible tabular data
 * - JSON: Machine-readable structured data
 * - Excel-compatible CSV with proper formatting
 * - ZIP: Complete project export with all data
 */

import { format } from 'date-fns';

// ============================================
// TYPES
// ============================================

export interface NodeResult {
    id: string;
    x: number;
    y: number;
    z: number;
    dx: number;
    dy: number;
    dz: number;
    rx?: number;
    ry?: number;
    rz?: number;
}

export interface MemberResult {
    id: string;
    startNodeId: string;
    endNodeId: string;
    axialStart: number;
    axialEnd: number;
    shearYStart: number;
    shearYEnd: number;
    shearZStart: number;
    shearZEnd: number;
    momentYStart: number;
    momentYEnd: number;
    momentZStart: number;
    momentZEnd: number;
    torsionStart: number;
    torsionEnd: number;
    maxStress?: number;
    utilization?: number;
}

export interface ReactionResult {
    nodeId: string;
    fx: number;
    fy: number;
    fz: number;
    mx: number;
    my: number;
    mz: number;
}

export interface DesignCheckResult {
    memberId: string;
    section: string;
    checkType: string;
    ratio: number;
    status: 'PASS' | 'FAIL';
    clause: string;
    designCode: string;
}

export interface ExportData {
    projectName: string;
    projectNumber?: string;
    engineer?: string;
    client?: string;
    timestamp: Date;
    nodes: NodeResult[];
    members: MemberResult[];
    reactions: ReactionResult[];
    designChecks?: DesignCheckResult[];
    loadCases?: string[];
    units?: {
        length: string;
        force: string;
        moment: string;
        stress: string;
    };
    analysisInfo?: {
        method: string;
        dofCount: number;
        solveTimeMs: number;
        warnings: string[];
    };
}

export type ExportFormat = 'csv' | 'json' | 'excel' | 'staad' | 'zip';

// ============================================
// EXPORT SERVICE CLASS
// ============================================

export class ExportService {
    private data: ExportData;

    constructor(data: ExportData) {
        this.data = data;
    }

    // ============================================
    // CSV EXPORT
    // ============================================

    /**
     * Export all results to CSV files (returns as Blob)
     */
    exportToCSV(type: 'nodes' | 'members' | 'reactions' | 'all'): Blob {
        if (type === 'all') {
            return this.exportAllToZip();
        }

        let content = '';

        switch (type) {
            case 'nodes':
                content = this.generateNodesCSV();
                break;
            case 'members':
                content = this.generateMembersCSV();
                break;
            case 'reactions':
                content = this.generateReactionsCSV();
                break;
        }

        return new Blob([content], { type: 'text/csv;charset=utf-8;' });
    }

    private generateNodesCSV(): string {
        const headers = [
            'Node ID',
            'X (m)',
            'Y (m)',
            'Z (m)',
            'dx (mm)',
            'dy (mm)',
            'dz (mm)',
            'rx (rad)',
            'ry (rad)',
            'rz (rad)',
            'Total Displacement (mm)'
        ];

        const rows = this.data.nodes.map(node => {
            const totalDisp = Math.sqrt(
                node.dx * node.dx + node.dy * node.dy + node.dz * node.dz
            ) * 1000; // Convert to mm

            return [
                node.id,
                node.x.toFixed(4),
                node.y.toFixed(4),
                node.z.toFixed(4),
                (node.dx * 1000).toFixed(6),
                (node.dy * 1000).toFixed(6),
                (node.dz * 1000).toFixed(6),
                (node.rx ?? 0).toFixed(8),
                (node.ry ?? 0).toFixed(8),
                (node.rz ?? 0).toFixed(8),
                totalDisp.toFixed(6)
            ].join(',');
        });

        return this.generateCSVContent(headers, rows, 'Node Displacements');
    }

    private generateMembersCSV(): string {
        const headers = [
            'Member ID',
            'Start Node',
            'End Node',
            'Axial Start (kN)',
            'Axial End (kN)',
            'Shear Y Start (kN)',
            'Shear Y End (kN)',
            'Shear Z Start (kN)',
            'Shear Z End (kN)',
            'Moment Y Start (kNm)',
            'Moment Y End (kNm)',
            'Moment Z Start (kNm)',
            'Moment Z End (kNm)',
            'Torsion Start (kNm)',
            'Torsion End (kNm)',
            'Max Stress (MPa)',
            'Utilization'
        ];

        const rows = this.data.members.map(m => [
            m.id,
            m.startNodeId,
            m.endNodeId,
            m.axialStart.toFixed(4),
            m.axialEnd.toFixed(4),
            m.shearYStart.toFixed(4),
            m.shearYEnd.toFixed(4),
            m.shearZStart.toFixed(4),
            m.shearZEnd.toFixed(4),
            m.momentYStart.toFixed(4),
            m.momentYEnd.toFixed(4),
            m.momentZStart.toFixed(4),
            m.momentZEnd.toFixed(4),
            m.torsionStart.toFixed(4),
            m.torsionEnd.toFixed(4),
            (m.maxStress ?? 0).toFixed(2),
            (m.utilization ?? 0).toFixed(4)
        ].join(','));

        return this.generateCSVContent(headers, rows, 'Member Forces');
    }

    private generateReactionsCSV(): string {
        const headers = [
            'Node ID',
            'Fx (kN)',
            'Fy (kN)',
            'Fz (kN)',
            'Mx (kNm)',
            'My (kNm)',
            'Mz (kNm)',
            'Total Force (kN)',
            'Total Moment (kNm)'
        ];

        const rows = this.data.reactions.map(r => {
            const totalForce = Math.sqrt(r.fx * r.fx + r.fy * r.fy + r.fz * r.fz);
            const totalMoment = Math.sqrt(r.mx * r.mx + r.my * r.my + r.mz * r.mz);

            return [
                r.nodeId,
                r.fx.toFixed(4),
                r.fy.toFixed(4),
                r.fz.toFixed(4),
                r.mx.toFixed(4),
                r.my.toFixed(4),
                r.mz.toFixed(4),
                totalForce.toFixed(4),
                totalMoment.toFixed(4)
            ].join(',');
        });

        return this.generateCSVContent(headers, rows, 'Support Reactions');
    }

    private generateCSVContent(headers: string[], rows: string[], title: string): string {
        const lines: string[] = [];

        // Add header metadata
        lines.push(`# BeamLab - ${title}`);
        lines.push(`# Project: ${this.data.projectName}`);
        lines.push(`# Engineer: ${this.data.engineer || 'N/A'}`);
        lines.push(`# Generated: ${format(this.data.timestamp, 'yyyy-MM-dd HH:mm:ss')}`);
        lines.push('');

        // Add column headers
        lines.push(headers.join(','));

        // Add data rows
        lines.push(...rows);

        return lines.join('\n');
    }

    // ============================================
    // JSON EXPORT
    // ============================================

    /**
     * Export all results to JSON
     */
    exportToJSON(pretty: boolean = true): Blob {
        const exportObject = {
            metadata: {
                format: 'BeamLab Export',
                version: '1.0',
                projectName: this.data.projectName,
                projectNumber: this.data.projectNumber,
                engineer: this.data.engineer,
                client: this.data.client,
                timestamp: this.data.timestamp.toISOString(),
                units: this.data.units || {
                    length: 'm',
                    force: 'kN',
                    moment: 'kNm',
                    stress: 'MPa'
                }
            },
            analysisInfo: this.data.analysisInfo,
            results: {
                nodes: this.data.nodes.map(n => ({
                    id: n.id,
                    coordinates: { x: n.x, y: n.y, z: n.z },
                    displacements: {
                        translations: { dx: n.dx, dy: n.dy, dz: n.dz },
                        rotations: { rx: n.rx, ry: n.ry, rz: n.rz }
                    }
                })),
                members: this.data.members.map(m => ({
                    id: m.id,
                    connectivity: { startNode: m.startNodeId, endNode: m.endNodeId },
                    forces: {
                        start: {
                            axial: m.axialStart,
                            shearY: m.shearYStart,
                            shearZ: m.shearZStart,
                            momentY: m.momentYStart,
                            momentZ: m.momentZStart,
                            torsion: m.torsionStart
                        },
                        end: {
                            axial: m.axialEnd,
                            shearY: m.shearYEnd,
                            shearZ: m.shearZEnd,
                            momentY: m.momentYEnd,
                            momentZ: m.momentZEnd,
                            torsion: m.torsionEnd
                        }
                    },
                    design: {
                        maxStress: m.maxStress,
                        utilization: m.utilization
                    }
                })),
                reactions: this.data.reactions.map(r => ({
                    nodeId: r.nodeId,
                    forces: { fx: r.fx, fy: r.fy, fz: r.fz },
                    moments: { mx: r.mx, my: r.my, mz: r.mz }
                })),
                designChecks: this.data.designChecks
            }
        };

        const content = pretty
            ? JSON.stringify(exportObject, null, 2)
            : JSON.stringify(exportObject);

        return new Blob([content], { type: 'application/json' });
    }

    // ============================================
    // STAAD-STYLE EXPORT
    // ============================================

    /**
     * Export in STAAD-compatible text format
     */
    exportToSTAAD(): Blob {
        const lines: string[] = [];

        lines.push('*********************************************************');
        lines.push('*       BeamLab - Analysis Results             *');
        lines.push('*       STAAD-Compatible Format                         *');
        lines.push('*********************************************************');
        lines.push('');
        lines.push(`JOB: ${this.data.projectName}`);
        lines.push(`DATE: ${format(this.data.timestamp, 'dd-MMM-yyyy HH:mm')}`);
        lines.push('');

        // Node Displacements
        lines.push('');
        lines.push('*********************************************************');
        lines.push('*       NODE DISPLACEMENTS                              *');
        lines.push('*********************************************************');
        lines.push('');
        lines.push('NODE         X-TRANS     Y-TRANS     Z-TRANS     X-ROTN      Y-ROTN      Z-ROTN');
        lines.push('             (MM)        (MM)        (MM)        (RAD)       (RAD)       (RAD)');
        lines.push('----------------------------------------------------------------------------------');

        for (const node of this.data.nodes) {
            const line = `${node.id.padEnd(12)} ${this.pad(node.dx * 1000)} ${this.pad(node.dy * 1000)} ${this.pad(node.dz * 1000)} ${this.pad(node.rx ?? 0, 8)} ${this.pad(node.ry ?? 0, 8)} ${this.pad(node.rz ?? 0, 8)}`;
            lines.push(line);
        }

        // Member Forces
        lines.push('');
        lines.push('*********************************************************');
        lines.push('*       MEMBER END FORCES                               *');
        lines.push('*********************************************************');
        lines.push('');
        lines.push('MEMBER   NODE   AXIAL      SHEAR-Y    SHEAR-Z    TORSION    MOM-Y      MOM-Z');
        lines.push('                (KN)       (KN)       (KN)       (KN-M)     (KN-M)     (KN-M)');
        lines.push('----------------------------------------------------------------------------------');

        for (const m of this.data.members) {
            const startLine = `${m.id.padEnd(8)} ${m.startNodeId.padEnd(6)} ${this.pad(m.axialStart)} ${this.pad(m.shearYStart)} ${this.pad(m.shearZStart)} ${this.pad(m.torsionStart)} ${this.pad(m.momentYStart)} ${this.pad(m.momentZStart)}`;
            const endLine = `         ${m.endNodeId.padEnd(6)} ${this.pad(m.axialEnd)} ${this.pad(m.shearYEnd)} ${this.pad(m.shearZEnd)} ${this.pad(m.torsionEnd)} ${this.pad(m.momentYEnd)} ${this.pad(m.momentZEnd)}`;
            lines.push(startLine);
            lines.push(endLine);
        }

        // Reactions
        lines.push('');
        lines.push('*********************************************************');
        lines.push('*       SUPPORT REACTIONS                               *');
        lines.push('*********************************************************');
        lines.push('');
        lines.push('NODE         FX          FY          FZ          MX          MY          MZ');
        lines.push('             (KN)        (KN)        (KN)        (KN-M)      (KN-M)      (KN-M)');
        lines.push('----------------------------------------------------------------------------------');

        for (const r of this.data.reactions) {
            const line = `${r.nodeId.padEnd(12)} ${this.pad(r.fx)} ${this.pad(r.fy)} ${this.pad(r.fz)} ${this.pad(r.mx)} ${this.pad(r.my)} ${this.pad(r.mz)}`;
            lines.push(line);
        }

        lines.push('');
        lines.push('*********************************************************');
        lines.push('*       END OF RESULTS                                  *');
        lines.push('*********************************************************');

        return new Blob([lines.join('\n')], { type: 'text/plain' });
    }

    private pad(value: number, width: number = 10): string {
        return value.toFixed(4).padStart(width);
    }

    // ============================================
    // EXCEL-COMPATIBLE EXPORT
    // ============================================

    /**
     * Export in Excel-compatible format (UTF-8 BOM for proper encoding)
     */
    exportToExcel(type: 'nodes' | 'members' | 'reactions'): Blob {
        const BOM = '\uFEFF'; // UTF-8 BOM for Excel
        let content = '';

        switch (type) {
            case 'nodes':
                content = this.generateNodesCSV();
                break;
            case 'members':
                content = this.generateMembersCSV();
                break;
            case 'reactions':
                content = this.generateReactionsCSV();
                break;
        }

        return new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    }

    // ============================================
    // ZIP EXPORT (All Data)
    // ============================================

    /**
     * Export all data as a combined download
     */
    private exportAllToZip(): Blob {
        // For now, create a combined CSV with all data sections
        const lines: string[] = [];

        lines.push('# BeamLab - Complete Results Export');
        lines.push(`# Project: ${this.data.projectName}`);
        lines.push(`# Generated: ${format(this.data.timestamp, 'yyyy-MM-dd HH:mm:ss')}`);
        lines.push('');

        // Nodes section
        lines.push('# ======== NODE DISPLACEMENTS ========');
        lines.push(this.generateNodesCSV().split('\n').slice(4).join('\n'));
        lines.push('');

        // Members section
        lines.push('# ======== MEMBER FORCES ========');
        lines.push(this.generateMembersCSV().split('\n').slice(4).join('\n'));
        lines.push('');

        // Reactions section
        lines.push('# ======== SUPPORT REACTIONS ========');
        lines.push(this.generateReactionsCSV().split('\n').slice(4).join('\n'));

        return new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    }

    // ============================================
    // DESIGN REPORT EXPORT
    // ============================================

    /**
     * Export design check results
     */
    exportDesignChecks(): Blob {
        if (!this.data.designChecks || this.data.designChecks.length === 0) {
            return new Blob(['No design check results available'], { type: 'text/plain' });
        }

        const headers = [
            'Member ID',
            'Section',
            'Check Type',
            'Design Code',
            'Clause',
            'Ratio',
            'Status'
        ];

        const rows = this.data.designChecks.map(dc => [
            dc.memberId,
            dc.section,
            dc.checkType,
            dc.designCode,
            dc.clause,
            dc.ratio.toFixed(4),
            dc.status
        ].join(','));

        return new Blob(
            [this.generateCSVContent(headers, rows, 'Design Check Results')],
            { type: 'text/csv;charset=utf-8;' }
        );
    }
}

// ============================================
// DOWNLOAD HELPER FUNCTIONS
// ============================================

/**
 * Trigger file download in browser
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Generate timestamped filename
 */
export function generateFilename(
    projectName: string,
    type: string,
    extension: string
): string {
    const sanitized = projectName.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
    return `${sanitized}_${type}_${timestamp}.${extension}`;
}

// ============================================
// QUICK EXPORT FUNCTIONS
// ============================================

export function exportNodesCSV(data: ExportData): void {
    const service = new ExportService(data);
    const blob = service.exportToCSV('nodes');
    downloadBlob(blob, generateFilename(data.projectName, 'nodes', 'csv'));
}

export function exportMembersCSV(data: ExportData): void {
    const service = new ExportService(data);
    const blob = service.exportToCSV('members');
    downloadBlob(blob, generateFilename(data.projectName, 'members', 'csv'));
}

export function exportReactionsCSV(data: ExportData): void {
    const service = new ExportService(data);
    const blob = service.exportToCSV('reactions');
    downloadBlob(blob, generateFilename(data.projectName, 'reactions', 'csv'));
}

export function exportAllCSV(data: ExportData): void {
    const service = new ExportService(data);
    const blob = service.exportToCSV('all');
    downloadBlob(blob, generateFilename(data.projectName, 'complete_results', 'csv'));
}

export function exportJSON(data: ExportData): void {
    const service = new ExportService(data);
    const blob = service.exportToJSON(true);
    downloadBlob(blob, generateFilename(data.projectName, 'results', 'json'));
}

export function exportSTAAD(data: ExportData): void {
    const service = new ExportService(data);
    const blob = service.exportToSTAAD();
    downloadBlob(blob, generateFilename(data.projectName, 'staad_format', 'txt'));
}

export function exportDesignChecks(data: ExportData): void {
    const service = new ExportService(data);
    const blob = service.exportDesignChecks();
    downloadBlob(blob, generateFilename(data.projectName, 'design_checks', 'csv'));
}

export default ExportService;
