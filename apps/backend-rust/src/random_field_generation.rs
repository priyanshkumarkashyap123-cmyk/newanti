//! Random Field Generation
//!
//! Methods for generating spatially correlated random fields.
//! Essential for modeling spatial variability in material properties.
//!
//! ## Methods Implemented
//! - **Karhunen-Loève Expansion** - Optimal L² representation
//! - **Spectral Representation** - FFT-based generation
//! - **Cholesky Decomposition** - Direct covariance factorization
//! - **Turning Bands** - Multi-dimensional extension
//! - **Sequential Gaussian Simulation** - Conditional simulation

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// CORRELATION FUNCTIONS
// ============================================================================

/// Spatial correlation function types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CorrelationFunction {
    Exponential,
    SquaredExponential,
    Matern12,
    Matern32,
    Matern52,
    SphericalModel,
    PowerLaw { exponent: f64 },
}

impl CorrelationFunction {
    /// Evaluate correlation at distance r
    pub fn evaluate(&self, r: f64, correlation_length: f64) -> f64 {
        let scaled_r = r / correlation_length;

        match *self {
            CorrelationFunction::Exponential => {
                (-scaled_r).exp()
            }
            CorrelationFunction::SquaredExponential => {
                (-scaled_r * scaled_r).exp()
            }
            CorrelationFunction::Matern12 => {
                (-scaled_r).exp()
            }
            CorrelationFunction::Matern32 => {
                let sqrt3_r = 3.0_f64.sqrt() * scaled_r;
                (1.0 + sqrt3_r) * (-sqrt3_r).exp()
            }
            CorrelationFunction::Matern52 => {
                let sqrt5_r = 5.0_f64.sqrt() * scaled_r;
                (1.0 + sqrt5_r + sqrt5_r * sqrt5_r / 3.0) * (-sqrt5_r).exp()
            }
            CorrelationFunction::SphericalModel => {
                if scaled_r >= 1.0 {
                    0.0
                } else {
                    1.0 - 1.5 * scaled_r + 0.5 * scaled_r.powi(3)
                }
            }
            CorrelationFunction::PowerLaw { exponent } => {
                (1.0 + scaled_r.powi(2)).powf(-exponent / 2.0)
            }
        }
    }

    /// Spectral density (Fourier transform of correlation)
    pub fn spectral_density(&self, k: f64, correlation_length: f64) -> f64 {
        let l = correlation_length;

        match *self {
            CorrelationFunction::Exponential => {
                // S(k) = L / (1 + (kL)²)
                l / (1.0 + (k * l).powi(2))
            }
            CorrelationFunction::SquaredExponential => {
                // S(k) = L√π * exp(-(kL/2)²)
                l * PI.sqrt() * (-(k * l / 2.0).powi(2)).exp()
            }
            CorrelationFunction::Matern32 => {
                4.0 * l / (1.0 + (k * l).powi(2)).powi(2)
            }
            CorrelationFunction::Matern52 => {
                16.0 * l / 3.0 / (1.0 + (k * l).powi(2)).powf(2.5)
            }
            _ => {
                // Numerical fallback
                self.evaluate(0.0, correlation_length)
            }
        }
    }
}

// ============================================================================
// RANDOM FIELD DEFINITION
// ============================================================================

/// Random field specification
#[derive(Debug, Clone)]
pub struct RandomFieldSpec {
    pub mean: f64,
    pub variance: f64,
    pub correlation_function: CorrelationFunction,
    pub correlation_lengths: Vec<f64>,  // Per dimension
    pub is_lognormal: bool,
}

impl RandomFieldSpec {
    pub fn new(mean: f64, variance: f64) -> Self {
        RandomFieldSpec {
            mean,
            variance,
            correlation_function: CorrelationFunction::Exponential,
            correlation_lengths: vec![1.0],
            is_lognormal: false,
        }
    }

    pub fn with_correlation(mut self, func: CorrelationFunction, lengths: Vec<f64>) -> Self {
        self.correlation_function = func;
        self.correlation_lengths = lengths;
        self
    }

    pub fn lognormal(mut self) -> Self {
        self.is_lognormal = true;
        self
    }

    /// Coefficient of variation
    pub fn cov(&self) -> f64 {
        self.variance.sqrt() / self.mean
    }
}

