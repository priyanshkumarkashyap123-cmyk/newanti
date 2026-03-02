/* tslint:disable */
/* eslint-disable */

export class AIArchitect {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  static suggest_beam_size(span: number, load: number): string;
  static new(): AIArchitect;
}

export class MacnealHarderWasm {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  static get_quad4_patch(): any;
  static generate_twisted_beam(n_elem: number): any;
}

export class Renderer {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Create a new renderer stub
   */
  constructor(_canvas: HTMLCanvasElement);
  /**
   * Clear canvas stub - no-op
   */
  clear(): void;
  /**
   * Get canvas width
   */
  width(): number;
  /**
   * Get canvas height
   */
  height(): number;
  /**
   * Render frame stub - no-op
   */
  render(): void;
  /**
   * Resize stub - no-op
   */
  resize(width: number, height: number): void;
}

export class WasmHHTIntegrator {
  free(): void;
  [Symbol.dispose](): void;
  set_initial(u0: Float64Array, v0: Float64Array): void;
  get_velocity(): Float64Array;
  get_acceleration(): Float64Array;
  get_displacement(): Float64Array;
  constructor(alpha: number, mass: Float64Array, damping: Float64Array, stiffness: Float64Array, dt: number);
  step(force: Float64Array): any;
  get_time(): number;
}

export class WasmSparseMatrix {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Get memory usage stats
   */
  memory_usage(): number;
  /**
   * Create from triplets (row, col, value)
   * Expects triplets as a flat array [r0, c0, v0, r1, c1, v1, ...]
   */
  constructor(nrows: number, ncols: number, triplets_flat: Float64Array);
  /**
   * Sparse matrix-vector multiplication (y = A*x)
   */
  spmv(x: Float64Array): Float64Array;
}

/**
 * Linearized buckling analysis — eigenvalue problem [Ke]{φ} = λ[-Kg]{φ}
 * Returns critical load factors where P_cr = λ × P_applied
 */
export function analyze_buckling(nodes_val: any, elements_val: any, point_loads_val: any, num_modes: number): any;

/**
 * Benchmark the ultra-fast solver
 * Returns timing statistics for different problem sizes
 */
export function benchmark_ultra_fast(num_nodes: number, num_elements: number, iterations: number): any;

export function calculate_aisc_capacity(d: number, bf: number, tw: number, tf: number, rx: number, ry: number, zx: number, zy: number, sx: number, sy: number, j: number, cw: number, ag: number, fy: number, E: number, lb: number, lc_x: number, lc_y: number, cb: number): any;

export function calculate_beam_capacity(b: number, d: number, fck: number, fy: number, ast: number): number;

export function calculate_seismic_base_shear(zone: number, importance: number, r_factor: number, period: number, soil: number, weight: number): number;

/**
 * Combine multiple load case results using factored superposition.
 * `cases_val`: JSON map { caseName: AnalysisResult3D }
 * `combinations_val`: JSON array of LoadCombination objects
 * Returns an EnvelopeResult with max/min across all combinations.
 */
export function combine_load_cases(cases_val: any, combinations_val: any): any;

export function create_bilinear_hysteresis(k0: number, fy: number, alpha: number): Float64Array;

export function create_out_of_core_matrix(ndof: number, block_size: number, max_memory_mb: number): string;

export function estimate_solve_requirements(ndof: number, avg_nnz_per_row: number): string;

export function get_available_hysteresis_models(): string[];

/**
 * Get solver version and capabilities
 */
export function get_solver_info(): string;

/**
 * Get standard AISC LRFD load combinations
 */
export function get_standard_combinations_aisc_lrfd(): any;

/**
 * Get standard Eurocode load combinations
 */
export function get_standard_combinations_eurocode(): any;

/**
 * Get standard IS 800 load combinations
 */
export function get_standard_combinations_is800(): any;

/**
 * Modal analysis for dynamic properties
 */
export function modal_analysis(nodes_val: any, elements_val: any, num_modes: number): any;

