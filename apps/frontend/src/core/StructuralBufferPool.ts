/**
 * StructuralBufferPool — Flat TypedArray storage for structural data.
 *
 * Why this exists:
 *   A 50,000-node model stored as `Map<string, {id,x,y,z}>` JS objects
 *   consumes ~80 bytes/node in V8 (hidden class + property storage + GC overhead)
 *   = 4 MB just for coordinates.  With members, loads, results that balloons to
 *   hundreds of MB, triggers major GC pauses, and cannot be zero-copy transferred
 *   to Web Workers or WASM.
 *
 *   This pool stores the same data in flat Float64Array / Int32Array buffers:
 *     50,000 nodes × 3 doubles = 1.2 MB, zero GC pressure, directly transferable.
 *
 * Architecture:
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │  StructuralBufferPool                                           │
 *   │  ┌──────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────┐  │
 *   │  │NodeBuffer│ │MemberBuffer  │ │ResultBuffer  │ │LoadBuffer │  │
 *   │  │Float64[3N]│ │Int32[2M]     │ │Float64[6N]   │ │Float64[6L]│  │
 *   │  │Uint8[6N]  │ │Float64[7M]   │ │Float64[12M]  │ │           │  │
 *   │  └──────────┘ └──────────────┘ └──────────────┘ └───────────┘  │
 *   │                                                                 │
 *   │  idMap: nodeId → index,  memberIdMap: memberId → index          │
 *   │  sync(): Map<string, Node> ↔ Float64Array (bidirectional)       │
 *   │  transfer(): zero-copy to Worker / WASM                        │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * @module core/StructuralBufferPool
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface BufferPoolStats {
  nodeCount: number;
  memberCount: number;
  loadCount: number;
  totalBytes: number;
  nodeBufferBytes: number;
  memberBufferBytes: number;
  resultBufferBytes: number;
  loadBufferBytes: number;
  capacityNodes: number;
  capacityMembers: number;
}

/** Minimal node interface matching modelTypes.ts */
export interface BufferNode {
  id: string;
  x: number;
  y: number;
  z: number;
  restraints?: {
    fx: boolean; fy: boolean; fz: boolean;
    mx: boolean; my: boolean; mz: boolean;
  };
}

/** Minimal member interface matching modelTypes.ts */
export interface BufferMember {
  id: string;
  startNodeId: string;
  endNodeId: string;
  E?: number;
  A?: number;
  I?: number;
  Iy?: number;
  Iz?: number;
  J?: number;
  G?: number;
}

/** Displacement result per node (6 DOF) */
export interface BufferDisplacement {
  dx: number; dy: number; dz: number;
  rx: number; ry: number; rz: number;
}

/** Force result per member (start + end = 12 values) */
export interface BufferMemberForces {
  axialStart: number; shearYStart: number; shearZStart: number;
  momentYStart: number; momentZStart: number; torsionStart: number;
  axialEnd: number; shearYEnd: number; shearZEnd: number;
  momentYEnd: number; momentZEnd: number; torsionEnd: number;
}

/** Node load */
export interface BufferNodeLoad {
  nodeIndex: number;
  fx: number; fy: number; fz: number;
  mx: number; my: number; mz: number;
}

// ─── Constants ──────────────────────────────────────────────────────

/** Growth factor when capacity is exceeded */
const GROWTH_FACTOR = 1.5;
/** Minimum initial capacity */
const MIN_CAPACITY = 256;
/** Floats per node coordinate (x, y, z) */
const COORDS_PER_NODE = 3;
/** Byte flags per node restraint (fx, fy, fz, mx, my, mz) */
const RESTRAINTS_PER_NODE = 6;
/** Ints per member connectivity (startIdx, endIdx) */
const CONN_PER_MEMBER = 2;
/** Floats per member properties (E, A, I, Iy, Iz, J, G) */
const PROPS_PER_MEMBER = 7;
/** Floats per node displacement result (dx, dy, dz, rx, ry, rz) */
const DISP_PER_NODE = 6;
/** Floats per member force result (start 6 + end 6) */
const FORCES_PER_MEMBER = 12;
/** Floats per node load (fx, fy, fz, mx, my, mz) */
const LOAD_DOF = 6;

