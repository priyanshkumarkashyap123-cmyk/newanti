#![allow(non_snake_case)]

/// Eurocode 2 / EN 1992-1-1 (European Reinforced Concrete Design Standard)
/// Ultimate Limit State Design with material safety factors
/// 
/// References:
/// - EN 1992-1-1:2004: Design of concrete structures - Part 1-1: General rules and rules for buildings
/// - Rectangular stress block with γc and γs safety factors

use serde::{Deserialize, Serialize};

/// Eurocode 2 concrete design capacity results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EC2Capacity {
    pub design_moment_kNm: f64,
    pub utilization_ratio: f64,
    pub compressive_zone_depth_mm: f64,
    pub lever_arm_mm: f64,
    pub design_stress_concrete_mpa: f64,
    pub design_stress_steel_mpa: f64,
}

/// Reinforced concrete beam section properties (Eurocode)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EC2Section {
    pub name: String,
    pub bwidth_mm: f64,                 // Beam width
    pub depth_mm: f64,                  // Total depth
    pub effective_depth_mm: f64,        // d - effective depth
    pub as_mm2: f64,                    // Area of tension steel
    pub fyk_mpa: f64,                   // Rebar characteristic yield (e.g., 500 MPa)
    pub fck_mpa: f64,                   // Concrete characteristic compressive strength
    pub cover_mm: f64,                  // Concrete cover
}

/// Eurocode 2 design parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EC2DesignParams {
    pub applied_moment_kNm: f64,        // Design moment (M_d)
    pub include_compression_steel: bool,
    pub as_prime_mm2: f64,              // Compression steel (optional)
    pub fyk_prime_mpa: f64,             // Compression steel yield
}

/// Calculate design yield strength of concrete with safety factor
/// fcd = αcc * fck / γc (typically αcc = 0.85, γc = 1.5)
fn calculate_fcd(fck_mpa: f64, gamma_c: f64, alpha_cc: f64) -> f64 {
    alpha_cc * fck_mpa / gamma_c
}

/// Calculate design yield strength of steel with safety factor
/// fyd = fyk / γs (typically γs = 1.15)
fn calculate_fyd(fyk_mpa: f64, gamma_s: f64) -> f64 {
    fyk_mpa / gamma_s
}

/// Calculate depth of compressive zone for rectangular stress block
/// Equilibrium: As * fyd = 0.8 * x * b * fcd
/// Returns x - depth of rectangular compressive zone
fn calculate_compressive_zone_depth(
    as_mm2: f64,
    fyd_mpa: f64,
    b_mm: f64,
    fcd_mpa: f64,
) -> f64 {
    as_mm2 * fyd_mpa / (0.8 * b_mm * fcd_mpa)
}

/// Calculate lever arm z = d - 0.4*x (Eurocode rectangular block)
fn calculate_lever_arm(d_mm: f64, x_mm: f64) -> f64 {
    (d_mm - 0.4 * x_mm).min(0.95 * d_mm).max(0.5 * d_mm)
}

/// Calculate Eurocode 2 reinforced concrete beam capacity
pub fn calculate_bending_capacity(
    section: &EC2Section,
    params: &EC2DesignParams,
) -> EC2Capacity {
    // Material safety factors (EC2 defaults)
    let gamma_c = 1.5;     // Concrete safety factor
    let gamma_s = 1.15;    // Steel safety factor
    let alpha_cc = 0.85;   // Coefficient for long-term effects
    
    // Step 1: Calculate design material strengths
    let fcd = calculate_fcd(section.fck_mpa, gamma_c, alpha_cc);
    let fyd = calculate_fyd(section.fyk_mpa, gamma_s);
    
    // Step 2: Calculate depth of compressive zone
    let x = calculate_compressive_zone_depth(
        section.as_mm2,
        fyd,
        section.bwidth_mm,
        fcd,
    );
    
    // Step 3: Calculate lever arm z
    let z = calculate_lever_arm(section.effective_depth_mm, x);
    
    // Step 4: Calculate moment capacity
    // Md = As * fyd * z
    let design_moment = section.as_mm2 * fyd * z / 1e6;  // kNm
    
    let utilization_ratio = (params.applied_moment_kNm / design_moment.max(0.001)).max(0.0);
    
    EC2Capacity {
        design_moment_kNm: design_moment,
        utilization_ratio,
        compressive_zone_depth_mm: x,
        lever_arm_mm: z,
        design_stress_concrete_mpa: fcd,
        design_stress_steel_mpa: fyd,
    }
}