/**
 * Run ALL NAFEMS benchmark tests and return comprehensive results.
 * Returns JSON with pass/fail for every benchmark across all categories.
 */
export function run_nafems_all_benchmarks(): any;

/**
 * Run only the Contact (IC) NAFEMS benchmarks
 */
export function run_nafems_contact_benchmarks(): any;

/**
 * Run only the Free Vibration (FV) NAFEMS benchmarks
 */
export function run_nafems_fv_benchmarks(): any;

/**
 * Run only the Linear Elastic (LE) NAFEMS benchmarks
 */
export function run_nafems_le_benchmarks(): any;

/**
 * Run only the Nonlinear (NL) NAFEMS benchmarks
 */
export function run_nafems_nl_benchmarks(): any;

/**
 * Run only the Thermal (T) NAFEMS benchmarks
 */
export function run_nafems_thermal_benchmarks(): any;

export function set_panic_hook(): void;

export function simulate_hysteresis_response(model: string, k0: number, fy: number, alpha: number, strain_history: Float64Array): Float64Array;

/**
 * 2D Frame analysis WITH nodal loads
 * This is the recommended function for 2D analysis with applied loads
 */
export function solve_2d_frame_with_loads(nodes_val: any, elements_val: any, loads_val: any): any;

/**
 * 3D Frame analysis (new advanced solver)
 * Accepts nodes, elements, nodal loads, distributed loads, and optional extended parameters
 */
export function solve_3d_frame(nodes_val: any, elements_val: any, nodal_loads_val: any, distributed_loads_val: any): any;

/**
 * Extended 3D Frame analysis with temperature loads, point loads, and config
 */
export function solve_3d_frame_extended(nodes_val: any, elements_val: any, nodal_loads_val: any, distributed_loads_val: any, temperature_loads_val: any, point_loads_val: any, config_val: any): any;

/**
 * P-Delta analysis - iterative geometric nonlinear analysis
 * Accounts for secondary moments from axial loads (P) acting on lateral displacements (Δ).
 * Backward-compatible wrapper — delegates to solve_p_delta_extended with empty optional loads.
 */
export function solve_p_delta(nodes_val: any, elements_val: any, point_loads_val: any, member_loads_val: any, max_iterations: number, tolerance: number): any;

/**
 * Extended P-Delta analysis with temperature loads, point loads on members, and config.
 */
export function solve_p_delta_extended(nodes_val: any, elements_val: any, point_loads_val: any, member_loads_val: any, temperature_loads_val: any, point_loads_on_members_val: any, config_val: any, max_iterations: number, tolerance: number): any;

/**
 * Nonlinear static pushover analysis — capacity curve generation
 * Returns base shear vs. roof displacement with hinge states
 */
export function solve_pushover(input_val: any): any;

/**
 * Response Spectrum Analysis (Seismic)
 */
export function solve_response_spectrum(modal_result_val: any, zone_factor: number, importance_factor: number, response_reduction: number, soil_type: number): any;

/**
 * Solve sparse system using Conjugate Gradient
 * This handles large structures (e.g. 10k+ nodes) without OOM.
 */
export function solve_sparse_system_json(input_json: string): string;

/**
 * 2D Frame analysis (backward compatible - no loads)
 */
export function solve_structure_wasm(nodes_val: any, elements_val: any): any;

/**
 * Solve a linear system K * u = F using LU decomposition
 * Backported from legacy solver-wasm for compatibility with StructuralSolverWorker
 */
export function solve_system(stiffness_array: Float64Array, force_array: Float64Array, dof: number): Float64Array;

/**
 * Ultra-fast 3D frame analysis with performance metrics
 * Returns microsecond-level analysis times for small-medium structures
 */
