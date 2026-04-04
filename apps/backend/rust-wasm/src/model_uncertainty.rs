//! Model Uncertainty Quantification Module
//!
//! Systematic treatment of epistemic uncertainties from modeling approximations.
//! Essential for realistic reliability assessment per JCSS Probabilistic Model Code.
//!
//! ## Uncertainty Sources
//! - **Model Uncertainty (θ)** - FEM vs reality discrepancy
//! - **Discretization Error** - Mesh refinement sensitivity
//! - **Material Model Uncertainty** - Constitutive law approximations
//! - **Geometric Imperfections** - Deviations from nominal geometry
//!
//! ## Standards
//! - JCSS Probabilistic Model Code (2001)
//! - ISO 2394:2015 General Principles on Reliability
//! - fib Model Code 2010 for Concrete Structures
//! - EN 1990 Annex D - Design assisted by testing

use serde::{Deserialize, Serialize};


fn standard_normal_inverse(p: f64) -> f64 {
    2.0_f64.sqrt() * crate::special_functions::erfinv(2.0 * p - 1.0)
}

// ============================================================================
// MODEL UNCERTAINTY FACTOR
// ============================================================================

/// Model uncertainty factor θ for structural models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelUncertaintyFactor {
    /// Description
    pub name: String,
    /// Mean value E[θ]
    pub mean: f64,
    /// Coefficient of variation V[θ]
    pub cov: f64,
    /// Distribution type
    pub distribution: UncertaintyDistribution,
    /// Bias type
    pub bias_type: BiasType,
}

/// Distribution for uncertainty factors
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum UncertaintyDistribution {
    Normal,
    Lognormal,
    Uniform,
}

/// Type of model bias
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum BiasType {
    /// θ > 1 means model underestimates (conservative)
    Resistance,
    /// θ > 1 means model overestimates (unconservative)
    Load,
}

impl ModelUncertaintyFactor {
    /// Create standard model uncertainty for resistance
    pub fn resistance(name: &str, mean: f64, cov: f64) -> Self {
        ModelUncertaintyFactor {
            name: name.to_string(),
            mean,
            cov,
            distribution: UncertaintyDistribution::Lognormal,
            bias_type: BiasType::Resistance,
        }
    }

    /// Create standard model uncertainty for load effect
    pub fn load_effect(name: &str, mean: f64, cov: f64) -> Self {
        ModelUncertaintyFactor {
            name: name.to_string(),
            mean,
            cov,
            distribution: UncertaintyDistribution::Normal,
            bias_type: BiasType::Load,
        }
    }

    /// Standard deviation
    pub fn std_dev(&self) -> f64 {
        self.mean * self.cov
    }

    /// Sample from distribution
    pub fn sample(&self, u: f64) -> f64 {
        match self.distribution {
            UncertaintyDistribution::Normal => {
                self.mean + self.std_dev() * standard_normal_inverse(u)
            }
            UncertaintyDistribution::Lognormal => {
                let sigma = (1.0 + self.cov * self.cov).ln().sqrt();
                let mu = self.mean.ln() - 0.5 * sigma * sigma;
                (mu + sigma * standard_normal_inverse(u)).exp()
            }
            UncertaintyDistribution::Uniform => {
                let half_width = self.std_dev() * 3.0_f64.sqrt();
                self.mean + half_width * (2.0 * u - 1.0)
            }
        }
    }

    /// Characteristic value (5% or 95% fractile)
    pub fn characteristic_value(&self, fractile: f64) -> f64 {
        self.sample(fractile)
    }
}

// ============================================================================
// JCSS MODEL UNCERTAINTY DATABASE
// ============================================================================

/// JCSS Probabilistic Model Code recommended values
#[derive(Debug, Clone)]
pub struct JCSSModelUncertainty;

impl JCSSModelUncertainty {
    // ========== RESISTANCE MODELS ==========

