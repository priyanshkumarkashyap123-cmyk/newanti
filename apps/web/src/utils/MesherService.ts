/**
 * MesherService - Surface Meshing for Plate/Shell Elements
 * Generates quad mesh from boundary polygon
 */

// ============================================
// TYPES & INTERFACES
// ============================================

export interface Point2D {
    x: number;
    y: number;
}

export interface Point3D {
    x: number;
    y: number;
    z: number;
}

export interface MeshNode {
    id: string;
    x: number;
    y: number;
    z: number;
    isBoundary: boolean;
}

export interface PlateElement {
    id: string;
    nodes: [string, string, string, string];  // 4 node IDs (counterclockwise)
    thickness: number;
    materialId: string;
}

export interface MeshResult {
    nodes: MeshNode[];
    elements: PlateElement[];
    boundaryNodes: string[];  // Node IDs on boundary
    stats: {
        nodeCount: number;
        elementCount: number;
        avgElementSize: number;
        aspectRatioMax: number;
    };
}

export interface MeshOptions {
    meshSize: number;
    thickness?: number;
    materialId?: string;
    zOffset?: number;
    minElementSize?: number;
    refineAtBoundary?: boolean;
}

// ============================================
// MESHER SERVICE
// ============================================

export class MesherService {
    /**
     * Main function: Mesh a surface defined by boundary vertices
     * @param surfaceVertices - Array of boundary points (polygon, counterclockwise)
     * @param options - Meshing options
     */
    static meshSurface(
        surfaceVertices: Point2D[] | Point3D[],
        options: MeshOptions
    ): MeshResult {
        const {
            meshSize,
            thickness = 0.1,
            materialId = 'default',
            zOffset = 0,
            refineAtBoundary = false
        } = options;

        // Convert to 2D if 3D points provided
        const vertices2D: Point2D[] = surfaceVertices.map(v => ({ x: v.x, y: v.y }));
        const zCoord = 'z' in surfaceVertices[0] ? (surfaceVertices[0] as Point3D).z : zOffset;

        // Calculate bounding box
        const bbox = this.getBoundingBox(vertices2D);

        // Generate grid of points within bounding box
        const gridPoints = this.generateGrid(bbox, meshSize, refineAtBoundary);

        // Filter points inside the polygon
        const interiorPoints = gridPoints.filter(p => this.isPointInPolygon(p, vertices2D));

        // Add boundary vertices
        const boundaryPoints = this.sampleBoundary(vertices2D, meshSize);

        // Combine all points
        const allPoints = [...interiorPoints, ...boundaryPoints];

        // Create mesh nodes
        const nodes: MeshNode[] = allPoints.map((p, i) => ({
            id: `mesh-node-${i}`,
            x: p.x,
            y: p.y,
            z: zCoord,
            isBoundary: i >= interiorPoints.length
        }));

        // Generate quad elements using structured grid approach
        const elements = this.generateQuadElements(
            nodes,
            bbox,
            meshSize,
            thickness,
            materialId,
            vertices2D
        );

        // Get boundary node IDs
        const boundaryNodes = nodes.filter(n => n.isBoundary).map(n => n.id);

        // Calculate statistics
        const stats = this.calculateMeshStats(nodes, elements, meshSize);

        return {
            nodes,
            elements,
            boundaryNodes,
            stats
        };
    }

    /**
     * Mesh a rectangular surface (simpler, more reliable)
     */
    static meshRectangle(
        width: number,
        height: number,
        options: MeshOptions,
        origin: Point3D = { x: 0, y: 0, z: 0 }
    ): MeshResult {
        const { meshSize, thickness = 0.1, materialId = 'default' } = options;

        const nx = Math.max(2, Math.ceil(width / meshSize) + 1);
        const ny = Math.max(2, Math.ceil(height / meshSize) + 1);
        const dx = width / (nx - 1);
        const dy = height / (ny - 1);

        const nodes: MeshNode[] = [];
        const nodeGrid: string[][] = [];

        // Generate grid nodes
        for (let j = 0; j < ny; j++) {
            nodeGrid[j] = [];
            for (let i = 0; i < nx; i++) {
                const id = `mesh-node-${j * nx + i}`;
                const isBoundary = i === 0 || i === nx - 1 || j === 0 || j === ny - 1;

                nodes.push({
                    id,
                    x: origin.x + i * dx,
                    y: origin.y + j * dy,
                    z: origin.z,
                    isBoundary
                });

                nodeGrid[j]![i] = id;
            }
        }

        // Generate quad elements
        const elements: PlateElement[] = [];
        let elementCount = 0;

        for (let j = 0; j < ny - 1; j++) {
            for (let i = 0; i < nx - 1; i++) {
                elements.push({
                    id: `plate-${elementCount++}`,
                    nodes: [
                        nodeGrid[j]![i]!,
                        nodeGrid[j]![i + 1]!,
                        nodeGrid[j + 1]![i + 1]!,
                        nodeGrid[j + 1]![i]!
                    ],
                    thickness,
                    materialId
                });
            }
        }

        const boundaryNodes = nodes.filter(n => n.isBoundary).map(n => n.id);

        return {
            nodes,
            elements,
            boundaryNodes,
            stats: {
                nodeCount: nodes.length,
                elementCount: elements.length,
                avgElementSize: (dx + dy) / 2,
                aspectRatioMax: Math.max(dx, dy) / Math.min(dx, dy)
            }
        };
    }

