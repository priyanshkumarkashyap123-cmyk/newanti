/**
 * ============================================================================
 * CALCULATION CACHE - PHASE 2
 * ============================================================================
 * 
 * High-performance caching for engineering calculations:
 * - Content-addressed cache (hash of inputs)
 * - LRU eviction policy
 * - TTL support
 * - Memory limit enforcement
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  hits: number;
  sizeBytes: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  entries: number;
  sizeBytes: number;
  maxSizeBytes: number;
}

export interface CacheConfig {
  maxEntries?: number;        // Max number of entries (default: 1000)
  maxSizeBytes?: number;      // Max total size in bytes (default: 50MB)
  defaultTTL?: number;        // Default TTL in ms (default: 1 hour)
  onEvict?: (key: string, value: unknown) => void;
}

// ============================================================================
// HASH FUNCTION
// ============================================================================

function hashInputs(inputs: unknown): string {
  const json = JSON.stringify(inputs, Object.keys(inputs as object).sort());
  // Simple djb2 hash
  let hash = 5381;
  for (let i = 0; i < json.length; i++) {
    hash = ((hash << 5) + hash) ^ json.charCodeAt(i);
  }
  return 'calc_' + Math.abs(hash).toString(36);
}

function estimateSize(value: unknown): number {
  // Rough estimate of object size in bytes
  const json = JSON.stringify(value);
  return json.length * 2; // UTF-16
}

// ============================================================================
// LRU CACHE IMPLEMENTATION
// ============================================================================

export class CalculationCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private accessOrder: string[] = [];
  private config: Required<CacheConfig>;
  private stats = { hits: 0, misses: 0 };
  private currentSizeBytes = 0;

  constructor(config: CacheConfig = {}) {
    this.config = {
      maxEntries: config.maxEntries ?? 1000,
      maxSizeBytes: config.maxSizeBytes ?? 50 * 1024 * 1024, // 50MB
      defaultTTL: config.defaultTTL ?? 60 * 60 * 1000, // 1 hour
      onEvict: config.onEvict ?? (() => {}),
    };
  }

  /**
   * Get cached result or undefined
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      this.stats.misses++;
      return undefined;
    }

    // Update access order (move to end)
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
      this.accessOrder.push(key);
    }

    entry.hits++;
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Store result in cache
   */
  set(key: string, value: T, ttl?: number): void {
    const sizeBytes = estimateSize(value);
    const expiresAt = Date.now() + (ttl ?? this.config.defaultTTL);

    // Evict if over limits
    while (
      (this.cache.size >= this.config.maxEntries ||
        this.currentSizeBytes + sizeBytes > this.config.maxSizeBytes) &&
      this.accessOrder.length > 0
    ) {
      this.evictOldest();
    }

    // Delete existing entry if present
    if (this.cache.has(key)) {
      this.delete(key);
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: Date.now(),
      expiresAt,
      hits: 0,
      sizeBytes,
    };

    this.cache.set(key, entry);
    this.accessOrder.push(key);
    this.currentSizeBytes += sizeBytes;
  }

  /**
   * Compute if absent - the main API for caching calculations
   */
  async computeIfAbsent(
    inputs: unknown,
    compute: () => T | Promise<T>,
    ttl?: number
  ): Promise<T> {
    const key = hashInputs(inputs);
    const cached = this.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = await compute();
    this.set(key, result, ttl);
    return result;
  }

  /**
   * Delete entry
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.currentSizeBytes -= entry.sizeBytes;

    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }

    this.config.onEvict(key, entry.value);
    return true;
  }

  /**
   * Evict oldest entry (LRU)
   */
  private evictOldest(): void {
    const oldest = this.accessOrder.shift();
    if (oldest) {
      this.delete(oldest);
    }
  }

  /**
   * Clear all entries
   */
  clear(): void {
    for (const key of Array.from(this.cache.keys())) {
      this.delete(key);
    }
  }

  /**
   * Clear expired entries
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.delete(key);
        pruned++;
      }
    }

    return pruned;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? Math.round((this.stats.hits / total) * 100) / 100 : 0,
      entries: this.cache.size,
      sizeBytes: this.currentSizeBytes,
      maxSizeBytes: this.config.maxSizeBytes,
    };
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }
    return true;
  }
}

// ============================================================================
// DOMAIN-SPECIFIC CACHES
// ============================================================================

// Structural analysis cache (longer TTL - results rarely change for same inputs)
export const structuralCache = new CalculationCache({
  maxEntries: 500,
  maxSizeBytes: 30 * 1024 * 1024,
  defaultTTL: 2 * 60 * 60 * 1000, // 2 hours
});

// Seismic analysis cache
export const seismicCache = new CalculationCache({
  maxEntries: 200,
  maxSizeBytes: 10 * 1024 * 1024,
  defaultTTL: 60 * 60 * 1000, // 1 hour
});

// Modal analysis cache (computationally expensive)
export const modalCache = new CalculationCache({
  maxEntries: 100,
  maxSizeBytes: 20 * 1024 * 1024,
  defaultTTL: 4 * 60 * 60 * 1000, // 4 hours
});

// Geotechnical cache
export const geotechCache = new CalculationCache({
  maxEntries: 200,
  maxSizeBytes: 10 * 1024 * 1024,
  defaultTTL: 60 * 60 * 1000, // 1 hour
});

// ============================================================================
// CACHE UTILITIES
// ============================================================================

/**
 * Prune all caches
 */
export function pruneAllCaches(): { total: number; byCache: Record<string, number> } {
  const structural = structuralCache.prune();
  const seismic = seismicCache.prune();
  const modal = modalCache.prune();
  const geotech = geotechCache.prune();

  return {
    total: structural + seismic + modal + geotech,
    byCache: { structural, seismic, modal, geotech },
  };
}

/**
 * Get all cache stats
 */
export function getAllCacheStats(): Record<string, CacheStats> {
  return {
    structural: structuralCache.getStats(),
    seismic: seismicCache.getStats(),
    modal: modalCache.getStats(),
    geotech: geotechCache.getStats(),
  };
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  structuralCache.clear();
  seismicCache.clear();
  modalCache.clear();
  geotechCache.clear();
}

// Auto-prune every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    pruneAllCaches();
  }, 10 * 60 * 1000);
}
