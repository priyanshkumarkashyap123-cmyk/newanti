//! Steel Connection Design Module
//! 
//! Design of bolted and welded steel connections per AISC 360
//! including moment connections, shear connections, and base plates.

use std::f64::consts::PI;

/// Connection type
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ConnectionType {
    ShearTab,
    SingleAngle,
    DoubleAngle,
    EndPlate,
    FlangePlate,
    ExtendedEndPlate,
    DirectWeld,
    SeatAngle,
    StiffenedSeat,
    BracingGusset,
}

/// Bolt grade
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BoltGrade {
    A325,       // 120 ksi tensile
    A490,       // 150 ksi tensile
    A307,       // 60 ksi tensile
    Metric88,   // Grade 8.8
    Metric109,  // Grade 10.9
}

impl BoltGrade {
    /// Nominal tensile strength (MPa)
    pub fn fnt(&self) -> f64 {
        match self {
            BoltGrade::A325 => 620.0,
            BoltGrade::A490 => 780.0,
            BoltGrade::A307 => 310.0,
            BoltGrade::Metric88 => 800.0,
            BoltGrade::Metric109 => 1000.0,
        }
    }

    /// Nominal shear strength (MPa)
    pub fn fnv(&self) -> f64 {
        // X-type connection (threads excluded)
        self.fnt() * 0.625
    }
}

/// Weld type
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum WeldType {
    Fillet,
    CJP,        // Complete joint penetration
    PJP,        // Partial joint penetration
    Plug,
    Slot,
}

/// Electrode classification
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ElectrodeType {
    E70,    // 70 ksi = 480 MPa
    E80,    // 80 ksi = 550 MPa
    E90,    // 90 ksi = 620 MPa
    E100,   // 100 ksi = 690 MPa
}

impl ElectrodeType {
    /// Nominal strength (MPa)
    pub fn fexx(&self) -> f64 {
        match self {
            ElectrodeType::E70 => 480.0,
            ElectrodeType::E80 => 550.0,
            ElectrodeType::E90 => 620.0,
            ElectrodeType::E100 => 690.0,
        }
    }
}

/// Bolt specification
#[derive(Debug, Clone)]
pub struct BoltSpec {
    pub diameter: f64,      // mm
    pub grade: BoltGrade,
    pub hole_type: HoleType,
    pub threads_in_shear: bool,
}

/// Hole type
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum HoleType {
    Standard,
    Oversized,
    ShortSlot,
    LongSlot,
}

impl BoltSpec {
    /// Standard A325 bolt
    pub fn a325(diameter: f64) -> Self {
        BoltSpec {
            diameter,
            grade: BoltGrade::A325,
            hole_type: HoleType::Standard,
            threads_in_shear: true,
        }
    }

    /// Standard A490 bolt
    pub fn a490(diameter: f64) -> Self {
        BoltSpec {
            diameter,
            grade: BoltGrade::A490,
            hole_type: HoleType::Standard,
            threads_in_shear: true,
        }
    }

    /// Bolt area (gross)
    pub fn area(&self) -> f64 {
        PI * (self.diameter / 2.0).powi(2)
    }

    /// Hole diameter
    pub fn hole_diameter(&self) -> f64 {
        match self.hole_type {
            HoleType::Standard => self.diameter + 2.0,
            HoleType::Oversized => self.diameter + 5.0,
            HoleType::ShortSlot => self.diameter + 2.0, // Width
            HoleType::LongSlot => self.diameter + 2.0,  // Width
        }
    }

    /// Single bolt shear capacity (kN)
    pub fn shear_capacity(&self) -> f64 {
        let fnv = if self.threads_in_shear {
            self.grade.fnv() * 0.8 // Reduction for threads
        } else {
            self.grade.fnv()
        };
        
        0.75 * fnv * self.area() / 1000.0
    }

    /// Single bolt tension capacity (kN)
    pub fn tension_capacity(&self) -> f64 {
        0.75 * self.grade.fnt() * self.area() / 1000.0
    }

