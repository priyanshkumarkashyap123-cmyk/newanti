/**
 * BeamLab WASM Solver Service
 *
 * Complete client-side structural analysis using Rust WASM.
 * Handles: Frame Analysis, P-Delta, Buckling Analysis
 *
 * NO backend calls - everything runs in the browser!
 */

import { wasmLogger } from "../utils/logger";
import init, {
  solve_structure_wasm,
  solve_3d_frame,
  solve_p_delta,
  analyze_buckling,
  get_solver_info,
  // Phase 52 Additions
  // WasmHHTIntegrator, // TODO: Export from Rust
  // WasmSparseMatrix, // TODO: Export from Rust
  // MacnealHarderWasm // TODO: Export from Rust
} from "backend-rust";

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface Node {
  id: number;
  x: number;
  y: number;
  z?: number; // Optional for 2D models
  // Support both 2D (3 DOF) and 3D (6 DOF) restraint formats
  // Format 1: fixed [dx, dy, rz] for 2D backward compatibility
  fixed?: [boolean, boolean, boolean];
  // Format 2: restraints [Fx, Fy, Fz, Mx, My, Mz] for full 3D
  restraints?: boolean[];
}

export interface Element {
  id: number;
  // 2D format (backward compatibility)
  node_start?: number;
  node_end?: number;
  e?: number; // Young's Modulus (Pa)
  i?: number; // Moment of Inertia (m^4)
  a?: number; // Cross-sectional Area (m^2)
  // 3D format (Rust native naming)
  node_i?: string; // Start node ID
  node_j?: string; // End node ID
  E?: number; // Young's Modulus (Pa)
  G?: number; // Shear Modulus (Pa)
  A?: number; // Cross-sectional Area (m^2)
  Iy?: number; // Moment of Inertia Y (m^4)
  Iz?: number; // Moment of Inertia Z (m^4)
  J?: number; // Torsional constant (m^4)
}

export interface PointLoad {
  node_id: number; // MUST match Rust struct field name
  fx: number; // Force X (N)
  fy: number; // Force Y (N)
  fz?: number; // Force Z (N)
  mx?: number; // Moment X (N·m)
  my?: number; // Moment Y (N·m)
  mz?: number; // Moment Z (N·m)
}

export type LoadDistribution = "Uniform" | "Triangular" | "Trapezoidal";

export interface MemberLoad {
  element_id: number;
  distribution?: LoadDistribution; // Optional - Rust infers from w1/w2
  w1: number; // Load intensity at start (N/m)
  w2: number; // Load intensity at end (N/m)
  direction: string; // "local_y", "global_y", etc. - Rust checks for "local" + "y"
  start_pos?: number; // 0-1 ratio (default 0)
  end_pos?: number; // 0-1 ratio (default 1)
  is_projected?: boolean; // For wind/snow loads
}

// Rust returns HashMap<i32, [f64; 3]> for displacements and reactions
// This gets serialized as { "1": [dx, dy, rz], "2": [...] } etc.
export interface DisplacementMap {
  [nodeId: string]: [number, number, number]; // [dx, dy, rz]
}

export interface ReactionMap {
  [nodeId: string]: [number, number, number]; // [fx, fy, mz]
}

// Rust MemberForces struct
export interface MemberForces {
  axial: number;
  shear_start: number;
  moment_start: number;
  shear_end: number;
  moment_end: number;
}

export interface MemberForcesMap {
  [elementId: string]: MemberForces;
}

export interface AnalysisResult {
  displacements: DisplacementMap; // HashMap from Rust
  reactions: ReactionMap; // HashMap from Rust
  member_forces: MemberForcesMap; // HashMap from Rust
  success: boolean;
  error?: string;
  stats?: {
    solveTimeMs: number;
    method: string;
  };
}

export interface PDeltaResult extends AnalysisResult {
  converged: boolean;
  iterations?: number;
}

export interface BucklingResult {
  success: boolean;
  buckling_loads: number[];
  modes?: number;
  error?: string;
}

export interface SolverInfo {
  version: string;
  capabilities: string[];
}

// ============================================
// MODULE STATE
// ============================================

let wasmInitialized = false;

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the WASM module. Call this once before using other functions.
 */
export async function initSolver(): Promise<void> {
  if (wasmInitialized) return;

  try {
    await init();
    wasmInitialized = true;
    wasmLogger.success("WASM Solver initialized successfully");

    // Log solver capabilities
    try {
      const info = JSON.parse(get_solver_info());
      wasmLogger.info("Solver version:", info.version);
      wasmLogger.debug("Capabilities:", info.capabilities);
    } catch (e) {
      wasmLogger.debug("Solver info not available");
    }
  } catch (error) {
    wasmLogger.error("Failed to initialize WASM Solver:", error);
    throw error;
  }
}