// ─── Buffer Pool ────────────────────────────────────────────────────

export class StructuralBufferPool {
  // ── ID mapping ──
  private _nodeIdToIndex = new Map<string, number>();
  private _indexToNodeId: string[] = [];
  private _memberIdToIndex = new Map<string, number>();
  private _indexToMemberId: string[] = [];

  // ── Counts ──
  private _nodeCount = 0;
  private _memberCount = 0;
  private _loadCount = 0;

  // ── Capacities ──
  private _nodeCapacity: number;
  private _memberCapacity: number;
  private _loadCapacity: number;

  // ── Node buffers ──
  /** Float64: [x0, y0, z0, x1, y1, z1, ...] */
  public nodeCoords: Float64Array;
  /** Uint8: [fx0, fy0, fz0, mx0, my0, mz0, fx1, ...] — 1=restrained */
  public nodeRestraints: Uint8Array;

  // ── Member buffers ──
  /** Int32: [startIdx0, endIdx0, startIdx1, endIdx1, ...] */
  public memberConnectivity: Int32Array;
  /** Float64: [E0, A0, I0, Iy0, Iz0, J0, G0, E1, ...] */
  public memberProps: Float64Array;

  // ── Result buffers ──
  /** Float64: [dx0, dy0, dz0, rx0, ry0, rz0, dx1, ...] */
  public displacements: Float64Array;
  /** Float64: [axS0, syS0, szS0, myS0, mzS0, tS0, axE0, ...] */
  public memberForces: Float64Array;

  // ── Load buffers ──
  /** Int32: node indices for each load */
  public loadNodeIndices: Int32Array;
  /** Float64: [fx0, fy0, fz0, mx0, my0, mz0, fx1, ...] */
  public loadValues: Float64Array;

  // ── Dirty flags (for incremental GPU sync) ──
  private _dirtyNodes = new Set<number>();
  private _dirtyMembers = new Set<number>();
  private _allNodesDirty = false;
  private _allMembersDirty = false;