    /// Bearing capacity on plate (kN)
    pub fn bearing_capacity(&self, t: f64, fu: f64, lc: f64) -> f64 {
        // t = plate thickness (mm)
        // fu = plate ultimate strength (MPa)
        // lc = clear distance to edge or adjacent hole (mm)
        
        let rn1 = 1.2 * lc * t * fu / 1000.0;
        let rn2 = 2.4 * self.diameter * t * fu / 1000.0;
        
        0.75 * rn1.min(rn2)
    }
}

/// Weld specification
#[derive(Debug, Clone)]
pub struct WeldSpec {
    pub weld_type: WeldType,
    pub size: f64,          // mm (leg size for fillet)
    pub length: f64,        // mm
    pub electrode: ElectrodeType,
}

impl WeldSpec {
    /// Fillet weld
    pub fn fillet(size: f64, length: f64) -> Self {
        WeldSpec {
            weld_type: WeldType::Fillet,
            size,
            length,
            electrode: ElectrodeType::E70,
        }
    }

    /// CJP weld
    pub fn cjp(thickness: f64, length: f64) -> Self {
        WeldSpec {
            weld_type: WeldType::CJP,
            size: thickness,
            length,
            electrode: ElectrodeType::E70,
        }
    }

    /// Effective throat (mm)
    pub fn effective_throat(&self) -> f64 {
        match self.weld_type {
            WeldType::Fillet => 0.707 * self.size,
            WeldType::CJP => self.size,
            WeldType::PJP => self.size * 0.75,
            _ => self.size,
        }
    }

    /// Weld capacity per unit length (kN/mm)
    pub fn capacity_per_mm(&self) -> f64 {
        let fexx = self.electrode.fexx();
        let te = self.effective_throat();
        
        match self.weld_type {
            WeldType::Fillet => 0.75 * 0.6 * fexx * te / 1000.0,
            WeldType::CJP => 0.9 * fexx * te / 1000.0,
            WeldType::PJP => 0.75 * 0.6 * fexx * te / 1000.0,
            _ => 0.75 * 0.6 * fexx * te / 1000.0,
        }
    }

    /// Total weld capacity (kN)
    pub fn total_capacity(&self) -> f64 {
        self.capacity_per_mm() * self.length
    }
}

/// Shear tab connection
#[derive(Debug, Clone)]
pub struct ShearTab {
    pub plate_thickness: f64,   // mm
    pub plate_depth: f64,       // mm
    pub plate_length: f64,      // mm
    pub bolts: BoltSpec,
    pub num_bolts: usize,
    pub bolt_spacing: f64,      // mm
    pub edge_distance: f64,     // mm
    pub plate_fy: f64,          // MPa
    pub plate_fu: f64,          // MPa
    pub weld_size: f64,         // mm (to column)
}

/// Shear tab design results
#[derive(Debug, Clone)]
pub struct ShearTabDesign {
    pub bolt_shear_capacity: f64,   // kN
    pub bolt_bearing_capacity: f64, // kN
    pub plate_shear_capacity: f64,  // kN
    pub plate_block_shear: f64,     // kN
    pub weld_capacity: f64,         // kN
    pub governing_capacity: f64,    // kN
    pub utilization: f64,
}

impl ShearTab {
    /// Create standard shear tab
    pub fn new(reaction: f64, _beam_depth: f64) -> Self {
        // Size based on reaction
        let num_bolts = ((reaction / 80.0).ceil() as usize).max(2).min(12);
        let bolt_dia = if reaction > 200.0 { 22.0 } else { 20.0 };
        
        let plate_depth = (num_bolts - 1) as f64 * 75.0 + 2.0 * 38.0;
        
        ShearTab {
            plate_thickness: 10.0,
            plate_depth,
            plate_length: 100.0,
            bolts: BoltSpec::a325(bolt_dia),
            num_bolts,
            bolt_spacing: 75.0,
            edge_distance: 38.0,
            plate_fy: 250.0,
            plate_fu: 400.0,
            weld_size: 6.0,
        }
    }

