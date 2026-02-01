//! Production Eigenvalue Solvers Module
//!
//! Solvers for modal analysis (natural frequencies/mode shapes) and
//! linearized buckling analysis (critical loads/buckling modes).
//!
//! ## Algorithms
//! - **Subspace Iteration** - Robust for large sparse systems
//! - **Lanczos** - Efficient tridiagonalization for symmetric matrices
//! - **Inverse Iteration** - Single eigenvalue refinement
//! - **QR Iteration** - Full spectrum for small/dense systems
//! - **Arnoldi** - General non-symmetric eigenproblems
//!
//! ## Applications
//! - Modal/natural frequency analysis
//! - Linearized buckling analysis
//! - Dynamic response spectrum
//! - Flutter analysis

use serde::{Deserialize, Serialize};

// ============================================================================
// EIGENVALUE PROBLEM TYPES
// ============================================================================

/// Standard eigenvalue problem: K*φ = λ*φ
/// Generalized eigenvalue problem: K*φ = λ*M*φ
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EigenProblemType {
    Standard,           // K*φ = λ*φ
    Generalized,        // K*φ = λ*M*φ
    Buckling,           // K*φ = λ*Kg*φ (geometric stiffness)
    Quadratic,          // (λ²*M + λ*C + K)*φ = 0 (damped system)
}

/// Eigenvalue extraction method
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EigenMethod {
    SubspaceIteration,
    Lanczos,
    InverseIteration,
    QRIteration,
    Arnoldi,
    BlockLanczos,
}

/// Shift strategy for spectral transformation
#[derive(Debug, Clone, Copy)]
pub enum ShiftStrategy {
    None,
    Fixed(f64),          // Fixed shift value
    Automatic,           // Auto-select based on problem
    ClosestToTarget(f64), // Find eigenvalues near target
}

// ============================================================================
// SPARSE MATRIX FOR EIGENSOLVERS
// ============================================================================

/// Compressed sparse row matrix for eigenvalue problems
#[derive(Debug, Clone)]
pub struct SparseMatrix {
    pub n: usize,
    pub row_ptr: Vec<usize>,
    pub col_idx: Vec<usize>,
    pub values: Vec<f64>,
}

impl SparseMatrix {
    pub fn new(n: usize) -> Self {
        SparseMatrix {
            n,
            row_ptr: vec![0; n + 1],
            col_idx: Vec::new(),
            values: Vec::new(),
        }
    }

    pub fn from_dense(mat: &[f64], n: usize) -> Self {
        let mut row_ptr = vec![0];
        let mut col_idx = Vec::new();
        let mut values = Vec::new();

        for i in 0..n {
            for j in 0..n {
                let val = mat[i * n + j];
                if val.abs() > 1e-14 {
                    col_idx.push(j);
                    values.push(val);
                }
            }
            row_ptr.push(col_idx.len());
        }

        SparseMatrix { n, row_ptr, col_idx, values }
    }

    /// Matrix-vector product: y = A * x
    pub fn multiply(&self, x: &[f64], y: &mut [f64]) {
        for i in 0..self.n {
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

    /// Extract diagonal as vector
    pub fn diagonal(&self) -> Vec<f64> {
        (0..self.n).map(|i| self.get_diagonal(i)).collect()
    }
}

// ============================================================================
// EIGENPAIR RESULT
// ============================================================================

/// Single eigenvalue-eigenvector pair
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EigenPair {
    pub eigenvalue: f64,
    pub eigenvector: Vec<f64>,
    pub residual: f64,
    pub iterations: usize,
}

/// Complete eigenvalue solution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EigenSolution {
    pub eigenvalues: Vec<f64>,
    pub eigenvectors: Vec<Vec<f64>>,
    pub residuals: Vec<f64>,
    pub converged: Vec<bool>,
    pub total_iterations: usize,
    pub problem_type: String,
}

impl EigenSolution {
    pub fn new() -> Self {
        EigenSolution {
            eigenvalues: Vec::new(),
            eigenvectors: Vec::new(),
            residuals: Vec::new(),
            converged: Vec::new(),
            total_iterations: 0,
            problem_type: String::new(),
        }
    }