  constructor(
    initialNodeCapacity = MIN_CAPACITY,
    initialMemberCapacity = MIN_CAPACITY,
    initialLoadCapacity = MIN_CAPACITY,
  ) {
    this._nodeCapacity = Math.max(initialNodeCapacity, MIN_CAPACITY);
    this._memberCapacity = Math.max(initialMemberCapacity, MIN_CAPACITY);
    this._loadCapacity = Math.max(initialLoadCapacity, MIN_CAPACITY);

    // Allocate
    this.nodeCoords = new Float64Array(this._nodeCapacity * COORDS_PER_NODE);
    this.nodeRestraints = new Uint8Array(this._nodeCapacity * RESTRAINTS_PER_NODE);
    this.memberConnectivity = new Int32Array(this._memberCapacity * CONN_PER_MEMBER);
    this.memberProps = new Float64Array(this._memberCapacity * PROPS_PER_MEMBER);
    this.displacements = new Float64Array(this._nodeCapacity * DISP_PER_NODE);
    this.memberForces = new Float64Array(this._memberCapacity * FORCES_PER_MEMBER);
    this.loadNodeIndices = new Int32Array(this._loadCapacity);
    this.loadValues = new Float64Array(this._loadCapacity * LOAD_DOF);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Accessors
  // ═══════════════════════════════════════════════════════════════════

  get nodeCount(): number { return this._nodeCount; }
  get memberCount(): number { return this._memberCount; }
  get loadCount(): number { return this._loadCount; }

  nodeIndex(id: string): number | undefined { return this._nodeIdToIndex.get(id); }
  memberIndex(id: string): number | undefined { return this._memberIdToIndex.get(id); }
  nodeId(index: number): string | undefined { return this._indexToNodeId[index]; }
  memberId(index: number): string | undefined { return this._indexToMemberId[index]; }

  /** Read node coordinates at index i */
  getNodeXYZ(i: number): [number, number, number] {
    const off = i * COORDS_PER_NODE;
    return [this.nodeCoords[off], this.nodeCoords[off + 1], this.nodeCoords[off + 2]];
  }

  /** Write node coordinates at index i */
  setNodeXYZ(i: number, x: number, y: number, z: number): void {
    const off = i * COORDS_PER_NODE;
    this.nodeCoords[off] = x;
    this.nodeCoords[off + 1] = y;
    this.nodeCoords[off + 2] = z;
    this._dirtyNodes.add(i);
  }

  /** Read node restraints at index i */
  getNodeRestraints(i: number): [boolean, boolean, boolean, boolean, boolean, boolean] {
    const off = i * RESTRAINTS_PER_NODE;
    return [
      this.nodeRestraints[off] === 1,
      this.nodeRestraints[off + 1] === 1,
      this.nodeRestraints[off + 2] === 1,
      this.nodeRestraints[off + 3] === 1,
      this.nodeRestraints[off + 4] === 1,
      this.nodeRestraints[off + 5] === 1,
    ];
  }

  /** Write node restraints at index i */
  setNodeRestraints(i: number, r: { fx: boolean; fy: boolean; fz: boolean; mx: boolean; my: boolean; mz: boolean }): void {
    const off = i * RESTRAINTS_PER_NODE;
    this.nodeRestraints[off] = r.fx ? 1 : 0;
    this.nodeRestraints[off + 1] = r.fy ? 1 : 0;
    this.nodeRestraints[off + 2] = r.fz ? 1 : 0;
    this.nodeRestraints[off + 3] = r.mx ? 1 : 0;
    this.nodeRestraints[off + 4] = r.my ? 1 : 0;
    this.nodeRestraints[off + 5] = r.mz ? 1 : 0;
    this._dirtyNodes.add(i);
  }

  /** Read member connectivity */
  getMemberConn(i: number): [number, number] {
    const off = i * CONN_PER_MEMBER;
    return [this.memberConnectivity[off], this.memberConnectivity[off + 1]];
  }

  /** Read member properties: [E, A, I, Iy, Iz, J, G] */
  getMemberProps(i: number): [number, number, number, number, number, number, number] {
    const off = i * PROPS_PER_MEMBER;
    return [
      this.memberProps[off], this.memberProps[off + 1], this.memberProps[off + 2],
      this.memberProps[off + 3], this.memberProps[off + 4], this.memberProps[off + 5],
      this.memberProps[off + 6],
    ];
  }

  /** Read displacement at node index i */
  getDisplacement(i: number): BufferDisplacement {
    const off = i * DISP_PER_NODE;
    return {
      dx: this.displacements[off], dy: this.displacements[off + 1], dz: this.displacements[off + 2],
      rx: this.displacements[off + 3], ry: this.displacements[off + 4], rz: this.displacements[off + 5],
    };
  }

  /** Read forces at member index i */
  getMemberForces(i: number): BufferMemberForces {
    const off = i * FORCES_PER_MEMBER;
    return {
      axialStart: this.memberForces[off], shearYStart: this.memberForces[off + 1],
      shearZStart: this.memberForces[off + 2], momentYStart: this.memberForces[off + 3],
      momentZStart: this.memberForces[off + 4], torsionStart: this.memberForces[off + 5],
      axialEnd: this.memberForces[off + 6], shearYEnd: this.memberForces[off + 7],
      shearZEnd: this.memberForces[off + 8], momentYEnd: this.memberForces[off + 9],
      momentZEnd: this.memberForces[off + 10], torsionEnd: this.memberForces[off + 11],
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Mutation
  // ═══════════════════════════════════════════════════════════════════

  /** Add a single node. Returns the buffer index assigned. */
  addNode(node: BufferNode): number {
    if (this._nodeCount >= this._nodeCapacity) {
      this._growNodes();
    }
    const idx = this._nodeCount++;
    this._nodeIdToIndex.set(node.id, idx);
    this._indexToNodeId[idx] = node.id;
    this.setNodeXYZ(idx, node.x, node.y, node.z);
    if (node.restraints) {
      this.setNodeRestraints(idx, node.restraints);
    }
    return idx;
  }

  /** Add a single member. Returns the buffer index assigned. */
  addMember(member: BufferMember): number {
    if (this._memberCount >= this._memberCapacity) {
      this._growMembers();
    }
    const idx = this._memberCount++;
    this._memberIdToIndex.set(member.id, idx);
    this._indexToMemberId[idx] = member.id;

    const startIdx = this._nodeIdToIndex.get(member.startNodeId) ?? 0;
    const endIdx = this._nodeIdToIndex.get(member.endNodeId) ?? 0;

    const connOff = idx * CONN_PER_MEMBER;
    this.memberConnectivity[connOff] = startIdx;
    this.memberConnectivity[connOff + 1] = endIdx;

    const propOff = idx * PROPS_PER_MEMBER;
    this.memberProps[propOff] = member.E ?? 200e6;     // kN/m² (steel default)
    this.memberProps[propOff + 1] = member.A ?? 0.01;  // m²
    this.memberProps[propOff + 2] = member.I ?? 1e-4;  // m⁴
    this.memberProps[propOff + 3] = member.Iy ?? member.I ?? 1e-4;
    this.memberProps[propOff + 4] = member.Iz ?? member.I ?? 1e-4;
    this.memberProps[propOff + 5] = member.J ?? 1e-5;
    this.memberProps[propOff + 6] = member.G ?? 77e6;

    this._dirtyMembers.add(idx);
    return idx;
  }

  /** Remove a node by id (swap-and-pop for O(1)). */
  removeNode(id: string): void {
    const idx = this._nodeIdToIndex.get(id);
    if (idx === undefined) return;

    const lastIdx = this._nodeCount - 1;
    if (idx !== lastIdx) {
      // Swap with last
      const lastId = this._indexToNodeId[lastIdx];
      // Copy coords
      const srcOff = lastIdx * COORDS_PER_NODE;
      const dstOff = idx * COORDS_PER_NODE;
      this.nodeCoords[dstOff] = this.nodeCoords[srcOff];
      this.nodeCoords[dstOff + 1] = this.nodeCoords[srcOff + 1];
      this.nodeCoords[dstOff + 2] = this.nodeCoords[srcOff + 2];
      // Copy restraints
      const rSrc = lastIdx * RESTRAINTS_PER_NODE;
      const rDst = idx * RESTRAINTS_PER_NODE;
      for (let k = 0; k < RESTRAINTS_PER_NODE; k++) {
        this.nodeRestraints[rDst + k] = this.nodeRestraints[rSrc + k];
      }
      // Update mappings
      this._nodeIdToIndex.set(lastId, idx);
      this._indexToNodeId[idx] = lastId;
    }

    this._nodeIdToIndex.delete(id);
    this._indexToNodeId.length = lastIdx;
    this._nodeCount--;
    this._allNodesDirty = true;
  }

  /** Remove a member by id (swap-and-pop for O(1)). */
  removeMember(id: string): void {
    const idx = this._memberIdToIndex.get(id);
    if (idx === undefined) return;

    const lastIdx = this._memberCount - 1;
    if (idx !== lastIdx) {
      const lastId = this._indexToMemberId[lastIdx];
      // Swap connectivity
      const cSrc = lastIdx * CONN_PER_MEMBER;
      const cDst = idx * CONN_PER_MEMBER;
      this.memberConnectivity[cDst] = this.memberConnectivity[cSrc];
      this.memberConnectivity[cDst + 1] = this.memberConnectivity[cSrc + 1];
      // Swap props
      const pSrc = lastIdx * PROPS_PER_MEMBER;
      const pDst = idx * PROPS_PER_MEMBER;
      for (let k = 0; k < PROPS_PER_MEMBER; k++) {
        this.memberProps[pDst + k] = this.memberProps[pSrc + k];
      }
      this._memberIdToIndex.set(lastId, idx);
      this._indexToMemberId[idx] = lastId;
    }

    this._memberIdToIndex.delete(id);
    this._indexToMemberId.length = lastIdx;
    this._memberCount--;
    this._allMembersDirty = true;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Bulk sync:  Map<string, Node/Member> ↔ TypedArray
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Ingest the full model from Zustand Maps into flat buffers.
   * Call this once after initial load or import, then use incremental ops.
   */
  syncFromMaps(
    nodes: Map<string, BufferNode>,
    members: Map<string, BufferMember>,
  ): void {
    // Reset
    this._nodeCount = 0;
    this._memberCount = 0;
    this._nodeIdToIndex.clear();
    this._memberIdToIndex.clear();
    this._indexToNodeId.length = 0;
    this._indexToMemberId.length = 0;

    // Ensure capacity
    if (nodes.size > this._nodeCapacity) {
      this._nodeCapacity = Math.ceil(nodes.size * GROWTH_FACTOR);
      this.nodeCoords = new Float64Array(this._nodeCapacity * COORDS_PER_NODE);
      this.nodeRestraints = new Uint8Array(this._nodeCapacity * RESTRAINTS_PER_NODE);
      this.displacements = new Float64Array(this._nodeCapacity * DISP_PER_NODE);
    }
    if (members.size > this._memberCapacity) {
      this._memberCapacity = Math.ceil(members.size * GROWTH_FACTOR);
      this.memberConnectivity = new Int32Array(this._memberCapacity * CONN_PER_MEMBER);
      this.memberProps = new Float64Array(this._memberCapacity * PROPS_PER_MEMBER);
      this.memberForces = new Float64Array(this._memberCapacity * FORCES_PER_MEMBER);
    }

    // Ingest nodes
    for (const [id, node] of nodes) {
      this.addNode(node);
    }

    // Ingest members
    for (const [id, member] of members) {
      this.addMember(member);
    }

    this._allNodesDirty = true;
    this._allMembersDirty = true;
  }

  /**
   * Write buffer data back to Maps (e.g., after WASM solver modifies buffers).
   * Returns new Maps suitable for Zustand set().
   */
  syncToMaps(): { nodes: Map<string, BufferNode>; members: Map<string, BufferMember> } {
    const nodes = new Map<string, BufferNode>();
    for (let i = 0; i < this._nodeCount; i++) {
      const id = this._indexToNodeId[i];
      const [x, y, z] = this.getNodeXYZ(i);
      const [fx, fy, fz, mx, my, mz] = this.getNodeRestraints(i);
      const hasRestraint = fx || fy || fz || mx || my || mz;
      nodes.set(id, {
        id, x, y, z,
        ...(hasRestraint ? { restraints: { fx, fy, fz, mx, my, mz } } : {}),
      });
    }

    const members = new Map<string, BufferMember>();
    for (let i = 0; i < this._memberCount; i++) {
      const id = this._indexToMemberId[i];
      const [startIdx, endIdx] = this.getMemberConn(i);
      const [E, A, I, Iy, Iz, J, G] = this.getMemberProps(i);
      members.set(id, {
        id,
        startNodeId: this._indexToNodeId[startIdx] ?? '',
        endNodeId: this._indexToNodeId[endIdx] ?? '',
        E, A, I, Iy, Iz, J, G,
      });
    }

    return { nodes, members };
  }

  /**
   * Write analysis results into buffers from the standard AnalysisResults shape.
   */
  syncResultsIn(
    displacementMap: Map<string, { dx: number; dy: number; dz: number; rx: number; ry: number; rz: number }>,
    memberForcesMap?: Map<string, {
      startForces?: { axial: number; shearY: number; shearZ?: number; momentY?: number; momentZ: number; torsion?: number };
      endForces?: { axial: number; shearY: number; shearZ?: number; momentY?: number; momentZ: number; torsion?: number };
    }>,
  ): void {
    // Displacements
    for (const [nodeId, disp] of displacementMap) {
      const idx = this._nodeIdToIndex.get(nodeId);
      if (idx === undefined) continue;
      const off = idx * DISP_PER_NODE;
      this.displacements[off] = disp.dx;
      this.displacements[off + 1] = disp.dy;
      this.displacements[off + 2] = disp.dz;
      this.displacements[off + 3] = disp.rx;
      this.displacements[off + 4] = disp.ry;
      this.displacements[off + 5] = disp.rz;
    }

    // Member forces
    if (memberForcesMap) {
      for (const [memId, forces] of memberForcesMap) {
        const idx = this._memberIdToIndex.get(memId);
        if (idx === undefined) continue;
        const off = idx * FORCES_PER_MEMBER;
        const sf = forces.startForces;
        const ef = forces.endForces;
        if (sf) {
          this.memberForces[off] = sf.axial ?? 0;
          this.memberForces[off + 1] = sf.shearY ?? 0;
          this.memberForces[off + 2] = sf.shearZ ?? 0;
          this.memberForces[off + 3] = sf.momentY ?? 0;
          this.memberForces[off + 4] = sf.momentZ ?? 0;
          this.memberForces[off + 5] = sf.torsion ?? 0;
        }
        if (ef) {
          this.memberForces[off + 6] = ef.axial ?? 0;
          this.memberForces[off + 7] = ef.shearY ?? 0;
          this.memberForces[off + 8] = ef.shearZ ?? 0;
          this.memberForces[off + 9] = ef.momentY ?? 0;
          this.memberForces[off + 10] = ef.momentZ ?? 0;
          this.memberForces[off + 11] = ef.torsion ?? 0;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Zero-copy transfer for Workers / WASM
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create transferable buffers for postMessage(..., [transferables]).
   * After calling this the current pool's arrays are neutered —
   * call reclaimFromTransfer() with the results to get them back.
   */
  createTransferablePayload(): {
    data: {
      nodeCoords: Float64Array;
      nodeRestraints: Uint8Array;
      memberConnectivity: Int32Array;
      memberProps: Float64Array;
      nodeCount: number;
      memberCount: number;
      nodeIds: string[];
      memberIds: string[];
    };
    transferables: ArrayBuffer[];
  } {
    // Create trimmed copies (only active region) so we don't transfer unused capacity
    const nc = this._nodeCount;
    const mc = this._memberCount;
    const coords = this.nodeCoords.slice(0, nc * COORDS_PER_NODE);
    const restraints = this.nodeRestraints.slice(0, nc * RESTRAINTS_PER_NODE);
    const conn = this.memberConnectivity.slice(0, mc * CONN_PER_MEMBER);
    const props = this.memberProps.slice(0, mc * PROPS_PER_MEMBER);

    return {
      data: {
        nodeCoords: coords,
        nodeRestraints: restraints,
        memberConnectivity: conn,
        memberProps: props,
        nodeCount: nc,
        memberCount: mc,
        nodeIds: this._indexToNodeId.slice(0, nc),
        memberIds: this._indexToMemberId.slice(0, mc),
      },
      transferables: [
        coords.buffer,
        restraints.buffer,
        conn.buffer,
        props.buffer,
      ],
    };
  }

  /**
   * Reclaim buffers returned from a Worker response.
   * The Worker should return the same ArrayBuffers (or new result buffers).
   */
  reclaimResultBuffers(
    displacementBuffer: Float64Array,
    memberForceBuffer?: Float64Array,
  ): void {
    // Copy into our (possibly larger) allocated arrays
    this.displacements.set(displacementBuffer.subarray(0, this._nodeCount * DISP_PER_NODE));
    if (memberForceBuffer) {
      this.memberForces.set(memberForceBuffer.subarray(0, this._memberCount * FORCES_PER_MEMBER));
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // GPU rendering helpers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Return a Float32Array of node positions suitable for Three.js
   * InstancedBufferAttribute (GPU wants float32, not float64).
   */
  getNodePositionsF32(): Float32Array {
    const n = this._nodeCount;
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) {
      out[i] = this.nodeCoords[i];
    }
    return out;
  }

  /**
   * Return member endpoint pairs as Float32Array for instanced rendering:
   * [sx0, sy0, sz0, ex0, ey0, ez0, sx1, ...]
   */
  getMemberEndpointsF32(): Float32Array {
    const m = this._memberCount;
    const out = new Float32Array(m * 6);
    for (let i = 0; i < m; i++) {
      const connOff = i * CONN_PER_MEMBER;
      const sIdx = this.memberConnectivity[connOff];
      const eIdx = this.memberConnectivity[connOff + 1];
      const sOff = sIdx * COORDS_PER_NODE;
      const eOff = eIdx * COORDS_PER_NODE;
      const o = i * 6;
      out[o] = this.nodeCoords[sOff];
      out[o + 1] = this.nodeCoords[sOff + 1];
      out[o + 2] = this.nodeCoords[sOff + 2];
      out[o + 3] = this.nodeCoords[eOff];
      out[o + 4] = this.nodeCoords[eOff + 1];
      out[o + 5] = this.nodeCoords[eOff + 2];
    }
    return out;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Dirty tracking
  // ═══════════════════════════════════════════════════════════════════

  /** Get indices of nodes modified since last flush. */
  getDirtyNodes(): number[] | 'all' {
    if (this._allNodesDirty) return 'all';
    return Array.from(this._dirtyNodes);
  }

  /** Get indices of members modified since last flush. */
  getDirtyMembers(): number[] | 'all' {
    if (this._allMembersDirty) return 'all';
    return Array.from(this._dirtyMembers);
  }

  /** Clear dirty flags after GPU sync. */
  flushDirty(): void {
    this._dirtyNodes.clear();
    this._dirtyMembers.clear();
    this._allNodesDirty = false;
    this._allMembersDirty = false;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Stats
  // ═══════════════════════════════════════════════════════════════════

  getStats(): BufferPoolStats {
    return {
      nodeCount: this._nodeCount,
      memberCount: this._memberCount,
      loadCount: this._loadCount,
      nodeBufferBytes: this.nodeCoords.byteLength + this.nodeRestraints.byteLength,
      memberBufferBytes: this.memberConnectivity.byteLength + this.memberProps.byteLength,
      resultBufferBytes: this.displacements.byteLength + this.memberForces.byteLength,
      loadBufferBytes: this.loadNodeIndices.byteLength + this.loadValues.byteLength,
      totalBytes:
        this.nodeCoords.byteLength + this.nodeRestraints.byteLength +
        this.memberConnectivity.byteLength + this.memberProps.byteLength +
        this.displacements.byteLength + this.memberForces.byteLength +
        this.loadNodeIndices.byteLength + this.loadValues.byteLength,
      capacityNodes: this._nodeCapacity,
      capacityMembers: this._memberCapacity,
    };
  }

  /** Dispose all buffers. */
  dispose(): void {
    this._nodeIdToIndex.clear();
    this._memberIdToIndex.clear();
    this._indexToNodeId.length = 0;
    this._indexToMemberId.length = 0;
    this._nodeCount = 0;
    this._memberCount = 0;
    // Buffers will be GC'd
  }

  // ═══════════════════════════════════════════════════════════════════
  // Private: capacity growth
  // ═══════════════════════════════════════════════════════════════════

  private _growNodes(): void {
    const newCap = Math.ceil(this._nodeCapacity * GROWTH_FACTOR);
    const newCoords = new Float64Array(newCap * COORDS_PER_NODE);
    newCoords.set(this.nodeCoords);
    this.nodeCoords = newCoords;

    const newRestraints = new Uint8Array(newCap * RESTRAINTS_PER_NODE);
    newRestraints.set(this.nodeRestraints);
    this.nodeRestraints = newRestraints;

    const newDisp = new Float64Array(newCap * DISP_PER_NODE);
    newDisp.set(this.displacements);
    this.displacements = newDisp;

    this._nodeCapacity = newCap;
  }

  private _growMembers(): void {
    const newCap = Math.ceil(this._memberCapacity * GROWTH_FACTOR);
    const newConn = new Int32Array(newCap * CONN_PER_MEMBER);
    newConn.set(this.memberConnectivity);
    this.memberConnectivity = newConn;

    const newProps = new Float64Array(newCap * PROPS_PER_MEMBER);
    newProps.set(this.memberProps);
    this.memberProps = newProps;

    const newForces = new Float64Array(newCap * FORCES_PER_MEMBER);
    newForces.set(this.memberForces);
    this.memberForces = newForces;

    this._memberCapacity = newCap;
  }
}

// ─── Singleton for app-wide use ─────────────────────────────────────

let _globalPool: StructuralBufferPool | null = null;

/**
 * Get or create the global buffer pool.
 * Use this from Zustand store middleware, rendering components, and workers.
 */
export function getBufferPool(): StructuralBufferPool {
  if (!_globalPool) {
    _globalPool = new StructuralBufferPool();
  }
  return _globalPool;
}

/**
 * Reset the global pool (e.g., when loading a new project).
 */
export function resetBufferPool(): void {
  _globalPool?.dispose();
  _globalPool = null;
}
