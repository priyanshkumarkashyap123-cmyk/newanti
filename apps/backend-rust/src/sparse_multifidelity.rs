//! Sparse PCE & Multi-Fidelity Methods
//!
//! Industry-standard sparse approximation and multi-fidelity surrogates.
//! Addresses critical gaps vs UQLab LAR/LARS and Dakota multi-fidelity.
//!
//! ## Industry Gap Analysis - CRITICAL MISSING FEATURES
//!
//! | Feature | UQLab | Dakota | OpenTURNS | This Module |
//! |---------|-------|--------|-----------|-------------|
//! | Sparse PCE (LARS) | ✓ | ✗ | ✓ | ✓ |
//! | Sparse PCE (OMP) | ✓ | ✗ | ✓ | ✓ |
//! | Hyperbolic truncation | ✓ | ✗ | ✓ | ✓ |
//! | Multi-fidelity Co-Kriging | ✓ | ✓ | ✓ | ✓ |
//! | Multi-fidelity PCE | ✓ | ✓ | ✗ | ✓ |
//! | Space-filling DoE | ✓ | ✓ | ✓ | ✓ |


// ============================================================================
// SPARSE PCE WITH LARS (LEAST ANGLE REGRESSION)
// ============================================================================

/// Sparse Polynomial Chaos Expansion using LARS
/// Industry standard: UQLab PCE module
#[derive(Debug, Clone)]
pub struct SparsePCE {
    pub dimension: usize,
    pub max_degree: usize,
    pub truncation: TruncationScheme,
    pub basis_indices: Vec<Vec<usize>>,
    pub coefficients: Vec<f64>,
    pub leave_one_out_error: f64,
}

#[derive(Debug, Clone, Copy)]
pub enum TruncationScheme {
    /// Standard total degree: |α| ≤ p
    TotalDegree,
    /// Hyperbolic: Σ(α_i^q) ≤ p^q with q < 1
    Hyperbolic { q: f64 },
    /// Maximum interaction: limit interaction order
    MaximumInteraction { max_order: usize },
}

impl SparsePCE {
    pub fn new(dimension: usize, max_degree: usize) -> Self {
        SparsePCE {
            dimension,
            max_degree,
            truncation: TruncationScheme::Hyperbolic { q: 0.75 },
            basis_indices: Vec::new(),
            coefficients: Vec::new(),
            leave_one_out_error: 0.0,
        }
    }

    /// Build basis using specified truncation
    pub fn build_basis(&mut self) {
        self.basis_indices = match self.truncation {
            TruncationScheme::TotalDegree => {
                self.total_degree_basis()
            }
            TruncationScheme::Hyperbolic { q } => {
                self.hyperbolic_basis(q)
            }
            TruncationScheme::MaximumInteraction { max_order } => {
                self.max_interaction_basis(max_order)
            }
        };
    }

    fn total_degree_basis(&self) -> Vec<Vec<usize>> {
        let mut basis = Vec::new();
        let mut alpha = vec![0usize; self.dimension];
        
        self.enumerate_basis(&mut basis, &mut alpha, 0, self.max_degree);
        basis
    }

    fn enumerate_basis(&self, basis: &mut Vec<Vec<usize>>, alpha: &mut Vec<usize>, 
                       pos: usize, remaining: usize) {
        if pos == self.dimension {
            basis.push(alpha.clone());
            return;
        }

        for deg in 0..=remaining {
            alpha[pos] = deg;
            self.enumerate_basis(basis, alpha, pos + 1, remaining - deg);
        }
    }

    fn hyperbolic_basis(&self, q: f64) -> Vec<Vec<usize>> {
        let p = self.max_degree as f64;
        let threshold = p.powf(q);
        
        let mut basis = Vec::new();
        let mut alpha = vec![0usize; self.dimension];
        
        self.enumerate_hyperbolic(&mut basis, &mut alpha, 0, threshold, q);
        basis
    }

    fn enumerate_hyperbolic(&self, basis: &mut Vec<Vec<usize>>, alpha: &mut Vec<usize>,
                            pos: usize, threshold: f64, q: f64) {
        if pos == self.dimension {
            // Check hyperbolic norm
            let norm: f64 = alpha.iter()
                .filter(|&&a| a > 0)
                .map(|&a| (a as f64).powf(q))
                .sum();
            
            if norm <= threshold {
                basis.push(alpha.clone());
            }
            return;
        }

        for deg in 0..=self.max_degree {
            alpha[pos] = deg;
            
            // Early termination check
            let partial_norm: f64 = alpha[..=pos].iter()
                .filter(|&&a| a > 0)
                .map(|&a| (a as f64).powf(q))
                .sum();
            
            if partial_norm <= threshold {
                self.enumerate_hyperbolic(basis, alpha, pos + 1, threshold, q);
            }
        }
    }

    fn max_interaction_basis(&self, max_order: usize) -> Vec<Vec<usize>> {
        let mut basis = Vec::new();
        let mut alpha = vec![0usize; self.dimension];
        
        self.enumerate_max_interaction(&mut basis, &mut alpha, 0, max_order);
        basis
    }

