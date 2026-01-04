/**
 * AI Architect WASM Solver Service
 * 
 * This service provides a bridge between the React frontend and the Rust WASM solver.
 * It handles loading the WASM module and calling solver functions.
 */

import init, { solve_structure_wasm, set_panic_hook } from 'solver-wasm';

export interface Node {
    id: number;
    x: number;
    y: number;
    fixed: [boolean, boolean, boolean]; // [dx, dy, rotation]
}

export interface Element {
    id: number;
    node_start: number;
    node_end: number;
    e: number; // Young's Modulus (Pa)
    i: number; // Moment of Inertia (m^4)
    a: number; // Cross-sectional Area (m^2)
}

export interface AnalysisResult {
    displacements: Record<number, [number, number, number]>;
    success: boolean;
    error?: string;
}

let wasmInitialized = false;
let webGpuAvailable: boolean | null = null;

function detectWebGpuSupport(): boolean {
    if (webGpuAvailable !== null) return webGpuAvailable;
    const hasWebGpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
    if (!hasWebGpu) {
        console.warn('[AI Architect] WebGPU not available; will use backend fallback');
    }
    webGpuAvailable = hasWebGpu;
    return hasWebGpu;
}

/**
 * Initialize the WASM module. Call this once before using other functions.
 */
export async function initSolver(): Promise<void> {
    if (wasmInitialized) return;

    if (!detectWebGpuSupport()) {
        throw new Error('WebGPU not available in this browser');
    }

    try {
        await init();
        set_panic_hook();
        wasmInitialized = true;
        console.log('[AI Architect] WASM Solver initialized successfully');
    } catch (error) {
        console.error('[AI Architect] Failed to initialize WASM Solver:', error);
        throw error;
    }
}

/**
 * Analyze a structure using the Direct Stiffness Method.
 * 
 * @param nodes - Array of nodes with coordinates and boundary conditions
 * @param elements - Array of beam elements connecting nodes
 * @returns Analysis results with node displacements
 */
export async function analyzeStructure(
    nodes: Node[],
    elements: Element[]
): Promise<AnalysisResult> {
    if (!wasmInitialized) {
        // If WebGPU is missing, fail fast so caller can route to backend solver
        await initSolver();
    }

    try {
        const result = solve_structure_wasm(nodes, elements);

        if (typeof result === 'string') {
            // Error message returned
            return {
                displacements: {},
                success: false,
                error: result
            };
        }

        return result as AnalysisResult;
    } catch (error) {
        console.error('[AI Architect] Analysis failed:', error);
        return {
            displacements: {},
            success: false,
            error: String(error)
        };
    }
}

/**
 * Check if WASM solver is initialized
 */
export function isSolverReady(): boolean {
    return wasmInitialized;
}

export function isWebGpuReady(): boolean {
    return detectWebGpuSupport();
}

/**
 * Get solver version information
 */
export function getSolverInfo(): { version: string; backend: string } {
    return {
        version: '1.0.0',
        backend: 'Rust/WASM (nalgebra)'
    };
}