    /// Steel tension member capacity
    pub fn steel_tension() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::resistance("Steel tension capacity", 1.00, 0.05)
    }

    /// Steel compression member (buckling)
    pub fn steel_compression_buckling() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::resistance("Steel compression buckling", 1.00, 0.10)
    }

    /// Steel bending capacity
    pub fn steel_bending() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::resistance("Steel bending capacity", 1.00, 0.05)
    }

    /// Steel lateral-torsional buckling
    pub fn steel_ltb() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::resistance("Steel LTB capacity", 1.00, 0.10)
    }

    /// Steel connection - bolted shear
    pub fn steel_bolt_shear() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::resistance("Bolted connection shear", 1.00, 0.08)
    }

    /// Steel connection - welded
    pub fn steel_weld() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::resistance("Welded connection", 1.00, 0.15)
    }

    /// RC flexural capacity
    pub fn rc_flexure() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::resistance("RC flexural capacity", 1.02, 0.06)
    }

    /// RC shear capacity (without stirrups)
    pub fn rc_shear_no_stirrups() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::resistance("RC shear (no stirrups)", 1.40, 0.25)
    }

    /// RC shear capacity (with stirrups)
    pub fn rc_shear_with_stirrups() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::resistance("RC shear (with stirrups)", 1.10, 0.15)
    }

    /// RC column capacity (combined loading)
    pub fn rc_column() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::resistance("RC column capacity", 1.05, 0.10)
    }

    /// Timber member capacity
    pub fn timber_member() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::resistance("Timber member capacity", 1.00, 0.10)
    }

    /// Masonry compression
    pub fn masonry_compression() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::resistance("Masonry compression", 1.00, 0.15)
    }

    /// Foundation bearing capacity
    pub fn foundation_bearing() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::resistance("Foundation bearing capacity", 1.00, 0.30)
    }

    /// Pile capacity
    pub fn pile_capacity() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::resistance("Pile capacity", 1.00, 0.25)
    }

    // ========== LOAD EFFECT MODELS ==========

    /// FEM linear elastic analysis
    pub fn fem_linear_elastic() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::load_effect("FEM linear elastic", 1.00, 0.05)
    }

    /// FEM geometric nonlinear analysis
    pub fn fem_geometric_nonlinear() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::load_effect("FEM geometric nonlinear", 1.00, 0.08)
    }

    /// FEM material nonlinear analysis
    pub fn fem_material_nonlinear() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::load_effect("FEM material nonlinear", 1.00, 0.10)
    }

    /// Dynamic analysis (response spectrum)
    pub fn dynamic_response_spectrum() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::load_effect("Response spectrum analysis", 1.00, 0.15)
    }

    /// Wind load model
    pub fn wind_load() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::load_effect("Wind load model", 1.00, 0.10)
    }

    /// Seismic load model
    pub fn seismic_load() -> ModelUncertaintyFactor {
        ModelUncertaintyFactor::load_effect("Seismic load model", 1.00, 0.20)
    }
}

// ============================================================================
// DISCRETIZATION ERROR ESTIMATION
// ============================================================================

/// Mesh refinement error estimation
#[derive(Debug, Clone)]
pub struct DiscretizationError {
    /// Results at different mesh levels
    pub mesh_results: Vec<MeshResult>,
    /// Estimated converged value
    pub extrapolated_value: f64,
    /// Estimated error in finest mesh
    pub estimated_error: f64,
    /// Convergence rate
    pub convergence_rate: f64,
    /// Grid Convergence Index (GCI)
    pub gci: f64,
}

#[derive(Debug, Clone)]
pub struct MeshResult {
    /// Characteristic mesh size (h)
    pub mesh_size: f64,
    /// Number of elements
    pub n_elements: usize,
    /// Result value (e.g., displacement, stress)
    pub value: f64,
}

impl DiscretizationError {
    pub fn new() -> Self {
        DiscretizationError {
            mesh_results: Vec::new(),
            extrapolated_value: 0.0,
            estimated_error: 0.0,
            convergence_rate: 2.0,
            gci: 0.0,
        }
    }

