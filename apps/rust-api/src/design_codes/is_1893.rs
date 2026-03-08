//! IS 1893:2016 — Earthquake Resistant Design of Structures
//!
//! Implements:
//! - Approximate natural period (Cl. 7.6.2) with infill/masonry support
//! - Spectral acceleration Sa/g for all soil types
//! - Design horizontal acceleration coefficient Ah
//! - Base shear and vertical distribution
//! - Storey drift check per Cl. 7.11.1
//! - SRSS and CQC modal combination methods
//! - One-call equivalent lateral force generation

use serde::{Deserialize, Serialize};

// ── Seismic Zone ──

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SeismicZone {
    II,
    III,
    IV,
    V,
}

impl SeismicZone {
    pub fn z_factor(&self) -> f64 {
        match self {
            Self::II => 0.10,
            Self::III => 0.16,
            Self::IV => 0.24,
            Self::V => 0.36,
        }
    }
}

// ── Soil Type ──

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SoilType {
    Hard,   // Type I — Rock or hard soil
    Medium, // Type II — Medium soil
    Soft,   // Type III — Soft soil
}

// ── Spectral Acceleration ──

/// Spectral acceleration coefficient Sa/g per IS 1893:2016 Cl. 6.4.2
pub fn spectral_acceleration(t: f64, soil: SoilType) -> f64 {
    match soil {
        SoilType::Hard => {
            if t <= 0.10 { 1.0 + 15.0 * t }
            else if t <= 0.40 { 2.5 }
            else if t <= 4.0 { 1.0 / t }
            else { 0.25 }
        }
        SoilType::Medium => {
            if t <= 0.10 { 1.0 + 15.0 * t }
            else if t <= 0.55 { 2.5 }
            else if t <= 4.0 { 1.36 / t }
            else { 0.34 }
        }
        SoilType::Soft => {
            if t <= 0.10 { 1.0 + 15.0 * t }
            else if t <= 0.67 { 2.5 }
            else if t <= 4.0 { 1.67 / t }
            else { 0.42 }
        }
    }
}

// ── Approximate Natural Period ──

/// Approximate natural period per Cl. 7.6.2
///
/// - RC frame: T = 0.075 × h^0.75
/// - Steel frame: T = 0.085 × h^0.75
/// - RC with infill: T = 0.09 × h / √d  (d = base dimension in EQ direction)
/// - Masonry: T = 0.09 × h / √d
pub fn calculate_period_approx(
    height_m: f64,
    building_type: &str,
    base_dimension: f64,
) -> f64 {
    match building_type {
        "steel_frame" | "steel_moment_frame" => 0.085 * height_m.powf(0.75),
        "rc_frame" | "rc_moment_frame" => 0.075 * height_m.powf(0.75),
        "rc_infill" | "infill" => {
            let d = if base_dimension > 0.0 { base_dimension } else { height_m };
            0.09 * height_m / d.sqrt()
        }
        "masonry" => {
            let d = if base_dimension > 0.0 { base_dimension } else { height_m };
            0.09 * height_m / d.sqrt()
        }
        _ => 0.075 * height_m.powf(0.75),
    }
}

// ── Base Shear ──

/// Design horizontal acceleration coefficient Ah
pub fn calculate_ah(
    zone: SeismicZone,
    soil: SoilType,
    importance_factor: f64,
    response_reduction: f64,
    period: f64,
) -> f64 {
    let z = zone.z_factor();
    let sa_g = spectral_acceleration(period, soil);
    let ah = (z / 2.0) * (importance_factor / response_reduction) * sa_g;
    // Cl. 7.2.2: Ah shall not be less than Z/2 × I/R × 0.2 (minimum for soft soil)
    ah.max(z * importance_factor / (2.0 * response_reduction) * 0.2)
}

/// Calculate base shear and return detailed result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BaseShearResult {
    pub vb_kn: f64,
    pub ah: f64,
    pub sa_g: f64,
    pub period_s: f64,
    pub w_total_kn: f64,
}

