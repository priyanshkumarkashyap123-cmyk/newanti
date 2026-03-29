//! SPT (Standard Penetration Test) Correlations — Geotechnical Utilities
//!
//! Empirical correlations for cohesionless (sandy) soils using SPT N60.
//! These are engineering estimates and must be used with judgement.
//!
//! Source references (empirical):
//! - Meyerhof (1956): penetration resistance vs relative density trends
//! - Bowles (1997): foundation modulus estimation ranges
//! - Kulhawy & Mayne (1990): practical geotechnical correlation guidance

use serde::{Deserialize, Serialize};

const N60_MIN_RELIABLE: f64 = 2.0;
const N60_MAX_RELIABLE: f64 = 60.0;
const PHI_MIN_DEG: f64 = 27.0;
const PHI_MAX_DEG: f64 = 42.0;
const DR_MIN_PERCENT: f64 = 5.0;
const DR_MAX_PERCENT: f64 = 95.0;
const ES_MIN_MPA: f64 = 5.0;

/// Soil consistency class based on SPT N60 (blows/300 mm).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum SoilConsistencyClass {
    VeryLoose,
    Loose,
    MediumDense,
    Dense,
    VeryDense,
}

/// Input for sandy-soil SPT correlations.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct SptCorrelationInput {
    /// Corrected SPT blow count, N60 (blows/300 mm)
    pub n60: f64,
    /// Fines content (%)
    pub fines_percent: Option<f64>,
    /// Groundwater table depth below ground level (m)
    pub groundwater_depth_m: Option<f64>,
}

/// Output from sandy-soil SPT correlations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SptCorrelationResult {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    /// Empirical source citation used for correlation
    pub source: String,
    /// Bounded N60 value used by calculations (blows/300 mm)
    pub n60_used: f64,
    /// Estimated friction angle, φ (degrees)
    pub phi_deg: f64,
    /// Estimated Young's modulus, Es (MPa)
    pub es_mpa: f64,
    /// Estimated relative density, Dr (%)
    pub relative_density_percent: f64,
    pub consistency: SoilConsistencyClass,
}

/// Classify sandy soil consistency from N60.
pub fn classify_consistency_from_n(n60: f64) -> SoilConsistencyClass {
    if n60 < 4.0 {
        SoilConsistencyClass::VeryLoose
    } else if n60 < 10.0 {
        SoilConsistencyClass::Loose
    } else if n60 < 30.0 {
        SoilConsistencyClass::MediumDense
    } else if n60 < 50.0 {
        SoilConsistencyClass::Dense
    } else {
        SoilConsistencyClass::VeryDense
    }
}

