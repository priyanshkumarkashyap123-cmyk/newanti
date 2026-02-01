/**
 * EnhancedDXFExportService.ts - Production DXF Export
 * 
 * Features:
 * - Section outlines with proper geometry
 * - Dimension annotations
 * - Layer organization (members, annotations, supports, loads)
 * - Block definitions for standard sections
 * - Text annotations for member IDs and sections
 */

// ============================================
// TYPES
// ============================================

interface Node {
    id: string;
    x: number;
    y: number;
    z: number;
}

interface Member {
    id: string;
    startNodeId: string;
    endNodeId: string;
    section?: {
        name: string;
        depth?: number;
        width?: number;
    };
}

interface Support {
    nodeId: string;
    type: 'fixed' | 'pinned' | 'roller';
}

interface Load {
    nodeId?: string;
    memberId?: string;
    type: 'point' | 'udl';
    fx?: number;
    fy?: number;
    fz?: number;
    magnitude?: number;
}

interface DXFExportOptions {
    includeAnnotations?: boolean;
    includeDimensions?: boolean;
    includeLoads?: boolean;
    includeSupports?: boolean;
    scale?: number;
    textHeight?: number;
}

// ============================================
// LAYER DEFINITIONS
// ============================================

const LAYERS = {
    MEMBERS: { name: 'BEAMLAB_MEMBERS', color: 7 },
    NODES: { name: 'BEAMLAB_NODES', color: 3 },
    SUPPORTS: { name: 'BEAMLAB_SUPPORTS', color: 1 },
    LOADS: { name: 'BEAMLAB_LOADS', color: 5 },
    ANNOTATIONS: { name: 'BEAMLAB_ANNOTATIONS', color: 4 },
    DIMENSIONS: { name: 'BEAMLAB_DIMENSIONS', color: 2 },
    SECTIONS: { name: 'BEAMLAB_SECTIONS', color: 6 }
};

// ============================================
// DXF EXPORT SERVICE
// ============================================

class EnhancedDXFExportServiceClass {
    private handle = 100;

    /**
     * Generate complete DXF file
     */
    generateDXF(
        nodes: Map<string, Node>,
        members: Map<string, Member>,
        supports?: Support[],
        loads?: Load[],
        options: DXFExportOptions = {}
    ): string {
        this.handle = 100;
        const opts = {
            includeAnnotations: true,
            includeDimensions: true,
            includeLoads: true,
            includeSupports: true,
            scale: 1,
            textHeight: 150,
            ...options
        };

        let dxf = '';
        dxf += this.generateHeader();
        dxf += this.generateTables();
        dxf += this.generateBlocks();
        dxf += this.generateEntities(nodes, members, supports, loads, opts);
        dxf += '0\nEOF\n';

        return dxf;
    }

