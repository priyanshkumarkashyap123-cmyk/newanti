/**
 * CSRSparseMatrix.ts
 *
 * High-performance Compressed Sparse Row (CSR) matrix implementation
 * for structural analysis. This is the industry-standard format used by
 * PARDISO, SuperLU, UMFPACK, and every serious FEA solver.
 *
 * Benefits over Map<string, number>:
 *  - 10-100x faster matrix-vector multiply (no string parsing)
 *  - 5-10x less memory (no string keys, uses TypedArrays)
 *  - Cache-friendly row-major access pattern
 *  - Direct compatibility with WASM/native solvers (zero-copy)
 *
 * Usage:
 *   const builder = new CSRMatrixBuilder(n);
 *   builder.add(row, col, value); // during assembly
 *   const csr = builder.build();  // finalize
 *   const y = csr.multiply(x);   // matrix-vector product
 */

// ============================================
// CSR MATRIX BUILDER (COO → CSR conversion)
// ============================================

/**
 * Coordinate (COO) format builder that efficiently converts to CSR.
 * Use this during finite element stiffness assembly phase.
 */
export class CSRMatrixBuilder {
  private rows: number[] = [];
  private cols: number[] = [];
  private vals: number[] = [];
  private _n: number;

  constructor(n: number) {
    this._n = n;
  }

  /** Add value to position (row, col). Duplicates are summed during build(). */
  add(row: number, col: number, value: number): void {
    if (Math.abs(value) < 1e-20) return;
    this.rows.push(row);
    this.cols.push(col);
    this.vals.push(value);
  }

  /** Add a local element matrix into the global matrix at given DOF indices. */
  addElementMatrix(ke: number[][], dofs: number[]): void {
    const n = dofs.length;
    for (let i = 0; i < n; i++) {
      const globalRow = dofs[i];
      if (globalRow < 0) continue;
      for (let j = 0; j < n; j++) {
        const globalCol = dofs[j];
        if (globalCol < 0) continue;
        const val = ke[i][j];
        if (Math.abs(val) < 1e-20) continue;
        this.rows.push(globalRow);
        this.cols.push(globalCol);
        this.vals.push(val);
      }
    }
  }

  /** Get matrix dimension */
  get size(): number {
    return this._n;
  }

  /** Number of non-zero entries (before dedup) */
  get nnz(): number {
    return this.rows.length;
  }

  /**
   * Build the final CSR matrix. Sums duplicate entries.
   * Time: O(nnz * log(nnz)) for sorting, O(nnz) for compression.
   */
  build(): CSRSparseMatrix {
    const nnz = this.rows.length;
    if (nnz === 0) {
      return new CSRSparseMatrix(
        this._n,
        new Int32Array(this._n + 1),
        new Int32Array(0),
        new Float64Array(0)
      );
    }

    // Sort by (row, col) for CSR construction
    const indices = new Int32Array(nnz);
    for (let i = 0; i < nnz; i++) indices[i] = i;

    const rows = this.rows;
    const cols = this.cols;
    const vals = this.vals;

    // Sort indices by (row, col)
    indices.sort((a, b) => {
      const dr = rows[a] - rows[b];
      return dr !== 0 ? dr : cols[a] - cols[b];
    });

    // Count unique entries (sum duplicates)
    let uniqueCount = 1;
    for (let k = 1; k < nnz; k++) {
      const i = indices[k];
      const iPrev = indices[k - 1];
      if (rows[i] !== rows[iPrev] || cols[i] !== cols[iPrev]) {
        uniqueCount++;
      }
    }

    // Build CSR arrays
    const rowPtr = new Int32Array(this._n + 1);
    const colIdx = new Int32Array(uniqueCount);
    const values = new Float64Array(uniqueCount);

    let outIdx = 0;
    let prevRow = rows[indices[0]];
    let prevCol = cols[indices[0]];
    colIdx[0] = prevCol;
    values[0] = vals[indices[0]];

    // Fill row pointers for empty rows at the start
    for (let r = 0; r <= prevRow; r++) {
      rowPtr[r] = 0;
    }

    for (let k = 1; k < nnz; k++) {
      const idx = indices[k];
      const r = rows[idx];
      const c = cols[idx];
      const v = vals[idx];

      if (r === prevRow && c === prevCol) {
        // Duplicate: sum values
        values[outIdx] += v;
      } else {
        // New entry
        outIdx++;
        colIdx[outIdx] = c;
        values[outIdx] = v;

        // Fill row pointers for rows between prevRow and r
        for (let rr = prevRow + 1; rr <= r; rr++) {
          rowPtr[rr] = outIdx;
        }
        prevRow = r;
        prevCol = c;
      }
    }

    // Finalize row pointers
    for (let r = prevRow + 1; r <= this._n; r++) {
      rowPtr[r] = outIdx + 1;
    }

    return new CSRSparseMatrix(this._n, rowPtr, colIdx, values);
  }
}