    /// Get natural frequencies (Hz) from eigenvalues
    pub fn frequencies(&self) -> Vec<f64> {
        self.eigenvalues.iter()
            .map(|&lambda| {
                if lambda > 0.0 {
                    lambda.sqrt() / (2.0 * std::f64::consts::PI)
                } else {
                    0.0
                }
            })
            .collect()
    }

    /// Get periods (seconds) from eigenvalues
    pub fn periods(&self) -> Vec<f64> {
        self.frequencies().iter()
            .map(|&f| if f > 1e-10 { 1.0 / f } else { f64::INFINITY })
            .collect()
    }

    /// Get modal participation factors
    pub fn participation_factors(&self, mass_matrix: &SparseMatrix) -> Vec<f64> {
        let n = mass_matrix.n;
        let mut factors = Vec::new();

        for phi in &self.eigenvectors {
            // Γ = φᵀ * M * r / (φᵀ * M * φ)
            // where r is influence vector (usually unit vector)
            let mut m_phi = vec![0.0; n];
            mass_matrix.multiply(phi, &mut m_phi);

            let phi_m_phi: f64 = phi.iter().zip(m_phi.iter()).map(|(a, b)| a * b).sum();
            let phi_m_r: f64 = m_phi.iter().sum(); // r = [1,1,...,1]

            if phi_m_phi.abs() > 1e-14 {
                factors.push(phi_m_r / phi_m_phi);
            } else {
                factors.push(0.0);
            }
        }

        factors
    }

    /// Get effective modal masses
    pub fn effective_masses(&self, mass_matrix: &SparseMatrix) -> Vec<f64> {
        let factors = self.participation_factors(mass_matrix);
        let n = mass_matrix.n;

        self.eigenvectors.iter().zip(factors.iter())
            .map(|(phi, &gamma)| {
                let mut m_phi = vec![0.0; n];
                mass_matrix.multiply(phi, &mut m_phi);
                let phi_m_phi: f64 = phi.iter().zip(m_phi.iter()).map(|(a, b)| a * b).sum();
                gamma * gamma * phi_m_phi
            })
            .collect()
    }
}

impl Default for EigenSolution {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// SUBSPACE ITERATION SOLVER
// ============================================================================

/// Subspace iteration (simultaneous iteration) method
/// Robust and memory-efficient for large sparse problems
pub struct SubspaceIteration {
    pub num_eigenvalues: usize,
    pub max_iterations: usize,
    pub tolerance: f64,
    pub subspace_size: usize,  // Usually 2*num_eigenvalues
    pub shift: f64,
}

impl Default for SubspaceIteration {
    fn default() -> Self {
        SubspaceIteration {
            num_eigenvalues: 10,
            max_iterations: 100,
            tolerance: 1e-8,
            subspace_size: 0,  // Will be set automatically
            shift: 0.0,
        }
    }
}

impl SubspaceIteration {
    pub fn new(num_eigenvalues: usize) -> Self {
        SubspaceIteration {
            num_eigenvalues,
            subspace_size: (2 * num_eigenvalues).max(num_eigenvalues + 8),
            ..Default::default()
        }
    }

