//! Structural Reliability Assessment Module
//! 
//! Advanced reliability and probabilistic analysis:
//! - First/Second Order Reliability Methods (FORM/SORM)
//! - Monte Carlo simulation
//! - Importance sampling
//! - System reliability
//! - Time-dependent reliability
//! - Bayesian updating

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;
use crate::special_functions::erf;

/// Main reliability analyzer
#[derive(Debug, Clone)]
pub struct ReliabilityAnalyzer {
    /// Random variables
    pub variables: Vec<RandomVariable>,
    /// Limit state function
    pub limit_state: LimitStateFunction,
    /// Analysis method
    pub method: ReliabilityMethod,
    /// Results
    pub results: Option<ReliabilityResults>,
}

/// Random variable definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RandomVariable {
    /// Variable name
    pub name: String,
    /// Distribution type
    pub distribution: Distribution,
    /// Mean value
    pub mean: f64,
    /// Standard deviation
    pub std_dev: f64,
    /// Correlation with other variables (optional)
    pub correlations: Vec<(String, f64)>,
}

/// Probability distribution types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum Distribution {
    /// Normal (Gaussian)
    Normal,
    /// Lognormal
    Lognormal,
    /// Uniform
    Uniform,
    /// Gumbel (Extreme Value Type I)
    Gumbel,
    /// Weibull
    Weibull,
    /// Exponential
    Exponential,
    /// Gamma
    Gamma,
}

impl Distribution {
    /// Get standard normal CDF
    pub fn std_normal_cdf(z: f64) -> f64 {
        0.5 * (1.0 + erf(z / 2.0_f64.sqrt()))
    }
    
    /// Get standard normal PDF
    pub fn std_normal_pdf(z: f64) -> f64 {
        (-0.5 * z * z).exp() / (2.0 * PI).sqrt()
    }
    