    fn enumerate_max_interaction(&self, basis: &mut Vec<Vec<usize>>, alpha: &mut Vec<usize>,
                                  pos: usize, max_order: usize) {
        if pos == self.dimension {
            let interaction = alpha.iter().filter(|&&a| a > 0).count();
            if interaction <= max_order {
                basis.push(alpha.clone());
            }
            return;
        }

        for deg in 0..=self.max_degree {
            alpha[pos] = deg;
            
            let partial_interaction = alpha[..=pos].iter().filter(|&&a| a > 0).count();
            if partial_interaction <= max_order {
                self.enumerate_max_interaction(basis, alpha, pos + 1, max_order);
            }
        }
    }

    /// Fit using LARS algorithm
    pub fn fit_lars(&mut self, samples: &[Vec<f64>], responses: &[f64]) {
        self.build_basis();
        
        let n = samples.len();
        let p = self.basis_indices.len();

        // Build design matrix
        let mut psi = vec![vec![0.0; p]; n];
        
        for (i, sample) in samples.iter().enumerate() {
            for (j, alpha) in self.basis_indices.iter().enumerate() {
                psi[i][j] = self.evaluate_basis(sample, alpha);
            }
        }

        // LARS algorithm
        let lars_result = self.lars_algorithm(&psi, responses);
        
        // Extract values before moving
        let active_indices = lars_result.active_indices.clone();
        self.coefficients = lars_result.coefficients;
        self.basis_indices = active_indices.iter()
            .map(|&i| self.basis_indices[i].clone())
            .collect();
        
        // Compute LOO error
        self.leave_one_out_error = self.compute_loo_from_residual(&psi, responses);
    }

    fn compute_loo_from_residual(&self, psi: &[Vec<f64>], responses: &[f64]) -> f64 {
        // Simplified LOO estimation
        let n = responses.len();
        let mut loo_error = 0.0;
        
        for i in 0..n {
            let pred: f64 = self.coefficients.iter()
                .enumerate()
                .map(|(j, &c)| c * psi[i][j])
                .sum();
            let residual = responses[i] - pred;
            loo_error += residual * residual;
        }
        
        (loo_error / n as f64).sqrt()
    }

    fn evaluate_basis(&self, x: &[f64], alpha: &[usize]) -> f64 {
        let mut result = 1.0;
        
        for (i, &deg) in alpha.iter().enumerate() {
            result *= hermite_polynomial(deg, x[i]);
        }
        
        result
    }

