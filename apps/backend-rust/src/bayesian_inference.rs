//! Bayesian Inference Module
//!
//! Bayesian parameter estimation and model updating for structural systems.
//! Essential for learning from data and quantifying epistemic uncertainty.
//!
//! ## Methods Implemented
//! - **Metropolis-Hastings MCMC** - General purpose sampling
//! - **Adaptive MCMC** - Self-tuning proposal distribution
//! - **Ensemble Samplers** - Affine-invariant sampling
//! - **Bayesian Model Selection** - Evidence computation
//! - **Gaussian Process Regression** - Non-parametric inference

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;
use crate::special_functions::lgamma as ln_gamma;

// ============================================================================
// PRIOR DISTRIBUTIONS
// ============================================================================

/// Prior distribution types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PriorDistribution {
    /// Normal prior: N(mean, variance)
    Normal { mean: f64, variance: f64 },
    /// Uniform prior: U(min, max)
    Uniform { min: f64, max: f64 },
    /// Log-normal prior: LogN(mu, sigma²)
    LogNormal { log_mean: f64, log_variance: f64 },
    /// Gamma prior: Gamma(shape, rate)
    Gamma { shape: f64, rate: f64 },
    /// Beta prior: Beta(alpha, beta)
    Beta { alpha: f64, beta: f64 },
    /// Inverse Gamma: InvGamma(shape, scale)
    InverseGamma { shape: f64, scale: f64 },
    /// Half-normal (positive): |N(0, scale)|
    HalfNormal { scale: f64 },
}

impl PriorDistribution {
    /// Log probability density
    pub fn log_pdf(&self, x: f64) -> f64 {
        match *self {
            PriorDistribution::Normal { mean, variance } => {
                let z = (x - mean) / variance.sqrt();
                -0.5 * (2.0 * PI * variance).ln() - 0.5 * z * z
            }
            PriorDistribution::Uniform { min, max } => {
                if x >= min && x <= max {
                    -(max - min).ln()
                } else {
                    f64::NEG_INFINITY
                }
            }
            PriorDistribution::LogNormal { log_mean, log_variance } => {
                if x <= 0.0 {
                    f64::NEG_INFINITY
                } else {
                    let log_x = x.ln();
                    let z = (log_x - log_mean) / log_variance.sqrt();
                    -log_x - 0.5 * (2.0 * PI * log_variance).ln() - 0.5 * z * z
                }
            }
            PriorDistribution::Gamma { shape, rate } => {
                if x <= 0.0 {
                    f64::NEG_INFINITY
                } else {
                    shape * rate.ln() - ln_gamma(shape) + (shape - 1.0) * x.ln() - rate * x
                }
            }
            PriorDistribution::Beta { alpha, beta } => {
                if x <= 0.0 || x >= 1.0 {
                    f64::NEG_INFINITY
                } else {
                    (alpha - 1.0) * x.ln() + (beta - 1.0) * (1.0 - x).ln()
                        - ln_beta(alpha, beta)
                }
            }
            PriorDistribution::InverseGamma { shape, scale } => {
                if x <= 0.0 {
                    f64::NEG_INFINITY
                } else {
                    shape * scale.ln() - ln_gamma(shape) 
                        - (shape + 1.0) * x.ln() - scale / x
                }
            }
            PriorDistribution::HalfNormal { scale } => {
                if x < 0.0 {
                    f64::NEG_INFINITY
                } else {
                    (2.0 / PI).sqrt().ln() - scale.ln() - 0.5 * (x / scale).powi(2)
                }
            }
        }
    }

    /// Sample from prior
    pub fn sample(&self, rng_state: &mut u64) -> f64 {
        match *self {
            PriorDistribution::Normal { mean, variance } => {
                mean + variance.sqrt() * box_muller_normal(rng_state)
            }
            PriorDistribution::Uniform { min, max } => {
                min + lcg_random(rng_state) * (max - min)
            }
            PriorDistribution::LogNormal { log_mean, log_variance } => {
                (log_mean + log_variance.sqrt() * box_muller_normal(rng_state)).exp()
            }
            PriorDistribution::Gamma { shape, rate } => {
                // Marsaglia and Tsang's method for shape >= 1
                let d = shape - 1.0 / 3.0;
                let c = 1.0 / (9.0 * d).sqrt();

                loop {
                    let x = box_muller_normal(rng_state);
                    let v = (1.0 + c * x).powi(3);

                    if v > 0.0 {
                        let u = lcg_random(rng_state);
                        if u < 1.0 - 0.0331 * x.powi(4) 
                            || u.ln() < 0.5 * x.powi(2) + d * (1.0 - v + v.ln()) {
                            return d * v / rate;
                        }
                    }
                }
            }
            PriorDistribution::Beta { alpha, beta } => {
                let x = self.sample_gamma(alpha, 1.0, rng_state);
                let y = self.sample_gamma(beta, 1.0, rng_state);
                x / (x + y)
            }
            PriorDistribution::InverseGamma { shape, scale } => {
                scale / self.sample_gamma(shape, 1.0, rng_state)
            }
            PriorDistribution::HalfNormal { scale } => {
                scale * box_muller_normal(rng_state).abs()
            }
        }
    }

