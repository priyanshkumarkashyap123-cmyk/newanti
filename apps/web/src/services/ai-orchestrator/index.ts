/**
 * ============================================================================
 * AI ORCHESTRATOR - PUBLIC API
 * ============================================================================
 * 
 * Single entry point for the entire AI system. Import everything from here.
 * 
 * Usage:
 * ```ts
 * import { aiOrchestrator } from '@/services/ai-orchestrator';
 * 
 * // Simple chat
 * const response = await aiOrchestrator.chat('Design a 5m simply supported beam');
 * 
 * // Generate structure
 * const { structure } = await aiOrchestrator.generateStructure(
 *   'Create a 3-bay portal frame, 6m span, 4m height'
 * );
 * 
 * // Check compliance
 * const check = await aiOrchestrator.checkCompliance(member, forces, 'IS_800');
 * 
 * // Stream
 * const cancel = aiOrchestrator.streamChat('Explain P-delta effects', (state) => {
 *   console.log(state.text);
 * });
 * 
 * // System status
 * const status = aiOrchestrator.getStatus();
 * ```
 */

// ── Core Orchestrator ──
export { AIOrchestrator, aiOrchestrator } from './AIOrchestrator';
export type { OrchestratorConfig } from './AIOrchestrator';

// ── Types ──
export type {
  AIProviderType,
  AIProviderConfig,
  AIRequest,
  AIResponse,
  AIRequestType,
  AICapability,
  AIContext,
  AIMessage,
  TokenUsage,
  TokenBudget,
  CircuitBreakerState,
  RateLimitConfig,
  AIEvent,
  AIEventType,
  AIEventListener,
  NormalizedStructureData,
  NormalizedNode,
  NormalizedMember,
  NormalizedLoad,
  NormalizedSupport,
  NormalizedMaterial,
  NormalizedSection,
  GuardrailResult,
  GuardrailSummary,
  AIAuditEntry,
  UserFeedback,
  FallbackStep,
  StreamingState,
  StreamingCallbacks,
} from './types';

// ── Subsystems (for advanced usage) ──
export { SchemaNormalizer, schemaNormalizer } from './SchemaNormalizer';
export { EnhancedAIGuardrails, enhancedGuardrails } from './EnhancedGuardrails';
export { SecureAIProxy, secureProxy } from './SecureAIProxy';
export { PersistentAuditTrail, persistentAuditTrail } from './PersistentAuditTrail';
export { AIErrorRecoveryEngine, AIErrorClassifier } from './ErrorRecovery';
export { StreamingResponseHandler, createStreamingState } from './StreamingHandler';

export {
  AIEventBus,
  CircuitBreaker,
  RetryHandler,
  RateLimiter,
  TokenBudgetManager,
  RequestDeduplicator,
  ResponseCache,
} from './ResilienceLayer';

// ── Autonomous Engineering Engine ──
export { AutonomousDesignEngine, autonomousDesignEngine } from './AutonomousDesignEngine';
export type { DesignRequest, DesignResult, DesignCheck, StructureParameters, StructureType, GeneratedNode, GeneratedMember } from './AutonomousDesignEngine';

export { SectionLookup } from './SectionLookup';
export type { SteelSection, SteelMaterial, MemberDesignProperties } from './SectionLookup';

export { AutoLoadGenerator } from './AutoLoadGenerator';
export type { ProjectLoadConfig, LoadCase, LoadCombination } from './AutoLoadGenerator';

export { SectionOptimizer } from './SectionOptimizer';
export type { OptimizationConfig, OptimizationResult } from './SectionOptimizer';
