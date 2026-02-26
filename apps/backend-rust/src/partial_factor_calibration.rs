//! Partial Factor Calibration Module
//!
//! Calibration of partial safety factors to achieve target reliability.
//! Essential for code development and reliability-based design verification.
//!
//! ## Standards Implemented
//! - EN 1990 Annex C (Basis of Structural Design)
//! - ISO 2394:2015 General Principles on Reliability
//! - JCSS Probabilistic Model Code
//! - fib Model Code 2010
//!
//! ## Methods
//! - Target reliability approach
//! - Design value method
//! - Partial factor method
//! - First-order calibration

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;
use crate::special_functions::*;


fn standard_normal_inverse(p: f64) -> f64 {
    2.0_f64.sqrt() * crate::special_functions::erfinv(2.0 * p - 1.0)
}

// ============================================================================
// TARGET RELIABILITY LEVELS (EN 1990 / ISO 2394)
// ============================================================================

/// Consequence class per EN 1990
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ConsequenceClass {
    /// CC1 - Low consequence (agricultural, minor structures)
    CC1,
    /// CC2 - Medium consequence (residential, office buildings)
    CC2,
    /// CC3 - High consequence (grandstands, hospitals, bridges)
    CC3,
}

impl ConsequenceClass {
    /// Target reliability index for 50-year reference period (ULS)
    pub fn target_beta_50yr(&self) -> f64 {
        match self {
            ConsequenceClass::CC1 => 3.3,
            ConsequenceClass::CC2 => 3.8,
            ConsequenceClass::CC3 => 4.3,
        }
    }

    /// Target reliability index for 1-year reference period (ULS)
    pub fn target_beta_1yr(&self) -> f64 {
        match self {
            ConsequenceClass::CC1 => 4.2,
            ConsequenceClass::CC2 => 4.7,
            ConsequenceClass::CC3 => 5.2,
        }
    }

    /// Target failure probability (50-year)
    pub fn target_pf_50yr(&self) -> f64 {
        standard_normal_cdf(-self.target_beta_50yr())
    }

    /// KFI factor (reliability differentiation)
    pub fn kfi(&self) -> f64 {
        match self {
            ConsequenceClass::CC1 => 0.9,
            ConsequenceClass::CC2 => 1.0,
            ConsequenceClass::CC3 => 1.1,
        }
    }
}

/// Reference period for reliability
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ReferencePeriod {
    /// 1 year
    OneYear,
    /// 50 years (typical design life)
    FiftyYears,
    /// 100 years (bridges, monumental)
    HundredYears,
    /// Custom period
    Custom(f64),
}

impl ReferencePeriod {
    pub fn years(&self) -> f64 {
        match self {
            ReferencePeriod::OneYear => 1.0,
            ReferencePeriod::FiftyYears => 50.0,
            ReferencePeriod::HundredYears => 100.0,
            ReferencePeriod::Custom(y) => *y,
        }
    }
}

// ============================================================================
// BASIC VARIABLE STATISTICS (EN 1990 TABLE C3)
// ============================================================================

