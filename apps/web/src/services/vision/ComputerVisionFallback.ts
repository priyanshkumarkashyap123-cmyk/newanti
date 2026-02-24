/**
 * ComputerVisionFallback.ts - Canvas-based Sketch Recognition
 * 
 * Provides fallback computer vision when Gemini Vision API is unavailable:
 * - Edge detection (Sobel)
 * - Line detection (Hough transform simplified)
 * - Shape recognition
 * - Grid detection
 */

// ============================================
// TYPES
// ============================================

export interface DetectedLine {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    length: number;
    angle: number;  // degrees
}

export interface DetectedShape {
    type: 'rectangle' | 'circle' | 'triangle' | 'line' | 'unknown';
    bounds: { x: number; y: number; width: number; height: number };
    points?: { x: number; y: number }[];
    confidence: number;
}

export interface SketchAnalysis {
    lines: DetectedLine[];
    shapes: DetectedShape[];
    gridSize: number | null;
    dimensions: { width: number; height: number };
    structuralInterpretation?: {
        beams: DetectedLine[];
        columns: DetectedLine[];
        supports: { x: number; y: number; type: string }[];
    };
}

// ============================================
// COMPUTER VISION SERVICE
// ============================================

class ComputerVisionFallbackClass {
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;

    /**
     * Analyze image using canvas-based CV
     */
    async analyzeImage(imageSource: string | HTMLImageElement | File): Promise<SketchAnalysis> {
        // Load image
        const img = await this.loadImage(imageSource);

        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx = this.canvas.getContext('2d')!;
        this.ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = this.ctx.getImageData(0, 0, img.width, img.height);

        // Process
        const grayscale = this.toGrayscale(imageData);
        const edges = this.detectEdges(grayscale, img.width, img.height);
        const lines = this.detectLines(edges, img.width, img.height);
        const shapes = this.detectShapes(lines, img.width, img.height);
        const gridSize = this.detectGrid(lines);

        // Structural interpretation
        const structuralInterpretation = this.interpretAsStructure(lines, shapes, img.width, img.height);

        return {
            lines,
            shapes,
            gridSize,
            dimensions: { width: img.width, height: img.height },
            structuralInterpretation
        };
    }

    /**
     * Quick check if image contains structural sketch
     */
    async isStructuralSketch(imageSource: string | File): Promise<boolean> {
        try {
            const analysis = await this.analyzeImage(imageSource);
            // Heuristics for structural sketch
            const hasLines = analysis.lines.length >= 3;
            const hasRectangles = analysis.shapes.some(s => s.type === 'rectangle');
            const hasVerticals = analysis.lines.some(l => Math.abs(l.angle - 90) < 10 || Math.abs(l.angle - 270) < 10);
            const hasHorizontals = analysis.lines.some(l => Math.abs(l.angle) < 10 || Math.abs(l.angle - 180) < 10);

            return hasLines && (hasRectangles || (hasVerticals && hasHorizontals));
        } catch {
            return false;
        }
    }

    // ============================================
    // IMAGE PROCESSING
    // ============================================

