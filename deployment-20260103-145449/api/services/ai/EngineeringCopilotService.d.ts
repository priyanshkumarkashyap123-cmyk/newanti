/**
 * EngineeringCopilotService - AI Assistant for Structural Engineering
 *
 * Provides intelligent suggestions for fixing failed structural members
 * based on IS 800, AISC 360, and other design codes.
 */
export interface FailedMemberData {
    memberId: string;
    memberType: 'beam' | 'column' | 'brace' | 'truss';
    utilizationRatio: number;
    failureMode: FailureMode;
    section: SectionData;
    geometry: GeometryData;
    loading: LoadingData;
}
export type FailureMode = 'compression_buckling' | 'lateral_torsional_buckling' | 'tension_yielding' | 'shear_failure' | 'combined_stress' | 'deflection_exceeded' | 'slenderness_exceeded';
export interface SectionData {
    name: string;
    area: number;
    momentOfInertia: number;
    sectionModulus: number;
    radiusOfGyration: number;
    flangeWidth: number;
    webThickness: number;
}
export interface GeometryData {
    length: number;
    effectiveLength: number;
    unsupportedLength: number;
    endConditions: 'fixed-fixed' | 'fixed-pinned' | 'pinned-pinned' | 'cantilever';
}
export interface LoadingData {
    axialForce: number;
    shearForce: number;
    bendingMoment: number;
    loadCombination: string;
}
export interface AIFixSuggestion {
    id: number;
    title: string;
    description: string;
    implementation: string;
    tradeoffs: {
        pros: string[];
        cons: string[];
    };
    estimatedImprovement: string;
    priority: 'high' | 'medium' | 'low';
}
export interface CopilotResponse {
    analysis: string;
    suggestions: AIFixSuggestion[];
    additionalNotes: string;
    designCodeReference: string;
}
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    memberContext?: FailedMemberData;
}
export declare class EngineeringCopilotService {
    private conversationHistory;
    private designCode;
    constructor(designCode?: 'is800' | 'aisc360' | 'general');
    /**
     * Analyze a failed member and generate fix suggestions
     */
    analyzeFailedMember(memberData: FailedMemberData): Promise<CopilotResponse>;
    /**
     * Construct the analysis prompt for the AI
     */
    private constructAnalysisPrompt;
    /**
     * Generate AI response (mock implementation)
     * Replace with actual AI API call (OpenAI, Claude, etc.)
     */
    private generateAIResponse;
    /**
     * Get fix suggestions based on failure mode
     */
    private getFixSuggestions;
    /**
     * Get analysis text based on failure mode
     */
    private getAnalysisText;
    /**
     * Get failure mode description
     */
    private getFailureModeDescription;
    /**
     * Suggest a larger section based on current section
     */
    private suggestLargerSection;
    /**
     * Suggest section with wider flanges
     */
    private suggestWiderFlangeSection;
    /**
     * Suggest deeper section
     */
    private suggestDeeperSection;
    /**
     * Get additional notes
     */
    private getAdditionalNotes;
    /**
     * Get code reference for failure mode
     */
    private getCodeReference;
    /**
     * Generate unique ID
     */
    private generateId;
    /**
     * Get conversation history
     */
    getHistory(): ChatMessage[];
    /**
     * Clear conversation history
     */
    clearHistory(): void;
    /**
     * Get system prompt for the current design code
     */
    getSystemPrompt(): string;
    /**
     * Set design code
     */
    setDesignCode(code: 'is800' | 'aisc360' | 'general'): void;
}
export declare const engineeringCopilot: EngineeringCopilotService;
export default EngineeringCopilotService;
//# sourceMappingURL=EngineeringCopilotService.d.ts.map