/**
 * CommandHistory — Delta-based undo/redo replacing state-snapshot cloning.
 *
 * Why this exists:
 *   Zustand's zundo `temporal` middleware snapshots the entire partialized state
 *   on every mutation.  For a 50,000-node model each snapshot is ~20 MB of
 *   serialized Maps.  With `limit: 25` that's 500 MB of undo history — the
 *   browser will OOM.
 *
 *   This module stores only DELTAS: "Node N5 moved from (1,2,3) to (4,5,6)"
 *   = ~100 bytes instead of 20 MB.  100 undo steps × 100 bytes = 10 KB.
 *
 * Architecture:
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │  CommandHistory                                                  │
 *   │                                                                 │
 *   │  undo stack: [Cmd, Cmd, BatchCmd, Cmd, ...]                    │
 *   │  redo stack: [Cmd, ...]                                        │
 *   │                                                                 │
 *   │  Each Cmd stores:                                               │
 *   │    apply(store)  — forward delta                                │
 *   │    revert(store) — inverse delta                                │
 *   │    description   — human-readable label                        │
 *   │    byteEstimate  — memory cost for automatic pruning           │
 *   │                                                                 │
 *   │  Integration:                                                   │
 *   │    commandHistory.execute(cmd) calls cmd.apply(store)           │
 *   │    commandHistory.undo() calls last cmd.revert(store)           │
 *   │    commandHistory.redo() calls cmd.apply(store) again           │
 *   │                                                                 │
 *   │  The command functions call useModelStore.setState()             │
 *   │  directly to mutate state, bypassing the zundo wrapper.        │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * @module core/CommandHistory
 */

// ─── Types ──────────────────────────────────────────────────────────

/**
 * A single undoable structural editing command that stores only the delta.
 * `apply` performs the forward mutation, `revert` undoes it.
 * Both operate directly on the Zustand store via setState.
 */
export interface StructuralCommand {
  /** Unique identifier */
  readonly id: string;
  /** Human-readable description shown in history panel */
  readonly description: string;
  /** Timestamp of execution */
  readonly timestamp: number;
  /** Estimated memory cost in bytes (for automatic pruning) */
  readonly byteEstimate: number;

  /**
   * Apply the forward delta to the store.
   * Called on initial execution and on redo.
   */
  apply(): void;

  /**
   * Apply the inverse delta to the store.
   * Called on undo.
   */
  revert(): void;
}

/**
 * A batch of commands executed as a single undo unit.
 * When undone, all sub-commands revert in reverse order.
 */
export interface BatchCommand extends StructuralCommand {
  readonly commands: StructuralCommand[];
}

/**
 * Listener callback for history changes.
 */
export type HistoryListener = (state: HistoryState) => void;

/**
 * Readonly snapshot of history state (for UI binding).
 */
export interface HistoryState {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoDescription: string | undefined;
  readonly redoDescription: string | undefined;
  readonly undoCount: number;
  readonly redoCount: number;
  readonly totalBytes: number;
  readonly entries: ReadonlyArray<{
    id: string;
    description: string;
    timestamp: number;
  }>;
  readonly currentIndex: number;
}

// ─── Configuration ──────────────────────────────────────────────────

export interface CommandHistoryOptions {
  /** Maximum number of undo steps (default: 200) */
  maxSteps?: number;
  /** Maximum total memory for undo stack in bytes (default: 50 MB) */
  maxBytes?: number;
  /** Coalesce rapid successive commands with same type within this window (ms) */
  coalesceWindowMs?: number;
}

const DEFAULT_OPTIONS: Required<CommandHistoryOptions> = {
  maxSteps: 200,
  maxBytes: 50 * 1024 * 1024,      // 50 MB
  coalesceWindowMs: 300,            // 300ms coalesce window
};

// ─── ID generator ───────────────────────────────────────────────────

let _cmdSeq = 0;
export function generateCommandId(): string {
  return `cmd_${++_cmdSeq}_${Date.now().toString(36)}`;
}

// ─── Command History Manager ────────────────────────────────────────