    /// Design check
    pub fn design(&self, vu: f64) -> ShearTabDesign {
        // Bolt shear
        let bolt_shear = self.num_bolts as f64 * self.bolts.shear_capacity();
        
        // Bolt bearing
        let lc = self.edge_distance - self.bolts.hole_diameter() / 2.0;
        let bearing_edge = self.bolts.bearing_capacity(self.plate_thickness, self.plate_fu, lc);
        let lc_int = self.bolt_spacing - self.bolts.hole_diameter();
        let bearing_int = self.bolts.bearing_capacity(self.plate_thickness, self.plate_fu, lc_int);
        let bolt_bearing = bearing_edge + (self.num_bolts - 1) as f64 * bearing_int;
        
        // Plate gross shear
        let agv = self.plate_depth * self.plate_thickness;
        let plate_shear = 0.6 * self.plate_fy * agv / 1000.0;
        
        // Block shear
        let anv = (self.plate_depth - self.num_bolts as f64 * self.bolts.hole_diameter()) * 
                  self.plate_thickness;
        let ant = (self.edge_distance - self.bolts.hole_diameter() / 2.0) * self.plate_thickness;
        let ubs = 1.0;
        let block_shear = 0.75 * (0.6 * self.plate_fu * anv + ubs * self.plate_fu * ant) / 1000.0;
        
        // Weld capacity
        let weld = WeldSpec::fillet(self.weld_size, self.plate_depth);
        let weld_cap = 2.0 * weld.total_capacity(); // Both sides
        
        // Governing
        let capacities = [bolt_shear, bolt_bearing, plate_shear, block_shear, weld_cap];
        let governing = capacities.iter().fold(f64::MAX, |a, &b| a.min(b));
        
        ShearTabDesign {
            bolt_shear_capacity: bolt_shear,
            bolt_bearing_capacity: bolt_bearing,
            plate_shear_capacity: plate_shear,
            plate_block_shear: block_shear,
            weld_capacity: weld_cap,
            governing_capacity: governing,
            utilization: vu / governing,
        }
    }
}

/// End plate moment connection
#[derive(Debug, Clone)]
pub struct EndPlateMoment {
    pub plate_width: f64,       // mm
    pub plate_depth: f64,       // mm
    pub plate_thickness: f64,   // mm
    pub stiffener_thickness: f64, // mm
    pub bolts: BoltSpec,
    pub bolt_rows: usize,       // Total rows
    pub bolts_per_row: usize,
    pub gage: f64,              // mm (bolt horizontal spacing)
    pub pitch: f64,             // mm (bolt vertical spacing)
    pub pfi: f64,               // mm (distance from flange to first bolt)
    pub pfo: f64,               // mm (extension beyond flange)
    pub beam_depth: f64,        // mm
    pub beam_flange_width: f64, // mm
    pub beam_flange_thick: f64, // mm
    pub beam_web_thick: f64,    // mm
    pub plate_fy: f64,          // MPa
    pub beam_fy: f64,           // MPa
}

/// End plate moment capacity
#[derive(Debug, Clone)]
pub struct EndPlateCapacity {
    pub bolt_tension_capacity: f64,     // kN·m
    pub plate_bending_capacity: f64,    // kN·m
    pub beam_flange_capacity: f64,      // kN·m
    pub governing_capacity: f64,        // kN·m
    pub shear_capacity: f64,            // kN
}

impl EndPlateMoment {
    /// Create 4-bolt unstiffened end plate
    pub fn four_bolt(beam_depth: f64, bf: f64, tf: f64, tw: f64) -> Self {
        EndPlateMoment {
            plate_width: bf + 25.0,
            plate_depth: beam_depth + 100.0,
            plate_thickness: 20.0,
            stiffener_thickness: 0.0,
            bolts: BoltSpec::a325(22.0),
            bolt_rows: 2,
            bolts_per_row: 2,
            gage: 140.0,
            pitch: 75.0,
            pfi: 50.0,
            pfo: 50.0,
            beam_depth,
            beam_flange_width: bf,
            beam_flange_thick: tf,
            beam_web_thick: tw,
            plate_fy: 250.0,
            beam_fy: 345.0,
        }
    }

