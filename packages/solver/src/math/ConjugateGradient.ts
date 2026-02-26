/**
 * ConjugateGradient - Iterative Sparse Solver
 * 
 * Implements the Conjugate Gradient method for solving symmetric
 * positive-definite systems. Includes Jacobi preconditioning.
 * 
 * Much faster than direct methods for large sparse systems.
 */

import { SparseMatrix, CSRMatrix } from './SparseMatrix';

// ============================================
// TYPES
// ============================================

export interface CGOptions {
    /** Convergence tolerance (default: 1e-6) */
    tolerance?: number;
    /** Maximum iterations (default: n * 2) */
    maxIterations?: number;
    /** Use Jacobi preconditioning (default: true) */
    precondition?: boolean;
    /** Initial guess (default: zeros) */
    x0?: Float64Array;
    /** Callback for progress reporting */
    onProgress?: (iteration: number, residual: number) => void;
}

export interface CGResult {
    /** Solution vector */
    x: Float64Array;
    /** Number of iterations */
    iterations: number;
    /** Final residual norm */
    residual: number;
    /** Whether solution converged */
    converged: boolean;
    /** Solve time in milliseconds */
    solveTimeMs: number;
}

// ============================================
// VECTOR OPERATIONS
// ============================================

function dot(a: Float64Array, b: Float64Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        sum += a[i] * b[i];
    }
    return sum;
}

function axpy(a: number, x: Float64Array, y: Float64Array): Float64Array {
    const result = new Float64Array(x.length);
    for (let i = 0; i < x.length; i++) {
        result[i] = a * x[i] + y[i];
    }
    return result;
}

function scale(a: number, x: Float64Array): Float64Array {
    const result = new Float64Array(x.length);
    for (let i = 0; i < x.length; i++) {
        result[i] = a * x[i];
    }
    return result;
}

function subtract(a: Float64Array, b: Float64Array): Float64Array {
    const result = new Float64Array(a.length);
    for (let i = 0; i < a.length; i++) {
        result[i] = a[i] - b[i];
    }
    return result;
}

function norm(x: Float64Array): number {
    return Math.sqrt(dot(x, x));
}

function copy(x: Float64Array): Float64Array {
    return new Float64Array(x);
}

// ============================================
// PRECONDITIONERS
// ============================================

/**
 * Jacobi preconditioner (diagonal scaling)
 * M = diag(A)
 */
function jacobiPrecondition(
    r: Float64Array,
    diagonal: Float64Array
): Float64Array {
    const z = new Float64Array(r.length);
    for (let i = 0; i < r.length; i++) {
        // Avoid division by zero
        z[i] = diagonal[i] !== 0 ? r[i] / diagonal[i] : r[i];
    }
    return z;
}

/**
 * Extract diagonal from CSR matrix
 */
function extractDiagonal(A: CSRMatrix): Float64Array {
    const n = Math.min(A.rows, A.cols);
    const diag = new Float64Array(n);

    for (let row = 0; row < n; row++) {
        const start = A.rowPtrs[row];
        const end = A.rowPtrs[row + 1];

        for (let i = start; i < end; i++) {
            if (A.colIndices[i] === row) {
                diag[row] = A.values[i];
                break;
            }
        }
    }

    return diag;
}

// ============================================
// CONJUGATE GRADIENT SOLVER
// ============================================

/**
 * Solve Ax = b using Conjugate Gradient method
 * 
 * For symmetric positive-definite matrices.
 * Use Preconditioned CG for better convergence.
 */
export function conjugateGradient(
    A: CSRMatrix,
    b: Float64Array,
    options: CGOptions = {}
): CGResult {
    const startTime = performance.now();
    const n = A.rows;

    // Options
    const tolerance = options.tolerance ?? 1e-6;
    const maxIterations = options.maxIterations ?? n * 2;
    const usePrecondition = options.precondition ?? true;

    // Initialize solution
    let x = options.x0 ? copy(options.x0) : new Float64Array(n);

    // Preconditioner (diagonal)
    const diagonal = usePrecondition ? extractDiagonal(A) : null;

    // Initial residual: r = b - A*x
    const Ax = SparseMatrix.csrMultiply(A, x);
    let r = subtract(b, Ax);

    // Preconditioned residual
    let z = usePrecondition && diagonal
        ? jacobiPrecondition(r, diagonal)
        : copy(r);

    // Search direction
    let p = copy(z);

    // Initial residual dot products
    let rzOld = dot(r, z);
    let residual = norm(r);
    const b_norm = norm(b) || 1;

    let iteration = 0;
    let converged = false;

    // CG iteration
    while (iteration < maxIterations) {
        // Check convergence
        if (residual / b_norm < tolerance) {
            converged = true;
            break;
        }

        // A * p
        const Ap = SparseMatrix.csrMultiply(A, p);

        // Step size: alpha = (r·z) / (p·Ap)
        const pAp = dot(p, Ap);
        if (Math.abs(pAp) < 1e-30) {
            break; // Breakdown
        }
        const alpha = rzOld / pAp;

        // Update solution: x = x + alpha * p
        x = axpy(alpha, p, x);

        // Update residual: r = r - alpha * Ap
        r = axpy(-alpha, Ap, r);

        // Precondition new residual
        z = usePrecondition && diagonal
            ? jacobiPrecondition(r, diagonal)
            : copy(r);

        // New residual dot product
        const rzNew = dot(r, z);

        // Update search direction: p = z + beta * p
        const beta = rzNew / rzOld;
        p = axpy(beta, p, z);

        rzOld = rzNew;
        residual = norm(r);
        iteration++;

        // Progress callback
        if (options.onProgress && iteration % 10 === 0) {
            options.onProgress(iteration, residual / b_norm);
        }
    }

    return {
        x,
        iterations: iteration,
        residual: residual / b_norm,
        converged,
        solveTimeMs: performance.now() - startTime
    };
}

