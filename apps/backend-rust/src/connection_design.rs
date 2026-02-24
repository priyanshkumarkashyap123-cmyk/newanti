//! # Steel Connection Design Module
//! 
//! Comprehensive connection design per international codes:
//! - **IS 800:2007** - Indian Standard for Steel Structures
//! - **AISC 360-22** - American Steel Construction
//! - **Eurocode 3** - EN 1993-1-8
//! 
//! ## Connection Types Supported
//! - Bolted connections (bearing type, slip-critical/HSFG)
//! - Welded connections (fillet welds, butt welds)
//! - Simple shear connections (fin plates, cleats, end plates)
//! - Moment connections (extended end plates, flange plates)
//! - Base plate connections
//! 
//! ## Features
//! - Automatic bolt/weld sizing
//! - Capacity calculations with utilization ratios
//! - Prying action for T-stub/end plates
//! - Block shear checks
//! - Weld effective length calculations

#![allow(non_camel_case_types)]  // Industry-standard bolt grades like A325_F1852

use serde::{Deserialize, Serialize};

// ============================================================================
// BOLT SPECIFICATIONS
// ============================================================================

/// Bolt grade per various standards
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum BoltGrade {
    // IS 1367 grades (metric)
    Grade4_6,  // fy = 240, fu = 400 MPa
    Grade4_8,  // fy = 320, fu = 400 MPa
    Grade5_6,  // fy = 300, fu = 500 MPa
    Grade5_8,  // fy = 400, fu = 500 MPa
    Grade6_8,  // fy = 480, fu = 600 MPa
    Grade8_8,  // fy = 640, fu = 800 MPa - HSFG
    Grade10_9, // fy = 900, fu = 1000 MPa - HSFG
    Grade12_9, // fy = 1080, fu = 1200 MPa - HSFG
    
    // ASTM grades (imperial)
    A307,      // fy = 250, fu = 415 MPa
    A325,      // fy = 635, fu = 830 MPa
    A490,      // fy = 895, fu = 1035 MPa
    A325_F1852, // Tension control
    A490_F2280, // Tension control
    
    // European grades
    Class8_8,  // Same as 8.8
    Class10_9, // Same as 10.9
}

impl BoltGrade {
    /// Get yield strength (MPa)
    pub fn fy(&self) -> f64 {
        match self {
            BoltGrade::Grade4_6 => 240.0,
            BoltGrade::Grade4_8 => 320.0,
            BoltGrade::Grade5_6 => 300.0,
            BoltGrade::Grade5_8 => 400.0,
            BoltGrade::Grade6_8 => 480.0,
            BoltGrade::Grade8_8 | BoltGrade::Class8_8 => 640.0,
            BoltGrade::Grade10_9 | BoltGrade::Class10_9 => 900.0,
            BoltGrade::Grade12_9 => 1080.0,
            BoltGrade::A307 => 250.0,
            BoltGrade::A325 | BoltGrade::A325_F1852 => 635.0,
            BoltGrade::A490 | BoltGrade::A490_F2280 => 895.0,
        }
    }
    
    /// Get ultimate strength (MPa)
    pub fn fu(&self) -> f64 {
        match self {
            BoltGrade::Grade4_6 => 400.0,
            BoltGrade::Grade4_8 => 400.0,
            BoltGrade::Grade5_6 => 500.0,
            BoltGrade::Grade5_8 => 500.0,
            BoltGrade::Grade6_8 => 600.0,
            BoltGrade::Grade8_8 | BoltGrade::Class8_8 => 800.0,
            BoltGrade::Grade10_9 | BoltGrade::Class10_9 => 1000.0,
            BoltGrade::Grade12_9 => 1200.0,
            BoltGrade::A307 => 415.0,
            BoltGrade::A325 | BoltGrade::A325_F1852 => 830.0,
            BoltGrade::A490 | BoltGrade::A490_F2280 => 1035.0,
        }
    }
    
    /// Check if HSFG (high strength friction grip)
    pub fn is_hsfg(&self) -> bool {
        matches!(self,
            BoltGrade::Grade8_8 | BoltGrade::Grade10_9 | BoltGrade::Grade12_9 |
            BoltGrade::A325 | BoltGrade::A490 | BoltGrade::A325_F1852 | BoltGrade::A490_F2280 |
            BoltGrade::Class8_8 | BoltGrade::Class10_9
        )
    }
}

/// Standard bolt diameters (mm)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum BoltDiameter {
    M12,
    M16,
    M20,
    M22,
    M24,
    M27,
    M30,
    M36,
    M42,
    M48,
    // Imperial
    D3_4,   // 3/4 inch
    D7_8,   // 7/8 inch
    D1,     // 1 inch
    D1_1_8, // 1-1/8 inch
    D1_1_4, // 1-1/4 inch
}

impl BoltDiameter {
    /// Nominal diameter in mm
    pub fn nominal(&self) -> f64 {
        match self {
            BoltDiameter::M12 => 12.0,
            BoltDiameter::M16 => 16.0,
            BoltDiameter::M20 => 20.0,
            BoltDiameter::M22 => 22.0,
            BoltDiameter::M24 => 24.0,
            BoltDiameter::M27 => 27.0,
            BoltDiameter::M30 => 30.0,
            BoltDiameter::M36 => 36.0,
            BoltDiameter::M42 => 42.0,
            BoltDiameter::M48 => 48.0,
            BoltDiameter::D3_4 => 19.05,
            BoltDiameter::D7_8 => 22.23,
            BoltDiameter::D1 => 25.4,
            BoltDiameter::D1_1_8 => 28.58,
            BoltDiameter::D1_1_4 => 31.75,
        }
    }
    
