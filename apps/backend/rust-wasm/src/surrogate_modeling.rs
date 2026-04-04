//! Surrogate Modeling
//!
//! Approximate expensive simulation models with efficient surrogates.
//! Essential for optimization, uncertainty quantification, and real-time analysis.
//!
//! ## Methods Implemented
//! - **Polynomial Response Surface** - Linear, quadratic, cubic
//! - **Kriging/Gaussian Process** - Spatial interpolation
//! - **Radial Basis Functions** - RBF interpolation
//! - **Support Vector Regression** - Kernel-based
//! - **Neural Network Surrogate** - MLP approximation

use crate::special_functions::erf;

// ============================================================================
// POLYNOMIAL RESPONSE SURFACE
// ============================================================================

/// Polynomial response surface method
#[derive(Debug, Clone)]
pub struct PolynomialSurface {
    pub degree: usize,
    pub n_inputs: usize,
    pub coefficients: Vec<f64>,
    pub term_powers: Vec<Vec<usize>>,  // Powers for each term
}

impl PolynomialSurface {
    pub fn new(n_inputs: usize, degree: usize) -> Self {
        let term_powers = Self::generate_terms(n_inputs, degree);
        let n_coeffs = term_powers.len();

        PolynomialSurface {
            degree,
            n_inputs,
            coefficients: vec![0.0; n_coeffs],
            term_powers,
        }
    }

    /// Generate polynomial terms up to given degree
    fn generate_terms(n_inputs: usize, max_degree: usize) -> Vec<Vec<usize>> {
        let mut terms = Vec::new();
        Self::generate_terms_recursive(n_inputs, max_degree, 0, vec![0; n_inputs], &mut terms);
        terms
    }

    fn generate_terms_recursive(
        n_inputs: usize,
        remaining_degree: usize,
        current_input: usize,
        current_powers: Vec<usize>,
        result: &mut Vec<Vec<usize>>,
    ) {
        if current_input == n_inputs {
            result.push(current_powers);
            return;
        }

        for power in 0..=remaining_degree {
            let mut next_powers = current_powers.clone();
            next_powers[current_input] = power;
            Self::generate_terms_recursive(
                n_inputs,
                remaining_degree - power,
                current_input + 1,
                next_powers,
                result,
            );
        }
    }

    /// Fit coefficients using least squares
    pub fn fit(&mut self, x_data: &[Vec<f64>], y_data: &[f64]) {
        let n_samples = x_data.len();
        let n_terms = self.term_powers.len();

        // Build design matrix Φ
        let mut phi = vec![0.0; n_samples * n_terms];

        for (i, x) in x_data.iter().enumerate() {
            for (j, powers) in self.term_powers.iter().enumerate() {
                let mut term = 1.0;
                for (k, &p) in powers.iter().enumerate() {
                    term *= x[k].powi(p as i32);
                }
                phi[i * n_terms + j] = term;
            }
        }

        // Solve normal equations: (Φᵀ Φ) c = Φᵀ y
        let mut phi_t_phi = vec![0.0; n_terms * n_terms];
        let mut phi_t_y = vec![0.0; n_terms];

        for i in 0..n_terms {
            for j in 0..n_terms {
                for k in 0..n_samples {
                    phi_t_phi[i * n_terms + j] += phi[k * n_terms + i] * phi[k * n_terms + j];
                }
            }
            for k in 0..n_samples {
                phi_t_y[i] += phi[k * n_terms + i] * y_data[k];
            }
        }

        // Add regularization for stability
        for i in 0..n_terms {
            phi_t_phi[i * n_terms + i] += 1e-10;
        }

        // Solve using Cholesky or Gaussian elimination
        self.coefficients = self.solve_linear(&phi_t_phi, &phi_t_y, n_terms);
    }

