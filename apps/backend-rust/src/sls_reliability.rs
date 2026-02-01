//! Serviceability Limit State (SLS) Reliability Module
//!
//! Probabilistic assessment of serviceability criteria:
//! deflection, crack width, vibration, and durability.
//!
//! ## Standards
//! - IS 456:2000 Serviceability Requirements
//! - EN 1992-1-1 Section 7 (SLS)
//! - EN 1993-1-1 Section 7 (Deflections)
//! - IS 800:2007 Section 5.6 (Deflection Limits)
//! - ACI 318 Chapter 24 (Serviceability)
//!
//! ## Target Reliability for SLS
//! - EN 1990: β = 1.5 (reversible) to 2.9 (irreversible)
//! - JCSS: β = 1.5 for 50-year reference period

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;
use crate::special_functions::*;


fn standard_normal_inverse(p: f64) -> f64 {
    2.0_f64.sqrt() * crate::special_functions::erfinv(2.0 * p - 1.0)
}

// ============================================================================
// DEFLECTION LIMITS
// ============================================================================

/// Deflection limit type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DeflectionLimitType {
    /// Appearance and general utility
    Appearance,
    /// Damage to non-structural elements
    PartitionDamage,
    /// Ponding on roofs
    Ponding,
    /// Comfort (floor vibration)
    Comfort,
    /// Machinery/equipment tolerance
    Equipment,
    /// Structural (excessive deformation)
    Structural,
}

/// Deflection limits per various codes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeflectionLimits {
    /// Span (m)
    pub span: f64,
    /// Limit type
    pub limit_type: DeflectionLimitType,
    /// Code standard
    pub code: DesignCode,
}

/// Design code for SLS
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DesignCode {
    IS456,
    IS800,
    EN1992,
    EN1993,
    ACI318,
    AISC360,
}

impl DeflectionLimits {
    /// Get deflection limit (m)
    pub fn limit(&self) -> f64 {
        match (self.code, self.limit_type) {
            // IS 456:2000 Table 6
            (DesignCode::IS456, DeflectionLimitType::Appearance) => self.span / 250.0,
            (DesignCode::IS456, DeflectionLimitType::PartitionDamage) => {
                (self.span / 350.0).min(0.020)  // 20mm max
            }

            // IS 800:2007 Table 6
            (DesignCode::IS800, DeflectionLimitType::Appearance) => self.span / 300.0,
            (DesignCode::IS800, DeflectionLimitType::PartitionDamage) => self.span / 360.0,
            (DesignCode::IS800, DeflectionLimitType::Equipment) => self.span / 500.0,

            // EN 1992-1-1 Section 7.4.1
            (DesignCode::EN1992, DeflectionLimitType::Appearance) => self.span / 250.0,
            (DesignCode::EN1992, DeflectionLimitType::PartitionDamage) => {
                (self.span / 500.0).min(0.020)
            }

            // EN 1993-1-1 (Steel)
            (DesignCode::EN1993, DeflectionLimitType::Appearance) => self.span / 250.0,
            (DesignCode::EN1993, DeflectionLimitType::PartitionDamage) => self.span / 300.0,

            // ACI 318 Table 24.2.2
            (DesignCode::ACI318, DeflectionLimitType::Appearance) => self.span / 240.0,
            (DesignCode::ACI318, DeflectionLimitType::PartitionDamage) => self.span / 480.0,

            // AISC 360 Table L1.1
            (DesignCode::AISC360, DeflectionLimitType::Appearance) => self.span / 240.0,
            (DesignCode::AISC360, DeflectionLimitType::PartitionDamage) => self.span / 360.0,

            // Default
            _ => self.span / 300.0,
        }
    }
}

// ============================================================================
// PROBABILISTIC DEFLECTION CHECK
// ============================================================================