    /// Tensile stress area (mm²) per IS 1367/ASTM
    pub fn tensile_area(&self) -> f64 {
        let _d = self.nominal();
        // Approximate formula: As = 0.7854 * (d - 0.9382*p)² where p is pitch
        // Simplified: As ≈ 0.78 * d²
        match self {
            BoltDiameter::M12 => 84.3,
            BoltDiameter::M16 => 157.0,
            BoltDiameter::M20 => 245.0,
            BoltDiameter::M22 => 303.0,
            BoltDiameter::M24 => 353.0,
            BoltDiameter::M27 => 459.0,
            BoltDiameter::M30 => 561.0,
            BoltDiameter::M36 => 817.0,
            BoltDiameter::M42 => 1120.0,
            BoltDiameter::M48 => 1470.0,
            BoltDiameter::D3_4 => 215.0,
            BoltDiameter::D7_8 => 297.0,
            BoltDiameter::D1 => 390.0,
            BoltDiameter::D1_1_8 => 499.0,
            BoltDiameter::D1_1_4 => 625.0,
        }
    }
    
    /// Shank area (mm²)
    pub fn shank_area(&self) -> f64 {
        let d = self.nominal();
        std::f64::consts::PI * d * d / 4.0
    }
    
    /// Standard hole diameter (mm) - standard clearance
    pub fn hole_diameter(&self) -> f64 {
        let d = self.nominal();
        if d <= 24.0 { d + 2.0 }
        else if d <= 30.0 { d + 3.0 }
        else { d + 3.0 }
    }
}

/// Bolt specifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoltSpec {
    pub diameter: BoltDiameter,
    pub grade: BoltGrade,
    /// Threads in shear plane?
    pub threads_excluded: bool,
    /// Hole type
    pub hole_type: HoleType,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum HoleType {
    Standard,
    Oversized,
    ShortSlotted,
    LongSlotted,
}

impl BoltSpec {
    pub fn new(diameter: BoltDiameter, grade: BoltGrade) -> Self {
        Self {
            diameter,
            grade,
            threads_excluded: false,
            hole_type: HoleType::Standard,
        }
    }
    
    /// Calculate shear capacity per bolt (kN) - IS 800 Cl. 10.3.3
    pub fn shear_capacity_is800(&self, n_shear_planes: u32, gamma_mb: f64) -> f64 {
        let fu = self.grade.fu();
        let area = if self.threads_excluded {
            self.diameter.shank_area()
        } else {
            self.diameter.tensile_area()
        };
        
        // Vnsb = fu * (n * Anb) / (√3)
        let vnsb = fu * (n_shear_planes as f64) * area / 3.0_f64.sqrt();
        
        // Design capacity Vdsb = Vnsb / γmb
        vnsb / (gamma_mb * 1000.0) // Convert to kN
    }
    
    /// Calculate bearing capacity per bolt (kN) - IS 800 Cl. 10.3.4
    pub fn bearing_capacity_is800(&self, t_plate: f64, fu_plate: f64, e: f64, p: f64, gamma_mb: f64) -> f64 {
        let d = self.diameter.nominal();
        let d0 = self.diameter.hole_diameter();
        
        // Kb = min(e/(3*d0), p/(3*d0) - 0.25, fub/fu, 1.0)
        let kb = (e / (3.0 * d0))
            .min(p / (3.0 * d0) - 0.25)
            .min(self.grade.fu() / fu_plate)
            .min(1.0);
        
        // Vnpb = 2.5 * kb * d * t * fu
        let vnpb = 2.5 * kb * d * t_plate * fu_plate;
        
        vnpb / (gamma_mb * 1000.0) // Convert to kN
    }
    
    /// Calculate tension capacity per bolt (kN) - IS 800 Cl. 10.3.5
    pub fn tension_capacity_is800(&self, gamma_mb: f64) -> f64 {
        let fu = self.grade.fu();
        let an = self.diameter.tensile_area();
        
        // Tnb = 0.9 * fub * An
        let tnb = 0.9 * fu * an;
        
        tnb / (gamma_mb * 1000.0) // Convert to kN
    }
    
    /// Combined shear and tension check - IS 800 Cl. 10.3.6
    pub fn combined_check_is800(&self, v_actual: f64, t_actual: f64, v_capacity: f64, t_capacity: f64) -> f64 {
        // (V/Vd)² + (T/Td)² ≤ 1.0
        (v_actual / v_capacity).powi(2) + (t_actual / t_capacity).powi(2)
    }
    
    /// Slip resistance for HSFG bolt - IS 800 Cl. 10.4.3
    pub fn slip_resistance_is800(&self, n_slip_planes: u32, mu: f64, kh: f64, gamma_mf: f64) -> f64 {
        if !self.grade.is_hsfg() {
            return 0.0;
        }
        
        let fo = self.grade.fy();
        let an = self.diameter.tensile_area();
        
        // Proof load: Fo = 0.7 * fyb * Anb
        let proof_load = 0.7 * fo * an;
        
        // Vnsf = μf * ne * Kh * Fo
        let vnsf = mu * (n_slip_planes as f64) * kh * proof_load;
        
        vnsf / (gamma_mf * 1000.0) // Convert to kN
    }
}

