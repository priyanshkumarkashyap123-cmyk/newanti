/**
 * StructuralSolverWorker - Enhanced Web Worker for Structural Analysis
 * 
 * Features:
 * - Full assembly and solve logic inside worker
 * - Progress events for UI feedback
 * - Transferable Objects (ArrayBuffers) for zero-copy data transfer
 * - Automatic WASM/JS solver selection
 */

// ============================================
// IMPORTS
// ============================================

// WASM Module import (dynamic from public folder)
let wasmModule: any = null;
let wasmReady = false;

async function loadWasm(): Promise<void> {
    try {
        // Import the WASM glue code from public folder
        // This uses the wasm-pack "web" target which exports an init() function
        const response = await fetch('/solver_wasm_bg.wasm');
        if (!response.ok) {
            throw new Error(`Failed to fetch WASM: ${response.status}`);
        }
        const wasmBytes = await response.arrayBuffer();

        // Use the bundled solver_wasm.js for initialization
        // Instead, we dynamically import the glue code which resolves the WASM file
        wasmModule = await import('/solver_wasm.js');

        // Initialize with the fetched bytes
        await wasmModule.default(wasmBytes);
        wasmReady = true;
        console.log('[StructuralSolverWorker] WASM Solver Module Loaded from public folder');
    } catch (error) {
        console.warn('[StructuralSolverWorker] WASM Solver not available, using JS fallback:', error);
    }
}

// Start loading
loadWasm();

// ============================================
// MESSAGE TYPES
// ============================================

/** Input: Model data from main thread */
export interface ModelData {
    nodes: NodeData[];
    members: MemberData[];
    loads: LoadData[];
    dofPerNode: 2 | 3 | 6;
    options?: SolverOptions;
}

export interface NodeData {
    id: string;
    x: number;
    y: number;
    z: number;
    restraints?: {
        fx: boolean;
        fy: boolean;
        fz: boolean;
        mx: boolean;
        my: boolean;
        mz: boolean;
    };
}

export interface MemberData {
    id: string;
    startNodeId: string;
    endNodeId: string;
    E: number;
    A: number;
    I: number;
}

export interface LoadData {
    nodeId: string;
    fx?: number;
    fy?: number;
    fz?: number;
    mx?: number;
    my?: number;
    mz?: number;
}

export interface SolverOptions {
    tolerance?: number;
    maxIterations?: number;
    method?: 'cg' | 'direct' | 'auto';
}

/** Output: Progress events */
export interface ProgressEvent {
    type: 'progress';
    stage: 'assembling' | 'applying_bc' | 'solving' | 'extracting';
    percent: number;
    message: string;
}

/** Output: Result data with Transferable buffers */
export interface ResultData {
    type: 'result';
    success: boolean;
    displacements?: Float64Array;  // Transferable
    reactions?: Float64Array;      // Transferable (per DOF)
    memberForces?: any;            // Small payload; object array for clarity
    stats: {
        assemblyTimeMs: number;
        solveTimeMs: number;
        totalTimeMs: number;
        method?: string;
        iterations?: number;
        residual?: number;
        nnz?: number;
        sparsity?: number;
    };
    error?: string;
}

/** Request message from main thread */
interface WorkerRequest {
    type: 'analyze';
    requestId: string;
    model: ModelData;
}

// ============================================
// SPARSE MATRIX (Inline for Worker)
// ============================================

class SparseMatrix {
    private data: Map<string, number> = new Map();
    constructor(public rows: number, public cols: number) { }

    get(row: number, col: number): number {
        return this.data.get(`${row},${col}`) ?? 0;
    }

    set(row: number, col: number, value: number): void {
        if (Math.abs(value) < 1e-15) {
            this.data.delete(`${row},${col}`);
        } else {
            this.data.set(`${row},${col}`, value);
        }
    }

    add(row: number, col: number, value: number): void {
        if (Math.abs(value) < 1e-15) return;
        const key = `${row},${col}`;
        const existing = this.data.get(key) ?? 0;
        const newValue = existing + value;
        if (Math.abs(newValue) < 1e-15) {
            this.data.delete(key);
        } else {
            this.data.set(key, newValue);
        }
    }

    get nnz(): number {
        return this.data.size;
    }

    getDiagonal(): Float64Array {
        const diag = new Float64Array(Math.min(this.rows, this.cols));
        for (let i = 0; i < diag.length; i++) {
            diag[i] = this.get(i, i);
        }
        return diag;
    }