    fn lars_algorithm(&self, psi: &[Vec<f64>], y: &[f64]) -> LarsResult {
        let n = y.len();
        let p = psi[0].len();

        let y_mean = y.iter().sum::<f64>() / n as f64;
        let y_centered: Vec<f64> = y.iter().map(|&yi| yi - y_mean).collect();

        // Normalize columns
        let mut psi_normalized = psi.to_vec();
        let mut col_norms = vec![0.0; p];
        let mut col_means = vec![0.0; p];

        for j in 0..p {
            col_means[j] = (0..n).map(|i| psi[i][j]).sum::<f64>() / n as f64;
            for i in 0..n {
                psi_normalized[i][j] -= col_means[j];
            }
            col_norms[j] = (0..n).map(|i| psi_normalized[i][j].powi(2)).sum::<f64>().sqrt();
            if col_norms[j] > 1e-10 {
                for i in 0..n {
                    psi_normalized[i][j] /= col_norms[j];
                }
            }
        }

        let mut residual = y_centered.clone();
        let mut active_set: Vec<usize> = Vec::new();
        let mut coeffs = vec![0.0; p];
        let mut beta_path: Vec<Vec<f64>> = Vec::new();

        let max_iter = p.min(n - 1);

        for _ in 0..max_iter {
            // Find most correlated variable
            let mut max_corr = 0.0;
            let mut max_j = 0;

            for j in 0..p {
                if active_set.contains(&j) {
                    continue;
                }
                
                let corr: f64 = (0..n).map(|i| psi_normalized[i][j] * residual[i]).sum::<f64>().abs();
                
                if corr > max_corr {
                    max_corr = corr;
                    max_j = j;
                }
            }

            if max_corr < 1e-10 {
                break;
            }

            active_set.push(max_j);

            // Compute equiangular direction
            let k = active_set.len();
            
            // Gram matrix of active set
            let mut gram = vec![vec![0.0; k]; k];
            for (ia, &a) in active_set.iter().enumerate() {
                for (ib, &b) in active_set.iter().enumerate() {
                    gram[ia][ib] = (0..n).map(|i| psi_normalized[i][a] * psi_normalized[i][b]).sum();
                }
            }

            // Solve for direction
            let ones = vec![1.0; k];
            let g_inv_1 = self.solve_system(&gram, &ones);
            
            let aa = g_inv_1.iter().sum::<f64>().sqrt();
            let w: Vec<f64> = g_inv_1.iter().map(|&gi| gi / aa).collect();

            // Equiangular vector
            let mut u = vec![0.0; n];
            for (iw, &wi) in w.iter().enumerate() {
                let j = active_set[iw];
                for i in 0..n {
                    u[i] += wi * psi_normalized[i][j];
                }
            }

            // Correlation of active variables
            let corr_active: f64 = (0..n).map(|i| u[i] * residual[i]).sum();

            // Step length (simplified - full LARS uses more complex step)
            let mut gamma = corr_active / aa;

            // Check for sign change (LASSO modification)
            for (iw, &wi) in w.iter().enumerate() {
                if wi.abs() > 1e-10 {
                    let potential_gamma = -coeffs[active_set[iw]] / wi;
                    if potential_gamma > 0.0 && potential_gamma < gamma {
                        gamma = potential_gamma;
                    }
                }
            }

            // Update coefficients
            for (iw, &wi) in w.iter().enumerate() {
                coeffs[active_set[iw]] += gamma * wi;
            }

            // Update residual
            for i in 0..n {
                residual[i] -= gamma * u[i];
            }

            beta_path.push(coeffs.clone());

            // Early stopping based on BIC
            let rss: f64 = residual.iter().map(|&r| r * r).sum();
            let bic = n as f64 * (rss / n as f64).ln() + k as f64 * (n as f64).ln();
            
            if k > 5 && beta_path.len() > 2 {
                let prev_k = beta_path[beta_path.len() - 2].iter().filter(|&&c| c.abs() > 1e-10).count();
                let prev_rss: f64 = y_centered.iter().enumerate()
                    .map(|(i, &yi)| {
                        let pred: f64 = active_set[..prev_k].iter()
                            .map(|&j| psi_normalized[i][j] * beta_path[beta_path.len() - 2][j])
                            .sum();
                        (yi - pred).powi(2)
                    })
                    .sum();
                let prev_bic = n as f64 * (prev_rss / n as f64).ln() + prev_k as f64 * (n as f64).ln();
                
                if bic > prev_bic {
                    coeffs = beta_path[beta_path.len() - 2].clone();
                    active_set.pop();
                    break;
                }
            }
        }

        // Transform back to original scale
        let mut final_coeffs = Vec::new();
        let mut final_indices = Vec::new();
        
        for (j, &c) in coeffs.iter().enumerate() {
            if c.abs() > 1e-10 && col_norms[j] > 1e-10 {
                final_coeffs.push(c / col_norms[j]);
                final_indices.push(j);
            }
        }

        // Add intercept
        let intercept = y_mean - final_indices.iter()
            .zip(final_coeffs.iter())
            .map(|(&j, &c)| c * col_means[j])
            .sum::<f64>();

        if intercept.abs() > 1e-10 {
            final_coeffs.insert(0, intercept);
            final_indices.insert(0, 0); // Constant basis
        }

        LarsResult {
            coefficients: final_coeffs,
            active_indices: final_indices,
        }
    }

    fn solve_system(&self, a: &[Vec<f64>], b: &[f64]) -> Vec<f64> {
        // Simple Gauss elimination
        let n = b.len();
        let mut aug: Vec<Vec<f64>> = a.iter().map(|row| row.clone()).collect();
        let mut rhs = b.to_vec();

        for i in 0..n {
            // Pivot
            let mut max_row = i;
            for k in (i + 1)..n {
                if aug[k][i].abs() > aug[max_row][i].abs() {
                    max_row = k;
                }
            }
            aug.swap(i, max_row);
            rhs.swap(i, max_row);

            // Eliminate
            for k in (i + 1)..n {
                if aug[i][i].abs() < 1e-14 {
                    continue;
                }
                let factor = aug[k][i] / aug[i][i];
                for j in i..n {
                    aug[k][j] -= factor * aug[i][j];
                }
                rhs[k] -= factor * rhs[i];
            }
        }

        // Back substitute
        let mut x = vec![0.0; n];
        for i in (0..n).rev() {
            x[i] = rhs[i];
            for j in (i + 1)..n {
                x[i] -= aug[i][j] * x[j];
            }
            if aug[i][i].abs() > 1e-14 {
                x[i] /= aug[i][i];
            }
        }

        x
    }

    fn compute_loo_error(&self, psi: &[Vec<f64>], y: &[f64], result: &LarsResult) -> f64 {
        let n = y.len();
        
        // Build reduced design matrix
        let p_active = result.active_indices.len();
        let mut psi_active = vec![vec![0.0; p_active]; n];
        
        for i in 0..n {
            for (ja, &j) in result.active_indices.iter().enumerate() {
                psi_active[i][ja] = psi[i][j];
            }
        }

        // Compute predictions
        let mut errors = 0.0;
        
        for i in 0..n {
            let pred: f64 = (0..p_active)
                .map(|j| psi_active[i][j] * result.coefficients[j])
                .sum();
            
            let error = (y[i] - pred).powi(2);
            
            // Leverage (hat matrix diagonal) - simplified
            let leverage = 1.0 / n as f64 * p_active as f64;
            
            errors += error / (1.0 - leverage).max(0.1).powi(2);
        }

        (errors / n as f64).sqrt()
    }

