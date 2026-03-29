//! Consolidation Settlement — Geotechnical Serviceability
//!
//! One-dimensional primary consolidation settlement and time-rate estimate.
//!
//! References:
//! - Terzaghi 1D consolidation theory
//! - Das & Sobhan, Geotechnical Engineering

use serde::{Deserialize, Serialize};

const DEFAULT_SETTLEMENT_LIMIT_MM: f64 = 50.0;

/// Input for primary consolidation settlement.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ConsolidationSettlementInput {
    /// Compressible layer thickness H (m)
    pub layer_thickness_m: f64,
    /// Initial void ratio e0
    pub initial_void_ratio: f64,
    /// Compression index Cc
    pub compression_index: f64,
    /// Initial effective vertical stress σ'0 (kPa)
    pub initial_effective_stress_kpa: f64,
    /// Stress increment Δσ' at layer center (kPa)
    pub stress_increment_kpa: f64,
    /// Drainage path Hdr (m) — H/2 for double drainage, H for single
    pub drainage_path_m: f64,
    /// Coefficient of consolidation Cv (m²/year)
    pub cv_m2_per_year: f64,
    /// Time since load application (years)
    pub time_years: f64,
    /// Serviceability limit (mm), default 50 mm
    pub required_max_settlement_mm: Option<f64>,
}

/// Result for consolidation settlement check.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsolidationSettlementResult {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    pub source: String,
    /// Ultimate primary consolidation settlement Sc∞ (mm)
    pub ultimate_settlement_mm: f64,
    /// Time factor Tv
    pub time_factor_tv: f64,
    /// Average degree of consolidation U (0–1)
    pub degree_of_consolidation: f64,
    /// Settlement at time t (mm)
    pub settlement_at_time_mm: f64,
    /// Limit for serviceability (mm)
    pub required_max_settlement_mm: f64,
}

/// Compute primary consolidation settlement and time-rate.
///
/// Equations:
/// - Sc∞ = H * Cc/(1+e0) * log10((σ'0 + Δσ')/σ'0)
/// - Tv = Cv t / Hdr²
/// - U(Tv) ≈ (2/√π)√Tv for Tv < 0.287, else U ≈ 1 - exp(-π² Tv / 4)
/// - Sc(t) = U * Sc∞
pub fn check_consolidation_settlement(
    input: &ConsolidationSettlementInput,
) -> Result<ConsolidationSettlementResult, String> {
    if input.layer_thickness_m <= 0.0 {
        return Err("layer_thickness_m must be > 0".to_string());
    }
    if input.initial_void_ratio <= 0.0 {
        return Err("initial_void_ratio must be > 0".to_string());
    }
    if input.compression_index <= 0.0 {
        return Err("compression_index must be > 0".to_string());
    }
    if input.initial_effective_stress_kpa <= 0.0 {
        return Err("initial_effective_stress_kpa must be > 0".to_string());
    }
    if input.stress_increment_kpa <= 0.0 {
        return Err("stress_increment_kpa must be > 0".to_string());
    }
    if input.drainage_path_m <= 0.0 {
        return Err("drainage_path_m must be > 0".to_string());
    }
    if input.cv_m2_per_year <= 0.0 {
        return Err("cv_m2_per_year must be > 0".to_string());
    }
    if input.time_years < 0.0 {
        return Err("time_years must be >= 0".to_string());
    }

    let ratio = (input.initial_effective_stress_kpa + input.stress_increment_kpa)
        / input.initial_effective_stress_kpa;
    if ratio <= 1.0 {
        return Err("stress ratio must be > 1".to_string());
    }

    let sc_ultimate_m = input.layer_thickness_m
        * (input.compression_index / (1.0 + input.initial_void_ratio))
        * ratio.log10();
    let ultimate_settlement_mm = sc_ultimate_m * 1000.0;

    let time_factor_tv =
        input.cv_m2_per_year * input.time_years / (input.drainage_path_m * input.drainage_path_m);

    let degree_of_consolidation = if time_factor_tv <= 0.0 {
        0.0
    } else if time_factor_tv < 0.287 {
        (2.0 / std::f64::consts::PI.sqrt()) * time_factor_tv.sqrt()
    } else {
        1.0 - (-(std::f64::consts::PI * std::f64::consts::PI) * time_factor_tv / 4.0).exp()
    }
    .clamp(0.0, 1.0);

    let settlement_at_time_mm = degree_of_consolidation * ultimate_settlement_mm;
    let required_max_settlement_mm = input
        .required_max_settlement_mm
        .unwrap_or(DEFAULT_SETTLEMENT_LIMIT_MM);
    if required_max_settlement_mm <= 0.0 {
        return Err("required_max_settlement_mm must be > 0".to_string());
    }

    let passed = settlement_at_time_mm <= required_max_settlement_mm;
    let utilization = settlement_at_time_mm / required_max_settlement_mm;

    let source = "Terzaghi 1D consolidation settlement".to_string();
    let message = format!(
        "Settlement ({source}): Sc∞={ultimate_settlement_mm:.1} mm, U={degree_of_consolidation:.3}, Sc(t)={settlement_at_time_mm:.1} mm, limit={required_max_settlement_mm:.1} mm.",
    );

    Ok(ConsolidationSettlementResult {
        passed,
        utilization,
        message,
        source,
        ultimate_settlement_mm,
        time_factor_tv,
        degree_of_consolidation,
        settlement_at_time_mm,
        required_max_settlement_mm,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_settlement_typical_case() {
        let input = ConsolidationSettlementInput {
            layer_thickness_m: 4.0,
            initial_void_ratio: 0.9,
            compression_index: 0.28,
            initial_effective_stress_kpa: 100.0,
            stress_increment_kpa: 60.0,
            drainage_path_m: 2.0,
            cv_m2_per_year: 1.2,
            time_years: 2.0,
            required_max_settlement_mm: Some(75.0),
        };

        let r = check_consolidation_settlement(&input).expect("valid input");
        assert!(r.ultimate_settlement_mm > 0.0);
        assert!(r.degree_of_consolidation > 0.0);
    }

    #[test]
    fn test_settlement_fails_tight_limit() {
        let input = ConsolidationSettlementInput {
            layer_thickness_m: 6.0,
            initial_void_ratio: 1.1,
            compression_index: 0.35,
            initial_effective_stress_kpa: 80.0,
            stress_increment_kpa: 90.0,
            drainage_path_m: 3.0,
            cv_m2_per_year: 0.8,
            time_years: 5.0,
            required_max_settlement_mm: Some(20.0),
        };

        let r = check_consolidation_settlement(&input).expect("valid input");
        assert!(!r.passed);
        assert!(r.utilization > 1.0);
    }

    #[test]
    fn test_invalid_input_rejected() {
        let input = ConsolidationSettlementInput {
            layer_thickness_m: 0.0,
            initial_void_ratio: 1.0,
            compression_index: 0.2,
            initial_effective_stress_kpa: 100.0,
            stress_increment_kpa: 50.0,
            drainage_path_m: 2.0,
            cv_m2_per_year: 1.0,
            time_years: 1.0,
            required_max_settlement_mm: None,
        };
        assert!(check_consolidation_settlement(&input).is_err());
    }
}
