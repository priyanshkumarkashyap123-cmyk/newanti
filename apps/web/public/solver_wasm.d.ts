/* tslint:disable */
/* eslint-disable */

export class AIArchitect {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  static suggest_beam_size(span: number, load: number): string;
  static new(): AIArchitect;
}

export class GpuContext {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Check if WebGPU is available
   * Note: Full WebGPU detection requires JavaScript interop
   */
  is_available(): boolean;
  get_dot_shader(): string;
  get_axpy_shader(): string;
  /**
   * Get all shader source code
   */
  get_spmv_shader(): string;
  get_jacobi_shader(): string;
  get_cg_update_shader(): string;
  /**
   * Create new GPU context
   */
  constructor();
}

export class GpuSolverConfig {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Create high-accuracy configuration
   */
  static high_accuracy(): GpuSolverConfig;
  /**
   * Create default configuration
   */
  constructor();
  /**
   * Create fast configuration (trades accuracy for speed)
   */
  static fast(): GpuSolverConfig;
  /**
   * Workgroup size (typically 256)
   */
  workgroup_size: number;
  /**
   * Maximum iterations
   */
  max_iterations: number;
  /**
   * Convergence tolerance
   */
  tolerance: number;
  /**
   * Use single precision (f32) for speed
   */
  use_single_precision: boolean;
  /**
   * Use async GPU operations
   */
  use_async: boolean;
}

export class Renderer {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Create stub renderer
   */
  constructor(_canvas: HTMLCanvasElement);
  /**
   * Render stub
   */
  render(): void;
  /**
   * Resize stub
   */
  resize(width: number, height: number): void;
}

export class UltraSolver {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Set tolerance
   */
  set_tolerance(tol: number): void;
  /**
   * Create new solver with default settings
   */
  constructor();
  /**
   * Solve large sparse system
   * Input: CSR format arrays
   * Returns: JSON with displacements and performance info
   */
  solve(row_ptrs: Uint32Array, col_indices: Uint32Array, values: Float64Array, forces: Float64Array, size: number): string;
}

/**
 * Buckling analysis - eigenvalue problem to find critical loads
 * Solves: [K_e - λ*K_g]{φ} = 0
 */
export function analyze_buckling(nodes_json: any, elements_json: any, point_loads_json: any, num_modes: number): any;

/**
 * Calculate number of workgroups needed
 */
export function calculate_workgroups(n: number, workgroup_size: number): number;

/**
 * Check if matrix is well-conditioned
 */
export function check_matrix_condition(stiffness_array: Float64Array, dof: number): string;

/**
 * Compute eigenvalues and eigenvectors for modal analysis
 * Returns JSON with eigenvalues (natural frequencies) and mode shapes
 */
export function compute_eigenvalues(stiffness_array: Float64Array, mass_array: Float64Array, dof: number, num_modes: number): string;

/**
 * Get solver version and capabilities
 */
export function get_solver_info(): string;

/**
 * Initialize panic hook for better error messages in browser console
 */
export function init(): void;

/**
 * Quick demo: train and predict with defaults
 */
export function pinn_demo(): string;

/**
 * P-Delta analysis with second-order effects
 * Iterative solution considering geometric nonlinearity
 */
export function solve_p_delta(nodes_json: any, elements_json: any, point_loads_json: any, member_loads_json: any, max_iterations?: number | null, tolerance?: number | null): any;

/**
 * Solve a sparse linear system using CG with direct TypedArray input and LU fallback
 * Avoids OOM issues with large JSON strings
 */
export function solve_sparse_system(row_indices: Uint32Array, col_indices: Uint32Array, values: Float64Array, forces: Float64Array, size: number): Float64Array;

/**
 * Solve a sparse linear system using CG (Conjugate Gradient) with LU fallback
 */
export function solve_sparse_system_json(input_json: string): string;

/**
 * Solve a frame structure using Direct Stiffness Method
 * Takes nodes, elements, and loads, returns displacements, reactions, and member forces
 */
export function solve_structure_wasm(nodes_json: any, elements_json: any, point_loads_json: any, member_loads_json: any): any;

/**
 * Solve a linear system K * u = F using LU decomposition
 *
 * # Arguments
 * * `stiffness_array` - Flattened stiffness matrix (row-major)
 * * `force_array` - Force vector
 * * `dof` - Number of degrees of freedom
 *
 * # Returns
 * * Displacement vector as Float64Array
 */
export function solve_system(stiffness_array: Float64Array, force_array: Float64Array, dof: number): Float64Array;

/**
 * Solve using Cholesky decomposition (faster for symmetric positive-definite matrices)
 */
export function solve_system_cholesky(stiffness_array: Float64Array, force_array: Float64Array, dof: number): Float64Array;

/**
 * Solve with full result information (JSON interface)
 */
