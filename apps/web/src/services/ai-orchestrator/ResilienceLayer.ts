/**
 * ============================================================================
 * RESILIENCE LAYER - Circuit Breaker, Retry, Rate Limiting, Token Budget
 * ============================================================================
 * 
 * Production-grade resilience patterns for AI provider calls:
 * - Circuit Breaker: Prevents cascading failures
 * - Retry with exponential backoff + jitter
 * - Rate limiting (per-minute, per-hour, concurrent)
 * - Token budget management with cost tracking
 * - Request deduplication
 * 
 * @version 1.0.0
 */

import type {
  AIProviderType,
  CircuitBreakerState,
  RateLimitConfig,
  RateLimitState,
  TokenBudget,
  TokenUsage,
  TokenUsageAccumulator,
  AIEvent,
  AIEventListener,
  AIEventType,
} from './types';

// ============================================================================
// EVENT BUS
// ============================================================================

export class AIEventBus {
  private listeners = new Map<AIEventType | '*', Set<AIEventListener>>();

  on(event: AIEventType | '*', listener: AIEventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  emit(event: AIEvent): void {
    // Notify specific listeners
    this.listeners.get(event.type)?.forEach(listener => {
      try {
        listener(event);
      } catch (err) {
        console.error(`[AIEventBus] Listener error for ${event.type}:`, err);
      }
    });

    // Notify wildcard listeners
    this.listeners.get('*')?.forEach(listener => {
      try {
        listener(event);
      } catch (err) {
        console.error(`[AIEventBus] Wildcard listener error:`, err);
      }
    });
  }

  removeAll(): void {
    this.listeners.clear();
  }
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

export class CircuitBreaker {
  private states = new Map<AIProviderType, CircuitBreakerState>();
  private eventBus: AIEventBus;

  // Configuration
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxAttempts: number;

  constructor(
    eventBus: AIEventBus,
    config?: {
      failureThreshold?: number;
      resetTimeoutMs?: number;
      halfOpenMaxAttempts?: number;
    }
  ) {
    this.eventBus = eventBus;
    this.failureThreshold = config?.failureThreshold ?? 5;
    this.resetTimeoutMs = config?.resetTimeoutMs ?? 60000; // 1 minute
    this.halfOpenMaxAttempts = config?.halfOpenMaxAttempts ?? 2;
  }

  /**
   * Check if a provider is available
   */
  canCall(provider: AIProviderType): boolean {
    const state = this.getState(provider);

    switch (state.state) {
      case 'closed':
        return true;

      case 'open':
        // Check if enough time has passed to try again
        if (state.nextRetryAt && new Date() >= state.nextRetryAt) {
          this.transitionTo(provider, 'half-open');
          return true;
        }
        return false;

      case 'half-open':
        return state.successCount < this.halfOpenMaxAttempts;

      default:
        return true;
    }
  }

  /**
   * Record a successful call
   */
  recordSuccess(provider: AIProviderType): void {
    const state = this.getState(provider);

    if (state.state === 'half-open') {
      state.successCount++;
      if (state.successCount >= this.halfOpenMaxAttempts) {
        this.transitionTo(provider, 'closed');
        this.eventBus.emit({
          type: 'circuit-closed',
          timestamp: new Date(),
          data: { provider, previousFailures: state.failureCount },
        });
      }
    }

    // Reset failure count on success in closed state
    if (state.state === 'closed') {
      state.failureCount = 0;
    }
  }

  /**
   * Record a failed call
   */
  recordFailure(provider: AIProviderType, error?: string): void {
    const state = this.getState(provider);
    state.failureCount++;
    state.lastFailure = new Date();

    if (state.state === 'half-open') {
      // Immediately open on failure in half-open
      this.transitionTo(provider, 'open');
    } else if (state.failureCount >= this.failureThreshold) {
      this.transitionTo(provider, 'open');
      this.eventBus.emit({
        type: 'circuit-opened',
        timestamp: new Date(),
        data: { provider, failureCount: state.failureCount, error },
      });
    }
  }

  /**
   * Get current state of all providers
   */
  getAllStates(): Map<AIProviderType, CircuitBreakerState> {
    return new Map(this.states);
  }

  getState(provider: AIProviderType): CircuitBreakerState {
    if (!this.states.has(provider)) {
      this.states.set(provider, {
        provider,
        state: 'closed',
        failureCount: 0,
        successCount: 0,
      });
    }
    return this.states.get(provider)!;
  }

  reset(provider: AIProviderType): void {
    this.states.set(provider, {
      provider,
      state: 'closed',
      failureCount: 0,
      successCount: 0,
    });
  }

  resetAll(): void {
    this.states.clear();
  }

  private transitionTo(provider: AIProviderType, newState: CircuitBreakerState['state']): void {
    const state = this.getState(provider);
    const oldState = state.state;
    state.state = newState;

    if (newState === 'open') {
      state.nextRetryAt = new Date(Date.now() + this.resetTimeoutMs);
      state.successCount = 0;
    } else if (newState === 'half-open') {
      state.successCount = 0;
    } else if (newState === 'closed') {
      state.failureCount = 0;
      state.successCount = 0;
      state.nextRetryAt = undefined;
    }

    console.log(`[CircuitBreaker] ${provider}: ${oldState} → ${newState}`);
  }
}

// ============================================================================
// RETRY WITH EXPONENTIAL BACKOFF
// ============================================================================

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;     // ms
  maxDelay: number;      // ms
  backoffMultiplier: number;
  jitterFactor: number;  // 0-1
  retryableErrors: string[];
  nonRetryableErrors: string[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.3,
  retryableErrors: [
    'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED',
    'rate_limit', 'quota_exceeded', '429', '500', '502', '503', '504',
    'overloaded', 'capacity', 'timeout',
  ],
  nonRetryableErrors: [
    '400', '401', '403', '404', 'invalid_api_key', 'unauthorized',
    'content_filter', 'safety', 'blocked',
  ],
};

export class RetryHandler {
  private config: RetryConfig;

  constructor(config?: Partial<RetryConfig>) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    context?: string
  ): Promise<{ result: T; attempts: number }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const result = await fn();
        return { result, attempts: attempt };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is non-retryable
        if (this.isNonRetryable(lastError)) {
          throw lastError;
        }

        // Check if error is retryable
        if (!this.isRetryable(lastError) && attempt > 1) {
          throw lastError;
        }

        // Don't wait after last attempt
        if (attempt < this.config.maxAttempts) {
          const delay = this.calculateDelay(attempt);
          console.warn(
            `[Retry] ${context || 'Operation'} failed (attempt ${attempt}/${this.config.maxAttempts}). ` +
            `Retrying in ${delay}ms. Error: ${lastError.message}`
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('All retry attempts exhausted');
  }

  private isRetryable(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return this.config.retryableErrors.some(pattern =>
      msg.includes(pattern.toLowerCase())
    );
  }

  private isNonRetryable(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return this.config.nonRetryableErrors.some(pattern =>
      msg.includes(pattern.toLowerCase())
    );
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    const clampedDelay = Math.min(exponentialDelay, this.config.maxDelay);

    // Add jitter
    const jitter = clampedDelay * this.config.jitterFactor * (Math.random() * 2 - 1);
    return Math.max(0, Math.round(clampedDelay + jitter));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// RATE LIMITER
// ============================================================================

export class RateLimiter {
  private eventBus: AIEventBus;
  private config: RateLimitConfig;
  private minuteWindow: { timestamps: number[] } = { timestamps: [] };
  private hourWindow: { timestamps: number[] } = { timestamps: [] };
  private currentConcurrent = 0;
  private queue: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(eventBus: AIEventBus, config?: Partial<RateLimitConfig>) {
    this.eventBus = eventBus;
    this.config = {
      maxRequestsPerMinute: config?.maxRequestsPerMinute ?? 30,
      maxRequestsPerHour: config?.maxRequestsPerHour ?? 500,
      maxConcurrentRequests: config?.maxConcurrentRequests ?? 5,
      burstAllowance: config?.burstAllowance ?? 5,
    };
  }

  /**
   * Acquire a rate limit slot. Returns a release function.
   */
  async acquire(timeoutMs: number = 30000): Promise<() => void> {
    // Clean old timestamps
    this.cleanWindows();

    // Check limits
    if (this.canProceed()) {
      return this.grant();
    }

    // Queue the request
    return new Promise<() => void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = this.queue.findIndex(q => q.resolve === resolve);
        if (idx >= 0) this.queue.splice(idx, 1);
        this.eventBus.emit({
          type: 'rate-limited',
          timestamp: new Date(),
          data: { reason: 'timeout', waitedMs: timeoutMs },
        });
        reject(new Error('Rate limit queue timeout'));
      }, timeoutMs);

      this.queue.push({ resolve: () => resolve(this.grant()), reject, timeout });
    });
  }

