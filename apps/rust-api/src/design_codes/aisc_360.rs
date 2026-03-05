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
}
