/**
 * ARVisualizationService.ts
 * 
 * WebXR Augmented Reality Visualization
 * 
 * Features:
 * - AR session management
 * - Model placement in real world
 * - Scale adjustment
 * - Interactive measurements
 * - Photo documentation
 */

// ============================================
// TYPES
// ============================================

export interface ARSession {
    id: string;
    status: 'inactive' | 'starting' | 'active' | 'paused' | 'error';
    mode: 'immersive-ar' | 'inline';
    features: string[];
}

export interface ARModel {
    id: string;
    meshData: any;        // Three.js mesh or similar
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: number;
    visible: boolean;
    anchored: boolean;
}

export interface ARMeasurement {
    id: string;
    type: 'distance' | 'angle' | 'area';
    points: Array<{ x: number; y: number; z: number }>;
    value: number;
    unit: string;
}

export interface ARCapture {
    id: string;
    timestamp: Date;
    imageData: string;    // Base64
    model: ARModel;
    measurements: ARMeasurement[];
    notes?: string;
}

// ============================================
// AR VISUALIZATION SERVICE
// ============================================

class ARVisualizationServiceClass {
    private session: ARSession | null = null;
    private models: Map<string, ARModel> = new Map();
    private measurements: ARMeasurement[] = [];
    private captures: ARCapture[] = [];
    private isSupported: boolean = false;

    constructor() {
        this.checkSupport();
    }

    /**
     * Check WebXR AR support
     */
    private async checkSupport(): Promise<void> {
        if (typeof navigator === 'undefined') return;

        if ('xr' in navigator) {
            try {
                this.isSupported = await (navigator as any).xr.isSessionSupported('immersive-ar');
            } catch (e) {
                this.isSupported = false;
            }
        }
    }

    /**
     * Check if AR is supported
     */
    isARSupported(): boolean {
        return this.isSupported;
    }

    /**
     * Start AR session
     */
    async startSession(options?: {
        domOverlay?: HTMLElement;
        requiredFeatures?: string[];
    }): Promise<ARSession> {
        if (!this.isSupported) {
            throw new Error('AR not supported on this device');
        }

        this.session = {
            id: `ar_${Date.now()}`,
            status: 'starting',
            mode: 'immersive-ar',
            features: options?.requiredFeatures || ['hit-test', 'dom-overlay']
        };

        try {
            // Request XR session
            const xrSession = await (navigator as any).xr.requestSession('immersive-ar', {
                requiredFeatures: this.session.features,
                domOverlay: options?.domOverlay ? { root: options.domOverlay } : undefined
            });

            // Store session reference
            (this as any)._xrSession = xrSession;

            xrSession.addEventListener('end', () => {
                this.session!.status = 'inactive';
            });

            this.session.status = 'active';
            console.log('[AR] Session started');

        } catch (error) {
            this.session.status = 'error';
            throw error;
        }

        return this.session;
    }

    /**
     * End AR session
     */
    async endSession(): Promise<void> {
        if ((this as any)._xrSession) {
            await (this as any)._xrSession.end();
            (this as any)._xrSession = null;
        }

        if (this.session) {
            this.session.status = 'inactive';
        }
    }

    /**
     * Place structural model in AR
     */
    placeModel(
        meshData: any,
        position: { x: number; y: number; z: number },
        scale: number = 0.1
    ): ARModel {
        const model: ARModel = {
            id: `model_${Date.now()}`,
            meshData,
            position,
            rotation: { x: 0, y: 0, z: 0 },
            scale,
            visible: true,
            anchored: false
        };

        this.models.set(model.id, model);
        console.log(`[AR] Model placed at (${position.x}, ${position.y}, ${position.z})`);

        return model;
    }

    /**
     * Anchor model to real-world surface
     */
    async anchorModel(modelId: string, hitTestResult: any): Promise<boolean> {
        const model = this.models.get(modelId);
        if (!model) return false;

        // In production, use XRAnchor
        model.anchored = true;
        console.log(`[AR] Model ${modelId} anchored`);

        return true;
    }

    /**
     * Update model transform
     */
    updateModel(
        modelId: string,
        updates: Partial<Pick<ARModel, 'position' | 'rotation' | 'scale' | 'visible'>>
    ): boolean {
        const model = this.models.get(modelId);
        if (!model) return false;

        if (updates.position) model.position = updates.position;
        if (updates.rotation) model.rotation = updates.rotation;
        if (updates.scale !== undefined) model.scale = updates.scale;
        if (updates.visible !== undefined) model.visible = updates.visible;

        return true;
    }

    /**
     * Create measurement in AR
     */
    addMeasurement(
        type: 'distance' | 'angle' | 'area',
        points: Array<{ x: number; y: number; z: number }>
    ): ARMeasurement {
        let value = 0;
        let unit = '';

        switch (type) {
            case 'distance':
                if (points.length >= 2) {
                    const [p1, p2] = points;
                    value = Math.sqrt(
                        (p2.x - p1.x) ** 2 +
                        (p2.y - p1.y) ** 2 +
                        (p2.z - p1.z) ** 2
                    );
                    unit = 'm';
                }
                break;

            case 'angle':
                if (points.length >= 3) {
                    // Calculate angle between three points
                    const [a, b, c] = points;
                    const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
                    const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
                    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
                    const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
                    const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);
                    value = Math.acos(dot / (mag1 * mag2)) * 180 / Math.PI;
                    unit = '°';
                }
                break;

            case 'area':
                if (points.length >= 3) {
                    // Simple polygon area using Shoelace formula (2D projection)
                    let sum = 0;
                    for (let i = 0; i < points.length; i++) {
                        const j = (i + 1) % points.length;
                        sum += points[i].x * points[j].z - points[j].x * points[i].z;
                    }
                    value = Math.abs(sum) / 2;
                    unit = 'm²';
                }
                break;
        }

        const measurement: ARMeasurement = {
            id: `meas_${Date.now()}`,
            type,
            points,
            value,
            unit
        };

        this.measurements.push(measurement);
        return measurement;
    }

    /**
     * Capture AR view with model
     */
    async captureView(notes?: string): Promise<ARCapture> {
        // Get active model
        const activeModel = Array.from(this.models.values()).find(m => m.visible);

        // In production, capture from XR session
        const capture: ARCapture = {
            id: `cap_${Date.now()}`,
            timestamp: new Date(),
            imageData: '', // Would be actual screenshot
            model: activeModel!,
            measurements: [...this.measurements],
            notes
        };

        this.captures.push(capture);
        console.log(`[AR] View captured with ${this.measurements.length} measurements`);

        return capture;
    }

    /**
     * Get scale for model placement
     */
    calculateScale(
        modelBounds: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
        desiredSize: number = 1 // meters
    ): number {
        const size = Math.max(
            modelBounds.max.x - modelBounds.min.x,
            modelBounds.max.y - modelBounds.min.y,
            modelBounds.max.z - modelBounds.min.z
        );

        return desiredSize / size;
    }

    /**
     * Get all captures
     */
    getCaptures(): ARCapture[] {
        return [...this.captures];
    }

    /**
     * Get session status
     */
    getSessionStatus(): ARSession | null {
        return this.session;
    }

    /**
     * Clear all models and measurements
     */
    clear(): void {
        this.models.clear();
        this.measurements = [];
    }
}

// ============================================
// SINGLETON
// ============================================

export const arVisualization = new ARVisualizationServiceClass();

export default ARVisualizationServiceClass;
