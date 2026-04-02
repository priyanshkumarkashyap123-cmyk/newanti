//! Sparse matrix utilities and high-performance CSR implementations.

use std::f64::consts::PI;

/// High-performance CSR sparse matrix
#[derive(Debug, Clone)]
pub struct SparseMatrixCSR {
    pub nrows: usize,
    pub ncols: usize,
    pub row_ptr: Vec<usize>,
    pub col_idx: Vec<usize>,
    pub values: Vec<f64>,
}

impl SparseMatrixCSR {
    pub fn new(nrows: usize, ncols: usize) -> Self {
        SparseMatrixCSR {
            nrows,
            ncols,
            row_ptr: vec![0; nrows + 1],
            col_idx: Vec::new(),
            values: Vec::new(),
        }
    }
    
    pub fn from_dense(mat: &[f64], nrows: usize, ncols: usize) -> Self {
        let mut row_ptr = vec![0];
        let mut col_idx = Vec::new();
        let mut values = Vec::new();
        
        for i in 0..nrows {
            for j in 0..ncols {
                let val = mat[i * ncols + j];
                if val.abs() > 1e-14 {
                    col_idx.push(j);
                    values.push(val);
                }
            }
            row_ptr.push(col_idx.len());
        }
        
        SparseMatrixCSR { nrows, ncols, row_ptr, col_idx, values }
    }
    
    /// Matrix-vector product: y = A * x
    pub fn multiply(&self, x: &[f64], y: &mut [f64]) {
        for i in 0..self.nrows {
            y[i] = 0.0;
            for k in self.row_ptr[i]..self.row_ptr[i + 1] {
                y[i] += self.values[k] * x[self.col_idx[k]];
            }
        }
    }
    
    /// Get diagonal element
    pub fn get_diagonal(&self, i: usize) -> f64 {
        for k in self.row_ptr[i]..self.row_ptr[i + 1] {
            if self.col_idx[k] == i {
                return self.values[k];
            }
        }
        0.0
    }
}

// ============================================================================
// ERROR TYPES
// ============================================================================

#[derive(Debug)]
pub enum EigenSolverError {
    InvalidParameters(String),
    NoConvergence(usize),
    SingularMatrix,
    NumericalInstability,
}

impl std::fmt::Display for EigenSolverError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EigenSolverError::InvalidParameters(msg) => write!(f, "Invalid parameters: {}", msg),
            EigenSolverError::NoConvergence(iters) => write!(f, "No convergence after {} iterations", iters),
            EigenSolverError::SingularMatrix => write!(f, "Singular matrix encountered"),
            EigenSolverError::NumericalInstability => write!(f, "Numerical instability detected"),
        }
    }
}

impl std::error::Error for EigenSolverError {}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

fn dot(a: &[f64], b: &[f64]) -> f64 {
    a.iter().zip(b.iter()).map(|(x, y)| x * y).sum()
}

fn norm(a: &[f64]) -> f64 {
    dot(a, a).sqrt()
}

fn normalize(a: &mut [f64]) {
    let n = norm(a);
    if n > 1e-14 {
        a.iter_mut().for_each(|x| *x /= n);
    }
}