/// Check if capacity is adequate
pub fn is_adequate(capacity: &EC2Capacity) -> bool {
    capacity.utilization_ratio <= 1.0 && capacity.lever_arm_mm > 0.0
}

/// Verify minimum steel ratio
/// ρ_min = max(0.0013, 0.26 * fctm / fyk) where fctm = 0.3 * fck^(2/3)
pub fn check_minimum_steel(fck_mpa: f64, fyk_mpa: f64, b_mm: f64, d_mm: f64) -> f64 {
    let fctm = 0.3 * fck_mpa.powf(2.0/3.0);
    let rho_min = (0.0013_f64).max(0.26 * fctm / fyk_mpa);
    rho_min * b_mm * d_mm
}

/// Verify maximum steel ratio to ensure ductility
/// ρ_max ≈ 0.04 (typical limit to ensure ductile failure)
pub fn check_maximum_steel(_fck_mpa: f64, _fyk_mpa: f64, b_mm: f64, d_mm: f64) -> f64 {
    let rho_max = 0.04;
    rho_max * b_mm * d_mm
}

// ── Shear Design (EN 1992-1-1 Cl. 6.2) ──

/// Shear capacity result per Eurocode 2
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EC2ShearCapacity {
    pub vrd_c_kn: f64,        // Concrete shear resistance
    pub vrd_s_kn: f64,        // Stirrup shear resistance
    pub vrd_max_kn: f64,      // Maximum shear resistance
    pub ved_kn: f64,          // Design shear force
    pub stirrup_spacing_mm: f64,
    pub asw_s: f64,           // Stirrup area per unit length (mm²/mm)
    pub utilization: f64,
    pub passed: bool,
}

/// Calculate concrete shear resistance VRd,c per EN 1992-1-1 Cl. 6.2.2
/// VRd,c = [0.18k(100ρ₁fck)^(1/3)] bw d / γc
pub fn calculate_shear_capacity_concrete(
    bw_mm: f64,
    d_mm: f64,
    fck_mpa: f64,
    rho_l: f64,
) -> f64 {
    let k = (1.0 + (200.0 / d_mm).sqrt()).min(2.0);
    let crdc = 0.18 / 1.5; // γc = 1.5
    let v_min = 0.035 * k.powf(1.5) * fck_mpa.sqrt();
    
    let vrd_c = crdc * k * (100.0 * rho_l * fck_mpa).powf(1.0/3.0) * bw_mm * d_mm / 1000.0; // kN
    let vrd_c_min = v_min * bw_mm * d_mm / 1000.0;
    
    vrd_c.max(vrd_c_min)
}

/// Design shear reinforcement per EN 1992-1-1 Cl. 6.2.3
/// VRd,s = (Asw/s) z fyd cot(θ)
pub fn design_shear_reinforcement(
    ved_kn: f64,
    vrd_c_kn: f64,
    bw_mm: f64,
    d_mm: f64,
    fck_mpa: f64,
    fyk_mpa: f64,
) -> EC2ShearCapacity {
    let z = 0.9 * d_mm; // Lever arm
    let fyd = fyk_mpa / 1.15;
    let theta = 21.8_f64.to_radians(); // θ = 21.8° per EC2 (cot θ = 2.5)
    let cot_theta = 2.5;
    
    // Maximum shear resistance (crushing)
    let alpha_cw = 1.0; // No axial force
    let v1 = 0.6 * (1.0 - fck_mpa / 250.0);
    let fcd = fck_mpa / 1.5; // Design concrete strength
    let vrd_max = alpha_cw * bw_mm * z * v1 * fcd / (cot_theta + theta.tan()) / 1000.0;
    
    let (asw_s, spacing_mm, vrd_s_kn) = if ved_kn <= vrd_c_kn {
        // Minimum stirrups per Cl. 9.2.2
        let asw_s_min = 0.08 * fck_mpa.sqrt() / fyk_mpa * bw_mm;
        let asw = 2.0 * 50.3; // 2-leg 8mm stirrups = 100.6 mm²
        let s_min = asw / asw_s_min;
        (asw_s_min, s_min.min(300.0), 0.0)
    } else {
        // Required Asw/s = VEd / (z fyd cot θ)
        let asw_s_req = ved_kn * 1000.0 / (z * fyd * cot_theta);
        
        // Use 2-leg 8mm stirrups
        let asw = 2.0 * 50.3;
        let spacing = asw / asw_s_req;
        
        // Maximum spacing per Cl. 9.2.2
        let s_max = 0.75 * d_mm;
        let spacing_final = spacing.min(s_max).max(75.0);
        
        let vrd_s = (asw / spacing_final) * z * fyd * cot_theta / 1000.0;
        (asw / spacing_final, spacing_final, vrd_s)
    };
    
    let vrd_total = vrd_c_kn + vrd_s_kn;
    let utilization = ved_kn / vrd_total.min(vrd_max).max(0.001);
    
    EC2ShearCapacity {
        vrd_c_kn,
        vrd_s_kn,
        vrd_max_kn: vrd_max,
        ved_kn,
        stirrup_spacing_mm: spacing_mm,
        asw_s,
        utilization,
        passed: utilization <= 1.0 && ved_kn <= vrd_max,
    }
}

