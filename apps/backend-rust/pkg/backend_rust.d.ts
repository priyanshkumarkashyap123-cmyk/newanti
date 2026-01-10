/* tslint:disable */
/* eslint-disable */

export class AIArchitect {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  static suggest_beam_size(span: number, load: number): string;
  static new(): AIArchitect;
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

/**
 * Buckling analysis (stub for backward compatibility)
 */
export function analyze_buckling(_nodes_val: any, _elements_val: any, _point_loads_val: any, _num_modes: number): any;

export function calculate_aisc_capacity(d: number, bf: number, tw: number, tf: number, rx: number, ry: number, zx: number, zy: number, sx: number, sy: number, j: number, cw: number, ag: number, fy: number, E: number, lb: number, lc_x: number, lc_y: number, cb: number): any;

export function calculate_beam_capacity(b: number, d: number, fck: number, fy: number, ast: number): number;

export function calculate_seismic_base_shear(zone: number, importance: number, r_factor: number, period: number, soil: number, weight: number): number;

/**
 * Get solver version and capabilities
 */
export function get_solver_info(): string;

/**
 * Modal analysis for dynamic properties
 */
export function modal_analysis(nodes_val: any, elements_val: any, num_modes: number): any;

export function set_panic_hook(): void;

/**
 * 3D Frame analysis (new advanced solver)
 */
export function solve_3d_frame(nodes_val: any, elements_val: any, nodal_loads_val: any, distributed_loads_val: any): any;

/**
 * P-Delta analysis (stub for backward compatibility)
 */
export function solve_p_delta(_nodes_val: any, _elements_val: any, _point_loads_val: any, _member_loads_val: any, _max_iterations: number, _tolerance: number): any;

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
 * 2D Frame analysis (backward compatible)
 */
export function solve_structure_wasm(nodes_val: any, elements_val: any): any;

/**
 * Solve a linear system K * u = F using LU decomposition
 * Backported from legacy solver-wasm for compatibility with StructuralSolverWorker
 */
export function solve_system(stiffness_array: Float64Array, force_array: Float64Array, dof: number): Float64Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_aiarchitect_free: (a: number, b: number) => void;
  readonly __wbg_renderer_free: (a: number, b: number) => void;
  readonly aiarchitect_suggest_beam_size: (a: number, b: number) => [number, number];
  readonly renderer_clear: (a: number) => [number, number];
  readonly renderer_height: (a: number) => number;
  readonly renderer_new: (a: any) => [number, number, number];
  readonly renderer_resize: (a: number, b: number, c: number) => void;
  readonly renderer_width: (a: number) => number;
  readonly renderer_render: (a: number) => [number, number];
  readonly aiarchitect_new: () => number;
  readonly calculate_aisc_capacity: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number) => any;
  readonly calculate_beam_capacity: (a: number, b: number, c: number, d: number, e: number) => number;
  readonly calculate_seismic_base_shear: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly get_solver_info: () => [number, number];
  readonly modal_analysis: (a: any, b: any, c: number) => any;
  readonly solve_3d_frame: (a: any, b: any, c: any, d: any) => any;
  readonly solve_response_spectrum: (a: any, b: number, c: number, d: number, e: number) => any;
  readonly solve_sparse_system_json: (a: number, b: number) => [number, number];
  readonly solve_structure_wasm: (a: any, b: any) => any;
  readonly solve_system: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
  readonly analyze_buckling: (a: any, b: any, c: any, d: number) => any;
  readonly set_panic_hook: () => void;
  readonly solve_p_delta: (a: any, b: any, c: any, d: any, e: number, f: number) => any;
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