    /// Get standard normal inverse CDF (approximation)
    pub fn std_normal_inv(p: f64) -> f64 {
        if p <= 0.0 { return f64::NEG_INFINITY; }
        if p >= 1.0 { return f64::INFINITY; }
        
        // Rational approximation
        let a = [
            -3.969683028665376e1,
            2.209460984245205e2,
            -2.759285104469687e2,
            1.383577518672690e2,
            -3.066479806614716e1,
            2.506628277459239e0,
        ];
        let b = [
            -5.447609879822406e1,
            1.615858368580409e2,
            -1.556989798598866e2,
            6.680131188771972e1,
            -1.328068155288572e1,
        ];
        let c = [
            -7.784894002430293e-3,
            -3.223964580411365e-1,
            -2.400758277161838e0,
            -2.549732539343734e0,
            4.374664141464968e0,
            2.938163982698783e0,
        ];
        let d = [
            7.784695709041462e-3,
            3.224671290700398e-1,
            2.445134137142996e0,
            3.754408661907416e0,
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

impl RandomVariable {
    /// Create normal variable
    pub fn normal(name: &str, mean: f64, std_dev: f64) -> Self {
        Self {
            name: name.to_string(),
            distribution: Distribution::Normal,
            mean,
            std_dev,
            correlations: Vec::new(),
        }
    }
    
    /// Create lognormal variable
    pub fn lognormal(name: &str, mean: f64, cov: f64) -> Self {
        let std_dev = mean * cov;
        Self {
            name: name.to_string(),
            distribution: Distribution::Lognormal,
            mean,
            std_dev,
            correlations: Vec::new(),
        }
    }
    
    /// Get coefficient of variation
    pub fn cov(&self) -> f64 {
        self.std_dev / self.mean
    }
    
    /// Transform to standard normal space
    pub fn to_standard_normal(&self, x: f64) -> f64 {
        match self.distribution {
            Distribution::Normal => (x - self.mean) / self.std_dev,
            Distribution::Lognormal => {
                let zeta = (1.0 + self.cov().powi(2)).ln().sqrt();
                let lambda = self.mean.ln() - 0.5 * zeta.powi(2);
                (x.ln() - lambda) / zeta
            }
            Distribution::Uniform => {
                // Uniform to standard normal via CDF
                let a = self.mean - self.std_dev * 3.0_f64.sqrt();
                let b = self.mean + self.std_dev * 3.0_f64.sqrt();
                let p = (x - a) / (b - a);
                Distribution::std_normal_inv(p)
            }
            Distribution::Gumbel => {
                let beta = self.std_dev * 6.0_f64.sqrt() / PI;
                let mu = self.mean - 0.5772 * beta;
                let p = (-(-((x - mu) / beta)).exp()).exp();
                Distribution::std_normal_inv(p)
            }
            _ => (x - self.mean) / self.std_dev, // Fallback
        }
    }
    
    /// Transform from standard normal space
    pub fn from_standard_normal(&self, z: f64) -> f64 {
        match self.distribution {
            Distribution::Normal => self.mean + z * self.std_dev,
            Distribution::Lognormal => {
                let zeta = (1.0 + self.cov().powi(2)).ln().sqrt();
                let lambda = self.mean.ln() - 0.5 * zeta.powi(2);
                (lambda + z * zeta).exp()
            }
            Distribution::Uniform => {
                let p = Distribution::std_normal_cdf(z);
                let a = self.mean - self.std_dev * 3.0_f64.sqrt();
                let b = self.mean + self.std_dev * 3.0_f64.sqrt();
                a + p * (b - a)
            }
            Distribution::Gumbel => {
                let beta = self.std_dev * 6.0_f64.sqrt() / PI;
                let mu = self.mean - 0.5772 * beta;
                let p = Distribution::std_normal_cdf(z);
                mu - beta * (-(-p.ln()).ln())
            }
            _ => self.mean + z * self.std_dev,
        }
    }
}

/// Limit state function
#[derive(Debug, Clone)]
pub struct LimitStateFunction {
    /// Function type
    pub function_type: LimitStateFunctionType,
    /// Function parameters
    pub parameters: Vec<f64>,
    /// Variable names in order
    pub variable_order: Vec<String>,
}

/// Limit state function type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum LimitStateFunctionType {
    /// Linear: g = a0 + sum(ai * xi)
    Linear,
    /// Simple R-S: g = R - S
    SimpleRS,
    /// Product: g = product(xi^ai)
    Product,
    /// Custom (requires explicit evaluation)
    Custom,
}

impl LimitStateFunction {
    /// Create simple R-S function
    pub fn simple_rs() -> Self {
        Self {
            function_type: LimitStateFunctionType::SimpleRS,
            parameters: vec![],
            variable_order: vec!["R".to_string(), "S".to_string()],
        }
    }
    
    /// Create linear function
    pub fn linear(coefficients: Vec<f64>, variables: Vec<String>) -> Self {
        Self {
            function_type: LimitStateFunctionType::Linear,
            parameters: coefficients,
            variable_order: variables,
        }
    }
    
    /// Evaluate function
    pub fn evaluate(&self, values: &[f64]) -> f64 {
        match self.function_type {
            LimitStateFunctionType::SimpleRS => {
                if values.len() >= 2 {
                    values[0] - values[1] // R - S
                } else {
                    0.0
                }
            }
            LimitStateFunctionType::Linear => {
                let mut g = if !self.parameters.is_empty() { self.parameters[0] } else { 0.0 };
                for (i, &x) in values.iter().enumerate() {
                    if i + 1 < self.parameters.len() {
                        g += self.parameters[i + 1] * x;
                    }
                }
                g
            }
            LimitStateFunctionType::Product => {
                let mut g = 1.0;
                for (i, &x) in values.iter().enumerate() {
                    if i < self.parameters.len() {
                        g *= x.powf(self.parameters[i]);
                    }
                }
                g
            }
            LimitStateFunctionType::Custom => {
                // Custom function would need external evaluation
                0.0
            }
        }
    }
    
    /// Calculate gradient (numerical)
    pub fn gradient(&self, values: &[f64], delta: f64) -> Vec<f64> {
        let n = values.len();
        let mut grad = vec![0.0; n];
        let g0 = self.evaluate(values);
        
        for i in 0..n {
            let mut values_plus = values.to_vec();
            values_plus[i] += delta;
            let g_plus = self.evaluate(&values_plus);
            grad[i] = (g_plus - g0) / delta;
        }
        
        grad
    }
}

/// Reliability analysis method
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ReliabilityMethod {
    /// First Order Reliability Method
    FORM,
    /// Second Order Reliability Method
    SORM,
    /// Monte Carlo Simulation
    MonteCarlo,
    /// Importance Sampling
    ImportanceSampling,
}

/// Reliability results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReliabilityResults {
    /// Reliability index (beta)
    pub beta: f64,
    /// Probability of failure
    pub pf: f64,
    /// Design point in original space
    pub design_point: Vec<f64>,
    /// Design point in standard normal space
    pub design_point_std: Vec<f64>,
    /// Sensitivity factors (alpha)
    pub alpha: Vec<f64>,
    /// Importance factors
    pub importance: Vec<f64>,
    /// Number of iterations/samples
    pub iterations: usize,
    /// Convergence achieved
    pub converged: bool,
}

impl ReliabilityAnalyzer {
    /// Create new analyzer
    pub fn new(limit_state: LimitStateFunction, method: ReliabilityMethod) -> Self {
        Self {
            variables: Vec::new(),
            limit_state,
            method,
            results: None,
        }
    }
    
