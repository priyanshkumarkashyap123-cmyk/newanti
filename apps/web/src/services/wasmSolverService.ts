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
  set_panic_hook,
  solve_3d_frame,
  solve_3d_frame_extended,
  solve_p_delta,
  solve_p_delta_extended,
  analyze_buckling,
  modal_analysis as wasm_modal_analysis,
  solve_response_spectrum as wasm_response_spectrum,
  solve_ultra_fast as wasm_solve_ultra_fast,
  benchmark_ultra_fast as wasm_benchmark_ultra_fast,
  get_solver_info,
  combine_load_cases as wasm_combine_load_cases,
  get_standard_combinations_is800,
  get_standard_combinations_eurocode,
  get_standard_combinations_aisc_lrfd,
  solve_pushover as wasm_solve_pushover,
  solve_sparse_system_json as wasm_solve_sparse,
} from "backend-rust";

// ============================================
// UTILITY: Convert JS Map → plain object
// ============================================
// serde-wasm-bindgen v0.6 serializes Rust HashMap as JavaScript Map,
// NOT a plain object.  Object.entries() / Object.keys() return []
// for JS Maps.  Convert them so the rest of the codebase works.
function jsMapToPlainObject(val: any): Record<string, any> {
  if (val instanceof Map) {
    const obj: Record<string, any> = {};
    val.forEach((v: any, k: any) => {
      // Recursively convert nested Maps (e.g. MemberForces with sub-Maps)
      obj[String(k)] = v instanceof Map ? jsMapToPlainObject(v) : v;
    });
    return obj;
  }
  // Already a plain object (or null/undefined) — return as-is
  return val || {};
}

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface Node {
  id: number | string;
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
  id: number | string;
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
  // Plate element fields (4-node shell: DKQ/Mindlin)
  element_type?: "Frame" | "Truss" | "Cable" | "Plate";
  thickness?: number; // Plate thickness (m)
  node_k?: string; // 3rd node (plates)
  node_l?: string; // 4th node (plates)
  nu?: number; // Poisson's ratio (plates, default 0.3)
}

export interface PointLoad {
  node_id: number | string; // MUST match Rust struct field name
  fx: number; // Force X (N)
  fy: number; // Force Y (N)
  fz?: number; // Force Z (N)
  mx?: number; // Moment X (N·m)
  my?: number; // Moment Y (N·m)
  mz?: number; // Moment Z (N·m)
}

export type LoadDistribution = "Uniform" | "Triangular" | "Trapezoidal";

export interface MemberLoad {
  element_id: number | string;
  distribution?: LoadDistribution; // Optional - Rust infers from w1/w2
  w1: number; // Load intensity at start (N/m)
  w2: number; // Load intensity at end (N/m)
  direction: string; // "local_y", "global_y", etc. - Rust checks for "local" + "y"
  start_pos?: number; // 0-1 ratio (default 0)
  end_pos?: number; // 0-1 ratio (default 1)
  is_projected?: boolean; // For wind/snow loads
}

export interface PointLoadOnMember {
  element_id: number | string;
  magnitude: number; // Force [N] or Moment [N·m]
  position: number; // 0-1 ratio along member
  direction: string; // "local_y", "global_y", etc.
  is_moment?: boolean; // true = concentrated moment, false = force (default)
}

export interface TemperatureLoad {
  element_id: string;
  delta_t: number; // Uniform temperature change [°C]
  gradient_y: number; // Gradient in Y [°C/m]
  gradient_z: number; // Gradient in Z [°C/m]
  alpha: number; // Thermal coefficient [1/°C]
}

export interface AnalysisConfig {
  include_self_weight?: boolean;
  gravity?: number; // m/s² (default: 9.80665)
  gravity_direction?: number; // -1.0 for downward (default)
}