pub fn calculate_base_shear(
    w_total: f64,
    period: f64,
    zone: SeismicZone,
    soil: SoilType,
    importance_factor: f64,
    response_reduction: f64,
) -> BaseShearResult {
    let sa_g = spectral_acceleration(period, soil);
    let ah = calculate_ah(zone, soil, importance_factor, response_reduction, period);
    let vb = ah * w_total;

    BaseShearResult {
        vb_kn: vb,
        ah,
        sa_g,
        period_s: period,
        w_total_kn: w_total,
    }
}

// ── Vertical Distribution ──

/// Vertical distribution of base shear per Cl. 7.6.3
/// Qi = Vb × (Wi × hi²) / Σ(Wj × hj²)
pub fn vertical_distribution(
    base_shear: f64,
    floor_weights: &[f64],
    floor_heights: &[f64],
) -> Vec<f64> {
    let sum_wh2: f64 = floor_weights
        .iter()
        .zip(floor_heights.iter())
        .map(|(w, h)| w * h * h)
        .sum();

    if sum_wh2.abs() < 1e-20 {
        return vec![0.0; floor_weights.len()];
    }

    floor_weights
        .iter()
        .zip(floor_heights.iter())
        .map(|(w, h)| base_shear * w * h * h / sum_wh2)
        .collect()
}

// ── Storey Drift Check (Cl. 7.11.1) ──

/// Storey drift check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriftCheckResult {
    pub storey: usize,
    pub elastic_drift_mm: f64,
    pub actual_drift_mm: f64,
    pub drift_ratio: f64,
    pub limit: f64,
    pub passed: bool,
    pub message: String,
}

/// Check storey drift per IS 1893 Cl. 7.11.1
///
/// δ_actual = δ_elastic × R
/// Δ / h ≤ 0.004
pub fn check_storey_drift(
    storey_height_mm: f64,
    elastic_drift_mm: f64,
    response_reduction: f64,
    storey_number: usize,
) -> DriftCheckResult {
    let actual = elastic_drift_mm * response_reduction;
    let ratio = actual / storey_height_mm;
    let limit = 0.004;
    let passed = ratio <= limit;

    DriftCheckResult {
        storey: storey_number,
        elastic_drift_mm,
        actual_drift_mm: actual,
        drift_ratio: ratio,
        limit,
        passed,
        message: format!(
            "Storey {storey_number}: drift = {ratio:.4} ({actual:.2} mm / {storey_height_mm:.0} mm) vs 0.004 → {}",
            if passed { "OK" } else { "FAIL" }
        ),
    }
}

// ── Modal Combination ──

/// SRSS modal combination: R = √(Σ ri²)
pub fn combine_srss(modal_responses: &[f64]) -> f64 {
    modal_responses.iter().map(|r| r * r).sum::<f64>().sqrt()
}

/// CQC modal combination with cross-correlation coefficients
///
/// R = √(Σi Σj ρij × ri × rj)
/// ρij = 8ξ²(1+β)β^1.5 / ((1−β²)² + 4ξ²β(1+β)²)
pub fn combine_cqc(modal_responses: &[f64], frequencies: &[f64], damping: f64) -> f64 {
    let n = modal_responses.len().min(frequencies.len());
    let xi = damping.abs().clamp(0.0, 0.30);
    let mut result = 0.0;

    for i in 0..n {
        if frequencies[i] <= 0.0 {
            continue;
        }
        for j in 0..n {
            if frequencies[j] <= 0.0 {
                continue;
            }

            let beta = if frequencies[i].abs() > 1e-10 {
                (frequencies[j] / frequencies[i]).abs()
            } else {
                1.0
            };

            let rho = if (beta - 1.0).abs() < 1e-10 {
                1.0
            } else {
                let num = 8.0 * xi * xi * (1.0 + beta) * beta.powf(1.5);
                let den = (1.0 - beta * beta).powi(2) + 4.0 * xi * xi * beta * (1.0 + beta).powi(2);
                if den.abs() > 1e-20 {
                    (num / den).clamp(0.0, 1.0)
                } else {
                    0.0
                }
            };

            result += rho * modal_responses[i] * modal_responses[j];
        }
    }

    result.max(0.0).sqrt()
}

