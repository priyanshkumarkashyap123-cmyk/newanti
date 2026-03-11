/// AISC 360-22 (US Steel Design Standard)
/// Load and Resistance Factor Design (LRFD) approach
/// 
/// References:
/// - AISC 360-22: Specification for Structural Steel Buildings
/// - LRFD (Load and Resistance Factor Design) methodology

use serde::{Deserialize, Serialize};

/// AISC 360-22 design capacity calculation results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiscCapacity {
    pub plastic_moment_kNm: f64,
    pub design_strength_kNm: f64,
    pub utilization_ratio: f64,
    pub buckling_mode: String,
    pub lb_mm: f64,              // Unbraced length
    pub lp_mm: f64,              // Limiting length for yielding
    pub lr_mm: f64,              // Limiting length for lateral-torsional buckling
}

/// AISC steel section properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiscSection {
    pub name: String,
    pub fy_mpa: f64,                    // Specified minimum yield stress
    pub zx_mm3: f64,                    // Plastic section modulus
    pub sx_mm3: f64,                    // Elastic section modulus
    pub iy_mm4: f64,                    // Second moment about weak axis
    pub ry_mm: f64,                     // Radius of gyration (weak axis)
    pub cw_mm6: f64,                    // Warping constant
    pub j_mm4: f64,                     // St. Venant torsional constant
}

/// AISC design parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiscDesignParams {
    pub unbraced_length_mm: f64,        // Lb - Unbraced length
    pub cb: f64,                        // Lateral-torsional buckling modification factor
    pub applied_moment_kNm: f64,        // Design moment
}

/// Calculate AISC 360-22 bending capacity
/// 
/// # Arguments
/// * `section` - AISC steel section properties
/// * `params` - Design parameters (unbraced length, Cb, applied moment)
/// 
/// # Returns
/// Design capacity and limiting lengths
pub fn calculate_bending_capacity(
    section: &AiscSection,
    params: &AiscDesignParams,
) -> AiscCapacity {
    let phi = 0.9; // Resistance factor for bending
    
    // Step 1: Calculate plastic moment (yielding capacity)
    let mp = section.zx_mm3 as f64 * section.fy_mpa / 1e6; // kNm
    
    // Step 2: Calculate limiting lengths
    // Lp = 1.76 * ry * sqrt(E / Fy)
    let e = 200_000.0; // Young's modulus in MPa
    let lp = 1.76 * section.ry_mm * (e / section.fy_mpa).sqrt();
    
    // Lr = 1.95 * ry * sqrt(E / (0.7 * Fy)) * sqrt(J / (Sx * d))
    // Simplified: Lr ≈ π * ry * sqrt(E / Fy) * sqrt(1 + sqrt(1 + Cw / (Iy * (E/Fy))))
    let lr = 1.95 * section.ry_mm * (e / (0.7 * section.fy_mpa)).sqrt();
    
    // Step 3: Determine buckling mode and calculate φMn
    let (design_strength_kNm, buckling_mode) = if params.unbraced_length_mm <= lp {
        // Plastic moment (no buckling)
        (phi * mp, "Plastic - No Buckling".to_string())
    } else if params.unbraced_length_mm <= lr {
        // Lateral-torsional buckling (inelastic)
        let interpolation_ratio = (params.unbraced_length_mm - lp) / (lr - lp);
        let moment_reduction = (mp - 0.7 * section.fy_mpa * section.sx_mm3 / 1e6) * interpolation_ratio;
        let mn = params.cb * (mp - moment_reduction);
        let clamped_mn = mn.min(mp);
        (phi * clamped_mn, "Lateral-Torsional Buckling (Inelastic)".to_string())
    } else {
        // Lateral-torsional buckling (elastic)
        let mcr = params.cb * std::f64::consts::PI * (e * section.iy_mm4 * section.cw_mm6 / (section.j_mm4 * params.unbraced_length_mm.powi(2))).sqrt() / 1e6;
        let mn = if mcr < 0.5 * mp { mcr } else { mp - 0.3 * (mcr - 0.5 * mp) };
        (phi * mn, "Lateral-Torsional Buckling (Elastic)".to_string())
    };
    
    let utilization_ratio = (params.applied_moment_kNm / design_strength_kNm).max(0.0);
    
    AiscCapacity {
        plastic_moment_kNm: phi * mp,
        design_strength_kNm,
        utilization_ratio,
        buckling_mode,
        lb_mm: params.unbraced_length_mm,
        lp_mm: lp,
        lr_mm: lr,
    }
}