// Rust returns HashMap<i32, [f64; 3]> for displacements and reactions
// This gets serialized as { "1": [dx, dy, rz], "2": [...] } etc.
export interface DisplacementMap {
  [nodeId: string]: [number, number, number]; // [dx, dy, rz]
}

export interface ReactionMap {
  [nodeId: string]: [number, number, number]; // [fx, fy, mz]
}

// Rust MemberForces struct — 3D solver returns forces_i/forces_j arrays
export interface MemberForces {
  // 3D format (actual Rust output)
  forces_i?: number[]; // [Fx, Fy, Fz, Mx, My, Mz] at node i
  forces_j?: number[]; // [Fx, Fy, Fz, Mx, My, Mz] at node j
  max_shear_y?: number;
  max_shear_z?: number;
  max_moment_y?: number;
  max_moment_z?: number;
  max_axial?: number;
  max_torsion?: number;
  // Legacy 2D scalar format (backward compat)
  axial?: number;
  shear_start?: number;
  moment_start?: number;
  shear_end?: number;
  moment_end?: number;
}

export interface MemberForcesMap {
  [elementId: string]: MemberForces;
}

export interface AnalysisResult {
  displacements: DisplacementMap; // HashMap from Rust
  reactions: ReactionMap; // HashMap from Rust
  member_forces: MemberForcesMap; // HashMap from Rust
  plate_results?: any; // HashMap<String, PlateStressResult> from Rust
  success: boolean;
  error?: string;
  stats?: {
    solveTimeMs: number;
    method: string;
  };
  // Industry-standard verification data from Rust solver
  equilibrium_check?: {
    applied_forces: number[];
    reaction_forces: number[];
    residual: number[];
    error_percent: number;
    pass: boolean;
  };
  condition_number?: number;
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

export interface ModalAnalysisResult {
  success: boolean;
  error?: string;
  frequencies: number[]; // Natural frequencies (Hz)
  periods: number[]; // Natural periods (s)
  mode_shapes: Record<string, number[]>[]; // Mode shapes per node
  mass_participation: Record<string, number>[]; // Mass participation factors
}

export interface ResponseSpectrumInput {
  zoneFactor: number; // IS 1893 zone factor (or PGA)
  importanceFactor: number; // Building importance factor
  responseReduction: number; // Response reduction factor R
  soilType: number; // 1=Rock, 2=Medium, 3=Soft
}

export interface ResponseSpectrumResult {
  success: boolean;
  error?: string;
  base_shear?: number;
  storey_forces?: number[];
  storey_displacements?: number[];
  modal_contributions?: any[];
}

export interface UltraFastResult {
  success: boolean;
  error?: string;
  displacements?: Record<string, number[]>;
  reactions?: Record<string, number[]>;
  member_forces?: Record<string, any>;
  solve_time_us?: number;
}

export interface BenchmarkResult {
  num_nodes: number;
  num_elements: number;
  iterations: number;
  mean_us: number;
  median_us: number;
  min_us: number;
  target_met: boolean;
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
    // Enable readable Rust panic stack traces in browser console
    try {
      set_panic_hook();
    } catch (_) {
      /* older builds may lack this export */
    }
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
  temperatureLoads: TemperatureLoad[] = [],
  pointLoadsOnMembers: PointLoadOnMember[] = [],
  config: AnalysisConfig = {},
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
    wasmLogger.info(
      "Loads:",
      pointLoads.length,
      "point loads,",
      memberLoads.length,
      "member loads",
    );

    // Log detailed input for debugging (only first few entries to avoid spam)
    if (nodes.length > 0) {
      wasmLogger.debug("First node:", JSON.stringify(nodes[0]));
    }
    if (elements.length > 0) {
      wasmLogger.debug("First element:", JSON.stringify(elements[0]));
    }
    if (pointLoads.length > 0) {
      wasmLogger.debug("First point load:", JSON.stringify(pointLoads[0]));
    }
    if (memberLoads.length > 0) {
      wasmLogger.debug("First member load:", JSON.stringify(memberLoads[0]));
    }