// ── Equivalent Lateral Forces (One-Call) ──

/// Node weight input for EQ force generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeWeight {
    pub node_id: String,
    pub weight_kn: f64,
    pub height_m: f64,
}

/// Lateral force at a node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LateralForce {
    pub node_id: String,
    pub force_kn: f64,
    pub direction: String,
}

/// Result of equivalent lateral force generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EqForceResult {
    pub forces: Vec<LateralForce>,
    pub vb_kn: f64,
    pub ah: f64,
    pub period_s: f64,
    pub w_total_kn: f64,
}

/// Generate equivalent lateral forces for entire building
///
/// Combines period estimation → base shear → vertical distribution into one call
pub fn generate_equivalent_lateral_forces(
    node_weights: &[NodeWeight],
    zone: SeismicZone,
    soil: SoilType,
    importance_factor: f64,
    response_reduction: f64,
    building_type: &str,
    base_dimension: f64,
    direction: &str,
) -> EqForceResult {
    let height = node_weights
        .iter()
        .map(|n| n.height_m)
        .fold(0.0_f64, f64::max);

    let period = calculate_period_approx(height, building_type, base_dimension);
    let w_total: f64 = node_weights.iter().map(|n| n.weight_kn).sum();

    let bs = calculate_base_shear(w_total, period, zone, soil, importance_factor, response_reduction);

    let weights: Vec<f64> = node_weights.iter().map(|n| n.weight_kn).collect();
    let heights: Vec<f64> = node_weights.iter().map(|n| n.height_m).collect();
    let qi = vertical_distribution(bs.vb_kn, &weights, &heights);

    let forces = node_weights
        .iter()
        .zip(qi.iter())
        .map(|(nw, &q)| LateralForce {
            node_id: nw.node_id.clone(),
            force_kn: (q * 1000.0).round() / 1000.0,
            direction: direction.to_string(),
        })
        .collect();

    EqForceResult {
        forces,
        vb_kn: (bs.vb_kn * 1000.0).round() / 1000.0,
        ah: (bs.ah * 1_000_000.0).round() / 1_000_000.0,
        period_s: (period * 10000.0).round() / 10000.0,
        w_total_kn: (w_total * 1000.0).round() / 1000.0,
    }
}

// ── Torsion Provisions (Cl. 7.9) ──

/// Torsion analysis result per IS 1893:2016 Cl. 7.9
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorsionResult {
    pub static_eccentricity_m: f64,
    pub accidental_eccentricity_m: f64,
    pub design_eccentricity_m: f64,
    pub torsional_moment_knm: f64,
    pub direction: String,
    pub message: String,
}

/// Calculate design eccentricity per IS 1893 Cl. 7.9.2
///
/// Design eccentricity = Static ecc + Accidental ecc
/// Accidental ecc = 0.05 × building dimension perpendicular to earthquake direction
///
/// # Arguments
/// * `static_ecc_m` - Static eccentricity between CM and CR (m)
/// * `building_dimension_perp_m` - Building dimension perpendicular to EQ direction (m)
/// * `floor_shear_kn` - Lateral force at the floor (kN)
///
/// # Returns
/// Design eccentricity (m)
pub fn calculate_design_eccentricity(
    static_ecc_m: f64,
    building_dimension_perp_m: f64,
) -> f64 {
    let accidental_ecc = 0.05 * building_dimension_perp_m.abs();
    static_ecc_m.abs() + accidental_ecc
}

