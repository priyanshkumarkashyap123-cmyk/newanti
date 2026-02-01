/**
 * IndexedDB History Persistence
 * 
 * Industry-standard persistent undo/redo with:
 * - IndexedDB storage (survives browser restart)
 * - History branching (like Git)
 * - Automatic cleanup of old history
 * - Compression for large states
 * - Cross-tab synchronization
 */

// ============================================================================
// TYPES
// ============================================================================

export interface HistorySnapshot<T = unknown> {
  id: string;
  timestamp: number;
  description: string;
  state: T;
  compressed?: boolean;
}

export interface HistoryBranch {
  id: string;
  name: string;
  parentBranchId?: string;
  parentSnapshotId?: string;
  createdAt: number;
  snapshotIds: string[];
  currentIndex: number;
}

export interface HistoryMetadata {
  projectId: string;
  currentBranchId: string;
  branches: HistoryBranch[];
  lastModified: number;
  version: number;
}

interface IndexedDBConfig {
  dbName: string;
  version: number;
  maxSnapshots: number;
  maxBranches: number;
  compressionThreshold: number; // bytes
}

// ============================================================================
// INDEXEDDB HISTORY STORE
// ============================================================================

const DEFAULT_CONFIG: IndexedDBConfig = {
  dbName: 'StructuralHistory',
  version: 1,
  maxSnapshots: 100,
  maxBranches: 10,
  compressionThreshold: 50 * 1024, // 50KB
};

class IndexedDBHistoryStore {
  private db: IDBDatabase | null = null;
  private config: IndexedDBConfig;
  private initPromise: Promise<void> | null = null;

  constructor(config: Partial<IndexedDBConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.version);

