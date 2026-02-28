/**
 * AIArchitectService - Gemini-Powered Structural Model Generation
 * 
 * Uses Google Gemini AI to generate structural models from natural language prompts.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env['GEMINI_API_KEY'] || '');

// ============================================
// TYPES
// ============================================

export interface GeneratedNode {
    id: string;
    x: number;
    y: number;
    z: number;
    isSupport?: boolean;
}

export interface GeneratedMember {
    id: string;
    s: string;  // startNode
    e: string;  // endNode
    section: string;
}

export interface GeneratedModel {
    nodes: GeneratedNode[];
    members: GeneratedMember[];
}

export interface GenerationResult {
    success: boolean;
    model?: GeneratedModel;
    error?: string;
    rawResponse?: string;
}

// ============================================
// SYSTEM INSTRUCTION
// ============================================

const SYSTEM_INSTRUCTION = `
You are a Civil Engineering AI specializing in structural modeling. 
Generate a structural model in JSON format based on the user's description.

CRITICAL RULES:
1. Units: Always use METERS for all coordinates.
2. Output ONLY valid JSON - no explanations, no markdown code blocks.
3. Ensure the structure is physically stable and connected.
4. Use realistic Indian Standard (IS) sections like ISMB, ISMC, ISA.

JSON SCHEMA:
{
  "nodes": [
    {"id": "n1", "x": 0, "y": 0, "z": 0, "isSupport": true},
    {"id": "n2", "x": 6, "y": 0, "z": 0, "isSupport": true},
    {"id": "n3", "x": 0, "y": 4, "z": 0},
    {"id": "n4", "x": 6, "y": 4, "z": 0}
  ],
  "members": [
    {"id": "m1", "s": "n1", "e": "n3", "section": "ISMB400"},
    {"id": "m2", "s": "n2", "e": "n4", "section": "ISMB400"},
    {"id": "m3", "s": "n3", "e": "n4", "section": "ISMB300"}
  ]
}

NODE RULES:
- "id": Unique identifier like "n1", "n2", etc.
- "x", "y", "z": Coordinates in meters (Y is vertical/height)
- "isSupport": true for nodes at ground level (y=0) that are fixed

MEMBER RULES:
- "id": Unique identifier like "m1", "m2", etc.
- "s": Start node id
- "e": End node id
- "section": Steel section (ISMB300, ISMB400, ISMB500, ISMC200, ISA100x100x10)

COMMON STRUCTURES:
- Portal Frame Warehouse: 2 columns + pitched roof (5 nodes, 4 members)
- Multi-story Building: Grid of columns and beams at each floor
- Pratt Truss: Bottom chord, top chord, verticals, diagonals
- Simple Beam: 2 support nodes, 1 member
- Cantilever: 1 fixed support, beam extending out

SECTION GUIDELINES:
- Columns: ISMB400, ISMB450, ISMB500
- Beams: ISMB300, ISMB350, ISMB400
- Rafters: ISMB250, ISMB300
- Truss members: ISA100x100x10, ISA75x75x8
- Purlins: ISMC150, ISMC200

Output the raw JSON object directly. Do not wrap in code blocks.
`;

// ============================================
// AI ARCHITECT SERVICE
// ============================================

export class AIArchitectService {
    /**
     * Generate a structural model from natural language prompt
     */
    static async generateStructure(userPrompt: string): Promise<GenerationResult> {
        try {
            // Check for API key
            if (!process.env['GEMINI_API_KEY']) {
                console.warn('[AIArchitect] No GEMINI_API_KEY, using fallback');
                return this.generateFallback(userPrompt);
            }

            const model = genAI.getGenerativeModel({ model: "gemini-pro" });

            console.log(`[AIArchitect] Generating for: "${userPrompt.substring(0, 50)}..."`);

            const result = await model.generateContent([SYSTEM_INSTRUCTION, userPrompt]);
            const response = await result.response;
            const text = response.text();

            console.log('[AIArchitect] Raw response:', text.substring(0, 200));

            // Clean and parse JSON
            const cleanedText = text
                .replace(/```json\s*/g, '')
                .replace(/```\s*/g, '')
                .trim();

            const parsedModel = JSON.parse(cleanedText) as GeneratedModel;

            // Validate the model
            const validation = this.validateModel(parsedModel);
            if (!validation.valid) {
                console.warn('[AIArchitect] Validation issues:', validation.issues);
            }

            // Normalize the model (convert s/e to startNodeId/endNodeId if needed)
            const normalizedModel = this.normalizeModel(parsedModel);

            return {
                success: true,
                model: normalizedModel,
                rawResponse: text
            };

        } catch (error) {
            console.error('[AIArchitect] Error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Normalize the model to ensure consistent field names
     */
    private static normalizeModel(model: GeneratedModel): GeneratedModel {
        return {
            nodes: model.nodes.map(node => ({
                id: node.id,
                x: node.x,
                y: node.y,
                z: node.z,
                isSupport: node.isSupport || (Math.abs(node.y) < 0.01)
            })),
            members: model.members.map(member => ({
                id: member.id,
                s: member.s,
                e: member.e,
                section: member.section || 'ISMB300'
            }))
        };
    }

    /**
     * Validate the generated model
     */
    private static validateModel(model: GeneratedModel): { valid: boolean; issues: string[] } {
        const issues: string[] = [];

        if (!model.nodes || !Array.isArray(model.nodes)) {
            issues.push('Missing or invalid nodes array');
        }

        if (!model.members || !Array.isArray(model.members)) {
            issues.push('Missing or invalid members array');
        }

        if (model.nodes && model.members) {
            const nodeIds = new Set(model.nodes.map(n => n.id));

            for (const member of model.members) {
                if (!nodeIds.has(member.s)) {
                    issues.push(`Member ${member.id} references invalid start node: ${member.s}`);
                }
                if (!nodeIds.has(member.e)) {
                    issues.push(`Member ${member.id} references invalid end node: ${member.e}`);
                }
            }
        }

        return { valid: issues.length === 0, issues };
    }

    /**
     * Fallback generation when no API key is available
     */
    private static async generateFallback(prompt: string): Promise<GenerationResult> {
        const lowerPrompt = prompt.toLowerCase();

        // Portal frame / warehouse
        if (lowerPrompt.includes('portal') || lowerPrompt.includes('warehouse') || lowerPrompt.includes('shed')) {
            return {
                success: true,
                model: {
                    nodes: [
                        { id: "n1", x: 0, y: 0, z: 0, isSupport: true },
                        { id: "n2", x: 0, y: 6, z: 0 },
                        { id: "n3", x: 10, y: 8, z: 0 },
                        { id: "n4", x: 20, y: 6, z: 0 },
                        { id: "n5", x: 20, y: 0, z: 0, isSupport: true }
                    ],
                    members: [
                        { id: "m1", s: "n1", e: "n2", section: "ISMB400" },
                        { id: "m2", s: "n2", e: "n3", section: "ISMB300" },
                        { id: "m3", s: "n3", e: "n4", section: "ISMB300" },
                        { id: "m4", s: "n4", e: "n5", section: "ISMB400" }
                    ]
                }
            };
        }

        // Truss
        if (lowerPrompt.includes('truss')) {
            return {
                success: true,
                model: {
                    nodes: [
                        { id: "n1", x: 0, y: 0, z: 0, isSupport: true },
                        { id: "n2", x: 3, y: 0, z: 0 },
                        { id: "n3", x: 6, y: 0, z: 0 },
                        { id: "n4", x: 9, y: 0, z: 0 },
                        { id: "n5", x: 12, y: 0, z: 0, isSupport: true },
                        { id: "n6", x: 3, y: 2.5, z: 0 },
                        { id: "n7", x: 6, y: 3.5, z: 0 },
                        { id: "n8", x: 9, y: 2.5, z: 0 }
                    ],
                    members: [
                        // Bottom chord
                        { id: "m1", s: "n1", e: "n2", section: "ISA100x100x10" },
                        { id: "m2", s: "n2", e: "n3", section: "ISA100x100x10" },
                        { id: "m3", s: "n3", e: "n4", section: "ISA100x100x10" },
                        { id: "m4", s: "n4", e: "n5", section: "ISA100x100x10" },
                        // Top chord
                        { id: "m5", s: "n1", e: "n6", section: "ISA100x100x10" },
                        { id: "m6", s: "n6", e: "n7", section: "ISA100x100x10" },
                        { id: "m7", s: "n7", e: "n8", section: "ISA100x100x10" },
                        { id: "m8", s: "n8", e: "n5", section: "ISA100x100x10" },
                        // Verticals
                        { id: "m9", s: "n2", e: "n6", section: "ISA75x75x8" },
                        { id: "m10", s: "n3", e: "n7", section: "ISA75x75x8" },
                        { id: "m11", s: "n4", e: "n8", section: "ISA75x75x8" }
                    ]
                }
            };
        }

        // Multi-story frame
        if (lowerPrompt.includes('story') || lowerPrompt.includes('storey') || lowerPrompt.includes('building') || lowerPrompt.includes('frame')) {
            return {
                success: true,
                model: {
                    nodes: [
                        // Ground floor
                        { id: "n1", x: 0, y: 0, z: 0, isSupport: true },
                        { id: "n2", x: 6, y: 0, z: 0, isSupport: true },
                        { id: "n3", x: 12, y: 0, z: 0, isSupport: true },
                        // Floor 1
                        { id: "n4", x: 0, y: 3.5, z: 0 },
                        { id: "n5", x: 6, y: 3.5, z: 0 },
                        { id: "n6", x: 12, y: 3.5, z: 0 },
                        // Floor 2
                        { id: "n7", x: 0, y: 7, z: 0 },
                        { id: "n8", x: 6, y: 7, z: 0 },
                        { id: "n9", x: 12, y: 7, z: 0 }
                    ],
                    members: [
                        // Columns
                        { id: "m1", s: "n1", e: "n4", section: "ISMB400" },
                        { id: "m2", s: "n2", e: "n5", section: "ISMB400" },
                        { id: "m3", s: "n3", e: "n6", section: "ISMB400" },
                        { id: "m4", s: "n4", e: "n7", section: "ISMB350" },
                        { id: "m5", s: "n5", e: "n8", section: "ISMB350" },
                        { id: "m6", s: "n6", e: "n9", section: "ISMB350" },
                        // Beams Floor 1
                        { id: "m7", s: "n4", e: "n5", section: "ISMB350" },
                        { id: "m8", s: "n5", e: "n6", section: "ISMB350" },
                        // Beams Floor 2
                        { id: "m9", s: "n7", e: "n8", section: "ISMB300" },
                        { id: "m10", s: "n8", e: "n9", section: "ISMB300" }
                    ]
                }
            };
        }

        // Default: Simple beam
        return {
            success: true,
            model: {
                nodes: [
                    { id: "n1", x: 0, y: 0, z: 0, isSupport: true },
                    { id: "n2", x: 3, y: 0, z: 0 },
                    { id: "n3", x: 6, y: 0, z: 0, isSupport: true }
                ],
                members: [
                    { id: "m1", s: "n1", e: "n2", section: "ISMB300" },
                    { id: "m2", s: "n2", e: "n3", section: "ISMB300" }
                ]
            }
        };
    }
}

export default AIArchitectService;
