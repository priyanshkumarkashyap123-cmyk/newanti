// ============================================================================
// PRECAST CONCRETE CONNECTIONS MODULE
// Corbels, dapped ends, bearing pads - PCI, ACI 318, fib
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// CONNECTION TYPES
// ============================================================================

/// Precast connection type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConnectionType {
    /// Corbel (bracket)
    Corbel,
    /// Dapped end (notched beam end)
    DappedEnd,
    /// Bearing pad (elastomeric/PTFE)
    BearingPad,
    /// Mechanical splice
    MechanicalSplice,
    /// Grouted sleeve
    GroutedSleeve,
    /// Bolted connection
    Bolted,
    /// Welded plate
    WeldedPlate,
}

/// Ductility class
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DuctilityClass {
    /// Low ductility (non-seismic)
    Low,
    /// Moderate ductility
    Moderate,
    /// High ductility (special seismic)
    High,
}

// ============================================================================
// CORBEL DESIGN (ACI 318 / PCI)
// ============================================================================

/// Corbel connection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Corbel {
    /// Depth at column face (mm)
    pub depth: f64,
    /// Width (mm)
    pub width: f64,
    /// Projection (mm)
    pub projection: f64,
    /// Concrete strength f'c (MPa)
    pub fc: f64,
    /// Steel yield strength fy (MPa)
    pub fy: f64,
    /// Primary tension steel area (mm²)
    pub as_main: f64,
    /// Horizontal shear friction steel (mm²)
    pub as_h: f64,
    /// Closed stirrup area per leg (mm²)
    pub as_stirrup: f64,
    /// Number of stirrup sets
    pub num_stirrups: u32,
}

impl Corbel {
    pub fn new(depth: f64, width: f64, projection: f64, fc: f64) -> Self {
        Self {
            depth,
            width,
            projection,
            fc,
            fy: 500.0,
            as_main: 0.0,
            as_h: 0.0,
            as_stirrup: 0.0,
            num_stirrups: 2,
        }
    }
    
    /// Shear span to depth ratio (a/d)
    pub fn av_d_ratio(&self) -> f64 {
        self.projection / self.effective_depth()
    }
    
    /// Effective depth (mm)
    pub fn effective_depth(&self) -> f64 {
        self.depth - 50.0 // Assume 50mm cover
    }
    
    /// Is valid corbel? (a/d <= 1.0 per ACI)
    pub fn is_valid_corbel(&self) -> bool {
        self.av_d_ratio() <= 1.0
    }
    
    /// Maximum shear capacity (kN) - ACI 318
    pub fn max_shear_capacity(&self) -> f64 {
        let d = self.effective_depth();
        let b = self.width;
        
        // Vn <= 0.2 f'c bw d or (3.3 + 0.08 f'c) bw d
        let v1 = 0.2 * self.fc * b * d / 1000.0;
        let v2 = (3.3 + 0.08 * self.fc) * b * d / 1000.0;
        let v3 = 11.0 * b * d / 1000.0; // Upper limit
        
        v1.min(v2).min(v3)
    }
    
    /// Required main reinforcement for shear (mm²)
    pub fn required_as_shear(&self, vu: f64, nu: f64) -> f64 {
        let d = self.effective_depth();
        let a = self.projection;
        let phi = 0.75;
        
        // Strut-and-tie approach
        let mu = vu * a + nu * (self.depth - d);
        
        // Tension from moment + direct tension
        let tu = mu / (0.9 * d) + nu;
        
        tu * 1000.0 / (phi * self.fy)
    }
    
    /// Required horizontal reinforcement (mm²)
    pub fn required_as_horizontal(&self, vu: f64) -> f64 {
        let phi = 0.75;
        let mu = 1.4; // Friction coefficient for concrete cast monolithically
        
        // Shear friction: Vn = mu * Avf * fy
        vu * 1000.0 / (phi * mu * self.fy)
    }
    
    /// Total required primary steel (mm²)
    pub fn required_as_total(&self, vu: f64, nu: f64) -> f64 {
        let as_shear = self.required_as_shear(vu, nu);
        let as_h = self.required_as_horizontal(vu);
        
        // ACI: As >= (2/3) * Avf + An
        let as_comb = 2.0 / 3.0 * as_h + nu * 1000.0 / (0.75 * self.fy);
        
        as_shear.max(as_comb)
    }
    
    /// Minimum reinforcement (mm²)
    pub fn min_reinforcement(&self) -> f64 {
        let b = self.width;
        let d = self.effective_depth();
        
        0.04 * self.fc / self.fy * b * d
    }
    
