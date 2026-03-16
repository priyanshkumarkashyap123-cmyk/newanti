//! Retaining Wall Stability — Geotechnical Checks
//!
//! Performs preliminary external stability checks for cantilever/gravity retaining
//! walls under active earth pressure using Rankine theory.
//!
//! References:
//! - Rankine active earth pressure theory
//! - Das & Sobhan, Principles of Geotechnical Engineering

use serde::{Deserialize, Serialize};

const DEG_TO_RAD: f64 = std::f64::consts::PI / 180.0;
const DEFAULT_FS_OVERTURNING: f64 = 1.50;
const DEFAULT_FS_SLIDING: f64 = 1.50;

/// Input for retaining wall external stability check (per metre wall length).
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct RetainingWallInput {
    /// Retained height H (m)
    pub wall_height_m: f64,
    /// Backfill unit weight γ (kN/m³)
    pub backfill_unit_weight_kn_m3: f64,
    /// Backfill friction angle φ (deg)
    pub backfill_friction_angle_deg: f64,
    /// Uniform surcharge q on backfill (kPa)
    pub surcharge_kpa: f64,
    /// Base width B (m)
    pub base_width_m: f64,
    /// Total vertical stabilizing load W (kN/m), includes wall + soil over heel
    pub total_vertical_load_kn_per_m: f64,
    /// Total stabilizing moment about toe Mr (kN·m/m), excluding overturning moment
    pub stabilizing_moment_knm_per_m: f64,
    /// Base friction coefficient μ at foundation interface
    pub base_friction_coeff: f64,
    /// Allowable bearing pressure q_allow (kPa)
    pub allowable_bearing_kpa: f64,
    /// Required FS for overturning (default 1.50)
    pub required_fs_overturning: Option<f64>,
    /// Required FS for sliding (default 1.50)
    pub required_fs_sliding: Option<f64>,
}

/// Result of retaining wall stability checks.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetainingWallResult {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    pub source: String,
    /// Active earth pressure coefficient Ka
    pub ka: f64,
    /// Total active thrust Pa (kN/m)
    pub active_thrust_kn_per_m: f64,
    /// Overturning moment due to earth pressure Mo (kN·m/m)
    pub overturning_moment_knm_per_m: f64,
    /// Factor of safety against overturning
    pub fs_overturning: f64,
    /// Factor of safety against sliding
    pub fs_sliding: f64,
    /// Resultant location from toe x (m)
    pub resultant_from_toe_m: f64,
    /// Eccentricity from base centerline e (m)
    pub eccentricity_m: f64,
    /// Maximum bearing pressure at base qmax (kPa)
    pub qmax_kpa: f64,
    /// Minimum bearing pressure at base qmin (kPa)
    pub qmin_kpa: f64,
}

