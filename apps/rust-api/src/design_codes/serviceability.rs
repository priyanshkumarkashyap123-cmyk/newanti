//! Serviceability Limit State Checks
//!
//! Unified checker for:
//! - Deflection (RC per IS 456/Steel per IS 800)
//! - Floor vibration (frequency check)
//! - Crack width (IS 456 Annex F)
//! - Storey drift (IS 1893 Cl. 7.11.1)
//!
//! Each check returns a ServiceabilityResult with pass/fail, utilization, and details.

use serde::{Deserialize, Serialize};

/// Unified serviceability check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceabilityResult {
    pub check_type: String,
    pub passed: bool,
    pub utilization: f64,
    pub demand: f64,
    pub limit: f64,
    pub code_clause: String,
    pub message: String,
}

// ── Deflection ──

/// RC span/depth limits (IS 456 Cl. 23.2)
fn rc_span_depth_limit(support: &str) -> f64 {
    match support {
        "cantilever" => 7.0,
        "continuous" => 26.0,
        _ => 20.0, // simply_supported
    }
}

/// Steel deflection limit (IS 800 Table 6)
fn steel_defl_divisor(member_type: &str, load_type: &str) -> f64 {
    match (member_type, load_type) {
        ("beam", "live") => 300.0,
        ("beam", "total") | ("beam", _) => 250.0,
        ("purlin", _) => 150.0,
        ("gantry", _) => 500.0,
        ("cantilever", _) => 150.0,
        _ => 300.0,
    }
}

/// Unified deflection check for RC or steel members
pub fn check_deflection(
    material: &str, // "rc" or "steel"
    span_mm: f64,
    actual_deflection_mm: f64,
    member_type: &str,       // "beam", "cantilever", "purlin", "gantry"
    load_type: &str,         // "live", "total"
    support_condition: &str, // For RC: "simply_supported", "continuous", "cantilever"
) -> ServiceabilityResult {
    let (limit, clause) = if material.eq_ignore_ascii_case("rc") {
        let divisor = rc_span_depth_limit(support_condition);
        let limit = span_mm / divisor;
        (limit, format!("IS 456 Cl. 23.2 (L/{divisor:.0})"))
    } else {
        let divisor = steel_defl_divisor(member_type, load_type);
        let limit = span_mm / divisor;
        (limit, format!("IS 800 Table 6 (L/{divisor:.0})"))
    };

    let demand = actual_deflection_mm.abs();
    let util = if limit > 0.0 { demand / limit } else { 999.0 };

    ServiceabilityResult {
        check_type: "deflection".into(),
        passed: util <= 1.0,
        utilization: (util * 1000.0).round() / 1000.0,
        demand,
        limit: (limit * 100.0).round() / 100.0,
        code_clause: clause,
        message: format!("δ = {demand:.2} mm vs {limit:.2} mm → {util:.2}",),
    }
}

// ── Floor Vibration ──

/// Check floor vibration — minimum frequency
pub fn check_floor_vibration(fundamental_freq_hz: f64, occupancy: &str) -> ServiceabilityResult {
    let f_min = match occupancy {
        "office" | "residential" => 5.0,
        "gym" | "dance" => 9.0,
        "lab" | "hospital" => 8.0,
        "footbridge" => 3.0,
        _ => 5.0,
    };

    let util = if fundamental_freq_hz > 0.0 {
        f_min / fundamental_freq_hz
    } else {
        999.0
    };

    ServiceabilityResult {
        check_type: "vibration".into(),
        passed: fundamental_freq_hz >= f_min,
        utilization: (util * 1000.0).round() / 1000.0,
        demand: f_min,
        limit: fundamental_freq_hz,
        code_clause: "IS 800 Cl. 5.6.2 / AISC DG11".into(),
        message: format!(
            "f₁ = {fundamental_freq_hz:.2} Hz vs f_min = {f_min:.1} Hz → {}",
            if fundamental_freq_hz >= f_min {
                "OK"
            } else {
                "FAIL"
            }
        ),
    }
}

// ── Crack Width (IS 456 Annex F) ──

/// Estimate crack width per IS 456 Annex F
///
/// w_cr = 3 × a_cr × ε_m / (1 + 2(a_cr − c_min) / (h − x))
///
/// where:
/// - a_cr = distance from crack point to nearest bar surface
/// - ε_m = average strain at surface
/// - c_min = minimum cover
/// - x = neutral axis depth
pub fn estimate_crack_width(
    b: f64,           // Width (mm)
    d: f64,           // Effective depth (mm)
    big_d: f64,       // Overall depth (mm)
    cover: f64,       // Clear cover (mm)
    bar_dia: f64,     // Bar diameter (mm)
    bar_spacing: f64, // Bar spacing (mm)
    fs: f64,          // Steel stress under service loads (N/mm²)
    exposure: &str,   // "mild", "moderate", "severe"
) -> ServiceabilityResult {
    estimate_crack_width_with_fck(b, d, big_d, cover, bar_dia, bar_spacing, fs, exposure, 25.0)
}