    /// Design corbel
    pub fn design(&mut self, vu: f64, nu: f64) {
        let as_req = self.required_as_total(vu, nu);
        let as_min = self.min_reinforcement();
        
        self.as_main = as_req.max(as_min);
        self.as_h = self.required_as_horizontal(vu);
        
        // Stirrups: at least 0.5 * (As - An) distributed in 2/3 depth
        let an = nu.max(0.0) * 1000.0 / (0.75 * self.fy);
        self.as_stirrup = 0.5 * (self.as_main - an) / (self.num_stirrups as f64);
    }
    
    /// Bearing capacity at load point (kN)
    pub fn bearing_capacity(&self, bearing_width: f64) -> f64 {
        let a1 = bearing_width * self.width;
        
        // A2 assumes 2:1 spread
        let a2 = (bearing_width + 4.0 * self.projection) * self.width;
        let ratio = (a2 / a1).sqrt().min(2.0);
        
        0.85 * self.fc * a1 * ratio / 1000.0
    }
}

// ============================================================================
// DAPPED END BEAM
// ============================================================================

/// Dapped (notched) beam end
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DappedEnd {
    /// Full beam depth (mm)
    pub beam_depth: f64,
    /// Beam width (mm)
    pub beam_width: f64,
    /// Dap depth (reduced section depth, mm)
    pub dap_depth: f64,
    /// Dap length (mm)
    pub dap_length: f64,
    /// Concrete strength (MPa)
    pub fc: f64,
    /// Steel yield strength (MPa)
    pub fy: f64,
}

impl DappedEnd {
    pub fn new(beam_depth: f64, beam_width: f64, dap_depth: f64, dap_length: f64) -> Self {
        Self {
            beam_depth,
            beam_width,
            dap_depth,
            dap_length,
            fc: 40.0,
            fy: 500.0,
        }
    }
    
    /// Nib depth (remaining after dap)
    pub fn nib_depth(&self) -> f64 {
        self.beam_depth - self.dap_depth
    }
    
    /// Effective depth at dap (mm)
    pub fn effective_depth_nib(&self) -> f64 {
        self.nib_depth() - 40.0
    }
    
    /// Effective depth at full section (mm)
    pub fn effective_depth_full(&self) -> f64 {
        self.beam_depth - 50.0
    }
    
    /// Hanger reinforcement (mm²) - carries shear to upper portion
    pub fn required_hanger(&self, vu: f64) -> f64 {
        let phi = 0.75;
        
        // Ah >= Vu / (phi * fy)
        vu * 1000.0 / (phi * self.fy)
    }
    
    /// Nib flexure reinforcement (mm²)
    pub fn required_nib_flexure(&self, vu: f64) -> f64 {
        let phi = 0.9;
        let d = self.effective_depth_nib();
        let a = self.dap_length * 0.5; // Assume load at mid-nib
        
        let mu = vu * a / 1000.0; // kN·m
        
        mu * 1e6 / (phi * self.fy * 0.9 * d)
    }
    
    /// Horizontal shear friction steel at re-entrant corner (mm²)
    pub fn required_shear_friction(&self, vu: f64) -> f64 {
        let phi = 0.75;
        let mu = 1.0; // Conservative for potential crack
        
        vu * 1000.0 / (phi * mu * self.fy)
    }
    
    /// Diagonal tension at re-entrant corner (mm²)
    pub fn required_diagonal(&self, vu: f64, nu: f64) -> f64 {
        let phi = 0.75;
        
        // 45° strut
        let tu = (vu.powi(2) + nu.powi(2)).sqrt();
        tu * 1000.0 / (phi * self.fy)
    }
    
    /// Full section shear capacity (kN)
    pub fn full_section_shear(&self) -> f64 {
        let d = self.effective_depth_full();
        let b = self.beam_width;
        
        0.17 * self.fc.sqrt() * b * d / 1000.0
    }
    
    /// Nib shear capacity (kN)
    pub fn nib_shear_capacity(&self) -> f64 {
        let d = self.effective_depth_nib();
        let b = self.beam_width;
        
        0.17 * self.fc.sqrt() * b * d / 1000.0
    }
}

// ============================================================================
// BEARING PAD DESIGN
// ============================================================================

/// Bearing pad type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PadType {
    /// Plain elastomeric (unreinforced)
    PlainElastomeric,
    /// Steel-reinforced elastomeric
    ReinforcedElastomeric,
    /// Cotton duck pad
    CottonDuck,
    /// PTFE sliding bearing
    Ptfe,
    /// Pot bearing
    Pot,
}

/// Elastomeric bearing pad (AASHTO)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BearingPad {
    /// Pad type
    pub pad_type: PadType,
    /// Length parallel to beam (mm)
    pub length: f64,
    /// Width (mm)
    pub width: f64,
    /// Total thickness (mm)
    pub thickness: f64,
    /// Individual layer thickness (mm)
    pub layer_thickness: f64,
    /// Number of steel shims
    pub num_shims: u32,
    /// Shear modulus G (MPa)
    pub shear_modulus: f64,
    /// Hardness (Shore A durometer)
    pub hardness: u32,
}

