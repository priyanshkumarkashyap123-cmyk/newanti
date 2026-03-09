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
/// ρ_min = max(0.0013, 0.26 * fck / fyk)
pub fn check_minimum_steel(fck_mpa: f64, fyk_mpa: f64, b_mm: f64, d_mm: f64) -> f64 {
    let rho_min = (0.0013_f64).max(0.26 * fck_mpa / fyk_mpa);
    rho_min * b_mm * d_mm
}

/// Verify maximum steel ratio to ensure ductility
/// ρ_max ≈ 0.04 (typical limit to ensure ductile failure)
pub fn check_maximum_steel(fck_mpa: f64, fyk_mpa: f64, b_mm: f64, d_mm: f64) -> f64 {
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
    let vrd_max = alpha_cw * bw_mm * z * v1 * fck_mpa / (cot_theta + theta.tan()) / 1000.0;
    
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
        // ρ_min = max(0.0013, 0.26 * 25 / 500) = max(0.0013, 0.013) = 0.013
        // As_min = 0.013 * 300 * 460 = 1794 mm²
        assert!(as_min > 1600.0 && as_min < 1900.0);
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
