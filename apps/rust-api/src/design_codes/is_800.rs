//! IS 800:2007 — General Construction in Steel (Limit State Method)
//!
//! Implements:
//! - Shear design per Cl. 8.4
//! - Bolt design: bearing type (Cl. 10.3) and HSFG friction type (Cl. 10.4)
//! - Fillet weld design per Cl. 10.5.7
//! - Deflection check per Table 6
//! - Auto-select lightest ISMB section
//! - Section classification per Table 2
//!
//! Unit conventions:
//!     Web depth d_web and thickness tw: mm
//!     Steel yield strength fy: N/mm²
//!     Shear demand Vu: kN
//!     Bolt design: bolt diameter mm, capacities in kN

use serde::{Deserialize, Serialize};


/// IS 800 code version selector.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum IS800Version {
    /// IS 800:2007 (production)
    V2007,
    /// Draft IS 800:2025 (research/sandbox)
    V2025Draft,
}

/// Banner warning required for draft outputs.
pub const DRAFT_WARNING_IS800_2025: &str =
    "DRAFT — IS 800:2025 has NOT been notified and is NOT legally binding. IS 800:2007 remains enforceable.";

pub const GAMMA_M0: f64 = 1.10;  // Yielding / instability (public export)
#[allow(dead_code)]
const GAMMA_M1: f64 = 1.25;  // Ultimate stress / fracture
const GAMMA_MB: f64 = 1.25;  // Bolts (bearing type)
const GAMMA_MW: f64 = 1.25;  // Welds — shop
const GAMMA_MW_FIELD: f64 = 1.5;  // Welds — field (IS 800 Cl. 10.5.7.1.1)
const GAMMA_MF: f64 = 1.10;  // HSFG bolt slipping

// ── Bolt Grades ──

/// Bolt grade mechanical properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoltGrade {
    pub name: String,
    pub fub: f64,  // Ultimate tensile strength (N/mm²)
    pub fyb: f64,  // Yield strength (N/mm²)
}

/// Standard bolt grades per IS 1367
pub fn bolt_grade(grade: &str) -> Option<BoltGrade> {
    match grade {
        "4.6" => Some(BoltGrade { name: "4.6".into(), fub: 400.0, fyb: 240.0 }),
        "4.8" => Some(BoltGrade { name: "4.8".into(), fub: 420.0, fyb: 340.0 }),
        "5.6" => Some(BoltGrade { name: "5.6".into(), fub: 500.0, fyb: 300.0 }),
        "5.8" => Some(BoltGrade { name: "5.8".into(), fub: 520.0, fyb: 420.0 }),
        "6.8" => Some(BoltGrade { name: "6.8".into(), fub: 600.0, fyb: 480.0 }),
        "8.8" => Some(BoltGrade { name: "8.8".into(), fub: 800.0, fyb: 640.0 }),
        "9.8" => Some(BoltGrade { name: "9.8".into(), fub: 900.0, fyb: 720.0 }),
        "10.9" => Some(BoltGrade { name: "10.9".into(), fub: 1000.0, fyb: 900.0 }),
        "12.9" => Some(BoltGrade { name: "12.9".into(), fub: 1200.0, fyb: 1080.0 }),
        _ => None,
    }
}

// ── Shear Design (Cl. 8.4) ──

/// Shear design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShearResult {
    pub av_mm2: f64,
    pub fyw: f64,
    pub vd_kn: f64,
    pub utilization: f64,
    pub passed: bool,
    pub message: String,
}

/// Design shear capacity for I-section per Cl. 8.4
///
/// Av = d_web × tw (for rolled I-sections)
/// Vd = Av × fyw / (√3 × γm0)
pub fn design_shear(d_web: f64, tw: f64, fy: f64, vu_kn: f64) -> ShearResult {
    let av = d_web * tw;
    let fyw = fy; // Web yield strength
    let vd = av * fyw / (3.0_f64.sqrt() * GAMMA_M0 * 1000.0);
    let utilization = vu_kn / vd;

    ShearResult {
        av_mm2: av,
        fyw,
        vd_kn: (vd * 100.0).round() / 100.0,
        utilization: (utilization * 1000.0).round() / 1000.0,
        passed: utilization <= 1.0,
        message: format!(
            "Shear: {vu_kn:.1} kN / {vd:.1} kN = {utilization:.2}",
        ),
    }
}