    fn sample_gamma(&self, shape: f64, rate: f64, rng_state: &mut u64) -> f64 {
        let d = shape - 1.0 / 3.0;
        let c = 1.0 / (9.0 * d.max(0.01)).sqrt();

        loop {
            let x = box_muller_normal(rng_state);
            let v = (1.0 + c * x).max(0.0).powi(3);

            if v > 0.0 {
                let u = lcg_random(rng_state);
                if u < 1.0 - 0.0331 * x.powi(4) 
                    || u.ln() < 0.5 * x.powi(2) + d * (1.0 - v + v.ln()) {
                    return d * v / rate;
                }
            }
        }
    }
}

/// Bayesian parameter with prior
#[derive(Debug, Clone)]
pub struct BayesianParameter {
    pub name: String,
    pub prior: PriorDistribution,
    pub current_value: f64,
    pub acceptance_rate: f64,
}

impl BayesianParameter {
    pub fn new(name: &str, prior: PriorDistribution) -> Self {
        let mut rng = 42u64;
        let initial = prior.sample(&mut rng);
        
        BayesianParameter {
            name: name.to_string(),
            prior,
            current_value: initial,
            acceptance_rate: 0.0,
        }
    }

    pub fn with_initial(mut self, value: f64) -> Self {
        self.current_value = value;
        self
    }
}

// ============================================================================
// LIKELIHOOD FUNCTIONS
// ============================================================================

/// Likelihood function types
#[derive(Debug, Clone)]
pub enum LikelihoodFunction {
    /// Gaussian likelihood: y ~ N(f(θ), σ²)
    Gaussian { sigma: f64 },
    /// Student-t likelihood: y ~ t(ν, f(θ), σ)
    StudentT { df: f64, scale: f64 },
    /// Poisson likelihood: y ~ Poisson(λ(θ))
    Poisson,
    /// Custom log-likelihood function (stored as closure ID)
    Custom,
}

impl LikelihoodFunction {
    /// Compute log-likelihood for single observation
    pub fn log_likelihood(&self, observed: f64, predicted: f64) -> f64 {
        match *self {
            LikelihoodFunction::Gaussian { sigma } => {
                let residual = observed - predicted;
                -0.5 * (2.0 * PI * sigma * sigma).ln() 
                    - 0.5 * (residual / sigma).powi(2)
            }
            LikelihoodFunction::StudentT { df, scale } => {
                let residual = (observed - predicted) / scale;
                ln_gamma((df + 1.0) / 2.0) - ln_gamma(df / 2.0)
                    - 0.5 * (df * PI).ln() - scale.ln()
                    - ((df + 1.0) / 2.0) * (1.0 + residual * residual / df).ln()
            }
            LikelihoodFunction::Poisson => {
                if observed < 0.0 || predicted <= 0.0 {
                    f64::NEG_INFINITY
                } else {
                    let k = observed.round() as u64;
                    k as f64 * predicted.ln() - predicted - ln_factorial(k)
                }
            }
            LikelihoodFunction::Custom => {
                // Placeholder - actual implementation would use closure
                0.0
            }
        }
    }

    /// Compute total log-likelihood for dataset
    pub fn total_log_likelihood(&self, observed: &[f64], predicted: &[f64]) -> f64 {
        observed.iter()
            .zip(predicted.iter())
            .map(|(&o, &p)| self.log_likelihood(o, p))
            .sum()
    }
}

// ============================================================================
// METROPOLIS-HASTINGS MCMC
// ============================================================================

/// Metropolis-Hastings MCMC sampler
#[derive(Debug, Clone)]
pub struct MetropolisHastings {
    pub n_iterations: usize,
    pub burn_in: usize,
    pub thinning: usize,
    pub proposal_scales: Vec<f64>,
    pub samples: Vec<Vec<f64>>,
    pub log_posteriors: Vec<f64>,
    pub acceptance_count: usize,
}

