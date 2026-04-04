#![allow(non_snake_case)]

/// NDS 2018 (US Timber Design Standard)
/// Load and Resistance Factor Design (LRFD) with adjustment factors
///
/// References:
/// - NDS 2018: National Design Specification for Wood Construction
/// - Adjusted bending design value with cascade of modification factors
use serde::{Deserialize, Serialize};

/// NDS 2018 version selector for draft toggles
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum NDSVersion {
    /// NDS 2018 (production)
    V2018,
    /// Draft NDS 2025 (sandbox)
    V2025Sandbox,
}

/// Sandbox warning for NDS 2025
pub const DRAFT_WARNING_NDS_2025: &str =
    "DRAFT — NDS 2025 provisions are in sandbox mode and non-enforceable.";

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
    pub reference_fb_mpa: f64,    // Reference bending value
    pub section_modulus_mm3: f64, // Elastic section modulus S
    pub depth_mm: f64,            // Member depth
    pub width_mm: f64,            // Member width
    pub species: String,          // Species/grade (e.g., "2x8 No.2 Pine")
}

/// NDS design parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NDSDesignParams {
    pub applied_moment_kNm: f64,    // Design moment
    pub load_duration: String,      // "Permanent", "10-Year", "7-Day", "1-Hour", "5-minute"
    pub wet_service: bool,          // Is member in wet environment?
    pub temperature_elevation: f64, // Temperature elevation above 68°F (°F)
    pub incised: bool,              // Are members incised?
    pub bearing_length_mm: f64,     // For lateral stability check
    pub member_length_mm: f64,      // For beam stability (Lu)
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
    if is_wet {
        0.85
    } else {
        1.0
    }
}

