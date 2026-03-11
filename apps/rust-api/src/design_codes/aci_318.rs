/// ACI 318-19 (US Reinforced Concrete Design Standard)
/// Strength Design Method (Ultimate Strength Design)
/// 
/// References:
/// - ACI 318-19: Building Code Requirements for Structural Concrete
/// - Whitney stress block and variable strength reduction factors

use serde::{Deserialize, Serialize};

/// Concrete design capacity and strain results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ACICapacity {
    pub nominal_moment_kNm: f64,
    pub design_moment_kNm: f64,
    pub utilization_ratio: f64,
    pub strength_reduction_factor: f64,
    pub strain_tension_steel: f64,
    pub compressive_block_depth_mm: f64,
    pub tension_controlled: bool,
}

/// Reinforced concrete beam section properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ACISection {
    pub name: String,
    pub bwidth_mm: f64,                 // Beam width
    pub depth_mm: f64,                  // Total depth
    pub effective_depth_mm: f64,        // d - effective depth
    pub as_mm2: f64,                    // Area of tension steel
    pub fy_mpa: f64,                    // Rebar yield strength
    pub fc_prime_mpa: f64,              // Concrete compressive strength
    pub cover_mm: f64,                  // Concrete cover
}

/// ACI design parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ACIDesignParams {
    pub applied_moment_kNm: f64,        // Design moment (Mu)
    pub include_compression_steel: bool,
    pub as_prime_mm2: f64,              // Area of compression steel (optional)
    pub fy_prime_mpa: f64,              // Compression steel yield (optional)
}

/// Calculate depth of equivalent stress block (Whitney)
/// a = As * fy / (0.85 * fc' * b)
fn calculate_stress_block_depth(
    as_mm2: f64,
    fy_mpa: f64,
    fc_prime_mpa: f64,
    bwidth_mm: f64,
) -> f64 {
    as_mm2 * fy_mpa / (0.85 * fc_prime_mpa * bwidth_mm)
}

/// Calculate strain in tension steel
/// Given neutral axis position c, strain εt = 0.003 * (d - c) / c
fn calculate_tension_strain(c_mm: f64, d_mm: f64) -> f64 {
    if c_mm > 0.001 {
        0.003 * (d_mm - c_mm) / c_mm
    } else {
        0.003
    }
}

/// Determine strength reduction factor φ based on tension strain
/// If εt ≥ 0.005: φ = 0.90 (tension-controlled)
/// If 0.002 ≤ εt < 0.005: φ interpolated
/// If εt < 0.002: φ ≤ 0.65 (compression-controlled)
fn calculate_strength_reduction_factor(epsilon_t: f64) -> f64 {
    if epsilon_t >= 0.005 {
        0.90  // Tension-controlled
    } else if epsilon_t >= 0.002 {
        // Linear interpolation
        0.65 + (epsilon_t - 0.002) * (0.90 - 0.65) / (0.005 - 0.002)
    } else {
        0.65  // Compression-controlled
    }
}

