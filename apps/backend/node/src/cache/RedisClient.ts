import { createClient, RedisClientType, type RedisArgument } from "redis";
import { logger } from "../utils/logger.js";

type RedisClient = RedisClientType;

let redisClient: RedisClient | null = null;
let isConnecting = false;
let connectionPromise: Promise<RedisClient | null> | null = null;

const CACHE_NAMESPACE = (process.env.CACHE_NAMESPACE || 'beamlab:api').trim().replace(/:+$/, '');
const MAX_CACHE_KEY_LENGTH = Number(process.env.MAX_CACHE_KEY_LENGTH || 256);
const MAX_CACHE_VALUE_BYTES = Number(process.env.MAX_CACHE_VALUE_BYTES || 1024 * 1024);

function normalizeKey(key: string): string {
  const trimmed = String(key || '').trim();
  if (!trimmed) {
    throw new Error('Cache key must be non-empty');
  }
  if (trimmed.length > MAX_CACHE_KEY_LENGTH) {
    throw new Error(`Cache key length exceeds limit (${MAX_CACHE_KEY_LENGTH})`);
  }
  return `${CACHE_NAMESPACE}:${trimmed}`;
}

function normalizePattern(pattern: string): string {
  const trimmed = String(pattern || '').trim();
  if (!trimmed) {
    throw new Error('Cache pattern must be non-empty');
  }
  return `${CACHE_NAMESPACE}:${trimmed}`;
}

function serializeCacheValue(value: unknown): string {
  const serialized = JSON.stringify(value);
  const byteLength = Buffer.byteLength(serialized, 'utf8');
  if (byteLength > MAX_CACHE_VALUE_BYTES) {
    throw new Error(`Cache payload too large (${byteLength} bytes > ${MAX_CACHE_VALUE_BYTES} bytes)`);
  }
  return serialized;
}

// (Reserved for future formatting helpers)

/**
 * Initialize Redis client with connection pooling
 * Implements singleton pattern with lazy initialization
 */
export async function initializeRedisClient(): Promise<RedisClient | null> {
  // Return existing client if already connected
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  // Return pending connection if already connecting
  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }

  isConnecting = true;

  connectionPromise = (async () => {
    try {
      const redisUrl =
        process.env.REDIS_URL ||
        process.env.REDIS_CONNECTION_STRING ||
        "redis://localhost:6379";

      redisClient = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error("[Redis] Max reconnection attempts reached");
              return new Error("Redis max retries exceeded");
            }
            return retries * 100; // Exponential backoff
          },
          connectTimeout: 10000,
          keepAlive: true,
        },
      });

      // Event listeners
      redisClient.on("error", (err: unknown) => {
        logger.error({ err }, "[Redis] Client error");
      });

      redisClient.on("connect", () => {
        logger.info("[Redis] Client connected");
      });

      redisClient.on("ready", () => {
        logger.info("[Redis] Client ready");
      });

      redisClient.on("reconnecting", () => {
        logger.warn("[Redis] Client reconnecting");
      });

      await redisClient.connect();
      isConnecting = false;
      logger.info("[Redis] Successfully connected to Redis");
      return redisClient;
    } catch (error) {
      isConnecting = false;
      logger.error({ err: error }, "[Redis] Failed to connect");
      // Fallback: return null client that doesn't cache
      return null;
    }
  })();

  return connectionPromise;
}

/**
 * Get Redis client instance
 * Returns null if Redis is unavailable (graceful degradation)
 */
export function getRedisClient(): RedisClient | null {
  return redisClient;
}

/**
 * Set value in cache with TTL
 * @param key Cache key
 * @param value Value to cache (will be JSON stringified)
 * @param ttlSeconds Time to live in seconds
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number = 3600
): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (!client || !client.isOpen) {
      return false; // Gracefully skip caching if Redis unavailable
    }

    const normalizedKey = normalizeKey(key);
    const serialized = serializeCacheValue(value);
    const safeTtlSeconds = Math.max(1, Math.floor(ttlSeconds));
    await client.setEx(normalizedKey, safeTtlSeconds, serialized);
    return true;
  } catch (error) {
    logger.warn({ err: error, key }, `[Cache] Failed to set key ${key}`);
    return false;
  }
}

/**
 * Get value from cache
 * @param key Cache key
 * @returns Cached value or null if not found
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    if (!client || !client.isOpen) {
      return null; // Return null if Redis unavailable
    }

    const normalizedKey = normalizeKey(key);
    const value = await client.get(normalizedKey);
    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch (error) {
    logger.warn({ err: error, key }, `[Cache] Failed to get key ${key}`);
    return null;
  }
}

/**
 * Delete key from cache
 * @param key Cache key
 */
export async function cacheDel(key: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (!client || !client.isOpen) {
      return false;
    }

    const normalizedKey = normalizeKey(key);
    const result = await client.del(normalizedKey as RedisArgument);
    return result > 0;
  } catch (error) {
    logger.warn({ err: error, key }, `[Cache] Failed to delete key ${key}`);
    return false;
  }
}

/**
 * Delete multiple keys matching a pattern
 * @param pattern Key pattern (e.g., "analysis:*")
 */
export async function cacheDelPattern(pattern: string): Promise<number> {
  try {
    const client = getRedisClient();
    if (!client || !client.isOpen) {
      return 0;
    }

    const normalizedPattern = normalizePattern(pattern);

    let keys: string[] = [];
    let cursor = "0";

    // Use SCAN to iterate keys matching pattern (non-blocking)
    do {
      const res = await client.scan(cursor, { MATCH: normalizedPattern, COUNT: 100 });
      cursor = res.cursor;
      keys = keys.concat(res.keys);
    } while (cursor !== "0");

    if (keys.length === 0) {
      return 0;
    }

    // Delete all found keys
    const result = await client.del(keys as RedisArgument[]);
    return result;
  } catch (error) {
    logger.warn({ err: error, pattern }, `[Cache] Failed to delete pattern ${pattern}`);
    return 0;
  }
}

/**
 * Check if key exists in cache
 * @param key Cache key
 */
export async function cacheExists(key: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    if (!client || !client.isOpen) {
      return false;
    }

    const normalizedKey = normalizeKey(key);
    const exists = await client.exists(normalizedKey as RedisArgument);
    return exists > 0;
  } catch (error) {
    logger.warn({ err: error, key }, `[Cache] Failed to check key ${key}`);
    return false;
  }
}

/**
 * Get cache statistics
 * Returns info about Redis memory usage, connected clients, etc.
 */
export async function getCacheStats(): Promise<Record<string, string> | null> {
  try {
    const client = getRedisClient();
    if (!client || !client.isOpen) {
      return null;
    }

    const info = await client.info("stats");
    const memory = await client.info("memory");
    const clients = await client.info("clients");

    return {
      stats: info,
      memory,
      clients,
    };
  } catch (error) {
    logger.warn({ err: error }, "[Cache] Failed to get stats");
    return null;
  }
}

/**
 * Gracefully disconnect Redis client
 */
export async function disconnectRedisClient(): Promise<void> {
  try {
    const client = getRedisClient();
    if (client && client.isOpen) {
      await client.disconnect();
      logger.info("[Redis] Client disconnected");
    }
  } catch (error) {
    logger.error({ err: error }, "[Redis] Error disconnecting");
  }
}