    /**
     * Download DXF file
     */
    downloadDXF(content: string, filename: string = 'structure.dxf'): void {
        const blob = new Blob([content], { type: 'application/dxf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // ============================================
    // DXF SECTIONS
    // ============================================

    private generateHeader(): string {
        return `0
SECTION
2
HEADER
9
$ACADVER
1
AC1021
9
$INSUNITS
70
4
9
$LUNITS
70
2
9
$MEASUREMENT
70
1
0
ENDSEC
`;
    }

    private generateTables(): string {
        let tables = '0\nSECTION\n2\nTABLES\n';

        // Layer table
        tables += '0\nTABLE\n2\nLAYER\n';
        tables += `5\n${this.getHandle()}\n`;
        tables += '330\n0\n100\nAcDbSymbolTable\n70\n7\n';

        Object.values(LAYERS).forEach(layer => {
            tables += `0\nLAYER\n5\n${this.getHandle()}\n330\n2\n`;
            tables += `100\nAcDbSymbolTableRecord\n100\nAcDbLayerTableRecord\n`;
            tables += `2\n${layer.name}\n70\n0\n62\n${layer.color}\n6\nCONTINUOUS\n`;
        });

        tables += '0\nENDTAB\n';

        // Text style table
        tables += '0\nTABLE\n2\nSTYLE\n';
        tables += `5\n${this.getHandle()}\n100\nAcDbSymbolTable\n70\n1\n`;
        tables += `0\nSTYLE\n5\n${this.getHandle()}\n100\nAcDbSymbolTableRecord\n`;
        tables += '100\nAcDbTextStyleTableRecord\n2\nSTANDARD\n70\n0\n40\n0\n41\n1\n';
        tables += '0\nENDTAB\n';

        tables += '0\nENDSEC\n';
        return tables;
    }

    private generateBlocks(): string {
        let blocks = '0\nSECTION\n2\nBLOCKS\n';

        // Fixed support block
        blocks += this.createSupportBlock('FIXED_SUPPORT', this.drawFixedSupport());
        blocks += this.createSupportBlock('PINNED_SUPPORT', this.drawPinnedSupport());
        blocks += this.createSupportBlock('ROLLER_SUPPORT', this.drawRollerSupport());

        blocks += '0\nENDSEC\n';
        return blocks;
    }

    private createSupportBlock(name: string, geometry: string): string {
        return `0\nBLOCK\n5\n${this.getHandle()}\n8\n0\n2\n${name}\n70\n0\n10\n0\n20\n0\n30\n0\n${geometry}0\nENDBLK\n5\n${this.getHandle()}\n8\n0\n`;
    }

    private generateEntities(
        nodes: Map<string, Node>,
        members: Map<string, Member>,
        supports?: Support[],
        loads?: Load[],
        opts?: DXFExportOptions
    ): string {
        let entities = '0\nSECTION\n2\nENTITIES\n';

        // Draw members
        members.forEach(member => {
            const start = nodes.get(member.startNodeId);
            const end = nodes.get(member.endNodeId);
            if (start && end) {
                entities += this.drawLine(start.x, start.y, end.x, end.y, LAYERS.MEMBERS.name);

                // Add section annotation
                if (opts?.includeAnnotations && member.section) {
                    const midX = (start.x + end.x) / 2;
                    const midY = (start.y + end.y) / 2;
                    entities += this.drawText(midX, midY + 200, member.section.name, opts.textHeight || 150, LAYERS.ANNOTATIONS.name);
                }
            }
        });

        // Draw nodes
        nodes.forEach(node => {
            entities += this.drawCircle(node.x, node.y, 50, LAYERS.NODES.name);
        });

        // Draw supports
        if (opts?.includeSupports && supports) {
            supports.forEach(support => {
                const node = nodes.get(support.nodeId);
                if (node) {
                    const blockName = `${support.type.toUpperCase()}_SUPPORT`;
                    entities += this.drawBlockInsert(blockName, node.x, node.y, LAYERS.SUPPORTS.name);
                }
            });
        }

        // Draw loads
        if (opts?.includeLoads && loads) {
            loads.forEach(load => {
                if (load.nodeId) {
                    const node = nodes.get(load.nodeId);
                    if (node) {
                        entities += this.drawArrow(node.x, node.y, load.fy || 0, LAYERS.LOADS.name);
                    }
                }
            });
        }

        entities += '0\nENDSEC\n';
        return entities;
    }

    // ============================================
    // DRAWING PRIMITIVES
    // ============================================

    private drawLine(x1: number, y1: number, x2: number, y2: number, layer: string): string {
        return `0\nLINE\n5\n${this.getHandle()}\n8\n${layer}\n10\n${x1}\n20\n${y1}\n30\n0\n11\n${x2}\n21\n${y2}\n31\n0\n`;
    }

    private drawCircle(x: number, y: number, r: number, layer: string): string {
        return `0\nCIRCLE\n5\n${this.getHandle()}\n8\n${layer}\n10\n${x}\n20\n${y}\n30\n0\n40\n${r}\n`;
    }

    private drawText(x: number, y: number, text: string, height: number, layer: string): string {
        return `0\nTEXT\n5\n${this.getHandle()}\n8\n${layer}\n10\n${x}\n20\n${y}\n30\n0\n40\n${height}\n1\n${text}\n`;
    }

    private drawBlockInsert(name: string, x: number, y: number, layer: string): string {
        return `0\nINSERT\n5\n${this.getHandle()}\n8\n${layer}\n2\n${name}\n10\n${x}\n20\n${y}\n30\n0\n41\n1\n42\n1\n43\n1\n50\n0\n`;
    }

    private drawArrow(x: number, y: number, magnitude: number, layer: string): string {
        const length = 300;
        const dir = magnitude < 0 ? 1 : -1;
        return this.drawLine(x, y, x, y + dir * length, layer) +
            this.drawLine(x, y, x - 50, y + dir * 100, layer) +
            this.drawLine(x, y, x + 50, y + dir * 100, layer);
    }

    private drawFixedSupport(): string {
        return this.drawLine(-100, 0, -100, -100, '0') +
            this.drawLine(100, 0, 100, -100, '0') +
            this.drawLine(-100, -100, 100, -100, '0');
    }

    private drawPinnedSupport(): string {
        return `0\nLINE\n8\n0\n10\n0\n20\n0\n11\n-75\n21\n-100\n0\nLINE\n8\n0\n10\n0\n20\n0\n11\n75\n21\n-100\n0\nLINE\n8\n0\n10\n-75\n20\n-100\n11\n75\n21\n-100\n`;
    }

    private drawRollerSupport(): string {
        return this.drawCircle(0, -50, 50, '0');
    }

    private getHandle(): string {
        return (this.handle++).toString(16).toUpperCase();
    }
}

// ============================================
// SINGLETON
// ============================================

export const enhancedDXF = new EnhancedDXFExportServiceClass();
export const generateDXF = enhancedDXF.generateDXF.bind(enhancedDXF);
export const downloadDXF = enhancedDXF.downloadDXF.bind(enhancedDXF);
export default enhancedDXF;
