//! Liquefaction Potential Screening (SPT-based)
//!
//! Simplified cyclic stress method for sandy soils using corrected SPT resistance.
//!
//! References:
//! - Seed & Idriss (1971/1982): CSR framework
//! - Idriss & Boulanger (2008): CRR7.5 from (N1)60cs correlations
//! - NCEER workshop recommendations for screening practice

use serde::{Deserialize, Serialize};

const DEFAULT_REQUIRED_FS: f64 = 1.10;
const DEFAULT_MAGNITUDE: f64 = 7.5;

/// Input for liquefaction screening at a depth point.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct LiquefactionInput {
    /// Earthquake moment magnitude Mw
    pub magnitude_mw: Option<f64>,
    /// Peak horizontal acceleration as fraction of g (PGA/g)
    pub pga_g: f64,
    /// Depth below ground level z (m)
    pub depth_m: f64,
    /// Total vertical overburden stress σv0 (kPa)
    pub total_stress_kpa: f64,
    /// Effective vertical overburden stress σ'v0 (kPa)
    pub effective_stress_kpa: f64,
    /// Clean-sand corrected SPT resistance (N1)60cs
    pub n1_60cs: f64,
    /// Optional stress reduction coefficient rd
    pub rd: Option<f64>,
    /// Required minimum liquefaction safety factor (default 1.10)
    pub required_fs: Option<f64>,
}

/// Result of liquefaction potential screening.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiquefactionResult {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    pub source: String,
    /// Cyclic stress ratio, CSR
    pub csr: f64,
    /// Magnitude-7.5 cyclic resistance ratio, CRR7.5
    pub crr_7p5: f64,
    /// Magnitude scaling factor, MSF
    pub msf: f64,
    /// Liquefaction factor of safety FSliq = (CRR7.5*MSF)/CSR
    pub fs_liquefaction: f64,
    /// Stress reduction coefficient rd
    pub rd_used: f64,
    /// Magnitude used in screening
    pub magnitude_mw: f64,
    /// Required minimum factor of safety
    pub required_fs: f64,
}

/// Screen liquefaction potential using SPT-based simplified procedure.
///
/// Equations:
/// - CSR = 0.65 * (amax/g) * (σv0/σ'v0) * rd
/// - CRR7.5 = exp( N/14.1 + (N/126)^2 - (N/23.6)^3 + (N/25.4)^4 - 2.8 )
///   where N = (N1)60cs (Idriss & Boulanger 2008 fit, typical range N<=35)
/// - MSF = (Mw/7.5)^(-2.56) (bounded)
/// - FSliq = (CRR7.5 * MSF) / CSR
pub fn check_liquefaction(input: &LiquefactionInput) -> Result<LiquefactionResult, String> {
    let magnitude_mw = input.magnitude_mw.unwrap_or(DEFAULT_MAGNITUDE);
    let required_fs = input.required_fs.unwrap_or(DEFAULT_REQUIRED_FS);

    if magnitude_mw < 5.0 || magnitude_mw > 9.0 {
        return Err("magnitude_mw must be in [5.0, 9.0]".to_string());
    }
    if input.pga_g <= 0.0 || input.pga_g > 1.5 {
        return Err("pga_g must be > 0 and <= 1.5".to_string());
    }
    if input.depth_m <= 0.0 || input.depth_m > 30.0 {
        return Err("depth_m must be > 0 and <= 30".to_string());
    }
    if input.total_stress_kpa <= 0.0 {
        return Err("total_stress_kpa must be > 0".to_string());
    }
    if input.effective_stress_kpa <= 0.0 {
        return Err("effective_stress_kpa must be > 0".to_string());
    }
    if input.total_stress_kpa < input.effective_stress_kpa {
        return Err("total_stress_kpa must be >= effective_stress_kpa".to_string());
    }
    if input.n1_60cs <= 0.0 || input.n1_60cs > 50.0 {
        return Err("n1_60cs must be > 0 and <= 50".to_string());
    }
    if required_fs <= 0.0 {
        return Err("required_fs must be > 0".to_string());
    }

    let rd_used = if let Some(rd) = input.rd {
        if !(0.3..=1.0).contains(&rd) {
            return Err("rd must be in [0.3, 1.0] when provided".to_string());
        }
        rd
    } else {
        estimate_rd(input.depth_m)
    };

    let csr = 0.65 * input.pga_g * (input.total_stress_kpa / input.effective_stress_kpa) * rd_used;
    if csr <= f64::EPSILON {
        return Err("computed CSR is near zero; check inputs".to_string());
    }

    let n = input.n1_60cs.min(35.0);
    let crr_7p5 =
        (n / 14.1 + (n / 126.0).powi(2) - (n / 23.6).powi(3) + (n / 25.4).powi(4) - 2.8).exp();

    let msf = (magnitude_mw / 7.5).powf(-2.56).clamp(0.7, 1.8);
    let fs_liquefaction = (crr_7p5 * msf) / csr;

    let passed = fs_liquefaction >= required_fs;
    let utilization = (required_fs / fs_liquefaction).max(0.0);

    let source = "Seed-Idriss CSR with Idriss-Boulanger SPT CRR correlation".to_string();
    let message = format!(
        "Liquefaction screening ({source}): FSliq={fs_liquefaction:.2}, required={required_fs:.2}, CSR={csr:.3}, CRR7.5={crr_7p5:.3}, MSF={msf:.2}, Mw={magnitude_mw:.2}.",
    );

    Ok(LiquefactionResult {
        passed,
        utilization,
        message,
        source,
        csr,
        crr_7p5,
        msf,
        fs_liquefaction,
        rd_used,
        magnitude_mw,
        required_fs,
    })
}