export function solve_system_json(input_json: string): string;

/**
 * Convert COO format to CSR and solve
 * More convenient input format from JavaScript
 */
export function solve_ultra_coo(rows: Uint32Array, cols: Uint32Array, values: Float64Array, forces: Float64Array, size: number): string;

/**
 * Solve a massive sparse linear system
 * Designed for 100,000+ node civil engineering structures
 */
export function solve_ultra_sparse(row_ptrs: Uint32Array, col_indices: Uint32Array, values: Float64Array, forces: Float64Array, size: number): string;

/**
 * Train PINN and return model as JSON (for persistence)
 */
export function train_beam_pinn(config_json: string): string;

/**
 * WASM-exported axpy
 */
export function wasm_axpy(alpha: number, x: Float64Array, y: Float64Array): void;

/**
 * WASM-exported dot product
 */
export function wasm_dot(a: Float64Array, b: Float64Array): number;

/**
 * WASM-exported vector norm
 */
export function wasm_norm(a: Float64Array): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly analyze_buckling: (a: any, b: any, c: any, d: number) => any;
  readonly check_matrix_condition: (a: number, b: number, c: number) => [number, number];
  readonly compute_eigenvalues: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
  readonly get_solver_info: () => [number, number];
  readonly solve_p_delta: (a: any, b: any, c: any, d: any, e: number, f: number, g: number) => any;
  readonly solve_sparse_system: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number, number];
  readonly solve_sparse_system_json: (a: number, b: number) => [number, number];
  readonly solve_structure_wasm: (a: any, b: any, c: any, d: any) => any;
  readonly solve_system: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
  readonly solve_system_cholesky: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
  readonly solve_system_json: (a: number, b: number) => [number, number];
  readonly init: () => void;
  readonly __wbg_ultrasolver_free: (a: number, b: number) => void;
  readonly solve_ultra_coo: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number];
  readonly solve_ultra_sparse: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number];
  readonly ultrasolver_new: () => number;
  readonly ultrasolver_set_tolerance: (a: number, b: number) => void;
  readonly ultrasolver_solve: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number];
  readonly wasm_axpy: (a: number, b: number, c: number, d: number, e: number, f: any) => void;
  readonly wasm_dot: (a: number, b: number, c: number, d: number) => number;
  readonly wasm_norm: (a: number, b: number) => number;
  readonly __wbg_get_gpusolverconfig_max_iterations: (a: number) => number;
  readonly __wbg_get_gpusolverconfig_tolerance: (a: number) => number;
  readonly __wbg_get_gpusolverconfig_use_async: (a: number) => number;
  readonly __wbg_get_gpusolverconfig_use_single_precision: (a: number) => number;
  readonly __wbg_get_gpusolverconfig_workgroup_size: (a: number) => number;
  readonly __wbg_gpucontext_free: (a: number, b: number) => void;
  readonly __wbg_gpusolverconfig_free: (a: number, b: number) => void;
  readonly __wbg_renderer_free: (a: number, b: number) => void;
  readonly __wbg_set_gpusolverconfig_max_iterations: (a: number, b: number) => void;
  readonly __wbg_set_gpusolverconfig_tolerance: (a: number, b: number) => void;
  readonly __wbg_set_gpusolverconfig_use_async: (a: number, b: number) => void;
  readonly __wbg_set_gpusolverconfig_use_single_precision: (a: number, b: number) => void;
  readonly __wbg_set_gpusolverconfig_workgroup_size: (a: number, b: number) => void;
  readonly gpucontext_get_axpy_shader: (a: number) => [number, number];
  readonly gpucontext_get_cg_update_shader: (a: number) => [number, number];
  readonly gpucontext_get_dot_shader: (a: number) => [number, number];
  readonly gpucontext_get_jacobi_shader: (a: number) => [number, number];
  readonly gpucontext_get_spmv_shader: (a: number) => [number, number];
  readonly gpucontext_is_available: (a: number) => number;
  readonly gpucontext_new: () => number;
  readonly gpusolverconfig_fast: () => number;
  readonly gpusolverconfig_high_accuracy: () => number;
  readonly gpusolverconfig_new: () => number;
  readonly renderer_new: (a: any) => [number, number, number];
  readonly renderer_render: (a: number) => [number, number];
  readonly renderer_resize: (a: number, b: number, c: number) => void;
  readonly calculate_workgroups: (a: number, b: number) => number;
  readonly __wbg_aiarchitect_free: (a: number, b: number) => void;
  readonly aiarchitect_suggest_beam_size: (a: number, b: number) => [number, number];
  readonly pinn_demo: () => [number, number];
  readonly train_beam_pinn: (a: number, b: number) => [number, number];
  readonly aiarchitect_new: () => number;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
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