/// Calculate ACI reinforced concrete beam capacity
/// Using Whitney stress block and variable φ factor
pub fn calculate_bending_capacity(
    section: &ACISection,
    params: &ACIDesignParams,
) -> ACICapacity {
    // Step 1: Calculate neutral axis depth and stress block depth
    let a = calculate_stress_block_depth(
        section.as_mm2,
        section.fy_mpa,
        section.fc_prime_mpa,
        section.bwidth_mm,
    );
    
    // Step 2: Calculate neutral axis position c = a / β1
    // β1 = 0.85 for fc' ≤ 28 MPa, decreases for higher strengths
    let beta_1 = if section.fc_prime_mpa <= 28.0 {
        0.85
    } else {
        0.85 - (section.fc_prime_mpa - 28.0) * 0.05 / 7.0
    };
    let c = a / beta_1;
    
    // Step 3: Calculate tension steel strain
    let epsilon_t = calculate_tension_strain(c, section.effective_depth_mm);
    
    // Step 4: Calculate strength reduction factor
    let phi = calculate_strength_reduction_factor(epsilon_t);
    
    // Step 5: Calculate nominal moment capacity
    // Mn = As * fy * (d - a/2)
    let lever_arm = section.effective_depth_mm - a / 2.0;
    let mn = section.as_mm2 * section.fy_mpa * lever_arm / 1e6; // kNm
    
    // Step 6: Add compression steel contribution if included
    let mn_total = if params.include_compression_steel && params.as_prime_mm2 > 0.0 {
        // Mn' = As' * fy' * (d - d')
        let mn_prime = params.as_prime_mm2 * params.fy_prime_mpa 
            * (section.effective_depth_mm - section.cover_mm) / 1e6;
        mn + mn_prime
    } else {
        mn
    };
    
    // Step 7: Calculate design moment
    let design_moment = phi * mn_total;
    let utilization_ratio = (params.applied_moment_kNm / design_moment.max(0.001)).max(0.0);
    
    ACICapacity {
        nominal_moment_kNm: mn_total,
        design_moment_kNm: design_moment,
        utilization_ratio,
        strength_reduction_factor: phi,
        strain_tension_steel: epsilon_t,
        compressive_block_depth_mm: a,
        tension_controlled: epsilon_t >= 0.005,
    }
}

/// Check if capacity is adequate
pub fn is_adequate(capacity: &ACICapacity) -> bool {
    capacity.utilization_ratio <= 1.0
}

/// Verify beam does not exceed balanced reinforcement
/// ρ_bal = 0.85 * β1 * fc' / fy * (0.003 / (0.003 + fy/Es))
pub fn check_balanced_steel(section: &ACISection) -> f64 {
    let es = 200_000.0; // Steel elastic modulus in MPa
    let beta_1 = if section.fc_prime_mpa <= 28.0 {
        0.85
    } else {
        0.85 - (section.fc_prime_mpa - 28.0) * 0.05 / 7.0
    };
    
    let rho_bal = 0.85 * beta_1 * section.fc_prime_mpa / section.fy_mpa 
        * (0.003 / (0.003 + section.fy_mpa / es));
    
    rho_bal
}

// ── Shear Design (ACI 318-19 Cl. 22.5) ──

/// Shear capacity result per ACI 318-19
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ACIShearCapacity {
    pub vc_kn: f64,           // Concrete shear strength (φVc)
    pub vs_kn: f64,           // Stirrup shear strength (φVs)
    pub vn_kn: f64,           // Nominal shear strength (φVn = φVc + φVs)
    pub vu_kn: f64,           // Factored shear demand
    pub phi: f64,             // Strength reduction factor (0.75 for shear)
    pub stirrup_spacing_mm: f64,
    pub av_mm2: f64,          // Area of stirrup legs
    pub utilization: f64,
    pub passed: bool,
}

/// Calculate concrete shear strength Vc per ACI 318-19 Cl. 22.5.5.1
/// Vc = 2λ√fc' bw d (in psi units, convert to N/mm²)
/// φVc where φ = 0.75 for shear
pub fn calculate_shear_capacity_concrete(
    bw_mm: f64,
    d_mm: f64,
    fc_prime_mpa: f64,
    lambda: f64,
) -> f64 {
    // Vc = 2λ√fc' bw d (ACI uses psi, so fc' in psi = fc'_MPa * 145)
    // Simplified: Vc = 0.17λ√fc'(MPa) bw d (in N)
    let vc_n = 0.17 * lambda * fc_prime_mpa.sqrt() * bw_mm * d_mm; // N
    let phi = 0.75; // ACI 318-19 Table 21.2.1(a) for shear
    phi * vc_n / 1000.0 // kN
}

