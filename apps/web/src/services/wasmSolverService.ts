/**
 * BeamLab WASM Solver Service
 * 
 * Complete client-side structural analysis using Rust WASM.
 * Handles: Frame Analysis, P-Delta, Buckling Analysis
 * 
 * NO backend calls - everything runs in the browser!
 */

import init, {
    solve_structure_wasm,
    solve_3d_frame,
    solve_p_delta,
    analyze_buckling,
    get_solver_info
} from 'backend-rust';

// ============================================
// TYPE DEFINITIONS
// ============================================

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

export interface PointLoad {
    node: number;
    fx: number; // Force X (N)
    fy: number; // Force Y (N)
    mz: number; // Moment Z (N·m)
}

export type LoadDistribution = 'Uniform' | 'Triangular' | 'Trapezoidal';

export interface MemberLoad {
    element_id: number;
    distribution: LoadDistribution;
    w1: number;  // Load intensity at start (N/m)
    w2: number;  // Load intensity at end (N/m)
    direction: string; // "LocalY", "GlobalY", etc.
    start_pos?: number; // 0-1 ratio (default 0)
    end_pos?: number;   // 0-1 ratio (default 1)
    is_projected?: boolean; // For wind/snow loads
}

export interface Displacement {
    node: number;
    dx: number;
    dy: number;
    rz: number;
}

export interface Reaction {
    node: number;
    fx: number;
    fy: number;
    mz: number;
}

export interface MemberForce {
    element: number;
    end: 'start' | 'end';
    axial: number;
    shear: number;
    moment: number;
}

export interface AnalysisResult {
    displacements: Displacement[];
    reactions: Reaction[];
    member_forces: MemberForce[];
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
        console.log('[BeamLab] WASM Solver initialized successfully ✅');