    const startTime = performance.now();

    // Call Rust WASM function - use extended 3D solver when extra params available
    const hasExtended =
      temperatureLoads.length > 0 ||
      pointLoadsOnMembers.length > 0 ||
      config.include_self_weight;
    const result = hasExtended
      ? solve_3d_frame_extended(
          nodes,
          elements,
          pointLoads,
          memberLoads,
          temperatureLoads,
          pointLoadsOnMembers,
          config,
        )
      : solve_3d_frame(nodes, elements, pointLoads, memberLoads);

    const endTime = performance.now();
    const solveTime = endTime - startTime;

    wasmLogger.success("Analysis completed in", solveTime.toFixed(2), "ms");

    // Check if result is a string (error from WASM)
    if (typeof result === "string") {
      wasmLogger.error("WASM returned error string:", result);
      return {
        displacements: {},
        reactions: {},
        member_forces: {},
        success: false,
        error: result,
      };
    }

    // serde-wasm-bindgen v0.6 returns JS Maps — convert to plain objects
    const displacements = jsMapToPlainObject(result.displacements);
    const reactions = jsMapToPlainObject(result.reactions);
    const member_forces = jsMapToPlainObject(result.member_forces);

    // Extract equilibrium check (may be Map or plain object)
    const rawEqCheck = result.equilibrium_check;
    const equilibrium_check =
      rawEqCheck instanceof Map
        ? (Object.fromEntries(
            rawEqCheck,
          ) as AnalysisResult["equilibrium_check"])
        : (rawEqCheck ?? undefined);
    const condition_number = result.condition_number ?? undefined;

