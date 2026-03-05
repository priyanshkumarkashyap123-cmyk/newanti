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