impl BearingPad {
    pub fn plain_pad(length: f64, width: f64, thickness: f64) -> Self {
        Self {
            pad_type: PadType::PlainElastomeric,
            length,
            width,
            thickness,
            layer_thickness: thickness,
            num_shims: 0,
            shear_modulus: 0.9, // 60 durometer typical
            hardness: 60,
        }
    }
    
    pub fn reinforced_pad(length: f64, width: f64, thickness: f64, num_layers: u32) -> Self {
        let shim_thickness = 3.0; // mm per steel shim
        let total_rubber = thickness - num_layers as f64 * shim_thickness;
        let layer_t = total_rubber / (num_layers as f64 + 1.0);
        
        Self {
            pad_type: PadType::ReinforcedElastomeric,
            length,
            width,
            thickness,
            layer_thickness: layer_t,
            num_shims: num_layers,
            shear_modulus: 0.9,
            hardness: 60,
        }
    }
    
    /// Plan area (mm²)
    pub fn area(&self) -> f64 {
        self.length * self.width
    }
    
    /// Shape factor S
    pub fn shape_factor(&self) -> f64 {
        let l = self.length;
        let w = self.width;
        let t = self.layer_thickness;
        
        l * w / (2.0 * t * (l + w))
    }
    
    /// Compressive stress limit (MPa) - plain pad
    pub fn compressive_stress_limit_plain(&self) -> f64 {
        let s = self.shape_factor();
        
        // AASHTO: σs ≤ G*S ≤ 5.5 MPa for plain pads
        (self.shear_modulus * s).min(5.5)
    }
    
    /// Compressive stress limit (MPa) - reinforced pad
    pub fn compressive_stress_limit_reinforced(&self) -> f64 {
        let s = self.shape_factor();
        let g = self.shear_modulus;
        
        (1.66 * g * s).min(11.0) // Max 11 MPa (1600 psi)
    }
    
    /// Compressive capacity (kN)
    pub fn compressive_capacity(&self) -> f64 {
        let sigma = match self.pad_type {
            PadType::PlainElastomeric => self.compressive_stress_limit_plain(),
            _ => self.compressive_stress_limit_reinforced(),
        };
        
        sigma * self.area() / 1000.0
    }
    
    /// Shear strain capacity
    pub fn shear_strain_capacity(&self) -> f64 {
        match self.pad_type {
            PadType::PlainElastomeric => 0.20, // 20%
            PadType::ReinforcedElastomeric => 0.50, // 50%
            _ => 0.70,
        }
    }
    
    /// Horizontal movement capacity (mm)
    pub fn movement_capacity(&self) -> f64 {
        let hrt = self.thickness - self.num_shims as f64 * 3.0; // Total rubber thickness
        
        self.shear_strain_capacity() * hrt
    }
    
    /// Horizontal force for given displacement (kN)
    pub fn horizontal_force(&self, displacement: f64) -> f64 {
        let hrt = self.thickness - self.num_shims as f64 * 3.0;
        let strain = displacement / hrt;
        
        self.shear_modulus * strain * self.area() / 1000.0
    }
    
    /// Rotation capacity (radians)
    pub fn rotation_capacity(&self) -> f64 {
        let s = self.shape_factor();
        let n = (self.num_shims + 1) as f64;
        
        // Simplified - depends on compressive load
        0.005 * n / s
    }
    
    /// Compressive deflection (mm)
    pub fn compressive_deflection(&self, load: f64) -> f64 {
        let stress = load * 1000.0 / self.area();
        let s = self.shape_factor();
        let ec = 3.0 * self.shear_modulus * s.powi(2); // Effective modulus
        // Only rubber layers compress - subtract steel shim thickness
        let hrt = self.thickness - self.num_shims as f64 * 3.0;
        
        stress * hrt / ec
    }
    
    /// Stability check - thickness vs plan dimensions
    pub fn stability_ok(&self) -> bool {
        let min_dim = self.length.min(self.width);
        
        match self.pad_type {
            PadType::PlainElastomeric => self.thickness <= min_dim / 5.0,
            _ => self.thickness <= min_dim / 3.0,
        }
    }
}

// ============================================================================
// MECHANICAL SPLICE
// ============================================================================

/// Mechanical splice type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SpliceType {
    /// Grouted sleeve (NMB, etc.)
    GroutedSleeve,
    /// Threaded coupler
    Threaded,
    /// Swaged coupling
    Swaged,
    /// Bolted splice plate
    BoltedPlate,
}

/// Mechanical rebar splice
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MechanicalSplice {
    /// Splice type
    pub splice_type: SpliceType,
    /// Bar diameter (mm)
    pub bar_diameter: f64,
    /// Bar yield strength (MPa)
    pub fy: f64,
    /// Bar tensile strength (MPa)
    pub fu: f64,
    /// Splice length (mm)
    pub length: f64,
}

