/**
 * engineAdapter.ts
 *
 * Adapter that bridges the EnhancedAnalysisEngine to ModernModeler's
 * expected input/output format, allowing the engine to serve as a
 * fallback solver between WASM and the TS Worker.
 *
 * Input:  Same arrays of nodes/members/loads that ModernModeler uses
 * Output: Same result shape that ModernModeler's WASM parser expects
 */

import { Node, Member, MemberLoad, NodeLoad } from '../store/model';
import {
  EnhancedAnalysisEngine,
  AnalysisConfig,
  AnalysisResults,
  Load as EngineLoad,
} from './EnhancedAnalysisEngine';

/** Singleton engine instance (has internal LRU cache) */
let _engine: EnhancedAnalysisEngine | null = null;
function getEngine(): EnhancedAnalysisEngine {
  if (!_engine) {
    _engine = new EnhancedAnalysisEngine();
  }
  return _engine;
}

/**
 * Result shape that ModernModeler's generic parser expects.
 * Matches the WASM / AnalysisService output contract.
 */
export interface AdapterResult {
  success: boolean;
  error?: string;
  displacements: Record<string, number[]>;
  reactions: Record<string, number[]>;
  memberForces: Record<string, {
    axial: number;
    shearY: number;
    shearZ: number;
    momentY: number;
    momentZ: number;
    torsion: number;
    shear_y?: number[];
    shear_z?: number[];
    moment_y?: number[];
    moment_z?: number[];
    x_values?: number[];
    max_shear_y?: number;
    max_shear_z?: number;
    max_moment_y?: number;
    max_moment_z?: number;
  }>;
  stats?: {
    solveTimeMs: number;
    method: string;
    solver: string;
  };
  equilibriumCheck?: {
    pass: boolean;
    error_percent: number;
  };
}

/**
 * Run the EnhancedAnalysisEngine with ModernModeler-shaped data and
 * return results in the same format the WASM parser expects.
 */
export async function analyzeWithEnhancedEngine(
  nodesArray: Node[],
  membersArray: Member[],
  nodalLoads: NodeLoad[],
  memberLoads: MemberLoad[],
  onProgress?: (stage: string, progress: number) => void,
): Promise<AdapterResult> {
  const engine = getEngine();

  // ---- Build Maps from arrays (engine expects Map<string, Node/Member>) ----
  const nodesMap = new Map<string, Node>();
  for (const n of nodesArray) nodesMap.set(n.id, n);

  const membersMap = new Map<string, Member>();
  for (const m of membersArray) membersMap.set(m.id, m);

  // ---- Build AnalysisConfig with a single load case ----
  const loads: EngineLoad[] = nodalLoads.map((nl) => ({
    id: nl.id,
    type: 'point' as const,
    targetType: 'node' as const,
    targetId: nl.nodeId,
    values: [nl.fx ?? 0, nl.fy ?? 0, nl.fz ?? 0, nl.mx ?? 0, nl.my ?? 0, nl.mz ?? 0],
    direction: 'Y' as const, // Not used for point node loads — engine reads values[] directly
  }));

  const config: AnalysisConfig = {
    type: 'linear-static',
    options: {},
    loadCases: [
      {
        id: 'default',
        name: 'Default',
        type: 'dead',
        factor: 1.0,
        loads,
        memberLoads: memberLoads.length > 0 ? memberLoads : undefined,
      },
    ],
  };

  // ---- Run analysis ----
  const engineResults: AnalysisResults = await engine.runAnalysis(
    nodesMap,
    membersMap,
    config,
    onProgress
      ? (stage, progress, _msg) => onProgress(stage, progress)
      : undefined,
  );

  if (engineResults.status === 'failed') {
    return {
      success: false,
      error: engineResults.errors.join('; '),
      displacements: {},
      reactions: {},
      memberForces: {},
    };
  }

  // ---- Convert displacements: NodalDisplacement[] → Record<nodeId, number[]> ----
  const displacements: Record<string, number[]> = {};
  for (const d of engineResults.displacements) {
    displacements[d.nodeId] = [d.dx, d.dy, d.dz, d.rx, d.ry, d.rz];
  }

  // ---- Convert reactions: NodalReaction[] → Record<nodeId, number[]> ----
  const reactions: Record<string, number[]> = {};
  for (const r of engineResults.reactions) {
    reactions[r.nodeId] = [r.fx, r.fy, r.fz, r.mx, r.my, r.mz];
  }

  // ---- Convert member forces ----
  // The engine returns MemberForce[] with position-based entries (start / end).
  // Group by memberId and extract start (position ≈ 0) and end (position ≈ 1).
  const memberForces: AdapterResult['memberForces'] = {};
  const grouped = new Map<string, typeof engineResults.memberForces>();
  for (const mf of engineResults.memberForces) {
    if (!grouped.has(mf.memberId)) grouped.set(mf.memberId, []);
    grouped.get(mf.memberId)!.push(mf);
  }

  for (const [memberId, forces] of grouped) {
    // Sort by position
    forces.sort((a, b) => a.position - b.position);

    // Start and end
    const start = forces[0];
    const end = forces[forces.length - 1];
    if (!start || !end) continue;

    const maxAbs = (arr: number[]) =>
      arr.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

    const shearYArr = forces.map((f) => f.shearY);
    const shearZArr = forces.map((f) => f.shearZ);
    const momentYArr = forces.map((f) => f.momentY);
    const momentZArr = forces.map((f) => f.momentZ);
    const axialArr = forces.map((f) => f.axial);
    const torsionArr = forces.map((f) => f.torsion);

    memberForces[memberId] = {
      axial: start.axial,
      shearY: maxAbs(shearYArr),
      shearZ: maxAbs(shearZArr),
      momentY: maxAbs(momentYArr),
      momentZ: maxAbs(momentZArr),
      torsion: maxAbs(torsionArr),
      shear_y: shearYArr,
      shear_z: shearZArr,
      moment_y: momentYArr,
      moment_z: momentZArr,
      x_values: forces.map((f) => f.position),
      max_shear_y: maxAbs(shearYArr),
      max_shear_z: maxAbs(shearZArr),
      max_moment_y: maxAbs(momentYArr),
      max_moment_z: maxAbs(momentZArr),
    };
  }

  return {
    success: true,
    displacements,
    reactions,
    memberForces,
    stats: {
      solveTimeMs: engineResults.duration,
      method: 'CSR Sparse + PCG',
      solver: 'EnhancedAnalysisEngine (TS fallback)',
    },
  };
}