// ============================================================================
// KARHUNEN-LOÈVE EXPANSION
// ============================================================================

/// Karhunen-Loève expansion for random fields
#[derive(Debug, Clone)]
pub struct KarhunenLoeve {
    pub n_terms: usize,
    pub eigenvalues: Vec<f64>,
    pub eigenfunctions: Vec<Vec<f64>>,  // Values at discretization points
    pub discretization: Vec<Vec<f64>>,   // Point coordinates
}

impl KarhunenLoeve {
    pub fn new(n_terms: usize) -> Self {
        KarhunenLoeve {
            n_terms,
            eigenvalues: Vec::new(),
            eigenfunctions: Vec::new(),
            discretization: Vec::new(),
        }
    }

    /// Compute KL expansion for 1D domain [0, L]
    pub fn compute_1d(
        &mut self,
        spec: &RandomFieldSpec,
        length: f64,
        n_points: usize,
    ) {
        // Discretization points
        self.discretization = (0..n_points)
            .map(|i| vec![i as f64 * length / (n_points - 1) as f64])
            .collect();

        // Build correlation matrix
        let correlation_length = spec.correlation_lengths.get(0).copied().unwrap_or(length / 5.0);
        let mut c_matrix = vec![0.0; n_points * n_points];

        for i in 0..n_points {
            for j in 0..n_points {
                let r = (self.discretization[i][0] - self.discretization[j][0]).abs();
                c_matrix[i * n_points + j] = spec.variance 
                    * spec.correlation_function.evaluate(r, correlation_length);
            }
        }

        // Eigenvalue decomposition
        let (eigenvalues, eigenvectors) = self.eigen_decomposition(&c_matrix, n_points);

        // Keep top n_terms
        self.eigenvalues = eigenvalues.into_iter().take(self.n_terms).collect();
        self.eigenfunctions = eigenvectors.into_iter().take(self.n_terms).collect();
    }

    /// Compute KL expansion for 2D rectangular domain
    pub fn compute_2d(
        &mut self,
        spec: &RandomFieldSpec,
        lx: f64,
        ly: f64,
        nx: usize,
        ny: usize,
    ) {
        let n_points = nx * ny;

        // Discretization points
        self.discretization = Vec::new();
        for j in 0..ny {
            for i in 0..nx {
                let x = i as f64 * lx / (nx - 1).max(1) as f64;
                let y = j as f64 * ly / (ny - 1).max(1) as f64;
                self.discretization.push(vec![x, y]);
            }
        }

        // Build correlation matrix
        let lc_x = spec.correlation_lengths.get(0).copied().unwrap_or(lx / 5.0);
        let lc_y = spec.correlation_lengths.get(1).copied().unwrap_or(ly / 5.0);

        let mut c_matrix = vec![0.0; n_points * n_points];

        for i in 0..n_points {
            for j in 0..n_points {
                let dx = (self.discretization[i][0] - self.discretization[j][0]) / lc_x;
                let dy = (self.discretization[i][1] - self.discretization[j][1]) / lc_y;
                let r = (dx * dx + dy * dy).sqrt();

                c_matrix[i * n_points + j] = spec.variance 
                    * spec.correlation_function.evaluate(r, 1.0);  // Already scaled
            }
        }

        // Eigenvalue decomposition (limited for large problems)
        let n_compute = n_points.min(100);
        let (eigenvalues, eigenvectors) = self.eigen_decomposition_partial(
            &c_matrix, n_points, n_compute);

        self.eigenvalues = eigenvalues.into_iter().take(self.n_terms).collect();
        self.eigenfunctions = eigenvectors.into_iter().take(self.n_terms).collect();
    }

    /// Generate random field realization
    pub fn generate(&self, spec: &RandomFieldSpec, xi: &[f64]) -> Vec<f64> {
        let n_points = self.discretization.len();
        let mut field = vec![spec.mean; n_points];

        for (k, &lambda) in self.eigenvalues.iter().enumerate() {
            if k >= xi.len() {
                break;
            }
            let phi = &self.eigenfunctions[k];
            let contribution = lambda.sqrt() * xi[k];

            for (i, val) in field.iter_mut().enumerate() {
                *val += contribution * phi[i];
            }
        }

        // Transform to lognormal if needed
        if spec.is_lognormal {
            field = field.iter()
                .map(|&v| {
                    let log_mean = spec.mean.ln() - 0.5 * spec.variance / spec.mean.powi(2);
                    let log_std = (spec.variance / spec.mean.powi(2)).ln().sqrt();
                    (log_mean + log_std * (v - spec.mean) / spec.variance.sqrt()).exp()
                })
                .collect();
        }

        field
    }