/// Basic variable for calibration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BasicVariable {
    /// Variable name
    pub name: String,
    /// Variable type
    pub var_type: VariableType,
    /// Distribution
    pub distribution: CalibrationDistribution,
    /// Coefficient of variation
    pub cov: f64,
    /// Characteristic value definition (fractile)
    pub char_fractile: f64,
    /// Sensitivity factor (α)
    pub alpha: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum VariableType {
    Resistance,
    PermanentLoad,
    VariableLoad,
    ModelUncertainty,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CalibrationDistribution {
    Normal,
    Lognormal,
    Gumbel,
    Weibull,
    Gamma,
}

impl BasicVariable {
    /// Structural steel yield strength (EN 1990 Table C3)
    pub fn steel_yield_strength() -> Self {
        BasicVariable {
            name: "Steel yield strength".to_string(),
            var_type: VariableType::Resistance,
            distribution: CalibrationDistribution::Lognormal,
            cov: 0.07,
            char_fractile: 0.05,  // 5% fractile
            alpha: 0.8,           // Dominant resistance
        }
    }

    /// Concrete compressive strength
    pub fn concrete_strength() -> Self {
        BasicVariable {
            name: "Concrete strength".to_string(),
            var_type: VariableType::Resistance,
            distribution: CalibrationDistribution::Lognormal,
            cov: 0.15,
            char_fractile: 0.05,
            alpha: 0.8,
        }
    }

    /// Permanent load (self-weight)
    pub fn permanent_load() -> Self {
        BasicVariable {
            name: "Permanent load".to_string(),
            var_type: VariableType::PermanentLoad,
            distribution: CalibrationDistribution::Normal,
            cov: 0.10,
            char_fractile: 0.50,  // Mean value
            alpha: -0.28,         // Secondary action (EN 1990)
        }
    }

    /// Imposed load (office)
    pub fn imposed_load_office() -> Self {
        BasicVariable {
            name: "Imposed load (office)".to_string(),
            var_type: VariableType::VariableLoad,
            distribution: CalibrationDistribution::Gumbel,
            cov: 0.35,
            char_fractile: 0.98,  // 98% fractile (50-year return)
            alpha: -0.7,          // Dominant action
        }
    }

    /// Wind load
    pub fn wind_load() -> Self {
        BasicVariable {
            name: "Wind load".to_string(),
            var_type: VariableType::VariableLoad,
            distribution: CalibrationDistribution::Gumbel,
            cov: 0.30,
            char_fractile: 0.98,
            alpha: -0.7,
        }
    }

    /// Snow load
    pub fn snow_load() -> Self {
        BasicVariable {
            name: "Snow load".to_string(),
            var_type: VariableType::VariableLoad,
            distribution: CalibrationDistribution::Gumbel,
            cov: 0.40,
            char_fractile: 0.98,
            alpha: -0.7,
        }
    }

    /// Model uncertainty for resistance
    pub fn model_uncertainty_resistance(cov: f64) -> Self {
        BasicVariable {
            name: "Model uncertainty (R)".to_string(),
            var_type: VariableType::ModelUncertainty,
            distribution: CalibrationDistribution::Lognormal,
            cov,
            char_fractile: 0.50,
            alpha: 0.32,
        }
    }
}

// ============================================================================
// PARTIAL FACTOR CALIBRATION
// ============================================================================

/// Partial factor calibrator
#[derive(Debug, Clone)]
pub struct PartialFactorCalibrator {
    /// Target reliability index
    pub beta_target: f64,
    /// Consequence class
    pub consequence_class: ConsequenceClass,
    /// Reference period
    pub reference_period: ReferencePeriod,
    /// Basic variables
    pub variables: Vec<BasicVariable>,
    /// Calibrated partial factors
    pub partial_factors: Vec<PartialFactor>,
}

/// Calibrated partial factor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartialFactor {
    /// Variable name
    pub variable_name: String,
    /// Partial factor value
    pub gamma: f64,
    /// Design value ratio (X_d / X_k)
    pub design_ratio: f64,
    /// Effective sensitivity
    pub alpha_eff: f64,
}

impl PartialFactorCalibrator {
    pub fn new(consequence_class: ConsequenceClass, reference_period: ReferencePeriod) -> Self {
        PartialFactorCalibrator {
            beta_target: consequence_class.target_beta_50yr(),
            consequence_class,
            reference_period,
            variables: Vec::new(),
            partial_factors: Vec::new(),
        }
    }

    pub fn add_variable(&mut self, variable: BasicVariable) {
        self.variables.push(variable);
    }

    /// Calibrate partial factors using EN 1990 Annex C approach
    pub fn calibrate(&mut self) {
        self.partial_factors.clear();

        for var in &self.variables {
            let gamma = self.calculate_partial_factor(var);
            self.partial_factors.push(gamma);
        }
    }

