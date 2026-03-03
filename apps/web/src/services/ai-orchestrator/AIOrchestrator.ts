/**
 * ============================================================================
 * AI ORCHESTRATOR - CENTRAL COMMAND
 * ============================================================================
 * 
 * The unified AI orchestrator that handles ALL possible scenarios for
 * the BeamLab AI system. This is the single entry point for all AI
 * operations, replacing fragmented direct calls to individual providers.
 * 
 * Architecture:
 * ┌──────────────────────────────────────────────────┐
 * │                 AI ORCHESTRATOR                    │
 * │                                                    │
 * │  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
 * │  │ Prompt    │  │ Rate     │  │ Token Budget  │   │
 * │  │ Safety    │→ │ Limiter  │→ │ Check         │   │
 * │  └──────────┘  └──────────┘  └───────────────┘   │
 * │       │                            │              │
 * │       ▼                            ▼              │
 * │  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
 * │  │ Cache    │  │ Provider │  │ Circuit       │   │
 * │  │ Lookup   │→ │ Router   │→ │ Breaker       │   │
 * │  └──────────┘  └──────────┘  └───────────────┘   │
 * │       │                            │              │
 * │       ▼                            ▼              │
 * │  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
 * │  │ Retry    │  │ Response │  │ Enhanced      │   │
 * │  │ Handler  │→ │ Normaliz │→ │ Guardrails    │   │
 * │  └──────────┘  └──────────┘  └───────────────┘   │
 * │       │                            │              │
 * │       ▼                            ▼              │
 * │  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
 * │  │ Error    │  │ Audit    │  │ Response      │   │
 * │  │ Recovery │→ │ Trail    │→ │ Delivered     │   │
 * │  └──────────┘  └──────────┘  └───────────────┘   │
 * └──────────────────────────────────────────────────┘
 * 
 * @version 3.0.0
 */

import { logger } from '../../lib/logging/logger';
import type {
  AIProviderType,
  AIProviderConfig,
  AIRequest,
  AIResponse,
  AIRequestType,
  AICapability,
  AIContext,
  AIMessage,
  TokenUsage,
  AIEvent,
  AIEventListener,
  AIEventType,
  NormalizedStructureData,
  GuardrailSummary,
  FallbackStep,
} from './types';

import {
  AIEventBus,
  CircuitBreaker,
  RetryHandler,
  RateLimiter,
  TokenBudgetManager,
  RequestDeduplicator,
  ResponseCache,
} from './ResilienceLayer';

import { SchemaNormalizer, schemaNormalizer } from './SchemaNormalizer';
import { EnhancedAIGuardrails, enhancedGuardrails } from './EnhancedGuardrails';
import { StreamingResponseHandler, createStreamingState } from './StreamingHandler';
import { SecureAIProxy, secureProxy } from './SecureAIProxy';
import { PersistentAuditTrail, persistentAuditTrail } from './PersistentAuditTrail';
import { AIErrorRecoveryEngine, AIErrorClassifier, type ClassifiedError } from './ErrorRecovery';
import { AutonomousDesignEngine, autonomousDesignEngine, type DesignRequest, type DesignResult, type DesignCheck } from './AutonomousDesignEngine';
import { SectionOptimizer, type OptimizationConfig, type OptimizationResult } from './SectionOptimizer';
import { SectionLookup } from './SectionLookup';
import { AutoLoadGenerator, type ProjectLoadConfig } from './AutoLoadGenerator';

// ============================================================================
// ORCHESTRATOR CONFIGURATION
// ============================================================================

export interface OrchestratorConfig {
  /** Provider fallback order */
  providerPriority: AIProviderType[];

  /** Provider configurations */
  providers: Partial<Record<AIProviderType, AIProviderConfig>>;

  /** Enable/disable features */
  features: {
    caching: boolean;
    rateLimiting: boolean;
    tokenBudget: boolean;
    guardrails: boolean;
    auditTrail: boolean;
    streaming: boolean;
    promptSafety: boolean;
    errorRecovery: boolean;
    deduplication: boolean;
  };

  /** API proxy base URL */
  apiBaseUrl: string;

  /** Default request timeout (ms) */
  defaultTimeout: number;

  /** Max conversation history to send */
  maxHistoryLength: number;