    /// Explained variance ratio (cumulative)
    pub fn explained_variance_ratio(&self) -> Vec<f64> {
        let total: f64 = self.eigenvalues.iter().sum();
        let mut cumulative = 0.0;

        self.eigenvalues.iter()
            .map(|&lambda| {
                cumulative += lambda;
                cumulative / total
            })
            .collect()
    }

    fn eigen_decomposition(&self, a: &[f64], n: usize) -> (Vec<f64>, Vec<Vec<f64>>) {
        // Power iteration for eigenvalues
        let mut eigenvalues = Vec::new();
        let mut eigenvectors = Vec::new();

        let mut work = a.to_vec();

        for _ in 0..self.n_terms.min(n) {
            let (lambda, v) = self.power_iteration(&work, n);
            
            if lambda < 1e-10 {
                break;
            }

            eigenvalues.push(lambda);
            eigenvectors.push(v.clone());

            // Deflate
            for i in 0..n {
                for j in 0..n {
                    work[i * n + j] -= lambda * v[i] * v[j];
                }
            }
        }

        (eigenvalues, eigenvectors)
    }

    fn eigen_decomposition_partial(&self, a: &[f64], n: usize, n_eig: usize) -> (Vec<f64>, Vec<Vec<f64>>) {
        let mut eigenvalues = Vec::new();
        let mut eigenvectors = Vec::new();

        let mut work = a.to_vec();

        for _ in 0..n_eig.min(n) {
            let (lambda, v) = self.power_iteration(&work, n);
            
            if lambda < 1e-10 {
                break;
            }

            eigenvalues.push(lambda);
            eigenvectors.push(v.clone());

            // Deflate
            for i in 0..n {
                for j in 0..n {
                    work[i * n + j] -= lambda * v[i] * v[j];
                }
            }
        }

        (eigenvalues, eigenvectors)
    }

    fn power_iteration(&self, a: &[f64], n: usize) -> (f64, Vec<f64>) {
        let mut v = vec![1.0 / (n as f64).sqrt(); n];

        for _ in 0..100 {
            // w = A * v
            let mut w = vec![0.0; n];
            for i in 0..n {
                for j in 0..n {
                    w[i] += a[i * n + j] * v[j];
                }
            }

            // Rayleigh quotient
            let lambda: f64 = v.iter().zip(w.iter()).map(|(&a, &b)| a * b).sum();

            // Normalize
            let norm: f64 = w.iter().map(|&x| x * x).sum::<f64>().sqrt();
            if norm < 1e-14 {
                return (0.0, v);
            }

            let new_v: Vec<f64> = w.iter().map(|&x| x / norm).collect();

            // Check convergence
            let diff: f64 = v.iter().zip(new_v.iter()).map(|(&a, &b)| (a - b).powi(2)).sum();
            v = new_v;

            if diff < 1e-12 {
                return (lambda, v);
            }
        }

        let w: Vec<f64> = (0..n).map(|i| {
            (0..n).map(|j| a[i * n + j] * v[j]).sum()
        }).collect();
        let lambda: f64 = v.iter().zip(w.iter()).map(|(&a, &b)| a * b).sum();

        (lambda, v)
    }
}

// ============================================================================
// SPECTRAL REPRESENTATION METHOD
// ============================================================================

/// Spectral representation for random fields
#[derive(Debug, Clone)]
pub struct SpectralRepresentation {
    pub n_frequencies: usize,
    pub cutoff_frequency: f64,
}

impl SpectralRepresentation {
    pub fn new(n_frequencies: usize) -> Self {
        SpectralRepresentation {
            n_frequencies,
            cutoff_frequency: 10.0,
        }
    }