    /// Create 8-bolt stiffened end plate
    pub fn eight_bolt_stiffened(beam_depth: f64, bf: f64, tf: f64, tw: f64) -> Self {
        EndPlateMoment {
            plate_width: bf + 25.0,
            plate_depth: beam_depth + 200.0,
            plate_thickness: 25.0,
            stiffener_thickness: 12.0,
            bolts: BoltSpec::a490(24.0),
            bolt_rows: 4,
            bolts_per_row: 2,
            gage: 140.0,
            pitch: 75.0,
            pfi: 50.0,
            pfo: 75.0,
            beam_depth,
            beam_flange_width: bf,
            beam_flange_thick: tf,
            beam_web_thick: tw,
            plate_fy: 345.0,
            beam_fy: 345.0,
        }
    }

    /// Calculate moment capacity
    pub fn capacity(&self) -> EndPlateCapacity {
        // Lever arm for bolt forces
        let d = self.beam_depth - self.beam_flange_thick;
        
        // Bolt tension capacity
        let pt = self.bolts.tension_capacity();
        let num_tension_bolts = self.bolt_rows * self.bolts_per_row / 2;
        let bolt_moment = pt * num_tension_bolts as f64 * d / 1000.0;
        
        // Plate bending (yield line theory - simplified)
        let tp = self.plate_thickness;
        let bp = self.plate_width;
        let s = self.gage / 2.0 - self.beam_web_thick / 2.0;
        
        let mp = self.plate_fy * bp * tp.powi(2) / 4.0 / 1e6;
        let plate_moment = 2.0 * mp * d / (self.pfi + s) * 1000.0;
        
        // Beam flange capacity
        let af = self.beam_flange_width * self.beam_flange_thick;
        let flange_force = self.beam_fy * af / 1000.0;
        let flange_moment = flange_force * d / 1000.0;
        
        // Shear capacity (through bolts)
        let shear_bolts = self.bolt_rows * self.bolts_per_row;
        let shear_cap = shear_bolts as f64 * self.bolts.shear_capacity();
        
        let governing = bolt_moment.min(plate_moment).min(flange_moment);
        
        EndPlateCapacity {
            bolt_tension_capacity: bolt_moment,
            plate_bending_capacity: plate_moment,
            beam_flange_capacity: flange_moment,
            governing_capacity: governing,
            shear_capacity: shear_cap,
        }
    }
}

/// Column base plate
#[derive(Debug, Clone)]
pub struct BasePlate {
    pub width: f64,             // mm (B)
    pub length: f64,            // mm (N)
    pub thickness: f64,         // mm
    pub column_depth: f64,      // mm (d)
    pub column_width: f64,      // mm (bf)
    pub plate_fy: f64,          // MPa
    pub concrete_fc: f64,       // MPa
    pub anchor_diameter: f64,   // mm
    pub anchor_embedment: f64,  // mm
    pub num_anchors: usize,
}

/// Base plate design results
#[derive(Debug, Clone)]
pub struct BasePlateDesign {
    pub bearing_capacity: f64,      // kN
    pub required_area: f64,         // mm²
    pub required_thickness: f64,    // mm
    pub anchor_tension: f64,        // kN per anchor
    pub anchor_capacity: f64,       // kN per anchor
    pub adequate: bool,
}

impl BasePlate {
    /// Create base plate for column
    pub fn new(col_depth: f64, col_width: f64) -> Self {
        BasePlate {
            width: col_width + 150.0,
            length: col_depth + 150.0,
            thickness: 25.0,
            column_depth: col_depth,
            column_width: col_width,
            plate_fy: 250.0,
            concrete_fc: 25.0,
            anchor_diameter: 24.0,
            anchor_embedment: 300.0,
            num_anchors: 4,
        }
    }

