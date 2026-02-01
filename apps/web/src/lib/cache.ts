/**
 * Caching Layer
 * Industry-standard client-side caching with multiple strategies
 * 
 * Features:
 * - Multiple cache backends (Memory, LocalStorage, IndexedDB)
 * - TTL (Time To Live) support
 * - LRU (Least Recently Used) eviction
 * - Cache invalidation patterns
 * - Stale-while-revalidate
 * - Request deduplication
 */

// ============================================================================
// Types
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  hits: number;
  lastAccessed: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
  staleWhileRevalidate?: boolean;
  onEvict?: (key: string, value: unknown) => void;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

type CacheBackend = 'memory' | 'localStorage' | 'indexedDB';

// ============================================================================
// Memory Cache
// ============================================================================

export class MemoryCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private options: Required<CacheOptions>;
  private stats: CacheStats = { hits: 0, misses: 0, size: 0, hitRate: 0 };

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: options.ttl ?? 5 * 60 * 1000, // 5 minutes default
      maxSize: options.maxSize ?? 100,
      staleWhileRevalidate: options.staleWhileRevalidate ?? false,
      onEvict: options.onEvict ?? (() => {}),
    };
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      if (!this.options.staleWhileRevalidate) {
        this.delete(key);
        this.stats.misses++;
        this.updateHitRate();
        return undefined;
      }
    }

    // Update access stats
    entry.hits++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;
    this.updateHitRate();
    
    return entry.data;
  }

  set(key: string, data: T, ttl?: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + (ttl ?? this.options.ttl),
      hits: 0,
      lastAccessed: now,
    };

    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.options.onEvict(key, entry.data);
    }
    const deleted = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return deleted;
  }

  clear(): void {
    this.cache.forEach((entry, key) => {
      this.options.onEvict(key, entry.data);
    });
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, size: 0, hitRate: 0 };
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestAccess = Infinity;

    this.cache.forEach((entry, key) => {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  // Cleanup expired entries
  cleanup(): number {
    let removed = 0;
    const now = Date.now();
    
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        this.delete(key);
        removed++;
      }
    });
    
    return removed;
  }
}

// ============================================================================
// LocalStorage Cache
// ============================================================================

export class LocalStorageCache<T = unknown> {
  private prefix: string;
  private options: Required<CacheOptions>;

  constructor(prefix = 'cache:', options: CacheOptions = {}) {
    this.prefix = prefix;
    this.options = {
      ttl: options.ttl ?? 24 * 60 * 60 * 1000, // 24 hours default
      maxSize: options.maxSize ?? 50,
      staleWhileRevalidate: options.staleWhileRevalidate ?? false,
      onEvict: options.onEvict ?? (() => {}),
    };
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  get(key: string): T | undefined {
    try {
      const raw = localStorage.getItem(this.getKey(key));
      if (!raw) return undefined;

      const entry: CacheEntry<T> = JSON.parse(raw);
      
      if (Date.now() > entry.expiresAt) {
        if (!this.options.staleWhileRevalidate) {
          this.delete(key);
          return undefined;
        }
      }

      return entry.data;
    } catch {
      return undefined;
    }
  }

  set(key: string, data: T, ttl?: number): void {
    try {
      const now = Date.now();
      const entry: CacheEntry<T> = {
        data,
        timestamp: now,
        expiresAt: now + (ttl ?? this.options.ttl),
        hits: 0,
        lastAccessed: now,
      };

      localStorage.setItem(this.getKey(key), JSON.stringify(entry));
    } catch (e) {
      // Storage might be full, try to evict old entries
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        this.cleanup();
        try {
          const now = Date.now();
          const entry: CacheEntry<T> = {
            data,
            timestamp: now,
            expiresAt: now + (ttl ?? this.options.ttl),
            hits: 0,
            lastAccessed: now,
          };
          localStorage.setItem(this.getKey(key), JSON.stringify(entry));
        } catch {
          // Still failing, give up
        }
      }
    }
  }

  delete(key: string): boolean {
    const fullKey = this.getKey(key);
    const exists = localStorage.getItem(fullKey) !== null;
    localStorage.removeItem(fullKey);
    return exists;
  }

  clear(): void {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  cleanup(): number {
    let removed = 0;
    const now = Date.now();
    
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const entry: CacheEntry<T> = JSON.parse(raw);
            if (now > entry.expiresAt) {
              localStorage.removeItem(key);
              removed++;
            }
          }
        } catch {
          // Invalid entry, remove it
          localStorage.removeItem(key);
          removed++;
        }
      }
    }
    
    return removed;
  }
}