impl MetropolisHastings {
    pub fn new(n_iterations: usize) -> Self {
        MetropolisHastings {
            n_iterations,
            burn_in: n_iterations / 4,
            thinning: 1,
            proposal_scales: Vec::new(),
            samples: Vec::new(),
            log_posteriors: Vec::new(),
            acceptance_count: 0,
        }
    }

    pub fn with_burn_in(mut self, burn_in: usize) -> Self {
        self.burn_in = burn_in;
        self
    }

    /// Run MCMC sampling
    #[allow(unused_assignments)]
    pub fn sample<F>(
        &mut self,
        parameters: &mut [BayesianParameter],
        log_likelihood: F,
    )
    where
        F: Fn(&[f64]) -> f64,
    {
        let n_params = parameters.len();
        let mut rng_state = 12345u64;

        // Initialize proposal scales if not set
        if self.proposal_scales.len() != n_params {
            self.proposal_scales = vec![1.0; n_params];
        }

        // Current state
        let mut current: Vec<f64> = parameters.iter().map(|p| p.current_value).collect();
        #[allow(unused_assignments)]
        let mut current_log_prior: f64 = parameters.iter()
            .zip(current.iter())
            .map(|(p, &x)| p.prior.log_pdf(x))
            .sum();
        #[allow(unused_assignments)]
        let mut current_log_likelihood = log_likelihood(&current);
        let mut current_log_posterior = current_log_prior + current_log_likelihood;

        self.samples.clear();
        self.log_posteriors.clear();
        self.acceptance_count = 0;

        for iter in 0..self.n_iterations {
            // Propose new state
            let mut proposed = current.clone();

            for i in 0..n_params {
                proposed[i] += self.proposal_scales[i] * box_muller_normal(&mut rng_state);
            }

            // Compute proposed log-posterior
            let proposed_log_prior: f64 = parameters.iter()
                .zip(proposed.iter())
                .map(|(p, &x)| p.prior.log_pdf(x))
                .sum();

            if proposed_log_prior.is_finite() {
                let proposed_log_likelihood = log_likelihood(&proposed);
                let proposed_log_posterior = proposed_log_prior + proposed_log_likelihood;

                // Acceptance probability
                let log_alpha = proposed_log_posterior - current_log_posterior;

                if log_alpha >= 0.0 || lcg_random(&mut rng_state).ln() < log_alpha {
                    current = proposed;
                    current_log_prior = proposed_log_prior;
                    current_log_likelihood = proposed_log_likelihood;
                    current_log_posterior = proposed_log_posterior;
                    self.acceptance_count += 1;
                }
            }

            // Store sample (after burn-in, with thinning)
            if iter >= self.burn_in && (iter - self.burn_in) % self.thinning == 0 {
                self.samples.push(current.clone());
                self.log_posteriors.push(current_log_posterior);
            }
        }

        // Update parameter values to posterior mean
        for (i, param) in parameters.iter_mut().enumerate() {
            param.current_value = self.samples.iter().map(|s| s[i]).sum::<f64>() 
                / self.samples.len() as f64;
            param.acceptance_rate = self.acceptance_count as f64 / self.n_iterations as f64;
        }
    }

    /// Compute posterior statistics
    pub fn posterior_statistics(&self) -> Vec<PosteriorStats> {
        if self.samples.is_empty() {
            return Vec::new();
        }

        let n_params = self.samples[0].len();
        let n_samples = self.samples.len();

        (0..n_params).map(|i| {
            let values: Vec<f64> = self.samples.iter().map(|s| s[i]).collect();

            let mean = values.iter().sum::<f64>() / n_samples as f64;
            let variance = values.iter().map(|&x| (x - mean).powi(2)).sum::<f64>() 
                / (n_samples - 1) as f64;

            let mut sorted = values.clone();
            sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

            let median = sorted[n_samples / 2];
            let ci_lower = sorted[(0.025 * n_samples as f64) as usize];
            let ci_upper = sorted[(0.975 * n_samples as f64) as usize];

            PosteriorStats {
                mean,
                std_dev: variance.sqrt(),
                median,
                ci_95_lower: ci_lower,
                ci_95_upper: ci_upper,
            }
        }).collect()
    }