    /// Calculate partial factor for a single variable
    fn calculate_partial_factor(&self, var: &BasicVariable) -> PartialFactor {
        let beta = self.beta_target;
        let alpha = var.alpha;
        let v = var.cov;

        // Design value method (EN 1990 Annex C, C7)
        let (x_d_over_mu, x_k_over_mu) = match var.distribution {
            CalibrationDistribution::Normal => {
                // X_d = μ * (1 - α * β * V)
                // X_k = μ * (1 + k * V) where k depends on fractile
                let k = standard_normal_inverse(var.char_fractile);
                let x_d_ratio = 1.0 - alpha * beta * v;
                let x_k_ratio = 1.0 + k * v;
                (x_d_ratio, x_k_ratio)
            }
            CalibrationDistribution::Lognormal => {
                // X_d = μ * exp(-α * β * V) for small V
                // More accurate: X_d = μ * exp(α * β * σ_ln - 0.5 * σ_ln²)
                let sigma_ln = (1.0 + v * v).ln().sqrt();
                let k = standard_normal_inverse(var.char_fractile);
                
                let x_d_ratio = (alpha * beta * sigma_ln - 0.5 * sigma_ln * sigma_ln).exp();
                let x_k_ratio = (k * sigma_ln - 0.5 * sigma_ln * sigma_ln).exp();
                (x_d_ratio, x_k_ratio)
            }
            CalibrationDistribution::Gumbel => {
                // For Gumbel (loads): X_d = μ * [1 - V * (0.45 + 0.78 * ln(-ln(Φ(-α*β))))]
                let phi_neg_ab = standard_normal_cdf(-alpha * beta);
                let u = -(-phi_neg_ab.ln()).ln();
                let x_d_ratio = 1.0 + v * (u - 0.5772) * 6.0_f64.sqrt() / PI;
                
                // Characteristic: 98% fractile
                let u_k = -(-var.char_fractile.ln()).ln();
                let x_k_ratio = 1.0 + v * (u_k - 0.5772) * 6.0_f64.sqrt() / PI;
                (x_d_ratio, x_k_ratio)
            }
            _ => {
                // Fallback to normal approximation
                let k = standard_normal_inverse(var.char_fractile);
                let x_d_ratio = 1.0 - alpha * beta * v;
                let x_k_ratio = 1.0 + k * v;
                (x_d_ratio, x_k_ratio)
            }
        };

        // Partial factor γ = X_d / X_k (for resistance) or X_d / X_k (for loads)
        let gamma = match var.var_type {
            VariableType::Resistance | VariableType::ModelUncertainty => {
                // γ_M = X_k / X_d (reduction)
                (x_k_over_mu / x_d_over_mu).max(1.0)
            }
            VariableType::PermanentLoad | VariableType::VariableLoad => {
                // γ_F = X_d / X_k (amplification)
                (x_d_over_mu / x_k_over_mu).max(1.0)
            }
        };

        PartialFactor {
            variable_name: var.name.clone(),
            gamma,
            design_ratio: x_d_over_mu / x_k_over_mu,
            alpha_eff: alpha,
        }
    }

    /// Verify calibration achieves target reliability
    pub fn verify_calibration(&self) -> CalibrationVerification {
        // Simplified FORM check
        let mut sum_alpha_sq = 0.0;
        let mut sum_alpha_beta = 0.0;

        for (var, pf) in self.variables.iter().zip(self.partial_factors.iter()) {
            let alpha = pf.alpha_eff;
            sum_alpha_sq += alpha * alpha;
            
            // Back-calculate β contribution
            let v = var.cov;
            let gamma = pf.gamma;
            
            let beta_contribution = match var.var_type {
                VariableType::Resistance => {
                    // β_R = ln(γ) / V for lognormal
                    gamma.ln() / v.max(0.01)
                }
                _ => {
                    // β_S = (γ - 1) / V for normal approximation
                    (gamma - 1.0) / v.max(0.01)
                }
            };
            
            sum_alpha_beta += alpha * beta_contribution;
        }

        let beta_achieved = sum_alpha_beta / sum_alpha_sq.sqrt().max(0.01);

        CalibrationVerification {
            beta_target: self.beta_target,
            beta_achieved,
            is_adequate: beta_achieved >= self.beta_target * 0.95,
            sum_alpha_squared: sum_alpha_sq,
        }
    }
}