  /**
   * Get current rate limit state
   */
  getState(): RateLimitState {
    this.cleanWindows();
    return {
      remainingPerMinute: Math.max(0, this.config.maxRequestsPerMinute - this.minuteWindow.timestamps.length),
      remainingPerHour: Math.max(0, this.config.maxRequestsPerHour - this.hourWindow.timestamps.length),
      currentConcurrent: this.currentConcurrent,
      resetAt: new Date(Date.now() + 60000),
      isLimited: !this.canProceed(),
    };
  }

  private canProceed(): boolean {
    return (
      this.currentConcurrent < this.config.maxConcurrentRequests &&
      this.minuteWindow.timestamps.length < this.config.maxRequestsPerMinute + this.config.burstAllowance &&
      this.hourWindow.timestamps.length < this.config.maxRequestsPerHour
    );
  }

  private grant(): () => void {
    const now = Date.now();
    this.minuteWindow.timestamps.push(now);
    this.hourWindow.timestamps.push(now);
    this.currentConcurrent++;

    // Return release function
    return () => {
      this.currentConcurrent = Math.max(0, this.currentConcurrent - 1);
      this.processQueue();
    };
  }

  private processQueue(): void {
    while (this.queue.length > 0 && this.canProceed()) {
      const next = this.queue.shift()!;
      clearTimeout(next.timeout);
      next.resolve();
    }
  }