    /// Effective sample size (ESS)
    pub fn effective_sample_size(&self, param_idx: usize) -> f64 {
        let values: Vec<f64> = self.samples.iter().map(|s| s[param_idx]).collect();
        let n = values.len();

        if n < 2 {
            return n as f64;
        }

        let mean = values.iter().sum::<f64>() / n as f64;
        let var: f64 = values.iter().map(|&x| (x - mean).powi(2)).sum::<f64>() / n as f64;

        if var < 1e-14 {
            return n as f64;
        }

        // Compute autocorrelation
        let mut rho_sum = 0.0;
        for lag in 1..(n / 2) {
            let autocorr: f64 = (0..(n - lag))
                .map(|i| (values[i] - mean) * (values[i + lag] - mean))
                .sum::<f64>() / (var * n as f64);

            if autocorr < 0.05 {
                break;
            }
            rho_sum += autocorr;
        }

        n as f64 / (1.0 + 2.0 * rho_sum)
    }
}

/// Posterior distribution statistics
#[derive(Debug, Clone)]
pub struct PosteriorStats {
    pub mean: f64,
    pub std_dev: f64,
    pub median: f64,
    pub ci_95_lower: f64,
    pub ci_95_upper: f64,
}

// ============================================================================
// ADAPTIVE MCMC
// ============================================================================

/// Adaptive Metropolis algorithm
#[derive(Debug, Clone)]
pub struct AdaptiveMCMC {
    pub n_iterations: usize,
    pub adaptation_interval: usize,
    pub target_acceptance: f64,
    pub covariance: Vec<f64>,  // n x n
    pub samples: Vec<Vec<f64>>,
    pub acceptance_count: usize,
}

impl AdaptiveMCMC {
    pub fn new(n_iterations: usize) -> Self {
        AdaptiveMCMC {
            n_iterations,
            adaptation_interval: 100,
            target_acceptance: 0.234,
            covariance: Vec::new(),
            samples: Vec::new(),
            acceptance_count: 0,
        }
    }

    /// Run adaptive MCMC
    #[allow(unused_assignments)]
    pub fn sample<F>(
        &mut self,
        parameters: &mut [BayesianParameter],
        log_likelihood: F,
    )
    where
        F: Fn(&[f64]) -> f64,
    {
        let n = parameters.len();
        let mut rng_state = 54321u64;

        // Initialize covariance as identity
        self.covariance = vec![0.0; n * n];
        for i in 0..n {
            self.covariance[i * n + i] = 1.0;
        }

        let mut current: Vec<f64> = parameters.iter().map(|p| p.current_value).collect();
        #[allow(unused_assignments)]
        let mut current_log_prior: f64 = parameters.iter()
            .zip(current.iter())
            .map(|(p, &x)| p.prior.log_pdf(x))
            .sum();
        #[allow(unused_assignments)]
        let mut current_log_likelihood = log_likelihood(&current);
        let mut current_log_posterior = current_log_prior + current_log_likelihood;

        let mut scale = 2.38 * 2.38 / n as f64;
        let mut batch_accepts = 0;

        // Empirical mean and covariance
        let mut emp_mean = current.clone();
        let mut emp_cov = self.covariance.clone();

        self.samples.clear();
        self.acceptance_count = 0;

        for iter in 0..self.n_iterations {
            // Generate proposal using Cholesky of covariance
            let z: Vec<f64> = (0..n).map(|_| box_muller_normal(&mut rng_state)).collect();
            let chol = self.cholesky(&emp_cov, n);

            let mut proposed = current.clone();
            for i in 0..n {
                for j in 0..=i {
                    proposed[i] += scale.sqrt() * chol[i * n + j] * z[j];
                }
            }

            // Evaluate proposal
            let proposed_log_prior: f64 = parameters.iter()
                .zip(proposed.iter())
                .map(|(p, &x)| p.prior.log_pdf(x))
                .sum();

            if proposed_log_prior.is_finite() {
                let proposed_log_likelihood = log_likelihood(&proposed);
                let proposed_log_posterior = proposed_log_prior + proposed_log_likelihood;

                let log_alpha = proposed_log_posterior - current_log_posterior;

                if log_alpha >= 0.0 || lcg_random(&mut rng_state).ln() < log_alpha {
                    current = proposed;
                    current_log_prior = proposed_log_prior;
                    current_log_likelihood = proposed_log_likelihood;
                    current_log_posterior = proposed_log_posterior;
                    self.acceptance_count += 1;
                    batch_accepts += 1;
                }
            }

            // Update empirical covariance (Welford's algorithm)
            let k = iter + 1;
            let delta: Vec<f64> = current.iter().zip(emp_mean.iter())
                .map(|(&c, &m)| c - m).collect();

            for (i, (m, &d)) in emp_mean.iter_mut().zip(delta.iter()).enumerate() {
                *m += d / k as f64;

                for j in 0..=i {
                    emp_cov[i * n + j] += (delta[i] * delta[j] - emp_cov[i * n + j]) / k as f64;
                    emp_cov[j * n + i] = emp_cov[i * n + j];
                }
            }

            // Adapt scale
            if (iter + 1) % self.adaptation_interval == 0 {
                let acceptance_rate = batch_accepts as f64 / self.adaptation_interval as f64;
                let factor = if acceptance_rate > self.target_acceptance { 1.1 } else { 0.9 };
                scale *= factor;
                batch_accepts = 0;
            }

            self.samples.push(current.clone());
        }

        self.covariance = emp_cov;
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
                    l[i * n + j] = if val > 0.0 { val.sqrt() } else { 1e-6 };
                } else {
                    l[i * n + j] = (a[i * n + j] - sum) / l[j * n + j].max(1e-10);
                }
            }
        }

        l
    }
}