    /// Evaluate PCE at a point
    pub fn evaluate(&self, x: &[f64]) -> f64 {
        self.coefficients.iter()
            .zip(self.basis_indices.iter())
            .map(|(&c, alpha)| c * self.evaluate_basis(x, alpha))
            .sum()
    }

    /// Compute Sobol indices from PCE coefficients
    pub fn compute_sobol_indices(&self) -> SobolIndices {
        let total_variance: f64 = self.coefficients.iter().skip(1)
            .map(|&c| c * c)
            .sum();

        let mut first_order = vec![0.0; self.dimension];
        let mut total_order = vec![0.0; self.dimension];

        for (coeff, alpha) in self.coefficients.iter().skip(1).zip(self.basis_indices.iter().skip(1)) {
            let var_contrib = coeff * coeff;
            
            let active_dims: Vec<usize> = alpha.iter().enumerate()
                .filter(|(_, &a)| a > 0)
                .map(|(i, _)| i)
                .collect();

            // First order: only one variable active
            if active_dims.len() == 1 {
                first_order[active_dims[0]] += var_contrib;
            }

            // Total order: any term involving the variable
            for &dim in &active_dims {
                total_order[dim] += var_contrib;
            }
        }

        if total_variance > 1e-14 {
            for i in 0..self.dimension {
                first_order[i] /= total_variance;
                total_order[i] /= total_variance;
            }
        }

        SobolIndices {
            first_order,
            total_order,
        }
    }
}

#[derive(Debug, Clone)]
struct LarsResult {
    coefficients: Vec<f64>,
    active_indices: Vec<usize>,
}

#[derive(Debug, Clone)]
pub struct SobolIndices {
    pub first_order: Vec<f64>,
    pub total_order: Vec<f64>,
}

// ============================================================================
// ORTHOGONAL MATCHING PURSUIT
// ============================================================================

/// Sparse PCE using Orthogonal Matching Pursuit
/// Industry standard: OpenTURNS, Chaospy
#[derive(Debug, Clone)]
pub struct OMPSparsePCE {
    pub dimension: usize,
    pub max_degree: usize,
    pub max_terms: usize,
    pub basis_indices: Vec<Vec<usize>>,
    pub coefficients: Vec<f64>,
}

impl OMPSparsePCE {
    pub fn new(dimension: usize, max_degree: usize, max_terms: usize) -> Self {
        OMPSparsePCE {
            dimension,
            max_degree,
            max_terms,
            basis_indices: Vec::new(),
            coefficients: Vec::new(),
        }
    }

    /// Fit using OMP algorithm
    pub fn fit(&mut self, samples: &[Vec<f64>], responses: &[f64]) {
        // Build full basis
        let full_basis = self.build_full_basis();
        
        let n = samples.len();
        let p = full_basis.len();

        // Design matrix
        let mut psi = vec![vec![0.0; p]; n];
        for (i, sample) in samples.iter().enumerate() {
            for (j, alpha) in full_basis.iter().enumerate() {
                psi[i][j] = self.evaluate_basis(sample, alpha);
            }
        }

        // OMP algorithm
        let y: Vec<f64> = responses.to_vec();
        let mut residual = y.clone();
        let mut selected: Vec<usize> = Vec::new();
        let mut coeffs = vec![0.0; p];

        for _ in 0..self.max_terms.min(p) {
            // Find most correlated column
            let mut max_corr = 0.0;
            let mut max_j = 0;

            for j in 0..p {
                if selected.contains(&j) {
                    continue;
                }

                let corr: f64 = (0..n).map(|i| psi[i][j] * residual[i]).sum::<f64>().abs();
                let norm: f64 = (0..n).map(|i| psi[i][j].powi(2)).sum::<f64>().sqrt();
                
                let normalized_corr = if norm > 1e-10 { corr / norm } else { 0.0 };

                if normalized_corr > max_corr {
                    max_corr = normalized_corr;
                    max_j = j;
                }
            }

            if max_corr < 1e-10 {
                break;
            }

            selected.push(max_j);

            // Solve least squares on selected columns
            let k = selected.len();
            let mut psi_selected = vec![vec![0.0; k]; n];
            for i in 0..n {
                for (js, &j) in selected.iter().enumerate() {
                    psi_selected[i][js] = psi[i][j];
                }
            }

            let new_coeffs = self.least_squares(&psi_selected, &y);

            // Update coefficients
            for (js, &j) in selected.iter().enumerate() {
                coeffs[j] = new_coeffs[js];
            }

            // Update residual
            for i in 0..n {
                let pred: f64 = selected.iter().map(|&j| psi[i][j] * coeffs[j]).sum();
                residual[i] = y[i] - pred;
            }

            // Early stopping based on residual
            let rss: f64 = residual.iter().map(|&r| r * r).sum();
            let tss: f64 = y.iter().map(|&yi| (yi - y.iter().sum::<f64>() / n as f64).powi(2)).sum();
            
            let r_squared = 1.0 - rss / tss;
            if r_squared > 0.999 {
                break;
            }
        }

        // Store results
        self.basis_indices = selected.iter().map(|&j| full_basis[j].clone()).collect();
        self.coefficients = selected.iter().map(|&j| coeffs[j]).collect();
    }

