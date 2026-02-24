/**
 * CanvasKit 2D Diagram Renderer
 * 
 * Uses Skia (CanvasKit) for vector-perfect 2D diagrams that don't pixelate on zoom.
 * Renders Bending Moment Diagrams (BMD), Shear Force Diagrams (SFD), and Deflection curves.
 */

let CanvasKitInstance: any = null;

export interface DiagramData {
    xValues: number[];
    shearValues: number[];
    momentValues: number[];
    deflectionValues: number[];
}

export interface DiagramOptions {
    width: number;
    height: number;
    showGrid: boolean;
    showLabels: boolean;
    colors: {
        shear: string;
        moment: string;
        deflection: string;
        baseline: string;
    };
}

const defaultOptions: DiagramOptions = {
    width: 800,
    height: 400,
    showGrid: true,
    showLabels: true,
    colors: {
        shear: '#FF6B6B',
        moment: '#4ECDC4',
        deflection: '#45B7D1',
        baseline: '#333333'
    }
};

/**
 * Initialize CanvasKit from the CDN
 */
export async function initCanvasKit(): Promise<void> {
    if (CanvasKitInstance) return;

    try {
        // Load CanvasKit from CDN
        const CanvasKitInit = (window as any).CanvasKitInit;
        if (!CanvasKitInit) {
            // Dynamically load CanvasKit if not present
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/canvaskit-wasm@0.39.1/bin/canvaskit.js';
            script.async = true;
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        CanvasKitInstance = await (window as any).CanvasKitInit({
            locateFile: (file: string) => `https://unpkg.com/canvaskit-wasm@0.39.1/bin/${file}`
        });

        console.log('[AI Architect] CanvasKit initialized successfully');
    } catch (error) {
        console.error('[AI Architect] Failed to initialize CanvasKit:', error);
        throw error;
    }
}

/**
 * Render a diagram to a canvas element
 */
export function renderDiagram(
    canvas: HTMLCanvasElement,
    data: DiagramData,
    diagramType: 'shear' | 'moment' | 'deflection',
    options: Partial<DiagramOptions> = {}
): void {
    if (!CanvasKitInstance) {
        console.error('[AI Architect] CanvasKit not initialized');
        return;
    }

    const opts = { ...defaultOptions, ...options };
    const surface = CanvasKitInstance.MakeCanvasSurface(canvas);
    if (!surface) {
        console.error('[AI Architect] Failed to create CanvasKit surface');
        return;
    }

    const skCanvas = surface.getCanvas();
    skCanvas.clear(CanvasKitInstance.WHITE);

    // Get data based on diagram type
    const values = diagramType === 'shear' ? data.shearValues :
        diagramType === 'moment' ? data.momentValues :
            data.deflectionValues;

    if (!values || values.length === 0) return;

    // Calculate scaling
    const maxVal = Math.max(...values.map(Math.abs));
    const minX = Math.min(...data.xValues);
    const maxX = Math.max(...data.xValues);
    const padding = 50;

    const scaleX = (opts.width - 2 * padding) / (maxX - minX);
    const scaleY = (opts.height - 2 * padding) / (2 * maxVal || 1);
    const centerY = opts.height / 2;

    // Draw baseline
    const baselinePaint = new CanvasKitInstance.Paint();
    baselinePaint.setColor(CanvasKitInstance.parseColorString(opts.colors.baseline));
    baselinePaint.setStrokeWidth(2);
    baselinePaint.setStyle(CanvasKitInstance.PaintStyle.Stroke);

    skCanvas.drawLine(padding, centerY, opts.width - padding, centerY, baselinePaint);

    // Draw diagram curve
    const diagramPaint = new CanvasKitInstance.Paint();
    const color = opts.colors[diagramType];
    diagramPaint.setColor(CanvasKitInstance.parseColorString(color));
    diagramPaint.setStrokeWidth(3);
    diagramPaint.setStyle(CanvasKitInstance.PaintStyle.Stroke);
    diagramPaint.setAntiAlias(true);

    const path = new CanvasKitInstance.Path();
    for (let i = 0; i < data.xValues.length; i++) {
        const x = padding + (data.xValues[i] - minX) * scaleX;
        const y = centerY - values[i] * scaleY;

        if (i === 0) {
            path.moveTo(x, y);
        } else {
            path.lineTo(x, y);
        }
    }

    skCanvas.drawPath(path, diagramPaint);

    // Fill area under curve
    const fillPaint = new CanvasKitInstance.Paint();
    fillPaint.setColor(CanvasKitInstance.parseColorString(color + '40')); // 25% opacity
    fillPaint.setStyle(CanvasKitInstance.PaintStyle.Fill);

    const fillPath = path.copy();
    fillPath.lineTo(opts.width - padding, centerY);
    fillPath.lineTo(padding, centerY);
    fillPath.close();

    skCanvas.drawPath(fillPath, fillPaint);

    // Cleanup
    surface.flush();
    baselinePaint.delete();
    diagramPaint.delete();
    fillPaint.delete();
    path.delete();
    fillPath.delete();
}

/**
 * Export diagram to PNG
 */
export async function exportDiagramToPNG(
    canvas: HTMLCanvasElement,
    filename: string = 'diagram.png'
): Promise<void> {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
}