// ============================================
// CSR SPARSE MATRIX
// ============================================

/**
 * Immutable CSR (Compressed Sparse Row) sparse matrix.
 *
 * Internal storage:
 *   rowPtr[i] = index into colIdx/values where row i starts
 *   colIdx[k] = column index of the k-th non-zero
 *   values[k] = value of the k-th non-zero
 *
 * This is the exact format expected by PARDISO, UMFPACK, and WASM solvers.
 */
export class CSRSparseMatrix {
  /** Matrix dimension (n × n) */
  readonly n: number;
  /** Row pointers (length n+1). rowPtr[i]..rowPtr[i+1] are entries in row i. */
  readonly rowPtr: Int32Array;
  /** Column indices for each non-zero */
  readonly colIdx: Int32Array;
  /** Values for each non-zero */
  readonly values: Float64Array;

  constructor(n: number, rowPtr: Int32Array, colIdx: Int32Array, values: Float64Array) {
    this.n = n;
    this.rowPtr = rowPtr;
    this.colIdx = colIdx;
    this.values = values;
  }

  /** Number of non-zero entries */
  get nnz(): number {
    return this.values.length;
  }

  /** Sparsity ratio (fraction of zeros) */
  get sparsity(): number {
    return 1 - this.nnz / (this.n * this.n);
  }

  /** Memory usage in bytes (approximate) */
  get memoryBytes(): number {
    return (
      this.rowPtr.byteLength +
      this.colIdx.byteLength +
      this.values.byteLength
    );
  }