// ============================================================================
// ENSEMBLE SAMPLER (EMCEE-STYLE)
// ============================================================================

/// Affine-invariant ensemble sampler
#[derive(Debug, Clone)]
pub struct EnsembleSampler {
    pub n_walkers: usize,
    pub n_iterations: usize,
    pub stretch_factor: f64,
    pub walkers: Vec<Vec<f64>>,
    pub log_probs: Vec<f64>,
    pub chain: Vec<Vec<Vec<f64>>>,  // iterations x walkers x params
}

impl EnsembleSampler {
    pub fn new(n_walkers: usize, n_iterations: usize) -> Self {
        EnsembleSampler {
            n_walkers,
            n_iterations,
            stretch_factor: 2.0,
            walkers: Vec::new(),
            log_probs: Vec::new(),
            chain: Vec::new(),
        }
    }

    /// Initialize walkers around starting point
    pub fn initialize(&mut self, parameters: &[BayesianParameter]) {
        let _n = parameters.len();
        let mut rng_state = 98765u64;

        self.walkers = (0..self.n_walkers).map(|_| {
            parameters.iter().map(|p| {
                p.current_value * (1.0 + 0.01 * box_muller_normal(&mut rng_state))
            }).collect()
        }).collect();

        self.log_probs = vec![f64::NEG_INFINITY; self.n_walkers];
    }

    /// Run ensemble sampling
    pub fn sample<F>(
        &mut self,
        parameters: &[BayesianParameter],
        log_probability: F,
    )
    where
        F: Fn(&[f64]) -> f64,
    {
        let mut rng_state = 11111u64;
        let n_params = parameters.len();

        // Initialize log probs
        for (i, walker) in self.walkers.iter().enumerate() {
            let log_prior: f64 = parameters.iter()
                .zip(walker.iter())
                .map(|(p, &x)| p.prior.log_pdf(x))
                .sum();
            self.log_probs[i] = if log_prior.is_finite() {
                log_prior + log_probability(walker)
            } else {
                f64::NEG_INFINITY
            };
        }

        self.chain.clear();

        for _iter in 0..self.n_iterations {
            // Update each walker
            for i in 0..self.n_walkers {
                // Choose complementary walker
                let mut j = (lcg_random(&mut rng_state) * self.n_walkers as f64) as usize;
                while j == i {
                    j = (lcg_random(&mut rng_state) * self.n_walkers as f64) as usize;
                }

                // Stretch move: z from p(z) ∝ 1/√z on [1/a, a] (Goodman & Weare 2010)
                // z = [u·(√a - 1/√a) + 1/√a]²
                let sqrt_a = self.stretch_factor.sqrt();
                let z = (lcg_random(&mut rng_state) * (sqrt_a - 1.0 / sqrt_a)
                    + 1.0 / sqrt_a).powi(2);

                let proposed: Vec<f64> = self.walkers[j].iter()
                    .zip(self.walkers[i].iter())
                    .map(|(&xj, &xi)| xj + z * (xi - xj))
                    .collect();

                // Evaluate
                let log_prior: f64 = parameters.iter()
                    .zip(proposed.iter())
                    .map(|(p, &x)| p.prior.log_pdf(x))
                    .sum();

                if log_prior.is_finite() {
                    let proposed_log_prob = log_prior + log_probability(&proposed);
                    
                    let log_alpha = (n_params - 1) as f64 * z.ln()
                        + proposed_log_prob - self.log_probs[i];

                    if log_alpha >= 0.0 || lcg_random(&mut rng_state).ln() < log_alpha {
                        self.walkers[i] = proposed;
                        self.log_probs[i] = proposed_log_prob;
                    }
                }
            }

            self.chain.push(self.walkers.clone());
        }
    }