    /// Design for axial load only
    pub fn design_axial(&self, pu: f64) -> BasePlateDesign {
        let a1 = self.width * self.length;
        
        // Bearing on full area
        let phi_pp = 0.65 * 0.85 * self.concrete_fc * a1 / 1000.0;
        
        // Required area
        let a_req = pu * 1000.0 / (0.65 * 0.85 * self.concrete_fc);
        
        // Required thickness (cantilever method)
        let m = (self.length - 0.95 * self.column_depth) / 2.0;
        let n = (self.width - 0.8 * self.column_width) / 2.0;
        let lambda = 2.0 * (self.column_depth * self.column_width).sqrt() / 
                    (self.column_depth + self.column_width);
        let x = ((4.0 * self.column_depth * self.column_width / a1) / 
                (1.0 + (1.0 - 4.0 * self.column_depth * self.column_width / a1).sqrt())).min(1.0);
        let lambda_n = lambda * x.sqrt().min(1.0);
        let l_eff = (m.max(n).max(lambda_n * (self.column_depth * self.column_width).sqrt() / 4.0)).max(1.0);
        
        let fp = pu / a1 * 1000.0; // MPa
        let t_req = l_eff * (2.0 * fp / (0.9 * self.plate_fy)).sqrt();
        
        BasePlateDesign {
            bearing_capacity: phi_pp,
            required_area: a_req,
            required_thickness: t_req,
            anchor_tension: 0.0,
            anchor_capacity: self.anchor_capacity(),
            adequate: pu <= phi_pp && t_req <= self.thickness,
        }
    }

    /// Design for axial plus moment
    pub fn design_moment(&self, pu: f64, mu: f64) -> BasePlateDesign {
        let a1 = self.width * self.length;
        let s = self.width * self.length.powi(2) / 6.0;
        
        // Eccentricity
        let e = mu / pu.max(0.001) * 1000.0; // mm
        let n = self.length;
        
        if e <= n / 6.0 {
            // No tension - trapezoidal pressure
            let fp_max = pu * 1000.0 / a1 + mu * 1e6 / s;
            let _fp_min = pu * 1000.0 / a1 - mu * 1e6 / s;
            
            let phi_pp = 0.65 * 0.85 * self.concrete_fc;
            
            BasePlateDesign {
                bearing_capacity: phi_pp * a1 / 1000.0,
                required_area: a1,
                required_thickness: self.thickness,
                anchor_tension: 0.0,
                anchor_capacity: self.anchor_capacity(),
                adequate: fp_max <= phi_pp,
            }
        } else {
            // Tension in anchors
            let fp_max = 0.85 * self.concrete_fc;
            let y = 3.0 * (n / 2.0 - e); // Bearing length (approximate)
            let y = y.max(0.0).min(n);
            
            let c = fp_max * self.width * y / 1000.0; // Compression force
            let t = c - pu; // Tension force
            
            let t_per_anchor = t / (self.num_anchors / 2) as f64;
            
            BasePlateDesign {
                bearing_capacity: c,
                required_area: self.width * y,
                required_thickness: self.thickness,
                anchor_tension: t_per_anchor.max(0.0),
                anchor_capacity: self.anchor_capacity(),
                adequate: t_per_anchor <= self.anchor_capacity(),
            }
        }
    }

    /// Anchor capacity
    fn anchor_capacity(&self) -> f64 {
        let ab = PI * (self.anchor_diameter / 2.0).powi(2);
        let fut = 400.0; // Anchor tensile strength (MPa)
        
        // Steel strength
        let phi_ns = 0.75 * fut * ab / 1000.0;
        
        // Concrete breakout (simplified)
        let hef = self.anchor_embedment;
        let anc = 9.0 * hef.powi(2);
        let phi_ncb = 0.7 * 10.0 * self.concrete_fc.sqrt() * anc / 1000.0;
        
        phi_ns.min(phi_ncb)
    }
}

/// Bracing gusset plate
#[derive(Debug, Clone)]
pub struct GussetPlate {
    pub thickness: f64,         // mm
    pub brace_force: f64,       // kN (tension or compression)
    pub brace_width: f64,       // mm
    pub brace_thickness: f64,   // mm
    pub plate_fy: f64,          // MPa
    pub plate_fu: f64,          // MPa
    pub connection_type: GussetConnection,
}

/// Gusset connection method
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum GussetConnection {
    Welded,
    Bolted,
}

