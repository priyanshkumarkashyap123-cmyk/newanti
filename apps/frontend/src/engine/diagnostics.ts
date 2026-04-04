/**
 * Model Diagnostics Engine
 *
 * Validates structural model integrity before analysis submission.
 * Detects issues that would cause solver failures or incorrect results.
 *
 * Categories:
 *   ERROR   — blocks analysis (singular matrix, no supports, etc.)
 *   WARNING — likely user mistake (orphan nodes, overlapping members)
 *   INFO    — suggestions (unused load cases, unloaded members)
 */

// ─── Types ─────────────────────────────────────────────────────────────
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  /** Entity IDs involved (node/member/etc.) */
  entityIds?: string[];
}

export interface DiagnosticSummary {
  errors: number;
  warnings: number;
  infos: number;
  items: Diagnostic[];
  /** True if there are zero errors (analysis can proceed) */
  canAnalyze: boolean;
}

// ─── Minimal interfaces expected from the model (avoid store coupling) ──
interface DiagNode {
  id: string;
  x: number;
  y: number;
  z: number;
}

interface DiagMember {
  id: string;
  startNodeId: string;
  endNodeId: string;
  E?: number;
  A?: number;
  I?: number;
}

interface DiagSupport {
  nodeId: string;
  fx?: boolean;
  fy?: boolean;
  fz?: boolean;
  mx?: boolean;
  my?: boolean;
  mz?: boolean;
}

interface DiagLoad {
  nodeId: string;
  fx?: number;
  fy?: number;
  fz?: number;
}

export interface DiagnosticInput {
  nodes: DiagNode[];
  members: DiagMember[];
  supports: DiagSupport[];
  loads: DiagLoad[];
}

// ─── Thresholds ────────────────────────────────────────────────────────
const ZERO_LENGTH_TOL = 1e-6;  // m
const OVERLAP_ANGLE_TOL = 0.01;  // radians (~0.6°)
const OVERLAP_DIST_TOL = 1e-4;   // m

// ─── Engine ────────────────────────────────────────────────────────────

export function runDiagnostics(input: DiagnosticInput): DiagnosticSummary {
  const items: Diagnostic[] = [];

  checkNoGeometry(input, items);
  checkZeroLengthMembers(input, items);
  checkOrphanNodes(input, items);
  checkDuplicateMembers(input, items);
  checkOverlappingMembers(input, items);
  checkNoSupports(input, items);
  checkInsufficientRestraints(input, items);
  checkNoLoads(input, items);
  checkMissingProperties(input, items);
  checkInvalidProperties(input, items);
  checkDisconnectedNodes(input, items);

  const errors = items.filter((d) => d.severity === 'error').length;
  const warnings = items.filter((d) => d.severity === 'warning').length;
  const infos = items.filter((d) => d.severity === 'info').length;

  return { errors, warnings, infos, items, canAnalyze: errors === 0 };
}

// ─── Individual Checks ─────────────────────────────────────────────────

function checkNoGeometry(input: DiagnosticInput, items: Diagnostic[]): void {
  if (input.nodes.length === 0) {
    items.push({ severity: 'error', code: 'NO_NODES', message: 'Model has no nodes.' });
  }
  if (input.members.length === 0) {
    items.push({ severity: 'error', code: 'NO_MEMBERS', message: 'Model has no members.' });
  }
}

function checkZeroLengthMembers(input: DiagnosticInput, items: Diagnostic[]): void {
  const nodeMap = new Map(input.nodes.map((n) => [n.id, n]));
  for (const m of input.members) {
    const s = nodeMap.get(m.startNodeId);
    const e = nodeMap.get(m.endNodeId);
    if (!s || !e) continue;
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const dz = e.z - s.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < ZERO_LENGTH_TOL) {
      items.push({
        severity: 'error',
        code: 'ZERO_LENGTH',
        message: `Member ${m.id} has zero or near-zero length (${len.toExponential(2)} m).`,
        entityIds: [m.id],
      });
    }
  }
}

function checkOrphanNodes(input: DiagnosticInput, items: Diagnostic[]): void {
  const connected = new Set<string>();
  for (const m of input.members) {
    connected.add(m.startNodeId);
    connected.add(m.endNodeId);
  }
  for (const n of input.nodes) {
    if (!connected.has(n.id)) {
      items.push({
        severity: 'warning',
        code: 'ORPHAN_NODE',
        message: `Node ${n.id} is not connected to any member.`,
        entityIds: [n.id],
      });
    }
  }
}

function checkDuplicateMembers(input: DiagnosticInput, items: Diagnostic[]): void {
  const seen = new Map<string, string>();
  for (const m of input.members) {
    const key1 = `${m.startNodeId}-${m.endNodeId}`;
    const key2 = `${m.endNodeId}-${m.startNodeId}`;
    const existing = seen.get(key1) ?? seen.get(key2);
    if (existing) {
      items.push({
        severity: 'warning',
        code: 'DUPLICATE_MEMBER',
        message: `Members ${existing} and ${m.id} connect the same nodes.`,
        entityIds: [existing, m.id],
      });
    } else {
      seen.set(key1, m.id);
    }
  }
}

