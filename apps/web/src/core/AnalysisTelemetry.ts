/**
 * AnalysisTelemetry — Captures structural analysis data for AI training.
 *
 * Why this exists:
 *   Every time a user runs a successful analysis, the input (structure graph)
 *   and output (displacements, forces, D/C ratios) form a training data point
 *   for Physics-Informed Neural Networks (PINNs). This service:
 *
 *   1. Normalizes structural models into a graph representation:
 *      - Nodes = vertices with features (coordinates, restraints)
 *      - Members = edges with features (E, A, I, section properties)
 *      - Loads = node/edge annotations
 *
 *   2. Pairs inputs with solved outputs (displacements, reactions, member forces)
 *
 *   3. Strips identifying info (user IDs, project names) for anonymized storage
 *
 *   4. Sends telemetry to the backend for storage in the data lake
 *
 * Architecture:
 *   ┌────────────────┐    ┌──────────────┐    ┌──────────────────┐
 *   │ Analysis Result │───▶│ Normalization │───▶│ Backend API      │
 *   │ (Zustand Store) │    │ (Graph repr.) │    │ POST /api/usage/ │
 *   └────────────────┘    └──────────────┘    │ telemetry        │
 *                                              └──────────────────┘
 *                                                      │
 *                                              ┌───────▼──────────┐
 *                                              │ MongoDB / Data   │
 *                                              │ Lake (anonymized)│
 *                                              └──────────────────┘
 *
 * Graph Representation:
 *   {
 *     vertices: [{idx, x, y, z, restraintMask, loadFx...Mz}],
 *     edges: [{i, j, E, A, Iy, Iz, J, G, beta, releaseMask}],
 *     results: {
 *       displacements: Float64Array[6 * nNodes],
 *       reactions: Float64Array[6 * nSupports],
 *       memberForces: Float64Array[12 * nMembers],
 *       equilibriumError: number,
 *       conditionNumber: number,
 *     }
 *   }
 *
 * Privacy:
 *   - No user IDs, project names, or IP addresses in the telemetry payload
 *   - Only structural geometry, material properties, and analysis results
 *   - Users can opt out via settings (check before sending)
 *
 * @module core/AnalysisTelemetry
 */

import { API_CONFIG } from '../config/env';

const API_URL = API_CONFIG.baseUrl;

// ─── Types ──────────────────────────────────────────────────────────

/** Graph vertex = structural node */
export interface GraphVertex {
  /** Sequential index (0-based) */
  idx: number;
  /** Normalized coordinates (model is translated to origin and scaled to unit bounding box) */
  x: number;
  y: number;
  z: number;
  /** Restraint bitmask: bit0=fx, bit1=fy, bit2=fz, bit3=mx, bit4=my, bit5=mz */
  restraintMask: number;
  /** Applied loads at this node (in original units, kN / kN·m) */
  fx: number;
  fy: number;
  fz: number;
  mx: number;
  my: number;
  mz: number;
}

/** Graph edge = structural member */
export interface GraphEdge {
  /** Node indices (into vertices array) */
  i: number;
  j: number;
  /** Material / section properties */
  E: number;
  A: number;
  Iy: number;
  Iz: number;
  J: number;
  G: number;
  beta: number;
  /** Release bitmask (same encoding as BinaryModelSerializer) */
  releaseMask: number;
  /** Computed member length */
  length: number;
}

/** Normalized graph representation of a structural model */
export interface StructuralGraph {
  /** Number of DOFs (vertices × 6) */
  dofCount: number;
  /** Vertices (nodes) */
  vertices: GraphVertex[];
  /** Edges (members) */
  edges: GraphEdge[];
  /** Bounding box before normalization */
  boundingBox: {
    minX: number; minY: number; minZ: number;
    maxX: number; maxY: number; maxZ: number;
    spanX: number; spanY: number; spanZ: number;
  };
  /** Whether the structure is 2D planar (all Z ≈ 0) */
  is2D: boolean;
  /** Structural topology metrics */
  topology: {
    nodeCount: number;
    memberCount: number;
    supportCount: number;
    loadedNodeCount: number;
    maxDegree: number;
    avgDegree: number;
    isStaticallyDeterminate: boolean;
  };
}