  /** Get value at (row, col). O(log(nnzInRow)) via binary search. */
  get(row: number, col: number): number {
    const start = this.rowPtr[row];
    const end = this.rowPtr[row + 1];

    // Binary search within row
    let lo = start;
    let hi = end - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const c = this.colIdx[mid];
      if (c === col) return this.values[mid];
      if (c < col) lo = mid + 1;
      else hi = mid - 1;
    }
    return 0;
  }

  /** Get diagonal element. O(log(nnzInRow)). */
  getDiag(i: number): number {
    return this.get(i, i);
  }

  /** Extract full diagonal as Float64Array. */
  getDiagonal(): Float64Array {
    const diag = new Float64Array(this.n);
    for (let i = 0; i < this.n; i++) {
      diag[i] = this.getDiag(i);
    }
    return diag;
  }

  /**
   * Matrix-vector multiply: y = A * x
   * This is the hot path in iterative solvers (CG, GMRES).
   * Optimized for cache-friendly sequential access.
   */
  multiply(x: Float64Array): Float64Array {
    const y = new Float64Array(this.n);
    const rp = this.rowPtr;
    const ci = this.colIdx;
    const v = this.values;

    for (let i = 0; i < this.n; i++) {
      let sum = 0;
      const end = rp[i + 1];
      for (let k = rp[i]; k < end; k++) {
        sum += v[k] * x[ci[k]];
      }
      y[i] = sum;
    }
    return y;
  }

  /**
   * Matrix-vector multiply and add: y = A * x + beta * y
   * Useful for avoiding allocation in iterative solvers.
   */
  multiplyAdd(x: Float64Array, y: Float64Array, beta: number = 0): void {
    const rp = this.rowPtr;
    const ci = this.colIdx;
    const v = this.values;

    for (let i = 0; i < this.n; i++) {
      let sum = 0;
      const end = rp[i + 1];
      for (let k = rp[i]; k < end; k++) {
        sum += v[k] * x[ci[k]];
      }
      y[i] = beta * y[i] + sum;
    }
  }

  /**
   * Apply penalty-method boundary conditions in-place.
   * Modifies values array directly (no copy).
   */
  applyPenaltyBC(fixedDofs: Set<number> | number[], penalty: number = 1e20): void {
    const dofs = fixedDofs instanceof Set ? fixedDofs : new Set(fixedDofs);
    for (const dof of dofs) {
      // Add penalty to diagonal
      const start = this.rowPtr[dof];
      const end = this.rowPtr[dof + 1];
      for (let k = start; k < end; k++) {
        if (this.colIdx[k] === dof) {
          (this.values as Float64Array)[k] += penalty;
          break;
        }
      }
    }
  }

  /**
   * Convert to dense array (for small matrices or debugging).
   * WARNING: O(n²) memory - only use for n < ~2000.
   */
  toDense(): number[][] {
    const A: number[][] = Array(this.n).fill(null).map(() => Array(this.n).fill(0));
    for (let i = 0; i < this.n; i++) {
      const end = this.rowPtr[i + 1];
      for (let k = this.rowPtr[i]; k < end; k++) {
        A[i][this.colIdx[k]] = this.values[k];
      }
    }
    return A;
  }

  /**
   * Get COO-format entries (for WASM or serialization).
   * Returns typed arrays for zero-copy transfer.
   */
  toCOO(): { rows: Int32Array; cols: Int32Array; values: Float64Array } {
    const nnz = this.nnz;
    const rows = new Int32Array(nnz);
    const cols = new Int32Array(nnz);
    const values = new Float64Array(nnz);

    let idx = 0;
    for (let i = 0; i < this.n; i++) {
      const end = this.rowPtr[i + 1];
      for (let k = this.rowPtr[i]; k < end; k++) {
        rows[idx] = i;
        cols[idx] = this.colIdx[k];
        values[idx] = this.values[k];
        idx++;
      }
    }
    return { rows, cols, values };
  }
}

// ============================================
// SOLVER UTILITIES
// ============================================

/**
 * Preconditioned Conjugate Gradient (PCG) solver.
 * Industry standard for symmetric positive definite systems.
 *
 * Uses Jacobi (diagonal) preconditioning by default.
 * For structural analysis, this converges in O(sqrt(kappa)) iterations
 * where kappa is the condition number.
 *
 * @param A  Symmetric positive definite CSR matrix
 * @param b  Right-hand side vector
 * @param tol Convergence tolerance (relative residual)
 * @param maxIter Maximum iterations (default: 2*n)
 * @returns Solution vector x, iterations, final residual
 */
export function solvePCG(
  A: CSRSparseMatrix,
  b: Float64Array,
  tol: number = 1e-10,
  maxIter?: number
): { x: Float64Array; iterations: number; residual: number; converged: boolean } {
  const n = A.n;
  maxIter = maxIter ?? n * 2;

  // Jacobi preconditioner: M = diag(A)
  const diagInv = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const d = A.getDiag(i);
    diagInv[i] = Math.abs(d) > 1e-20 ? 1 / d : 0;
  }

  // Initial guess: x = 0
  const x = new Float64Array(n);
  const r = new Float64Array(b); // r = b - A*x = b
  const z = new Float64Array(n);
  const p = new Float64Array(n);
  const Ap = new Float64Array(n);

  // z = M^-1 * r
  for (let i = 0; i < n; i++) z[i] = diagInv[i] * r[i];

  // p = z
  p.set(z);

  let rz = dot(r, z, n);
  const bnorm = Math.sqrt(dot(b, b, n));
  if (bnorm < 1e-30) {
    return { x, iterations: 0, residual: 0, converged: true };
  }

  let iter = 0;
  let rnorm = Math.sqrt(dot(r, r, n));

  for (iter = 0; iter < maxIter; iter++) {
    // Ap = A * p
    A.multiplyAdd(p, Ap, 0);

    const pAp = dot(p, Ap, n);
    if (Math.abs(pAp) < 1e-30) break;

    const alpha = rz / pAp;

    // x += alpha * p
    // r -= alpha * Ap
    for (let i = 0; i < n; i++) {
      x[i] += alpha * p[i];
      r[i] -= alpha * Ap[i];
    }

    rnorm = Math.sqrt(dot(r, r, n));
    if (rnorm / bnorm < tol) {
      iter++;
      break;
    }

    // z = M^-1 * r
    for (let i = 0; i < n; i++) z[i] = diagInv[i] * r[i];

    const rzNew = dot(r, z, n);
    const beta = rzNew / (rz || 1e-30);
    rz = rzNew;

    // p = z + beta * p
    for (let i = 0; i < n; i++) {
      p[i] = z[i] + beta * p[i];
    }
  }

  return {
    x,
    iterations: iter,
    residual: rnorm / bnorm,
    converged: rnorm / bnorm < tol
  };
}

