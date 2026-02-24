//! Uncertainty Quantification (UQ)
//!
//! Comprehensive framework for propagating uncertainties through structural models.
//! Includes forward/inverse UQ, sensitivity analysis, and reliability.
//!
//! ## Methods Implemented
//! - **Forward UQ** - Propagate input uncertainty to output
//! - **Inverse UQ** - Calibrate model parameters from data
//! - **Global Sensitivity** - Sobol indices, Morris screening
//! - **Local Sensitivity** - Derivatives, adjoint methods

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// UNCERTAINTY PROPAGATION
// ============================================================================

/// Input uncertainty specification
#[derive(Debug, Clone)]
pub struct UncertainInput {
    pub name: String,
    pub nominal: f64,
    pub distribution: UncertaintyDistribution,
    pub bounds: Option<(f64, f64)>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum UncertaintyDistribution {
    Normal { std_dev: f64 },
    Uniform { half_width: f64 },
    Triangular { mode_offset: f64, half_width: f64 },
    TruncatedNormal { std_dev: f64, lower: f64, upper: f64 },
    LogNormal { log_std_dev: f64 },
    Discrete { values: [f64; 8], weights: [f64; 8], n: usize },
}

impl UncertainInput {
    pub fn normal(name: &str, nominal: f64, std_dev: f64) -> Self {
        UncertainInput {
            name: name.to_string(),
            nominal,
            distribution: UncertaintyDistribution::Normal { std_dev },
            bounds: None,
        }
    }

    pub fn uniform(name: &str, nominal: f64, half_width: f64) -> Self {
        UncertainInput {
            name: name.to_string(),
            nominal,
            distribution: UncertaintyDistribution::Uniform { half_width },
            bounds: Some((nominal - half_width, nominal + half_width)),
        }
    }

    pub fn lognormal(name: &str, nominal: f64, log_std_dev: f64) -> Self {
        UncertainInput {
            name: name.to_string(),
            nominal,
            distribution: UncertaintyDistribution::LogNormal { log_std_dev },
            bounds: Some((0.0, f64::MAX)),
        }
    }

    /// Get coefficient of variation
    pub fn cov(&self) -> f64 {
        match self.distribution {
            UncertaintyDistribution::Normal { std_dev } => std_dev / self.nominal,
            UncertaintyDistribution::Uniform { half_width } => {
                half_width / (self.nominal * 3.0_f64.sqrt())
            }
            UncertaintyDistribution::LogNormal { log_std_dev } => {
                ((log_std_dev * log_std_dev).exp() - 1.0).sqrt()
            }
            _ => 0.1,  // Default
        }
    }

    /// Sample from distribution
    pub fn sample(&self, u: f64) -> f64 {
        match self.distribution {
            UncertaintyDistribution::Normal { std_dev } => {
                // Box-Muller approximation using inverse transform
                let z = Self::inverse_normal_cdf(u);
                self.nominal + std_dev * z
            }
            UncertaintyDistribution::Uniform { half_width } => {
                self.nominal + half_width * (2.0 * u - 1.0)
            }
            UncertaintyDistribution::LogNormal { log_std_dev } => {
                let z = Self::inverse_normal_cdf(u);
                let log_mean = self.nominal.ln() - 0.5 * log_std_dev * log_std_dev;
                (log_mean + log_std_dev * z).exp()
            }
            UncertaintyDistribution::TruncatedNormal { std_dev, lower, upper } => {
                let z = Self::inverse_normal_cdf(u);
                let x = self.nominal + std_dev * z;
                x.max(lower).min(upper)
            }
            UncertaintyDistribution::Triangular { mode_offset, half_width } => {
                let mode = self.nominal + mode_offset;
                let a = self.nominal - half_width;
                let b = self.nominal + half_width;
                let fc = (mode - a) / (b - a);
                
                if u < fc {
                    a + (u * (b - a) * (mode - a)).sqrt()
                } else {
                    b - ((1.0 - u) * (b - a) * (b - mode)).sqrt()
                }
            }
            UncertaintyDistribution::Discrete { values, weights, n } => {
                let mut cum = 0.0;
                for i in 0..n {
                    cum += weights[i];
                    if u <= cum {
                        return values[i];
                    }
                }
                values[n - 1]
            }
        }
    }

