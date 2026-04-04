/**
 * ============================================================================
 * PERSISTENT AI AUDIT TRAIL
 * ============================================================================
 * 
 * Production-grade audit logging for all AI operations with:
 * - IndexedDB persistence (survives page refresh/close)
 * - Configurable retention policies
 * - Export/query capabilities
 * - User feedback collection
 * - Performance analytics
 * - Compliance-ready audit logs
 * 
 * @version 1.0.0
 */

import type {
  AIAuditEntry,
  AIRequestType,
  AIProviderType,
  TokenUsage,
  GuardrailSummary,
  UserFeedback,
} from './types';
import { logger } from '../../lib/logging/logger';

// ============================================================================
// INDEXEDDB AUDIT STORE
// ============================================================================

const DB_NAME = 'beamlab_ai_audit';
const DB_VERSION = 1;
const STORE_NAME = 'audit_entries';
const FEEDBACK_STORE = 'user_feedback';
const MAX_ENTRIES = 10000;
const DEFAULT_RETENTION_DAYS = 90;

export class PersistentAuditTrail {
  private db: IDBDatabase | null = null;
  private memoryFallback: AIAuditEntry[] = [];
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private retentionDays: number;

  constructor(retentionDays: number = DEFAULT_RETENTION_DAYS) {
    this.retentionDays = retentionDays;
    this.initPromise = this.initialize();
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private async initialize(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      logger.warn('[AuditTrail] IndexedDB not available, using memory fallback');
      this.isInitialized = true;
      return;
    }

    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('type', 'type', { unique: false });
            store.createIndex('provider', 'provider', { unique: false });
            store.createIndex('sessionId', 'sessionId', { unique: false });
            store.createIndex('success', 'success', { unique: false });
          }