/// Design shear stirrups per ACI 318-19 Cl. 22.5.10
/// Vs = (Av * fyt * d) / s
/// Solve for s: s = (Av * fyt * d) / Vs_req
pub fn design_shear_stirrups(
    vu_kn: f64,
    vc_kn: f64,
    bw_mm: f64,
    d_mm: f64,
    fyt_mpa: f64,
    fc_prime_mpa: f64,
) -> ACIShearCapacity {
    let phi = 0.75;
    
    // Required stirrup contribution: Vs = (Vu/φ) - Vc/φ
    let vs_req_kn = (vu_kn / phi) - (vc_kn / phi);
    
    let (av_mm2, spacing_mm, vs_kn) = if vs_req_kn <= 0.0 {
        // No stirrups required
        (0.0, 0.0, 0.0)
    } else {
        // Use 2-leg 10mm stirrups (Av = 2 × 78.5 = 157 mm²)
        let av = 2.0 * 78.5; // 2-leg #3 stirrups
        
        // Calculate required spacing: s = Av·fyt·d / Vs_req
        let s_req = av * fyt_mpa * d_mm / (vs_req_kn * 1000.0);
        
        // Maximum spacing per ACI 318-19 Cl. 9.7.6.2
        let s_max = if vs_req_kn > 0.33 * fc_prime_mpa.sqrt() * bw_mm * d_mm / 1000.0 {
            d_mm / 4.0  // If Vs > (√fc'/3)bwd, use d/4
        } else {
            d_mm / 2.0  // Otherwise use d/2
        };
        let s_max = s_max.min(600.0); // Also limit to 600mm per ACI
        
        let spacing = s_req.min(s_max).max(75.0); // Min 75mm clear
        let vs = av * fyt_mpa * d_mm / spacing / 1000.0; // kN
        
        (av, spacing, phi * vs)
    };
    
    let vn_kn = vc_kn + vs_kn;
    let utilization = vu_kn / vn_kn.max(0.001);
    
    ACIShearCapacity {
        vc_kn,
        vs_kn,
        vn_kn,
        vu_kn,
        phi,
        stirrup_spacing_mm: spacing_mm,
        av_mm2,
        utilization,
        passed: utilization <= 1.0,
    }
}

/// Database of common reinforced concrete sections
pub fn aci_sections() -> Vec<ACISection> {
    vec![
        ACISection {
            name: "300x500 (6#10)".into(),
            bwidth_mm: 300.0,
            depth_mm: 500.0,
            effective_depth_mm: 450.0,
            as_mm2: 6.0 * 71.33,  // 6 #10 bars = 6 × 71.33 mm²
            fy_mpa: 414.0,
            fc_prime_mpa: 27.6,
            cover_mm: 40.0,
        },
        ACISection {
            name: "400x600 (8#12)".into(),
            bwidth_mm: 400.0,
            depth_mm: 600.0,
            effective_depth_mm: 550.0,
            as_mm2: 8.0 * 113.10, // 8 #12 bars = 8 × 113.10 mm²
            fy_mpa: 414.0,
            fc_prime_mpa: 27.6,
            cover_mm: 40.0,
        },
        ACISection {
            name: "350x550 (6#12)".into(),
            bwidth_mm: 350.0,
            depth_mm: 550.0,
            effective_depth_mm: 500.0,
            as_mm2: 6.0 * 113.10,
            fy_mpa: 414.0,
            fc_prime_mpa: 27.6,
            cover_mm: 40.0,
        },
        ACISection {
            name: "300x450 (4#12)".into(),
            bwidth_mm: 300.0,
            depth_mm: 450.0,
            effective_depth_mm: 400.0,
            as_mm2: 4.0 * 113.10,
            fy_mpa: 414.0,
            fc_prime_mpa: 27.6,
            cover_mm: 40.0,
        },
    ]
}

// ── Column P-M Interaction (ACI 318-19 Ch. 22.4) ──

/// Single point on the P-M interaction diagram
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ACIPMPoint {
    pub phi_pn_kn: f64,
    pub phi_mn_knm: f64,
}

/// ACI 318 column check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ACIColumnResult {
    pub passed: bool,
    pub utilization: f64,
    pub phi_pn0_kn: f64,
    pub phi_mn_at_pu_knm: f64,
    pub message: String,
}

