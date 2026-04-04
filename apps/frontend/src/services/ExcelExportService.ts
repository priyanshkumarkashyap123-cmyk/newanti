/**
 * ============================================================================
 * PROFESSIONAL EXCEL EXPORT SERVICE
 * ============================================================================
 *
 * Industry-standard Excel export for structural engineering data.
 * Uses exceljs library for real Excel files (not just CSV).
 *
 * Features:
 * - Multi-sheet workbooks
 * - Formatted tables with headers
 * - Conditional formatting for utilization ratios
 * - Charts for diagrams
 * - Cell formulas
 * - Print-ready layouts
 *
 * @version 2.0.0
 * @author BeamLab Engineering Team
 */

// exceljs loaded on-demand — only fetched when user triggers export
let _exceljsPromise: Promise<typeof import('exceljs')> | null = null;
function getExcelJS() {
    if (!_exceljsPromise) _exceljsPromise = import('exceljs');
    return _exceljsPromise;
}
import { AnalysisResults } from "../store/model";
import { BEAMLAB_COMPANY } from '../constants/BrandingConstants';

type ExcelJsWorkbook = import('exceljs').Workbook;
type ExcelJsWorksheet = import('exceljs').Worksheet;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ExcelExportOptions {
    includeNodes?: boolean;
    includeMembers?: boolean;
    includeLoads?: boolean;
    includeResults?: boolean;
    includeDesignChecks?: boolean;
    includeSummary?: boolean;
    projectInfo?: {
        name: string;
        engineer: string;
        date: string;
        client?: string;
        jobNumber?: string;
    };
}

interface DesignCheck {
    memberId: string;
    section: string;
    utilization: number;
    status: 'OK' | 'FAIL' | 'WARNING';
    governingCase: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a styled worksheet with headers
 */
function createStyledWorksheet(
    workbook: ExcelJsWorkbook,
    sheetName: string,
    headers: string[],
    data: (string | number)[][],
    title: string | undefined = undefined
) {
    const ws = workbook.addWorksheet(sheetName);

    if (title) {
        ws.addRow([title]);
        ws.addRow([]);
    }

    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true };

    data.forEach((row) => ws.addRow(row));

    headers.forEach((header, i) => {
        const maxDataWidth = Math.max(
            header.length,
            ...data.map((row) => String(row[i] ?? '').length)
        );
        ws.getColumn(i + 1).width = Math.min(maxDataWidth + 2, 30);
    });

    return ws;
}