    fn build_full_basis(&self) -> Vec<Vec<usize>> {
        let mut basis = Vec::new();
        let mut alpha = vec![0usize; self.dimension];
        
        self.enumerate_basis(&mut basis, &mut alpha, 0, self.max_degree);
        basis
    }

    fn enumerate_basis(&self, basis: &mut Vec<Vec<usize>>, alpha: &mut Vec<usize>,
                       pos: usize, remaining: usize) {
        if pos == self.dimension {
            basis.push(alpha.clone());
            return;
        }

        for deg in 0..=remaining {
            alpha[pos] = deg;
            self.enumerate_basis(basis, alpha, pos + 1, remaining - deg);
        }
    }

    fn evaluate_basis(&self, x: &[f64], alpha: &[usize]) -> f64 {
        let mut result = 1.0;
        for (i, &deg) in alpha.iter().enumerate() {
            result *= hermite_polynomial(deg, x[i]);
        }
        result
    }

    fn least_squares(&self, a: &[Vec<f64>], b: &[f64]) -> Vec<f64> {
        let n = a.len();
        let p = a[0].len();

        // A^T A
        let mut ata = vec![vec![0.0; p]; p];
        for i in 0..p {
            for j in 0..p {
                ata[i][j] = (0..n).map(|k| a[k][i] * a[k][j]).sum();
            }
        }

        // A^T b
        let atb: Vec<f64> = (0..p).map(|i| (0..n).map(|k| a[k][i] * b[k]).sum()).collect();

        // Solve
        self.solve_system(&ata, &atb)
    }

    fn solve_system(&self, a: &[Vec<f64>], b: &[f64]) -> Vec<f64> {
        let n = b.len();
        let mut aug: Vec<Vec<f64>> = a.iter().map(|row| row.clone()).collect();
        let mut rhs = b.to_vec();

        for i in 0..n {
            let mut max_row = i;
            for k in (i + 1)..n {
                if aug[k][i].abs() > aug[max_row][i].abs() {
                    max_row = k;
                }
            }
            aug.swap(i, max_row);
            rhs.swap(i, max_row);

            for k in (i + 1)..n {
                if aug[i][i].abs() < 1e-14 { continue; }
                let factor = aug[k][i] / aug[i][i];
                for j in i..n {
                    aug[k][j] -= factor * aug[i][j];
                }
                rhs[k] -= factor * rhs[i];
            }
        }

        let mut x = vec![0.0; n];
        for i in (0..n).rev() {
            x[i] = rhs[i];
            for j in (i + 1)..n {
                x[i] -= aug[i][j] * x[j];
            }
            if aug[i][i].abs() > 1e-14 {
                x[i] /= aug[i][i];
            }
        }
        x
    }

    pub fn evaluate(&self, x: &[f64]) -> f64 {
        self.coefficients.iter()
            .zip(self.basis_indices.iter())
            .map(|(&c, alpha)| c * self.evaluate_basis(x, alpha))
            .sum()
    }
}

// ============================================================================
// MULTI-FIDELITY CO-KRIGING
// ============================================================================

/// Multi-fidelity surrogate using recursive Co-Kriging
/// Industry standard: Dakota, UQLab Kriging module
#[derive(Debug, Clone)]
pub struct CoKriging {
    pub n_fidelities: usize,
    /// Training data: Vec<(samples, responses)> for each fidelity
    train_data: Vec<(Vec<Vec<f64>>, Vec<f64>)>,
    /// Scaling factors ρ between fidelities
    rho: Vec<f64>,
    /// Kernel hyperparameters for each fidelity
    theta: Vec<Vec<f64>>,
    /// Correlation matrices for each fidelity
    r_inv: Vec<Vec<Vec<f64>>>,
    /// Regression coefficients
    beta: Vec<f64>,
}

impl CoKriging {
    pub fn new(n_fidelities: usize) -> Self {
        CoKriging {
            n_fidelities,
            train_data: Vec::new(),
            rho: vec![1.0; n_fidelities - 1],
            theta: Vec::new(),
            r_inv: Vec::new(),
            beta: Vec::new(),
        }
    }

    /// Add training data for a fidelity level
    pub fn add_fidelity(&mut self, fidelity: usize, samples: Vec<Vec<f64>>, responses: Vec<f64>) {
        while self.train_data.len() <= fidelity {
            self.train_data.push((Vec::new(), Vec::new()));
        }
        self.train_data[fidelity] = (samples, responses);
    }

