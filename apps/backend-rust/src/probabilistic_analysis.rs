//! Probabilistic Analysis Module
//!
//! Structural reliability and probabilistic assessment methods.
//! Essential for safety-critical design decisions.
//!
//! ## Methods Implemented
//! - **FORM** - First Order Reliability Method
//! - **SORM** - Second Order Reliability Method
//! - **Importance Sampling** - Efficient failure probability estimation
//! - **Subset Simulation** - Rare event simulation
//! - **System Reliability** - Series/parallel systems

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;
use crate::special_functions::*;


fn standard_normal_inverse_cdf(p: f64) -> f64 {
    2.0_f64.sqrt() * crate::special_functions::erfinv(2.0 * p - 1.0)
}

// ============================================================================
// RANDOM VARIABLES FOR RELIABILITY
// ============================================================================

/// Random variable types for reliability analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RandomVariableType {
    Normal { mean: f64, std_dev: f64 },
    Lognormal { mean: f64, std_dev: f64 },
    Uniform { min: f64, max: f64 },
    Gumbel { location: f64, scale: f64 },
    Weibull { shape: f64, scale: f64 },
    Frechet { shape: f64, scale: f64 },
}

impl RandomVariableType {
    /// Transform from standard normal to physical space
    pub fn from_standard_normal(&self, u: f64) -> f64 {
        let cdf = standard_normal_cdf(u);

        match *self {
            RandomVariableType::Normal { mean, std_dev } => {
                mean + std_dev * u
            }
            RandomVariableType::Lognormal { mean, std_dev } => {
                let cv = std_dev / mean;
                let zeta = (1.0 + cv * cv).ln().sqrt();
                let lambda = mean.ln() - 0.5 * zeta * zeta;
                (lambda + zeta * u).exp()
            }
            RandomVariableType::Uniform { min, max } => {
                min + cdf * (max - min)
            }
            RandomVariableType::Gumbel { location, scale } => {
                if cdf <= 0.0 {
                    f64::NEG_INFINITY
                } else if cdf >= 1.0 {
                    f64::INFINITY
                } else {
                    location - scale * (-cdf.ln()).ln()
                }
            }
            RandomVariableType::Weibull { shape, scale } => {
                if cdf <= 0.0 {
                    0.0
                } else if cdf >= 1.0 {
                    f64::INFINITY
                } else {
                    scale * (-(1.0 - cdf).ln()).powf(1.0 / shape)
                }
            }
            RandomVariableType::Frechet { shape, scale } => {
                if cdf <= 0.0 {
                    0.0
                } else {
                    scale * (-cdf.ln()).powf(-1.0 / shape)
                }
            }
        }
    }

    /// Transform from physical space to standard normal
    pub fn to_standard_normal(&self, x: f64) -> f64 {
        let cdf = self.cdf(x);
        standard_normal_inverse_cdf(cdf)
    }

    /// Cumulative distribution function
    pub fn cdf(&self, x: f64) -> f64 {
        match *self {
            RandomVariableType::Normal { mean, std_dev } => {
                standard_normal_cdf((x - mean) / std_dev)
            }
            RandomVariableType::Lognormal { mean, std_dev } => {
                if x <= 0.0 {
                    0.0
                } else {
                    let cv = std_dev / mean;
                    let zeta = (1.0 + cv * cv).ln().sqrt();
                    let lambda = mean.ln() - 0.5 * zeta * zeta;
                    standard_normal_cdf((x.ln() - lambda) / zeta)
                }
            }
            RandomVariableType::Uniform { min, max } => {
                if x <= min { 0.0 }
                else if x >= max { 1.0 }
                else { (x - min) / (max - min) }
            }
            RandomVariableType::Gumbel { location, scale } => {
                (-(-(x - location) / scale).exp()).exp()
            }
            RandomVariableType::Weibull { shape, scale } => {
                if x <= 0.0 { 0.0 }
                else { 1.0 - (-(x / scale).powf(shape)).exp() }
            }
            RandomVariableType::Frechet { shape, scale } => {
                if x <= 0.0 { 0.0 }
                else { (-(scale / x).powf(shape)).exp() }
            }
        }
    }