/// Result of calibration verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalibrationVerification {
    pub beta_target: f64,
    pub beta_achieved: f64,
    pub is_adequate: bool,
    pub sum_alpha_squared: f64,
}

// ============================================================================
// STANDARD PARTIAL FACTORS (EUROCODE / IS CODES)
// ============================================================================

/// Standard code partial factors
#[derive(Debug, Clone)]
pub struct CodePartialFactors;

impl CodePartialFactors {
    // ========== EUROCODE ==========

    /// EN 1993 (Steel) - γ_M0 for cross-section resistance
    pub fn eurocode_gamma_m0() -> f64 { 1.00 }

    /// EN 1993 (Steel) - γ_M1 for member buckling
    pub fn eurocode_gamma_m1() -> f64 { 1.00 }

    /// EN 1993 (Steel) - γ_M2 for connections
    pub fn eurocode_gamma_m2() -> f64 { 1.25 }

    /// EN 1992 (Concrete) - γ_c
    pub fn eurocode_gamma_c() -> f64 { 1.50 }

    /// EN 1992 (Concrete) - γ_s for reinforcement
    pub fn eurocode_gamma_s() -> f64 { 1.15 }

    /// EN 1990 - γ_G for permanent loads (unfavorable)
    pub fn eurocode_gamma_g_unfav() -> f64 { 1.35 }

    /// EN 1990 - γ_G for permanent loads (favorable)
    pub fn eurocode_gamma_g_fav() -> f64 { 1.00 }

    /// EN 1990 - γ_Q for variable loads
    pub fn eurocode_gamma_q() -> f64 { 1.50 }

    // ========== INDIAN STANDARDS ==========

    /// IS 456 - γ_c for concrete
    pub fn is456_gamma_c() -> f64 { 1.50 }

    /// IS 456 - γ_s for steel reinforcement
    pub fn is456_gamma_s() -> f64 { 1.15 }

    /// IS 800 - γ_m0 for cross-section
    pub fn is800_gamma_m0() -> f64 { 1.10 }

    /// IS 800 - γ_m1 for buckling
    pub fn is800_gamma_m1() -> f64 { 1.10 }

    /// IS 456 - γ_f for dead load
    pub fn is456_gamma_dl() -> f64 { 1.50 }

    /// IS 456 - γ_f for live load
    pub fn is456_gamma_ll() -> f64 { 1.50 }

    // ========== AISC / ACI ==========

    /// AISC 360 - φ for tension
    pub fn aisc_phi_tension() -> f64 { 0.90 }

    /// AISC 360 - φ for compression
    pub fn aisc_phi_compression() -> f64 { 0.90 }

    /// AISC 360 - φ for flexure
    pub fn aisc_phi_flexure() -> f64 { 0.90 }

    /// AISC 360 - φ for shear
    pub fn aisc_phi_shear() -> f64 { 1.00 }

    /// AISC 360 - φ for bolts
    pub fn aisc_phi_bolts() -> f64 { 0.75 }

    /// ACI 318 - φ for flexure
    pub fn aci_phi_flexure() -> f64 { 0.90 }

    /// ACI 318 - φ for shear
    pub fn aci_phi_shear() -> f64 { 0.75 }

    /// ACI 318 - φ for compression
    pub fn aci_phi_compression() -> f64 { 0.65 }
}

// ============================================================================
// DESIGN VALUE COMPUTATION
// ============================================================================

