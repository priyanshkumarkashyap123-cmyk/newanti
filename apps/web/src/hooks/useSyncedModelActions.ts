/**
 * useSyncedModelActions — Wraps Zustand store mutations with offline sync queue.
 *
 * Every structural model mutation (addNode, addMember, updateNode, etc.)
 * is applied optimistically to the local store AND queued via SyncManager
 * for eventual server-side persistence.
 *
 * Usage:
 *   const { addNode, removeNode, addMember, updateMember, ... } = useSyncedModelActions();
 *   addNode({ id: 'N1', x: 0, y: 0, z: 0, ... });
 *
 * Benefits:
 * - Offline-first: mutations apply immediately to local state
 * - Queued: all changes persist to IndexedDB and sync when online
 * - Drop-in: same API as raw store actions, just import this hook instead
 */

import { useCallback } from 'react';
import { useModelStore, type Node, type Member, type MemberLoad } from '../store/model';
import { useSync } from '../lib/offlineSync';

export function useSyncedModelActions() {
  const store = useModelStore;
  const { queue } = useSync();

  // ---- Nodes ----

  const addNode = useCallback(
    (node: Node) => {
      store.getState().addNode(node);
      queue('create', 'node', node).catch(console.error);
    },
    [queue],
  );

  const removeNode = useCallback(
    (id: string) => {
      store.getState().removeNode(id);
      queue('delete', 'node', { id }).catch(console.error);
    },
    [queue],
  );

  const updateNode = useCallback(
    (id: string, updates: Partial<Node>) => {
      store.getState().updateNode(id, updates);
      queue('update', 'node', { id, ...updates }).catch(console.error);
    },
    [queue],
  );

  const updateNodePosition = useCallback(
    (id: string, position: { x?: number; y?: number; z?: number }) => {
      store.getState().updateNodePosition(id, position);
      queue('update', 'node', { id, position }).catch(console.error);
    },
    [queue],
  );

  // ---- Members ----

  const addMember = useCallback(
    (member: Member) => {
      store.getState().addMember(member);
      queue('create', 'member', member).catch(console.error);
    },
    [queue],
  );

  const updateMember = useCallback(
    (id: string, updates: Partial<Member>) => {
      store.getState().updateMember(id, updates);
      queue('update', 'member', { id, ...updates }).catch(console.error);
    },
    [queue],
  );

  const removeMember = useCallback(
    (id: string) => {
      store.getState().removeMember(id);
      queue('delete', 'member', { id }).catch(console.error);
    },
    [queue],
  );

  // ---- Member Loads ----

  const addMemberLoad = useCallback(
    (load: MemberLoad) => {
      store.getState().addMemberLoad(load);
      queue('create', 'memberLoad', load).catch(console.error);
    },
    [queue],
  );

  const removeMemberLoad = useCallback(
    (id: string) => {
      store.getState().removeMemberLoad(id);
      queue('delete', 'memberLoad', { id }).catch(console.error);
    },
    [queue],
  );

  const updateMemberLoadById = useCallback(
    (id: string, updates: Partial<MemberLoad>) => {
      store.getState().updateMemberLoadById(id, updates);
      queue('update', 'memberLoad', { id, ...updates }).catch(console.error);
    },
    [queue],
  );

  // ---- Bulk Operations ----

  const addNodes = useCallback(
    (nodes: Node[]) => {
      store.getState().addNodes(nodes);
      // Single queue entry for bulk operation
      queue('create', 'nodes_bulk', { nodes }).catch(console.error);
    },
    [queue],
  );

  const addMembers = useCallback(
    (members: Member[]) => {
      store.getState().addMembers(members);
      queue('create', 'members_bulk', { members }).catch(console.error);
    },
    [queue],
  );

  return {
    addNode,
    removeNode,
    updateNode,
    updateNodePosition,
    addMember,
    updateMember,
    removeMember,
    addMemberLoad,
    removeMemberLoad,
    updateMemberLoadById,
    addNodes,
    addMembers,
  };
}