// ============================================================================
// Request Deduplication
// ============================================================================

const pendingRequests = new Map<string, Promise<unknown>>();

export async function deduplicateRequest<T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> {
  // Check if there's already a pending request for this key
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>;
  }

  // Create new request
  const promise = requestFn().finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
}

// ============================================================================
// Cached Fetch Utility
// ============================================================================

interface CachedFetchOptions extends CacheOptions {
  backend?: CacheBackend;
  cacheKey?: string;
}

const memoryCache = new MemoryCache<unknown>();
const localStorageCache = new LocalStorageCache<unknown>();

export async function cachedFetch<T>(
  url: string,
  fetchOptions?: RequestInit,
  cacheOptions?: CachedFetchOptions
): Promise<T> {
  const key = cacheOptions?.cacheKey ?? url;
  const backend = cacheOptions?.backend ?? 'memory';
  
  // Select cache backend
  const cache = backend === 'localStorage' ? localStorageCache : memoryCache;

  // Check cache first
  const cached = cache.get(key) as T | undefined;
  if (cached !== undefined) {
    // Stale-while-revalidate: return cached but refresh in background
    if (cacheOptions?.staleWhileRevalidate) {
      deduplicateRequest(key, async () => {
        const response = await fetch(url, fetchOptions);
        const data = await response.json();
        cache.set(key, data, cacheOptions?.ttl);
        return data;
      }).catch(() => {});
    }
    return cached;
  }

  // Deduplicate concurrent requests
  const data = await deduplicateRequest(key, async () => {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  });

  // Store in cache
  cache.set(key, data, cacheOptions?.ttl);
  
  return data as T;
}

// ============================================================================
// Cache Invalidation Patterns
// ============================================================================

export class CacheInvalidator {
  private patterns: Map<string, Set<string>> = new Map();

  /**
   * Register a cache key with tags for invalidation
   */
  tag(key: string, tags: string[]): void {
    tags.forEach(tag => {
      if (!this.patterns.has(tag)) {
        this.patterns.set(tag, new Set());
      }
      this.patterns.get(tag)!.add(key);
    });
  }

  /**
   * Get all cache keys associated with a tag
   */
  getKeysByTag(tag: string): string[] {
    return Array.from(this.patterns.get(tag) ?? []);
  }

  /**
   * Invalidate all cache entries with given tag
   */
  invalidateByTag(tag: string, cache: MemoryCache | LocalStorageCache): void {
    const keys = this.getKeysByTag(tag);
    keys.forEach(key => cache.delete(key));
    this.patterns.delete(tag);
  }

  /**
   * Clear all patterns
   */
  clear(): void {
    this.patterns.clear();
  }
}

// ============================================================================
// React Hook for Caching
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseCachedDataOptions<T> extends CacheOptions {
  key: string;
  fetcher: () => Promise<T>;
  enabled?: boolean;
  refetchInterval?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseCachedDataReturn<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  isStale: boolean;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

export function useCachedData<T>(options: UseCachedDataOptions<T>): UseCachedDataReturn<T> {
  const {
    key,
    fetcher,
    enabled = true,
    ttl = 5 * 60 * 1000,
    refetchInterval,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T | undefined>(() => memoryCache.get(key) as T | undefined);
  const [isLoading, setIsLoading] = useState(!data);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await deduplicateRequest(key, fetcherRef.current);
      
      memoryCache.set(key, result, ttl);
      setData(result);
      setIsStale(false);
      onSuccess?.(result);
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Unknown error');
      setError(err);
      onError?.(err);
    } finally {
      setIsLoading(false);
    }
  }, [key, ttl, onSuccess, onError]);

  const invalidate = useCallback(() => {
    memoryCache.delete(key);
    setIsStale(true);
  }, [key]);

  useEffect(() => {
    if (!enabled) return;
    
    // Fetch if no cached data
    if (!data) {
      fetchData();
    }
  }, [enabled, key]);

  useEffect(() => {
    if (!enabled || !refetchInterval) return;

    const intervalId = setInterval(fetchData, refetchInterval);
    return () => clearInterval(intervalId);
  }, [enabled, refetchInterval, fetchData]);

  return {
    data,
    isLoading,
    error,
    isStale,
    refetch: fetchData,
    invalidate,
  };
}

// ============================================================================
// Export cache instances for global use
// ============================================================================

export const cache = {
  memory: memoryCache,
  localStorage: localStorageCache,
  invalidator: new CacheInvalidator(),
};