/// Check if bending capacity is adequate under AISC 360-22
pub fn is_adequate(capacity: &AiscCapacity) -> bool {
    capacity.utilization_ratio <= 1.0
}

/// Database of common AISC steel sections (W-shapes, common sizes)
pub fn aisc_w_sections() -> Vec<AiscSection> {
    vec![
        AiscSection {
            name: "W12x120".into(),
            fy_mpa: 250.0,
            zx_mm3: 1150e3,
            sx_mm3: 1070e3,
            iy_mm4: 4270e6,
            ry_mm: 51.0,
            cw_mm6: 8.0e9,
            j_mm4: 47e6,
        },
        AiscSection {
            name: "W12x96".into(),
            fy_mpa: 250.0,
            zx_mm3: 916e3,
            sx_mm3: 856e3,
            iy_mm4: 3400e6,
            ry_mm: 51.0,
            cw_mm6: 5.2e9,
            j_mm4: 30e6,
        },
        AiscSection {
            name: "W12x72".into(),
            fy_mpa: 250.0,
            zx_mm3: 688e3,
            sx_mm3: 645e3,
            iy_mm4: 2530e6,
            ry_mm: 50.0,
            cw_mm6: 3.0e9,
            j_mm4: 18e6,
        },
        AiscSection {
            name: "W14x120".into(),
            fy_mpa: 250.0,
            zx_mm3: 1380e3,
            sx_mm3: 1280e3,
            iy_mm4: 5600e6,
            ry_mm: 61.0,
            cw_mm6: 15.0e9,
            j_mm4: 64e6,
        },
        AiscSection {
            name: "W16x100".into(),
            fy_mpa: 250.0,
            zx_mm3: 1490e3,
            sx_mm3: 1370e3,
            iy_mm4: 4680e6,
            ry_mm: 65.0,
            cw_mm6: 20.0e9,
            j_mm4: 49e6,
        },
    ]
}

// ── Compression Capacity (AISC 360-22 Ch. E) ──

/// AISC 360 compression section properties (extends AiscSection for column checks)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiscCompressionParams {
    /// Gross area (mm²)
    pub ag_mm2: f64,
    /// Radius of gyration about critical axis (mm)
    pub r_mm: f64,
    /// Effective length KL (mm)
    pub kl_mm: f64,
    /// Yield stress (MPa)
    pub fy_mpa: f64,
    /// Applied axial force (kN)
    pub pu_kn: f64,
}

/// AISC 360 compression capacity result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiscCompressionCapacity {
    pub passed: bool,
    pub utilization: f64,
    pub phi_pn_kn: f64,
    pub fcr_mpa: f64,
    pub slenderness: f64,
    pub message: String,
}

/// Compression capacity per AISC 360-22 Eq. E3-1 through E3-4
///
/// Fcr depends on slenderness ratio KL/r relative to elastic buckling limit.
/// - KL/r ≤ 4.71√(E/Fy): inelastic buckling, Eq. E3-2
/// - KL/r > 4.71√(E/Fy): elastic buckling, Eq. E3-3
pub fn calculate_compression_capacity(params: &AiscCompressionParams) -> AiscCompressionCapacity {
    let phi = 0.9; // AISC 360 §E1
    let e = 200_000.0; // MPa

    let slenderness = params.kl_mm / params.r_mm;
    let fe = std::f64::consts::PI.powi(2) * e / slenderness.powi(2); // Eq. E3-4
    let limit = 4.71 * (e / params.fy_mpa).sqrt();

    let fcr = if slenderness <= limit {
        // Inelastic buckling: Fcr = (0.658^(Fy/Fe)) * Fy — Eq. E3-2
        (0.658_f64).powf(params.fy_mpa / fe) * params.fy_mpa
    } else {
        // Elastic buckling: Fcr = 0.877 * Fe — Eq. E3-3
        0.877 * fe
    };

    let phi_pn = phi * fcr * params.ag_mm2 / 1000.0; // kN
    let utilization = params.pu_kn.abs() / phi_pn.max(f64::EPSILON);

    AiscCompressionCapacity {
        passed: utilization <= 1.0,
        utilization,
        phi_pn_kn: phi_pn,
        fcr_mpa: fcr,
        slenderness,
        message: format!(
            "AISC 360 Eq. E3: KL/r={slenderness:.1}, Fcr={fcr:.1} MPa, \
             φPn={phi_pn:.1} kN, Pu={:.1} kN, util={utilization:.3}",
            params.pu_kn.abs(),
        ),
    }
}