/// Check retaining wall external stability.
///
/// Formulation:
/// - Ka = (1 - sinφ)/(1 + sinφ)
/// - Pa = 0.5 Ka γ H² + Ka q H
/// - Mo = (0.5 Ka γ H²)(H/3) + (Ka q H)(H/2)
/// - FS_ot = Mr / Mo
/// - FS_sl = μW / Pa
/// - x = (Mr - Mo)/W, e = B/2 - x
/// - qmax,min = W/B * (1 ± 6e/B)
pub fn check_retaining_wall(input: &RetainingWallInput) -> Result<RetainingWallResult, String> {
    if input.wall_height_m <= 0.0 {
        return Err("wall_height_m must be > 0".to_string());
    }
    if input.backfill_unit_weight_kn_m3 <= 0.0 {
        return Err("backfill_unit_weight_kn_m3 must be > 0".to_string());
    }
    if input.backfill_friction_angle_deg <= 0.0 || input.backfill_friction_angle_deg >= 50.0 {
        return Err("backfill_friction_angle_deg must be > 0 and < 50".to_string());
    }
    if input.surcharge_kpa < 0.0 {
        return Err("surcharge_kpa must be >= 0".to_string());
    }
    if input.base_width_m <= 0.0 {
        return Err("base_width_m must be > 0".to_string());
    }
    if input.total_vertical_load_kn_per_m <= 0.0 {
        return Err("total_vertical_load_kn_per_m must be > 0".to_string());
    }
    if input.stabilizing_moment_knm_per_m <= 0.0 {
        return Err("stabilizing_moment_knm_per_m must be > 0".to_string());
    }
    if input.base_friction_coeff <= 0.0 {
        return Err("base_friction_coeff must be > 0".to_string());
    }
    if input.allowable_bearing_kpa <= 0.0 {
        return Err("allowable_bearing_kpa must be > 0".to_string());
    }

    let req_ot = input.required_fs_overturning.unwrap_or(DEFAULT_FS_OVERTURNING);
    let req_sl = input.required_fs_sliding.unwrap_or(DEFAULT_FS_SLIDING);
    if req_ot <= 0.0 || req_sl <= 0.0 {
        return Err("required factors of safety must be > 0".to_string());
    }

    let phi = input.backfill_friction_angle_deg * DEG_TO_RAD;
    let ka = (1.0 - phi.sin()) / (1.0 + phi.sin());

    let pa_soil = 0.5 * ka * input.backfill_unit_weight_kn_m3 * input.wall_height_m * input.wall_height_m;
    let pa_surcharge = ka * input.surcharge_kpa * input.wall_height_m;
    let active_thrust_kn_per_m = pa_soil + pa_surcharge;

    if active_thrust_kn_per_m <= f64::EPSILON {
        return Err("active thrust is near zero; check inputs".to_string());
    }

    let overturning_moment_knm_per_m =
        pa_soil * (input.wall_height_m / 3.0) + pa_surcharge * (input.wall_height_m / 2.0);

    let fs_overturning = input.stabilizing_moment_knm_per_m / overturning_moment_knm_per_m;
    let fs_sliding = (input.base_friction_coeff * input.total_vertical_load_kn_per_m) / active_thrust_kn_per_m;

    let resultant_from_toe_m =
        (input.stabilizing_moment_knm_per_m - overturning_moment_knm_per_m) / input.total_vertical_load_kn_per_m;
    let eccentricity_m = input.base_width_m / 2.0 - resultant_from_toe_m;

    let base_avg = input.total_vertical_load_kn_per_m / input.base_width_m; // kPa
    let qmax_kpa = base_avg * (1.0 + 6.0 * eccentricity_m / input.base_width_m);
    let qmin_kpa = base_avg * (1.0 - 6.0 * eccentricity_m / input.base_width_m);

    let pass_ot = fs_overturning >= req_ot;
    let pass_sl = fs_sliding >= req_sl;
    let pass_bearing = qmax_kpa <= input.allowable_bearing_kpa;
    let pass_no_tension = qmin_kpa >= 0.0;

    let passed = pass_ot && pass_sl && pass_bearing && pass_no_tension;

    let u_ot = req_ot / fs_overturning;
    let u_sl = req_sl / fs_sliding;
    let u_b = qmax_kpa / input.allowable_bearing_kpa;
    let u_tension = if qmin_kpa >= 0.0 { 0.0 } else { 1.0 + (-qmin_kpa / (base_avg + 1e-9)) };
    let utilization = u_ot.max(u_sl).max(u_b).max(u_tension).max(0.0);

    let source = "Rankine active earth pressure + external stability checks".to_string();
    let message = format!(
        "Retaining wall stability ({source}): FS_ot={fs_overturning:.2} (req {req_ot:.2}), FS_sl={fs_sliding:.2} (req {req_sl:.2}), qmax={qmax_kpa:.1} kPa (allow {allow:.1}), qmin={qmin_kpa:.1} kPa.",
        allow = input.allowable_bearing_kpa
    );

    Ok(RetainingWallResult {
        passed,
        utilization,
        message,
        source,
        ka,
        active_thrust_kn_per_m,
        overturning_moment_knm_per_m,
        fs_overturning,
        fs_sliding,
        resultant_from_toe_m,
        eccentricity_m,
        qmax_kpa,
        qmin_kpa,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_retaining_wall_stable_case() {
        let input = RetainingWallInput {
            wall_height_m: 5.0,
            backfill_unit_weight_kn_m3: 18.0,
            backfill_friction_angle_deg: 32.0,
            surcharge_kpa: 10.0,
            base_width_m: 3.5,
            total_vertical_load_kn_per_m: 320.0,
            stabilizing_moment_knm_per_m: 430.0,
            base_friction_coeff: 0.55,
            allowable_bearing_kpa: 260.0,
            required_fs_overturning: Some(1.5),
            required_fs_sliding: Some(1.5),
        };

        let r = check_retaining_wall(&input).expect("valid input");
        assert!(r.fs_overturning > 1.5);
        assert!(r.fs_sliding > 1.0);
    }

    #[test]
    fn test_retaining_wall_unstable_case() {
        let input = RetainingWallInput {
            wall_height_m: 6.0,
            backfill_unit_weight_kn_m3: 19.0,
            backfill_friction_angle_deg: 26.0,
            surcharge_kpa: 30.0,
            base_width_m: 2.5,
            total_vertical_load_kn_per_m: 180.0,
            stabilizing_moment_knm_per_m: 180.0,
            base_friction_coeff: 0.4,
            allowable_bearing_kpa: 180.0,
            required_fs_overturning: Some(1.5),
            required_fs_sliding: Some(1.5),
        };

        let r = check_retaining_wall(&input).expect("valid input");
        assert!(!r.passed);
        assert!(r.utilization > 1.0);
    }

    #[test]
    fn test_invalid_phi_rejected() {
        let input = RetainingWallInput {
            wall_height_m: 5.0,
            backfill_unit_weight_kn_m3: 18.0,
            backfill_friction_angle_deg: 55.0,
            surcharge_kpa: 0.0,
            base_width_m: 3.0,
            total_vertical_load_kn_per_m: 250.0,
            stabilizing_moment_knm_per_m: 300.0,
            base_friction_coeff: 0.5,
            allowable_bearing_kpa: 250.0,
            required_fs_overturning: None,
            required_fs_sliding: None,
        };
        assert!(check_retaining_wall(&input).is_err());
    }
}