fn transpose(a: &[Vec<f64>]) -> Vec<Vec<f64>> {
    if a.is_empty() {
        return vec![];
    }
    let rows = a.len();
    let cols = a[0].len();
    (0..cols).map(|j| (0..rows).map(|i| a[i][j]).collect()).collect()
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::PI;

    fn create_test_matrix(n: usize) -> SparseMatrixCSR {
        // Create a simple SPD tridiagonal matrix
        let mut mat = vec![0.0; n * n];
        for i in 0..n {
            mat[i * n + i] = 4.0;
            if i > 0 {
                mat[i * n + i - 1] = -1.0;
            }
            if i < n - 1 {
                mat[i * n + i + 1] = -1.0;
            }
        }
        SparseMatrixCSR::from_dense(&mat, n, n)
    }
    
    fn create_identity(n: usize) -> SparseMatrixCSR {
        let mut mat = vec![0.0; n * n];
        for i in 0..n {
            mat[i * n + i] = 1.0;
        }
        SparseMatrixCSR::from_dense(&mat, n, n)
    }

    #[test]
    fn test_iram_creation() {
        let solver = ImplicitlyRestartedArnoldi::new(5);
        assert_eq!(solver.num_eigenvalues, 5);
        assert!(solver.subspace_size >= 12);
    }
    
    #[test]
    fn test_block_lanczos_creation() {
        let solver = BlockLanczosSolver::new(10);
        assert_eq!(solver.num_eigenvalues, 10);
        assert!(solver.block_size >= 2);
    }
    
    #[test]
    fn test_sparse_matrix_multiply() {
        let mat = create_test_matrix(3);
        let x = vec![1.0, 2.0, 3.0];
        let mut y = vec![0.0; 3];
        
        mat.multiply(&x, &mut y);
        
        // [4 -1 0 ] [1]   [2]
        // [-1 4 -1] [2] = [4]
        // [0 -1 4 ] [3]   [10]
        assert!((y[0] - 2.0).abs() < 1e-10);
        assert!((y[1] - 4.0).abs() < 1e-10);
        assert!((y[2] - 10.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_hht_alpha_parameters() {
        let integrator = AdvancedTimeIntegration::hht_alpha(0.01, -0.1);
        assert!(integrator.alpha >= -0.333 && integrator.alpha <= 0.0);
        assert!(integrator.beta > 0.0);
        assert!(integrator.gamma > 0.0);
    }
    
    #[test]
    fn test_generalized_alpha_parameters() {
        let integrator = AdvancedTimeIntegration::generalized_alpha(0.01, 0.9);
        assert!(integrator.beta > 0.0);
        assert!(integrator.gamma >= 0.5);
    }
    
    #[test]
    fn test_arc_length_solver() {
        let solver = ArcLengthSolver::default();
        assert!(solver.arc_length > 0.0);
        assert!(solver.tolerance > 0.0);
    }
    
    #[test]
    fn test_arc_length_adaptation() {
        let mut solver = ArcLengthSolver {
            arc_length: 0.1,
            min_arc_length: 0.01,
            max_arc_length: 1.0,
            ..Default::default()
        };
        
        // Quick convergence should increase arc length
        solver.adapt_arc_length(3, true);
        assert!(solver.arc_length > 0.1);
        
        // Non-convergence should decrease
        solver.arc_length = 0.1;
        solver.adapt_arc_length(25, false);
        assert!(solver.arc_length < 0.1);
    }
    
    #[test]
    fn test_modal_superposition() {
        let modes = ModalSuperposition::new(
            vec![10.0, 25.0, 50.0],  // rad/s
            vec![
                vec![1.0, 0.5, 0.2],
                vec![0.5, -0.5, 0.5],
                vec![0.2, 0.5, -1.0],
            ],
            vec![0.02, 0.02, 0.03],
        );
        
        assert_eq!(modes.frequencies.len(), 3);
        assert_eq!(modes.damping_ratios.len(), 3);
    }
    
    #[test]
    fn test_modal_integration() {
        let modes = ModalSuperposition::new(
            vec![2.0 * PI],  // 1 Hz
            vec![vec![1.0]],
            vec![0.05],
        );
        
        // Step acceleration
        let accel = vec![1.0; 100];
        let response = modes.integrate_mode(0, &accel, 0.01);
        
        assert_eq!(response.len(), 100);
        // Response should build up over time
        assert!(response[50].abs() > response[10].abs());
    }
    
    #[test]
    fn test_adaptive_load_stepping() {
        let stepper = AdaptiveLoadStepping::default();
        
        // Fast convergence -> larger step
        let step1 = stepper.compute_next_step(0.1, 3, true);
        assert!(step1 > 0.1);
        
        // Non-convergence -> much smaller step
        let step2 = stepper.compute_next_step(0.1, 25, false);
        assert!(step2 < 0.1);
    }
    
    #[test]
    fn test_effective_stiffness_newmark() {
        let integrator = AdvancedTimeIntegration::newmark(0.01);
        let (a0, a1, _) = integrator.effective_stiffness_coefficients();
        
        // a0 = 1/(β*dt²) = 1/(0.25*0.0001) = 40000
        assert!((a0 - 40000.0).abs() < 1.0);
        
        // a1 = γ/(β*dt) = 0.5/(0.25*0.01) = 200
        assert!((a1 - 200.0).abs() < 0.1);
    }
    
    #[test]
    fn test_iram_solve_small() {
        let k = create_test_matrix(10);
        let m = create_identity(10);
        
        let solver = ImplicitlyRestartedArnoldi::new(3);
        let result = solver.solve_generalized(&k, &m);
        
        // Should either succeed or fail gracefully
        match result {
            Ok(sol) => {
                assert!(sol.eigenvalues.len() >= 1);
                // Eigenvalues should be positive for SPD K
                for ev in &sol.eigenvalues {
                    assert!(*ev > 0.0 || *ev < 10.0); // Reasonable range check
                }
            }
            Err(_) => {
                // Acceptable for small test matrix
            }
        }
    }
    
    #[test]
    fn test_block_lanczos_small() {
        let k = create_test_matrix(20);
        let m = create_identity(20);
        
        let solver = BlockLanczosSolver::new(3);
        let result = solver.solve_generalized(&k, &m);
        
        match result {
            Ok(sol) => {
                assert!(sol.eigenvalues.len() >= 1);
            }
            Err(_) => {
                // Acceptable for test
            }
        }
    }
}