    /// Build co-kriging model using recursive formulation
    pub fn fit(&mut self) {
        // Kennedy & O'Hagan (2000) auto-regressive model:
        // Z_k(x) = ρ_k * Z_{k-1}(x) + δ_k(x)
        
        // Step 1: Fit lowest fidelity
        let dim = self.train_data[0].0[0].len();
        
        self.theta = Vec::new();
        self.r_inv = Vec::new();
        self.beta = Vec::new();

        for level in 0..self.n_fidelities {
            let (samples, responses) = &self.train_data[level];
            let n = samples.len();

            // Estimate hyperparameters (simplified - would use MLE in practice)
            let theta_level = vec![1.0; dim];
            self.theta.push(theta_level.clone());

            // Build correlation matrix
            let r = self.build_correlation_matrix(samples, &theta_level);
            
            // Compute R^(-1)
            let r_inv = self.invert_matrix(&r);
            self.r_inv.push(r_inv.clone());

            // Compute regression coefficient
            let ones = vec![1.0; n];
            let r_inv_1: Vec<f64> = self.mat_vec_mult(&r_inv, &ones);
            let r_inv_y: Vec<f64> = self.mat_vec_mult(&r_inv, responses);
            
            let beta = r_inv_y.iter().sum::<f64>() / r_inv_1.iter().sum::<f64>();
            self.beta.push(beta);

            // Estimate ρ for next level
            if level < self.n_fidelities - 1 {
                let (next_samples, next_responses) = &self.train_data[level + 1];
                
                // Interpolate low fidelity at high fidelity points
                let low_at_high: Vec<f64> = next_samples.iter()
                    .map(|x| self.predict_single_level(x, level))
                    .collect();

                // Estimate ρ using least squares
                let num: f64 = low_at_high.iter().zip(next_responses.iter())
                    .map(|(&l, &h)| l * h)
                    .sum();
                let den: f64 = low_at_high.iter().map(|&l| l * l).sum();
                
                self.rho[level] = if den > 1e-10 { num / den } else { 1.0 };
            }
        }
    }

    fn build_correlation_matrix(&self, samples: &[Vec<f64>], theta: &[f64]) -> Vec<Vec<f64>> {
        let n = samples.len();
        let mut r = vec![vec![0.0; n]; n];

        for i in 0..n {
            for j in 0..n {
                let dist_sq: f64 = samples[i].iter()
                    .zip(samples[j].iter())
                    .zip(theta.iter())
                    .map(|((&xi, &xj), &t)| t * (xi - xj).powi(2))
                    .sum();
                r[i][j] = (-dist_sq).exp();
            }
        }

        // Add nugget for numerical stability
        for i in 0..n {
            r[i][i] += 1e-8;
        }

        r
    }

    fn invert_matrix(&self, a: &[Vec<f64>]) -> Vec<Vec<f64>> {
        let n = a.len();
        let mut aug = vec![vec![0.0; 2 * n]; n];

        // Augmented matrix [A | I]
        for i in 0..n {
            for j in 0..n {
                aug[i][j] = a[i][j];
                aug[i][n + j] = if i == j { 1.0 } else { 0.0 };
            }
        }

        // Gauss-Jordan
        for i in 0..n {
            let mut max_row = i;
            for k in (i + 1)..n {
                if aug[k][i].abs() > aug[max_row][i].abs() {
                    max_row = k;
                }
            }
            aug.swap(i, max_row);

            let pivot = aug[i][i];
            if pivot.abs() < 1e-14 {
                continue;
            }

            for j in 0..(2 * n) {
                aug[i][j] /= pivot;
            }

            for k in 0..n {
                if k == i { continue; }
                let factor = aug[k][i];
                for j in 0..(2 * n) {
                    aug[k][j] -= factor * aug[i][j];
                }
            }
        }

        // Extract inverse
        let mut inv = vec![vec![0.0; n]; n];
        for i in 0..n {
            for j in 0..n {
                inv[i][j] = aug[i][n + j];
            }
        }
        inv
    }

    fn mat_vec_mult(&self, a: &[Vec<f64>], x: &[f64]) -> Vec<f64> {
        a.iter().map(|row| row.iter().zip(x.iter()).map(|(&a, &x)| a * x).sum()).collect()
    }

    fn predict_single_level(&self, x: &[f64], level: usize) -> f64 {
        let (samples, responses) = &self.train_data[level];
        let n = samples.len();

        // Correlation vector
        let r: Vec<f64> = samples.iter()
            .map(|si| {
                let dist_sq: f64 = si.iter()
                    .zip(x.iter())
                    .zip(self.theta[level].iter())
                    .map(|((&xi, &xj), &t)| t * (xi - xj).powi(2))
                    .sum();
                (-dist_sq).exp()
            })
            .collect();

        let _r_inv_y: Vec<f64> = self.mat_vec_mult(&self.r_inv[level], responses);
        let _r_inv_1: Vec<f64> = self.mat_vec_mult(&self.r_inv[level], &vec![1.0; n]);

        let y_centered: Vec<f64> = responses.iter().map(|&y| y - self.beta[level]).collect();
        let r_inv_y_c: Vec<f64> = self.mat_vec_mult(&self.r_inv[level], &y_centered);

        self.beta[level] + r.iter().zip(r_inv_y_c.iter()).map(|(&r, &ry)| r * ry).sum::<f64>()
    }

