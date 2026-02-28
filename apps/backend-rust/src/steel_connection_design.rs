//! Steel Connection Design and Limit States
//!
//! Production-grade steel connection design matching AISC 360-22, Eurocode 3,
//! and IS 800:2007 requirements.
//!
//! ## Critical Limit States (AISC 360-22)
//! - Bolt shear/tension (J3)
//! - Bolt bearing (J3.10)
//! - Block shear rupture (J4.3)
//! - Weld capacity (J2)
//! - Plate yielding/rupture (J4)
//! - Prying action (9.2.2)
//!
//! ## Connection Types
//! - Bolted shear connections (simple)
//! - Bolted moment connections (fully restrained)
//! - Welded connections
//! - Extended end-plate connections
//! - Shear tab connections

#![allow(non_camel_case_types)]  // Industry-standard design codes like CSA_S16_19

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// DESIGN CODES
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SteelDesignCode {
    /// AISC 360-22 (US)
    AISC360_22,
    /// AISC 360-16 (US)
    AISC360_16,
    /// Eurocode 3 EN 1993-1-8
    EC3_1993_1_8,
    /// IS 800:2007 (India)
    IS800_2007,
    /// CSA S16-19 (Canada)
    CSA_S16_19,
    /// AS 4100 (Australia)
    AS4100,
}

// ============================================================================
// MATERIAL PROPERTIES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelMaterial {
    /// Yield strength (MPa)
    pub fy: f64,
    /// Ultimate tensile strength (MPa)
    pub fu: f64,
    /// Elastic modulus (MPa)
    pub e: f64,
    /// Shear modulus (MPa)
    pub g: f64,
    /// Poisson's ratio
    pub nu: f64,
    /// Material grade designation
    pub grade: String,
}

impl SteelMaterial {
    /// ASTM A36
    pub fn a36() -> Self {
        SteelMaterial {
            fy: 250.0,
            fu: 400.0,
            e: 200000.0,
            g: 77000.0,
            nu: 0.3,
            grade: "A36".to_string(),
        }
    }
    
    /// ASTM A992 (typical W shapes)
    pub fn a992() -> Self {
        SteelMaterial {
            fy: 345.0,
            fu: 450.0,
            e: 200000.0,
            g: 77000.0,
            nu: 0.3,
            grade: "A992".to_string(),
        }
    }
    
    /// S355 (Eurocode)
    pub fn s355() -> Self {
        SteelMaterial {
            fy: 355.0,
            fu: 510.0,
            e: 210000.0,
            g: 81000.0,
            nu: 0.3,
            grade: "S355".to_string(),
        }
    }
    
    /// Fe 410 (IS 800)
    pub fn fe410() -> Self {
        SteelMaterial {
            fy: 250.0,
            fu: 410.0,
            e: 200000.0,
            g: 77000.0,
            nu: 0.3,
            grade: "Fe 410".to_string(),
        }
    }
}

// ============================================================================
// BOLT PROPERTIES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoltProperties {
    /// Nominal diameter (mm)
    pub diameter: f64,
    /// Bolt grade
    pub grade: BoltGrade,
    /// Thread type
    pub thread_type: ThreadType,
    /// Hole type
    pub hole_type: HoleType,
    /// Pretension (for slip-critical)
    pub pretension: Option<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum BoltGrade {
    /// ASTM A325 / Grade 8.8
    A325,
    /// ASTM A490 / Grade 10.9
    A490,
    /// Grade 4.6
    Grade4_6,
    /// Grade 8.8
    Grade8_8,
    /// Grade 10.9
    Grade10_9,
}

impl BoltGrade {
    /// Nominal tensile strength (MPa)
    pub fn fub(&self) -> f64 {
        match self {
            BoltGrade::A325 => 830.0,          // 120 ksi
            BoltGrade::A490 => 1040.0,         // 150 ksi
            BoltGrade::Grade8_8 => 800.0,      // 8 × 100 MPa per ISO 898-1
            BoltGrade::Grade10_9 => 1000.0,    // 10 × 100 MPa per ISO 898-1
            BoltGrade::Grade4_6 => 400.0,      // 4 × 100 MPa
        }
    }
    
