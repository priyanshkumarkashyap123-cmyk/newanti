/// Eurocode 3 / EN 1993-1-1 (European Steel Design Standard)
/// Ultimate Limit State Design with classification-based approach
/// 
/// References:
/// - EN 1993-1-1:2005: Design of steel structures - Part 1-1: General rules and rules for buildings
/// - National Annexes with γM0, γM1 adjustments

use serde::{Deserialize, Serialize};

/// Section classification (Class 1, 2, 3, or 4)
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SectionClass {
    Class1,  // Plastic
    Class2,  // Compact
    Class3,  // Semi-compact
    Class4,  // Slender
}

/// Eurocode 3 design capacity calculation results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EC3Capacity {
    pub bending_resistance_kNm: f64,
    pub ltb_resistance_kNm: f64,
    pub utilization_ratio: f64,
    pub section_class: String,
    pub slenderness_ltb: f64,
    pub reduction_factor_ltb: f64,
}

/// Eurocode 3 steel section properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EC3Section {
    pub name: String,
    pub fy_mpa: f64,                    // Yield strength
    pub fu_mpa: f64,                    // Ultimate strength
    pub wpl_mm3: f64,                   // Plastic section modulus
    pub wel_mm3: f64,                   // Elastic section modulus
    pub iy_mm4: f64,                    // Second moment about weak axis
    pub iy_iy: f64,                     // For warping: Iy for LTB
    pub cw_mm6: f64,                    // Warping constant
    pub c1_mm: Option<f64>,             // For warping stiffness
}

/// Eurocode 3 design parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EC3DesignParams {
    pub section_length_mm: f64,         // L - Member length
    pub applied_moment_kNm: f64,        // Design moment
    pub lateral_supports: i32,          // Number of lateral supports
    pub moment_distribution: String,    // "Constant", "Linear", "Parabolic"
}

/// Calculate slenderness for lateral-torsional buckling
/// λ̄_LT = sqrt(Wpl * fy / Mcr)
fn calculate_slenderness_ltb(
    wpl_mm3: f64,
    fy_mpa: f64,
    mcr_kNm: f64,
) -> f64 {
    let wpl_kNm = wpl_mm3 * fy_mpa / 1e6;
    (wpl_kNm / mcr_kNm.max(0.001)).sqrt()
}

/// Calculate critical moment for lateral-torsional buckling (elastic)
/// Simplified formula without complex warping terms
fn calculate_mcr(
    section: &EC3Section,
    length_mm: f64,
    c1: f64,
) -> f64 {
    let e = 210_000.0; // MPa
    let g = 81_000.0;  // MPa (shear modulus)
    
    let mcr = c1 * std::f64::consts::PI * (e * section.iy_mm4 * g * 0.1).sqrt()
        / (length_mm.max(1.0));
    mcr / 1e6  // Convert to kNm
}

/// Calculate lateral-torsional buckling reduction factor (χ_LT)
/// Using European type curve (usually 'a' or 'b')
fn calculate_chi_ltb(lambda_ltb: f64) -> f64 {
    let lambda_ltb_limit = 0.4;
    
    if lambda_ltb <= lambda_ltb_limit {
        return 1.0;
    }
    
    // Use curve 'a' (α = 0.21)
    let alpha = 0.21;
    let phi_ltb = 0.5 * (1.0 + alpha * (lambda_ltb - lambda_ltb_limit) + lambda_ltb.powi(2));
    let chi_ltb = 1.0 / (phi_ltb + (phi_ltb.powi(2) - lambda_ltb.powi(2)).sqrt()).max(0.001);
    
    chi_ltb.min(1.0)
}

/// Calculate Eurocode 3 bending capacity
pub fn calculate_bending_capacity(
    section: &EC3Section,
    params: &EC3DesignParams,
    section_class: SectionClass,
) -> EC3Capacity {
    let gamma_m0 = 1.0;  // Partial safety factor for Class 1, 2, 3
    let gamma_m1 = 1.0;  // Partial safety factor for LTB
    
    // Step 1: Determine which section modulus to use
    let w = match section_class {
        SectionClass::Class1 | SectionClass::Class2 => section.wpl_mm3,
        SectionClass::Class3 | SectionClass::Class4 => section.wel_mm3,
    };
    
    // Step 2: Calculate basic bending resistance
    let mc_rd = w as f64 * section.fy_mpa / gamma_m0 / 1e6;  // kNm
    
    // Step 3: Calculate lateral-torsional buckling reduction
    // Determine C1 factor based on moment distribution
    let c1 = match params.moment_distribution.as_str() {
        "Constant" => 1.0,
        "Linear" => 1.15,
        "Parabolic" => 1.30,
        _ => 1.0,
    };
    
    let mcr = calculate_mcr(section, params.section_length_mm, c1);
    let lambda_ltb = if mcr > 0.001 {
        calculate_slenderness_ltb(section.wpl_mm3, section.fy_mpa, mcr)
    } else {
        0.0
    };
    
    let chi_ltb = calculate_chi_ltb(lambda_ltb);
    
    // Step 4: Calculate LTB design strength
    let mb_rd = chi_ltb * w as f64 * section.fy_mpa / gamma_m1 / 1e6;  // kNm
    
    // Step 5: Calculate utilization
    let design_strength = mb_rd;
    let utilization_ratio = (params.applied_moment_kNm / design_strength).max(0.0);
    
    EC3Capacity {
        bending_resistance_kNm: mc_rd,
        ltb_resistance_kNm: design_strength,
        utilization_ratio,
        section_class: format!("{:?}", section_class),
        slenderness_ltb: lambda_ltb,
        reduction_factor_ltb: chi_ltb,
    }
}