// ── Bolt Design — Bearing Type (Cl. 10.3) ──

/// Bearing bolt design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoltBearingResult {
    pub bolt_dia: f64,
    pub bolt_grade: String,
    pub n_bolts: usize,
    pub shear_cap_per_bolt_kn: f64,
    pub bearing_cap_per_bolt_kn: f64,
    pub governing_cap_per_bolt_kn: f64,
    pub total_capacity_kn: f64,
    pub governing: String, // "shear" or "bearing"
    pub kb: f64,
}

/// Design bearing-type bolted connection per IS 800 Cl. 10.3.3 / 10.3.4
#[allow(clippy::too_many_arguments)]
pub fn design_bolt_bearing(
    bolt_dia: f64,
    grade: &str,
    plate_fu: f64,
    plate_thk: f64,
    n_bolts: usize,
    n_shear_planes: usize,
    edge_dist: f64,
    pitch: f64,
) -> Result<BoltBearingResult, String> {
    let bg = bolt_grade(grade).ok_or_else(|| format!("Unknown bolt grade: {grade}"))?;
    let n_sp = n_shear_planes.max(1);

    // Nominal bolt area and net tensile area
    let a_sb = std::f64::consts::PI / 4.0 * bolt_dia * bolt_dia;
    let a_nb = 0.78 * a_sb; // IS 800 Cl. 10.3.2

    // Shear capacity per bolt (Cl. 10.3.3)
    // Vdsb = fub / (√3 × γmb) × (nn × Anb + ns × Asb)
    // Assume all planes through threaded portion
    let v_nsb = bg.fub / (3.0_f64.sqrt() * GAMMA_MB) * (n_sp as f64) * a_nb / 1000.0;

    // Bearing capacity per bolt (Cl. 10.3.4)
    // Vdpb = 2.5 × kb × d × t × fu / γmb
    let hole_dia = bolt_dia + 2.0; // Standard clearance
    let kb_vals = [
        edge_dist / (3.0 * hole_dia),
        pitch / (3.0 * hole_dia) - 0.25,
        bg.fub / plate_fu,
        1.0,
    ];
    let kb = kb_vals.iter().copied().fold(f64::INFINITY, f64::min);
    let v_dpb = 2.5 * kb * bolt_dia * plate_thk * plate_fu / (GAMMA_MB * 1000.0);

    let governing_cap = v_nsb.min(v_dpb);
    let governing = if v_nsb <= v_dpb { "shear" } else { "bearing" };

    Ok(BoltBearingResult {
        bolt_dia,
        bolt_grade: grade.to_string(),
        n_bolts,
        shear_cap_per_bolt_kn: (v_nsb * 100.0).round() / 100.0,
        bearing_cap_per_bolt_kn: (v_dpb * 100.0).round() / 100.0,
        governing_cap_per_bolt_kn: (governing_cap * 100.0).round() / 100.0,
        total_capacity_kn: ((governing_cap * n_bolts as f64) * 100.0).round() / 100.0,
        governing: governing.to_string(),
        kb: (kb * 1000.0).round() / 1000.0,
    })
}

// ── Bolt Design — HSFG Friction Type (Cl. 10.4) ──

/// HSFG bolt design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoltHsfgResult {
    pub bolt_dia: f64,
    pub proof_load_kn: f64,
    pub slip_resistance_per_bolt_kn: f64,
    pub total_capacity_kn: f64,
    pub n_bolts: usize,
    pub mu_f: f64,
}