/// Database of common European reinforced concrete sections
pub fn ec2_sections() -> Vec<EC2Section> {
    vec![
        EC2Section {
            name: "250x400 (4Ø14)".into(),
            bwidth_mm: 250.0,
            depth_mm: 400.0,
            effective_depth_mm: 360.0,
            as_mm2: 4.0 * 153.94,  // 4 × Ø14mm = 4 × 153.94 mm²
            fyk_mpa: 500.0,
            fck_mpa: 25.0,
            cover_mm: 30.0,
        },
        EC2Section {
            name: "300x500 (5Ø16)".into(),
            bwidth_mm: 300.0,
            depth_mm: 500.0,
            effective_depth_mm: 460.0,
            as_mm2: 5.0 * 201.06,  // 5 × Ø16mm = 5 × 201.06 mm²
            fyk_mpa: 500.0,
            fck_mpa: 30.0,
            cover_mm: 30.0,
        },
        EC2Section {
            name: "350x550 (6Ø18)".into(),
            bwidth_mm: 350.0,
            depth_mm: 550.0,
            effective_depth_mm: 510.0,
            as_mm2: 6.0 * 254.47,  // 6 × Ø18mm = 6 × 254.47 mm²
            fyk_mpa: 500.0,
            fck_mpa: 30.0,
            cover_mm: 35.0,
        },
        EC2Section {
            name: "400x600 (8Ø16)".into(),
            bwidth_mm: 400.0,
            depth_mm: 600.0,
            effective_depth_mm: 560.0,
            as_mm2: 8.0 * 201.06,
            fyk_mpa: 500.0,
            fck_mpa: 35.0,
            cover_mm: 35.0,
        },
    ]
}

// ── Crack Width Check (EN 1992-1-1 Cl. 7.3) ──

/// Crack width result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EC2CrackWidthResult {
    pub passed: bool,
    pub utilization: f64,
    pub wk_mm: f64,
    pub wk_limit_mm: f64,
    pub sr_max_mm: f64,
    pub epsilon_sm_minus_cm: f64,
    pub message: String,
}

