/**
 * ModelGeneratorService - AI-Powered Structural Model Generation
 * 
 * Uses LLM to generate structural models from natural language prompts.
 * Outputs valid JSON conforming to BeamLab schema.
 */

import OpenAI from 'openai';

// ============================================
// TYPES
// ============================================

export interface GeneratedNode {
    id: string;
    x: number;
    y: number;
    z: number;
}

export interface GeneratedMember {
    id: string;
    startNodeId: string;
    endNodeId: string;
    section: string;
}

export interface GeneratedModel {
    nodes: GeneratedNode[];
    members: GeneratedMember[];
}

export interface GenerationRequest {
    prompt: string;
    constraints?: {
        maxNodes?: number;
        maxMembers?: number;
        preferredSections?: string[];
    };
}

export interface GenerationResult {
    success: boolean;
    model?: GeneratedModel;
    error?: string;
    tokens?: {
        prompt: number;
        completion: number;
    };
}

// ============================================
// SYSTEM PROMPT
// ============================================

const SYSTEM_PROMPT = `You are a structural modeling agent for BeamLab Ultimate.
Output ONLY valid JSON. No prose. No explanations. No markdown code blocks.

Schema:
{
  "nodes": [{ "id": "string", "x": number, "y": number, "z": number }],
  "members": [{ "id": "string", "startNodeId": "string", "endNodeId": "string", "section": "string" }]
}

Rules:
1. Use Meters as units.
2. Ensure the structure is stable and connected (no floating nodes).
3. Use realistic node IDs like "N1", "N2" and member IDs like "M1", "M2".
4. Use common steel sections like "ISMB 300", "ISMB 400", "W14x90", "HE 300B".
5. For trusses, use lighter sections like "ISA 100x100x10", "L100x100x10".
6. Start the structure at origin (0,0,0) unless specified otherwise.
7. Ensure nodes are at grid-friendly coordinates (whole numbers or simple decimals).
8. Every member must connect two existing nodes.

Common structure templates:
- Simple beam: 2 nodes on X-axis, 1 member
- Portal frame: 4 nodes forming a rectangle in XY plane
- Truss: Triangulated pattern for efficiency
- Multi-story frame: Grid of nodes at each floor level

Output the raw JSON object directly. Do not wrap in code blocks or add any text.`;

// ============================================
// MODEL GENERATOR SERVICE
// ============================================

export class ModelGeneratorService {
    private openai: OpenAI | null = null;
    private model: string = 'gpt-4-turbo-preview';

    constructor() {
        const apiKey = process.env['OPENAI_API_KEY'];
        if (apiKey) {
            this.openai = new OpenAI({ apiKey });
        }
    }

    /**
     * Generate a structural model from a natural language prompt
     */
    async generate(request: GenerationRequest): Promise<GenerationResult> {
        if (!this.openai) {
            // Fallback to demo generation if no API key
            return this.generateDemo(request);
        }

        try {
            // Build user prompt with constraints
            let userPrompt = request.prompt;
            if (request.constraints) {
                const constraints: string[] = [];
                if (request.constraints.maxNodes) {
                    constraints.push(`Maximum ${request.constraints.maxNodes} nodes`);
                }
                if (request.constraints.maxMembers) {
                    constraints.push(`Maximum ${request.constraints.maxMembers} members`);
                }
                if (request.constraints.preferredSections?.length) {
                    constraints.push(`Preferred sections: ${request.constraints.preferredSections.join(', ')}`);
                }
                if (constraints.length > 0) {
                    userPrompt += `\n\nConstraints: ${constraints.join('. ')}.`;
                }
            }

            // Call OpenAI API
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                max_tokens: 4000,
                response_format: { type: 'json_object' }
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                return { success: false, error: 'Empty response from LLM' };
            }

            // Parse and validate JSON
            const model = this.parseAndValidate(content);
            if (!model) {
                return { success: false, error: 'Invalid JSON structure from LLM' };
            }

            return {
                success: true,
                model,
                tokens: {
                    prompt: response.usage?.prompt_tokens || 0,
                    completion: response.usage?.completion_tokens || 0
                }
            };

        } catch (error) {
            console.error('[ModelGenerator] Error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Parse and validate the JSON response
     */
    private parseAndValidate(content: string): GeneratedModel | null {
        try {
            // Try to extract JSON if wrapped in code blocks
            let jsonStr = content.trim();
            if (jsonStr.startsWith('```')) {
                const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (match?.[1]) {
                    jsonStr = match[1];
                }
            }

            const parsed = JSON.parse(jsonStr);

            // Validate structure
            if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.members)) {
                return null;
            }

            // Validate nodes
            for (const node of parsed.nodes) {
                if (typeof node.id !== 'string' ||
                    typeof node.x !== 'number' ||
                    typeof node.y !== 'number' ||
                    typeof node.z !== 'number') {
                    return null;
                }
            }

            // Validate members
            const nodeIds = new Set(parsed.nodes.map((n: GeneratedNode) => n.id));
            for (const member of parsed.members) {
                if (typeof member.id !== 'string' ||
                    typeof member.startNodeId !== 'string' ||
                    typeof member.endNodeId !== 'string' ||
                    typeof member.section !== 'string') {
                    return null;
                }
                // Check that member references valid nodes
                if (!nodeIds.has(member.startNodeId) || !nodeIds.has(member.endNodeId)) {
                    return null;
                }
            }

            return parsed as GeneratedModel;

        } catch (e) {
            console.error('[ModelGenerator] Parse error:', e);
            return null;
        }
    }

