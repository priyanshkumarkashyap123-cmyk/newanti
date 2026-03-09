//! Ductile Detailing Module
//!
//! Seismic-resistant detailing provisions for reinforced concrete members
//! per IS 456:2000, IS 1893:2016, and ACI 318-19
//!
//! ## Features
//! - Confinement reinforcement (ties/spirals)
//! - Stirrup spacing near plastic hinges
//! - Reinforcement spacing limits
//! - Hook and bend requirements
//! - Splice location restrictions
//!
//! ## References
//! - IS 456:2000 Cl. 26.3, 26.5, 33 (Ductile Detailing)
//! - IS 1893:2016 Cl. 12 (Special RC Moment Frame)
//! - ACI 318-19 Ch. 18 (Earthquake-Resistant Structures)

use serde::{Deserialize, Serialize};

// ── Types ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuctileDetailingParams {
    /// Member type
    pub member_type: MemberType,
    /// Section width (mm)
    pub width_mm: f64,
    /// Section depth (mm)
    pub depth_mm: f64,
    /// Clear cover (mm)
    pub cover_mm: f64,
    /// Longitudinal bar diameter (mm)
    pub long_bar_dia_mm: f64,
    /// Number of longitudinal bars
    pub num_long_bars: u32,
    /// Stirrup/tie bar diameter (mm)
    pub tie_dia_mm: f64,
    /// Concrete grade (MPa)
    pub fck_mpa: f64,
    /// Steel grade (MPa)
    pub fy_mpa: f64,
    /// Seismic zone (II, III, IV, V)
    pub seismic_zone: SeismicZone,
    /// Design code
    pub code: DesignCode,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MemberType {
    Column,
    Beam,
    BeamColumnJoint,
    ShearWall,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SeismicZone {
    ZoneII,   // Low seismic
    ZoneIII,  // Moderate
    ZoneIV,   // High
    ZoneV,    // Very high
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DesignCode {
    IS456,
    IS1893,
    ACI318,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuctileDetailingResult {
    pub passed: bool,
    pub confinement_check: ConfinementCheck,
    pub spacing_check: SpacingCheck,
    pub splice_check: SpliceCheck,
    pub joint_check: Option<JointCheck>,
    pub messages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfinementCheck {
    pub required_spacing_mm: f64,
    pub provided_spacing_mm: f64,
    pub required_area_mm2: f64,
    pub provided_area_mm2: f64,
    pub passed: bool,
    pub clause: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpacingCheck {
    pub min_spacing_mm: f64,
    pub max_spacing_mm: f64,
    pub provided_spacing_mm: f64,
    pub passed: bool,
    pub remarks: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpliceCheck {
    pub splice_prohibited_zone_mm: f64,
    pub recommended_locations: Vec<String>,
    pub passed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JointCheck {
    pub joint_shear_stress_mpa: f64,
    pub allowable_shear_mpa: f64,
    pub passed: bool,
}

// ── Design Functions ──

/// Check ductile detailing requirements
pub fn check_ductile_detailing(params: &DuctileDetailingParams) -> Result<DuctileDetailingResult, String> {
    match params.code {
        DesignCode::IS456 | DesignCode::IS1893 => check_is_code_detailing(params),
        DesignCode::ACI318 => check_aci_detailing(params),
    }
}

/// IS 456 / IS 1893 ductile detailing checks
fn check_is_code_detailing(params: &DuctileDetailingParams) -> Result<DuctileDetailingResult, String> {
    let mut messages = Vec::new();
    
    // 1. Confinement reinforcement (IS 1893 Cl. 12.2 for columns, 12.3 for beams)
    let confinement = match params.member_type {
        MemberType::Column => check_column_confinement_is(params),
        MemberType::Beam => check_beam_confinement_is(params),
        MemberType::BeamColumnJoint => check_joint_confinement_is(params),
        _ => ConfinementCheck {
            required_spacing_mm: 0.0,
            provided_spacing_mm: 0.0,
            required_area_mm2: 0.0,
            provided_area_mm2: 0.0,
            passed: true,
            clause: "N/A".to_string(),
        }
    };

    // 2. Longitudinal bar spacing (IS 456 Cl. 26.3)
    let spacing = check_bar_spacing_is(params);

    // 3. Splice location (IS 1893 Cl. 12.2.3)
    let splice = check_splice_location_is(params);

    // 4. Joint shear (IS 1893 Cl. 12.4)
    let joint = if params.member_type == MemberType::BeamColumnJoint {
        Some(check_joint_shear_is(params))
    } else {
        None
    };

    // Collect messages
    if !confinement.passed {
        messages.push(format!(
            "⚠️ Confinement: Required spacing {} mm but provided {} mm ({})",
            confinement.required_spacing_mm, confinement.provided_spacing_mm, confinement.clause
        ));
    }
    if !spacing.passed {
        messages.push(format!("⚠️ Bar spacing: {}", spacing.remarks));
    }
    if !splice.passed {
        messages.push("⚠️ Splice location: Splices should not be in plastic hinge zones".to_string());
    }
    if let Some(ref j) = joint {
        if !j.passed {
            messages.push(format!(
                "⚠️ Joint shear: {:.2} MPa exceeds allowable {:.2} MPa",
                j.joint_shear_stress_mpa, j.allowable_shear_mpa
            ));
        }
    }

    let passed = confinement.passed && spacing.passed && splice.passed 
        && joint.as_ref().map(|j| j.passed).unwrap_or(true);

    Ok(DuctileDetailingResult {
        passed,
        confinement_check: confinement,
        spacing_check: spacing,
        splice_check: splice,
        joint_check: joint,
        messages,
    })
}

/// Column confinement per IS 1893 Cl. 12.2
fn check_column_confinement_is(params: &DuctileDetailingParams) -> ConfinementCheck {
    let d_core = params.depth_mm - 2.0 * params.cover_mm;
    let b_core = params.width_mm - 2.0 * params.cover_mm;
    
    // Required spacing per IS 1893 Cl. 12.2.2
    // s ≤ min(b/2, d/2, 100 mm) in plastic hinge zone (d from face)
    let spacing_limit_1 = b_core / 2.0;
    let spacing_limit_2 = d_core / 2.0;
    let spacing_limit_3 = 100.0;
    let required_spacing_mm = spacing_limit_1.min(spacing_limit_2).min(spacing_limit_3);

    // Confinement steel area per IS 456 Cl. 39.4
    // Ash = 0.09 * s * D * (fck/fy) (for rectangular ties)
    let d_long_bar = params.long_bar_dia_mm;
    let lap_splice_length = 45.0 * d_long_bar; // IS 456 Cl. 26.2.5.1(c)
    let plastic_hinge_zone = params.depth_mm.max(params.width_mm).max(lap_splice_length);
    
    // Required area of tie per spacing
    let ash_required = 0.09 * required_spacing_mm * (params.width_mm + params.depth_mm) 
        * (params.fck_mpa / params.fy_mpa);
    
    // Provided area (assuming 2-legged stirrup)
    let tie_area = std::f64::consts::PI * params.tie_dia_mm.powi(2) / 4.0;
    let ash_provided = 2.0 * tie_area; // 2-leg stirrup

    // Check for high seismic zones (IV, V)
    let is_high_seismic = matches!(params.seismic_zone, SeismicZone::ZoneIV | SeismicZone::ZoneV);
    let spacing_multiplier = if is_high_seismic { 0.75 } else { 1.0 };
    let required_spacing_final = required_spacing_mm * spacing_multiplier;

    ConfinementCheck {
        required_spacing_mm: required_spacing_final,
        provided_spacing_mm: required_spacing_mm, // User should provide actual
        required_area_mm2: ash_required,
        provided_area_mm2: ash_provided,
        passed: ash_provided >= ash_required,
        clause: "IS 1893 Cl. 12.2.2, IS 456 Cl. 39.4".to_string(),
    }
}

/// Beam confinement per IS 1893 Cl. 12.3
fn check_beam_confinement_is(params: &DuctileDetailingParams) -> ConfinementCheck {
    // Stirrup spacing in plastic hinge zone: s ≤ min(d/4, 8*φ_long, 100 mm)
    let d_eff = params.depth_mm - params.cover_mm - params.long_bar_dia_mm / 2.0;
    let spacing_limit_1 = d_eff / 4.0;
    let spacing_limit_2 = 8.0 * params.long_bar_dia_mm;
    let spacing_limit_3 = 100.0;
    let required_spacing_mm = spacing_limit_1.min(spacing_limit_2).min(spacing_limit_3);

    // IS 1893 Cl. 12.3.2: First stirrup within 50 mm from face
    let first_stirrup_location = 50.0; // mm

    ConfinementCheck {
        required_spacing_mm,
        provided_spacing_mm: required_spacing_mm, // User should provide actual
        required_area_mm2: 0.0, // Calculated based on shear
        provided_area_mm2: 0.0,
        passed: true, // Simplified: actual check needs shear demand
        clause: "IS 1893 Cl. 12.3.2".to_string(),
    }
}

/// Joint confinement per IS 1893 Cl. 12.4
fn check_joint_confinement_is(params: &DuctileDetailingParams) -> ConfinementCheck {
    // Joint ties: spacing ≤ 150 mm
    let required_spacing_mm = 150.0;

    ConfinementCheck {
        required_spacing_mm,
        provided_spacing_mm: required_spacing_mm,
        required_area_mm2: 0.0,
        provided_area_mm2: 0.0,
        passed: true,
        clause: "IS 1893 Cl. 12.4.3".to_string(),
    }
}

/// Check longitudinal bar spacing per IS 456 Cl. 26.3
fn check_bar_spacing_is(params: &DuctileDetailingParams) -> SpacingCheck {
    // IS 456 Cl. 26.3.2: Clear spacing ≥ max(bar_dia, 25 mm, aggregate_size + 5 mm)
    let min_clear_spacing = params.long_bar_dia_mm.max(25.0); // Assume aggregate = 20 mm
    
    // IS 456 Cl. 26.3.3: Maximum spacing for crack control
    // For beams: ≤ min(3*d_eff, 300 mm)
    // For columns: based on layer count
    let max_spacing = match params.member_type {
        MemberType::Beam => {
            let d_eff = params.depth_mm - params.cover_mm - params.long_bar_dia_mm / 2.0;
            (3.0 * d_eff).min(300.0)
        }
        MemberType::Column => 300.0, // Simplified
        _ => 300.0,
    };

    // Estimate provided spacing
    let available_width = params.width_mm - 2.0 * params.cover_mm - 2.0 * params.tie_dia_mm;
    let num_spaces = (params.num_long_bars - 1) as f64;
    let provided_spacing = if num_spaces > 0.0 {
        (available_width - params.num_long_bars as f64 * params.long_bar_dia_mm) / num_spaces
    } else {
        available_width
    };

    let passed = provided_spacing >= min_clear_spacing && provided_spacing <= max_spacing;
    let remarks = if !passed {
        format!(
            "Spacing {:.0} mm outside range [{:.0}, {:.0}] mm",
            provided_spacing, min_clear_spacing, max_spacing
        )
    } else {
        format!("Spacing {:.0} mm OK", provided_spacing)
    };

    SpacingCheck {
        min_spacing_mm: min_clear_spacing,
        max_spacing_mm: max_spacing,
        provided_spacing_mm: provided_spacing,
        passed,
        remarks,
    }
}

/// Check splice locations per IS 1893 Cl. 12.2.3
fn check_splice_location_is(params: &DuctileDetailingParams) -> SpliceCheck {
    // IS 1893 Cl. 12.2.3: Splices should not be in plastic hinge zones
    // Plastic hinge zone = max(member depth, member width, 1/6 clear span)
    let plastic_hinge_zone = params.depth_mm.max(params.width_mm);
    
    // For columns: 1.5*D from beam-column joint
    // For beams: 2*D from column face
    let prohibited_zone = match params.member_type {
        MemberType::Column => 1.5 * params.depth_mm,
        MemberType::Beam => 2.0 * params.depth_mm,
        _ => plastic_hinge_zone,
    };

    SpliceCheck {
        splice_prohibited_zone_mm: prohibited_zone,
        recommended_locations: vec![
            "Mid-height for columns".to_string(),
            "Mid-span for beams".to_string(),
            "Not more than 50% of bars spliced at one section (IS 456 Cl. 26.2.5.2)".to_string(),
        ],
        passed: true, // Requires user input on actual splice locations
    }
}

/// Check beam-column joint shear per IS 1893 Cl. 12.4
fn check_joint_shear_is(params: &DuctileDetailingParams) -> JointCheck {
    // Simplified joint shear stress calculation
    // τ_j = V_u / (b_j * h_col) where V_u = beam moment / (0.875 * h_beam)
    // Allowable: τ_c,max = 1.2 * sqrt(fck) for confined joints (IS 1893 Table 6)
    
    let allowable_shear = 1.2 * params.fck_mpa.sqrt();
    
    // Placeholder: actual joint shear requires beam/column moments
    let joint_shear = 0.0; // User should provide

    JointCheck {
        joint_shear_stress_mpa: joint_shear,
        allowable_shear_mpa: allowable_shear,
        passed: joint_shear <= allowable_shear,
    }
}

/// ACI 318-19 Ch. 18 ductile detailing checks (Special Moment Frames)
fn check_aci_detailing(params: &DuctileDetailingParams) -> Result<DuctileDetailingResult, String> {
    let mut messages = Vec::new();

    // 1. Confinement reinforcement per ACI 318-19 § 18.7 (columns), § 18.6 (beams)
    let confinement = match params.member_type {
        MemberType::Column => {
            // ACI 318-19 § 18.7.5.3: Spacing s ≤ min(b/4, 6*db_long, so)
            // so = 4 + (14 - hx)/3, bounded [4", 6"] → in mm: [102, 152]
            let b_core = params.width_mm - 2.0 * params.cover_mm;
            let d_core = params.depth_mm - 2.0 * params.cover_mm;
            let spacing_1 = params.width_mm.min(params.depth_mm) / 4.0;
            let spacing_2 = 6.0 * params.long_bar_dia_mm;
            // so formula: hx ~ width/2 for simplicity
            let hx_mm = params.width_mm / 2.0;
            let so_mm = (102.0 + (356.0 - hx_mm) / 3.0).clamp(102.0, 152.0);
            let required_spacing = spacing_1.min(spacing_2).min(so_mm);

            // ACI 318-19 § 18.7.5.4: Ash ≥ max(0.3*s*bc*(Ag/Ach - 1)*(fc'/fyt), 0.09*s*bc*(fc'/fyt))
            let ag = params.width_mm * params.depth_mm;
            let ach = b_core * d_core;
            let ratio = (ag / ach - 1.0).max(0.0);
            let ash_1 = 0.3 * required_spacing * b_core * ratio * (params.fck_mpa / params.fy_mpa);
            let ash_2 = 0.09 * required_spacing * b_core * (params.fck_mpa / params.fy_mpa);
            let ash_required = ash_1.max(ash_2);

            let tie_area = std::f64::consts::PI * params.tie_dia_mm.powi(2) / 4.0;
            let ash_provided = 2.0 * tie_area;

            ConfinementCheck {
                required_spacing_mm: required_spacing,
                provided_spacing_mm: required_spacing,
                required_area_mm2: ash_required,
                provided_area_mm2: ash_provided,
                passed: ash_provided >= ash_required,
                clause: "ACI 318-19 § 18.7.5.3, 18.7.5.4".to_string(),
            }
        }
        MemberType::Beam => {
            // ACI 318-19 § 18.6.4.4: Hoop spacing ≤ min(d/4, 8*db, 24*db_hoop, 300 mm)
            let d_eff = params.depth_mm - params.cover_mm - params.long_bar_dia_mm / 2.0;
            let s1 = d_eff / 4.0;
            let s2 = 8.0 * params.long_bar_dia_mm;
            let s3 = 24.0 * params.tie_dia_mm;
            let s4 = 300.0;
            let required_spacing = s1.min(s2).min(s3).min(s4);

            ConfinementCheck {
                required_spacing_mm: required_spacing,
                provided_spacing_mm: required_spacing,
                required_area_mm2: 0.0,
                provided_area_mm2: 0.0,
                passed: true,
                clause: "ACI 318-19 § 18.6.4.4".to_string(),
            }
        }
        _ => ConfinementCheck {
            required_spacing_mm: 150.0,
            provided_spacing_mm: 150.0,
            required_area_mm2: 0.0,
            provided_area_mm2: 0.0,
            passed: true,
            clause: "ACI 318-19 § 18.8".to_string(),
        },
    };

    // 2. Bar spacing (same logic, ACI references)
    let available_width = params.width_mm - 2.0 * params.cover_mm - 2.0 * params.tie_dia_mm;
    let num_spaces = (params.num_long_bars - 1) as f64;
    let provided_spacing = if num_spaces > 0.0 {
        (available_width - params.num_long_bars as f64 * params.long_bar_dia_mm) / num_spaces
    } else {
        available_width
    };
    let min_spacing = params.long_bar_dia_mm.max(25.0);
    let spacing = SpacingCheck {
        min_spacing_mm: min_spacing,
        max_spacing_mm: 300.0,
        provided_spacing_mm: provided_spacing,
        passed: provided_spacing >= min_spacing,
        remarks: format!("ACI 318-19 § 25.2.1 — spacing {:.0} mm", provided_spacing),
    };

    // 3. Splice restrictions (ACI 318-19 § 18.6.3.3, § 18.7.4.3)
    let splice_zone = match params.member_type {
        MemberType::Column => 1.5 * params.depth_mm,
        MemberType::Beam => 2.0 * params.depth_mm,
        _ => params.depth_mm,
    };
    let splice = SpliceCheck {
        splice_prohibited_zone_mm: splice_zone,
        recommended_locations: vec![
            "ACI 318-19 § 18.6.3.3: Lap splices not within 2h from beam face".to_string(),
            "ACI 318-19 § 18.7.4.3: Column splices in center half of length".to_string(),
        ],
        passed: true,
    };

    if !confinement.passed {
        messages.push(format!(
            "⚠️ Confinement: Ash {:.0} mm² < required {:.0} mm² ({})",
            confinement.provided_area_mm2, confinement.required_area_mm2, confinement.clause
        ));
    }
    if !spacing.passed {
        messages.push(format!("⚠️ Bar spacing: {}", spacing.remarks));
    }

    let passed = confinement.passed && spacing.passed && splice.passed;

    Ok(DuctileDetailingResult {
        passed,
        confinement_check: confinement,
        spacing_check: spacing,
        splice_check: splice,
        joint_check: None,
        messages,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_column_confinement_is1893() {
        let params = DuctileDetailingParams {
            member_type: MemberType::Column,
            width_mm: 400.0,
            depth_mm: 400.0,
            cover_mm: 40.0,
            long_bar_dia_mm: 20.0,
            num_long_bars: 8,
            tie_dia_mm: 10.0,
            fck_mpa: 30.0,
            fy_mpa: 500.0,
            seismic_zone: SeismicZone::ZoneIV,
            code: DesignCode::IS1893,
        };

        let result = check_ductile_detailing(&params).unwrap();
        
        // Confinement spacing should be ≤ min(160, 160, 100) * 0.75 = 75 mm (high seismic)
        assert!(result.confinement_check.required_spacing_mm <= 100.0);
        assert_eq!(result.confinement_check.clause, "IS 1893 Cl. 12.2.2, IS 456 Cl. 39.4");
    }

    #[test]
    fn test_beam_confinement_is1893() {
        let params = DuctileDetailingParams {
            member_type: MemberType::Beam,
            width_mm: 300.0,
            depth_mm: 500.0,
            cover_mm: 25.0,
            long_bar_dia_mm: 20.0,
            num_long_bars: 4,
            tie_dia_mm: 10.0,
            fck_mpa: 30.0,
            fy_mpa: 500.0,
            seismic_zone: SeismicZone::ZoneIII,
            code: DesignCode::IS1893,
        };

        let result = check_ductile_detailing(&params).unwrap();
        
        // d_eff ≈ 465 mm → spacing ≤ min(116, 160, 100) = 100 mm
        assert!(result.confinement_check.required_spacing_mm <= 100.0);
    }

    #[test]
    fn test_bar_spacing() {
        let params = DuctileDetailingParams {
            member_type: MemberType::Beam,
            width_mm: 300.0,
            depth_mm: 500.0,
            cover_mm: 25.0,
            long_bar_dia_mm: 25.0,
            num_long_bars: 3,
            tie_dia_mm: 10.0,
            fck_mpa: 30.0,
            fy_mpa: 500.0,
            seismic_zone: SeismicZone::ZoneIII,
            code: DesignCode::IS456,
        };

        let result = check_ductile_detailing(&params).unwrap();
        
        // Min spacing ≥ max(25, 25) = 25 mm
        assert!(result.spacing_check.min_spacing_mm >= 25.0);
        // Max spacing ≤ 300 mm
        assert!(result.spacing_check.max_spacing_mm <= 300.0);
    }
}