    /// Get flattened chain (all walkers combined)
    pub fn get_flat_chain(&self, discard: usize) -> Vec<Vec<f64>> {
        self.chain.iter()
            .skip(discard)
            .flat_map(|step| step.iter().cloned())
            .collect()
    }
}

// ============================================================================
// BAYESIAN MODEL SELECTION
// ============================================================================

/// Bayesian model comparison
#[derive(Debug, Clone)]
pub struct BayesianModelSelection {
    pub models: Vec<ModelEvidence>,
    pub posterior_probabilities: Vec<f64>,
}

#[derive(Debug, Clone)]
pub struct ModelEvidence {
    pub name: String,
    pub log_evidence: f64,
    pub prior_probability: f64,
    pub n_parameters: usize,
    pub bic: f64,
    pub aic: f64,
}

impl BayesianModelSelection {
    pub fn new() -> Self {
        BayesianModelSelection {
            models: Vec::new(),
            posterior_probabilities: Vec::new(),
        }
    }

    /// Add model with evidence computed via harmonic mean estimator
    pub fn add_model(
        &mut self,
        name: &str,
        log_likelihoods: &[f64],
        n_parameters: usize,
        n_data_points: usize,
        prior_probability: f64,
    ) {
        // Harmonic mean estimator (simple but can be unstable)
        let max_ll = log_likelihoods.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let log_evidence = max_ll - (log_likelihoods.iter()
            .map(|&ll| (max_ll - ll).exp())
            .sum::<f64>() / log_likelihoods.len() as f64).ln();

        // Information criteria
        let max_ll_value = log_likelihoods.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let aic = -2.0 * max_ll_value + 2.0 * n_parameters as f64;
        let bic = -2.0 * max_ll_value + (n_parameters as f64) * (n_data_points as f64).ln();

        self.models.push(ModelEvidence {
            name: name.to_string(),
            log_evidence,
            prior_probability,
            n_parameters,
            bic,
            aic,
        });
    }

    /// Compute posterior model probabilities
    pub fn compute_posterior_probabilities(&mut self) {
        let max_log_evidence = self.models.iter()
            .map(|m| m.log_evidence + m.prior_probability.ln())
            .fold(f64::NEG_INFINITY, f64::max);

        let unnormalized: Vec<f64> = self.models.iter()
            .map(|m| (m.log_evidence + m.prior_probability.ln() - max_log_evidence).exp())
            .collect();

        let total: f64 = unnormalized.iter().sum();

        self.posterior_probabilities = unnormalized.iter()
            .map(|&p| p / total)
            .collect();
    }

    /// Bayes factor between two models
    pub fn bayes_factor(&self, model1_idx: usize, model2_idx: usize) -> f64 {
        let log_bf = self.models[model1_idx].log_evidence 
            - self.models[model2_idx].log_evidence;
        log_bf.exp()
    }
}

impl Default for BayesianModelSelection {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// GAUSSIAN PROCESS REGRESSION (BAYESIAN)
// ============================================================================

/// Bayesian Gaussian Process regression
#[derive(Debug, Clone)]
pub struct BayesianGaussianProcess {
    pub x_train: Vec<Vec<f64>>,
    pub y_train: Vec<f64>,
    pub length_scale: f64,
    pub signal_variance: f64,
    pub noise_variance: f64,
    pub alpha: Vec<f64>,  // Precomputed weights
    pub k_inv: Vec<f64>,  // Inverse covariance
}

impl BayesianGaussianProcess {
    pub fn new() -> Self {
        BayesianGaussianProcess {
            x_train: Vec::new(),
            y_train: Vec::new(),
            length_scale: 1.0,
            signal_variance: 1.0,
            noise_variance: 0.01,
            alpha: Vec::new(),
            k_inv: Vec::new(),
        }
    }

    /// Fit GP to training data
    pub fn fit(&mut self, x: &[Vec<f64>], y: &[f64]) {
        self.x_train = x.to_vec();
        self.y_train = y.to_vec();
        let n = x.len();

        // Build covariance matrix
        let mut k = vec![0.0; n * n];
        for i in 0..n {
            for j in 0..n {
                k[i * n + j] = self.kernel(&x[i], &x[j]);
                if i == j {
                    k[i * n + j] += self.noise_variance;
                }
            }
        }

        // Compute inverse and weights
        self.k_inv = self.matrix_inverse(&k, n);
        self.alpha = self.matrix_vector_mult(&self.k_inv, y, n);
    }