    /**
     * Demo generation without API (for testing/fallback)
     */
    private async generateDemo(request: GenerationRequest): Promise<GenerationResult> {
        const prompt = request.prompt.toLowerCase();

        // Simple pattern matching for demo
        if (prompt.includes('portal frame') || prompt.includes('simple frame')) {
            return {
                success: true,
                model: {
                    nodes: [
                        { id: 'N1', x: 0, y: 0, z: 0 },
                        { id: 'N2', x: 6, y: 0, z: 0 },
                        { id: 'N3', x: 0, y: 4, z: 0 },
                        { id: 'N4', x: 6, y: 4, z: 0 }
                    ],
                    members: [
                        { id: 'M1', startNodeId: 'N1', endNodeId: 'N3', section: 'ISMB 300' },
                        { id: 'M2', startNodeId: 'N2', endNodeId: 'N4', section: 'ISMB 300' },
                        { id: 'M3', startNodeId: 'N3', endNodeId: 'N4', section: 'ISMB 400' }
                    ]
                }
            };
        }

        if (prompt.includes('truss') || prompt.includes('roof')) {
            return {
                success: true,
                model: {
                    nodes: [
                        { id: 'N1', x: 0, y: 0, z: 0 },
                        { id: 'N2', x: 3, y: 0, z: 0 },
                        { id: 'N3', x: 6, y: 0, z: 0 },
                        { id: 'N4', x: 9, y: 0, z: 0 },
                        { id: 'N5', x: 12, y: 0, z: 0 },
                        { id: 'N6', x: 3, y: 2, z: 0 },
                        { id: 'N7', x: 6, y: 3, z: 0 },
                        { id: 'N8', x: 9, y: 2, z: 0 }
                    ],
                    members: [
                        // Bottom chord
                        { id: 'M1', startNodeId: 'N1', endNodeId: 'N2', section: 'ISA 100x100x10' },
                        { id: 'M2', startNodeId: 'N2', endNodeId: 'N3', section: 'ISA 100x100x10' },
                        { id: 'M3', startNodeId: 'N3', endNodeId: 'N4', section: 'ISA 100x100x10' },
                        { id: 'M4', startNodeId: 'N4', endNodeId: 'N5', section: 'ISA 100x100x10' },
                        // Top chord
                        { id: 'M5', startNodeId: 'N1', endNodeId: 'N6', section: 'ISA 100x100x10' },
                        { id: 'M6', startNodeId: 'N6', endNodeId: 'N7', section: 'ISA 100x100x10' },
                        { id: 'M7', startNodeId: 'N7', endNodeId: 'N8', section: 'ISA 100x100x10' },
                        { id: 'M8', startNodeId: 'N8', endNodeId: 'N5', section: 'ISA 100x100x10' },
                        // Verticals
                        { id: 'M9', startNodeId: 'N2', endNodeId: 'N6', section: 'ISA 75x75x8' },
                        { id: 'M10', startNodeId: 'N3', endNodeId: 'N7', section: 'ISA 75x75x8' },
                        { id: 'M11', startNodeId: 'N4', endNodeId: 'N8', section: 'ISA 75x75x8' }
                    ]
                }
            };
        }

        if (prompt.includes('beam') || prompt.includes('simple')) {
            return {
                success: true,
                model: {
                    nodes: [
                        { id: 'N1', x: 0, y: 0, z: 0 },
                        { id: 'N2', x: 6, y: 0, z: 0 }
                    ],
                    members: [
                        { id: 'M1', startNodeId: 'N1', endNodeId: 'N2', section: 'ISMB 300' }
                    ]
                }
            };
        }

        // Default: 2-story frame
        return {
            success: true,
            model: {
                nodes: [
                    { id: 'N1', x: 0, y: 0, z: 0 },
                    { id: 'N2', x: 6, y: 0, z: 0 },
                    { id: 'N3', x: 12, y: 0, z: 0 },
                    { id: 'N4', x: 0, y: 3.5, z: 0 },
                    { id: 'N5', x: 6, y: 3.5, z: 0 },
                    { id: 'N6', x: 12, y: 3.5, z: 0 },
                    { id: 'N7', x: 0, y: 7, z: 0 },
                    { id: 'N8', x: 6, y: 7, z: 0 },
                    { id: 'N9', x: 12, y: 7, z: 0 }
                ],
                members: [
                    // Columns
                    { id: 'M1', startNodeId: 'N1', endNodeId: 'N4', section: 'ISMB 400' },
                    { id: 'M2', startNodeId: 'N2', endNodeId: 'N5', section: 'ISMB 400' },
                    { id: 'M3', startNodeId: 'N3', endNodeId: 'N6', section: 'ISMB 400' },
                    { id: 'M4', startNodeId: 'N4', endNodeId: 'N7', section: 'ISMB 350' },
                    { id: 'M5', startNodeId: 'N5', endNodeId: 'N8', section: 'ISMB 350' },
                    { id: 'M6', startNodeId: 'N6', endNodeId: 'N9', section: 'ISMB 350' },
                    // Beams Floor 1
                    { id: 'M7', startNodeId: 'N4', endNodeId: 'N5', section: 'ISMB 350' },
                    { id: 'M8', startNodeId: 'N5', endNodeId: 'N6', section: 'ISMB 350' },
                    // Beams Floor 2
                    { id: 'M9', startNodeId: 'N7', endNodeId: 'N8', section: 'ISMB 300' },
                    { id: 'M10', startNodeId: 'N8', endNodeId: 'N9', section: 'ISMB 300' }
                ]
            }
        };
    }