        // Log solver capabilities
        try {
            const info = JSON.parse(get_solver_info());
            console.log('[BeamLab] Solver version:', info.version);
            console.log('[BeamLab] Capabilities:', info.capabilities);
        } catch (e) {
            console.log('[BeamLab] Solver info not available');
        }
    } catch (error) {
        console.error('[BeamLab] Failed to initialize WASM Solver:', error);
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
    memberLoads: MemberLoad[] = []
): Promise<AnalysisResult> {
    if (!wasmInitialized) {
        await initSolver();
    }

    try {
        console.log('[WASM] Analyzing structure:', nodes.length, 'nodes,', elements.length, 'elements');
        console.log('[WASM] Loads:', pointLoads.length, 'point loads,', memberLoads.length, 'member loads');

        const startTime = performance.now();

        // Call Rust WASM function - use solve_3d_frame for full 3D analysis with loads
        const result = solve_3d_frame(
            nodes,
            elements,
            pointLoads,
            memberLoads
        );

        const endTime = performance.now();
        const solveTime = endTime - startTime;

        console.log('[WASM] Analysis completed in', solveTime.toFixed(2), 'ms');

        if (result.error) {
            return {
                displacements: [],
                reactions: [],
                member_forces: [],
                success: false,
                error: result.error
            };
        }

        return {
            displacements: result.displacements || [],
            reactions: result.reactions || [],
            member_forces: result.member_forces || [],
            success: true,
            stats: {
                solveTimeMs: solveTime,
                method: 'Direct Stiffness Method'
            }
        };
    } catch (error) {
        console.error('[WASM] Analysis failed:', error);
        return {
            displacements: [],
            reactions: [],
            member_forces: [],
            success: false,
            error: String(error)
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
    tolerance: number = 1e-4
): Promise<PDeltaResult> {
    if (!wasmInitialized) {
        await initSolver();
    }

    try {
        console.log('[WASM] Running P-Delta analysis...');
        console.log('[WASM] Max iterations:', maxIterations, 'Tolerance:', tolerance);

        const startTime = performance.now();

        const result = solve_p_delta(
            nodes,
            elements,
            pointLoads,
            memberLoads,
            maxIterations,
            tolerance
        );

        const endTime = performance.now();
        const solveTime = endTime - startTime;

        console.log('[WASM] P-Delta completed in', solveTime.toFixed(2), 'ms');

        if (result.converged !== undefined) {
            console.log('[WASM] Converged:', result.converged, 'Iterations:', result.iterations);
        }

        if (result.error) {
            return {
                displacements: [],
                reactions: [],
                member_forces: [],
                success: false,
                converged: false,
                error: result.error
            };
        }

        return {
            displacements: result.displacements || [],
            reactions: result.reactions || [],
            member_forces: result.member_forces || [],
            success: true,
            converged: result.converged || false,
            iterations: result.iterations,
            stats: {
                solveTimeMs: solveTime,
                method: 'P-Delta (Newton-Raphson)'
            }
        };
    } catch (error) {
        console.error('[WASM] P-Delta analysis failed:', error);
        return {
            displacements: [],
            reactions: [],
            member_forces: [],
            success: false,
            converged: false,
            error: String(error)
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
    numModes: number = 5
): Promise<BucklingResult> {
    if (!wasmInitialized) {
        await initSolver();
    }

    try {
        console.log('[WASM] Running buckling analysis for', numModes, 'modes...');

        const startTime = performance.now();

        let result = analyze_buckling(
            nodes,
            elements,
            pointLoads,
            numModes
        );

        // Handle case where WASM returns JSON string instead of object (stub implementation)
        if (typeof result === 'string') {
            try {
                result = JSON.parse(result);
            } catch (e) {
                console.error('[WASM] Failed to parse buckling result:', e);
                return {
                    success: false,
                    buckling_loads: [],
                    error: 'Failed to parse buckling analysis result'
                };
            }
        }

        const endTime = performance.now();
        const solveTime = endTime - startTime;

        console.log('[WASM] Buckling analysis completed in', solveTime.toFixed(2), 'ms');

        if (result.error) {
            return {
                success: false,
                buckling_loads: [],
                error: result.error
            };
        }

        console.log('[WASM] Critical loads:', result.buckling_loads);

        return {
            success: true,
            buckling_loads: result.buckling_loads || [],
            modes: numModes
        };
    } catch (error) {
        console.error('[WASM] Buckling analysis failed:', error);
        return {
            success: false,
            buckling_loads: [],
            error: String(error)
        };
    }
}

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
                version: info.version || '1.0.0',
                capabilities: info.capabilities || []
            };
        }
    } catch (e) {
        console.warn('Failed to get solver info:', e);
    }

    return {
        version: '1.0.0',
        capabilities: [
            '2D frame analysis',
            'Direct stiffness method',
            'Triangular loads',
            'Trapezoidal loads',
            'P-Delta analysis',
            'Buckling analysis'
        ]
    };
}

/**
 * Create a simple uniform distributed load
 */
export function createUniformLoad(
    elementId: number,
    intensity: number,
    direction: string = 'LocalY'
): MemberLoad {
    return {
        element_id: elementId,
        distribution: 'Uniform',
        w1: intensity,
        w2: intensity,
        direction,
        start_pos: 0.0,
        end_pos: 1.0
    };
}

/**
 * Create a triangular distributed load (zero at start, max at end)
 */
export function createTriangularLoad(
    elementId: number,
    maxIntensity: number,
    direction: string = 'LocalY'
): MemberLoad {
    return {
        element_id: elementId,
        distribution: 'Triangular',
        w1: 0,
        w2: maxIntensity,
        direction,
        start_pos: 0.0,
        end_pos: 1.0
    };
}

/**
 * Create a trapezoidal distributed load
 */
export function createTrapezoidalLoad(
    elementId: number,
    startIntensity: number,
    endIntensity: number,
    direction: string = 'LocalY'
): MemberLoad {
    return {
        element_id: elementId,
        distribution: 'Trapezoidal',
        w1: startIntensity,
        w2: endIntensity,
        direction,
        start_pos: 0.0,
        end_pos: 1.0
    };
}