/// Temperature factor (Ct)
fn get_temperature_factor(elevation_f: f64) -> f64 {
    if elevation_f <= 0.0 {
        1.0
    } else if elevation_f >= 203.0 {
        // 203°F ≈ 95°C
        0.1 // Severe loss of properties
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
    let _width_in = width_mm / 25.4;

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
    if incised {
        0.9
    } else {
        1.0
    }
}

/// Repetitive member factor (Cr)
fn get_repetitive_member_factor(is_repetitive: bool) -> f64 {
    if is_repetitive {
        1.15
    } else {
        1.0
    }
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
    let design_moment = fb_adjusted * section.section_modulus_mm3 / 1e6; // kNm

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

/// Version-aware adjusted bending value per NDS
pub fn calculate_adjusted_bending_value_with_version(
    section: &NDSSection,
    params: &NDSDesignParams,
    version: NDSVersion,
) -> NDSCapacity {
    let cap = calculate_adjusted_bending_value(section, params);
    if matches!(version, NDSVersion::V2025Sandbox) {
        eprintln!("{}", DRAFT_WARNING_NDS_2025);
    }
    cap
}

/// Check if timber capacity is adequate
pub fn is_adequate(capacity: &NDSCapacity) -> bool {
    capacity.utilization_ratio <= 1.0 && capacity.adjusted_bending_value_mpa > 0.0
}

/// Version-aware adequacy check per NDS
pub fn is_adequate_with_version(
    capacity: &NDSCapacity,
    version: NDSVersion,
) -> bool {
    let ok = is_adequate(capacity);
    if matches!(version, NDSVersion::V2025Sandbox) {
        eprintln!("{}", DRAFT_WARNING_NDS_2025);
    }
    ok
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

/// Version-aware lateral bracing check per NDS
pub fn is_laterally_braced_with_version(
    lu_mm: f64,
    d_mm: f64,
    version: NDSVersion,
) -> bool {
    let ok = is_laterally_braced(lu_mm, d_mm);
    if matches!(version, NDSVersion::V2025Sandbox) {
        eprintln!("{}", DRAFT_WARNING_NDS_2025);
    }
    ok
}

/// Database of common NDS lumber grades and sizes
pub fn nds_lumber_sections() -> Vec<NDSSection> {
    vec![
        NDSSection {
            name: "2x8 No.2 Pine".into(),
            reference_fb_mpa: 11.7,      // 1700 psi ≈ 11.7 MPa
            section_modulus_mm3: 21.4e3, // S ≈ 13.1 in³ ≈ 21.4e3 mm³
            depth_mm: 190.5,             // 7.5 in
            width_mm: 38.1,              // 1.5 in
            species: "2x8 No.2 Pine".into(),
        },
        NDSSection {
            name: "2x10 No.2 Pine".into(),
            reference_fb_mpa: 11.7,
            section_modulus_mm3: 35.9e3, // S ≈ 21.4 in³
            depth_mm: 241.3,             // 9.5 in
            width_mm: 38.1,
            species: "2x10 No.2 Pine".into(),
        },
        NDSSection {
            name: "2x12 No.2 Pine".into(),
            reference_fb_mpa: 11.0,
            section_modulus_mm3: 52.0e3, // S ≈ 31.4 in³
            depth_mm: 292.1,             // 11.5 in
            width_mm: 38.1,
            species: "2x12 No.2 Pine".into(),
        },
        NDSSection {
            name: "4x12 No.2 Pine".into(),
            reference_fb_mpa: 10.3,
            section_modulus_mm3: 88.6e3, // S ≈ 54.0 in³
            depth_mm: 292.1,             // 11.25 in
            width_mm: 88.9,              // 3.5 in
            species: "4x12 No.2 Pine".into(),
        },
    ]
}

/// Version-aware lumber section database per NDS
pub fn nds_lumber_sections_with_version(version: NDSVersion) -> Vec<NDSSection> {
    let secs = nds_lumber_sections();
    if matches!(version, NDSVersion::V2025Sandbox) {
        eprintln!("{}", DRAFT_WARNING_NDS_2025);
    }
    secs
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
            member_length_mm: 1200.0, // 1.2 m unbraced length (more reasonable for timber)
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
        let cl_good = calculate_beam_stability_factor(1000.0, 190.5); // Lu/d ≈ 5.2
        let cl_poor = calculate_beam_stability_factor(5000.0, 190.5); // Lu/d ≈ 26.2

        assert!(cl_good > cl_poor);
        assert!(cl_good < 1.0);
    }

    #[test]
    fn test_nds_lateral_bracing() {
        assert!(is_laterally_braced(1000.0, 190.5)); // Lu/d ≈ 5.2
        assert!(!is_laterally_braced(10000.0, 190.5)); // Lu/d ≈ 52.5
    }
}

// ── Fire Resistance (NDS Chapter 16) ──

/// Fire design calculation result per NDS 2018 Chapter 16
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FireResistanceResult {
    pub char_rate_mm_min: f64,
    pub exposure_time_min: f64,
    pub char_depth_mm: f64,
    pub effective_depth_mm: f64,
    pub original_depth_mm: f64,
    pub residual_capacity_ratio: f64,
    pub passed: bool,
    pub message: String,
}

/// Calculate fire resistance per NDS 2018 Cl. 16.2
///
/// Nominal charring rate βn:
/// - Exposed wood members (3+ sides exposed): βn = 1.5 in/hr = 0.635 mm/min
/// - Protected members (1-2 sides exposed): βn = 1.2 in/hr = 0.508 mm/min
/// - For fire resistance calculation:
///   - Char depth = βn × t (exposure time)
///   - Effective depth = Original depth - char depth - additional layer (7mm)
///   - Residual capacity = (d_eff / d_original)³ for bending
///
/// # Arguments
/// * `original_depth_mm` - Original member depth (mm)
/// * `exposure_time_min` - Fire exposure time (minutes)
/// * `exposure_type` - "exposed" or "protected"
///
/// # Returns
/// Fire resistance result
pub fn calculate_fire_resistance(
    original_depth_mm: f64,
    exposure_time_min: f64,
    exposure_type: &str,
) -> FireResistanceResult {
    // Charring rate per NDS 2018 Cl. 16.2.2
    let char_rate = match exposure_type {
        "exposed" => 0.635,   // 1.5 in/hr
        "protected" => 0.508, // 1.2 in/hr
        _ => 0.635,
    };

    let char_depth = char_rate * exposure_time_min;

    // NDS 2018 Cl. 16.2.3: Additional layer of 7mm assumed damaged
    let additional_layer = 7.0;
    let total_reduction = char_depth + additional_layer;

    let effective_depth = (original_depth_mm - total_reduction).max(0.0);

    // Residual capacity ratio assuming bending (proportional to d³)
    let residual_ratio = if original_depth_mm > 0.0 {
        (effective_depth / original_depth_mm).powi(3)
    } else {
        0.0
    };

    let passed = residual_ratio >= 0.5; // Minimum 50% residual capacity typical requirement

    FireResistanceResult {
        char_rate_mm_min: char_rate,
        exposure_time_min,
        char_depth_mm: char_depth,
        effective_depth_mm: effective_depth,
        original_depth_mm,
        residual_capacity_ratio: residual_ratio,
        passed,
        message: format!(
            "Fire resistance: d_eff = {:.1} mm (d_0 = {:.1} mm - char {:.1} mm - layer 7 mm), Residual capacity = {:.1}% → {}",
            effective_depth, original_depth_mm, char_depth, residual_ratio * 100.0,
            if passed { "ADEQUATE" } else { "INADEQUATE" }
        ),
    }
}

// ── Seismic Design (NDS Chapter 4 + ASCE 7) ──

/// Seismic design parameters for timber structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeismicDesignParams {
    pub sds: f64,                        // Design spectral acceleration (short period)
    pub sd1: f64,                        // Design spectral acceleration (1-second period)
    pub seismic_design_category: String, // "A", "B", "C", "D", "E", or "F"
    pub response_modification_r: f64,    // R factor (varies by system type)
    pub importance_factor: f64,          // Ie (typically 1.0, 1.25, or 1.5)
}

/// Seismic design result for timber members
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeismicDesignResult {
    pub seismic_load_factor: f64,
    pub adjusted_capacity_knm: f64,
    pub seismic_demand_knm: f64,
    pub utilization_ratio: f64,
    pub connection_overstrength: f64,
    pub passed: bool,
    pub message: String,
}

/// Calculate seismic design capacity per NDS 2018 Cl. 4.3
///
/// For seismic loading, load duration factor CD = 1.6 (5-minute loading)
/// Connection capacity must account for overstrength factor Ω₀
///
/// # Arguments
/// * `base_capacity_knm` - Base moment capacity (kN·m)
/// * `seismic_demand_knm` - Seismic demand moment (kN·m)
/// * `params` - Seismic design parameters
///
/// # Returns
/// Seismic design result
pub fn calculate_seismic_capacity(
    base_capacity_knm: f64,
    seismic_demand_knm: f64,
    _params: &SeismicDesignParams,
) -> SeismicDesignResult {
    // CD = 1.6 for seismic (5-minute loading) per NDS Table 2.3.2
    let cd_seismic = 1.6;

    // Adjusted capacity for seismic loading
    let adjusted_capacity = base_capacity_knm * cd_seismic;

    // Utilization ratio
    let utilization = seismic_demand_knm / adjusted_capacity.max(0.001);

    // Overstrength factor for connections (ASCE 7 Cl. 12.4.3)
    // Light-frame wood shear walls: Ω₀ = 3.0
    // Special reinforced masonry shear walls: Ω₀ = 2.5
    let overstrength = 3.0;

    let passed = utilization <= 1.0;

    SeismicDesignResult {
        seismic_load_factor: cd_seismic,
        adjusted_capacity_knm: adjusted_capacity,
        seismic_demand_knm,
        utilization_ratio: utilization,
        connection_overstrength: overstrength,
        passed,
        message: format!(
            "Seismic design: M'_seismic = {:.2} kN·m (CD = {:.1}), Demand = {:.2} kN·m, Util = {:.2} → {}",
            adjusted_capacity, cd_seismic, seismic_demand_knm, utilization,
            if passed { "OK" } else { "FAIL" }
        ),
    }
}

#[cfg(test)]
mod tests_fire_seismic {
    use super::*;

    #[test]
    fn test_fire_resistance_exposed() {
        // 292mm deep 2x12, 60 min exposure, exposed on 3+ sides
        let result = calculate_fire_resistance(292.1, 60.0, "exposed");

        // Char depth = 0.635 mm/min × 60 min = 38.1 mm
        // Effective depth = 292.1 - 38.1 - 7 = 247 mm
        assert!((result.char_depth_mm - 38.1).abs() < 0.1);
        assert!((result.effective_depth_mm - 247.0).abs() < 1.0);
        assert!(result.residual_capacity_ratio > 0.5);
        assert!(result.passed);
    }

    #[test]
    fn test_fire_resistance_protected() {
        // 190mm deep 2x8, 90 min exposure, protected
        let result = calculate_fire_resistance(190.5, 90.0, "protected");

        // Char depth = 0.508 mm/min × 90 min = 45.7 mm
        // Effective depth = 190.5 - 45.7 - 7 = 137.8 mm
        assert!((result.char_depth_mm - 45.7).abs() < 0.2);
        assert!((result.effective_depth_mm - 137.8).abs() < 1.0);
    }

    #[test]
    fn test_seismic_capacity() {
        let params = SeismicDesignParams {
            sds: 0.8,
            sd1: 0.4,
            seismic_design_category: "D".to_string(),
            response_modification_r: 6.5,
            importance_factor: 1.0,
        };

        // Base capacity 50 kN·m, seismic demand 70 kN·m
        let result = calculate_seismic_capacity(50.0, 70.0, &params);

        // Adjusted capacity = 50 × 1.6 = 80 kN·m
        assert_eq!(result.seismic_load_factor, 1.6);
        assert_eq!(result.adjusted_capacity_knm, 80.0);
        assert!((result.utilization_ratio - 0.875).abs() < 0.01);
        assert!(result.passed);
    }

    #[test]
    fn test_seismic_failure() {
        let params = SeismicDesignParams {
            sds: 1.2,
            sd1: 0.6,
            seismic_design_category: "E".to_string(),
            response_modification_r: 6.5,
            importance_factor: 1.25,
        };

        // Base capacity 30 kN·m, seismic demand 60 kN·m
        let result = calculate_seismic_capacity(30.0, 60.0, &params);

        // Adjusted capacity = 30 × 1.6 = 48 kN·m < 60 kN·m
        assert_eq!(result.adjusted_capacity_knm, 48.0);
        assert!(result.utilization_ratio > 1.0);
        assert!(!result.passed);
    }
}

#[cfg(test)]
mod version_tests {
    use super::*;

    #[test]
    fn test_calculate_adjusted_bending_value_with_version() {
        let section = NDSSection {
            name: "2x8 Pine".into(),
            reference_fb_mpa: 11.7,
            section_modulus_mm3: 21.4e3,
            depth_mm: 190.5,
            width_mm: 38.1,
            species: "Pine".into(),
        };
        let params = NDSDesignParams {
            applied_moment_kNm: 5.0,
            load_duration: "7-Day".into(),
            wet_service: false,
            temperature_elevation: 0.0,
            incised: false,
            bearing_length_mm: 0.0,
            member_length_mm: 2000.0,
        };
        let base = calculate_adjusted_bending_value(&section, &params);
        let v = calculate_adjusted_bending_value_with_version(&section, &params, NDSVersion::V2025Sandbox);
        assert_eq!(base.adjusted_bending_value_mpa, v.adjusted_bending_value_mpa);
    }

    #[test]
    fn test_is_adequate_with_version() {
        let cap = NDSCapacity {
            reference_bending_value_mpa: 11.7,
            adjusted_bending_value_mpa: 10.0,
            adjusted_section_modulus_mm3: 21.4e3,
            design_moment_kNm: 10.0,
            utilization_ratio: 0.5,
            adjustment_factor_total: 1.0,
        };
        assert!(is_adequate_with_version(&cap, NDSVersion::V2025Sandbox));
    }

    #[test]
    fn test_is_laterally_braced_with_version() {
        let ok = is_laterally_braced_with_version(1000.0, 200.0, NDSVersion::V2025Sandbox);
        assert!(ok);
    }

    #[test]
    fn test_nds_lumber_sections_with_version() {
        let secs = nds_lumber_sections();
        let vsecs = nds_lumber_sections_with_version(NDSVersion::V2025Sandbox);
        assert_eq!(secs.len(), vsecs.len());
    }
}
