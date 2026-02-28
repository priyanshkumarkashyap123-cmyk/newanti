//! AISC 360 Direct Analysis Method
//!
//! Complete implementation of the Direct Analysis Method per AISC 360-22
//! Chapter C for steel frame stability analysis.
//!
//! ## Features
//! - Notional loads (Cl. C2.2b)
//! - τb stiffness reduction factor (Cl. C2.3)
//! - B1/B2 amplification factors
//! - P-Delta analysis requirements
//! - Second-order analysis validation
//! - Effective length factor K=1.0

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// AISC 360 DESIGN PARAMETERS
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum AISCEdition {
    AISC36010,
    AISC36016,
    AISC36022,
}

impl Default for AISCEdition {
    fn default() -> Self {
        AISCEdition::AISC36022
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum AnalysisMethod {
    /// Effective Length Method (old approach, K factors)
    EffectiveLength,
    /// Direct Analysis Method (DAM) - preferred
    DirectAnalysis,
    /// First-Order Analysis with amplified moments
    FirstOrderWithB1B2,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectAnalysisConfig {
    /// AISC edition
    pub edition: AISCEdition,
    /// Include notional loads
    pub apply_notional_loads: bool,
    /// Notional load coefficient (default 0.002)
    pub notional_load_coefficient: f64,
    /// Apply stiffness reduction τb
    pub apply_stiffness_reduction: bool,
    /// Include initial imperfections
    pub include_initial_imperfections: bool,
    /// Imperfection magnitude (L/500 default)
    pub imperfection_ratio: f64,
    /// Second-order P-Delta analysis
    pub second_order_analysis: bool,
    /// Number of iterations for P-Delta
    pub pdelta_iterations: usize,
    /// Convergence tolerance for P-Delta
    pub pdelta_tolerance: f64,
}

impl Default for DirectAnalysisConfig {
    fn default() -> Self {
        DirectAnalysisConfig {
            edition: AISCEdition::AISC36022,
            apply_notional_loads: true,
            notional_load_coefficient: 0.002,
            apply_stiffness_reduction: true,
            include_initial_imperfections: false,
            imperfection_ratio: 500.0, // L/500
            second_order_analysis: true,
            pdelta_iterations: 10,
            pdelta_tolerance: 0.001,
        }
    }
}

// ============================================================================
// NOTIONAL LOADS (AISC 360 Cl. C2.2b)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Level {
    /// Level ID/name
    pub id: String,
    /// Elevation (m)
    pub elevation: f64,
    /// Total gravity load at level (kN)
    pub yi: f64,
    /// Story height to level above (m)
    pub story_height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotionalLoad {
    /// Level ID
    pub level_id: String,
    /// Notional load in X direction (kN)
    pub ni_x: f64,
    /// Notional load in Y direction (kN)
    pub ni_y: f64,
    /// Applied at elevation (m)
    pub elevation: f64,
}

/// Calculate notional loads per AISC 360 C2.2b
///
/// Ni = 0.002 × Yi (or as specified)
pub fn calculate_notional_loads(
    levels: &[Level],
    config: &DirectAnalysisConfig,
) -> Vec<NotionalLoad> {
    let alpha = config.notional_load_coefficient;
    
    levels.iter().map(|level| {
        let ni = alpha * level.yi;
        NotionalLoad {
            level_id: level.id.clone(),
            ni_x: ni,
            ni_y: ni,
            elevation: level.elevation,
        }
    }).collect()
}

/// Calculate notional loads for a single load case
/// Returns (Ni_x, Ni_y) for each level
pub fn notional_loads_for_case(
    levels: &[Level],
    gravity_multiplier: f64,
    lateral_x: f64,
    lateral_y: f64,
    config: &DirectAnalysisConfig,
) -> Vec<NotionalLoad> {
    let alpha = config.notional_load_coefficient;
    
    levels.iter().map(|level| {
        // Yi factored for this load case
        let yi_factored = gravity_multiplier * level.yi;
        let ni = alpha * yi_factored;
        
        // Direction of notional loads matches lateral
        let dir_x = if lateral_x.abs() > 1e-6 { lateral_x.signum() } else { 1.0 };
        let dir_y = if lateral_y.abs() > 1e-6 { lateral_y.signum() } else { 1.0 };
        
        NotionalLoad {
            level_id: level.id.clone(),
            ni_x: dir_x * ni,
            ni_y: dir_y * ni,
            elevation: level.elevation,
        }
    }).collect()
}

// ============================================================================
// STIFFNESS REDUCTION τb (AISC 360 Cl. C2.3)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberProperties {
    /// Member ID
    pub id: String,
    /// Yield stress Fy (MPa)
    pub fy: f64,
    /// Elastic modulus E (MPa)
    pub e: f64,
    /// Area (mm²)
    pub a: f64,
    /// Moment of inertia about x (mm⁴)
    pub ix: f64,
    /// Moment of inertia about y (mm⁴)
    pub iy: f64,
    /// Length (mm)
    pub l: f64,
    /// Required axial strength Pr (kN)
    pub pr: f64,
    /// Plastic moment about x (kN-m)
    pub mpx: f64,
    /// Plastic moment about y (kN-m)
    pub mpy: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StiffnessReduction {
    /// Member ID
    pub member_id: String,
    /// τb factor for flexural stiffness
    pub tau_b: f64,
    /// Pr/Py ratio
    pub pr_py_ratio: f64,
    /// Applied to EI
    pub ei_reduced: f64,
    /// Applied to EA (for axial stiffness)
    pub ea_reduced: f64,
}

/// Calculate stiffness reduction factor τb per AISC 360 C2.3
///
/// For αPr/Py ≤ 0.5: τb = 1.0
/// For αPr/Py > 0.5: τb = 4(αPr/Py)(1 - αPr/Py)
pub fn calculate_tau_b(
    member: &MemberProperties,
    alpha_pr: f64, // Factored Pr for LRFD (usually 1.0)
) -> StiffnessReduction {
    // Py = Fy × A
    let py = member.fy * member.a / 1000.0; // kN
    
    // Pr/Py ratio
    let pr = member.pr.abs();
    let ratio = alpha_pr * pr / py;
    
    // τb calculation
    let tau_b = if ratio <= 0.5 {
        1.0
    } else {
        4.0 * ratio * (1.0 - ratio)
    };
    
    // τb cannot exceed 1.0
    let tau_b = tau_b.min(1.0);
    
    // Reduced stiffness
    let _ei_x = 0.8 * tau_b * member.e * member.ix;
    let _ei_y = 0.8 * tau_b * member.e * member.iy;
    let _ea = 0.8 * member.e * member.a; // EA reduction is just 0.8
    
    StiffnessReduction {
        member_id: member.id.clone(),
        tau_b,
        pr_py_ratio: ratio,
        ei_reduced: 0.8 * tau_b,
        ea_reduced: 0.8,
    }
}

/// Calculate τb for all members
pub fn calculate_all_tau_b(
    members: &[MemberProperties],
    alpha_pr: f64,
) -> Vec<StiffnessReduction> {
    members.iter().map(|m| calculate_tau_b(m, alpha_pr)).collect()
}

// ============================================================================
// B1/B2 AMPLIFICATION (AISC 360 Appendix 8)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct B1B2Factors {
    /// B1 factor (non-sway amplification)
    pub b1_x: f64,
    pub b1_y: f64,
    /// B2 factor (sway amplification)
    pub b2_x: f64,
    pub b2_y: f64,
    /// Story stiffness used
    pub story_stiffness_x: f64,
    pub story_stiffness_y: f64,
    /// ΣPe2 (Euler buckling sum)
    pub sum_pe2_x: f64,
    pub sum_pe2_y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryData {
    /// Story ID
    pub id: String,
    /// Story height (mm)
    pub h: f64,
    /// Total gravity load in story (kN)
    pub p_story: f64,
    /// Story drift under lateral load (mm)
    pub delta_x: f64,
    pub delta_y: f64,
    /// Applied lateral force (kN)
    pub v_x: f64,
    pub v_y: f64,
    /// Cm factor for members (typically 1.0 for sway frames)
    pub cm: f64,
    /// RM factor: 1 - 0.15(Pmf/Pstory).
    /// Use 0.85 when all columns are in moment frames, 1.0 for braced frames.
    pub rm: f64,
}

/// Calculate B2 (sway amplification) factor per AISC 360 Appendix 8.2.2
///
/// B2 = 1 / (1 - αΣPnt/ΣPe2)
/// where ΣPe2 can be calculated from story stiffness
pub fn calculate_b2(
    story: &StoryData,
    _config: &DirectAnalysisConfig,
) -> (f64, f64) {
    let alpha = 1.0; // LRFD
    
    // Story stiffness method: Pe2 = RM × H × L / ΔH
    // RM = 1 - 0.15(Pmf/Pstory) per AISC 360 App. 8.2.2
    let rm = story.rm;
    
    // ΣPe2 from drift
    let pe2_x = if story.delta_x.abs() > 1e-6 {
        rm * story.h * story.v_x / story.delta_x
    } else {
        f64::MAX
    };
    
    let pe2_y = if story.delta_y.abs() > 1e-6 {
        rm * story.h * story.v_y / story.delta_y
    } else {
        f64::MAX
    };
    
    // B2 calculation
    let b2_x = if pe2_x > alpha * story.p_story {
        1.0 / (1.0 - alpha * story.p_story / pe2_x)
    } else {
        f64::MAX // Unstable
    };
    
    let b2_y = if pe2_y > alpha * story.p_story {
        1.0 / (1.0 - alpha * story.p_story / pe2_y)
    } else {
        f64::MAX
    };
    
    // AISC 360 does not impose an artificial cap on B2.
    // B2 > 1.5 triggers requirement for rigorous second-order analysis.
    // B2 → ∞ indicates elastic instability — do NOT silently clamp.
    
    (b2_x.max(1.0), b2_y.max(1.0))
}

/// Calculate B1 (non-sway amplification) factor per AISC 360 Appendix 8.2.1
///
/// B1 = Cm / (1 - αPr/Pe1) ≥ 1.0
/// Pe1 uses reduced stiffness EI* = 0.8τbEI for Direct Analysis Method
pub fn calculate_b1(
    member: &MemberProperties,
    cm: f64,
    k_factor: f64,
    tau_b: f64, // τb stiffness reduction factor (1.0 if not using DAM)
) -> (f64, f64) {
    let alpha = 1.0; // LRFD
    
    // Pe1 = π²EI*/(K1×L)² where EI* = 0.8×τb×EI for DAM (AISC 360-22 C2.3)
    let ei_star_x = 0.8 * tau_b * member.e * member.ix;
    let ei_star_y = 0.8 * tau_b * member.e * member.iy;
    let pe1_x = PI.powi(2) * ei_star_x / 
        (k_factor * member.l).powi(2) / 1000.0; // kN
    let pe1_y = PI.powi(2) * ei_star_y / 
        (k_factor * member.l).powi(2) / 1000.0;
    
    let pr = member.pr.abs();
    
    // B1 calculation
    let b1_x = if pe1_x > alpha * pr {
        cm / (1.0 - alpha * pr / pe1_x)
    } else {
        f64::MAX
    };
    
    let b1_y = if pe1_y > alpha * pr {
        cm / (1.0 - alpha * pr / pe1_y)
    } else {
        f64::MAX
    };
    
    (b1_x.max(1.0).min(10.0), b1_y.max(1.0).min(10.0))
}

// ============================================================================
// SECOND-ORDER P-DELTA ANALYSIS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PDeltaResult {
    /// Number of iterations performed
    pub iterations: usize,
    /// Converged successfully
    pub converged: bool,
    /// Final convergence error
    pub final_error: f64,
    /// Amplification factor (approx B2)
    pub amplification_factor: f64,
    /// Member end moments after P-Delta (node1, node2) per member
    pub amplified_moments: Vec<(String, f64, f64)>,
}

#[derive(Debug, Clone)]
pub struct PDeltaFrame {
    /// Story heights (bottom to top)
    pub story_heights: Vec<f64>,
    /// Story weights (dead + live typically)
    pub story_weights: Vec<f64>,
    /// First-order story drifts
    pub first_order_drifts: Vec<f64>,
    /// First-order story shears
    pub story_shears: Vec<f64>,
}

/// Perform simplified P-Delta analysis (story stiffness approach)
///
/// Iterates until convergence: δ_new = δ1 × B2
pub fn pdelta_analysis(
    frame: &PDeltaFrame,
    config: &DirectAnalysisConfig,
) -> PDeltaResult {
    let n_stories = frame.story_heights.len();
    let mut drifts = frame.first_order_drifts.clone();
    let mut prev_drifts = vec![0.0; n_stories];
    
    let mut iteration = 0;
    let mut error = f64::MAX;
    
    while iteration < config.pdelta_iterations && error > config.pdelta_tolerance {
        prev_drifts = drifts.clone();
        
        // Calculate P-Delta shears for each story
        for i in 0..n_stories {
            // Cumulative P above this story
            let p_above: f64 = frame.story_weights[i..].iter().sum();
            
            // P-Delta moment = P × Δ
            let pdelta_moment = p_above * drifts[i] / 1000.0; // kN-m
            
            // Additional shear = M / h
            let pdelta_shear = pdelta_moment / frame.story_heights[i];
            
            // Story stiffness
            let k_story = if drifts[i].abs() > 1e-6 {
                frame.story_shears[i] / frame.first_order_drifts[i]
            } else {
                f64::MAX
            };
            
            // Additional drift from P-Delta shear
            let additional_drift = if k_story.is_finite() {
                pdelta_shear * 1000.0 / k_story
            } else {
                0.0
            };
            
            drifts[i] = frame.first_order_drifts[i] + additional_drift;
        }
        
        // Calculate convergence error
        let max_drift = drifts.iter().fold(f64::MIN, |a, &b| a.max(b.abs()));
        if max_drift > 1e-6 {
            error = drifts.iter().zip(&prev_drifts)
                .map(|(d, p)| (d - p).abs())
                .fold(f64::MIN, |a, b| a.max(b)) / max_drift;
        } else {
            error = 0.0;
        }
        
        iteration += 1;
    }
    
    // Calculate amplification factor
    let first_order_sum: f64 = frame.first_order_drifts.iter().sum();
    let final_sum: f64 = drifts.iter().sum();
    let amplification = if first_order_sum.abs() > 1e-6 {
        final_sum / first_order_sum
    } else {
        1.0
    };
    
    PDeltaResult {
        iterations: iteration,
        converged: error <= config.pdelta_tolerance,
        final_error: error,
        amplification_factor: amplification,
        amplified_moments: Vec::new(), // Would be populated from full FEA
    }
}

// ============================================================================
// DIRECT ANALYSIS REQUIREMENTS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectAnalysisRequirements {
    /// Notional loads required
    pub notional_loads_required: bool,
    /// Stiffness reduction required
    pub stiffness_reduction_required: bool,
    /// Second-order analysis required
    pub second_order_required: bool,
    /// K = 1.0 can be used
    pub k_equals_one: bool,
    /// B2 limit exceeded
    pub b2_limit_exceeded: bool,
    /// Maximum B2 in structure
    pub max_b2: f64,
    /// Additional requirements/notes
    pub notes: Vec<String>,
}

/// Check Direct Analysis Method requirements per AISC 360 Chapter C
pub fn check_dam_requirements(
    stories: &[StoryData],
    members: &[MemberProperties],
    config: &DirectAnalysisConfig,
) -> DirectAnalysisRequirements {
    let mut notes = Vec::new();
    
    // Calculate max B2
    let mut max_b2: f64 = 1.0;
    for story in stories {
        let (b2_x, b2_y) = calculate_b2(story, config);
        max_b2 = max_b2.max(b2_x).max(b2_y);
    }
    
    // Check B2 limit
    let b2_limit_exceeded = max_b2 > 1.5;
    if b2_limit_exceeded {
        notes.push(format!(
            "B2 = {:.2} > 1.5: More rigorous second-order analysis required",
            max_b2
        ));
    }
    
    // Notional loads always required for DAM
    notes.push("Notional loads Ni = 0.002Yi applied at each level".to_string());
    
    // Stiffness reduction
    notes.push("Reduced stiffness 0.8τbEI and 0.8EA applied".to_string());
    
    // K = 1.0 for DAM
    notes.push("Effective length factor K = 1.0 for all members".to_string());
    
    // Check for high axial loads
    let mut high_axial_members = Vec::new();
    for member in members {
        let py = member.fy * member.a / 1000.0;
        if member.pr / py > 0.5 {
            high_axial_members.push(member.id.clone());
        }
    }
    if !high_axial_members.is_empty() {
        notes.push(format!(
            "Members with Pr/Py > 0.5 (reduced τb): {:?}",
            high_axial_members
        ));
    }
    
    DirectAnalysisRequirements {
        notional_loads_required: true,
        stiffness_reduction_required: true,
        second_order_required: true,
        k_equals_one: true,
        b2_limit_exceeded,
        max_b2,
        notes,
    }
}

// ============================================================================
// LOAD CASE GENERATION FOR DAM
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DAMLoadCase {
    /// Load case name
    pub name: String,
    /// Base load combination
    pub base_combination: String,
    /// Notional load direction (+X, -X, +Y, -Y)
    pub notional_direction: String,
    /// Notional load values per level
    pub notional_loads: Vec<NotionalLoad>,
    /// Is gravity-only case
    pub is_gravity_only: bool,
}

/// Generate load cases with notional loads for Direct Analysis Method
pub fn generate_dam_load_cases(
    base_combinations: &[String],
    levels: &[Level],
    config: &DirectAnalysisConfig,
) -> Vec<DAMLoadCase> {
    let mut cases = Vec::new();
    
    for combo in base_combinations {
        // Determine if gravity-only or lateral
        // S = Snow (gravity load) — do NOT exclude it from gravity-only classification
        let is_gravity = combo.contains("D") && 
            !combo.contains("E") && 
            !combo.contains("W");
        
        if is_gravity {
            // Gravity-only: apply notional in all 4 directions
            for (dir_name, dir_x, dir_y) in [
                ("+X", 1.0, 0.0),
                ("-X", -1.0, 0.0),
                ("+Y", 0.0, 1.0),
                ("-Y", 0.0, -1.0),
            ] {
                let notional = notional_loads_for_case(
                    levels, 1.0, dir_x, dir_y, config
                );
                
                cases.push(DAMLoadCase {
                    name: format!("{} + Notional {}", combo, dir_name),
                    base_combination: combo.clone(),
                    notional_direction: dir_name.to_string(),
                    notional_loads: notional,
                    is_gravity_only: true,
                });
            }
        } else {
            // Lateral: apply notional in direction of lateral
            let (dir_x, dir_y) = if combo.contains("Ex") || combo.contains("+Ex") {
                (1.0, 0.0)
            } else if combo.contains("-Ex") {
                (-1.0, 0.0)
            } else if combo.contains("Ey") || combo.contains("+Ey") {
                (0.0, 1.0)
            } else if combo.contains("-Ey") {
                (0.0, -1.0)
            } else if combo.contains("Wx") {
                (1.0, 0.0) // Assume +X wind
            } else {
                (1.0, 0.0) // Default
            };
            
            let dir_name = if dir_x > 0.0 { "+X" } 
                else if dir_x < 0.0 { "-X" }
                else if dir_y > 0.0 { "+Y" }
                else { "-Y" };
            
            let notional = notional_loads_for_case(
                levels, 1.0, dir_x, dir_y, config
            );
            
            cases.push(DAMLoadCase {
                name: format!("{} + Notional", combo),
                base_combination: combo.clone(),
                notional_direction: dir_name.to_string(),
                notional_loads: notional,
                is_gravity_only: false,
            });
        }
    }
    
    cases
}

// ============================================================================
// DESIGN SUMMARY
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DAMDesignSummary {
    /// Analysis method used
    pub method: String,
    /// Notional load coefficient
    pub alpha_notional: f64,
    /// Maximum B2 factor
    pub max_b2: f64,
    /// Members requiring reduced τb
    pub reduced_tau_b_members: Vec<(String, f64)>,
    /// P-Delta convergence status
    pub pdelta_converged: bool,
    /// P-Delta amplification
    pub pdelta_amplification: f64,
    /// All requirements satisfied
    pub compliant: bool,
    /// Compliance notes
    pub compliance_notes: Vec<String>,
}

/// Generate Direct Analysis Method design summary
pub fn dam_design_summary(
    requirements: &DirectAnalysisRequirements,
    stiffness: &[StiffnessReduction],
    pdelta: Option<&PDeltaResult>,
    config: &DirectAnalysisConfig,
) -> DAMDesignSummary {
    let reduced_members: Vec<(String, f64)> = stiffness.iter()
        .filter(|s| s.tau_b < 1.0)
        .map(|s| (s.member_id.clone(), s.tau_b))
        .collect();
    
    let (pdelta_converged, pdelta_amp) = pdelta
        .map(|p| (p.converged, p.amplification_factor))
        .unwrap_or((true, 1.0));
    
    let compliant = !requirements.b2_limit_exceeded && pdelta_converged;
    
    let mut notes = requirements.notes.clone();
    if !compliant {
        notes.push("Structure may require rigorous second-order analysis".to_string());
    }
    
    DAMDesignSummary {
        method: "AISC 360 Direct Analysis Method".to_string(),
        alpha_notional: config.notional_load_coefficient,
        max_b2: requirements.max_b2,
        reduced_tau_b_members: reduced_members,
        pdelta_converged,
        pdelta_amplification: pdelta_amp,
        compliant,
        compliance_notes: notes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_notional_loads() {
        let levels = vec![
            Level { id: "L1".into(), elevation: 4.0, yi: 5000.0, story_height: 4.0 },
            Level { id: "L2".into(), elevation: 8.0, yi: 4000.0, story_height: 4.0 },
        ];
        let config = DirectAnalysisConfig::default();
        let notional = calculate_notional_loads(&levels, &config);
        
        assert_eq!(notional.len(), 2);
        assert!((notional[0].ni_x - 10.0).abs() < 0.01); // 0.002 × 5000
        assert!((notional[1].ni_x - 8.0).abs() < 0.01);  // 0.002 × 4000
    }
    
    #[test]
    fn test_tau_b() {
        let member = MemberProperties {
            id: "C1".into(),
            fy: 345.0,
            e: 200000.0,
            a: 10000.0,
            ix: 50_000_000.0,
            iy: 20_000_000.0,
            l: 4000.0,
            pr: 1500.0, // Pr/Py = 1500/(345×10) = 0.435
            mpx: 500.0,
            mpy: 300.0,
        };
        
        let result = calculate_tau_b(&member, 1.0);
        assert!((result.pr_py_ratio - 0.435).abs() < 0.01);
        assert!((result.tau_b - 1.0).abs() < 0.01); // < 0.5, so τb = 1.0
    }
    
    #[test]
    fn test_tau_b_high_axial() {
        let member = MemberProperties {
            id: "C2".into(),
            fy: 345.0,
            e: 200000.0,
            a: 10000.0,
            ix: 50_000_000.0,
            iy: 20_000_000.0,
            l: 4000.0,
            pr: 2500.0, // Pr/Py = 2500/3450 = 0.725
            mpx: 500.0,
            mpy: 300.0,
        };
        
        let result = calculate_tau_b(&member, 1.0);
        // τb = 4 × 0.725 × (1 - 0.725) = 0.798
        assert!((result.tau_b - 0.798).abs() < 0.05);
    }
    
    #[test]
    fn test_b2() {
        let story = StoryData {
            id: "Story1".into(),
            h: 4000.0,
            p_story: 5000.0,
            delta_x: 20.0,
            delta_y: 15.0,
            v_x: 500.0,
            v_y: 400.0,
            cm: 1.0,
            rm: 0.85,
        };
        let config = DirectAnalysisConfig::default();
        let (b2_x, b2_y) = calculate_b2(&story, &config);
        
        assert!(b2_x > 1.0);
        assert!(b2_y > 1.0);
    }
    
    #[test]
    fn test_pdelta() {
        let frame = PDeltaFrame {
            story_heights: vec![4000.0, 4000.0, 4000.0],
            story_weights: vec![5000.0, 4500.0, 4000.0],
            first_order_drifts: vec![15.0, 12.0, 8.0],
            story_shears: vec![600.0, 450.0, 250.0],
        };
        let config = DirectAnalysisConfig::default();
        let result = pdelta_analysis(&frame, &config);
        
        assert!(result.converged);
        assert!(result.amplification_factor > 1.0);
    }
    
    #[test]
    fn test_dam_load_cases() {
        let combos = vec![
            "1.4D".to_string(),
            "1.2D+1.6L".to_string(),
            "1.2D+1.0L+1.0Ex".to_string(),
        ];
        let levels = vec![
            Level { id: "L1".into(), elevation: 4.0, yi: 5000.0, story_height: 4.0 },
        ];
        let config = DirectAnalysisConfig::default();
        let cases = generate_dam_load_cases(&combos, &levels, &config);
        
        // Gravity cases get 4 directions, lateral gets 1
        assert!(cases.len() >= 3);
    }
}
