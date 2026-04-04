/**
 * BinaryModelSerializer — Compact binary serialization for structural models.
 *
 * Why this exists:
 *   A 10,000-node model saved as JSON is ~3-5 MB due to key names, string IDs,
 *   and floating-point text representation. The same data in binary is ~500 KB
 *   because:
 *   - Node coordinates are 24 bytes (3 × Float64) instead of ~80 bytes in JSON
 *   - No repeated key names ("id", "x", "y", "z" etc)
 *   - Integer IDs instead of UUID strings (mapped at serialize/deserialize time)
 *   - Restraints packed into a single byte bitmask
 *
 * File Format (.beamlab):
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ Header (32 bytes)                                                │
 *   │   Magic: "BEAM" (4 bytes)                                       │
 *   │   Version: uint16                                                │
 *   │   Flags: uint16                                                  │
 *   │   NodeCount: uint32                                              │
 *   │   MemberCount: uint32                                            │
 *   │   LoadCount: uint32                                              │
 *   │   MemberLoadCount: uint32                                        │
 *   │   PlateCount: uint32                                             │
 *   │   MetadataLength: uint32                                         │
 *   │   Reserved: 4 bytes                                              │
 *   ├──────────────────────────────────────────────────────────────────┤
 *   │ Metadata (JSON, variable length)                                 │
 *   │   projectInfo, settings, loadCases, loadCombinations, idMap      │
 *   ├──────────────────────────────────────────────────────────────────┤
 *   │ Node Block (nodeCount × 25 bytes)                                │
 *   │   x: Float64, y: Float64, z: Float64, restraints: Uint8         │
 *   ├──────────────────────────────────────────────────────────────────┤
 *   │ Member Block (memberCount × 66 bytes)                            │
 *   │   startNodeIdx: Uint32, endNodeIdx: Uint32                       │
 *   │   E: Float64, A: Float64, Iy: Float64, Iz: Float64              │
 *   │   J: Float64, G: Float64, betaAngle: Float64                    │
 *   │   releaseFlags: Uint16                                           │
 *   ├──────────────────────────────────────────────────────────────────┤
 *   │ Load Block (loadCount × 52 bytes)                                │
 *   │   nodeIdx: Uint32, fx-mz: 6×Float64                             │
 *   ├──────────────────────────────────────────────────────────────────┤
 *   │ Member Load Block (variable)                                     │
 *   │   JSON-encoded (complex types: UDL, UVL, point, moment)          │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * @module core/BinaryModelSerializer
 */

// ─── Constants ──────────────────────────────────────────────────────

const MAGIC = 0x4D414542; // "BEAM" in little-endian
const FORMAT_VERSION = 1;
const HEADER_SIZE = 32;

/** Bytes per node: 3×f64 + 1×u8 restraint bitmask */
const NODE_STRIDE = 3 * 8 + 1; // 25 bytes
/** Bytes per member: 2×u32 idx + 7×f64 props + 1×u16 releases */
const MEMBER_STRIDE = 2 * 4 + 7 * 8 + 2; // 66 bytes
/** Bytes per nodal load: 1×u32 idx + 6×f64 forces */
const LOAD_STRIDE = 4 + 6 * 8; // 52 bytes

// ─── Types ──────────────────────────────────────────────────────────

export interface SerializableModel {
  projectInfo?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  nodes: Map<string, { id: string; x: number; y: number; z: number; restraints?: Record<string, boolean> }>;
  members: Map<string, {
    id: string; startNodeId: string; endNodeId: string;
    E?: number; A?: number; Iy?: number; Iz?: number; J?: number; G?: number;
    betaAngle?: number;
    releases?: Record<string, boolean>;
  }>;
  loads: Array<{ nodeId: string; fx?: number; fy?: number; fz?: number; mx?: number; my?: number; mz?: number }>;
  memberLoads?: Array<Record<string, unknown>>;
  floorLoads?: Array<Record<string, unknown>>;
  loadCases?: Array<Record<string, unknown>>;
  loadCombinations?: Array<Record<string, unknown>>;
  plates?: Map<string, Record<string, unknown>>;
}