/** Analysis results paired with the graph */
export interface AnalysisTelemetryPayload {
  /** Anonymized structural graph */
  graph: StructuralGraph;
  /** Solver results */
  results: {
    /** Max displacement magnitude (mm) */
    maxDisplacement: number;
    /** Max member force (kN or kN·m) */
    maxMemberForce: number;
    /** Equilibrium error percentage */
    equilibriumErrorPercent: number;
    /** Stiffness matrix condition number */
    conditionNumber: number;
    /** Whether analysis passed all checks */
    passed: boolean;
    /** Solver timing (ms) */
    solveTimeMs: number;
    /** Per-node displacements: flat [dx0,dy0,dz0,rx0,ry0,rz0, dx1,...] */
    displacements: number[];
    /** Per-node reactions (only support nodes): flat [fx,fy,fz,mx,my,mz, ...] */
    reactions: Array<{ nodeIdx: number; fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>;
    /** Per-member end forces: flat [axS,syS,szS,myS,mzS,tS, axE,syE,szE,myE,mzE,tE, ...] */
    memberForces: number[];
  };
  /** Metadata */
  meta: {
    /** Solver used (wasm, python, rust-api) */
    solver: string;
    /** Timestamp */
    timestamp: string;
    /** Client app version */
    appVersion: string;
    /** Analysis type (static, modal, buckling, etc.) */
    analysisType: string;
  };
}

// ─── Graph Builder ──────────────────────────────────────────────────

/**
 * Build a normalized structural graph from store data.
 * Strips all identifying info — only geometry + properties.
 */
export function buildStructuralGraph(
  nodes: Map<string, { id: string; x: number; y: number; z: number; restraints?: Record<string, boolean> | { fx: boolean; fy: boolean; fz: boolean; mx: boolean; my: boolean; mz: boolean } }>,
  members: Map<string, {
    id: string; startNodeId: string; endNodeId: string;
    E?: number; A?: number; Iy?: number; Iz?: number; J?: number; G?: number;
    betaAngle?: number; releases?: Record<string, boolean>;
  }>,
  loads: Array<{ nodeId: string; fx?: number; fy?: number; fz?: number; mx?: number; my?: number; mz?: number }>,
): StructuralGraph {
  // Build node index map
  const nodeIdToIdx = new Map<string, number>();
  let idx = 0;
  for (const [id] of nodes) {
    nodeIdToIdx.set(id, idx++);
  }

  // Compute bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const [, n] of nodes) {
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    minZ = Math.min(minZ, n.z); maxZ = Math.max(maxZ, n.z);
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const spanZ = maxZ - minZ || 1;
  const scale = Math.max(spanX, spanY, spanZ);
  const is2D = (maxZ - minZ) < 0.001;

  // Build load lookup
  const loadByNode = new Map<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }>();
  for (const l of loads) {
    const existing = loadByNode.get(l.nodeId) ?? { fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 };
    existing.fx += l.fx ?? 0;
    existing.fy += l.fy ?? 0;
    existing.fz += l.fz ?? 0;
    existing.mx += l.mx ?? 0;
    existing.my += l.my ?? 0;
    existing.mz += l.mz ?? 0;
    loadByNode.set(l.nodeId, existing);
  }

  // Build vertices
  let supportCount = 0;
  const vertices: GraphVertex[] = [];
  for (const [id, n] of nodes) {
    const i = nodeIdToIdx.get(id)!;
    const r = n.restraints;
    let restraintMask = 0;
    if (r) {
      if (r.fx) restraintMask |= 0x01;
      if (r.fy) restraintMask |= 0x02;
      if (r.fz) restraintMask |= 0x04;
      if (r.mx) restraintMask |= 0x08;
      if (r.my) restraintMask |= 0x10;
      if (r.mz) restraintMask |= 0x20;
      if (restraintMask > 0) supportCount++;
    }
    const load = loadByNode.get(id);
    vertices.push({
      idx: i,
      // Normalize to [0, 1] range
      x: (n.x - minX) / scale,
      y: (n.y - minY) / scale,
      z: (n.z - minZ) / scale,
      restraintMask,
      fx: load?.fx ?? 0,
      fy: load?.fy ?? 0,
      fz: load?.fz ?? 0,
      mx: load?.mx ?? 0,
      my: load?.my ?? 0,
      mz: load?.mz ?? 0,
    });
  }