/// Calculate torsional moment per IS 1893 Cl. 7.9.1
///
/// Mt = Fi × edi
/// where:
/// - Fi = lateral force at floor i
/// - edi = design eccentricity at floor i
///
/// # Arguments
/// * `floor_shear_kn` - Lateral shear force at the floor (kN)
/// * `static_ecc_m` - Static eccentricity between CM and CR (m)
/// * `building_dimension_perp_m` - Building dimension perpendicular to EQ direction (m)
/// * `direction` - Direction of analysis ("X" or "Y")
///
/// # Returns
/// Torsion analysis result
pub fn calculate_torsional_moment(
    floor_shear_kn: f64,
    static_ecc_m: f64,
    building_dimension_perp_m: f64,
    direction: &str,
) -> TorsionResult {
    let accidental_ecc = 0.05 * building_dimension_perp_m.abs();
    let design_ecc = static_ecc_m.abs() + accidental_ecc;
    let mt = floor_shear_kn * design_ecc;

    TorsionResult {
        static_eccentricity_m: static_ecc_m,
        accidental_eccentricity_m: accidental_ecc,
        design_eccentricity_m: design_ecc,
        torsional_moment_knm: mt,
        direction: direction.to_string(),
        message: format!(
            "Torsion in {} direction: Mt = {:.2} kN·m (Fi = {:.2} kN × edi = {:.3} m)",
            direction, mt, floor_shear_kn, design_ecc
        ),
    }
}

/// Calculate accidental eccentricity per IS 1893 Cl. 7.9.2
///
/// eai = ±0.05 × Li
/// where Li = floor dimension perpendicular to the direction of force
///
/// # Arguments
/// * `building_dimension_perp_m` - Building dimension perpendicular to EQ direction (m)
///
/// # Returns
/// Accidental eccentricity (m) — always positive, sign applied in analysis
pub fn calculate_accidental_eccentricity(building_dimension_perp_m: f64) -> f64 {
    0.05 * building_dimension_perp_m.abs()
}

// ── Capacity Design Checks (IS 1893 Cl. 7.2, 7.10) ──

