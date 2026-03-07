/**
 * Core Web Architecture Modules — Index
 *
 * Feature "5. Memory & Web Architecture (The Silent Killer)"
 *
 * Three engines that eliminate the memory/performance cliff for large models:
 *
 *   1. StructuralBufferPool — Flat TypedArray storage replacing JS object Maps.
 *      50K nodes in 1.2 MB vs 4+ MB, zero GC pressure, zero-copy transfer.
 *
 *   2. InstancedStructureRenderer — Custom shader InstancedMesh that draws the
 *      entire structure in 2 GPU draw calls (1 for members, 1 for nodes).
 *
 *   3. CommandHistory — Delta-based undo/redo storing only "Node N5 moved by
 *      dx:2" instead of full state snapshots.  200 undo steps = ~20 KB vs 500 MB.
 *
 * @module core
 */

// ─── TypedArray Buffer Engine ───────────────────────────────────────
export {
  StructuralBufferPool,
  getBufferPool,
  resetBufferPool,
  type BufferNode,
  type BufferMember,
  type BufferDisplacement,
  type BufferMemberForces,
  type BufferNodeLoad,
  type BufferPoolStats,
} from './StructuralBufferPool';

// ─── Instanced Rendering Engine ─────────────────────────────────────
export {
  InstancedStructureRenderer,
  InstancedMemberShaderRenderer,
  InstancedNodeShaderRenderer,
  type InstancedStructureRendererProps,
} from './InstancedStructureRenderer';

// ─── Command Pattern Undo/Redo ──────────────────────────────────────
export {
  CommandHistory,
  getCommandHistory,
  resetCommandHistory,
  generateCommandId,
  type StructuralCommand,
  type BatchCommand,
  type HistoryState,
  type HistoryListener,
  type StoreAccessor,
  type CommandHistoryOptions,
  // Command factories
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
} from './CommandHistory';

// ─── Store Integration ──────────────────────────────────────────────
export {
  getStoreAccessor,
  useCommandHistoryState,
  initializeIntegration,
  teardownIntegration,
  reinitializeIntegration,
} from './StoreIntegration';
