/**
 * DXFExportService.ts
 * 
 * AutoCAD DXF File Export for Structural Drawings
 * 
 * Features:
 * - 2D plan/section/elevation exports
 * - Layer organization
 * - Text and dimension support
 * - Member labels
 * - Support symbols
 */

// ============================================
// TYPES
// ============================================

export interface DXFNode {
    id: string;
    x: number;
    y: number;
    z: number;
    supportType?: 'fixed' | 'pinned' | 'roller';
}

export interface DXFMember {
    id: string;
    startNode: string;
    endNode: string;
    section: string;
    type: 'beam' | 'column' | 'brace';
}

export interface DXFLayer {
    name: string;
    color: number;   // AutoCAD color index (1-255)
    lineType: string;
}

export interface DXFExportOptions {
    viewType: 'plan' | 'elevation_x' | 'elevation_y' | 'section';
    level?: number;
    includeLabels: boolean;
    includeDimensions: boolean;
    includeGrid: boolean;
    scale: number;
}

// ============================================
// DXF CONSTANTS
// ============================================

const COLORS = {
    GRID: 8,         // Gray
    BEAMS: 1,        // Red
    COLUMNS: 3,      // Green
    BRACES: 5,       // Blue
    TEXT: 7,         // White/Black
    DIMENSIONS: 4,   // Cyan
    SUPPORTS: 6      // Magenta
};

// ============================================
// DXF EXPORT SERVICE
// ============================================

class DXFExportServiceClass {
    private dxfContent: string[] = [];

    /**
     * Export structural model to DXF
     */
    exportToDXF(
        nodes: DXFNode[],
        members: DXFMember[],
        options: DXFExportOptions
    ): string {
        this.dxfContent = [];

        // Header section
        this.addHeader();

        // Tables section (layers, line types)
        this.addTables();

        // Entities section
        this.addSection('ENTITIES');

        // Add grid if requested
        if (options.includeGrid) {
            this.addGridLines(nodes, options);
        }

        // Transform coordinates based on view type
        const transform = this.getTransformFunction(options.viewType);

        // Add members
        for (const member of members) {
            const startNode = nodes.find(n => n.id === member.startNode);
            const endNode = nodes.find(n => n.id === member.endNode);
            if (!startNode || !endNode) continue;

            const layer = member.type === 'column' ? 'COLUMNS' :
                member.type === 'brace' ? 'BRACES' : 'BEAMS';

            const start = transform(startNode);
            const end = transform(endNode);

            this.addLine(start.x, start.y, end.x, end.y, layer);

            // Add label
            if (options.includeLabels) {
                const midX = (start.x + end.x) / 2;
                const midY = (start.y + end.y) / 2;
                this.addText(member.section, midX, midY + 0.2, 0.15, 'LABELS');
            }
        }

        // Add supports
        for (const node of nodes) {
            if (node.supportType) {
                const pos = transform(node);
                this.addSupportSymbol(pos.x, pos.y, node.supportType);
            }
        }

        // Add dimensions if requested
        if (options.includeDimensions) {
            this.addDimensions(nodes, members, transform);
        }

        this.addEndSection();

        // EOF
        this.addEOF();

        return this.dxfContent.join('\n');
    }

    /**
     * Add DXF header
     */
    private addHeader(): void {
        this.dxfContent.push('0', 'SECTION');
        this.dxfContent.push('2', 'HEADER');
        this.dxfContent.push('9', '$ACADVER');
        this.dxfContent.push('1', 'AC1024'); // AutoCAD 2010 format
        this.dxfContent.push('9', '$INSUNITS');
        this.dxfContent.push('70', '6'); // Meters
        this.dxfContent.push('0', 'ENDSEC');
    }

    /**
     * Add tables section (layers)
     */
    private addTables(): void {
        this.dxfContent.push('0', 'SECTION');
        this.dxfContent.push('2', 'TABLES');

        // Layer table
        this.dxfContent.push('0', 'TABLE');
        this.dxfContent.push('2', 'LAYER');

        // Add layers
        this.addLayer('0', 7, 'CONTINUOUS');
        this.addLayer('GRID', COLORS.GRID, 'DASHED');
        this.addLayer('BEAMS', COLORS.BEAMS, 'CONTINUOUS');
        this.addLayer('COLUMNS', COLORS.COLUMNS, 'CONTINUOUS');
        this.addLayer('BRACES', COLORS.BRACES, 'CONTINUOUS');
        this.addLayer('LABELS', COLORS.TEXT, 'CONTINUOUS');
        this.addLayer('DIMENSIONS', COLORS.DIMENSIONS, 'CONTINUOUS');
        this.addLayer('SUPPORTS', COLORS.SUPPORTS, 'CONTINUOUS');

        this.dxfContent.push('0', 'ENDTAB');
        this.dxfContent.push('0', 'ENDSEC');
    }

    /**
     * Add layer definition
     */
    private addLayer(name: string, color: number, lineType: string): void {
        this.dxfContent.push('0', 'LAYER');
        this.dxfContent.push('2', name);
        this.dxfContent.push('70', '0');
        this.dxfContent.push('62', color.toString());
        this.dxfContent.push('6', lineType);
    }

    /**
     * Add section start
     */
    private addSection(name: string): void {
        this.dxfContent.push('0', 'SECTION');
        this.dxfContent.push('2', name);
    }

    /**
     * Add section end
     */
    private addEndSection(): void {
        this.dxfContent.push('0', 'ENDSEC');
    }

