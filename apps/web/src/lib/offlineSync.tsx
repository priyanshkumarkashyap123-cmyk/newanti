/**
 * Offline Data Sync
 * Industry-standard offline-first data synchronization
 * 
 * Features:
 * - IndexedDB storage for offline data
 * - Conflict resolution strategies
 * - Background sync queue
 * - Optimistic updates
 * - Online/offline detection
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - idb types may not be available during build
import { openDB } from 'idb';

// Using loose types for idb since exact types are complex
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IDBDatabase = any;

// ============================================================================
// Types
// ============================================================================

interface SyncItem<T = unknown> {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: string;
  data: T;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  error?: string;
}

interface SyncConflict<T = unknown> {
  local: T;
  remote: T;
  entity: string;
  id: string;
}

type ConflictResolution = 'local' | 'remote' | 'merge';

interface SyncOptions {
  dbName?: string;
  maxRetries?: number;
  retryDelay?: number;
  batchSize?: number;
  onConflict?: <T>(conflict: SyncConflict<T>) => Promise<ConflictResolution>;
  onSyncStart?: () => void;
  onSyncComplete?: (results: SyncResult) => void;
  onSyncError?: (error: Error) => void;
}

interface SyncResult {
  synced: number;
  failed: number;
  conflicts: number;
  duration: number;
}

// Using simplified schema for offline storage
interface OfflineDBSchema {
  syncQueue: SyncItem;
  offlineData: {
    id: string;
    entity: string;
    data: unknown;
    lastModified: number;
    syncedAt?: number;
  };
  metadata: {
    key: string;
    value: unknown;
  };
}

// ============================================================================
// Database Manager
// ============================================================================

class OfflineDatabase {
  private db: IDBDatabase = null;
  private dbName: string;

  constructor(dbName = 'structural-eng-offline') {
    this.dbName = dbName;
  }

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB(this.dbName, 1, {
      upgrade(db: IDBDatabase) {
        // Sync queue store
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        syncStore.createIndex('by-status', 'status');
        syncStore.createIndex('by-entity', 'entity');
        syncStore.createIndex('by-timestamp', 'timestamp');

        // Offline data store
        const dataStore = db.createObjectStore('offlineData', { keyPath: 'id' });
        dataStore.createIndex('by-entity', 'entity');

        // Metadata store
        db.createObjectStore('metadata', { keyPath: 'key' });
      },
    });
  }

  async addToSyncQueue(item: Omit<SyncItem, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<string> {
    await this.init();
    
    const syncItem: SyncItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    await this.db!.add('syncQueue', syncItem);
    return syncItem.id;
  }

  async getPendingItems(): Promise<SyncItem[]> {
    await this.init();
    return this.db!.getAllFromIndex('syncQueue', 'by-status', 'pending');
  }

  async updateSyncItem(id: string, updates: Partial<SyncItem>): Promise<void> {
    await this.init();
    const item = await this.db!.get('syncQueue', id);
    if (item) {
      await this.db!.put('syncQueue', { ...item, ...updates });
    }
  }

  async removeSyncItem(id: string): Promise<void> {
    await this.init();
    await this.db!.delete('syncQueue', id);
  }

  async saveOfflineData(entity: string, id: string, data: unknown): Promise<void> {
    await this.init();
    await this.db!.put('offlineData', {
      id: `${entity}:${id}`,
      entity,
      data,
      lastModified: Date.now(),
    });
  }

  async getOfflineData<T>(entity: string, id: string): Promise<T | undefined> {
    await this.init();
    const result = await this.db!.get('offlineData', `${entity}:${id}`);
    return result?.data as T | undefined;
  }

  async getAllOfflineData<T>(entity: string): Promise<T[]> {
    await this.init();
    const results = await this.db!.getAllFromIndex('offlineData', 'by-entity', entity);
    return results.map((r: { data: unknown }) => r.data as T);
  }

  async setMetadata(key: string, value: unknown): Promise<void> {
    await this.init();
    await this.db!.put('metadata', { key, value });
  }

  async getMetadata<T>(key: string): Promise<T | undefined> {
    await this.init();
    const result = await this.db!.get('metadata', key);
    return result?.value as T | undefined;
  }

  async clearSyncQueue(): Promise<void> {
    await this.init();
    await this.db!.clear('syncQueue');
  }

  async getQueueStats(): Promise<{ pending: number; failed: number; syncing: number }> {
    await this.init();
    const all = await this.db!.getAll('syncQueue');
    return {
      pending: all.filter((i: SyncItem) => i.status === 'pending').length,
      failed: all.filter((i: SyncItem) => i.status === 'failed').length,
      syncing: all.filter((i: SyncItem) => i.status === 'syncing').length,
    };
  }
}

// ============================================================================
// Sync Manager
// ============================================================================

export class SyncManager {
  private db: OfflineDatabase;
  private options: Required<SyncOptions>;
  private isSyncing = false;
  private syncPromise: Promise<SyncResult> | null = null;

  constructor(options: SyncOptions = {}) {
    this.db = new OfflineDatabase(options.dbName);
    this.options = {
      dbName: options.dbName ?? 'structural-eng-offline',
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      batchSize: options.batchSize ?? 10,
      onConflict: options.onConflict ?? (async () => 'remote'),
      onSyncStart: options.onSyncStart ?? (() => {}),
      onSyncComplete: options.onSyncComplete ?? (() => {}),
      onSyncError: options.onSyncError ?? (() => {}),
    };
  }

  /**
   * Queue an operation for sync
   */
  async queue<T>(
    type: SyncItem['type'],
    entity: string,
    data: T
  ): Promise<string> {
    return this.db.addToSyncQueue({ type, entity, data });
  }

  /**
   * Save data locally for offline access
   */
  async saveLocal<T extends { id: string }>(entity: string, data: T): Promise<void> {
    await this.db.saveOfflineData(entity, data.id, data);
  }

  /**
   * Get local data
   */
  async getLocal<T>(entity: string, id: string): Promise<T | undefined> {
    return this.db.getOfflineData<T>(entity, id);
  }

  /**
   * Get all local data for an entity
   */
  async getAllLocal<T>(entity: string): Promise<T[]> {
    return this.db.getAllOfflineData<T>(entity);
  }

  /**
   * Trigger a sync
   */
  async sync(): Promise<SyncResult> {
    // Prevent concurrent syncs
    if (this.isSyncing && this.syncPromise) {
      return this.syncPromise;
    }

    this.isSyncing = true;
    this.options.onSyncStart();

    const startTime = Date.now();
    let synced = 0;
    let failed = 0;
    let conflicts = 0;

    try {
      const pendingItems = await this.db.getPendingItems();
      const batches = this.chunkArray(pendingItems, this.options.batchSize);

      for (const batch of batches) {
        const results = await Promise.allSettled(
          batch.map((item) => this.syncItem(item))
        );

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const item = batch[i];

          if (result.status === 'fulfilled') {
            if (result.value === 'synced') {
              synced++;
              await this.db.removeSyncItem(item.id);
            } else if (result.value === 'conflict') {
              conflicts++;
            }
          } else {
            failed++;
            await this.handleSyncError(item, result.reason);
          }
        }
      }

      const syncResult: SyncResult = {
        synced,
        failed,
        conflicts,
        duration: Date.now() - startTime,
      };

      this.options.onSyncComplete(syncResult);
      return syncResult;
    } catch (error) {
      this.options.onSyncError(error instanceof Error ? error : new Error('Sync failed'));
      throw error;
    } finally {
      this.isSyncing = false;
      this.syncPromise = null;
    }
  }

  private async syncItem(item: SyncItem): Promise<'synced' | 'conflict'> {
    await this.db.updateSyncItem(item.id, { status: 'syncing' });

    // Simulate API call - replace with actual API implementation
    const response = await this.sendToServer(item);

    if (response.status === 'conflict') {
      const resolution = await this.options.onConflict({
        local: item.data,
        remote: response.remoteData,
        entity: item.entity,
        id: item.id,
      });

      if (resolution === 'local') {
        // Retry with force flag
        await this.sendToServer({ ...item, force: true } as SyncItem & { force?: boolean });
      } else if (resolution === 'merge') {
        // Merge data and retry
        const merged = { ...(response.remoteData as Record<string, unknown>), ...(item.data as Record<string, unknown>) };
        await this.sendToServer({ ...item, data: merged } as SyncItem & { force?: boolean });
      }
      // For 'remote', we accept the server version

      return 'conflict';
    }

    return 'synced';
  }

  private async sendToServer(_item: SyncItem & { force?: boolean }): Promise<{
    status: 'success' | 'conflict';
    remoteData?: unknown;
  }> {
    // This is a placeholder - implement actual API calls here
    // Example:
    // const response = await fetch(`/api/${item.entity}`, {
    //   method: item.type === 'create' ? 'POST' : item.type === 'update' ? 'PUT' : 'DELETE',
    //   body: JSON.stringify(item.data),
    // });
    
    return { status: 'success' };
  }

  private async handleSyncError(item: SyncItem, error: unknown): Promise<void> {
    const newRetryCount = item.retryCount + 1;
    
    if (newRetryCount >= this.options.maxRetries) {
      await this.db.updateSyncItem(item.id, {
        status: 'failed',
        retryCount: newRetryCount,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } else {
      // Schedule retry
      await this.db.updateSyncItem(item.id, {
        status: 'pending',
        retryCount: newRetryCount,
      });
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    return this.db.getQueueStats();
  }

  /**
   * Clear failed items from queue
   */
  async clearFailedItems(): Promise<void> {
    await this.db.clearSyncQueue();
  }
}

// ============================================================================
// React Hook
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSyncOptions extends SyncOptions {
  autoSync?: boolean;
  syncInterval?: number;
}

interface UseSyncReturn {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncResult: SyncResult | null;
  sync: () => Promise<SyncResult>;
  queue: <T>(type: SyncItem['type'], entity: string, data: T) => Promise<string>;
  saveLocal: <T extends { id: string }>(entity: string, data: T) => Promise<void>;
  getLocal: <T>(entity: string, id: string) => Promise<T | undefined>;
}

export function useSync(options: UseSyncOptions = {}): UseSyncReturn {
  const {
    autoSync = true,
    syncInterval = 30000,
    ...syncOptions
  } = options;

  const syncManagerRef = useRef<SyncManager | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  // Initialize sync manager
  useEffect(() => {
    syncManagerRef.current = new SyncManager({
      ...syncOptions,
      onSyncStart: () => {
        setIsSyncing(true);
        syncOptions.onSyncStart?.();
      },
      onSyncComplete: (result) => {
        setIsSyncing(false);
        setLastSyncResult(result);
        syncOptions.onSyncComplete?.(result);
        updateStats();
      },
      onSyncError: (error) => {
        setIsSyncing(false);
        syncOptions.onSyncError?.(error);
      },
    });

    updateStats();
  }, []);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (autoSync) {
        sync();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [autoSync]);

  // Auto-sync interval
  useEffect(() => {
    if (!autoSync || !isOnline) return;

    const intervalId = setInterval(() => {
      sync();
    }, syncInterval);

    return () => clearInterval(intervalId);
  }, [autoSync, isOnline, syncInterval]);

  const updateStats = useCallback(async () => {
    if (!syncManagerRef.current) return;
    const stats = await syncManagerRef.current.getQueueStats();
    setPendingCount(stats.pending);
    setFailedCount(stats.failed);
  }, []);

  const sync = useCallback(async () => {
    if (!syncManagerRef.current || !isOnline) {
      return { synced: 0, failed: 0, conflicts: 0, duration: 0 };
    }
    const result = await syncManagerRef.current.sync();
    return result;
  }, [isOnline]);

  const queue = useCallback(async <T,>(
    type: SyncItem['type'],
    entity: string,
    data: T
  ) => {
    if (!syncManagerRef.current) throw new Error('Sync manager not initialized');
    const id = await syncManagerRef.current.queue(type, entity, data);
    await updateStats();
    return id;
  }, [updateStats]);

  const saveLocal = useCallback(async <T extends { id: string }>(
    entity: string,
    data: T
  ) => {
    if (!syncManagerRef.current) throw new Error('Sync manager not initialized');
    await syncManagerRef.current.saveLocal(entity, data);
  }, []);

  const getLocal = useCallback(async <T,>(entity: string, id: string) => {
    if (!syncManagerRef.current) throw new Error('Sync manager not initialized');
    return syncManagerRef.current.getLocal<T>(entity, id);
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    failedCount,
    lastSyncResult,
    sync,
    queue,
    saveLocal,
    getLocal,
  };
}

// ============================================================================
// Sync Status Component
// ============================================================================

interface SyncStatusProps {
  className?: string;
}

export function SyncStatus({ className = '' }: SyncStatusProps): JSX.Element {
  const { isOnline, isSyncing, pendingCount, failedCount, sync } = useSync();

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Online status */}
      <div className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Pending items */}
      {pendingCount > 0 && (
        <div className="text-sm text-yellow-600 dark:text-yellow-400">
          {pendingCount} pending
        </div>
      )}

      {/* Failed items */}
      {failedCount > 0 && (
        <div className="text-sm text-red-600 dark:text-red-400">
          {failedCount} failed
        </div>
      )}

      {/* Sync button */}
      <button
        onClick={() => sync()}
        disabled={isSyncing || !isOnline}
        className={`p-1.5 rounded transition-colors ${
          isSyncing || !isOnline
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
        }`}
        title={isSyncing ? 'Syncing...' : 'Sync now'}
      >
        <svg
          className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>
    </div>
  );
}

// ============================================================================
// Export
// ============================================================================

export { OfflineDatabase };
export type { SyncItem, SyncConflict, SyncResult, SyncOptions };