/// Estimate crack width with specified concrete grade
pub fn estimate_crack_width_with_fck(
    b: f64,           // Width (mm)
    d: f64,           // Effective depth (mm)
    big_d: f64,       // Overall depth (mm)
    cover: f64,       // Clear cover (mm)
    bar_dia: f64,     // Bar diameter (mm)
    bar_spacing: f64, // Bar spacing (mm)
    fs: f64,          // Steel stress under service loads (N/mm²)
    exposure: &str,   // "mild", "moderate", "severe"
    fck: f64,         // Concrete characteristic strength (N/mm²)
) -> ServiceabilityResult {
    let w_limit = match exposure {
        "mild" => 0.3,
        "severe" | "very_severe" | "extreme" => 0.1,
        _ => 0.2, // moderate
    };

    // Modular ratio m = Es / Ec where Es = 200 GPa
    // Ec = 5000√fck (IS 456 Cl. 6.2.3.1)
    let ec = 5000.0 * fck.max(15.0).sqrt(); // N/mm²
    let es = 200_000.0; // N/mm²
    let m = (es / ec.max(1.0)).clamp(6.0, 20.0); // Practical range

    let ast = std::f64::consts::PI / 4.0
        * bar_dia.max(1.0)
        * bar_dia.max(1.0)
        * (b / bar_spacing.max(10.0));

    // Neutral axis depth (cracked section): quadratic formula
    // x²b + 2mx·Ast - 2mx·Ast·d = 0
    let a_coef = b;
    let b_coef = m * ast;
    let c_coef = -m * ast * d;

    let discriminant = b_coef * b_coef - 4.0 * a_coef * c_coef;
    let x = if discriminant >= 0.0 && a_coef > 1e-12 {
        (-b_coef + discriminant.sqrt()) / (2.0 * a_coef)
    } else {
        d / 3.0 // Fallback approximation
    }
    .clamp(0.0, d);

    // Distance from crack to nearest bar
    let c_min = cover.max(10.0);
    let half_spacing = (bar_spacing.max(10.0)) / 2.0;
    let d_to_bar = c_min + bar_dia.max(1.0) / 2.0;
    let a_cr = ((half_spacing * half_spacing + d_to_bar * d_to_bar).sqrt()
        - bar_dia.max(1.0) / 2.0)
        .max(c_min);

    // Strain at steel level
    let epsilon_1 = (fs.abs() / es).clamp(0.0, 0.01);

    // Tension stiffening effect
    let epsilon_2 = if big_d > x {
        let bt = b * (big_d - x); // Tension zone area
        if bt > 1e-6 && ast > 1e-6 {
            (1.0e-3 * bt / (3.0 * es * ast)).clamp(0.0, epsilon_1 * 0.5)
        } else {
            0.0
        }
    } else {
        0.0
    };
    let epsilon_m = (epsilon_1 - epsilon_2).max(0.0);

    // Crack width formula with numeric guards
    let denom = 1.0 + 2.0 * (a_cr - c_min).max(0.0) / (big_d - x).max(1.0);
    let w_cr = if denom > 1e-12 {
        (3.0 * a_cr * epsilon_m / denom).clamp(0.0, 5.0)
    } else {
        0.0
    };

    let util = if w_limit > 1e-12 {
        w_cr / w_limit
    } else {
        999.0
    };

    ServiceabilityResult {
        check_type: "crack_width".into(),
        passed: w_cr <= w_limit,
        utilization: (util * 1000.0).round() / 1000.0,
        demand: (w_cr * 1000.0).round() / 1000.0,
        limit: w_limit,
        code_clause: "IS 456:2000 Annex F".into(),
        message: format!(
            "w_cr = {w_cr:.3} mm vs {w_limit:.1} mm ({exposure}) → {}",
            if w_cr <= w_limit { "OK" } else { "FAIL" }
        ),
    }
}

// ── Storey Drift ──

/// Check storey drift per IS 1893 Cl. 7.11.1
pub fn check_storey_drift(
    storey_height_mm: f64,
    elastic_drift_mm: f64,
    response_reduction: f64,
) -> ServiceabilityResult {
    let actual = elastic_drift_mm * response_reduction;
    let ratio = actual / storey_height_mm;
    let limit = 0.004;
    let util = ratio / limit;

    ServiceabilityResult {
        check_type: "storey_drift".into(),
        passed: ratio <= limit,
        utilization: (util * 1000.0).round() / 1000.0,
        demand: (ratio * 10000.0).round() / 10000.0,
        limit,
        code_clause: "IS 1893:2016 Cl. 7.11.1".into(),
        message: format!(
            "Drift = {ratio:.4} ({actual:.2} mm / {storey_height_mm:.0} mm) vs {limit} → {}",
            if ratio <= limit { "OK" } else { "FAIL" }
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deflection_steel() {
        let r = check_deflection("steel", 6000.0, 15.0, "beam", "live", "");
        assert!(r.passed, "15mm vs L/300=20mm should pass");
        assert!((r.utilization - 0.75).abs() < 0.01);
    }

    #[test]
    fn test_deflection_rc() {
        let r = check_deflection("rc", 5000.0, 12.0, "beam", "live", "simply_supported");
        assert!(r.passed);
    }

    #[test]
    fn test_vibration() {
        let r = check_floor_vibration(6.2, "office");
        assert!(r.passed);
    }

    #[test]
    fn test_crack_width() {
        let r = estimate_crack_width(230.0, 450.0, 500.0, 30.0, 16.0, 150.0, 200.0, "moderate");
        assert!(r.demand < 0.3, "Crack width should be < 0.3mm");
    }

    #[test]
    fn test_drift_pass() {
        let r = check_storey_drift(3500.0, 2.5, 5.0);
        // 2.5 * 5.0 = 12.5mm, 12.5/3500 = 0.003571 ≤ 0.004 → PASS
        assert!(r.passed);
    }

    #[test]
    fn test_drift_fail() {
        let r = check_storey_drift(3000.0, 3.0, 5.0);
        // 3.0 * 5.0 = 15mm, 15/3000 = 0.005 > 0.004 → FAIL
        assert!(!r.passed);
    }
}