impl MechanicalSplice {
    pub fn grouted_sleeve(bar_diameter: f64) -> Self {
        Self {
            splice_type: SpliceType::GroutedSleeve,
            bar_diameter,
            fy: 500.0,
            fu: 600.0,
            length: bar_diameter * 8.0, // Typical
        }
    }
    
    /// Bar area (mm²)
    pub fn bar_area(&self) -> f64 {
        PI * self.bar_diameter.powi(2) / 4.0
    }
    
    /// Yield capacity (kN)
    pub fn yield_capacity(&self) -> f64 {
        self.bar_area() * self.fy / 1000.0
    }
    
    /// Ultimate capacity (kN)
    pub fn ultimate_capacity(&self) -> f64 {
        self.bar_area() * self.fu / 1000.0
    }
    
    /// Required splice capacity (kN) - Type 1
    pub fn required_capacity_type1(&self) -> f64 {
        1.25 * self.yield_capacity()
    }
    
    /// Required splice capacity (kN) - Type 2
    pub fn required_capacity_type2(&self) -> f64 {
        self.ultimate_capacity()
    }
    
    /// Minimum grout strength for grouted sleeve (MPa)
    pub fn min_grout_strength(&self) -> f64 {
        50.0 // Typical high-strength non-shrink grout
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_corbel_geometry() {
        let corbel = Corbel::new(500.0, 400.0, 300.0, 40.0);
        
        assert!(corbel.av_d_ratio() < 1.0);
        assert!(corbel.is_valid_corbel());
    }

    #[test]
    fn test_corbel_capacity() {
        let corbel = Corbel::new(500.0, 400.0, 300.0, 40.0);
        let v_max = corbel.max_shear_capacity();
        
        assert!(v_max > 500.0);
    }

    #[test]
    fn test_corbel_design() {
        let mut corbel = Corbel::new(500.0, 400.0, 300.0, 40.0);
        corbel.design(400.0, 50.0);
        
        assert!(corbel.as_main > corbel.min_reinforcement());
    }

    #[test]
    fn test_corbel_bearing() {
        let corbel = Corbel::new(500.0, 400.0, 300.0, 40.0);
        let cap = corbel.bearing_capacity(200.0);
        
        assert!(cap > 1000.0);
    }

    #[test]
    fn test_dapped_end() {
        let dap = DappedEnd::new(800.0, 400.0, 500.0, 200.0);
        
        assert!((dap.nib_depth() - 300.0).abs() < 0.1);
    }

    #[test]
    fn test_dapped_reinforcement() {
        let dap = DappedEnd::new(800.0, 400.0, 500.0, 200.0);
        let ah = dap.required_hanger(300.0);
        
        assert!(ah > 500.0);
    }

    #[test]
    fn test_plain_bearing_pad() {
        let pad = BearingPad::plain_pad(300.0, 200.0, 25.0);
        
        assert!(pad.shape_factor() > 2.0);
    }

    #[test]
    fn test_reinforced_bearing_pad() {
        let pad = BearingPad::reinforced_pad(400.0, 300.0, 75.0, 3);
        
        assert!(pad.num_shims == 3);
        assert!(pad.shape_factor() > pad.layer_thickness / 10.0);
    }

    #[test]
    fn test_bearing_capacity() {
        let pad = BearingPad::reinforced_pad(400.0, 300.0, 75.0, 3);
        let cap = pad.compressive_capacity();
        
        assert!(cap > 500.0);
    }

    #[test]
    fn test_bearing_movement() {
        let pad = BearingPad::reinforced_pad(400.0, 300.0, 75.0, 3);
        let mov = pad.movement_capacity();
        
        assert!(mov > 20.0);
    }

    #[test]
    fn test_bearing_stability() {
        let pad = BearingPad::reinforced_pad(400.0, 300.0, 75.0, 3);
        
        assert!(pad.stability_ok());
    }

    #[test]
    fn test_mechanical_splice() {
        let splice = MechanicalSplice::grouted_sleeve(32.0);
        
        assert!(splice.yield_capacity() > 350.0);
    }

    #[test]
    fn test_splice_capacity() {
        let splice = MechanicalSplice::grouted_sleeve(32.0);
        
        // Type 1: 1.25*fy = 1.25*500 = 625 MPa based
        // Type 2: fu = 600 MPa based
        // Type 1 requires higher capacity for splice qualification
        assert!(splice.required_capacity_type1() > 0.0);
        assert!(splice.required_capacity_type2() > 0.0);
    }

    #[test]
    fn test_ductility_class() {
        assert_ne!(DuctilityClass::Low, DuctilityClass::High);
    }
}
