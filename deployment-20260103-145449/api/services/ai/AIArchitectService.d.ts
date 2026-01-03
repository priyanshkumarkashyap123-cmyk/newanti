/**
 * AIArchitectService - Gemini-Powered Structural Model Generation
 *
 * Uses Google Gemini AI to generate structural models from natural language prompts.
 */
export interface GeneratedNode {
    id: string;
    x: number;
    y: number;
    z: number;
    isSupport?: boolean;
}
export interface GeneratedMember {
    id: string;
    s: string;
    e: string;
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
export declare class AIArchitectService {
    /**
     * Generate a structural model from natural language prompt
     */
    static generateStructure(userPrompt: string): Promise<GenerationResult>;
    /**
     * Normalize the model to ensure consistent field names
     */
    private static normalizeModel;
    /**
     * Validate the generated model
     */
    private static validateModel;
    /**
     * Fallback generation when no API key is available
     */
    private static generateFallback;
}
export default AIArchitectService;
//# sourceMappingURL=AIArchitectService.d.ts.map