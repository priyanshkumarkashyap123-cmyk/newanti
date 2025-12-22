/**
 * bridgeService.ts - Bridge between TypeScript and Python Backend
 * 
 * Provides a unified interface for communicating with the Python structural engine.
 */

// ============================================
// CONFIGURATION
// ============================================

const PYTHON_API = import.meta.env['VITE_PYTHON_API_URL'] || "http://localhost:8081";

// ============================================
// TYPES
// ============================================

export interface BridgeNode {
    id: string;
    x: number;
    y: number;
    z: number;
    support?: 'PINNED' | 'FIXED' | 'ROLLER' | 'NONE';
}

export interface BridgeMember {
    id: string;
    start_node: string;
    end_node: string;
    section_profile: string;
    member_type?: string;
}

export interface StructuralModel {
    nodes: BridgeNode[];
    members: BridgeMember[];
    metadata?: Record<string, string>;
}

export interface BridgeResponse {
    success: boolean;
    model?: StructuralModel;
    error?: string;
}

export type TemplateType = 'beam' | 'continuous_beam' | 'truss' | 'frame' | 'portal';

export interface BeamParams {
    span?: number;
    spans?: string;  // Comma-separated for continuous beam
    support_type?: 'simple' | 'fixed' | 'cantilever';
}

export interface TrussParams {
    span?: number;
    height?: number;
    bays?: number;
}

export interface FrameParams {
    width?: number;
    length?: number;
    height?: number;
    stories?: number;
    bays_x?: number;
    bays_z?: number;
}

export interface PortalParams {
    width?: number;
    height?: number;
    roof_angle?: number;
}

export type TemplateParams = BeamParams | TrussParams | FrameParams | PortalParams;

// ============================================
// BRIDGE SERVICE
// ============================================

export const Bridge = {
    /**
     * Check if Python server is online
     */
    async checkConnection(): Promise<boolean> {
        try {
            const response = await fetch(`${PYTHON_API}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000)
            });
            return response.ok;
        } catch (e) {
            console.warn('[Bridge] Python server offline');
            return false;
        }
    },

    /**
     * Spawn a structural template from the Python factory
     * 
     * @param type - Template type: beam, truss, frame, portal
     * @param params - Parameters for the template
     * @returns Structural model or null if server offline
     * 
     * @example
     * const model = await Bridge.spawnTemplate('truss', { span: 12, height: 3, bays: 6 });
     */
    async spawnTemplate(
        type: TemplateType,
        params: TemplateParams = {}
    ): Promise<BridgeResponse | null> {
        try {
            // Build query string from params
            const queryParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    queryParams.append(key, String(value));
                }
            });

            const url = `${PYTHON_API}/template/${type}?${queryParams.toString()}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[Bridge] Template fetch failed:', errorData);
                return {
                    success: false,
                    error: errorData.detail || `HTTP ${response.status}`
                };
            }

            const data: BridgeResponse = await response.json();

            console.log(`[Bridge] Template '${type}' loaded:`,
                `${data.model?.nodes.length} nodes, ${data.model?.members.length} members`);

            return data;

        } catch (e) {
            console.error("[Bridge] Python Server Offline", e);
            return null;
        }
    },

    /**
     * Generate structure from natural language prompt (AI)
     * 
     * @param userText - Natural language description
     * @returns Structural model or null
     * 
     * @example
     * const model = await Bridge.generateFromPrompt('Create a 15m bridge truss');
     */
    async generateFromPrompt(userText: string): Promise<BridgeResponse | null> {
        try {
            const response = await fetch(`${PYTHON_API}/generate/ai`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt: userText })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    success: false,
                    error: errorData.detail || `HTTP ${response.status}`
                };
            }

            const data: BridgeResponse = await response.json();

            console.log(`[Bridge] AI generated:`,
                `${data.model?.nodes.length} nodes, ${data.model?.members.length} members`);

            return data;

        } catch (e) {
            console.error("[Bridge] AI generation failed", e);
            return null;
        }
    },

    /**
     * Validate a structural model
     * 
     * @param model - Model to validate
     * @returns Validation result
     */
    async validateModel(model: StructuralModel): Promise<{
        valid: boolean;
        issues: string[];
        node_count: number;
        member_count: number;
        support_count: number;
    } | null> {
        try {
            const response = await fetch(`${PYTHON_API}/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(model)
            });

            if (!response.ok) {
                return null;
            }

            return await response.json();

        } catch (e) {
            console.error("[Bridge] Validation failed", e);
            return null;
        }
    },

    /**
     * Generate continuous beam with multiple spans
     * 
     * @param spans - Array of span lengths
     * @returns Structural model
     */
    async spawnContinuousBeam(spans: number[]): Promise<BridgeResponse | null> {
        return this.spawnTemplate('continuous_beam', {
            spans: spans.join(',')
        });
    },

    /**
     * Generate Pratt truss
     * 
     * @param span - Total span
     * @param height - Truss height  
     * @param bays - Number of bays
     */
    async spawnTruss(span: number, height: number, bays: number): Promise<BridgeResponse | null> {
        return this.spawnTemplate('truss', { span, height, bays });
    },

    /**
     * Generate 3D building frame
     * 
     * @param width - Width in X
     * @param length - Length in Z
     * @param height - Story height
     * @param stories - Number of stories
     */
    async spawnFrame(
        width: number,
        length: number,
        height: number,
        stories: number
    ): Promise<BridgeResponse | null> {
        return this.spawnTemplate('frame', { width, length, height, stories });
    },

    /**
     * Generate portal frame with pitched roof
     * 
     * @param width - Frame width
     * @param height - Eave height
     * @param roofAngle - Roof pitch angle
     */
    async spawnPortal(
        width: number,
        height: number,
        roofAngle: number = 15
    ): Promise<BridgeResponse | null> {
        return this.spawnTemplate('portal', {
            width,
            height,
            roof_angle: roofAngle
        });
    }
};

export default Bridge;