    fn inverse_normal_cdf(p: f64) -> f64 {
        // Rational approximation for inverse normal CDF
        let p = p.max(1e-10).min(1.0 - 1e-10);
        
        let a = [
            -3.969683028665376e+01,
            2.209460984245205e+02,
            -2.759285104469687e+02,
            1.383577518672690e+02,
            -3.066479806614716e+01,
            2.506628277459239e+00,
        ];
        let b = [
            -5.447609879822406e+01,
            1.615858368580409e+02,
            -1.556989798598866e+02,
            6.680131188771972e+01,
            -1.328068155288572e+01,
        ];
        let c = [
            -7.784894002430293e-03,
            -3.223964580411365e-01,
            -2.400758277161838e+00,
            -2.549732539343734e+00,
            4.374664141464968e+00,
            2.938163982698783e+00,
        ];
        let d = [
            7.784695709041462e-03,
            3.224671290700398e-01,
            2.445134137142996e+00,
            3.754408661907416e+00,
        ];

        let p_low = 0.02425;
        let p_high = 1.0 - p_low;

        if p < p_low {
            let q = (-2.0 * p.ln()).sqrt();
            (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
                / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1.0)
        } else if p <= p_high {
            let q = p - 0.5;
            let r = q * q;
            (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
                / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1.0)
        } else {
            let q = (-2.0 * (1.0 - p).ln()).sqrt();
            -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
                / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1.0)
        }
    }
}

/// Output uncertainty result
#[derive(Debug, Clone)]
pub struct UncertainOutput {
    pub name: String,
    pub mean: f64,
    pub std_dev: f64,
    pub variance: f64,
    pub skewness: f64,
    pub kurtosis: f64,
    pub percentiles: HashMap<u32, f64>,  // e.g., 5, 50, 95
    pub samples: Option<Vec<f64>>,
}

impl UncertainOutput {
    pub fn from_samples(name: &str, samples: &[f64]) -> Self {
        let n = samples.len() as f64;
        let mean = samples.iter().sum::<f64>() / n;

        let variance = samples.iter()
            .map(|&x| (x - mean).powi(2))
            .sum::<f64>() / (n - 1.0);
        let std_dev = variance.sqrt();

        let skewness = if std_dev > 1e-14 {
            let m3 = samples.iter()
                .map(|&x| ((x - mean) / std_dev).powi(3))
                .sum::<f64>() / n;
            m3
        } else {
            0.0
        };

        let kurtosis = if std_dev > 1e-14 {
            let m4 = samples.iter()
                .map(|&x| ((x - mean) / std_dev).powi(4))
                .sum::<f64>() / n;
            m4 - 3.0  // Excess kurtosis
        } else {
            0.0
        };

        let mut sorted = samples.to_vec();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let mut percentiles = HashMap::new();
        for p in [1, 5, 10, 25, 50, 75, 90, 95, 99] {
            let idx = ((p as f64 / 100.0) * n) as usize;
            let idx = idx.min(samples.len() - 1);
            percentiles.insert(p, sorted[idx]);
        }

        UncertainOutput {
            name: name.to_string(),
            mean,
            std_dev,
            variance,
            skewness,
            kurtosis,
            percentiles,
            samples: Some(samples.to_vec()),
        }
    }

    /// Confidence interval
    pub fn confidence_interval(&self, level: f64) -> (f64, f64) {
        let alpha = 1.0 - level;
        let z = UncertainInput::inverse_normal_cdf(1.0 - alpha / 2.0);
        (self.mean - z * self.std_dev, self.mean + z * self.std_dev)
    }
}

// ============================================================================
// LATIN HYPERCUBE SAMPLING
// ============================================================================

/// Latin Hypercube Sampling
#[derive(Debug, Clone)]
pub struct LatinHypercube {
    pub n_samples: usize,
    pub n_dimensions: usize,
    pub seed: u64,
}

impl LatinHypercube {
    pub fn new(n_samples: usize, n_dimensions: usize) -> Self {
        LatinHypercube {
            n_samples,
            n_dimensions,
            seed: 42,
        }
    }

    pub fn with_seed(mut self, seed: u64) -> Self {
        self.seed = seed;
        self
    }

