//! Time-Variant Reliability Module
//!
//! Structural reliability that evolves over time due to deterioration,
//! fatigue, and environmental degradation processes.
//!
//! ## Standards
//! - ISO 13823:2008 General principles on the design of structures for durability
//! - fib Model Code 2010 (Chloride-induced corrosion)
//! - EN 1992-1-1 Concrete durability
//! - IS 456:2000 Durability requirements
//! - JCSS Probabilistic Model Code (Time-variant reliability)
//!
//! ## Models
//! - Chloride ingress (Fick's 2nd Law)
//! - Carbonation depth
//! - Corrosion initiation and propagation
//! - Fatigue damage accumulation (Miner's rule)
//! - PHI2 outcrossing rate

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;
use crate::special_functions::{erfc, standard_normal_cdf};

// ============================================================================
// ENVIRONMENTAL EXPOSURE CLASSES
// ============================================================================

/// Exposure class per EN 206 / IS 456
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ExposureClass {
    /// No risk of corrosion (dry environment)
    X0,
    /// Corrosion induced by carbonation - dry
    XC1,
    /// Corrosion induced by carbonation - wet, rarely dry
    XC2,
    /// Corrosion induced by carbonation - moderate humidity
    XC3,
    /// Corrosion induced by carbonation - cyclic wet/dry
    XC4,
    /// Corrosion induced by chlorides (not seawater)
    XD1,
    /// Corrosion induced by chlorides - wet, rarely dry
    XD2,
    /// Corrosion induced by chlorides - cyclic wet/dry
    XD3,
    /// Corrosion induced by seawater - airborne salt
    XS1,
    /// Corrosion induced by seawater - submerged
    XS2,
    /// Corrosion induced by seawater - tidal/splash
    XS3,
    /// IS 456 - Mild exposure
    Mild,
    /// IS 456 - Moderate exposure
    Moderate,
    /// IS 456 - Severe exposure
    Severe,
    /// IS 456 - Very severe exposure
    VerySevere,
    /// IS 456 - Extreme exposure
    Extreme,
}

impl ExposureClass {
    /// Typical surface chloride concentration (% by cement mass)
    pub fn surface_chloride(&self) -> f64 {
        match self {
            ExposureClass::X0 | ExposureClass::XC1 => 0.0,
            ExposureClass::XC2 | ExposureClass::XC3 | ExposureClass::XC4 => 0.1,
            ExposureClass::XD1 | ExposureClass::XD2 => 1.0,
            ExposureClass::XD3 => 2.0,
            ExposureClass::XS1 => 2.0,
            ExposureClass::XS2 => 4.0,
            ExposureClass::XS3 => 5.0,
            ExposureClass::Mild => 0.0,
            ExposureClass::Moderate => 0.5,
            ExposureClass::Severe => 2.0,
            ExposureClass::VerySevere => 4.0,
            ExposureClass::Extreme => 5.0,
        }
    }

    /// Minimum cover requirement per EN 1992-1-1 (mm)
    pub fn min_cover_eurocode(&self) -> f64 {
        match self {
            ExposureClass::X0 => 10.0,
            ExposureClass::XC1 => 15.0,
            ExposureClass::XC2 | ExposureClass::XC3 => 25.0,
            ExposureClass::XC4 => 30.0,
            ExposureClass::XD1 | ExposureClass::XS1 => 35.0,
            ExposureClass::XD2 | ExposureClass::XS2 => 40.0,
            ExposureClass::XD3 | ExposureClass::XS3 => 45.0,
            ExposureClass::Mild => 20.0,
            ExposureClass::Moderate => 30.0,
            ExposureClass::Severe => 45.0,
            ExposureClass::VerySevere => 50.0,
            ExposureClass::Extreme => 75.0,
        }
    }
}

// ============================================================================
// CHLORIDE INGRESS MODEL (Fick's 2nd Law)
// ============================================================================