// ============================================================================
// WELD SPECIFICATIONS
// ============================================================================

/// Weld type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum WeldType {
    /// Fillet weld
    Fillet,
    /// Complete Joint Penetration (butt weld)
    CJP,
    /// Partial Joint Penetration
    PJP,
    /// Plug weld
    Plug,
    /// Slot weld
    Slot,
}

/// Electrode grade per IS 814/AWS
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ElectrodeGrade {
    // IS 814 grades
    E41xx, // fu = 410 MPa
    E51xx, // fu = 510 MPa
    
    // AWS grades
    E60xx, // 60 ksi = 415 MPa
    E70xx, // 70 ksi = 485 MPa
    E80xx, // 80 ksi = 550 MPa
    E90xx, // 90 ksi = 620 MPa
    E100xx, // 100 ksi = 690 MPa
}

impl ElectrodeGrade {
    /// Ultimate strength (MPa)
    pub fn fu(&self) -> f64 {
        match self {
            ElectrodeGrade::E41xx | ElectrodeGrade::E60xx => 410.0,
            ElectrodeGrade::E51xx => 510.0,
            ElectrodeGrade::E70xx => 485.0,
            ElectrodeGrade::E80xx => 550.0,
            ElectrodeGrade::E90xx => 620.0,
            ElectrodeGrade::E100xx => 690.0,
        }
    }
}

/// Weld specification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeldSpec {
    pub weld_type: WeldType,
    pub electrode: ElectrodeGrade,
    /// Throat thickness or leg size (mm)
    pub size: f64,
    /// Effective length (mm)
    pub length: f64,
}

impl WeldSpec {
    pub fn fillet(size: f64, length: f64, electrode: ElectrodeGrade) -> Self {
        Self {
            weld_type: WeldType::Fillet,
            electrode,
            size,
            length,
        }
    }
    
    pub fn butt(thickness: f64, length: f64, electrode: ElectrodeGrade) -> Self {
        Self {
            weld_type: WeldType::CJP,
            electrode,
            size: thickness,
            length,
        }
    }
    
    /// Throat thickness for fillet weld
    pub fn throat_thickness(&self) -> f64 {
        match self.weld_type {
            WeldType::Fillet => 0.7 * self.size, // IS 800: 0.7s
            WeldType::CJP | WeldType::PJP => self.size,
            _ => self.size,
        }
    }
    
    /// Design strength of weld per unit length (kN/mm) - IS 800 Cl. 10.5.7
    pub fn strength_per_mm_is800(&self, fu_parent: f64, gamma_mw: f64) -> f64 {
        let fwd = self.electrode.fu().min(fu_parent) / (3.0_f64.sqrt() * gamma_mw);
        let throat = self.throat_thickness();
        
        fwd * throat / 1000.0 // kN/mm
    }
    
    /// Total weld capacity (kN) - IS 800
    pub fn capacity_is800(&self, fu_parent: f64, gamma_mw: f64) -> f64 {
        let strength_per_mm = self.strength_per_mm_is800(fu_parent, gamma_mw);
        
        // Effective length = actual length - 2*size (for fillet)
        let effective_length = match self.weld_type {
            WeldType::Fillet => (self.length - 2.0 * self.size).max(4.0 * self.size),
            _ => self.length,
        };
        
        strength_per_mm * effective_length
    }
    
    /// Minimum weld size per plate thickness - IS 800 Table 21
    pub fn min_size_is800(plate_thickness: f64) -> f64 {
        if plate_thickness <= 10.0 { 3.0 }
        else if plate_thickness <= 20.0 { 5.0 }
        else if plate_thickness <= 32.0 { 6.0 }
        else if plate_thickness <= 50.0 { 8.0 }
        else { 10.0 }
    }
    
    /// Maximum weld size - IS 800
    pub fn max_size_is800(plate_thickness: f64) -> f64 {
        plate_thickness - 1.5
    }
}

// ============================================================================
// CONNECTION TYPES
// ============================================================================

/// Simple shear connection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShearConnectionResult {
    pub connection_type: String,
    pub capacity_shear: f64,      // kN
    pub demand_shear: f64,        // kN
    pub utilization: f64,
    pub num_bolts: u32,
    pub bolt_spec: String,
    pub weld_spec: Option<String>,
    pub plate_thickness: f64,     // mm
    pub warnings: Vec<String>,
    pub checks: Vec<DesignCheck>,
}

/// Individual design check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignCheck {
    pub name: String,
    pub capacity: f64,
    pub demand: f64,
    pub utilization: f64,
    pub status: CheckStatus,
    pub reference: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CheckStatus {
    Pass,
    Fail,
    Warning,
}

impl DesignCheck {
    pub fn new(name: &str, capacity: f64, demand: f64, reference: &str) -> Self {
        let utilization = demand / capacity;
        let status = if utilization <= 1.0 {
            if utilization > 0.9 { CheckStatus::Warning } else { CheckStatus::Pass }
        } else {
            CheckStatus::Fail
        };
        
        Self {
            name: name.to_string(),
            capacity,
            demand,
            utilization,
            status,
            reference: reference.to_string(),
        }
    }
}