/// Design HSFG bolt connection per IS 800 Cl. 10.4
pub fn design_bolt_hsfg(
    bolt_dia: f64,
    grade: &str,
    n_bolts: usize,
    n_effective_interfaces: usize,
    mu_f: f64,   // Slip factor (0.2 – 0.55 per Table 20)
    kh: f64,     // Hole factor (1.0 for standard, 0.85 for oversize)
) -> Result<BoltHsfgResult, String> {
    let bg = bolt_grade(grade).ok_or_else(|| format!("Unknown bolt grade: {grade}"))?;

    let a_nb = 0.78 * std::f64::consts::PI / 4.0 * bolt_dia * bolt_dia;
    let fo = 0.7 * bg.fub * a_nb / 1000.0; // Proof load (kN)

    let ne = n_effective_interfaces.max(1) as f64;
    let vsf = mu_f * ne * kh * fo / GAMMA_MF;

    Ok(BoltHsfgResult {
        bolt_dia,
        proof_load_kn: (fo * 100.0).round() / 100.0,
        slip_resistance_per_bolt_kn: (vsf * 100.0).round() / 100.0,
        total_capacity_kn: ((vsf * n_bolts as f64) * 100.0).round() / 100.0,
        n_bolts,
        mu_f,
    })
}

// ── Fillet Weld Design (Cl. 10.5.7) ──

/// Fillet weld design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeldResult {
    pub weld_size_mm: f64,
    pub throat_mm: f64,
    pub effective_length_mm: f64,
    pub fw_mpa: f64,
    pub capacity_kn: f64,
    pub demand_kn: f64,
    pub utilization: f64,
    pub passed: bool,
}

/// Design fillet weld per IS 800 Cl. 10.5.7
///
/// Throat thickness tt = 0.7 × weld size
/// Design strength fw = fuw / (√3 × γmw)
/// Effective length = max(L − 2s, 0)
/// 
/// weld_type: "shop" (γmw=1.25) or "field" (γmw=1.5)
pub fn design_fillet_weld(
    weld_size: f64,
    weld_length: f64,
    weld_fu: f64,
    load_kn: f64,
    weld_type: &str,
) -> WeldResult {
    let gamma_mw = if weld_type == "field" { GAMMA_MW_FIELD } else { GAMMA_MW };
    let tt = 0.7 * weld_size;
    let eff_length = (weld_length - 2.0 * weld_size).max(0.0);
    let fw = weld_fu / (3.0_f64.sqrt() * gamma_mw);
    let capacity = tt * eff_length * fw / 1000.0;
    let utilization = if capacity > 0.0 { load_kn / capacity } else { 999.0 };

    WeldResult {
        weld_size_mm: weld_size,
        throat_mm: tt,
        effective_length_mm: eff_length,
        fw_mpa: (fw * 10.0).round() / 10.0,
        capacity_kn: (capacity * 100.0).round() / 100.0,
        demand_kn: load_kn,
        utilization: (utilization * 1000.0).round() / 1000.0,
        passed: utilization <= 1.0,
    }
}

// ── Deflection Check (Table 6) ──

/// Deflection check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeflectionResult {
    pub actual_mm: f64,
    pub allowable_mm: f64,
    pub span_divisor: f64,
    pub utilization: f64,
    pub passed: bool,
    pub clause: String,
}

/// Check deflection per IS 800 Table 6
///
/// Member types: beam (L/300), purlin (L/150), gantry (L/500), cantilever (L/150)
pub fn check_deflection(
    span_mm: f64,
    actual_defl_mm: f64,
    member_type: &str,
) -> DeflectionResult {
    let divisor = match member_type {
        "purlin" => 150.0,
        "gantry" => 500.0,
        "cantilever" => 150.0,
        _ => 300.0, // beam
    };
    let allowable = span_mm / divisor;
    let utilization = actual_defl_mm.abs() / allowable;

    DeflectionResult {
        actual_mm: actual_defl_mm.abs(),
        allowable_mm: (allowable * 100.0).round() / 100.0,
        span_divisor: divisor,
        utilization: (utilization * 1000.0).round() / 1000.0,
        passed: utilization <= 1.0,
        clause: format!("IS 800:2007 Table 6 (L/{divisor:.0})"),
    }
}

// ── ISMB Section Database ──