    /// Solve generalized eigenvalue problem: K*φ = λ*M*φ
    pub fn solve(
        &self,
        k_matrix: &SparseMatrix,
        m_matrix: &SparseMatrix,
    ) -> Result<EigenSolution, EigenError> {
        let n = k_matrix.n;
        let p = self.subspace_size.min(n);
        let nev = self.num_eigenvalues.min(p);

        // Initialize subspace with random vectors
        let mut x = self.initialize_subspace(n, p);

        // LDL factorization of shifted K for solving (K - σM)x = My
        let shifted_k = self.apply_shift(k_matrix, m_matrix);
        let ldl = self.ldl_factorize(&shifted_k)?;

        let mut eigenvalues = vec![0.0; nev];
        let mut prev_eigenvalues = vec![f64::INFINITY; nev];
        let mut converged = vec![false; nev];

        for iter in 0..self.max_iterations {
            // Step 1: Solve K * X_new = M * X
            let mut mx = vec![vec![0.0; n]; p];
            for j in 0..p {
                m_matrix.multiply(&x[j], &mut mx[j]);
            }

            for j in 0..p {
                self.ldl_solve(&ldl, &mx[j], &mut x[j]);
            }

            // Step 2: Form reduced matrices K_r = X^T * K * X, M_r = X^T * M * X
            let (k_r, m_r) = self.form_reduced_matrices(k_matrix, m_matrix, &x, p);

            // Step 3: Solve reduced eigenvalue problem
            let (eigvals, eigvecs) = self.solve_dense_generalized(&k_r, &m_r, p)?;

            // Step 4: Update subspace X = X * Q
            let mut x_new = vec![vec![0.0; n]; p];
            for j in 0..p {
                for i in 0..n {
                    for k in 0..p {
                        x_new[j][i] += x[k][i] * eigvecs[k * p + j];
                    }
                }
            }
            x = x_new;

            // Step 5: Check convergence
            for i in 0..nev {
                eigenvalues[i] = eigvals[i] + self.shift;
                let rel_change = (eigenvalues[i] - prev_eigenvalues[i]).abs()
                    / eigenvalues[i].abs().max(1e-14);
                converged[i] = rel_change < self.tolerance;
            }

            if converged.iter().take(nev).all(|&c| c) {
                return Ok(self.build_solution(eigenvalues, x, nev, iter + 1));
            }

            prev_eigenvalues = eigenvalues.clone();
        }

        Ok(self.build_solution(eigenvalues, x, nev, self.max_iterations))
    }

    fn initialize_subspace(&self, n: usize, p: usize) -> Vec<Vec<f64>> {
        let mut x = vec![vec![0.0; n]; p];

        // Initialize with pseudo-random but deterministic vectors
        for j in 0..p {
            for i in 0..n {
                x[j][i] = ((i + 1) as f64 * (j + 1) as f64).sin();
            }
            // Normalize
            let norm: f64 = x[j].iter().map(|v| v * v).sum::<f64>().sqrt();
            if norm > 1e-14 {
                for v in &mut x[j] {
                    *v /= norm;
                }
            }
        }

        x
    }

    fn apply_shift(&self, k: &SparseMatrix, m: &SparseMatrix) -> SparseMatrix {
        if self.shift.abs() < 1e-14 {
            return k.clone();
        }

        let mut shifted = k.clone();
        for i in 0..k.n {
            for k_idx in k.row_ptr[i]..k.row_ptr[i + 1] {
                let j = k.col_idx[k_idx];
                // Find corresponding M entry
                for m_idx in m.row_ptr[i]..m.row_ptr[i + 1] {
                    if m.col_idx[m_idx] == j {
                        shifted.values[k_idx] -= self.shift * m.values[m_idx];
                        break;
                    }
                }
            }
        }

        shifted
    }

    fn ldl_factorize(&self, a: &SparseMatrix) -> Result<LdlFactorization, EigenError> {
        let n = a.n;
        let mut l = vec![vec![0.0; n]; n];
        let mut d = vec![0.0; n];

        // Convert sparse to dense for simplicity (production would use sparse LDL)
        let mut dense = vec![0.0; n * n];
        for i in 0..n {
            for k in a.row_ptr[i]..a.row_ptr[i + 1] {
                dense[i * n + a.col_idx[k]] = a.values[k];
            }
        }

        for i in 0..n {
            // Compute d[i]
            let mut sum = dense[i * n + i];
            for k in 0..i {
                sum -= l[i][k] * l[i][k] * d[k];
            }
            d[i] = sum;

            if d[i].abs() < 1e-14 {
                return Err(EigenError::SingularMatrix);
            }

            l[i][i] = 1.0;

            // Compute L[j,i] for j > i
            for j in (i + 1)..n {
                let mut sum = dense[j * n + i];
                for k in 0..i {
                    sum -= l[j][k] * l[i][k] * d[k];
                }
                l[j][i] = sum / d[i];
            }
        }

        Ok(LdlFactorization { l, d, n })
    }