/// Gusset design results
#[derive(Debug, Clone)]
pub struct GussetDesign {
    pub whitmore_width: f64,        // mm
    pub block_shear: f64,           // kN
    pub buckling_capacity: f64,     // kN
    pub weld_length: f64,           // mm (if welded)
    pub num_bolts: usize,           // (if bolted)
    pub adequate: bool,
}

impl GussetPlate {
    /// Create gusset plate
    pub fn new(brace_force: f64, brace_width: f64, brace_thick: f64) -> Self {
        let t = if brace_force.abs() > 500.0 { 16.0 } else { 12.0 };
        
        GussetPlate {
            thickness: t,
            brace_force,
            brace_width,
            brace_thickness: brace_thick,
            plate_fy: 250.0,
            plate_fu: 400.0,
            connection_type: GussetConnection::Welded,
        }
    }

    /// Design gusset
    pub fn design(&self, connection_length: f64, _angle: f64) -> GussetDesign {
        // Whitmore section (30° spread)
        let whitmore = self.brace_width + 2.0 * connection_length * 30.0_f64.to_radians().tan();
        
        // Tension yielding on Whitmore
        let pn_yield = self.plate_fy * whitmore * self.thickness / 1000.0;
        
        // Block shear (simplified)
        let agv = 2.0 * connection_length * self.thickness;
        let ant = whitmore * self.thickness;
        let pn_block = 0.6 * self.plate_fu * agv / 1000.0 + 
                      self.plate_fu * ant / 1000.0;
        
        // Buckling (compression)
        let l_avg = (connection_length * 2.0 + self.brace_width) / 3.0;
        let r = self.thickness / 12.0_f64.sqrt();
        let kl_r = 0.65 * l_avg / r;
        
        let fe = PI.powi(2) * 200000.0 / kl_r.powi(2);
        let fcr = if kl_r <= 4.71 * (200000.0 / self.plate_fy).sqrt() {
            self.plate_fy * (0.658_f64.powf(self.plate_fy / fe))
        } else {
            0.877 * fe
        };
        
        let pn_buckling = 0.9 * fcr * whitmore * self.thickness / 1000.0;
        
        // Connection design
        let (weld_length, num_bolts) = match self.connection_type {
            GussetConnection::Welded => {
                let weld = WeldSpec::fillet(6.0, 1.0);
                let cap_per_mm = weld.capacity_per_mm();
                let required_length = self.brace_force.abs() / (2.0 * cap_per_mm);
                (required_length, 0)
            }
            GussetConnection::Bolted => {
                let bolt = BoltSpec::a325(20.0);
                let num = (self.brace_force.abs() / bolt.shear_capacity()).ceil() as usize;
                (0.0, num.max(2))
            }
        };
        
        let capacity = pn_yield.min(pn_block).min(pn_buckling);
        let adequate = self.brace_force.abs() <= 0.9 * capacity;
        
        GussetDesign {
            whitmore_width: whitmore,
            block_shear: 0.75 * pn_block,
            buckling_capacity: pn_buckling,
            weld_length,
            num_bolts,
            adequate,
        }
    }
}

/// Splice connection
#[derive(Debug, Clone)]
pub struct FlangeSplice {
    pub flange_width: f64,      // mm
    pub flange_thickness: f64,  // mm
    pub plate_thickness: f64,   // mm
    pub bolts: BoltSpec,
    pub bolt_rows: usize,
    pub bolts_per_row: usize,
    pub plate_fy: f64,          // MPa
    pub plate_fu: f64,          // MPa
}

impl FlangeSplice {
    /// Create flange splice
    pub fn new(bf: f64, tf: f64) -> Self {
        FlangeSplice {
            flange_width: bf,
            flange_thickness: tf,
            plate_thickness: tf,
            bolts: BoltSpec::a325(22.0),
            bolt_rows: 2,
            bolts_per_row: 4,
            plate_fy: 250.0,
            plate_fu: 400.0,
        }
    }