/// Compute design values from characteristic values
#[derive(Debug, Clone)]
pub struct DesignValueCalculator {
    /// Partial factors to apply
    pub factors: Vec<(String, f64)>,
}

impl DesignValueCalculator {
    pub fn new() -> Self {
        DesignValueCalculator {
            factors: Vec::new(),
        }
    }

    /// Add partial factor
    pub fn add_factor(&mut self, name: &str, gamma: f64) {
        self.factors.push((name.to_string(), gamma));
    }

    /// Eurocode steel member setup
    pub fn eurocode_steel(&mut self) {
        self.factors.clear();
        self.add_factor("gamma_M0", CodePartialFactors::eurocode_gamma_m0());
        self.add_factor("gamma_M1", CodePartialFactors::eurocode_gamma_m1());
        self.add_factor("gamma_G", CodePartialFactors::eurocode_gamma_g_unfav());
        self.add_factor("gamma_Q", CodePartialFactors::eurocode_gamma_q());
    }

    /// IS code steel member setup
    pub fn is800_steel(&mut self) {
        self.factors.clear();
        self.add_factor("gamma_m0", CodePartialFactors::is800_gamma_m0());
        self.add_factor("gamma_m1", CodePartialFactors::is800_gamma_m1());
        self.add_factor("gamma_DL", CodePartialFactors::is456_gamma_dl());
        self.add_factor("gamma_LL", CodePartialFactors::is456_gamma_ll());
    }

    /// Compute design resistance
    pub fn design_resistance(&self, r_k: f64, gamma_m_name: &str) -> f64 {
        let gamma = self.factors.iter()
            .find(|(n, _)| n == gamma_m_name)
            .map(|(_, g)| *g)
            .unwrap_or(1.0);
        
        r_k / gamma
    }

    /// Compute design action effect
    pub fn design_action(&self, s_k: f64, gamma_f_name: &str) -> f64 {
        let gamma = self.factors.iter()
            .find(|(n, _)| n == gamma_f_name)
            .map(|(_, g)| *g)
            .unwrap_or(1.0);
        
        s_k * gamma
    }

    /// Check limit state: R_d ≥ S_d
    pub fn check_limit_state(&self, r_k: f64, s_k: f64, gamma_m: &str, gamma_f: &str) -> DesignCheck {
        let r_d = self.design_resistance(r_k, gamma_m);
        let s_d = self.design_action(s_k, gamma_f);
        let utilization = s_d / r_d;

        DesignCheck {
            characteristic_resistance: r_k,
            design_resistance: r_d,
            characteristic_action: s_k,
            design_action: s_d,
            utilization,
            is_safe: utilization <= 1.0,
        }
    }
}

impl Default for DesignValueCalculator {
    fn default() -> Self {
        Self::new()
    }
}

/// Result of design check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignCheck {
    pub characteristic_resistance: f64,
    pub design_resistance: f64,
    pub characteristic_action: f64,
    pub design_action: f64,
    pub utilization: f64,
    pub is_safe: bool,
}

// ============================================================================
// RELIABILITY TO PARTIAL FACTOR MAPPING
// ============================================================================

/// Map reliability analysis result to equivalent partial factors
#[derive(Debug, Clone)]
pub struct ReliabilityToPartialFactor {
    /// FORM result: β
    pub beta: f64,
    /// Design point in standard normal space
    pub design_point_u: Vec<f64>,
    /// Variable names
    pub variable_names: Vec<String>,
    /// Variable COVs
    pub variable_covs: Vec<f64>,
    /// Variable means
    pub variable_means: Vec<f64>,
    /// Is resistance (true) or load (false)
    pub is_resistance: Vec<bool>,
}

impl ReliabilityToPartialFactor {
    pub fn new(beta: f64) -> Self {
        ReliabilityToPartialFactor {
            beta,
            design_point_u: Vec::new(),
            variable_names: Vec::new(),
            variable_covs: Vec::new(),
            variable_means: Vec::new(),
            is_resistance: Vec::new(),
        }
    }