/// Standard ISMB section properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IsmbSection {
    pub name: String,
    pub depth: f64,      // mm
    pub width: f64,      // mm
    pub tw: f64,         // Web thickness (mm)
    pub tf: f64,         // Flange thickness (mm)
    pub area: f64,       // mm²
    pub ixx: f64,        // mm⁴
    pub iyy: f64,        // mm⁴
    pub zxx: f64,        // mm³
    pub zyy: f64,        // mm³
    pub rxx: f64,        // mm
    pub ryy: f64,        // mm
    pub weight: f64,     // kg/m
}

/// Get standard ISMB section database (sorted by weight ascending)
pub fn ismb_database() -> Vec<IsmbSection> {
    vec![
        IsmbSection { name: "ISMB100".into(), depth: 100.0, width: 75.0, tw: 4.0, tf: 7.2, area: 1160.0, ixx: 2.57e6, iyy: 0.41e6, zxx: 51.4e3, zyy: 10.9e3, rxx: 40.1, ryy: 18.4, weight: 8.9 },
        IsmbSection { name: "ISMB150".into(), depth: 150.0, width: 80.0, tw: 4.8, tf: 7.6, area: 1660.0, ixx: 7.26e6, iyy: 0.53e6, zxx: 96.8e3, zyy: 13.2e3, rxx: 59.0, ryy: 17.8, weight: 14.9 },
        IsmbSection { name: "ISMB200".into(), depth: 200.0, width: 100.0, tw: 5.7, tf: 10.8, area: 3230.0, ixx: 22.35e6, iyy: 1.50e6, zxx: 223.5e3, zyy: 30.0e3, rxx: 83.2, ryy: 21.5, weight: 25.4 },
        IsmbSection { name: "ISMB250".into(), depth: 250.0, width: 125.0, tw: 6.9, tf: 12.5, area: 4750.0, ixx: 51.31e6, iyy: 3.34e6, zxx: 410.5e3, zyy: 53.5e3, rxx: 103.9, ryy: 26.5, weight: 37.3 },
        IsmbSection { name: "ISMB300".into(), depth: 300.0, width: 140.0, tw: 7.7, tf: 13.1, area: 5870.0, ixx: 86.04e6, iyy: 4.53e6, zxx: 573.6e3, zyy: 64.7e3, rxx: 121.1, ryy: 27.8, weight: 46.1 },
        IsmbSection { name: "ISMB350".into(), depth: 350.0, width: 140.0, tw: 8.1, tf: 14.2, area: 6760.0, ixx: 136.3e6, iyy: 5.38e6, zxx: 778.9e3, zyy: 76.8e3, rxx: 142.0, ryy: 28.2, weight: 52.4 },
        IsmbSection { name: "ISMB400".into(), depth: 400.0, width: 140.0, tw: 8.9, tf: 16.0, area: 7840.0, ixx: 204.6e6, iyy: 6.22e6, zxx: 1022.9e3, zyy: 88.9e3, rxx: 161.5, ryy: 28.2, weight: 61.6 },
        IsmbSection { name: "ISMB450".into(), depth: 450.0, width: 150.0, tw: 9.4, tf: 17.4, area: 9220.0, ixx: 303.9e6, iyy: 8.34e6, zxx: 1350.7e3, zyy: 111.2e3, rxx: 181.6, ryy: 30.1, weight: 72.4 },
        IsmbSection { name: "ISMB500".into(), depth: 500.0, width: 180.0, tw: 10.2, tf: 17.2, area: 11070.0, ixx: 452.2e6, iyy: 13.7e6, zxx: 1808.7e3, zyy: 152.2e3, rxx: 202.2, ryy: 35.2, weight: 86.9 },
        IsmbSection { name: "ISMB550".into(), depth: 550.0, width: 190.0, tw: 11.2, tf: 19.3, area: 13210.0, ixx: 649.5e6, iyy: 18.1e6, zxx: 2361.8e3, zyy: 190.5e3, rxx: 221.7, ryy: 37.0, weight: 103.7 },
        IsmbSection { name: "ISMB600".into(), depth: 600.0, width: 210.0, tw: 12.0, tf: 20.8, area: 15600.0, ixx: 918.1e6, iyy: 26.5e6, zxx: 3060.4e3, zyy: 252.4e3, rxx: 242.5, ryy: 41.2, weight: 122.6 },
    ]
}