    /// Generate 1D random field realization
    pub fn generate_1d(
        &self,
        spec: &RandomFieldSpec,
        x_coords: &[f64],
        random_phases: &[f64],
    ) -> Vec<f64> {
        let n = x_coords.len();
        let mut field = vec![spec.mean; n];

        let correlation_length = spec.correlation_lengths.get(0).copied().unwrap_or(1.0);
        let dk = self.cutoff_frequency / self.n_frequencies as f64;

        for m in 0..self.n_frequencies {
            let k = (m as f64 + 0.5) * dk;
            let s_k = spec.correlation_function.spectral_density(k, correlation_length);
            let amplitude = (2.0 * s_k * dk).sqrt() * spec.variance.sqrt();

            let phase = if m < random_phases.len() { random_phases[m] } else { 0.0 };

            for (i, &x) in x_coords.iter().enumerate() {
                field[i] += amplitude * (k * x + phase).cos();
            }
        }

        if spec.is_lognormal {
            self.transform_to_lognormal(&mut field, spec);
        }

        field
    }

    /// Generate 2D random field realization
    pub fn generate_2d(
        &self,
        spec: &RandomFieldSpec,
        x_coords: &[f64],
        y_coords: &[f64],
        random_phases: &[(f64, f64)],  // (phase_x, phase_y)
    ) -> Vec<Vec<f64>> {
        let nx = x_coords.len();
        let ny = y_coords.len();
        let mut field = vec![vec![spec.mean; nx]; ny];

        let lc_x = spec.correlation_lengths.get(0).copied().unwrap_or(1.0);
        let lc_y = spec.correlation_lengths.get(1).copied().unwrap_or(1.0);
        let dk = self.cutoff_frequency / self.n_frequencies as f64;

        for mx in 0..self.n_frequencies {
            for my in 0..self.n_frequencies {
                let kx = (mx as f64 + 0.5) * dk;
                let ky = (my as f64 + 0.5) * dk;

                // 2D spectral density (separable assumption)
                let s_k = spec.correlation_function.spectral_density(kx, lc_x)
                    * spec.correlation_function.spectral_density(ky, lc_y);
                let amplitude = (2.0 * s_k * dk * dk).sqrt() * spec.variance.sqrt();

                let phase_idx = mx * self.n_frequencies + my;
                let (phase_x, phase_y) = if phase_idx < random_phases.len() {
                    random_phases[phase_idx]
                } else {
                    (0.0, 0.0)
                };

                for (j, &y) in y_coords.iter().enumerate() {
                    for (i, &x) in x_coords.iter().enumerate() {
                        field[j][i] += amplitude * (kx * x + ky * y + phase_x + phase_y).cos();
                    }
                }
            }
        }

        if spec.is_lognormal {
            for row in &mut field {
                self.transform_to_lognormal(row, spec);
            }
        }

        field
    }

    fn transform_to_lognormal(&self, field: &mut [f64], spec: &RandomFieldSpec) {
        let cv = spec.cov();
        let sigma_ln = (1.0 + cv * cv).ln().sqrt();
        let mu_ln = spec.mean.ln() - 0.5 * sigma_ln * sigma_ln;

        for val in field.iter_mut() {
            let z = (*val - spec.mean) / spec.variance.sqrt();
            *val = (mu_ln + sigma_ln * z).exp();
        }
    }
}

// ============================================================================
// CHOLESKY DECOMPOSITION METHOD
// ============================================================================

/// Cholesky decomposition method for random fields
#[derive(Debug, Clone)]
pub struct CholeskyRandomField {
    pub lower_triangular: Vec<f64>,
    pub n_points: usize,
}

impl CholeskyRandomField {
    pub fn new() -> Self {
        CholeskyRandomField {
            lower_triangular: Vec::new(),
            n_points: 0,
        }
    }

    /// Compute Cholesky factorization of correlation matrix
    pub fn compute(&mut self, spec: &RandomFieldSpec, points: &[Vec<f64>]) {
        self.n_points = points.len();
        let n = self.n_points;

        // Build covariance matrix
        let mut c = vec![0.0; n * n];

        for i in 0..n {
            for j in 0..n {
                let r = self.distance(&points[i], &points[j], &spec.correlation_lengths);
                c[i * n + j] = spec.variance 
                    * spec.correlation_function.evaluate(r, 1.0);
            }
        }

        // Cholesky decomposition
        self.lower_triangular = self.cholesky(&c, n);
    }