    /// Add mesh refinement result
    pub fn add_result(&mut self, mesh_size: f64, n_elements: usize, value: f64) {
        self.mesh_results.push(MeshResult {
            mesh_size,
            n_elements,
            value,
        });
    }

    /// Compute Richardson extrapolation and GCI
    pub fn compute_gci(&mut self) {
        if self.mesh_results.len() < 3 {
            return;
        }

        // Sort by mesh size (coarse to fine)
        self.mesh_results.sort_by(|a, b| {
            b.mesh_size.partial_cmp(&a.mesh_size).unwrap_or(std::cmp::Ordering::Equal)
        });

        let h1 = self.mesh_results[2].mesh_size;  // Finest
        let h2 = self.mesh_results[1].mesh_size;
        let h3 = self.mesh_results[0].mesh_size;  // Coarsest

        let f1 = self.mesh_results[2].value;
        let f2 = self.mesh_results[1].value;
        let f3 = self.mesh_results[0].value;

        let r21 = h2 / h1;
        let r32 = h3 / h2;

        // Estimate convergence rate p
        let eps21 = f2 - f1;
        let eps32 = f3 - f2;

        if eps21.abs() < 1e-14 || eps32.abs() < 1e-14 {
            self.convergence_rate = 2.0;
        } else {
            // Iterative solution for p
            let mut p = 2.0;
            for _ in 0..20 {
                let s = if eps21 * eps32 > 0.0 { 1.0 } else { -1.0 };
                let p_new = (1.0 / r21.ln()) * ((eps32 / eps21).abs().ln() 
                    + (r21.powf(p) - s) / (r32.powf(p) - s)).ln().abs();
                if (p_new - p).abs() < 0.01 {
                    break;
                }
                p = p_new.max(0.5).min(5.0);
            }
            self.convergence_rate = p;
        }

        // Richardson extrapolation
        let r = r21;
        let p = self.convergence_rate;
        self.extrapolated_value = (r.powf(p) * f1 - f2) / (r.powf(p) - 1.0);

        // Estimated error in finest mesh
        self.estimated_error = (f1 - self.extrapolated_value).abs();

        // Grid Convergence Index (Roache)
        // GCI = Fs * |ε| / (r^p - 1)
        let fs = 1.25;  // Safety factor for 3 grids
        self.gci = fs * eps21.abs() / (r.powf(p) - 1.0);
    }

    /// Get uncertainty factor from discretization error
    pub fn uncertainty_factor(&self) -> ModelUncertaintyFactor {
        let cov = if self.extrapolated_value.abs() > 1e-14 {
            self.gci / self.extrapolated_value.abs()
        } else {
            0.05
        };

        ModelUncertaintyFactor {
            name: "FEM discretization".to_string(),
            mean: 1.0,
            cov: cov.min(0.20),  // Cap at 20%
            distribution: UncertaintyDistribution::Normal,
            bias_type: BiasType::Load,
        }
    }
}

impl Default for DiscretizationError {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// GEOMETRIC IMPERFECTION MODELS
// ============================================================================

/// Geometric imperfection characterization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeometricImperfection {
    /// Imperfection type
    pub imperfection_type: ImperfectionType,
    /// Amplitude statistics (as fraction of reference dimension)
    pub amplitude_mean: f64,
    pub amplitude_cov: f64,
    /// Code tolerance limit
    pub tolerance_limit: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ImperfectionType {
    /// Column out-of-straightness
    ColumnBow,
    /// Beam out-of-straightness
    BeamBow,
    /// Frame sway imperfection
    FrameSway,
    /// Plate local imperfection
    PlateLocal,
    /// Shell imperfection
    ShellImperfection,
}

impl GeometricImperfection {
    /// Column out-of-straightness per AISC/Eurocode
    pub fn column_bow() -> Self {
        GeometricImperfection {
            imperfection_type: ImperfectionType::ColumnBow,
            amplitude_mean: 0.0005,  // L/2000 mean
            amplitude_cov: 0.50,
            tolerance_limit: 0.001,  // L/1000 limit
        }
    }

