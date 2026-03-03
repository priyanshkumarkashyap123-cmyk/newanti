/**
 * BeamLabAIEngine.ts
 *
 * Our OWN AI engine — no external API calls.
 * Designed to match and exceed Gemini for structural engineering tasks.
 *
 * Capabilities:
 *  - Deep structural engineering Q&A (200+ topics)
 *  - Model-aware contextual answers (reads Zustand store)
 *  - Design code references (IS 800, IS 456, AISC 360, Eurocode 3)
 *  - Calculation assistance (formulas with actual values)
 *  - Smart suggestions based on current model state
 *  - Conversational context tracking
 *  - Structural diagnosis and recommendations
 */

import { useModelStore } from "../../store/model";

// Re-export shared types for consumers
export type {
  BeamLabAIResponse,
  ResponseCategory,
  CalculationStep,
  TopicHandler,
} from "./aiEngineTypes";

import type {
  BeamLabAIResponse,
  ResponseCategory,
  CalculationStep,
  TopicHandler,
  AIHandlerContext,
} from "./aiEngineTypes";

// Handler module registrations
import { registerModelHandlers } from "./modelHandlers";
import { registerSectionMaterialHandlers } from "./sectionMaterialHandlers";
import { registerFormulaHandlers } from "./formulaHandlers";
import { registerDesignCodeHandlers } from "./designCodeHandlers";
import { registerConceptHandlers } from "./conceptHandlers";
import { registerUtilityHandlers } from "./utilityHandlers";
import type { UtilityHandlerDeps } from "./utilityHandlers";

// ============================================
// CORE ENGINE
// ============================================

class BeamLabAIEngine {
  private conversationHistory: { role: "user" | "ai"; text: string }[] = [];
  private topicHandlers: TopicHandler[] = [];
  private genericFallback!: (input: string) => BeamLabAIResponse;

  constructor() {
    this.registerAllHandlers();
  }

  private registerAllHandlers(): void {
    const ctx: AIHandlerContext = {
      buildResponse: this.buildResponse.bind(this),
      getStore: this.getStore.bind(this),
    };

    // Collect concept and formula handlers — needed by utility deps
    const conceptHandlers = registerConceptHandlers(ctx);
    const formulaHandlers = registerFormulaHandlers(ctx);
    const designCodeHandlers = registerDesignCodeHandlers(ctx);

    // Helper: invoke a handler from an array by calling its handler fn
    const callFirst = (
      handlers: TopicHandler[],
      input: string,
    ): BeamLabAIResponse => {
      for (const h of handlers) {
        const m = input.toLowerCase().match(h.pattern);
        if (m) return h.handler(input, m);
      }
      return this.buildResponse("", "general", 0.3);
    };

    // Build cross-handler deps for the generic fallback
    const deps: UtilityHandlerDeps = {
      handleSSBeam: () => callFirst(conceptHandlers, "simply supported beam"),
      handleBucklingHelp: (input: string) =>
        callFirst(formulaHandlers, input.includes("buckl") ? input : "buckling"),
      handleDeflectionHelp: (input: string) =>
        callFirst(formulaHandlers, input.includes("deflect") ? input : "deflection formula"),
      handleMomentCapacity: (input: string) =>
        callFirst(formulaHandlers, input.includes("moment") ? input : "moment capacity"),
      handleShearCapacity: (input: string) =>
        callFirst(formulaHandlers, input.includes("shear") ? input : "shear capacity"),
      handleConnections: () => callFirst(conceptHandlers, "connection design"),
      handleFoundations: () => callFirst(conceptHandlers, "foundation"),
      handleIS800: () => callFirst(designCodeHandlers, "is 800"),
      handleWindLoad: () => callFirst(conceptHandlers, "wind load"),
      handleSeismicLoad: () => callFirst(conceptHandlers, "seismic"),
      handleOptimization: () => callFirst(conceptHandlers, "optimize model"),
      handleAnalysisGuide: () => callFirst(designCodeHandlers, "how to analyse"),
    };

    const { handlers: utilityHandlers, handleGenericQuestion } =
      registerUtilityHandlers(ctx, deps);

    this.genericFallback = handleGenericQuestion;

    // Assemble all handlers in priority order
    this.topicHandlers = [
      ...registerModelHandlers(ctx),
      ...registerSectionMaterialHandlers(ctx),
      ...formulaHandlers,
      ...designCodeHandlers,
      ...conceptHandlers,
      ...utilityHandlers,
    ];
  }

  // ============================================
  // MAIN ENTRY — Process a chat message
  // ============================================

  async processChat(message: string): Promise<BeamLabAIResponse> {
    const startTime = performance.now();
    const lower = message.toLowerCase().trim();

    // Track history
    this.conversationHistory.push({ role: "user", text: message });

    // Try topic handlers in order
    for (const handler of this.topicHandlers) {
      const match = lower.match(handler.pattern);
      if (match) {
        const response = handler.handler(message, match);
        response.latencyMs = performance.now() - startTime;
        this.conversationHistory.push({ role: "ai", text: response.text });
        return response;
      }
    }

    // Fallback: If it's a question, try harder
    if (
      lower.endsWith("?") ||
      /^(what|how|why|when|where|which|can|does|is|are|do|should|would|could)\b/.test(
        lower,
      )
    ) {
      const response = this.genericFallback(message);
      response.latencyMs = performance.now() - startTime;
      this.conversationHistory.push({ role: "ai", text: response.text });
      return response;
    }

    // Ultimate fallback
    const fallback = this.buildResponse(
      `I understand you're asking about "${message}". Here's what I can help with:\n\n` +
        `**Structural Engineering:**\n` +
        `• Beam/column/truss design — "Explain Pratt truss", "How to design a beam?"\n` +
        `• Formulas — "Formula for deflection", "Euler buckling formula"\n` +
        `• Materials — "ISMB300 properties", "E250 steel properties"\n` +
        `• Design codes — "IS 800", "AISC 360", "Eurocode 3"\n\n` +
        `**Your Model:**\n` +
        `• "Tell me about my model" / "How many nodes?"\n` +
        `• "Is the model stable?" / "What sections are used?"\n` +
        `• "Recommend a section" / "Why is analysis failing?"\n\n` +
        `**Commands:**\n` +
        `• "Select N1", "Apply UDL on M1", "Show reactions"\n` +
        `• Type "help" for the full command list.`,
      "general",
      0.3,
    );
    fallback.latencyMs = performance.now() - startTime;
    return fallback;
  }

  // ============================================
  // HELPER — Build response
  // ============================================

  private buildResponse(
    text: string,
    category: ResponseCategory,
    confidence: number,
    suggestions?: string[],
    calculations?: CalculationStep[],
  ): BeamLabAIResponse {
    return {
      text,
      source: "beamlab-ai",
      confidence,
      latencyMs: 0,
      category,
      suggestions,
      calculations,
    };
  }

  private getStore() {
    return useModelStore.getState();
  }

  // ============================================
  // RESET
  // ============================================

  resetConversation(): void {
    this.conversationHistory = [];
  }
}

// Singleton export
export const beamLabAI = new BeamLabAIEngine();
export default beamLabAI;
