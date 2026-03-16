//! Slope Stability (Geotechnical) — Infinite Slope Method
//!
//! Provides a practical factor-of-safety check for translational failure along
//! a plane parallel to slope surface.
//!
//! Method reference:
//! - Das & Sobhan, Principles of Geotechnical Engineering (Infinite slope)
//! - Duncan, Wright & Brandon, Soil Strength and Slope Stability

use serde::{Deserialize, Serialize};

const DEG_TO_RAD: f64 = std::f64::consts::PI / 180.0;
const DEFAULT_REQUIRED_FS: f64 = 1.50;

/// Input for infinite slope stability check (drained effective stress approach).
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct InfiniteSlopeInput {
    /// Slope angle β (deg)
    pub slope_angle_deg: f64,
    /// Effective friction angle φ' (deg)
    pub friction_angle_deg: f64,
    /// Effective cohesion c' (kPa)
    pub cohesion_kpa: f64,
    /// Soil unit weight γ (kN/m³)
    pub unit_weight_kn_m3: f64,
    /// Failure plane depth z normal to ground (m)
    pub depth_m: f64,
    /// Pore pressure ratio ru = u / (γ z cos²β), [0, 1)
    pub ru: Option<f64>,
    /// Required minimum factor of safety (default 1.50)
    pub required_fs: Option<f64>,
}

/// Result of infinite slope stability check.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InfiniteSlopeResult {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    /// Source citation used in formulation
    pub source: String,
    /// Computed factor of safety FS = resisting / driving
    pub fs: f64,
    /// Required minimum factor of safety
    pub required_fs: f64,
    /// Driving shear stress τd (kPa)
    pub driving_shear_kpa: f64,
    /// Resisting shear strength τr (kPa)
    pub resisting_shear_kpa: f64,
    /// Effective normal stress σ'n (kPa)
    pub effective_normal_stress_kpa: f64,
}

/// Infinite slope factor of safety (drained, effective stress).
///
/// Equation:
/// - τd = γ z sinβ cosβ
/// - σ'n = γ z cos²β (1 - ru)
/// - τr = c' + σ'n tanφ'
/// - FS = τr / τd
pub fn check_infinite_slope(input: &InfiniteSlopeInput) -> Result<InfiniteSlopeResult, String> {
    if input.slope_angle_deg <= 0.0 || input.slope_angle_deg >= 89.0 {
        return Err("slope_angle_deg must be > 0 and < 89".to_string());
    }
    if input.friction_angle_deg <= 0.0 || input.friction_angle_deg >= 60.0 {
        return Err("friction_angle_deg must be > 0 and < 60".to_string());
    }
    if input.cohesion_kpa < 0.0 {
        return Err("cohesion_kpa must be >= 0".to_string());
    }
    if input.unit_weight_kn_m3 <= 0.0 {
        return Err("unit_weight_kn_m3 must be > 0".to_string());
    }
    if input.depth_m <= 0.0 {
        return Err("depth_m must be > 0".to_string());
    }

    let ru = input.ru.unwrap_or(0.0);
    if !(0.0..1.0).contains(&ru) {
        return Err("ru must be in [0, 1)".to_string());
    }

    let required_fs = input.required_fs.unwrap_or(DEFAULT_REQUIRED_FS);
    if required_fs <= 0.0 {
        return Err("required_fs must be > 0".to_string());
    }

    let beta = input.slope_angle_deg * DEG_TO_RAD;
    let phi = input.friction_angle_deg * DEG_TO_RAD;

    let gamma_z = input.unit_weight_kn_m3 * input.depth_m; // kPa
    let driving_shear_kpa = gamma_z * beta.sin() * beta.cos();
    if driving_shear_kpa <= f64::EPSILON {
        return Err("driving shear stress is near zero; check slope/depth inputs".to_string());
    }

    let effective_normal_stress_kpa = gamma_z * beta.cos() * beta.cos() * (1.0 - ru);
    let resisting_shear_kpa = input.cohesion_kpa + effective_normal_stress_kpa * phi.tan();
    let fs = resisting_shear_kpa / driving_shear_kpa;

    let passed = fs >= required_fs;
    let utilization = (required_fs / fs).max(0.0);
    let source = "Infinite slope method (Das & Sobhan; Duncan-Wright-Brandon)".to_string();
    let message = format!(
        "Infinite slope stability ({source}): FS={fs:.3}, required={required_fs:.2}, τd={driving_shear_kpa:.2} kPa, τr={resisting_shear_kpa:.2} kPa, σ'n={effective_normal_stress_kpa:.2} kPa.",
    );

    Ok(InfiniteSlopeResult {
        passed,
        utilization,
        message,
        source,
        fs,
        required_fs,
        driving_shear_kpa,
        resisting_shear_kpa,
        effective_normal_stress_kpa,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_infinite_slope_stable_case() {
        let input = InfiniteSlopeInput {
            slope_angle_deg: 26.0,
            friction_angle_deg: 34.0,
            cohesion_kpa: 8.0,
            unit_weight_kn_m3: 19.0,
            depth_m: 2.0,
            ru: Some(0.15),
            required_fs: Some(1.30),
        };

        let r = check_infinite_slope(&input).expect("valid input should evaluate");
        assert!(r.fs > 1.0);
        assert!(r.passed);
    }

    #[test]
    fn test_infinite_slope_unstable_high_ru() {
        let input = InfiniteSlopeInput {
            slope_angle_deg: 34.0,
            friction_angle_deg: 28.0,
            cohesion_kpa: 2.0,
            unit_weight_kn_m3: 19.0,
            depth_m: 3.0,
            ru: Some(0.65),
            required_fs: Some(1.50),
        };

        let r = check_infinite_slope(&input).expect("valid input should evaluate");
        assert!(!r.passed);
        assert!(r.fs < 1.5);
    }

    #[test]
    fn test_infinite_slope_invalid_ru() {
        let input = InfiniteSlopeInput {
            slope_angle_deg: 30.0,
            friction_angle_deg: 30.0,
            cohesion_kpa: 5.0,
            unit_weight_kn_m3: 18.0,
            depth_m: 2.0,
            ru: Some(1.1),
            required_fs: None,
        };

        assert!(check_infinite_slope(&input).is_err());
    }

    #[test]
    fn test_fs_decreases_with_ru() {
        let base = InfiniteSlopeInput {
            slope_angle_deg: 28.0,
            friction_angle_deg: 32.0,
            cohesion_kpa: 6.0,
            unit_weight_kn_m3: 19.5,
            depth_m: 2.5,
            ru: Some(0.1),
            required_fs: None,
        };
        let wet = InfiniteSlopeInput {
            ru: Some(0.5),
            ..base
        };

        let r1 = check_infinite_slope(&base).expect("base case");
        let r2 = check_infinite_slope(&wet).expect("wet case");
        assert!(r2.fs < r1.fs);
    }
}
