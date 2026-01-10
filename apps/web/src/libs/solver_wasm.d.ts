/**
 * Type declarations for solver_wasm module
 */

// Make this a module
export {};

declare module '*.js' {
    const content: any;
    export default content;
}

declare module './solver_wasm.js' {
    export interface SolverResult {
        success: boolean;
        displacements?: Float64Array;
        solve_time_ms?: number;
        iterations?: number;
        residual?: number;
        method?: string;
        error?: string;
    }

    export function solve_sparse_csr(
        rowPtr: Uint32Array,
        colIndices: Uint32Array,
        values: Float64Array,
        rhs: Float64Array,
        size: number
    ): SolverResult;

    export function solve_sparse_coo(
        rows: Uint32Array,
        cols: Uint32Array,
        values: Float64Array,
        rhs: Float64Array,
        size: number
    ): SolverResult;

    export function solve_sparse_system_json(inputJson: string): string;

    export function init(): void;

    const initWasm: () => Promise<void>;
    export default initWasm;
}

// Extend Navigator for WebGPU
declare global {
    interface Navigator {
        gpu?: GPU;
    }
}