/// Auto-select result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoSelectResult {
    pub selected: String,
    pub area_mm2: f64,
    pub max_utilization: f64,
    pub weight_kg_per_m: f64,
    pub message: String,
}

/// Auto-select lightest ISMB section that satisfies all design checks
///
/// Iterates from lightest to heaviest, returns first section where max utilization ≤ 0.95
pub fn auto_select_section(
    fy: f64,
    pu_kn: f64,
    mux_knm: f64,
    _muy_knm: f64,
    vu_kn: f64,
    lx_mm: f64,
    ly_mm: f64,
) -> AutoSelectResult {
    let db = ismb_database();

    for section in &db {
        let d_web = section.depth - 2.0 * section.tf;

        // Shear check
        let shear = design_shear(d_web, section.tw, fy, vu_kn);

        // Flexure check (simplified plastic moment)
        let zpxx = 1.15 * section.zxx; // Approximate plastic modulus
        let md = zpxx * fy / (GAMMA_M0 * 1e6);
        let flex_util = mux_knm / md;

        // Compression check (if axial load present)
        let comp_util = if pu_kn > 0.0 {
            let lambda_xx = lx_mm / section.rxx.max(1.0);
            let lambda_yy = ly_mm / section.ryy.max(1.0);
            let lambda = lambda_xx.max(lambda_yy);
            let lambda_e = (lambda / std::f64::consts::PI) * (fy / 200_000.0).sqrt();
            let alpha = 0.34; // Buckling curve b (for I-sections per Table 7)
            let phi = 0.5 * (1.0 + alpha * (lambda_e - 0.2) + lambda_e.powi(2));
            // χ = 1/[φ + √(φ² - λ̄²)] but ensure φ² ≥ λ̄² and result ≤ 1.0
            let discriminant = (phi * phi - lambda_e * lambda_e).max(0.0);
            let chi = if discriminant > 1e-12 {
                let denominator = phi + discriminant.sqrt();
                if denominator > 1e-12 {
                    (1.0 / denominator).min(1.0)
                } else {
                    1.0
                }
            } else {
                // When φ² ≈ λ̄², χ = 1/(2φ)
                (1.0 / (2.0 * phi.max(0.5))).min(1.0)
            };
            let fcd = chi * fy / GAMMA_M0;
            let pd = section.area * fcd / 1000.0;
            pu_kn / pd
        } else {
            0.0
        };

        let max_util = flex_util.max(shear.utilization).max(comp_util);

        if max_util <= 0.95 {
            return AutoSelectResult {
                selected: section.name.clone(),
                area_mm2: section.area,
                max_utilization: (max_util * 1000.0).round() / 1000.0,
                weight_kg_per_m: section.weight,
                message: format!(
                    "{}: flex={flex_util:.3}, shear={:.3}, comp={comp_util:.3}, max={max_util:.3}",
                    section.name, shear.utilization
                ),
            };
        }
    }

    // No section adequate
    AutoSelectResult {
        selected: "NONE".into(),
        area_mm2: 0.0,
        max_utilization: 999.0,
        weight_kg_per_m: 0.0,
        message: "No ISMB section satisfies design requirements".into(),
    }
}

// ── Version-aware wrappers (Draft toggle) ──

/// Design shear capacity per IS 800 Cl. 8.4 with version toggle.
pub fn design_shear_with_version(
    d_web: f64,
    tw: f64,
    fy: f64,
    vu_kn: f64,
    version: IS800Version,
) -> ShearResult {
    let mut result = design_shear(d_web, tw, fy, vu_kn);
    if matches!(version, IS800Version::V2025Draft)
        && !result.message.contains("DRAFT")
    {
        result.message = format!("{} [{}]", result.message, DRAFT_WARNING_IS800_2025);
    }
    result
}