/// Random variables for deflection calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeflectionRandomVariables {
    /// Elastic modulus mean (MPa)
    pub e_mean: f64,
    /// Elastic modulus CoV
    pub e_cov: f64,
    /// Moment of inertia mean (m⁴)
    pub i_mean: f64,
    /// Moment of inertia CoV
    pub i_cov: f64,
    /// Dead load mean (kN/m)
    pub g_mean: f64,
    /// Dead load CoV
    pub g_cov: f64,
    /// Live load mean (kN/m)
    pub q_mean: f64,
    /// Live load CoV
    pub q_cov: f64,
    /// Span (m)
    pub span: f64,
    /// Model uncertainty factor mean
    pub theta_mean: f64,
    /// Model uncertainty factor CoV
    pub theta_cov: f64,
}

impl Default for DeflectionRandomVariables {
    fn default() -> Self {
        DeflectionRandomVariables {
            e_mean: 30000.0,    // Concrete E_c (MPa)
            e_cov: 0.10,
            i_mean: 0.001,     // 1e-3 m⁴
            i_cov: 0.05,
            g_mean: 10.0,      // kN/m
            g_cov: 0.10,
            q_mean: 5.0,       // kN/m
            q_cov: 0.25,
            span: 6.0,         // m
            theta_mean: 1.0,
            theta_cov: 0.10,
        }
    }
}

/// Probabilistic deflection assessment
#[derive(Debug)]
pub struct DeflectionReliability {
    params: DeflectionRandomVariables,
    limit: f64,
}

impl DeflectionReliability {
    pub fn new(params: DeflectionRandomVariables, limit: f64) -> Self {
        DeflectionReliability { params, limit }
    }

    /// Simple beam deflection (5wL⁴/384EI)
    fn deflection_simple_beam(&self, e: f64, i: f64, w: f64, l: f64) -> f64 {
        5.0 * w * l.powi(4) / (384.0 * e * 1e6 * i)
    }

    /// FORM analysis for deflection limit state
    pub fn form_analysis(&self) -> DeflectionFORMResult {
        // Limit state: G = δ_limit - θ * δ_calc
        // Using gradient-based approach

        let mut x = vec![
            self.params.e_mean,
            self.params.i_mean,
            self.params.g_mean,
            self.params.q_mean,
            self.params.theta_mean,
        ];

        let sigma = vec![
            self.params.e_mean * self.params.e_cov,
            self.params.i_mean * self.params.i_cov,
            self.params.g_mean * self.params.g_cov,
            self.params.q_mean * self.params.q_cov,
            self.params.theta_mean * self.params.theta_cov,
        ];

        // HL-RF iteration
        let mut beta = 0.0;
        let mut alpha = vec![0.0; 5];

        for _iter in 0..50 {
            let e = x[0];
            let i = x[1];
            let g = x[2];
            let q = x[3];
            let theta = x[4];

            let w = g + q;  // Total load (kN/m) → N/m for SI
            let delta = self.deflection_simple_beam(e, i, w, self.params.span);
            let g_val = self.limit - theta * delta;

            // Gradients
            let dg_de = theta * 5.0 * w * self.params.span.powi(4) 
                      / (384.0 * e.powi(2) * 1e6 * i);
            let dg_di = theta * 5.0 * w * self.params.span.powi(4) 
                      / (384.0 * e * 1e6 * i.powi(2));
            let dg_dg = -theta * 5.0 * self.params.span.powi(4) 
                      / (384.0 * e * 1e6 * i);
            let dg_dq = -theta * 5.0 * self.params.span.powi(4) 
                      / (384.0 * e * 1e6 * i);
            let dg_dtheta = -delta;

            let grad = vec![dg_de, dg_di, dg_dg, dg_dq, dg_dtheta];

            // Transform to standard normal
            let grad_u: Vec<f64> = grad.iter()
                .zip(sigma.iter())
                .map(|(&g, &s)| g * s)
                .collect();

            let grad_norm = grad_u.iter().map(|&g| g.powi(2)).sum::<f64>().sqrt();

            if grad_norm < 1e-10 {
                break;
            }

            alpha = grad_u.iter().map(|&g| g / grad_norm).collect();
            
            // Update beta
            let u: Vec<f64> = x.iter()
                .enumerate()
                .map(|(i, &xi)| {
                    let mean = match i {
                        0 => self.params.e_mean,
                        1 => self.params.i_mean,
                        2 => self.params.g_mean,
                        3 => self.params.q_mean,
                        _ => self.params.theta_mean,
                    };
                    (xi - mean) / sigma[i]
                })
                .collect();

            let u_norm_sq = u.iter().map(|&ui| ui.powi(2)).sum::<f64>();

            beta = (u_norm_sq.sqrt() * g_val.signum() + g_val / grad_norm).abs();

            // Update design point
            for i in 0..5 {
                let mean = match i {
                    0 => self.params.e_mean,
                    1 => self.params.i_mean,
                    2 => self.params.g_mean,
                    3 => self.params.q_mean,
                    _ => self.params.theta_mean,
                };
                x[i] = mean - alpha[i] * beta * sigma[i];
            }

            if g_val.abs() < 1e-6 {
                break;
            }
        }

        DeflectionFORMResult {
            beta,
            pf: standard_normal_cdf(-beta),
            design_point: x.clone(),
            sensitivity: alpha,
            limit: self.limit,
            calculated_deflection: self.deflection_simple_beam(
                x[0], x[1], x[2] + x[3], self.params.span
            ) * x[4],
        }
    }