    // Matrix-vector multiply
    multiply(x: Float64Array): Float64Array {
        const y = new Float64Array(this.rows);
        for (const [key, value] of this.data) {
            const [row, col] = key.split(',').map(Number);
            y[row] += value * x[col];
        }
        return y;
    }
}

// ============================================
// PROGRESS REPORTING
// ============================================

function sendProgress(stage: ProgressEvent['stage'], percent: number, message: string): void {
    self.postMessage({
        type: 'progress',
        stage,
        percent,
        message
    } as ProgressEvent);
}

// ============================================
// ASSEMBLY FUNCTIONS
// ============================================

function assembleStiffnessMatrix(
    model: ModelData,
    nodeIndexMap: Map<string, number>
): { K: SparseMatrix; F: Float64Array; fixedDofs: Set<number> } {
    const { nodes, members, loads, dofPerNode } = model;
    const totalDof = nodes.length * dofPerNode;

    const K = new SparseMatrix(totalDof, totalDof);
    const F = new Float64Array(totalDof);
    const fixedDofs = new Set<number>();

    sendProgress('assembling', 0, 'Starting stiffness matrix assembly...');

    // Identify fixed DOFs
    nodes.forEach((node, nodeIndex) => {
        if (node.restraints) {
            const baseDof = nodeIndex * dofPerNode;
            if (node.restraints.fx) fixedDofs.add(baseDof);
            if (node.restraints.fy) fixedDofs.add(baseDof + 1);
            if (node.restraints.fz && dofPerNode >= 3) fixedDofs.add(baseDof + 2);
            if (node.restraints.mx && dofPerNode >= 4) fixedDofs.add(baseDof + 3);
            if (node.restraints.my && dofPerNode >= 5) fixedDofs.add(baseDof + 4);
            if (node.restraints.mz && dofPerNode >= 6) fixedDofs.add(baseDof + 5);
        }
    });

    // Assemble element stiffness matrices
    const totalMembers = members.length;
    for (let m = 0; m < totalMembers; m++) {
        const member = members[m];

        // Progress every 10% of members
        if (m % Math.max(1, Math.floor(totalMembers / 10)) === 0) {
            const percent = Math.round((m / totalMembers) * 60);
            sendProgress('assembling', percent, `Assembling member ${m + 1}/${totalMembers}...`);
        }

        const startIdx = nodeIndexMap.get(member.startNodeId)!;
        const endIdx = nodeIndexMap.get(member.endNodeId)!;
        const startNode = nodes[startIdx];
        const endNode = nodes[endIdx];

        // Compute element stiffness
        const dx = endNode.x - startNode.x;
        const dy = endNode.y - startNode.y;
        const dz = endNode.z - startNode.z;
        const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const cx = dx / L;
        const cy = dy / L;
        const cz = dz / L;

        const { E, A } = member;
        const k = (E * A) / L;

        // Build DOF map
        const dofMap: number[] = [];
        for (let i = 0; i < dofPerNode; i++) {
            dofMap.push(startIdx * dofPerNode + i);
        }
        for (let i = 0; i < dofPerNode; i++) {
            dofMap.push(endIdx * dofPerNode + i);
        }

        // Element stiffness matrix (frame when dofPerNode>=3, else truss)
        const ke = (dofPerNode === 3)
            ? computeFrameStiffness(E, A, member.I, L, cx, cy, cz)
            : computeTrussStiffness(k, cx, cy, cz, dofPerNode);

        // Add to global matrix
        for (let i = 0; i < ke.length; i++) {
            for (let j = 0; j < ke.length; j++) {
                if (Math.abs(ke[i][j]) > 1e-15) {
                    K.add(dofMap[i], dofMap[j], ke[i][j]);
                }
            }
        }
    }

    sendProgress('assembling', 70, 'Assembling force vector...');

    // Assemble force vector
    for (const load of loads) {
        const nodeIndex = nodeIndexMap.get(load.nodeId);
        if (nodeIndex === undefined) continue;

        const baseDof = nodeIndex * dofPerNode;
        if (load.fx) F[baseDof] += load.fx;
        if (load.fy) F[baseDof + 1] += load.fy;
        if (load.fz && dofPerNode >= 3) F[baseDof + 2] += load.fz;
        if (load.mx && dofPerNode >= 4) F[baseDof + 3] += load.mx;
        if (load.my && dofPerNode >= 5) F[baseDof + 4] += load.my;
        if (load.mz && dofPerNode >= 6) F[baseDof + 5] += load.mz;
    }

    return { K, F, fixedDofs };
}