  // Build edges and compute topology metrics
  const degree = new Map<number, number>();
  const edges: GraphEdge[] = [];

  const RELEASE_KEYS_I = ['fxStart', 'fyStart', 'fzStart', 'mxStart', 'myStart', 'mzStart', 'startMoment'];
  const RELEASE_KEYS_J = ['fxEnd', 'fyEnd', 'fzEnd', 'mxEnd', 'myEnd', 'mzEnd', 'endMoment'];

  for (const [, m] of members) {
    const ni = nodeIdToIdx.get(m.startNodeId);
    const nj = nodeIdToIdx.get(m.endNodeId);
    if (ni === undefined || nj === undefined) continue;

    degree.set(ni, (degree.get(ni) ?? 0) + 1);
    degree.set(nj, (degree.get(nj) ?? 0) + 1);

    // Compute length
    const n1 = nodes.get(m.startNodeId)!;
    const n2 = nodes.get(m.endNodeId)!;
    const dx = n2.x - n1.x, dy = n2.y - n1.y, dz = n2.z - n1.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Encode releases
    let releaseMask = 0;
    if (m.releases) {
      RELEASE_KEYS_I.forEach((k, b) => { if (m.releases![k]) releaseMask |= (1 << b); });
      RELEASE_KEYS_J.forEach((k, b) => { if (m.releases![k]) releaseMask |= (1 << (b + 7)); });
    }

    edges.push({
      i: ni, j: nj,
      E: m.E ?? 200e6,
      A: m.A ?? 0.01,
      Iy: m.Iy ?? 1e-4,
      Iz: m.Iz ?? 1e-4,
      J: m.J ?? 2e-4,
      G: m.G ?? 76.9e6,
      beta: m.betaAngle ?? 0,
      releaseMask,
      length,
    });
  }

  const degrees = Array.from(degree.values());
  const maxDegree = degrees.length > 0 ? Math.max(...degrees) : 0;
  const avgDegree = degrees.length > 0 ? degrees.reduce((a, b) => a + b, 0) / degrees.length : 0;

  // Static determinacy check: r + 3m = 3n (2D) or r + 6m = 6n (3D)
  // r = total restrained DOFs, m = member count, n = node count
  let totalRestrainedDofs = 0;
  for (const v of vertices) {
    for (let b = 0; b < 6; b++) {
      if (v.restraintMask & (1 << b)) totalRestrainedDofs++;
    }
  }
  const dofPerNode = is2D ? 3 : 6;
  const unknowns = nodes.size * dofPerNode - totalRestrainedDofs;
  const equations = members.size * (is2D ? 3 : 6);
  const isStaticallyDeterminate = unknowns === equations;

  return {
    dofCount: nodes.size * 6,
    vertices,
    edges,
    boundingBox: { minX, minY, minZ, maxX, maxY, maxZ, spanX, spanY, spanZ },
    is2D,
    topology: {
      nodeCount: nodes.size,
      memberCount: members.size,
      supportCount,
      loadedNodeCount: loadByNode.size,
      maxDegree,
      avgDegree,
      isStaticallyDeterminate,
    },
  };
}

// ─── Telemetry Sender ───────────────────────────────────────────────

/**
 * Capture and send analysis telemetry to the backend.
 * This is fire-and-forget — failures are logged but never block the user.
 *
 * @param graph - Normalized structural graph
 * @param analysisResults - Raw analysis results from the solver
 * @param solveTimeMs - How long the solver took
 * @param getToken - Auth token getter (for API authentication)
 */
