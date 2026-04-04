//! Stochastic Finite Element Method (SFEM)
//!
//! Methods for analyzing structures with uncertain parameters.
//! Combines FEM with probability theory for reliability assessment.
//!
//! ## Methods Implemented
//! - **Perturbation Method** - Taylor series expansion
//! - **Spectral SFEM** - Polynomial chaos expansion
//! - **Monte Carlo FEM** - Direct sampling
//! - **Neumann Expansion** - Series solution for random systems

use serde::{Deserialize, Serialize};
use crate::special_functions::gamma;

// ============================================================================
// RANDOM VARIABLES
// ============================================================================

/// Distribution types for random variables
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum Distribution {
    Normal { mean: f64, std_dev: f64 },
    Lognormal { mean: f64, std_dev: f64 },
    Uniform { min: f64, max: f64 },
    Weibull { scale: f64, shape: f64 },
    Gumbel { location: f64, scale: f64 },
    Beta { alpha: f64, beta: f64, min: f64, max: f64 },
    Exponential { rate: f64 },
}

impl Distribution {
    /// Get mean value
    pub fn mean(&self) -> f64 {
        match *self {
            Distribution::Normal { mean, .. } => mean,
            Distribution::Lognormal { mean, std_dev } => {
                let sigma2 = (1.0 + (std_dev / mean).powi(2)).ln();
                let mu = mean.ln() - 0.5 * sigma2;
                (mu + 0.5 * sigma2).exp()
            }
            Distribution::Uniform { min, max } => 0.5 * (min + max),
            Distribution::Weibull { scale, shape } => {
                scale * gamma(1.0 + 1.0 / shape)
            }
            Distribution::Gumbel { location, scale } => {
                location + scale * 0.5772156649  // Euler-Mascheroni constant
            }
            Distribution::Beta { alpha, beta, min, max } => {
                min + (max - min) * alpha / (alpha + beta)
            }
            Distribution::Exponential { rate } => 1.0 / rate,
        }
    }

    /// Get standard deviation
    pub fn std_dev(&self) -> f64 {
        match *self {
            Distribution::Normal { std_dev, .. } => std_dev,
            Distribution::Lognormal { mean, std_dev } => {
                let cv = std_dev / mean;
                let sigma2 = (1.0 + cv * cv).ln();
                mean * (sigma2.exp() - 1.0).sqrt()
            }
            Distribution::Uniform { min, max } => (max - min) / (12.0_f64).sqrt(),
            Distribution::Weibull { scale, shape } => {
                let g1 = gamma(1.0 + 1.0 / shape);
                let g2 = gamma(1.0 + 2.0 / shape);
                scale * (g2 - g1 * g1).sqrt()
            }
            Distribution::Gumbel { scale, .. } => {
                scale * std::f64::consts::PI / (6.0_f64).sqrt()
            }
            Distribution::Beta { alpha, beta, min, max } => {
                let var = alpha * beta / ((alpha + beta).powi(2) * (alpha + beta + 1.0));
                (max - min) * var.sqrt()
            }
            Distribution::Exponential { rate } => 1.0 / rate,
        }
    }

    /// Coefficient of variation
    pub fn cov(&self) -> f64 {
        self.std_dev() / self.mean()
    }