    /// Probability density function
    pub fn pdf(&self, x: f64) -> f64 {
        match *self {
            RandomVariableType::Normal { mean, std_dev } => {
                let z = (x - mean) / std_dev;
                (-0.5 * z * z).exp() / (std_dev * (2.0 * PI).sqrt())
            }
            RandomVariableType::Lognormal { mean, std_dev } => {
                if x <= 0.0 {
                    0.0
                } else {
                    let cv = std_dev / mean;
                    let zeta = (1.0 + cv * cv).ln().sqrt();
                    let lambda = mean.ln() - 0.5 * zeta * zeta;
                    let z = (x.ln() - lambda) / zeta;
                    (-0.5 * z * z).exp() / (x * zeta * (2.0 * PI).sqrt())
                }
            }
            RandomVariableType::Uniform { min, max } => {
                if x >= min && x <= max { 1.0 / (max - min) } else { 0.0 }
            }
            RandomVariableType::Gumbel { location, scale } => {
                let z = (x - location) / scale;
                (-z - (-z).exp()).exp() / scale
            }
            RandomVariableType::Weibull { shape, scale } => {
                if x <= 0.0 {
                    0.0
                } else {
                    (shape / scale) * (x / scale).powf(shape - 1.0) 
                        * (-(x / scale).powf(shape)).exp()
                }
            }
            RandomVariableType::Frechet { shape, scale } => {
                if x <= 0.0 {
                    0.0
                } else {
                    (shape / scale) * (scale / x).powf(shape + 1.0) 
                        * (-(scale / x).powf(shape)).exp()
                }
            }
        }
    }
}

/// Random variable for reliability analysis
#[derive(Debug, Clone)]
pub struct ReliabilityVariable {
    pub name: String,
    pub distribution: RandomVariableType,
    pub design_point: f64,
    pub sensitivity: f64,
}

impl ReliabilityVariable {
    pub fn new(name: &str, distribution: RandomVariableType) -> Self {
        let design_point = match &distribution {
            RandomVariableType::Normal { mean, .. } => *mean,
            RandomVariableType::Lognormal { mean, .. } => *mean,
            RandomVariableType::Uniform { min, max } => (min + max) / 2.0,
            RandomVariableType::Gumbel { location, .. } => *location,
            RandomVariableType::Weibull { scale, .. } => *scale,
            RandomVariableType::Frechet { scale, .. } => *scale,
        };

        ReliabilityVariable {
            name: name.to_string(),
            distribution,
            design_point,
            sensitivity: 0.0,
        }
    }
}

// ============================================================================
// FIRST ORDER RELIABILITY METHOD (FORM)
// ============================================================================

/// FORM reliability analysis
#[derive(Debug, Clone)]
pub struct FirstOrderReliability {
    pub max_iterations: usize,
    pub tolerance: f64,
    pub beta: f64,
    pub design_point_u: Vec<f64>,
    pub design_point_x: Vec<f64>,
    pub alpha: Vec<f64>,  // Importance factors
    pub probability_of_failure: f64,
}

impl FirstOrderReliability {
    pub fn new() -> Self {
        FirstOrderReliability {
            max_iterations: 100,
            tolerance: 1e-6,
            beta: 0.0,
            design_point_u: Vec::new(),
            design_point_x: Vec::new(),
            alpha: Vec::new(),
            probability_of_failure: 0.0,
        }
    }