function computeTrussStiffness(k: number, cx: number, cy: number, cz: number, dofPerNode: number): number[][] {
    if (dofPerNode === 2) {
        const c2 = cx * cx, s2 = cy * cy, cs = cx * cy;
        return [
            [k * c2, k * cs, -k * c2, -k * cs],
            [k * cs, k * s2, -k * cs, -k * s2],
            [-k * c2, -k * cs, k * c2, k * cs],
            [-k * cs, -k * s2, k * cs, k * s2]
        ];
    } else {
        // 3D truss (6 DOF per element, 2 nodes)
        return [
            [k * cx * cx, k * cx * cy, k * cx * cz, -k * cx * cx, -k * cx * cy, -k * cx * cz],
            [k * cy * cx, k * cy * cy, k * cy * cz, -k * cy * cx, -k * cy * cy, -k * cy * cz],
            [k * cz * cx, k * cz * cy, k * cz * cz, -k * cz * cx, -k * cz * cy, -k * cz * cz],
            [-k * cx * cx, -k * cx * cy, -k * cx * cz, k * cx * cx, k * cx * cy, k * cx * cz],
            [-k * cy * cx, -k * cy * cy, -k * cy * cz, k * cy * cx, k * cy * cy, k * cy * cz],
            [-k * cz * cx, -k * cz * cy, -k * cz * cz, k * cz * cx, k * cz * cy, k * cz * cz]
        ];
    }
}

// 2D Frame (u, v, theta per node) transformed to global coordinates
function computeFrameStiffness(E: number, A: number, I: number, L: number, cx: number, cy: number, cz: number): number[][] {
    // Local 2D frame stiffness (6x6)
    const EA_L = (E * A) / L;
    const EI = E * I;
    const L2 = L * L;
    const L3 = L2 * L;

    const kLocal = [
        [EA_L, 0, 0, -EA_L, 0, 0],
        [0, 12 * EI / L3, 6 * EI / L2, 0, -12 * EI / L3, 6 * EI / L2],
        [0, 6 * EI / L2, 4 * EI / L, 0, -6 * EI / L2, 2 * EI / L],
        [-EA_L, 0, 0, EA_L, 0, 0],
        [0, -12 * EI / L3, -6 * EI / L2, 0, 12 * EI / L3, -6 * EI / L2],
        [0, 6 * EI / L2, 2 * EI / L, 0, -6 * EI / L2, 4 * EI / L]
    ];

    // Direction cosines (2D projection)
    const Lproj = Math.sqrt(cx * cx + cy * cy + cz * cz);
    const c = cx / Lproj;
    const s = cy / Lproj;

    // Transformation matrix T (6x6)
    const T = [
        [c, -s, 0, 0, 0, 0],
        [s, c, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0],
        [0, 0, 0, c, -s, 0],
        [0, 0, 0, s, c, 0],
        [0, 0, 0, 0, 0, 1]
    ];

    // ke = T^T * kLocal * T
    const temp: number[][] = Array.from({ length: 6 }, () => Array(6).fill(0));
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
            for (let k = 0; k < 6; k++) temp[i][j] += kLocal[i][k] * T[k][j];
        }
    }

    const kGlobal: number[][] = Array.from({ length: 6 }, () => Array(6).fill(0));
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
            for (let k = 0; k < 6; k++) kGlobal[i][j] += T[k][i] * temp[k][j];
        }
    }

    return kGlobal;
}