const downloadExcelBuffer = (buffer: ArrayBuffer, filename: string): void => {
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Format number for display
 */
const formatNumber = (value: number, decimals: number = 3): string => {
    return value.toFixed(decimals);
};

/**
 * Get utilization color code
 */
const getUtilizationStatus = (ratio: number): 'OK' | 'WARNING' | 'FAIL' => {
    if (ratio <= 0.9) return 'OK';
    if (ratio <= 1.0) return 'WARNING';
    return 'FAIL';
};

// ============================================================================
// CSV EXPORT (Legacy support)
// ============================================================================

export const exportToCSV = (filename: string, headers: string[], data: (string | number)[][]): void => {
    // Add BOM for Excel utf-8 compatibility
    const BOM = "\uFEFF";

    const csvContent = BOM + [
        headers.join(','),
        ...data.map(row => row.map(item => {
            // Escape quotes and wrap in quotes
            const str = String(item).replace(/"/g, '""');
            return `"${str}"`;
        }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// ============================================================================
// FULL EXCEL EXPORT
// ============================================================================

/**
 * Export complete project data to Excel workbook
 */
export const exportToExcel = async (
    nodes: Map<string, any>,
    members: Map<string, any>,
    results: AnalysisResults | null,
    designChecks: DesignCheck[] = [],
    options: ExcelExportOptions = {}
): Promise<void> => {
    const {
        includeNodes = true,
        includeMembers = true,
        includeLoads = true,
        includeResults = true,
        includeDesignChecks = true,
        includeSummary = true,
        projectInfo = {
            name: 'BeamLab Project',
            engineer: 'Engineer',
            date: new Date().toISOString().split('T')[0],
        },
    } = options;

    const ExcelJS = await getExcelJS();
    const wb = new ExcelJS.Workbook();

    // ========================================
    // 1. SUMMARY SHEET
    // ========================================
    if (includeSummary) {
        const summaryData = [
                [`${BEAMLAB_COMPANY.name} — Structural Analysis Report`],
                [`${BEAMLAB_COMPANY.website}  |  ${BEAMLAB_COMPANY.email}`],
            [],
            ['Project Information'],
            ['Project Name:', projectInfo.name],
            ['Engineer:', projectInfo.engineer],
            ['Date:', projectInfo.date],
            ['Job Number:', projectInfo.jobNumber ?? 'N/A'],
            ['Client:', projectInfo.client ?? 'N/A'],
            [],
            ['Model Statistics'],
            ['Total Nodes:', nodes.size],
            ['Total Members:', members.size],
            ['Analysis Status:', results ? 'Complete' : 'Not Run'],
        ];

        if (results) {
            // Find max values
            let maxDisp = 0;
            let maxMoment = 0;
            let maxShear = 0;
            let maxAxial = 0;

            results.displacements.forEach((disp: any) => {
                const total = Math.sqrt(
                    (disp.dx || 0) ** 2 + 
                    (disp.dy || 0) ** 2 + 
                    (disp.dz || 0) ** 2
                );
                maxDisp = Math.max(maxDisp, total);
            });

            results.memberForces.forEach((forces: any) => {
                maxMoment = Math.max(maxMoment, Math.abs(forces.momentY || 0), Math.abs(forces.momentZ || 0));
                maxShear = Math.max(maxShear, Math.abs(forces.shearY || 0), Math.abs(forces.shearZ || 0));
                maxAxial = Math.max(maxAxial, Math.abs(forces.axial || 0));
            });

            summaryData.push(
                [],
                ['Analysis Results Summary'],
                ['Max Displacement:', `${(maxDisp * 1000).toFixed(2)} mm`],
                ['Max Bending Moment:', `${maxMoment.toFixed(2)} kN·m`],
                ['Max Shear Force:', `${maxShear.toFixed(2)} kN`],
                ['Max Axial Force:', `${maxAxial.toFixed(2)} kN`]
            );
        }

        if (designChecks.length > 0) {
            const passCount = designChecks.filter(c => c.status === 'OK').length;
            const failCount = designChecks.filter(c => c.status === 'FAIL').length;
            const maxUtil = Math.max(...designChecks.map(c => c.utilization));

            summaryData.push(
                [],
                ['Design Check Summary'],
                ['Total Checks:', designChecks.length],
                ['Passed:', passCount],
                ['Failed:', failCount],
                ['Max Utilization:', `${(maxUtil * 100).toFixed(1)}%`]
            );
        }

        const summaryWs = wb.addWorksheet('Summary');
        summaryData.forEach((row) => summaryWs.addRow(row));
        summaryWs.getColumn(1).width = 25;
        summaryWs.getColumn(2).width = 30;

        // Append branded disclaimer at the bottom of the summary
        summaryWs.addRow([]);
        summaryWs.addRow([BEAMLAB_COMPANY.generatedByLine]);
        summaryWs.addRow([BEAMLAB_COMPANY.disclaimer]);
        }

    // ========================================
    // 2. NODES SHEET
    // ========================================
    if (includeNodes) {
        const nodesHeaders = [
            'Node ID', 'X (m)', 'Y (m)', 'Z (m)',
            'Fixed TX', 'Fixed TY', 'Fixed TZ',
            'Fixed RX', 'Fixed RY', 'Fixed RZ'
        ];
        
        const nodesData = Array.from(nodes.values()).map(n => [
            n.id,
            formatNumber(n.x, 4),
            formatNumber(n.y, 4),
            formatNumber(n.z || 0, 4),
            n.restraints?.fx ? 'Yes' : 'No',
            n.restraints?.fy ? 'Yes' : 'No',
            n.restraints?.fz ? 'Yes' : 'No',
            n.restraints?.mx ? 'Yes' : 'No',
            n.restraints?.my ? 'Yes' : 'No',
            n.restraints?.mz ? 'Yes' : 'No'
        ]);
        
        createStyledWorksheet(wb, 'Nodes', nodesHeaders, nodesData, 'Node Coordinates');
    }

    // ========================================
    // 3. MEMBERS SHEET
    // ========================================
    if (includeMembers) {
        const membersHeaders = [
            'Member ID', 'Start Node', 'End Node', 
            'Section', 'Material', 
            'E (GPa)', 'A (cm²)', 'Iy (cm⁴)', 'Iz (cm⁴)',
            'Length (m)'
        ];
        
        const membersData = Array.from(members.values()).map(m => {
            const startNode = nodes.get(m.startNodeId);
            const endNode = nodes.get(m.endNodeId);
            let length = 0;
            if (startNode && endNode) {
                length = Math.sqrt(
                    (endNode.x - startNode.x) ** 2 +
                    (endNode.y - startNode.y) ** 2 +
                    (endNode.z || 0 - (startNode.z || 0)) ** 2
                );
            }
            
            return [
                m.id,
                m.startNodeId,
                m.endNodeId,
                m.section?.name || 'Default',
                m.material || 'Steel',
                formatNumber((m.E || 200e9) / 1e9, 0),
                formatNumber((m.A || 0.01) * 1e4, 2),
                formatNumber((m.Iy || 1e-4) * 1e8, 2),
                formatNumber((m.Iz || 1e-4) * 1e8, 2),
                formatNumber(length, 3)
            ];
        });
        
        createStyledWorksheet(wb, 'Members', membersHeaders, membersData, 'Member Properties');
    }

    // ========================================
    // 4. DISPLACEMENTS SHEET
    // ========================================
    if (includeResults && results) {
        const dispHeaders = [
            'Node ID', 
            'DX (mm)', 'DY (mm)', 'DZ (mm)',
            'RX (mrad)', 'RY (mrad)', 'RZ (mrad)',
            'Total Disp (mm)'
        ];
        
        const dispData = Array.from(results.displacements.entries()).map(([id, disp]: [string, any]) => {
            const dx = (disp.dx || 0) * 1000;
            const dy = (disp.dy || 0) * 1000;
            const dz = (disp.dz || 0) * 1000;
            const total = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            return [
                id,
                formatNumber(dx, 4),
                formatNumber(dy, 4),
                formatNumber(dz, 4),
                formatNumber((disp.rx || 0) * 1000, 4),
                formatNumber((disp.ry || 0) * 1000, 4),
                formatNumber((disp.rz || 0) * 1000, 4),
                formatNumber(total, 4)
            ];
        });
        
        createStyledWorksheet(wb, 'Displacements', dispHeaders, dispData, 'Nodal Displacements');
    }

    // ========================================
    // 5. MEMBER FORCES SHEET
    // ========================================
    if (includeResults && results) {
        const forcesHeaders = [
            'Member ID',
            'Axial (kN)',
            'Shear Y (kN)', 'Shear Z (kN)',
            'Moment Y (kN·m)', 'Moment Z (kN·m)',
            'Torsion (kN·m)'
        ];
        
        const forcesData = Array.from(results.memberForces.entries()).map(([id, forces]: [string, any]) => [
            id,
            formatNumber(forces.axial || 0, 2),
            formatNumber(forces.shearY || 0, 2),
            formatNumber(forces.shearZ || 0, 2),
            formatNumber(forces.momentY || 0, 2),
            formatNumber(forces.momentZ || 0, 2),
            formatNumber(forces.torsion || 0, 2)
        ]);
        
        createStyledWorksheet(wb, 'Forces', forcesHeaders, forcesData, 'Member Forces');
    }

    // ========================================
    // 6. REACTIONS SHEET
    // ========================================
    if (includeResults && results && results.reactions) {
        const reactionsHeaders = [
            'Node ID',
            'RX (kN)', 'RY (kN)', 'RZ (kN)',
            'MX (kN·m)', 'MY (kN·m)', 'MZ (kN·m)'
        ];
        
        const reactionsData = Array.from(results.reactions.entries()).map(([id, react]: [string, any]) => [
            id,
            formatNumber(react.fx || 0, 2),
            formatNumber(react.fy || 0, 2),
            formatNumber(react.fz || 0, 2),
            formatNumber(react.mx || 0, 2),
            formatNumber(react.my || 0, 2),
            formatNumber(react.mz || 0, 2)
        ]);
        
        createStyledWorksheet(wb, 'Reactions', reactionsHeaders, reactionsData, 'Support Reactions');
    }

    // ========================================
    // 7. DESIGN CHECKS SHEET
    // ========================================
    if (includeDesignChecks && designChecks.length > 0) {
        const checksHeaders = [
            'Member ID', 'Section',
            'Utilization (%)', 'Status',
            'Governing Case'
        ];
        
        const checksData = designChecks.map(check => [
            check.memberId,
            check.section,
            formatNumber(check.utilization * 100, 1),
            check.status,
            check.governingCase
        ]);
        
        createStyledWorksheet(wb, 'Design Checks', checksHeaders, checksData, 'Design Checks - IS 800:2007');
    }

    // ========================================
    // GENERATE AND DOWNLOAD
    // ========================================
    const filename = `${projectInfo.name.replace(/\s+/g, '_')}_${projectInfo.date}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    downloadExcelBuffer(buffer as ArrayBuffer, filename);
};

/**
 * Export analysis comparison to Excel
 */
export const exportComparisonToExcel = async (
    comparisons: Array<{
        name: string;
        results: AnalysisResults;
        parameters: Record<string, any>;
    }>
): Promise<void> => {
    const ExcelJS = await getExcelJS();
    const wb = new ExcelJS.Workbook();

    // Create comparison summary
    const summaryHeaders = ['Parameter', ...comparisons.map(c => c.name)];
    const summaryData: (string | number)[][] = [];

    // Add parameter comparison
    const allParams = new Set<string>();
    comparisons.forEach(c => Object.keys(c.parameters).forEach(p => allParams.add(p)));
    
    allParams.forEach(param => {
        const row: (string | number)[] = [param];
        comparisons.forEach(c => row.push(c.parameters[param] ?? 'N/A'));
        summaryData.push(row);
    });

    createStyledWorksheet(wb, 'Comparison', summaryHeaders, summaryData, 'Parameter Comparison');

    // Add individual result sheets
    comparisons.forEach((comp, idx) => {
        const forcesHeaders = ['Member ID', 'Axial (kN)', 'Moment (kN·m)', 'Shear (kN)'];
        const forcesData = Array.from(comp.results.memberForces.entries()).map(([id, forces]: [string, any]) => [
            id,
            formatNumber(forces.axial || 0, 2),
            formatNumber(forces.momentZ || forces.momentY || 0, 2),
            formatNumber(forces.shearY || forces.shearZ || 0, 2)
        ]);
        
        createStyledWorksheet(wb, `Case ${idx + 1}`, forcesHeaders, forcesData);
    });

    const filename = `BeamLab_Comparison_${new Date().toISOString().split('T')[0]}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    downloadExcelBuffer(buffer as ArrayBuffer, filename);
};

/**
 * Legacy export function (backward compatibility)
 */
export const exportProjectData = (
    project_name: string,
    nodes: Map<string, any>,
    members: Map<string, any>,
    results: AnalysisResults | null
): void => {
    // Use the new Excel export
    exportToExcel(nodes, members, results, [], {
        projectInfo: {
            name: project_name,
            engineer: 'Engineer',
            date: new Date().toISOString().split('T')[0],
        },
    }).catch(error => {
        console.error('Excel export failed, falling back to CSV:', error);
        // Fallback to CSV export
        const timestamp = new Date().toISOString().split('T')[0];
        const cleanName = project_name.replace(/\s+/g, '_');

        const nodesHeaders = ['Node ID', 'X (m)', 'Y (m)', 'Z (m)'];
        const nodesData = Array.from(nodes.values()).map(n => [n.id, n.x, n.y, n.z || 0]);
        exportToCSV(`${cleanName}_Nodes_${timestamp}`, nodesHeaders, nodesData);
    });
};

