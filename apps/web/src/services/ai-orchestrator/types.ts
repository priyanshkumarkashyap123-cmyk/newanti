/**
 * ============================================================================
 * AI ORCHESTRATOR - TYPE DEFINITIONS
 * ============================================================================
 * 
 * Unified type system for the entire AI pipeline.
 * All AI providers, services, and components use these types.
 * 
 * @version 3.0.0
 */

// ============================================================================
// PROVIDER TYPES
// ============================================================================

export type AIProviderType = 'gemini' | 'openai' | 'anthropic' | 'local' | 'mock';

export type AIProviderStatus = 'available' | 'degraded' | 'unavailable' | 'rate-limited' | 'error';

export interface AIProviderConfig {
  type: AIProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
  topP?: number;
  topK?: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  priority: number; // Lower = higher priority for fallback chain
  costPerInputToken: number; // USD per token
  costPerOutputToken: number;
  capabilities: AICapability[];
}

export type AICapability =
  | 'chat'
  | 'code-generation'
  | 'structure-generation'
  | 'explanation'
  | 'vision'
  | 'function-calling'
  | 'streaming'
  | 'embeddings'
  | 'analysis'
  | 'code-compliance'
  | 'design-optimization';

// ============================================================================
// REQUEST / RESPONSE TYPES
// ============================================================================