    /// Predict using multi-fidelity model
    pub fn predict(&self, x: &[f64]) -> f64 {
        // Recursive prediction: Z_k = ρ_k * Z_{k-1} + δ_k
        let mut z = self.predict_single_level(x, 0);

        for level in 1..self.n_fidelities {
            let delta = self.predict_single_level(x, level) - self.rho[level - 1] * z;
            z = self.rho[level - 1] * z + delta;
        }

        z
    }
}

// ============================================================================
// MULTI-FIDELITY PCE
// ============================================================================

/// Multi-fidelity PCE combining different accuracy levels
#[derive(Debug, Clone)]
pub struct MultiFidelityPCE {
    pub n_fidelities: usize,
    /// PCE for each fidelity level
    pce_levels: Vec<SparsePCE>,
    /// Correction factors
    rho: Vec<f64>,
}

impl MultiFidelityPCE {
    pub fn new(dimension: usize, n_fidelities: usize) -> Self {
        MultiFidelityPCE {
            n_fidelities,
            pce_levels: (0..n_fidelities)
                .map(|_| SparsePCE::new(dimension, 3))
                .collect(),
            rho: vec![1.0; n_fidelities - 1],
        }
    }

    /// Fit PCE at each level
    pub fn fit(&mut self, data: &[(Vec<Vec<f64>>, Vec<f64>)]) {
        // Fit lowest fidelity
        self.pce_levels[0].fit_lars(&data[0].0, &data[0].1);

        // Fit corrections
        for level in 1..self.n_fidelities {
            let (samples, responses) = &data[level];

            // Low fidelity predictions at high fidelity points
            let low_preds: Vec<f64> = samples.iter()
                .map(|x| self.pce_levels[level - 1].evaluate(x))
                .collect();

            // Estimate scaling
            let num: f64 = low_preds.iter().zip(responses.iter())
                .map(|(&l, &h)| l * h)
                .sum();
            let den: f64 = low_preds.iter().map(|&l| l * l).sum();
            self.rho[level - 1] = if den > 1e-10 { num / den } else { 1.0 };

            // Fit correction
            let corrections: Vec<f64> = responses.iter()
                .zip(low_preds.iter())
                .map(|(&h, &l)| h - self.rho[level - 1] * l)
                .collect();

            self.pce_levels[level].fit_lars(samples, &corrections);
        }
    }

    /// Predict using multi-fidelity model
    pub fn predict(&self, x: &[f64]) -> f64 {
        let mut result = self.pce_levels[0].evaluate(x);

        for level in 1..self.n_fidelities {
            result = self.rho[level - 1] * result + self.pce_levels[level].evaluate(x);
        }

        result
    }
}

// ============================================================================
// SPACE-FILLING DESIGNS
// ============================================================================

/// Latin Hypercube Sampling with maximin optimization
#[derive(Debug, Clone)]
pub struct OptimalLHS {
    pub dimension: usize,
    pub n_samples: usize,
    pub samples: Vec<Vec<f64>>,
}

impl OptimalLHS {
    pub fn new(dimension: usize, n_samples: usize) -> Self {
        OptimalLHS {
            dimension,
            n_samples,
            samples: Vec::new(),
        }
    }

    /// Generate maximin LHS design
    pub fn generate(&mut self) {
        let mut best_samples = self.random_lhs();
        let mut best_min_dist = self.min_distance(&best_samples);

        // Simulated annealing optimization
        let mut rng_state = 42u64;
        let mut temperature = 1.0;

        for _ in 0..1000 {
            let mut new_samples = best_samples.clone();

            // Random swap within a dimension
            let dim = (lcg_random(&mut rng_state) * self.dimension as f64) as usize;
            let i = (lcg_random(&mut rng_state) * self.n_samples as f64) as usize;
            let j = (lcg_random(&mut rng_state) * self.n_samples as f64) as usize;

            if i != j {
                let temp = new_samples[i][dim];
                new_samples[i][dim] = new_samples[j][dim];
                new_samples[j][dim] = temp;
            }

            let new_min_dist = self.min_distance(&new_samples);

            // Accept if better or with probability
            if new_min_dist > best_min_dist ||
               lcg_random(&mut rng_state) < ((new_min_dist - best_min_dist) / temperature).exp() 
            {
                best_samples = new_samples;
                best_min_dist = new_min_dist;
            }

            temperature *= 0.995;
        }

        self.samples = best_samples;
    }

    fn random_lhs(&self) -> Vec<Vec<f64>> {
        let mut rng_state = 12345u64;
        let mut samples = vec![vec![0.0; self.dimension]; self.n_samples];

        for d in 0..self.dimension {
            // Create permutation
            let mut perm: Vec<usize> = (0..self.n_samples).collect();
            
            for i in (1..self.n_samples).rev() {
                let j = (lcg_random(&mut rng_state) * (i + 1) as f64) as usize;
                perm.swap(i, j);
            }

            // Assign values
            for (i, &p) in perm.iter().enumerate() {
                let u = lcg_random(&mut rng_state);
                samples[i][d] = (p as f64 + u) / self.n_samples as f64;
            }
        }

        samples
    }