// ── Shear Capacity (AISC 360-22 Ch. G) ──

/// AISC 360 shear capacity result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiscShearCapacity {
    pub passed: bool,
    pub utilization: f64,
    pub phi_vn_kn: f64,
    pub cv1: f64,
    pub message: String,
}

/// Shear capacity per AISC 360-22 Eq. G2-1
///
/// φVn = φ × 0.6 × Fy × Aw × Cv1
/// - Cv1 = 1.0 for h/tw ≤ 2.24√(E/Fy) (most rolled shapes)
/// - Otherwise reduced per Table G2.2
pub fn calculate_shear_capacity(
    d_mm: f64,
    tw_mm: f64,
    fy_mpa: f64,
    vu_kn: f64,
) -> AiscShearCapacity {
    let phi_v = 1.0; // AISC 360 §G1 for rolled I-shapes with h/tw ≤ 2.24√(E/Fy)
    let e = 200_000.0;
    let aw = d_mm * tw_mm; // Web area (mm²)
    let h_tw = d_mm / tw_mm;
    let limit = 2.24 * (e / fy_mpa).sqrt();

    let (cv1, phi_actual) = if h_tw <= limit {
        (1.0, 1.0)
    } else {
        // For slender webs: Cv1 per Eq. G2-3/G2-4, φ = 0.9
        let kv = 5.34; // no stiffeners
        let cv = if h_tw <= 1.10 * (kv * e / fy_mpa).sqrt() {
            1.0
        } else {
            1.10 * (kv * e / fy_mpa).sqrt() / h_tw
        };
        (cv, 0.9)
    };

    let phi_vn = phi_actual * 0.6 * fy_mpa * aw * cv1 / 1000.0; // kN
    let utilization = vu_kn.abs() / phi_vn.max(f64::EPSILON);

    AiscShearCapacity {
        passed: utilization <= 1.0,
        utilization,
        phi_vn_kn: phi_vn,
        cv1,
        message: format!(
            "AISC 360 Eq. G2-1: h/tw={h_tw:.1}, Cv1={cv1:.3}, \
             φVn={phi_vn:.1} kN, Vu={:.1} kN, util={utilization:.3}",
            vu_kn.abs(),
        ),
    }
}

// ── Combined Axial + Bending Interaction (AISC 360-22 Ch. H) ──

/// AISC 360 interaction check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiscInteractionResult {
    pub passed: bool,
    pub utilization: f64,
    pub equation: String,
    pub message: String,
}