    /// Monte Carlo simulation
    pub fn monte_carlo(&self, n_samples: usize) -> (f64, f64) {
        let mut rng = SimpleRng::new(12345);
        let mut n_fail = 0;

        for _ in 0..n_samples {
            // Sample random variables (lognormal for E, I; normal for others)
            let e = self.params.e_mean * (self.params.e_cov * rng.normal()).exp();
            let i = self.params.i_mean * (self.params.i_cov * rng.normal()).exp();
            let g = self.params.g_mean * (1.0 + self.params.g_cov * rng.normal());
            let q = self.params.q_mean * (1.0 + self.params.q_cov * rng.normal()).max(0.0);
            let theta = self.params.theta_mean * (1.0 + self.params.theta_cov * rng.normal());

            let w = g + q;
            let delta = self.deflection_simple_beam(e, i, w, self.params.span) * theta;

            if delta > self.limit {
                n_fail += 1;
            }
        }

        let pf = n_fail as f64 / n_samples as f64;
        let beta = if pf > 0.0 && pf < 1.0 {
            -standard_normal_inverse(pf)
        } else if pf == 0.0 {
            6.0  // Very safe
        } else {
            -6.0  // Very unsafe
        };

        (pf, beta)
    }
}

/// FORM result for deflection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeflectionFORMResult {
    pub beta: f64,
    pub pf: f64,
    pub design_point: Vec<f64>,
    pub sensitivity: Vec<f64>,
    pub limit: f64,
    pub calculated_deflection: f64,
}

// ============================================================================
// CRACK WIDTH RELIABILITY
// ============================================================================

/// Crack width calculation parameters (EN 1992-1-1 Section 7.3.4)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrackWidthParams {
    /// Steel stress under quasi-permanent load (MPa)
    pub sigma_s: f64,
    /// Steel stress CoV
    pub sigma_s_cov: f64,
    /// Bar diameter (mm)
    pub phi: f64,
    /// Effective concrete area per bar (mm²)
    pub ac_eff: f64,
    /// Clear cover (mm)
    pub cover: f64,
    /// Concrete tensile strength mean (MPa)
    pub fct_mean: f64,
    /// Concrete tensile strength CoV
    pub fct_cov: f64,
    /// Steel elastic modulus (MPa)
    pub es: f64,
    /// Concrete elastic modulus mean (MPa)
    pub ecm: f64,
    /// Bond factor k1 (0.8 for high bond, 1.6 for plain)
    pub k1: f64,
    /// Strain distribution factor k2 (0.5 bending, 1.0 tension)
    pub k2: f64,
}