    /// Frame sway imperfection
    pub fn frame_sway(n_columns: usize) -> Self {
        // φ0 = 1/200 * √(0.5 + 1/m) * √(2/√n)
        let alpha_m = (0.5 + 1.0 / (n_columns as f64).max(1.0)).sqrt();
        let base = 1.0 / 200.0 * alpha_m;

        GeometricImperfection {
            imperfection_type: ImperfectionType::FrameSway,
            amplitude_mean: base,
            amplitude_cov: 0.30,
            tolerance_limit: 1.0 / 300.0,
        }
    }

    /// Shell imperfection per EN 1993-1-6
    pub fn shell_imperfection(quality_class: char) -> Self {
        let (mean, limit) = match quality_class {
            'A' => (0.006, 0.010),   // Class A - Excellent
            'B' => (0.010, 0.016),   // Class B - High
            'C' => (0.016, 0.025),   // Class C - Normal
            _ => (0.016, 0.025),
        };

        GeometricImperfection {
            imperfection_type: ImperfectionType::ShellImperfection,
            amplitude_mean: mean,
            amplitude_cov: 0.40,
            tolerance_limit: limit,
        }
    }

    /// Get imperfection amplitude for reliability analysis
    pub fn sample_amplitude(&self, u: f64) -> f64 {
        let sigma = self.amplitude_mean * self.amplitude_cov;
        let z = standard_normal_inverse(u);
        (self.amplitude_mean + sigma * z).max(0.0).min(self.tolerance_limit)
    }

    /// Uncertainty factor for imperfection-sensitive analysis
    pub fn knockdown_factor(&self) -> ModelUncertaintyFactor {
        ModelUncertaintyFactor {
            name: format!("{:?} imperfection", self.imperfection_type),
            mean: 1.0,
            cov: self.amplitude_cov * 0.5,  // Reduced COV for knockdown
            distribution: UncertaintyDistribution::Lognormal,
            bias_type: BiasType::Resistance,
        }
    }
}

// ============================================================================
// BAYESIAN UPDATING OF MODEL UNCERTAINTY
// ============================================================================

/// Bayesian updating of model uncertainty from test data
#[derive(Debug, Clone)]
pub struct BayesianModelUpdate {
    /// Prior model uncertainty
    pub prior: ModelUncertaintyFactor,
    /// Test data (predicted/measured ratios)
    pub test_data: Vec<f64>,
    /// Posterior mean
    pub posterior_mean: f64,
    /// Posterior COV
    pub posterior_cov: f64,
    /// Measurement error COV
    pub measurement_cov: f64,
}

impl BayesianModelUpdate {
    pub fn new(prior: ModelUncertaintyFactor, measurement_cov: f64) -> Self {
        BayesianModelUpdate {
            prior: prior.clone(),
            test_data: Vec::new(),
            posterior_mean: prior.mean,
            posterior_cov: prior.cov,
            measurement_cov,
        }
    }

    /// Add test observation (ratio of predicted/actual)
    pub fn add_observation(&mut self, ratio: f64) {
        self.test_data.push(ratio);
    }

    /// Perform Bayesian update
    pub fn update(&mut self) {
        if self.test_data.is_empty() {
            return;
        }

        let n = self.test_data.len() as f64;

        // Sample mean and variance of test data
        let x_bar: f64 = self.test_data.iter().sum::<f64>() / n;
        let s2: f64 = if n > 1.0 {
            self.test_data.iter()
                .map(|&x| (x - x_bar).powi(2))
                .sum::<f64>() / (n - 1.0)
        } else {
            self.prior.std_dev().powi(2)
        };

        // Prior variance
        let tau_prior = self.prior.std_dev().powi(2);

        // Likelihood variance (including measurement error)
        let tau_likelihood = s2 + (self.measurement_cov * x_bar).powi(2);

        // Posterior (conjugate normal-normal update)
        let tau_posterior = 1.0 / (1.0 / tau_prior + n / tau_likelihood);

        self.posterior_mean = tau_posterior * (self.prior.mean / tau_prior + n * x_bar / tau_likelihood);
        self.posterior_cov = tau_posterior.sqrt() / self.posterior_mean.abs().max(1e-10);

        // Bound posterior COV
        self.posterior_cov = self.posterior_cov.max(0.02).min(0.50);
    }