export interface AIRequest {
  id: string;
  type: AIRequestType;
  prompt: string;
  systemPrompt?: string;
  context?: AIContext;
  history?: AIMessage[];
  constraints?: AIConstraints;
  metadata?: Record<string, unknown>;
  preferredProvider?: AIProviderType;
  requiredCapabilities?: AICapability[];
  streaming?: boolean;
  timeout?: number;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

export type AIRequestType =
  | 'chat'
  | 'structure-generation'
  | 'analysis'
  | 'design-check'
  | 'code-compliance'
  | 'optimization'
  | 'explanation'
  | 'diagnosis'
  | 'auto-fix'
  | 'modification'
  | 'vision';

export interface AIResponse {
  id: string;
  requestId: string;
  success: boolean;
  provider: AIProviderType;
  model: string;
  content: string;
  structuredData?: StructuredAIOutput;
  confidence: number;
  usage: TokenUsage;
  latency: number;
  cached: boolean;
  guardrailResults?: GuardrailSummary;
  fallbackChain?: FallbackStep[];
  warnings: string[];
  errors: string[];
  timestamp: Date;
}

export interface StructuredAIOutput {
  type: 'structure' | 'analysis' | 'design-check' | 'modification' | 'general';
  data: NormalizedStructureData | AnalysisOutput | DesignCheckOutput | Record<string, unknown>;
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface AIContext {
  modelContext?: ModelContext;
  sessionId?: string;
  userId?: string;
  projectId?: string;
  activeDesignCode?: DesignCode;
  unitSystem?: 'SI' | 'Imperial';
  expertiseLevel?: 'student' | 'professional' | 'expert';
  previousActions?: AIActionRecord[];
}

export interface ModelContext {
  nodes: NormalizedNode[];
  members: NormalizedMember[];
  loads: NormalizedLoad[];
  supports: NormalizedSupport[];
  materials?: NormalizedMaterial[];
  sections?: NormalizedSection[];
  analysisResults?: AnalysisResultsSummary;
  metadata?: Record<string, unknown>;
}

export type DesignCode = 'IS_800' | 'IS_456' | 'IS_1893' | 'AISC_360' | 'ACI_318' | 'EC3' | 'EC2' | 'EC8' | 'AS_4100';

// ============================================================================
// NORMALIZED SCHEMA (Unified across all backends)
// ============================================================================

export interface NormalizedNode {
  id: string;
  x: number;
  y: number;
  z: number;
  label?: string;
  restraint?: NormalizedRestraint;
}

export interface NormalizedMember {
  id: string;
  startNodeId: string;
  endNodeId: string;
  type?: 'beam' | 'column' | 'brace' | 'truss-chord' | 'truss-diagonal' | 'truss-vertical' | 'cable' | 'other';
  sectionId?: string;
  materialId?: string;
  releases?: MemberRelease;
}

export interface NormalizedLoad {
  id: string;
  type: 'point' | 'distributed' | 'moment' | 'temperature' | 'prestress';
  targetType: 'node' | 'member' | 'global';
  targetId: string;
  values: number[];
  direction?: 'x' | 'y' | 'z' | 'local-x' | 'local-y' | 'local-z';
  loadCase?: string;
  loadCombination?: string;
}

export interface NormalizedSupport {
  nodeId: string;
  type: 'fixed' | 'pinned' | 'roller' | 'spring' | 'custom';
  restraints: {
    dx: boolean;
    dy: boolean;
    dz: boolean;
    rx: boolean;
    ry: boolean;
    rz: boolean;
  };
  springStiffness?: number[];
}

export interface NormalizedRestraint {
  dx: boolean;
  dy: boolean;
  dz: boolean;
  rx: boolean;
  ry: boolean;
  rz: boolean;
}

export interface MemberRelease {
  startRelease?: NormalizedRestraint;
  endRelease?: NormalizedRestraint;
}

export interface NormalizedMaterial {
  id: string;
  name: string;
  type: 'steel' | 'concrete' | 'timber' | 'aluminum' | 'custom';
  E: number;        // Young's modulus (Pa)
  G?: number;       // Shear modulus (Pa)
  fy?: number;      // Yield strength (Pa)
  fu?: number;      // Ultimate strength (Pa)
  density?: number;  // kg/m³
  poisson?: number;  // Poisson's ratio
  alpha?: number;    // Thermal expansion coefficient
}

export interface NormalizedSection {
  id: string;
  name: string;
  type: 'I' | 'H' | 'C' | 'L' | 'T' | 'pipe' | 'box' | 'rectangular' | 'circular' | 'custom';
  area: number;      // m²
  Ixx: number;       // m⁴
  Iyy: number;       // m⁴
  Izz?: number;      // m⁴
  Sx?: number;       // Section modulus m³
  Zx?: number;       // Plastic modulus m³
  ry?: number;       // Radius of gyration m
  rz?: number;       // Radius of gyration m
  depth?: number;    // mm
  width?: number;    // mm
  tw?: number;       // mm
  tf?: number;       // mm
}

// ============================================================================
// NORMALIZED STRUCTURE DATA
// ============================================================================

export interface NormalizedStructureData {
  type: string;
  nodes: NormalizedNode[];
  members: NormalizedMember[];
  loads: NormalizedLoad[];
  supports: NormalizedSupport[];
  materials: NormalizedMaterial[];
  sections: NormalizedSection[];
  metadata: {
    generatedBy: AIProviderType;
    generatedAt: Date;
    confidence: number;
    validationPassed: boolean;
    warnings: string[];
    structureDescription: string;
  };
}

// ============================================================================
// ANALYSIS OUTPUT
// ============================================================================

export interface AnalysisOutput {
  summary: string;
  maxDisplacement: number;
  maxStress: number;
  maxMoment: number;
  criticalMembers: string[];
  recommendations: string[];
  designCodeChecks?: DesignCodeCheckResult[];
}

export interface DesignCheckOutput {
  code: DesignCode;
  passed: boolean;
  utilization: number;
  checks: DesignCodeCheckResult[];
  recommendations: string[];
}

export interface DesignCodeCheckResult {
  clause: string;
  description: string;
  demand: number;
  capacity: number;
  utilization: number;
  passed: boolean;
  unit: string;
}

export interface AnalysisResultsSummary {
  maxDisplacement: number;
  maxStress: number;
  maxMoment: number;
  maxShear?: number;
  maxAxial?: number;
  naturalFrequencies?: number[];
  reactions?: Record<string, number[]>;
}

// ============================================================================
// TOKEN USAGE & COST TRACKING
// ============================================================================

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
}

export interface TokenBudget {
  maxTokensPerRequest: number;
  maxTokensPerSession: number;
  maxTokensPerDay: number;
  maxCostPerDay: number;
  currentUsage: TokenUsageAccumulator;
}

export interface TokenUsageAccumulator {
  sessionTokens: number;
  dailyTokens: number;
  dailyCostUSD: number;
  requestCount: number;
  lastResetDate: string;
}

// ============================================================================
// GUARDRAIL TYPES
// ============================================================================

export interface GuardrailSummary {
  passed: boolean;
  confidence: number;
  totalChecks: number;
  passedChecks: number;
  warnings: GuardrailWarning[];
  failures: GuardrailFailure[];
}

export interface GuardrailWarning {
  parameter: string;
  value: number;
  expectedRange: string;
  message: string;
}

export interface GuardrailFailure {
  parameter: string;
  value: number;
  limit: string;
  message: string;
  severity: 'critical' | 'major';
}

// ============================================================================
// FALLBACK & RESILIENCE
// ============================================================================

export interface FallbackStep {
  provider: AIProviderType;
  model: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  latency?: number;
}

export interface CircuitBreakerState {
  provider: AIProviderType;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailure?: Date;
  nextRetryAt?: Date;
  successCount: number;
}

// ============================================================================
// RATE LIMITING
// ============================================================================

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxConcurrentRequests: number;
  burstAllowance: number;
}