  private cleanWindows(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;

    this.minuteWindow.timestamps = this.minuteWindow.timestamps.filter(t => t > oneMinuteAgo);
    this.hourWindow.timestamps = this.hourWindow.timestamps.filter(t => t > oneHourAgo);
  }
}

// ============================================================================
// TOKEN BUDGET MANAGER
// ============================================================================

const STORAGE_KEY = 'beamlab_ai_token_budget';

export class TokenBudgetManager {
  private eventBus: AIEventBus;
  private budget: TokenBudget;
  private accumulator: TokenUsageAccumulator;

  constructor(eventBus: AIEventBus, budget?: Partial<TokenBudget>) {
    this.eventBus = eventBus;
    this.budget = {
      maxTokensPerRequest: budget?.maxTokensPerRequest ?? 16384,
      maxTokensPerSession: budget?.maxTokensPerSession ?? 500000,
      maxTokensPerDay: budget?.maxTokensPerDay ?? 2000000,
      maxCostPerDay: budget?.maxCostPerDay ?? 10.0, // $10/day default
      currentUsage: budget?.currentUsage ?? this.loadUsage(),
    };
    this.accumulator = this.budget.currentUsage;
    this.checkDailyReset();
  }

  /**
   * Check if a request is within budget
   */
  canAfford(estimatedTokens: number): { allowed: boolean; reason?: string } {
    this.checkDailyReset();

    if (estimatedTokens > this.budget.maxTokensPerRequest) {
      return { allowed: false, reason: `Request exceeds max tokens per request (${estimatedTokens} > ${this.budget.maxTokensPerRequest})` };
    }

    if (this.accumulator.sessionTokens + estimatedTokens > this.budget.maxTokensPerSession) {
      this.eventBus.emit({
        type: 'token-budget-warning',
        timestamp: new Date(),
        data: { type: 'session', current: this.accumulator.sessionTokens, max: this.budget.maxTokensPerSession },
      });
      return { allowed: false, reason: 'Session token budget exceeded' };
    }

    if (this.accumulator.dailyTokens + estimatedTokens > this.budget.maxTokensPerDay) {
      this.eventBus.emit({
        type: 'token-budget-exceeded',
        timestamp: new Date(),
        data: { type: 'daily', current: this.accumulator.dailyTokens, max: this.budget.maxTokensPerDay },
      });
      return { allowed: false, reason: 'Daily token budget exceeded' };
    }

    // Warning at 80% usage
    const dailyUsagePercent = ((this.accumulator.dailyTokens + estimatedTokens) / this.budget.maxTokensPerDay) * 100;
    if (dailyUsagePercent > 80) {
      this.eventBus.emit({
        type: 'token-budget-warning',
        timestamp: new Date(),
        data: { type: 'daily', usagePercent: dailyUsagePercent },
      });
    }

    return { allowed: true };
  }

  /**
   * Record token usage after a successful request
   */
  recordUsage(usage: TokenUsage): void {
    this.accumulator.sessionTokens += usage.totalTokens;
    this.accumulator.dailyTokens += usage.totalTokens;
    this.accumulator.dailyCostUSD += usage.estimatedCostUSD;
    this.accumulator.requestCount++;
    this.saveUsage();
  }

  /**
   * Get current usage stats
   */
  getUsageStats(): {
    session: { tokens: number; maxTokens: number; percentUsed: number };
    daily: { tokens: number; maxTokens: number; percentUsed: number; costUSD: number; maxCostUSD: number };
    requests: number;
  } {
    this.checkDailyReset();
    return {
      session: {
        tokens: this.accumulator.sessionTokens,
        maxTokens: this.budget.maxTokensPerSession,
        percentUsed: (this.accumulator.sessionTokens / this.budget.maxTokensPerSession) * 100,
      },
      daily: {
        tokens: this.accumulator.dailyTokens,
        maxTokens: this.budget.maxTokensPerDay,
        percentUsed: (this.accumulator.dailyTokens / this.budget.maxTokensPerDay) * 100,
        costUSD: this.accumulator.dailyCostUSD,
        maxCostUSD: this.budget.maxCostPerDay,
      },
      requests: this.accumulator.requestCount,
    };
  }

