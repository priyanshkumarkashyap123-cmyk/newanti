/**
 * ============================================================================
 * PROFESSIONAL DXF EXPORT SERVICE
 * ============================================================================
 * 
 * Industry-standard AutoCAD DXF R12/R14 export for structural models.
 * Supports:
 * - Multiple layers (members, nodes, loads, annotations)
 * - Section profiles as blocks
 * - Dimensioning
 * - Text annotations
 * - Load arrows
 * - Support symbols
 * - Result contours
 * 
 * @version 2.0.0
 * @author BeamLab Engineering Team
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Node {
    id: string;
    x: number;
    y: number;
    z: number;
    restraints?: {
        fx?: boolean;
        fy?: boolean;
        fz?: boolean;
        mx?: boolean;
        my?: boolean;
        mz?: boolean;
    };
}

interface Member {
    id: string;
    startNodeId: string;
    endNodeId: string;
    section?: {
        name: string;
        depth?: number;
        width?: number;
        area?: number;
    };
}

interface Load {
    nodeId?: string;
    memberId?: string;
    fx?: number;
    fy?: number;
    fz?: number;
    magnitude?: number;
    type: 'point' | 'distributed';
}

interface AnalysisResult {
    displacements?: Map<string, { dx: number; dy: number; dz: number }>;
    memberForces?: Map<string, {
        axial: number;
        shearStart: number;
        shearEnd: number;
        momentStart: number;
        momentEnd: number;
    }>;
}

interface DXFExportOptions {
    includeNodes?: boolean;
    includeMembers?: boolean;
    includeLoads?: boolean;
    includeSupports?: boolean;
    includeLabels?: boolean;
    includeDimensions?: boolean;
    includeResults?: boolean;
    deformationScale?: number;
    colorBySection?: boolean;
    colorByUtilization?: boolean;
    units?: 'mm' | 'm' | 'in' | 'ft';
    precision?: number;
}

// ============================================================================
// DXF COLOR CODES (AutoCAD ACI colors)
// ============================================================================

const DXF_COLORS = {
    WHITE: 7,
    RED: 1,
    YELLOW: 2,
    GREEN: 3,
    CYAN: 4,
    BLUE: 5,
    MAGENTA: 6,
    GRAY: 8,
    LIGHT_GRAY: 9,
    ORANGE: 30,
    BROWN: 52,
};

// ============================================================================
// LAYER DEFINITIONS
// ============================================================================

const LAYERS = {
    MEMBERS: { name: 'BEAMLAB_MEMBERS', color: DXF_COLORS.WHITE },
    NODES: { name: 'BEAMLAB_NODES', color: DXF_COLORS.CYAN },
    SUPPORTS: { name: 'BEAMLAB_SUPPORTS', color: DXF_COLORS.MAGENTA },
    LOADS: { name: 'BEAMLAB_LOADS', color: DXF_COLORS.RED },
    LABELS: { name: 'BEAMLAB_LABELS', color: DXF_COLORS.YELLOW },
    DIMENSIONS: { name: 'BEAMLAB_DIMENSIONS', color: DXF_COLORS.GREEN },
    RESULTS_DEFORMED: { name: 'BEAMLAB_DEFORMED', color: DXF_COLORS.ORANGE },
    RESULTS_BMD: { name: 'BEAMLAB_BMD', color: DXF_COLORS.BLUE },
    RESULTS_SFD: { name: 'BEAMLAB_SFD', color: DXF_COLORS.GREEN },
    GRID: { name: 'BEAMLAB_GRID', color: DXF_COLORS.GRAY },
};

// ============================================================================
// DXF BUILDER CLASS
// ============================================================================

class DXFBuilder {
    private content: string[] = [];
    private handleCounter = 100;

    constructor() {
        this.addHeader();
        this.addTables();
    }

    private getHandle(): string {
        return (this.handleCounter++).toString(16).toUpperCase();
    }

    private addHeader(): void {
        this.content.push('0', 'SECTION');
        this.content.push('2', 'HEADER');
        
        // AutoCAD version
        this.content.push('9', '$ACADVER');
        this.content.push('1', 'AC1015'); // AutoCAD 2000
        
        // Units
        this.content.push('9', '$INSUNITS');
        this.content.push('70', '4'); // Millimeters
        
        // Drawing extents
        this.content.push('9', '$EXTMIN');
        this.content.push('10', '0.0');
        this.content.push('20', '0.0');
        this.content.push('30', '0.0');
        
        this.content.push('9', '$EXTMAX');
        this.content.push('10', '1000.0');
        this.content.push('20', '1000.0');
        this.content.push('30', '1000.0');
        
        this.content.push('0', 'ENDSEC');
    }

    private addTables(): void {
        this.content.push('0', 'SECTION');
        this.content.push('2', 'TABLES');

        // Layer table
        this.content.push('0', 'TABLE');
        this.content.push('2', 'LAYER');
        this.content.push('70', Object.keys(LAYERS).length.toString());

        for (const [, layer] of Object.entries(LAYERS)) {
            this.content.push('0', 'LAYER');
            this.content.push('2', layer.name);
            this.content.push('70', '0'); // Layer flags
            this.content.push('62', layer.color.toString()); // Color
            this.content.push('6', 'CONTINUOUS'); // Linetype
        }

        this.content.push('0', 'ENDTAB');

        // Linetype table
        this.content.push('0', 'TABLE');
        this.content.push('2', 'LTYPE');
        this.content.push('70', '3');
        
        // Continuous linetype
        this.content.push('0', 'LTYPE');
        this.content.push('2', 'CONTINUOUS');
        this.content.push('70', '0');
        this.content.push('3', 'Solid line');
        this.content.push('72', '65');
        this.content.push('73', '0');
        this.content.push('40', '0.0');

        // Dashed linetype
        this.content.push('0', 'LTYPE');
        this.content.push('2', 'DASHED');
        this.content.push('70', '0');
        this.content.push('3', 'Dashed');
        this.content.push('72', '65');
        this.content.push('73', '2');
        this.content.push('40', '1.0');
        this.content.push('49', '0.5');
        this.content.push('49', '-0.5');

        // Center linetype
        this.content.push('0', 'LTYPE');
        this.content.push('2', 'CENTER');
        this.content.push('70', '0');
        this.content.push('3', 'Center');
        this.content.push('72', '65');
        this.content.push('73', '4');
        this.content.push('40', '2.0');
        this.content.push('49', '1.25');
        this.content.push('49', '-0.25');
        this.content.push('49', '0.25');
        this.content.push('49', '-0.25');

        this.content.push('0', 'ENDTAB');
        this.content.push('0', 'ENDSEC');
    }

    startEntities(): void {
        this.content.push('0', 'SECTION');
        this.content.push('2', 'ENTITIES');
    }

    endEntities(): void {
        this.content.push('0', 'ENDSEC');
    }

    addLine(
        x1: number, y1: number, z1: number,
        x2: number, y2: number, z2: number,
        layer: string = LAYERS.MEMBERS.name,
        color?: number
    ): void {
        this.content.push('0', 'LINE');
        this.content.push('5', this.getHandle());
        this.content.push('8', layer);
        if (color !== undefined) {
            this.content.push('62', color.toString());
        }
        this.content.push('10', x1.toFixed(6));
        this.content.push('20', y1.toFixed(6));
        this.content.push('30', z1.toFixed(6));
        this.content.push('11', x2.toFixed(6));
        this.content.push('21', y2.toFixed(6));
        this.content.push('31', z2.toFixed(6));
    }

    addCircle(
        x: number, y: number, z: number,
        radius: number,
        layer: string = LAYERS.NODES.name
    ): void {
        this.content.push('0', 'CIRCLE');
        this.content.push('5', this.getHandle());
        this.content.push('8', layer);
        this.content.push('10', x.toFixed(6));
        this.content.push('20', y.toFixed(6));
        this.content.push('30', z.toFixed(6));
        this.content.push('40', radius.toFixed(6));
    }

    addPoint(
        x: number, y: number, z: number,
        layer: string = LAYERS.NODES.name
    ): void {
        this.content.push('0', 'POINT');
        this.content.push('5', this.getHandle());
        this.content.push('8', layer);
        this.content.push('10', x.toFixed(6));
        this.content.push('20', y.toFixed(6));
        this.content.push('30', z.toFixed(6));
    }

    addText(
        x: number, y: number, z: number,
        text: string,
        height: number = 0.25,
        layer: string = LAYERS.LABELS.name,
        rotation: number = 0
    ): void {
        this.content.push('0', 'TEXT');
        this.content.push('5', this.getHandle());
        this.content.push('8', layer);
        this.content.push('10', x.toFixed(6));
        this.content.push('20', y.toFixed(6));
        this.content.push('30', z.toFixed(6));
        this.content.push('40', height.toFixed(6));
        this.content.push('1', text);
        this.content.push('50', rotation.toFixed(2));
    }

    addPolyline(
        points: Array<{ x: number; y: number; z: number }>,
        layer: string = LAYERS.MEMBERS.name,
        closed: boolean = false
    ): void {
        this.content.push('0', 'LWPOLYLINE');
        this.content.push('5', this.getHandle());
        this.content.push('8', layer);
        this.content.push('90', points.length.toString());
        this.content.push('70', closed ? '1' : '0');

        for (const point of points) {
            this.content.push('10', point.x.toFixed(6));
            this.content.push('20', point.y.toFixed(6));
        }
    }

    addArrow(
        x1: number, y1: number, z1: number,
        x2: number, y2: number, z2: number,
        layer: string = LAYERS.LOADS.name,
        arrowSize: number = 0.3
    ): void {
        // Main line
        this.addLine(x1, y1, z1, x2, y2, z2, layer);

        // Arrow head
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length > 0) {
            const ux = dx / length;
            const uy = dy / length;

            // Perpendicular
            const px = -uy * arrowSize * 0.5;
            const py = ux * arrowSize * 0.5;

            // Arrow head points
            const ax = x2 - ux * arrowSize;
            const ay = y2 - uy * arrowSize;

            this.addLine(x2, y2, z2, ax + px, ay + py, z2, layer);
            this.addLine(x2, y2, z2, ax - px, ay - py, z2, layer);
        }
    }

    addSupportSymbol(
        x: number, y: number, z: number,
        type: 'fixed' | 'pinned' | 'roller',
        size: number = 0.5,
        layer: string = LAYERS.SUPPORTS.name
    ): void {
        if (type === 'fixed') {
            // Ground hatching for fixed support
            for (let i = -3; i <= 3; i++) {
                const offset = i * size * 0.15;
                this.addLine(
                    x - size * 0.5 + offset, y - size * 0.4, z,
                    x - size * 0.5 + offset - size * 0.15, y - size * 0.6, z,
                    layer
                );
            }
            // Base line
            this.addLine(x - size * 0.5, y, z, x + size * 0.5, y, z, layer);
        } else if (type === 'pinned') {
            // Triangle for pinned support
            this.addLine(x, y, z, x - size * 0.4, y - size * 0.5, z, layer);
            this.addLine(x, y, z, x + size * 0.4, y - size * 0.5, z, layer);
            this.addLine(x - size * 0.4, y - size * 0.5, z, x + size * 0.4, y - size * 0.5, z, layer);
        } else if (type === 'roller') {
            // Triangle with circle for roller
            this.addLine(x, y, z, x - size * 0.4, y - size * 0.4, z, layer);
            this.addLine(x, y, z, x + size * 0.4, y - size * 0.4, z, layer);
            this.addLine(x - size * 0.4, y - size * 0.4, z, x + size * 0.4, y - size * 0.4, z, layer);
            this.addCircle(x, y - size * 0.55, z, size * 0.1, layer);
        }
    }

    addDimension(
        x1: number, y1: number, z1: number,
        x2: number, y2: number, z2: number,
        offset: number = 1.0,
        layer: string = LAYERS.DIMENSIONS.name
    ): void {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        // Perpendicular direction for offset
        const px = -dy / length * offset;
        const py = dx / length * offset;

        // Dimension line
        const dimX1 = x1 + px;
        const dimY1 = y1 + py;
        const dimX2 = x2 + px;
        const dimY2 = y2 + py;

        this.addLine(dimX1, dimY1, z1, dimX2, dimY2, z2, layer);
        
        // Extension lines
        this.addLine(x1, y1, z1, dimX1, dimY1, z1, layer);
        this.addLine(x2, y2, z2, dimX2, dimY2, z2, layer);

        // Dimension text
        const midX = (dimX1 + dimX2) / 2;
        const midY = (dimY1 + dimY2) / 2;
        const rotation = Math.atan2(dy, dx) * 180 / Math.PI;
        
        this.addText(midX, midY + 0.2, (z1 + z2) / 2, length.toFixed(2), 0.2, layer, rotation);
    }

    build(): string {
        this.content.push('0', 'EOF');
        return this.content.join('\n');
    }
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Generate professional DXF file from structural model
 */