fn estimate_rd(depth_m: f64) -> f64 {
    if depth_m <= 9.15 {
        1.0 - 0.00765 * depth_m
    } else {
        1.174 - 0.0267 * depth_m
    }
    .clamp(0.3, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_liquefaction_low_demand_passes() {
        let input = LiquefactionInput {
            magnitude_mw: Some(7.5),
            pga_g: 0.15,
            depth_m: 6.0,
            total_stress_kpa: 110.0,
            effective_stress_kpa: 70.0,
            n1_60cs: 22.0,
            rd: None,
            required_fs: Some(1.1),
        };

        let r = check_liquefaction(&input).expect("valid input");
        assert!(r.passed);
        assert!(r.fs_liquefaction > 1.1);
    }

    #[test]
    fn test_liquefaction_high_demand_fails() {
        let input = LiquefactionInput {
            magnitude_mw: Some(7.5),
            pga_g: 0.35,
            depth_m: 8.0,
            total_stress_kpa: 160.0,
            effective_stress_kpa: 80.0,
            n1_60cs: 10.0,
            rd: None,
            required_fs: Some(1.1),
        };

        let r = check_liquefaction(&input).expect("valid input");
        assert!(!r.passed);
        assert!(r.fs_liquefaction < 1.1);
    }

    #[test]
    fn test_invalid_effective_stress_rejected() {
        let input = LiquefactionInput {
            magnitude_mw: Some(7.5),
            pga_g: 0.2,
            depth_m: 5.0,
            total_stress_kpa: 100.0,
            effective_stress_kpa: 0.0,
            n1_60cs: 18.0,
            rd: None,
            required_fs: None,
        };

        assert!(check_liquefaction(&input).is_err());
    }

    #[test]
    fn test_magnitude_effect_reduces_fs_for_larger_event() {
        let base = LiquefactionInput {
            magnitude_mw: Some(6.5),
            pga_g: 0.2,
            depth_m: 7.0,
            total_stress_kpa: 130.0,
            effective_stress_kpa: 75.0,
            n1_60cs: 16.0,
            rd: None,
            required_fs: None,
        };
        let large_mw = LiquefactionInput {
            magnitude_mw: Some(8.0),
            ..base
        };

        let r1 = check_liquefaction(&base).expect("valid base");
        let r2 = check_liquefaction(&large_mw).expect("valid large event");
        assert!(r2.fs_liquefaction < r1.fs_liquefaction);
    }
}