    /// Analyze using HL-RF algorithm
    pub fn analyze<F>(&mut self, variables: &mut [ReliabilityVariable], limit_state: F)
    where
        F: Fn(&[f64]) -> f64,
    {
        let n = variables.len();

        // Initialize at mean in standard normal space
        let mut u = vec![0.0; n];

        for iter in 0..self.max_iterations {
            // Transform to physical space
            let x: Vec<f64> = u.iter()
                .zip(variables.iter())
                .map(|(&ui, var)| var.distribution.from_standard_normal(ui))
                .collect();

            // Evaluate limit state
            let g = limit_state(&x);

            // Compute gradient numerically
            let grad_g = self.numerical_gradient(&x, &limit_state);

            // Transform gradient to standard normal space
            let grad_u: Vec<f64> = grad_g.iter()
                .zip(variables.iter())
                .zip(x.iter())
                .map(|((&dg, var), &xi)| {
                    let pdf_x = var.distribution.pdf(xi);
                    let u_i = var.distribution.to_standard_normal(xi);
                    let phi_u = standard_normal_pdf(u_i);
                    if pdf_x > 1e-14 {
                        dg * phi_u / pdf_x
                    } else {
                        dg
                    }
                })
                .collect();

            let grad_norm: f64 = grad_u.iter().map(|&x| x * x).sum::<f64>().sqrt();

            if grad_norm < 1e-14 {
                break;
            }

            // Normalized gradient
            let alpha: Vec<f64> = grad_u.iter().map(|&x| -x / grad_norm).collect();

            // HL-RF iteration
            let u_dot_alpha: f64 = u.iter().zip(alpha.iter()).map(|(&a, &b)| a * b).sum();
            let new_u: Vec<f64> = alpha.iter()
                .map(|&ai| ai * (u_dot_alpha + g / grad_norm))
                .collect();

            // Check convergence
            let diff: f64 = u.iter()
                .zip(new_u.iter())
                .map(|(&a, &b)| (a - b).powi(2))
                .sum::<f64>()
                .sqrt();

            u = new_u;

            if diff < self.tolerance && iter > 0 {
                break;
            }
        }

        // Store results
        self.design_point_u = u.clone();
        self.beta = u.iter().map(|&x| x * x).sum::<f64>().sqrt();

        let grad_norm: f64 = self.beta.max(1e-10);
        self.alpha = u.iter().map(|&x| -x / grad_norm).collect();

        self.design_point_x = u.iter()
            .zip(variables.iter())
            .map(|(&ui, var)| var.distribution.from_standard_normal(ui))
            .collect();

        // Update sensitivities
        for (var, &ai) in variables.iter_mut().zip(self.alpha.iter()) {
            var.sensitivity = ai * ai;  // Importance factor
        }

        self.probability_of_failure = standard_normal_cdf(-self.beta);
    }

    fn numerical_gradient<F>(&self, x: &[f64], f: F) -> Vec<f64>
    where
        F: Fn(&[f64]) -> f64,
    {
        let n = x.len();
        let mut grad = vec![0.0; n];
        let h = 1e-6;

        let f0 = f(x);

        for i in 0..n {
            let mut x_plus = x.to_vec();
            x_plus[i] += h;
            grad[i] = (f(&x_plus) - f0) / h;
        }

        grad
    }

    /// Reliability index from failure probability
    pub fn beta_from_pf(pf: f64) -> f64 {
        -standard_normal_inverse_cdf(pf)
    }
}

impl Default for FirstOrderReliability {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// SECOND ORDER RELIABILITY METHOD (SORM)
// ============================================================================

/// SORM reliability analysis
#[derive(Debug, Clone)]
pub struct SecondOrderReliability {
    pub form_beta: f64,
    pub sorm_beta: f64,
    pub curvatures: Vec<f64>,
    pub probability_of_failure: f64,
}

impl SecondOrderReliability {
    pub fn new() -> Self {
        SecondOrderReliability {
            form_beta: 0.0,
            sorm_beta: 0.0,
            curvatures: Vec::new(),
            probability_of_failure: 0.0,
        }
    }