    /// Sample from distribution (using Box-Muller for normal)
    pub fn sample(&self, u1: f64, u2: f64) -> f64 {
        match *self {
            Distribution::Normal { mean, std_dev } => {
                let z = (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos();
                mean + std_dev * z
            }
            Distribution::Lognormal { mean, std_dev } => {
                let cv = std_dev / mean;
                let sigma2 = (1.0 + cv * cv).ln();
                let mu = mean.ln() - 0.5 * sigma2;
                let z = (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos();
                (mu + sigma2.sqrt() * z).exp()
            }
            Distribution::Uniform { min, max } => {
                min + u1 * (max - min)
            }
            Distribution::Weibull { scale, shape } => {
                scale * (-u1.ln()).powf(1.0 / shape)
            }
            Distribution::Gumbel { location, scale } => {
                location - scale * (-u1.ln()).ln()
            }
            Distribution::Beta { alpha, beta, min, max } => {
                // Simplified beta sampling using transformation
                let x = beta_sample(alpha, beta, u1, u2);
                min + x * (max - min)
            }
            Distribution::Exponential { rate } => {
                -u1.ln() / rate
            }
        }
    }
}

/// Simplified beta sample
fn beta_sample(alpha: f64, beta: f64, u1: f64, u2: f64) -> f64 {
    // Use inverse CDF approximation for beta distribution
    let mean = alpha / (alpha + beta);
    let var = alpha * beta / ((alpha + beta).powi(2) * (alpha + beta + 1.0));
    
    // Normal approximation for simplicity
    let z = (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos();
    let x = mean + var.sqrt() * z;
    x.max(0.0).min(1.0)
}

/// Random variable for structural analysis
#[derive(Debug, Clone)]
pub struct RandomVariable {
    pub name: String,
    pub distribution: Distribution,
    pub correlation_group: Option<usize>,
}

impl RandomVariable {
    pub fn new(name: &str, distribution: Distribution) -> Self {
        RandomVariable {
            name: name.to_string(),
            distribution,
            correlation_group: None,
        }
    }

    pub fn with_correlation(mut self, group: usize) -> Self {
        self.correlation_group = Some(group);
        self
    }
}

// ============================================================================
// CORRELATION STRUCTURE
// ============================================================================

/// Correlation matrix for random variables
#[derive(Debug, Clone)]
pub struct CorrelationMatrix {
    pub n: usize,
    pub matrix: Vec<f64>,  // Row-major storage
}

impl CorrelationMatrix {
    pub fn identity(n: usize) -> Self {
        let mut matrix = vec![0.0; n * n];
        for i in 0..n {
            matrix[i * n + i] = 1.0;
        }
        CorrelationMatrix { n, matrix }
    }

    pub fn new(n: usize, correlations: Vec<f64>) -> Self {
        assert_eq!(correlations.len(), n * n);
        CorrelationMatrix { n, matrix: correlations }
    }

    /// Set correlation between variables i and j
    pub fn set(&mut self, i: usize, j: usize, rho: f64) {
        assert!(rho >= -1.0 && rho <= 1.0);
        self.matrix[i * self.n + j] = rho;
        self.matrix[j * self.n + i] = rho;
    }

    /// Get correlation
    pub fn get(&self, i: usize, j: usize) -> f64 {
        self.matrix[i * self.n + j]
    }

    /// Cholesky decomposition for correlated sampling
    pub fn cholesky(&self) -> Option<Vec<f64>> {
        let mut l = vec![0.0; self.n * self.n];

        for i in 0..self.n {
            for j in 0..=i {
                let mut sum = 0.0;
                for k in 0..j {
                    sum += l[i * self.n + k] * l[j * self.n + k];
                }

                if i == j {
                    let diag = self.matrix[i * self.n + i] - sum;
                    if diag <= 0.0 {
                        return None;  // Not positive definite
                    }
                    l[i * self.n + j] = diag.sqrt();
                } else {
                    l[i * self.n + j] = (self.matrix[i * self.n + j] - sum) / l[j * self.n + j];
                }
            }
        }

        Some(l)
    }

    /// Generate correlated samples
    pub fn correlate(&self, independent: &[f64]) -> Vec<f64> {
        let l = self.cholesky().unwrap_or_else(|| vec![0.0; self.n * self.n]);
        let mut correlated = vec![0.0; self.n];

        for i in 0..self.n {
            for j in 0..=i {
                correlated[i] += l[i * self.n + j] * independent[j];
            }
        }

        correlated
    }
}

// ============================================================================
// PERTURBATION METHOD
// ============================================================================

/// First-order perturbation SFEM
#[derive(Debug, Clone)]
pub struct PerturbationSFEM {
    pub n_dof: usize,
    pub n_rv: usize,  // Number of random variables
    pub mean_k: Vec<f64>,       // Mean stiffness
    pub dk_dtheta: Vec<Vec<f64>>,  // Stiffness derivatives
    pub mean_f: Vec<f64>,       // Mean force
    pub df_dtheta: Vec<Vec<f64>>,  // Force derivatives
}

impl PerturbationSFEM {
    pub fn new(n_dof: usize, n_rv: usize) -> Self {
        PerturbationSFEM {
            n_dof,
            n_rv,
            mean_k: vec![0.0; n_dof * n_dof],
            dk_dtheta: vec![vec![0.0; n_dof * n_dof]; n_rv],
            mean_f: vec![0.0; n_dof],
            df_dtheta: vec![vec![0.0; n_dof]; n_rv],
        }
    }

    /// Set mean stiffness matrix
    pub fn set_mean_stiffness(&mut self, k: Vec<f64>) {
        self.mean_k = k;
    }

    /// Set stiffness derivative for random variable i
    pub fn set_stiffness_derivative(&mut self, rv_idx: usize, dk: Vec<f64>) {
        if rv_idx < self.n_rv {
            self.dk_dtheta[rv_idx] = dk;
        }
    }

    /// Solve for mean response
    pub fn solve_mean(&self) -> Vec<f64> {
        self.solve_linear(&self.mean_k, &self.mean_f)
    }

    /// Solve for displacement derivatives (du/dθ)
    /// K * (du/dθ) = dF/dθ - (dK/dθ) * u_mean
    pub fn solve_derivatives(&self, u_mean: &[f64]) -> Vec<Vec<f64>> {
        let mut du_dtheta = Vec::new();

        for i in 0..self.n_rv {
            let mut rhs = self.df_dtheta[i].clone();

            // Subtract dK/dθ * u_mean
            for j in 0..self.n_dof {
                for k in 0..self.n_dof {
                    rhs[j] -= self.dk_dtheta[i][j * self.n_dof + k] * u_mean[k];
                }
            }

            let du = self.solve_linear(&self.mean_k, &rhs);
            du_dtheta.push(du);
        }

        du_dtheta
    }

    /// Compute response covariance
    /// Cov[u] = Σ (du/dθ_i) * (du/dθ_j) * Cov[θ_i, θ_j]
    pub fn response_covariance(
        &self,
        du_dtheta: &[Vec<f64>],
        rv_covariance: &[f64],  // n_rv x n_rv
    ) -> Vec<f64> {
        let mut cov_u = vec![0.0; self.n_dof * self.n_dof];

        for i in 0..self.n_rv {
            for j in 0..self.n_rv {
                let cov_ij = rv_covariance[i * self.n_rv + j];

                for k in 0..self.n_dof {
                    for l in 0..self.n_dof {
                        cov_u[k * self.n_dof + l] += 
                            du_dtheta[i][k] * du_dtheta[j][l] * cov_ij;
                    }
                }
            }
        }

        cov_u
    }

    /// Response standard deviation
    pub fn response_std_dev(&self, cov_u: &[f64]) -> Vec<f64> {
        (0..self.n_dof)
            .map(|i| cov_u[i * self.n_dof + i].sqrt())
            .collect()
    }

    fn solve_linear(&self, a: &[f64], b: &[f64]) -> Vec<f64> {
        let n = self.n_dof;
        let mut aug = a.to_vec();
        let mut x = b.to_vec();

        for i in 0..n {
            let pivot = aug[i * n + i];
            if pivot.abs() < 1e-14 {
                continue;
            }

            for k in (i + 1)..n {
                let factor = aug[k * n + i] / pivot;
                for j in 0..n {
                    aug[k * n + j] -= factor * aug[i * n + j];
                }
                x[k] -= factor * x[i];
            }
        }

        for i in (0..n).rev() {
            let pivot = aug[i * n + i];
            if pivot.abs() < 1e-14 {
                continue;
            }
            x[i] /= pivot;
            for k in 0..i {
                x[k] -= aug[k * n + i] * x[i];
            }
        }

        x
    }
}

// ============================================================================
// POLYNOMIAL CHAOS EXPANSION (PCE)
// ============================================================================

/// Polynomial type for chaos expansion
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PolynomialBasis {
    Hermite,    // Normal distribution
    Legendre,   // Uniform distribution
    Laguerre,   // Exponential distribution
    Jacobi,     // Beta distribution
}

/// Polynomial Chaos Expansion
#[derive(Debug, Clone)]
pub struct PolynomialChaos {
    pub dimension: usize,      // Number of random variables
    pub order: usize,          // Polynomial order
    pub basis: PolynomialBasis,
    pub n_terms: usize,        // Number of PCE terms
    pub multi_indices: Vec<Vec<usize>>,  // Multi-index set
}

impl PolynomialChaos {
    pub fn new(dimension: usize, order: usize, basis: PolynomialBasis) -> Self {
        let multi_indices = Self::generate_multi_indices(dimension, order);
        let n_terms = multi_indices.len();

        PolynomialChaos {
            dimension,
            order,
            basis,
            n_terms,
            multi_indices,
        }
    }

    /// Generate multi-indices for total order expansion
    fn generate_multi_indices(dim: usize, order: usize) -> Vec<Vec<usize>> {
        let mut indices = Vec::new();
        Self::generate_indices_recursive(dim, order, 0, vec![0; dim], &mut indices);
        indices
    }

    fn generate_indices_recursive(
        dim: usize,
        remaining_order: usize,
        current_dim: usize,
        current: Vec<usize>,
        result: &mut Vec<Vec<usize>>,
    ) {
        if current_dim == dim {
            result.push(current);
            return;
        }

        for i in 0..=remaining_order {
            let mut next = current.clone();
            next[current_dim] = i;
            Self::generate_indices_recursive(
                dim,
                remaining_order - i,
                current_dim + 1,
                next,
                result,
            );
        }
    }

    /// Evaluate univariate polynomial
    pub fn evaluate_polynomial(&self, order: usize, xi: f64) -> f64 {
        match self.basis {
            PolynomialBasis::Hermite => self.hermite(order, xi),
            PolynomialBasis::Legendre => self.legendre(order, xi),
            PolynomialBasis::Laguerre => self.laguerre(order, xi),
            PolynomialBasis::Jacobi => self.jacobi(order, xi, 0.0, 0.0),
        }
    }

    /// Evaluate multivariate basis function
    pub fn evaluate_basis(&self, term_idx: usize, xi: &[f64]) -> f64 {
        let indices = &self.multi_indices[term_idx];
        let mut result = 1.0;

        for (d, &order) in indices.iter().enumerate() {
            result *= self.evaluate_polynomial(order, xi[d]);
        }

        result
    }

    /// Hermite polynomial (probabilist's)
    fn hermite(&self, n: usize, x: f64) -> f64 {
        match n {
            0 => 1.0,
            1 => x,
            _ => {
                let mut h_prev = 1.0;
                let mut h_curr = x;
                for k in 2..=n {
                    let h_next = x * h_curr - (k - 1) as f64 * h_prev;
                    h_prev = h_curr;
                    h_curr = h_next;
                }
                h_curr
            }
        }
    }

    /// Legendre polynomial
    fn legendre(&self, n: usize, x: f64) -> f64 {
        match n {
            0 => 1.0,
            1 => x,
            _ => {
                let mut p_prev = 1.0;
                let mut p_curr = x;
                for k in 2..=n {
                    let p_next = ((2 * k - 1) as f64 * x * p_curr 
                        - (k - 1) as f64 * p_prev) / k as f64;
                    p_prev = p_curr;
                    p_curr = p_next;
                }
                p_curr
            }
        }
    }

    /// Laguerre polynomial
    fn laguerre(&self, n: usize, x: f64) -> f64 {
        match n {
            0 => 1.0,
            1 => 1.0 - x,
            _ => {
                let mut l_prev = 1.0;
                let mut l_curr = 1.0 - x;
                for k in 2..=n {
                    let mut l_next = ((2 * k - 1) as f64 - x) * l_curr 
                        - (k - 1) as f64 * l_prev;
                    l_next /= k as f64;
                    l_prev = l_curr;
                    l_curr = l_next;
                }
                l_curr
            }
        }
    }

    /// Jacobi polynomial
    fn jacobi(&self, n: usize, x: f64, alpha: f64, beta: f64) -> f64 {
        match n {
            0 => 1.0,
            1 => 0.5 * (alpha - beta + (alpha + beta + 2.0) * x),
            _ => {
                let mut p_prev = 1.0;
                let mut p_curr = 0.5 * (alpha - beta + (alpha + beta + 2.0) * x);

                for k in 2..=n {
                    let k_f = k as f64;
                    let a = alpha;
                    let b = beta;

                    let c1 = 2.0 * k_f * (k_f + a + b) * (2.0 * k_f + a + b - 2.0);
                    let c2 = (2.0 * k_f + a + b - 1.0) 
                        * ((2.0 * k_f + a + b) * (2.0 * k_f + a + b - 2.0) * x + a * a - b * b);
                    let c3 = 2.0 * (k_f + a - 1.0) * (k_f + b - 1.0) * (2.0 * k_f + a + b);

                    let p_next = (c2 * p_curr - c3 * p_prev) / c1;
                    p_prev = p_curr;
                    p_curr = p_next;
                }
                p_curr
            }
        }
    }

    /// Compute norm squared for basis function
    pub fn norm_squared(&self, term_idx: usize) -> f64 {
        let indices = &self.multi_indices[term_idx];
        let mut norm2 = 1.0;

        for &order in indices {
            norm2 *= match self.basis {
                PolynomialBasis::Hermite => factorial(order) as f64,
                PolynomialBasis::Legendre => 1.0 / (2.0 * order as f64 + 1.0),
                PolynomialBasis::Laguerre => 1.0,
                PolynomialBasis::Jacobi => 1.0,  // Depends on alpha, beta
            };
        }

        norm2
    }
}

fn factorial(n: usize) -> usize {
    (1..=n).product()
}

/// PCE coefficients for response
#[derive(Debug, Clone)]
pub struct PCEResponse {
    pub pce: PolynomialChaos,
    pub coefficients: Vec<f64>,  // Coefficients for each term
}

impl PCEResponse {
    pub fn new(pce: PolynomialChaos) -> Self {
        let n_terms = pce.n_terms;
        PCEResponse {
            pce,
            coefficients: vec![0.0; n_terms],
        }
    }

    /// Evaluate response at given random variable values
    pub fn evaluate(&self, xi: &[f64]) -> f64 {
        let mut result = 0.0;
        for (i, &coeff) in self.coefficients.iter().enumerate() {
            result += coeff * self.pce.evaluate_basis(i, xi);
        }
        result
    }

    /// Compute mean (coefficient of order-0 term)
    pub fn mean(&self) -> f64 {
        self.coefficients[0]
    }

    /// Compute variance from PCE coefficients
    pub fn variance(&self) -> f64 {
        let mut var = 0.0;
        for (i, &coeff) in self.coefficients.iter().enumerate().skip(1) {
            var += coeff * coeff * self.pce.norm_squared(i);
        }
        var
    }

    /// Compute standard deviation
    pub fn std_dev(&self) -> f64 {
        self.variance().sqrt()
    }

    /// Sobol sensitivity indices
    pub fn sobol_indices(&self) -> Vec<f64> {
        let total_var = self.variance();
        if total_var < 1e-14 {
            return vec![0.0; self.pce.dimension];
        }

        let mut indices = vec![0.0; self.pce.dimension];

        for (term_idx, &coeff) in self.coefficients.iter().enumerate().skip(1) {
            let multi_idx = &self.pce.multi_indices[term_idx];
            
            // Find which dimension this term depends on
            for (d, &order) in multi_idx.iter().enumerate() {
                if order > 0 {
                    indices[d] += coeff * coeff * self.pce.norm_squared(term_idx);
                }
            }
        }

        for idx in &mut indices {
            *idx /= total_var;
        }

        indices
    }
}

// ============================================================================
// NEUMANN EXPANSION
// ============================================================================

/// Neumann series expansion for random stiffness
#[derive(Debug, Clone)]
pub struct NeumannExpansion {
    pub n_dof: usize,
    pub order: usize,  // Expansion order
}

impl NeumannExpansion {
    pub fn new(n_dof: usize, order: usize) -> Self {
        NeumannExpansion { n_dof, order }
    }

    /// Solve K(θ) * u = F using Neumann expansion
    /// K(θ) = K₀ + ΔK(θ)
    /// u = K₀⁻¹ * F - K₀⁻¹ * ΔK * K₀⁻¹ * F + ...
    /// u = Σ (-K₀⁻¹ * ΔK)ⁿ * K₀⁻¹ * F
    pub fn solve(
        &self,
        k0: &[f64],
        delta_k: &[f64],
        f: &[f64],
    ) -> Vec<f64> {
        let n = self.n_dof;

        // Compute K₀⁻¹ * F
        let u0 = self.solve_linear(k0, f);

        // Compute K₀⁻¹ * ΔK
        let mut k0_inv_dk = vec![0.0; n * n];
        for j in 0..n {
            let mut col = vec![0.0; n];
            for i in 0..n {
                col[i] = delta_k[i * n + j];
            }
            let inv_col = self.solve_linear(k0, &col);
            for i in 0..n {
                k0_inv_dk[i * n + j] = inv_col[i];
            }
        }

        // Neumann series
        let mut u = u0.clone();
        let mut v = u0;

        for _ in 1..=self.order {
            // v = -K₀⁻¹ * ΔK * v
            let mut new_v = vec![0.0; n];
            for i in 0..n {
                for j in 0..n {
                    new_v[i] -= k0_inv_dk[i * n + j] * v[j];
                }
            }
            v = new_v;

            // u += v
            for i in 0..n {
                u[i] += v[i];
            }
        }

        u
    }

    /// Check convergence condition: ρ(K₀⁻¹ * ΔK) < 1
    pub fn check_convergence(&self, k0: &[f64], delta_k: &[f64]) -> f64 {
        let n = self.n_dof;

        // Estimate spectral radius using power iteration
        let mut x = vec![1.0; n];

        for _ in 0..50 {
            // y = ΔK * x
            let mut y = vec![0.0; n];
            for i in 0..n {
                for j in 0..n {
                    y[i] += delta_k[i * n + j] * x[j];
                }
            }

            // z = K₀⁻¹ * y
            let z = self.solve_linear(k0, &y);

            // Estimate eigenvalue
            let lambda: f64 = x.iter().zip(z.iter()).map(|(&a, &b)| a * b).sum::<f64>()
                / x.iter().map(|&v| v * v).sum::<f64>();

            // Normalize
            let norm: f64 = z.iter().map(|&v| v * v).sum::<f64>().sqrt();
            x = z.iter().map(|&v| v / norm).collect();

            if lambda.abs() < 1e-10 {
                return 0.0;
            }
        }

        // Return spectral radius estimate
        let y: Vec<f64> = (0..n).map(|i| {
            (0..n).map(|j| delta_k[i * n + j] * x[j]).sum()
        }).collect();
        let z = self.solve_linear(k0, &y);

        (z.iter().map(|&v| v * v).sum::<f64>() / x.iter().map(|&v| v * v).sum::<f64>()).sqrt()
    }

    fn solve_linear(&self, a: &[f64], b: &[f64]) -> Vec<f64> {
        let n = self.n_dof;
        let mut aug = a.to_vec();
        let mut x = b.to_vec();

        for i in 0..n {
            let pivot = aug[i * n + i];
            if pivot.abs() < 1e-14 {
                continue;
            }

            for k in (i + 1)..n {
                let factor = aug[k * n + i] / pivot;
                for j in 0..n {
                    aug[k * n + j] -= factor * aug[i * n + j];
                }
                x[k] -= factor * x[i];
            }
        }

        for i in (0..n).rev() {
            let pivot = aug[i * n + i];
            if pivot.abs() < 1e-14 {
                continue;
            }
            x[i] /= pivot;
            for k in 0..i {
                x[k] -= aug[k * n + i] * x[i];
            }
        }

        x
    }
}

// ============================================================================
// MONTE CARLO FEM
// ============================================================================

/// Monte Carlo SFEM
#[derive(Debug, Clone)]
pub struct MonteCarloSFEM {
    pub n_samples: usize,
    pub seed: u64,
}

impl MonteCarloSFEM {
    pub fn new(n_samples: usize) -> Self {
        MonteCarloSFEM {
            n_samples,
            seed: 12345,
        }
    }

    pub fn with_seed(mut self, seed: u64) -> Self {
        self.seed = seed;
        self
    }

    /// Generate samples from random variables
    pub fn generate_samples(&self, variables: &[RandomVariable]) -> Vec<Vec<f64>> {
        let n_rv = variables.len();
        let mut samples = vec![vec![0.0; n_rv]; self.n_samples];

        // Simple LCG for reproducibility
        let mut rng_state = self.seed;

        for sample in &mut samples {
            for (j, rv) in variables.iter().enumerate() {
                let u1 = lcg_random(&mut rng_state);
                let u2 = lcg_random(&mut rng_state);
                sample[j] = rv.distribution.sample(u1, u2);
            }
        }

        samples
    }

    /// Compute statistics from samples
    pub fn compute_statistics(&self, samples: &[f64]) -> SampleStatistics {
        let n = samples.len();
        let mean = samples.iter().sum::<f64>() / n as f64;

        let variance = samples.iter()
            .map(|&x| (x - mean).powi(2))
            .sum::<f64>() / (n - 1) as f64;

        let std_dev = variance.sqrt();

        let mut sorted = samples.to_vec();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        let p05 = sorted[(0.05 * n as f64) as usize];
        let p50 = sorted[(0.50 * n as f64) as usize];
        let p95 = sorted[(0.95 * n as f64) as usize];

        SampleStatistics {
            mean,
            std_dev,
            variance,
            cov: std_dev / mean,
            min: sorted[0],
            max: sorted[n - 1],
            percentile_5: p05,
            percentile_50: p50,
            percentile_95: p95,
        }
    }
}

fn lcg_random(state: &mut u64) -> f64 {
    *state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
    (*state as f64) / (u64::MAX as f64)
}

/// Sample statistics
#[derive(Debug, Clone)]
pub struct SampleStatistics {
    pub mean: f64,
    pub std_dev: f64,
    pub variance: f64,
    pub cov: f64,
    pub min: f64,
    pub max: f64,
    pub percentile_5: f64,
    pub percentile_50: f64,
    pub percentile_95: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normal_distribution() {
        let dist = Distribution::Normal { mean: 100.0, std_dev: 10.0 };
        assert!((dist.mean() - 100.0).abs() < 1e-10);
        assert!((dist.std_dev() - 10.0).abs() < 1e-10);
    }

    #[test]
    fn test_uniform_distribution() {
        let dist = Distribution::Uniform { min: 0.0, max: 10.0 };
        assert!((dist.mean() - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_correlation_matrix() {
        let mut corr = CorrelationMatrix::identity(3);
        corr.set(0, 1, 0.5);

        assert!((corr.get(0, 1) - 0.5).abs() < 1e-10);
        assert!((corr.get(1, 0) - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_cholesky() {
        let corr = CorrelationMatrix::identity(3);
        let l = corr.cholesky().unwrap();

        // Should be identity for identity correlation
        assert!((l[0] - 1.0).abs() < 1e-10);
        assert!((l[4] - 1.0).abs() < 1e-10);
        assert!((l[8] - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_polynomial_chaos() {
        let pce = PolynomialChaos::new(2, 2, PolynomialBasis::Hermite);

        // Total order 2 with 2 dimensions: 1 + 2 + 3 = 6 terms
        assert_eq!(pce.n_terms, 6);
    }

    #[test]
    fn test_hermite_polynomial() {
        let pce = PolynomialChaos::new(1, 3, PolynomialBasis::Hermite);

        // H_0(x) = 1
        assert!((pce.evaluate_polynomial(0, 0.5) - 1.0).abs() < 1e-10);

        // H_1(x) = x
        assert!((pce.evaluate_polynomial(1, 0.5) - 0.5).abs() < 1e-10);

        // H_2(x) = x² - 1
        assert!((pce.evaluate_polynomial(2, 2.0) - 3.0).abs() < 1e-10);
    }

    #[test]
    fn test_legendre_polynomial() {
        let pce = PolynomialChaos::new(1, 2, PolynomialBasis::Legendre);

        // P_0(x) = 1
        assert!((pce.evaluate_polynomial(0, 0.5) - 1.0).abs() < 1e-10);

        // P_1(x) = x
        assert!((pce.evaluate_polynomial(1, 0.5) - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_pce_response() {
        let pce = PolynomialChaos::new(1, 2, PolynomialBasis::Hermite);
        let mut resp = PCEResponse::new(pce);

        resp.coefficients[0] = 10.0;  // Mean
        resp.coefficients[1] = 1.0;   // Linear term

        assert!((resp.mean() - 10.0).abs() < 1e-10);
        assert!(resp.variance() > 0.0);
    }

    #[test]
    fn test_neumann_expansion() {
        let neumann = NeumannExpansion::new(2, 3);

        // Simple 2x2 system
        let k0 = vec![2.0, 0.0, 0.0, 2.0];
        let delta_k = vec![0.1, 0.0, 0.0, 0.1];
        let f = vec![1.0, 1.0];

        let u = neumann.solve(&k0, &delta_k, &f);

        // Should be close to (K0 + ΔK)⁻¹ * F
        assert!(u[0] > 0.0);
        assert!(u[1] > 0.0);
    }

    #[test]
    fn test_monte_carlo() {
        let mc = MonteCarloSFEM::new(1000);
        let vars = vec![
            RandomVariable::new("E", Distribution::Normal { mean: 200e9, std_dev: 10e9 }),
        ];

        let samples = mc.generate_samples(&vars);
        assert_eq!(samples.len(), 1000);

        let e_samples: Vec<f64> = samples.iter().map(|s| s[0]).collect();
        let stats = mc.compute_statistics(&e_samples);

        // Mean should be close to 200e9
        assert!((stats.mean - 200e9).abs() < 20e9);
    }

    #[test]
    fn test_perturbation_sfem() {
        let mut sfem = PerturbationSFEM::new(2, 1);

        sfem.set_mean_stiffness(vec![2.0, 0.0, 0.0, 2.0]);
        sfem.mean_f = vec![1.0, 1.0];
        sfem.set_stiffness_derivative(0, vec![0.1, 0.0, 0.0, 0.1]);

        let u_mean = sfem.solve_mean();
        assert!((u_mean[0] - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_random_variable() {
        let rv = RandomVariable::new("yield_stress", Distribution::Lognormal { 
            mean: 250.0, 
            std_dev: 25.0 
        });

        assert_eq!(rv.name, "yield_stress");
    }
}