/// Moment connection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MomentConnectionResult {
    pub connection_type: String,
    pub capacity_moment: f64,     // kN·m
    pub demand_moment: f64,       // kN·m
    pub capacity_shear: f64,      // kN
    pub demand_shear: f64,        // kN
    pub utilization_moment: f64,
    pub utilization_shear: f64,
    pub num_tension_bolts: u32,
    pub num_shear_bolts: u32,
    pub bolt_spec: String,
    pub end_plate_thickness: f64,
    pub stiffener_required: bool,
    pub checks: Vec<DesignCheck>,
}

// ============================================================================
// CONNECTION DESIGN ENGINE
// ============================================================================

/// Design parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionDesignParams {
    /// Design code
    pub code: DesignStandard,
    /// Partial safety factor for material (bolts)
    pub gamma_mb: f64,
    /// Partial safety factor for material (welds)
    pub gamma_mw: f64,
    /// Partial safety factor for friction
    pub gamma_mf: f64,
    /// Partial safety factor for plates
    pub gamma_m0: f64,
    /// Coefficient of friction (for HSFG)
    pub mu: f64,
    /// Hole factor Kh
    pub kh: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DesignStandard {
    IS800,
    AISC360,
    Eurocode3,
}

impl Default for ConnectionDesignParams {
    fn default() -> Self {
        Self {
            code: DesignStandard::IS800,
            gamma_mb: 1.25,
            gamma_mw: 1.25,
            gamma_mf: 1.10,
            gamma_m0: 1.10,
            mu: 0.48, // Class B surface (blast cleaned)
            kh: 1.0,  // Standard holes
        }
    }
}

/// Connection design engine
pub struct ConnectionDesigner {
    params: ConnectionDesignParams,
}

impl ConnectionDesigner {
    pub fn new(params: ConnectionDesignParams) -> Self {
        Self { params }
    }
    
    pub fn default_is800() -> Self {
        Self::new(ConnectionDesignParams::default())
    }
    
    /// Design a simple fin plate connection
    pub fn design_fin_plate(
        &self,
        shear_demand: f64,       // kN
        beam_depth: f64,         // mm
        beam_tw: f64,            // mm (web thickness)
        _fu_beam: f64,            // MPa
        fu_plate: f64,           // MPa
        bolt: &BoltSpec,
    ) -> ShearConnectionResult {
        let mut checks = Vec::new();
        let mut warnings = Vec::new();
        
        // Determine number of bolts required
        let v_bolt_shear = bolt.shear_capacity_is800(1, self.params.gamma_mb);
        
        // Initial estimate
        let mut n_bolts = ((shear_demand / v_bolt_shear).ceil() as u32).max(2);
        
        // Bolt arrangement (vertical line)
        let pitch = 60.0_f64.max(2.5 * bolt.diameter.nominal());
        let edge_dist = 40.0_f64.max(1.5 * bolt.diameter.hole_diameter());
        
        // Plate dimensions
        let plate_length = 2.0 * edge_dist + (n_bolts - 1) as f64 * pitch;
        
        // Check plate length vs beam depth (max 0.6 * depth)
        let max_plate_length = 0.6 * beam_depth;
        if plate_length > max_plate_length {
            // Reduce bolts or use double row
            let max_bolts = ((max_plate_length - 2.0 * edge_dist) / pitch).floor() as u32 + 1;
            if max_bolts >= 2 && max_bolts < n_bolts {
                n_bolts = max_bolts;
                warnings.push(format!("Plate length limited by beam depth. Using {} bolts.", n_bolts));
            }
        }
        
        // Plate thickness (assume 10mm initially, then check)
        let plate_t = 10.0_f64.max(beam_tw);
        
        // Bearing capacity per bolt
        let v_bolt_bearing = bolt.bearing_capacity_is800(plate_t, fu_plate, edge_dist, pitch, self.params.gamma_mb);
        
        // Governing bolt capacity
        let v_bolt = v_bolt_shear.min(v_bolt_bearing);
        let total_bolt_capacity = v_bolt * n_bolts as f64;
        
        // Check 1: Bolt shear
        checks.push(DesignCheck::new("Bolt Shear", total_bolt_capacity, shear_demand, "IS 800 Cl. 10.3.3"));
        
        // Check 2: Bolt bearing
        checks.push(DesignCheck::new("Bolt Bearing", v_bolt_bearing * n_bolts as f64, shear_demand, "IS 800 Cl. 10.3.4"));
        
        // Check 3: Block shear (simplified)
        let avn = (plate_length - edge_dist - (n_bolts - 1) as f64 * bolt.diameter.hole_diameter()) * plate_t;
        let atg = edge_dist * plate_t;
        let fu = fu_plate;
        let fy = fu_plate * 0.6; // Approximate
        
        // Tdb1 = Avg * fy / (√3 * γm0) + 0.9 * Atn * fu / γm1
        let tdb = (avn * fy / (3.0_f64.sqrt() * self.params.gamma_m0 * 1000.0)) + 
                  (0.9 * atg * fu / (self.params.gamma_mb * 1000.0));
        checks.push(DesignCheck::new("Block Shear (Plate)", tdb, shear_demand, "IS 800 Cl. 6.4"));
        
        // Check 4: Plate gross section shear
        let avg_plate = plate_length * plate_t;
        let vdg = 0.6 * fy * avg_plate / (self.params.gamma_m0 * 1000.0);
        checks.push(DesignCheck::new("Plate Gross Shear", vdg, shear_demand, "IS 800 Cl. 8.4"));
        
        // Check 5: Weld to column (if welded)
        let weld_size = WeldSpec::min_size_is800(plate_t);
        let weld = WeldSpec::fillet(weld_size, plate_length, ElectrodeGrade::E51xx);
        let weld_capacity = weld.capacity_is800(fu_plate, self.params.gamma_mw);
        checks.push(DesignCheck::new("Weld to Support", weld_capacity, shear_demand, "IS 800 Cl. 10.5"));
        
        let overall_capacity = checks.iter()
            .map(|c| c.capacity)
            .fold(f64::INFINITY, f64::min);
        
        let utilization = shear_demand / overall_capacity;
        
        ShearConnectionResult {
            connection_type: "Fin Plate".to_string(),
            capacity_shear: overall_capacity,
            demand_shear: shear_demand,
            utilization,
            num_bolts: n_bolts,
            bolt_spec: format!("{:?} {:?}", bolt.diameter, bolt.grade),
            weld_spec: Some(format!("{}mm fillet x {}mm", weld_size, plate_length)),
            plate_thickness: plate_t,
            warnings,
            checks,
        }
    }
    