  /**
   * Reset session usage (e.g., on new session)
   */
  resetSession(): void {
    this.accumulator.sessionTokens = 0;
    this.saveUsage();
  }

  /**
   * Estimate token count from text (rough approximation)
   */
  static estimateTokens(text: string): number {
    // ~4 chars per token for English text (approximation)
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost based on provider rates
   */
  static calculateCost(
    inputTokens: number,
    outputTokens: number,
    costPerInputToken: number,
    costPerOutputToken: number
  ): number {
    return (inputTokens * costPerInputToken) + (outputTokens * costPerOutputToken);
  }

  private checkDailyReset(): void {
    const today = new Date().toISOString().split('T')[0];
    if (this.accumulator.lastResetDate !== today) {
      this.accumulator.dailyTokens = 0;
      this.accumulator.dailyCostUSD = 0;
      this.accumulator.requestCount = 0;
      this.accumulator.lastResetDate = today;
      this.saveUsage();
    }
  }

  private loadUsage(): TokenUsageAccumulator {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // localStorage not available
    }
    return {
      sessionTokens: 0,
      dailyTokens: 0,
      dailyCostUSD: 0,
      requestCount: 0,
      lastResetDate: new Date().toISOString().split('T')[0],
    };
  }

  private saveUsage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.accumulator));
    } catch {
      // localStorage not available
    }
  }
}

// ============================================================================
// REQUEST DEDUPLICATOR
// ============================================================================

export class RequestDeduplicator {
  private inFlight = new Map<string, Promise<any>>();
  private recentResults = new Map<string, { result: any; timestamp: number }>();
  private readonly dedupeWindowMs: number;

  constructor(dedupeWindowMs: number = 5000) {
    this.dedupeWindowMs = dedupeWindowMs;
  }

  /**
   * Execute a function, deduplicating identical concurrent requests
   */
  async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Check recent results
    const recent = this.recentResults.get(key);
    if (recent && Date.now() - recent.timestamp < this.dedupeWindowMs) {
      return recent.result;
    }

    // Check in-flight requests
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key)!;
    }

    // Execute and track
    const promise = fn().then(result => {
      this.inFlight.delete(key);
      this.recentResults.set(key, { result, timestamp: Date.now() });
      this.cleanRecent();
      return result;
    }).catch(error => {
      this.inFlight.delete(key);
      throw error;
    });

    this.inFlight.set(key, promise);
    return promise;
  }

  private cleanRecent(): void {
    const now = Date.now();
    for (const [key, entry] of this.recentResults.entries()) {
      if (now - entry.timestamp > this.dedupeWindowMs * 2) {
        this.recentResults.delete(key);
      }
    }
  }
}

// ============================================================================
// RESPONSE CACHE
// ============================================================================

export class ResponseCache {
  private cache = new Map<string, { data: any; timestamp: number; hits: number }>();
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private eventBus: AIEventBus;

  constructor(eventBus: AIEventBus, maxSize: number = 200, ttlMs: number = 300000) {
    this.eventBus = eventBus;
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.eventBus.emit({ type: 'cache-miss', timestamp: new Date(), data: { key } });
      return null;
    }

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.eventBus.emit({ type: 'cache-miss', timestamp: new Date(), data: { key, reason: 'expired' } });
      return null;
    }

    entry.hits++;
    this.eventBus.emit({ type: 'cache-hit', timestamp: new Date(), data: { key, hits: entry.hits } });
    return entry.data;
  }

  set(key: string, data: any): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      let oldestKey = '';
      let oldestTime = Infinity;
      for (const [k, v] of this.cache.entries()) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, { data, timestamp: Date.now(), hits: 0 });
  }

  /**
   * Generate a cache key from request parameters
   */
  static generateKey(prompt: string, provider: string, model: string): string {
    // Simple hash for cache key
    const str = `${provider}:${model}:${prompt.trim().toLowerCase().slice(0, 500)}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `ai_cache_${Math.abs(hash).toString(36)}`;
  }

  getStats(): { size: number; maxSize: number; hitRate: number } {
    let totalHits = 0;
    let totalEntries = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      totalEntries++;
    }
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalEntries > 0 ? totalHits / totalEntries : 0,
    };
  }

  clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const defaultEventBus = new AIEventBus();