/// Crack width calculation per EN 1992-1-1 Cl. 7.3.4
///
/// wk = sr,max × (εsm − εcm)
///
/// sr,max = 3.4c + 0.425 k1 k2 Ø / ρp,eff  (Eq. 7.11)
/// εsm − εcm = [σs − kt fct,eff/ρp,eff (1 + αe ρp,eff)] / Es  (Eq. 7.9)
///
/// Typical limits: 0.3mm for XC1 exposure, 0.2mm for XC2–XC4
pub fn check_crack_width(
    b_mm: f64,
    d_mm: f64,
    cover_mm: f64,
    as_mm2: f64,
    bar_dia_mm: f64,
    fck_mpa: f64,
    sigma_s_mpa: f64,
    wk_limit_mm: f64,
    is_long_term: bool,
) -> EC2CrackWidthResult {
    let fctm = 0.3 * fck_mpa.powf(2.0 / 3.0); // EN 1992-1-1 Table 3.1
    let es = 200_000.0; // MPa
    let ecm_gpa = 22.0 * (fck_mpa / 10.0).powf(0.3); // Table 3.1
    let alpha_e = es / (ecm_gpa * 1000.0);

    // Effective tension area: Ac,eff = b × hc,eff
    // hc,eff = min(2.5(h − d), (h − x)/3, h/2) — simplified as 2.5 × cover + bar_dia
    let h = d_mm + cover_mm + bar_dia_mm / 2.0;
    let hc_eff = (2.5 * (h - d_mm)).min(h / 2.0);
    let ac_eff = b_mm * hc_eff;
    let rho_p_eff = (as_mm2 / ac_eff).max(0.001);

    // kt: 0.6 for short-term, 0.4 for long-term loading
    let kt = if is_long_term { 0.4 } else { 0.6 };

    // Eq. 7.9: εsm − εcm
    let esm_ecm_raw = (sigma_s_mpa - kt * fctm / rho_p_eff * (1.0 + alpha_e * rho_p_eff)) / es;
    let esm_ecm = esm_ecm_raw.max(0.6 * sigma_s_mpa / es);

    // Eq. 7.11: sr,max — k1=0.8 (high bond), k2=0.5 (flexure)
    let k1 = 0.8;
    let k2 = 0.5;
    let sr_max = 3.4 * cover_mm + 0.425 * k1 * k2 * bar_dia_mm / rho_p_eff;

    let wk = sr_max * esm_ecm;
    let utilization = wk / wk_limit_mm.max(f64::EPSILON);

    EC2CrackWidthResult {
        passed: wk <= wk_limit_mm,
        utilization,
        wk_mm: wk,
        wk_limit_mm,
        sr_max_mm: sr_max,
        epsilon_sm_minus_cm: esm_ecm,
        message: format!(
            "EC2 Cl. 7.3: wk={wk:.3}mm ≤ {wk_limit_mm}mm, sr,max={sr_max:.1}mm, \
             (εsm−εcm)={esm_ecm:.6}"
        ),
    }
}

// ── Punching Shear (EN 1992-1-1 Cl. 6.4) ──

/// Punching shear result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EC2PunchingShearResult {
    pub passed: bool,
    pub utilization: f64,
    pub ved_mpa: f64,
    pub vrd_c_mpa: f64,
    pub vrd_max_mpa: f64,
    pub u1_mm: f64,
    pub message: String,
}