export function solve_ultra_fast(nodes_val: any, elements_val: any, loads_val: any): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_aiarchitect_free: (a: number, b: number) => void;
  readonly __wbg_renderer_free: (a: number, b: number) => void;
  readonly __wbg_wasmhhtintegrator_free: (a: number, b: number) => void;
  readonly __wbg_wasmsparsematrix_free: (a: number, b: number) => void;
  readonly aiarchitect_suggest_beam_size: (a: number, b: number, c: number) => void;
  readonly analyze_buckling: (a: number, b: number, c: number, d: number) => number;
  readonly benchmark_ultra_fast: (a: number, b: number, c: number) => number;
  readonly calculate_aisc_capacity: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number) => number;
  readonly calculate_beam_capacity: (a: number, b: number, c: number, d: number, e: number) => number;
  readonly calculate_seismic_base_shear: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly combine_load_cases: (a: number, b: number) => number;
  readonly create_bilinear_hysteresis: (a: number, b: number, c: number, d: number) => void;
  readonly create_out_of_core_matrix: (a: number, b: number, c: number, d: number) => void;
  readonly estimate_solve_requirements: (a: number, b: number, c: number) => void;
  readonly get_available_hysteresis_models: (a: number) => void;
  readonly get_solver_info: (a: number) => void;
  readonly get_standard_combinations_aisc_lrfd: () => number;
  readonly get_standard_combinations_eurocode: () => number;
  readonly get_standard_combinations_is800: () => number;
  readonly macnealharderwasm_generate_twisted_beam: (a: number) => number;
  readonly macnealharderwasm_get_quad4_patch: () => number;
  readonly modal_analysis: (a: number, b: number, c: number) => number;
  readonly renderer_clear: (a: number, b: number) => void;
  readonly renderer_height: (a: number) => number;
  readonly renderer_new: (a: number, b: number) => void;
  readonly renderer_resize: (a: number, b: number, c: number) => void;
  readonly renderer_width: (a: number) => number;
  readonly run_nafems_all_benchmarks: () => number;
  readonly run_nafems_contact_benchmarks: () => number;
  readonly run_nafems_fv_benchmarks: () => number;
  readonly run_nafems_le_benchmarks: () => number;
  readonly run_nafems_nl_benchmarks: () => number;
  readonly run_nafems_thermal_benchmarks: () => number;
  readonly simulate_hysteresis_response: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
  readonly solve_2d_frame_with_loads: (a: number, b: number, c: number) => number;
  readonly solve_3d_frame_extended: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
  readonly solve_p_delta_extended: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => number;
  readonly solve_pushover: (a: number) => number;
  readonly solve_response_spectrum: (a: number, b: number, c: number, d: number, e: number) => number;
  readonly solve_sparse_system_json: (a: number, b: number, c: number) => void;
  readonly solve_structure_wasm: (a: number, b: number) => number;
  readonly solve_system: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly solve_ultra_fast: (a: number, b: number, c: number) => number;
  readonly wasmhhtintegrator_get_acceleration: (a: number, b: number) => void;
  readonly wasmhhtintegrator_get_displacement: (a: number, b: number) => void;
  readonly wasmhhtintegrator_get_time: (a: number) => number;
  readonly wasmhhtintegrator_get_velocity: (a: number, b: number) => void;
  readonly wasmhhtintegrator_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
  readonly wasmhhtintegrator_set_initial: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmhhtintegrator_step: (a: number, b: number, c: number, d: number) => void;
  readonly wasmsparsematrix_memory_usage: (a: number) => number;
  readonly wasmsparsematrix_new: (a: number, b: number, c: number, d: number) => number;
  readonly wasmsparsematrix_spmv: (a: number, b: number, c: number, d: number) => void;
  readonly set_panic_hook: () => void;
  readonly solve_p_delta: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly solve_3d_frame: (a: number, b: number, c: number, d: number) => number;
  readonly renderer_render: (a: number, b: number) => void;
  readonly __wbg_macnealharderwasm_free: (a: number, b: number) => void;
  readonly aiarchitect_new: () => number;
  readonly __wbindgen_export: (a: number, b: number) => number;
  readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export3: (a: number) => void;
  readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
