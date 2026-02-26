/**
 * Zundo Storage Adapter for IndexedDB
 * 
 * Integrates zundo temporal middleware with IndexedDB for persistent undo/redo
 * Features:
 * - Persistent history across browser sessions
 * - Automatic state compression for large models
 * - History branching support
 * - Cross-tab synchronization via BroadcastChannel
 */

import { historyDB, HistorySnapshot, HistoryBranch } from './indexeddb-history';
import type { TemporalState } from 'zundo';
import { useEffect, useCallback, useRef, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface PersistentHistoryOptions {
  projectId: string;
  /** How often to persist to IndexedDB (ms). Default: 1000ms */
  persistInterval?: number;
  /** Max in-memory states before persisting. Default: 50 */
  maxInMemoryStates?: number;
  /** Enable cross-tab sync. Default: true */
  enableCrossTabSync?: boolean;
  /** Description generator for snapshots */
  getSnapshotDescription?: (state: any, prevState: any) => string;
}

interface SyncMessage {
  type: 'UNDO' | 'REDO' | 'SAVE' | 'RESTORE';
  projectId: string;
  snapshotId?: string;
  timestamp: number;
  tabId: string;
}

// ============================================================================
// TAB ID
// ============================================================================

const TAB_ID = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ============================================================================
// BROADCAST CHANNEL FOR CROSS-TAB SYNC
// ============================================================================

let broadcastChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  
  if (!broadcastChannel && typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel('structural-history-sync');
  }
  
  return broadcastChannel;
}

function broadcastMessage(message: SyncMessage): void {
  const channel = getBroadcastChannel();
  if (channel) {
    try {
      channel.postMessage(message);
    } catch (e) {
      console.warn('[HistorySync] Failed to broadcast:', e);
    }
  }
}

// ============================================================================
// MAIN INTEGRATION HOOK
// ============================================================================

/**
 * Hook to integrate zundo temporal state with IndexedDB persistence
 * 
 * @example
 * ```tsx
 * const { undo, redo, canUndo, canRedo } = usePersistentHistory(
 *   useModelStore,
 *   { projectId: 'my-project' }
 * );
 * ```
 */