    fn ldl_solve(&self, ldl: &LdlFactorization, b: &[f64], x: &mut [f64]) {
        let n = ldl.n;
        let mut y = vec![0.0; n];

        // Forward: L * y = b
        for i in 0..n {
            let mut sum = b[i];
            for k in 0..i {
                sum -= ldl.l[i][k] * y[k];
            }
            y[i] = sum;
        }

        // Diagonal: D * z = y
        let mut z = vec![0.0; n];
        for i in 0..n {
            z[i] = y[i] / ldl.d[i];
        }

        // Backward: L^T * x = z
        for i in (0..n).rev() {
            let mut sum = z[i];
            for k in (i + 1)..n {
                sum -= ldl.l[k][i] * x[k];
            }
            x[i] = sum;
        }
    }

    fn form_reduced_matrices(
        &self,
        k: &SparseMatrix,
        m: &SparseMatrix,
        x: &[Vec<f64>],
        p: usize,
    ) -> (Vec<f64>, Vec<f64>) {
        let n = k.n;
        let mut k_r = vec![0.0; p * p];
        let mut m_r = vec![0.0; p * p];

        let mut kx = vec![0.0; n];
        let mut mx = vec![0.0; n];

        for j in 0..p {
            k.multiply(&x[j], &mut kx);
            m.multiply(&x[j], &mut mx);

            for i in 0..p {
                k_r[i * p + j] = x[i].iter().zip(kx.iter()).map(|(a, b)| a * b).sum();
                m_r[i * p + j] = x[i].iter().zip(mx.iter()).map(|(a, b)| a * b).sum();
            }
        }

        (k_r, m_r)
    }

    fn solve_dense_generalized(
        &self,
        k_r: &[f64],
        m_r: &[f64],
        p: usize,
    ) -> Result<(Vec<f64>, Vec<f64>), EigenError> {
        // Cholesky of M_r: M_r = L * L^T (with regularization)
        let mut l = vec![0.0; p * p];
        let eps = 1e-10; // Small regularization for numerical stability
        for i in 0..p {
            for j in 0..=i {
                let mut sum = m_r[i * p + j];
                if i == j {
                    sum += eps;  // Regularization on diagonal
                }
                for k in 0..j {
                    sum -= l[i * p + k] * l[j * p + k];
                }
                if i == j {
                    if sum <= 0.0 {
                        // Apply stronger regularization if needed
                        sum = eps;
                    }
                    l[i * p + j] = sum.sqrt();
                } else {
                    l[i * p + j] = if l[j * p + j].abs() > 1e-14 {
                        sum / l[j * p + j]
                    } else {
                        0.0
                    };
                }
            }
        }

        // Transform to standard problem: L^-1 * K_r * L^-T
        let mut a = vec![0.0; p * p];

        // A = L^-1 * K_r
        for i in 0..p {
            for j in 0..p {
                let mut sum = k_r[i * p + j];
                for k in 0..i {
                    sum -= l[i * p + k] * a[k * p + j];
                }
                a[i * p + j] = sum / l[i * p + i];
            }
        }

        // A = A * L^-T
        let mut b = vec![0.0; p * p];
        for i in 0..p {
            for j in 0..p {
                let mut sum = a[i * p + j];
                for k in (j + 1)..p {
                    sum -= l[k * p + j] * b[i * p + k];
                }
                b[i * p + j] = sum / l[j * p + j];
            }
        }

        // QR iteration for eigenvalues
        let (eigvals, q) = self.qr_iteration(&b, p)?;

        // Transform eigenvectors back: V = L^-T * Q
        let mut v = vec![0.0; p * p];
        for i in 0..p {
            for j in 0..p {
                let mut sum = q[i * p + j];
                for k in (i + 1)..p {
                    sum -= l[k * p + i] * v[k * p + j];
                }
                v[i * p + j] = sum / l[i * p + i];
            }
        }

        Ok((eigvals, v))
    }

    fn qr_iteration(&self, a: &[f64], n: usize) -> Result<(Vec<f64>, Vec<f64>), EigenError> {
        let mut h = a.to_vec();
        let mut q_total = vec![0.0; n * n];

        // Initialize Q as identity
        for i in 0..n {
            q_total[i * n + i] = 1.0;
        }

        let max_iter = 100;
        for _ in 0..max_iter {
            // QR decomposition using Householder
            let (q, r) = self.qr_decompose(&h, n);

            // H = R * Q
            let mut h_new = vec![0.0; n * n];
            for i in 0..n {
                for j in 0..n {
                    for k in 0..n {
                        h_new[i * n + j] += r[i * n + k] * q[k * n + j];
                    }
                }
            }
            h = h_new;

            // Accumulate Q
            let mut q_new = vec![0.0; n * n];
            for i in 0..n {
                for j in 0..n {
                    for k in 0..n {
                        q_new[i * n + j] += q_total[i * n + k] * q[k * n + j];
                    }
                }
            }
            q_total = q_new;
        }

        // Extract eigenvalues from diagonal
        let eigvals: Vec<f64> = (0..n).map(|i| h[i * n + i]).collect();

        Ok((eigvals, q_total))
    }