  /** Whether to notify user of degraded mode */
  notifyOnDegradedMode: boolean;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  providerPriority: ['gemini', 'openai', 'anthropic', 'local', 'mock'],
  providers: {
    gemini: {
      type: 'gemini',
      model: 'gemini-2.0-flash',
      maxTokens: 8192,
      temperature: 0.7,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      priority: 1,
      costPerInputToken: 0.000000075,  // $0.075 per 1M input tokens
      costPerOutputToken: 0.0000003,   // $0.30 per 1M output tokens
      capabilities: ['chat', 'structure-generation', 'vision', 'analysis', 'code-compliance', 'streaming'],
    },
    openai: {
      type: 'openai',
      model: 'gpt-4-turbo',
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 60000,
      retryAttempts: 2,
      retryDelay: 2000,
      priority: 2,
      costPerInputToken: 0.00001,
      costPerOutputToken: 0.00003,
      capabilities: ['chat', 'structure-generation', 'code-generation', 'function-calling', 'streaming'],
    },
    local: {
      type: 'local',
      model: 'rule-engine-v2',
      maxTokens: 0,
      temperature: 0,
      timeout: 5000,
      retryAttempts: 1,
      retryDelay: 0,
      priority: 10,
      costPerInputToken: 0,
      costPerOutputToken: 0,
      capabilities: ['chat', 'structure-generation', 'explanation'],
    },
    mock: {
      type: 'mock',
      model: 'mock-v1',
      maxTokens: 0,
      temperature: 0,
      timeout: 1000,
      retryAttempts: 0,
      retryDelay: 0,
      priority: 99,
      costPerInputToken: 0,
      costPerOutputToken: 0,
      capabilities: ['chat', 'structure-generation'],
    },
  },
  features: {
    caching: true,
    rateLimiting: true,
    tokenBudget: true,
    guardrails: true,
    auditTrail: true,
    streaming: true,
    promptSafety: true,
    errorRecovery: true,
    deduplication: true,
  },
  apiBaseUrl: '/api/ai',
  defaultTimeout: 30000,
  maxHistoryLength: 10,
  notifyOnDegradedMode: true,
};

// ============================================================================
// AI ORCHESTRATOR
// ============================================================================