    /// Analyze with curvature correction
    pub fn analyze<F>(
        &mut self,
        variables: &mut [ReliabilityVariable],
        limit_state: F,
    )
    where
        F: Fn(&[f64]) -> f64,
    {
        // First run FORM
        let mut form = FirstOrderReliability::new();
        form.analyze(variables, &limit_state);

        self.form_beta = form.beta;

        // Compute curvatures at design point
        let n = variables.len();
        let h = 1e-5;

        // Hessian in standard normal space (simplified)
        let u_star = &form.design_point_u;
        let x_star = &form.design_point_x;

        let g0 = limit_state(x_star);

        // Compute principal curvatures
        let mut curvatures = Vec::new();

        for i in 0..(n - 1) {
            // Approximate curvature in each direction perpendicular to alpha
            let mut u_plus = u_star.clone();
            let mut u_minus = u_star.clone();

            // Perturb perpendicular to gradient
            let perp_idx = (i + 1) % n;
            u_plus[perp_idx] += h;
            u_minus[perp_idx] -= h;

            let x_plus: Vec<f64> = u_plus.iter()
                .zip(variables.iter())
                .map(|(&ui, var)| var.distribution.from_standard_normal(ui))
                .collect();
            let x_minus: Vec<f64> = u_minus.iter()
                .zip(variables.iter())
                .map(|(&ui, var)| var.distribution.from_standard_normal(ui))
                .collect();

            let g_plus = limit_state(&x_plus);
            let g_minus = limit_state(&x_minus);

            let curvature = (g_plus - 2.0 * g0 + g_minus) / (h * h);
            curvatures.push(curvature);
        }

        self.curvatures = curvatures.clone();

        // Breitung's formula for SORM
        let phi_beta = standard_normal_cdf(-self.form_beta);
        let mut correction = 1.0;

        for &kappa in &curvatures {
            let factor = 1.0 + self.form_beta * kappa;
            if factor > 0.0 {
                correction *= factor.powf(-0.5);
            }
        }

        self.probability_of_failure = phi_beta * correction;
        self.sorm_beta = -standard_normal_inverse_cdf(self.probability_of_failure);
    }
}

impl Default for SecondOrderReliability {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// IMPORTANCE SAMPLING
// ============================================================================

/// Importance sampling for reliability analysis
#[derive(Debug, Clone)]
pub struct ImportanceSampling {
    pub n_samples: usize,
    pub design_point: Vec<f64>,
    pub probability_of_failure: f64,
    pub coefficient_of_variation: f64,
}

impl ImportanceSampling {
    pub fn new(n_samples: usize) -> Self {
        ImportanceSampling {
            n_samples,
            design_point: Vec::new(),
            probability_of_failure: 0.0,
            coefficient_of_variation: 0.0,
        }
    }

    /// Run importance sampling around design point
    pub fn analyze<F>(
        &mut self,
        variables: &[ReliabilityVariable],
        design_point_u: &[f64],
        limit_state: F,
    )
    where
        F: Fn(&[f64]) -> f64,
    {
        let _n = variables.len();
        self.design_point = design_point_u.to_vec();

        let mut rng_state = 42u64;
        let mut sum = 0.0;
        let mut sum_sq = 0.0;

        for _ in 0..self.n_samples {
            // Sample from shifted distribution (centered at design point)
            let mut u = Vec::new();
            for &u_star in design_point_u {
                let z = box_muller_normal(&mut rng_state);
                u.push(u_star + z);
            }

            // Transform to physical space
            let x: Vec<f64> = u.iter()
                .zip(variables.iter())
                .map(|(&ui, var)| var.distribution.from_standard_normal(ui))
                .collect();

            // Evaluate limit state
            let g = limit_state(&x);

            // Indicator function
            let indicator = if g <= 0.0 { 1.0 } else { 0.0 };

            // Importance sampling weight
            let weight = self.likelihood_ratio(&u, design_point_u);

            let contribution = indicator * weight;
            sum += contribution;
            sum_sq += contribution * contribution;
        }

        self.probability_of_failure = sum / self.n_samples as f64;

        let variance = (sum_sq / self.n_samples as f64 
            - self.probability_of_failure.powi(2))
            / self.n_samples as f64;

        self.coefficient_of_variation = if self.probability_of_failure > 1e-14 {
            variance.sqrt() / self.probability_of_failure
        } else {
            f64::INFINITY
        };
    }