    /// Add random variable
    pub fn add_variable(&mut self, var: RandomVariable) {
        self.variables.push(var);
    }
    
    /// Run FORM analysis
    pub fn run_form(&mut self) -> &ReliabilityResults {
        let n = self.variables.len();
        
        // Initial point (mean values)
        let mut u = vec![0.0; n]; // Standard normal space
        
        let max_iter = 100;
        let tol = 1e-6;
        let mut converged = false;
        let mut iter = 0;
        
        for _ in 0..max_iter {
            iter += 1;
            
            // Transform to original space
            let x: Vec<f64> = self.variables.iter().zip(&u)
                .map(|(var, &ui)| var.from_standard_normal(ui))
                .collect();
            
            // Evaluate limit state and gradient
            let g = self.limit_state.evaluate(&x);
            let grad_x = self.limit_state.gradient(&x, 1e-6);
            
            // Transform gradient to standard normal space
            let grad_u: Vec<f64> = self.variables.iter().zip(&grad_x)
                .map(|(var, &dg)| dg * var.std_dev)
                .collect();
            
            // Gradient norm
            let grad_norm: f64 = grad_u.iter().map(|x| x * x).sum::<f64>().sqrt();
            
            if grad_norm < 1e-12 {
                break;
            }
            
            // Direction cosines (alpha)
            let alpha: Vec<f64> = grad_u.iter().map(|&x| -x / grad_norm).collect();
            
            // Update design point
            let beta = u.iter().map(|x| x * x).sum::<f64>().sqrt();
            let u_dot_alpha: f64 = u.iter().zip(&alpha).map(|(a, b)| a * b).sum();
            
            // Newton step
            let d_beta = (g / grad_norm) + beta - u_dot_alpha;
            let beta_new = beta + d_beta;
            
            let u_new: Vec<f64> = alpha.iter().map(|&a| beta_new * a).collect();
            
            // Check convergence
            let du: f64 = u_new.iter().zip(&u).map(|(a, b)| (a - b).powi(2)).sum::<f64>().sqrt();
            
            if du < tol && g.abs() < tol {
                converged = true;
                u = u_new;
                break;
            }
            
            u = u_new;
        }
        
        // Final results
        let beta = u.iter().map(|x| x * x).sum::<f64>().sqrt();
        let pf = 1.0 - Distribution::std_normal_cdf(beta);
        
        let design_point: Vec<f64> = self.variables.iter().zip(&u)
            .map(|(var, &ui)| var.from_standard_normal(ui))
            .collect();
        
        let grad_x = self.limit_state.gradient(&design_point, 1e-6);
        let grad_u: Vec<f64> = self.variables.iter().zip(&grad_x)
            .map(|(var, &dg)| dg * var.std_dev)
            .collect();
        let grad_norm: f64 = grad_u.iter().map(|x| x * x).sum::<f64>().sqrt();
        
        let alpha: Vec<f64> = grad_u.iter().map(|&x| -x / grad_norm.max(1e-12)).collect();
        let importance: Vec<f64> = alpha.iter().map(|&a| a * a).collect();
        
        self.results = Some(ReliabilityResults {
            beta,
            pf,
            design_point,
            design_point_std: u,
            alpha,
            importance,
            iterations: iter,
            converged,
        });
        
        self.results.as_ref().unwrap()
    }
    