export class AIOrchestrator {
  private config: OrchestratorConfig;
  private eventBus: AIEventBus;
  private circuitBreaker: CircuitBreaker;
  private retryHandler: RetryHandler;
  private rateLimiter: RateLimiter;
  private tokenBudget: TokenBudgetManager;
  private deduplicator: RequestDeduplicator;
  private cache: ResponseCache;
  private guardrails: EnhancedAIGuardrails;
  private streamingHandler: StreamingResponseHandler;
  private proxy: SecureAIProxy;
  private auditTrail: PersistentAuditTrail;
  private errorRecovery: AIErrorRecoveryEngine;
  private designEngine: AutonomousDesignEngine;
  private conversationHistory: AIMessage[] = [];
  private sessionId: string;

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Initialize all subsystems
    this.eventBus = new AIEventBus();
    this.circuitBreaker = new CircuitBreaker(this.eventBus);
    this.retryHandler = new RetryHandler({ maxAttempts: 3 });
    this.rateLimiter = new RateLimiter(this.eventBus);
    this.tokenBudget = new TokenBudgetManager(this.eventBus);
    this.deduplicator = new RequestDeduplicator();
    this.cache = new ResponseCache(this.eventBus);
    this.guardrails = new EnhancedAIGuardrails();
    this.streamingHandler = new StreamingResponseHandler(this.eventBus);
    this.proxy = new SecureAIProxy({ baseUrl: this.config.apiBaseUrl, sessionId: this.sessionId });
    this.auditTrail = new PersistentAuditTrail();
    this.errorRecovery = new AIErrorRecoveryEngine(this.eventBus);
    this.designEngine = new AutonomousDesignEngine();
  }

  // ============================================================================
  // MAIN API - The primary interface for all AI operations
  // ============================================================================

  /**
   * Process any AI request through the full pipeline
   */
  async process(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const requestId = request.id || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    request.id = requestId;

    this.eventBus.emit({
      type: 'request-started',
      timestamp: new Date(),
      data: { requestId, type: request.type, provider: request.preferredProvider },
    });

    try {
      // ── STEP 1: Prompt Safety Check ──
      if (this.config.features.promptSafety) {
        const safetyResult = this.guardrails.checkPromptSafety(request.prompt);
        if (!safetyResult.safe) {
          logger.warn(`[Orchestrator] Prompt safety issues: ${safetyResult.threats.join(', ')}`);
          request.prompt = safetyResult.sanitizedPrompt;
        }
      }

      // ── STEP 2: Rate Limit Check ──
      let releaseRateLimit: (() => void) | null = null;
      if (this.config.features.rateLimiting) {
        try {
          releaseRateLimit = await this.rateLimiter.acquire(10000);
        } catch {
          return this.createErrorResponse(requestId, request, 'Rate limit exceeded. Please try again shortly.', 'rate-limited');
        }
      }

      try {
        // ── STEP 3: Token Budget Check ──
        if (this.config.features.tokenBudget) {
          const estimatedTokens = TokenBudgetManager.estimateTokens(request.prompt);
          const budgetCheck = this.tokenBudget.canAfford(estimatedTokens);
          if (!budgetCheck.allowed) {
            // Try with local AI instead
            logger.warn(`[Orchestrator] Budget exceeded: ${budgetCheck.reason}`);
            request.preferredProvider = 'local';
          }
        }

        // ── STEP 4: Cache Lookup ──
        if (this.config.features.caching && !request.streaming) {
          const provider = request.preferredProvider || this.config.providerPriority[0];
          const providerConfig = this.config.providers[provider];
          const cacheKey = ResponseCache.generateKey(request.prompt, provider, providerConfig?.model || '');
          const cached = this.cache.get(cacheKey);
          if (cached) {
            return {
              ...cached,
              id: `cached_${requestId}`,
              requestId,
              cached: true,
              latency: Date.now() - startTime,
              timestamp: new Date(),
            };
          }
        }

        // ── STEP 5: Deduplication ──
        if (this.config.features.deduplication) {
          const dedupeKey = `${request.type}:${request.prompt.slice(0, 200)}`;
          return await this.deduplicator.execute(dedupeKey, () =>
            this.executeWithFallback(request, startTime)
          );
        }

        // ── STEP 6: Execute with fallback chain ──
        return await this.executeWithFallback(request, startTime);

      } finally {
        releaseRateLimit?.();
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[Orchestrator] Unhandled error for ${requestId}`, { error: err.message });
      return this.createErrorResponse(requestId, request, err.message, 'unknown');
    }
  }

  // ============================================================================
  // CONVENIENCE METHODS
  // ============================================================================

  /**
   * Simple chat interface
   */
  async chat(message: string, context?: string): Promise<AIResponse> {
    this.conversationHistory.push({ role: 'user', content: message, timestamp: new Date() });

    const response = await this.process({
      id: '',
      type: 'chat',
      prompt: message,
      systemPrompt: this.getSystemPrompt('chat'),
      history: this.conversationHistory.slice(-this.config.maxHistoryLength),
      context: context ? { modelContext: undefined, sessionId: this.sessionId } : undefined,
    });

    if (response.success) {
      this.conversationHistory.push({ role: 'assistant', content: response.content, timestamp: new Date() });
    }

    return response;
  }

  /**
   * Generate a structural model
   */
  async generateStructure(
    prompt: string,
    constraints?: Record<string, any>
  ): Promise<AIResponse & { structure?: NormalizedStructureData }> {
    const response = await this.process({
      id: '',
      type: 'structure-generation',
      prompt,
      systemPrompt: this.getSystemPrompt('structure-generation'),
      constraints,
      requiredCapabilities: ['structure-generation'],
    });

    // If response has structured data, validate it
    if (response.success && response.structuredData?.type === 'structure') {
      const structure = response.structuredData.data as NormalizedStructureData;

      if (this.config.features.guardrails) {
        const guardrailResult = this.guardrails.validateStructureOutput(structure);
        response.guardrailResults = guardrailResult;

        if (!guardrailResult.passed) {
          response.warnings.push(
            ...guardrailResult.failures.map(f => `⚠️ ${f.message}`),
            ...guardrailResult.warnings.map(w => `ℹ️ ${w.message}`)
          );
        }
      }

      return { ...response, structure };
    }

    return response;
  }

  /**
   * Run design code compliance check
   */
  async checkCompliance(
    member: Record<string, any>,
    forces: Record<string, any>,
    code?: string
  ): Promise<AIResponse> {
    return this.process({
      id: '',
      type: 'code-compliance',
      prompt: `Check ${code || 'IS_800'} compliance for member: ${JSON.stringify(member)} under forces: ${JSON.stringify(forces)}`,
      requiredCapabilities: ['code-compliance'],
      metadata: { member, forces, code },
    });
  }

  /**
   * Get AI explanation of engineering concept
   */
  async explain(topic: string): Promise<AIResponse> {
    return this.process({
      id: '',
      type: 'explanation',
      prompt: topic,
      systemPrompt: this.getSystemPrompt('explanation'),
    });
  }

  /**
   * Diagnose model issues
   */
  async diagnoseModel(modelData: Record<string, any>): Promise<AIResponse> {
    return this.process({
      id: '',
      type: 'diagnosis',
      prompt: `Diagnose the following structural model for issues: ${JSON.stringify(modelData).slice(0, 5000)}`,
      metadata: { modelData },
    });
  }

  /**
   * Auto-fix model issues
   */
  async autoFix(modelData: Record<string, any>, issues: string[]): Promise<AIResponse> {
    return this.process({
      id: '',
      type: 'auto-fix',
      prompt: `Fix these issues in the model: ${issues.join('; ')}`,
      metadata: { modelData, issues },
    });
  }

  /**
   * Modify model via natural language
   */
  async modifyModel(modelData: Record<string, any>, instruction: string): Promise<AIResponse> {
    return this.process({
      id: '',
      type: 'modification',
      prompt: instruction,
      context: {
        modelContext: schemaNormalizer.normalizeStructure(modelData, 'local') as any,
        sessionId: this.sessionId,
      },
    });
  }

  // ============================================================================
  // AUTONOMOUS DESIGN - The "do the business himself" methods
  // ============================================================================

  /**
   * Autonomously design a complete structure from a natural language prompt.
   * Goes through: parse → generate → load → analyze → check → optimize → report
   * No external LLM needed — 100% local computation.
   */
  async autonomousDesign(
    prompt: string,
    options?: Partial<DesignRequest>
  ): Promise<DesignResult> {
    this.eventBus.emit({
      type: 'request-started',
      timestamp: new Date(),
      data: { requestId: `design_${Date.now()}`, type: 'autonomous-design', provider: 'local' },
    });

    const result = await this.designEngine.design({
      prompt,
      optimize: true,
      maxIterations: 5,
      targetUtilization: 0.85,
      designCode: 'IS_800',
      materialGrade: 'E250',
      ...options,
    });

    // Log to audit trail
    if (this.config.features.auditTrail) {
      this.auditTrail.log({
        requestId: `design_${Date.now()}`,
        type: 'structure-generation',
        provider: 'local',
        model: 'autonomous-design-engine-v1',
        prompt: prompt.slice(0, 2000),
        response: result.report.slice(0, 2000),
        success: result.passed,
        confidence: result.passed ? 0.95 : 0.6,
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUSD: 0 },
        latency: result.computeTimeMs,
        fallbacksAttempted: 0,
        sessionId: this.sessionId,
      });
    }

    // Add to conversation history
    this.conversationHistory.push(
      { role: 'user', content: prompt, timestamp: new Date() },
      { role: 'assistant', content: result.report, timestamp: new Date() },
    );

    return result;
  }

  /**
   * Quick structure check — generate, analyze, and check a structure type
   * without full optimization. Good for rapid prototyping.
   */
  async quickDesignCheck(
    prompt: string,
  ): Promise<{ passed: boolean; maxUtilization: number; weight: number; report: string; failedMembers: string[] }> {
    const result = await this.designEngine.design({
      prompt,
      optimize: false,
    });
    return {
      passed: result.passed,
      maxUtilization: result.maxUtilization,
      weight: result.totalWeight,
      report: result.report,
      failedMembers: result.failedMembers,
    };
  }

  /**
   * Look up a steel section by name (fuzzy matching)
   */
  lookupSection(name: string) {
    return SectionLookup.getSection(name);
  }

  /**
   * Get available section names for a family
   */
  getAvailableSections(family: 'ISMB' | 'ISMC' | 'ISA' = 'ISMB') {
    return SectionLookup.getSectionNames(family);
  }

  /**
   * Analyze a sketch image
   */
  async analyzeSketch(imageData: string): Promise<AIResponse> {
    return this.process({
      id: '',
      type: 'vision',
      prompt: 'Analyze this structural engineering sketch and generate the corresponding model',
      requiredCapabilities: ['vision'],
      metadata: { imageData },
    });
  }

  // ============================================================================
  // STREAMING
  // ============================================================================

  /**
   * Stream a chat response with progressive output
   */
  streamChat(
    message: string,
    onUpdate: (state: { text: string; streaming: boolean; progress: any; error: string | null }) => void
  ) {
    const state = createStreamingState(this.streamingHandler, onUpdate);
    return state.start(
      `${this.config.apiBaseUrl}/chat`,
      {
        message,
        history: this.conversationHistory.slice(-this.config.maxHistoryLength),
        sessionId: this.sessionId,
        stream: true,
      },
      'gemini'
    );
  }

  // ============================================================================
  // EVENT SYSTEM
  // ============================================================================

  /**
   * Subscribe to orchestrator events
   */
  on(event: AIEventType | '*', listener: AIEventListener): () => void {
    return this.eventBus.on(event, listener);
  }

  // ============================================================================
  // STATUS & DIAGNOSTICS
  // ============================================================================

  /**
   * Get comprehensive system status
   */
  getStatus(): {
    sessionId: string;
    providers: Record<string, { available: boolean; circuitState: string; failureCount: number }>;
    rateLimits: { remaining: number; isLimited: boolean };
    tokenBudget: { sessionPercent: number; dailyPercent: number; dailyCostUSD: number };
    cache: { size: number; hitRate: number };
    activeStreams: number;
    conversationLength: number;
  } {
    const providerStatus: Record<string, any> = {};
    for (const provider of this.config.providerPriority) {
      const cbState = this.circuitBreaker.getState(provider);
      providerStatus[provider] = {
        available: this.circuitBreaker.canCall(provider),
        circuitState: cbState.state,
        failureCount: cbState.failureCount,
      };
    }

    const rateLimitState = this.rateLimiter.getState();
    const budgetStats = this.tokenBudget.getUsageStats();
    const cacheStats = this.cache.getStats();

    return {
      sessionId: this.sessionId,
      providers: providerStatus,
      rateLimits: {
        remaining: rateLimitState.remainingPerMinute,
        isLimited: rateLimitState.isLimited,
      },
      tokenBudget: {
        sessionPercent: budgetStats.session.percentUsed,
        dailyPercent: budgetStats.daily.percentUsed,
        dailyCostUSD: budgetStats.daily.costUSD,
      },
      cache: {
        size: cacheStats.size,
        hitRate: cacheStats.hitRate,
      },
      activeStreams: this.streamingHandler.activeStreamCount,
      conversationLength: this.conversationHistory.length,
    };
  }

  /**
   * Get performance analytics
   */
  async getAnalytics(periodDays?: number) {
    return this.auditTrail.getAnalytics(periodDays);
  }

  /**
   * Record user feedback on a response
   */
  async recordFeedback(requestId: string, rating: 1 | 2 | 3 | 4 | 5, comment?: string) {
    await this.auditTrail.recordFeedback(requestId, {
      rating,
      helpful: rating >= 3,
      accurate: rating >= 4,
      comment,
      timestamp: new Date(),
    });
  }

  /**
   * Export audit trail
   */
  async exportAuditTrail() {
    return this.auditTrail.export();
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  clearHistory(): void {
    this.conversationHistory = [];
  }

  resetSession(): void {
    this.conversationHistory = [];
    this.tokenBudget.resetSession();
    this.cache.clear();
    this.circuitBreaker.resetAll();
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.proxy.updateConfig({ sessionId: this.sessionId });
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  updateConfig(config: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.apiBaseUrl) {
      this.proxy.updateConfig({ baseUrl: config.apiBaseUrl });
    }
  }

  getConfig(): Readonly<OrchestratorConfig> {
    return { ...this.config };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Execute request with automatic fallback chain
   */
  private async executeWithFallback(request: AIRequest, startTime: number): Promise<AIResponse> {
    const fallbackChain: FallbackStep[] = [];
    const providers = this.getProviderChain(request);

    for (const provider of providers) {
      // Check circuit breaker
      if (!this.circuitBreaker.canCall(provider)) {
        fallbackChain.push({ provider, model: '', status: 'skipped', error: 'Circuit open' });
        continue;
      }

      const providerConfig = this.config.providers[provider];
      if (!providerConfig) {
        fallbackChain.push({ provider, model: '', status: 'skipped', error: 'Not configured' });
        continue;
      }

      try {
        const response = await this.executeOnProvider(request, provider, providerConfig, startTime);
        
        this.circuitBreaker.recordSuccess(provider);
        fallbackChain.push({ provider, model: providerConfig.model, status: 'success', latency: Date.now() - startTime });
        response.fallbackChain = fallbackChain;

        // Record in audit trail
        if (this.config.features.auditTrail) {
          this.auditTrail.log({
            requestId: request.id,
            type: request.type,
            provider,
            model: providerConfig.model,
            prompt: request.prompt.slice(0, 2000),
            response: response.content.slice(0, 2000),
            success: response.success,
            confidence: response.confidence,
            tokenUsage: response.usage,
            latency: response.latency,
            fallbacksAttempted: fallbackChain.length - 1,
            guardrailResult: response.guardrailResults,
            sessionId: this.sessionId,
          });
        }

        // Cache successful response
        if (this.config.features.caching && response.success && !request.streaming) {
          const cacheKey = ResponseCache.generateKey(request.prompt, provider, providerConfig.model);
          this.cache.set(cacheKey, response);
        }

        // Record token usage
        if (this.config.features.tokenBudget && response.usage) {
          this.tokenBudget.recordUsage(response.usage);
        }

        return response;

      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.circuitBreaker.recordFailure(provider, err.message);
        fallbackChain.push({ provider, model: providerConfig.model, status: 'failed', error: err.message });

        logger.warn(`[Orchestrator] Provider ${provider} failed`, { error: err.message });

        // If error recovery is enabled, try to recover before moving to next provider
        if (this.config.features.errorRecovery && providers.indexOf(provider) === providers.length - 1) {
          const recovery = await this.errorRecovery.recover(
            err,
            provider,
            request,
            async (p) => this.executeOnProvider(request, p, this.config.providers[p]!, startTime),
            providers
          );

          if (recovery.response) {
            recovery.response.fallbackChain = fallbackChain;
            return recovery.response;
          }
        }
      }
    }

    // All providers failed
    const errorResponse = this.createErrorResponse(
      request.id,
      request,
      'All AI providers are currently unavailable. Please try again later.',
      'all-providers-failed'
    );
    errorResponse.fallbackChain = fallbackChain;
    return errorResponse;
  }

  /**
   * Execute request on a specific provider
   */
  private async executeOnProvider(
    request: AIRequest,
    provider: AIProviderType,
    config: AIProviderConfig,
    startTime: number
  ): Promise<AIResponse> {
    const timeout = request.timeout || config.timeout || this.config.defaultTimeout;

    // Use retry handler
    const { result, attempts } = await this.retryHandler.execute(
      () => this.callProvider(request, provider, config, timeout),
      `${provider}/${request.type}`
    );

    // Validate text response
    if (this.config.features.guardrails && result.content) {
      const textValidation = this.guardrails.validateTextResponse(result.content);
      if (!textValidation.safe) {
        result.warnings.push(...textValidation.issues);
        result.confidence = Math.min(result.confidence, textValidation.confidence / 100);
      }
      result.content = textValidation.sanitized;
    }

    result.latency = Date.now() - startTime;
    return result;
  }

  /**
   * Make the actual call to a provider
   */
  private async callProvider(
    request: AIRequest,
    provider: AIProviderType,
    config: AIProviderConfig,
    timeout: number
  ): Promise<AIResponse> {
    switch (provider) {
      case 'gemini':
      case 'openai':
      case 'anthropic':
        return this.callRemoteProvider(request, provider, config, timeout);

      case 'local':
        return this.callLocalProvider(request);

      case 'mock':
        return this.callMockProvider(request);

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Call a remote AI provider through the secure proxy
   */
  private async callRemoteProvider(
    request: AIRequest,
    provider: AIProviderType,
    config: AIProviderConfig,
    timeout: number
  ): Promise<AIResponse> {
    const requestId = request.id;

    switch (request.type) {
      case 'chat':
      case 'explanation': {
        const result = await this.proxy.chat(request.prompt, {
          context: request.systemPrompt,
          history: request.history,
          provider,
          model: config.model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          systemPrompt: request.systemPrompt,
        });

        return {
          id: `resp_${Date.now()}`,
          requestId,
          success: true,
          provider: result.provider,
          model: config.model,
          content: result.response,
          confidence: 0.85,
          usage: result.usage,
          latency: 0,
          cached: result.cached,
          warnings: [],
          errors: [],
          timestamp: new Date(),
        };
      }

      case 'structure-generation': {
        const result = await this.proxy.generateStructure(request.prompt, {
          constraints: request.constraints as any,
          provider,
          designCode: request.context?.activeDesignCode,
          unitSystem: request.context?.unitSystem,
        });

        return {
          id: `resp_${Date.now()}`,
          requestId,
          success: true,
          provider: result.provider,
          model: config.model,
          content: `Generated ${result.structure.type} with ${result.structure.nodes.length} nodes and ${result.structure.members.length} members`,
          structuredData: { type: 'structure', data: result.structure },
          confidence: result.structure.metadata.confidence,
          usage: result.usage,
          latency: 0,
          cached: false,
          guardrailResults: undefined,
          warnings: result.structure.metadata.warnings,
          errors: [],
          timestamp: new Date(),
        };
      }

      case 'code-compliance': {
        const { member, forces, code } = request.metadata || {};
        const result = await this.proxy.checkCodeCompliance(
          member as Record<string, any>,
          forces as Record<string, any>,
          code as string
        );

        return {
          id: `resp_${Date.now()}`,
          requestId,
          success: true,
          provider,
          model: config.model,
          content: result.passed ? 'All code compliance checks passed' : `Member fails ${code || 'IS_800'} check (utilization: ${result.utilization})`,
          structuredData: { type: 'design-check', data: result as any },
          confidence: 0.9,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUSD: 0 },
          latency: 0,
          cached: false,
          warnings: [],
          errors: [],
          timestamp: new Date(),
        };
      }

      case 'diagnosis': {
        const result = await this.proxy.diagnoseModel(request.metadata?.modelData as any);

        return {
          id: `resp_${Date.now()}`,
          requestId,
          success: true,
          provider,
          model: config.model,
          content: `Found ${result.issues.length} issues. Score: ${result.score}/100. ${result.recommendations.join('. ')}`,
          structuredData: { type: 'general', data: result },
          confidence: 0.8,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUSD: 0 },
          latency: 0,
          cached: false,
          warnings: [],
          errors: [],
          timestamp: new Date(),
        };
      }

      case 'modification': {
        const modelData = request.context?.modelContext || request.metadata?.modelData;
        const result = await this.proxy.modifyModel(modelData as any, request.prompt);

        return {
          id: `resp_${Date.now()}`,
          requestId,
          success: true,
          provider: result.provider,
          model: config.model,
          content: `Applied ${result.changes.length} modifications: ${result.changes.join(', ')}`,
          structuredData: { type: 'structure', data: result.modifiedModel },
          confidence: 0.75,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUSD: 0 },
          latency: 0,
          cached: false,
          warnings: [],
          errors: [],
          timestamp: new Date(),
        };
      }

      case 'vision': {
        const imageData = request.metadata?.imageData as string;
        const result = await this.proxy.analyzeSketch(imageData);

        return {
          id: `resp_${Date.now()}`,
          requestId,
          success: true,
          provider: 'gemini',
          model: 'gemini-2.0-flash',
          content: result.description,
          structuredData: { type: 'structure', data: result.structure },
          confidence: result.confidence,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUSD: 0 },
          latency: 0,
          cached: false,
          warnings: [],
          errors: [],
          timestamp: new Date(),
        };
      }

      default:
        // Generic chat for any other request type
        const genericResult = await this.proxy.chat(request.prompt, {
          context: request.systemPrompt,
          history: request.history,
          provider,
        });

        return {
          id: `resp_${Date.now()}`,
          requestId,
          success: true,
          provider: genericResult.provider,
          model: config.model,
          content: genericResult.response,
          confidence: 0.7,
          usage: genericResult.usage,
          latency: 0,
          cached: genericResult.cached,
          warnings: [],
          errors: [],
          timestamp: new Date(),
        };
    }
  }

  /**
   * Call the local rule-based AI engine.
   * For structure-generation requests, uses the autonomous design engine for
   * end-to-end analysis (structure → loads → analysis → design check → optimize).
   */
  private async callLocalProvider(request: AIRequest): Promise<AIResponse> {
    // For structure generation, use the autonomous engine which does EVERYTHING locally
    if (request.type === 'structure-generation' || request.type === 'auto-fix') {
      try {
        const designResult = await this.designEngine.design({
          prompt: request.prompt,
          optimize: true,
          maxIterations: 5,
          targetUtilization: 0.85,
        });

        // Convert to AIResponse format
        const nodeList = designResult.model.nodes.map(n => ({
          id: n.id, x: n.x, y: n.y, z: n.z,
          ...(n.restraints && { restraints: n.restraints }),
        }));
        const memberList = designResult.model.members.map(m => ({
          id: m.id, startNodeId: m.startNodeId, endNodeId: m.endNodeId,
          sectionName: m.sectionName, E: m.E, A: m.A, I: m.I,
        }));

        return {
          id: `local_design_${Date.now()}`,
          requestId: request.id,
          success: true,
          provider: 'local',
          model: 'autonomous-design-engine-v1',
          content: designResult.report,
          confidence: designResult.passed ? 0.95 : 0.6,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUSD: 0 },
          latency: designResult.computeTimeMs,
          cached: false,
          warnings: designResult.warnings,
          errors: designResult.failedMembers.length > 0
            ? [`${designResult.failedMembers.length} members failed design checks`]
            : [],
          timestamp: new Date(),
          structuredData: {
            type: 'structure',
            data: {
              type: 'auto-designed',
              nodes: nodeList,
              members: memberList,
              loads: designResult.loadCases.flatMap(lc => [
                ...lc.nodeLoads.map(nl => ({ ...nl, type: 'point' as const })),
                ...lc.memberLoads.map(ml => ({ ...ml })),
              ]),
              designChecks: designResult.designChecks,
              designPassed: designResult.passed,
              maxUtilization: designResult.maxUtilization,
              totalWeight: designResult.totalWeight,
              metadata: {
                confidence: designResult.passed ? 0.95 : 0.6,
                warnings: designResult.warnings,
                provider: 'autonomous-design-engine',
              },
            },
          },
        };
      } catch (err) {
        logger.warn('[Orchestrator] Autonomous engine fallback to legacy', { error: err instanceof Error ? err.message : String(err) });
        // Fall through to legacy local provider
      }
    }

    // Legacy path: use rule-based AI architect
    const { aiArchitect } = await import('../../ai/EnhancedAIArchitect');
    
    const localResponse = await aiArchitect.processRequest({
      message: request.prompt,
      modelContext: request.context?.modelContext as any,
    });

    return {
      id: `local_${Date.now()}`,
      requestId: request.id,
      success: true,
      provider: 'local',
      model: 'enhanced-ai-architect-v2',
      content: localResponse.message,
      confidence: localResponse.confidence,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUSD: 0 },
      latency: 0,
      cached: false,
      warnings: localResponse.warnings || [],
      errors: [],
      timestamp: new Date(),
      structuredData: localResponse.structureData
        ? { type: 'structure', data: schemaNormalizer.normalizeStructure(localResponse.structureData, 'local') }
        : undefined,
    };
  }

  /**
   * Call mock provider for development/testing
   */
  private async callMockProvider(request: AIRequest): Promise<AIResponse> {
    return {
      id: `mock_${Date.now()}`,
      requestId: request.id,
      success: true,
      provider: 'mock',
      model: 'mock-v1',
      content: `[Mock Response] Processed ${request.type} request: "${request.prompt.slice(0, 100)}"`,
      confidence: 0.3,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUSD: 0 },
      latency: 50,
      cached: false,
      warnings: ['This is a mock response - configure an AI provider for real results'],
      errors: [],
      timestamp: new Date(),
    };
  }

  /**
   * Determine provider fallback chain for a request
   */
  private getProviderChain(request: AIRequest): AIProviderType[] {
    let providers = [...this.config.providerPriority];

    // If preferred provider specified, put it first
    if (request.preferredProvider) {
      providers = [request.preferredProvider, ...providers.filter(p => p !== request.preferredProvider)];
    }

    // Filter by required capabilities
    if (request.requiredCapabilities && request.requiredCapabilities.length > 0) {
      providers = providers.filter(p => {
        const config = this.config.providers[p];
        if (!config) return false;
        return request.requiredCapabilities!.every(cap => config.capabilities.includes(cap));
      });
    }

    // Sort by priority
    providers.sort((a, b) => {
      const aPriority = this.config.providers[a]?.priority ?? 99;
      const bPriority = this.config.providers[b]?.priority ?? 99;
      return aPriority - bPriority;
    });

    return providers.length > 0 ? providers : ['local', 'mock'];
  }

  /**
   * Get system prompt for a request type
   */
  private getSystemPrompt(type: AIRequestType): string {
    const prompts: Partial<Record<AIRequestType, string>> = {
      'chat': `You are BeamLab AI, an expert civil/structural engineering assistant. You help engineers with structural analysis, design, and code compliance. Be precise, reference relevant design codes (IS 800, AISC 360, Eurocode 3, IS 456, etc.), and provide calculations when appropriate. Always prioritize safety in your recommendations. Current date: ${new Date().toLocaleDateString()}.`,

      'structure-generation': `You are a structural model generator. Given a description, generate a valid structural model in JSON format with nodes, members, loads, supports, materials, and sections. Use consistent node/member IDs. Ensure structural stability with proper supports. Use realistic engineering dimensions and material properties.`,

      'explanation': `You are a civil engineering professor. Explain concepts clearly with relevant formulas, code references (IS/AISC/Eurocode), and practical examples. Use proper engineering terminology and SI units unless otherwise specified.`,

      'code-compliance': `You are a structural design code compliance checker. Check member designs against the specified code (IS 800, AISC 360, etc.). Report clause references, demand/capacity ratios, and pass/fail status for each check.`,
    };

    return prompts[type] || prompts['chat']!;
  }

  /**
   * Create a standardized error response
   */
  private createErrorResponse(
    requestId: string,
    request: AIRequest,
    message: string,
    errorType: string
  ): AIResponse {
    return {
      id: `error_${Date.now()}`,
      requestId,
      success: false,
      provider: 'mock',
      model: 'error-handler',
      content: message,
      confidence: 0,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUSD: 0 },
      latency: 0,
      cached: false,
      warnings: [],
      errors: [message],
      timestamp: new Date(),
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

export const aiOrchestrator = new AIOrchestrator();