// ============================================
// ANALYSIS FUNCTIONS
// ============================================

/**
 * Analyze a structure using the Direct Stiffness Method.
 *
 * Supports:
 * - Uniform distributed loads
 * - Triangular distributed loads (linearly varying)
 * - Trapezoidal distributed loads
 * - Point loads and moments
 */
export async function analyzeStructure(
  nodes: Node[],
  elements: Element[],
  pointLoads: PointLoad[] = [],
  memberLoads: MemberLoad[] = [],
): Promise<AnalysisResult> {
  if (!wasmInitialized) {
    await initSolver();
  }

  try {
    wasmLogger.info(
      "Analyzing structure:",
      nodes.length,
      "nodes,",
      elements.length,
      "elements",
    );
    wasmLogger.debug(
      "Loads:",
      pointLoads.length,
      "point loads,",
      memberLoads.length,
      "member loads",
    );

    const startTime = performance.now();

    // Call Rust WASM function - use solve_3d_frame for full 3D analysis with loads
    const result = solve_3d_frame(nodes, elements, pointLoads, memberLoads);

    const endTime = performance.now();
    const solveTime = endTime - startTime;

    wasmLogger.success("Analysis completed in", solveTime.toFixed(2), "ms");
    wasmLogger.debug("Raw result:", result);

    if (result.error) {
      return {
        displacements: {},
        reactions: {},
        member_forces: {},
        success: false,
        error: result.error,
      };
    }

    return {
      displacements: result.displacements || {},
      reactions: result.reactions || {},
      member_forces: result.member_forces || {},
      success: true,
      stats: {
        solveTimeMs: solveTime,
        method: "Direct Stiffness Method",
      },
    };
  } catch (error) {
    wasmLogger.error("Analysis failed:", error);
    return {
      displacements: {},
      reactions: {},
      member_forces: {},
      success: false,
      error: String(error),
    };
  }
}

/**
 * P-Delta analysis with second-order effects.
 *
 * Iteratively solves [K_e + K_g(P)]·u = F using Newton-Raphson.
 * Captures geometric nonlinearity from axial forces.
 *
 * Critical for:
 * - Slender columns with high axial loads
 * - Tall buildings with lateral forces
 * - Structures where P/P_E > 0.05
 */
export async function analyzePDelta(
  nodes: Node[],
  elements: Element[],
  pointLoads: PointLoad[] = [],
  memberLoads: MemberLoad[] = [],
  maxIterations: number = 20,
  tolerance: number = 1e-4,
): Promise<PDeltaResult> {
  if (!wasmInitialized) {
    await initSolver();
  }

  try {
    wasmLogger.info("Running P-Delta analysis...");
    wasmLogger.debug("Max iterations:", maxIterations, "Tolerance:", tolerance);

    const startTime = performance.now();

    const result = solve_p_delta(
      nodes,
      elements,
      pointLoads,
      memberLoads,
      maxIterations,
      tolerance,
    );

    const endTime = performance.now();
    const solveTime = endTime - startTime;

    wasmLogger.success("P-Delta completed in", solveTime.toFixed(2), "ms");

    if (result.converged !== undefined) {
      wasmLogger.info(
        "Converged:",
        result.converged,
        "Iterations:",
        result.iterations,
      );
    }

    if (result.error) {
      return {
        displacements: {},
        reactions: {},
        member_forces: {},
        success: false,
        converged: false,
        error: result.error,
      };
    }

    return {
      displacements: result.displacements || {},
      reactions: result.reactions || {},
      member_forces: result.member_forces || {},
      success: true,
      converged: result.converged || false,
      iterations: result.iterations,
      stats: {
        solveTimeMs: solveTime,
        method: "P-Delta (Newton-Raphson)",
      },
    };
  } catch (error) {
    wasmLogger.error("P-Delta analysis failed:", error);
    return {
      displacements: {},
      reactions: {},
      member_forces: {},
      success: false,
      converged: false,
      error: String(error),
    };
  }
}

/**
 * Buckling analysis - eigenvalue problem to find critical loads.
 *
 * Solves: [K_e - λ*K_g]{φ} = 0
 *
 * Returns buckling load factors λ where:
 * P_critical = λ × P_applied
 *
 * Validates against Euler formula: P_cr = π²EI/L² for pin-ended columns
 */