/**
 * Direct solver using LU decomposition (Gaussian elimination with partial pivoting).
 * For small to medium systems (n < ~3000).
 * Falls back to this when CG doesn't converge (indefinite systems).
 */
export function solveDirectLU(A: CSRSparseMatrix, b: Float64Array): Float64Array {
  const n = A.n;

  // Convert to dense for direct solve (only for moderate sizes)
  if (n > 5000) {
    console.warn(`[CSRSparseMatrix] Direct solve on n=${n} may use excessive memory. Consider using solvePCG.`);
  }

  const M = A.toDense();
  const rhs = new Float64Array(b);

  // Gaussian elimination with partial pivoting
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxVal = Math.abs(M[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > maxVal) {
        maxVal = Math.abs(M[k][i]);
        maxRow = k;
      }
    }

    if (maxVal < 1e-15) continue; // Singular or near-singular

    // Swap rows
    if (maxRow !== i) {
      [M[i], M[maxRow]] = [M[maxRow], M[i]];
      [rhs[i], rhs[maxRow]] = [rhs[maxRow], rhs[i]];
    }

    // Eliminate
    const pivot = M[i][i];
    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / pivot;
      for (let j = i + 1; j < n; j++) {
        M[k][j] -= factor * M[i][j];
      }
      rhs[k] -= factor * rhs[i];
      M[k][i] = 0;
    }
  }

  // Back substitution
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = rhs[i];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = Math.abs(M[i][i]) > 1e-15 ? sum / M[i][i] : 0;
  }

  return x;
}

/**
 * Auto-select solver based on matrix properties.
 */
export function solve(
  A: CSRSparseMatrix,
  b: Float64Array,
  options?: { method?: 'auto' | 'direct' | 'pcg'; tol?: number; maxIter?: number }
): { x: Float64Array; method: string; iterations?: number; residual?: number } {
  const method = options?.method ?? 'auto';

  if (method === 'direct' || (method === 'auto' && A.n < 500)) {
    return { x: solveDirectLU(A, b), method: 'direct' };
  }

  // Try PCG first (faster for SPD systems)
  const result = solvePCG(A, b, options?.tol ?? 1e-10, options?.maxIter);

  if (result.converged) {
    return {
      x: result.x,
      method: 'pcg',
      iterations: result.iterations,
      residual: result.residual
    };
  }

  // Fallback to direct if PCG didn't converge
  console.warn(`[Solver] PCG did not converge (residual=${result.residual.toExponential(2)}). Falling back to direct solver.`);
  return { x: solveDirectLU(A, b), method: 'direct-fallback' };
}

// ============================================
// HELPERS
// ============================================

/** Dot product of two vectors */
function dot(a: Float64Array, b: Float64Array, n: number): number {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Compute the bandwidth of the matrix (for profiling).
 * Structural matrices have bounded bandwidth when nodes are well-ordered.
 */
export function computeBandwidth(A: CSRSparseMatrix): number {
  let maxBW = 0;
  for (let i = 0; i < A.n; i++) {
    const end = A.rowPtr[i + 1];
    for (let k = A.rowPtr[i]; k < end; k++) {
      maxBW = Math.max(maxBW, Math.abs(i - A.colIdx[k]));
    }
  }
  return maxBW;
}