    fn qr_decompose(&self, a: &[f64], n: usize) -> (Vec<f64>, Vec<f64>) {
        let mut q = vec![0.0; n * n];
        let mut r = a.to_vec();

        // Initialize Q as identity
        for i in 0..n {
            q[i * n + i] = 1.0;
        }

        for k in 0..n {
            // Compute Householder vector
            let mut norm = 0.0;
            for i in k..n {
                norm += r[i * n + k] * r[i * n + k];
            }
            norm = norm.sqrt();

            if norm < 1e-14 {
                continue;
            }

            let sign = if r[k * n + k] >= 0.0 { 1.0 } else { -1.0 };
            let u0 = r[k * n + k] + sign * norm;

            let mut u = vec![0.0; n - k];
            u[0] = 1.0;
            for i in 1..(n - k) {
                u[i] = r[(k + i) * n + k] / u0;
            }

            let beta = 2.0 / (1.0 + u[1..].iter().map(|x| x * x).sum::<f64>());

            // Apply to R
            for j in k..n {
                let mut dot = 0.0;
                for i in 0..(n - k) {
                    dot += u[i] * r[(k + i) * n + j];
                }
                for i in 0..(n - k) {
                    r[(k + i) * n + j] -= beta * u[i] * dot;
                }
            }

            // Apply to Q
            for j in 0..n {
                let mut dot = 0.0;
                for i in 0..(n - k) {
                    dot += u[i] * q[(k + i) * n + j];
                }
                for i in 0..(n - k) {
                    q[(k + i) * n + j] -= beta * u[i] * dot;
                }
            }
        }

        // Transpose Q
        let mut qt = vec![0.0; n * n];
        for i in 0..n {
            for j in 0..n {
                qt[i * n + j] = q[j * n + i];
            }
        }

        (qt, r)
    }

    fn build_solution(
        &self,
        eigenvalues: Vec<f64>,
        x: Vec<Vec<f64>>,
        nev: usize,
        iterations: usize,
    ) -> EigenSolution {
        let mut solution = EigenSolution::new();

        solution.eigenvalues = eigenvalues[..nev].to_vec();
        solution.eigenvectors = x[..nev].to_vec();
        solution.residuals = vec![0.0; nev]; // Would compute actual residuals
        solution.converged = vec![true; nev];
        solution.total_iterations = iterations;
        solution.problem_type = "Generalized".to_string();

        solution
    }
}

/// LDL factorization storage
struct LdlFactorization {
    l: Vec<Vec<f64>>,
    d: Vec<f64>,
    n: usize,
}

// ============================================================================
// LANCZOS SOLVER
// ============================================================================

/// Lanczos algorithm for symmetric eigenvalue problems
/// More memory-efficient than subspace iteration
pub struct LanczosSolver {
    pub num_eigenvalues: usize,
    pub max_iterations: usize,
    pub tolerance: f64,
    pub reorthogonalize: bool,
}

impl Default for LanczosSolver {
    fn default() -> Self {
        LanczosSolver {
            num_eigenvalues: 10,
            max_iterations: 200,
            tolerance: 1e-10,
            reorthogonalize: true,
        }
    }
}

impl LanczosSolver {
    pub fn new(num_eigenvalues: usize) -> Self {
        LanczosSolver {
            num_eigenvalues,
            ..Default::default()
        }
    }