function computeMemberEndForces(
    model: ModelData,
    displacements: Float64Array,
    nodeIndexMap: Map<string, number>
) {
    const { members, nodes, dofPerNode } = model;
    const results: any[] = [];

    if (dofPerNode < 3) return results;

    for (const member of members) {
        const i = nodeIndexMap.get(member.startNodeId)!;
        const j = nodeIndexMap.get(member.endNodeId)!;
        const n1 = nodes[i];
        const n2 = nodes[j];

        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dz = n2.z - n1.z;
        const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const cx = dx / L;
        const cy = dy / L;
        const cz = dz / L;

        const kGlobal = computeFrameStiffness(member.E, member.A, member.I, L, cx, cy, cz);

        const dofIndices = [
            i * dofPerNode + 0,
            i * dofPerNode + 1,
            i * dofPerNode + 2,
            j * dofPerNode + 0,
            j * dofPerNode + 1,
            j * dofPerNode + 2,
        ];

        const uGlobal = new Float64Array(6);
        for (let n = 0; n < 6; n++) uGlobal[n] = displacements[dofIndices[n]];

        // Build transformation matrix T (same as in stiffness)
        const Lproj = Math.sqrt(cx * cx + cy * cy + cz * cz);
        const c = cx / Lproj;
        const s = cy / Lproj;
        const T = [
            [c, -s, 0, 0, 0, 0],
            [s, c, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0],
            [0, 0, 0, c, -s, 0],
            [0, 0, 0, s, c, 0],
            [0, 0, 0, 0, 0, 1]
        ];

        const uLocal = new Float64Array(6);
        for (let r = 0; r < 6; r++) {
            let sum = 0;
            for (let cIdx = 0; cIdx < 6; cIdx++) sum += T[r][cIdx] * uGlobal[cIdx];
            uLocal[r] = sum;
        }

        // Local end forces f = k_local * u_local (use local matrix from frame calc)
        const EA_L = (member.E * member.A) / L;
        const EI = member.E * member.I;
        const L2 = L * L;
        const L3 = L2 * L;

        const kLocal = [
            [EA_L, 0, 0, -EA_L, 0, 0],
            [0, 12 * EI / L3, 6 * EI / L2, 0, -12 * EI / L3, 6 * EI / L2],
            [0, 6 * EI / L2, 4 * EI / L, 0, -6 * EI / L2, 2 * EI / L],
            [-EA_L, 0, 0, EA_L, 0, 0],
            [0, -12 * EI / L3, -6 * EI / L2, 0, 12 * EI / L3, -6 * EI / L2],
            [0, 6 * EI / L2, 2 * EI / L, 0, -6 * EI / L2, 4 * EI / L]
        ];

        const fLocal = new Float64Array(6);
        for (let r = 0; r < 6; r++) {
            let sum = 0;
            for (let cIdx = 0; cIdx < 6; cIdx++) sum += kLocal[r][cIdx] * uLocal[cIdx];
            fLocal[r] = sum;
        }

        results.push({
            id: member.id,
            start: {
                axial: fLocal[0],
                shear: fLocal[1],
                moment: fLocal[2]
            },
            end: {
                axial: -fLocal[3],
                shear: fLocal[4],
                moment: fLocal[5]
            }
        });
    }

    return results;
}

// ============================================
// BOUNDARY CONDITIONS
// ============================================

function applyBoundaryConditions(K: SparseMatrix, F: Float64Array, fixedDofs: Set<number>): void {
    sendProgress('applying_bc', 75, 'Applying boundary conditions...');

    const penalty = 1e20;
    for (const dof of fixedDofs) {
        const existing = K.get(dof, dof);
        K.set(dof, dof, existing + penalty);
        F[dof] = 0;
    }
}

// ============================================
// CONJUGATE GRADIENT SOLVER
// ============================================

function conjugateGradient(
    K: SparseMatrix,
    F: Float64Array,
    options: SolverOptions = {}
): { x: Float64Array; iterations: number; residual: number } {
    const n = K.rows;
    const tolerance = options.tolerance ?? 1e-8;
    const maxIterations = options.maxIterations ?? n * 2;

    // Initial guess
    const x = new Float64Array(n);

    // Preconditioner (Jacobi)
    const diagonal = K.getDiagonal();

    // r = F - K*x (x=0 so r = F)
    let r = new Float64Array(F);

    // z = M^-1 * r (Jacobi preconditioner)
    let z = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        z[i] = diagonal[i] !== 0 ? r[i] / diagonal[i] : r[i];
    }

    let p = new Float64Array(z);
    let rzOld = dot(r, z);

    const bNorm = norm(F) || 1;
    let residual = norm(r) / bNorm;
    let iteration = 0;

    sendProgress('solving', 80, 'Starting conjugate gradient solver...');

    while (iteration < maxIterations && residual > tolerance) {
        // Ap = K * p
        const Ap = K.multiply(p);

        // alpha = (r·z) / (p·Ap)
        const pAp = dot(p, Ap);
        if (Math.abs(pAp) < 1e-30) break;
        const alpha = rzOld / pAp;

        // x = x + alpha * p
        for (let i = 0; i < n; i++) x[i] += alpha * p[i];

        // r = r - alpha * Ap
        for (let i = 0; i < n; i++) r[i] -= alpha * Ap[i];

        // z = M^-1 * r
        for (let i = 0; i < n; i++) {
            z[i] = diagonal[i] !== 0 ? r[i] / diagonal[i] : r[i];
        }

        const rzNew = dot(r, z);
        const beta = rzNew / rzOld;

        // p = z + beta * p
        for (let i = 0; i < n; i++) p[i] = z[i] + beta * p[i];

        rzOld = rzNew;
        residual = norm(r) / bNorm;
        iteration++;

        // Progress every 50 iterations
        if (iteration % 50 === 0) {
            const percent = 80 + Math.min(15, (iteration / maxIterations) * 15);
            sendProgress('solving', percent, `Solving... iteration ${iteration}, residual: ${residual.toExponential(2)}`);
        }
    }

    return { x, iterations: iteration, residual };
}