    /// Generate realization from standard normal samples
    pub fn generate(&self, spec: &RandomFieldSpec, z: &[f64]) -> Vec<f64> {
        let n = self.n_points;
        let mut field = vec![spec.mean; n];

        // y = mean + L * z
        for i in 0..n {
            for j in 0..=i {
                field[i] += self.lower_triangular[i * n + j] * z[j];
            }
        }

        if spec.is_lognormal {
            let cv = spec.cov();
            let sigma_ln = (1.0 + cv * cv).ln().sqrt();
            let mu_ln = spec.mean.ln() - 0.5 * sigma_ln * sigma_ln;

            for val in &mut field {
                let z = (*val - spec.mean) / spec.variance.sqrt();
                *val = (mu_ln + sigma_ln * z).exp();
            }
        }

        field
    }

    fn distance(&self, p1: &[f64], p2: &[f64], lengths: &[f64]) -> f64 {
        p1.iter()
            .zip(p2.iter())
            .zip(lengths.iter().chain(std::iter::repeat(&1.0)))
            .map(|((&a, &b), &l)| ((a - b) / l).powi(2))
            .sum::<f64>()
            .sqrt()
    }

    fn cholesky(&self, a: &[f64], n: usize) -> Vec<f64> {
        let mut l = vec![0.0; n * n];

        for i in 0..n {
            for j in 0..=i {
                let mut sum = 0.0;
                for k in 0..j {
                    sum += l[i * n + k] * l[j * n + k];
                }

                if i == j {
                    let val = a[i * n + i] - sum;
                    l[i * n + j] = if val > 0.0 { val.sqrt() } else { 1e-10 };
                } else {
                    l[i * n + j] = (a[i * n + j] - sum) / l[j * n + j];
                }
            }
        }

        l
    }
}

impl Default for CholeskyRandomField {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// TURNING BANDS METHOD
// ============================================================================

/// Turning bands method for multi-dimensional fields
#[derive(Debug, Clone)]
pub struct TurningBands {
    pub n_bands: usize,
    pub band_directions: Vec<Vec<f64>>,
}

impl TurningBands {
    pub fn new(n_bands: usize, dim: usize) -> Self {
        let band_directions = Self::generate_directions(n_bands, dim);
        TurningBands {
            n_bands,
            band_directions,
        }
    }

    /// Generate uniformly distributed directions
    fn generate_directions(n: usize, dim: usize) -> Vec<Vec<f64>> {
        let mut rng_state = 42u64;
        let mut directions = Vec::new();

        for _ in 0..n {
            let mut dir = Vec::new();
            let mut norm_sq = 0.0;

            for _ in 0..dim {
                // Box-Muller for normal
                let u1 = lcg_random(&mut rng_state);
                let u2 = lcg_random(&mut rng_state);
                let z = (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos();
                dir.push(z);
                norm_sq += z * z;
            }

            // Normalize
            let norm = norm_sq.sqrt();
            for d in &mut dir {
                *d /= norm;
            }
            directions.push(dir);
        }

        directions
    }

    /// Generate 2D/3D field using turning bands
    pub fn generate(
        &self,
        spec: &RandomFieldSpec,
        points: &[Vec<f64>],
        line_processes: &[Vec<f64>],  // 1D processes on each band
    ) -> Vec<f64> {
        let n = points.len();
        let mut field = vec![spec.mean; n];

        let scale = (self.n_bands as f64).sqrt();

        for (band_idx, direction) in self.band_directions.iter().enumerate() {
            if band_idx >= line_processes.len() {
                break;
            }

            let line_values = &line_processes[band_idx];

            for (i, point) in points.iter().enumerate() {
                // Project point onto band direction
                let projection: f64 = point.iter()
                    .zip(direction.iter())
                    .map(|(&p, &d)| p * d)
                    .sum();

                // Interpolate from line process (simple nearest)
                let line_idx = ((projection + 10.0) * 10.0) as usize;
                let line_idx = line_idx.min(line_values.len().saturating_sub(1));

                field[i] += line_values[line_idx] / scale;
            }
        }

        // Scale to correct variance
        for val in &mut field {
            *val = spec.mean + (*val - spec.mean) * spec.variance.sqrt();
        }

        field
    }
}

fn lcg_random(state: &mut u64) -> f64 {
    *state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
    (*state as f64) / (u64::MAX as f64)
}

// ============================================================================
// SEQUENTIAL GAUSSIAN SIMULATION
// ============================================================================

/// Sequential Gaussian Simulation
#[derive(Debug, Clone)]
pub struct SequentialGaussian {
    pub n_neighbors: usize,
    pub search_radius: f64,
}

impl SequentialGaussian {
    pub fn new(n_neighbors: usize) -> Self {
        SequentialGaussian {
            n_neighbors,
            search_radius: f64::MAX,
        }
    }