export class CommandHistory {
  private _undoStack: StructuralCommand[] = [];
  private _redoStack: StructuralCommand[] = [];
  private _totalBytes = 0;
  private _options: Required<CommandHistoryOptions>;
  private _listeners = new Set<HistoryListener>();
  private _lastCommandType: string | null = null;
  private _lastCommandTime = 0;

  constructor(options?: CommandHistoryOptions) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Core API
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Execute a command: apply its forward delta and push to undo stack.
   * Clears the redo stack (any "future" is discarded).
   */
  execute(command: StructuralCommand): void {
    command.apply();
    this._redoStack.length = 0;
    this._undoStack.push(command);
    this._totalBytes += command.byteEstimate;
    this._lastCommandType = command.description;
    this._lastCommandTime = Date.now();
    this._enforceLimit();
    this._notify();
  }

  /**
   * Execute a batch of commands as a single undo unit.
   */
  executeBatch(description: string, commands: StructuralCommand[]): void {
    if (commands.length === 0) return;

    // Execute all sub-commands
    for (const cmd of commands) {
      cmd.apply();
    }

    const totalBytes = commands.reduce((sum, c) => sum + c.byteEstimate, 0);
    const batch: BatchCommand = {
      id: generateCommandId(),
      description,
      timestamp: Date.now(),
      byteEstimate: totalBytes,
      commands,
      apply() {
        for (const cmd of commands) cmd.apply();
      },
      revert() {
        // Revert in reverse order
        for (let i = commands.length - 1; i >= 0; i--) {
          commands[i].revert();
        }
      },
    };

    this._redoStack.length = 0;
    this._undoStack.push(batch);
    this._totalBytes += totalBytes;
    this._enforceLimit();
    this._notify();
  }

  /**
   * Undo the last command.
   */
  undo(): boolean {
    const cmd = this._undoStack.pop();
    if (!cmd) return false;

    cmd.revert();
    this._redoStack.push(cmd);
    this._totalBytes -= cmd.byteEstimate;
    this._notify();
    return true;
  }

  /**
   * Redo the next command.
   */
  redo(): boolean {
    const cmd = this._redoStack.pop();
    if (!cmd) return false;

    cmd.apply();
    this._undoStack.push(cmd);
    this._totalBytes += cmd.byteEstimate;
    this._notify();
    return true;
  }

  /**
   * Clear all history.
   */
  clear(): void {
    this._undoStack.length = 0;
    this._redoStack.length = 0;
    this._totalBytes = 0;
    this._lastCommandType = null;
    this._notify();
  }

  // ═══════════════════════════════════════════════════════════════════
  // State Queries
  // ═══════════════════════════════════════════════════════════════════

  get canUndo(): boolean { return this._undoStack.length > 0; }
  get canRedo(): boolean { return this._redoStack.length > 0; }

  get undoDescription(): string | undefined {
    return this._undoStack.length > 0
      ? this._undoStack[this._undoStack.length - 1].description
      : undefined;
  }

  get redoDescription(): string | undefined {
    return this._redoStack.length > 0
      ? this._redoStack[this._redoStack.length - 1].description
      : undefined;
  }

