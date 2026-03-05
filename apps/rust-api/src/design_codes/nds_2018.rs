/// NDS 2018 (US Timber Design Standard)
/// Load and Resistance Factor Design (LRFD) with adjustment factors
/// 
/// References:
/// - NDS 2018: National Design Specification for Wood Construction
/// - Adjusted bending design value with cascade of modification factors

use serde::{Deserialize, Serialize};

/// NDS timber design capacity results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NDSCapacity {
    pub reference_bending_value_mpa: f64,
    pub adjusted_bending_value_mpa: f64,
    pub adjusted_section_modulus_mm3: f64,
    pub design_moment_kNm: f64,
    pub utilization_ratio: f64,
    pub adjustment_factor_total: f64,
}

/// Timber section properties (NDS)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NDSSection {
    pub name: String,
    pub reference_fb_mpa: f64,          // Reference bending value
    pub section_modulus_mm3: f64,       // Elastic section modulus S
    pub depth_mm: f64,                  // Member depth
    pub width_mm: f64,                  // Member width
    pub species: String,                // Species/grade (e.g., "2x8 No.2 Pine")
}

/// NDS design parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NDSDesignParams {
    pub applied_moment_kNm: f64,        // Design moment
    pub load_duration: String,          // "Permanent", "10-Year", "7-Day", "1-Hour", "5-minute"
    pub wet_service: bool,              // Is member in wet environment?
    pub temperature_elevation: f64,     // Temperature elevation above 68°F (°F)
    pub incised: bool,                  // Are members incised?
    pub bearing_length_mm: f64,         // For lateral stability check
    pub member_length_mm: f64,          // For beam stability (Lu)
}

/// Load duration factor (CD)
fn get_load_duration_factor(duration: &str) -> f64 {
    match duration {
        "Permanent" => 0.9,
        "10-Year" => 1.0,
        "7-Day" => 1.15,
        "1-Hour" => 1.25,
        "5-minute" => 1.6,
        _ => 1.0,
    }
}

/// Wet service factor (CM)
fn get_wet_service_factor(is_wet: bool) -> f64 {
    if is_wet { 0.85 } else { 1.0 }
}

/// Temperature factor (Ct)
fn get_temperature_factor(elevation_f: f64) -> f64 {
    if elevation_f <= 0.0 {
        1.0
    } else if elevation_f >= 203.0 {
        // 203°F ≈ 95°C
        0.1  // Severe loss of properties
    } else {
        // Linear interpolation
        1.0 - elevation_f * 0.9 / 203.0
    }
}

/// Beam stability factor (CL) - simplified
/// For unbraced length Lu and depth d: CL = sqrt(1 + (Lu/d)²)^-1
fn calculate_beam_stability_factor(lu_mm: f64, d_mm: f64) -> f64 {
    if d_mm > 0.001 {
        let ratio = lu_mm / d_mm;
        1.0 / (1.0 + ratio.powi(2)).sqrt()
    } else {
        1.0
    }
}

/// Size factor (CF) based on member dimensions
/// For sawn lumber: CF decreases with larger cross-sections
fn get_size_factor(depth_mm: f64, width_mm: f64) -> f64 {
    let depth_in = depth_mm / 25.4;
    let width_in = width_mm / 25.4;
    
    // 2x6 and smaller: CF = 1.3
    // 2x8: CF = 1.2
    // 2x10: CF = 1.1
    // 2x12: CF = 1.0
    // Simplified based on depth
    if depth_in <= 6.0 {
        1.3
    } else if depth_in <= 8.0 {
        1.2
    } else if depth_in <= 10.0 {
        1.1
    } else {
        1.0
    }
}

/// Incising factor (Ci)
fn get_incising_factor(incised: bool) -> f64 {
    if incised { 0.9 } else { 1.0 }
}

/// Repetitive member factor (Cr)
fn get_repetitive_member_factor(is_repetitive: bool) -> f64 {
    if is_repetitive { 1.15 } else { 1.0 }
}

/// Calculate NDS adjusted bending value
/// F'b = Fb × CD × CM × Ct × CL × CF × Ci × Cr
pub fn calculate_adjusted_bending_value(
    section: &NDSSection,
    params: &NDSDesignParams,
) -> NDSCapacity {
    // Step 1: Calculate all adjustment factors
    let cd = get_load_duration_factor(&params.load_duration);
    let cm = get_wet_service_factor(params.wet_service);
    let ct = get_temperature_factor(params.temperature_elevation);
    let cl = calculate_beam_stability_factor(params.member_length_mm, section.depth_mm);
    let cf = get_size_factor(section.depth_mm, section.width_mm);
    let ci = get_incising_factor(params.incised);
    let cr = get_repetitive_member_factor(false); // Non-repetitive member
    
    // Step 2: Calculate total adjustment factor
    let total_adjustment = cd * cm * ct * cl * cf * ci * cr;
    
    // Step 3: Calculate adjusted bending value
    // F'b = Fb × (all adjustment factors)
    let fb_adjusted = section.reference_fb_mpa * total_adjustment;
    
    // Step 4: Calculate moment capacity
    // M' = F'b × S
    let design_moment = fb_adjusted * section.section_modulus_mm3 / 1e6;  // kNm
    
    let utilization_ratio = (params.applied_moment_kNm / design_moment.max(0.001)).max(0.0);
    
    NDSCapacity {
        reference_bending_value_mpa: section.reference_fb_mpa,
        adjusted_bending_value_mpa: fb_adjusted,
        adjusted_section_modulus_mm3: section.section_modulus_mm3,
        design_moment_kNm: design_moment,
        utilization_ratio,
        adjustment_factor_total: total_adjustment,
    }
}