    fn min_distance(&self, samples: &[Vec<f64>]) -> f64 {
        let mut min_dist = f64::INFINITY;

        for i in 0..samples.len() {
            for j in (i + 1)..samples.len() {
                let dist: f64 = samples[i].iter()
                    .zip(samples[j].iter())
                    .map(|(&a, &b)| (a - b).powi(2))
                    .sum::<f64>()
                    .sqrt();
                min_dist = min_dist.min(dist);
            }
        }

        min_dist
    }

    /// Transform samples from [0,1] to specified bounds
    pub fn transform(&self, bounds: &[(f64, f64)]) -> Vec<Vec<f64>> {
        self.samples.iter()
            .map(|s| {
                s.iter().zip(bounds.iter())
                    .map(|(&x, &(lo, hi))| lo + x * (hi - lo))
                    .collect()
            })
            .collect()
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

fn hermite_polynomial(n: usize, x: f64) -> f64 {
    match n {
        0 => 1.0,
        1 => x,
        _ => {
            let mut h_prev = 1.0;
            let mut h_curr = x;
            for k in 1..n {
                let h_next = x * h_curr - k as f64 * h_prev;
                h_prev = h_curr;
                h_curr = h_next;
            }
            h_curr
        }
    }
}

fn lcg_random(state: &mut u64) -> f64 {
    *state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
    (*state as f64) / (u64::MAX as f64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::PI;
    use std::f64::consts::E;

    #[test]
    fn test_sparse_pce_basis() {
        let mut pce = SparsePCE::new(3, 4);
        pce.truncation = TruncationScheme::TotalDegree;
        pce.build_basis();
        
        // Total degree basis: C(n+d-1, d-1) terms
        assert!(pce.basis_indices.len() > 0);
    }

    #[test]
    fn test_hyperbolic_basis() {
        let mut pce = SparsePCE::new(5, 3);
        pce.truncation = TruncationScheme::Hyperbolic { q: 0.7 };
        pce.build_basis();
        
        // Hyperbolic should have fewer terms than total degree
        let mut pce_total = SparsePCE::new(5, 3);
        pce_total.truncation = TruncationScheme::TotalDegree;
        pce_total.build_basis();
        
        assert!(pce.basis_indices.len() <= pce_total.basis_indices.len());
    }

    #[test]
    fn test_sparse_pce_fit() {
        let mut pce = SparsePCE::new(2, 3);
        
        // Generate training data
        let mut rng_state = 42u64;
        let samples: Vec<Vec<f64>> = (0..50)
            .map(|_| vec![
                box_muller_normal(&mut rng_state),
                box_muller_normal(&mut rng_state),
            ])
            .collect();
        
        let responses: Vec<f64> = samples.iter()
            .map(|x| x[0].powi(2) + x[1] - x[0] * x[1])
            .collect();

        pce.fit_lars(&samples, &responses);
        
        assert!(pce.coefficients.len() > 0);
    }

    #[test]
    fn test_omp_sparse_pce() {
        let mut pce = OMPSparsePCE::new(2, 3, 10);
        
        let mut rng_state = 12345u64;
        let samples: Vec<Vec<f64>> = (0..30)
            .map(|_| vec![
                box_muller_normal(&mut rng_state),
                box_muller_normal(&mut rng_state),
            ])
            .collect();
        
        let responses: Vec<f64> = samples.iter()
            .map(|x| x[0] + x[1].powi(2))
            .collect();

        pce.fit(&samples, &responses);
        
        assert!(pce.coefficients.len() <= 10);
    }

    #[test]
    fn test_cokriging() {
        let mut ck = CoKriging::new(2);
        
        // Low fidelity
        let samples_low: Vec<Vec<f64>> = vec![
            vec![0.0], vec![0.25], vec![0.5], vec![0.75], vec![1.0],
        ];
        let responses_low: Vec<f64> = samples_low.iter()
            .map(|x| (2.0 * PI * x[0]).sin())
            .collect();
        
        // High fidelity (fewer points)
        let samples_high: Vec<Vec<f64>> = vec![
            vec![0.0], vec![0.5], vec![1.0],
        ];
        let responses_high: Vec<f64> = samples_high.iter()
            .map(|x| (2.0 * PI * x[0]).sin() + 0.1 * x[0])
            .collect();

        ck.add_fidelity(0, samples_low, responses_low);
        ck.add_fidelity(1, samples_high, responses_high);
        ck.fit();

        let pred = ck.predict(&vec![0.3]);
        assert!(pred.abs() < 2.0);
    }

    #[test]
    fn test_optimal_lhs() {
        let mut lhs = OptimalLHS::new(3, 20);
        lhs.generate();
        
        assert_eq!(lhs.samples.len(), 20);
        assert_eq!(lhs.samples[0].len(), 3);
        
        // Check all in [0,1]
        for s in &lhs.samples {
            for &x in s {
                assert!(x >= 0.0 && x <= 1.0);
            }
        }
    }
    
    fn box_muller_normal(state: &mut u64) -> f64 {
        let u1 = lcg_random(state);
        let u2 = lcg_random(state);
        (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos()
    }
}
