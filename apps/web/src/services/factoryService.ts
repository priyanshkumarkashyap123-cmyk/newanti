/**
 * factoryService.ts - Client for Python Structural Backend
 * 
 * Communicates with the FastAPI backend for structure generation.
 */

// ============================================
// CONFIGURATION
// ============================================

// Python backend URL - defaults to localhost:8000 for development
// In production, set VITE_PYTHON_API_URL environment variable
const API_URL = import.meta.env.VITE_PYTHON_API_URL || "https://beamlab-backend-python.azurewebsites.net";

// ============================================
// TYPES
// ============================================

export interface FactoryNode {
    id: string;
    x: number;
    y: number;
    z: number;
    support: 'FIXED' | 'PINNED' | 'ROLLER' | 'NONE';
}

export interface FactoryMember {
    id: string;
    startNodeId: string;
    endNodeId: string;
    section: string;
}

export interface StructuralModel {
    nodes: FactoryNode[];
    members: FactoryMember[];
    name?: string;
    metadata?: Record<string, unknown>;
}

export interface GenerateResponse {
    success: boolean;
    model?: StructuralModel;
    error?: string;
    template_used?: string;
}

export type TemplateType =
    | 'beam'
    | 'portal_frame'
    | 'pratt_truss'
    | 'warren_truss'
    | 'multi_story_frame';

export interface TemplateParams {
    // Beam
    span?: number;
    supports?: 'simple' | 'cantilever' | 'fixed';

    // Portal Frame
    width?: number;
    height?: number;
    roof_angle?: number;

    // Trusses
    bays?: number;
    panels?: number;

    // Multi-story
    stories?: number;
    bay_width?: number;
    story_height?: number;
}

// ============================================
// ERROR HANDLING
// ============================================

class FactoryServiceError extends Error {
    constructor(message: string, public statusCode?: number) {
        super(message);
        this.name = 'FactoryServiceError';
    }
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Fetch a structural model from a predefined template.
 * 
 * @param type - Template type (beam, portal_frame, pratt_truss, etc.)
 * @param params - Template parameters (span, height, bays, etc.)
 * @returns Structural model with nodes and members
 * 
 * @example
 * const model = await fetchTemplate('portal_frame', { width: 12, height: 6 });
 */
export async function fetchTemplate(
    type: TemplateType,
    params: TemplateParams = {}
): Promise<StructuralModel> {
    try {
        const response = await fetch(`${API_URL}/generate/template`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ type, params }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new FactoryServiceError(
                errorData.detail || `HTTP error: ${response.status}`,
                response.status
            );
        }

        const data: GenerateResponse = await response.json();

        if (!data.success || !data.model) {
            throw new FactoryServiceError(data.error || 'Template generation failed');
        }

        console.log(`[FactoryService] Generated ${type}: ${data.model.nodes.length} nodes, ${data.model.members.length} members`);

        return data.model;
    } catch (error) {
        if (error instanceof FactoryServiceError) {
            throw error;
        }

        // Network or parsing error
        console.error('[FactoryService] Template fetch error:', error);
        throw new FactoryServiceError(
            error instanceof Error ? error.message : 'Failed to connect to Python backend'
        );
    }
}

/**
 * Generate a structural model from natural language prompt using AI.
 * 
 * @param prompt - Natural language description of the structure
 * @returns Structural model with nodes and members
 * 
 * @example
 * const model = await generateFromAI('Create a 12m span bridge truss');
 */
export async function generateFromAI(prompt: string): Promise<StructuralModel> {
    try {
        const response = await fetch(`${API_URL}/generate/ai`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new FactoryServiceError(
                errorData.detail || `HTTP error: ${response.status}`,
                response.status
            );
        }

        const data: GenerateResponse = await response.json();

        if (!data.success || !data.model) {
            throw new FactoryServiceError(data.error || 'AI generation failed');
        }

        console.log(`[FactoryService] AI generated: ${data.model.nodes.length} nodes, ${data.model.members.length} members`);

        return data.model;
    } catch (error) {
        if (error instanceof FactoryServiceError) {
            throw error;
        }

        console.error('[FactoryService] AI generation error:', error);
        throw new FactoryServiceError(
            error instanceof Error ? error.message : 'Failed to generate from AI'
        );
    }
}

/**
 * Validate a structural model.
 * 
 * @param model - Structural model to validate
 * @returns Validation result with issues
 */
export async function validateModel(model: StructuralModel): Promise<{
    valid: boolean;
    issues: string[];
    node_count: number;
    member_count: number;
    support_count: number;
}> {
    try {
        const response = await fetch(`${API_URL}/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(model),
        });

        if (!response.ok) {
            throw new FactoryServiceError(`HTTP error: ${response.status}`, response.status);
        }

        return await response.json();
    } catch (error) {
        console.error('[FactoryService] Validation error:', error);
        throw new FactoryServiceError(
            error instanceof Error ? error.message : 'Failed to validate model'
        );
    }
}

/**
 * Check if the Python backend is available.
 * 
 * @returns Health status
 */
export async function checkHealth(): Promise<{
    status: string;
    templates_available: string[];
}> {
    try {
        const response = await fetch(`${API_URL}/health`, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new FactoryServiceError(`Backend unavailable: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('[FactoryService] Health check failed:', error);
        throw new FactoryServiceError('Python backend is not running');
    }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Quick helper to create a simple beam.
 */
export const createBeam = (span = 6, supports: 'simple' | 'cantilever' | 'fixed' = 'simple') =>
    fetchTemplate('beam', { span, supports });

/**
 * Quick helper to create a portal frame.
 */
export const createPortalFrame = (width = 10, height = 6, roof_angle = 15) =>
    fetchTemplate('portal_frame', { width, height, roof_angle });

/**
 * Quick helper to create a Pratt truss.
 */
export const createPrattTruss = (span = 12, height = 3, bays = 6) =>
    fetchTemplate('pratt_truss', { span, height, bays });

/**
 * Quick helper to create a multi-story frame.
 */
export const createMultiStoryFrame = (bays = 2, stories = 3) =>
    fetchTemplate('multi_story_frame', { bays, stories });

export default {
    fetchTemplate,
    generateFromAI,
    validateModel,
    checkHealth,
    createBeam,
    createPortalFrame,
    createPrattTruss,
    createMultiStoryFrame
};