/// Combined axial + bending check per AISC 360-22 Eq. H1-1a/H1-1b
///
/// When Pr/Pc ≥ 0.2: Pr/Pc + (8/9)(Mrx/Mcx + Mry/Mcy) ≤ 1.0 (H1-1a)
/// When Pr/Pc < 0.2: Pr/(2Pc) + (Mrx/Mcx + Mry/Mcy) ≤ 1.0 (H1-1b)
pub fn check_interaction_h1(
    pr_kn: f64,      // Required axial strength (kN)
    pc_kn: f64,      // Available axial strength φPn (kN)
    mrx_knm: f64,    // Required flexural strength about x-axis (kN·m)
    mcx_knm: f64,    // Available flexural strength about x-axis φMnx (kN·m)
    mry_knm: f64,    // Required flexural strength about y-axis (kN·m)
    mcy_knm: f64,    // Available flexural strength about y-axis φMny (kN·m)
) -> AiscInteractionResult {
    let ratio_p = pr_kn.abs() / pc_kn.max(f64::EPSILON);
    let ratio_mx = mrx_knm.abs() / mcx_knm.max(f64::EPSILON);
    let ratio_my = mry_knm.abs() / mcy_knm.max(f64::EPSILON);

    let (utilization, equation) = if ratio_p >= 0.2 {
        // Eq. H1-1a
        let u = ratio_p + (8.0 / 9.0) * (ratio_mx + ratio_my);
        (u, "H1-1a".to_string())
    } else {
        // Eq. H1-1b
        let u = ratio_p / 2.0 + ratio_mx + ratio_my;
        (u, "H1-1b".to_string())
    };

    AiscInteractionResult {
        passed: utilization <= 1.0,
        utilization,
        equation: equation.clone(),
        message: format!(
            "AISC 360 Eq. {equation}: Pr/Pc={ratio_p:.3}, Mrx/Mcx={ratio_mx:.3}, \
             Mry/Mcy={ratio_my:.3}, interaction={utilization:.3}",
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_aisc_plastic_moment() {
        let section = AiscSection {
            name: "W12x120".into(),
            fy_mpa: 250.0,
            zx_mm3: 1150e3,
            sx_mm3: 1070e3,
            iy_mm4: 4270e6,
            ry_mm: 51.0,
            cw_mm6: 8.0e9,
            j_mm4: 47e6,
        };

        let params = AiscDesignParams {
            unbraced_length_mm: 1000.0,
            cb: 1.0,
            applied_moment_kNm: 250.0,
        };

        let capacity = calculate_bending_capacity(&section, &params);

        // Mp = Zx * Fy = 1150e3 * 250 / 1e6 = 287.5 kNm
        assert!(capacity.plastic_moment_kNm > 250.0);
        assert!(capacity.utilization_ratio < 1.5);
    }

    #[test]
    fn test_aisc_limiting_lengths() {
        let section = AiscSection {
            name: "W12x120".into(),
            fy_mpa: 250.0,
            zx_mm3: 1150e3,
            sx_mm3: 1070e3,
            iy_mm4: 4270e6,
            ry_mm: 51.0,
            cw_mm6: 8.0e9,
            j_mm4: 47e6,
        };

        let params = AiscDesignParams {
            unbraced_length_mm: 2000.0,
            cb: 1.0,
            applied_moment_kNm: 200.0,
        };

        let capacity = calculate_bending_capacity(&section, &params);

        // Lp should be less than Lr
        assert!(capacity.lp_mm < capacity.lr_mm);
        assert!(capacity.lp_mm > 0.0);
    }

    #[test]
    fn test_is_adequate_pass() {
        let section = AiscSection {
            name: "W12x120".into(),
            fy_mpa: 250.0,
            zx_mm3: 1150e3,
            sx_mm3: 1070e3,
            iy_mm4: 4270e6,
            ry_mm: 51.0,
            cw_mm6: 8.0e9,
            j_mm4: 47e6,
        };
        // Low demand → should pass
        let params = AiscDesignParams {
            unbraced_length_mm: 1000.0,
            cb: 1.0,
            applied_moment_kNm: 100.0,
        };
        let cap = calculate_bending_capacity(&section, &params);
        assert!(is_adequate(&cap));
    }

    #[test]
    fn test_is_adequate_fail() {
        let section = AiscSection {
            name: "W12x72".into(),
            fy_mpa: 250.0,
            zx_mm3: 688e3,
            sx_mm3: 645e3,
            iy_mm4: 2530e6,
            ry_mm: 50.0,
            cw_mm6: 3.0e9,
            j_mm4: 18e6,
        };
        // Very high demand → should fail
        let params = AiscDesignParams {
            unbraced_length_mm: 8000.0,
            cb: 1.0,
            applied_moment_kNm: 500.0,
        };
        let cap = calculate_bending_capacity(&section, &params);
        assert!(!is_adequate(&cap));
    }

    #[test]
    fn test_section_database_not_empty() {
        let sections = aisc_w_sections();
        assert!(sections.len() >= 5);
        // Every section should have positive properties
        for s in &sections {
            assert!(s.fy_mpa > 0.0);
            assert!(s.zx_mm3 > 0.0);
            assert!(s.ry_mm > 0.0);
        }
    }

    #[test]
    fn test_aisc_cb_effect() {
        // Higher Cb should increase capacity for same section/length
        let section = AiscSection {
            name: "W14x120".into(),
            fy_mpa: 250.0,
            zx_mm3: 1380e3,
            sx_mm3: 1280e3,
            iy_mm4: 5600e6,
            ry_mm: 61.0,
            cw_mm6: 15.0e9,
            j_mm4: 64e6,
        };
        let params1 = AiscDesignParams {
            unbraced_length_mm: 5000.0,
            cb: 1.0,
            applied_moment_kNm: 200.0,
        };
        let params2 = AiscDesignParams {
            unbraced_length_mm: 5000.0,
            cb: 1.5,
            applied_moment_kNm: 200.0,
        };
        let cap1 = calculate_bending_capacity(&section, &params1);
        let cap2 = calculate_bending_capacity(&section, &params2);
        // Higher Cb → lower utilization (same demand, higher capacity)
        assert!(cap2.utilization_ratio <= cap1.utilization_ratio);
    }
}