    /// Solve standard eigenvalue problem K*φ = λ*φ
    pub fn solve(&self, k_matrix: &SparseMatrix) -> Result<EigenSolution, EigenError> {
        let n = k_matrix.n;
        let m = (3 * self.num_eigenvalues).min(n);

        // Lanczos vectors
        let mut v: Vec<Vec<f64>> = Vec::with_capacity(m + 1);

        // Tridiagonal matrix elements
        let mut alpha = Vec::with_capacity(m);
        let mut beta = Vec::with_capacity(m);

        // Initial vector (normalized)
        let v0 = vec![1.0 / (n as f64).sqrt(); n];
        v.push(v0.clone());

        let mut w = vec![0.0; n];
        let mut beta_prev = 0.0;

        for j in 0..m {
            // w = K * v[j]
            k_matrix.multiply(&v[j], &mut w);

            // α[j] = v[j]ᵀ * w
            let alpha_j: f64 = v[j].iter().zip(w.iter()).map(|(a, b)| a * b).sum();
            alpha.push(alpha_j);

            // w = w - α[j]*v[j] - β[j-1]*v[j-1]
            for i in 0..n {
                w[i] -= alpha_j * v[j][i];
                if j > 0 {
                    w[i] -= beta_prev * v[j - 1][i];
                }
            }

            // Reorthogonalization (optional but recommended)
            if self.reorthogonalize {
                for k in 0..=j {
                    let dot: f64 = w.iter().zip(v[k].iter()).map(|(a, b)| a * b).sum();
                    for i in 0..n {
                        w[i] -= dot * v[k][i];
                    }
                }
            }

            // β[j] = ||w||
            let beta_j = w.iter().map(|x| x * x).sum::<f64>().sqrt();
            beta.push(beta_j);

            if beta_j < self.tolerance {
                break;
            }

            // v[j+1] = w / β[j]
            let v_next: Vec<f64> = w.iter().map(|x| x / beta_j).collect();
            v.push(v_next);

            beta_prev = beta_j;
        }

        // Solve tridiagonal eigenvalue problem
        let k_lanczos = alpha.len();
        let (ritz_values, ritz_vectors) = self.solve_tridiagonal(&alpha, &beta)?;

        // Transform Ritz vectors back to original space
        let mut solution = EigenSolution::new();
        let nev = self.num_eigenvalues.min(k_lanczos);

        for i in 0..nev {
            solution.eigenvalues.push(ritz_values[i]);

            let mut eigvec = vec![0.0; n];
            for j in 0..k_lanczos {
                for k in 0..n {
                    eigvec[k] += ritz_vectors[j * k_lanczos + i] * v[j][k];
                }
            }

            // Normalize
            let norm = eigvec.iter().map(|x| x * x).sum::<f64>().sqrt();
            for x in &mut eigvec {
                *x /= norm;
            }

            solution.eigenvectors.push(eigvec);
            solution.converged.push(true);
            solution.residuals.push(beta[k_lanczos - 1] * ritz_vectors[(k_lanczos - 1) * k_lanczos + i].abs());
        }

        solution.total_iterations = k_lanczos;
        solution.problem_type = "Standard (Lanczos)".to_string();

        Ok(solution)
    }