/**
 * Solve with SparseMatrix input (convenience wrapper)
 */
export function solveSparse(
    A: SparseMatrix,
    b: number[],
    options: CGOptions = {}
): CGResult {
    const csr = A.toCSR();
    return conjugateGradient(csr, new Float64Array(b), options);
}

// ============================================
// BICGSTAB (For Non-Symmetric Matrices)
// ============================================

/**
 * BiCGSTAB - Bi-Conjugate Gradient Stabilized
 * 
 * Works for non-symmetric matrices.
 */
export function biCGSTAB(
    A: CSRMatrix,
    b: Float64Array,
    options: CGOptions = {}
): CGResult {
    const startTime = performance.now();
    const n = A.rows;

    const tolerance = options.tolerance ?? 1e-6;
    const maxIterations = options.maxIterations ?? n * 2;

    let x = options.x0 ? copy(options.x0) : new Float64Array(n);

    // Initial residual
    const Ax = SparseMatrix.csrMultiply(A, x);
    let r = subtract(b, Ax);
    const r0 = copy(r); // Shadow residual

    let rho = 1, alpha = 1, omega = 1;
    let p = new Float64Array(n);
    let v = new Float64Array(n);

    const b_norm = norm(b) || 1;
    let residual = norm(r);
    let iteration = 0;
    let converged = false;

    while (iteration < maxIterations) {
        if (residual / b_norm < tolerance) {
            converged = true;
            break;
        }

        const rhoNew = dot(r0, r);
        if (Math.abs(rhoNew) < 1e-30) break;

        const beta = (rhoNew / rho) * (alpha / omega);

        // p = r + beta * (p - omega * v)
        for (let i = 0; i < n; i++) {
            p[i] = r[i] + beta * (p[i] - omega * v[i]);
        }

        // v = A * p
        v = SparseMatrix.csrMultiply(A, p);

        alpha = rhoNew / dot(r0, v);

        // s = r - alpha * v
        const s = axpy(-alpha, v, r);

        // Check if s is small enough
        if (norm(s) / b_norm < tolerance) {
            x = axpy(alpha, p, x);
            converged = true;
            break;
        }

        // t = A * s
        const t = SparseMatrix.csrMultiply(A, s);

        omega = dot(t, s) / dot(t, t);

        // x = x + alpha * p + omega * s
        for (let i = 0; i < n; i++) {
            x[i] = x[i] + alpha * p[i] + omega * s[i];
        }

        // r = s - omega * t
        r = axpy(-omega, t, s);

        rho = rhoNew;
        residual = norm(r);
        iteration++;

        if (options.onProgress && iteration % 10 === 0) {
            options.onProgress(iteration, residual / b_norm);
        }
    }

    return {
        x,
        iterations: iteration,
        residual: residual / b_norm,
        converged,
        solveTimeMs: performance.now() - startTime
    };
}

// ============================================
// EXPORTED SOLVER INTERFACE
// ============================================

export interface SparseSolverOptions extends CGOptions {
    /** Solver method */
    method?: 'cg' | 'bicgstab' | 'auto';
}

/**
 * Main sparse solver interface
 * Automatically selects appropriate method
 */
export function sparseSolve(
    A: SparseMatrix | CSRMatrix,
    b: number[] | Float64Array,
    options: SparseSolverOptions = {}
): CGResult {
    const csr = 'toCSR' in A ? A.toCSR() : A;
    const bArray = b instanceof Float64Array ? b : new Float64Array(b);

    const method = options.method ?? 'auto';

    if (method === 'cg' || method === 'auto') {
        // Use CG for symmetric matrices (common in structural analysis)
        return conjugateGradient(csr, bArray, options);
    } else {
        return biCGSTAB(csr, bArray, options);
    }
}

export default {
    conjugateGradient,
    biCGSTAB,
    solveSparse,
    sparseSolve
};