export const generateDXF = (
    nodes: Map<string, Node>,
    members: Map<string, Member>,
    options: DXFExportOptions = {}
): string => {
    const {
        includeNodes = true,
        includeMembers = true,
        includeLoads = true,
        includeSupports = true,
        includeLabels = true,
        includeDimensions = false,
    } = options;

    const dxf = new DXFBuilder();
    dxf.startEntities();

    // Calculate model bounds for text sizing
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x);
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y);
    });
    
    const modelSize = Math.max(maxX - minX, maxY - minY, 1);
    const textHeight = modelSize * 0.02;
    const nodeRadius = modelSize * 0.01;
    const supportSize = modelSize * 0.05;

    // Draw members
    if (includeMembers) {
        members.forEach((member) => {
            const startNode = nodes.get(member.startNodeId);
            const endNode = nodes.get(member.endNodeId);

            if (startNode && endNode) {
                dxf.addLine(
                    startNode.x, startNode.y, startNode.z,
                    endNode.x, endNode.y, endNode.z,
                    LAYERS.MEMBERS.name
                );

                // Add member label at midpoint
                if (includeLabels) {
                    const midX = (startNode.x + endNode.x) / 2;
                    const midY = (startNode.y + endNode.y) / 2;
                    const midZ = (startNode.z + endNode.z) / 2;
                    dxf.addText(midX, midY + textHeight, midZ, `M${member.id}`, textHeight, LAYERS.LABELS.name);
                }

                // Add dimensions
                if (includeDimensions) {
                    dxf.addDimension(
                        startNode.x, startNode.y, startNode.z,
                        endNode.x, endNode.y, endNode.z,
                        modelSize * 0.1
                    );
                }
            }
        });
    }

    // Draw nodes
    if (includeNodes) {
        nodes.forEach((node, nodeId) => {
            dxf.addCircle(node.x, node.y, node.z, nodeRadius, LAYERS.NODES.name);

            if (includeLabels) {
                dxf.addText(
                    node.x + nodeRadius * 2,
                    node.y + nodeRadius * 2,
                    node.z,
                    `N${nodeId}`,
                    textHeight * 0.8,
                    LAYERS.LABELS.name
                );
            }

            // Draw supports
            if (includeSupports && node.restraints) {
                const isFixed = node.restraints.fx && node.restraints.fy && node.restraints.fz;
                const isPinned = node.restraints.fx && node.restraints.fy && !node.restraints.mz;
                const isRoller = (node.restraints.fx || node.restraints.fy) && 
                                 !(node.restraints.fx && node.restraints.fy);

                if (isFixed) {
                    dxf.addSupportSymbol(node.x, node.y, node.z, 'fixed', supportSize);
                } else if (isPinned) {
                    dxf.addSupportSymbol(node.x, node.y, node.z, 'pinned', supportSize);
                } else if (isRoller) {
                    dxf.addSupportSymbol(node.x, node.y, node.z, 'roller', supportSize);
                }
            }
        });
    }

    dxf.endEntities();
    return dxf.build();
};

