/**
 * Analysis Result Cache
 *
 * An in-process LRU cache keyed by SHA-256 of the serialised analysis model
 * payload. Identical models submitted by the same or different users skip the
 * Rust proxy entirely and receive the cached result instantly.
 *
 * Design choices:
 * - Pure in-memory Map — no additional infrastructure dependency.
 * - LRU eviction: when capacity is reached the oldest-accessed entry is dropped.
 * - TTL enforced at get-time (lazy eviction) rather than via setInterval timers
 *   so the cache has zero background overhead.
 * - Thread-safe by Node.js event-loop single-threading; no locks needed.
 *
 * Sizing defaults (configurable via env):
 *   ANALYSIS_CACHE_MAX_ENTRIES  = 500
 *   ANALYSIS_CACHE_TTL_MS       = 600_000  (10 minutes)
 */

import { createHash } from "node:crypto";
import logger from "./logger.js";

function envInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const MAX_ENTRIES = envInt("ANALYSIS_CACHE_MAX_ENTRIES", 500);
const TTL_MS = envInt("ANALYSIS_CACHE_TTL_MS", 600_000);

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

/**
 * Minimal LRU cache backed by an insertion-ordered Map. On every read the
 * entry is deleted and re-inserted so it moves to the "most recent" position.
 * When capacity is exceeded the first (oldest) key is evicted.
 */
class LruCache<T> {
  private map = new Map<string, CacheEntry<T>>();
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      this.misses += 1;
      return undefined;
    }
    // LRU: move to end (most recently used)
    this.map.delete(key);
    this.map.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      // Evict the oldest entry (first key in insertion order)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
        this.evictions += 1;
      }
    }
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(key: string): boolean {
    return this.map.delete(key);
  }

  stats() {
    return {
      size: this.map.size,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: this.hits + this.misses > 0
        ? Number(((this.hits / (this.hits + this.misses)) * 100).toFixed(1))
        : 0,
    };
  }
}

// Singleton cache instance — shared across all analysis request handlers
const resultCache = new LruCache<unknown>(MAX_ENTRIES, TTL_MS);

/**
 * Compute a deterministic cache key from an arbitrary analysis model object.
 * The key is the first 16 hex characters of SHA-256(JSON.stringify(model)).
 * Sufficient for cache keying; not suitable for cryptographic purposes.
 */
export function cacheKey(model: unknown): string {
  const serialised = JSON.stringify(model);
  return createHash("sha256").update(serialised).digest("hex").slice(0, 32);
}

/**
 * Retrieve a cached analysis result.
 * Returns undefined on cache miss or TTL expiry.
 */
export function getCachedResult<T = unknown>(key: string): T | undefined {
  return resultCache.get(key) as T | undefined;
}

/**
 * Store an analysis result. The caller is responsible for providing the same
 * key that was used in getCachedResult().
 */
export function setCachedResult(key: string, value: unknown): void {
  resultCache.set(key, value);
}

/**
 * Expose cache statistics for the /health endpoint and monitoring.
 */
export function getCacheStats() {
  return resultCache.stats();
}

/**
 * Wrap a handler so that results are read from / written to cache automatically.
 *
 *   await withCache(cacheKey(model), () => rustProxy(...));
 *
 * Returns the cached value (if fresh) or the result of fn(), caching it on
 * success. On error, the error propagates; nothing is cached for failures.
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  shouldCache: (result: T) => boolean = () => true,
): Promise<{ result: T; fromCache: boolean }> {
  const cached = getCachedResult<T>(key);
  if (cached !== undefined) {
    logger.debug({ key }, "analysis_cache: hit");
    return { result: cached, fromCache: true };
  }

  const result = await fn();
  if (shouldCache(result)) {
    setCachedResult(key, result);
    logger.debug({ key }, "analysis_cache: stored");
  }
  return { result, fromCache: false };
}