    fn likelihood_ratio(&self, u: &[f64], u_center: &[f64]) -> f64 {
        // Ratio of original to shifted density
        let mut log_ratio = 0.0;

        for (&ui, &uc) in u.iter().zip(u_center.iter()) {
            // Original: N(0,1), Shifted: N(u_center, 1)
            log_ratio += -0.5 * ui * ui + 0.5 * (ui - uc).powi(2);
        }

        log_ratio.exp()
    }
}

// ============================================================================
// SUBSET SIMULATION
// ============================================================================

/// Subset simulation for rare events
#[derive(Debug, Clone)]
pub struct SubsetSimulation {
    pub n_samples_per_level: usize,
    pub conditional_probability: f64,
    pub n_chains: usize,
    pub levels: Vec<SubsetLevel>,
    pub probability_of_failure: f64,
    pub coefficient_of_variation: f64,
}

#[derive(Debug, Clone)]
pub struct SubsetLevel {
    pub threshold: f64,
    pub samples: Vec<Vec<f64>>,
    pub limit_state_values: Vec<f64>,
}

impl SubsetSimulation {
    pub fn new(n_samples: usize, conditional_prob: f64) -> Self {
        SubsetSimulation {
            n_samples_per_level: n_samples,
            conditional_probability: conditional_prob,
            n_chains: (n_samples as f64 * conditional_prob) as usize,
            levels: Vec::new(),
            probability_of_failure: 0.0,
            coefficient_of_variation: 0.0,
        }
    }

    /// Run subset simulation
    pub fn analyze<F>(&mut self, variables: &[ReliabilityVariable], limit_state: F)
    where
        F: Fn(&[f64]) -> f64,
    {
        let n = variables.len();
        let mut rng_state = 12345u64;

        // Level 0: Direct Monte Carlo
        let mut samples: Vec<Vec<f64>> = Vec::new();
        let mut g_values = Vec::new();

        for _ in 0..self.n_samples_per_level {
            let u: Vec<f64> = (0..n).map(|_| box_muller_normal(&mut rng_state)).collect();
            let x: Vec<f64> = u.iter()
                .zip(variables.iter())
                .map(|(&ui, var)| var.distribution.from_standard_normal(ui))
                .collect();
            let g = limit_state(&x);
            samples.push(u);
            g_values.push(g);
        }

        let mut cumulative_prob = 1.0;
        let mut level_probs = Vec::new();

        // Adaptive levels
        let max_levels = 20;

        for level in 0..max_levels {
            // Sort by limit state value
            let mut indices: Vec<usize> = (0..g_values.len()).collect();
            indices.sort_by(|&i, &j| g_values[i].partial_cmp(&g_values[j]).unwrap_or(std::cmp::Ordering::Equal));

            // Find threshold
            let threshold_idx = (self.conditional_probability * self.n_samples_per_level as f64) as usize;
            let threshold_idx = threshold_idx.min(indices.len() - 1);
            let threshold = g_values[indices[threshold_idx]];

            // Count failures at this level
            let n_failure: usize = g_values.iter().filter(|&&g| g <= 0.0).count();

            self.levels.push(SubsetLevel {
                threshold,
                samples: samples.clone(),
                limit_state_values: g_values.clone(),
            });

            if threshold <= 0.0 {
                // Reached failure region
                let p_level = n_failure as f64 / self.n_samples_per_level as f64;
                level_probs.push(p_level);
                cumulative_prob *= p_level;
                break;
            }

            level_probs.push(self.conditional_probability);
            cumulative_prob *= self.conditional_probability;

            // Select seeds (samples below threshold)
            let seeds: Vec<Vec<f64>> = indices.iter()
                .take(threshold_idx + 1)
                .map(|&i| samples[i].clone())
                .collect();

            // MCMC from seeds
            let mut new_samples = Vec::new();
            let mut new_g_values = Vec::new();

            let samples_per_chain = self.n_samples_per_level / seeds.len().max(1);

            for seed in &seeds {
                let (chain_samples, chain_g) = self.run_mcmc_chain(
                    seed, 
                    samples_per_chain, 
                    variables, 
                    &limit_state, 
                    threshold,
                    &mut rng_state,
                );
                new_samples.extend(chain_samples);
                new_g_values.extend(chain_g);
            }

            samples = new_samples;
            g_values = new_g_values;

            if level >= max_levels - 1 {
                break;
            }
        }

        self.probability_of_failure = cumulative_prob;

        // Estimate CoV (simplified)
        let _n_levels = level_probs.len();
        let var_sum: f64 = level_probs.iter()
            .map(|&p| (1.0 - p) / (p * self.n_samples_per_level as f64))
            .sum();
        
        self.coefficient_of_variation = var_sum.sqrt();
    }