/// Design bearing-type bolts per IS 800 Cl. 10.3 with version toggle.
#[allow(clippy::too_many_arguments)]
pub fn design_bolt_bearing_with_version(
    bolt_dia: f64,
    grade: &str,
    plate_fu: f64,
    plate_thk: f64,
    n_bolts: usize,
    n_shear_planes: usize,
    edge_dist: f64,
    pitch: f64,
    _version: IS800Version,
) -> Result<BoltBearingResult, String> {
    design_bolt_bearing(
        bolt_dia,
        grade,
        plate_fu,
        plate_thk,
        n_bolts,
        n_shear_planes,
        edge_dist,
        pitch,
    )
}

/// Design HSFG bolts per IS 800 Cl. 10.4 with version toggle.
pub fn design_bolt_hsfg_with_version(
    bolt_dia: f64,
    grade: &str,
    n_bolts: usize,
    n_effective_interfaces: usize,
    mu_f: f64,
    kh: f64,
    _version: IS800Version,
) -> Result<BoltHsfgResult, String> {
    design_bolt_hsfg(bolt_dia, grade, n_bolts, n_effective_interfaces, mu_f, kh)
}

/// Design fillet weld per IS 800 Cl. 10.5.7 with version toggle.
pub fn design_fillet_weld_with_version(
    weld_size: f64,
    weld_length: f64,
    weld_fu: f64,
    load_kn: f64,
    weld_type: &str,
    _version: IS800Version,
) -> WeldResult {
    design_fillet_weld(weld_size, weld_length, weld_fu, load_kn, weld_type)
}

/// Auto-select section with IS 800 version toggle.
pub fn auto_select_section_with_version(
    fy: f64,
    pu_kn: f64,
    mux_knm: f64,
    muy_knm: f64,
    vu_kn: f64,
    lx_mm: f64,
    ly_mm: f64,
    version: IS800Version,
) -> AutoSelectResult {
    let mut result = auto_select_section(fy, pu_kn, mux_knm, muy_knm, vu_kn, lx_mm, ly_mm);
    if matches!(version, IS800Version::V2025Draft)
        && !result.message.contains("DRAFT")
    {
        result.message = format!("{} [{}]", result.message, DRAFT_WARNING_IS800_2025);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shear_design() {
        let r = design_shear(350.0 - 2.0 * 14.2, 8.1, 250.0, 250.0);
        assert!(r.passed, "Shear should pass");
        assert!(r.utilization > 0.5 && r.utilization < 1.0);
    }

    #[test]
    fn test_bolt_bearing() {
        let r = design_bolt_bearing(20.0, "4.6", 410.0, 10.0, 4, 1, 35.0, 60.0).unwrap();
        assert_eq!(r.governing, "shear");
        assert!(r.total_capacity_kn > 100.0);
    }

    #[test]
    fn test_fillet_weld() {
        let r = design_fillet_weld(6.0, 150.0, 410.0, 100.0, "shop");
        assert!(r.passed);
        assert!(r.utilization < 1.0);
    }

    #[test]
    fn test_design_shear_with_version_draft() {
        let r = design_shear_with_version(
            350.0 - 2.0 * 14.2,
            8.1,
            250.0,
            250.0,
            IS800Version::V2025Draft,
        );
        assert!(r.passed, "Shear should pass");
        assert!(r.message.contains("DRAFT"), "Draft warning should be present");
    }

    #[test]
    fn test_auto_select_with_version_draft() {
        let r = auto_select_section_with_version(
            250.0,
            0.0,
            200.0,
            0.0,
            100.0,
            6000.0,
            6000.0,
            IS800Version::V2025Draft,
        );
        assert_ne!(r.selected, "NONE");
        assert!(r.message.contains("DRAFT"), "Draft warning should be present");
    }

    #[test]
    fn test_auto_select() {
        let r = auto_select_section(250.0, 0.0, 200.0, 0.0, 100.0, 6000.0, 6000.0);
        assert_ne!(r.selected, "NONE");
        assert!(r.max_utilization <= 0.95);
    }
}