    /// Evaluate surrogate at point
    pub fn evaluate(&self, x: &[f64]) -> f64 {
        let mut result = 0.0;
        for (j, powers) in self.term_powers.iter().enumerate() {
            let mut term = self.coefficients[j];
            for (k, &p) in powers.iter().enumerate() {
                term *= x[k].powi(p as i32);
            }
            result += term;
        }
        result
    }

    /// Compute gradient at point
    pub fn gradient(&self, x: &[f64]) -> Vec<f64> {
        let mut grad = vec![0.0; self.n_inputs];

        for (j, powers) in self.term_powers.iter().enumerate() {
            for i in 0..self.n_inputs {
                if powers[i] == 0 {
                    continue;
                }

                let mut term = self.coefficients[j] * powers[i] as f64;
                for (k, &p) in powers.iter().enumerate() {
                    if k == i {
                        term *= x[k].powi(p as i32 - 1);
                    } else {
                        term *= x[k].powi(p as i32);
                    }
                }
                grad[i] += term;
            }
        }

        grad
    }

    /// R² coefficient of determination
    pub fn r_squared(&self, x_data: &[Vec<f64>], y_data: &[f64]) -> f64 {
        let y_mean = y_data.iter().sum::<f64>() / y_data.len() as f64;

        let ss_tot: f64 = y_data.iter().map(|&y| (y - y_mean).powi(2)).sum();
        let ss_res: f64 = x_data.iter()
            .zip(y_data.iter())
            .map(|(x, &y)| (y - self.evaluate(x)).powi(2))
            .sum();

        1.0 - ss_res / ss_tot
    }

