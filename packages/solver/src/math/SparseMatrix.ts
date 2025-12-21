/**
 * SparseMatrix - Efficient Sparse Matrix Implementation
 * 
 * Uses Map-based storage for assembly and CSR format for computation.
 * Optimized for large structural stiffness matrices.
 */

// ============================================
// TYPES
// ============================================

/**
 * Compressed Sparse Row (CSR) format
 */
export interface CSRMatrix {
    /** Number of rows */
    rows: number;
    /** Number of columns */
    cols: number;
    /** Non-zero values (length = nnz) */
    values: Float64Array;
    /** Column indices for each value (length = nnz) */
    colIndices: Uint32Array;
    /** Row pointers - index where each row starts (length = rows + 1) */
    rowPtrs: Uint32Array;
    /** Number of non-zero elements */
    nnz: number;
}

/**
 * Triplet format entry (for assembly)
 */
interface TripletEntry {
    row: number;
    col: number;
    value: number;
}

// ============================================
// SPARSE MATRIX CLASS
// ============================================

export class SparseMatrix {
    private data: Map<string, number>;
    private _rows: number;
    private _cols: number;

    constructor(rows: number, cols: number) {
        this._rows = rows;
        this._cols = cols;
        this.data = new Map();
    }

    // ========================================
    // ACCESSORS
    // ========================================

    get rows(): number {
        return this._rows;
    }

    get cols(): number {
        return this._cols;
    }

    get nnz(): number {
        return this.data.size;
    }

    // ========================================
    // ELEMENT ACCESS
    // ========================================

    /**
     * Get value at (row, col)
     */
    get(row: number, col: number): number {
        const key = `${row},${col}`;
        return this.data.get(key) ?? 0;
    }

    /**
     * Set value at (row, col)
     * Only stores non-zero values
     */
    set(row: number, col: number, value: number): void {
        if (row < 0 || row >= this._rows || col < 0 || col >= this._cols) {
            throw new Error(`Index out of bounds: (${row}, ${col})`);
        }

        const key = `${row},${col}`;

        if (Math.abs(value) < 1e-15) {
            // Remove zero entries
            this.data.delete(key);
        } else {
            this.data.set(key, value);
        }
    }

    /**
     * Add value to existing entry at (row, col)
     * Efficient for stiffness matrix assembly
     */
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

    // ========================================
    // BULK OPERATIONS
    // ========================================

    /**
     * Add a dense submatrix at specified location
     * Used for element stiffness matrix assembly
     */
    addSubmatrix(
        startRow: number,
        startCol: number,
        submatrix: number[][],
        dofMap?: number[]
    ): void {
        const n = submatrix.length;

        if (dofMap) {
            // Use DOF mapping (for stiffness assembly)
            for (let i = 0; i < n; i++) {
                const globalRow = dofMap[i];
                if (globalRow < 0) continue; // Skip constrained DOFs

                for (let j = 0; j < n; j++) {
                    const globalCol = dofMap[j];
                    if (globalCol < 0) continue;

                    this.add(globalRow, globalCol, submatrix[i][j]);
                }
            }
        } else {
            // Direct placement
            for (let i = 0; i < submatrix.length; i++) {
                for (let j = 0; j < submatrix[i].length; j++) {
                    this.add(startRow + i, startCol + j, submatrix[i][j]);
                }
            }
        }
    }

    /**
     * Clear all entries
     */
    clear(): void {
        this.data.clear();
    }

    // ========================================
    // CSR CONVERSION
    // ========================================

    /**
     * Convert to CSR format for efficient computation
     */
    toCSR(): CSRMatrix {
        // Collect entries and sort by row, then column
        const entries: TripletEntry[] = [];

        for (const [key, value] of this.data) {
            const [row, col] = key.split(',').map(Number);
            entries.push({ row, col, value });
        }

        // Sort by row, then by column
        entries.sort((a, b) => {
            if (a.row !== b.row) return a.row - b.row;
            return a.col - b.col;
        });

        const nnz = entries.length;
        const values = new Float64Array(nnz);
        const colIndices = new Uint32Array(nnz);
        const rowPtrs = new Uint32Array(this._rows + 1);

        // Fill arrays
        let currentRow = 0;
        rowPtrs[0] = 0;

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];

