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
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  static new(canvas: HTMLCanvasElement): Promise<Renderer>;
  render(): void;
  resize(width: number, height: number): void;
}

export function calculate_beam_capacity(b: number, d: number, fck: number, fy: number, ast: number): number;

export function calculate_seismic_base_shear(zone: number, importance: number, r_factor: number, period: number, soil: number, weight: number): number;

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
  readonly __wbg_renderer_free: (a: number, b: number) => void;
  readonly renderer_new: (a: any) => any;
  readonly renderer_render: (a: number) => [number, number];
  readonly renderer_resize: (a: number, b: number, c: number) => void;
  readonly calculate_beam_capacity: (a: number, b: number, c: number, d: number, e: number) => number;
  readonly calculate_seismic_base_shear: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly modal_analysis: (a: any, b: any, c: number) => any;
  readonly solve_3d_frame: (a: any, b: any, c: any, d: any) => any;
  readonly solve_structure_wasm: (a: any, b: any) => any;
  readonly solve_system: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
  readonly set_panic_hook: () => void;
  readonly __wbg_aiarchitect_free: (a: number, b: number) => void;
  readonly aiarchitect_suggest_beam_size: (a: number, b: number) => [number, number];
  readonly aiarchitect_new: () => number;
  readonly wasm_bindgen__convert__closures_____invoke__he8f385b6a6d9f55c: (a: number, b: number, c: any) => void;
  readonly wasm_bindgen__closure__destroy__h5c9d28f7c75ac88f: (a: number, b: number) => void;
  readonly wasm_bindgen__convert__closures_____invoke__h1057b88e8295d0b8: (a: number, b: number, c: any) => void;
  readonly wasm_bindgen__closure__destroy__hf9bdda0f49fbdd02: (a: number, b: number) => void;
  readonly wasm_bindgen__convert__closures_____invoke__h201191e8bc17cbcd: (a: number, b: number, c: any, d: any) => void;
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