    /// Splice capacity
    pub fn capacity(&self) -> f64 {
        let n = self.bolt_rows * self.bolts_per_row;
        
        // Bolt shear (double shear)
        let bolt_cap = 2.0 * n as f64 * self.bolts.shear_capacity();
        
        // Gross section yield
        let ag = self.flange_width * self.flange_thickness;
        let yield_cap = 0.9 * self.plate_fy * ag / 1000.0;
        
        // Net section fracture
        let an = (self.flange_width - self.bolts_per_row as f64 * self.bolts.hole_diameter()) *
                 self.flange_thickness;
        let fracture_cap = 0.75 * self.plate_fu * an / 1000.0;
        
        bolt_cap.min(yield_cap).min(fracture_cap)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bolt_spec() {
        let bolt = BoltSpec::a325(22.0);
        
        assert!(bolt.shear_capacity() > 0.0);
        assert!(bolt.tension_capacity() > 0.0);
        assert!(bolt.hole_diameter() > bolt.diameter);
    }

    #[test]
    fn test_bolt_bearing() {
        let bolt = BoltSpec::a325(20.0);
        let bearing = bolt.bearing_capacity(12.0, 400.0, 30.0);
        
        assert!(bearing > 0.0);
    }

    #[test]
    fn test_weld_spec() {
        let weld = WeldSpec::fillet(8.0, 200.0);
        
        assert!(weld.effective_throat() < weld.size);
        assert!(weld.capacity_per_mm() > 0.0);
        assert!(weld.total_capacity() > 0.0);
    }

    #[test]
    fn test_shear_tab_creation() {
        let tab = ShearTab::new(150.0, 400.0);
        
        assert!(tab.num_bolts >= 2);
        assert!(tab.plate_depth > 0.0);
    }

    #[test]
    fn test_shear_tab_design() {
        let tab = ShearTab::new(150.0, 400.0);
        let design = tab.design(150.0);
        
        assert!(design.governing_capacity > 0.0);
        assert!(design.utilization > 0.0);
    }

    #[test]
    fn test_end_plate_four_bolt() {
        let ep = EndPlateMoment::four_bolt(400.0, 180.0, 14.0, 8.0);
        let capacity = ep.capacity();
        
        assert!(capacity.governing_capacity > 0.0);
        assert!(capacity.shear_capacity > 0.0);
    }

    #[test]
    fn test_end_plate_eight_bolt() {
        let ep = EndPlateMoment::eight_bolt_stiffened(600.0, 220.0, 18.0, 12.0);
        let capacity = ep.capacity();
        
        assert!(capacity.governing_capacity > capacity.shear_capacity / 10.0);
    }

    #[test]
    fn test_base_plate_creation() {
        let bp = BasePlate::new(300.0, 300.0);
        
        assert!(bp.width > bp.column_width);
        assert!(bp.length > bp.column_depth);
    }

    #[test]
    fn test_base_plate_axial() {
        let bp = BasePlate::new(300.0, 300.0);
        let design = bp.design_axial(1000.0);
        
        assert!(design.bearing_capacity > 0.0);
        assert!(design.required_thickness > 0.0);
    }

    #[test]
    fn test_base_plate_moment() {
        let bp = BasePlate::new(300.0, 300.0);
        let design = bp.design_moment(500.0, 100.0);
        
        assert!(design.bearing_capacity > 0.0);
    }

    #[test]
    fn test_gusset_plate() {
        let gusset = GussetPlate::new(400.0, 150.0, 10.0);
        let design = gusset.design(200.0, 45.0);
        
        assert!(design.whitmore_width > gusset.brace_width);
        assert!(design.block_shear > 0.0);
    }

    #[test]
    fn test_flange_splice() {
        let splice = FlangeSplice::new(200.0, 16.0);
        let capacity = splice.capacity();
        
        assert!(capacity > 0.0);
    }

    #[test]
    fn test_bolt_grades() {
        let a325 = BoltGrade::A325;
        let a490 = BoltGrade::A490;
        
        assert!(a490.fnt() > a325.fnt());
        assert!(a490.fnv() > a325.fnv());
    }

    #[test]
    fn test_electrode_types() {
        let e70 = ElectrodeType::E70;
        let e90 = ElectrodeType::E90;
        
        assert!(e90.fexx() > e70.fexx());
    }
}