/// Column axial + bending check per ACI 318-19 Eq. 22.4.2
///
/// Generates a simplified P-M envelope and checks if (Pu, Mu)
/// falls inside the diagram.
///
/// - Pure axial: φPn(max) = 0.80 × φ × (0.85 f'c (Ag−Ast) + fy Ast) (Eq. 22.4.2.1)
/// - Balanced: εs = εy at balanced point
/// - Pure bending: As × fy × (d − a/2) with φ = 0.90
pub fn check_column_aci(
    b_mm: f64,
    h_mm: f64,
    fc_prime_mpa: f64,
    fy_mpa: f64,
    ast_mm2: f64,
    cover_mm: f64,
    pu_kn: f64,
    mu_knm: f64,
) -> ACIColumnResult {
    let ag = b_mm * h_mm;
    let d = h_mm - cover_mm - 10.0; // effective depth assuming 20mm bar
    let d_prime = cover_mm + 10.0;

    // β1 per Cl. 22.2.2.4.3
    let beta1 = if fc_prime_mpa <= 28.0 {
        0.85
    } else {
        (0.85 - 0.05 * (fc_prime_mpa - 28.0) / 7.0).max(0.65)
    };

    let es_mod = 200_000.0; // MPa
    let epsilon_cu = 0.003;

    // Pure axial capacity (no bending)
    // φPn0 = 0.80 × φ × [0.85 × f'c × (Ag − Ast) + fy × Ast]
    let phi_axial = 0.65; // Compression-controlled
    let pn0 = 0.85 * fc_prime_mpa * (ag - ast_mm2) + fy_mpa * ast_mm2;
    let phi_pn0 = 0.80 * phi_axial * pn0 / 1000.0; // kN

    // Balanced point: c_b = εcu / (εcu + εy) × d
    let epsilon_y = fy_mpa / es_mod;
    let c_b = epsilon_cu / (epsilon_cu + epsilon_y) * d;
    let a_b = beta1 * c_b;

    // Half steel on each face (simplified symmetric reinforcement)
    let as_half = ast_mm2 / 2.0;
    // Strain in compression steel at balanced
    let fs_prime = (es_mod * epsilon_cu * (c_b - d_prime) / c_b).min(fy_mpa);
    let pn_b = 0.85 * fc_prime_mpa * a_b * b_mm + as_half * fs_prime - as_half * fy_mpa;
    let mn_b = 0.85 * fc_prime_mpa * a_b * b_mm * (h_mm / 2.0 - a_b / 2.0)
        + as_half * fs_prime * (h_mm / 2.0 - d_prime)
        + as_half * fy_mpa * (d - h_mm / 2.0);
    let _phi_pn_b = phi_axial * pn_b / 1000.0;
    let phi_mn_b = phi_axial * mn_b / 1e6;

    // Pure bending capacity (no axial)
    let a_flex = ast_mm2 * fy_mpa / (0.85 * fc_prime_mpa * b_mm);
    let phi_mn0 = 0.9 * ast_mm2 * fy_mpa * (d - a_flex / 2.0) / 1e6;

    // Linear interpolation on the P-M diagram to find φMn at Pu
    let pu_abs = pu_kn.abs();
    let phi_mn_at_pu = if pu_abs >= phi_pn0 {
        0.0 // Over pure axial — fails
    } else if pu_abs >= _phi_pn_b.abs() {
        // Between pure axial and balanced — linear interpolation
        let ratio = (phi_pn0 - pu_abs) / (phi_pn0 - _phi_pn_b.abs()).max(f64::EPSILON);
        ratio * phi_mn_b
    } else {
        // Between balanced and pure bending — linear interpolation
        let ratio = pu_abs / _phi_pn_b.abs().max(f64::EPSILON);
        phi_mn0 + ratio * (phi_mn_b - phi_mn0)
    };

    let utilization = mu_knm.abs() / phi_mn_at_pu.max(f64::EPSILON);

    ACIColumnResult {
        passed: utilization <= 1.0 && pu_abs <= phi_pn0,
        utilization,
        phi_pn0_kn: phi_pn0,
        phi_mn_at_pu_knm: phi_mn_at_pu,
        message: format!(
            "ACI 318-19 §22.4: φPn0={phi_pn0:.1} kN, φMn@Pu={phi_mn_at_pu:.1} kN·m, \
             Pu={pu_abs:.1} kN, Mu={:.1} kN·m, util={utilization:.3}",
            mu_knm.abs(),
        ),
    }
}