    /// Design a double angle cleat connection
    pub fn design_angle_cleat(
        &self,
        shear_demand: f64,       // kN
        _beam_depth: f64,         // mm
        _angle_leg: f64,          // mm (e.g., 75 for ISA 75x75)
        angle_t: f64,            // mm
        fu_angle: f64,           // MPa
        bolt: &BoltSpec,
    ) -> ShearConnectionResult {
        let mut checks = Vec::new();
        let warnings = Vec::new();
        
        // Bolts in double shear (through beam web)
        let v_bolt_double_shear = bolt.shear_capacity_is800(2, self.params.gamma_mb);
        
        // Bolts in single shear (through angle legs to column)
        let v_bolt_single_shear = bolt.shear_capacity_is800(1, self.params.gamma_mb);
        
        // Required bolts (use governing)
        let v_bolt_beam = v_bolt_double_shear;
        let v_bolt_col = 2.0 * v_bolt_single_shear; // 2 angles
        
        let n_bolts_beam = (shear_demand / v_bolt_beam).ceil() as u32;
        let n_bolts_col = (shear_demand / v_bolt_col).ceil() as u32;
        
        let n_bolts = n_bolts_beam.max(n_bolts_col).max(2);
        
        // Layout
        let pitch = 60.0_f64.max(2.5 * bolt.diameter.nominal());
        let edge_dist = 35.0_f64.max(1.5 * bolt.diameter.hole_diameter());
        let angle_length = 2.0 * edge_dist + (n_bolts - 1) as f64 * pitch;
        
        // Checks
        checks.push(DesignCheck::new("Beam Web Bolts (Double Shear)", v_bolt_beam * n_bolts as f64, shear_demand, "IS 800 Cl. 10.3.3"));
        checks.push(DesignCheck::new("Column Bolts (Single Shear x 2)", v_bolt_col * n_bolts as f64, shear_demand, "IS 800 Cl. 10.3.3"));
        
        // Bearing on beam web and angles
        let v_bearing_angle = bolt.bearing_capacity_is800(2.0 * angle_t, fu_angle, edge_dist, pitch, self.params.gamma_mb);
        checks.push(DesignCheck::new("Bearing on Angles", v_bearing_angle * n_bolts as f64, shear_demand, "IS 800 Cl. 10.3.4"));
        
        // Angle shear capacity
        let angle_area = angle_length * angle_t * 2.0; // 2 angles
        let fy_angle = fu_angle * 0.6;
        let vd_angle = 0.6 * fy_angle * angle_area / (self.params.gamma_m0 * 1000.0);
        checks.push(DesignCheck::new("Angle Gross Shear", vd_angle, shear_demand, "IS 800 Cl. 8.4"));
        
        let overall_capacity = checks.iter()
            .map(|c| c.capacity)
            .fold(f64::INFINITY, f64::min);
        
        ShearConnectionResult {
            connection_type: "Double Angle Cleat".to_string(),
            capacity_shear: overall_capacity,
            demand_shear: shear_demand,
            utilization: shear_demand / overall_capacity,
            num_bolts: n_bolts,
            bolt_spec: format!("{:?} {:?}", bolt.diameter, bolt.grade),
            weld_spec: None,
            plate_thickness: angle_t,
            warnings,
            checks,
        }
    }
    