    /// Run Monte Carlo simulation
    pub fn run_monte_carlo(&mut self, num_samples: usize) -> &ReliabilityResults {
        let n = self.variables.len();
        let mut failures = 0;
        
        // Simple LCG for reproducibility
        let mut seed: u64 = 12345;
        let lcg = |s: &mut u64| -> f64 {
            *s = s.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            (*s as f64) / (u64::MAX as f64)
        };
        
        // Box-Muller for normal samples
        let normal = |seed: &mut u64| -> f64 {
            let u1 = lcg(seed);
            let u2 = lcg(seed);
            (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos()
        };
        
        let mut sum_g = 0.0;
        let mut sum_g2 = 0.0;
        
        for _ in 0..num_samples {
            // Generate random values
            let x: Vec<f64> = self.variables.iter()
                .map(|var| var.from_standard_normal(normal(&mut seed)))
                .collect();
            
            let g = self.limit_state.evaluate(&x);
            
            if g <= 0.0 {
                failures += 1;
            }
            
            sum_g += g;
            sum_g2 += g * g;
        }
        
        let pf = failures as f64 / num_samples as f64;
        let beta = if pf > 0.0 && pf < 1.0 {
            -Distribution::std_normal_inv(pf)
        } else if pf == 0.0 {
            6.0 // Upper bound
        } else {
            0.0
        };
        
        // Mean values as design point approximation
        let design_point: Vec<f64> = self.variables.iter().map(|v| v.mean).collect();
        let design_point_std = vec![0.0; n];
        
        self.results = Some(ReliabilityResults {
            beta,
            pf,
            design_point,
            design_point_std,
            alpha: vec![0.0; n],
            importance: vec![0.0; n],
            iterations: num_samples,
            converged: true,
        });
        
        self.results.as_ref().unwrap()
    }
    
    /// Run analysis with configured method
    pub fn analyze(&mut self) -> &ReliabilityResults {
        match self.method {
            ReliabilityMethod::FORM => self.run_form(),
            ReliabilityMethod::MonteCarlo => self.run_monte_carlo(100000),
            ReliabilityMethod::SORM => self.run_form(), // Simplified to FORM
            ReliabilityMethod::ImportanceSampling => self.run_form(), // Simplified
        }
    }
}

/// System reliability analyzer
#[derive(Debug, Clone)]
pub struct SystemReliability {
    /// Component reliabilities
    pub components: Vec<ComponentReliability>,
    /// System type
    pub system_type: SystemType,
}

/// Component reliability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentReliability {
    /// Component name
    pub name: String,
    /// Reliability index
    pub beta: f64,
    /// Failure probability
    pub pf: f64,
}

/// System type
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SystemType {
    /// Series (weakest link)
    Series,
    /// Parallel (redundant)
    Parallel,
    /// Mixed (combination)
    Mixed(Vec<SystemType>),
}

impl SystemReliability {
    /// Create new system
    pub fn new(system_type: SystemType) -> Self {
        Self {
            components: Vec::new(),
            system_type,
        }
    }
    
    /// Add component
    pub fn add_component(&mut self, name: &str, beta: f64) {
        let pf = 1.0 - Distribution::std_normal_cdf(beta);
        self.components.push(ComponentReliability {
            name: name.to_string(),
            beta,
            pf,
        });
    }
    
    /// Calculate system probability of failure (independent components)
    pub fn system_pf(&self) -> f64 {
        match &self.system_type {
            SystemType::Series => {
                // Pf_sys = 1 - prod(1 - Pf_i) ≈ sum(Pf_i) for small Pf
                1.0 - self.components.iter()
                    .map(|c| 1.0 - c.pf)
                    .product::<f64>()
            }
            SystemType::Parallel => {
                // Pf_sys = prod(Pf_i)
                self.components.iter()
                    .map(|c| c.pf)
                    .product()
            }
            SystemType::Mixed(_) => {
                // Simplified: treat as series
                1.0 - self.components.iter()
                    .map(|c| 1.0 - c.pf)
                    .product::<f64>()
            }
        }
    }
    
    /// Calculate system reliability index
    pub fn system_beta(&self) -> f64 {
        let pf = self.system_pf();
        if pf > 0.0 && pf < 1.0 {
            -Distribution::std_normal_inv(pf)
        } else if pf <= 0.0 {
            6.0
        } else {
            0.0
        }
    }
}

/// Time-dependent reliability
#[derive(Debug, Clone)]
pub struct TimeDependentReliability {
    /// Initial reliability index
    pub beta_0: f64,
    /// Degradation model
    pub degradation: DegradationModel,
    /// Service life (years)
    pub service_life: f64,
}

/// Degradation model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DegradationModel {
    /// Model type
    pub model_type: DegradationType,
    /// Degradation rate
    pub rate: f64,
    /// Parameters
    pub parameters: Vec<f64>,
}