export interface RateLimitState {
  remainingPerMinute: number;
  remainingPerHour: number;
  currentConcurrent: number;
  resetAt: Date;
  isLimited: boolean;
}

// ============================================================================
// AUDIT & OBSERVABILITY
// ============================================================================

export interface AIAuditEntry {
  id: string;
  timestamp: Date;
  requestId: string;
  type: AIRequestType;
  provider: AIProviderType;
  model: string;
  prompt: string;
  response: string;
  success: boolean;
  confidence: number;
  tokenUsage: TokenUsage;
  latency: number;
  fallbacksAttempted: number;
  guardrailResult?: GuardrailSummary;
  userFeedback?: UserFeedback;
  sessionId?: string;
  tags?: string[];
}

export interface UserFeedback {
  rating: 1 | 2 | 3 | 4 | 5;
  helpful: boolean;
  accurate: boolean;
  comment?: string;
  corrections?: string;
  timestamp: Date;
}

// ============================================================================
// ACTION RECORDING
// ============================================================================

export interface AIActionRecord {
  type: string;
  description: string;
  timestamp: Date;
  success: boolean;
  undoable: boolean;
  data?: Record<string, unknown>;
}

// ============================================================================
// CONSTRAINT TYPES
// ============================================================================

export interface AIConstraints {
  maxSpan?: number;
  maxHeight?: number;
  maxStories?: number;
  designCode?: DesignCode;
  materialPreference?: string;
  budgetLimit?: number;
  structureType?: string;
  loadingConditions?: string[];
  customConstraints?: Record<string, unknown>;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export type AIEventType =
  | 'request-started'
  | 'request-completed'
  | 'request-failed'
  | 'error'
  | 'provider-switched'
  | 'fallback-triggered'
  | 'rate-limited'
  | 'circuit-opened'
  | 'circuit-closed'
  | 'guardrail-warning'
  | 'guardrail-failure'
  | 'token-budget-warning'
  | 'token-budget-exceeded'
  | 'cache-hit'
  | 'cache-miss'
  | 'stream-chunk'
  | 'stream-complete';

export interface AIEvent {
  type: AIEventType;
  timestamp: Date;
  data: Record<string, unknown>;
}

export type AIEventListener = (event: AIEvent) => void;

// ============================================================================
// STREAMING TYPES
// ============================================================================

export interface StreamingState {
  text: string;
  streaming: boolean;
  progress: unknown;
  error: string | null;
}

export type StreamingCallbacks = {
  onToken?: (token: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: unknown) => void;
  signal?: AbortSignal;
};

// ============================================================================
// GUARDRAIL TYPES
// ============================================================================

export interface GuardrailResult {
  passed: boolean;
  warnings: GuardrailWarning[];
  failures: GuardrailFailure[];
  sanitizedContent?: string;
}
