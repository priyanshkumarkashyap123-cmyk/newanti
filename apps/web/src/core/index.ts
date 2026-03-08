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
 *   4. BinaryModelSerializer — Compact .beamlab binary format (5-10× smaller
 *      than JSON) for model persistence & file exchange.
 *
 *   5. AnalysisTelemetry — Graph normalization pipeline feeding AI/PINN training
 *      with anonymized structural analysis data.
 *
 *   6. WasmBufferBridge — Zero-copy TypedArray packing for WASM solver fast path.
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

// ─── Binary Model Serializer ────────────────────────────────────────
export {
  serializeModel,
  deserializeModel,
  estimateBinarySize,
  compressionStats,
  BEAMLAB_FILE,
  type SerializableModel,
  type DeserializedModel,
} from './BinaryModelSerializer';

// ─── Analysis Telemetry (AI/PINN Pipeline) ──────────────────────────
export {
  buildStructuralGraph,
  sendAnalysisTelemetry,
  type StructuralGraph,
  type GraphVertex,
  type GraphEdge,
  type AnalysisTelemetryPayload,
} from './AnalysisTelemetry';

// ─── WASM TypedArray Buffer Bridge ──────────────────────────────────
export {
  packForWasm,
  unpackResults,
  benchmarkPacking,
  type WasmInputBuffers,
  type WasmResultBuffers,
} from './WasmBufferBridge';
