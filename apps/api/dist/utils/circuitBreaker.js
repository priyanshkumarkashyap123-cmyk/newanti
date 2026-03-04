class CircuitBreakerOpenError extends Error {
  constructor(circuitName) {
    super(`Circuit breaker '${circuitName}' is OPEN \u2014 call rejected`);
    this.circuitName = circuitName;
    this.name = "CircuitBreakerOpenError";
  }
}
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 3e4;
    this.callTimeoutMs = options.callTimeoutMs ?? 1e4;
    this.successThreshold = options.successThreshold ?? 2;
    this.onStateChange = options.onStateChange;
  }
  state = "CLOSED";
  failures = 0;
  successes = 0;
  lastFailureTime = null;
  totalRequests = 0;
  totalFailures = 0;
  totalSuccesses = 0;
  totalRejected = 0;
  failureThreshold;
  resetTimeoutMs;
  callTimeoutMs;
  successThreshold;
  onStateChange;
  // ─── Public API ───────────────────────────────────────
  /**
   * Execute `fn` through the circuit breaker.
   * Rejects immediately if the circuit is OPEN.
   */
  async execute(fn) {
    this.totalRequests++;
    if (this.state === "OPEN") {
      if (this.shouldAttemptReset()) {
        this.transitionTo("HALF_OPEN");
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
  async executeWithFallback(fn, fallback) {
    try {
      return await this.execute(fn);
    } catch {
      return typeof fallback === "function" ? fallback() : fallback;
    }
  }
  /** Get current circuit stats for monitoring/health checks. */
  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      totalRejected: this.totalRejected
    };
  }
  /** Force-reset the circuit to CLOSED (admin override). */
  reset() {
    this.transitionTo("CLOSED");
    this.failures = 0;
    this.successes = 0;
  }
  // ─── Internal ─────────────────────────────────────────
  onSuccess() {
    this.totalSuccesses++;
    if (this.state === "HALF_OPEN") {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.transitionTo("CLOSED");
        this.failures = 0;
        this.successes = 0;
      }
    } else {
      this.failures = 0;
    }
  }
  onFailure() {
    this.totalFailures++;
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.state === "HALF_OPEN") {
      this.transitionTo("OPEN");
      this.successes = 0;
    } else if (this.failures >= this.failureThreshold) {
      this.transitionTo("OPEN");
    }
  }
  shouldAttemptReset() {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime >= this.resetTimeoutMs;
  }
  transitionTo(newState) {
    if (this.state !== newState) {
      const prev = this.state;
      this.state = newState;
      this.onStateChange?.(prev, newState, this.name);
    }
  }
  callWithTimeout(fn) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Circuit '${this.name}': call timed out after ${this.callTimeoutMs}ms`));
      }, this.callTimeoutMs);
      fn().then((result) => {
        clearTimeout(timer);
        resolve(result);
      }).catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}
const registry = /* @__PURE__ */ new Map();
function getCircuitBreaker(name, options) {
  let cb = registry.get(name);
  if (!cb) {
    cb = new CircuitBreaker(name, {
      ...options,
      onStateChange: (from, to, n) => {
        console.warn(`[circuit-breaker] ${n}: ${from} \u2192 ${to}`);
        options?.onStateChange?.(from, to, n);
      }
    });
    registry.set(name, cb);
  }
  return cb;
}
function getAllCircuitStats() {
  const result = {};
  for (const [name, cb] of registry) {
    result[name] = cb.getStats();
  }
  return result;
}
export {
  CircuitBreaker,
  CircuitBreakerOpenError,
  getAllCircuitStats,
  getCircuitBreaker
};
//# sourceMappingURL=circuitBreaker.js.map
