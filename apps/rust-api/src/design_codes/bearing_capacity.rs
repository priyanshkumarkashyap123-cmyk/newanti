//! Bearing Capacity (Geotechnical) — Terzaghi Strip Footing
//!
//! Ultimate and allowable bearing pressure estimates for strip footings in
//! homogeneous soil (general shear assumption).
//!
//! References:
//! - Terzaghi, K. (1943), Theoretical Soil Mechanics
//! - Bowles, Foundation Analysis and Design

use serde::{Deserialize, Serialize};

const DEG_TO_RAD: f64 = std::f64::consts::PI / 180.0;
const DEFAULT_FS: f64 = 3.0;

/// Input for Terzaghi strip footing bearing-capacity check.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct TerzaghiStripInput {
    /// Effective cohesion c' (kPa)
    pub cohesion_kpa: f64,
    /// Effective friction angle φ' (deg)
    pub friction_angle_deg: f64,
    /// Soil unit weight γ (kN/m³)
    pub unit_weight_kn_m3: f64,
    /// Footing width B (m)
    pub footing_width_m: f64,
    /// Embedment depth Df (m)
    pub embedment_depth_m: f64,
    /// Applied service pressure q_service (kPa)
    pub applied_pressure_kpa: f64,
    /// Global factor of safety for allowable capacity (default 3.0)
    pub safety_factor: Option<f64>,
}

/// Result for strip footing bearing-capacity check.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerzaghiStripResult {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    pub source: String,
    /// Overburden surcharge at footing base q = γDf (kPa)
    pub surcharge_q_kpa: f64,
    /// Ultimate bearing capacity qult (kPa)
    pub q_ult_kpa: f64,
    /// Net ultimate capacity qnu = qult - q (kPa)
    pub q_net_ult_kpa: f64,
    /// Net allowable capacity qna = qnu / FS (kPa)
    pub q_net_allow_kpa: f64,
    /// Gross allowable capacity qallow = qna + q (kPa)
    pub q_allow_kpa: f64,
    /// Terzaghi factors
    pub n_c: f64,
    pub n_q: f64,
    pub n_gamma: f64,
}

/// Terzaghi strip footing bearing capacity.
///
/// Equation (general shear):
/// - qult = c'Nc + qNq + 0.5γBNγ
/// - q = γDf
/// - qallow = (qult - q)/FS + q
pub fn check_terzaghi_strip(input: &TerzaghiStripInput) -> Result<TerzaghiStripResult, String> {
    if input.cohesion_kpa < 0.0 {
        return Err("cohesion_kpa must be >= 0".to_string());
    }
    if input.friction_angle_deg < 0.0 || input.friction_angle_deg > 50.0 {
        return Err("friction_angle_deg must be in [0, 50]".to_string());
    }
    if input.unit_weight_kn_m3 <= 0.0 {
        return Err("unit_weight_kn_m3 must be > 0".to_string());
    }
    if input.footing_width_m <= 0.0 {
        return Err("footing_width_m must be > 0".to_string());
    }
    if input.embedment_depth_m < 0.0 {
        return Err("embedment_depth_m must be >= 0".to_string());
    }
    if input.applied_pressure_kpa < 0.0 {
        return Err("applied_pressure_kpa must be >= 0".to_string());
    }

    let fs = input.safety_factor.unwrap_or(DEFAULT_FS);
    if fs <= 1.0 {
        return Err("safety_factor must be > 1.0".to_string());
    }

    let phi = input.friction_angle_deg * DEG_TO_RAD;

    // Bearing capacity factors (Terzaghi)
    let n_q = if input.friction_angle_deg.abs() <= f64::EPSILON {
        1.0
    } else {
        ((std::f64::consts::PI * phi.tan()).exp()) * (std::f64::consts::FRAC_PI_4 + phi / 2.0).tan().powi(2)
    };
    let n_c = if input.friction_angle_deg.abs() <= f64::EPSILON {
        5.7
    } else {
        (n_q - 1.0) / phi.tan()
    };
    let n_gamma = if input.friction_angle_deg.abs() <= f64::EPSILON {
        0.0
    } else {
        2.0 * (n_q + 1.0) * phi.tan()
    };

    let surcharge_q_kpa = input.unit_weight_kn_m3 * input.embedment_depth_m;
    let q_ult_kpa = input.cohesion_kpa * n_c
        + surcharge_q_kpa * n_q
        + 0.5 * input.unit_weight_kn_m3 * input.footing_width_m * n_gamma;

    let q_net_ult_kpa = (q_ult_kpa - surcharge_q_kpa).max(0.0);
    let q_net_allow_kpa = q_net_ult_kpa / fs;
    let q_allow_kpa = q_net_allow_kpa + surcharge_q_kpa;

    let passed = input.applied_pressure_kpa <= q_allow_kpa;
    let utilization = if q_allow_kpa > f64::EPSILON {
        input.applied_pressure_kpa / q_allow_kpa
    } else {
        99.0
    };

    let source = "Terzaghi strip footing bearing capacity (Terzaghi 1943; Bowles)".to_string();
    let message = format!(
        "Bearing capacity ({source}): q_allow={q_allow_kpa:.2} kPa, q_applied={:.2} kPa, FS={fs:.2}, qult={q_ult_kpa:.2} kPa.",
        input.applied_pressure_kpa
    );

    Ok(TerzaghiStripResult {
        passed,
        utilization,
        message,
        source,
        surcharge_q_kpa,
        q_ult_kpa,
        q_net_ult_kpa,
        q_net_allow_kpa,
        q_allow_kpa,
        n_c,
        n_q,
        n_gamma,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bearing_capacity_typical_pass() {
        let input = TerzaghiStripInput {
            cohesion_kpa: 0.0,
            friction_angle_deg: 32.0,
            unit_weight_kn_m3: 18.0,
            footing_width_m: 2.0,
            embedment_depth_m: 1.5,
            applied_pressure_kpa: 220.0,
            safety_factor: Some(3.0),
        };
        let r = check_terzaghi_strip(&input).expect("valid input");
        assert!(r.q_allow_kpa > 0.0);
        assert!(r.passed);
    }

    #[test]
    fn test_bearing_capacity_fail_high_demand() {
        let input = TerzaghiStripInput {
            cohesion_kpa: 5.0,
            friction_angle_deg: 25.0,
            unit_weight_kn_m3: 17.5,
            footing_width_m: 1.2,
            embedment_depth_m: 1.0,
            applied_pressure_kpa: 900.0,
            safety_factor: Some(3.0),
        };
        let r = check_terzaghi_strip(&input).expect("valid input");
        assert!(!r.passed);
        assert!(r.utilization > 1.0);
    }

    #[test]
    fn test_bearing_capacity_invalid_phi() {
        let input = TerzaghiStripInput {
            cohesion_kpa: 0.0,
            friction_angle_deg: 55.0,
            unit_weight_kn_m3: 18.0,
            footing_width_m: 1.5,
            embedment_depth_m: 1.2,
            applied_pressure_kpa: 100.0,
            safety_factor: None,
        };
        assert!(check_terzaghi_strip(&input).is_err());
    }
}