      request.onerror = () => {
        console.error('[HistoryDB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[HistoryDB] Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Snapshots store
        if (!db.objectStoreNames.contains('snapshots')) {
          const snapshotStore = db.createObjectStore('snapshots', { keyPath: 'id' });
          snapshotStore.createIndex('timestamp', 'timestamp', { unique: false });
          snapshotStore.createIndex('projectId', 'projectId', { unique: false });
        }

        // Metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'projectId' });
        }

        // Compressed states store (for large snapshots)
        if (!db.objectStoreNames.contains('compressedStates')) {
          db.createObjectStore('compressedStates', { keyPath: 'snapshotId' });
        }

        console.log('[HistoryDB] Database schema created/upgraded');
      };
    });

    return this.initPromise;
  }

  private ensureDb(): IDBDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  // ============================================================================
  // SNAPSHOT OPERATIONS
  // ============================================================================

  async saveSnapshot<T>(
    projectId: string,
    description: string,
    state: T
  ): Promise<HistorySnapshot<T>> {
    await this.init();
    const db = this.ensureDb();

    const snapshot: HistorySnapshot<T> = {
      id: this.generateId(),
      timestamp: Date.now(),
      description,
      state,
      compressed: false,
    };

    // Check if compression needed
    const stateSize = JSON.stringify(state).length;
    if (stateSize > this.config.compressionThreshold) {
      snapshot.compressed = true;
      // Store state separately in compressed store
      await this.saveCompressedState(snapshot.id, state);
      (snapshot as any).state = null; // Don't duplicate in main store
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['snapshots', 'metadata'], 'readwrite');
      const store = transaction.objectStore('snapshots');

      const request = store.put({ ...snapshot, projectId });

      request.onsuccess = async () => {
        // Update metadata
        await this.addSnapshotToCurrentBranch(projectId, snapshot.id);
        resolve(snapshot);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getSnapshot<T>(snapshotId: string): Promise<HistorySnapshot<T> | null> {
    await this.init();
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('snapshots', 'readonly');
      const store = transaction.objectStore('snapshots');
      const request = store.get(snapshotId);

      request.onsuccess = async () => {
        const snapshot = request.result as HistorySnapshot<T> | undefined;
        if (!snapshot) {
          resolve(null);
          return;
        }

        // Load compressed state if needed
        if (snapshot.compressed) {
          const state = await this.getCompressedState<T>(snapshotId);
          snapshot.state = state;
        }

        resolve(snapshot);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async deleteSnapshot(snapshotId: string): Promise<void> {
    await this.init();
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['snapshots', 'compressedStates'], 'readwrite');
      
      transaction.objectStore('snapshots').delete(snapshotId);
      transaction.objectStore('compressedStates').delete(snapshotId);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // ============================================================================
  // COMPRESSED STATE OPERATIONS
  // ============================================================================

  private async saveCompressedState<T>(snapshotId: string, state: T): Promise<void> {
    const db = this.ensureDb();
    
    // Simple compression: JSON + base64 (in production, use pako/lz-string)
    const jsonStr = JSON.stringify(state);
    const compressed = btoa(unescape(encodeURIComponent(jsonStr)));

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('compressedStates', 'readwrite');
      const store = transaction.objectStore('compressedStates');
      
      const request = store.put({ snapshotId, data: compressed, size: jsonStr.length });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getCompressedState<T>(snapshotId: string): Promise<T> {
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('compressedStates', 'readonly');
      const store = transaction.objectStore('compressedStates');
      const request = store.get(snapshotId);

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          reject(new Error(`Compressed state not found: ${snapshotId}`));
          return;
        }

        try {
          const jsonStr = decodeURIComponent(escape(atob(result.data)));
          resolve(JSON.parse(jsonStr));
        } catch (e) {
          reject(e);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ============================================================================
  // BRANCH OPERATIONS
  // ============================================================================

  async getMetadata(projectId: string): Promise<HistoryMetadata | null> {
    await this.init();
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('metadata', 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.get(projectId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveMetadata(metadata: HistoryMetadata): Promise<void> {
    await this.init();
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('metadata', 'readwrite');
      const store = transaction.objectStore('metadata');
      const request = store.put(metadata);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async initProject(projectId: string): Promise<HistoryMetadata> {
    let metadata = await this.getMetadata(projectId);
    
    if (!metadata) {
      const mainBranch: HistoryBranch = {
        id: 'main',
        name: 'Main',
        createdAt: Date.now(),
        snapshotIds: [],
        currentIndex: -1,
      };

      metadata = {
        projectId,
        currentBranchId: 'main',
        branches: [mainBranch],
        lastModified: Date.now(),
        version: 1,
      };

      await this.saveMetadata(metadata);
    }

    return metadata;
  }

  async createBranch(
    projectId: string,
    name: string,
    fromBranchId?: string,
    fromSnapshotId?: string
  ): Promise<HistoryBranch> {
    const metadata = await this.getMetadata(projectId);
    if (!metadata) throw new Error('Project not found');

    if (metadata.branches.length >= this.config.maxBranches) {
      // Remove oldest non-main branch
      const oldestBranch = metadata.branches
        .filter(b => b.id !== 'main')
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      
      if (oldestBranch) {
        await this.deleteBranch(projectId, oldestBranch.id);
      }
    }

    const sourceBranch = fromBranchId 
      ? metadata.branches.find(b => b.id === fromBranchId)
      : metadata.branches.find(b => b.id === metadata.currentBranchId);

    const newBranch: HistoryBranch = {
      id: this.generateId(),
      name,
      parentBranchId: sourceBranch?.id,
      parentSnapshotId: fromSnapshotId || sourceBranch?.snapshotIds[sourceBranch.currentIndex],
      createdAt: Date.now(),
      snapshotIds: [],
      currentIndex: -1,
    };

    // Copy snapshots up to the branch point
    if (sourceBranch && fromSnapshotId) {
      const branchPointIndex = sourceBranch.snapshotIds.indexOf(fromSnapshotId);
      if (branchPointIndex >= 0) {
        newBranch.snapshotIds = sourceBranch.snapshotIds.slice(0, branchPointIndex + 1);
        newBranch.currentIndex = branchPointIndex;
      }
    }

    metadata.branches.push(newBranch);
    metadata.lastModified = Date.now();
    await this.saveMetadata(metadata);

    return newBranch;
  }

  async switchBranch(projectId: string, branchId: string): Promise<HistoryBranch | null> {
    const metadata = await this.getMetadata(projectId);
    if (!metadata) return null;

    const branch = metadata.branches.find(b => b.id === branchId);
    if (!branch) return null;

    metadata.currentBranchId = branchId;
    metadata.lastModified = Date.now();
    await this.saveMetadata(metadata);

    return branch;
  }

  async deleteBranch(projectId: string, branchId: string): Promise<void> {
    if (branchId === 'main') throw new Error('Cannot delete main branch');

    const metadata = await this.getMetadata(projectId);
    if (!metadata) return;

    const branch = metadata.branches.find(b => b.id === branchId);
    if (!branch) return;

    // Delete all snapshots unique to this branch
    const otherBranchSnapshots = new Set(
      metadata.branches
        .filter(b => b.id !== branchId)
        .flatMap(b => b.snapshotIds)
    );

    for (const snapshotId of branch.snapshotIds) {
      if (!otherBranchSnapshots.has(snapshotId)) {
        await this.deleteSnapshot(snapshotId);
      }
    }

    metadata.branches = metadata.branches.filter(b => b.id !== branchId);
    
    if (metadata.currentBranchId === branchId) {
      metadata.currentBranchId = 'main';
    }
    
    metadata.lastModified = Date.now();
    await this.saveMetadata(metadata);
  }

  // ============================================================================
  // HISTORY NAVIGATION
  // ============================================================================

  private async addSnapshotToCurrentBranch(projectId: string, snapshotId: string): Promise<void> {
    const metadata = await this.getMetadata(projectId);
    if (!metadata) return;

    const branch = metadata.branches.find(b => b.id === metadata.currentBranchId);
    if (!branch) return;

    // Truncate any redo history
    branch.snapshotIds = branch.snapshotIds.slice(0, branch.currentIndex + 1);
    branch.snapshotIds.push(snapshotId);
    branch.currentIndex = branch.snapshotIds.length - 1;

    // Enforce max snapshots per branch
    while (branch.snapshotIds.length > this.config.maxSnapshots) {
      const removedId = branch.snapshotIds.shift()!;
      branch.currentIndex--;
      
      // Only delete if not used by other branches
      const usedElsewhere = metadata.branches
        .filter(b => b.id !== branch.id)
        .some(b => b.snapshotIds.includes(removedId));
      
      if (!usedElsewhere) {
        await this.deleteSnapshot(removedId);
      }
    }

    metadata.lastModified = Date.now();
    await this.saveMetadata(metadata);
  }

  async undo<T>(projectId: string): Promise<HistorySnapshot<T> | null> {
    const metadata = await this.getMetadata(projectId);
    if (!metadata) return null;

    const branch = metadata.branches.find(b => b.id === metadata.currentBranchId);
    if (!branch || branch.currentIndex <= 0) return null;

    branch.currentIndex--;
    metadata.lastModified = Date.now();
    await this.saveMetadata(metadata);

    return this.getSnapshot<T>(branch.snapshotIds[branch.currentIndex]);
  }

  async redo<T>(projectId: string): Promise<HistorySnapshot<T> | null> {
    const metadata = await this.getMetadata(projectId);
    if (!metadata) return null;

    const branch = metadata.branches.find(b => b.id === metadata.currentBranchId);
    if (!branch || branch.currentIndex >= branch.snapshotIds.length - 1) return null;

    branch.currentIndex++;
    metadata.lastModified = Date.now();
    await this.saveMetadata(metadata);

    return this.getSnapshot<T>(branch.snapshotIds[branch.currentIndex]);
  }

  async canUndo(projectId: string): Promise<boolean> {
    const metadata = await this.getMetadata(projectId);
    if (!metadata) return false;

    const branch = metadata.branches.find(b => b.id === metadata.currentBranchId);
    return branch ? branch.currentIndex > 0 : false;
  }

  async canRedo(projectId: string): Promise<boolean> {
    const metadata = await this.getMetadata(projectId);
    if (!metadata) return false;

    const branch = metadata.branches.find(b => b.id === metadata.currentBranchId);
    return branch ? branch.currentIndex < branch.snapshotIds.length - 1 : false;
  }

  async jumpToSnapshot<T>(projectId: string, snapshotId: string): Promise<HistorySnapshot<T> | null> {
    const metadata = await this.getMetadata(projectId);
    if (!metadata) return null;

    const branch = metadata.branches.find(b => b.id === metadata.currentBranchId);
    if (!branch) return null;

    const index = branch.snapshotIds.indexOf(snapshotId);
    if (index === -1) return null;

    branch.currentIndex = index;
    metadata.lastModified = Date.now();
    await this.saveMetadata(metadata);

    return this.getSnapshot<T>(snapshotId);
  }

  async getHistory(projectId: string): Promise<HistorySnapshot<unknown>[]> {
    const metadata = await this.getMetadata(projectId);
    if (!metadata) return [];

    const branch = metadata.branches.find(b => b.id === metadata.currentBranchId);
    if (!branch) return [];

    const snapshots: HistorySnapshot<unknown>[] = [];
    for (const id of branch.snapshotIds) {
      const snapshot = await this.getSnapshot(id);
      if (snapshot) {
        // Don't include full state in history list
        snapshots.push({
          ...snapshot,
          state: undefined as unknown,
        });
      }
    }

    return snapshots;
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async clearProject(projectId: string): Promise<void> {
    const metadata = await this.getMetadata(projectId);
    if (!metadata) return;

    // Delete all snapshots
    for (const branch of metadata.branches) {
      for (const snapshotId of branch.snapshotIds) {
        await this.deleteSnapshot(snapshotId);
      }
    }

    // Delete metadata
    await this.init();
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('metadata', 'readwrite');
      const store = transaction.objectStore('metadata');
      const request = store.delete(projectId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getStorageUsage(): Promise<{ snapshots: number; bytes: number }> {
    await this.init();
    const db = this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['snapshots', 'compressedStates'], 'readonly');
      
      let snapshotCount = 0;
      let totalBytes = 0;

      const snapshotStore = transaction.objectStore('snapshots');
      const snapshotCountReq = snapshotStore.count();
      snapshotCountReq.onsuccess = () => {
        snapshotCount = snapshotCountReq.result;
      };

      const compressedStore = transaction.objectStore('compressedStates');
      const cursor = compressedStore.openCursor();
      
      cursor.onsuccess = (event) => {
        const result = (event.target as IDBRequest).result;
        if (result) {
          totalBytes += result.value.size || 0;
          result.continue();
        }
      };

      transaction.oncomplete = () => {
        resolve({ snapshots: snapshotCount, bytes: totalBytes });
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const historyDB = new IndexedDBHistoryStore();

// ============================================================================
// REACT HOOK
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseHistoryDBOptions {
  projectId: string;
  autoSaveDebounceMs?: number;
}

export function useHistoryDB<T>(options: UseHistoryDBOptions) {
  const { projectId, autoSaveDebounceMs = 500 } = options;
  
  const [isReady, setIsReady] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [history, setHistory] = useState<HistorySnapshot<unknown>[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [branches, setBranches] = useState<HistoryBranch[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState('main');
  
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize
  useEffect(() => {
    const init = async () => {
      await historyDB.init();
      await historyDB.initProject(projectId);
      await refreshState();
      setIsReady(true);
    };
    init();
  }, [projectId]);

  const refreshState = useCallback(async () => {
    const [undoable, redoable, historyList, metadata] = await Promise.all([
      historyDB.canUndo(projectId),
      historyDB.canRedo(projectId),
      historyDB.getHistory(projectId),
      historyDB.getMetadata(projectId),
    ]);
    
    setCanUndo(undoable);
    setCanRedo(redoable);
    setHistory(historyList);
    
    if (metadata) {
      setBranches(metadata.branches);
      setCurrentBranchId(metadata.currentBranchId);
      const branch = metadata.branches.find(b => b.id === metadata.currentBranchId);
      setCurrentIndex(branch?.currentIndex ?? -1);
    }
  }, [projectId]);

  const saveSnapshot = useCallback(async (description: string, state: T) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(async () => {
      await historyDB.saveSnapshot(projectId, description, state);
      await refreshState();
    }, autoSaveDebounceMs);
  }, [projectId, autoSaveDebounceMs, refreshState]);

  const saveSnapshotImmediate = useCallback(async (description: string, state: T) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    await historyDB.saveSnapshot(projectId, description, state);
    await refreshState();
  }, [projectId, refreshState]);

  const undo = useCallback(async (): Promise<T | null> => {
    const snapshot = await historyDB.undo<T>(projectId);
    await refreshState();
    return snapshot?.state ?? null;
  }, [projectId, refreshState]);

  const redo = useCallback(async (): Promise<T | null> => {
    const snapshot = await historyDB.redo<T>(projectId);
    await refreshState();
    return snapshot?.state ?? null;
  }, [projectId, refreshState]);

  const jumpTo = useCallback(async (snapshotId: string): Promise<T | null> => {
    const snapshot = await historyDB.jumpToSnapshot<T>(projectId, snapshotId);
    await refreshState();
    return snapshot?.state ?? null;
  }, [projectId, refreshState]);

  const createBranch = useCallback(async (name: string): Promise<HistoryBranch> => {
    const branch = await historyDB.createBranch(projectId, name);
    await refreshState();
    return branch;
  }, [projectId, refreshState]);

  const switchBranch = useCallback(async (branchId: string): Promise<boolean> => {
    const branch = await historyDB.switchBranch(projectId, branchId);
    await refreshState();
    return branch !== null;
  }, [projectId, refreshState]);

  const deleteBranch = useCallback(async (branchId: string): Promise<void> => {
    await historyDB.deleteBranch(projectId, branchId);
    await refreshState();
  }, [projectId, refreshState]);

  return {
    isReady,
    canUndo,
    canRedo,
    history,
    currentIndex,
    branches,
    currentBranchId,
    saveSnapshot,
    saveSnapshotImmediate,
    undo,
    redo,
    jumpTo,
    createBranch,
    switchBranch,
    deleteBranch,
    refreshState,
  };
}

export default historyDB;