    /**
     * Mesh a triangular surface
     */
    static meshTriangle(
        p1: Point3D,
        p2: Point3D,
        p3: Point3D,
        options: MeshOptions
    ): MeshResult {
        const { meshSize, thickness = 0.1, materialId = 'default' } = options;

        // Calculate edge lengths
        const len12 = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
        const len23 = Math.sqrt((p3.x - p2.x) ** 2 + (p3.y - p2.y) ** 2);
        const len31 = Math.sqrt((p1.x - p3.x) ** 2 + (p1.y - p3.y) ** 2);
        const maxLen = Math.max(len12, len23, len31);

        const nDivisions = Math.max(2, Math.ceil(maxLen / meshSize));

        const nodes: MeshNode[] = [];
        const elements: PlateElement[] = [];
        let nodeId = 0;
        let elemId = 0;

        // Generate nodes using barycentric subdivision
        const nodeMap: Map<string, string> = new Map();

        for (let i = 0; i <= nDivisions; i++) {
            for (let j = 0; j <= nDivisions - i; j++) {
                const k = nDivisions - i - j;
                const key = `${i}-${j}-${k}`;

                // Barycentric coordinates
                const u = i / nDivisions;
                const v = j / nDivisions;
                const w = k / nDivisions;

                const x = u * p1.x + v * p2.x + w * p3.x;
                const y = u * p1.y + v * p2.y + w * p3.y;
                const z = u * p1.z + v * p2.z + w * p3.z;

                const id = `mesh-node-${nodeId++}`;
                const isBoundary = i === 0 || j === 0 || k === 0;

                nodes.push({ id, x, y, z, isBoundary });
                nodeMap.set(key, id);
            }
        }

        // Generate elements (quads where possible, triangles at edges)
        for (let i = 0; i < nDivisions; i++) {
            for (let j = 0; j < nDivisions - i; j++) {
                const k = nDivisions - i - j - 1;

                const n1 = nodeMap.get(`${i}-${j}-${k + 1}`)!;
                const n2 = nodeMap.get(`${i}-${j + 1}-${k}`)!;
                const n3 = nodeMap.get(`${i + 1}-${j}-${k}`)!;

                // Create triangle as degenerate quad
                elements.push({
                    id: `plate-${elemId++}`,
                    nodes: [n1, n2, n3, n3],  // Degenerate quad
                    thickness,
                    materialId
                });

                // Add second triangle if not at edge
                if (j < nDivisions - i - 1) {
                    const n4 = nodeMap.get(`${i + 1}-${j + 1}-${k - 1}`)!;
                    elements.push({
                        id: `plate-${elemId++}`,
                        nodes: [n2, n4, n3, n3],
                        thickness,
                        materialId
                    });
                }
            }
        }

        return {
            nodes,
            elements,
            boundaryNodes: nodes.filter(n => n.isBoundary).map(n => n.id),
            stats: {
                nodeCount: nodes.length,
                elementCount: elements.length,
                avgElementSize: maxLen / nDivisions,
                aspectRatioMax: 1.0
            }
        };
    }

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    private static getBoundingBox(vertices: Point2D[]): {
        minX: number; maxX: number; minY: number; maxY: number
    } {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const v of vertices) {
            minX = Math.min(minX, v.x);
            maxX = Math.max(maxX, v.x);
            minY = Math.min(minY, v.y);
            maxY = Math.max(maxY, v.y);
        }

