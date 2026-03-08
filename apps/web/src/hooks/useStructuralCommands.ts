/**
 * useStructuralCommands — React hook that routes structural mutations
 * through the delta-based CommandHistory instead of zundo snapshots.
 *
 * Drop-in replacement for store.addNode() / store.removeNode() etc.
 * Components using this hook get delta-based undo/redo automatically.
 *
 * Memory comparison (50K-node model):
 *   zundo:   25 snapshots × ~20 MB = 500 MB
 *   deltas:  200 commands  × ~100 B = 20 KB
 *
 * Usage:
 *   const { addNode, removeNode, moveNode, undo, redo, canUndo, canRedo } = useStructuralCommands();
 *   addNode({ id: 'N1', x: 0, y: 0, z: 0 });
 *   undo(); // reverts addNode
 *
 * @module hooks/useStructuralCommands
 */

import { useCallback, useMemo } from 'react';
import {
  getCommandHistory,
  getStoreAccessor,
  useCommandHistoryState,
} from '../core';
import {
  createAddNodeCommand,
  createRemoveNodeCommand,
  createMoveNodeCommand,
  createMoveNodesCommand,
  createSetRestraintsCommand,
  createAddMemberCommand,
  createRemoveMemberCommand,
  createUpdateMemberCommand,
  createBulkAddNodesCommand,
  createBulkAddMembersCommand,
  createDeleteSelectionCommand,
  createAddLoadCommand,
  createAddMemberLoadCommand,
  createRemoveLoadCommand,
  createAddPlateCommand,
  createRemovePlateCommand,
} from '../core/CommandHistory';
import type { Node, Member, Plate, NodeLoad, MemberLoad, Restraints } from '../store/modelTypes';

export interface StructuralCommandsAPI {
  // ── Node mutations ──
  addNode: (node: Node) => void;
  removeNode: (id: string) => void;
  moveNode: (id: string, pos: { x?: number; y?: number; z?: number }) => void;
  moveNodes: (moves: Array<{ nodeId: string; dx: number; dy: number; dz: number }>) => void;
  setRestraints: (id: string, restraints: Restraints) => void;

  // ── Member mutations ──
  addMember: (member: Member) => void;
  removeMember: (id: string) => void;
  updateMember: (id: string, updates: Partial<Member>) => void;

  // ── Bulk operations ──
  addNodes: (nodes: Node[]) => void;
  addMembers: (members: Member[]) => void;
  deleteSelection: (selectedIds: Set<string>) => void;

  // ── Load mutations ──
  addLoad: (load: NodeLoad) => void;
  removeLoad: (id: string) => void;
  addMemberLoad: (load: MemberLoad) => void;

  // ── Plate mutations ──
  addPlate: (plate: Plate) => void;
  removePlate: (id: string) => void;

  // ── Undo/Redo ──
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | undefined;
  redoDescription: string | undefined;
  undoCount: number;
  redoCount: number;
  totalBytes: number;
  clear: () => void;
}

/**
 * React hook providing structural mutations routed through CommandHistory.
 * Every mutation is automatically recorded as a delta command — enabling
 * ~100-byte undo entries vs ~20 MB zundo snapshots.
 */
export function useStructuralCommands(): StructuralCommandsAPI {
  const { state: historyState, undo, redo, clear } = useCommandHistoryState();
  const history = useMemo(() => getCommandHistory(), []);
  const accessor = useMemo(() => getStoreAccessor(), []);

  // ── Node commands ──

  const addNode = useCallback((node: Node) => {
    history.execute(createAddNodeCommand(accessor, node));
  }, [history, accessor]);

  const removeNode = useCallback((id: string) => {
    history.execute(createRemoveNodeCommand(accessor, id));
  }, [history, accessor]);

  const moveNode = useCallback((id: string, pos: { x?: number; y?: number; z?: number }) => {
    history.execute(createMoveNodeCommand(accessor, id, pos));
  }, [history, accessor]);

  const moveNodes = useCallback((moves: Array<{ nodeId: string; dx: number; dy: number; dz: number }>) => {
    history.execute(createMoveNodesCommand(accessor, moves));
  }, [history, accessor]);

  const setRestraints = useCallback((id: string, restraints: Restraints) => {
    history.execute(createSetRestraintsCommand(accessor, id, restraints));
  }, [history, accessor]);

  // ── Member commands ──

  const addMember = useCallback((member: Member) => {
    history.execute(createAddMemberCommand(accessor, member));
  }, [history, accessor]);

  const removeMember = useCallback((id: string) => {
    history.execute(createRemoveMemberCommand(accessor, id));
  }, [history, accessor]);

  const updateMember = useCallback((id: string, updates: Partial<Member>) => {
    history.execute(createUpdateMemberCommand(accessor, id, updates));
  }, [history, accessor]);

  // ── Bulk commands ──

  const addNodes = useCallback((nodes: Node[]) => {
    history.execute(createBulkAddNodesCommand(accessor, nodes));
  }, [history, accessor]);

  const addMembers = useCallback((members: Member[]) => {
    history.execute(createBulkAddMembersCommand(accessor, members));
  }, [history, accessor]);

  const deleteSelection = useCallback((selectedIds: Set<string>) => {
    history.execute(createDeleteSelectionCommand(accessor, selectedIds));
  }, [history, accessor]);

  // ── Load commands ──

  const addLoad = useCallback((load: NodeLoad) => {
    history.execute(createAddLoadCommand(accessor, load));
  }, [history, accessor]);

  const removeLoad = useCallback((id: string) => {
    history.execute(createRemoveLoadCommand(accessor, id));
  }, [history, accessor]);

  const addMemberLoad = useCallback((load: MemberLoad) => {
    history.execute(createAddMemberLoadCommand(accessor, load));
  }, [history, accessor]);

  // ── Plate commands ──

  const addPlate = useCallback((plate: Plate) => {
    history.execute(createAddPlateCommand(accessor, plate));
  }, [history, accessor]);

  const removePlate = useCallback((id: string) => {
    history.execute(createRemovePlateCommand(accessor, id));
  }, [history, accessor]);

  return {
    addNode, removeNode, moveNode, moveNodes, setRestraints,
    addMember, removeMember, updateMember,
    addNodes, addMembers, deleteSelection,
    addLoad, removeLoad, addMemberLoad,
    addPlate, removePlate,
    undo, redo, clear,
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
    undoDescription: historyState.undoDescription,
    redoDescription: historyState.redoDescription,
    undoCount: historyState.undoCount,
    redoCount: historyState.redoCount,
    totalBytes: historyState.totalBytes,
  };
}