/// Check if timber capacity is adequate
pub fn is_adequate(capacity: &NDSCapacity) -> bool {
    capacity.utilization_ratio <= 1.0 && capacity.adjusted_bending_value_mpa > 0.0
}

/// Check lateral buckling (torsional bracing)
/// Lu/d ratio should generally be < 50 for adequate lateral support
pub fn is_laterally_braced(lu_mm: f64, d_mm: f64) -> bool {
    if d_mm > 0.001 {
        (lu_mm / d_mm) < 50.0
    } else {
        true
    }
}

/// Database of common NDS lumber grades and sizes
pub fn nds_lumber_sections() -> Vec<NDSSection> {
    vec![
        NDSSection {
            name: "2x8 No.2 Pine".into(),
            reference_fb_mpa: 11.7,  // 1700 psi ≈ 11.7 MPa
            section_modulus_mm3: 21.4e3,  // S ≈ 13.1 in³ ≈ 21.4e3 mm³
            depth_mm: 190.5,         // 7.5 in
            width_mm: 38.1,          // 1.5 in
            species: "2x8 No.2 Pine".into(),
        },
        NDSSection {
            name: "2x10 No.2 Pine".into(),
            reference_fb_mpa: 11.7,
            section_modulus_mm3: 35.9e3,  // S ≈ 21.4 in³
            depth_mm: 241.3,         // 9.5 in
            width_mm: 38.1,
            species: "2x10 No.2 Pine".into(),
        },
        NDSSection {
            name: "2x12 No.2 Pine".into(),
            reference_fb_mpa: 11.0,
            section_modulus_mm3: 52.0e3,  // S ≈ 31.4 in³
            depth_mm: 292.1,         // 11.5 in
            width_mm: 38.1,
            species: "2x12 No.2 Pine".into(),
        },
        NDSSection {
            name: "4x12 No.2 Pine".into(),
            reference_fb_mpa: 10.3,
            section_modulus_mm3: 88.6e3,  // S ≈ 54.0 in³
            depth_mm: 292.1,         // 11.25 in
            width_mm: 88.9,          // 3.5 in
            species: "4x12 No.2 Pine".into(),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nds_load_duration_factors() {
        assert_eq!(get_load_duration_factor("Permanent"), 0.9);
        assert_eq!(get_load_duration_factor("10-Year"), 1.0);
        assert_eq!(get_load_duration_factor("7-Day"), 1.15);
        assert_eq!(get_load_duration_factor("1-Hour"), 1.25);
        assert_eq!(get_load_duration_factor("5-minute"), 1.6);
    }

    #[test]
    fn test_nds_adjusted_bending_value() {
        let section = NDSSection {
            name: "2x8 No.2 Pine".into(),
            reference_fb_mpa: 11.7,
            section_modulus_mm3: 21.4e3,
            depth_mm: 190.5,
            width_mm: 38.1,
            species: "2x8 No.2 Pine".into(),
        };

        let params = NDSDesignParams {
            applied_moment_kNm: 10.0,
            load_duration: "10-Year".to_string(),
            wet_service: false,
            temperature_elevation: 0.0,
            incised: false,
            bearing_length_mm: 50.0,
            member_length_mm: 1200.0,  // 1.2 m unbraced length (more reasonable for timber)
        };

        let capacity = calculate_adjusted_bending_value(&section, &params);

        // 2x8 Pine with 1.2m unbraced length: LSB significantly reduces capacity
        // Base: 11.7 × 21.4e3 / 1e6 = 0.25 kNm
        // With CL = 0.157 (Lu/d=6.3), CF=1.3: design_moment ≈ 0.05 kNm
        assert!(capacity.design_moment_kNm > 0.03 && capacity.design_moment_kNm < 0.08);
        assert!(capacity.adjustment_factor_total > 0.10 && capacity.adjustment_factor_total < 0.30);
    }

    #[test]
    fn test_nds_beam_stability_factor() {
        let cl_good = calculate_beam_stability_factor(1000.0, 190.5);  // Lu/d ≈ 5.2
        let cl_poor = calculate_beam_stability_factor(5000.0, 190.5);  // Lu/d ≈ 26.2
        
        assert!(cl_good > cl_poor);
        assert!(cl_good < 1.0);
    }

    #[test]
    fn test_nds_lateral_bracing() {
        assert!(is_laterally_braced(1000.0, 190.5));    // Lu/d ≈ 5.2
        assert!(!is_laterally_braced(10000.0, 190.5));  // Lu/d ≈ 52.5
    }
}