/// Chloride ingress parameters per fib Model Code 2010
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChlorideIngressParams {
    /// Surface chloride concentration (% by cement mass)
    pub c_s: f64,
    /// Initial chloride content (% by cement mass)
    pub c_0: f64,
    /// Critical chloride threshold (% by cement mass)
    pub c_crit: f64,
    /// Apparent diffusion coefficient at reference time (m²/s)
    pub d_app_ref: f64,
    /// Reference time for diffusion coefficient (years)
    pub t_ref: f64,
    /// Age factor (n) for time-dependent diffusion
    pub age_factor: f64,
    /// Cover depth (m)
    pub cover: f64,
    /// Temperature (°C)
    pub temperature: f64,
}

impl Default for ChlorideIngressParams {
    fn default() -> Self {
        ChlorideIngressParams {
            c_s: 4.0,           // Marine splash zone
            c_0: 0.1,           // Typical initial content
            c_crit: 0.4,        // Probabilistic mean per JCSS
            d_app_ref: 5e-12,   // Good quality concrete
            t_ref: 0.0767,      // 28 days in years
            age_factor: 0.3,    // OPC concrete
            cover: 0.05,        // 50 mm
            temperature: 20.0,  // Reference temperature
        }
    }
}

/// Chloride ingress calculator
#[derive(Debug)]
pub struct ChlorideIngress {
    params: ChlorideIngressParams,
}

impl ChlorideIngress {
    pub fn new(params: ChlorideIngressParams) -> Self {
        ChlorideIngress { params }
    }

    /// Calculate chloride concentration at depth x and time t
    /// Using Fick's 2nd Law with time-dependent diffusion
    pub fn concentration(&self, x: f64, t_years: f64) -> f64 {
        if t_years <= 0.0 {
            return self.params.c_0;
        }

        let d_app = self.apparent_diffusion_coefficient(t_years);
        let z = x / (2.0 * (d_app * t_years * 365.25 * 24.0 * 3600.0).sqrt());

        self.params.c_0 + (self.params.c_s - self.params.c_0) * erfc(z)
    }

    /// Apparent diffusion coefficient at time t
    fn apparent_diffusion_coefficient(&self, t_years: f64) -> f64 {
        // Time-dependent diffusion per fib MC 2010
        let t_s = t_years.max(self.params.t_ref);
        
        self.params.d_app_ref * (self.params.t_ref / t_s).powf(self.params.age_factor)
    }

    /// Time to corrosion initiation (Tcr)
    pub fn time_to_initiation(&self) -> f64 {
        // Solve: C(cover, t) = C_crit using bisection
        let mut t_low = 0.1;
        let mut t_high = 1000.0;

        for _ in 0..100 {
            let t_mid = (t_low + t_high) / 2.0;
            let c = self.concentration(self.params.cover, t_mid);

            if (c - self.params.c_crit).abs() < 1e-6 {
                return t_mid;
            }

            if c < self.params.c_crit {
                t_low = t_mid;
            } else {
                t_high = t_mid;
            }
        }

        (t_low + t_high) / 2.0
    }

    /// Probability of corrosion initiation at time t
    pub fn probability_of_initiation(&self, t_years: f64, n_samples: usize) -> f64 {
        // Monte Carlo with random parameters
        let mut rng = SimpleRng::new(42);
        let mut count = 0;

        for _ in 0..n_samples {
            // Random C_crit (lognormal, mean=0.4, CoV=0.2)
            let c_crit = 0.4 * (0.2 * rng.normal()).exp();
            
            // Random cover (normal, CoV=0.1)
            let cover = self.params.cover * (1.0 + 0.1 * rng.normal());
            
            // Random D_app (lognormal, CoV=0.3)
            let d_factor = (0.3 * rng.normal()).exp();

            // Check initiation
            let d_app = self.apparent_diffusion_coefficient(t_years) * d_factor;
            let z = cover / (2.0 * (d_app * t_years * 365.25 * 24.0 * 3600.0).sqrt());
            let c = self.params.c_0 + (self.params.c_s - self.params.c_0) * erfc(z);

            if c >= c_crit {
                count += 1;
            }
        }

        count as f64 / n_samples as f64
    }
}

// ============================================================================
// CARBONATION MODEL
// ============================================================================

/// Carbonation depth parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CarbonationParams {
    /// Natural carbonation coefficient (mm/√year)
    pub k_nac: f64,
    /// Environmental factor (relative humidity effect)
    pub k_env: f64,
    /// Curing factor
    pub k_cure: f64,
    /// Execution factor
    pub k_exe: f64,
    /// Cover depth (mm)
    pub cover: f64,
}