    /**
     * Validate that a model is structurally sound
     */
    validateModel(model: GeneratedModel): { valid: boolean; issues: string[] } {
        const issues: string[] = [];

        // Check for isolated nodes
        const connectedNodes = new Set<string>();
        for (const member of model.members) {
            connectedNodes.add(member.startNodeId);
            connectedNodes.add(member.endNodeId);
        }

        for (const node of model.nodes) {
            if (!connectedNodes.has(node.id)) {
                issues.push(`Node ${node.id} is not connected to any member`);
            }
        }

        // Check for duplicate node positions
        const positions = new Map<string, string>();
        for (const node of model.nodes) {
            const key = `${node.x},${node.y},${node.z}`;
            if (positions.has(key)) {
                issues.push(`Nodes ${positions.get(key)} and ${node.id} have the same position`);
            }
            positions.set(key, node.id);
        }

        // Check for zero-length members
        const nodeMap = new Map(model.nodes.map(n => [n.id, n]));
        for (const member of model.members) {
            const start = nodeMap.get(member.startNodeId);
            const end = nodeMap.get(member.endNodeId);
            if (start && end) {
                const length = Math.sqrt(
                    (end.x - start.x) ** 2 +
                    (end.y - start.y) ** 2 +
                    (end.z - start.z) ** 2
                );
                if (length < 0.01) {
                    issues.push(`Member ${member.id} has near-zero length`);
                }
            }
        }

        return { valid: issues.length === 0, issues };
    }
}

export const modelGeneratorService = new ModelGeneratorService();
export default modelGeneratorService;