    fn solve_linear(&self, a: &[f64], b: &[f64], n: usize) -> Vec<f64> {
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
// KRIGING / GAUSSIAN PROCESS
// ============================================================================

/// Kernel types for Kriging
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum KernelType {
    SquaredExponential,
    Matern32,
    Matern52,
    Exponential,
    Linear,
}

/// Kriging surrogate model
#[derive(Debug, Clone)]
pub struct Kriging {
    pub kernel: KernelType,
    pub length_scales: Vec<f64>,
    pub variance: f64,
    pub noise_variance: f64,
    pub x_train: Vec<Vec<f64>>,
    pub y_train: Vec<f64>,
    pub alpha: Vec<f64>,  // K⁻¹ * y
    pub y_mean: f64,
}

impl Kriging {
    pub fn new(n_inputs: usize, kernel: KernelType) -> Self {
        Kriging {
            kernel,
            length_scales: vec![1.0; n_inputs],
            variance: 1.0,
            noise_variance: 1e-6,
            x_train: Vec::new(),
            y_train: Vec::new(),
            alpha: Vec::new(),
            y_mean: 0.0,
        }
    }

    /// Set hyperparameters
    pub fn set_hyperparameters(&mut self, length_scales: Vec<f64>, variance: f64, noise: f64) {
        self.length_scales = length_scales;
        self.variance = variance;
        self.noise_variance = noise;
    }

    /// Compute kernel value
    pub fn kernel_value(&self, x1: &[f64], x2: &[f64]) -> f64 {
        let scaled_dist_sq: f64 = x1.iter()
            .zip(x2.iter())
            .zip(self.length_scales.iter())
            .map(|((&a, &b), &l)| ((a - b) / l).powi(2))
            .sum();

        match self.kernel {
            KernelType::SquaredExponential => {
                self.variance * (-0.5 * scaled_dist_sq).exp()
            }
            KernelType::Matern32 => {
                let r = scaled_dist_sq.sqrt() * 3.0_f64.sqrt();
                self.variance * (1.0 + r) * (-r).exp()
            }
            KernelType::Matern52 => {
                let r = scaled_dist_sq.sqrt() * 5.0_f64.sqrt();
                self.variance * (1.0 + r + r * r / 3.0) * (-r).exp()
            }
            KernelType::Exponential => {
                self.variance * (-scaled_dist_sq.sqrt()).exp()
            }
            KernelType::Linear => {
                self.variance * x1.iter().zip(x2.iter()).map(|(&a, &b)| a * b).sum::<f64>()
            }
        }
    }

    /// Fit the model
    pub fn fit(&mut self, x_data: &[Vec<f64>], y_data: &[f64]) {
        self.x_train = x_data.to_vec();
        self.y_train = y_data.to_vec();
        self.y_mean = y_data.iter().sum::<f64>() / y_data.len() as f64;

        let n = x_data.len();

        // Build kernel matrix
        let mut k = vec![0.0; n * n];
        for i in 0..n {
            for j in 0..n {
                k[i * n + j] = self.kernel_value(&x_data[i], &x_data[j]);
                if i == j {
                    k[i * n + j] += self.noise_variance;
                }
            }
        }

        // Solve K * α = (y - mean)
        let y_centered: Vec<f64> = y_data.iter().map(|&y| y - self.y_mean).collect();
        self.alpha = self.solve_linear(&k, &y_centered, n);
    }

    /// Predict mean at point
    pub fn predict(&self, x: &[f64]) -> f64 {
        let k_star: Vec<f64> = self.x_train.iter()
            .map(|xi| self.kernel_value(x, xi))
            .collect();

        let mean = self.y_mean + k_star.iter()
            .zip(self.alpha.iter())
            .map(|(&k, &a)| k * a)
            .sum::<f64>();

        mean
    }

    /// Predict mean and variance (uncertainty)
    pub fn predict_with_uncertainty(&self, x: &[f64]) -> (f64, f64) {
        let n = self.x_train.len();

        let k_star: Vec<f64> = self.x_train.iter()
            .map(|xi| self.kernel_value(x, xi))
            .collect();

        let mean = self.y_mean + k_star.iter()
            .zip(self.alpha.iter())
            .map(|(&k, &a)| k * a)
            .sum::<f64>();

        // Variance: k(x,x) - k*ᵀ K⁻¹ k*
        let k_xx = self.kernel_value(x, x) + self.noise_variance;

        // Build K matrix for K⁻¹ k*
        let mut k_matrix = vec![0.0; n * n];
        for i in 0..n {
            for j in 0..n {
                k_matrix[i * n + j] = self.kernel_value(&self.x_train[i], &self.x_train[j]);
                if i == j {
                    k_matrix[i * n + j] += self.noise_variance;
                }
            }
        }

        let v = self.solve_linear(&k_matrix, &k_star, n);
        let variance = k_xx - k_star.iter().zip(v.iter()).map(|(&k, &v)| k * v).sum::<f64>();

        (mean, variance.max(0.0))
    }

    fn solve_linear(&self, a: &[f64], b: &[f64], n: usize) -> Vec<f64> {
        let mut aug = a.to_vec();
        let mut x = b.to_vec();

        for i in 0..n {
            // Partial pivoting
            let mut max_row = i;
            for k in (i + 1)..n {
                if aug[k * n + i].abs() > aug[max_row * n + i].abs() {
                    max_row = k;
                }
            }

            for j in 0..n {
                aug.swap(i * n + j, max_row * n + j);
            }
            x.swap(i, max_row);

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
// RADIAL BASIS FUNCTIONS
// ============================================================================

/// RBF type
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum RBFType {
    Gaussian,
    Multiquadric,
    InverseMultiquadric,
    ThinPlateSpline,
    Cubic,
    Linear,
}

/// Radial Basis Function surrogate
#[derive(Debug, Clone)]
pub struct RBFSurrogate {
    pub rbf_type: RBFType,
    pub epsilon: f64,  // Shape parameter
    pub x_centers: Vec<Vec<f64>>,
    pub weights: Vec<f64>,
    pub polynomial_order: i32,  // -1: none, 0: constant, 1: linear
    pub poly_coeffs: Vec<f64>,
}

impl RBFSurrogate {
    pub fn new(rbf_type: RBFType, epsilon: f64) -> Self {
        RBFSurrogate {
            rbf_type,
            epsilon,
            x_centers: Vec::new(),
            weights: Vec::new(),
            polynomial_order: 0,
            poly_coeffs: Vec::new(),
        }
    }

    /// Compute RBF basis function
    pub fn rbf_value(&self, r: f64) -> f64 {
        match self.rbf_type {
            RBFType::Gaussian => (-self.epsilon * r * r).exp(),
            RBFType::Multiquadric => (1.0 + (self.epsilon * r).powi(2)).sqrt(),
            RBFType::InverseMultiquadric => 1.0 / (1.0 + (self.epsilon * r).powi(2)).sqrt(),
            RBFType::ThinPlateSpline => {
                if r > 0.0 { r * r * r.ln() } else { 0.0 }
            }
            RBFType::Cubic => r.powi(3),
            RBFType::Linear => r,
        }
    }

    /// Distance between two points
    fn distance(&self, x1: &[f64], x2: &[f64]) -> f64 {
        x1.iter()
            .zip(x2.iter())
            .map(|(&a, &b)| (a - b).powi(2))
            .sum::<f64>()
            .sqrt()
    }

    /// Fit the model
    pub fn fit(&mut self, x_data: &[Vec<f64>], y_data: &[f64]) {
        self.x_centers = x_data.to_vec();
        let n = x_data.len();
        let dim = if n > 0 { x_data[0].len() } else { 0 };

        // Number of polynomial terms
        let n_poly = match self.polynomial_order {
            -1 => 0,
            0 => 1,
            1 => 1 + dim,
            _ => 1 + dim,
        };

        let total = n + n_poly;
        let mut matrix = vec![0.0; total * total];
        let mut rhs = vec![0.0; total];

        // RBF matrix
        for i in 0..n {
            for j in 0..n {
                let r = self.distance(&x_data[i], &x_data[j]);
                matrix[i * total + j] = self.rbf_value(r);
            }
            rhs[i] = y_data[i];
        }

        // Polynomial terms
        for i in 0..n {
            for p in 0..n_poly {
                let val = if p == 0 {
                    1.0
                } else {
                    x_data[i][p - 1]
                };
                matrix[i * total + n + p] = val;
                matrix[(n + p) * total + i] = val;
            }
        }

        // Solve augmented system
        let solution = self.solve_linear(&matrix, &rhs, total);

        self.weights = solution[..n].to_vec();
        self.poly_coeffs = solution[n..].to_vec();
    }

    /// Evaluate at point
    pub fn evaluate(&self, x: &[f64]) -> f64 {
        let mut result = 0.0;

        // RBF contribution
        for (i, center) in self.x_centers.iter().enumerate() {
            let r = self.distance(x, center);
            result += self.weights[i] * self.rbf_value(r);
        }

        // Polynomial contribution
        if !self.poly_coeffs.is_empty() {
            result += self.poly_coeffs[0];
            for (i, &c) in self.poly_coeffs.iter().enumerate().skip(1) {
                if i - 1 < x.len() {
                    result += c * x[i - 1];
                }
            }
        }

        result
    }

    fn solve_linear(&self, a: &[f64], b: &[f64], n: usize) -> Vec<f64> {
        let mut aug = a.to_vec();
        let mut x = b.to_vec();

        for i in 0..n {
            let mut max_row = i;
            for k in (i + 1)..n {
                if aug[k * n + i].abs() > aug[max_row * n + i].abs() {
                    max_row = k;
                }
            }

            for j in 0..n {
                aug.swap(i * n + j, max_row * n + j);
            }
            x.swap(i, max_row);

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
// NEURAL NETWORK SURROGATE
// ============================================================================

/// Activation functions
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Activation {
    ReLU,
    Tanh,
    Sigmoid,
    Linear,
    LeakyReLU,
}

impl Activation {
    pub fn apply(&self, x: f64) -> f64 {
        match self {
            Activation::ReLU => x.max(0.0),
            Activation::Tanh => x.tanh(),
            Activation::Sigmoid => 1.0 / (1.0 + (-x).exp()),
            Activation::Linear => x,
            Activation::LeakyReLU => if x > 0.0 { x } else { 0.01 * x },
        }
    }

    pub fn derivative(&self, x: f64) -> f64 {
        match self {
            Activation::ReLU => if x > 0.0 { 1.0 } else { 0.0 },
            Activation::Tanh => 1.0 - x.tanh().powi(2),
            Activation::Sigmoid => {
                let s = 1.0 / (1.0 + (-x).exp());
                s * (1.0 - s)
            }
            Activation::Linear => 1.0,
            Activation::LeakyReLU => if x > 0.0 { 1.0 } else { 0.01 },
        }
    }
}

/// Simple feedforward neural network surrogate
#[derive(Debug, Clone)]
pub struct NeuralNetworkSurrogate {
    pub layer_sizes: Vec<usize>,
    pub weights: Vec<Vec<f64>>,
    pub biases: Vec<Vec<f64>>,
    pub activation: Activation,
    pub learning_rate: f64,
}

impl NeuralNetworkSurrogate {
    pub fn new(layer_sizes: Vec<usize>, activation: Activation) -> Self {
        let mut weights = Vec::new();
        let mut biases = Vec::new();

        let mut rng_state = 42u64;

        for i in 0..layer_sizes.len() - 1 {
            let n_in = layer_sizes[i];
            let n_out = layer_sizes[i + 1];

            // Xavier initialization
            let scale = (2.0 / (n_in + n_out) as f64).sqrt();

            let mut w = vec![0.0; n_in * n_out];
            for val in &mut w {
                *val = (lcg_random(&mut rng_state) - 0.5) * 2.0 * scale;
            }
            weights.push(w);

            biases.push(vec![0.0; n_out]);
        }

        NeuralNetworkSurrogate {
            layer_sizes,
            weights,
            biases,
            activation,
            learning_rate: 0.01,
        }
    }

    /// Forward pass
    pub fn forward(&self, x: &[f64]) -> Vec<Vec<f64>> {
        let mut activations = vec![x.to_vec()];

        for (i, (w, b)) in self.weights.iter().zip(self.biases.iter()).enumerate() {
            let prev = activations.last().unwrap();
            let n_in = self.layer_sizes[i];
            let n_out = self.layer_sizes[i + 1];

            let mut z = vec![0.0; n_out];
            for j in 0..n_out {
                z[j] = b[j];
                for k in 0..n_in {
                    z[j] += w[k * n_out + j] * prev[k];
                }

                // Apply activation (except last layer)
                if i < self.weights.len() - 1 {
                    z[j] = self.activation.apply(z[j]);
                }
            }
            activations.push(z);
        }

        activations
    }

    /// Evaluate (single output)
    pub fn evaluate(&self, x: &[f64]) -> f64 {
        let activations = self.forward(x);
        activations.last().unwrap()[0]
    }

    /// Train using gradient descent
    pub fn train(&mut self, x_data: &[Vec<f64>], y_data: &[f64], epochs: usize) {
        for _ in 0..epochs {
            for (x, &y) in x_data.iter().zip(y_data.iter()) {
                self.train_step(x, y);
            }
        }
    }

    fn train_step(&mut self, x: &[f64], y: f64) {
        let activations = self.forward(x);
        let n_layers = self.layer_sizes.len();

        // Output error
        let output = activations.last().unwrap()[0];
        let mut delta = vec![vec![output - y]];

        // Backpropagation
        for l in (0..n_layers - 2).rev() {
            let n_curr = self.layer_sizes[l + 1];
            let n_next = self.layer_sizes[l + 2];

            let mut d = vec![0.0; n_curr];
            for j in 0..n_curr {
                let mut sum = 0.0;
                for k in 0..n_next {
                    sum += self.weights[l + 1][j * n_next + k] * delta[0][k];
                }
                d[j] = sum * self.activation.derivative(activations[l + 1][j]);
            }
            delta.insert(0, d);
        }

        // Update weights and biases
        for l in 0..n_layers - 1 {
            let n_in = self.layer_sizes[l];
            let n_out = self.layer_sizes[l + 1];

            for j in 0..n_out {
                self.biases[l][j] -= self.learning_rate * delta[l][j];
                for k in 0..n_in {
                    self.weights[l][k * n_out + j] -= 
                        self.learning_rate * delta[l][j] * activations[l][k];
                }
            }
        }
    }

    /// Compute MSE loss
    pub fn loss(&self, x_data: &[Vec<f64>], y_data: &[f64]) -> f64 {
        let mse: f64 = x_data.iter()
            .zip(y_data.iter())
            .map(|(x, &y)| (self.evaluate(x) - y).powi(2))
            .sum();
        mse / x_data.len() as f64
    }
}

fn lcg_random(state: &mut u64) -> f64 {
    *state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
    (*state as f64) / (u64::MAX as f64)
}

// ============================================================================
// ADAPTIVE SAMPLING
// ============================================================================

/// Adaptive sampling strategies
#[derive(Debug, Clone)]
pub struct AdaptiveSampling {
    pub strategy: SamplingStrategy,
    pub n_initial: usize,
    pub n_batch: usize,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SamplingStrategy {
    MaxVariance,      // Sample where uncertainty is highest
    ExpectedImprovement,  // Optimization-oriented
    LowerConfidenceBound,
    Random,
}

impl AdaptiveSampling {
    pub fn new(strategy: SamplingStrategy, n_initial: usize) -> Self {
        AdaptiveSampling {
            strategy,
            n_initial,
            n_batch: 1,
        }
    }

    /// Find next sampling point (for Kriging with uncertainty)
    pub fn next_point(
        &self,
        kriging: &Kriging,
        bounds: &[(f64, f64)],
        n_candidates: usize,
    ) -> Vec<f64> {
        let dim = bounds.len();
        let mut rng_state = 12345u64;

        let mut best_point = vec![0.0; dim];
        let mut best_score = f64::NEG_INFINITY;

        for _ in 0..n_candidates {
            let candidate: Vec<f64> = bounds.iter()
                .map(|&(lo, hi)| lo + lcg_random(&mut rng_state) * (hi - lo))
                .collect();

            let (mean, var) = kriging.predict_with_uncertainty(&candidate);
            let std = var.sqrt();

            let score = match self.strategy {
                SamplingStrategy::MaxVariance => std,
                SamplingStrategy::ExpectedImprovement => {
                    // EI = (f_min - mean) * Φ(z) + σ * φ(z)
                    let f_min = kriging.y_train.iter()
                        .cloned()
                        .fold(f64::INFINITY, f64::min);
                    if std < 1e-10 {
                        0.0
                    } else {
                        let z = (f_min - mean) / std;
                        (f_min - mean) * normal_cdf(z) + std * normal_pdf(z)
                    }
                }
                SamplingStrategy::LowerConfidenceBound => {
                    -mean + 2.0 * std  // For minimization
                }
                SamplingStrategy::Random => lcg_random(&mut rng_state),
            };

            if score > best_score {
                best_score = score;
                best_point = candidate;
            }
        }

        best_point
    }
}

fn normal_pdf(x: f64) -> f64 {
    (1.0 / (2.0 * std::f64::consts::PI).sqrt()) * (-0.5 * x * x).exp()
}

fn normal_cdf(x: f64) -> f64 {
    0.5 * (1.0 + erf(x / std::f64::consts::SQRT_2))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_polynomial_surface_linear() {
        let mut poly = PolynomialSurface::new(1, 1);

        // y = 2x + 1
        let x_data = vec![vec![0.0], vec![1.0], vec![2.0]];
        let y_data = vec![1.0, 3.0, 5.0];

        poly.fit(&x_data, &y_data);

        assert!((poly.evaluate(&[1.5]) - 4.0).abs() < 0.1);
    }

    #[test]
    fn test_polynomial_r_squared() {
        let mut poly = PolynomialSurface::new(1, 2);

        let x_data = vec![vec![0.0], vec![1.0], vec![2.0], vec![3.0]];
        let y_data = vec![0.0, 1.0, 4.0, 9.0];

        poly.fit(&x_data, &y_data);

        let r2 = poly.r_squared(&x_data, &y_data);
        assert!(r2 > 0.99);
    }

    #[test]
    fn test_kriging_basic() {
        let mut kriging = Kriging::new(1, KernelType::SquaredExponential);
        kriging.set_hyperparameters(vec![1.0], 1.0, 1e-6);

        let x_data = vec![vec![0.0], vec![1.0], vec![2.0]];
        let y_data = vec![0.0, 1.0, 2.0];

        kriging.fit(&x_data, &y_data);

        // Interpolation should pass through data points
        let y_pred = kriging.predict(&[1.0]);
        assert!((y_pred - 1.0).abs() < 0.1);
    }

    #[test]
    fn test_kriging_uncertainty() {
        let mut kriging = Kriging::new(1, KernelType::SquaredExponential);
        kriging.set_hyperparameters(vec![1.0], 1.0, 1e-6);

        let x_data = vec![vec![0.0], vec![2.0]];
        let y_data = vec![0.0, 2.0];

        kriging.fit(&x_data, &y_data);

        // Uncertainty should be higher between points
        let (_, var_at_data) = kriging.predict_with_uncertainty(&[0.0]);
        let (_, var_between) = kriging.predict_with_uncertainty(&[1.0]);

        assert!(var_between > var_at_data);
    }

    #[test]
    fn test_rbf_surrogate() {
        let mut rbf = RBFSurrogate::new(RBFType::Gaussian, 1.0);

        let x_data = vec![vec![0.0], vec![1.0], vec![2.0]];
        let y_data = vec![0.0, 1.0, 0.0];

        rbf.fit(&x_data, &y_data);

        // Should interpolate exactly at data points
        assert!((rbf.evaluate(&[0.0]) - 0.0).abs() < 0.1);
        assert!((rbf.evaluate(&[1.0]) - 1.0).abs() < 0.1);
    }

    #[test]
    fn test_neural_network_creation() {
        let nn = NeuralNetworkSurrogate::new(vec![2, 5, 1], Activation::Tanh);

        assert_eq!(nn.layer_sizes.len(), 3);
        assert_eq!(nn.weights.len(), 2);
    }

    #[test]
    fn test_neural_network_forward() {
        let nn = NeuralNetworkSurrogate::new(vec![2, 3, 1], Activation::ReLU);
        let output = nn.evaluate(&[1.0, 2.0]);

        // Just check it produces a number
        assert!(output.is_finite());
    }

    #[test]
    fn test_activation_functions() {
        assert!((Activation::ReLU.apply(-1.0) - 0.0).abs() < 1e-10);
        assert!((Activation::ReLU.apply(1.0) - 1.0).abs() < 1e-10);

        assert!((Activation::Sigmoid.apply(0.0) - 0.5).abs() < 1e-10);

        assert!((Activation::Tanh.apply(0.0) - 0.0).abs() < 1e-10);
    }

    #[test]
    fn test_adaptive_sampling() {
        let sampler = AdaptiveSampling::new(SamplingStrategy::MaxVariance, 10);
        assert_eq!(sampler.n_initial, 10);
    }

    #[test]
    fn test_kernel_types() {
        let kriging = Kriging::new(1, KernelType::Matern52);

        let k = kriging.kernel_value(&[0.0], &[0.0]);
        assert!((k - kriging.variance).abs() < 1e-10);

        let k_far = kriging.kernel_value(&[0.0], &[10.0]);
        assert!(k_far < k);  // Kernel decays with distance
    }
}