    /**
     * Add line entity
     */
    private addLine(x1: number, y1: number, x2: number, y2: number, layer: string): void {
        this.dxfContent.push('0', 'LINE');
        this.dxfContent.push('8', layer);
        this.dxfContent.push('10', x1.toFixed(6));
        this.dxfContent.push('20', y1.toFixed(6));
        this.dxfContent.push('11', x2.toFixed(6));
        this.dxfContent.push('21', y2.toFixed(6));
    }

    /**
     * Add text entity
     */
    private addText(text: string, x: number, y: number, height: number, layer: string): void {
        this.dxfContent.push('0', 'TEXT');
        this.dxfContent.push('8', layer);
        this.dxfContent.push('10', x.toFixed(6));
        this.dxfContent.push('20', y.toFixed(6));
        this.dxfContent.push('40', height.toFixed(6));
        this.dxfContent.push('1', text);
        this.dxfContent.push('72', '1'); // Center justified
    }

    /**
     * Add circle entity
     */
    private addCircle(x: number, y: number, radius: number, layer: string): void {
        this.dxfContent.push('0', 'CIRCLE');
        this.dxfContent.push('8', layer);
        this.dxfContent.push('10', x.toFixed(6));
        this.dxfContent.push('20', y.toFixed(6));
        this.dxfContent.push('40', radius.toFixed(6));
    }

    /**
     * Add support symbol
     */
    private addSupportSymbol(x: number, y: number, type: 'fixed' | 'pinned' | 'roller'): void {
        const layer = 'SUPPORTS';
        const size = 0.3;

        switch (type) {
            case 'fixed':
                // Triangle with hatching
                this.addLine(x - size, y - size, x + size, y - size, layer);
                this.addLine(x - size, y - size, x, y, layer);
                this.addLine(x + size, y - size, x, y, layer);
                // Ground line
                this.addLine(x - size * 1.2, y - size, x + size * 1.2, y - size, layer);
                break;

            case 'pinned':
                // Triangle only
                this.addLine(x - size, y - size, x + size, y - size, layer);
                this.addLine(x - size, y - size, x, y, layer);
                this.addLine(x + size, y - size, x, y, layer);
                this.addCircle(x, y, size * 0.15, layer);
                break;

            case 'roller':
                // Triangle with circles
                this.addLine(x - size, y - size * 0.5, x + size, y - size * 0.5, layer);
                this.addLine(x - size, y - size * 0.5, x, y, layer);
                this.addLine(x + size, y - size * 0.5, x, y, layer);
                this.addCircle(x - size * 0.5, y - size * 0.7, size * 0.15, layer);
                this.addCircle(x + size * 0.5, y - size * 0.7, size * 0.15, layer);
                break;
        }
    }

    /**
     * Add grid lines
     */
    private addGridLines(nodes: DXFNode[], options: DXFExportOptions): void {
        const transform = this.getTransformFunction(options.viewType);
        const xs = [...new Set(nodes.map(n => transform(n).x))].sort((a, b) => a - b);
        const ys = [...new Set(nodes.map(n => transform(n).y))].sort((a, b) => a - b);

        const minX = Math.min(...xs) - 1;
        const maxX = Math.max(...xs) + 1;
        const minY = Math.min(...ys) - 1;
        const maxY = Math.max(...ys) + 1;

        // Vertical grid lines
        xs.forEach((x, i) => {
            this.addLine(x, minY, x, maxY, 'GRID');
            this.addText(String.fromCharCode(65 + i), x, maxY + 0.5, 0.3, 'GRID');
        });

        // Horizontal grid lines
        ys.forEach((y, i) => {
            this.addLine(minX, y, maxX, y, 'GRID');
            this.addText((i + 1).toString(), minX - 0.5, y, 0.3, 'GRID');
        });
    }

    /**
     * Add dimensions
     */
    private addDimensions(
        nodes: DXFNode[],
        members: DXFMember[],
        transform: (n: DXFNode) => { x: number; y: number }
    ): void {
        // Add dimension lines for horizontal spans
        const beams = members.filter(m => m.type === 'beam');

        for (const beam of beams.slice(0, 5)) { // Limit to avoid clutter
            const start = nodes.find(n => n.id === beam.startNode);
            const end = nodes.find(n => n.id === beam.endNode);
            if (!start || !end) continue;

            const p1 = transform(start);
            const p2 = transform(end);
            const length = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);

            // Dimension line below
            const offset = -0.5;
            this.addLine(p1.x, p1.y + offset, p2.x, p2.y + offset, 'DIMENSIONS');
            this.addText(`${length.toFixed(2)}m`, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 + offset - 0.2, 0.12, 'DIMENSIONS');
        }
    }

    /**
     * Get coordinate transform function for view type
     */
    private getTransformFunction(viewType: DXFExportOptions['viewType']): (n: DXFNode) => { x: number; y: number } {
        switch (viewType) {
            case 'plan':
                return (n) => ({ x: n.x, y: n.z });
            case 'elevation_x':
                return (n) => ({ x: n.x, y: n.y });
            case 'elevation_y':
                return (n) => ({ x: n.z, y: n.y });
            case 'section':
            default:
                return (n) => ({ x: n.x, y: n.y });
        }
    }

    /**
     * Add EOF
     */
    private addEOF(): void {
        this.dxfContent.push('0', 'EOF');
    }

    /**
     * Download DXF file
     */
    download(content: string, filename: string = 'structure.dxf'): void {
        const blob = new Blob([content], { type: 'application/dxf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }
}

// ============================================
// SINGLETON
// ============================================

export const dxfExport = new DXFExportServiceClass();

export default DXFExportServiceClass;
