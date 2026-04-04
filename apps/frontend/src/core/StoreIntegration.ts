/**
 * StoreIntegration — Bridges StructuralBufferPool & CommandHistory to the Zustand model store.
 *
 * This module provides:
 *   1. `bufferSyncMiddleware` — Zustand subscriber that keeps StructuralBufferPool
 *      in sync with the store's Map<string, Node/Member> data.
 *   2. `storeAccessor` — Adapter satisfying the StoreAccessor interface for
 *      CommandHistory command factories.
 *   3. `useCommandHistory` — React hook exposing undo/redo state via useSyncExternalStore.
 *   4. `initializeIntegration` / `teardownIntegration` — lifecycle management.
 *
 * Usage:
 *   Call `initializeIntegration()` once at app startup (e.g., in App.tsx or main.tsx).
 *   Use `useCommandHistory()` in toolbar/ribbon components for undo/redo buttons.
 *   Use `getStoreAccessor()` when creating commands.
 *
 * @module core/StoreIntegration
 */

import { useSyncExternalStore, useCallback } from 'react';
import { useModelStore } from '../store/model';
import { getBufferPool, resetBufferPool } from './StructuralBufferPool';
import {
  getCommandHistory,
  resetCommandHistory,
  type HistoryState,
  type StoreAccessor,
} from './CommandHistory';

// ─── Store Accessor (for CommandHistory commands) ───────────────────

/**
 * Adapter that wraps useModelStore for the StoreAccessor interface.
 * Allows command factories to read/write the Zustand store without
 * importing it directly (prevents circular deps in complex command files).
 */
const storeAccessor: StoreAccessor = {
  getState() {
    const s = useModelStore.getState();
    return {
      nodes: s.nodes,
      members: s.members,
      plates: s.plates,
      loads: s.loads,
      memberLoads: s.memberLoads,
    };
  },
  setState(partial: Record<string, unknown>) {
    useModelStore.setState(partial as Partial<ReturnType<typeof useModelStore.getState>>);
  },
};

/** Get the store accessor singleton. */
export function getStoreAccessor(): StoreAccessor {
  return storeAccessor;
}

// ─── Buffer Pool Sync Subscriber ────────────────────────────────────

let _unsubBuffer: (() => void) | null = null;

/**
 * Subscribe to the Zustand store and sync structural data into the
 * StructuralBufferPool whenever nodes or members change.
 *
 * This is a lightweight listener — it only triggers when the node/member
 * Map references actually change (Zustand uses immutable Map replacements).
 */
function startBufferSync(): void {
  if (_unsubBuffer) return; // already running

  const pool = getBufferPool();
  let prevNodesRef: Map<string, unknown> | null = null;
  let prevMembersRef: Map<string, unknown> | null = null;

  _unsubBuffer = useModelStore.subscribe((state) => {
    const nodesRef = state.nodes;
    const membersRef = state.members;

    // Only sync when Map reference has changed (Zustand immutable pattern)
    if (nodesRef !== prevNodesRef || membersRef !== prevMembersRef) {
      prevNodesRef = nodesRef;
      prevMembersRef = membersRef;

      // Full resync — for incremental mode, use the pool's add/remove directly
      pool.syncFromMaps(
        state.nodes as Map<string, { id: string; x: number; y: number; z: number; restraints?: { fx: boolean; fy: boolean; fz: boolean; mx: boolean; my: boolean; mz: boolean } }>,
        state.members as Map<string, { id: string; startNodeId: string; endNodeId: string; E?: number; A?: number; I?: number; Iy?: number; Iz?: number; J?: number; G?: number }>,
      );
    }
  });
}

function stopBufferSync(): void {
  if (_unsubBuffer) {
    _unsubBuffer();
    _unsubBuffer = null;
  }
}

// ─── React Hook: useCommandHistory ──────────────────────────────────

/**
 * React hook that exposes CommandHistory state reactively via useSyncExternalStore.
 * Use in Toolbar, EngineeringRibbon, HistoryPanel, etc.
 *
 * Returns:
 *   state   — current HistoryState (canUndo, canRedo, descriptions, entries...)
 *   undo()  — trigger undo
 *   redo()  — trigger redo
 *   clear() — clear all history
 */
export function useCommandHistoryState(): {
  state: HistoryState;
  undo: () => void;
  redo: () => void;
  clear: () => void;
} {
  const history = getCommandHistory();

  const state = useSyncExternalStore(
    (onStoreChange) => {
      return history.subscribe(onStoreChange);
    },
    () => history.getState(),
    () => history.getState(),
  );

  const undo = useCallback(() => { history.undo(); }, [history]);
  const redo = useCallback(() => { history.redo(); }, [history]);
  const clear = useCallback(() => { history.clear(); }, [history]);

  return { state, undo, redo, clear };
}

// ─── Lifecycle ──────────────────────────────────────────────────────

let _initialized = false;

/**
 * Initialize the buffer pool sync and command history.
 * Call once at app startup.
 */
export function initializeIntegration(): void {
  if (_initialized) return;
  _initialized = true;

  // Start syncing Zustand → BufferPool
  startBufferSync();

  // Initial sync of current store state
  const state = useModelStore.getState();
  if (state.nodes.size > 0 || state.members.size > 0) {
    const pool = getBufferPool();
    pool.syncFromMaps(
      state.nodes as Map<string, { id: string; x: number; y: number; z: number; restraints?: { fx: boolean; fy: boolean; fz: boolean; mx: boolean; my: boolean; mz: boolean } }>,
      state.members as Map<string, { id: string; startNodeId: string; endNodeId: string; E?: number; A?: number; I?: number; Iy?: number; Iz?: number; J?: number; G?: number }>,
    );
  }
}

/**
 * Teardown integration (e.g., on full model reset / project load).
 */
export function teardownIntegration(): void {
  stopBufferSync();
  resetBufferPool();
  resetCommandHistory();
  _initialized = false;
}

/**
 * Re-initialize (e.g., after loading a new project).
 */
export function reinitializeIntegration(): void {
  teardownIntegration();
  initializeIntegration();
}