export interface DeserializedModel {
  projectInfo: Record<string, unknown>;
  settings: Record<string, unknown>;
  nodes: Array<[string, { id: string; x: number; y: number; z: number; restraints?: Record<string, boolean> }]>;
  members: Array<[string, Record<string, unknown>]>;
  loads: Array<Record<string, unknown>>;
  memberLoads: Array<Record<string, unknown>>;
  floorLoads: Array<Record<string, unknown>>;
  loadCases: Array<Record<string, unknown>>;
  loadCombinations: Array<Record<string, unknown>>;
  plates: Array<[string, Record<string, unknown>]>;
  savedAt: string;
}

// ─── Restraint Bitmask Encoding ─────────────────────────────────────

function encodeRestraints(r?: Record<string, boolean>): number {
  if (!r) return 0;
  let mask = 0;
  if (r.fx) mask |= 0x01;
  if (r.fy) mask |= 0x02;
  if (r.fz) mask |= 0x04;
  if (r.mx) mask |= 0x08;
  if (r.my) mask |= 0x10;
  if (r.mz) mask |= 0x20;
  return mask;
}

function decodeRestraints(mask: number): Record<string, boolean> | undefined {
  if (mask === 0) return undefined;
  return {
    fx: !!(mask & 0x01),
    fy: !!(mask & 0x02),
    fz: !!(mask & 0x04),
    mx: !!(mask & 0x08),
    my: !!(mask & 0x10),
    mz: !!(mask & 0x20),
  };
}

// ─── Release Flags Encoding (12 DOFs → 2 bytes) ────────────────────

const RELEASE_KEYS_I = ['fxStart', 'fyStart', 'fzStart', 'mxStart', 'myStart', 'mzStart', 'startMoment'] as const;
const RELEASE_KEYS_J = ['fxEnd', 'fyEnd', 'fzEnd', 'mxEnd', 'myEnd', 'mzEnd', 'endMoment'] as const;

function encodeReleases(r?: Record<string, boolean>): number {
  if (!r) return 0;
  let mask = 0;
  RELEASE_KEYS_I.forEach((k, i) => { if (r[k]) mask |= (1 << i); });
  RELEASE_KEYS_J.forEach((k, i) => { if (r[k]) mask |= (1 << (i + 7)); });
  return mask;
}

function decodeReleases(mask: number): Record<string, boolean> | undefined {
  if (mask === 0) return undefined;
  const r: Record<string, boolean> = {};
  let any = false;
  RELEASE_KEYS_I.forEach((k, i) => { if (mask & (1 << i)) { r[k] = true; any = true; } });
  RELEASE_KEYS_J.forEach((k, i) => { if (mask & (1 << (i + 7))) { r[k] = true; any = true; } });
  return any ? r : undefined;
}

// ─── Encoder / Decoder ──────────────────────────────────────────────

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Serialize a structural model to a compact binary ArrayBuffer.
 *
 * Typical compression ratio vs. JSON: 5-10× smaller.
 * A 10,000-node model: ~500 KB binary vs ~4 MB JSON.
 */