/// Degradation type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DegradationType {
    /// Linear degradation
    Linear,
    /// Square root (diffusion)
    SquareRoot,
    /// Power law
    PowerLaw,
    /// Exponential decay
    Exponential,
}

impl TimeDependentReliability {
    /// Create new time-dependent analysis
    pub fn new(beta_0: f64, degradation: DegradationModel, service_life: f64) -> Self {
        Self {
            beta_0,
            degradation,
            service_life,
        }
    }
    
    /// Calculate reliability index at time t
    pub fn beta_at_time(&self, t: f64) -> f64 {
        let reduction = match self.degradation.model_type {
            DegradationType::Linear => self.degradation.rate * t,
            DegradationType::SquareRoot => self.degradation.rate * t.sqrt(),
            DegradationType::PowerLaw => {
                let n = self.degradation.parameters.first().unwrap_or(&1.0);
                self.degradation.rate * t.powf(*n)
            }
            DegradationType::Exponential => {
                self.beta_0 * (1.0 - (-self.degradation.rate * t).exp())
            }
        };
        
        (self.beta_0 - reduction).max(0.0)
    }
    
    /// Calculate time to reach target reliability
    pub fn time_to_target(&self, beta_target: f64) -> Option<f64> {
        if beta_target >= self.beta_0 {
            return None;
        }
        
        let delta = self.beta_0 - beta_target;
        
        match self.degradation.model_type {
            DegradationType::Linear => Some(delta / self.degradation.rate),
            DegradationType::SquareRoot => Some((delta / self.degradation.rate).powi(2)),
            DegradationType::PowerLaw => {
                let n = self.degradation.parameters.first().unwrap_or(&1.0);
                Some((delta / self.degradation.rate).powf(1.0 / n))
            }
            DegradationType::Exponential => {
                let ratio = 1.0 - delta / self.beta_0;
                if ratio > 0.0 {
                    Some(-ratio.ln() / self.degradation.rate)
                } else {
                    None
                }
            }
        }
    }
    
    /// Generate reliability profile
    pub fn reliability_profile(&self, num_points: usize) -> Vec<(f64, f64, f64)> {
        let dt = self.service_life / (num_points - 1) as f64;
        
        (0..num_points)
            .map(|i| {
                let t = i as f64 * dt;
                let beta = self.beta_at_time(t);
                let pf = 1.0 - Distribution::std_normal_cdf(beta);
                (t, beta, pf)
            })
            .collect()
    }
}

/// Bayesian reliability updater
#[derive(Debug, Clone)]
pub struct BayesianUpdater {
    /// Prior distribution parameters
    pub prior: PriorDistribution,
    /// Observations
    pub observations: Vec<Observation>,
}

/// Prior distribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriorDistribution {
    /// Distribution type
    pub dist_type: PriorType,
    /// Parameter 1
    pub param1: f64,
    /// Parameter 2
    pub param2: f64,
}

/// Prior distribution type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum PriorType {
    /// Normal
    Normal,
    /// Beta (for probability)
    Beta,
    /// Gamma (for rate/precision)
    Gamma,
}

/// Observation data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Observation {
    /// Observation type
    pub obs_type: ObservationType,
    /// Value
    pub value: f64,
    /// Uncertainty (if applicable)
    pub uncertainty: Option<f64>,
}

/// Observation type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ObservationType {
    /// Direct measurement
    Measurement,
    /// Success/failure
    Binary,
    /// Count data
    Count,
}

impl BayesianUpdater {
    /// Create new updater
    pub fn new(prior: PriorDistribution) -> Self {
        Self {
            prior,
            observations: Vec::new(),
        }
    }
    
    /// Add observation
    pub fn add_observation(&mut self, obs: Observation) {
        self.observations.push(obs);
    }
    
    /// Update posterior for Normal-Normal conjugate
    pub fn update_normal(&self) -> (f64, f64) {
        let mu_0 = self.prior.param1;
        let sigma_0 = self.prior.param2;
        let tau_0 = 1.0 / (sigma_0 * sigma_0);
        
        let n = self.observations.len() as f64;
        if n == 0.0 {
            return (mu_0, sigma_0);
        }
        
        let sum: f64 = self.observations.iter()
            .filter(|o| o.obs_type == ObservationType::Measurement)
            .map(|o| o.value)
            .sum();
        let x_bar = sum / n;
        
        // Assume known measurement variance
        let sigma_m = self.observations.first()
            .and_then(|o| o.uncertainty)
            .unwrap_or(sigma_0);
        let tau_m = 1.0 / (sigma_m * sigma_m);
        
        // Posterior parameters
        let tau_n = tau_0 + n * tau_m;
        let mu_n = (tau_0 * mu_0 + n * tau_m * x_bar) / tau_n;
        let sigma_n = 1.0 / tau_n.sqrt();
        
        (mu_n, sigma_n)
    }
    