impl Default for CarbonationParams {
    fn default() -> Self {
        CarbonationParams {
            k_nac: 4.0,   // Typical for 30 MPa concrete
            k_env: 1.0,   // Unsheltered outdoor
            k_cure: 1.0,  // Standard curing
            k_exe: 1.0,   // Normal execution
            cover: 35.0,  // 35 mm cover
        }
    }
}

/// Carbonation depth calculator
#[derive(Debug)]
pub struct Carbonation {
    params: CarbonationParams,
}

impl Carbonation {
    pub fn new(params: CarbonationParams) -> Self {
        Carbonation { params }
    }

    /// Carbonation depth at time t (mm)
    pub fn depth(&self, t_years: f64) -> f64 {
        let k = self.params.k_nac * self.params.k_env 
              * self.params.k_cure * self.params.k_exe;
        
        k * t_years.sqrt()
    }

    /// Time to depassivation (carbonation front reaches rebar)
    pub fn time_to_depassivation(&self) -> f64 {
        let k = self.params.k_nac * self.params.k_env 
              * self.params.k_cure * self.params.k_exe;
        
        (self.params.cover / k).powi(2)
    }

    /// Probability of depassivation at time t
    pub fn probability_of_depassivation(&self, t_years: f64, n_samples: usize) -> f64 {
        let mut rng = SimpleRng::new(42);
        let mut count = 0;

        for _ in 0..n_samples {
            // Random k_nac (normal, CoV=0.2)
            let k = self.params.k_nac * (1.0 + 0.2 * rng.normal())
                  * self.params.k_env * self.params.k_cure * self.params.k_exe;
            
            // Random cover (normal, CoV=0.15)
            let cover = self.params.cover * (1.0 + 0.15 * rng.normal());
            
            let depth = k * t_years.sqrt();

            if depth >= cover.max(0.0) {
                count += 1;
            }
        }

        count as f64 / n_samples as f64
    }
}

// ============================================================================
// CORROSION PROPAGATION MODEL
// ============================================================================

/// Corrosion propagation parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrosionPropagationParams {
    /// Initial bar diameter (mm)
    pub d_0: f64,
    /// Corrosion rate (μA/cm² or mm/year)
    pub i_corr: f64,
    /// Pitting factor
    pub r_pit: f64,
    /// Critical section loss ratio
    pub critical_loss: f64,
}

impl Default for CorrosionPropagationParams {
    fn default() -> Self {
        CorrosionPropagationParams {
            d_0: 16.0,
            i_corr: 1.0,      // 1 μA/cm² ≈ 0.0116 mm/year
            r_pit: 5.0,       // Pitting factor for localized corrosion
            critical_loss: 0.25, // 25% section loss
        }
    }
}

/// Corrosion propagation calculator
#[derive(Debug)]
pub struct CorrosionPropagation {
    params: CorrosionPropagationParams,
}

impl CorrosionPropagation {
    pub fn new(params: CorrosionPropagationParams) -> Self {
        CorrosionPropagation { params }
    }

    /// Bar diameter at time t after corrosion initiation (mm)
    pub fn remaining_diameter(&self, t_prop_years: f64) -> f64 {
        let corrosion_rate = 0.0116 * self.params.i_corr * self.params.r_pit;
        let d = self.params.d_0 - 2.0 * corrosion_rate * t_prop_years;
        d.max(0.0)
    }

    /// Section loss ratio at time t after initiation
    pub fn section_loss_ratio(&self, t_prop_years: f64) -> f64 {
        let d_t = self.remaining_diameter(t_prop_years);
        1.0 - (d_t / self.params.d_0).powi(2)
    }

    /// Yield strength reduction factor (empirical)
    pub fn strength_reduction(&self, t_prop_years: f64) -> f64 {
        let loss = self.section_loss_ratio(t_prop_years);
        // Empirical: strength reduces faster than area due to pitting
        (1.0 - 1.2 * loss).max(0.0)
    }

    /// Time from initiation to critical section loss
    pub fn time_to_failure(&self) -> f64 {
        let target_d = self.params.d_0 * (1.0 - self.params.critical_loss).sqrt();
        let corrosion_rate = 0.0116 * self.params.i_corr * self.params.r_pit;
        
        (self.params.d_0 - target_d) / (2.0 * corrosion_rate)
    }
}

