/**
 * AIOrchestrator.ts
 *
 * Unified AI Orchestrator that runs BOTH:
 *  1. Gemini (external LLM) — rich conversational answers
 *  2. BeamLabAI (local engine) — instant, offline, model-aware
 *
 * Strategy:
 *  - Action commands → Local interpreter/executor (instant)
 *  - Knowledge/chat → Race both engines in parallel, pick best
 *  - If Gemini fails (rate limit / offline) → BeamLabAI answers
 *  - If BeamLabAI low confidence → wait for Gemini
 *  - Source attribution on every response
 */

import { geminiClient, GeminiResponse } from "./GeminiClientService";
import { beamLabAI, BeamLabAIResponse } from "./BeamLabAIEngine";
import {
  interpretCommand,
  isActionCommand,
  ParsedCommand,
} from "./AICommandInterpreter";
import { executeCommand, ExecutionResult } from "./AIModelExecutor";

// ============================================
// TYPES
// ============================================

export interface OrchestratedResponse {
  /** Final text shown to the user */
  text: string;
  /** Which engine provided the answer */
  source: "local-command" | "beamlab-ai" | "gemini" | "combined" | "fallback";
  /** How confident (0-1) we are in the answer */
  confidence: number;
  /** Response time in ms */
  latencyMs: number;
  /** Did a command execute? */
  commandExecuted?: boolean;
  /** Parsed command (if action) */
  parsedCommand?: ParsedCommand;
  /** Execution result (if action) */
  executionResult?: ExecutionResult;
  /** Suggestions for follow-up */
  suggestions?: string[];
  /** Gemini response (if fetched) */
  geminiResponse?: GeminiResponse;
  /** BeamLabAI response (if fetched) */
  localResponse?: BeamLabAIResponse;
  /** Was Gemini available? */
  geminiAvailable: boolean;
}

export interface OrchestratorConfig {
  /** Prefer Gemini for conversational answers? (default: true when configured) */
  preferGemini: boolean;
  /** Timeout for Gemini (ms) before falling back to local */
  geminiTimeout: number;
  /** Minimum local confidence to show without waiting for Gemini */
  localConfidenceThreshold: number;
  /** Show source attribution in responses */
  showSourceAttribution: boolean;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  preferGemini: true,
  geminiTimeout: 10000,
  localConfidenceThreshold: 0.8,
  showSourceAttribution: true,
};

// ============================================
// ORCHESTRATOR
// ============================================

class AIOrchestrator {
  private config: OrchestratorConfig;

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  updateConfig(partial: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }

  get isGeminiConfigured(): boolean {
    return geminiClient.isConfigured;
  }

  configureGemini(apiKey: string): void {
    geminiClient.configure(apiKey);
  }

  removeGemini(): void {
    geminiClient.removeApiKey();
  }

  getGeminiApiKey(): string {
    return geminiClient.getApiKey();
  }

  // ============================================
  // MAIN ENTRY — Process user message
  // ============================================

  async processMessage(message: string): Promise<OrchestratedResponse> {
    const startTime = performance.now();
    const trimmed = message.trim();

    // =============================================
    // STEP 1: Check if it's an ACTION command
    // =============================================
    if (isActionCommand(trimmed)) {
      const parsed = interpretCommand(trimmed);

      if (parsed.action !== "unknown" && parsed.confidence >= 0.4) {
        // Execute immediately — no need for LLM calls
        const result = executeCommand(parsed);

        return {
          text: result.message,
          source: "local-command",
          confidence: parsed.confidence,
          latencyMs: performance.now() - startTime,
          commandExecuted: true,
          parsedCommand: parsed,
          executionResult: result,
          geminiAvailable: geminiClient.isConfigured,
        };
      }
    }

    // =============================================
    // STEP 2: Knowledge/Chat — Run BOTH engines in parallel
    // =============================================
    const geminiAvailable =
      geminiClient.isConfigured && this.config.preferGemini;

    // Launch both simultaneously
    const localPromise = beamLabAI.processChat(trimmed);
    const geminiPromise = geminiAvailable
      ? this.geminiWithTimeout(trimmed)
      : Promise.resolve(null);

    // Wait for local first (instant)
    const localResult = await localPromise;

    // If local is very confident, return immediately
    if (
      localResult.confidence >= this.config.localConfidenceThreshold &&
      !geminiAvailable
    ) {
      return this.formatLocalResponse(localResult, startTime);
    }

    // Wait for Gemini (or timeout)
    const geminiResult = await geminiPromise;

    // =============================================
    // STEP 3: Pick the best response
    // =============================================
    return this.pickBestResponse(localResult, geminiResult, startTime);
  }

  // ============================================
  // GEMINI WITH TIMEOUT
  // ============================================