export function serializeModel(model: SerializableModel): ArrayBuffer {
  const nodeCount = model.nodes.size;
  const memberCount = model.members.size;
  const loadCount = model.loads.length;
  const plateCount = model.plates?.size ?? 0;

  // Build ID → index maps
  const nodeIdToIdx = new Map<string, number>();
  const nodeIds: string[] = [];
  let idx = 0;
  for (const [id] of model.nodes) {
    nodeIdToIdx.set(id, idx);
    nodeIds.push(id);
    idx++;
  }

  const memberIds: string[] = [];
  for (const [id] of model.members) {
    memberIds.push(id);
  }

  // Encode metadata as JSON (compact — only non-binary data)
  const metadata = {
    projectInfo: model.projectInfo ?? {},
    settings: model.settings ?? {},
    nodeIds,
    memberIds,
    loadCases: model.loadCases ?? [],
    loadCombinations: model.loadCombinations ?? [],
    memberLoads: model.memberLoads ?? [],
    floorLoads: model.floorLoads ?? [],
    plates: model.plates ? Array.from(model.plates.entries()) : [],
    savedAt: new Date().toISOString(),
  };
  const metadataBytes = textEncoder.encode(JSON.stringify(metadata));
  const memberLoadCount = model.memberLoads?.length ?? 0;

  // Calculate total buffer size
  const totalSize =
    HEADER_SIZE +
    metadataBytes.byteLength +
    nodeCount * NODE_STRIDE +
    memberCount * MEMBER_STRIDE +
    loadCount * LOAD_STRIDE;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let offset = 0;

  // ── Header ──
  view.setUint32(offset, MAGIC, true); offset += 4;
  view.setUint16(offset, FORMAT_VERSION, true); offset += 2;
  view.setUint16(offset, 0, true); offset += 2; // flags
  view.setUint32(offset, nodeCount, true); offset += 4;
  view.setUint32(offset, memberCount, true); offset += 4;
  view.setUint32(offset, loadCount, true); offset += 4;
  view.setUint32(offset, memberLoadCount, true); offset += 4;
  view.setUint32(offset, plateCount, true); offset += 4;
  view.setUint32(offset, metadataBytes.byteLength, true); offset += 4;

  // ── Metadata ──
  bytes.set(metadataBytes, offset);
  offset += metadataBytes.byteLength;

  // ── Nodes ──
  for (const [, node] of model.nodes) {
    view.setFloat64(offset, node.x, true); offset += 8;
    view.setFloat64(offset, node.y, true); offset += 8;
    view.setFloat64(offset, node.z, true); offset += 8;
    bytes[offset] = encodeRestraints(node.restraints);
    offset += 1;
  }

  // ── Members ──
  for (const [, member] of model.members) {
    const startIdx = nodeIdToIdx.get(member.startNodeId) ?? 0;
    const endIdx = nodeIdToIdx.get(member.endNodeId) ?? 0;
    view.setUint32(offset, startIdx, true); offset += 4;
    view.setUint32(offset, endIdx, true); offset += 4;
    view.setFloat64(offset, member.E ?? 200e6, true); offset += 8;
    view.setFloat64(offset, member.A ?? 0.01, true); offset += 8;
    view.setFloat64(offset, member.Iy ?? 1e-4, true); offset += 8;
    view.setFloat64(offset, member.Iz ?? 1e-4, true); offset += 8;
    view.setFloat64(offset, member.J ?? 2e-4, true); offset += 8;
    view.setFloat64(offset, member.G ?? 76.9e6, true); offset += 8;
    view.setFloat64(offset, member.betaAngle ?? 0, true); offset += 8;
    view.setUint16(offset, encodeReleases(member.releases), true); offset += 2;
  }

  // ── Nodal Loads ──
  for (const load of model.loads) {
    const nIdx = nodeIdToIdx.get(load.nodeId) ?? 0;
    view.setUint32(offset, nIdx, true); offset += 4;
    view.setFloat64(offset, load.fx ?? 0, true); offset += 8;
    view.setFloat64(offset, load.fy ?? 0, true); offset += 8;
    view.setFloat64(offset, load.fz ?? 0, true); offset += 8;
    view.setFloat64(offset, load.mx ?? 0, true); offset += 8;
    view.setFloat64(offset, load.my ?? 0, true); offset += 8;
    view.setFloat64(offset, load.mz ?? 0, true); offset += 8;
  }

  return buffer;
}

/**
 * Deserialize a binary buffer back to model data.
 * Returns the same shape as SavedProjectData for easy hydration.
 */
