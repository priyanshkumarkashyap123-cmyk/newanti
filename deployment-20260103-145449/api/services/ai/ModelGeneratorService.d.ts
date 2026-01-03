/**
 * ModelGeneratorService - AI-Powered Structural Model Generation
 *
 * Uses LLM to generate structural models from natural language prompts.
 * Outputs valid JSON conforming to BeamLab schema.
 */
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
export declare class ModelGeneratorService {
    private openai;
    private model;
    constructor();
    /**
     * Generate a structural model from a natural language prompt
     */
    generate(request: GenerationRequest): Promise<GenerationResult>;
    /**
     * Parse and validate the JSON response
     */
    private parseAndValidate;
    /**
     * Demo generation without API (for testing/fallback)
     */
    private generateDemo;
    /**
     * Validate that a model is structurally sound
     */
    validateModel(model: GeneratedModel): {
        valid: boolean;
        issues: string[];
    };
}
export declare const modelGeneratorService: ModelGeneratorService;
export default modelGeneratorService;
//# sourceMappingURL=ModelGeneratorService.d.ts.map