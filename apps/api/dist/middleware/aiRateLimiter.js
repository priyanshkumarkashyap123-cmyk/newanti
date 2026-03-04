const ENDPOINT_LIMITS = {
  "/generate": { maxRequests: 10, windowMs: 6e4, costWeight: 3, message: "Structure generation rate limit exceeded" },
  "/chat": { maxRequests: 30, windowMs: 6e4, costWeight: 1 },
  "/validate": { maxRequests: 60, windowMs: 6e4, costWeight: 0.5 },
  "/code-check": { maxRequests: 20, windowMs: 6e4, costWeight: 2 },
  "/accuracy": { maxRequests: 30, windowMs: 6e4, costWeight: 0.5 },
  "/diagnose": { maxRequests: 15, windowMs: 6e4, costWeight: 2 },
  "/auto-fix": { maxRequests: 10, windowMs: 6e4, costWeight: 3 },
  "/modify": { maxRequests: 15, windowMs: 6e4, costWeight: 2 },
  "/sketch": { maxRequests: 5, windowMs: 6e4, costWeight: 5 },
  default: { maxRequests: 30, windowMs: 6e4, costWeight: 1 }
};
const GLOBAL_LIMIT = {
  maxRequests: 100,
  windowMs: 6e4,
  costWeight: 1,
  message: "Global AI rate limit exceeded. Please wait before making more requests."
};
class RateLimitStore {
  windows = /* @__PURE__ */ new Map();
  cleanupInterval;
  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 6e4);
  }
  /**
   * Record a request and check if within limits
   */
  check(key, config) {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    let records = this.windows.get(key) || [];
    records = records.filter((r) => r.timestamp > windowStart);
    const totalCost = records.reduce((sum, r) => sum + r.cost, 0);
    const remaining = Math.max(0, config.maxRequests - totalCost);
    const oldestInWindow = records.length > 0 ? records[0].timestamp : now;
    const resetAt = oldestInWindow + config.windowMs;
    if (totalCost >= config.maxRequests) {
      this.windows.set(key, records);
      return { allowed: false, remaining: 0, resetAt };
    }
    records.push({ timestamp: now, cost: config.costWeight });
    this.windows.set(key, records);
    return { allowed: true, remaining: Math.max(0, config.maxRequests - totalCost - config.costWeight), resetAt };
  }
  cleanup() {
    const now = Date.now();
    const maxWindow = Math.max(...Object.values(ENDPOINT_LIMITS).map((c) => c.windowMs), GLOBAL_LIMIT.windowMs);
    for (const [key, records] of this.windows.entries()) {
      const active = records.filter((r) => r.timestamp > now - maxWindow);
      if (active.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, active);
      }
    }
  }
  /** Get current state for a key (for monitoring) */
  getUsage(key, windowMs) {
    const records = this.windows.get(key) || [];
    const windowStart = Date.now() - windowMs;
    return records.filter((r) => r.timestamp > windowStart).reduce((sum, r) => sum + r.cost, 0);
  }
  destroy() {
    clearInterval(this.cleanupInterval);
    this.windows.clear();
  }
}
const store = new RateLimitStore();
function getClientId(req) {
  const apiKey = req.headers["x-api-key"];
  if (apiKey) {
    return `key:${apiKey.slice(0, 16)}`;
  }
  const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  return `ip:${ip}`;
}
function getEndpointCategory(path) {
  for (const endpoint of Object.keys(ENDPOINT_LIMITS)) {
    if (endpoint !== "default" && path.includes(endpoint)) {
      return endpoint;
    }
  }
  return "default";
}
function aiRateLimiter(customConfig) {
  const limits = { ...ENDPOINT_LIMITS, ...customConfig };
  return (req, res, next) => {
    const clientId = getClientId(req);
    const endpointCategory = getEndpointCategory(req.path);
    const config = limits[endpointCategory] || limits.default;
    const endpointKey = `${clientId}:${endpointCategory}`;
    const endpointResult = store.check(endpointKey, config);
    const globalKey = `${clientId}:global`;
    const globalResult = store.check(globalKey, GLOBAL_LIMIT);
    res.setHeader("X-RateLimit-Limit", config.maxRequests.toString());
    res.setHeader("X-RateLimit-Remaining", Math.min(endpointResult.remaining, globalResult.remaining).toString());
    res.setHeader("X-RateLimit-Reset", Math.max(endpointResult.resetAt, globalResult.resetAt).toString());
    if (!endpointResult.allowed) {
      console.warn(`[RateLimit] Endpoint limit hit: ${clientId} on ${endpointCategory}`);
      res.setHeader("Retry-After", Math.ceil((endpointResult.resetAt - Date.now()) / 1e3).toString());
      return res.status(429).json({
        success: false,
        error: config.message || `Rate limit exceeded for ${endpointCategory}. Try again later.`,
        retryAfter: Math.ceil((endpointResult.resetAt - Date.now()) / 1e3)
      });
    }
    if (!globalResult.allowed) {
      console.warn(`[RateLimit] Global limit hit: ${clientId}`);
      res.setHeader("Retry-After", Math.ceil((globalResult.resetAt - Date.now()) / 1e3).toString());
      return res.status(429).json({
        success: false,
        error: GLOBAL_LIMIT.message,
        retryAfter: Math.ceil((globalResult.resetAt - Date.now()) / 1e3)
      });
    }
    next();
  };
}
function getAIRateLimitStats(clientId) {
  const stats = {};
  for (const [endpoint, config] of Object.entries(ENDPOINT_LIMITS)) {
    const key = `${clientId}:${endpoint}`;
    stats[endpoint] = {
      usage: store.getUsage(key, config.windowMs),
      limit: config.maxRequests
    };
  }
  stats.global = {
    usage: store.getUsage(`${clientId}:global`, GLOBAL_LIMIT.windowMs),
    limit: GLOBAL_LIMIT.maxRequests
  };
  return stats;
}
var aiRateLimiter_default = aiRateLimiter;
export {
  aiRateLimiter,
  aiRateLimiter_default as default,
  getAIRateLimitStats
};
//# sourceMappingURL=aiRateLimiter.js.map
