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
        // Import the entire WASM module from backend-rust
        wasmModule = await import('backend-rust');
        // Initialize the WASM module
        await wasmModule.default();
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

        // Use Transferable Objects for zero-copy transfer of large arrays
        const transferables: ArrayBuffer[] = [];
        if (response.data?.displacements instanceof Float64Array) {
            transferables.push(response.data.displacements.buffer);
        }
        (self as any).postMessage(response, transferables);
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
                    stiffness,
                    forces,
                    dof
                );
            } else {
                displacements = wasmModule.solve_system(
                    stiffness,
                    forces,
                    dof
                );
            }

            return {
                requestId,
                success: true,
                data: { displacements },
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
    // Create working copies - use flat array instead of Array-of-Array for better cache locality
    const A = new Float64Array(K);
    const b = new Float64Array(F);

    // Forward elimination with partial pivoting (in-place on flat array)
    for (let k = 0; k < n - 1; k++) {
        // Find pivot
        let maxVal = Math.abs(A[k * n + k]);
        let maxRow = k;

        for (let i = k + 1; i < n; i++) {
            const absVal = Math.abs(A[i * n + k]);
            if (absVal > maxVal) {
                maxVal = absVal;
                maxRow = i;
            }
        }

        // Check for singularity
        if (maxVal < 1e-15) {
            return { success: false, error: 'Matrix is singular or nearly singular' };
        }

        // Swap rows if needed (in flat array)
        if (maxRow !== k) {
            for (let j = 0; j < n; j++) {
                const tmp = A[k * n + j];
                A[k * n + j] = A[maxRow * n + j];
                A[maxRow * n + j] = tmp;
            }
            const tmp = b[k];
            b[k] = b[maxRow];
            b[maxRow] = tmp;
        }

        // Eliminate
        const pivot = A[k * n + k];
        for (let i = k + 1; i < n; i++) {
            const factor = A[i * n + k] / pivot;
            for (let j = k; j < n; j++) {
                A[i * n + j] -= factor * A[k * n + j];
            }
            b[i] -= factor * b[k];
        }
    }

    // Back substitution
    const x = new Float64Array(n);

    for (let i = n - 1; i >= 0; i--) {
        if (Math.abs(A[i * n + i]) < 1e-15) {
            return { success: false, error: 'Matrix is singular' };
        }

        let sum = b[i];
        for (let j = i + 1; j < n; j++) {
            sum -= A[i * n + j] * x[j];
        }
        x[i] = sum / A[i * n + i];
    }

    return { success: true, displacements: x as unknown as number[] };
}

// Export for TypeScript module recognition
export { };