    /// Generate conditional simulation
    pub fn generate(
        &self,
        spec: &RandomFieldSpec,
        points: &[Vec<f64>],
        conditioning_data: &[(Vec<f64>, f64)],  // (location, value)
        random_values: &[f64],  // Standard normal
    ) -> Vec<f64> {
        let n = points.len();
        let mut field = vec![spec.mean; n];
        let mut simulated = vec![false; n];

        // Random visitation order
        let mut order: Vec<usize> = (0..n).collect();
        let mut rng_state = 12345u64;
        for i in (1..n).rev() {
            let j = (lcg_random(&mut rng_state) * (i + 1) as f64) as usize;
            order.swap(i, j);
        }

        // Include conditioning data
        let mut known_points: Vec<(Vec<f64>, f64)> = conditioning_data.to_vec();

        for (visit_idx, &i) in order.iter().enumerate() {
            // Find nearest neighbors
            let neighbors = self.find_neighbors(&points[i], &known_points, spec);

            if neighbors.is_empty() {
                // No neighbors: use unconditional mean and variance
                let z = if visit_idx < random_values.len() { random_values[visit_idx] } else { 0.0 };
                field[i] = spec.mean + spec.variance.sqrt() * z;
            } else {
                // Simple Kriging
                let (mean, var) = self.simple_kriging(&points[i], &neighbors, spec);
                let z = if visit_idx < random_values.len() { random_values[visit_idx] } else { 0.0 };
                field[i] = mean + var.sqrt() * z;
            }

            simulated[i] = true;
            known_points.push((points[i].clone(), field[i]));
        }

        field
    }

    fn find_neighbors(
        &self,
        point: &[f64],
        known: &[(Vec<f64>, f64)],
        spec: &RandomFieldSpec,
    ) -> Vec<(Vec<f64>, f64, f64)> {
        let mut neighbors: Vec<_> = known.iter()
            .map(|(p, v)| {
                let dist = self.distance(point, p, &spec.correlation_lengths);
                (p.clone(), *v, dist)
            })
            .filter(|(_, _, d)| *d < self.search_radius)
            .collect();

        neighbors.sort_by(|a, b| a.2.partial_cmp(&b.2).unwrap());
        neighbors.truncate(self.n_neighbors);
        neighbors
    }

    fn simple_kriging(
        &self,
        _point: &[f64],
        neighbors: &[(Vec<f64>, f64, f64)],
        spec: &RandomFieldSpec,
    ) -> (f64, f64) {
        let n = neighbors.len();
        if n == 0 {
            return (spec.mean, spec.variance);
        }

        // Build covariance matrices
        let mut c_nn = vec![0.0; n * n];  // Neighbor-neighbor
        let mut c_0n = vec![0.0; n];      // Point-neighbor

        for i in 0..n {
            c_0n[i] = spec.variance * spec.correlation_function.evaluate(
                neighbors[i].2, 1.0);

            for j in 0..n {
                let d = self.distance(&neighbors[i].0, &neighbors[j].0, &spec.correlation_lengths);
                c_nn[i * n + j] = spec.variance * spec.correlation_function.evaluate(d, 1.0);
            }
        }

        // Solve for weights: C_nn * w = c_0n
        let weights = self.solve_linear(&c_nn, &c_0n, n);

        // Kriging mean
        let residuals: Vec<f64> = neighbors.iter().map(|(_, v, _)| v - spec.mean).collect();
        let mean = spec.mean + weights.iter()
            .zip(residuals.iter())
            .map(|(&w, &r)| w * r)
            .sum::<f64>();

        // Kriging variance
        let var = spec.variance - weights.iter()
            .zip(c_0n.iter())
            .map(|(&w, &c)| w * c)
            .sum::<f64>();

        (mean, var.max(0.0))
    }