impl Default for CrackWidthParams {
    fn default() -> Self {
        CrackWidthParams {
            sigma_s: 200.0,
            sigma_s_cov: 0.15,
            phi: 16.0,
            ac_eff: 10000.0,
            cover: 40.0,
            fct_mean: 2.5,
            fct_cov: 0.20,
            es: 200000.0,
            ecm: 30000.0,
            k1: 0.8,
            k2: 0.5,
        }
    }
}

/// Crack width reliability assessment
#[derive(Debug)]
pub struct CrackWidthReliability {
    params: CrackWidthParams,
    /// Crack width limit (mm)
    limit: f64,
}

impl CrackWidthReliability {
    pub fn new(params: CrackWidthParams, limit_mm: f64) -> Self {
        CrackWidthReliability { params, limit: limit_mm }
    }

    /// Crack spacing per EN 1992-1-1 Eq. 7.11
    fn crack_spacing(&self, c: f64, phi: f64, rho_eff: f64) -> f64 {
        let k3 = 3.4;
        let k4 = 0.425;
        k3 * c + k4 * self.params.k1 * self.params.k2 * phi / rho_eff
    }

    /// Mean strain difference per EN 1992-1-1 Eq. 7.9
    fn mean_strain_diff(&self, sigma_s: f64, fct: f64, rho_eff: f64) -> f64 {
        let alpha_e = self.params.es / self.params.ecm;
        let kt = 0.4;  // Long-term loading

        let eps_sm_eps_cm = (sigma_s - kt * fct / rho_eff * (1.0 + alpha_e * rho_eff))
            / self.params.es;

        eps_sm_eps_cm.max(0.6 * sigma_s / self.params.es)
    }

    /// Characteristic crack width (mm)
    fn crack_width(&self, sigma_s: f64, fct: f64, c: f64, phi: f64) -> f64 {
        let as_bar = PI * phi.powi(2) / 4.0;
        let rho_eff = as_bar / self.params.ac_eff;

        let sr_max = self.crack_spacing(c, phi, rho_eff);
        let eps_diff = self.mean_strain_diff(sigma_s, fct, rho_eff);

        sr_max * eps_diff
    }

    /// Monte Carlo reliability analysis
    pub fn monte_carlo(&self, n_samples: usize) -> CrackWidthResult {
        let mut rng = SimpleRng::new(54321);
        let mut n_fail = 0;
        let mut widths = Vec::with_capacity(n_samples);

        for _ in 0..n_samples {
            // Random variables
            let sigma_s = self.params.sigma_s 
                * (1.0 + self.params.sigma_s_cov * rng.normal());
            let fct = self.params.fct_mean 
                * (self.params.fct_cov * rng.normal()).exp();
            let c = self.params.cover * (1.0 + 0.15 * rng.normal());
            let phi = self.params.phi * (1.0 + 0.02 * rng.normal());

            let w = self.crack_width(sigma_s.max(0.0), fct.max(0.5), c.max(10.0), phi.max(8.0));
            widths.push(w);

            if w > self.limit {
                n_fail += 1;
            }
        }

        let pf = n_fail as f64 / n_samples as f64;
        let beta = if pf > 0.0 && pf < 1.0 {
            -standard_normal_inverse(pf)
        } else if pf == 0.0 {
            6.0
        } else {
            -6.0
        };

        // Statistics
        let mean_w = widths.iter().sum::<f64>() / widths.len() as f64;
        widths.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let w_95 = widths[(0.95 * widths.len() as f64) as usize];

        CrackWidthResult {
            beta,
            pf,
            mean_crack_width: mean_w,
            characteristic_width: w_95,
            limit: self.limit,
        }
    }
}