          if (!db.objectStoreNames.contains(FEEDBACK_STORE)) {
            const feedbackStore = db.createObjectStore(FEEDBACK_STORE, { keyPath: 'requestId' });
            feedbackStore.createIndex('timestamp', 'timestamp', { unique: false });
            feedbackStore.createIndex('rating', 'rating', { unique: false });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      this.isInitialized = true;

      // Run maintenance on startup
      await this.runMaintenance();
    } catch (error) {
      logger.warn('[AuditTrail] Failed to initialize IndexedDB', { error: error instanceof Error ? error.message : String(error) });
      this.isInitialized = true; // Use memory fallback
    }
  }

  private async ensureReady(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  // ============================================================================
  // LOGGING
  // ============================================================================

  /**
   * Log an AI operation
   */
  async log(entry: Omit<AIAuditEntry, 'id' | 'timestamp'>): Promise<string> {
    await this.ensureReady();

    const fullEntry: AIAuditEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
    };

    if (this.db) {
      try {
        await this.dbPut(STORE_NAME, fullEntry);
      } catch (error) {
        logger.warn('[AuditTrail] DB write failed, using memory fallback', { error: error instanceof Error ? error.message : String(error) });
        this.memoryFallback.push(fullEntry);
      }
    } else {
      this.memoryFallback.push(fullEntry);
      if (this.memoryFallback.length > MAX_ENTRIES) {
        this.memoryFallback = this.memoryFallback.slice(-MAX_ENTRIES / 2);
      }
    }

    return fullEntry.id;
  }

  /**
   * Record user feedback for a specific AI response
   */
  async recordFeedback(requestId: string, feedback: UserFeedback): Promise<void> {
    await this.ensureReady();

    const feedbackEntry = { requestId, ...feedback };

    if (this.db) {
      try {
        await this.dbPut(FEEDBACK_STORE, feedbackEntry);

        // Also update the audit entry with feedback
        const entry = await this.getEntry(requestId);
        if (entry) {
          entry.userFeedback = feedback;
          await this.dbPut(STORE_NAME, entry);
        }
      } catch (error) {
        logger.warn('[AuditTrail] Feedback write failed', { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  // ============================================================================
  // QUERYING
  // ============================================================================

  /**
   * Get a specific audit entry
   */
  async getEntry(id: string): Promise<AIAuditEntry | null> {
    await this.ensureReady();

    if (this.db) {
      try {
        return await this.dbGet(STORE_NAME, id);
      } catch {
        return this.memoryFallback.find(e => e.id === id || e.requestId === id) || null;
      }
    }
    return this.memoryFallback.find(e => e.id === id || e.requestId === id) || null;
  }

  /**
   * Get recent entries
   */
  async getRecent(limit: number = 50): Promise<AIAuditEntry[]> {
    await this.ensureReady();

    if (this.db) {
      try {
        return await this.dbGetAll(STORE_NAME, limit, 'timestamp');
      } catch {
        return this.memoryFallback.slice(-limit).reverse();
      }
    }
    return this.memoryFallback.slice(-limit).reverse();
  }

  /**
   * Query entries by filter
   */
  async query(filters: {
    type?: AIRequestType;
    provider?: AIProviderType;
    sessionId?: string;
    success?: boolean;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }): Promise<AIAuditEntry[]> {
    await this.ensureReady();

    let entries: AIAuditEntry[];

    if (this.db) {
      try {
        entries = await this.dbGetAll(STORE_NAME, filters.limit || 1000, 'timestamp');
      } catch {
        entries = [...this.memoryFallback];
      }
    } else {
      entries = [...this.memoryFallback];
    }

    // Apply filters
    return entries.filter(entry => {
      if (filters.type && entry.type !== filters.type) return false;
      if (filters.provider && entry.provider !== filters.provider) return false;
      if (filters.sessionId && entry.sessionId !== filters.sessionId) return false;
      if (filters.success !== undefined && entry.success !== filters.success) return false;
      if (filters.fromDate && new Date(entry.timestamp) < filters.fromDate) return false;
      if (filters.toDate && new Date(entry.timestamp) > filters.toDate) return false;
      return true;
    }).slice(0, filters.limit || 1000);
  }

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  /**
   * Get performance analytics
   */
  async getAnalytics(periodDays: number = 30): Promise<{
    totalRequests: number;
    successRate: number;
    averageLatency: number;
    medianLatency: number;
    p95Latency: number;
    averageConfidence: number;
    totalTokens: number;
    totalCostUSD: number;
    providerBreakdown: Record<AIProviderType, { requests: number; successRate: number; avgLatency: number }>;
    typeBreakdown: Record<AIRequestType, number>;
    dailyVolume: Array<{ date: string; requests: number; successRate: number }>;
    fallbackRate: number;
    cacheHitRate: number;
    feedbackScore: number;
  }> {
    const fromDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const entries = await this.query({ fromDate });

    if (entries.length === 0) {
      return {
        totalRequests: 0,
        successRate: 0,
        averageLatency: 0,
        medianLatency: 0,
        p95Latency: 0,
        averageConfidence: 0,
        totalTokens: 0,
        totalCostUSD: 0,
        providerBreakdown: {} as any,
        typeBreakdown: {} as any,
        dailyVolume: [],
        fallbackRate: 0,
        cacheHitRate: 0,
        feedbackScore: 0,
      };
    }

    const successEntries = entries.filter(e => e.success);
    const latencies = entries.map(e => e.latency).sort((a, b) => a - b);

    // Provider breakdown
    const providerBreakdown: Record<string, { requests: number; successes: number; totalLatency: number }> = {};
    for (const entry of entries) {
      if (!providerBreakdown[entry.provider]) {
        providerBreakdown[entry.provider] = { requests: 0, successes: 0, totalLatency: 0 };
      }
      providerBreakdown[entry.provider].requests++;
      if (entry.success) providerBreakdown[entry.provider].successes++;
      providerBreakdown[entry.provider].totalLatency += entry.latency;
    }

    // Type breakdown
    const typeBreakdown: Record<string, number> = {};
    for (const entry of entries) {
      typeBreakdown[entry.type] = (typeBreakdown[entry.type] || 0) + 1;
    }

    // Daily volume
    const dailyMap = new Map<string, { requests: number; successes: number }>();
    for (const entry of entries) {
      const date = new Date(entry.timestamp).toISOString().split('T')[0];
      if (!dailyMap.has(date)) dailyMap.set(date, { requests: 0, successes: 0 });
      dailyMap.get(date)!.requests++;
      if (entry.success) dailyMap.get(date)!.successes++;
    }

    // Feedback score
    const feedbackEntries = entries.filter(e => e.userFeedback);
    const avgFeedback = feedbackEntries.length > 0
      ? feedbackEntries.reduce((sum, e) => sum + (e.userFeedback?.rating || 0), 0) / feedbackEntries.length
      : 0;

    // Fallback rate
    const fallbackEntries = entries.filter(e => (e.fallbacksAttempted || 0) > 0);

    return {
      totalRequests: entries.length,
      successRate: (successEntries.length / entries.length) * 100,
      averageLatency: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
      medianLatency: latencies[Math.floor(latencies.length / 2)] || 0,
      p95Latency: latencies[Math.floor(latencies.length * 0.95)] || 0,
      averageConfidence: entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length,
      totalTokens: entries.reduce((sum, e) => sum + (e.tokenUsage?.totalTokens || 0), 0),
      totalCostUSD: entries.reduce((sum, e) => sum + (e.tokenUsage?.estimatedCostUSD || 0), 0),
      providerBreakdown: Object.fromEntries(
        Object.entries(providerBreakdown).map(([k, v]) => [k, {
          requests: v.requests,
          successRate: (v.successes / v.requests) * 100,
          avgLatency: Math.round(v.totalLatency / v.requests),
        }])
      ) as any,
      typeBreakdown: typeBreakdown as any,
      dailyVolume: Array.from(dailyMap.entries()).map(([date, v]) => ({
        date,
        requests: v.requests,
        successRate: (v.successes / v.requests) * 100,
      })).sort((a, b) => a.date.localeCompare(b.date)),
      fallbackRate: (fallbackEntries.length / entries.length) * 100,
      cacheHitRate: 0, // Would need cache events integration
      feedbackScore: avgFeedback,
    };
  }

  // ============================================================================
  // EXPORT
  // ============================================================================

  /**
   * Export all audit entries as JSON
   */
  async export(): Promise<string> {
    const entries = await this.getRecent(MAX_ENTRIES);
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      version: '1.0',
      entryCount: entries.length,
      entries,
    }, null, 2);
  }

  /**
   * Export analytics report
   */
  async exportAnalytics(periodDays: number = 30): Promise<string> {
    const analytics = await this.getAnalytics(periodDays);
    return JSON.stringify({
      reportDate: new Date().toISOString(),
      periodDays,
      ...analytics,
    }, null, 2);
  }

  // ============================================================================
  // MAINTENANCE
  // ============================================================================

  /**
   * Run maintenance: delete old entries, compact database
   */
  async runMaintenance(): Promise<{ deletedCount: number }> {
    await this.ensureReady();

    const cutoffDate = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    if (this.db) {
      try {
        const entries = await this.dbGetAll(STORE_NAME, MAX_ENTRIES * 2, 'timestamp');
        const toDelete = entries.filter(e => new Date(e.timestamp) < cutoffDate);

        for (const entry of toDelete) {
          await this.dbDelete(STORE_NAME, entry.id);
          deletedCount++;
        }

        // Also enforce max entries
        if (entries.length - deletedCount > MAX_ENTRIES) {
          const sorted = entries
            .filter(e => new Date(e.timestamp) >= cutoffDate)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

          const overflow = sorted.slice(0, sorted.length - MAX_ENTRIES);
          for (const entry of overflow) {
            await this.dbDelete(STORE_NAME, entry.id);
            deletedCount++;
          }
        }
      } catch (error) {
        logger.warn('[AuditTrail] Maintenance failed', { error: error instanceof Error ? error.message : String(error) });
      }
    } else {
      // Memory fallback maintenance
      const beforeCount = this.memoryFallback.length;
      this.memoryFallback = this.memoryFallback.filter(
        e => new Date(e.timestamp) >= cutoffDate
      );
      deletedCount = beforeCount - this.memoryFallback.length;
    }

    logger.info(`[AuditTrail] Maintenance: deleted ${deletedCount} old entries`);
    return { deletedCount };
  }

  /**
   * Clear all audit data
   */
  async clear(): Promise<void> {
    await this.ensureReady();

    if (this.db) {
      try {
        await this.dbClear(STORE_NAME);
        await this.dbClear(FEEDBACK_STORE);
      } catch (error) {
        logger.warn('[AuditTrail] Clear failed', { error: error instanceof Error ? error.message : String(error) });
      }
    }
    this.memoryFallback = [];
  }

  // ============================================================================
  // INDEXEDDB HELPERS
  // ============================================================================

  private dbPut(storeName: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB not initialized'));
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(value);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private dbGet(storeName: string, key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB not initialized'));
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private dbGetAll(storeName: string, limit: number, indexName?: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB not initialized'));
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const source = indexName ? store.index(indexName) : store;

      const results: any[] = [];
      const request = source.openCursor(null, 'prev'); // newest first

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  private dbDelete(storeName: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB not initialized'));
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private dbClear(storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB not initialized'));
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

export const persistentAuditTrail = new PersistentAuditTrail();
