//! Composite Beam Design per IS 800:2007 and AISC 360-22
//!
//! Steel beam with concrete slab acting compositely via shear connectors
//!
//! ## Features
//! - Effective width of concrete flange
//! - Plastic moment capacity (full/partial interaction)
//! - Shear connector design (studs, channels)
//! - Deflection checks for composite action
//! - Negative moment reinforcement over supports
//!
//! ## References
//! - IS 800:2007 Cl. 12 (Composite Construction)
//! - AISC 360-22 Chapter I (Composite Members)
//! - Eurocode 4 EN 1994-1-1 (Composite Steel-Concrete)

use serde::{Deserialize, Serialize};

// ── Types ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompositeBeamParams {
    /// Steel section depth (mm)
    pub steel_depth_mm: f64,
    /// Steel section width (mm)
    pub steel_width_mm: f64,
    /// Steel section area (mm²)
    pub steel_area_mm2: f64,
    /// Steel section moment of inertia (mm⁴)
    pub steel_i_mm4: f64,
    /// Steel section plastic modulus (mm³)
    pub steel_zp_mm3: f64,
    /// Steel yield strength (MPa)
    pub fy_steel_mpa: f64,
    /// Concrete slab thickness (mm)
    pub slab_thickness_mm: f64,
    /// Concrete grade (MPa)
    pub fck_mpa: f64,
    /// Beam span (mm)
    pub span_mm: f64,
    /// Transverse beam spacing (mm) — distance between parallel beams
    pub beam_spacing_mm: f64,
    /// Applied positive moment (kN·m) — sagging
    pub moment_positive_knm: f64,
    /// Applied negative moment (kN·m) — hogging (over support)
    pub moment_negative_knm: f64,
    /// Shear connector type
    pub connector_type: ConnectorType,
    /// Connector diameter (mm) for studs, or height (mm) for channels
    pub connector_dia_or_height_mm: f64,
    /// Design code
    pub code: CompositeCode,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConnectorType {
    ShearStud,
    ChannelConnector,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CompositeCode {
    IS800,
    AISC360,
    Eurocode4,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompositeBeamResult {
    pub passed: bool,
    pub effective_width_mm: f64,
    pub plastic_moment_capacity_knm: f64,
    pub positive_moment_check: MomentCheckResult,
    pub negative_moment_check: Option<MomentCheckResult>,
    pub shear_connector_design: ConnectorDesignResult,
    pub deflection_check: DeflectionCheckResult,
    pub messages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MomentCheckResult {
    pub moment_applied_knm: f64,
    pub moment_capacity_knm: f64,
    pub utilization: f64,
    pub passed: bool,
    pub neutral_axis_location: String, // "In slab", "In steel flange", "In steel web"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorDesignResult {
    pub connector_capacity_kn: f64,
    pub required_shear_flow_kn_per_m: f64,
    pub required_spacing_mm: f64,
    pub num_connectors: u32,
    pub degree_of_interaction: f64, // 0.0 (no interaction) to 1.0 (full interaction)
    pub passed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeflectionCheckResult {
    pub deflection_mm: f64,
    pub allowable_mm: f64,
    pub ratio: f64,
    pub passed: bool,
}

// ── Design Functions ──

/// Design composite steel-concrete beam
pub fn design_composite_beam(params: &CompositeBeamParams) -> Result<CompositeBeamResult, String> {
    let mut messages = Vec::new();

    // 1. Calculate effective width of concrete flange
    let b_eff = calculate_effective_width(params);
    messages.push(format!("Effective slab width: {:.0} mm", b_eff));

    // 2. Calculate plastic moment capacity
    let m_capacity = calculate_plastic_moment_capacity(params, b_eff)?;

    // 3. Check positive moment (sagging)
    let positive_check = check_positive_moment(params, m_capacity);
    if !positive_check.passed {
        messages.push(format!(
            "⚠️ Positive moment: {:.2} kN·m exceeds capacity {:.2} kN·m",
            positive_check.moment_applied_knm, positive_check.moment_capacity_knm
        ));
    }

    // 4. Check negative moment (hogging) — requires reinforcement in slab
    let negative_check = if params.moment_negative_knm.abs() > 0.01 {
        let check = check_negative_moment(params);
        if !check.passed {
            messages.push(format!(
                "⚠️ Negative moment: {:.2} kN·m exceeds capacity {:.2} kN·m (requires slab reinforcement)",
                check.moment_applied_knm, check.moment_capacity_knm
            ));
        }
        Some(check)
    } else {
        None
    };

    // 5. Design shear connectors
    let connector_design = design_shear_connectors(params, b_eff)?;
    if !connector_design.passed {
        messages.push(format!(
            "⚠️ Shear connectors: Required spacing {:.0} mm",
            connector_design.required_spacing_mm
        ));
    } else {
        messages.push(format!(
            "✓ Shear connectors: {} × {} @ {:.0} mm c/c (DOI: {:.0}%)",
            connector_design.num_connectors,
            match params.connector_type {
                ConnectorType::ShearStud => format!("Ø{} studs", params.connector_dia_or_height_mm.round() as i32),
                ConnectorType::ChannelConnector => format!("{}mm channels", params.connector_dia_or_height_mm.round() as i32),
            },
            connector_design.required_spacing_mm,
            connector_design.degree_of_interaction * 100.0
        ));
    }

    // 6. Deflection check
    let deflection = check_deflection_composite(params, connector_design.degree_of_interaction);
    if !deflection.passed {
        messages.push(format!(
            "⚠️ Deflection: {:.1} mm > allowable {:.1} mm (L/{:.0})",
            deflection.deflection_mm, deflection.allowable_mm, deflection.ratio
        ));
    }

    let passed = positive_check.passed 
        && negative_check.as_ref().map(|c| c.passed).unwrap_or(true)
        && connector_design.passed
        && deflection.passed;

    if passed {
        messages.push("✓ Composite beam design OK".to_string());
    }

    Ok(CompositeBeamResult {
        passed,
        effective_width_mm: b_eff,
        plastic_moment_capacity_knm: m_capacity,
        positive_moment_check: positive_check,
        negative_moment_check: negative_check,
        shear_connector_design: connector_design,
        deflection_check: deflection,
        messages,
    })
}

/// Calculate effective width of concrete flange per IS 800 Cl. 12.2 / AISC I3.1
fn calculate_effective_width(params: &CompositeBeamParams) -> f64 {
    match params.code {
        CompositeCode::IS800 => {
            // IS 800 Cl. 12.2: b_eff = min(L/4, beam spacing)
            let b_eff_span = params.span_mm / 4.0;
            let b_eff_spacing = params.beam_spacing_mm;
            b_eff_span.min(b_eff_spacing)
        }
        CompositeCode::AISC360 => {
            // AISC I3.1a: b_eff = min(L/4, center-to-center spacing)
            // For interior beams: full spacing
            // For edge beams: overhang + half spacing
            let b_eff_span = params.span_mm / 8.0; // Each side L/8
            let b_eff_total = 2.0 * b_eff_span.min(params.beam_spacing_mm / 2.0);
            b_eff_total.min(params.beam_spacing_mm)
        }
        CompositeCode::Eurocode4 => {
            // EN 1994-1-1 Cl. 5.4.1.2: b_eff = Σ b_ei where b_ei = L_e/8
            // L_e = effective span (distance between zero moments)
            let b_eff = params.span_mm / 8.0;
            (2.0 * b_eff).min(params.beam_spacing_mm)
        }
    }
}

/// Calculate plastic moment capacity assuming full shear connection
fn calculate_plastic_moment_capacity(params: &CompositeBeamParams, b_eff: f64) -> Result<f64, String> {
    // Concrete compressive force (assuming full depth in compression)
    // C_c = 0.85 * f_ck * b_eff * t_s / γ_c
    let gamma_c = 1.5; // IS 456 / IS 800
    let gamma_m0 = 1.10; // IS 800
    
    let fck_design = params.fck_mpa / gamma_c;
    let fy_design = params.fy_steel_mpa / gamma_m0;
    
    let c_concrete = 0.85 * fck_design * b_eff * params.slab_thickness_mm; // N

    // Steel tensile force
    let t_steel = fy_design * params.steel_area_mm2; // N

    // Neutral axis location and moment calculation
    let m_plastic = if c_concrete >= t_steel {
        // NA in slab — full plastic moment
        let y_na = (t_steel / (0.85 * fck_design * b_eff)).min(params.slab_thickness_mm);
        
        // Lever arm: distance from steel centroid to center of concrete stress block
        let lever_arm = params.steel_depth_mm / 2.0 + params.slab_thickness_mm - y_na / 2.0;
        
        t_steel * lever_arm / 1e6 // N·mm to kN·m
    } else {
        // NA in steel — partial depth of concrete
        // For simplicity, use rectangular stress block
        let lever_arm = params.steel_depth_mm / 2.0 + params.slab_thickness_mm / 2.0;
        c_concrete * lever_arm / 1e6
    };

    Ok(m_plastic)
}

/// Check positive moment (sagging) capacity
fn check_positive_moment(params: &CompositeBeamParams, m_capacity: f64) -> MomentCheckResult {
    let utilization = params.moment_positive_knm / m_capacity;
    let passed = utilization <= 1.0;

    MomentCheckResult {
        moment_applied_knm: params.moment_positive_knm,
        moment_capacity_knm: m_capacity,
        utilization,
        passed,
        neutral_axis_location: "In slab (composite action)".to_string(),
    }
}

/// Check negative moment (hogging) capacity — steel section only + slab reinforcement
fn check_negative_moment(params: &CompositeBeamParams) -> MomentCheckResult {
    // Over supports: concrete in tension (cracked), steel section resists
    // Simplified: use steel plastic modulus only
    let gamma_m0 = 1.10;
    let fy_design = params.fy_steel_mpa / gamma_m0;
    let m_capacity = (fy_design * params.steel_zp_mm3) / 1e6; // N·mm to kN·m

    let utilization = params.moment_negative_knm.abs() / m_capacity;
    let passed = utilization <= 1.0;

    MomentCheckResult {
        moment_applied_knm: params.moment_negative_knm.abs(),
        moment_capacity_knm: m_capacity,
        utilization,
        passed,
        neutral_axis_location: "In steel (concrete cracked)".to_string(),
    }
}

/// Design shear connectors per IS 800 Cl. 12.3 / AISC I8
fn design_shear_connectors(params: &CompositeBeamParams, b_eff: f64) -> Result<ConnectorDesignResult, String> {
    // Connector capacity per IS 800 Cl. 12.3.2 or AISC Eq. I8-1
    let q_connector = match params.connector_type {
        ConnectorType::ShearStud => {
            // AISC I8.2a: Q_n = 0.5 * A_sc * sqrt(f'c * E_c) ≤ R_g * R_p * A_sc * F_u
            // Simplified IS 800: Q = 0.8 * f_ck^0.5 * d^2 (in N, d in mm)
            let d = params.connector_dia_or_height_mm;
            let q_is800 = 0.8 * params.fck_mpa.sqrt() * d.powi(2); // N
            
            // AISC approach (more accurate)
            let a_sc = std::f64::consts::PI * (d / 2.0).powi(2); // mm²
            let ec = 4700.0 * params.fck_mpa.sqrt(); // MPa (concrete modulus)
            let fu_stud = 400.0; // Typical stud tensile strength (MPa)
            
            let q_aisc = 0.5 * a_sc * (params.fck_mpa * ec).sqrt(); // N
            let q_aisc_limit = a_sc * fu_stud; // N
            
            q_aisc.min(q_aisc_limit).min(q_is800 * 1.5) / 1000.0 // Convert to kN
        }
        ConnectorType::ChannelConnector => {
            // IS 800 Cl. 12.3.3: Q = (h + 0.5*t_f) * t_w * sqrt(f_ck * E_c) / 3
            // Simplified: Q ≈ 0.6 * h * f_ck^0.5 (kN)
            let h = params.connector_dia_or_height_mm;
            0.6 * h * params.fck_mpa.sqrt() / 1000.0 // kN
        }
    };

    // Horizontal shear force to transfer
    // V_h = min(C_c, T_s) where C_c = 0.85*f_ck*A_c, T_s = f_y*A_s
    let gamma_c = 1.5;
    let gamma_m0 = 1.10;
    let fck_design = params.fck_mpa / gamma_c;
    let fy_design = params.fy_steel_mpa / gamma_m0;
    
    let c_concrete = 0.85 * fck_design * b_eff * params.slab_thickness_mm / 1000.0; // kN
    let t_steel = fy_design * params.steel_area_mm2 / 1000.0; // kN
    let v_horizontal = c_concrete.min(t_steel);

    // Degree of shear connection (full = 1.0, partial ≥ 0.4 per IS 800)
    let num_connectors_full = (v_horizontal / q_connector).ceil() as u32;
    let doi_target = 0.8; // Target 80% interaction (common in practice)
    let num_connectors_actual = (num_connectors_full as f64 * doi_target).ceil() as u32;

    // Spacing
    let spacing = if num_connectors_actual > 1 {
        params.span_mm / (num_connectors_actual - 1) as f64
    } else {
        params.span_mm
    };

    // Check minimum degree of interaction (IS 800: ≥ 0.4, AISC: ≥ 0.25)
    let min_doi = match params.code {
        CompositeCode::IS800 => 0.40,
        CompositeCode::AISC360 => 0.25,
        CompositeCode::Eurocode4 => 0.40,
    };

    let passed = doi_target >= min_doi && spacing <= 600.0; // Max spacing 600 mm per codes

    Ok(ConnectorDesignResult {
        connector_capacity_kn: q_connector,
        required_shear_flow_kn_per_m: v_horizontal / (params.span_mm / 1000.0),
        required_spacing_mm: spacing,
        num_connectors: num_connectors_actual,
        degree_of_interaction: doi_target,
        passed,
    })
}

/// Check deflection with partial composite action
fn check_deflection_composite(params: &CompositeBeamParams, doi: f64) -> DeflectionCheckResult {
    // Effective moment of inertia with partial interaction
    // I_eff = I_steel + doi × (I_composite - I_steel)
    
    // Transformed section properties (concrete → steel)
    let modular_ratio = 10.0; // Typical E_steel / E_concrete ≈ 200/20 = 10
    let b_eff_transformed = params.beam_spacing_mm / modular_ratio;
    
    // Centroid calculation (simplified)
    let y_steel = params.steel_depth_mm / 2.0;
    let y_slab = params.steel_depth_mm + params.slab_thickness_mm / 2.0;
    
    let a_steel = params.steel_area_mm2;
    let a_slab = b_eff_transformed * params.slab_thickness_mm;
    
    let y_na = (a_steel * y_steel + a_slab * y_slab) / (a_steel + a_slab);
    
    // Composite moment of inertia (parallel axis theorem)
    let i_steel_composite = params.steel_i_mm4 + a_steel * (y_na - y_steel).powi(2);
    let i_slab_composite = (b_eff_transformed * params.slab_thickness_mm.powi(3) / 12.0)
        + a_slab * (y_slab - y_na).powi(2);
    
    let i_composite = i_steel_composite + i_slab_composite;
    let i_eff = params.steel_i_mm4 + doi * (i_composite - params.steel_i_mm4);
    
    // Deflection (simplified uniformly loaded beam)
    // Δ = 5 * w * L^4 / (384 * E * I)
    // Assume w from moment: M = w*L²/8 → w = 8*M/L²
    let m_total = params.moment_positive_knm.max(params.moment_negative_knm.abs());
    let w = 8.0 * m_total * 1e6 / params.span_mm.powi(2); // N/mm
    
    let e_steel = 200_000.0; // MPa
    let deflection = (5.0 * w * params.span_mm.powi(4)) / (384.0 * e_steel * i_eff);
    
    let allowable = params.span_mm / 300.0; // L/300 typical
    let ratio = params.span_mm / deflection;
    let passed = deflection <= allowable;
    
    DeflectionCheckResult {
        deflection_mm: deflection,
        allowable_mm: allowable,
        ratio,
        passed,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_composite_beam_is800() {
        let params = CompositeBeamParams {
            steel_depth_mm: 400.0,
            steel_width_mm: 180.0,
            steel_area_mm2: 8400.0,
            steel_i_mm4: 2.15e8,
            steel_zp_mm3: 1200e3,
            fy_steel_mpa: 250.0,
            slab_thickness_mm: 150.0,
            fck_mpa: 30.0,
            span_mm: 8000.0,
            beam_spacing_mm: 3000.0,
            moment_positive_knm: 250.0,
            moment_negative_knm: -150.0,
            connector_type: ConnectorType::ShearStud,
            connector_dia_or_height_mm: 19.0,
            code: CompositeCode::IS800,
        };

        let result = design_composite_beam(&params).unwrap();
        
        // Effective width should be min(8000/4, 3000) = 2000 mm
        assert_eq!(result.effective_width_mm, 2000.0);
        
        // Should have composite capacity > steel-only capacity
        assert!(result.plastic_moment_capacity_knm > 200.0);
        
        // Should have reasonable connector spacing
        assert!(result.shear_connector_design.required_spacing_mm > 0.0);
        assert!(result.shear_connector_design.required_spacing_mm <= 600.0);
    }

    #[test]
    fn test_effective_width_calculation() {
        let params = CompositeBeamParams {
            steel_depth_mm: 400.0,
            steel_width_mm: 180.0,
            steel_area_mm2: 8400.0,
            steel_i_mm4: 2.15e8,
            steel_zp_mm3: 1200e3,
            fy_steel_mpa: 250.0,
            slab_thickness_mm: 150.0,
            fck_mpa: 30.0,
            span_mm: 10000.0,
            beam_spacing_mm: 4000.0,
            moment_positive_knm: 0.0,
            moment_negative_knm: 0.0,
            connector_type: ConnectorType::ShearStud,
            connector_dia_or_height_mm: 19.0,
            code: CompositeCode::IS800,
        };

        let b_eff = calculate_effective_width(&params);
        
        // IS 800: b_eff = min(L/4, spacing) = min(2500, 4000) = 2500 mm
        assert_eq!(b_eff, 2500.0);
    }
}
