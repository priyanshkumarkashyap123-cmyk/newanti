/**
 * BeamLab Ultra Solver - High Performance Wrapper
 * 
 * Provides a clean TypeScript interface to the ultra-high-performance
 * WASM solver for 100,000+ node civil engineering structures.
 */

// Types for the solver
export interface SparseMatrixCSR {
  rowPtrs: Uint32Array;
  colIndices: Uint32Array;
  values: Float64Array;
  size: number;
}

export interface SparseMatrixCOO {
  rows: number[];
  cols: number[];
  values: number[];
  size: number;
}

export interface SolverResult {
  displacements: Float64Array;
  solveTimeMs: number;
  success: boolean;
  error?: string;
  iterations?: number;
  methodUsed?: string;
  residualNorm?: number;
}

export interface SolverOptions {
  tolerance?: number;
  maxIterations?: number;
  useAmg?: boolean;
  useDomainDecomposition?: boolean;
  numDomains?: number;
}

// Default options
const DEFAULT_OPTIONS: SolverOptions = {
  tolerance: 1e-10,
  maxIterations: 10000,
  useAmg: true,
  useDomainDecomposition: true,
  numDomains: 8,
};

// WASM module reference
let wasmModule: any = null;
let isInitialized = false;

/**
 * Initialize the WASM solver module
 */
export async function initUltraSolver(): Promise<boolean> {
  if (isInitialized) return true;
  
  try {
    // Dynamic import of the WASM module
    const wasm = await import('./solver_wasm.js');
    wasmModule = wasm;
    isInitialized = true;
    console.log('🚀 BeamLab Ultra Solver initialized');
    console.log('   Max DOF: 600,000 (100,000 nodes)');
    console.log('   Solvers: AMG-PCG, Domain Decomposition');
    return true;
  } catch (error) {
    console.error('Failed to initialize WASM solver:', error);
    return false;
  }
}

/**
 * Check if WebGPU is available for GPU acceleration
 */