export async function sendAnalysisTelemetry(
  graph: StructuralGraph,
  analysisResults: {
    displacements?: Map<string, Record<string, number>>;
    reactions?: Map<string, Record<string, number>>;
    memberForces?: Map<string, Record<string, unknown>>;
    equilibriumCheck?: { error_percent?: number; pass?: boolean };
    conditionNumber?: number;
  },
  solveTimeMs: number,
  getToken: () => Promise<string | null>,
  nodeIdToIdx: Map<string, number>,
): Promise<void> {
  try {
    // Check opt-out (user settings)
    try {
      const optOut = localStorage.getItem('beamlab_telemetry_opt_out');
      if (optOut === 'true') return;
    } catch { /* noop */ }

    // Build flat displacement array
    const displacements: number[] = new Array(graph.vertices.length * 6).fill(0);
    if (analysisResults.displacements) {
      for (const [nodeId, d] of analysisResults.displacements) {
        const idx = nodeIdToIdx.get(nodeId);
        if (idx === undefined) continue;
        const off = idx * 6;
        displacements[off] = d.DX ?? d.dx ?? 0;
        displacements[off + 1] = d.DY ?? d.dy ?? 0;
        displacements[off + 2] = d.DZ ?? d.dz ?? 0;
        displacements[off + 3] = d.RX ?? d.rx ?? 0;
        displacements[off + 4] = d.RY ?? d.ry ?? 0;
        displacements[off + 5] = d.RZ ?? d.rz ?? 0;
      }
    }

    // Build reactions array (only support nodes)
    const reactions: Array<{ nodeIdx: number; fx: number; fy: number; fz: number; mx: number; my: number; mz: number }> = [];
    if (analysisResults.reactions) {
      for (const [nodeId, r] of analysisResults.reactions) {
        const idx = nodeIdToIdx.get(nodeId);
        if (idx === undefined) continue;
        const vals = Array.isArray(r) ? r : [r.fx ?? 0, r.fy ?? 0, r.fz ?? 0, r.mx ?? 0, r.my ?? 0, r.mz ?? 0];
        reactions.push({
          nodeIdx: idx,
          fx: vals[0] ?? 0, fy: vals[1] ?? 0, fz: vals[2] ?? 0,
          mx: vals[3] ?? 0, my: vals[4] ?? 0, mz: vals[5] ?? 0,
        });
      }
    }

    // Build flat member forces array
    const memberForces: number[] = [];
    if (analysisResults.memberForces) {
      for (const [, forces] of analysisResults.memberForces) {
        const sf = (forces as any).startForces ?? {};
        const ef = (forces as any).endForces ?? {};
        memberForces.push(
          sf.axial ?? 0, sf.shearY ?? 0, sf.shearZ ?? 0,
          sf.momentY ?? 0, sf.momentZ ?? 0, sf.torsion ?? 0,
          ef.axial ?? 0, ef.shearY ?? 0, ef.shearZ ?? 0,
          ef.momentY ?? 0, ef.momentZ ?? 0, ef.torsion ?? 0,
        );
      }
    }

    // Max displacement
    let maxDisp = 0;
    for (let i = 0; i < displacements.length; i += 6) {
      const mag = Math.sqrt(
        displacements[i] ** 2 + displacements[i + 1] ** 2 + displacements[i + 2] ** 2
      );
      maxDisp = Math.max(maxDisp, mag);
    }

    // Max member force
    let maxForce = 0;
    for (const v of memberForces) {
      maxForce = Math.max(maxForce, Math.abs(v));
    }

    const payload: AnalysisTelemetryPayload = {
      graph,
      results: {
        maxDisplacement: maxDisp * 1000, // m → mm
        maxMemberForce: maxForce,
        equilibriumErrorPercent: analysisResults.equilibriumCheck?.error_percent ?? -1,
        conditionNumber: analysisResults.conditionNumber ?? -1,
        passed: analysisResults.equilibriumCheck?.pass ?? true,
        solveTimeMs,
        displacements,
        reactions,
        memberForces,
      },
      meta: {
        solver: 'wasm',
        timestamp: new Date().toISOString(),
        appVersion: import.meta.env?.VITE_APP_VERSION ?? '1.0.0',
        analysisType: 'static',
      },
    };

    // Send to backend (fire-and-forget)
    const token = await getToken();
    if (!token) return;

    fetch(`${API_URL}/api/usage/analysis-results`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Store as analysis result with telemetry graph attached
        telemetry: payload,
        analysisType: 'static',
        nodeCount: graph.topology.nodeCount,
        memberCount: graph.topology.memberCount,
        solveTimeMs,
        success: payload.results.passed,
      }),
    }).catch(() => { /* non-critical */ });

  } catch {
    // Never block the user
  }
}