    /// Add variable from FORM analysis
    pub fn add_variable(
        &mut self,
        name: &str,
        u_star: f64,
        mean: f64,
        cov: f64,
        is_resistance: bool,
    ) {
        self.variable_names.push(name.to_string());
        self.design_point_u.push(u_star);
        self.variable_means.push(mean);
        self.variable_covs.push(cov);
        self.is_resistance.push(is_resistance);
    }

    /// Compute equivalent partial factors from FORM design point
    pub fn compute_partial_factors(&self) -> Vec<EquivalentPartialFactor> {
        let mut factors = Vec::new();
        let n = self.variable_names.len();

        // Total norm for alpha calculation
        let norm: f64 = self.design_point_u.iter()
            .map(|&u| u * u)
            .sum::<f64>()
            .sqrt();

        for i in 0..n {
            let u_star = self.design_point_u[i];
            let mean = self.variable_means[i];
            let cov = self.variable_covs[i];
            let is_r = self.is_resistance[i];

            // Sensitivity factor
            let alpha = if norm > 1e-10 { -u_star / norm } else { 0.0 };

            // Design point in physical space (lognormal assumption)
            let sigma_ln = (1.0 + cov * cov).ln().sqrt();
            let x_star = mean * (u_star * sigma_ln).exp();

            // Characteristic value (5% for R, 98% for S)
            let char_fractile = if is_r { 0.05 } else { 0.98 };
            let k = standard_normal_inverse(char_fractile);
            let x_k = mean * (k * sigma_ln).exp();

            // Equivalent partial factor
            let gamma = if is_r {
                x_k / x_star  // γ_M = R_k / R_d
            } else {
                x_star / x_k  // γ_F = S_d / S_k
            };

            factors.push(EquivalentPartialFactor {
                variable_name: self.variable_names[i].clone(),
                alpha,
                design_value: x_star,
                characteristic_value: x_k,
                gamma: gamma.max(0.5).min(3.0),
                is_resistance: is_r,
            });
        }

        factors
    }
}

/// Equivalent partial factor from reliability analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EquivalentPartialFactor {
    pub variable_name: String,
    pub alpha: f64,
    pub design_value: f64,
    pub characteristic_value: f64,
    pub gamma: f64,
    pub is_resistance: bool,
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_target_reliability() {
        let cc2 = ConsequenceClass::CC2;
        assert!((cc2.target_beta_50yr() - 3.8).abs() < 0.01);
        assert!((cc2.target_pf_50yr() - 7.2e-5).abs() < 1e-5);
    }

    #[test]
    fn test_partial_factor_calibration() {
        let mut calibrator = PartialFactorCalibrator::new(
            ConsequenceClass::CC2,
            ReferencePeriod::FiftyYears,
        );

        calibrator.add_variable(BasicVariable::steel_yield_strength());
        calibrator.add_variable(BasicVariable::permanent_load());
        calibrator.add_variable(BasicVariable::imposed_load_office());

        calibrator.calibrate();

        assert!(calibrator.partial_factors.len() == 3);

        // Steel should have γ_M close to 1.0
        let gamma_steel = calibrator.partial_factors[0].gamma;
        assert!(gamma_steel >= 1.0 && gamma_steel < 1.20);
    }

    #[test]
    fn test_design_value_calculator() {
        let mut calc = DesignValueCalculator::new();
        calc.eurocode_steel();

        // R_k = 300 kN, S_k = 200 kN
        let check = calc.check_limit_state(300.0, 200.0, "gamma_M0", "gamma_G");

        assert!((check.design_resistance - 300.0).abs() < 0.1);  // γ_M0 = 1.0
        assert!((check.design_action - 270.0).abs() < 0.1);       // 200 * 1.35
        assert!(check.is_safe);
    }
}