// ============================================================================
// FATIGUE DAMAGE MODEL (Miner's Rule)
// ============================================================================

/// S-N curve parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SNParameters {
    /// Detail category (MPa) - EN 1993-1-9
    pub delta_sigma_c: f64,
    /// Slope m1 (above constant amplitude limit)
    pub m1: f64,
    /// Slope m2 (below constant amplitude limit)
    pub m2: f64,
    /// Constant amplitude fatigue limit (MPa)
    pub delta_sigma_d: f64,
    /// Cut-off limit (MPa)
    pub delta_sigma_l: f64,
}

impl SNParameters {
    /// Standard detail categories per EN 1993-1-9
    pub fn detail_category(cat: u32) -> Self {
        // Reference stress range at 2e6 cycles
        let delta_sigma_c = cat as f64;
        let delta_sigma_d = 0.737 * delta_sigma_c;  // At 5e6 cycles
        let delta_sigma_l = 0.549 * delta_sigma_c;  // At 1e8 cycles

        SNParameters {
            delta_sigma_c,
            m1: 3.0,
            m2: 5.0,
            delta_sigma_d,
            delta_sigma_l,
        }
    }

    /// Cycles to failure at given stress range
    pub fn cycles_to_failure(&self, delta_sigma: f64) -> f64 {
        if delta_sigma >= self.delta_sigma_d {
            // Region 1: slope m1
            2e6 * (self.delta_sigma_c / delta_sigma).powf(self.m1)
        } else if delta_sigma >= self.delta_sigma_l {
            // Region 2: slope m2
            5e6 * (self.delta_sigma_d / delta_sigma).powf(self.m2)
        } else {
            // Below cut-off: infinite life
            f64::INFINITY
        }
    }
}

/// Fatigue damage accumulator
#[derive(Debug)]
pub struct FatigueDamage {
    sn_params: SNParameters,
    /// Accumulated damage (D)
    damage: f64,
    /// Cycle count history
    history: Vec<(f64, usize)>,  // (stress_range, n_cycles)
}

impl FatigueDamage {
    pub fn new(sn_params: SNParameters) -> Self {
        FatigueDamage {
            sn_params,
            damage: 0.0,
            history: Vec::new(),
        }
    }

    /// Add cycles at given stress range
    pub fn add_cycles(&mut self, delta_sigma: f64, n_cycles: usize) {
        let n_f = self.sn_params.cycles_to_failure(delta_sigma);
        
        if n_f.is_finite() {
            self.damage += n_cycles as f64 / n_f;
            self.history.push((delta_sigma, n_cycles));
        }
    }

    /// Add cycles from rainflow counting result
    pub fn add_rainflow_result(&mut self, bins: &[(f64, usize)]) {
        for &(delta_sigma, n_cycles) in bins {
            self.add_cycles(delta_sigma, n_cycles);
        }
    }

    /// Current accumulated damage (should be < 1.0 for safe)
    pub fn accumulated_damage(&self) -> f64 {
        self.damage
    }

    /// Remaining life fraction
    pub fn remaining_life_fraction(&self) -> f64 {
        (1.0 - self.damage).max(0.0)
    }

    /// Estimated cycles to failure at given stress range
    pub fn remaining_cycles(&self, delta_sigma: f64) -> f64 {
        let n_f = self.sn_params.cycles_to_failure(delta_sigma);
        n_f * (1.0 - self.damage).max(0.0)
    }
}

// ============================================================================
// TIME-VARIANT RELIABILITY (β(t))
// ============================================================================

/// Time-variant reliability parameters
#[derive(Debug, Clone)]
pub struct TimeVariantReliabilityParams {
    /// Initial resistance mean
    pub r_0_mean: f64,
    /// Initial resistance CoV
    pub r_0_cov: f64,
    /// Load effect mean
    pub s_mean: f64,
    /// Load effect CoV
    pub s_cov: f64,
    /// Degradation model
    pub degradation: DegradationModel,
}