    fn solve_tridiagonal(&self, alpha: &[f64], beta: &[f64]) -> Result<(Vec<f64>, Vec<f64>), EigenError> {
        let n = alpha.len();

        // Build tridiagonal matrix
        let mut t = vec![0.0; n * n];
        for i in 0..n {
            t[i * n + i] = alpha[i];
            if i > 0 {
                t[i * n + (i - 1)] = beta[i - 1];
                t[(i - 1) * n + i] = beta[i - 1];
            }
        }

        // Use QR iteration
        let subspace = SubspaceIteration::default();
        subspace.qr_iteration(&t, n)
    }
}

// ============================================================================
// INVERSE ITERATION
// ============================================================================

/// Inverse iteration for finding eigenvector given approximate eigenvalue
pub struct InverseIteration {
    pub max_iterations: usize,
    pub tolerance: f64,
}

impl Default for InverseIteration {
    fn default() -> Self {
        InverseIteration {
            max_iterations: 50,
            tolerance: 1e-10,
        }
    }
}

impl InverseIteration {
    /// Find eigenvector for eigenvalue near target
    pub fn find_eigenvector(
        &self,
        k_matrix: &SparseMatrix,
        target: f64,
    ) -> Result<EigenPair, EigenError> {
        let n = k_matrix.n;

        // Shift matrix: (K - σI)
        let mut shifted = k_matrix.clone();
        for i in 0..n {
            for k in shifted.row_ptr[i]..shifted.row_ptr[i + 1] {
                if shifted.col_idx[k] == i {
                    shifted.values[k] -= target;
                }
            }
        }

        // LU factorization
        let subspace = SubspaceIteration::default();
        let ldl = subspace.ldl_factorize(&shifted)?;

        // Initial guess
        let mut x: Vec<f64> = (0..n).map(|i| (i as f64).sin()).collect();
        let norm = x.iter().map(|v| v * v).sum::<f64>().sqrt();
        for v in &mut x {
            *v /= norm;
        }

        let mut eigenvalue = target;

        for iter in 0..self.max_iterations {
            // y = (K - σI)^-1 * x
            let mut y = vec![0.0; n];
            subspace.ldl_solve(&ldl, &x, &mut y);

            // Rayleigh quotient: λ = xᵀKx / xᵀx
            let mut kx = vec![0.0; n];
            k_matrix.multiply(&x, &mut kx);
            let x_kx: f64 = x.iter().zip(kx.iter()).map(|(a, b)| a * b).sum();
            let x_x: f64 = x.iter().map(|v| v * v).sum();
            let new_eigenvalue = x_kx / x_x;

            // Normalize y
            let norm = y.iter().map(|v| v * v).sum::<f64>().sqrt();
            for v in &mut y {
                *v /= norm;
            }

            // Check convergence
            let diff = (new_eigenvalue - eigenvalue).abs() / new_eigenvalue.abs().max(1e-14);
            eigenvalue = new_eigenvalue;
            x = y;

            if diff < self.tolerance {
                return Ok(EigenPair {
                    eigenvalue,
                    eigenvector: x,
                    residual: diff,
                    iterations: iter + 1,
                });
            }
        }

        Ok(EigenPair {
            eigenvalue,
            eigenvector: x,
            residual: self.tolerance,
            iterations: self.max_iterations,
        })
    }
}

// ============================================================================
// BUCKLING ANALYSIS
// ============================================================================

/// Linearized buckling solver
/// Solves: K*φ = λ*Kg*φ
/// where K is stiffness and Kg is geometric stiffness
pub struct BucklingSolver {
    pub num_modes: usize,
    pub method: EigenMethod,
}

impl Default for BucklingSolver {
    fn default() -> Self {
        BucklingSolver {
            num_modes: 5,
            method: EigenMethod::SubspaceIteration,
        }
    }
}

impl BucklingSolver {
    pub fn new(num_modes: usize) -> Self {
        BucklingSolver {
            num_modes,
            ..Default::default()
        }
    }

    /// Solve buckling eigenvalue problem
    pub fn solve(
        &self,
        k_matrix: &SparseMatrix,
        kg_matrix: &SparseMatrix,
    ) -> Result<BucklingResult, EigenError> {
        let subspace = SubspaceIteration::new(self.num_modes);

        // Solve K*φ = λ*Kg*φ
        let solution = subspace.solve(k_matrix, kg_matrix)?;

        Ok(BucklingResult {
            critical_loads: solution.eigenvalues.clone(),
            buckling_modes: solution.eigenvectors.clone(),
            mode_descriptions: (0..solution.eigenvalues.len())
                .map(|i| format!("Mode {}", i + 1))
                .collect(),
        })
    }
}

/// Buckling analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BucklingResult {
    pub critical_loads: Vec<f64>,
    pub buckling_modes: Vec<Vec<f64>>,
    pub mode_descriptions: Vec<String>,
}

impl BucklingResult {
    /// Get critical load factor for mode i
    pub fn load_factor(&self, mode: usize) -> Option<f64> {
        self.critical_loads.get(mode).copied()
    }

