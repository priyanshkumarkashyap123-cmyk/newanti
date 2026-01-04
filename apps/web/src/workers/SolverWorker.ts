/**
 * SolverWorker - Web Worker for WASM Linear Solver
 * 
 * Runs the Rust WASM solver in a separate thread to keep UI responsive.
 * Automatically switches between JS and WASM solvers based on model size.
 */

// ============================================
// TYPES
// ============================================

interface SolveRequest {
    type: 'solve';
    requestId: string;
    stiffness: Float64Array;
    forces: Float64Array;
    dof: number;
    method: 'lu' | 'cholesky' | 'auto';
}

interface EigenRequest {
    type: 'eigen';
    requestId: string;
    stiffness: Float64Array;
    mass: Float64Array;
    dof: number;
    numModes: number;
}

interface CheckConditionRequest {
    type: 'check_condition';
    requestId: string;
    stiffness: Float64Array;
    dof: number;
}

type WorkerRequest = SolveRequest | EigenRequest | CheckConditionRequest;

interface WorkerResponse {
    requestId: string;
    success: boolean;
    data?: any;
    error?: string;
    solveTimeMs?: number;
    usedWasm: boolean;
}

// ============================================
// WASM MODULE LOADING
// ============================================

let wasmModule: any = null;
let wasmReady = false;

async function loadWasmModule(): Promise<void> {
    try {
        // Dynamic import of WASM module
        // Path: apps/web/src/workers -> ../../../../packages/solver-wasm/pkg
        const wasm = await import('../../../../packages/solver-wasm/pkg/solver_wasm');
        wasmModule = wasm;
        wasmReady = true;
        self.postMessage({ type: 'wasm_ready' });
        console.log('[SolverWorker] WASM module loaded successfully');
    } catch (error) {
        console.warn('[SolverWorker] WASM module not available, using JS fallback:', error);
        wasmReady = false;
    }
}

// Load WASM on worker start
loadWasmModule();

// ============================================
// MESSAGE HANDLER
// ============================================

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const request = event.data;

    try {
        let response: WorkerResponse;

        switch (request.type) {
            case 'solve':
                response = await handleSolve(request);
                break;
            case 'eigen':
                response = await handleEigen(request);
                break;
            case 'check_condition':
                response = await handleCheckCondition(request);
                break;
            default:
                response = {
                    requestId: (request as any).requestId,
                    success: false,
                    error: 'Unknown request type',
                    usedWasm: false
                };
        }

        self.postMessage(response);
    } catch (error) {
        self.postMessage({
            requestId: request.requestId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            usedWasm: false
        });
    }
};

// ============================================
// SOLVE HANDLER
// ============================================

async function handleSolve(request: SolveRequest): Promise<WorkerResponse> {
    const start = performance.now();
    const { stiffness, forces, dof, method, requestId } = request;

    // Use WASM for large models (>500 nodes = >3000 DOF typically)
    const useWasm = wasmReady && dof > 500;

    if (useWasm && wasmModule) {
        try {
            let displacements: Float64Array;

            if (method === 'cholesky') {
                displacements = wasmModule.solve_system_cholesky(
                    new Float64Array(stiffness),
                    new Float64Array(forces),
                    dof
                );
            } else {
                displacements = wasmModule.solve_system(
                    new Float64Array(stiffness),
                    new Float64Array(forces),
                    dof
                );
            }

            return {
                requestId,
                success: true,
                data: { displacements: Array.from(displacements) },
                solveTimeMs: performance.now() - start,
                usedWasm: true
            };
        } catch (error) {
            console.warn('[SolverWorker] WASM solve failed, falling back to JS:', error);
        }
    }

    // JavaScript fallback (Gaussian elimination with partial pivoting)
    const result = solveJS(stiffness, forces, dof);

    return {
        requestId,
        success: result.success,
        data: result.success ? { displacements: result.displacements } : undefined,
        error: result.error,
        solveTimeMs: performance.now() - start,
        usedWasm: false
    };
}

// ============================================
// EIGEN HANDLER
// ============================================

async function handleEigen(request: EigenRequest): Promise<WorkerResponse> {
    const { stiffness, mass, dof, numModes, requestId } = request;

    if (!wasmReady || !wasmModule) {
        return {
            requestId,
            success: false,
            error: 'Eigenvalue analysis requires WASM module',
            usedWasm: false
        };
    }

    try {
        const resultJson = wasmModule.compute_eigenvalues(
            new Float64Array(stiffness),
            new Float64Array(mass),
            dof,
            numModes
        );

        const result = JSON.parse(resultJson);

        return {
            requestId,
            success: result.success,
            data: result.success ? {
                eigenvalues: result.eigenvalues,
                frequencies: result.frequencies,
                eigenvectors: result.eigenvectors
            } : undefined,
            error: result.error,
            usedWasm: true
        };
    } catch (error) {
        return {
            requestId,
            success: false,
            error: error instanceof Error ? error.message : 'Eigenvalue computation failed',
            usedWasm: false
        };
    }
}

// ============================================
// CONDITION CHECK HANDLER
// ============================================

async function handleCheckCondition(request: CheckConditionRequest): Promise<WorkerResponse> {
    const { stiffness, dof, requestId } = request;

    if (!wasmReady || !wasmModule) {
        return {
            requestId,
            success: true,
            data: { warning: 'WASM not available for condition check' },
            usedWasm: false
        };
    }

    try {
        const resultJson = wasmModule.check_matrix_condition(
            new Float64Array(stiffness),
            dof
        );

        const result = JSON.parse(resultJson);

        return {
            requestId,
            success: true,
            data: result,
            usedWasm: true
        };
    } catch (error) {
        return {
            requestId,
            success: false,
            error: error instanceof Error ? error.message : 'Condition check failed',
            usedWasm: false
        };
    }
}

// ============================================
// JAVASCRIPT FALLBACK SOLVER
// ============================================

interface SolveResult {
    success: boolean;
    displacements?: number[];
    error?: string;
}

function solveJS(K: Float64Array, F: Float64Array, n: number): SolveResult {
    // Create working copies
    const A = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => K[i * n + j])
    );
    const b = Array.from(F);

    // Forward elimination with partial pivoting
    for (let k = 0; k < n - 1; k++) {
        // Find pivot
        let maxVal = Math.abs(A[k][k]);
        let maxRow = k;

        for (let i = k + 1; i < n; i++) {
            if (Math.abs(A[i][k]) > maxVal) {
                maxVal = Math.abs(A[i][k]);
                maxRow = i;
            }
        }

        // Check for singularity
        if (maxVal < 1e-15) {
            return { success: false, error: 'Matrix is singular or nearly singular' };
        }

        // Swap rows if needed
        if (maxRow !== k) {
            [A[k], A[maxRow]] = [A[maxRow], A[k]];
            [b[k], b[maxRow]] = [b[maxRow], b[k]];
        }

        // Eliminate
        for (let i = k + 1; i < n; i++) {
            const factor = A[i][k] / A[k][k];
            for (let j = k; j < n; j++) {
                A[i][j] -= factor * A[k][j];
            }
            b[i] -= factor * b[k];
        }
    }

    // Back substitution
    const x: number[] = new Array(n).fill(0);

    for (let i = n - 1; i >= 0; i--) {
        if (Math.abs(A[i][i]) < 1e-15) {
            return { success: false, error: 'Matrix is singular' };
        }

        let sum = b[i];
        for (let j = i + 1; j < n; j++) {
            sum -= A[i][j] * x[j];
        }
        x[i] = sum / A[i][i];
    }

    return { success: true, displacements: x };
}

// Export for TypeScript module recognition
export { };