/// Degradation model type
#[derive(Debug, Clone)]
pub enum DegradationModel {
    /// R(t) = R_0 * (1 - α*t)
    Linear { alpha: f64 },
    /// R(t) = R_0 * exp(-λ*t)
    Exponential { lambda: f64 },
    /// R(t) = R_0 * (1 - (t/t_life)^β)
    Power { t_life: f64, beta: f64 },
    /// From corrosion model
    Corrosion { initiation_time: f64, propagation_rate: f64 },
    /// No degradation
    None,
}

/// Time-variant reliability calculator
#[derive(Debug)]
pub struct TimeVariantReliability {
    params: TimeVariantReliabilityParams,
}

impl TimeVariantReliability {
    pub fn new(params: TimeVariantReliabilityParams) -> Self {
        TimeVariantReliability { params }
    }

    /// Mean resistance at time t
    pub fn resistance_mean(&self, t: f64) -> f64 {
        let degradation_factor = self.degradation_factor(t);
        self.params.r_0_mean * degradation_factor
    }

    fn degradation_factor(&self, t: f64) -> f64 {
        match &self.params.degradation {
            DegradationModel::Linear { alpha } => (1.0 - alpha * t).max(0.0),
            DegradationModel::Exponential { lambda } => (-lambda * t).exp(),
            DegradationModel::Power { t_life, beta } => {
                (1.0 - (t / t_life).powf(*beta)).max(0.0)
            }
            DegradationModel::Corrosion { initiation_time, propagation_rate } => {
                if t <= *initiation_time {
                    1.0
                } else {
                    let t_prop = t - initiation_time;
                    (1.0 - propagation_rate * t_prop).max(0.0)
                }
            }
            DegradationModel::None => 1.0,
        }
    }

    /// Reliability index at time t (assuming normal distributions)
    pub fn reliability_index(&self, t: f64) -> f64 {
        let r_mean = self.resistance_mean(t);
        let r_std = self.params.r_0_mean * self.params.r_0_cov * self.degradation_factor(t);
        let s_mean = self.params.s_mean;
        let s_std = self.params.s_mean * self.params.s_cov;

        // β = (μR - μS) / √(σR² + σS²)
        (r_mean - s_mean) / (r_std.powi(2) + s_std.powi(2)).sqrt()
    }

    /// Probability of failure at time t
    pub fn failure_probability(&self, t: f64) -> f64 {
        let beta = self.reliability_index(t);
        standard_normal_cdf(-beta)
    }

    /// Time to target reliability (inverse)
    pub fn time_to_target_beta(&self, beta_target: f64) -> f64 {
        // Bisection search
        let mut t_low = 0.0;
        let mut t_high = 1000.0;

        for _ in 0..100 {
            let t_mid = (t_low + t_high) / 2.0;
            let beta = self.reliability_index(t_mid);

            if (beta - beta_target).abs() < 0.001 {
                return t_mid;
            }

            if beta > beta_target {
                t_low = t_mid;
            } else {
                t_high = t_mid;
            }
        }

        (t_low + t_high) / 2.0
    }

    /// Cumulative failure probability up to time T (first-passage)
    pub fn cumulative_failure_probability(&self, t_final: f64, dt: f64) -> f64 {
        // Using PHI2 outcrossing rate approximation
        let mut p_survival = 1.0;
        let mut t = 0.0;

        while t < t_final {
            let pf = self.failure_probability(t);
            p_survival *= 1.0 - pf.min(1.0);
            t += dt;
        }

        1.0 - p_survival
    }

    /// Full lifecycle reliability profile
    pub fn lifecycle_profile(&self, t_max: f64, n_points: usize) -> Vec<(f64, f64, f64)> {
        let dt = t_max / n_points as f64;
        
        (0..=n_points)
            .map(|i| {
                let t = i as f64 * dt;
                let beta = self.reliability_index(t);
                let pf = self.failure_probability(t);
                (t, beta, pf)
            })
            .collect()
    }
}

// ============================================================================
// SERVICE LIFE PREDICTION (fib Model Code 2010)
// ============================================================================

/// Service life prediction per fib MC 2010
#[derive(Debug)]
pub struct ServiceLifePredictor {
    /// Chloride ingress model
    chloride: Option<ChlorideIngress>,
    /// Carbonation model
    carbonation: Option<Carbonation>,
    /// Corrosion propagation model
    propagation: Option<CorrosionPropagation>,
    /// Target reliability index
    beta_target: f64,
}