/// Crack width reliability result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrackWidthResult {
    pub beta: f64,
    pub pf: f64,
    pub mean_crack_width: f64,
    pub characteristic_width: f64,
    pub limit: f64,
}

// ============================================================================
// VIBRATION SERVICEABILITY
// ============================================================================

/// Floor vibration parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VibrationParams {
    /// Fundamental frequency mean (Hz)
    pub f1_mean: f64,
    /// Fundamental frequency CoV
    pub f1_cov: f64,
    /// Modal mass (kg)
    pub modal_mass: f64,
    /// Damping ratio
    pub zeta: f64,
    /// Walker weight (N)
    pub walker_weight: f64,
    /// Walking frequency (Hz)
    pub walking_freq: f64,
}

impl Default for VibrationParams {
    fn default() -> Self {
        VibrationParams {
            f1_mean: 8.0,        // Hz
            f1_cov: 0.15,
            modal_mass: 5000.0,  // kg
            zeta: 0.03,          // 3% damping
            walker_weight: 700.0, // N
            walking_freq: 2.0,   // Hz
        }
    }
}

/// Vibration limit type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum VibrationLimitType {
    /// Office/residential
    Office,
    /// Workshop
    Workshop,
    /// Hospital operating theatre
    Hospital,
    /// Footbridge
    Footbridge,
}

impl VibrationLimitType {
    /// Peak acceleration limit (m/s²) per AISC Design Guide 11
    pub fn acceleration_limit(&self) -> f64 {
        match self {
            VibrationLimitType::Office => 0.05 * 9.81,   // 0.5% g
            VibrationLimitType::Workshop => 0.08 * 9.81, // 0.8% g
            VibrationLimitType::Hospital => 0.02 * 9.81, // 0.2% g
            VibrationLimitType::Footbridge => 0.07 * 9.81,
        }
    }
}

/// Vibration serviceability assessment
#[derive(Debug)]
pub struct VibrationReliability {
    params: VibrationParams,
    limit_type: VibrationLimitType,
}

impl VibrationReliability {
    pub fn new(params: VibrationParams, limit_type: VibrationLimitType) -> Self {
        VibrationReliability { params, limit_type }
    }

    /// Peak acceleration from walking (AISC DG11)
    fn peak_acceleration(&self, f1: f64) -> f64 {
        // Dynamic load factor for walking
        let alpha = if self.params.walking_freq <= 2.2 {
            0.5
        } else {
            0.4
        };

        // Resonance response (simplified)
        let harmonic = (f1 / self.params.walking_freq).round() as i32;
        
        if harmonic >= 1 && harmonic <= 4 {
            // Near resonance
            let p0 = alpha * self.params.walker_weight;
            p0 / (2.0 * self.params.zeta * self.params.modal_mass)
        } else {
            // Off-resonance (much lower)
            0.1 * self.params.walker_weight / self.params.modal_mass
        }
    }

    /// Monte Carlo reliability analysis
    pub fn monte_carlo(&self, n_samples: usize) -> VibrationResult {
        let mut rng = SimpleRng::new(98765);
        let mut n_fail = 0;
        let limit = self.limit_type.acceleration_limit();

        for _ in 0..n_samples {
            let f1 = self.params.f1_mean * (self.params.f1_cov * rng.normal()).exp();
            let a = self.peak_acceleration(f1);

            if a > limit {
                n_fail += 1;
            }
        }

        let pf = n_fail as f64 / n_samples as f64;
        let beta = if pf > 0.0 && pf < 1.0 {
            -standard_normal_inverse(pf)
        } else if pf == 0.0 {
            6.0
        } else {
            -6.0
        };

        VibrationResult {
            beta,
            pf,
            mean_frequency: self.params.f1_mean,
            limit_type: self.limit_type,
            acceleration_limit: limit,
        }
    }
}

/// Vibration reliability result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VibrationResult {
    pub beta: f64,
    pub pf: f64,
    pub mean_frequency: f64,
    pub limit_type: VibrationLimitType,
    pub acceleration_limit: f64,
}