export function usePersistentHistory<TState extends object>(
  useStore: {
    temporal: {
      getState: () => TemporalState<TState>;
    };
    getState: () => TState;
    setState: (state: Partial<TState>) => void;
    subscribe: (listener: (state: TState, prevState: TState) => void) => () => void;
  },
  options: PersistentHistoryOptions
) {
  const {
    projectId,
    persistInterval = 1000,
    maxInMemoryStates = 50,
    enableCrossTabSync = true,
    getSnapshotDescription = defaultDescriptionGenerator,
  } = options;

  const [isReady, setIsReady] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [branches, setBranches] = useState<HistoryBranch[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState('main');
  const [historyList, setHistoryList] = useState<HistorySnapshot[]>([]);
  
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistedStateRef = useRef<string | null>(null);
  const isRestoringRef = useRef(false);
  
  // ============================================================================
  // HELPER FUNCTIONS (defined before useEffects that use them)
  // ============================================================================
  
  const refreshState = useCallback(async () => {
    const [undoable, redoable, history, metadata] = await Promise.all([
      historyDB.canUndo(projectId),
      historyDB.canRedo(projectId),
      historyDB.getHistory(projectId),
      historyDB.getMetadata(projectId),
    ]);
    
    setCanUndo(undoable);
    setCanRedo(redoable);
    setHistoryList(history);
    
    if (metadata) {
      setBranches(metadata.branches);
      setCurrentBranchId(metadata.currentBranchId);
    }
  }, [projectId]);
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  useEffect(() => {
    let isMounted = true;
    
    const init = async () => {
      try {
        await historyDB.init();
        const metadata = await historyDB.initProject(projectId);
        
        if (!isMounted) return;
        
        setBranches(metadata.branches);
        setCurrentBranchId(metadata.currentBranchId);
        
        // Restore last state if available
        const currentBranch = metadata.branches.find(b => b.id === metadata.currentBranchId);
        if (currentBranch && currentBranch.snapshotIds.length > 0) {
          const lastSnapshotId = currentBranch.snapshotIds[currentBranch.currentIndex];
          if (lastSnapshotId) {
            const snapshot = await historyDB.getSnapshot<TState>(lastSnapshotId);
            if (snapshot?.state && isMounted) {
              isRestoringRef.current = true;
              useStore.setState(snapshot.state as Partial<TState>);
              isRestoringRef.current = false;
              console.log('[PersistentHistory] Restored last state from IndexedDB');
            }
          }
        }
        
        await refreshState();
        setIsReady(true);
        console.log('[PersistentHistory] Initialized for project:', projectId);
        
      } catch (error) {
        console.error('[PersistentHistory] Init failed:', error);
      }
    };
    
    init();
    
    return () => {
      isMounted = false;
    };
  }, [projectId, refreshState, useStore]);
  
  // ============================================================================
  // CROSS-TAB SYNC
  // ============================================================================
  
  useEffect(() => {
    if (!enableCrossTabSync) return;
    
    const channel = getBroadcastChannel();
    if (!channel) return;
    
    const handleMessage = async (event: MessageEvent<SyncMessage>) => {
      const msg = event.data;
      if (msg.tabId === TAB_ID || msg.projectId !== projectId) return;
      
      console.log('[PersistentHistory] Received cross-tab message:', msg.type);
      
      switch (msg.type) {
        case 'SAVE':
          // Another tab saved - refresh our history list
          await refreshState();
          break;
          
        case 'UNDO':
        case 'REDO':
        case 'RESTORE':
          // Another tab navigated - we need to sync
          if (msg.snapshotId) {
            const snapshot = await historyDB.getSnapshot<TState>(msg.snapshotId);
            if (snapshot?.state) {
              isRestoringRef.current = true;
              useStore.setState(snapshot.state as Partial<TState>);
              isRestoringRef.current = false;
            }
          }
          await refreshState();
          break;
      }
    };
    
    channel.addEventListener('message', handleMessage);
    
    return () => {
      channel.removeEventListener('message', handleMessage);
    };
  }, [projectId, enableCrossTabSync, refreshState, useStore]);
  
  // ============================================================================
  // AUTO-PERSIST ON CHANGES
  // ============================================================================
  
  useEffect(() => {
    if (!isReady) return;
    
    const unsubscribe = useStore.subscribe((state, prevState) => {
      if (isRestoringRef.current) return;
      
      // Debounce persist
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
      
      persistTimeoutRef.current = setTimeout(async () => {
        const stateHash = JSON.stringify(state);
        
        // Skip if state hasn't really changed
        if (stateHash === lastPersistedStateRef.current) return;
        
        const description = getSnapshotDescription(state, prevState);
        await historyDB.saveSnapshot(projectId, description, state);
        lastPersistedStateRef.current = stateHash;
        
        broadcastMessage({
          type: 'SAVE',
          projectId,
          timestamp: Date.now(),
          tabId: TAB_ID,
        });
        
        await refreshState();
        
      }, persistInterval);
    });
    
    return () => {
      unsubscribe();
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
    };
  }, [isReady, projectId, persistInterval, getSnapshotDescription, refreshState, useStore]);
  
  // ============================================================================
  // PUBLIC API
  // ============================================================================
  
  const undo = useCallback(async (): Promise<boolean> => {
    const snapshot = await historyDB.undo<TState>(projectId);
    if (!snapshot?.state) return false;
    
    isRestoringRef.current = true;
    useStore.setState(snapshot.state as Partial<TState>);
    isRestoringRef.current = false;
    
    broadcastMessage({
      type: 'UNDO',
      projectId,
      snapshotId: snapshot.id,
      timestamp: Date.now(),
      tabId: TAB_ID,
    });
    
    await refreshState();
    return true;
  }, [projectId, refreshState, useStore]);
  
  const redo = useCallback(async (): Promise<boolean> => {
    const snapshot = await historyDB.redo<TState>(projectId);
    if (!snapshot?.state) return false;
    
    isRestoringRef.current = true;
    useStore.setState(snapshot.state as Partial<TState>);
    isRestoringRef.current = false;
    
    broadcastMessage({
      type: 'REDO',
      projectId,
      snapshotId: snapshot.id,
      timestamp: Date.now(),
      tabId: TAB_ID,
    });
    
    await refreshState();
    return true;
  }, [projectId, refreshState, useStore]);
  
  const jumpToSnapshot = useCallback(async (snapshotId: string): Promise<boolean> => {
    const snapshot = await historyDB.jumpToSnapshot<TState>(projectId, snapshotId);
    if (!snapshot?.state) return false;
    
    isRestoringRef.current = true;
    useStore.setState(snapshot.state as Partial<TState>);
    isRestoringRef.current = false;
    
    broadcastMessage({
      type: 'RESTORE',
      projectId,
      snapshotId: snapshot.id,
      timestamp: Date.now(),
      tabId: TAB_ID,
    });
    
    await refreshState();
    return true;
  }, [projectId, refreshState, useStore]);
  
  const createBranch = useCallback(async (name: string): Promise<HistoryBranch | null> => {
    try {
      const branch = await historyDB.createBranch(projectId, name);
      await refreshState();
      return branch;
    } catch (e) {
      console.error('[PersistentHistory] Failed to create branch:', e);
      return null;
    }
  }, [projectId, refreshState]);
  
  const switchBranch = useCallback(async (branchId: string): Promise<boolean> => {
    const branch = await historyDB.switchBranch(projectId, branchId);
    if (!branch) return false;
    
    // Restore state from branch's current position
    if (branch.snapshotIds.length > 0 && branch.currentIndex >= 0) {
      const snapshotId = branch.snapshotIds[branch.currentIndex];
      const snapshot = await historyDB.getSnapshot<TState>(snapshotId);
      if (snapshot?.state) {
        isRestoringRef.current = true;
        useStore.setState(snapshot.state as Partial<TState>);
        isRestoringRef.current = false;
      }
    }
    
    await refreshState();
    return true;
  }, [projectId, refreshState, useStore]);
  
  const deleteBranch = useCallback(async (branchId: string): Promise<boolean> => {
    try {
      await historyDB.deleteBranch(projectId, branchId);
      await refreshState();
      return true;
    } catch (e) {
      console.error('[PersistentHistory] Failed to delete branch:', e);
      return false;
    }
  }, [projectId, refreshState]);
  
  const saveSnapshot = useCallback(async (description: string): Promise<void> => {
    const state = useStore.getState();
    await historyDB.saveSnapshot(projectId, description, state);
    lastPersistedStateRef.current = JSON.stringify(state);
    
    broadcastMessage({
      type: 'SAVE',
      projectId,
      timestamp: Date.now(),
      tabId: TAB_ID,
    });
    
    await refreshState();
  }, [projectId, refreshState, useStore]);
  
  const getStorageInfo = useCallback(async () => {
    return historyDB.getStorageUsage();
  }, []);
  
  const clearHistory = useCallback(async (): Promise<void> => {
    await historyDB.clearProject(projectId);
    await historyDB.initProject(projectId);
    lastPersistedStateRef.current = null;
    await refreshState();
  }, [projectId, refreshState]);
  
  return {
    isReady,
    canUndo,
    canRedo,
    branches,
    currentBranchId,
    historyList,
    undo,
    redo,
    jumpToSnapshot,
    createBranch,
    switchBranch,
    deleteBranch,
    saveSnapshot,
    getStorageInfo,
    clearHistory,
  };
}

// ============================================================================
// DEFAULT DESCRIPTION GENERATOR
// ============================================================================

function defaultDescriptionGenerator(state: any, prevState: any): string {
  if (!prevState) return 'Initial state';
  
  const changes: string[] = [];
  
  // Check node changes
  const prevNodeCount = prevState.nodes?.size ?? 0;
  const currNodeCount = state.nodes?.size ?? 0;
  if (currNodeCount !== prevNodeCount) {
    if (currNodeCount > prevNodeCount) {
      changes.push(`Added ${currNodeCount - prevNodeCount} node(s)`);
    } else {
      changes.push(`Removed ${prevNodeCount - currNodeCount} node(s)`);
    }
  }
  
  // Check member changes
  const prevMemberCount = prevState.members?.size ?? 0;
  const currMemberCount = state.members?.size ?? 0;
  if (currMemberCount !== prevMemberCount) {
    if (currMemberCount > prevMemberCount) {
      changes.push(`Added ${currMemberCount - prevMemberCount} member(s)`);
    } else {
      changes.push(`Removed ${prevMemberCount - currMemberCount} member(s)`);
    }
  }
  
  // Check load changes
  const prevLoadCount = (prevState.loads?.length ?? 0) + (prevState.memberLoads?.length ?? 0);
  const currLoadCount = (state.loads?.length ?? 0) + (state.memberLoads?.length ?? 0);
  if (currLoadCount !== prevLoadCount) {
    if (currLoadCount > prevLoadCount) {
      changes.push(`Added ${currLoadCount - prevLoadCount} load(s)`);
    } else {
      changes.push(`Removed ${prevLoadCount - currLoadCount} load(s)`);
    }
  }
  
  // Check analysis results
  if (state.analysisResults && !prevState.analysisResults) {
    changes.push('Analysis completed');
  } else if (!state.analysisResults && prevState.analysisResults) {
    changes.push('Cleared analysis results');
  }
  
  // Check selection changes
  const prevSelCount = prevState.selectedIds?.size ?? 0;
  const currSelCount = state.selectedIds?.size ?? 0;
  if (currSelCount !== prevSelCount) {
    changes.push(`Selection changed (${currSelCount} items)`);
  }
  
  // Check project info
  if (state.projectInfo?.name !== prevState.projectInfo?.name) {
    changes.push(`Renamed to "${state.projectInfo?.name}"`);
  }
  
  return changes.length > 0 ? changes.join(', ') : 'Model updated';
}

// ============================================================================
// KEYBOARD SHORTCUTS HOOK
// ============================================================================

export function useUndoRedoKeyboard(
  undo: () => Promise<boolean>,
  redo: () => Promise<boolean>,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input field
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }
      
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;
      
      if (cmdKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (cmdKey && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (cmdKey && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, enabled]);
}

export default usePersistentHistory;