/// Correlate sandy soil properties from SPT N60.
///
/// Empirical (not codal) conservative bounded correlations:
/// - Dr(%) = clamp(16*sqrt(N60)-9, 5, 95)
/// - φ(°): piecewise bounded [27, 42]
/// - Es(MPa): piecewise multiplier of N60, lower-bounded
pub fn correlate_sandy_soil(input: &SptCorrelationInput) -> Result<SptCorrelationResult, String> {
    if input.n60 <= 0.0 {
        return Err("N60 must be > 0 blows/300 mm".to_string());
    }

    let n60_used = input.n60.clamp(N60_MIN_RELIABLE, N60_MAX_RELIABLE);

    // Relative density trend (Meyerhof-style)
    let dr = (16.0 * n60_used.sqrt() - 9.0).clamp(DR_MIN_PERCENT, DR_MAX_PERCENT);

    // Conservative φ piecewise trend
    let phi = if n60_used < 10.0 {
        27.0 + 0.30 * n60_used
    } else if n60_used < 30.0 {
        30.0 + 0.20 * n60_used
    } else {
        36.0 + 0.10 * n60_used
    }
    .clamp(PHI_MIN_DEG, PHI_MAX_DEG);

    // Conservative Es range multiplier
    let es = if n60_used < 10.0 {
        2.5 * n60_used
    } else if n60_used < 30.0 {
        3.2 * n60_used
    } else {
        4.0 * n60_used
    }
    .max(ES_MIN_MPA);

    let consistency = classify_consistency_from_n(n60_used);

    let mut cautions: Vec<String> = Vec::new();
    if let Some(fines) = input.fines_percent {
        if fines > 20.0 {
            cautions.push("fines > 20%: sandy-soil correlation reliability reduced".to_string());
        }
    }
    if let Some(gwt) = input.groundwater_depth_m {
        if gwt < 1.0 {
            cautions.push(
                "groundwater depth < 1 m: effective stress conditions may reduce confidence"
                    .to_string(),
            );
        }
    }

    let caution_text = if cautions.is_empty() {
        "".to_string()
    } else {
        format!(" Caution: {}.", cautions.join("; "))
    };

    let source = "Empirical correlations: Meyerhof (1956), Bowles (1997), Kulhawy & Mayne (1990)"
        .to_string();

    let message = format!(
        "SPT correlation ({source}): N60={n60_used:.1}, class={:?}, φ={phi:.1}°, Es={es:.1} MPa, Dr={dr:.1}%.
{caution_text}",
        consistency
    );

    Ok(SptCorrelationResult {
        passed: true,
        utilization: (dr / 100.0).clamp(0.0, 1.0),
        message,
        source,
        n60_used,
        phi_deg: phi,
        es_mpa: es,
        relative_density_percent: dr,
        consistency,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_mid_range_input() {
        let input = SptCorrelationInput {
            n60: 20.0,
            fines_percent: Some(10.0),
            groundwater_depth_m: Some(2.0),
        };
        let r = correlate_sandy_soil(&input).expect("valid input should pass");
        assert!(r.passed);
        assert!(r.phi_deg >= 30.0 && r.phi_deg <= 42.0);
        assert!(r.es_mpa > 40.0);
        assert!(r.relative_density_percent > 0.0);
    }

    #[test]
    fn test_low_input_floor_behavior() {
        let input = SptCorrelationInput {
            n60: 1.5,
            fines_percent: None,
            groundwater_depth_m: None,
        };
        let r = correlate_sandy_soil(&input).expect("N60>0 should pass with clamped value");
        assert!((r.n60_used - 2.0).abs() < 1e-9);
        assert!(r.phi_deg >= PHI_MIN_DEG);
        assert!(r.es_mpa >= ES_MIN_MPA);
    }

    #[test]
    fn test_high_input_cap_behavior() {
        let input = SptCorrelationInput {
            n60: 85.0,
            fines_percent: None,
            groundwater_depth_m: None,
        };
        let r = correlate_sandy_soil(&input).expect("valid should pass");
        assert!((r.n60_used - 60.0).abs() < 1e-9);
        assert!(r.phi_deg <= PHI_MAX_DEG);
        assert!(r.relative_density_percent <= DR_MAX_PERCENT);
    }

    #[test]
    fn test_invalid_n_error() {
        let input = SptCorrelationInput {
            n60: 0.0,
            fines_percent: None,
            groundwater_depth_m: None,
        };
        assert!(correlate_sandy_soil(&input).is_err());
    }

    #[test]
    fn test_monotonicity_phi_es() {
        let low = SptCorrelationInput {
            n60: 8.0,
            fines_percent: None,
            groundwater_depth_m: None,
        };
        let high = SptCorrelationInput {
            n60: 35.0,
            fines_percent: None,
            groundwater_depth_m: None,
        };
        let rl = correlate_sandy_soil(&low).expect("low should pass");
        let rh = correlate_sandy_soil(&high).expect("high should pass");
        assert!(rh.phi_deg >= rl.phi_deg);
        assert!(rh.es_mpa >= rl.es_mpa);
    }

    #[test]
    fn test_consistency_boundaries() {
        assert_eq!(
            classify_consistency_from_n(3.0),
            SoilConsistencyClass::VeryLoose
        );
        assert_eq!(
            classify_consistency_from_n(4.0),
            SoilConsistencyClass::Loose
        );
        assert_eq!(
            classify_consistency_from_n(10.0),
            SoilConsistencyClass::MediumDense
        );
        assert_eq!(
            classify_consistency_from_n(30.0),
            SoilConsistencyClass::Dense
        );
        assert_eq!(
            classify_consistency_from_n(50.0),
            SoilConsistencyClass::VeryDense
        );
    }
}
