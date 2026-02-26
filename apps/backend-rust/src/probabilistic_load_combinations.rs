//! Probabilistic Load Combinations Module
//!
//! Rational treatment of load combinations considering:
//! - Load coincidence (Turkstra's rule)
//! - Ferry-Borges/Castanheta model
//! - Point-in-time vs lifetime reliability
//! - Companion action factors (ψ factors)
//!
//! ## Standards
//! - EN 1990:2002 Annex A (Load combinations)
//! - IS 875 (Part 5) Load combinations
//! - ASCE 7-22 Chapter 2 (Combinations)
//! - JCSS Probabilistic Model Code (Load processes)

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;
use crate::special_functions::gamma as gamma_func;

// ============================================================================
// LOAD TYPES AND PROCESSES
// ============================================================================

/// Load type classification
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum LoadType {
    /// Permanent (dead) load
    Permanent,
    /// Variable (live) load
    Variable,
    /// Wind load
    Wind,
    /// Snow load
    Snow,
    /// Seismic load
    Seismic,
    /// Temperature load
    Temperature,
    /// Accidental load
    Accidental,
}

/// Load process model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadProcess {
    /// Load type
    pub load_type: LoadType,
    /// Mean value (characteristic value)
    pub mean: f64,
    /// Coefficient of variation
    pub cov: f64,
    /// Distribution type
    pub distribution: LoadDistribution,
    /// Renewal rate (events per year)
    pub renewal_rate: f64,
    /// Duration of each event (fraction of year)
    pub event_duration: f64,
    /// Point-in-time to lifetime factor
    pub phi_point_lifetime: f64,
}

/// Load distribution type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum LoadDistribution {
    Normal,
    Lognormal,
    Gumbel,
    Weibull,
    Gamma,
}

impl LoadProcess {
    /// Permanent load (JCSS values)
    pub fn permanent(mean: f64) -> Self {
        LoadProcess {
            load_type: LoadType::Permanent,
            mean,
            cov: 0.10,
            distribution: LoadDistribution::Normal,
            renewal_rate: 0.0,      // Constant
            event_duration: 1.0,     // Always present
            phi_point_lifetime: 1.0,
        }
    }

    /// Office/residential live load (JCSS values)
    pub fn live_office(mean: f64) -> Self {
        LoadProcess {
            load_type: LoadType::Variable,
            mean,
            cov: 0.20,
            distribution: LoadDistribution::Gamma,
            renewal_rate: 1.0,       // 1 renewal per year
            event_duration: 0.5,     // 50% of time
            phi_point_lifetime: 0.7, // EN 1990 ψ0
        }
    }

    /// Wind load (JCSS values)
    pub fn wind(mean: f64) -> Self {
        LoadProcess {
            load_type: LoadType::Wind,
            mean,
            cov: 0.30,
            distribution: LoadDistribution::Gumbel,
            renewal_rate: 50.0,      // ~50 storms per year
            event_duration: 0.001,   // ~8 hours / year total
            phi_point_lifetime: 0.6,
        }
    }

    /// Snow load
    pub fn snow(mean: f64) -> Self {
        LoadProcess {
            load_type: LoadType::Snow,
            mean,
            cov: 0.40,
            distribution: LoadDistribution::Gumbel,
            renewal_rate: 1.0,
            event_duration: 0.25,    // 3 months
            phi_point_lifetime: 0.5,
        }
    }

    /// Sample from distribution
    pub fn sample(&self, rng: &mut SimpleRng) -> f64 {
        let mu = self.mean;
        let sigma = self.mean * self.cov;

        match self.distribution {
            LoadDistribution::Normal => mu + sigma * rng.normal(),
            LoadDistribution::Lognormal => {
                let sigma_ln = (1.0 + self.cov.powi(2)).ln().sqrt();
                let mu_ln = mu.ln() - 0.5 * sigma_ln.powi(2);
                (mu_ln + sigma_ln * rng.normal()).exp()
            }
            LoadDistribution::Gumbel => {
                // Location and scale
                let beta = sigma * 6.0_f64.sqrt() / PI;
                let mu_gumbel = mu - 0.5772 * beta;
                mu_gumbel - beta * (-rng.uniform().ln()).ln()
            }
            LoadDistribution::Weibull => {
                // Shape k ≈ 1/cov for moderate cov
                let k = 1.0 / self.cov;
                let lambda = mu / gamma_func(1.0 + 1.0 / k);
                lambda * (-rng.uniform().ln()).powf(1.0 / k)
            }
            LoadDistribution::Gamma => {
                // Shape and rate
                let alpha = 1.0 / self.cov.powi(2);
                let beta_param = alpha / mu;
                sample_gamma(alpha, beta_param, rng)
            }
        }
    }

