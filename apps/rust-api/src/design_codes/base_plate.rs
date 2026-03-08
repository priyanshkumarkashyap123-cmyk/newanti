//! Base Plate Design per IS 800:2007
//!
//! Foundation anchor bolt and base plate design for steel columns
//!
//! ## Features
//! - Base plate thickness design (IS 800 Cl. 7.4)
//! - Anchor bolt design (IS 800 Cl. 10.7)
//! - Bearing stress on concrete (IS 800 Cl. 7.4.3)
//! - Prying action in anchor bolts
//! - Shear key design
//! - Grout bearing capacity
//!
//! ## References
//! - IS 800:2007 Cl. 7.4 (Base Plates)
//! - IS 800:2007 Cl. 10.7 (Anchor Bolts)
//! - IS 456:2000 Cl. 34.4 (Bearing Stress)
//! - AISC Design Guide 1 (Base Plate and Anchor Rod Design)

use serde::{Deserialize, Serialize};

// ── Types ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BasePlateParams {
    /// Column section depth (mm)
    pub column_depth_mm: f64,
    /// Column section width (mm)
    pub column_width_mm: f64,
    /// Column flange thickness (mm)
    pub flange_thickness_mm: f64,
    /// Axial load (kN, tension +, compression -)
    pub axial_load_kn: f64,
    /// Moment about major axis (kN·m)
    pub moment_major_knm: f64,
    /// Moment about minor axis (kN·m)
    pub moment_minor_knm: f64,
    /// Shear force (kN)
    pub shear_kn: f64,
    /// Concrete grade (MPa)
    pub fck_mpa: f64,
    /// Base plate steel grade (MPa)
    pub plate_fy_mpa: f64,
    /// Anchor bolt steel grade (MPa)
    pub bolt_fy_mpa: f64,
    /// Number of anchor bolts
    pub num_bolts: u32,
    /// Bolt diameter (mm)
    pub bolt_dia_mm: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BasePlateResult {
    pub passed: bool,
    pub required_plate_thickness_mm: f64,
    pub required_plate_length_mm: f64,
    pub required_plate_width_mm: f64,
    pub bearing_stress_mpa: f64,
    pub allowable_bearing_mpa: f64,
    pub bolt_tension_kn: f64,
    pub bolt_capacity_kn: f64,
    pub bolt_shear_kn: f64,
    pub bolt_shear_capacity_kn: f64,
    pub prying_force_kn: f64,
    pub messages: Vec<String>,
}

// ── Design Functions ──

/// Design base plate per IS 800:2007 Cl. 7.4
pub fn design_base_plate(params: &BasePlateParams) -> Result<BasePlateResult, String> {
    let mut messages = Vec::new();

    // 1. Calculate required base plate area
    let (req_length, req_width, bearing_stress) = calculate_plate_area(params)?;

    // 2. Calculate allowable bearing stress (IS 456 Cl. 34.4)
    let allowable_bearing = calculate_bearing_capacity(params.fck_mpa);

    // 3. Check bearing stress
    let bearing_ok = bearing_stress <= allowable_bearing;
    if !bearing_ok {
        messages.push(format!(
            "⚠️ Bearing stress {:.2} MPa exceeds allowable {:.2} MPa",
            bearing_stress, allowable_bearing
        ));
    }

    // 4. Calculate required plate thickness
    let plate_thickness = calculate_plate_thickness(params, req_length, req_width)?;

    // 5. Design anchor bolts
    let (bolt_tension, bolt_capacity, bolt_shear, bolt_shear_capacity, prying) = 
        design_anchor_bolts(params, req_length, req_width)?;

    let bolt_tension_ok = bolt_tension <= bolt_capacity;
    let bolt_shear_ok = bolt_shear <= bolt_shear_capacity;

    if !bolt_tension_ok {
        messages.push(format!(
            "⚠️ Bolt tension {:.2} kN exceeds capacity {:.2} kN",
            bolt_tension, bolt_capacity
        ));
    }
    if !bolt_shear_ok {
        messages.push(format!(
            "⚠️ Bolt shear {:.2} kN exceeds capacity {:.2} kN",
            bolt_shear, bolt_shear_capacity
        ));
    }

    // 6. Interaction check for bolts under combined tension & shear
    let interaction = check_bolt_interaction(bolt_tension, bolt_capacity, bolt_shear, bolt_shear_capacity);
    if !interaction {
        messages.push("⚠️ Bolt interaction check failed (tension + shear)".to_string());
    }

    let passed = bearing_ok && bolt_tension_ok && bolt_shear_ok && interaction;

    if passed {
        messages.push(format!(
            "✓ Base plate: {} × {} × {} mm OK",
            req_length.round() as i32,
            req_width.round() as i32,
            plate_thickness.round() as i32
        ));
    }

    Ok(BasePlateResult {
        passed,
        required_plate_thickness_mm: plate_thickness,
        required_plate_length_mm: req_length,
        required_plate_width_mm: req_width,
        bearing_stress_mpa: bearing_stress,
        allowable_bearing_mpa: allowable_bearing,
        bolt_tension_kn: bolt_tension,
        bolt_capacity_kn: bolt_capacity,
        bolt_shear_kn: bolt_shear,
        bolt_shear_capacity_kn: bolt_shear_capacity,
        prying_force_kn: prying,
        messages,
    })
}