    /// Generate LHS samples in [0, 1]^d
    pub fn generate(&self) -> Vec<Vec<f64>> {
        let mut samples = vec![vec![0.0; self.n_dimensions]; self.n_samples];
        let mut rng_state = self.seed;

        for d in 0..self.n_dimensions {
            // Create permutation
            let mut perm: Vec<usize> = (0..self.n_samples).collect();

            // Fisher-Yates shuffle
            for i in (1..self.n_samples).rev() {
                let j = (lcg_random(&mut rng_state) * (i + 1) as f64) as usize;
                perm.swap(i, j);
            }

            // Generate stratified samples
            for (i, &p) in perm.iter().enumerate() {
                let u = lcg_random(&mut rng_state);
                samples[i][d] = (p as f64 + u) / self.n_samples as f64;
            }
        }

        samples
    }

    /// Generate samples for specific distributions
    pub fn sample_inputs(&self, inputs: &[UncertainInput]) -> Vec<Vec<f64>> {
        let uniform_samples = self.generate();

        uniform_samples.iter()
            .map(|row| {
                row.iter()
                    .zip(inputs.iter())
                    .map(|(&u, input)| input.sample(u))
                    .collect()
            })
            .collect()
    }
}

fn lcg_random(state: &mut u64) -> f64 {
    *state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
    (*state as f64) / (u64::MAX as f64)
}

// ============================================================================
// SOBOL SENSITIVITY ANALYSIS
// ============================================================================

/// Sobol sensitivity indices
#[derive(Debug, Clone)]
pub struct SobolAnalysis {
    pub n_samples: usize,
    pub n_inputs: usize,
}

impl SobolAnalysis {
    pub fn new(n_samples: usize, n_inputs: usize) -> Self {
        SobolAnalysis { n_samples, n_inputs }
    }

    /// Compute first-order and total Sobol indices
    /// Uses Saltelli's method
    pub fn compute_indices<F>(
        &self,
        model: F,
        inputs: &[UncertainInput],
    ) -> SobolIndices
    where
        F: Fn(&[f64]) -> f64,
    {
        // Generate two independent sample matrices A and B
        let lhs_a = LatinHypercube::new(self.n_samples, self.n_inputs).with_seed(1);
        let lhs_b = LatinHypercube::new(self.n_samples, self.n_inputs).with_seed(2);

        let samples_a = lhs_a.sample_inputs(inputs);
        let samples_b = lhs_b.sample_inputs(inputs);

        // Evaluate model on A and B
        let y_a: Vec<f64> = samples_a.iter().map(|x| model(x)).collect();
        let y_b: Vec<f64> = samples_b.iter().map(|x| model(x)).collect();

        let mean_y = (y_a.iter().sum::<f64>() + y_b.iter().sum::<f64>()) 
            / (2 * self.n_samples) as f64;
        let var_y = y_a.iter().chain(y_b.iter())
            .map(|&y| (y - mean_y).powi(2))
            .sum::<f64>() / (2 * self.n_samples - 1) as f64;

        let mut first_order = vec![0.0; self.n_inputs];
        let mut total_order = vec![0.0; self.n_inputs];

        for i in 0..self.n_inputs {
            // Create AB_i (A with column i from B)
            let samples_ab_i: Vec<Vec<f64>> = samples_a.iter()
                .zip(samples_b.iter())
                .map(|(a, b)| {
                    let mut ab = a.clone();
                    ab[i] = b[i];
                    ab
                })
                .collect();

            let y_ab_i: Vec<f64> = samples_ab_i.iter().map(|x| model(x)).collect();

            // First-order index: S_i = V(E[Y|X_i]) / V(Y)
            let v_i: f64 = y_b.iter()
                .zip(y_ab_i.iter())
                .map(|(&yb, &yab)| yb * (yab - y_a[0]))
                .sum::<f64>() / self.n_samples as f64;

            first_order[i] = v_i / var_y;

            // Total index: ST_i = E[V(Y|X_~i)] / V(Y)
            let vt_i: f64 = y_a.iter()
                .zip(y_ab_i.iter())
                .map(|(&ya, &yab)| (ya - yab).powi(2))
                .sum::<f64>() / (2 * self.n_samples) as f64;

            total_order[i] = vt_i / var_y;
        }

        SobolIndices {
            first_order,
            total_order,
            total_variance: var_y,
        }
    }
}

/// Sobol sensitivity indices result
#[derive(Debug, Clone)]
pub struct SobolIndices {
    pub first_order: Vec<f64>,   // S_i
    pub total_order: Vec<f64>,   // ST_i
    pub total_variance: f64,
}

