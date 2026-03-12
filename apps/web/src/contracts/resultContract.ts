/**
 * Result Contract — Canonical result payload structure
 *
 * All structural engine results must conform to this contract.
 * Enables unified post-processing, reports, and utilization displays.
 *
 * Every engine returns:
 *   - passed: boolean (capacity check)
 *   - utilization: number (0..∞, <1 = OK)
 *   - message: human-readable summary
 *   - clause: design code clause reference
 */

// ─── Core Result Types ─────────────────────────────────────────────────

/** Design code reference */
export interface ClauseRef {
  code: string;     // e.g. "IS 456:2000", "IS 800:2007", "ACI 318-19"
  clause: string;   // e.g. "Cl. 40.1", "Cl. 8.4.1", "Eq. E3-1"
  table?: string;   // e.g. "Table 19", "Table 5"
  description?: string;
}

/** Single design check result */
export interface CheckResult {
  name: string;           // e.g. "Flexure", "Shear", "Deflection"
  passed: boolean;
  utilization: number;    // demand/capacity ratio
  demand: number;
  capacity: number;
  demandLabel: string;    // e.g. "Mu"
  capacityLabel: string;  // e.g. "Mu,limit"
  unit: string;           // e.g. "kN·m", "kN", "mm"
  clause: ClauseRef;
  message: string;
}

/** Complete engine result */
export interface EngineResult {
  engineId: string;        // e.g. "rc-beam-flexure", "steel-column-buckling"
  engineVersion: string;   // semver for reproducibility
  passed: boolean;         // overall pass (all checks passed)
  utilization: number;     // max utilization across all checks
  governingCheck: string;  // name of the check that governed
  checks: CheckResult[];
  inputs: Record<string, number | string>;
  timestamp: string;       // ISO 8601
  message: string;         // one-line summary
}

// ─── Analysis Result Contract ──────────────────────────────────────────

/** Per-node displacement result */
export interface NodeDisplacementResult {
  nodeId: string;
  dx: number; dy: number; dz: number;
  rx: number; ry: number; rz: number;
  /** Resultant translational displacement */
  magnitude: number;
}

/** Per-member force result at 21 stations */
export interface MemberForceResult {
  memberId: string;
  length: number;
  stations: MemberStation[];
  peaks: MemberPeaks;
}

export interface MemberStation {
  /** Fractional position (0 = start, 1 = end) */
  position: number;
  /** Absolute distance from start (m or mm, per unit system) */
  distance: number;
  axial: number;
  shearY: number;
  shearZ: number;
  torsion: number;
  momentY: number;
  momentZ: number;
  deflectionY: number;
  deflectionZ: number;
}

export interface MemberPeaks {
  maxAxial: number;
  minAxial: number;
  maxShearY: number;
  maxMomentZ: number;
  minMomentZ: number;
  maxDeflection: number;
  maxMomentPosition: number;
  maxDeflectionPosition: number;
}

/** Support reaction result */
export interface ReactionResult {
  nodeId: string;
  fx: number; fy: number; fz: number;
  mx: number; my: number; mz: number;
}

/** Equilibrium verification */
export interface EquilibriumCheck {
  /** Sum of applied forces (should equal reactions) */
  appliedForce: { fx: number; fy: number; fz: number };
  /** Sum of reactions */
  reactionForce: { fx: number; fy: number; fz: number };
  /** Max residual (should be ≈ 0) */
  residual: number;
  /** Passed if residual < tolerance */
  passed: boolean;
}

/** Full analysis result payload */
export interface AnalysisResultPayload {
  success: boolean;
  method: string;       // "DSM", "FEM", "sparse"
  solverBackend: 'rust' | 'python' | 'wasm';
  displacements: NodeDisplacementResult[];
  memberForces: MemberForceResult[];
  reactions: ReactionResult[];
  equilibrium: EquilibriumCheck;
  performance: {
    assemblyTimeMs: number;
    solveTimeMs: number;
    postProcessTimeMs: number;
    totalTimeMs: number;
    matrixSize: number;
    sparsity: number;
  };
  maxDisplacement: number;
  maxStress: number;
  /** Load combination results (if applicable) */
  combinations?: CombinationResultPayload[];
  envelope?: EnvelopePayload;
}

export interface CombinationResultPayload {
  combinationId: string;
  combinationName: string;
  displacements: Record<string, [number, number, number, number, number, number]>;
  memberForces: Record<string, number[]>;
  reactions: Record<string, [number, number, number, number, number, number]>;
}

export interface EnvelopePayload {
  memberForces: Record<
    string,
    {
      max: number[];
      min: number[];
      maxCombo: string[];
      minCombo: string[];
    }
  >;
  reactions: Record<
    string,
    {
      max: [number, number, number, number, number, number];
      min: [number, number, number, number, number, number];
      maxCombo: string[];
      minCombo: string[];
    }
  >;
  governingCombinations: Record<string, string>;
}

// ─── Utilization Color Mapping ─────────────────────────────────────────

/**
 * Map utilization ratio to a color for visualization.
 * Green → Yellow → Orange → Red → Dark Red
 */
export function utilizationColor(u: number): string {
  if (u <= 0.5) return '#22c55e';    // green-500
  if (u <= 0.75) return '#eab308';   // yellow-500
  if (u <= 0.9) return '#f97316';    // orange-500
  if (u <= 1.0) return '#ef4444';    // red-500
  return '#991b1b';                  // red-800 (over-stressed)
}

/**
 * Rank members by utilization (descending).
 * Returns top N critical members.
 */
export function rankCriticalMembers(
  results: { memberId: string; utilization: number }[],
  topN = 10,
): { memberId: string; utilization: number; rank: number }[] {
  return results
    .slice()
    .sort((a, b) => b.utilization - a.utilization)
    .slice(0, topN)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