// ============================================================================
// SLS TARGET RELIABILITY
// ============================================================================

/// Target reliability for SLS per EN 1990
#[derive(Debug, Clone, Copy)]
pub struct SLSTargetReliability {
    /// Reference period (years)
    pub reference_period: f64,
    /// Reversible limit state
    pub reversible: bool,
}

impl SLSTargetReliability {
    /// Target β for SLS
    pub fn target_beta(&self) -> f64 {
        if self.reversible {
            // Reversible: appearance, comfort
            match self.reference_period as i32 {
                1 => 2.9,
                50 => 1.5,
                _ => 1.5 + 1.4 * (50.0 / self.reference_period).ln() / 50.0_f64.ln(),
            }
        } else {
            // Irreversible: damage to finishes
            match self.reference_period as i32 {
                1 => 3.8,
                50 => 2.9,
                _ => 2.9 + 0.9 * (50.0 / self.reference_period).ln() / 50.0_f64.ln(),
            }
        }
    }
}

// ============================================================================
// COMBINED SLS ASSESSMENT
// ============================================================================

/// Combined SLS reliability assessment
#[derive(Debug)]
pub struct SLSAssessment {
    pub deflection: Option<DeflectionFORMResult>,
    pub crack_width: Option<CrackWidthResult>,
    pub vibration: Option<VibrationResult>,
    pub target_beta: f64,
}

impl SLSAssessment {
    pub fn new(target_beta: f64) -> Self {
        SLSAssessment {
            deflection: None,
            crack_width: None,
            vibration: None,
            target_beta,
        }
    }

    /// Check if all SLS criteria pass
    pub fn passes(&self) -> bool {
        let d_ok = self.deflection.as_ref()
            .map(|d| d.beta >= self.target_beta)
            .unwrap_or(true);

        let c_ok = self.crack_width.as_ref()
            .map(|c| c.beta >= self.target_beta)
            .unwrap_or(true);

        let v_ok = self.vibration.as_ref()
            .map(|v| v.beta >= self.target_beta)
            .unwrap_or(true);

        d_ok && c_ok && v_ok
    }

    /// Governing (minimum) beta
    pub fn governing_beta(&self) -> f64 {
        let betas = [
            self.deflection.as_ref().map(|d| d.beta),
            self.crack_width.as_ref().map(|c| c.beta),
            self.vibration.as_ref().map(|v| v.beta),
        ];

        betas.iter()
            .filter_map(|&b| b)
            .min_by(|a, b| a.partial_cmp(b).unwrap())
            .unwrap_or(f64::INFINITY)
    }
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
        let u1 = self.uniform().max(1e-10);
        let u2 = self.uniform();
        (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deflection_limit() {
        let limits = DeflectionLimits {
            span: 6.0,
            limit_type: DeflectionLimitType::Appearance,
            code: DesignCode::IS456,
        };

        let limit = limits.limit();
        assert!((limit - 0.024).abs() < 0.001);  // L/250 = 24mm
    }

    #[test]
    fn test_deflection_reliability() {
        let params = DeflectionRandomVariables::default();
        let limit = 0.024;  // 24mm
        
        let dr = DeflectionReliability::new(params, limit);
        let result = dr.form_analysis();

        // Should have positive beta for reasonable design
        assert!(result.beta > 0.0);
        println!("Deflection β = {:.2}, Pf = {:.2e}", result.beta, result.pf);
    }

    #[test]
    fn test_crack_width_reliability() {
        let params = CrackWidthParams::default();
        let limit = 0.3;  // 0.3mm per EN 1992-1-1
        
        let cwr = CrackWidthReliability::new(params, limit);
        let result = cwr.monte_carlo(10000);

        println!("Crack width β = {:.2}, mean w = {:.3}mm", result.beta, result.mean_crack_width);
        assert!(result.mean_crack_width < result.limit);
    }
}
