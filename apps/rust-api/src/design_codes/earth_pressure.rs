//! Earth Pressure (Geotechnical) — Rankine Coefficients and Resultants
//!
//! Computes active, at-rest, and passive lateral earth pressure for level backfill.
//!
//! References:
//! - Rankine earth pressure theory
//! - Jaky at-rest coefficient K0 = 1 - sinφ

use serde::{Deserialize, Serialize};

const DEG_TO_RAD: f64 = std::f64::consts::PI / 180.0;

/// Input for Rankine earth pressure computation.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct RankineEarthPressureInput {
    /// Backfill friction angle φ (deg)
    pub friction_angle_deg: f64,
    /// Backfill unit weight γ (kN/m³)
    pub unit_weight_kn_m3: f64,
    /// Retained height H (m)
    pub retained_height_m: f64,
    /// Uniform surcharge q (kPa)
    pub surcharge_kpa: Option<f64>,
}

/// Earth pressure output for active/at-rest/passive states.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RankineEarthPressureResult {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    pub source: String,
    /// Rankine active coefficient Ka
    pub ka: f64,
    /// Jaky at-rest coefficient K0
    pub k0: f64,
    /// Rankine passive coefficient Kp
    pub kp: f64,
    /// Total active thrust Pa (kN/m)
    pub pa_kn_per_m: f64,
    /// Total at-rest thrust P0 (kN/m)
    pub p0_kn_per_m: f64,
    /// Total passive thrust Pp (kN/m)
    pub pp_kn_per_m: f64,
    /// Active resultant location above base (m)
    pub pa_resultant_height_m: f64,
    /// At-rest resultant location above base (m)
    pub p0_resultant_height_m: f64,
    /// Passive resultant location above base (m)
    pub pp_resultant_height_m: f64,
}

/// Compute Rankine earth pressures for level backfill.
///
/// Equations:
/// - Ka = (1 - sinφ)/(1 + sinφ)
/// - Kp = (1 + sinφ)/(1 - sinφ)
/// - K0 = 1 - sinφ
/// - P = 0.5 KγH² + KqH
/// - ȳ = H * (KγH/6 + Kq/2) / (0.5 KγH + Kq)
pub fn compute_rankine_earth_pressure(
    input: &RankineEarthPressureInput,
) -> Result<RankineEarthPressureResult, String> {
    if input.friction_angle_deg <= 0.0 || input.friction_angle_deg >= 50.0 {
        return Err("friction_angle_deg must be > 0 and < 50".to_string());
    }
    if input.unit_weight_kn_m3 <= 0.0 {
        return Err("unit_weight_kn_m3 must be > 0".to_string());
    }
    if input.retained_height_m <= 0.0 {
        return Err("retained_height_m must be > 0".to_string());
    }

    let surcharge_kpa = input.surcharge_kpa.unwrap_or(0.0);
    if surcharge_kpa < 0.0 {
        return Err("surcharge_kpa must be >= 0".to_string());
    }

    let phi = input.friction_angle_deg * DEG_TO_RAD;
    let sin_phi = phi.sin();

    let ka = (1.0 - sin_phi) / (1.0 + sin_phi);
    let kp = (1.0 + sin_phi) / (1.0 - sin_phi);
    let k0 = 1.0 - sin_phi;

    let h = input.retained_height_m;
    let gamma = input.unit_weight_kn_m3;

    let pa_kn_per_m = resultant_for_k(ka, gamma, h, surcharge_kpa);
    let p0_kn_per_m = resultant_for_k(k0, gamma, h, surcharge_kpa);
    let pp_kn_per_m = resultant_for_k(kp, gamma, h, surcharge_kpa);

    let pa_resultant_height_m = resultant_height_for_k(ka, gamma, h, surcharge_kpa);
    let p0_resultant_height_m = resultant_height_for_k(k0, gamma, h, surcharge_kpa);
    let pp_resultant_height_m = resultant_height_for_k(kp, gamma, h, surcharge_kpa);

    let source = "Rankine pressure coefficients with Jaky K0".to_string();
    let message = format!(
        "Earth pressure ({source}): Ka={ka:.3}, K0={k0:.3}, Kp={kp:.3}, Pa={pa_kn_per_m:.1} kN/m @ y={pa_resultant_height_m:.2} m.",
    );

    Ok(RankineEarthPressureResult {
        passed: true,
        utilization: 0.0,
        message,
        source,
        ka,
        k0,
        kp,
        pa_kn_per_m,
        p0_kn_per_m,
        pp_kn_per_m,
        pa_resultant_height_m,
        p0_resultant_height_m,
        pp_resultant_height_m,
    })
}

fn resultant_for_k(k: f64, gamma: f64, h: f64, surcharge_kpa: f64) -> f64 {
    0.5 * k * gamma * h * h + k * surcharge_kpa * h
}

fn resultant_height_for_k(k: f64, gamma: f64, h: f64, surcharge_kpa: f64) -> f64 {
    let denominator = 0.5 * k * gamma * h + k * surcharge_kpa;
    if denominator <= f64::EPSILON {
        return h / 3.0;
    }

    h * ((k * gamma * h / 6.0) + (k * surcharge_kpa / 2.0)) / denominator
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rankine_coefficients_ordering() {
        let input = RankineEarthPressureInput {
            friction_angle_deg: 30.0,
            unit_weight_kn_m3: 18.0,
            retained_height_m: 5.0,
            surcharge_kpa: Some(10.0),
        };

        let r = compute_rankine_earth_pressure(&input).expect("valid input");
        assert!(r.ka < r.k0 && r.k0 < r.kp);
        assert!(r.pa_kn_per_m < r.p0_kn_per_m && r.p0_kn_per_m < r.pp_kn_per_m);
    }

    #[test]
    fn test_surcharge_increases_pa() {
        let base = RankineEarthPressureInput {
            friction_angle_deg: 32.0,
            unit_weight_kn_m3: 18.5,
            retained_height_m: 4.0,
            surcharge_kpa: Some(0.0),
        };
        let loaded = RankineEarthPressureInput {
            surcharge_kpa: Some(20.0),
            ..base
        };

        let r1 = compute_rankine_earth_pressure(&base).expect("base case");
        let r2 = compute_rankine_earth_pressure(&loaded).expect("loaded case");
        assert!(r2.pa_kn_per_m > r1.pa_kn_per_m);
    }

    #[test]
    fn test_invalid_phi_rejected() {
        let input = RankineEarthPressureInput {
            friction_angle_deg: 55.0,
            unit_weight_kn_m3: 18.0,
            retained_height_m: 5.0,
            surcharge_kpa: Some(0.0),
        };

        assert!(compute_rankine_earth_pressure(&input).is_err());
    }
}