  private async geminiWithTimeout(
    message: string,
  ): Promise<GeminiResponse | null> {
    try {
      const result = await Promise.race([
        geminiClient.chat(message),
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), this.config.geminiTimeout),
        ),
      ]);
      return result;
    } catch (err) {
      console.warn("[AIOrchestrator] Gemini error:", err);
      return null;
    }
  }

  // ============================================
  // RESPONSE SELECTION LOGIC
  // ============================================

  private pickBestResponse(
    local: BeamLabAIResponse,
    gemini: GeminiResponse | null,
    startTime: number,
  ): OrchestratedResponse {
    const latencyMs = performance.now() - startTime;
    const geminiOk = gemini?.success && gemini.text?.trim();

    // Case 1: Gemini succeeded and local is low-confidence → use Gemini
    if (geminiOk && local.confidence < 0.7) {
      return {
        text: this.maybeAttribuate(gemini!.text, "gemini"),
        source: "gemini",
        confidence: 0.9,
        latencyMs,
        suggestions: local.suggestions,
        geminiResponse: gemini!,
        localResponse: local,
        geminiAvailable: true,
      };
    }

    // Case 2: Both succeeded — Gemini for rich answers, local for model queries
    if (geminiOk && local.confidence >= 0.7) {
      // For model_query / diagnosis / recommendation, prefer local (more accurate)
      if (
        ["model_query", "diagnosis", "recommendation", "section_info"].includes(
          local.category,
        )
      ) {
        return {
          text: this.maybeAttribuate(local.text, "beamlab-ai"),
          source: "beamlab-ai",
          confidence: local.confidence,
          latencyMs,
          suggestions: local.suggestions,
          geminiResponse: gemini!,
          localResponse: local,
          geminiAvailable: true,
        };
      }
      // For engineering knowledge, prefer Gemini (richer, more nuanced)
      return {
        text: this.maybeAttribuate(gemini!.text, "gemini"),
        source: "gemini",
        confidence: 0.9,
        latencyMs,
        suggestions: local.suggestions,
        geminiResponse: gemini!,
        localResponse: local,
        geminiAvailable: true,
      };
    }

    // Case 3: Gemini failed — use local
    return this.formatLocalResponse(local, startTime);
  }

  // ============================================
  // FORMAT HELPERS
  // ============================================

  private formatLocalResponse(
    local: BeamLabAIResponse,
    startTime: number,
  ): OrchestratedResponse {
    return {
      text: this.maybeAttribuate(local.text, "beamlab-ai"),
      source: "beamlab-ai",
      confidence: local.confidence,
      latencyMs: performance.now() - startTime,
      suggestions: local.suggestions,
      localResponse: local,
      geminiAvailable: geminiClient.isConfigured,
    };
  }

  private maybeAttribuate(
    text: string,
    source: "gemini" | "beamlab-ai",
  ): string {
    if (!this.config.showSourceAttribution) return text;

    const badge =
      source === "gemini"
        ? "\n\n_— Powered by Gemini AI_"
        : "\n\n_— BeamLab AI_";
    return text + badge;
  }

  // ============================================
  // SPECIALIZED METHODS
  // ============================================

  /** Send a question specifically about the current model — always uses both engines */
  async analyzeModel(question: string): Promise<OrchestratedResponse> {
    const startTime = performance.now();

    // Local always answers model questions well
    const localPromise = beamLabAI.processChat(question);
    const geminiPromise = geminiClient.isConfigured
      ? geminiClient.analyzeStructure(question)
      : Promise.resolve(null);

    const [local, gemini] = await Promise.all([localPromise, geminiPromise]);

    // For model analysis, combine both if Gemini succeeded
    if (gemini?.success && gemini.text) {
      const combined = `${local.text}\n\n---\n\n**Gemini Analysis:**\n${gemini.text}`;
      return {
        text: combined,
        source: "combined",
        confidence: 0.95,
        latencyMs: performance.now() - startTime,
        suggestions: local.suggestions,
        geminiResponse: gemini,
        localResponse: local,
        geminiAvailable: true,
      };
    }

    return this.formatLocalResponse(local, startTime);
  }

  /** Just run local engine (for when Gemini is not wanted) */
  async processLocal(message: string): Promise<OrchestratedResponse> {
    const startTime = performance.now();
    const local = await beamLabAI.processChat(message);
    return this.formatLocalResponse(local, startTime);
  }

  /** Just run Gemini (for when local is not wanted) */
  async processGemini(message: string): Promise<OrchestratedResponse> {
    if (!geminiClient.isConfigured) {
      return {
        text: "⚠ Gemini API not configured. Add your API key in the settings panel.",
        source: "fallback",
        confidence: 0,
        latencyMs: 0,
        geminiAvailable: false,
      };
    }

    const startTime = performance.now();
    const result = await geminiClient.chat(message);

    return {
      text: result.success ? result.text : `Gemini error: ${result.error}`,
      source: "gemini",
      confidence: result.success ? 0.9 : 0,
      latencyMs: performance.now() - startTime,
      geminiResponse: result,
      geminiAvailable: true,
    };
  }

  // ============================================
  // RESET
  // ============================================

  resetConversation(): void {
    beamLabAI.resetConversation();
    geminiClient.resetChat();
  }
}

// ============================================
// SINGLETON
// ============================================

export const aiOrchestrator = new AIOrchestrator();
export default aiOrchestrator;