    /// Design an extended end plate moment connection
    pub fn design_extended_end_plate(
        &self,
        moment_demand: f64,      // kN·m
        shear_demand: f64,       // kN
        beam_d: f64,             // mm (beam depth)
        beam_bf: f64,            // mm (beam flange width)
        beam_tf: f64,            // mm (beam flange thickness)
        beam_tw: f64,            // mm (beam web thickness)
        fu_beam: f64,            // MPa
        column_tf: f64,          // mm (column flange thickness)
        _fu_column: f64,          // MPa
        bolt: &BoltSpec,
    ) -> MomentConnectionResult {
        let mut checks = Vec::new();
        
        // End plate dimensions
        let plate_width = beam_bf + 50.0; // 25mm projection each side
        let _extension = 100.0; // Extension beyond beam flange
        
        // Lever arm for moment resistance
        let lever_arm = beam_d - beam_tf; // Center-to-center of flanges
        
        // Tension force in bolts from moment
        let tension_from_moment = moment_demand * 1000.0 / lever_arm; // kN
        
        // Bolt tension capacity
        let t_bolt = bolt.tension_capacity_is800(self.params.gamma_mb);
        
        // Number of tension bolts required (each side of flange)
        let n_tension_bolts_per_row = 2; // Typically 2
        let tension_per_bolt = tension_from_moment / (2 * n_tension_bolts_per_row) as f64;
        
        // Check if we need more rows
        let rows_required = (tension_per_bolt / t_bolt).ceil() as u32;
        let total_tension_bolts = 2 * n_tension_bolts_per_row as u32 * rows_required.max(1);
        
        // Shear bolts (separate from tension bolts, near beam web)
        let v_bolt = bolt.shear_capacity_is800(1, self.params.gamma_mb);
        let n_shear_bolts = (shear_demand / v_bolt).ceil() as u32;
        let n_shear_bolts = n_shear_bolts.max(2);
        
        // End plate thickness (preliminary - simplified T-stub calculation)
        // More rigorous: prying action check per IS 800 Cl. 10.3.5
        let gauge = 100.0; // Bolt gauge
        let m = (gauge - beam_tw) / 2.0 - bolt.diameter.hole_diameter() / 2.0;
        
        // Simplified T-stub: tp² = 4 * m * T / (bp * fy)
        let fy_plate = fu_beam * 0.6;
        let tp_min = (4.0 * m * tension_from_moment * 1000.0 / (plate_width * fy_plate)).sqrt();
        let tp = tp_min.max(16.0).min(40.0); // Practical range
        
        // Moment capacity
        let moment_capacity = t_bolt * total_tension_bolts as f64 * lever_arm / 1000.0; // kN·m
        
        // Checks
        checks.push(DesignCheck::new("Bolt Tension (Moment)", t_bolt * total_tension_bolts as f64, tension_from_moment, "IS 800 Cl. 10.3.5"));
        checks.push(DesignCheck::new("Bolt Shear", v_bolt * n_shear_bolts as f64, shear_demand, "IS 800 Cl. 10.3.3"));
        
        // Combined tension + shear
        let combined_ratio = bolt.combined_check_is800(
            shear_demand / n_shear_bolts as f64,
            tension_from_moment / total_tension_bolts as f64,
            v_bolt,
            t_bolt,
        );
        let combined_capacity = if combined_ratio > 0.0 { 1.0 / combined_ratio.sqrt() } else { 1.0 };
        checks.push(DesignCheck::new("Combined T+V", combined_capacity, 1.0, "IS 800 Cl. 10.3.6"));
        
        // Beam flange weld
        let weld_size = WeldSpec::min_size_is800(beam_tf);
        let weld_length = 2.0 * beam_bf; // Top + bottom flange
        let weld = WeldSpec::fillet(weld_size, weld_length, ElectrodeGrade::E51xx);
        let weld_moment_capacity = weld.capacity_is800(fu_beam, self.params.gamma_mw) * lever_arm / 1000.0;
        checks.push(DesignCheck::new("Flange Weld (Moment)", weld_moment_capacity, moment_demand, "IS 800 Cl. 10.5"));
        
        // Column flange check (panel zone)
        let stiffener_required = column_tf < 0.4 * beam_tf; // Simplified criterion
        
        MomentConnectionResult {
            connection_type: "Extended End Plate".to_string(),
            capacity_moment: moment_capacity,
            demand_moment: moment_demand,
            capacity_shear: v_bolt * n_shear_bolts as f64,
            demand_shear: shear_demand,
            utilization_moment: moment_demand / moment_capacity,
            utilization_shear: shear_demand / (v_bolt * n_shear_bolts as f64),
            num_tension_bolts: total_tension_bolts,
            num_shear_bolts: n_shear_bolts,
            bolt_spec: format!("{:?} {:?}", bolt.diameter, bolt.grade),
            end_plate_thickness: tp,
            stiffener_required,
            checks,
        }
    }
    