  /**
   * Return a readonly snapshot of current history state (for React UI).
   */
  getState(): HistoryState {
    return {
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      undoDescription: this.undoDescription,
      redoDescription: this.redoDescription,
      undoCount: this._undoStack.length,
      redoCount: this._redoStack.length,
      totalBytes: this._totalBytes,
      entries: this._undoStack.map(c => ({
        id: c.id,
        description: c.description,
        timestamp: c.timestamp,
      })),
      currentIndex: this._undoStack.length - 1,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Subscription (for React useSyncExternalStore integration)
  // ═══════════════════════════════════════════════════════════════════

  subscribe(listener: HistoryListener): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  private _notify(): void {
    const state = this.getState();
    for (const listener of this._listeners) {
      listener(state);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Limit enforcement
  // ═══════════════════════════════════════════════════════════════════

  private _enforceLimit(): void {
    // Enforce step limit
    while (this._undoStack.length > this._options.maxSteps) {
      const removed = this._undoStack.shift();
      if (removed) this._totalBytes -= removed.byteEstimate;
    }
    // Enforce byte limit
    while (this._totalBytes > this._options.maxBytes && this._undoStack.length > 1) {
      const removed = this._undoStack.shift();
      if (removed) this._totalBytes -= removed.byteEstimate;
    }
  }
}

// ═════════════════════════════════════════════════════════════════════
// Concrete Command Factories
// ═════════════════════════════════════════════════════════════════════

// These factories create StructuralCommands that call
// useModelStore.setState() directly.  They capture the minimal delta
// needed to undo/redo each operation.

import type { Node, Member, NodeLoad, MemberLoad, Plate } from '../store/modelTypes';
import type { Restraints } from '../store/modelTypes';

/**
 * StoreAccessor provides the minimal interface into the Zustand store
 * needed by commands. Passed at creation time to avoid direct import
 * dependency on the store module (prevents circular imports).
 */
export interface StoreAccessor {
  getState(): {
    nodes: Map<string, Node>;
    members: Map<string, Member>;
    plates: Map<string, Plate>;
    loads: NodeLoad[];
    memberLoads: MemberLoad[];
  };
  setState(partial: Record<string, unknown>): void;
}

// ─── Node Commands ──────────────────────────────────────────────────

/** Add a node — delta stores only the node object (~200 bytes). */
export function createAddNodeCommand(
  store: StoreAccessor,
  node: Node,
): StructuralCommand {
  return {
    id: generateCommandId(),
    description: `Add node ${node.id}`,
    timestamp: Date.now(),
    byteEstimate: 200,
    apply() {
      const nodes = new Map(store.getState().nodes);
      nodes.set(node.id, node);
      store.setState({ nodes });
    },
    revert() {
      const nodes = new Map(store.getState().nodes);
      nodes.delete(node.id);
      store.setState({ nodes });
    },
  };
}

/** Remove a node — delta stores the removed node + cascaded members (~1 KB). */
export function createRemoveNodeCommand(
  store: StoreAccessor,
  nodeId: string,
): StructuralCommand {
  // Capture all data needed to restore on undo
  const state = store.getState();
  const removedNode = state.nodes.get(nodeId);
  if (!removedNode) {
    return createNoopCommand(`Remove node ${nodeId} (not found)`);
  }

  // Find cascade-deleted members
  const cascadeMembers: Member[] = [];
  for (const [, member] of state.members) {
    if (member.startNodeId === nodeId || member.endNodeId === nodeId) {
      cascadeMembers.push({ ...member });
    }
  }

  // Find cascade-deleted loads
  const cascadeLoads = state.loads.filter(l => l.nodeId === nodeId);
  const cascadeMemberLoads = state.memberLoads.filter(ml =>
    cascadeMembers.some(m => m.id === ml.memberId)
  );

  // Find cascade-deleted plates
  const cascadePlates: Plate[] = [];
  for (const [, plate] of state.plates) {
    if (plate.nodeIds.includes(nodeId)) {
      cascadePlates.push({ ...plate });
    }
  }

  const savedNode = { ...removedNode };

  return {
    id: generateCommandId(),
    description: `Remove node ${nodeId}`,
    timestamp: Date.now(),
    byteEstimate: 200 + cascadeMembers.length * 300 + cascadeLoads.length * 100,
    apply() {
      const s = store.getState();
      const nodes = new Map(s.nodes);
      const members = new Map(s.members);
      const plates = new Map(s.plates);
      nodes.delete(nodeId);
      for (const m of cascadeMembers) members.delete(m.id);
      for (const p of cascadePlates) plates.delete(p.id);
      const loads = s.loads.filter(l => l.nodeId !== nodeId);
      const cascadeMemberIds = new Set(cascadeMembers.map(m => m.id));
      const memberLoads = s.memberLoads.filter(ml => !cascadeMemberIds.has(ml.memberId));
      store.setState({ nodes, members, plates, loads, memberLoads });
    },
    revert() {
      const s = store.getState();
      const nodes = new Map(s.nodes);
      const members = new Map(s.members);
      const plates = new Map(s.plates);
      nodes.set(nodeId, savedNode);
      for (const m of cascadeMembers) members.set(m.id, m);
      for (const p of cascadePlates) plates.set(p.id, p);
      const loads = [...s.loads, ...cascadeLoads];
      const memberLoads = [...s.memberLoads, ...cascadeMemberLoads];
      store.setState({ nodes, members, plates, loads, memberLoads });
    },
  };
}

/** Move a node — delta stores only (nodeId, oldXYZ, newXYZ) = ~100 bytes. */
export function createMoveNodeCommand(
  store: StoreAccessor,
  nodeId: string,
  newPosition: { x?: number; y?: number; z?: number },
): StructuralCommand {
  const node = store.getState().nodes.get(nodeId);
  if (!node) return createNoopCommand(`Move node ${nodeId} (not found)`);

  const oldX = node.x;
  const oldY = node.y;
  const oldZ = node.z;
  const newX = newPosition.x ?? oldX;
  const newY = newPosition.y ?? oldY;
  const newZ = newPosition.z ?? oldZ;

  return {
    id: generateCommandId(),
    description: `Move node ${nodeId}`,
    timestamp: Date.now(),
    byteEstimate: 100,
    apply() {
      const nodes = new Map(store.getState().nodes);
      const n = nodes.get(nodeId);
      if (n) {
        nodes.set(nodeId, { ...n, x: newX, y: newY, z: newZ });
        store.setState({ nodes });
      }
    },
    revert() {
      const nodes = new Map(store.getState().nodes);
      const n = nodes.get(nodeId);
      if (n) {
        nodes.set(nodeId, { ...n, x: oldX, y: oldY, z: oldZ });
        store.setState({ nodes });
      }
    },
  };
}

/** Move multiple nodes — delta stores (id,oldXYZ,newXYZ)[] ~100 bytes/node. */
export function createMoveNodesCommand(
  store: StoreAccessor,
  moves: Array<{ nodeId: string; dx: number; dy: number; dz: number }>,
): StructuralCommand {
  // Capture old positions
  const deltas: Array<{ nodeId: string; oldX: number; oldY: number; oldZ: number; newX: number; newY: number; newZ: number }> = [];
  const state = store.getState();
  for (const { nodeId, dx, dy, dz } of moves) {
    const node = state.nodes.get(nodeId);
    if (!node) continue;
    deltas.push({
      nodeId,
      oldX: node.x, oldY: node.y, oldZ: node.z,
      newX: node.x + dx, newY: node.y + dy, newZ: node.z + dz,
    });
  }

  return {
    id: generateCommandId(),
    description: `Move ${deltas.length} nodes`,
    timestamp: Date.now(),
    byteEstimate: deltas.length * 100,
    apply() {
      const nodes = new Map(store.getState().nodes);
      for (const d of deltas) {
        const n = nodes.get(d.nodeId);
        if (n) nodes.set(d.nodeId, { ...n, x: d.newX, y: d.newY, z: d.newZ });
      }
      store.setState({ nodes });
    },
    revert() {
      const nodes = new Map(store.getState().nodes);
      for (const d of deltas) {
        const n = nodes.get(d.nodeId);
        if (n) nodes.set(d.nodeId, { ...n, x: d.oldX, y: d.oldY, z: d.oldZ });
      }
      store.setState({ nodes });
    },
  };
}

/** Set node restraints — delta stores old + new restraints ~80 bytes. */
export function createSetRestraintsCommand(
  store: StoreAccessor,
  nodeId: string,
  newRestraints: Restraints,
): StructuralCommand {
  const node = store.getState().nodes.get(nodeId);
  const oldRestraints = node?.restraints ? { ...node.restraints } : undefined;

  return {
    id: generateCommandId(),
    description: `Set restraints on ${nodeId}`,
    timestamp: Date.now(),
    byteEstimate: 80,
    apply() {
      const nodes = new Map(store.getState().nodes);
      const n = nodes.get(nodeId);
      if (n) {
        nodes.set(nodeId, { ...n, restraints: newRestraints });
        store.setState({ nodes });
      }
    },
    revert() {
      const nodes = new Map(store.getState().nodes);
      const n = nodes.get(nodeId);
      if (n) {
        nodes.set(nodeId, { ...n, restraints: oldRestraints });
        store.setState({ nodes });
      }
    },
  };
}

// ─── Member Commands ────────────────────────────────────────────────

/** Add a member — delta stores the member object (~300 bytes). */
export function createAddMemberCommand(
  store: StoreAccessor,
  member: Member,
): StructuralCommand {
  return {
    id: generateCommandId(),
    description: `Add member ${member.id}`,
    timestamp: Date.now(),
    byteEstimate: 300,
    apply() {
      const members = new Map(store.getState().members);
      // Apply defaults like the store does
      const memberWithDefaults = {
        ...member,
        sectionId: member.sectionId ?? 'Default',
        E: member.E ?? 200e6,
        A: member.A ?? 0.01,
        I: member.I ?? 1e-4,
      };
      members.set(member.id, memberWithDefaults);
      store.setState({ members });
    },
    revert() {
      const members = new Map(store.getState().members);
      members.delete(member.id);
      store.setState({ members });
    },
  };
}

/** Remove a member — delta stores the removed member (~300 bytes). */
export function createRemoveMemberCommand(
  store: StoreAccessor,
  memberId: string,
): StructuralCommand {
  const member = store.getState().members.get(memberId);
  if (!member) return createNoopCommand(`Remove member ${memberId} (not found)`);

  const savedMember = { ...member };
  const cascadeMemberLoads = store.getState().memberLoads.filter(ml => ml.memberId === memberId);

  return {
    id: generateCommandId(),
    description: `Remove member ${memberId}`,
    timestamp: Date.now(),
    byteEstimate: 300 + cascadeMemberLoads.length * 100,
    apply() {
      const members = new Map(store.getState().members);
      members.delete(memberId);
      const memberLoads = store.getState().memberLoads.filter(ml => ml.memberId !== memberId);
      store.setState({ members, memberLoads });
    },
    revert() {
      const members = new Map(store.getState().members);
      members.set(memberId, savedMember);
      const memberLoads = [...store.getState().memberLoads, ...cascadeMemberLoads];
      store.setState({ members, memberLoads });
    },
  };
}

/** Update member properties — delta stores old+new partial ~200 bytes. */
export function createUpdateMemberCommand(
  store: StoreAccessor,
  memberId: string,
  updates: Partial<Member>,
): StructuralCommand {
  const member = store.getState().members.get(memberId);
  if (!member) return createNoopCommand(`Update member ${memberId} (not found)`);

  // Capture only the properties being changed (oldValues)
  const oldValues: Partial<Member> = {};
  for (const key of Object.keys(updates) as (keyof Member)[]) {
    (oldValues as Record<string, unknown>)[key] = member[key];
  }

  return {
    id: generateCommandId(),
    description: `Update member ${memberId}`,
    timestamp: Date.now(),
    byteEstimate: 200,
    apply() {
      const members = new Map(store.getState().members);
      const m = members.get(memberId);
      if (m) {
        members.set(memberId, { ...m, ...updates });
        store.setState({ members });
      }
    },
    revert() {
      const members = new Map(store.getState().members);
      const m = members.get(memberId);
      if (m) {
        members.set(memberId, { ...m, ...oldValues });
        store.setState({ members });
      }
    },
  };
}

// ─── Bulk Commands ──────────────────────────────────────────────────

/** Add multiple nodes in one undo step. */
export function createBulkAddNodesCommand(
  store: StoreAccessor,
  newNodes: Node[],
): StructuralCommand {
  const nodeIds = newNodes.map(n => n.id);

  return {
    id: generateCommandId(),
    description: `Add ${newNodes.length} nodes`,
    timestamp: Date.now(),
    byteEstimate: newNodes.length * 200,
    apply() {
      const nodes = new Map(store.getState().nodes);
      for (const node of newNodes) nodes.set(node.id, node);
      store.setState({ nodes });
    },
    revert() {
      const nodes = new Map(store.getState().nodes);
      for (const id of nodeIds) nodes.delete(id);
      store.setState({ nodes });
    },
  };
}

/** Add multiple members in one undo step. */
export function createBulkAddMembersCommand(
  store: StoreAccessor,
  newMembers: Member[],
): StructuralCommand {
  const memberIds = newMembers.map(m => m.id);

  return {
    id: generateCommandId(),
    description: `Add ${newMembers.length} members`,
    timestamp: Date.now(),
    byteEstimate: newMembers.length * 300,
    apply() {
      const members = new Map(store.getState().members);
      for (const member of newMembers) {
        members.set(member.id, {
          ...member,
          sectionId: member.sectionId ?? 'Default',
          E: member.E ?? 200e6,
          A: member.A ?? 0.01,
          I: member.I ?? 1e-4,
        });
      }
      store.setState({ members });
    },
    revert() {
      const members = new Map(store.getState().members);
      for (const id of memberIds) members.delete(id);
      store.setState({ members });
    },
  };
}

/** Delete selected nodes and members — stores everything needed to restore. */
export function createDeleteSelectionCommand(
  store: StoreAccessor,
  selectedIds: Set<string>,
): StructuralCommand {
  const state = store.getState();
  const deletedNodes: Node[] = [];
  const deletedMembers: Member[] = [];
  const deletedPlates: Plate[] = [];
  const deletedNodeIds = new Set<string>();

  // Collect selected nodes
  for (const id of selectedIds) {
    const node = state.nodes.get(id);
    if (node) {
      deletedNodes.push({ ...node });
      deletedNodeIds.add(id);
    }
  }

  // Collect selected members + members connected to deleted nodes
  for (const id of selectedIds) {
    const member = state.members.get(id);
    if (member) deletedMembers.push({ ...member });
  }
  for (const [, member] of state.members) {
    if (deletedNodeIds.has(member.startNodeId) || deletedNodeIds.has(member.endNodeId)) {
      if (!selectedIds.has(member.id)) {
        deletedMembers.push({ ...member });
      }
    }
  }

  // Collect cascade-deleted plates
  for (const [, plate] of state.plates) {
    if (plate.nodeIds.some(nid => deletedNodeIds.has(nid)) || selectedIds.has(plate.id)) {
      deletedPlates.push({ ...plate });
    }
  }

  const deletedMemberIds = new Set(deletedMembers.map(m => m.id));
  const deletedLoads = state.loads.filter(l => deletedNodeIds.has(l.nodeId));
  const deletedMemberLoads = state.memberLoads.filter(ml => deletedMemberIds.has(ml.memberId));

  return {
    id: generateCommandId(),
    description: `Delete ${deletedNodes.length} nodes, ${deletedMembers.length} members`,
    timestamp: Date.now(),
    byteEstimate: deletedNodes.length * 200 + deletedMembers.length * 300 + deletedLoads.length * 100,
    apply() {
      const s = store.getState();
      const nodes = new Map(s.nodes);
      const members = new Map(s.members);
      const plates = new Map(s.plates);
      for (const n of deletedNodes) nodes.delete(n.id);
      for (const m of deletedMembers) members.delete(m.id);
      for (const p of deletedPlates) plates.delete(p.id);
      const loads = s.loads.filter(l => !deletedNodeIds.has(l.nodeId));
      const memberLoads = s.memberLoads.filter(ml => !deletedMemberIds.has(ml.memberId));
      store.setState({ nodes, members, plates, loads, memberLoads });
    },
    revert() {
      const s = store.getState();
      const nodes = new Map(s.nodes);
      const members = new Map(s.members);
      const plates = new Map(s.plates);
      for (const n of deletedNodes) nodes.set(n.id, n);
      for (const m of deletedMembers) members.set(m.id, m);
      for (const p of deletedPlates) plates.set(p.id, p);
      const loads = [...s.loads, ...deletedLoads];
      const memberLoads = [...s.memberLoads, ...deletedMemberLoads];
      store.setState({ nodes, members, plates, loads, memberLoads });
    },
  };
}

// ─── Load Commands ──────────────────────────────────────────────────

/** Add a node load. */
export function createAddLoadCommand(
  store: StoreAccessor,
  load: NodeLoad,
): StructuralCommand {
  return {
    id: generateCommandId(),
    description: `Add load on ${load.nodeId}`,
    timestamp: Date.now(),
    byteEstimate: 120,
    apply() {
      const loads = [...store.getState().loads, load];
      store.setState({ loads });
    },
    revert() {
      const loads = store.getState().loads.filter(l => l.id !== load.id);
      store.setState({ loads });
    },
  };
}

/** Add a member load. */
export function createAddMemberLoadCommand(
  store: StoreAccessor,
  load: MemberLoad,
): StructuralCommand {
  return {
    id: generateCommandId(),
    description: `Add member load on ${load.memberId}`,
    timestamp: Date.now(),
    byteEstimate: 150,
    apply() {
      const memberLoads = [...store.getState().memberLoads, load];
      store.setState({ memberLoads });
    },
    revert() {
      const memberLoads = store.getState().memberLoads.filter(ml => ml.id !== load.id);
      store.setState({ memberLoads });
    },
  };
}

/** Remove a node load. */
export function createRemoveLoadCommand(
  store: StoreAccessor,
  loadId: string,
): StructuralCommand {
  const savedLoad = store.getState().loads.find(l => l.id === loadId);
  if (!savedLoad) return createNoopCommand(`Remove load ${loadId} (not found)`);

  return {
    id: generateCommandId(),
    description: `Remove load ${loadId}`,
    timestamp: Date.now(),
    byteEstimate: 120,
    apply() {
      const loads = store.getState().loads.filter(l => l.id !== loadId);
      store.setState({ loads });
    },
    revert() {
      const loads = [...store.getState().loads, savedLoad];
      store.setState({ loads });
    },
  };
}

// ─── Plate Commands ─────────────────────────────────────────────────

export function createAddPlateCommand(
  store: StoreAccessor,
  plate: Plate,
): StructuralCommand {
  return {
    id: generateCommandId(),
    description: `Add plate ${plate.id}`,
    timestamp: Date.now(),
    byteEstimate: 300,
    apply() {
      const plates = new Map(store.getState().plates);
      plates.set(plate.id, plate);
      store.setState({ plates });
    },
    revert() {
      const plates = new Map(store.getState().plates);
      plates.delete(plate.id);
      store.setState({ plates });
    },
  };
}

export function createRemovePlateCommand(
  store: StoreAccessor,
  plateId: string,
): StructuralCommand {
  const plate = store.getState().plates.get(plateId);
  if (!plate) return createNoopCommand(`Remove plate ${plateId} (not found)`);

  const savedPlate = { ...plate };

  return {
    id: generateCommandId(),
    description: `Remove plate ${plateId}`,
    timestamp: Date.now(),
    byteEstimate: 300,
    apply() {
      const plates = new Map(store.getState().plates);
      plates.delete(plateId);
      store.setState({ plates });
    },
    revert() {
      const plates = new Map(store.getState().plates);
      plates.set(plateId, savedPlate);
      store.setState({ plates });
    },
  };
}

// ─── Utility ────────────────────────────────────────────────────────

/** A no-op command for cases where the target doesn't exist. */
function createNoopCommand(description: string): StructuralCommand {
  return {
    id: generateCommandId(),
    description,
    timestamp: Date.now(),
    byteEstimate: 0,
    apply() {},
    revert() {},
  };
}

// ─── Singleton ──────────────────────────────────────────────────────

let _globalHistory: CommandHistory | null = null;

/**
 * Get or create the global command history.
 */
export function getCommandHistory(): CommandHistory {
  if (!_globalHistory) {
    _globalHistory = new CommandHistory();
  }
  return _globalHistory;
}

/**
 * Reset the global command history (e.g., on project load).
 */
export function resetCommandHistory(): void {
  _globalHistory?.clear();
  _globalHistory = null;
}