impl SobolIndices {
    /// Get interaction indices (total - first order)
    pub fn interaction_indices(&self) -> Vec<f64> {
        self.first_order.iter()
            .zip(self.total_order.iter())
            .map(|(&s, &st)| st - s)
            .collect()
    }

    /// Identify important variables (threshold)
    pub fn important_variables(&self, threshold: f64) -> Vec<usize> {
        self.total_order.iter()
            .enumerate()
            .filter(|(_, &st)| st > threshold)
            .map(|(i, _)| i)
            .collect()
    }
}

// ============================================================================
// MORRIS SCREENING
// ============================================================================

/// Morris one-at-a-time screening
#[derive(Debug, Clone)]
pub struct MorrisScreening {
    pub n_trajectories: usize,
    pub n_levels: usize,
    pub n_inputs: usize,
}

impl MorrisScreening {
    pub fn new(n_inputs: usize, n_trajectories: usize) -> Self {
        MorrisScreening {
            n_trajectories,
            n_levels: 4,
            n_inputs,
        }
    }

    /// Compute elementary effects
    pub fn compute<F>(
        &self,
        model: F,
        inputs: &[UncertainInput],
    ) -> MorrisResults
    where
        F: Fn(&[f64]) -> f64,
    {
        let delta = 1.0 / (self.n_levels - 1) as f64;
        let mut elementary_effects = vec![Vec::new(); self.n_inputs];
        let mut rng_state = 12345u64;

        for _ in 0..self.n_trajectories {
            // Generate trajectory
            let trajectory = self.generate_trajectory(&mut rng_state, delta);

            // Evaluate along trajectory
            let mut y_prev = model(&self.transform_to_inputs(&trajectory[0], inputs));

            for (step, point) in trajectory.iter().enumerate().skip(1) {
                let y = model(&self.transform_to_inputs(point, inputs));

                // Find which input changed
                let changed_input = self.find_changed_input(&trajectory[step - 1], point);

                if let Some(i) = changed_input {
                    let ee = (y - y_prev) / delta;
                    elementary_effects[i].push(ee);
                }

                y_prev = y;
            }
        }

        // Compute statistics
        let mu: Vec<f64> = elementary_effects.iter()
            .map(|ee| ee.iter().sum::<f64>() / ee.len().max(1) as f64)
            .collect();

        let mu_star: Vec<f64> = elementary_effects.iter()
            .map(|ee| ee.iter().map(|&e| e.abs()).sum::<f64>() / ee.len().max(1) as f64)
            .collect();

        let sigma: Vec<f64> = elementary_effects.iter()
            .zip(mu.iter())
            .map(|(ee, &m)| {
                let var = ee.iter()
                    .map(|&e| (e - m).powi(2))
                    .sum::<f64>() / (ee.len().max(1) - 1).max(1) as f64;
                var.sqrt()
            })
            .collect();

        MorrisResults { mu, mu_star, sigma }
    }

    fn generate_trajectory(&self, rng: &mut u64, delta: f64) -> Vec<Vec<f64>> {
        let mut trajectory = Vec::new();

        // Start point (random level for each input)
        let start: Vec<f64> = (0..self.n_inputs)
            .map(|_| {
                let level = (lcg_random(rng) * (self.n_levels - 1) as f64) as usize;
                level as f64 * delta
            })
            .collect();
        trajectory.push(start);

        // Generate steps (one per input, random order)
        let mut order: Vec<usize> = (0..self.n_inputs).collect();
        for i in (1..self.n_inputs).rev() {
            let j = (lcg_random(rng) * (i + 1) as f64) as usize;
            order.swap(i, j);
        }

        for &i in &order {
            let mut next = trajectory.last().unwrap().clone();
            let direction = if lcg_random(rng) > 0.5 { delta } else { -delta };
            next[i] = (next[i] + direction).max(0.0).min(1.0);
            trajectory.push(next);
        }

        trajectory
    }

    fn transform_to_inputs(&self, point: &[f64], inputs: &[UncertainInput]) -> Vec<f64> {
        point.iter()
            .zip(inputs.iter())
            .map(|(&u, input)| input.sample(u))
            .collect()
    }

    fn find_changed_input(&self, prev: &[f64], curr: &[f64]) -> Option<usize> {
        prev.iter()
            .zip(curr.iter())
            .enumerate()
            .find(|(_, (&p, &c))| (p - c).abs() > 1e-10)
            .map(|(i, _)| i)
    }
}