    private async loadImage(source: string | HTMLImageElement | File): Promise<HTMLImageElement> {
        if (source instanceof HTMLImageElement) {
            return source;
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;

            if (source instanceof File) {
                img.src = URL.createObjectURL(source);
            } else {
                img.src = source;
            }
        });
    }

    private toGrayscale(imageData: ImageData): Uint8Array {
        const gray = new Uint8Array(imageData.width * imageData.height);
        const data = imageData.data;

        for (let i = 0; i < gray.length; i++) {
            const idx = i * 4;
            // Luminosity method
            gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
        }

        return gray;
    }

    private detectEdges(gray: Uint8Array, width: number, height: number): Uint8Array {
        const edges = new Uint8Array(width * height);

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
                edges[y * width + x] = magnitude > 50 ? 255 : 0;
            }
        }

        return edges;
    }

    private detectLines(edges: Uint8Array, width: number, height: number): DetectedLine[] {
        const lines: DetectedLine[] = [];
        const visited = new Set<number>();

        // Simple line detection by tracing edge pixels
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (edges[idx] !== 255 || visited.has(idx)) continue;

                // Start a line trace
                const linePoints: { x: number; y: number }[] = [{ x, y }];
                visited.add(idx);

                // Follow the edge
                let cx = x, cy = y;
                for (let step = 0; step < 1000; step++) {
                    let found = false;
                    for (let dy = -1; dy <= 1 && !found; dy++) {
                        for (let dx = -1; dx <= 1 && !found; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = cx + dx, ny = cy + dy;
                            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                            const nidx = ny * width + nx;
                            if (edges[nidx] === 255 && !visited.has(nidx)) {
                                visited.add(nidx);
                                linePoints.push({ x: nx, y: ny });
                                cx = nx; cy = ny;
                                found = true;
                            }
                        }
                    }
                    if (!found) break;
                }

                // If long enough, create a line
                if (linePoints.length >= 10) {
                    const start = linePoints[0];
                    const end = linePoints[linePoints.length - 1];
                    const length = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
                    const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;

                    lines.push({
                        x1: start.x, y1: start.y,
                        x2: end.x, y2: end.y,
                        length,
                        angle: angle < 0 ? angle + 360 : angle
                    });
                }
            }
        }

        return lines;
    }

    private detectShapes(lines: DetectedLine[], width: number, height: number): DetectedShape[] {
        const shapes: DetectedShape[] = [];

        // Group lines by proximity to find rectangles
        const horizontals = lines.filter(l => Math.abs(l.angle) < 15 || Math.abs(l.angle - 180) < 15);
        const verticals = lines.filter(l => Math.abs(l.angle - 90) < 15 || Math.abs(l.angle - 270) < 15);

        // Find rectangles from pairs of horizontal and vertical lines
        for (const h1 of horizontals) {
            for (const h2 of horizontals) {
                if (h1 === h2) continue;

                for (const v1 of verticals) {
                    for (const v2 of verticals) {
                        if (v1 === v2) continue;

                        // Check if lines form a rectangle
                        const rect = this.checkRectangle(h1, h2, v1, v2);
                        if (rect) {
                            shapes.push({
                                type: 'rectangle',
                                bounds: rect,
                                confidence: 0.8
                            });
                        }
                    }
                }
            }
        }

        return shapes;
    }

    private checkRectangle(
        h1: DetectedLine, h2: DetectedLine,
        v1: DetectedLine, v2: DetectedLine
    ): { x: number; y: number; width: number; height: number } | null {
        // Simple heuristic - check if lines are approximately perpendicular and connected
        const tolerance = 30;

        const top = h1.y1 < h2.y1 ? h1 : h2;
        const bottom = h1.y1 < h2.y1 ? h2 : h1;
        const left = v1.x1 < v2.x1 ? v1 : v2;
        const right = v1.x1 < v2.x1 ? v2 : v1;

        // Check corners
        if (Math.abs(top.x1 - left.x1) > tolerance) return null;
        if (Math.abs(top.x2 - right.x1) > tolerance) return null;
        if (Math.abs(bottom.x1 - left.x2) > tolerance) return null;

        return {
            x: left.x1,
            y: top.y1,
            width: right.x1 - left.x1,
            height: bottom.y1 - top.y1
        };
    }

    private detectGrid(lines: DetectedLine[]): number | null {
        // Find common spacing between parallel lines
        const horizontals = lines.filter(l => Math.abs(l.angle) < 15);
        if (horizontals.length < 2) return null;

        const yPositions = horizontals.map(l => l.y1).sort((a, b) => a - b);
        const spacings: number[] = [];

        for (let i = 1; i < yPositions.length; i++) {
            spacings.push(yPositions[i] - yPositions[i - 1]);
        }

        // Find most common spacing
        const spacingCounts = new Map<number, number>();
        for (const s of spacings) {
            const rounded = Math.round(s / 10) * 10;
            spacingCounts.set(rounded, (spacingCounts.get(rounded) || 0) + 1);
        }

        let maxCount = 0;
        let gridSize: number | null = null;
        spacingCounts.forEach((count, spacing) => {
            if (count > maxCount && spacing > 20) {
                maxCount = count;
                gridSize = spacing;
            }
        });

        return gridSize;
    }

    private interpretAsStructure(
        lines: DetectedLine[],
        shapes: DetectedShape[],
        width: number,
        height: number
    ): SketchAnalysis['structuralInterpretation'] {
        const beams: DetectedLine[] = [];
        const columns: DetectedLine[] = [];
        const supports: { x: number; y: number; type: string }[] = [];

        // Classify lines as beams (horizontal) or columns (vertical)
        for (const line of lines) {
            if (line.length < 30) continue; // Skip short lines

            if (Math.abs(line.angle) < 15 || Math.abs(line.angle - 180) < 15) {
                beams.push(line);
            } else if (Math.abs(line.angle - 90) < 15 || Math.abs(line.angle - 270) < 15) {
                columns.push(line);
            }
        }

        // Detect supports at bottom of columns
        for (const col of columns) {
            const bottomY = Math.max(col.y1, col.y2);
            if (bottomY > height * 0.8) {
                // Likely a support
                supports.push({
                    x: col.x1,
                    y: bottomY,
                    type: 'fixed' // Default assumption
                });
            }
        }

        return { beams, columns, supports };
    }
}

// ============================================
// SINGLETON
// ============================================

export const cvFallback = new ComputerVisionFallbackClass();
export default ComputerVisionFallbackClass;