        return { minX, maxX, minY, maxY };
    }

    private static generateGrid(
        bbox: { minX: number; maxX: number; minY: number; maxY: number },
        meshSize: number,
        refine: boolean
    ): Point2D[] {
        const points: Point2D[] = [];
        const size = refine ? meshSize * 0.5 : meshSize;

        const nx = Math.ceil((bbox.maxX - bbox.minX) / size);
        const ny = Math.ceil((bbox.maxY - bbox.minY) / size);

        for (let j = 0; j <= ny; j++) {
            for (let i = 0; i <= nx; i++) {
                points.push({
                    x: bbox.minX + i * size,
                    y: bbox.minY + j * size
                });
            }
        }

        return points;
    }

    private static sampleBoundary(vertices: Point2D[], meshSize: number): Point2D[] {
        const points: Point2D[] = [];

        for (let i = 0; i < vertices.length; i++) {
            const p1 = vertices[i]!;
            const p2 = vertices[(i + 1) % vertices.length]!;

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nSegments = Math.max(1, Math.ceil(len / meshSize));

            for (let j = 0; j < nSegments; j++) {
                const t = j / nSegments;
                points.push({
                    x: p1.x + t * dx,
                    y: p1.y + t * dy
                });
            }
        }

        return points;
    }

    private static isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
        let inside = false;
        const n = polygon.length;

        for (let i = 0, j = n - 1; i < n; j = i++) {
            const pi = polygon[i]!;
            const pj = polygon[j]!;

            if (((pi.y > point.y) !== (pj.y > point.y)) &&
                (point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x)) {
                inside = !inside;
            }
        }

        return inside;
    }

    private static generateQuadElements(
        nodes: MeshNode[],
        bbox: { minX: number; maxX: number; minY: number; maxY: number },
        meshSize: number,
        thickness: number,
        materialId: string,
        boundary: Point2D[]
    ): PlateElement[] {
        const elements: PlateElement[] = [];

        // Create spatial index for quick node lookup
        const nodeIndex = new Map<string, MeshNode>();
        for (const node of nodes) {
            const key = `${Math.round(node.x / (meshSize * 0.1))}-${Math.round(node.y / (meshSize * 0.1))}`;
            nodeIndex.set(key, node);
        }

        // Find nearest node
        const findNearestNode = (x: number, y: number): MeshNode | null => {
            let nearest: MeshNode | null = null;
            let minDist = Infinity;

            for (const node of nodes) {
                const dist = (node.x - x) ** 2 + (node.y - y) ** 2;
                if (dist < minDist) {
                    minDist = dist;
                    nearest = node;
                }
            }

            return minDist < meshSize * meshSize * 2 ? nearest : null;
        };

        // Generate elements based on grid
        const nx = Math.ceil((bbox.maxX - bbox.minX) / meshSize);
        const ny = Math.ceil((bbox.maxY - bbox.minY) / meshSize);

        let elemId = 0;

        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const x0 = bbox.minX + i * meshSize;
                const y0 = bbox.minY + j * meshSize;

                // Find 4 corner nodes
                const n1 = findNearestNode(x0, y0);
                const n2 = findNearestNode(x0 + meshSize, y0);
                const n3 = findNearestNode(x0 + meshSize, y0 + meshSize);
                const n4 = findNearestNode(x0, y0 + meshSize);

                // Only create element if all 4 nodes exist and are inside
                if (n1 && n2 && n3 && n4) {
                    const center = {
                        x: (x0 + meshSize / 2),
                        y: (y0 + meshSize / 2)
                    };

                    if (this.isPointInPolygon(center, boundary)) {
                        elements.push({
                            id: `plate-${elemId++}`,
                            nodes: [n1.id, n2.id, n3.id, n4.id],
                            thickness,
                            materialId
                        });
                    }
                }
            }
        }

        return elements;
    }

    private static calculateMeshStats(
        nodes: MeshNode[],
        elements: PlateElement[],
        targetSize: number
    ): MeshResult['stats'] {
        let totalSize = 0;
        let maxAspectRatio = 1;

        for (const elem of elements) {
            // Calculate element size (approximate)
            const nodeCoords = elem.nodes.map(id => nodes.find(n => n.id === id)!);

            if (nodeCoords.length === 4 && nodeCoords[0] && nodeCoords[1] && nodeCoords[2] && nodeCoords[3]) {
                const dx = Math.abs(nodeCoords[1].x - nodeCoords[0].x);
                const dy = Math.abs(nodeCoords[3].y - nodeCoords[0].y);
                totalSize += (dx + dy) / 2;

                const aspect = dx > 0 && dy > 0 ? Math.max(dx, dy) / Math.min(dx, dy) : 1;
                maxAspectRatio = Math.max(maxAspectRatio, aspect);
            }
        }

        return {
            nodeCount: nodes.length,
            elementCount: elements.length,
            avgElementSize: elements.length > 0 ? totalSize / elements.length : targetSize,
            aspectRatioMax: maxAspectRatio
        };
    }

    /**
     * Get mesh quality summary
     */
    static getQualitySummary(result: MeshResult): string {
        const { stats } = result;
        const quality = stats.aspectRatioMax < 2 ? '✓ Good' :
            stats.aspectRatioMax < 5 ? '⚠ Acceptable' : '✗ Poor';

        return [
            `=== Mesh Quality Report ===`,
            `Nodes: ${stats.nodeCount}`,
            `Elements: ${stats.elementCount}`,
            `Avg Element Size: ${stats.avgElementSize.toFixed(3)}`,
            `Max Aspect Ratio: ${stats.aspectRatioMax.toFixed(2)}`,
            `Quality: ${quality}`
        ].join('\n');
    }
}

export default MesherService;