/**
 * Generate DXF with analysis results (deformed shape, diagrams)
 */
export const generateResultsDXF = (
    nodes: Map<string, Node>,
    members: Map<string, Member>,
    results: AnalysisResult,
    options: DXFExportOptions = {}
): string => {
    const {
        deformationScale = 100,
        includeLabels = true,
    } = options;

    const dxf = new DXFBuilder();
    dxf.startEntities();

    // Calculate model bounds
    let modelSize = 0;
    nodes.forEach(n1 => {
        nodes.forEach(n2 => {
            const dist = Math.sqrt(
                Math.pow(n2.x - n1.x, 2) +
                Math.pow(n2.y - n1.y, 2)
            );
            modelSize = Math.max(modelSize, dist);
        });
    });
    modelSize = Math.max(modelSize, 1);

    // Draw original members (dashed)
    members.forEach((member) => {
        const startNode = nodes.get(member.startNodeId);
        const endNode = nodes.get(member.endNodeId);

        if (startNode && endNode) {
            dxf.addLine(
                startNode.x, startNode.y, startNode.z,
                endNode.x, endNode.y, endNode.z,
                LAYERS.MEMBERS.name,
                DXF_COLORS.GRAY
            );
        }
    });

    // Draw deformed shape
    if (results.displacements) {
        members.forEach((member) => {
            const startNode = nodes.get(member.startNodeId);
            const endNode = nodes.get(member.endNodeId);
            const startDisp = results.displacements?.get(member.startNodeId);
            const endDisp = results.displacements?.get(member.endNodeId);

            if (startNode && endNode && startDisp && endDisp) {
                dxf.addLine(
                    startNode.x + startDisp.dx * deformationScale,
                    startNode.y + startDisp.dy * deformationScale,
                    startNode.z + startDisp.dz * deformationScale,
                    endNode.x + endDisp.dx * deformationScale,
                    endNode.y + endDisp.dy * deformationScale,
                    endNode.z + endDisp.dz * deformationScale,
                    LAYERS.RESULTS_DEFORMED.name
                );
            }
        });
    }

    // Draw bending moment diagram
    if (results.memberForces) {
        const momentScale = modelSize * 0.1 / Math.max(
            ...Array.from(results.memberForces.values()).map(f => 
                Math.max(Math.abs(f.momentStart), Math.abs(f.momentEnd))
            ),
            1
        );

        results.memberForces.forEach((forces, memberId) => {
            const member = members.get(memberId);
            if (!member) return;

            const startNode = nodes.get(member.startNodeId);
            const endNode = nodes.get(member.endNodeId);
            if (!startNode || !endNode) return;

            // Member direction
            const dx = endNode.x - startNode.x;
            const dy = endNode.y - startNode.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if (length === 0) return;

            // Perpendicular direction
            const px = -dy / length;
            const py = dx / length;

            // BMD points
            const m1 = forces.momentStart * momentScale;
            const m2 = forces.momentEnd * momentScale;

            dxf.addLine(
                startNode.x + px * m1, startNode.y + py * m1, startNode.z,
                endNode.x + px * m2, endNode.y + py * m2, endNode.z,
                LAYERS.RESULTS_BMD.name
            );

            // Close diagram
            dxf.addLine(
                startNode.x, startNode.y, startNode.z,
                startNode.x + px * m1, startNode.y + py * m1, startNode.z,
                LAYERS.RESULTS_BMD.name
            );
            dxf.addLine(
                endNode.x, endNode.y, endNode.z,
                endNode.x + px * m2, endNode.y + py * m2, endNode.z,
                LAYERS.RESULTS_BMD.name
            );

            // Add values
            if (includeLabels) {
                dxf.addText(
                    startNode.x + px * m1 * 1.2,
                    startNode.y + py * m1 * 1.2,
                    startNode.z,
                    forces.momentStart.toFixed(1),
                    modelSize * 0.015,
                    LAYERS.RESULTS_BMD.name
                );
            }
        });
    }

    dxf.endEntities();
    return dxf.build();
};