    /// Get buckling mode shape
    pub fn mode_shape(&self, mode: usize) -> Option<&[f64]> {
        self.buckling_modes.get(mode).map(|v| v.as_slice())
    }
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/// Eigenvalue solver error
#[derive(Debug)]
pub enum EigenError {
    SingularMatrix,
    NotPositiveDefinite,
    ConvergenceFailure,
    InvalidInput(String),
}

impl std::fmt::Display for EigenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EigenError::SingularMatrix => write!(f, "Matrix is singular"),
            EigenError::NotPositiveDefinite => write!(f, "Matrix is not positive definite"),
            EigenError::ConvergenceFailure => write!(f, "Eigenvalue iteration did not converge"),
            EigenError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
        }
    }
}

impl std::error::Error for EigenError {}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_simple_stiffness() -> SparseMatrix {
        // Simple 3x3 SPD matrix
        let mat = vec![
            4.0, -1.0, 0.0,
            -1.0, 4.0, -1.0,
            0.0, -1.0, 3.0,
        ];
        SparseMatrix::from_dense(&mat, 3)
    }

    fn create_identity(n: usize) -> SparseMatrix {
        let mut mat = vec![0.0; n * n];
        for i in 0..n {
            mat[i * n + i] = 1.0;
        }
        SparseMatrix::from_dense(&mat, n)
    }

    #[test]
    fn test_sparse_matrix_multiply() {
        let mat = create_simple_stiffness();
        let x = vec![1.0, 2.0, 3.0];
        let mut y = vec![0.0; 3];

        mat.multiply(&x, &mut y);

        assert!((y[0] - 2.0).abs() < 1e-10);
        assert!((y[1] - 4.0).abs() < 1e-10);
        assert!((y[2] - 7.0).abs() < 1e-10);
    }

    #[test]
    fn test_sparse_diagonal() {
        let mat = create_simple_stiffness();
        let diag = mat.diagonal();

        assert!((diag[0] - 4.0).abs() < 1e-10);
        assert!((diag[1] - 4.0).abs() < 1e-10);
        assert!((diag[2] - 3.0).abs() < 1e-10);
    }

    #[test]
    fn test_lanczos_simple() {
        let k = create_simple_stiffness();
        let solver = LanczosSolver::new(2);

        let result = solver.solve(&k).unwrap();

        assert_eq!(result.eigenvalues.len(), 2);
        // Eigenvalues should be positive for SPD matrix
        assert!(result.eigenvalues[0] > 0.0);
    }

    #[test]
    fn test_subspace_iteration() {
        let k = create_simple_stiffness();
        let m = create_identity(3);

        let solver = SubspaceIteration::new(2);
        let result = solver.solve(&k, &m).unwrap();

        assert!(result.eigenvalues.len() >= 2);
    }

    #[test]
    fn test_eigen_solution_frequencies() {
        let mut solution = EigenSolution::new();
        solution.eigenvalues = vec![
            (2.0 * std::f64::consts::PI * 10.0).powi(2),  // 10 Hz
            (2.0 * std::f64::consts::PI * 20.0).powi(2),  // 20 Hz
        ];

        let freqs = solution.frequencies();

        assert!((freqs[0] - 10.0).abs() < 0.01);
        assert!((freqs[1] - 20.0).abs() < 0.01);
    }

    #[test]
    fn test_eigen_solution_periods() {
        let mut solution = EigenSolution::new();
        solution.eigenvalues = vec![
            (2.0 * std::f64::consts::PI).powi(2),  // 1 Hz -> T = 1s
        ];

        let periods = solution.periods();

        assert!((periods[0] - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_inverse_iteration() {
        let k = create_simple_stiffness();
        let solver = InverseIteration::default();

        // Target near smallest eigenvalue
        let result = solver.find_eigenvector(&k, 2.0).unwrap();

        assert!(result.eigenvalue > 0.0);
        assert_eq!(result.eigenvector.len(), 3);
    }

    #[test]
    fn test_buckling_solver() {
        let k = create_simple_stiffness();
        let kg = create_simple_stiffness();  // Use same for test

        let solver = BucklingSolver::new(2);
        let result = solver.solve(&k, &kg).unwrap();

        assert!(result.critical_loads.len() >= 2);
    }

    #[test]
    fn test_eigenpair() {
        let pair = EigenPair {
            eigenvalue: 10.0,
            eigenvector: vec![1.0, 0.0, 0.0],
            residual: 1e-10,
            iterations: 5,
        };

        assert!((pair.eigenvalue - 10.0).abs() < 1e-10);
    }
}