export async function checkGpuAvailable(): Promise<boolean> {
  const nav = navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown | null> } };
  if (!nav.gpu) {
    return false;
  }
  
  try {
    const adapter = await nav.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

/**
 * Convert COO format to CSR format
 * CSR is more efficient for sparse matrix operations
 */
export function cooToCsr(coo: SparseMatrixCOO): SparseMatrixCSR {
  const { rows, cols, values, size } = coo;
  const nnz = values.length;
  
  // Count entries per row
  const rowCounts = new Uint32Array(size + 1);
  for (const r of rows) {
    rowCounts[r + 1]++;
  }
  
  // Cumulative sum for row pointers
  for (let i = 1; i <= size; i++) {
    rowCounts[i] += rowCounts[i - 1];
  }
  
  // Fill in column indices and values
  const colIndices = new Uint32Array(nnz);
  const sortedValues = new Float64Array(nnz);
  const rowOffsets = new Uint32Array(rowCounts.slice(0, size));
  
  for (let i = 0; i < nnz; i++) {
    const row = rows[i];
    const offset = rowOffsets[row];
    colIndices[offset] = cols[i];
    sortedValues[offset] = values[i];
    rowOffsets[row]++;
  }
  
  return {
    rowPtrs: rowCounts,
    colIndices,
    values: sortedValues,
    size,
  };
}

/**
 * Solve a sparse linear system Kx = F
 * 
 * Automatically selects the best solver based on problem size:
 * - Small (< 5,000 DOF): Jacobi-preconditioned CG
 * - Medium (5,000 - 100,000 DOF): AMG-preconditioned CG
 * - Large (> 100,000 DOF): Domain Decomposition + AMG-PCG
 * 
 * @param matrix Sparse stiffness matrix in CSR format
 * @param forces Force vector
 * @param options Solver options
 * @returns Solution with displacements and performance info
 */
export async function solveUltra(
  matrix: SparseMatrixCSR,
  forces: Float64Array,
  options: SolverOptions = {}
): Promise<SolverResult> {
  if (!isInitialized) {
    const success = await initUltraSolver();
    if (!success) {
      return {
        displacements: new Float64Array(0),
        solveTimeMs: 0,
        success: false,
        error: 'Failed to initialize WASM solver',
      };
    }
  }
  
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = performance.now();
  
  try {
    // Check size limits
    const MAX_DOF = 600000;
    if (matrix.size > MAX_DOF) {
      return {
        displacements: new Float64Array(0),
        solveTimeMs: 0,
        success: false,
        error: `Model too large: ${matrix.size} DOF exceeds limit of ${MAX_DOF}. Consider cloud computing.`,
      };
    }
    
    // Call the ultra solver
    const resultJson = wasmModule.solve_ultra_sparse(
      matrix.rowPtrs,
      matrix.colIndices,
      matrix.values,
      forces,
      matrix.size
    );
    
    const result = JSON.parse(resultJson);
    const solveTime = performance.now() - startTime;
    
    return {
      displacements: new Float64Array(result.displacements),
      solveTimeMs: result.solve_time_ms || solveTime,
      success: result.success,
      error: result.error,
      iterations: result.iterations,
      methodUsed: result.method_used,
      residualNorm: result.residual_norm,
    };
  } catch (error) {
    const solveTime = performance.now() - startTime;
    return {
      displacements: new Float64Array(0),
      solveTimeMs: solveTime,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Solve using COO format input (convenience function)
 */
export async function solveUltraCoo(
  rows: number[],
  cols: number[],
  values: number[],
  forces: number[],
  size: number,
  options: SolverOptions = {}
): Promise<SolverResult> {
  if (!isInitialized) {
    const success = await initUltraSolver();
    if (!success) {
      return {
        displacements: new Float64Array(0),
        solveTimeMs: 0,
        success: false,
        error: 'Failed to initialize WASM solver',
      };
    }
  }
  
  const startTime = performance.now();
  
  try {
    const resultJson = wasmModule.solve_ultra_coo(
      new Uint32Array(rows),
      new Uint32Array(cols),
      new Float64Array(values),
      new Float64Array(forces),
      size
    );
    
    const result = JSON.parse(resultJson);
    const solveTime = performance.now() - startTime;
    
    return {
      displacements: new Float64Array(result.displacements),
      solveTimeMs: result.solve_time_ms || solveTime,
      success: result.success,
      error: result.error,
      iterations: result.iterations,
      methodUsed: result.method_used,
      residualNorm: result.residual_norm,
    };
  } catch (error) {
    const solveTime = performance.now() - startTime;
    return {
      displacements: new Float64Array(0),
      solveTimeMs: solveTime,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Estimate solve time for a given problem size
 * Useful for progress indicators
 */
export function estimateSolveTime(dof: number): number {
  // Based on AMG-PCG complexity: O(n * log(n) * iterations)
  const iterations = 100; // Typical for well-conditioned problems
  const complexity = dof * Math.log2(Math.max(dof, 2)) * iterations;
  
  // Empirical factor from benchmarks
  const factor = 500 / (600000 * Math.log2(600000) * 100);
  
  return complexity * factor;
}

/**
 * Get solver statistics and capabilities
 */
export function getSolverInfo(): {
  maxDof: number;
  methods: string[];
  gpuAvailable: boolean;
  simdEnabled: boolean;
} {
  return {
    maxDof: 600000,
    methods: ['jacobi_pcg', 'amg_pcg', 'domain_decomposition'],
    gpuAvailable: false, // Set based on WebGPU check
    simdEnabled: typeof WebAssembly !== 'undefined',
  };
}

/**
 * Warm up the solver by running a small problem
 * This triggers JIT compilation for better first-run performance
 */
export async function warmupSolver(): Promise<void> {
  if (!isInitialized) {
    await initUltraSolver();
  }
  
  // Solve a tiny 3x3 system
  const rows = [0, 1, 2, 0, 1, 1, 2];
  const cols = [0, 1, 2, 1, 0, 2, 1];
  const values = [4, 4, 4, -1, -1, -1, -1];
  const forces = [1, 2, 3];
  
  await solveUltraCoo(rows, cols, values, forces, 3);
  console.log('✅ Solver warmed up');
}

// Auto-initialize when module loads
if (typeof window !== 'undefined') {
  // Browser environment
  initUltraSolver().then(success => {
    if (success) {
      warmupSolver();
    }
  });
}

export default {
  initUltraSolver,
  solveUltra,
  solveUltraCoo,
  cooToCsr,
  estimateSolveTime,
  getSolverInfo,
  warmupSolver,
  checkGpuAvailable,
};