/// Check for soft storey / weak storey condition per IS 1893 Cl. 7.10.3
///
/// A storey is considered "soft" if its lateral stiffness is less than 70% of
/// that in the storey above, or less than 80% of the average stiffness of
/// the three storeys above.
///
/// **Strength-based check**: Storey shear strength should not be < 80% of storey above
///
/// **Reference**: IS 1893:2016 Cl. 7.10.3
///
/// # Arguments
/// * `storey_stiffness_kn_per_m` - Lateral stiffness of current storey (kN/m)
/// * `storey_above_stiffness_kn_per_m` - Lateral stiffness of storey above (kN/m)
/// * `storey_shear_capacity_kn` - Shear capacity of current storey (kN)
/// * `storey_above_shear_capacity_kn` - Shear capacity of storey above (kN)
///
/// # Returns
/// SoftStoreyResult with pass/fail and diagnostic messages
pub fn check_soft_storey(
    storey_stiffness_kn_per_m: f64,
    storey_above_stiffness_kn_per_m: f64,
    storey_shear_capacity_kn: f64,
    storey_above_shear_capacity_kn: f64,
) -> SoftStoreyResult {
    // Stiffness-based check: k_i ≥ 0.70 × k_(i+1)
    let stiffness_ratio = storey_stiffness_kn_per_m / storey_above_stiffness_kn_per_m;
    let stiffness_check_passed = stiffness_ratio >= 0.70;

    // Strength-based check: V_i ≥ 0.80 × V_(i+1)
    let strength_ratio = storey_shear_capacity_kn / storey_above_shear_capacity_kn;
    let strength_check_passed = strength_ratio >= 0.80;

    let passed = stiffness_check_passed && strength_check_passed;

    let mut messages = Vec::new();
    if !stiffness_check_passed {
        messages.push(format!(
            "⚠️ Soft storey: Stiffness ratio {:.2} < 0.70 (IS 1893 Cl. 7.10.3)",
            stiffness_ratio
        ));
    }
    if !strength_check_passed {
        messages.push(format!(
            "⚠️ Weak storey: Strength ratio {:.2} < 0.80 (IS 1893 Cl. 7.10.3)",
            strength_ratio
        ));
    }
    if passed {
        messages.push("✓ No soft/weak storey condition detected".to_string());
    }

    SoftStoreyResult {
        stiffness_ratio,
        strength_ratio,
        stiffness_check_passed,
        strength_check_passed,
        passed,
        messages,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoftStoreyResult {
    pub stiffness_ratio: f64,
    pub strength_ratio: f64,
    pub stiffness_check_passed: bool,
    pub strength_check_passed: bool,
    pub passed: bool,
    pub messages: Vec<String>,
}

/// Check column-beam strength hierarchy for capacity design per IS 1893 Cl. 7.2.3
///
/// **Strong-column-weak-beam principle**: At a beam-column joint, the sum of moment
/// capacities of columns should exceed the sum of moment capacities of beams.
///
/// ΣM_c ≥ 1.2 × ΣM_b (for Special RC Moment Frames)
///
/// This ensures plastic hinges form in beams (ductile, repairable) rather than
/// columns (non-ductile, collapse risk).
///
/// **Reference**: IS 1893:2016 Cl. 7.2.3, IS 13920:2016 Cl. 7.3.3
///
/// # Arguments
/// * `sum_column_moment_knm` - Sum of moment capacities of columns at joint (kN·m)
/// * `sum_beam_moment_knm` - Sum of moment capacities of beams at joint (kN·m)
/// * `frame_type` - Frame type ("SMRF", "OMRF", "IMRF")
///
/// # Returns
/// CapacityDesignResult with pass/fail and messages
pub fn check_column_beam_capacity_hierarchy(
    sum_column_moment_knm: f64,
    sum_beam_moment_knm: f64,
    frame_type: &str,
) -> CapacityDesignResult {
    // Factor depends on frame type
    // SMRF (Special Moment Resisting Frame): 1.2 per IS 13920
    // OMRF (Ordinary Moment Resisting Frame): 1.1
    // IMRF (Intermediate Moment Resisting Frame): 1.1
    let factor = match frame_type {
        "SMRF" | "special" => 1.2,
        "OMRF" | "ordinary" => 1.1,
        "IMRF" | "intermediate" => 1.1,
        _ => 1.2, // Default to most conservative
    };

    let required_column_moment = factor * sum_beam_moment_knm;
    let passed = sum_column_moment_knm >= required_column_moment;
    let capacity_ratio = sum_column_moment_knm / required_column_moment;

    let message = if passed {
        format!(
            "✓ Strong-column-weak-beam: ΣM_c = {:.2} kN·m ≥ {} × ΣM_b = {:.2} kN·m (ratio: {:.2})",
            sum_column_moment_knm, factor, required_column_moment, capacity_ratio
        )
    } else {
        format!(
            "✗ Strong-column-weak-beam VIOLATION: ΣM_c = {:.2} kN·m < {} × ΣM_b = {:.2} kN·m (shortfall: {:.2} kN·m)",
            sum_column_moment_knm, factor, required_column_moment,
            required_column_moment - sum_column_moment_knm
        )
    };

    CapacityDesignResult {
        sum_column_moment_knm,
        sum_beam_moment_knm,
        required_factor: factor,
        required_column_moment_knm: required_column_moment,
        capacity_ratio,
        passed,
        message,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapacityDesignResult {
    pub sum_column_moment_knm: f64,
    pub sum_beam_moment_knm: f64,
    pub required_factor: f64,
    pub required_column_moment_knm: f64,
    pub capacity_ratio: f64,
    pub passed: bool,
    pub message: String,
}

/// Check P-Delta effects per IS 1893 Cl. 7.11.2
///
/// P-Δ effects should be considered when stability coefficient θ_i > 0.10
///
/// θ_i = (P_i × Δ_i) / (V_i × h_i)
///
/// where:
/// - P_i = total gravity load at storey i
/// - Δ_i = interstory drift
/// - V_i = seismic storey shear
/// - h_i = storey height
///
/// **Reference**: IS 1893:2016 Cl. 7.11.2
///
/// # Arguments
/// * `gravity_load_kn` - Total gravity load above storey (kN)
/// * `interstory_drift_mm` - Interstory drift (mm)
/// * `storey_shear_kn` - Seismic storey shear (kN)
/// * `storey_height_mm` - Storey height (mm)
///
/// # Returns
/// P-Delta check result
pub fn check_p_delta_effects(
    gravity_load_kn: f64,
    interstory_drift_mm: f64,
    storey_shear_kn: f64,
    storey_height_mm: f64,
) -> PDeltaResult {
    let drift_m = interstory_drift_mm / 1000.0;
    let height_m = storey_height_mm / 1000.0;

    let theta = (gravity_load_kn * drift_m) / (storey_shear_kn * height_m);
    let requires_p_delta = theta > 0.10;

    let message = if requires_p_delta {
        format!(
            "⚠️ P-Δ effects SIGNIFICANT: θ = {:.3} > 0.10 — must include in analysis (IS 1893 Cl. 7.11.2)",
            theta
        )
    } else {
        format!(
            "✓ P-Δ effects negligible: θ = {:.3} ≤ 0.10",
            theta
        )
    };

    PDeltaResult {
        stability_coefficient: theta,
        requires_p_delta_analysis: requires_p_delta,
        gravity_load_kn,
        interstory_drift_mm,
        storey_shear_kn,
        storey_height_mm,
        message,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PDeltaResult {
    pub stability_coefficient: f64,
    pub requires_p_delta_analysis: bool,
    pub gravity_load_kn: f64,
    pub interstory_drift_mm: f64,
    pub storey_shear_kn: f64,
    pub storey_height_mm: f64,
    pub message: String,
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_period_rc() {
        let t = calculate_period_approx(30.0, "rc_frame", 0.0);
        assert!((t - 0.961).abs() < 0.01, "T should be ~0.961, got {t}");
    }

    #[test]
    fn test_period_infill() {
        let t = calculate_period_approx(30.0, "rc_infill", 15.0);
        assert!((t - 0.697).abs() < 0.01, "T should be ~0.697, got {t}");
    }

    #[test]
    fn test_base_shear() {
        let bs = calculate_base_shear(
            1300.0, 0.961, SeismicZone::IV, SoilType::Medium, 1.5, 5.0,
        );
        assert!(bs.vb_kn > 50.0 && bs.vb_kn < 200.0);
    }

    #[test]
    fn test_cqc() {
        let responses = vec![50.0, 30.0, 20.0];
        let freqs = vec![2.0, 5.0, 10.0];
        let r = combine_cqc(&responses, &freqs, 0.05);
        assert!(r > 50.0 && r < 100.0, "CQC = {r}");
    }

    #[test]
    fn test_drift() {
        let r = check_storey_drift(3500.0, 3.5, 5.0, 2);
        assert!(r.drift_ratio > 0.004, "Should fail at 0.005");
        assert!(!r.passed);
    }

    #[test]
    fn test_accidental_eccentricity() {
        // Building 20m × 30m, EQ in X direction
        let ecc_acc = calculate_accidental_eccentricity(30.0);
        assert_eq!(ecc_acc, 1.5, "Accidental ecc should be 0.05 × 30m = 1.5m");
    }

    #[test]
    fn test_torsional_moment() {
        // Floor shear 500 kN, static ecc 2m, building width 25m
        let result = calculate_torsional_moment(500.0, 2.0, 25.0, "X");
        
        // Accidental ecc = 0.05 × 25 = 1.25 m
        // Design ecc = 2.0 + 1.25 = 3.25 m
        // Mt = 500 × 3.25 = 1625 kN·m
        assert_eq!(result.accidental_eccentricity_m, 1.25);
        assert_eq!(result.design_eccentricity_m, 3.25);
        assert_eq!(result.torsional_moment_knm, 1625.0);
        assert_eq!(result.direction, "X");
    }
}
