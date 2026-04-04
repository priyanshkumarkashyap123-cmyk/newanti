/**
 * CircuitBreaker – Lightweight circuit breaker for external service calls.
 *
 * Implements the standard states: CLOSED → OPEN → HALF_OPEN → CLOSED.
 *
 * Usage:
 *   const googleBreaker = new CircuitBreaker('google-oauth', { failureThreshold: 3, resetTimeoutMs: 30_000 });
 *   const result = await googleBreaker.execute(() => axios.get('https://...'));
 *
 * When the circuit is OPEN, calls are rejected immediately without hitting
 * the external service, preventing cascade failures.
 */

import { logger } from './logger.js';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
    /** Number of consecutive failures before opening the circuit (default: 5) */
    failureThreshold?: number;
    /** How long to wait (ms) before transitioning OPEN → HALF_OPEN (default: 30s) */
    resetTimeoutMs?: number;
    /** Maximum time (ms) to wait for a single call before treating it as a failure (default: 10s) */
    callTimeoutMs?: number;
    /** Number of successful probe calls in HALF_OPEN before closing the circuit (default: 2) */
    successThreshold?: number;
    /** Optional callback when state changes */
    onStateChange?: (from: CircuitState, to: CircuitState, name: string) => void;
}

interface CircuitStats {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureTime: number | null;
    totalRequests: number;
    totalFailures: number;
    totalSuccesses: number;
    totalRejected: number;
}

export class CircuitBreakerOpenError extends Error {
    constructor(public readonly circuitName: string) {
        super(`Circuit breaker '${circuitName}' is OPEN — call rejected`);
        this.name = 'CircuitBreakerOpenError';
    }
}

export class CircuitBreaker {
    private state: CircuitState = 'CLOSED';
    private failures = 0;
    private successes = 0;
    private lastFailureTime: number | null = null;
    private totalRequests = 0;
    private totalFailures = 0;
    private totalSuccesses = 0;
    private totalRejected = 0;

    private readonly failureThreshold: number;
    private readonly resetTimeoutMs: number;
    private readonly callTimeoutMs: number;
    private readonly successThreshold: number;
    private readonly onStateChange?: CircuitBreakerOptions['onStateChange'];

    constructor(
        public readonly name: string,
        options: CircuitBreakerOptions = {},
    ) {
        this.failureThreshold = options.failureThreshold ?? 5;
        this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
        this.callTimeoutMs = options.callTimeoutMs ?? 10_000;
        this.successThreshold = options.successThreshold ?? 2;
        this.onStateChange = options.onStateChange;
    }

    // ─── Public API ───────────────────────────────────────

    /**
     * Execute `fn` through the circuit breaker.
     * Rejects immediately if the circuit is OPEN.
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        this.totalRequests++;

        if (this.state === 'OPEN') {
            if (this.shouldAttemptReset()) {
                this.transitionTo('HALF_OPEN');
            } else {
                this.totalRejected++;
                throw new CircuitBreakerOpenError(this.name);
            }
        }

        try {
            const result = await this.callWithTimeout(fn);
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    /**
     * Execute `fn` with a fallback value if the circuit is OPEN or the call fails.
     */
    async executeWithFallback<T>(fn: () => Promise<T>, fallback: T | (() => T)): Promise<T> {
        try {
            return await this.execute(fn);
        } catch {
            return typeof fallback === 'function' ? (fallback as () => T)() : fallback;
        }
    }

    /** Get current circuit stats for monitoring/health checks. */
    getStats(): CircuitStats {
        return {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            lastFailureTime: this.lastFailureTime,
            totalRequests: this.totalRequests,
            totalFailures: this.totalFailures,
            totalSuccesses: this.totalSuccesses,
            totalRejected: this.totalRejected,
        };
    }

    /** Force-reset the circuit to CLOSED (admin override). */
    reset(): void {
        this.transitionTo('CLOSED');
        this.failures = 0;
        this.successes = 0;
    }

    // ─── Internal ─────────────────────────────────────────

    private onSuccess(): void {
        this.totalSuccesses++;

        if (this.state === 'HALF_OPEN') {
            this.successes++;
            if (this.successes >= this.successThreshold) {
                this.transitionTo('CLOSED');
                this.failures = 0;
                this.successes = 0;
            }
        } else {
            // In CLOSED state, reset failure count on success
            this.failures = 0;
        }
    }

    private onFailure(): void {
        this.totalFailures++;
        this.failures++;
        this.lastFailureTime = Date.now();

        if (this.state === 'HALF_OPEN') {
            // Any failure in HALF_OPEN reopens the circuit
            this.transitionTo('OPEN');
            this.successes = 0;
        } else if (this.failures >= this.failureThreshold) {
            this.transitionTo('OPEN');
        }
    }

    private shouldAttemptReset(): boolean {
        if (!this.lastFailureTime) return true;
        return Date.now() - this.lastFailureTime >= this.resetTimeoutMs;
    }

    private transitionTo(newState: CircuitState): void {
        if (this.state !== newState) {
            const prev = this.state;
            this.state = newState;
            this.onStateChange?.(prev, newState, this.name);
        }
    }

    private callWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Circuit '${this.name}': call timed out after ${this.callTimeoutMs}ms`));
            }, this.callTimeoutMs);

            fn()
                .then((result) => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch((err) => {
                    clearTimeout(timer);
                    reject(err);
                });
        });
    }
}

// ============================================
// SINGLETON REGISTRY
// ============================================

const registry = new Map<string, CircuitBreaker>();

/**
 * Get or create a named circuit breaker.
 * Same name always returns the same instance.
 */
export function getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    let cb = registry.get(name);
    if (!cb) {
        cb = new CircuitBreaker(name, {
            ...options,
            onStateChange: (from, to, n) => {
                logger.warn(`[circuit-breaker] ${n}: ${from} -> ${to}`);
                options?.onStateChange?.(from, to, n);
            },
        });
        registry.set(name, cb);
    }
    return cb;
}

/** Get stats for all registered circuit breakers (useful for /health endpoint). */
export function getAllCircuitStats(): Record<string, CircuitStats> {
    const result: Record<string, CircuitStats> = {};
    for (const [name, cb] of registry) {
        result[name] = cb.getStats();
    }
    return result;
}