    /// Point-in-time probability of occurrence
    pub fn point_probability(&self) -> f64 {
        self.event_duration
    }

    /// Lifetime maximum distribution parameters
    pub fn lifetime_params(&self, years: f64) -> (f64, f64) {
        // Number of events in lifetime
        let n = (self.renewal_rate * years).max(1.0);

        match self.distribution {
            LoadDistribution::Gumbel => {
                // For Gumbel, max of n Gumbels is also Gumbel
                let sigma = self.mean * self.cov;
                let beta = sigma * 6.0_f64.sqrt() / PI;
                let mu_1 = self.mean - 0.5772 * beta;
                
                // Shift for n-year max
                let u_n = mu_1 + beta * n.ln();
                (u_n + 0.5772 * beta, sigma)  // Mean and std of n-year max
            }
            _ => {
                // Approximate using Type I extreme value
                let mu_max = self.mean + 0.5772 * self.mean * self.cov * n.ln().sqrt();
                let sigma_max = self.mean * self.cov * (PI / (6.0_f64.sqrt()));
                (mu_max, sigma_max)
            }
        }
    }
}

// ============================================================================
// TURKSTRA'S RULE
// ============================================================================

/// Turkstra's rule for load combination
/// Maximum of one load, others at arbitrary point-in-time values
#[derive(Debug, Clone)]
pub struct TurkstrasRule {
    loads: Vec<LoadProcess>,
    reference_period: f64,
}

impl TurkstrasRule {
    pub fn new(reference_period: f64) -> Self {
        TurkstrasRule {
            loads: Vec::new(),
            reference_period,
        }
    }

    pub fn add_load(&mut self, load: LoadProcess) {
        self.loads.push(load);
    }

    /// Compute combined load effect using Turkstra's rule
    /// Returns (mean, std, dominant_load_index)
    pub fn combine(&self) -> (f64, f64, usize) {
        if self.loads.is_empty() {
            return (0.0, 0.0, 0);
        }

        // Find dominant load (highest coefficient of variation or intermittency)
        let mut best_idx = 0;
        let mut best_ratio = 0.0;

        for (i, load) in self.loads.iter().enumerate() {
            let ratio = load.cov / load.point_probability().max(0.01);
            if ratio > best_ratio {
                best_ratio = ratio;
                best_idx = i;
            }
        }

        // Dominant load at lifetime max
        let (mu_max, sigma_max) = self.loads[best_idx].lifetime_params(self.reference_period);

        // Other loads at point-in-time
        let mut total_mean = mu_max;
        let mut total_var = sigma_max.powi(2);

        for (i, load) in self.loads.iter().enumerate() {
            if i != best_idx {
                // Companion load: arbitrary point in time
                let companion_mean = load.mean * load.phi_point_lifetime;
                let companion_var = (load.mean * load.cov * load.phi_point_lifetime).powi(2);
                
                total_mean += companion_mean;
                total_var += companion_var;
            }
        }

        (total_mean, total_var.sqrt(), best_idx)
    }

    /// Monte Carlo simulation of combined load
    pub fn monte_carlo(&self, n_samples: usize) -> Vec<f64> {
        let mut rng = SimpleRng::new(12345);
        let mut results = Vec::with_capacity(n_samples);

        for _ in 0..n_samples {
            // Determine which load is at its maximum (randomly weighted)
            let mut max_contrib = 0.0;
            let mut dominant_idx = 0;

            for (i, load) in self.loads.iter().enumerate() {
                // Probability of being dominant proportional to variability
                let contrib = load.cov / load.point_probability().max(0.01) * rng.uniform();
                if contrib > max_contrib {
                    max_contrib = contrib;
                    dominant_idx = i;
                }
            }

            // Sample loads
            let mut total = 0.0;
            for (i, load) in self.loads.iter().enumerate() {
                if i == dominant_idx {
                    // Lifetime max (sample from extreme value)
                    let (mu_n, sigma_n) = load.lifetime_params(self.reference_period);
                    let beta = sigma_n * 6.0_f64.sqrt() / PI;
                    let u = mu_n - 0.5772 * beta;
                    total += u - beta * (-rng.uniform().ln()).ln();
                } else {
                    // Point-in-time value (or zero if not present)
                    if rng.uniform() < load.point_probability() {
                        total += load.sample(&mut rng) * load.phi_point_lifetime;
                    }
                }
            }

            results.push(total);
        }

        results
    }
}