/// Punching shear check per EN 1992-1-1 Cl. 6.4.3–6.4.4
///
/// Control perimeter u1 at 2d from column face.
/// vEd = β × VEd / (u1 × d)
/// vRd,c = CRd,c × k × (100 ρl fck)^(1/3) ≥ vmin   (Eq. 6.47)
///
/// β = 1.15 for interior, 1.4 for edge, 1.5 for corner columns
pub fn check_punching_shear(
    column_b_mm: f64,
    column_h_mm: f64,
    slab_d_mm: f64,
    fck_mpa: f64,
    rho_l: f64,
    ved_kn: f64,
    beta: f64,
) -> EC2PunchingShearResult {
    // Control perimeter at 2d from column face (rectangular column)
    let u1 = 2.0 * (column_b_mm + column_h_mm) + 4.0 * std::f64::consts::PI * slab_d_mm;

    // Applied punching shear stress
    let v_ed = beta * ved_kn * 1000.0 / (u1 * slab_d_mm); // MPa

    // vRd,c per Cl. 6.4.4 / Eq. 6.47
    let k = (1.0 + (200.0 / slab_d_mm).sqrt()).min(2.0);
    let crd_c = 0.18 / 1.5; // CRd,c / γc
    let vrd_c = crd_c * k * (100.0 * rho_l.min(0.02) * fck_mpa).powf(1.0 / 3.0);
    let vmin = 0.035 * k.powf(1.5) * fck_mpa.sqrt();
    let vrd_c = vrd_c.max(vmin);

    // Maximum punching shear stress vRd,max
    let nu = 0.6 * (1.0 - fck_mpa / 250.0);
    let fcd = fck_mpa / 1.5;
    let vrd_max = 0.5 * nu * fcd;

    let utilization = v_ed / vrd_c.max(f64::EPSILON);

    EC2PunchingShearResult {
        passed: v_ed <= vrd_c && v_ed <= vrd_max,
        utilization,
        ved_mpa: v_ed,
        vrd_c_mpa: vrd_c,
        vrd_max_mpa: vrd_max,
        u1_mm: u1,
        message: format!(
            "EC2 Cl. 6.4: vEd={v_ed:.3} MPa ≤ vRd,c={vrd_c:.3} MPa, \
             u1={u1:.0}mm, β={beta:.2}"
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ec2_fcd_calculation() {
        let fcd = calculate_fcd(25.0, 1.5, 0.85);
        // fcd = 0.85 * 25 / 1.5 = 14.17 MPa
        assert!(fcd > 14.0 && fcd < 14.2);
    }

    #[test]
    fn test_ec2_bending_capacity() {
        let section = EC2Section {
            name: "300x500 (5Ø16)".into(),
            bwidth_mm: 300.0,
            depth_mm: 500.0,
            effective_depth_mm: 460.0,
            as_mm2: 5.0 * 201.06,
            fyk_mpa: 500.0,
            fck_mpa: 30.0,
            cover_mm: 30.0,
        };

        let params = EC2DesignParams {
            applied_moment_kNm: 150.0,
            include_compression_steel: false,
            as_prime_mm2: 0.0,
            fyk_prime_mpa: 0.0,
        };

        let capacity = calculate_bending_capacity(&section, &params);

        assert!(capacity.design_moment_kNm > 150.0);
        assert!(capacity.lever_arm_mm > 300.0);
        assert!(capacity.utilization_ratio < 1.0);
    }

    #[test]
    fn test_ec2_minimum_steel() {
        let as_min = check_minimum_steel(25.0, 500.0, 300.0, 460.0);
        // fctm = 0.3 * 25^(2/3) ≈ 2.087 MPa
        // ρ_min = max(0.0013, 0.26 * 2.087 / 500) = max(0.0013, 0.00108) = 0.0013
        // As_min = 0.0013 * 300 * 460 ≈ 179.4 mm²
        assert!(as_min > 170.0 && as_min < 190.0);
    }

    #[test]
    fn test_ec2_lever_arm_bounds() {
        let z = calculate_lever_arm(460.0, 200.0);
        // z = 460 - 0.4*200 = 380 mm, bounded to [0.5*460, 0.95*460] = [230, 437]
        assert!(z > 230.0 && z < 437.0);
    }

    #[test]
    fn test_ec2_is_adequate() {
        let section = EC2Section {
            name: "300x500".into(),
            bwidth_mm: 300.0,
            depth_mm: 500.0,
            effective_depth_mm: 460.0,
            as_mm2: 1005.3,
            fyk_mpa: 500.0,
            fck_mpa: 30.0,
            cover_mm: 30.0,
        };
        let params = EC2DesignParams {
            applied_moment_kNm: 100.0,
            include_compression_steel: false,
            as_prime_mm2: 0.0,
            fyk_prime_mpa: 0.0,
        };
        let cap = calculate_bending_capacity(&section, &params);
        assert!(is_adequate(&cap));
    }

    #[test]
    fn test_ec2_maximum_steel() {
        let as_max = check_maximum_steel(30.0, 500.0, 300.0, 460.0);
        // ρ_max = 0.04, As_max = 0.04 * 300 * 460 = 5520 mm²
        assert!((as_max - 5520.0).abs() < 1.0);
    }

    #[test]
    fn test_ec2_shear_capacity_concrete() {
        // 300x500 beam, d=460mm, C30, ρ=0.02
        let vrd_c = calculate_shear_capacity_concrete(300.0, 460.0, 30.0, 0.02);
        // VRd,c should be in the range 80-150 kN for this beam size
        assert!(vrd_c > 50.0 && vrd_c < 200.0);
        // Must be positive
        assert!(vrd_c > 0.0);
    }

    #[test]
    fn test_ec2_shear_reinforcement_minimum() {
        // VEd < VRd,c → minimum stirrups only
        let vrd_c = calculate_shear_capacity_concrete(300.0, 460.0, 30.0, 0.02);
        let result = design_shear_reinforcement(20.0, vrd_c, 300.0, 460.0, 30.0, 500.0);
        assert!(result.passed);
        assert!(result.stirrup_spacing_mm > 0.0);
        assert!(result.stirrup_spacing_mm <= 300.0); // max min-stirrup spacing
    }

    #[test]
    fn test_ec2_shear_reinforcement_required() {
        // VEd > VRd,c → full shear design
        let result = design_shear_reinforcement(200.0, 80.0, 300.0, 460.0, 30.0, 500.0);
        assert!(result.stirrup_spacing_mm > 0.0);
        // Closer spacing for higher shear
        assert!(result.asw_s > 0.0);
    }

    #[test]
    fn test_ec2_section_database() {
        let sections = ec2_sections();
        assert!(sections.len() >= 2);
        for s in &sections {
            assert!(s.bwidth_mm > 0.0);
            assert!(s.effective_depth_mm > 0.0);
            assert!(s.fck_mpa > 0.0);
        }
    }
}