export function deserializeModel(buffer: ArrayBuffer): DeserializedModel {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let offset = 0;

  // ── Header ──
  const magic = view.getUint32(offset, true); offset += 4;
  if (magic !== MAGIC) {
    throw new Error('Invalid .beamlab file: bad magic number');
  }
  const version = view.getUint16(offset, true); offset += 2;
  if (version > FORMAT_VERSION) {
    throw new Error(`Unsupported .beamlab format version: ${version}`);
  }
  offset += 2; // flags
  const nodeCount = view.getUint32(offset, true); offset += 4;
  const memberCount = view.getUint32(offset, true); offset += 4;
  const loadCount = view.getUint32(offset, true); offset += 4;
  const _memberLoadCount = view.getUint32(offset, true); offset += 4;
  const _plateCount = view.getUint32(offset, true); offset += 4;
  const metadataLength = view.getUint32(offset, true); offset += 4;

  // ── Metadata ──
  const metadataJson = textDecoder.decode(bytes.slice(offset, offset + metadataLength));
  const metadata = JSON.parse(metadataJson);
  offset += metadataLength;

  const nodeIds: string[] = metadata.nodeIds ?? [];
  const memberIds: string[] = metadata.memberIds ?? [];

  // ── Nodes ──
  const nodes: Array<[string, { id: string; x: number; y: number; z: number; restraints?: Record<string, boolean> }]> = [];
  for (let i = 0; i < nodeCount; i++) {
    const x = view.getFloat64(offset, true); offset += 8;
    const y = view.getFloat64(offset, true); offset += 8;
    const z = view.getFloat64(offset, true); offset += 8;
    const restraintMask = bytes[offset]; offset += 1;
    const id = nodeIds[i] ?? `node_${i}`;
    const restraints = decodeRestraints(restraintMask);
    nodes.push([id, { id, x, y, z, ...(restraints ? { restraints } : {}) }]);
  }

  // ── Members ──
  const members: Array<[string, Record<string, unknown>]> = [];
  for (let i = 0; i < memberCount; i++) {
    const startIdx = view.getUint32(offset, true); offset += 4;
    const endIdx = view.getUint32(offset, true); offset += 4;
    const E = view.getFloat64(offset, true); offset += 8;
    const A = view.getFloat64(offset, true); offset += 8;
    const Iy = view.getFloat64(offset, true); offset += 8;
    const Iz = view.getFloat64(offset, true); offset += 8;
    const J = view.getFloat64(offset, true); offset += 8;
    const G = view.getFloat64(offset, true); offset += 8;
    const betaAngle = view.getFloat64(offset, true); offset += 8;
    const releaseFlags = view.getUint16(offset, true); offset += 2;

    const id = memberIds[i] ?? `member_${i}`;
    const startNodeId = nodeIds[startIdx] ?? '';
    const endNodeId = nodeIds[endIdx] ?? '';
    const releases = decodeReleases(releaseFlags);

    members.push([id, {
      id, startNodeId, endNodeId,
      E, A, I: Iy, Iy, Iz, J, G,
      betaAngle,
      ...(releases ? { releases } : {}),
    }]);
  }

  // ── Loads ──
  const loads: Array<Record<string, unknown>> = [];
  for (let i = 0; i < loadCount; i++) {
    const nIdx = view.getUint32(offset, true); offset += 4;
    const fx = view.getFloat64(offset, true); offset += 8;
    const fy = view.getFloat64(offset, true); offset += 8;
    const fz = view.getFloat64(offset, true); offset += 8;
    const mx = view.getFloat64(offset, true); offset += 8;
    const my = view.getFloat64(offset, true); offset += 8;
    const mz = view.getFloat64(offset, true); offset += 8;
    loads.push({
      nodeId: nodeIds[nIdx] ?? '',
      fx, fy, fz, mx, my, mz,
    });
  }

  return {
    projectInfo: metadata.projectInfo ?? {},
    settings: metadata.settings ?? {},
    nodes,
    members,
    loads,
    memberLoads: metadata.memberLoads ?? [],
    floorLoads: metadata.floorLoads ?? [],
    loadCases: metadata.loadCases ?? [],
    loadCombinations: metadata.loadCombinations ?? [],
    plates: metadata.plates ?? [],
    savedAt: metadata.savedAt ?? new Date().toISOString(),
  };
}

/**
 * Get the file extension and MIME type for binary model files.
 */
export const BEAMLAB_FILE = {
  extension: '.beamlab',
  mimeType: 'application/octet-stream',
  description: 'BeamLab Binary Model',
} as const;

/**
 * Utility: Estimate the binary size of a model before serializing.
 * Useful for progress indicators and quota checks.
 */
export function estimateBinarySize(
  nodeCount: number,
  memberCount: number,
  loadCount: number,
  metadataEstimate = 2048,
): number {
  return HEADER_SIZE + metadataEstimate +
    nodeCount * NODE_STRIDE +
    memberCount * MEMBER_STRIDE +
    loadCount * LOAD_STRIDE;
}

/**
 * Compare compression ratio between JSON and binary for a model.
 */
export function compressionStats(jsonSize: number, binarySize: number): {
  jsonSize: number;
  binarySize: number;
  ratio: number;
  savingsPercent: number;
} {
  const ratio = jsonSize / Math.max(binarySize, 1);
  const savingsPercent = ((jsonSize - binarySize) / Math.max(jsonSize, 1)) * 100;
  return { jsonSize, binarySize, ratio, savingsPercent };
}