// ============================================================================
// FERRY-BORGES CASTANHETA MODEL
// ============================================================================

/// Ferry-Borges Castanheta load combination model
/// Rectangular pulse process with periodic renewals
#[derive(Debug, Clone)]
pub struct FerryBorgesCastanheta {
    loads: Vec<FBCLoad>,
    reference_period: f64,
}

/// FBC load definition
#[derive(Debug, Clone)]
pub struct FBCLoad {
    pub name: String,
    pub mean_intensity: f64,
    pub cov_intensity: f64,
    /// Number of load renewals in reference period
    pub n_renewals: u32,
    /// Duration as fraction of reference period
    pub duration_fraction: f64,
}

impl FerryBorgesCastanheta {
    pub fn new(reference_period: f64) -> Self {
        FerryBorgesCastanheta {
            loads: Vec::new(),
            reference_period,
        }
    }

    pub fn add_load(&mut self, load: FBCLoad) {
        self.loads.push(load);
    }

    /// Standard combination: G + Qmax + ψ·W
    pub fn standard_combination(&self, _gamma_g: f64, gamma_q: f64) -> Vec<(String, f64)> {
        let mut combinations = Vec::new();

        for (i, load_i) in self.loads.iter().enumerate() {
            // Load i is dominant
            let combo_name = format!("{}_max", load_i.name);
            let mut values = Vec::new();

            for (j, load_j) in self.loads.iter().enumerate() {
                if i == j {
                    // Maximum value
                    let mu_max = self.extreme_value_mean(load_j);
                    values.push((load_j.name.clone(), gamma_q * mu_max));
                } else {
                    // Companion value
                    let psi = self.companion_factor(load_j);
                    values.push((load_j.name.clone(), gamma_q * psi * load_j.mean_intensity));
                }
            }

            let total: f64 = values.iter().map(|(_, v)| v).sum();
            combinations.push((combo_name, total));
        }

        combinations
    }

    /// Extreme value mean for FBC process
    fn extreme_value_mean(&self, load: &FBCLoad) -> f64 {
        let n = load.n_renewals as f64;
        let sigma = load.mean_intensity * load.cov_intensity;
        
        // Gumbel approximation
        let u_n = load.mean_intensity + 0.5772 * sigma * (2.0 * n.ln()).sqrt();
        u_n
    }

    /// Companion action factor (ψ0 equivalent)
    fn companion_factor(&self, load: &FBCLoad) -> f64 {
        // Based on duration and renewal rate
        let rho = load.duration_fraction;
        
        // Approximate ψ0 = E[X] / E[Xmax]
        let mu_max = self.extreme_value_mean(load);
        if mu_max > 0.0 {
            (load.mean_intensity * rho) / mu_max
        } else {
            rho
        }
    }

    /// Monte Carlo simulation
    pub fn monte_carlo_combination(&self, n_samples: usize) -> Vec<f64> {
        let mut rng = SimpleRng::new(54321);
        let mut results = Vec::with_capacity(n_samples);

        // Time discretization
        let dt = 0.001;  // 0.1% of reference period
        let n_steps = (1.0 / dt) as usize;

        for _ in 0..n_samples {
            let mut max_total = 0.0;

            for step in 0..n_steps {
                let t = step as f64 * dt;
                let mut total = 0.0;

                for load in &self.loads {
                    // Check if load is active at this time
                    let period = 1.0 / (load.n_renewals as f64).max(1.0);
                    let active = (t % period) < (period * load.duration_fraction);

                    if active {
                        // Sample intensity
                        let intensity = load.mean_intensity 
                            * (1.0 + load.cov_intensity * rng.normal());
                        total += intensity.max(0.0);
                    }
                }

                if total > max_total {
                    max_total = total;
                }
            }

            results.push(max_total);
        }

        results
    }
}

// ============================================================================
// LOAD COMBINATION FACTORS (EN 1990)
// ============================================================================

