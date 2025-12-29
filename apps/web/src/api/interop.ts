/**
 * interop.ts - File Import/Export API Service
 * 
 * Provides TypeScript interfaces and API calls for:
 * - STAAD.Pro import/export
 * - JSON model exchange
 * - DXF geometry import
 * - Excel/CSV export
 * - Report generation
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ============================================
// COMMON TYPES
// ============================================

export interface ModelNode {
    id: string;
    x: number;
    y: number;
    z: number;
}

export interface ModelMember {
    id: string;
    startNodeId: string;
    endNodeId: string;
    section?: {
        name?: string;
        A?: number;
        I?: number;
        E?: number;
    };
}

export interface ModelSupport {
    nodeId: string;
    type: 'FIXED' | 'PINNED' | 'ROLLER_X' | 'ROLLER_Y' | 'ROLLER_Z';
}

export interface ModelLoad {
    type: 'nodal' | 'member' | 'distributed';
    targetId: string;
    values: Record<string, number>;
}

export interface StructuralModel {
    nodes: ModelNode[];
    members: ModelMember[];
    supports: ModelSupport[];
    loads?: ModelLoad[];
    metadata?: {
        title?: string;
        engineer?: string;
        date?: string;
        units?: string;
    };
}

// ============================================
// STAAD IMPORT/EXPORT
// ============================================

export interface STAADImportResult {
    success: boolean;
    model: StructuralModel;
    warnings?: string[];
    errors?: string[];
    stats: {
        nodesCount: number;
        membersCount: number;
        supportsCount: number;
        loadCasesCount: number;
    };
}

/**
 * Parse STAAD.Pro .std file content
 */
export async function importSTAAD(fileContent: string): Promise<STAADImportResult> {
    const response = await fetch(`${API_BASE}/api/interop/staad/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fileContent }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Import failed' }));
        throw new Error(error.error || 'STAAD import failed');
    }

    return response.json();
}

/**
 * Export model to STAAD.Pro format
 */
export async function exportSTAAD(model: StructuralModel): Promise<string> {
    const response = await fetch(`${API_BASE}/api/interop/staad/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(error.error || 'STAAD export failed');
    }

    const result = await response.json();
    return result.content;
}

// ============================================
// JSON MODEL EXCHANGE
// ============================================

/**
 * Export model to JSON format
 */
export function exportJSON(model: StructuralModel): string {
    return JSON.stringify(model, null, 2);
}

/**
 * Import model from JSON
 */
export function importJSON(content: string): StructuralModel {
    const data = JSON.parse(content);
    
    // Validate required fields
    if (!Array.isArray(data.nodes)) {
        throw new Error('Invalid JSON: missing nodes array');
    }
    if (!Array.isArray(data.members)) {
        throw new Error('Invalid JSON: missing members array');
    }
    
    return data as StructuralModel;
}

// ============================================
// DXF IMPORT
// ============================================

export interface DXFImportResult {
    success: boolean;
    nodes: ModelNode[];
    members: ModelMember[];
    layers: string[];
    stats: {
        linesCount: number;
        nodesCount: number;
        membersCount: number;
    };
}

/**
 * Parse DXF file and extract structural geometry
 */