    /// Predict with uncertainty
    pub fn predict(&self, x_new: &[f64]) -> (f64, f64) {
        let n = self.x_train.len();

        // Covariance with training points
        let k_star: Vec<f64> = self.x_train.iter()
            .map(|xi| self.kernel(x_new, xi))
            .collect();

        // Mean prediction
        let mean: f64 = k_star.iter().zip(self.alpha.iter())
            .map(|(&k, &a)| k * a)
            .sum();

        // Variance prediction
        let k_star_star = self.kernel(x_new, x_new) + self.noise_variance;
        let v = self.matrix_vector_mult(&self.k_inv, &k_star, n);
        let variance = k_star_star - k_star.iter().zip(v.iter())
            .map(|(&k, &vi)| k * vi)
            .sum::<f64>();

        (mean, variance.max(0.0))
    }

    /// Log marginal likelihood (for hyperparameter optimization)
    pub fn log_marginal_likelihood(&self) -> f64 {
        let n = self.x_train.len();

        // Build covariance matrix
        let mut k = vec![0.0; n * n];
        for i in 0..n {
            for j in 0..n {
                k[i * n + j] = self.kernel(&self.x_train[i], &self.x_train[j]);
                if i == j {
                    k[i * n + j] += self.noise_variance;
                }
            }
        }

        // Log determinant (sum of log diagonal of Cholesky)
        let chol = self.cholesky(&k, n);
        let log_det: f64 = (0..n).map(|i| chol[i * n + i].ln()).sum::<f64>() * 2.0;

        // Data fit term
        let alpha = self.matrix_vector_mult(&self.k_inv, &self.y_train, n);
        let data_fit: f64 = self.y_train.iter().zip(alpha.iter())
            .map(|(&y, &a)| y * a)
            .sum();

        -0.5 * data_fit - 0.5 * log_det - 0.5 * n as f64 * (2.0 * PI).ln()
    }

