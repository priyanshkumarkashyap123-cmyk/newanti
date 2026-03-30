//! Seismic Earth Pressure (Geotechnical) — Pseudo-Static Increment
//!
//! Provides a practical seismic increment to active earth pressure for preliminary
//! retaining wall checks.
//!
//! References:
//! - Seed & Whitman (1970): practical seismic earth pressure increment
//! - Mononobe-Okabe framework (simplified engineering screening)

use serde::{Deserialize, Serialize};

/// Seismic earth pressure version selector for draft toggles
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum SeismicEarthPressureVersion {
    /// Production provisions
    VCurrent,
    /// Draft seismic earth pressure increment 2025 (sandbox mode)
    V2025Sandbox,
}

/// Sandbox warning for seismic earth pressure increment 2025
pub const SANDBOX_WARNING_SEISMIC_EARTH_PRESSURE_2025: &str =
    "DRAFT — Seismic earth pressure increment 2025 provisions are in sandbox mode and non-enforceable.";

/// Input for seismic earth pressure increment.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct SeismicEarthPressureInput {
    /// Backfill unit weight γ (kN/m³)
    pub unit_weight_kn_m3: f64,
    /// Retained height H (m)
    pub retained_height_m: f64,
    /// Horizontal seismic coefficient kh
    pub kh: f64,
    /// Vertical seismic coefficient kv (upward positive in this screening model)
    pub kv: Option<f64>,
    /// Static active thrust Pa_static (kN/m), typically from Rankine/COULOMB
    pub static_active_thrust_kn_per_m: f64,
}

/// Result for seismic earth pressure increment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeismicEarthPressureResult {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    pub source: String,
    /// Seismic active increment ΔPae (kN/m)
    pub delta_pae_kn_per_m: f64,
    /// Total seismic active thrust Pae = Pa + ΔPae (kN/m)
    pub pae_total_kn_per_m: f64,
    /// Assumed resultant height of increment above base (m), ~0.6H
    pub increment_resultant_height_m: f64,
    /// Combined resultant height above base (m)
    pub total_resultant_height_m: f64,
    /// kv used in computation
    pub kv_used: f64,
}

/// Compute pseudo-static seismic increment of active earth pressure.
///
/// Simplified engineering expression:
/// - ΔPae ≈ 0.375 * kh * (1 - kv) * γ * H²
/// - Pae,total = Pa,static + ΔPae
///
/// Notes:
/// - Increment resultant commonly taken at ~0.6H above base.
/// - Static component resultant assumed at H/3 above base.
pub fn check_seismic_earth_pressure(
    input: &SeismicEarthPressureInput,
) -> Result<SeismicEarthPressureResult, String> {
    if input.unit_weight_kn_m3 <= 0.0 {
        return Err("unit_weight_kn_m3 must be > 0".to_string());
    }
    if input.retained_height_m <= 0.0 {
        return Err("retained_height_m must be > 0".to_string());
    }
    if input.kh < 0.0 || input.kh > 0.6 {
        return Err("kh must be in [0, 0.6]".to_string());
    }
    if input.static_active_thrust_kn_per_m < 0.0 {
        return Err("static_active_thrust_kn_per_m must be >= 0".to_string());
    }

    let kv_used = input.kv.unwrap_or(0.0);
    if kv_used < -0.5 || kv_used > 0.5 {
        return Err("kv must be in [-0.5, 0.5]".to_string());
    }

    let gamma = input.unit_weight_kn_m3;
    let h = input.retained_height_m;

    let delta_pae_kn_per_m = 0.375 * input.kh * (1.0 - kv_used) * gamma * h * h;
    let pae_total_kn_per_m = input.static_active_thrust_kn_per_m + delta_pae_kn_per_m;

    let y_static = h / 3.0;
    let y_increment = 0.6 * h;
    let total_resultant_height_m = if pae_total_kn_per_m <= f64::EPSILON {
        y_static
    } else {
        (input.static_active_thrust_kn_per_m * y_static + delta_pae_kn_per_m * y_increment)
            / pae_total_kn_per_m
    };

    let source = "Seed-Whitman pseudo-static increment (Mononobe-Okabe screening)".to_string();
    let message = format!(
        "Seismic earth pressure ({source}): ΔPae={delta_pae_kn_per_m:.1} kN/m, Pae,total={pae_total_kn_per_m:.1} kN/m, y={total_resultant_height_m:.2} m above base.",
    );

    Ok(SeismicEarthPressureResult {
        passed: true,
        utilization: 0.0,
        message,
        source,
        delta_pae_kn_per_m,
        pae_total_kn_per_m,
        increment_resultant_height_m: y_increment,
        total_resultant_height_m,
        kv_used,
    })
}

/// Version-aware seismic earth pressure increment check
pub fn check_seismic_earth_pressure_with_version(
    input: &SeismicEarthPressureInput,
    version: SeismicEarthPressureVersion,
) -> Result<SeismicEarthPressureResult, String> {
    let res = check_seismic_earth_pressure(input);
    if matches!(version, SeismicEarthPressureVersion::V2025Sandbox) {
        eprintln!("{}", SANDBOX_WARNING_SEISMIC_EARTH_PRESSURE_2025);
    }
    res
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_seismic_increment_positive_for_nonzero_kh() {
        let input = SeismicEarthPressureInput {
            unit_weight_kn_m3: 18.0,
            retained_height_m: 6.0,
            kh: 0.15,
            kv: Some(0.0),
            static_active_thrust_kn_per_m: 120.0,
        };

        let r = check_seismic_earth_pressure(&input).expect("valid input");
        assert!(r.delta_pae_kn_per_m > 0.0);
        assert!(r.pae_total_kn_per_m > input.static_active_thrust_kn_per_m);
    }

    #[test]
    fn test_zero_kh_gives_no_increment() {
        let input = SeismicEarthPressureInput {
            unit_weight_kn_m3: 18.0,
            retained_height_m: 6.0,
            kh: 0.0,
            kv: Some(0.0),
            static_active_thrust_kn_per_m: 120.0,
        };

        let r = check_seismic_earth_pressure(&input).expect("valid input");
        assert!(r.delta_pae_kn_per_m.abs() < 1e-12);
        assert!((r.pae_total_kn_per_m - 120.0).abs() < 1e-9);
    }

    #[test]
    fn test_invalid_kh_rejected() {
        let input = SeismicEarthPressureInput {
            unit_weight_kn_m3: 18.0,
            retained_height_m: 6.0,
            kh: 0.9,
            kv: Some(0.0),
            static_active_thrust_kn_per_m: 120.0,
        };

        assert!(check_seismic_earth_pressure(&input).is_err());
    }
}