function dot(a: Float64Array, b: Float64Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
    return sum;
}

function norm(a: Float64Array): number {
    return Math.sqrt(dot(a, a));
}

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

// ============================================
// ASSEMBLY & SOLVER
// ============================================

import { SparseMatrixAssembler } from '../utils/SparseMatrixAssembler';

function analyze(model: ModelData): ResultData {
    const startTime = performance.now();

    try {
        // 1. ASSEMBLE (Sparse)
        // ====================
        sendProgress('assembling', 0, 'Assembling stiffness matrix...');
        const assemblyStart = performance.now();

        // Use the shared assembler
        const { entries, forces, dof, nodeMapping } = SparseMatrixAssembler.assemble({
            nodes: model.nodes,
            members: model.members,
            loads: model.loads
        });

        const assemblyTime = performance.now() - assemblyStart;
        sendProgress('assembling', 100, `Assembly complete. System size: ${dof} DOF, ${entries.length} non-zeros`);

        // 2. SOLVE
        // ========
        let displacements: Float64Array;
        let stats: any = {};
        const solveStart = performance.now();

        if (wasmReady && wasmModule && wasmModule.solve_sparse_system_json) {
            // WASM PATH (Sparse)
            sendProgress('solving', 20, 'Solving using backend-rust WASM (Sparse LU)...');

            const input = {
                entries,
                forces, // Array[dof]
                size: dof
            };

            // Serialize to JSON for WASM
            // This overhead is negligible compared to dense matrix transfer
            const inputJson = JSON.stringify(input);

            try {
                const resultJson = wasmModule.solve_sparse_system_json(inputJson);
                const result = JSON.parse(resultJson);

                if (!result.success) {
                    throw new Error(result.error || 'WASM solver failed');
                }

                displacements = new Float64Array(result.displacements);
                stats.method = 'Rust WASM (Sparse LU)';
                stats.solveTimeMs = result.solve_time_ms;

            } catch (e) {
                console.error('WASM Solver Error:', e);
                throw e;
            }

        } else {
            // FALLBACK JS PATH (Dense/Iterative)
            // Note: This WILL crash for 50k elements. Only for small fallback.
            // If model is large, throw error
            if (dof > 5000) {
                throw new Error('Model too large for JavaScript fallback solver. Please ensure WASM is loaded.');
            }

            sendProgress('solving', 20, 'WASM unimplemented/not ready. Using JS fallback (slow)...');
            console.warn('Using JS fallback solver');

            // Re-use assembly for now or implement sparse JS solver?
            // For safety, let's error out if WASM isn't ready for large models
            throw new Error('WASM solver not ready. Cannot solve.');
        }

        const solveTime = performance.now() - solveStart;

        // 3. POST-PROCESS
        // ===============
        sendProgress('extracting', 90, 'Calculating member forces...');

        // Member forces calculation (simplified for now)
        // TODO: Move member force calc to SparseMatrixAssembler or similar utility
        const memberForces: any[] = []; // computeMemberEndForces(model, displacements, nodeMapping);

        return {
            type: 'result',
            success: true,
            displacements,
            reactions: new Float64Array(dof), // TODO: Calculate reactions
            memberForces,
            stats: {
                assemblyTimeMs: assemblyTime,
                solveTimeMs: solveTime,
                totalTimeMs: performance.now() - startTime,
                ...stats,
                nnz: entries.length,
                sparsity: 1 - (entries.length / (dof * dof))
            }
        };

    } catch (error) {
        console.error('Worker Analysis Failed:', error);
        return {
            type: 'result',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stats: {
                assemblyTimeMs: 0,
                solveTimeMs: 0,
                totalTimeMs: performance.now() - startTime
            }
        };
    }
}

// ============================================
// MESSAGE HANDLER
// ============================================

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
    const request = event.data;

    if (request.type === 'analyze') {
        const result = analyze(request.model);

        // Use Transferable Objects for zero-copy transfer
        const transferables: Transferable[] = [];

        if (result.displacements) {
            transferables.push(result.displacements.buffer);
        }
        if (result.reactions) {
            transferables.push(result.reactions.buffer);
        }
        // memberForces is an object array (small), no transferable

        // Post with transferables (zero-copy)
        self.postMessage(result, { transfer: transferables });
    }
};

// Export for TypeScript
export { };