/**
 * Download DXF file
 */
export const downloadDXF = (dxfContent: string, filename: string): void => {
    const blob = new Blob([dxfContent], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.dxf') ? filename : `${filename}.dxf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Generate DXF with loads visualization
 */
export const generateLoadsDXF = (
    nodes: Map<string, Node>,
    members: Map<string, Member>,
    loads: Load[]
): string => {
    const dxf = new DXFBuilder();
    dxf.startEntities();

    // Calculate load scale
    const maxLoad = Math.max(
        ...loads.map(l => Math.abs(l.fy ?? 0)),
        ...loads.map(l => Math.abs(l.fx ?? 0)),
        1
    );
    
    let modelSize = 0;
    nodes.forEach(n1 => {
        nodes.forEach(n2 => {
            const dist = Math.sqrt(Math.pow(n2.x - n1.x, 2) + Math.pow(n2.y - n1.y, 2));
            modelSize = Math.max(modelSize, dist);
        });
    });
    modelSize = Math.max(modelSize, 1);
    
    const loadScale = modelSize * 0.2 / maxLoad;

    // Draw members
    members.forEach((member) => {
        const startNode = nodes.get(member.startNodeId);
        const endNode = nodes.get(member.endNodeId);
        if (startNode && endNode) {
            dxf.addLine(
                startNode.x, startNode.y, startNode.z,
                endNode.x, endNode.y, endNode.z,
                LAYERS.MEMBERS.name
            );
        }
    });

    // Draw nodes
    nodes.forEach((node) => {
        dxf.addCircle(node.x, node.y, node.z, modelSize * 0.01, LAYERS.NODES.name);
    });

    // Draw loads
    loads.forEach(load => {
        if (load.nodeId && load.type === 'point') {
            const node = nodes.get(load.nodeId);
            if (!node) return;

            if (load.fy) {
                const arrowLength = Math.abs(load.fy) * loadScale;
                const direction = load.fy > 0 ? 1 : -1;
                dxf.addArrow(
                    node.x, node.y + arrowLength * direction, node.z,
                    node.x, node.y, node.z,
                    LAYERS.LOADS.name,
                    modelSize * 0.03
                );
                dxf.addText(
                    node.x + modelSize * 0.02,
                    node.y + arrowLength * direction * 0.5,
                    node.z,
                    `${Math.abs(load.fy).toFixed(1)} kN`,
                    modelSize * 0.015,
                    LAYERS.LOADS.name
                );
            }

            if (load.fx) {
                const arrowLength = Math.abs(load.fx) * loadScale;
                const direction = load.fx > 0 ? 1 : -1;
                dxf.addArrow(
                    node.x + arrowLength * direction, node.y, node.z,
                    node.x, node.y, node.z,
                    LAYERS.LOADS.name,
                    modelSize * 0.03
                );
            }
        }
    });

    dxf.endEntities();
    return dxf.build();
};

// Export layer definitions for external use
export { LAYERS, DXF_COLORS };