    fn kernel(&self, x1: &[f64], x2: &[f64]) -> f64 {
        let sq_dist: f64 = x1.iter().zip(x2.iter())
            .map(|(&a, &b)| (a - b).powi(2))
            .sum();

        self.signal_variance * (-0.5 * sq_dist / (self.length_scale * self.length_scale)).exp()
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

    fn matrix_inverse(&self, a: &[f64], n: usize) -> Vec<f64> {
        let mut aug = vec![0.0; n * 2 * n];
        for i in 0..n {
            for j in 0..n {
                aug[i * 2 * n + j] = a[i * n + j];
            }
            aug[i * 2 * n + n + i] = 1.0;
        }

        for i in 0..n {
            let pivot = aug[i * 2 * n + i];
            if pivot.abs() < 1e-14 {
                continue;
            }
            for j in 0..(2 * n) {
                aug[i * 2 * n + j] /= pivot;
            }
            for k in 0..n {
                if k != i {
                    let factor = aug[k * 2 * n + i];
                    for j in 0..(2 * n) {
                        aug[k * 2 * n + j] -= factor * aug[i * 2 * n + j];
                    }
                }
            }
        }

        let mut inv = vec![0.0; n * n];
        for i in 0..n {
            for j in 0..n {
                inv[i * n + j] = aug[i * 2 * n + n + j];
            }
        }

        inv
    }

    fn matrix_vector_mult(&self, a: &[f64], x: &[f64], n: usize) -> Vec<f64> {
        (0..n).map(|i| {
            (0..n).map(|j| a[i * n + j] * x[j]).sum()
        }).collect()
    }
}

impl Default for BayesianGaussianProcess {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

fn lcg_random(state: &mut u64) -> f64 {
    *state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
    (*state as f64) / (u64::MAX as f64)
}

fn box_muller_normal(state: &mut u64) -> f64 {
    let u1 = lcg_random(state);
    let u2 = lcg_random(state);
    (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos()
}

fn ln_beta(a: f64, b: f64) -> f64 {
    ln_gamma(a) + ln_gamma(b) - ln_gamma(a + b)
}

fn ln_factorial(n: u64) -> f64 {
    ln_gamma(n as f64 + 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normal_prior() {
        let prior = PriorDistribution::Normal { mean: 0.0, variance: 1.0 };
        
        let pdf_0 = prior.log_pdf(0.0).exp();
        assert!((pdf_0 - 0.3989).abs() < 0.01);  // 1/sqrt(2π)
    }

    #[test]
    fn test_uniform_prior() {
        let prior = PriorDistribution::Uniform { min: 0.0, max: 1.0 };

        assert!(prior.log_pdf(0.5).exp() > 0.99);
        assert!(prior.log_pdf(1.5).is_infinite());
    }

    #[test]
    fn test_prior_sampling() {
        let prior = PriorDistribution::Normal { mean: 10.0, variance: 4.0 };
        let mut rng = 42u64;

        let samples: Vec<f64> = (0..1000).map(|_| prior.sample(&mut rng)).collect();
        let mean: f64 = samples.iter().sum::<f64>() / 1000.0;

        assert!((mean - 10.0).abs() < 0.5);
    }

    #[test]
    fn test_gaussian_likelihood() {
        let ll = LikelihoodFunction::Gaussian { sigma: 1.0 };

        // Perfect match
        let log_ll = ll.log_likelihood(5.0, 5.0);
        assert!(log_ll > ll.log_likelihood(5.0, 6.0));
    }

    #[test]
    fn test_metropolis_hastings() {
        let mut mh = MetropolisHastings::new(1000);
        let mut params = vec![
            BayesianParameter::new("mu", PriorDistribution::Normal { mean: 0.0, variance: 100.0 })
                .with_initial(0.0),
        ];

        // Likelihood centered at 5
        let log_ll = |theta: &[f64]| {
            let sigma = 1.0;
            -0.5 * (theta[0] - 5.0).powi(2) / (sigma * sigma)
        };

        mh.sample(&mut params, log_ll);

        let stats = mh.posterior_statistics();
        assert!((stats[0].mean - 5.0).abs() < 1.0);
    }

    #[test]
    fn test_ensemble_sampler() {
        let mut es = EnsembleSampler::new(10, 100);
        let params = vec![
            BayesianParameter::new("x", PriorDistribution::Uniform { min: -10.0, max: 10.0 })
                .with_initial(0.0),
        ];

        es.initialize(&params);

        let log_prob = |theta: &[f64]| -0.5 * theta[0].powi(2);
        es.sample(&params, log_prob);

        assert!(!es.chain.is_empty());
    }

    #[test]
    fn test_bayesian_model_selection() {
        let mut bms = BayesianModelSelection::new();

        bms.add_model("Model A", &[-10.0, -11.0, -10.5], 2, 10, 0.5);
        bms.add_model("Model B", &[-15.0, -16.0, -15.5], 3, 10, 0.5);

        bms.compute_posterior_probabilities();

        // Model A should have higher posterior (lower negative log-likelihood)
        assert!(bms.posterior_probabilities[0] > bms.posterior_probabilities[1]);
    }

    #[test]
    fn test_gaussian_process() {
        let mut gp = BayesianGaussianProcess::new();
        gp.length_scale = 1.0;
        gp.signal_variance = 1.0;
        gp.noise_variance = 0.01;

        let x_train = vec![vec![0.0], vec![1.0], vec![2.0]];
        let y_train = vec![0.0, 1.0, 0.5];

        gp.fit(&x_train, &y_train);

        let (mean, var) = gp.predict(&[1.0]);
        assert!((mean - 1.0).abs() < 0.2);
        assert!(var >= 0.0);
    }

    #[test]
    fn test_gp_uncertainty() {
        let mut gp = BayesianGaussianProcess::new();
        gp.length_scale = 1.0;
        gp.signal_variance = 1.0;
        gp.noise_variance = 0.01;

        let x_train = vec![vec![0.0], vec![2.0]];
        let y_train = vec![0.0, 0.0];

        gp.fit(&x_train, &y_train);

        // Uncertainty should be higher far from training points
        let (_, var_near) = gp.predict(&[0.0]);
        let (_, var_far) = gp.predict(&[1.0]);

        assert!(var_far > var_near);
    }

    #[test]
    fn test_adaptive_mcmc() {
        let mut amcmc = AdaptiveMCMC::new(500);
        let mut params = vec![
            BayesianParameter::new("theta", PriorDistribution::Normal { mean: 0.0, variance: 100.0 })
                .with_initial(0.0),
        ];

        let log_ll = |theta: &[f64]| -0.5 * (theta[0] - 3.0).powi(2);

        amcmc.sample(&mut params, log_ll);

        assert!(!amcmc.samples.is_empty());
    }
}