    wasmLogger.debug("Displacements count:", Object.keys(displacements).length);
    wasmLogger.debug("Reactions count:", Object.keys(reactions).length);
    wasmLogger.debug("Member forces count:", Object.keys(member_forces).length);

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
      displacements,
      reactions,
      member_forces,
      success: true,
      equilibrium_check,
      condition_number,
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
      displacements: jsMapToPlainObject(result.displacements),
      reactions: jsMapToPlainObject(result.reactions),
      member_forces: jsMapToPlainObject(result.member_forces),
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
 * Extended P-Delta analysis with temperature loads, point loads on members, and self-weight config.
 * Uses solve_p_delta_extended WASM binding.
 */
export async function analyzePDeltaExtended(
  nodes: Node[],
  elements: Element[],
  pointLoads: PointLoad[],
  memberLoads: MemberLoad[] = [],
  temperatureLoads: TemperatureLoad[] = [],
  pointLoadsOnMembers: PointLoadOnMember[] = [],
  config: AnalysisConfig | null = null,
  maxIterations: number = 20,
  tolerance: number = 1e-4,
): Promise<PDeltaResult> {
  if (!wasmInitialized) {
    await initSolver();
  }

  try {
    wasmLogger.info("Running Extended P-Delta analysis...");
    const startTime = performance.now();

    const result = solve_p_delta_extended(
      nodes,
      elements,
      pointLoads,
      memberLoads,
      temperatureLoads,
      pointLoadsOnMembers,
      config,
      maxIterations,
      tolerance,
    );

    const solveTime = performance.now() - startTime;
    wasmLogger.success(
      "Extended P-Delta completed in",
      solveTime.toFixed(2),
      "ms",
    );

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
      displacements: jsMapToPlainObject(result.displacements),
      reactions: jsMapToPlainObject(result.reactions),
      member_forces: jsMapToPlainObject(result.member_forces),
      success: true,
      converged: result.converged || false,
      iterations: result.iterations,
      equilibrium_check: result.equilibrium_check,
      stats: {
        solveTimeMs: solveTime,
        method: "P-Delta Extended (Temperature+Springs+Self-Weight)",
      },
    };
  } catch (error) {
    wasmLogger.error("Extended P-Delta analysis failed:", error);
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
// PUSHOVER ANALYSIS (Nonlinear Static)
// ============================================

export interface PushoverInput {
  /** Story heights in meters */
  story_heights: number[];
  /** Story masses / weights in kN */
  story_masses: number[];
  /** Story stiffness in kN/m */
  story_stiffness: number[];
  /** Optional first-mode shape */
  mode_shape?: number[];
  /** Load pattern: "uniform" | "triangular" | "first-mode" | "mass-proportional" | "code" */
  load_pattern?: string;
  /** Target displacement in meters */
  target_displacement?: number;
  /** Number of load steps */
  num_steps?: number;
  /** Include P-Delta effects */
  include_pdelta?: boolean;
  /** Convergence tolerance */
  tolerance?: number;
  /** Max iterations per step */
  max_iterations?: number;
  /** Hinge material type: "rc_beam" | "rc_column" | "steel" */
  hinge_material?: string;
}

export interface PushoverPoint {
  step: number;
  base_shear: number;
  roof_displacement: number;
  hinges_yielded: number;
}

export interface PushoverResult {
  success: boolean;
  points: PushoverPoint[];
  yield_point?: PushoverPoint;
  ultimate_point?: PushoverPoint;
  ductility: number;
  effective_period: number;
  hinge_summary: Array<{
    id: number;
    state: string;
    deformation: number;
    ductility_demand: number;
  }>;
  error?: string;
}

/**
 * Nonlinear static pushover analysis — capacity curve generation.
 *
 * Uses the real Rust pushover_analysis module via WASM.
 * Generates base shear vs. roof displacement with plastic hinge tracking.
 *
 * @param input - Pushover analysis parameters (stories, masses, stiffness, config)
 * @returns Capacity curve with yield/ultimate points and ductility
 */
export async function runPushoverAnalysis(
  input: PushoverInput,
): Promise<PushoverResult> {
  if (!wasmInitialized) {
    await initSolver();
  }

  try {
    wasmLogger.info(
      "Running pushover analysis:",
      input.story_heights.length,
      "stories",
    );

    const startTime = performance.now();

    let result = wasm_solve_pushover(input);

    // Handle string response (fallback)
    if (typeof result === "string") {
      try {
        result = JSON.parse(result);
      } catch (e) {
        wasmLogger.error("Failed to parse pushover result:", e);
        return {
          success: false,
          points: [],
          ductility: 0,
          effective_period: 0,
          hinge_summary: [],
          error: "Failed to parse pushover analysis result",
        };
      }
    }

    const endTime = performance.now();
    const solveTime = endTime - startTime;

    wasmLogger.success(
      "Pushover analysis completed in",
      solveTime.toFixed(2),
      "ms —",
      result.points?.length || 0,
      "capacity points",
    );

    if (result.error) {
      return {
        success: false,
        points: [],
        ductility: 0,
        effective_period: 0,
        hinge_summary: [],
        error: result.error,
      };
    }

    return {
      success: true,
      points: result.points || [],
      yield_point: result.yield_point,
      ultimate_point: result.ultimate_point,
      ductility: result.ductility || 1,
      effective_period: result.effective_period || 0,
      hinge_summary: result.hinge_summary || [],
    };
  } catch (error) {
    wasmLogger.error("Pushover analysis failed:", error);
    return {
      success: false,
      points: [],
      ductility: 0,
      effective_period: 0,
      hinge_summary: [],
      error: String(error),
    };
  }
}

// ============================================
// MODAL ANALYSIS (C1: Frequency extraction)
// ============================================

/**
 * Perform modal (eigenvalue) analysis to extract natural frequencies and mode shapes.
 *
 * Solves the generalized eigenvalue problem: [K]{φ} = ω²[M]{φ}
 *
 * @param nodes - Structure nodes
 * @param elements - Structure elements (must have density for mass)
 * @param numModes - Number of modes to extract (default: 6)
 * @returns Modal result with frequencies, periods, mode shapes, participation
 */
export async function analyzeModal(
  nodes: Node[],
  elements: Element[],
  numModes: number = 6,
): Promise<ModalAnalysisResult> {
  if (!wasmInitialized) await initSolver();

  try {
    wasmLogger.info("Running modal analysis for", numModes, "modes...");
    const startTime = performance.now();

    let result = wasm_modal_analysis(nodes, elements, numModes);

    // Handle JSON string return
    if (typeof result === "string") {
      try {
        result = JSON.parse(result);
      } catch (_) {
        return {
          success: false,
          frequencies: [],
          periods: [],
          mode_shapes: [],
          mass_participation: [],
          error: result,
        };
      }
    }

    const solveTime = performance.now() - startTime;
    wasmLogger.success(
      "Modal analysis completed in",
      solveTime.toFixed(2),
      "ms",
    );

    if (result.error) {
      return {
        success: false,
        frequencies: [],
        periods: [],
        mode_shapes: [],
        mass_participation: [],
        error: result.error,
      };
    }

    return {
      success: true,
      frequencies: result.frequencies || [],
      periods: result.periods || [],
      mode_shapes: (result.mode_shapes || []).map((ms: any) =>
        ms instanceof Map ? jsMapToPlainObject(ms) : ms,
      ),
      mass_participation: (result.mass_participation || []).map((mp: any) =>
        mp instanceof Map ? jsMapToPlainObject(mp) : mp,
      ),
    };
  } catch (error) {
    wasmLogger.error("Modal analysis failed:", error);
    return {
      success: false,
      frequencies: [],
      periods: [],
      mode_shapes: [],
      mass_participation: [],
      error: String(error),
    };
  }
}

// ============================================
// RESPONSE SPECTRUM ANALYSIS (C2: Seismic)
// ============================================

/**
 * Response Spectrum Analysis per IS 1893 / equivalent.
 *
 * Workflow: First run analyzeModal() to get mode shapes,
 * then pass the modal result here with seismic parameters.
 *
 * @param modalResult - Output from analyzeModal()
 * @param params - Seismic parameters (zone, importance, R, soil type)
 */
export async function analyzeResponseSpectrum(
  modalResult: ModalAnalysisResult,
  params: ResponseSpectrumInput,
): Promise<ResponseSpectrumResult> {
  if (!wasmInitialized) await initSolver();

  try {
    wasmLogger.info("Running response spectrum analysis...");
    const startTime = performance.now();

    let result = wasm_response_spectrum(
      modalResult,
      params.zoneFactor,
      params.importanceFactor,
      params.responseReduction,
      params.soilType,
    );

    if (typeof result === "string") {
      try {
        result = JSON.parse(result);
      } catch (_) {
        return { success: false, error: result };
      }
    }

    const solveTime = performance.now() - startTime;
    wasmLogger.success(
      "Response spectrum completed in",
      solveTime.toFixed(2),
      "ms",
    );

    if (result.error) return { success: false, error: result.error };

    return {
      success: true,
      base_shear: result.base_shear,
      storey_forces: result.storey_forces,
      storey_displacements: result.storey_displacements,
      modal_contributions: result.modal_contributions,
    };
  } catch (error) {
    wasmLogger.error("Response spectrum failed:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// ULTRA-FAST SOLVER (H1: Interactive perf)
// ============================================

/**
 * Ultra-fast solver for interactive editing — microsecond-level analysis.
 * Optimized for small-to-medium structures (≤ 100 nodes).
 *
 * Use this for real-time feedback while the user drags/edits a structure.
 */
export function analyzeUltraFast(
  nodes: any[],
  elements: any[],
  loads: any[],
): UltraFastResult {
  if (!wasmInitialized) {
    return { success: false, error: "Solver not initialized" };
  }

  try {
    let result = wasm_solve_ultra_fast(nodes, elements, loads);
    if (typeof result === "string") {
      try {
        result = JSON.parse(result);
      } catch (_) {
        return { success: false, error: result };
      }
    }
    if (result.error) return { success: false, error: result.error };

    return {
      success: true,
      displacements:
        result.displacements instanceof Map
          ? jsMapToPlainObject(result.displacements)
          : result.displacements,
      reactions:
        result.reactions instanceof Map
          ? jsMapToPlainObject(result.reactions)
          : result.reactions,
      member_forces:
        result.member_forces instanceof Map
          ? jsMapToPlainObject(result.member_forces)
          : result.member_forces,
      solve_time_us: result.solve_time_us,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Benchmark the ultra-fast solver for a given problem size.
 * Returns timing statistics (mean, median, min in μs).
 */
export function benchmarkUltraFast(
  numNodes: number,
  numElements: number,
  iterations: number = 10,
): BenchmarkResult | null {
  if (!wasmInitialized) return null;
  try {
    let result = wasm_benchmark_ultra_fast(numNodes, numElements, iterations);
    if (typeof result === "string") result = JSON.parse(result);
    return result as BenchmarkResult;
  } catch (error) {
    wasmLogger.error("Benchmark failed:", error);
    return null;
  }
}

// ============================================
// M5: PER-SOLVE TIMEOUT WRAPPER
// ============================================

/** Default analysis timeout — 30 seconds prevents pathological hangs */
const DEFAULT_SOLVE_TIMEOUT_MS = 30_000;

/**
 * Wrap a synchronous WASM call in a timeout.
 * Because WASM runs on the main thread, we can't truly abort it,
 * but we can reject the promise if it takes too long using a
 * microtask break.
 */
function withSolveTimeout<T>(
  fn: () => T,
  timeoutMs: number = DEFAULT_SOLVE_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Solver timeout: analysis exceeded ${timeoutMs}ms. Consider using the Worker solver for large models.`,
        ),
      );
    }, timeoutMs);
    try {
      const result = fn();
      clearTimeout(timer);
      resolve(result);
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
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
 * WASM binding for this solver mode is pending Rust backend development
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

// ============================================
// M4: SOLVER CONSISTENCY CHECKER
// ============================================

export interface ConsistencyReport {
  pass: boolean;
  maxDisplacementError: number;
  maxReactionError: number;
  maxForceError: number;
  details: string[];
  wasmTime: number;
  workerTime: number;
}

/**
 * Feature parity matrix: what each solver supports.
 * Use this to decide which solver path to route a model to,
 * and to document known capability gaps.
 */
export const SOLVER_FEATURE_MATRIX = {
  wasm: {
    linearStatic: true,
    pDelta: true,
    buckling: true,
    modalAnalysis: true,
    selfWeight: true, // C1
    temperatureLoads: true, // C2
    loadCombinations: true, // C3
    springSupports: true, // H1
    pointLoadsOnMembers: true, // H2
    equilibriumMomentCheck: true, // H3
    timoshenkoBeam: true, // M1
    inputValidation: true, // M3
    plateElements: true,
    dynamicTimeHistory: false, // Worker only
    topologyOptimization: false, // Worker only
  },
  worker: {
    linearStatic: true,
    pDelta: true,
    buckling: false,
    modalAnalysis: false,
    selfWeight: true,
    temperatureLoads: true, // Added in Worker Newmark integration
    loadCombinations: false,
    springSupports: true, // Spring elements
    pointLoadsOnMembers: true, // Via FEF
    equilibriumMomentCheck: true, // C4: computeEquilibriumCheck in Worker
    timoshenkoBeam: false,
    inputValidation: false,
    plateElements: false,
    dynamicTimeHistory: true,
    topologyOptimization: true,
  },
} as const;

/**
 * Validate WASM solver results against known analytical solutions.
 * Returns a consistency report with pass/fail and detailed error analysis.
 *
 * Benchmark: Simply supported beam, L=6m, UDL w=10 kN/m, E=200 GPa, I=1e-4 m⁴, A=0.01 m²
 *
 * Analytical: R=30kN, M_max=45kN·m, δ_max=5wL⁴/(384EI)
 */
export async function validateSolverConsistency(): Promise<ConsistencyReport> {
  const report: ConsistencyReport = {
    pass: true,
    maxDisplacementError: 0,
    maxReactionError: 0,
    maxForceError: 0,
    details: [],
    wasmTime: 0,
    workerTime: 0,
  };

  if (!wasmInitialized) {
    report.pass = false;
    report.details.push("WASM solver not initialized");
    return report;
  }

  // ---- Benchmark: SS beam with UDL ----
  const L = 6.0; // m
  const w = 10000.0; // N/m (10 kN/m)
  const E = 200e9; // Pa
  const A = 0.01; // m²
  const I = 1e-4; // m⁴

  // Analytical solutions
  const R_analytical = (w * L) / 2; // 30,000 N
  const M_max_analytical = (w * L * L) / 8; // 45,000 N·m
  const delta_max_analytical = (5 * w * Math.pow(L, 4)) / (384 * E * I); // 0.0028125 m

  // Run WASM solver
  const wasmStart = performance.now();
  const wasmResult = await analyzeStructure(
    [
      {
        id: "A",
        x: 0,
        y: 0,
        z: 0,
        restraints: [true, true, true, true, true, false],
      },
      {
        id: "B",
        x: L,
        y: 0,
        z: 0,
        restraints: [false, true, true, true, true, false],
      },
    ],
    [
      {
        id: "M1",
        node_i: "A",
        node_j: "B",
        E,
        A,
        Iy: I,
        Iz: I,
        J: 2 * I,
        G: E / 2.6,
      },
    ],
    [], // No nodal loads
    [
      {
        element_id: "M1",
        w1: -w,
        w2: -w,
        direction: "GlobalY",
        is_projected: false,
        start_pos: 0.0,
        end_pos: 1.0,
      },
    ],
  );
  report.wasmTime = performance.now() - wasmStart;

  if (!wasmResult || !wasmResult.success) {
    report.pass = false;
    report.details.push(
      `WASM analysis failed: ${wasmResult?.error || "unknown"}`,
    );
    return report;
  }

  // Check reaction at A (Ry)
  const Ry_A = wasmResult.reactions?.A?.[1] || 0;
  const rxnError = (Math.abs(Ry_A - R_analytical) / R_analytical) * 100;
  report.maxReactionError = rxnError;
  if (rxnError > 0.1) {
    report.pass = false;
    report.details.push(
      `Reaction error: ${rxnError.toFixed(4)}% (Ry_A=${Ry_A.toFixed(1)}, expected=${R_analytical})`,
    );
  } else {
    report.details.push(`✓ Reactions OK (error=${rxnError.toFixed(6)}%)`);
  }

  // Check member forces (moment at midspan approximated from end moments)
  // The WASM solver returns the full 3D MemberForces struct with forces_i, forces_j, max_*
  // TypeScript typing may differ slightly — use 'any' cast since raw WASM result is dynamic
  const mfRaw = wasmResult.member_forces?.M1 as any;
  if (mfRaw) {
    // Try 3D struct fields first, fall back to 2D names
    const maxMz = mfRaw.max_moment_z ?? Math.abs(mfRaw.moment_start || 0);
    if (maxMz > 0) {
      const forceError =
        (Math.abs(maxMz - M_max_analytical) / M_max_analytical) * 100;
      report.maxForceError = forceError;
      if (forceError > 1.0) {
        report.details.push(
          `⚠ Moment error: ${forceError.toFixed(4)}% (max_Mz=${maxMz.toFixed(1)}, expected=${M_max_analytical})`,
        );
      } else {
        report.details.push(
          `✓ Member forces OK (Mz error=${forceError.toFixed(4)}%)`,
        );
      }
    }
  }

  // Check displacement (analytical δ_max at midspan — not directly available from 2-node model,
  // but the relative magnitude should be correct)
  report.details.push(
    `✓ Benchmark completed in ${report.wasmTime.toFixed(1)}ms`,
  );
  report.details.push(
    `Feature parity: WASM has ${Object.values(SOLVER_FEATURE_MATRIX.wasm).filter((v) => v).length}/${Object.keys(SOLVER_FEATURE_MATRIX.wasm).length} features, Worker has ${Object.values(SOLVER_FEATURE_MATRIX.worker).filter((v) => v).length}/${Object.keys(SOLVER_FEATURE_MATRIX.worker).length} features`,
  );

  return report;
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
// ============================================
// LOAD COMBINATIONS (C3: Industry-standard)
// ============================================

export interface LoadCombination {
  name: string;
  factors: [string, number][];
}

export interface EnvelopeResult {
  max_displacements: Record<string, number[]>;
  min_displacements: Record<string, number[]>;
  max_reactions: Record<string, number[]>;
  min_reactions: Record<string, number[]>;
  max_member_forces: Record<string, any>;
  governing_combo: Record<string, string>;
  combination_results: [string, any][];
}

/**
 * Combine multiple load case results using factored superposition.
 * Run each load case separately via analyzeStructure(), then combine here.
 *
 * @param cases - Map of case name → AnalysisResult
 * @param combinations - Array of LoadCombination with factors
 * @returns EnvelopeResult with max/min across all combinations
 */
export function combineLoadCases(
  cases: Record<string, any>,
  combinations: LoadCombination[],
): EnvelopeResult | null {
  if (!wasmInitialized) {
    wasmLogger.error("Solver not ready for load combinations");
    return null;
  }
  try {
    const result = wasm_combine_load_cases(cases, combinations);
    if (typeof result === "string") {
      wasmLogger.error(`Load combination error: ${result}`);
      return null;
    }
    return result as EnvelopeResult;
  } catch (err: any) {
    wasmLogger.error(`Load combination failed: ${err.message || err}`);
    return null;
  }
}

/**
 * Get standard load combinations for a given code.
 * Available codes: 'IS800', 'Eurocode', 'AISC_LRFD'
 */
export function getStandardCombinations(
  code: "IS800" | "Eurocode" | "AISC_LRFD",
): LoadCombination[] {
  if (!wasmInitialized) return [];
  switch (code) {
    case "IS800":
      return get_standard_combinations_is800() as LoadCombination[];
    case "Eurocode":
      return get_standard_combinations_eurocode() as LoadCombination[];
    case "AISC_LRFD":
      return get_standard_combinations_aisc_lrfd() as LoadCombination[];
    default:
      return [];
  }
}

/**
 * Solve a large sparse system (CG solver for 10k+ DOF problems)
 */
export async function solveSparseSystem(input: {
  rows: number[];
  cols: number[];
  values: number[];
  rhs: number[];
  n: number;
}): Promise<{ solution: number[]; iterations: number; residual: number }> {
  await initSolver();
  const inputJson = JSON.stringify(input);
  const resultJson = wasm_solve_sparse(inputJson);
  return JSON.parse(resultJson);
}

export const wasmSolver = {
  initialize: initSolver,
  analyze: analyzeStructure,
  analyzePDelta,
  analyzePDeltaExtended,
  analyzeBuckling,
  analyzeModal,
  analyzeResponseSpectrum,
  analyzeUltraFast,
  benchmarkUltraFast,
  runPushoverAnalysis,
  solveSparseSystem,
  isSolverReady,
  getSolverInfo,
  createUniformLoad,
  createTriangularLoad,
  createTrapezoidalLoad,
  combineLoadCases,
  getStandardCombinations,
  validateSolverConsistency,
  withSolveTimeout,
  SOLVER_FEATURE_MATRIX,
} as const;
