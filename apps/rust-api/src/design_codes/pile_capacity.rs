//! Axial Pile Capacity (Geotechnical) — Static Analysis Method
//!
//! Estimates axial compressive pile capacity from shaft + base resistance.
//!
//! References:
//! - IS 2911 (Part 1): Pile foundations — static load design philosophy
//! - Tomlinson & Woodward, Pile Design and Construction Practice

use serde::{Deserialize, Serialize};

/// Pile axial capacity version selector for draft toggles
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum PileAxialCapacityVersion {
    /// Production provisions
    VCurrent,
    /// Draft pile axial capacity 2025 (sandbox mode)
    V2025Sandbox,
}

/// Sandbox warning for pile axial capacity 2025
pub const SANDBOX_WARNING_PILE_AXIAL_CAPACITY_2025: &str =
    "DRAFT — Pile axial capacity 2025 provisions are in sandbox mode and non-enforceable.";

const DEFAULT_FS: f64 = 2.5;

/// Input for axial pile capacity check.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct PileAxialCapacityInput {
    /// Pile diameter/width D (m)
    pub diameter_m: f64,
    /// Embedded length L (m)
    pub length_m: f64,
    /// Average unit shaft resistance fs (kPa)
    pub unit_skin_friction_kpa: f64,
    /// Unit base resistance qb (kPa)
    pub unit_end_bearing_kpa: f64,
    /// Applied service axial compression load (kN)
    pub applied_load_kn: f64,
    /// Global factor of safety for allowable load (default 2.5)
    pub safety_factor: Option<f64>,
}

/// Result for axial pile capacity check.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PileAxialCapacityResult {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    pub source: String,
    /// Shaft area As = πDL (m²)
    pub shaft_area_m2: f64,
    /// Base area Ab = πD²/4 (m²)
    pub base_area_m2: f64,
    /// Ultimate shaft resistance Qs (kN)
    pub qs_ult_kn: f64,
    /// Ultimate base resistance Qb (kN)
    pub qb_ult_kn: f64,
    /// Total ultimate resistance Qult (kN)
    pub q_ult_kn: f64,
    /// Allowable axial compression resistance Qall (kN)
    pub q_allow_kn: f64,
    /// Governing factor of safety
    pub safety_factor: f64,
}

/// Check pile axial compression capacity using static resistance components.
///
/// Equations:
/// - As = π D L
/// - Ab = π D² / 4
/// - Qs = fs As
/// - Qb = qb Ab
/// - Qult = Qs + Qb
/// - Qall = Qult / FS
pub fn check_pile_axial_capacity(
    input: &PileAxialCapacityInput,
) -> Result<PileAxialCapacityResult, String> {
    if input.diameter_m <= 0.0 {
        return Err("diameter_m must be > 0".to_string());
    }
    if input.length_m <= 0.0 {
        return Err("length_m must be > 0".to_string());
    }
    if input.unit_skin_friction_kpa <= 0.0 {
        return Err("unit_skin_friction_kpa must be > 0".to_string());
    }
    if input.unit_end_bearing_kpa <= 0.0 {
        return Err("unit_end_bearing_kpa must be > 0".to_string());
    }
    if input.applied_load_kn < 0.0 {
        return Err("applied_load_kn must be >= 0".to_string());
    }

    let safety_factor = input.safety_factor.unwrap_or(DEFAULT_FS);
    if safety_factor <= 1.0 {
        return Err("safety_factor must be > 1.0".to_string());
    }

    let shaft_area_m2 = std::f64::consts::PI * input.diameter_m * input.length_m;
    let base_area_m2 = std::f64::consts::PI * input.diameter_m * input.diameter_m / 4.0;

    // kPa * m² = kN
    let qs_ult_kn = input.unit_skin_friction_kpa * shaft_area_m2;
    let qb_ult_kn = input.unit_end_bearing_kpa * base_area_m2;
    let q_ult_kn = qs_ult_kn + qb_ult_kn;
    let q_allow_kn = q_ult_kn / safety_factor;

    let passed = input.applied_load_kn <= q_allow_kn;
    let utilization = if q_allow_kn > f64::EPSILON {
        input.applied_load_kn / q_allow_kn
    } else {
        99.0
    };

    let source = "Static pile capacity components (IS 2911 design practice)".to_string();
    let message = format!(
        "Pile axial capacity ({source}): Qall={q_allow_kn:.1} kN, applied={:.1} kN, Qs={qs_ult_kn:.1} kN, Qb={qb_ult_kn:.1} kN, FS={safety_factor:.2}.",
        input.applied_load_kn
    );

    Ok(PileAxialCapacityResult {
        passed,
        utilization,
        message,
        source,
        shaft_area_m2,
        base_area_m2,
        qs_ult_kn,
        qb_ult_kn,
        q_ult_kn,
        q_allow_kn,
        safety_factor,
    })
}

/// Version-aware pile axial capacity check
pub fn check_pile_axial_capacity_with_version(
    input: &PileAxialCapacityInput,
    version: PileAxialCapacityVersion,
) -> Result<PileAxialCapacityResult, String> {
    let res = check_pile_axial_capacity(input);
    if matches!(version, PileAxialCapacityVersion::V2025Sandbox) {
        eprintln!("{}", SANDBOX_WARNING_PILE_AXIAL_CAPACITY_2025);
    }
    res
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pile_capacity_pass_case() {
        let input = PileAxialCapacityInput {
            diameter_m: 0.6,
            length_m: 18.0,
            unit_skin_friction_kpa: 55.0,
            unit_end_bearing_kpa: 1800.0,
            applied_load_kn: 900.0,
            safety_factor: Some(2.5),
        };

        let r = check_pile_axial_capacity(&input).expect("valid input");
        assert!(r.q_allow_kn > 0.0);
        assert!(r.passed);
    }

    #[test]
    fn test_pile_capacity_fail_case() {
        let input = PileAxialCapacityInput {
            diameter_m: 0.4,
            length_m: 10.0,
            unit_skin_friction_kpa: 35.0,
            unit_end_bearing_kpa: 900.0,
            applied_load_kn: 1500.0,
            safety_factor: Some(2.5),
        };

        let r = check_pile_axial_capacity(&input).expect("valid input");
        assert!(!r.passed);
        assert!(r.utilization > 1.0);
    }

    #[test]
    fn test_invalid_inputs_rejected() {
        let input = PileAxialCapacityInput {
            diameter_m: 0.0,
            length_m: 10.0,
            unit_skin_friction_kpa: 35.0,
            unit_end_bearing_kpa: 900.0,
            applied_load_kn: 100.0,
            safety_factor: None,
        };

        assert!(check_pile_axial_capacity(&input).is_err());
    }
}