    fn run_mcmc_chain<F>(
        &self,
        seed: &[f64],
        n_samples: usize,
        variables: &[ReliabilityVariable],
        limit_state: &F,
        threshold: f64,
        rng_state: &mut u64,
    ) -> (Vec<Vec<f64>>, Vec<f64>)
    where
        F: Fn(&[f64]) -> f64,
    {
        let _n = seed.len();
        let proposal_std = 1.0;

        let mut current = seed.to_vec();
        let x: Vec<f64> = current.iter()
            .zip(variables.iter())
            .map(|(&ui, var)| var.distribution.from_standard_normal(ui))
            .collect();
        let mut current_g = limit_state(&x);

        let mut samples = vec![current.clone()];
        let mut g_values = vec![current_g];

        for _ in 1..n_samples {
            // Propose
            let proposed: Vec<f64> = current.iter()
                .map(|&u| u + proposal_std * box_muller_normal(rng_state))
                .collect();

            let x_prop: Vec<f64> = proposed.iter()
                .zip(variables.iter())
                .map(|(&ui, var)| var.distribution.from_standard_normal(ui))
                .collect();
            let g_prop = limit_state(&x_prop);

            // Accept if still below threshold
            if g_prop <= threshold {
                let acceptance = (-0.5 * (proposed.iter().map(|&x| x*x).sum::<f64>() 
                    - current.iter().map(|&x| x*x).sum::<f64>())).exp();

                if lcg_random(rng_state) < acceptance.min(1.0) {
                    current = proposed;
                    current_g = g_prop;
                }
            }

            samples.push(current.clone());
            g_values.push(current_g);
        }

        (samples, g_values)
    }
}

fn lcg_random(state: &mut u64) -> f64 {
    *state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
    (*state as f64) / (u64::MAX as f64)
}

fn box_muller_normal(state: &mut u64) -> f64 {
    let u1 = lcg_random(state);
    let u2 = lcg_random(state);
    (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos()
}

// ============================================================================
// SYSTEM RELIABILITY
// ============================================================================

/// System reliability types
#[derive(Debug, Clone, Copy)]
pub enum SystemType {
    Series,     // Weakest link - any failure causes system failure
    Parallel,   // All must fail for system failure
}

/// System reliability analysis
#[derive(Debug, Clone)]
pub struct SystemReliability {
    pub system_type: SystemType,
    pub component_betas: Vec<f64>,
    pub correlation_matrix: Vec<f64>,  // n x n
    pub system_beta: f64,
    pub system_pf: f64,
}

impl SystemReliability {
    pub fn new(system_type: SystemType) -> Self {
        SystemReliability {
            system_type,
            component_betas: Vec::new(),
            correlation_matrix: Vec::new(),
            system_beta: 0.0,
            system_pf: 0.0,
        }
    }

    /// Analyze series or parallel system
    pub fn analyze(&mut self, betas: &[f64], correlation: Option<&[f64]>) {
        let n = betas.len();
        self.component_betas = betas.to_vec();

        // Default to independent
        self.correlation_matrix = if let Some(corr) = correlation {
            corr.to_vec()
        } else {
            let mut ident = vec![0.0; n * n];
            for i in 0..n {
                ident[i * n + i] = 1.0;
            }
            ident
        };

        match self.system_type {
            SystemType::Series => self.analyze_series(),
            SystemType::Parallel => self.analyze_parallel(),
        }
    }

    fn analyze_series(&mut self) {
        let n = self.component_betas.len();

        // Ditlevsen bounds for series system
        // Lower bound: max(pf_i)
        // Upper bound: 1 - prod(1 - pf_i)

        let pf_components: Vec<f64> = self.component_betas.iter()
            .map(|&beta| standard_normal_cdf(-beta))
            .collect();

        let pf_lower = pf_components.iter().cloned().fold(0.0, f64::max);

        // Upper bound (independent assumption)
        let pf_upper_ind = 1.0 - pf_components.iter()
            .map(|&p| 1.0 - p)
            .product::<f64>();

        // Narrow bounds with correlation (simplified)
        let mut pf_estimate = pf_lower;

        for i in 1..n {
            // Maximum additional contribution
            let mut max_contrib = pf_components[i];

            for j in 0..i {
                let rho = self.correlation_matrix[i * n + j];
                let joint = self.bivariate_normal_cdf(
                    -self.component_betas[i],
                    -self.component_betas[j],
                    rho,
                );
                max_contrib = (max_contrib - joint).max(0.0);
            }

            pf_estimate += max_contrib;
        }

        self.system_pf = pf_estimate.min(pf_upper_ind);
        self.system_beta = -standard_normal_inverse_cdf(self.system_pf);
    }

    fn analyze_parallel(&mut self) {
        let n = self.component_betas.len();

        // For parallel: all must fail
        // P(system fail) = P(all components fail)

        if n == 1 {
            self.system_pf = standard_normal_cdf(-self.component_betas[0]);
            self.system_beta = self.component_betas[0];
            return;
        }

        // Product approximation for independent components
        let pf_product: f64 = self.component_betas.iter()
            .map(|&beta| standard_normal_cdf(-beta))
            .product();

        // Correlation increases joint probability (simplified correction)
        let mut correlation_factor = 1.0;
        for i in 0..n {
            for j in (i + 1)..n {
                let rho = self.correlation_matrix[i * n + j];
                correlation_factor *= 1.0 + rho * 0.5;  // Simplified
            }
        }

        self.system_pf = (pf_product * correlation_factor).min(1.0);
        self.system_beta = -standard_normal_inverse_cdf(self.system_pf);
    }

    fn bivariate_normal_cdf(&self, x: f64, y: f64, rho: f64) -> f64 {
        // Approximate bivariate normal CDF (Drezner-Wesolowsky)
        if rho.abs() < 1e-10 {
            return standard_normal_cdf(x) * standard_normal_cdf(y);
        }

        let a1 = -x / (2.0 * (1.0 - rho * rho)).sqrt();
        let b1 = -y / (2.0 * (1.0 - rho * rho)).sqrt();

        // Gauss-Legendre weights and nodes
        let weights = [0.1713244924, 0.3607615730, 0.4679139346];
        let nodes = [0.9324695142, 0.6612093865, 0.2386191861];

        let mut result = 0.0;

        for i in 0..3 {
            for sign in [-1.0, 1.0] {
                let xi = sign * nodes[i];
                let sin_theta = xi * rho / 2.0_f64.sqrt();
                let cos_theta = (1.0 - sin_theta * sin_theta).sqrt();

                result += weights[i] * 
                    (a1 * (1.0 + sin_theta) / cos_theta + b1).exp();
            }
        }

        result *= -(1.0 - rho * rho) / (4.0 * PI);
        result += standard_normal_cdf(x) * standard_normal_cdf(y);

        result.clamp(0.0, 1.0)
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normal_distribution() {
        let rv = RandomVariableType::Normal { mean: 100.0, std_dev: 10.0 };

        let x = rv.from_standard_normal(0.0);
        assert!((x - 100.0).abs() < 1e-6);

        let u = rv.to_standard_normal(110.0);
        assert!((u - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_lognormal_distribution() {
        let rv = RandomVariableType::Lognormal { mean: 100.0, std_dev: 20.0 };

        assert!(rv.pdf(100.0) > 0.0);
        assert!(rv.cdf(100.0) > 0.4 && rv.cdf(100.0) < 0.6);
    }

    #[test]
    fn test_weibull_distribution() {
        let rv = RandomVariableType::Weibull { shape: 2.0, scale: 100.0 };

        assert!((rv.cdf(0.0)).abs() < 1e-10);
        assert!(rv.cdf(100.0) > 0.5);
    }

    #[test]
    fn test_form_simple() {
        let mut form = FirstOrderReliability::new();
        let mut variables = vec![
            ReliabilityVariable::new("R", RandomVariableType::Normal { mean: 100.0, std_dev: 10.0 }),
            ReliabilityVariable::new("S", RandomVariableType::Normal { mean: 50.0, std_dev: 5.0 }),
        ];

        let limit_state = |x: &[f64]| x[0] - x[1];  // g = R - S

        form.analyze(&mut variables, limit_state);

        // Beta should be positive (safe system)
        assert!(form.beta > 0.0);
        assert!(form.probability_of_failure < 0.5);
    }

    #[test]
    fn test_sorm() {
        let mut sorm = SecondOrderReliability::new();
        let mut variables = vec![
            ReliabilityVariable::new("X", RandomVariableType::Normal { mean: 5.0, std_dev: 1.0 }),
        ];

        let limit_state = |x: &[f64]| x[0] - 3.0;

        sorm.analyze(&mut variables, limit_state);

        assert!(sorm.form_beta > 0.0);
    }

    #[test]
    fn test_importance_sampling() {
        let mut is = ImportanceSampling::new(1000);
        let variables = vec![
            ReliabilityVariable::new("X", RandomVariableType::Normal { mean: 0.0, std_dev: 1.0 }),
        ];
        let design_point = vec![3.0];
        
        let limit_state = |x: &[f64]| 3.0 - x[0];

        is.analyze(&variables, &design_point, limit_state);

        assert!(is.probability_of_failure > 0.0 && is.probability_of_failure < 0.01);
    }

    #[test]
    fn test_system_reliability_series() {
        let mut sr = SystemReliability::new(SystemType::Series);
        let betas = vec![3.0, 4.0, 5.0];

        sr.analyze(&betas, None);

        // Series: pf > max individual pf
        assert!(sr.system_pf > standard_normal_cdf(-3.0) * 0.9);
    }

    #[test]
    fn test_system_reliability_parallel() {
        let mut sr = SystemReliability::new(SystemType::Parallel);
        let betas = vec![3.0, 3.0];

        sr.analyze(&betas, None);

        // Parallel: pf < each individual pf
        let pf_single = standard_normal_cdf(-3.0);
        assert!(sr.system_pf < pf_single);
    }

    #[test]
    fn test_beta_from_pf() {
        let beta = FirstOrderReliability::beta_from_pf(0.001);
        assert!((beta - 3.09).abs() < 0.1);
    }

    #[test]
    fn test_standard_normal_cdf() {
        assert!((standard_normal_cdf(0.0) - 0.5).abs() < 1e-6);
        assert!((standard_normal_cdf(1.0) - 0.8413).abs() < 0.01);
        assert!((standard_normal_cdf(-1.0) - 0.1587).abs() < 0.01);
    }

    #[test]
    fn test_standard_normal_inverse() {
        assert!((standard_normal_inverse_cdf(0.5)).abs() < 1e-6);
        assert!((standard_normal_inverse_cdf(0.8413) - 1.0).abs() < 0.01);
    }
}