/// EN 1990 combination factors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EN1990CombinationFactors {
    /// ψ0: Combination factor
    pub psi_0: f64,
    /// ψ1: Frequent value factor
    pub psi_1: f64,
    /// ψ2: Quasi-permanent value factor
    pub psi_2: f64,
}

impl EN1990CombinationFactors {
    /// Category A: Domestic/residential
    pub fn category_a() -> Self {
        EN1990CombinationFactors {
            psi_0: 0.7,
            psi_1: 0.5,
            psi_2: 0.3,
        }
    }

    /// Category B: Offices
    pub fn category_b() -> Self {
        EN1990CombinationFactors {
            psi_0: 0.7,
            psi_1: 0.5,
            psi_2: 0.3,
        }
    }

    /// Category C: Assembly areas
    pub fn category_c() -> Self {
        EN1990CombinationFactors {
            psi_0: 0.7,
            psi_1: 0.7,
            psi_2: 0.6,
        }
    }

    /// Wind loads
    pub fn wind() -> Self {
        EN1990CombinationFactors {
            psi_0: 0.6,
            psi_1: 0.2,
            psi_2: 0.0,
        }
    }

    /// Snow (altitude ≤ 1000m)
    pub fn snow_low() -> Self {
        EN1990CombinationFactors {
            psi_0: 0.5,
            psi_1: 0.2,
            psi_2: 0.0,
        }
    }

    /// Temperature
    pub fn temperature() -> Self {
        EN1990CombinationFactors {
            psi_0: 0.6,
            psi_1: 0.5,
            psi_2: 0.0,
        }
    }
}

// ============================================================================
// PROBABILISTIC COMBINATION (Full)
// ============================================================================

/// Full probabilistic load combination
#[derive(Debug)]
pub struct ProbabilisticCombination {
    permanent: Vec<LoadProcess>,
    variable: Vec<(LoadProcess, EN1990CombinationFactors)>,
    target_beta: f64,
    reference_period: f64,
}

impl ProbabilisticCombination {
    pub fn new(target_beta: f64, reference_period: f64) -> Self {
        ProbabilisticCombination {
            permanent: Vec::new(),
            variable: Vec::new(),
            target_beta,
            reference_period,
        }
    }

    pub fn add_permanent(&mut self, load: LoadProcess) {
        self.permanent.push(load);
    }

    pub fn add_variable(&mut self, load: LoadProcess, factors: EN1990CombinationFactors) {
        self.variable.push((load, factors));
    }

    /// Compute design load effect
    pub fn design_load_effect(&self, gamma_g: f64, gamma_q: f64) -> f64 {
        let mut total = 0.0;

        // Permanent loads
        for g in &self.permanent {
            total += gamma_g * g.mean;
        }

        // Variable loads - find dominant
        let mut max_var = 0.0;
        let mut max_idx = 0;

        for (i, (q, _)) in self.variable.iter().enumerate() {
            let (mu_max, _) = q.lifetime_params(self.reference_period);
            if mu_max > max_var {
                max_var = mu_max;
                max_idx = i;
            }
        }

        // Dominant variable load
        if !self.variable.is_empty() {
            let (ref q_dom, _) = self.variable[max_idx];
            let (mu_max, _) = q_dom.lifetime_params(self.reference_period);
            total += gamma_q * mu_max;

            // Companion loads
            for (i, (q, factors)) in self.variable.iter().enumerate() {
                if i != max_idx {
                    total += gamma_q * factors.psi_0 * q.mean;
                }
            }
        }

        total
    }

