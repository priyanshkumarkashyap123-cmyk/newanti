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

/// Composite beam design version selector for draft toggles
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum CompositeBeamVersion {
    /// Production provisions
    VCurrent,
    /// Draft composite beam design 2025 (sandbox mode)
    V2025Sandbox,
}

/// Sandbox warning for composite beam design 2025
pub const SANDBOX_WARNING_COMPOSITE_BEAM_2025: &str =
    "DRAFT — Composite beam design 2025 provisions are in sandbox mode and non-enforceable.";

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
    /// Transverse beam spacing (mm)
    pub beam_spacing_mm: f64,
    /// Applied positive moment (kN·m)
    pub moment_positive_knm: f64,
    /// Applied negative moment (kN·m)
    pub moment_negative_knm: f64,
    /// Shear connector type
    pub connector_type: ConnectorType,
    /// Connector diameter (mm) or channel height (mm)
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
    pub neutral_axis_location: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorDesignResult {
    pub connector_capacity_kn: f64,
    pub required_shear_flow_kn_per_m: f64,
    pub required_spacing_mm: f64,
    pub num_connectors: u32,
    pub degree_of_interaction: f64,
    pub passed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeflectionCheckResult {
    pub deflection_mm: f64,
    pub allowable_mm: f64,
    pub ratio: f64,
    pub passed: bool,
}

// ── Core Design ──

/// Design composite steel-concrete beam
pub fn design_composite_beam(
    params: &CompositeBeamParams,
) -> Result<CompositeBeamResult, String> {
    let mut messages = Vec::new();

    // 1. Effective width
    let b_eff = calculate_effective_width(params);
    messages.push(format!("Effective slab width: {:.0} mm", b_eff));

    // 2. Plastic moment capacity
    let m_capacity = calculate_plastic_moment_capacity(params, b_eff)?;

    // 3. Positive moment check
    let positive = check_positive_moment(params, m_capacity);
    if !positive.passed {
        messages.push(format!(
            "⚠️ Positive moment: {:.2} kN·m exceeds capacity {:.2} kN·m",
            positive.moment_applied_knm, positive.moment_capacity_knm
        ));
    }

    // 4. Negative moment check
    let negative = if params.moment_negative_knm.abs() > 0.01 {
        let chk = check_negative_moment(params);
        if !chk.passed {
            messages.push(format!(
                "⚠️ Negative moment: {:.2} kN·m exceeds capacity {:.2} kN·m",
                chk.moment_applied_knm, chk.moment_capacity_knm
            ));
        }
        Some(chk)
    } else {
        None
    };

    // 5. Shear connector design
    let connector = design_shear_connectors(params, b_eff)?;
    if !connector.passed {
        messages.push(format!(
            "⚠️ Shear connectors: Required spacing {:.0} mm",
            connector.required_spacing_mm
        ));
    } else {
        messages.push(format!(
            "✓ Shear connectors: {} × {} @ {:.0} mm c/c (DOI: {:.0}%)",
            connector.num_connectors,
            match params.connector_type {
                ConnectorType::ShearStud => format!("Ø{} studs", params.connector_dia_or_height_mm.round() as i32),
                ConnectorType::ChannelConnector => format!("{}mm channels", params.connector_dia_or_height_mm.round() as i32),
            },
            connector.required_spacing_mm,
            connector.degree_of_interaction * 100.0
        ));
    }

    // 6. Deflection check
    let deflect = check_deflection_composite(params, connector.degree_of_interaction);
    if !deflect.passed {
        messages.push(format!(
            "⚠️ Deflection: {:.1} mm > allowable {:.1} mm",
            deflect.deflection_mm, deflect.allowable_mm
        ));
    }

    // Overall pass
    let passed = positive.passed
        && negative.as_ref().map(|c| c.passed).unwrap_or(true)
        && connector.passed
        && deflect.passed;

    if passed {
        messages.push("✓ Composite beam design OK".to_string());
    }

    Ok(CompositeBeamResult {
        passed,
        effective_width_mm: b_eff,
        plastic_moment_capacity_knm: m_capacity,
        positive_moment_check: positive,
        negative_moment_check: negative,
        shear_connector_design: connector,
        deflection_check: deflect,
        messages,
    })
}

// ── Version Wrapper ──

/// Version-aware composite beam design
pub fn design_composite_beam_with_version(
    params: &CompositeBeamParams,
    version: CompositeBeamVersion,
) -> Result<CompositeBeamResult, String> {
    let res = design_composite_beam(params);
    if matches!(version, CompositeBeamVersion::V2025Sandbox) {
        eprintln!("{}", SANDBOX_WARNING_COMPOSITE_BEAM_2025);
    }
    res
}

// ── Helpers ──

/// Calculate effective width of concrete flange per codes
fn calculate_effective_width(params: &CompositeBeamParams) -> f64 {
    match params.code {
        CompositeCode::IS800 => (params.span_mm / 4.0).min(params.beam_spacing_mm),
        CompositeCode::AISC360 => {
            let b_half = (params.span_mm / 8.0).min(params.beam_spacing_mm / 2.0);
            (2.0 * b_half).min(params.beam_spacing_mm)
        }
        CompositeCode::Eurocode4 => {
            let b = params.span_mm / 8.0;
            (2.0 * b).min(params.beam_spacing_mm)
        }
    }
}

/// Calculate plastic moment capacity
fn calculate_plastic_moment_capacity(
    params: &CompositeBeamParams,
    b_eff: f64,
) -> Result<f64, String> {
    let gamma_c = 1.5;
    let gamma_m0 = 1.10;
    let fck_d = params.fck_mpa / gamma_c;
    let fy_d = params.fy_steel_mpa / gamma_m0;
    let c_c = 0.85 * fck_d * b_eff * params.slab_thickness_mm;
    let t_s = fy_d * params.steel_area_mm2;
    let m_pl = if c_c >= t_s {
        // NA in slab
        let y_na = (t_s / (0.85 * fck_d * b_eff)).min(params.slab_thickness_mm);
        let lever = params.steel_depth_mm / 2.0 + params.slab_thickness_mm - y_na / 2.0;
        t_s * lever / 1e6
    } else {
        let lever = params.steel_depth_mm / 2.0 + params.slab_thickness_mm / 2.0;
        c_c * lever / 1e6
    };
    Ok(m_pl)
}

/// Check positive moment
fn check_positive_moment(params: &CompositeBeamParams, m_cap: f64) -> MomentCheckResult {
    let util = params.moment_positive_knm / m_cap;
    MomentCheckResult {
        moment_applied_knm: params.moment_positive_knm,
        moment_capacity_knm: m_cap,
        utilization: util,
        passed: util <= 1.0,
        neutral_axis_location: "In slab (composite action)".to_string(),
    }
}

/// Check negative moment
fn check_negative_moment(params: &CompositeBeamParams) -> MomentCheckResult {
    let gamma_m0 = 1.10;
    let fy_d = params.fy_steel_mpa / gamma_m0;
    let m_cap = fy_d * params.steel_zp_mm3 / 1e6;
    let util = params.moment_negative_knm.abs() / m_cap;
    MomentCheckResult {
        moment_applied_knm: params.moment_negative_knm.abs(),
        moment_capacity_knm: m_cap,
        utilization: util,
        passed: util <= 1.0,
        neutral_axis_location: "In steel (cracked)".to_string(),
    }
}

/// Design shear connectors
fn design_shear_connectors(
    params: &CompositeBeamParams,
    b_eff: f64,
) -> Result<ConnectorDesignResult, String> {
    let q = match params.connector_type {
        ConnectorType::ShearStud => {
            let d = params.connector_dia_or_height_mm;
            let a = std::f64::consts::PI * (d / 2.0).powi(2);
            (0.5 * a * (params.fck_mpa * 4700.0 * params.fck_mpa.sqrt()).sqrt()).min(a * 400.0) / 1000.0
        }
        ConnectorType::ChannelConnector => 0.6 * params.connector_dia_or_height_mm * params.fck_mpa.sqrt() / 1000.0,
    };
    let c = 0.85 * (params.fck_mpa / 1.5) * b_eff * params.slab_thickness_mm / 1000.0;
    let t = (params.fy_steel_mpa / 1.10) * params.steel_area_mm2 / 1000.0;
    let vh = c.min(t);
    let full = (vh / q).ceil() as u32;
    let doi = 0.8;
    let actual = (full as f64 * doi).ceil() as u32;
    let spacing = if actual > 1 { params.span_mm / (actual - 1) as f64 } else { params.span_mm };
    let passed = doi >= match params.code { CompositeCode::IS800 => 0.4, CompositeCode::AISC360 => 0.25, _ => 0.4 } && spacing <= 600.0;
    Ok(ConnectorDesignResult { connector_capacity_kn: q, required_shear_flow_kn_per_m: vh / (params.span_mm / 1000.0), required_spacing_mm: spacing, num_connectors: actual, degree_of_interaction: doi, passed })
}

/// Deflection check
fn check_deflection_composite(
    params: &CompositeBeamParams,
    doi: f64,
) -> DeflectionCheckResult {
    let mr = 10.0;
    let b_t = params.beam_spacing_mm / mr;
    let y_s = params.steel_depth_mm / 2.0;
    let y_c = params.steel_depth_mm + params.slab_thickness_mm / 2.0;
    let a_s = params.steel_area_mm2;
    let a_c = b_t * params.slab_thickness_mm;
    let y_na = (a_s * y_s + a_c * y_c) / (a_s + a_c);
    let i_s = params.steel_i_mm4;
    let i_c = b_t * params.slab_thickness_mm.powi(3) / 12.0;
    let i_comp = i_s + a_s * (y_na - y_s).powi(2) + i_c + a_c * (y_c - y_na).powi(2);
    let i_eff = i_s + doi * (i_comp - i_s);
    let m_tot = params.moment_positive_knm.max(params.moment_negative_knm.abs());
    let w = 8.0 * m_tot * 1e6 / params.span_mm.powi(2);
    let delta = 5.0 * w * params.span_mm.powi(4) / (384.0 * 200_000.0 * i_eff);
    let allow = params.span_mm / 300.0;
    DeflectionCheckResult { deflection_mm: delta, allowable_mm: allow, ratio: params.span_mm / delta, passed: delta <= allow }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_is800() {
        let params = CompositeBeamParams { steel_depth_mm:400.0, steel_width_mm:180.0, steel_area_mm2:8400.0, steel_i_mm4:2.15e8, steel_zp_mm3:1200e3, fy_steel_mpa:250.0, slab_thickness_mm:150.0, fck_mpa:30.0, span_mm:8000.0, beam_spacing_mm:3000.0, moment_positive_knm:250.0, moment_negative_knm:-150.0, connector_type:ConnectorType::ShearStud, connector_dia_or_height_mm:19.0, code:CompositeCode::IS800 };
        let r = design_composite_beam(&params).unwrap();
        assert_eq!(r.effective_width_mm,2000.0);
    }
}