    /// Get updated model uncertainty factor
    pub fn posterior_factor(&self) -> ModelUncertaintyFactor {
        ModelUncertaintyFactor {
            name: format!("{} (updated)", self.prior.name),
            mean: self.posterior_mean,
            cov: self.posterior_cov,
            distribution: self.prior.distribution,
            bias_type: self.prior.bias_type,
        }
    }

    /// Design value per EN 1990 Annex D
    /// X_d = η_d * X_m * (1 - k_n * V_X)
    pub fn design_value(&self, characteristic_fractile: f64) -> f64 {
        let n = self.test_data.len();
        let k_n = self.kn_factor(n, characteristic_fractile);

        self.posterior_mean * (1.0 - k_n * self.posterior_cov)
    }

    /// k_n factor from EN 1990 Table D1
    fn kn_factor(&self, n: usize, fractile: f64) -> f64 {
        // 5% characteristic value
        if (fractile - 0.05).abs() < 0.01 {
            match n {
                1 => 2.31,
                2 => 2.01,
                3 => 1.89,
                5 => 1.80,
                10 => 1.73,
                20 => 1.68,
                30 => 1.67,
                _ if n > 30 => 1.64,
                _ => 1.80,
            }
        } else {
            // General case
            1.64 + 1.5 / (n as f64).sqrt()
        }
    }
}

// ============================================================================
// COMBINED MODEL UNCERTAINTY
// ============================================================================

/// Combine multiple model uncertainty factors
#[derive(Debug, Clone)]
pub struct CombinedModelUncertainty {
    /// Component uncertainties
    pub components: Vec<ModelUncertaintyFactor>,
    /// Combined mean
    pub combined_mean: f64,
    /// Combined COV
    pub combined_cov: f64,
}

impl CombinedModelUncertainty {
    pub fn new() -> Self {
        CombinedModelUncertainty {
            components: Vec::new(),
            combined_mean: 1.0,
            combined_cov: 0.0,
        }
    }

    pub fn add(&mut self, factor: ModelUncertaintyFactor) {
        self.components.push(factor);
    }

    /// Combine for resistance (multiplicative)
    /// θ_R = θ_1 * θ_2 * ... * θ_n
    pub fn combine_multiplicative(&mut self) {
        if self.components.is_empty() {
            return;
        }

        // For lognormal: product is lognormal
        // E[θ] = Π E[θ_i]
        // V²[θ] = Π(1 + V²[θ_i]) - 1

        self.combined_mean = self.components.iter()
            .map(|c| c.mean)
            .product();

        let var_factor: f64 = self.components.iter()
            .map(|c| 1.0 + c.cov * c.cov)
            .product::<f64>() - 1.0;

        self.combined_cov = var_factor.sqrt();
    }

    /// Combine for load effects (additive variances for independent)
    /// σ² = σ₁² + σ₂² + ...
    pub fn combine_additive(&mut self) {
        if self.components.is_empty() {
            return;
        }

        self.combined_mean = self.components.iter()
            .map(|c| c.mean)
            .sum::<f64>() / self.components.len() as f64;

        let var_sum: f64 = self.components.iter()
            .map(|c| (c.mean * c.cov).powi(2))
            .sum();

        self.combined_cov = var_sum.sqrt() / self.combined_mean.abs().max(1e-10);
    }