export async function importDXF(fileContent: string): Promise<DXFImportResult> {
    const response = await fetch(`${API_BASE}/api/interop/dxf/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fileContent }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Import failed' }));
        throw new Error(error.error || 'DXF import failed');
    }

    return response.json();
}

/**
 * Simple client-side DXF parser (for LINE entities only)
 */
export function parseDXFLocally(content: string): {
    lines: Array<{
        x1: number; y1: number; z1: number;
        x2: number; y2: number; z2: number;
        layer: string;
    }>;
} {
    const lines: Array<{
        x1: number; y1: number; z1: number;
        x2: number; y2: number; z2: number;
        layer: string;
    }> = [];

    const entitySection = content.split('ENTITIES')[1]?.split('ENDSEC')[0] || '';
    const lineBlocks = entitySection.split('LINE');

    for (let i = 1; i < lineBlocks.length; i++) {
        const block = lineBlocks[i];
        const codes = block.match(/\n\s*(\d+)\n\s*([^\n]+)/g) || [];
        
        const values: Record<string, string> = {};
        for (const code of codes) {
            const match = code.match(/(\d+)\n\s*([^\n]+)/);
            if (match) {
                values[match[1]] = match[2].trim();
            }
        }

        if (values['10'] && values['20'] && values['11'] && values['21']) {
            lines.push({
                x1: parseFloat(values['10']),
                y1: parseFloat(values['20']),
                z1: parseFloat(values['30'] || '0'),
                x2: parseFloat(values['11']),
                y2: parseFloat(values['21']),
                z2: parseFloat(values['31'] || '0'),
                layer: values['8'] || '0',
            });
        }
    }

    return { lines };
}

/**
 * Convert DXF lines to structural model
 */
export function dxfLinesToModel(
    lines: Array<{
        x1: number; y1: number; z1: number;
        x2: number; y2: number; z2: number;
    }>,
    tolerance = 0.01
): { nodes: ModelNode[]; members: ModelMember[] } {
    const nodeMap = new Map<string, ModelNode>();
    const members: ModelMember[] = [];

    const getNodeKey = (x: number, y: number, z: number) => 
        `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;

    const getOrCreateNode = (x: number, y: number, z: number): ModelNode => {
        const key = getNodeKey(x, y, z);
        if (!nodeMap.has(key)) {
            const id = `N${nodeMap.size + 1}`;
            nodeMap.set(key, { id, x, y, z });
        }
        return nodeMap.get(key)!;
    };

    lines.forEach((line, idx) => {
        const startNode = getOrCreateNode(line.x1, line.y1, line.z1);
        const endNode = getOrCreateNode(line.x2, line.y2, line.z2);
        
        members.push({
            id: `M${idx + 1}`,
            startNodeId: startNode.id,
            endNodeId: endNode.id,
        });
    });

    return {
        nodes: Array.from(nodeMap.values()),
        members,
    };
}

// ============================================
// EXCEL/CSV EXPORT
// ============================================

export interface ExcelExportOptions {
    includeNodes?: boolean;
    includeMembers?: boolean;
    includeForces?: boolean;
    includeReactions?: boolean;
    includeDesign?: boolean;
}

/**
 * Export results to CSV format
 */
export function exportToCSV(
    data: Array<Record<string, unknown>>,
    headers: string[]
): string {
    const rows: string[] = [];
    
    // Header row
    rows.push(headers.join(','));
    
    // Data rows
    for (const row of data) {
        const values = headers.map((h) => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
            return String(val);
        });
        rows.push(values.join(','));
    }
    
    return rows.join('\n');
}

/**
 * Export nodes to CSV
 */
export function exportNodesToCSV(nodes: ModelNode[]): string {
    return exportToCSV(
        nodes.map((n) => ({
            ID: n.id,
            X: n.x,
            Y: n.y,
            Z: n.z,
        })),
        ['ID', 'X', 'Y', 'Z']
    );
}

/**
 * Export members to CSV
 */
export function exportMembersToCSV(members: ModelMember[]): string {
    return exportToCSV(
        members.map((m) => ({
            ID: m.id,
            'Start Node': m.startNodeId,
            'End Node': m.endNodeId,
            Section: m.section?.name || '',
        })),
        ['ID', 'Start Node', 'End Node', 'Section']
    );
}

// ============================================
// REPORT GENERATION
// ============================================

export interface ReportOptions {
    title: string;
    engineer?: string;
    date?: string;
    projectNumber?: string;
    sections: {
        modelSummary?: boolean;
        nodeTable?: boolean;
        memberTable?: boolean;
        loadCases?: boolean;
        analysisResults?: boolean;
        designResults?: boolean;
        diagrams?: boolean;
    };
}

export interface ReportResult {
    success: boolean;
    pdfUrl?: string;
    htmlContent?: string;
}

/**
 * Generate PDF report
 */
export async function generateReport(
    model: StructuralModel,
    results: unknown,
    options: ReportOptions
): Promise<ReportResult> {
    const response = await fetch(`${API_BASE}/api/report/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, results, options }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Report generation failed' }));
        throw new Error(error.error || 'Failed to generate report');
    }

    return response.json();
}

// ============================================
// FILE DOWNLOAD UTILITIES
// ============================================

/**
 * Download text content as file
 */
export function downloadTextFile(content: string, filename: string, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Download JSON model
 */
export function downloadJSON(model: StructuralModel, filename = 'model.json') {
    downloadTextFile(exportJSON(model), filename, 'application/json');
}

/**
 * Download STAAD file
 */
export async function downloadSTAAD(model: StructuralModel, filename = 'model.std') {
    const content = await exportSTAAD(model);
    downloadTextFile(content, filename, 'text/plain');
}

/**
 * Download CSV file
 */
export function downloadCSV(content: string, filename: string) {
    downloadTextFile(content, filename, 'text/csv');
}

// ============================================
// FILE READING UTILITIES
// ============================================

/**
 * Read file as text
 */
export function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

/**
 * Get file extension
 */
export function getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Supported file formats
 */
export const SUPPORTED_FORMATS = {
    import: ['json', 'std', 'dxf'],
    export: ['json', 'std', 'csv'],
};