export async function analyzeBuckling(
  nodes: Node[],
  elements: Element[],
  pointLoads: PointLoad[] = [],
  numModes: number = 5,
): Promise<BucklingResult> {
  if (!wasmInitialized) {
    await initSolver();
  }

  try {
    wasmLogger.info("Running buckling analysis for", numModes, "modes...");

    const startTime = performance.now();

    let result = analyze_buckling(nodes, elements, pointLoads, numModes);

    // Handle case where WASM returns JSON string instead of object (stub implementation)
    if (typeof result === "string") {
      try {
        result = JSON.parse(result);
      } catch (e) {
        wasmLogger.error("Failed to parse buckling result:", e);
        return {
          success: false,
          buckling_loads: [],
          error: "Failed to parse buckling analysis result",
        };
      }
    }

    const endTime = performance.now();
    const solveTime = endTime - startTime;

    wasmLogger.success(
      "Buckling analysis completed in",
      solveTime.toFixed(2),
      "ms",
    );

    if (result.error) {
      return {
        success: false,
        buckling_loads: [],
        error: result.error,
      };
    }

    wasmLogger.debug("Critical loads:", result.buckling_loads);

    return {
      success: true,
      buckling_loads: result.buckling_loads || [],
      modes: numModes,
    };
  } catch (error) {
    wasmLogger.error("Buckling analysis failed:", error);
    return {
      success: false,
      buckling_loads: [],
      error: String(error),
    };
  }
}

// ============================================
// CIVIL ENGINEERING ANALYSIS (Phase 2)
// ============================================

export interface GeotechBearingInput {
  width: number;
  length: number;
  depth: number;
  cohesion: number;
  phi: number;
  gamma: number;
  fs?: number;
}

export interface GeotechBearingResult {
  q_ult: number;
  q_allow: number;
  nc: number;
  nq: number;
  n_gamma: number;
}

/**
 * Calculate Bearing Capacity using Rust WASM Engine (Ultra Fast)
 * TODO: Not yet implemented in Rust - waiting for WASM binding
 */
/* 
export async function calculateGeotechBearing(input: GeotechBearingInput): Promise<GeotechBearingResult | null> {
    if (!wasmInitialized) await initSolver();

    try {
        const payload = JSON.stringify({
            ...input,
            fs: input.fs || 3.0
        });

        const json = calculate_bearing_capacity(payload);
        const result = JSON.parse(json);

        if (!result.q_allow) return null; // Error or invalid
        return result;
    } catch (e) {
        wasmLogger.error('Geotech calculation failed:', e);
        return null; // Fallback to TS
    }
}
*/

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if WASM solver is initialized
 */
export function isSolverReady(): boolean {
  return wasmInitialized;
}

/**
 * Get solver version and capabilities information
 */
export function getSolverInfo(): SolverInfo {
  try {
    if (wasmInitialized) {
      const info = JSON.parse(get_solver_info());
      return {
        version: info.version || "1.0.0",
        capabilities: info.capabilities || [],
      };
    }
  } catch (e) {
    wasmLogger.warn("Failed to get solver info:", e);
  }

  return {
    version: "1.0.0",
    capabilities: [
      "2D frame analysis",
      "Direct stiffness method",
      "Triangular loads",
      "Trapezoidal loads",
      "P-Delta analysis",
      "Buckling analysis",
    ],
  };
}

/**
 * Create a simple uniform distributed load
 */
export function createUniformLoad(
  elementId: number,
  intensity: number,
  direction: string = "LocalY",
): MemberLoad {
  return {
    element_id: elementId,
    distribution: "Uniform",
    w1: intensity,
    w2: intensity,
    direction,
    start_pos: 0.0,
    end_pos: 1.0,
  };
}

/**
 * Create a triangular distributed load (zero at start, max at end)
 */
export function createTriangularLoad(
  elementId: number,
  maxIntensity: number,
  direction: string = "LocalY",
): MemberLoad {
  return {
    element_id: elementId,
    distribution: "Triangular",
    w1: 0,
    w2: maxIntensity,
    direction,
    start_pos: 0.0,
    end_pos: 1.0,
  };
}

/**
 * Create a trapezoidal distributed load
 */
export function createTrapezoidalLoad(
  elementId: number,
  startIntensity: number,
  endIntensity: number,
  direction: string = "LocalY",
): MemberLoad {
  return {
    element_id: elementId,
    distribution: "Trapezoidal",
    w1: startIntensity,
    w2: endIntensity,
    direction,
    start_pos: 0.0,
    end_pos: 1.0,
  };
}

// ============================================
// SERVICE OBJECT EXPORT
// ============================================

/**
 * Unified wasmSolver service object for ServiceRegistry
 */
export const wasmSolver = {
  initialize: initSolver,
  analyze: analyzeStructure,
  analyzePDelta,
  analyzeBuckling,
  // calculateGeotechBearing, // TODO: Not yet implemented in Rust
  isSolverReady,
  getSolverInfo,
  createUniformLoad,
  createTriangularLoad,
  createTrapezoidalLoad,
};