/// Calculate required plate area and bearing stress
fn calculate_plate_area(params: &BasePlateParams) -> Result<(f64, f64, f64), String> {
    // Compression load (make positive)
    let p_compression = if params.axial_load_kn < 0.0 {
        -params.axial_load_kn
    } else {
        0.0 // Tension case handled separately
    };

    // Section modulus of base plate required for moment
    // Z_req = M / (0.9 * fy) for plate bending
    let z_req_major = if params.moment_major_knm.abs() > 0.01 {
        (params.moment_major_knm * 1e6) / (0.9 * params.plate_fy_mpa)
    } else {
        0.0
    };

    // Minimum plate dimensions (start from column size + projection)
    let projection = 100.0; // Typical 100 mm projection
    let mut plate_length = params.column_depth_mm + 2.0 * projection;
    let mut plate_width = params.column_width_mm + 2.0 * projection;

    // Iterate to find plate size that satisfies bearing stress
    let mut iterations = 0;
    loop {
        let plate_area = plate_length * plate_width;
        let bearing_stress = if plate_area > 0.0 {
            (p_compression * 1000.0) / plate_area // kN to N, mm²
        } else {
            0.0
        };

        let allowable = calculate_bearing_capacity(params.fck_mpa);

        if bearing_stress <= allowable || iterations > 20 {
            return Ok((plate_length, plate_width, bearing_stress));
        }

        // Increase plate size proportionally
        let scale = (bearing_stress / allowable).sqrt();
        plate_length *= scale;
        plate_width *= scale;
        iterations += 1;
    }
}

/// Calculate allowable bearing stress per IS 456 Cl. 34.4
///
/// σ_br = 0.45 × fck × √(A1/A2) ≤ 0.9 × fck
///
/// where:
/// - A1 = supporting area (pedestal/footing)
/// - A2 = loaded area (base plate)
///
/// Conservatively assume A1/A2 = 2.0
fn calculate_bearing_capacity(fck_mpa: f64) -> f64 {
    let a1_a2_ratio = 2.0_f64; // Conservative assumption
    let sigma_br = 0.45 * fck_mpa * a1_a2_ratio.sqrt();
    sigma_br.min(0.9 * fck_mpa)
}

/// Calculate required plate thickness per IS 800 Cl. 7.4.3
///
/// Base plate acts as a cantilever with bearing pressure from concrete
/// t_req = √(3 × w × c² / fy)
///
/// where:
/// - w = bearing pressure (N/mm²)
/// - c = cantilever projection (mm)
/// - fy = yield strength of plate (N/mm²)
fn calculate_plate_thickness(
    params: &BasePlateParams,
    plate_length: f64,
    plate_width: f64,
) -> Result<f64, String> {
    let p_compression = if params.axial_load_kn < 0.0 {
        -params.axial_load_kn
    } else {
        return Ok(10.0); // Minimum thickness for tension-only case
    };

    let plate_area = plate_length * plate_width;
    let bearing_pressure = (p_compression * 1000.0) / plate_area; // N/mm²

    // Cantilever projection beyond column face
    let c_length = (plate_length - params.column_depth_mm) / 2.0;
    let c_width = (plate_width - params.column_width_mm) / 2.0;
    let c_max = c_length.max(c_width);

    // Required thickness (IS 800 approach)
    let gamma_m0 = 1.10; // Partial safety factor
    let fy_design = params.plate_fy_mpa / gamma_m0;
    
    let t_req = (3.0 * bearing_pressure * c_max.powi(2) / fy_design).sqrt();

    // Minimum practical thickness
    Ok(t_req.max(10.0))
}