// ── Development Length (ACI 318-19 Ch. 25) ──

/// Development length result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ACIDevLengthResult {
    pub ld_mm: f64,
    pub message: String,
}

/// Development length for deformed bars in tension per ACI 318-19 §25.4.2.3 (simplified)
///
/// ld = (fy × ψt × ψe × ψs / (1.1 × λ × √f'c)) × db
/// where ψt = 1.3 for top bars, 1.0 otherwise
///       ψe = 1.0 for uncoated, 1.5 for epoxy-coated
///       ψs = 0.8 for ≤ #6 (≤ 19mm), 1.0 otherwise
///       λ = 1.0 for normal weight concrete
pub fn development_length_aci(
    db_mm: f64,
    fy_mpa: f64,
    fc_prime_mpa: f64,
    is_top_bar: bool,
    is_epoxy_coated: bool,
) -> ACIDevLengthResult {
    let psi_t = if is_top_bar { 1.3 } else { 1.0 };
    let psi_e = if is_epoxy_coated { 1.5 } else { 1.0 };
    let psi_s = if db_mm <= 19.0 { 0.8 } else { 1.0 };
    let lambda = 1.0; // Normal weight concrete

    // ACI 318-19 Eq. 25.4.2.3a
    let ld = (fy_mpa * psi_t * psi_e * psi_s) / (1.1 * lambda * fc_prime_mpa.sqrt()) * db_mm;
    // Minimum per §25.4.2.4
    let ld = ld.max(300.0);

    ACIDevLengthResult {
        ld_mm: ld,
        message: format!(
            "ACI 318-19 §25.4.2.3: db={db_mm:.0}mm, ld={ld:.0}mm \
             (ψt={psi_t}, ψe={psi_e}, ψs={psi_s})"
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_aci_bending_capacity() {
        let section = ACISection {
            name: "300x500 (6#10)".into(),
            bwidth_mm: 300.0,
            depth_mm: 500.0,
            effective_depth_mm: 450.0,
            as_mm2: 6.0 * 71.33,
            fy_mpa: 414.0,
            fc_prime_mpa: 27.6,
            cover_mm: 40.0,
        };

        let params = ACIDesignParams {
            applied_moment_kNm: 100.0,
            include_compression_steel: false,
            as_prime_mm2: 0.0,
            fy_prime_mpa: 0.0,
        };

        let capacity = calculate_bending_capacity(&section, &params);

        // 6#10 bars (427.98 mm²) with d=450 mm should give ~74-80 kNm capacity
        assert!(capacity.design_moment_kNm > 60.0 && capacity.design_moment_kNm < 90.0);
        assert!(capacity.utilization_ratio < 2.0);
    }

    #[test]
    fn test_aci_strength_reduction_factor() {
        let phi_tension = calculate_strength_reduction_factor(0.008);
        let phi_compression = calculate_strength_reduction_factor(0.001);
        
        assert!(phi_tension > phi_compression);
        assert_eq!(phi_tension, 0.90);
    }

    #[test]
    fn test_aci_balanced_steel() {
        let section = ACISection {
            name: "300x500 (6#10)".into(),
            bwidth_mm: 300.0,
            depth_mm: 500.0,
            effective_depth_mm: 450.0,
            as_mm2: 6.0 * 71.33,
            fy_mpa: 414.0,
            fc_prime_mpa: 27.6,
            cover_mm: 40.0,
        };

        let rho_bal = check_balanced_steel(&section);
        assert!(rho_bal > 0.01 && rho_bal < 0.05);
    }
}