            // Fill row pointers for empty rows
            while (currentRow < entry.row) {
                currentRow++;
                rowPtrs[currentRow] = i;
            }

            values[i] = entry.value;
            colIndices[i] = entry.col;
        }

        // Fill remaining row pointers
        for (let r = currentRow + 1; r <= this._rows; r++) {
            rowPtrs[r] = nnz;
        }

        return {
            rows: this._rows,
            cols: this._cols,
            values,
            colIndices,
            rowPtrs,
            nnz
        };
    }

    /**
     * Create from CSR format
     */
    static fromCSR(csr: CSRMatrix): SparseMatrix {
        const matrix = new SparseMatrix(csr.rows, csr.cols);

        for (let row = 0; row < csr.rows; row++) {
            const start = csr.rowPtrs[row];
            const end = csr.rowPtrs[row + 1];

            for (let i = start; i < end; i++) {
                matrix.set(row, csr.colIndices[i], csr.values[i]);
            }
        }

        return matrix;
    }

    // ========================================
    // MATRIX-VECTOR OPERATIONS (CSR)
    // ========================================

    /**
     * Sparse matrix-vector multiplication: y = A * x
     */
    static csrMultiply(A: CSRMatrix, x: Float64Array): Float64Array {
        const y = new Float64Array(A.rows);

        for (let row = 0; row < A.rows; row++) {
            let sum = 0;
            const start = A.rowPtrs[row];
            const end = A.rowPtrs[row + 1];

            for (let i = start; i < end; i++) {
                sum += A.values[i] * x[A.colIndices[i]];
            }

            y[row] = sum;
        }

        return y;
    }

    /**
     * Matrix-vector multiply using internal data
     */
    multiply(x: number[]): number[] {
        const y = new Array(this._rows).fill(0);

        for (const [key, value] of this.data) {
            const [row, col] = key.split(',').map(Number);
            y[row] += value * x[col];
        }

        return y;
    }

    // ========================================
    // UTILITY
    // ========================================

    /**
     * Get diagonal elements
     */
    getDiagonal(): Float64Array {
        const n = Math.min(this._rows, this._cols);
        const diag = new Float64Array(n);

        for (let i = 0; i < n; i++) {
            diag[i] = this.get(i, i);
        }

        return diag;
    }

    /**
     * Check if matrix is symmetric
     */
    isSymmetric(tolerance: number = 1e-10): boolean {
        for (const [key, value] of this.data) {
            const [row, col] = key.split(',').map(Number);
            const transposed = this.get(col, row);
            if (Math.abs(value - transposed) > tolerance) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get sparsity statistics
     */
    getStats(): { nnz: number; total: number; density: number } {
        const total = this._rows * this._cols;
        return {
            nnz: this.nnz,
            total,
            density: this.nnz / total
        };
    }

    /**
     * Convert to dense array (for debugging small matrices)
     */
    toDense(): number[][] {
        const dense: number[][] = [];

        for (let i = 0; i < this._rows; i++) {
            dense[i] = [];
            for (let j = 0; j < this._cols; j++) {
                dense[i][j] = this.get(i, j);
            }
        }

        return dense;
    }

    /**
     * Create identity matrix
     */
    static identity(n: number): SparseMatrix {
        const matrix = new SparseMatrix(n, n);
        for (let i = 0; i < n; i++) {
            matrix.set(i, i, 1);
        }
        return matrix;
    }

    /**
     * Create from dense array
     */
    static fromDense(dense: number[][]): SparseMatrix {
        const rows = dense.length;
        const cols = dense[0]?.length ?? 0;
        const matrix = new SparseMatrix(rows, cols);

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                if (Math.abs(dense[i][j]) > 1e-15) {
                    matrix.set(i, j, dense[i][j]);
                }
            }
        }

        return matrix;
    }
}

export default SparseMatrix;