    fn distance(&self, p1: &[f64], p2: &[f64], lengths: &[f64]) -> f64 {
        p1.iter()
            .zip(p2.iter())
            .zip(lengths.iter().chain(std::iter::repeat(&1.0)))
            .map(|((&a, &b), &l)| ((a - b) / l).powi(2))
            .sum::<f64>()
            .sqrt()
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_correlation_exponential() {
        let cf = CorrelationFunction::Exponential;
        assert!((cf.evaluate(0.0, 1.0) - 1.0).abs() < 1e-10);
        assert!(cf.evaluate(1.0, 1.0) < 1.0);
    }

    #[test]
    fn test_correlation_squared_exponential() {
        let cf = CorrelationFunction::SquaredExponential;
        assert!((cf.evaluate(0.0, 1.0) - 1.0).abs() < 1e-10);
        assert!(cf.evaluate(1.0, 1.0) < cf.evaluate(0.5, 1.0));
    }

    #[test]
    fn test_random_field_spec() {
        let spec = RandomFieldSpec::new(200e9, 1e18)
            .with_correlation(CorrelationFunction::Matern52, vec![0.5]);

        assert!((spec.mean - 200e9).abs() < 1.0);
    }

    #[test]
    fn test_karhunen_loeve_1d() {
        let mut kl = KarhunenLoeve::new(5);
        let spec = RandomFieldSpec::new(0.0, 1.0)
            .with_correlation(CorrelationFunction::Exponential, vec![0.5]);

        kl.compute_1d(&spec, 1.0, 20);

        assert_eq!(kl.eigenvalues.len(), 5);
        assert!(kl.eigenvalues[0] >= kl.eigenvalues[1]);  // Decreasing
    }

    #[test]
    fn test_kl_explained_variance() {
        let mut kl = KarhunenLoeve::new(10);
        let spec = RandomFieldSpec::new(0.0, 1.0)
            .with_correlation(CorrelationFunction::Exponential, vec![0.3]);

        kl.compute_1d(&spec, 1.0, 50);

        let ratios = kl.explained_variance_ratio();
        assert!(ratios.last().unwrap() > &0.9);  // Most variance captured
    }

    #[test]
    fn test_spectral_representation_1d() {
        let sr = SpectralRepresentation::new(50);
        let spec = RandomFieldSpec::new(100.0, 25.0)
            .with_correlation(CorrelationFunction::Exponential, vec![0.5]);

        let x_coords: Vec<f64> = (0..20).map(|i| i as f64 * 0.1).collect();
        let phases: Vec<f64> = (0..50).map(|i| i as f64 * 0.1).collect();

        let field = sr.generate_1d(&spec, &x_coords, &phases);
        assert_eq!(field.len(), 20);
    }

    #[test]
    fn test_cholesky_random_field() {
        let mut crf = CholeskyRandomField::new();
        let spec = RandomFieldSpec::new(0.0, 1.0)
            .with_correlation(CorrelationFunction::SquaredExponential, vec![0.5]);

        let points: Vec<Vec<f64>> = (0..10).map(|i| vec![i as f64 * 0.1]).collect();
        crf.compute(&spec, &points);

        assert_eq!(crf.n_points, 10);
    }

    #[test]
    fn test_turning_bands() {
        let tb = TurningBands::new(20, 2);
        assert_eq!(tb.band_directions.len(), 20);

        // Check directions are unit vectors
        for dir in &tb.band_directions {
            let norm: f64 = dir.iter().map(|&x| x * x).sum::<f64>().sqrt();
            assert!((norm - 1.0).abs() < 1e-10);
        }
    }

    #[test]
    fn test_sequential_gaussian() {
        let sgs = SequentialGaussian::new(5);
        let spec = RandomFieldSpec::new(100.0, 25.0)
            .with_correlation(CorrelationFunction::Exponential, vec![0.5]);

        let points: Vec<Vec<f64>> = (0..20).map(|i| vec![i as f64 * 0.1]).collect();
        let conditioning = vec![(vec![0.0], 100.0), (vec![1.0], 105.0)];
        let random: Vec<f64> = (0..20).map(|_| 0.0).collect();

        let field = sgs.generate(&spec, &points, &conditioning, &random);
        assert_eq!(field.len(), 20);
    }

    #[test]
    fn test_spectral_density() {
        let cf = CorrelationFunction::Exponential;
        let s0 = cf.spectral_density(0.0, 1.0);
        let s1 = cf.spectral_density(1.0, 1.0);

        assert!(s0 > s1);  // Spectral density decreases with frequency
    }
}