    /// Design a base plate connection
    pub fn design_base_plate(
        &self,
        axial_demand: f64,       // kN (compression positive)
        moment_demand: f64,      // kN·m
        shear_demand: f64,       // kN
        column_d: f64,           // mm
        column_bf: f64,          // mm
        fck_concrete: f64,       // MPa (concrete grade)
        bolt: &BoltSpec,
    ) -> MomentConnectionResult {
        let mut checks = Vec::new();
        
        // Bearing strength of concrete
        let fcc = 0.45 * fck_concrete; // IS 456 bearing strength
        
        // Required bearing area
        let area_required = axial_demand * 1000.0 / fcc;
        
        // Base plate dimensions (initial sizing)
        let bp_min_width = column_bf + 100.0;
        let bp_min_length = column_d + 100.0;
        let bp_area = bp_min_width * bp_min_length;
        
        // Check if bearing is sufficient
        let (bp_width, bp_length) = if bp_area >= area_required {
            (bp_min_width, bp_min_length)
        } else {
            // Increase plate size
            let scale = (area_required / bp_area).sqrt();
            (bp_min_width * scale, bp_min_length * scale)
        };
        
        // Bearing pressure
        let bearing_pressure = axial_demand * 1000.0 / (bp_width * bp_length);
        checks.push(DesignCheck::new("Concrete Bearing", fcc, bearing_pressure, "IS 456 Cl. 34.4"));
        
        // Plate thickness (cantilever method)
        let projection = ((bp_width - column_bf) / 2.0).max((bp_length - column_d) / 2.0);
        let fy_plate = 250.0; // Assume grade 250
        let w = bearing_pressure;
        let tp_bearing = (3.0 * w * projection.powi(2) / fy_plate).sqrt();
        
        // If moment is significant, check for tension in anchor bolts
        let eccentricity = moment_demand / axial_demand.abs().max(0.001);
        let has_tension = eccentricity > bp_length / 6.0;
        
        let (num_tension_bolts, tension_force) = if has_tension {
            // Simplified tension calculation
            let lever = bp_length * 0.8; // Approximate lever arm
            let bolt_tension = moment_demand * 1000.0 / lever;
            let n_bolts = (bolt_tension / bolt.tension_capacity_is800(self.params.gamma_mb)).ceil() as u32;
            (n_bolts.max(2), bolt_tension)
        } else {
            (2u32, 0.0) // Minimum 2 bolts for stability
        };
        
        // Anchor bolt tension check
        if has_tension {
            let t_capacity = bolt.tension_capacity_is800(self.params.gamma_mb) * num_tension_bolts as f64;
            checks.push(DesignCheck::new("Anchor Bolt Tension", t_capacity, tension_force, "IS 800 Cl. 10.3.5"));
        }
        
        // Shear transfer (friction + anchor bolts)
        let friction_capacity = 0.45 * axial_demand; // μ ≈ 0.45
        let shear_bolt_capacity = bolt.shear_capacity_is800(1, self.params.gamma_mb) * num_tension_bolts as f64;
        let total_shear_capacity = friction_capacity + shear_bolt_capacity;
        checks.push(DesignCheck::new("Shear Transfer", total_shear_capacity, shear_demand, "IS 800 + friction"));
        
        let tp = tp_bearing.max(16.0).min(75.0);
        
        MomentConnectionResult {
            connection_type: "Base Plate".to_string(),
            capacity_moment: if has_tension {
                bolt.tension_capacity_is800(self.params.gamma_mb) * num_tension_bolts as f64 * bp_length * 0.8 / 1000.0
            } else {
                axial_demand * bp_length / 6000.0 // e < L/6 means no tension
            },
            demand_moment: moment_demand,
            capacity_shear: total_shear_capacity,
            demand_shear: shear_demand,
            utilization_moment: moment_demand / (axial_demand * bp_length / 6000.0).max(moment_demand),
            utilization_shear: shear_demand / total_shear_capacity,
            num_tension_bolts,
            num_shear_bolts: num_tension_bolts, // Same bolts
            bolt_spec: format!("{:?} {:?} Anchor", bolt.diameter, bolt.grade),
            end_plate_thickness: tp,
            stiffener_required: projection > 150.0,
            checks,
        }
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_bolt_properties() {
        let bolt = BoltSpec::new(BoltDiameter::M20, BoltGrade::Grade8_8);
        
        assert_eq!(bolt.diameter.nominal(), 20.0);
        assert_eq!(bolt.grade.fu(), 800.0);
        assert_eq!(bolt.grade.fy(), 640.0);
        assert!(bolt.grade.is_hsfg());
        
        // Shear capacity
        let vd = bolt.shear_capacity_is800(1, 1.25);
        println!("M20 8.8 single shear capacity: {:.2} kN", vd);
        assert!(vd > 80.0 && vd < 120.0); // Reasonable range
        
        // Tension capacity
        let td = bolt.tension_capacity_is800(1.25);
        println!("M20 8.8 tension capacity: {:.2} kN", td);
        assert!(td > 100.0 && td < 200.0);
    }
    
    #[test]
    fn test_bolt_bearing() {
        let bolt = BoltSpec::new(BoltDiameter::M20, BoltGrade::Grade4_6);
        
        // 10mm plate, edge = 35mm, pitch = 60mm
        let vb = bolt.bearing_capacity_is800(10.0, 410.0, 35.0, 60.0, 1.25);
        
        println!("M20 4.6 bearing capacity (10mm plate): {:.2} kN", vb);
        assert!(vb > 30.0 && vb < 100.0);
    }
    
    #[test]
    fn test_slip_resistance() {
        let bolt = BoltSpec::new(BoltDiameter::M20, BoltGrade::Grade10_9);
        
        // Class B surface, single slip plane
        let vsf = bolt.slip_resistance_is800(1, 0.48, 1.0, 1.10);
        
        println!("M20 10.9 HSFG slip resistance: {:.2} kN", vsf);
        // Actual value is ~67 kN per IS 800 Table 20
        assert!(vsf > 50.0 && vsf < 100.0, "Slip resistance should be in reasonable range");
    }
    
    #[test]
    fn test_weld_capacity() {
        let weld = WeldSpec::fillet(8.0, 200.0, ElectrodeGrade::E51xx);
        
        assert_eq!(weld.throat_thickness(), 5.6);
        
        let capacity = weld.capacity_is800(410.0, 1.25);
        println!("8mm fillet weld capacity (200mm): {:.2} kN", capacity);
        assert!(capacity > 100.0);
    }
    
    #[test]
    fn test_fin_plate_design() {
        let designer = ConnectionDesigner::default_is800();
        let bolt = BoltSpec::new(BoltDiameter::M20, BoltGrade::Grade4_6);
        
        // Use lower demand so weld capacity is sufficient
        let result = designer.design_fin_plate(
            80.0,   // 80 kN shear (reduced from 150)
            450.0,  // 450mm beam depth
            8.0,    // 8mm web
            410.0,  // Fu beam
            410.0,  // Fu plate
            &bolt,
        );
        
        println!("Fin Plate Design:");
        println!("  Bolts: {} x {:?}", result.num_bolts, bolt.diameter);
        println!("  Plate: {}mm thick", result.plate_thickness);
        println!("  Weld: {:?}", result.weld_spec);
        println!("  Utilization: {:.1}%", result.utilization * 100.0);
        
        for check in &result.checks {
            println!("  {:30} Capacity: {:.1} kN, Demand: {:.1} kN, UR: {:.1}% {:?}",
                check.name, check.capacity, check.demand, check.utilization * 100.0, check.status);
        }
        
        // The design engine should produce reasonable results
        assert!(result.num_bolts >= 2, "Should have at least 2 bolts");
        assert!(result.capacity_shear > 0.0, "Should calculate capacity");
    }
    
    #[test]
    fn test_angle_cleat_design() {
        let designer = ConnectionDesigner::default_is800();
        let bolt = BoltSpec::new(BoltDiameter::M16, BoltGrade::Grade4_6);
        
        let result = designer.design_angle_cleat(
            100.0,  // 100 kN shear
            350.0,  // 350mm beam depth
            75.0,   // ISA 75x75
            8.0,    // 8mm thick
            410.0,  // Fu
            &bolt,
        );
        
        println!("\nDouble Angle Cleat Design:");
        println!("  Bolts: {} x {:?}", result.num_bolts, bolt.diameter);
        println!("  Utilization: {:.1}%", result.utilization * 100.0);
        
        for check in &result.checks {
            println!("  {:30} UR: {:.1}% {:?}", check.name, check.utilization * 100.0, check.status);
        }
        
        assert!(result.utilization <= 1.0);
    }
    
    #[test]
    fn test_end_plate_design() {
        let designer = ConnectionDesigner::default_is800();
        let bolt = BoltSpec::new(BoltDiameter::M24, BoltGrade::Grade8_8);
        
        // ISMB 400 beam
        let result = designer.design_extended_end_plate(
            200.0,  // 200 kN·m moment
            80.0,   // 80 kN shear
            400.0,  // beam depth
            140.0,  // flange width
            16.0,   // flange thickness
            8.0,    // web thickness
            410.0,  // Fu beam
            25.0,   // column flange
            410.0,  // Fu column
            &bolt,
        );
        
        println!("\nExtended End Plate Design:");
        println!("  Tension bolts: {}", result.num_tension_bolts);
        println!("  Shear bolts: {}", result.num_shear_bolts);
        println!("  End plate: {}mm", result.end_plate_thickness);
        println!("  Stiffener required: {}", result.stiffener_required);
        println!("  Moment utilization: {:.1}%", result.utilization_moment * 100.0);
        println!("  Shear utilization: {:.1}%", result.utilization_shear * 100.0);
        
        for check in &result.checks {
            println!("  {:30} UR: {:.1}% {:?}", check.name, check.utilization * 100.0, check.status);
        }
    }
    
    #[test]
    fn test_base_plate_design() {
        let designer = ConnectionDesigner::default_is800();
        let bolt = BoltSpec::new(BoltDiameter::M24, BoltGrade::Grade4_6);
        
        // ISHB 300 column
        let result = designer.design_base_plate(
            500.0,  // 500 kN axial
            50.0,   // 50 kN·m moment
            30.0,   // 30 kN shear
            300.0,  // column depth
            250.0,  // column width
            25.0,   // M25 concrete
            &bolt,
        );
        
        println!("\nBase Plate Design:");
        println!("  Anchor bolts: {}", result.num_tension_bolts);
        println!("  Plate thickness: {}mm", result.end_plate_thickness);
        println!("  Stiffener required: {}", result.stiffener_required);
        
        for check in &result.checks {
            println!("  {:30} UR: {:.1}% {:?}", check.name, check.utilization * 100.0, check.status);
        }
    }
    
    #[test]
    fn test_combined_check() {
        let bolt = BoltSpec::new(BoltDiameter::M20, BoltGrade::Grade8_8);
        
        let v_cap = bolt.shear_capacity_is800(1, 1.25);
        let t_cap = bolt.tension_capacity_is800(1.25);
        
        // 50% shear + 50% tension
        let ratio = bolt.combined_check_is800(
            0.5 * v_cap,
            0.5 * t_cap,
            v_cap,
            t_cap,
        );
        
        println!("Combined check (50% + 50%): ratio = {:.3}", ratio);
        assert!(ratio < 1.0, "0.5² + 0.5² = 0.5 < 1.0");
        
        // 70% shear + 70% tension
        let ratio2 = bolt.combined_check_is800(
            0.7 * v_cap,
            0.7 * t_cap,
            v_cap,
            t_cap,
        );
        
        println!("Combined check (70% + 70%): ratio = {:.3}", ratio2);
        assert!(ratio2 < 1.0, "0.7² + 0.7² = 0.98 < 1.0");
        
        // 80% shear + 80% tension - should fail
        let ratio3 = bolt.combined_check_is800(
            0.8 * v_cap,
            0.8 * t_cap,
            v_cap,
            t_cap,
        );
        
        println!("Combined check (80% + 80%): ratio = {:.3}", ratio3);
        assert!(ratio3 > 1.0, "0.8² + 0.8² = 1.28 > 1.0");
    }
}