    /// Update posterior for Beta-Binomial conjugate
    pub fn update_beta(&self) -> (f64, f64) {
        let alpha_0 = self.prior.param1;
        let beta_0 = self.prior.param2;
        
        let successes = self.observations.iter()
            .filter(|o| o.obs_type == ObservationType::Binary && o.value > 0.5)
            .count() as f64;
        let failures = self.observations.iter()
            .filter(|o| o.obs_type == ObservationType::Binary && o.value <= 0.5)
            .count() as f64;
        
        let alpha_n = alpha_0 + successes;
        let beta_n = beta_0 + failures;
        
        (alpha_n, beta_n)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_random_variable_normal() {
        let var = RandomVariable::normal("X", 100.0, 10.0);
        assert_eq!(var.mean, 100.0);
        assert_eq!(var.std_dev, 10.0);
        assert!((var.cov() - 0.1).abs() < 1e-10);
    }
    
    #[test]
    fn test_random_variable_lognormal() {
        let var = RandomVariable::lognormal("Y", 100.0, 0.2);
        assert_eq!(var.mean, 100.0);
        assert!((var.cov() - 0.2).abs() < 1e-10);
    }
    
    #[test]
    fn test_std_normal_cdf() {
        let cdf_0 = Distribution::std_normal_cdf(0.0);
        assert!((cdf_0 - 0.5).abs() < 0.01);
        
        let cdf_2 = Distribution::std_normal_cdf(2.0);
        assert!((cdf_2 - 0.977).abs() < 0.01);
    }
    
    #[test]
    fn test_std_normal_inv() {
        let z = Distribution::std_normal_inv(0.5);
        assert!(z.abs() < 0.01);
        
        let z_95 = Distribution::std_normal_inv(0.95);
        assert!((z_95 - 1.645).abs() < 0.01);
    }
    
    #[test]
    fn test_transform_normal() {
        let var = RandomVariable::normal("X", 100.0, 10.0);
        
        let z = var.to_standard_normal(110.0);
        assert!((z - 1.0).abs() < 1e-10);
        
        let x = var.from_standard_normal(1.0);
        assert!((x - 110.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_limit_state_simple_rs() {
        let lsf = LimitStateFunction::simple_rs();
        
        let g = lsf.evaluate(&[100.0, 80.0]);
        assert!((g - 20.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_limit_state_linear() {
        let lsf = LimitStateFunction::linear(
            vec![10.0, 1.0, -1.0],
            vec!["R".to_string(), "S".to_string()],
        );
        
        let g = lsf.evaluate(&[100.0, 80.0]);
        // g = 10 + 1*100 + (-1)*80 = 30
        assert!((g - 30.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_gradient() {
        let lsf = LimitStateFunction::simple_rs();
        let grad = lsf.gradient(&[100.0, 80.0], 1e-6);
        
        assert!((grad[0] - 1.0).abs() < 1e-4);  // dg/dR = 1
        assert!((grad[1] - (-1.0)).abs() < 1e-4); // dg/dS = -1
    }
    
    #[test]
    fn test_form_analysis() {
        let lsf = LimitStateFunction::simple_rs();
        let mut analyzer = ReliabilityAnalyzer::new(lsf, ReliabilityMethod::FORM);
        
        analyzer.add_variable(RandomVariable::normal("R", 100.0, 10.0));
        analyzer.add_variable(RandomVariable::normal("S", 60.0, 8.0));
        
        let results = analyzer.run_form();
        
        // Analytical: beta = (100-60) / sqrt(10^2 + 8^2) ≈ 3.12
        assert!((results.beta - 3.12).abs() < 0.2);
        assert!(results.pf > 0.0 && results.pf < 0.01);
    }
    
    #[test]
    fn test_monte_carlo() {
        let lsf = LimitStateFunction::simple_rs();
        let mut analyzer = ReliabilityAnalyzer::new(lsf, ReliabilityMethod::MonteCarlo);
        
        analyzer.add_variable(RandomVariable::normal("R", 100.0, 10.0));
        analyzer.add_variable(RandomVariable::normal("S", 60.0, 8.0));
        
        let results = analyzer.run_monte_carlo(100000);
        
        // Should give similar results to FORM
        assert!(results.beta > 2.5 && results.beta < 4.0);
    }
    
    #[test]
    fn test_system_series() {
        let mut sys = SystemReliability::new(SystemType::Series);
        
        sys.add_component("A", 3.0);
        sys.add_component("B", 3.0);
        
        let pf = sys.system_pf();
        let beta = sys.system_beta();
        
        // Series: Pf ≈ Pf_A + Pf_B (for small Pf)
        assert!(pf > 0.001);
        assert!(beta < 3.0);
    }
    
    #[test]
    fn test_system_parallel() {
        let mut sys = SystemReliability::new(SystemType::Parallel);
        
        sys.add_component("A", 3.0);
        sys.add_component("B", 3.0);
        
        let pf = sys.system_pf();
        let beta = sys.system_beta();
        
        // Parallel: Pf = Pf_A * Pf_B (much smaller)
        assert!(pf < 0.001);
        assert!(beta > 3.0);
    }
    
    #[test]
    fn test_time_dependent_linear() {
        let degradation = DegradationModel {
            model_type: DegradationType::Linear,
            rate: 0.05, // 0.05 per year
            parameters: vec![],
        };
        
        let tdr = TimeDependentReliability::new(4.0, degradation, 50.0);
        
        let beta_0 = tdr.beta_at_time(0.0);
        let beta_50 = tdr.beta_at_time(50.0);
        
        assert!((beta_0 - 4.0).abs() < 1e-10);
        assert!((beta_50 - 1.5).abs() < 1e-10);
    }
    
    #[test]
    fn test_time_to_target() {
        let degradation = DegradationModel {
            model_type: DegradationType::Linear,
            rate: 0.1,
            parameters: vec![],
        };
        
        let tdr = TimeDependentReliability::new(4.0, degradation, 50.0);
        
        let t = tdr.time_to_target(2.0).unwrap();
        assert!((t - 20.0).abs() < 0.1);
    }
    
    #[test]
    fn test_reliability_profile() {
        let degradation = DegradationModel {
            model_type: DegradationType::Linear,
            rate: 0.05,
            parameters: vec![],
        };
        
        let tdr = TimeDependentReliability::new(4.0, degradation, 50.0);
        
        let profile = tdr.reliability_profile(11);
        assert_eq!(profile.len(), 11);
        
        // First point should be at t=0 with beta=4.0
        assert!((profile[0].0).abs() < 1e-10);
        assert!((profile[0].1 - 4.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_bayesian_normal() {
        let prior = PriorDistribution {
            dist_type: PriorType::Normal,
            param1: 100.0, // Mean
            param2: 10.0,  // Std dev
        };
        
        let mut updater = BayesianUpdater::new(prior);
        
        updater.add_observation(Observation {
            obs_type: ObservationType::Measurement,
            value: 105.0,
            uncertainty: Some(5.0),
        });
        
        let (mu_n, sigma_n) = updater.update_normal();
        
        // Posterior mean should be between prior and observation
        assert!(mu_n > 100.0 && mu_n < 105.0);
        // Posterior std should be smaller
        assert!(sigma_n < 10.0);
    }
    
    #[test]
    fn test_bayesian_beta() {
        let prior = PriorDistribution {
            dist_type: PriorType::Beta,
            param1: 1.0, // alpha
            param2: 1.0, // beta (uniform prior)
        };
        
        let mut updater = BayesianUpdater::new(prior);
        
        // 8 successes, 2 failures
        for _ in 0..8 {
            updater.add_observation(Observation {
                obs_type: ObservationType::Binary,
                value: 1.0,
                uncertainty: None,
            });
        }
        for _ in 0..2 {
            updater.add_observation(Observation {
                obs_type: ObservationType::Binary,
                value: 0.0,
                uncertainty: None,
            });
        }
        
        let (alpha, beta) = updater.update_beta();
        
        assert!((alpha - 9.0).abs() < 1e-10);
        assert!((beta - 3.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_distribution_types() {
        assert_ne!(Distribution::Normal, Distribution::Lognormal);
    }
    
    #[test]
    fn test_method_types() {
        assert_ne!(ReliabilityMethod::FORM, ReliabilityMethod::MonteCarlo);
    }
}