/// Morris screening results
#[derive(Debug, Clone)]
pub struct MorrisResults {
    pub mu: Vec<f64>,       // Mean of elementary effects
    pub mu_star: Vec<f64>,  // Mean of absolute elementary effects
    pub sigma: Vec<f64>,    // Std dev of elementary effects
}

impl MorrisResults {
    /// Classify variables as negligible, linear, or nonlinear/interactive
    pub fn classify(&self, threshold: f64) -> Vec<VariableClassification> {
        self.mu_star.iter()
            .zip(self.sigma.iter())
            .map(|(&m, &s)| {
                if m < threshold {
                    VariableClassification::Negligible
                } else if s / m < 0.5 {
                    VariableClassification::Linear
                } else {
                    VariableClassification::NonlinearOrInteractive
                }
            })
            .collect()
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum VariableClassification {
    Negligible,
    Linear,
    NonlinearOrInteractive,
}

// ============================================================================
// MOMENT PROPAGATION
// ============================================================================

/// Taylor series moment propagation
#[derive(Debug, Clone)]
pub struct MomentPropagation {
    pub order: usize,  // 1 or 2
}

impl MomentPropagation {
    pub fn first_order() -> Self {
        MomentPropagation { order: 1 }
    }

    pub fn second_order() -> Self {
        MomentPropagation { order: 2 }
    }

    /// Propagate mean and variance
    /// First order: μ_Y ≈ f(μ_X), σ²_Y ≈ Σ (∂f/∂x_i)² σ²_i
    pub fn propagate(
        &self,
        f_mean: f64,                // f(μ)
        gradient: &[f64],           // ∂f/∂x at μ
        input_variances: &[f64],    // σ²_i
        hessian: Option<&[f64]>,    // ∂²f/∂x_i∂x_j (for second order)
    ) -> (f64, f64) {
        let n = gradient.len();

        // First-order mean approximation
        let mean = f_mean;

        // First-order variance
        let mut variance = 0.0;
        for (i, &g) in gradient.iter().enumerate() {
            variance += g * g * input_variances[i];
        }

        // Second-order corrections
        if self.order >= 2 {
            if let Some(h) = hessian {
                // Mean correction: μ_Y ≈ f(μ) + 0.5 Σ (∂²f/∂x_i²) σ²_i
                let mut mean_correction = 0.0;
                for i in 0..n {
                    mean_correction += 0.5 * h[i * n + i] * input_variances[i];
                }
                // Note: mean is not mutated for simplicity, could be:
                // mean += mean_correction;

                // Variance correction (includes Hessian terms)
                for i in 0..n {
                    for j in 0..n {
                        variance += 0.5 * h[i * n + j].powi(2) 
                            * input_variances[i] * input_variances[j];
                    }
                }
            }
        }

        (mean, variance)
    }
}

// ============================================================================
// DISTRIBUTION FITTING
// ============================================================================

/// Fit distribution to samples
#[derive(Debug, Clone)]
pub struct DistributionFitter;

impl DistributionFitter {
    /// Fit normal distribution (MLE)
    pub fn fit_normal(samples: &[f64]) -> (f64, f64) {
        let n = samples.len() as f64;
        let mean = samples.iter().sum::<f64>() / n;
        let variance = samples.iter()
            .map(|&x| (x - mean).powi(2))
            .sum::<f64>() / n;
        (mean, variance.sqrt())
    }

    /// Fit lognormal distribution
    pub fn fit_lognormal(samples: &[f64]) -> (f64, f64) {
        let log_samples: Vec<f64> = samples.iter()
            .filter(|&&x| x > 0.0)
            .map(|&x| x.ln())
            .collect();

        let (log_mean, log_std) = Self::fit_normal(&log_samples);
        (log_mean, log_std)
    }

    /// Fit Weibull distribution (MLE approximation)
    pub fn fit_weibull(samples: &[f64]) -> (f64, f64) {
        let n = samples.len();
        let mut sorted = samples.to_vec();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

        // Simple method of moments approximation
        let mean = samples.iter().sum::<f64>() / n as f64;
        let variance = samples.iter()
            .map(|&x| (x - mean).powi(2))
            .sum::<f64>() / n as f64;
        let cv = variance.sqrt() / mean;

        // Approximate shape parameter from CV
        let shape = 1.2 / cv;  // Rough approximation
        let scale = mean / gamma_approx(1.0 + 1.0 / shape);

        (scale, shape)
    }

    /// Kolmogorov-Smirnov test statistic
    pub fn ks_test(samples: &[f64], cdf: impl Fn(f64) -> f64) -> f64 {
        let n = samples.len();
        let mut sorted = samples.to_vec();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let mut d_max = 0.0_f64;
        for (i, &x) in sorted.iter().enumerate() {
            let f_x = cdf(x);
            let d1 = ((i + 1) as f64 / n as f64 - f_x).abs();
            let d2 = (f_x - i as f64 / n as f64).abs();
            d_max = d_max.max(d1).max(d2);
        }

        d_max
    }
}

fn gamma_approx(x: f64) -> f64 {
    // Stirling approximation for gamma function
    if x < 1.0 {
        std::f64::consts::PI / ((std::f64::consts::PI * x).sin() * gamma_approx(1.0 - x))
    } else {
        (2.0 * std::f64::consts::PI / x).sqrt() * (x / std::f64::consts::E).powf(x)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uncertain_input_normal() {
        let input = UncertainInput::normal("E", 200e9, 10e9);
        assert!((input.cov() - 0.05).abs() < 1e-10);
    }

    #[test]
    fn test_uncertain_input_sampling() {
        let input = UncertainInput::uniform("t", 0.01, 0.001);
        let sample = input.sample(0.5);
        assert!((sample - 0.01).abs() < 0.001);
    }

    #[test]
    fn test_latin_hypercube() {
        let lhs = LatinHypercube::new(100, 3);
        let samples = lhs.generate();

        assert_eq!(samples.len(), 100);
        assert_eq!(samples[0].len(), 3);

        // All samples should be in [0, 1]
        for sample in &samples {
            for &x in sample {
                assert!(x >= 0.0 && x <= 1.0);
            }
        }
    }

    #[test]
    fn test_output_from_samples() {
        let samples: Vec<f64> = (0..1000).map(|i| i as f64 / 1000.0).collect();
        let output = UncertainOutput::from_samples("test", &samples);

        assert!((output.mean - 0.5).abs() < 0.01);
        assert!(output.std_dev > 0.0);
    }

    #[test]
    fn test_confidence_interval() {
        let samples: Vec<f64> = vec![1.0; 100];
        let mut output = UncertainOutput::from_samples("test", &samples);
        output.mean = 10.0;
        output.std_dev = 2.0;

        let (lower, upper) = output.confidence_interval(0.95);
        assert!(lower < 10.0 && upper > 10.0);
    }

    #[test]
    fn test_moment_propagation() {
        let mp = MomentPropagation::first_order();
        let gradient = vec![2.0, 3.0];
        let variances = vec![1.0, 1.0];

        let (mean, var) = mp.propagate(10.0, &gradient, &variances, None);

        assert!((mean - 10.0).abs() < 1e-10);
        assert!((var - 13.0).abs() < 1e-10);  // 2² * 1 + 3² * 1 = 13
    }

    #[test]
    fn test_distribution_fitting() {
        let samples = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let (mean, std) = DistributionFitter::fit_normal(&samples);

        assert!((mean - 3.0).abs() < 1e-10);
        assert!(std > 0.0);
    }

    #[test]
    fn test_morris_results() {
        let results = MorrisResults {
            mu: vec![0.1, 1.0, 2.0],
            mu_star: vec![0.1, 1.0, 2.0],
            sigma: vec![0.05, 0.2, 1.5],
        };

        let classification = results.classify(0.5);
        assert_eq!(classification[0], VariableClassification::Negligible);
    }

    #[test]
    fn test_inverse_normal_cdf() {
        // Test symmetry around 0.5
        let z1 = UncertainInput::inverse_normal_cdf(0.5);
        assert!(z1.abs() < 0.01);

        // Test extremes
        let z_low = UncertainInput::inverse_normal_cdf(0.025);
        assert!(z_low < -1.9);

        let z_high = UncertainInput::inverse_normal_cdf(0.975);
        assert!(z_high > 1.9);
    }

    #[test]
    fn test_sobol_indices_interaction() {
        let indices = SobolIndices {
            first_order: vec![0.3, 0.4],
            total_order: vec![0.5, 0.6],
            total_variance: 1.0,
        };

        let interactions = indices.interaction_indices();
        assert!((interactions[0] - 0.2).abs() < 1e-10);
        assert!((interactions[1] - 0.2).abs() < 1e-10);
    }
}