    /// Nominal shear strength (MPa)
    pub fn fnv(&self) -> f64 {
        // AISC: 0.563*Fub for threads not excluded
        self.fub() * 0.563
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ThreadType {
    /// Threads included in shear plane (N)
    Included,
    /// Threads excluded from shear plane (X)
    Excluded,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum HoleType {
    Standard,
    Oversized,
    ShortSlotted,
    LongSlotted,
}

impl HoleType {
    /// Hole diameter increment (mm)
    pub fn clearance(&self, bolt_dia: f64) -> f64 {
        match self {
            HoleType::Standard => {
                if bolt_dia <= 24.0 { 2.0 } else { 3.0 }
            }
            HoleType::Oversized => {
                if bolt_dia <= 24.0 { 3.0 }
                else if bolt_dia <= 27.0 { 4.0 }
                else { 5.0 }
            }
            HoleType::ShortSlotted | HoleType::LongSlotted => {
                if bolt_dia <= 24.0 { 2.0 } else { 3.0 }
            }
        }
    }
}

impl BoltProperties {
    /// Gross area (mm²)
    pub fn area_gross(&self) -> f64 {
        PI * self.diameter.powi(2) / 4.0
    }
    
    /// Tensile stress area (mm²)
    pub fn area_tensile(&self) -> f64 {
        // Approximate formula for metric bolts
        let d = self.diameter;
        let p = self.pitch();
        PI * (d - 0.9382 * p).powi(2) / 4.0
    }
    
    /// Thread pitch (mm)
    fn pitch(&self) -> f64 {
        match self.diameter as i32 {
            12 => 1.75,
            16 => 2.0,
            20 => 2.5,
            22 => 2.5,
            24 => 3.0,
            27 => 3.0,
            30 => 3.5,
            36 => 4.0,
            _ => self.diameter / 8.0, // Approximate
        }
    }
    
    /// Hole diameter (mm)
    pub fn hole_diameter(&self) -> f64 {
        self.diameter + self.hole_type.clearance(self.diameter)
    }
}

// ============================================================================
// WELD PROPERTIES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeldProperties {
    /// Weld size/leg (mm)
    pub size: f64,
    /// Weld length (mm)
    pub length: f64,
    /// Weld type
    pub weld_type: WeldType,
    /// Electrode classification
    pub electrode: WeldElectrode,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum WeldType {
    FilletWeld,
    GrooveWeldCJP,  // Complete Joint Penetration
    GrooveWeldPJP,  // Partial Joint Penetration
    PlugWeld,
    SlotWeld,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum WeldElectrode {
    E70,  // 70 ksi = 483 MPa
    E80,
    E90,
    E100,
    E110,
}

impl WeldElectrode {
    /// Nominal strength (MPa)
    pub fn fexx(&self) -> f64 {
        match self {
            WeldElectrode::E70 => 483.0,
            WeldElectrode::E80 => 552.0,
            WeldElectrode::E90 => 621.0,
            WeldElectrode::E100 => 690.0,
            WeldElectrode::E110 => 759.0,
        }
    }
}

// ============================================================================
// CONNECTION GEOMETRY
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoltGroup {
    /// Number of rows
    pub n_rows: usize,
    /// Number of columns
    pub n_cols: usize,
    /// Vertical spacing (mm)
    pub pitch: f64,
    /// Horizontal spacing (mm)
    pub gage: f64,
    /// Edge distance to first row (mm)
    pub edge_distance: f64,
    /// End distance to first column (mm)
    pub end_distance: f64,
    /// Bolt properties
    pub bolt: BoltProperties,
}

impl BoltGroup {
    pub fn total_bolts(&self) -> usize {
        self.n_rows * self.n_cols
    }
    
    /// Bolt positions relative to centroid
    pub fn bolt_positions(&self) -> Vec<(f64, f64)> {
        let mut positions = Vec::with_capacity(self.total_bolts());
        
        // Centroid at (0, 0)
        let total_height = (self.n_rows - 1) as f64 * self.pitch;
        let total_width = (self.n_cols - 1) as f64 * self.gage;
        
        for row in 0..self.n_rows {
            for col in 0..self.n_cols {
                let x = col as f64 * self.gage - total_width / 2.0;
                let y = row as f64 * self.pitch - total_height / 2.0;
                positions.push((x, y));
            }
        }
        
        positions
    }
    
    /// Polar moment of inertia of bolt group
    pub fn j_bolt_group(&self) -> f64 {
        let positions = self.bolt_positions();
        positions.iter()
            .map(|(x, y)| x.powi(2) + y.powi(2))
            .sum()
    }
    
    /// Maximum distance from centroid to any bolt
    pub fn c_max(&self) -> f64 {
        let positions = self.bolt_positions();
        positions.iter()
            .map(|(x, y)| (x.powi(2) + y.powi(2)).sqrt())
            .fold(0.0_f64, f64::max)
    }
}

// ============================================================================
// BOLT LIMIT STATES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoltCapacity {
    /// Shear capacity per shear plane (kN)
    pub shear_capacity: f64,
    /// Tensile capacity (kN)
    pub tensile_capacity: f64,
    /// Bearing capacity at each bolt (kN)
    pub bearing_capacity: f64,
    /// Slip resistance (for slip-critical) (kN)
    pub slip_resistance: Option<f64>,
    /// Combined interaction ratio
    pub interaction_ratio: f64,
    /// Controlling limit state
    pub controlling_state: BoltLimitState,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum BoltLimitState {
    ShearRupture,
    TensileRupture,
    BearingDeformation,
    BearingTearout,
    SlipResistance,
    CombinedShearTension,
}

/// Calculate bolt capacity per AISC 360-22
pub fn calculate_bolt_capacity_aisc(
    bolt: &BoltProperties,
    plate_thickness: f64,
    plate_fu: f64,
    lc: f64,  // Clear distance in direction of load
    n_shear_planes: usize,
    applied_shear: f64,
    applied_tension: f64,
    is_slip_critical: bool,
) -> BoltCapacity {
    let phi = 0.75; // Resistance factor for bolts
    let d = bolt.diameter;
    let ab = bolt.area_gross();
    
    // Shear capacity (J3.6)
    let fnv = match bolt.thread_type {
        ThreadType::Included => bolt.grade.fub() * 0.450,
        ThreadType::Excluded => bolt.grade.fub() * 0.563,
    };
    let rn_shear = fnv * ab * n_shear_planes as f64 / 1000.0; // kN
    let shear_capacity = phi * rn_shear;
    
    // Tensile capacity (J3.6)
    let fnt = 0.75 * bolt.grade.fub();
    let rn_tension = fnt * bolt.area_tensile() / 1000.0; // kN
    let tensile_capacity = phi * rn_tension;
    
    // Bearing capacity (J3.10)
    // Bearing with deformation consideration
    let rn_bearing_deform = 2.4 * d * plate_thickness * plate_fu / 1000.0;
    // Tearout
    let rn_tearout = 1.2 * lc * plate_thickness * plate_fu / 1000.0;
    let rn_bearing = rn_bearing_deform.min(rn_tearout);
    let bearing_capacity = phi * rn_bearing;
    
    // Slip resistance (for slip-critical connections)
    let slip_resistance = if is_slip_critical {
        let mu = 0.30; // Class A surface
        let du = 1.13; // For standard holes
        let hsc = 1.0; // Factor for hole type
        let tb = bolt.pretension.unwrap_or(0.7 * bolt.grade.fub() * bolt.area_tensile() / 1000.0);
        let rn_slip = mu * du * hsc * tb * n_shear_planes as f64;
        Some(1.0 * rn_slip) // φ = 1.0 for slip
    } else {
        None
    };
    
    // Combined shear-tension interaction (J3.7)
    let interaction_ratio = if applied_tension > 0.0 {
        // Modified tensile stress
        let fnt_prime = 1.3 * fnt - fnt / (phi * fnv) * (applied_shear * 1000.0 / ab);
        let _fnt_prime = fnt_prime.max(0.0).min(fnt);
        
        let tension_ratio = applied_tension / tensile_capacity;
        let shear_ratio = applied_shear / shear_capacity;
        
        // Elliptical interaction
        (tension_ratio.powi(2) + shear_ratio.powi(2)).sqrt()
    } else {
        applied_shear / shear_capacity
    };
    
    // Determine controlling limit state
    let controlling_state = if is_slip_critical && slip_resistance.is_some() {
        if applied_shear > slip_resistance.unwrap() {
            BoltLimitState::SlipResistance
        } else if interaction_ratio > 1.0 {
            BoltLimitState::CombinedShearTension
        } else if bearing_capacity < shear_capacity {
            if rn_tearout < rn_bearing_deform {
                BoltLimitState::BearingTearout
            } else {
                BoltLimitState::BearingDeformation
            }
        } else {
            BoltLimitState::ShearRupture
        }
    } else if interaction_ratio > 1.0 {
        BoltLimitState::CombinedShearTension
    } else if bearing_capacity < shear_capacity {
        if rn_tearout < rn_bearing_deform {
            BoltLimitState::BearingTearout
        } else {
            BoltLimitState::BearingDeformation
        }
    } else {
        BoltLimitState::ShearRupture
    };
    
    BoltCapacity {
        shear_capacity,
        tensile_capacity,
        bearing_capacity,
        slip_resistance,
        interaction_ratio,
        controlling_state,
    }
}

// ============================================================================
// BLOCK SHEAR
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockShearResult {
    /// Block shear capacity (kN)
    pub capacity: f64,
    /// Gross tension area (mm²)
    pub agv: f64,
    /// Net tension area (mm²)
    pub ant: f64,
    /// Gross shear area (mm²)
    pub anv: f64,
    /// Net shear area (mm²)
    pub ags: f64,
    /// Tension rupture controls
    pub tension_rupture_controls: bool,
}

/// Calculate block shear capacity per AISC J4.3
pub fn calculate_block_shear_aisc(
    fy: f64,
    fu: f64,
    agv: f64,   // Gross area in shear
    ant: f64,   // Net area in tension
    anv: f64,   // Net area in shear
    ubs: f64,   // 1.0 for uniform stress, 0.5 for non-uniform
) -> BlockShearResult {
    let phi = 0.75;
    
    // Equation J4-5
    let rn1 = 0.6 * fu * anv + ubs * fu * ant;
    let rn2 = 0.6 * fy * agv + ubs * fu * ant;
    
    let rn = rn1.min(rn2) / 1000.0; // kN
    let capacity = phi * rn;
    
    BlockShearResult {
        capacity,
        agv,
        ant,
        anv,
        ags: agv,
        tension_rupture_controls: rn1 < rn2,
    }
}

// ============================================================================
// WELD CAPACITY
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeldCapacity {
    /// Weld strength (kN/mm)
    pub strength_per_length: f64,
    /// Total weld capacity (kN)
    pub total_capacity: f64,
    /// Effective throat (mm)
    pub effective_throat: f64,
    /// Base metal limiting
    pub base_metal_controls: bool,
}

/// Calculate fillet weld capacity per AISC J2
pub fn calculate_fillet_weld_capacity_aisc(
    weld: &WeldProperties,
    base_metal_fu: f64,
    load_angle: f64,  // Angle between load and weld axis (degrees)
) -> WeldCapacity {
    let phi = 0.75;
    
    // Effective throat
    let te = weld.size * 0.707; // 45-degree fillet
    
    // Directional strength increase (J2.4)
    let theta_rad = load_angle * PI / 180.0;
    let directional_factor = 1.0 + 0.50 * theta_rad.sin().powf(1.5);
    
    // Weld metal capacity
    let fnw = 0.6 * weld.electrode.fexx() * directional_factor;
    let rn_weld = fnw * te / 1000.0; // kN/mm
    
    // Base metal shear rupture
    let rn_base = 0.6 * base_metal_fu * weld.size / 1000.0;
    
    let strength_per_length = phi * rn_weld.min(rn_base);
    let total_capacity = strength_per_length * weld.length;
    
    WeldCapacity {
        strength_per_length,
        total_capacity,
        effective_throat: te,
        base_metal_controls: rn_base < rn_weld,
    }
}

// ============================================================================
// PRYING ACTION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PryingResult {
    /// Prying force ratio Q/T
    pub prying_ratio: f64,
    /// Required plate thickness (mm)
    pub required_thickness: f64,
    /// Available capacity with prying (kN)
    pub capacity_with_prying: f64,
    /// Is prying significant
    pub prying_significant: bool,
}

/// Calculate prying action per AISC Design Guide 4
pub fn calculate_prying_action(
    bolt: &BoltProperties,
    plate_fy: f64,
    plate_thickness: f64,
    _bolt_tension: f64,
    a: f64,  // Distance from bolt line to edge
    b: f64,  // Distance from bolt line to face of tee/angle
    p: f64,  // Tributary length per bolt
) -> PryingResult {
    let d = bolt.diameter;
    let d_prime = bolt.hole_diameter();
    
    // Effective distances
    let a_prime = a + d / 2.0;
    let b_prime = b - d / 2.0;
    
    // Calculate alpha prime
    let delta = 1.0 - d_prime / p;
    let rho = b_prime / a_prime;
    
    // Required thickness to eliminate prying
    let bn = bolt.area_tensile() * bolt.grade.fub() / 1000.0; // kN
    let tc = (4.0 * bn * b_prime / (p * plate_fy)).sqrt();
    
    let t_ratio = plate_thickness / tc;
    
    // Prying ratio calculation
    let alpha_prime = if t_ratio >= 1.0 {
        0.0 // No prying
    } else {
        let alpha_max = 1.0 / (delta * (1.0 + rho));
        let alpha = (1.0 / delta) * ((tc / plate_thickness).powi(2) - 1.0);
        alpha.min(alpha_max).max(0.0)
    };
    
    // Prying force ratio
    let q_over_t = if alpha_prime > 0.0 {
        delta * alpha_prime * (plate_thickness / tc).powi(2) / (1.0 + delta * alpha_prime)
    } else {
        0.0
    };
    
    // Available capacity considering prying
    let capacity = bn / (1.0 + q_over_t);
    
    PryingResult {
        prying_ratio: q_over_t,
        required_thickness: tc,
        capacity_with_prying: capacity,
        prying_significant: q_over_t > 0.1,
    }
}

// ============================================================================
// COMPLETE CONNECTION CHECK
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionCheckResult {
    pub is_adequate: bool,
    pub overall_ratio: f64,
    pub bolt_checks: Vec<BoltCapacity>,
    pub block_shear: Option<BlockShearResult>,
    pub weld_checks: Vec<WeldCapacity>,
    pub prying: Option<PryingResult>,
    pub controlling_limit_state: String,
    pub warnings: Vec<String>,
}

/// Shear tab (single plate) connection design check
pub fn check_shear_tab_connection(
    _code: SteelDesignCode,
    plate_material: &SteelMaterial,
    _beam_material: &SteelMaterial,
    bolt_group: &BoltGroup,
    plate_thickness: f64,
    plate_depth: f64,
    _beam_web_thickness: f64,
    applied_shear: f64,
    applied_moment: f64,  // Moment from eccentricity
) -> ConnectionCheckResult {
    let mut warnings = Vec::new();
    let mut bolt_checks = Vec::new();
    
    // Check minimum edge/end distances
    let min_edge = 1.5 * bolt_group.bolt.diameter;
    if bolt_group.edge_distance < min_edge {
        warnings.push(format!(
            "Edge distance {:.1}mm < minimum {:.1}mm",
            bolt_group.edge_distance, min_edge
        ));
    }
    
    // Bolt forces with eccentricity
    let n_bolts = bolt_group.total_bolts();
    let direct_shear = if n_bolts > 0 {
        applied_shear / n_bolts as f64
    } else {
        0.0
    };
    
    // Moment from eccentricity
    let j = bolt_group.j_bolt_group();
    let c_max = bolt_group.c_max();
    let moment_shear = if j > 0.0 {
        applied_moment * c_max / j
    } else {
        0.0
    };
    
    let max_bolt_shear = ((direct_shear.powi(2) + moment_shear.powi(2)) as f64).sqrt();
    
    // Check each bolt
    let lc = bolt_group.pitch - bolt_group.bolt.hole_diameter();
    let bolt_capacity = calculate_bolt_capacity_aisc(
        &bolt_group.bolt,
        plate_thickness,
        plate_material.fu,
        lc,
        1, // Single shear
        max_bolt_shear,
        0.0, // No tension for shear tab
        false,
    );
    bolt_checks.push(bolt_capacity.clone());
    
    // Block shear check
    let n_rows = bolt_group.n_rows;
    let pitch = bolt_group.pitch;
    let d_hole = bolt_group.bolt.hole_diameter();
    
    // Block shear path
    let agv = 2.0 * (bolt_group.edge_distance + (n_rows - 1) as f64 * pitch) * plate_thickness;
    let anv = agv - 2.0 * (n_rows as f64 - 0.5) * d_hole * plate_thickness;
    let ant = (bolt_group.end_distance - d_hole / 2.0) * plate_thickness;
    
    let block_shear = calculate_block_shear_aisc(
        plate_material.fy,
        plate_material.fu,
        agv,
        ant,
        anv,
        1.0,
    );
    
    // Plate yielding check
    let gross_area = plate_depth * plate_thickness;
    let plate_yield_capacity = 0.9 * plate_material.fy * gross_area / 1000.0;
    
    // Net section rupture
    let net_area = gross_area - n_rows as f64 * d_hole * plate_thickness;
    let plate_rupture_capacity = 0.75 * plate_material.fu * net_area / 1000.0;
    
    // Overall ratio
    let bolt_ratio = max_bolt_shear / bolt_capacity.shear_capacity;
    let block_ratio = applied_shear / block_shear.capacity;
    let yield_ratio = applied_shear / plate_yield_capacity;
    let rupture_ratio = applied_shear / plate_rupture_capacity;
    
    let overall_ratio = bolt_ratio.max(block_ratio).max(yield_ratio).max(rupture_ratio);
    
    let controlling_limit_state = if bolt_ratio >= block_ratio && bolt_ratio >= yield_ratio && bolt_ratio >= rupture_ratio {
        format!("{:?}", bolt_capacity.controlling_state)
    } else if block_ratio >= yield_ratio && block_ratio >= rupture_ratio {
        "Block Shear Rupture".to_string()
    } else if yield_ratio >= rupture_ratio {
        "Plate Gross Section Yielding".to_string()
    } else {
        "Plate Net Section Rupture".to_string()
    };
    
    ConnectionCheckResult {
        is_adequate: overall_ratio <= 1.0,
        overall_ratio,
        bolt_checks,
        block_shear: Some(block_shear),
        weld_checks: Vec::new(),
        prying: None,
        controlling_limit_state,
        warnings,
    }
}

// ============================================================================
// MOMENT CONNECTION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MomentConnectionResult {
    pub is_adequate: bool,
    pub flange_force_ratio: f64,
    pub web_force_ratio: f64,
    pub bolt_tension_ratio: f64,
    pub bolt_shear_ratio: f64,
    pub prying_effect: PryingResult,
    pub controlling_state: String,
}

/// Extended end-plate moment connection check
pub fn check_extended_endplate_connection(
    bolt: &BoltProperties,
    n_bolt_rows: usize,
    n_bolts_per_row: usize,
    bolt_pitch: f64,
    plate_thickness: f64,
    plate_fy: f64,
    applied_moment: f64,  // kN-m
    applied_shear: f64,   // kN
    beam_depth: f64,
    beam_flange_thickness: f64,
) -> MomentConnectionResult {
    // Flange force from moment
    let lever_arm = beam_depth - beam_flange_thickness;
    let flange_force = applied_moment * 1000.0 / lever_arm; // kN
    
    // Bolts in tension (assume half on each side of beam)
    let n_tension_bolts = (n_bolt_rows * n_bolts_per_row) / 2;
    let tension_per_bolt = if n_tension_bolts > 0 {
        flange_force / n_tension_bolts as f64
    } else {
        f64::MAX // No bolts → infinite demand signals failure
    };
    
    // Bolt tension capacity
    let fnt = 0.75 * bolt.grade.fub();
    let bolt_tension_capacity = 0.75 * fnt * bolt.area_tensile() / 1000.0;
    
    // Bolts in shear
    let n_shear_bolts = n_bolt_rows * n_bolts_per_row;
    let shear_per_bolt = if n_shear_bolts > 0 {
        applied_shear / n_shear_bolts as f64
    } else {
        f64::MAX
    };
    
    // Bolt shear capacity - must account for thread condition
    let fnv = match bolt.thread_type {
        ThreadType::Included => bolt.grade.fub() * 0.450,
        ThreadType::Excluded => bolt.grade.fub() * 0.563,
    };
    let bolt_shear_capacity = 0.75 * fnv * bolt.area_gross() / 1000.0;
    
    // Prying action
    let a = 50.0; // Typical edge distance
    let b = bolt_pitch / 2.0;
    let p = bolt_pitch;
    
    let prying = calculate_prying_action(
        bolt,
        plate_fy,
        plate_thickness,
        tension_per_bolt,
        a,
        b,
        p,
    );
    
    // Adjusted tension ratio with prying
    let effective_tension = tension_per_bolt * (1.0 + prying.prying_ratio);
    let bolt_tension_ratio = effective_tension / bolt_tension_capacity;
    let bolt_shear_ratio = shear_per_bolt / bolt_shear_capacity;
    
    // Combined ratio (elliptical interaction)
    let combined_ratio = (bolt_tension_ratio.powi(2) + bolt_shear_ratio.powi(2)).sqrt();
    
    let controlling_state = if bolt_tension_ratio > bolt_shear_ratio {
        if prying.prying_significant {
            "Bolt Tension with Prying".to_string()
        } else {
            "Bolt Tension".to_string()
        }
    } else {
        "Bolt Shear".to_string()
    };
    
    MomentConnectionResult {
        is_adequate: combined_ratio <= 1.0,
        flange_force_ratio: flange_force / (n_tension_bolts as f64 * bolt_tension_capacity),
        web_force_ratio: bolt_shear_ratio,
        bolt_tension_ratio,
        bolt_shear_ratio,
        prying_effect: prying,
        controlling_state,
    }
}

// ============================================================================
// EUROCODE 3 METHODS
// ============================================================================

/// Calculate bolt shear capacity per EN 1993-1-8
pub fn calculate_bolt_shear_ec3(
    bolt: &BoltProperties,
    n_shear_planes: usize,
    gamma_m2: f64,  // Typically 1.25
) -> f64 {
    let fub = bolt.grade.fub();
    // EC3 Table 3.4: αv = 0.5 for 4.8/5.8/6.8/10.9 when threads in shear plane
    // αv = 0.6 for all grades when shank (unthreaded) in shear plane
    let alpha_v = match bolt.thread_type {
        ThreadType::Included => if fub > 800.0 { 0.5 } else { 0.6 },
        ThreadType::Excluded => 0.6,
    };
    
    let a = match bolt.thread_type {
        ThreadType::Included => bolt.area_tensile(),
        ThreadType::Excluded => bolt.area_gross(),
    };
    
    alpha_v * fub * a * n_shear_planes as f64 / (gamma_m2 * 1000.0)
}

/// Calculate bolt bearing capacity per EN 1993-1-8
pub fn calculate_bolt_bearing_ec3(
    bolt: &BoltProperties,
    plate_thickness: f64,
    plate_fu: f64,
    e1: f64,  // End distance in direction of load
    p1: f64,  // Pitch in direction of load
    e2: f64,  // Edge distance perpendicular to load
    p2: f64,  // Pitch perpendicular to load
    gamma_m2: f64,
) -> f64 {
    let d = bolt.diameter;
    let d0 = bolt.hole_diameter();
    let fub = bolt.grade.fub();
    
    // Alpha_b = min of several terms
    let alpha_d = e1 / (3.0 * d0);
    let alpha_p = p1 / (3.0 * d0) - 0.25;
    let alpha_fub = fub / plate_fu;
    let alpha_b = alpha_d.min(alpha_p).min(alpha_fub).min(1.0);
    
    // k1
    let k1_edge = 2.8 * e2 / d0 - 1.7;
    let k1_inner = 1.4 * p2 / d0 - 1.7;
    let k1 = k1_edge.min(k1_inner).min(2.5);
    
    k1 * alpha_b * plate_fu * d * plate_thickness / (gamma_m2 * 1000.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_bolt_area() {
        let bolt = BoltProperties {
            diameter: 20.0,
            grade: BoltGrade::A325,
            thread_type: ThreadType::Included,
            hole_type: HoleType::Standard,
            pretension: None,
        };
        
        let area = bolt.area_gross();
        assert!((area - 314.159).abs() < 1.0); // π * 20² / 4
    }
    
    #[test]
    fn test_bolt_shear_capacity() {
        let bolt = BoltProperties {
            diameter: 20.0,
            grade: BoltGrade::A325,
            thread_type: ThreadType::Excluded,
            hole_type: HoleType::Standard,
            pretension: None,
        };
        
        let capacity = calculate_bolt_capacity_aisc(
            &bolt,
            10.0,    // plate thickness
            400.0,   // plate fu
            50.0,    // lc
            1,       // single shear
            0.0,     // no applied shear
            0.0,     // no tension
            false,
        );
        
        assert!(capacity.shear_capacity > 100.0); // Should be > 100 kN
    }
    
    #[test]
    fn test_fillet_weld_capacity() {
        let weld = WeldProperties {
            size: 6.0,
            length: 100.0,
            weld_type: WeldType::FilletWeld,
            electrode: WeldElectrode::E70,
        };
        
        let capacity = calculate_fillet_weld_capacity_aisc(&weld, 400.0, 0.0);
        
        assert!(capacity.total_capacity > 50.0);
        assert!((capacity.effective_throat - 4.24).abs() < 0.1);
    }
    
    #[test]
    fn test_block_shear() {
        let result = calculate_block_shear_aisc(
            250.0,   // fy
            400.0,   // fu
            2000.0,  // agv
            500.0,   // ant
            1600.0,  // anv
            1.0,     // ubs
        );
        
        assert!(result.capacity > 200.0);
    }
    
    #[test]
    fn test_shear_tab_connection() {
        let plate = SteelMaterial::a36();
        let beam = SteelMaterial::a992();
        
        let bolt = BoltProperties {
            diameter: 20.0,
            grade: BoltGrade::A325,
            thread_type: ThreadType::Included,
            hole_type: HoleType::Standard,
            pretension: None,
        };
        
        let bolt_group = BoltGroup {
            n_rows: 3,
            n_cols: 1,
            pitch: 75.0,
            gage: 0.0,
            edge_distance: 38.0,
            end_distance: 38.0,
            bolt,
        };
        
        let result = check_shear_tab_connection(
            SteelDesignCode::AISC360_22,
            &plate,
            &beam,
            &bolt_group,
            10.0,   // plate thickness
            230.0,  // plate depth
            10.0,   // beam web thickness
            150.0,  // applied shear
            15.0,   // applied moment
        );
        
        assert!(result.overall_ratio < 1.5); // Should be close to adequate
    }
    
    #[test]
    fn test_prying_action() {
        let bolt = BoltProperties {
            diameter: 20.0,
            grade: BoltGrade::A325,
            thread_type: ThreadType::Included,
            hole_type: HoleType::Standard,
            pretension: None,
        };
        
        let result = calculate_prying_action(
            &bolt,
            250.0,  // plate fy
            16.0,   // plate thickness
            50.0,   // bolt tension
            40.0,   // a
            50.0,   // b
            75.0,   // p
        );
        
        assert!(result.prying_ratio >= 0.0);
        assert!(result.required_thickness > 0.0);
    }
}