/// Check if bending capacity is adequate
pub fn is_adequate(capacity: &EC3Capacity) -> bool {
    capacity.utilization_ratio <= 1.0
}
// ── Shear Design (EN 1993-1-1 Cl. 6.2.6) ──

/// Shear capacity result per Eurocode 3
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EC3ShearCapacity {
    pub vpl_rd_kn: f64,       // Plastic shear resistance
    pub ved_kn: f64,          // Design shear force
    pub utilization: f64,
    pub passed: bool,
}

/// Calculate shear capacity per EN 1993-1-1 Cl. 6.2.6
/// Vpl,Rd = Av (fy / √3) / γM0
/// where Av is shear area (typically hw * tw for I-sections)
pub fn calculate_shear_capacity(
    av_mm2: f64,
    fy_mpa: f64,
    ved_kn: f64,
) -> EC3ShearCapacity {
    let gamma_m0 = 1.0;
    let vpl_rd = av_mm2 * (fy_mpa / 3.0_f64.sqrt()) / gamma_m0 / 1000.0; // kN
    let utilization = ved_kn / vpl_rd.max(0.001);
    
    EC3ShearCapacity {
        vpl_rd_kn: vpl_rd,
        ved_kn,
        utilization,
        passed: utilization <= 1.0,
    }
}
/// Classify section per Eurocode 3 Table 5.2
pub fn classify_section(
    depth_mm: f64,
    width_mm: f64,
    tf_mm: f64,
    tw_mm: f64,
) -> SectionClass {
    // Simplified classification for I-sections
    let flange_ratio = (width_mm - tw_mm) / (2.0 * tf_mm);
    let web_ratio = (depth_mm - 2.0 * tf_mm) / tw_mm;
    
    // Class limits (simplified)
    if flange_ratio <= 5.0 && web_ratio <= 72.0 {
        SectionClass::Class1
    } else if flange_ratio <= 7.0 && web_ratio <= 83.0 {
        SectionClass::Class2
    } else if flange_ratio <= 9.0 && web_ratio <= 124.0 {
        SectionClass::Class3
    } else {
        SectionClass::Class4
    }
}

/// Database of common European I-sections (IPE, HE series)
pub fn ec3_ipe_sections() -> Vec<EC3Section> {
    vec![
        EC3Section {
            name: "IPE 300".into(),
            fy_mpa: 235.0,
            fu_mpa: 360.0,
            wpl_mm3: 557e3,
            wel_mm3: 557e3,
            iy_mm4: 8356e6,
            iy_iy: 8356e6,
            cw_mm6: 1.3e9,
            c1_mm: Some(1.0),
        },
        EC3Section {
            name: "IPE 270".into(),
            fy_mpa: 235.0,
            fu_mpa: 360.0,
            wpl_mm3: 429e3,
            wel_mm3: 429e3,
            iy_mm4: 5790e6,
            iy_iy: 5790e6,
            cw_mm6: 0.8e9,
            c1_mm: Some(1.0),
        },
        EC3Section {
            name: "IPE 240".into(),
            fy_mpa: 235.0,
            fu_mpa: 360.0,
            wpl_mm3: 324e3,
            wel_mm3: 324e3,
            iy_mm4: 3892e6,
            iy_iy: 3892e6,
            cw_mm6: 0.5e9,
            c1_mm: Some(1.0),
        },
        EC3Section {
            name: "HE 300A".into(),
            fy_mpa: 235.0,
            fu_mpa: 360.0,
            wpl_mm3: 698e3,
            wel_mm3: 628e3,
            iy_mm4: 25170e6,
            iy_iy: 25170e6,
            cw_mm6: 8.0e9,
            c1_mm: Some(1.0),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ec3_bending_capacity() {
        let section = EC3Section {
            name: "IPE 300".into(),
            fy_mpa: 235.0,
            fu_mpa: 360.0,
            wpl_mm3: 557e3,
            wel_mm3: 557e3,
            iy_mm4: 8356e6,
            iy_iy: 8356e6,
            cw_mm6: 1.3e9,
            c1_mm: Some(1.0),
        };

        let params = EC3DesignParams {
            section_length_mm: 4000.0,
            applied_moment_kNm: 100.0,
            lateral_supports: 0,
            moment_distribution: "Constant".to_string(),
        };

        let capacity = calculate_bending_capacity(&section, &params, SectionClass::Class1);

        // Basic capacity: Wpl * fy = 557e3 * 235 / 1e6 = 130.9 kNm
        assert!(capacity.bending_resistance_kNm > 100.0);
    }

    #[test]
    fn test_ec3_classification() {
        // IPE 300: depth=300, width=150, tf=10.7, tw=7.1
        let class = classify_section(300.0, 150.0, 10.7, 7.1);
        assert!(matches!(class, SectionClass::Class1 | SectionClass::Class2));
    }
}