impl ServiceLifePredictor {
    pub fn new() -> Self {
        ServiceLifePredictor {
            chloride: None,
            carbonation: None,
            propagation: None,
            beta_target: 1.5,  // SLS target per EN 1990
        }
    }

    pub fn with_chloride(mut self, params: ChlorideIngressParams) -> Self {
        self.chloride = Some(ChlorideIngress::new(params));
        self
    }

    pub fn with_carbonation(mut self, params: CarbonationParams) -> Self {
        self.carbonation = Some(Carbonation::new(params));
        self
    }

    pub fn with_propagation(mut self, params: CorrosionPropagationParams) -> Self {
        self.propagation = Some(CorrosionPropagation::new(params));
        self
    }

    pub fn with_target_beta(mut self, beta: f64) -> Self {
        self.beta_target = beta;
        self
    }

    /// Predict service life
    pub fn predict_service_life(&self, _n_samples: usize) -> ServiceLifePrediction {
        let mut t_init = None;
        let mut t_prop = None;

        // Initiation phase
        if let Some(ref chloride) = self.chloride {
            t_init = Some(chloride.time_to_initiation());
        } else if let Some(ref carb) = self.carbonation {
            t_init = Some(carb.time_to_depassivation());
        }

        // Propagation phase
        if let Some(ref prop) = self.propagation {
            t_prop = Some(prop.time_to_failure());
        }

        let t_total = match (t_init, t_prop) {
            (Some(ti), Some(tp)) => ti + tp,
            (Some(ti), None) => ti,
            (None, Some(tp)) => tp,
            (None, None) => f64::INFINITY,
        };

        ServiceLifePrediction {
            initiation_time: t_init,
            propagation_time: t_prop,
            total_service_life: t_total,
            target_beta: self.beta_target,
        }
    }
}

impl Default for ServiceLifePredictor {
    fn default() -> Self {
        Self::new()
    }
}

/// Service life prediction result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceLifePrediction {
    pub initiation_time: Option<f64>,
    pub propagation_time: Option<f64>,
    pub total_service_life: f64,
    pub target_beta: f64,
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Simple RNG for Monte Carlo
struct SimpleRng {
    state: u64,
}

impl SimpleRng {
    fn new(seed: u64) -> Self {
        SimpleRng { state: seed }
    }

    fn next_u64(&mut self) -> u64 {
        self.state = self.state.wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        self.state
    }

    fn uniform(&mut self) -> f64 {
        (self.next_u64() as f64) / (u64::MAX as f64)
    }

    fn normal(&mut self) -> f64 {
        // Box-Muller transform
        let u1 = self.uniform().max(1e-10);
        let u2 = self.uniform();
        (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chloride_ingress() {
        let params = ChlorideIngressParams::default();
        let chloride = ChlorideIngress::new(params);

        // Concentration should increase with time
        let c_10 = chloride.concentration(0.03, 10.0);
        let c_50 = chloride.concentration(0.03, 50.0);
        assert!(c_50 > c_10);

        // Time to initiation should be positive
        let t_init = chloride.time_to_initiation();
        assert!(t_init > 0.0);
    }

    #[test]
    fn test_fatigue_damage() {
        let sn = SNParameters::detail_category(80);
        let mut fatigue = FatigueDamage::new(sn);

        // Add cycles
        fatigue.add_cycles(100.0, 100000);
        fatigue.add_cycles(80.0, 500000);

        // Damage should accumulate
        assert!(fatigue.accumulated_damage() > 0.0);
        assert!(fatigue.remaining_life_fraction() < 1.0);
    }

    #[test]
    fn test_time_variant_reliability() {
        let params = TimeVariantReliabilityParams {
            r_0_mean: 100.0,
            r_0_cov: 0.1,
            s_mean: 50.0,
            s_cov: 0.2,
            degradation: DegradationModel::Linear { alpha: 0.01 },
        };

        let tvr = TimeVariantReliability::new(params);

        // Beta should decrease with time
        let beta_0 = tvr.reliability_index(0.0);
        let beta_50 = tvr.reliability_index(50.0);
        assert!(beta_50 < beta_0);
    }
}