    /// Get combined factor
    pub fn combined_factor(&self) -> ModelUncertaintyFactor {
        ModelUncertaintyFactor {
            name: "Combined model uncertainty".to_string(),
            mean: self.combined_mean,
            cov: self.combined_cov,
            distribution: UncertaintyDistribution::Lognormal,
            bias_type: BiasType::Resistance,
        }
    }
}

impl Default for CombinedModelUncertainty {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// LIMIT STATE WITH MODEL UNCERTAINTY
// ============================================================================

/// Limit state function with explicit model uncertainty
#[derive(Debug, Clone)]
pub struct UncertainLimitState {
    /// Resistance model uncertainty
    pub theta_r: ModelUncertaintyFactor,
    /// Load effect model uncertainty
    pub theta_e: ModelUncertaintyFactor,
    /// FEM analysis uncertainty
    pub theta_fem: ModelUncertaintyFactor,
}

impl UncertainLimitState {
    /// Standard setup for steel member
    pub fn steel_member(failure_mode: &str) -> Self {
        let theta_r = match failure_mode {
            "tension" => JCSSModelUncertainty::steel_tension(),
            "compression" => JCSSModelUncertainty::steel_compression_buckling(),
            "bending" => JCSSModelUncertainty::steel_bending(),
            "ltb" => JCSSModelUncertainty::steel_ltb(),
            _ => JCSSModelUncertainty::steel_bending(),
        };

        UncertainLimitState {
            theta_r,
            theta_e: JCSSModelUncertainty::fem_linear_elastic(),
            theta_fem: JCSSModelUncertainty::fem_linear_elastic(),
        }
    }

    /// Standard setup for RC member
    pub fn rc_member(failure_mode: &str) -> Self {
        let theta_r = match failure_mode {
            "flexure" => JCSSModelUncertainty::rc_flexure(),
            "shear" => JCSSModelUncertainty::rc_shear_with_stirrups(),
            "column" => JCSSModelUncertainty::rc_column(),
            _ => JCSSModelUncertainty::rc_flexure(),
        };

        UncertainLimitState {
            theta_r,
            theta_e: JCSSModelUncertainty::fem_linear_elastic(),
            theta_fem: JCSSModelUncertainty::fem_material_nonlinear(),
        }
    }

    /// Evaluate limit state: g = θ_R * R - θ_E * E
    pub fn evaluate(&self, resistance: f64, load_effect: f64, u_r: f64, u_e: f64) -> f64 {
        let theta_r = self.theta_r.sample(u_r);
        let theta_e = self.theta_e.sample(u_e);

        theta_r * resistance - theta_e * load_effect
    }

    /// Get total uncertainty (approximate)
    pub fn total_cov(&self) -> f64 {
        let v_r = self.theta_r.cov;
        let v_e = self.theta_e.cov;
        let v_fem = self.theta_fem.cov;

        (v_r * v_r + v_e * v_e + v_fem * v_fem).sqrt()
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jcss_model_uncertainty() {
        let theta = JCSSModelUncertainty::rc_flexure();
        assert!((theta.mean - 1.02).abs() < 0.01);
        assert!((theta.cov - 0.06).abs() < 0.01);
    }

    #[test]
    fn test_bayesian_update() {
        let prior = JCSSModelUncertainty::steel_bending();
        let mut updater = BayesianModelUpdate::new(prior, 0.02);

        // Add test data
        for ratio in [0.98, 1.02, 1.00, 0.99, 1.01] {
            updater.add_observation(ratio);
        }

        updater.update();

        // Posterior should be close to sample mean with reduced uncertainty
        assert!((updater.posterior_mean - 1.0).abs() < 0.05);
        assert!(updater.posterior_cov < updater.prior.cov);
    }

    #[test]
    fn test_discretization_error() {
        let mut de = DiscretizationError::new();

        // Simulated mesh refinement study
        de.add_result(0.20, 100, 10.5);
        de.add_result(0.10, 400, 10.2);
        de.add_result(0.05, 1600, 10.1);

        de.compute_gci();

        assert!(de.extrapolated_value > 10.0);
        assert!(de.gci > 0.0);
        assert!(de.convergence_rate > 1.0);
    }
}