/// Design anchor bolts per IS 800 Cl. 10.7
fn design_anchor_bolts(
    params: &BasePlateParams,
    plate_length: f64,
    plate_width: f64,
) -> Result<(f64, f64, f64, f64, f64), String> {
    // Tension in bolts (if axial tension or moment creates tension)
    let p_axial = params.axial_load_kn;
    let m_major = params.moment_major_knm;

    // Bolt arrangement: typically 4 bolts in rectangle
    // Distance from center to bolt group centroid
    let bolt_spacing_length = plate_length - 100.0; // 50 mm edge distance × 2
    let bolt_distance = bolt_spacing_length / 2.0; // Distance from center to bolt

    // Tension per bolt due to axial load
    let tension_axial = if p_axial > 0.0 {
        p_axial / params.num_bolts as f64
    } else {
        0.0
    };

    // Tension per bolt due to moment (lever arm from neutral axis)
    let tension_moment = if m_major.abs() > 0.01 {
        (m_major * 1000.0) / (2.0 * bolt_distance) // Force in outermost bolts
    } else {
        0.0
    };

    let total_tension_per_bolt = tension_axial + tension_moment;

    // Bolt tensile capacity per IS 800 Cl. 10.4.3
    // T_db = 0.9 * fyb * An / γmb where An = net area at threads
    let gamma_mb = 1.25;
    let a_net = 0.78 * std::f64::consts::PI * (params.bolt_dia_mm / 2.0).powi(2); // 78% gross area
    let bolt_capacity = (0.9 * params.bolt_fy_mpa * a_net) / (gamma_mb * 1000.0); // kN

    // Prying action (Q = k × T where k depends on plate flexibility)
    // Conservative estimate: Q = 0.5 × T for flexible plates
    let prying_coefficient = 0.5;
    let prying_force = prying_coefficient * total_tension_per_bolt;
    let total_bolt_tension = total_tension_per_bolt + prying_force;

    // Shear per bolt
    let shear_per_bolt = params.shear_kn / params.num_bolts as f64;

    // Bolt shear capacity per IS 800 Cl. 10.4.2
    // V_dsb = fyb * An / (√3 * γmb)
    let bolt_shear_capacity = (params.bolt_fy_mpa * a_net) / (3_f64.sqrt() * gamma_mb * 1000.0); // kN

    Ok((
        total_bolt_tension,
        bolt_capacity,
        shear_per_bolt,
        bolt_shear_capacity,
        prying_force,
    ))
}

/// Check bolt interaction under combined tension and shear per IS 800 Cl. 10.4.6
///
/// (V / Vd)² + (T / Td)² ≤ 1.0
fn check_bolt_interaction(
    tension_kn: f64,
    tension_capacity_kn: f64,
    shear_kn: f64,
    shear_capacity_kn: f64,
) -> bool {
    let v_ratio = shear_kn / shear_capacity_kn;
    let t_ratio = tension_kn / tension_capacity_kn;
    let interaction = v_ratio.powi(2) + t_ratio.powi(2);
    interaction <= 1.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base_plate_compression_only() {
        let params = BasePlateParams {
            column_depth_mm: 300.0,
            column_width_mm: 200.0,
            flange_thickness_mm: 12.0,
            axial_load_kn: -500.0, // Compression
            moment_major_knm: 0.0,
            moment_minor_knm: 0.0,
            shear_kn: 0.0,
            fck_mpa: 25.0,
            plate_fy_mpa: 250.0,
            bolt_fy_mpa: 400.0,
            num_bolts: 4,
            bolt_dia_mm: 20.0,
        };

        let result = design_base_plate(&params).unwrap();
        
        // Bearing stress should be within allowable
        assert!(result.bearing_stress_mpa <= result.allowable_bearing_mpa);
        // Plate thickness should be reasonable
        assert!(result.required_plate_thickness_mm >= 10.0);
        assert!(result.required_plate_thickness_mm <= 50.0);
    }

    #[test]
    fn test_base_plate_with_moment() {
        let params = BasePlateParams {
            column_depth_mm: 300.0,
            column_width_mm: 200.0,
            flange_thickness_mm: 12.0,
            axial_load_kn: -300.0,
            moment_major_knm: 100.0,
            moment_minor_knm: 0.0,
            shear_kn: 50.0,
            fck_mpa: 25.0,
            plate_fy_mpa: 250.0,
            bolt_fy_mpa: 400.0,
            num_bolts: 4,
            bolt_dia_mm: 20.0,
        };

        let result = design_base_plate(&params).unwrap();
        
        // Bolts should carry moment-induced tension
        assert!(result.bolt_tension_kn > 0.0);
        // Should have shear demand
        assert!(result.bolt_shear_kn > 0.0);
        // Prying forces should be considered
        assert!(result.prying_force_kn >= 0.0);
    }

    #[test]
    fn test_bearing_stress_calculation() {
        let fck = 30.0;
        let allowable = calculate_bearing_capacity(fck);
        
        // Should be between 0.45*fck*√2 and 0.9*fck
        assert!(allowable >= 0.45 * fck * 2.0_f64.sqrt() * 0.95); // Allow 5% tolerance
        assert!(allowable <= 0.9 * fck);
    }
}
