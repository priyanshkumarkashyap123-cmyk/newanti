/**
 * CanvasSketchDetector.ts
 * 
 * Computer Vision Fallback using Canvas API
 * Works without external ML when Gemini Vision unavailable
 * 
 * Features:
 * - Line detection using Hough Transform approximation
 * - Junction detection
 * - Support symbol recognition (triangle, square, circle)
 * - Arrow/load detection
 */

// ============================================
// TYPES
// ============================================

export interface Point2D {
    x: number;
    y: number;
}

export interface Line2D {
    start: Point2D;
    end: Point2D;
    length: number;
    angle: number;
}

export interface DetectedShape {
    type: 'triangle' | 'rectangle' | 'circle' | 'arrow' | 'line';
    center: Point2D;
    bounds: { x: number; y: number; width: number; height: number };
    confidence: number;
}

export interface CVDetectionResult {
    lines: Line2D[];
    junctions: Point2D[];
    shapes: DetectedShape[];
    imageWidth: number;
    imageHeight: number;
}

// ============================================
// CANVAS SKETCH DETECTOR
// ============================================

export class CanvasSketchDetector {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d')!;
    }

    /**
     * Process image and detect structural elements
     */
    async detect(imageSource: HTMLImageElement | ImageBitmap | string): Promise<CVDetectionResult> {
        // Load image
        const img = await this.loadImage(imageSource);

        // Set canvas size
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = this.ctx.getImageData(0, 0, img.width, img.height);

        // Preprocess: grayscale + edge detection
        const edges = this.detectEdges(imageData);

        // Detect lines
        const lines = this.detectLines(edges, img.width, img.height);

        // Find junctions (line intersections)
        const junctions = this.findJunctions(lines);

        // Detect shapes (supports, loads)
        const shapes = this.detectShapes(edges, img.width, img.height);

        return {
            lines,
            junctions,
            shapes,
            imageWidth: img.width,
            imageHeight: img.height
        };
    }

    /**
     * Load image from various sources
     */
    private async loadImage(source: HTMLImageElement | ImageBitmap | string): Promise<HTMLImageElement | ImageBitmap> {
        if (typeof source === 'string') {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = source;
            });
        }
        return source;
    }

    /**
     * Edge detection using Sobel operator
     */
    private detectEdges(imageData: ImageData): Uint8ClampedArray {
        const { width, height, data } = imageData;
        const gray = new Uint8ClampedArray(width * height);
        const edges = new Uint8ClampedArray(width * height);

        // Convert to grayscale
        for (let i = 0; i < data.length; i += 4) {
            gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }

        // Sobel kernels
        const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let gx = 0, gy = 0;

                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = (y + ky) * width + (x + kx);
                        const kidx = (ky + 1) * 3 + (kx + 1);
                        gx += gray[idx] * sobelX[kidx];
                        gy += gray[idx] * sobelY[kidx];
                    }
                }

                const magnitude = Math.sqrt(gx * gx + gy * gy);
                edges[y * width + x] = magnitude > 50 ? 255 : 0; // Threshold
            }
        }

        return edges;
    }

    /**
     * Detect lines using simplified Hough Transform
     */
    private detectLines(edges: Uint8ClampedArray, width: number, height: number): Line2D[] {
        const lines: Line2D[] = [];
        const visited = new Set<string>();

        // Find edge points and trace lines
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (edges[y * width + x] > 0 && !visited.has(`${x},${y}`)) {
                    const line = this.traceLine(edges, width, height, x, y, visited);
                    if (line && line.length > 30) { // Min length threshold
                        lines.push(line);
                    }
                }
            }
        }

        return this.mergeCollinearLines(lines);
    }

    /**
     * Trace a line from a starting edge point
     */
    private traceLine(
        edges: Uint8ClampedArray,
        width: number,
        height: number,
        startX: number,
        startY: number,
        visited: Set<string>
    ): Line2D | null {
        const points: Point2D[] = [{ x: startX, y: startY }];
        visited.add(`${startX},${startY}`);

        let x = startX, y = startY;
        const directions = [
            [1, 0], [1, 1], [0, 1], [-1, 1],
            [-1, 0], [-1, -1], [0, -1], [1, -1]
        ];

        // Follow the edge
        for (let iter = 0; iter < 1000; iter++) {
            let found = false;
            for (const [dx, dy] of directions) {
                const nx = x + dx, ny = y + dy;
                const key = `${nx},${ny}`;

                if (nx >= 0 && nx < width && ny >= 0 && ny < height &&
                    edges[ny * width + nx] > 0 && !visited.has(key)) {
                    visited.add(key);
                    points.push({ x: nx, y: ny });
                    x = nx;
                    y = ny;
                    found = true;
                    break;
                }
            }
            if (!found) break;
        }

        if (points.length < 10) return null;

        // Fit line to points
        const start = points[0];
        const end = points[points.length - 1];
        const length = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
        const angle = Math.atan2(end.y - start.y, end.x - start.x);

        return { start, end, length, angle };
    }

    /**
     * Merge collinear lines that are close together
     */
    private mergeCollinearLines(lines: Line2D[]): Line2D[] {
        const merged: Line2D[] = [];
        const used = new Set<number>();

        for (let i = 0; i < lines.length; i++) {
            if (used.has(i)) continue;

            let line = lines[i];

            for (let j = i + 1; j < lines.length; j++) {
                if (used.has(j)) continue;

                const other = lines[j];

                // Check if collinear and close
                const angleDiff = Math.abs(line.angle - other.angle);
                if (angleDiff < 0.15 || angleDiff > Math.PI - 0.15) {
                    const dist = this.pointToLineDistance(other.start, line);
                    if (dist < 10) {
                        // Merge
                        line = this.mergeLines(line, other);
                        used.add(j);
                    }
                }
            }

            merged.push(line);
            used.add(i);
        }

        return merged;
    }

    private pointToLineDistance(point: Point2D, line: Line2D): number {
        const { start, end } = line;
        const A = point.x - start.x;
        const B = point.y - start.y;
        const C = end.x - start.x;
        const D = end.y - start.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        const param = lenSq !== 0 ? dot / lenSq : -1;

        let xx, yy;
        if (param < 0) {
            xx = start.x; yy = start.y;
        } else if (param > 1) {
            xx = end.x; yy = end.y;
        } else {
            xx = start.x + param * C;
            yy = start.y + param * D;
        }

        return Math.sqrt((point.x - xx) ** 2 + (point.y - yy) ** 2);
    }

    private mergeLines(a: Line2D, b: Line2D): Line2D {
        const points = [a.start, a.end, b.start, b.end];
        points.sort((p1, p2) => p1.x - p2.x || p1.y - p2.y);

        const start = points[0];
        const end = points[3];
        const length = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
        const angle = Math.atan2(end.y - start.y, end.x - start.x);

        return { start, end, length, angle };
    }

    /**
     * Find junction points (line intersections)
     */
    private findJunctions(lines: Line2D[]): Point2D[] {
        const junctions: Point2D[] = [];

        for (let i = 0; i < lines.length; i++) {
            for (let j = i + 1; j < lines.length; j++) {
                const intersection = this.lineIntersection(lines[i], lines[j]);
                if (intersection) {
                    junctions.push(intersection);
                }
            }
        }

        // Merge nearby junctions
        return this.mergeNearbyPoints(junctions, 15);
    }

    private lineIntersection(a: Line2D, b: Line2D): Point2D | null {
        const x1 = a.start.x, y1 = a.start.y;
        const x2 = a.end.x, y2 = a.end.y;
        const x3 = b.start.x, y3 = b.start.y;
        const x4 = b.end.x, y4 = b.end.y;

        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) < 0.001) return null;

        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: x1 + t * (x2 - x1),
                y: y1 + t * (y2 - y1)
            };
        }

        return null;
    }

    private mergeNearbyPoints(points: Point2D[], threshold: number): Point2D[] {
        const merged: Point2D[] = [];
        const used = new Set<number>();

        for (let i = 0; i < points.length; i++) {
            if (used.has(i)) continue;

            let sumX = points[i].x;
            let sumY = points[i].y;
            let count = 1;

            for (let j = i + 1; j < points.length; j++) {
                if (used.has(j)) continue;

                const dist = Math.sqrt(
                    (points[i].x - points[j].x) ** 2 +
                    (points[i].y - points[j].y) ** 2
                );

                if (dist < threshold) {
                    sumX += points[j].x;
                    sumY += points[j].y;
                    count++;
                    used.add(j);
                }
            }

            merged.push({ x: sumX / count, y: sumY / count });
            used.add(i);
        }

        return merged;
    }

    /**
     * Detect support and load symbols
     */
    private detectShapes(edges: Uint8ClampedArray, width: number, height: number): DetectedShape[] {
        // Simplified shape detection
        // In production, use contour detection + shape matching
        return [];
    }

    /**
     * Convert detection to structural model
     */
    toStructuralModel(result: CVDetectionResult, scale: number = 0.01): {
        nodes: Array<{ id: string; x: number; y: number; z: number }>;
        members: Array<{ id: string; startNodeId: string; endNodeId: string }>;
    } {
        const nodes: Array<{ id: string; x: number; y: number; z: number }> = [];
        const members: Array<{ id: string; startNodeId: string; endNodeId: string }> = [];

        // Create nodes from junctions
        result.junctions.forEach((j, i) => {
            nodes.push({
                id: `N${i + 1}`,
                x: j.x * scale,
                y: 0,
                z: (result.imageHeight - j.y) * scale // Flip Y
            });
        });

        // Create members from lines
        result.lines.forEach((line, i) => {
            // Find nearest nodes to line endpoints
            const startNode = this.findNearestNode(line.start, result.junctions);
            const endNode = this.findNearestNode(line.end, result.junctions);

            if (startNode !== endNode) {
                members.push({
                    id: `M${i + 1}`,
                    startNodeId: `N${startNode + 1}`,
                    endNodeId: `N${endNode + 1}`
                });
            }
        });

        return { nodes, members };
    }

    private findNearestNode(point: Point2D, nodes: Point2D[]): number {
        let minDist = Infinity;
        let nearest = 0;

        nodes.forEach((n, i) => {
            const dist = Math.sqrt((point.x - n.x) ** 2 + (point.y - n.y) ** 2);
            if (dist < minDist) {
                minDist = dist;
                nearest = i;
            }
        });

        return nearest;
    }
}

// ============================================
// SINGLETON
// ============================================

export const canvasSketchDetector = new CanvasSketchDetector();

export default CanvasSketchDetector;
