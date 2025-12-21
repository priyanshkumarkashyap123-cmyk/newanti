/**
 * Math Package Index
 * 
 * Exports all sparse matrix and solver utilities.
 */

// Sparse matrix
export { SparseMatrix, type CSRMatrix } from './SparseMatrix';

// Iterative solvers
export {
    conjugateGradient,
    biCGSTAB,
    solveSparse,
    sparseSolve,
    type CGOptions,
    type CGResult,
    type SparseSolverOptions
} from './ConjugateGradient';

// Stiffness assembler
export {
    SparseStiffnessAssembler,
    type Node,
    type Member,
    type NodalLoad,
    type AnalysisInput,
    type AnalysisResult
} from './SparseStiffnessAssembler';