    /// Monte Carlo simulation of combined load
    pub fn monte_carlo(&self, n_samples: usize) -> LoadCombinationResult {
        let mut rng = SimpleRng::new(99999);
        let mut results = Vec::with_capacity(n_samples);

        for _ in 0..n_samples {
            let mut total = 0.0;

            // Permanent loads (always present)
            for g in &self.permanent {
                total += g.sample(&mut rng);
            }

            // Variable loads - determine which is dominant
            let mut max_q_idx = 0;
            let mut max_q_val = 0.0;

            for (i, (q, _)) in self.variable.iter().enumerate() {
                let val = q.sample(&mut rng);
                if val > max_q_val {
                    max_q_val = val;
                    max_q_idx = i;
                }
            }

            // Add variable loads
            for (i, (q, factors)) in self.variable.iter().enumerate() {
                if i == max_q_idx {
                    // Dominant: use lifetime max
                    let (mu_max, sigma_max) = q.lifetime_params(self.reference_period);
                    let beta = sigma_max * 6.0_f64.sqrt() / PI;
                    let u = mu_max - 0.5772 * beta;
                    total += u - beta * (-rng.uniform().ln()).ln();
                } else {
                    // Companion: point-in-time with ψ0
                    if rng.uniform() < q.point_probability() {
                        total += factors.psi_0 * q.sample(&mut rng);
                    }
                }
            }

            results.push(total);
        }

        // Statistics
        let mean = results.iter().sum::<f64>() / n_samples as f64;
        let variance = results.iter()
            .map(|&x| (x - mean).powi(2))
            .sum::<f64>() / (n_samples - 1) as f64;

        results.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let p_95 = results[(0.95 * n_samples as f64) as usize];
        let p_99 = results[(0.99 * n_samples as f64) as usize];

        LoadCombinationResult {
            mean,
            std: variance.sqrt(),
            p95: p_95,
            p99: p_99,
            samples: results,
        }
    }
}

/// Load combination Monte Carlo result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadCombinationResult {
    pub mean: f64,
    pub std: f64,
    pub p95: f64,
    pub p99: f64,
    pub samples: Vec<f64>,
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Simple RNG for Monte Carlo
pub struct SimpleRng {
    state: u64,
}

impl SimpleRng {
    pub fn new(seed: u64) -> Self {
        SimpleRng { state: seed }
    }

    fn next_u64(&mut self) -> u64 {
        self.state = self.state.wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        self.state
    }

    pub fn uniform(&mut self) -> f64 {
        (self.next_u64() as f64) / (u64::MAX as f64)
    }

    pub fn normal(&mut self) -> f64 {
        let u1 = self.uniform().max(1e-10);
        let u2 = self.uniform();
        (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos()
    }
}

fn sample_gamma(alpha: f64, beta: f64, rng: &mut SimpleRng) -> f64 {
    // Marsaglia and Tsang's method
    let d = alpha - 1.0 / 3.0;
    let c = 1.0 / (9.0 * d).sqrt();

    loop {
        let x = rng.normal();
        let v = (1.0 + c * x).powi(3);

        if v > 0.0 {
            let u = rng.uniform();
            if u < 1.0 - 0.0331 * x.powi(4) 
               || u.ln() < 0.5 * x.powi(2) + d * (1.0 - v + v.ln()) {
                return d * v / beta;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_turkstras_rule() {
        let mut combo = TurkstrasRule::new(50.0);
        
        combo.add_load(LoadProcess::permanent(10.0));
        combo.add_load(LoadProcess::live_office(3.0));
        combo.add_load(LoadProcess::wind(5.0));

        let (mean, std, dominant) = combo.combine();
        
        println!("Combined: mean = {:.2}, std = {:.2}, dominant = {}", mean, std, dominant);
        assert!(mean > 0.0);
    }

    #[test]
    fn test_fbc_model() {
        let mut fbc = FerryBorgesCastanheta::new(50.0);

        fbc.add_load(FBCLoad {
            name: "Live".to_string(),
            mean_intensity: 3.0,
            cov_intensity: 0.25,
            n_renewals: 50,
            duration_fraction: 0.5,
        });

        fbc.add_load(FBCLoad {
            name: "Wind".to_string(),
            mean_intensity: 5.0,
            cov_intensity: 0.35,
            n_renewals: 500,
            duration_fraction: 0.01,
        });

        let combos = fbc.standard_combination(1.35, 1.5);
        
        for (name, value) in &combos {
            println!("{}: {:.2}", name, value);
        }

        assert!(!combos.is_empty());
    }

    #[test]
    fn test_probabilistic_combination() {
        let mut combo = ProbabilisticCombination::new(3.8, 50.0);
        
        combo.add_permanent(LoadProcess::permanent(10.0));
        combo.add_variable(
            LoadProcess::live_office(3.0), 
            EN1990CombinationFactors::category_b()
        );
        combo.add_variable(
            LoadProcess::wind(5.0), 
            EN1990CombinationFactors::wind()
        );

        let result = combo.monte_carlo(10000);
        
        println!("Combined load: mean = {:.2}, std = {:.2}, P95 = {:.2}", 
                 result.mean, result.std, result.p95);
        
        assert!(result.mean > 0.0);
        assert!(result.p95 > result.mean);
    }
}