function checkOverlappingMembers(input: DiagnosticInput, items: Diagnostic[]): void {
  const nodeMap = new Map(input.nodes.map((n) => [n.id, n]));

  interface VecMem {
    id: string;
    sx: number; sy: number; sz: number;
    dx: number; dy: number; dz: number;
    len: number;
  }

  const vecs: VecMem[] = [];
  for (const m of input.members) {
    const s = nodeMap.get(m.startNodeId);
    const e = nodeMap.get(m.endNodeId);
    if (!s || !e) continue;
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const dz = e.z - s.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < ZERO_LENGTH_TOL) continue;
    vecs.push({ id: m.id, sx: s.x, sy: s.y, sz: s.z, dx: dx / len, dy: dy / len, dz: dz / len, len });
  }

  for (let i = 0; i < vecs.length; i++) {
    for (let j = i + 1; j < vecs.length; j++) {
      const a = vecs[i];
      const b = vecs[j];
      // Check if collinear (cross product ≈ 0)
      const cx = a.dy * b.dz - a.dz * b.dy;
      const cy = a.dz * b.dx - a.dx * b.dz;
      const cz = a.dx * b.dy - a.dy * b.dx;
      const crossMag = Math.sqrt(cx * cx + cy * cy + cz * cz);
      if (crossMag > OVERLAP_ANGLE_TOL) continue;

      // Check if colinear (distance between lines ≈ 0)
      const abx = b.sx - a.sx;
      const aby = b.sy - a.sy;
      const abz = b.sz - a.sz;
      const dotAB = abx * a.dx + aby * a.dy + abz * a.dz;
      const perpX = abx - dotAB * a.dx;
      const perpY = aby - dotAB * a.dy;
      const perpZ = abz - dotAB * a.dz;
      const dist = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);
      if (dist > OVERLAP_DIST_TOL) continue;

      // Check actual overlapping range (project b's endpoints onto a's axis)
      const t_b_start = (abx * a.dx + aby * a.dy + abz * a.dz);
      const t_b_end = t_b_start + (b.dx * a.dx + b.dy * a.dy + b.dz * a.dz) * b.len;
      const t_min = Math.min(t_b_start, t_b_end);
      const t_max = Math.max(t_b_start, t_b_end);
      if (t_max > OVERLAP_DIST_TOL && t_min < a.len - OVERLAP_DIST_TOL) {
        items.push({
          severity: 'warning',
          code: 'OVERLAP_MEMBER',
          message: `Members ${a.id} and ${b.id} overlap along their length.`,
          entityIds: [a.id, b.id],
        });
      }
    }
  }
}

function checkNoSupports(input: DiagnosticInput, items: Diagnostic[]): void {
  if (input.supports.length === 0) {
    items.push({
      severity: 'error',
      code: 'NO_SUPPORTS',
      message: 'Model has no supports — structure is unstable.',
    });
  }
}

function checkInsufficientRestraints(input: DiagnosticInput, items: Diagnostic[]): void {
  // Simple check: count total restrained translational DOFs
  let restrained = 0;
  for (const s of input.supports) {
    if (s.fx) restrained++;
    if (s.fy) restrained++;
    if (s.fz) restrained++;
  }
  // Minimum 3 translational restraints needed for 3D stability (6 for full)
  if (restrained > 0 && restrained < 3) {
    items.push({
      severity: 'error',
      code: 'INSUFFICIENT_RESTRAINTS',
      message: `Only ${restrained} translational DOF(s) restrained — at least 3 needed for 3D stability.`,
    });
  }
}

function checkNoLoads(input: DiagnosticInput, items: Diagnostic[]): void {
  if (input.loads.length === 0) {
    items.push({
      severity: 'info',
      code: 'NO_LOADS',
      message: 'No loads applied — analysis will produce zero results.',
    });
  }
}

function checkMissingProperties(input: DiagnosticInput, items: Diagnostic[]): void {
  for (const m of input.members) {
    const missing: string[] = [];
    if (m.E == null || m.E <= 0) missing.push('E');
    if (m.A == null || m.A <= 0) missing.push('A');
    if (m.I == null || m.I <= 0) missing.push('I');
    if (missing.length > 0) {
      items.push({
        severity: 'error',
        code: 'MISSING_PROPERTY',
        message: `Member ${m.id} is missing required properties: ${missing.join(', ')}.`,
        entityIds: [m.id],
      });
    }
  }
}

function checkInvalidProperties(input: DiagnosticInput, items: Diagnostic[]): void {
  for (const m of input.members) {
    if (m.E != null && m.E < 0) {
      items.push({
        severity: 'error',
        code: 'NEGATIVE_E',
        message: `Member ${m.id} has negative Young's modulus (E = ${m.E}).`,
        entityIds: [m.id],
      });
    }
  }
}

function checkDisconnectedNodes(input: DiagnosticInput, items: Diagnostic[]): void {
  if (input.nodes.length < 2 || input.members.length === 0) return;

  // Build adjacency list
  const adj = new Map<string, Set<string>>();
  for (const n of input.nodes) adj.set(n.id, new Set());
  for (const m of input.members) {
    adj.get(m.startNodeId)?.add(m.endNodeId);
    adj.get(m.endNodeId)?.add(m.startNodeId);
  }

  // BFS from the first connected node
  const connectedNodes = new Set<string>();
  for (const m of input.members) {
    connectedNodes.add(m.startNodeId);
    connectedNodes.add(m.endNodeId);
  }
  if (connectedNodes.size === 0) return;

  const start = connectedNodes.values().next().value!;
  const visited = new Set<string>();
  const queue = [start];
  visited.add(start);
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adj.get(current);
    if (!neighbors) continue;
    for (const nb of neighbors) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }

  const disconnected = [...connectedNodes].filter((id) => !visited.has(id));
  if (disconnected.length > 0) {
    items.push({
      severity: 'error',
      code: 'DISCONNECTED_STRUCTURE',
      message: `Structure is disconnected: ${disconnected.length} node(s) not reachable from the main structure.`,
      entityIds: disconnected,
    });
  }
}
