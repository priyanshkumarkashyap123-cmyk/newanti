// ============================================================================
// TUNNEL & UNDERGROUND STRUCTURES MODULE  
// Cut-and-cover, bored tunnels, caverns - AASHTO LRFD, Eurocode 7
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// GROUND CONDITIONS
// ============================================================================

/// Rock mass class (Q-system)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RockMassClass {
    /// Q > 40: Exceptionally good
    Excellent,
    /// Q 10-40: Very good
    VeryGood,
    /// Q 4-10: Good
    Good,
    /// Q 1-4: Fair
    Fair,
    /// Q 0.1-1: Poor
    Poor,
    /// Q 0.01-0.1: Very poor
    VeryPoor,
    /// Q < 0.01: Exceptionally poor
    ExceptionallyPoor,
}

impl RockMassClass {
    /// Typical Q value
    pub fn typical_q(&self) -> f64 {
        match self {
            RockMassClass::Excellent => 60.0,
            RockMassClass::VeryGood => 20.0,
            RockMassClass::Good => 6.0,
            RockMassClass::Fair => 2.0,
            RockMassClass::Poor => 0.5,
            RockMassClass::VeryPoor => 0.05,
            RockMassClass::ExceptionallyPoor => 0.005,
        }
    }
    
    /// Support requirement factor
    pub fn support_factor(&self) -> f64 {
        match self {
            RockMassClass::Excellent => 0.0,
            RockMassClass::VeryGood => 0.1,
            RockMassClass::Good => 0.3,
            RockMassClass::Fair => 0.5,
            RockMassClass::Poor => 0.8,
            RockMassClass::VeryPoor => 1.0,
            RockMassClass::ExceptionallyPoor => 1.5,
        }
    }
}

/// Tunnel ground type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GroundType {
    /// Hard rock
    HardRock,
    /// Soft rock
    SoftRock,
    /// Dense sand/gravel
    GranularDense,
    /// Loose sand
    GranularLoose,
    /// Stiff clay
    CohesiveStiff,
    /// Soft clay
    CohesiveSoft,
    /// Mixed face
    MixedFace,
}

impl GroundType {
    /// Typical modulus (MPa)
    pub fn modulus(&self) -> f64 {
        match self {
            GroundType::HardRock => 10000.0,
            GroundType::SoftRock => 2000.0,
            GroundType::GranularDense => 100.0,
            GroundType::GranularLoose => 30.0,
            GroundType::CohesiveStiff => 50.0,
            GroundType::CohesiveSoft => 10.0,
            GroundType::MixedFace => 50.0,
        }
    }
    
    /// Poisson's ratio
    pub fn poisson(&self) -> f64 {
        match self {
            GroundType::HardRock => 0.2,
            GroundType::SoftRock => 0.25,
            GroundType::GranularDense => 0.3,
            GroundType::GranularLoose => 0.35,
            GroundType::CohesiveStiff => 0.35,
            GroundType::CohesiveSoft => 0.45,
            GroundType::MixedFace => 0.3,
        }
    }
}

// ============================================================================
// TUNNEL LINING DESIGN
// ============================================================================

/// Tunnel cross-section shape
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TunnelShape {
    /// Circular (TBM)
    Circular,
    /// Horseshoe (drill & blast)
    Horseshoe,
    /// Rectangular (cut & cover)
    Rectangular,
    /// Elliptical
    Elliptical,
}

/// Tunnel lining type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LiningType {
    /// Precast segmental (TBM)
    SegmentalConcrete,
    /// Cast-in-place concrete
    CastInPlace,
    /// Sprayed concrete (shotcrete)
    Shotcrete,
    /// Steel ribs with lagging
    SteelRibs,
    /// Composite (shotcrete + segments)
    Composite,
}

/// Tunnel lining design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelLining {
    /// Tunnel shape
    pub shape: TunnelShape,
    /// Internal diameter/width (m)
    pub internal_diameter: f64,
    /// Internal height (m) - for non-circular
    pub internal_height: f64,
    /// Lining thickness (mm)
    pub thickness: f64,
    /// Lining type
    pub lining_type: LiningType,
    /// Concrete grade (MPa)
    pub fck: f64,
    /// Cover depth (m)
    pub cover: f64,
    /// Ground type
    pub ground: GroundType,
}

impl TunnelLining {
    pub fn circular_tbm(diameter: f64, cover: f64) -> Self {
        Self {
            shape: TunnelShape::Circular,
            internal_diameter: diameter,
            internal_height: diameter,
            thickness: diameter * 35.0, // t/D ~ 1/30
            lining_type: LiningType::SegmentalConcrete,
            fck: 50.0,
            cover,
            ground: GroundType::CohesiveStiff,
        }
    }
    
    pub fn cut_and_cover(width: f64, height: f64, cover: f64) -> Self {
        Self {
            shape: TunnelShape::Rectangular,
            internal_diameter: width,
            internal_height: height,
            thickness: 500.0, // Typical wall thickness
            lining_type: LiningType::CastInPlace,
            fck: 40.0,
            cover,
            ground: GroundType::GranularDense,
        }
    }
    
    /// External diameter (m)
    pub fn external_diameter(&self) -> f64 {
        self.internal_diameter + 2.0 * self.thickness / 1000.0
    }
    
    /// Ring stiffness (kN·m²/m)
    pub fn ring_stiffness(&self) -> f64 {
        let e = 30000.0; // Concrete E (MPa)
        let i = (self.thickness / 1000.0).powi(3) / 12.0; // m⁴/m
        e * 1000.0 * i
    }
    
    /// Flexibility ratio
    pub fn flexibility_ratio(&self) -> f64 {
        let r = self.internal_diameter / 2.0 + self.thickness / 2000.0;
        self.ground.modulus() * r.powi(3) / (self.ring_stiffness())
    }
    
    /// Ground load on crown (kPa) - Terzaghi's rock load
    pub fn crown_pressure(&self) -> f64 {
        let h = self.cover;
        let gamma = 20.0; // kN/m³
        
        if h > 2.0 * self.external_diameter() {
            // Deep tunnel - arching
            gamma * self.external_diameter() * 0.3
        } else {
            // Shallow - full overburden
            gamma * h
        }
    }
    
    /// Lateral ground pressure (kPa)
    pub fn lateral_pressure(&self) -> f64 {
        let k0 = 1.0 - self.ground.poisson().sin(); // At rest coefficient
        let vertical = self.crown_pressure() + 20.0 * self.external_diameter() / 2.0;
        k0 * vertical
    }
    
    /// Maximum thrust in lining (kN/m)
    pub fn max_thrust(&self) -> f64 {
        let r = self.external_diameter() / 2.0;
        let p = self.crown_pressure();
        let f = self.flexibility_ratio();
        
        // Thrust depends on flexibility
        if f < 1.0 {
            // Stiff lining
            p * r * 0.9
        } else {
            // Flexible lining
            p * r * 0.7
        }
    }
    
    /// Maximum moment in lining (kN·m/m)
    pub fn max_moment(&self) -> f64 {
        let r = self.external_diameter() / 2.0;
        let p_diff = (self.crown_pressure() - self.lateral_pressure()).abs();
        
        p_diff * r.powi(2) / 6.0
    }
    
    /// Required reinforcement (mm²/m)
    pub fn required_reinforcement(&self) -> f64 {
        let n = self.max_thrust();
        let m = self.max_moment();
        let t = self.thickness / 1000.0; // m
        let d = t - 0.050; // Effective depth
        
        let fyd = 435.0; // Steel design strength (MPa)
        let fcd = self.fck / 1.5;
        
        // Simplified section design
        let z = 0.9 * d;
        let as_moment = m * 1000.0 / (fyd * z); // mm²/m
        let as_thrust = (n - fcd * t * 1000.0 / 2.0).max(0.0) * 1000.0 / fyd;
        
        (as_moment + as_thrust / 2.0).max(0.002 * t * 1e6)
    }
}

// ============================================================================
// SEGMENTAL LINING
// ============================================================================

/// Segment configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentRing {
    /// Number of segments in ring (excluding key)
    pub num_segments: u32,
    /// Ring width (m)
    pub width: f64,
    /// Segment thickness (mm)
    pub thickness: f64,
    /// Key segment angle (degrees)
    pub key_angle: f64,
    /// Taper ratio (mm/m)
    pub taper: f64,
}

impl SegmentRing {
    pub fn standard_tbm(diameter: f64) -> Self {
        let n = if diameter < 6.0 { 5 } else if diameter < 10.0 { 6 } else { 7 };
        
        Self {
            num_segments: n,
            width: 1.5,
            thickness: (diameter * 35.0).min(400.0), // Limited to 400mm
            key_angle: 22.5,
            taper: 40.0,
        }
    }
    
    /// Segment angle (degrees)
    pub fn segment_angle(&self) -> f64 {
        (360.0 - self.key_angle) / (self.num_segments as f64)
    }
    
    /// Minimum curve radius (m)
    pub fn min_curve_radius(&self) -> f64 {
        self.width * 1000.0 / self.taper
    }
    
    /// Segment weight (kN) - approximate
    pub fn segment_weight(&self, inner_radius: f64) -> f64 {
        let angle_rad = self.segment_angle() * PI / 180.0;
        let r_outer = inner_radius + self.thickness / 1000.0;
        let area = (r_outer.powi(2) - inner_radius.powi(2)) * angle_rad / 2.0;
        let volume = area * self.width;
        
        volume * 25.0 // kN/m³ concrete
    }
    
    /// Joint capacity - simplified (kN/m)
    pub fn joint_moment_capacity(&self) -> f64 {
        let t = self.thickness / 1000.0;
        // Typically 70% of continuous section
        0.7 * 30.0 * t.powi(2) / 6.0 * 1000.0 // Using fcd = 30 MPa
    }
}

// ============================================================================
// TUNNEL BORING MACHINE
// ============================================================================

/// TBM type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TbmType {
    /// Open face
    OpenFace,
    /// Slurry shield
    SlurryShield,
    /// Earth pressure balance
    Epb,
    /// Hard rock TBM
    HardRock,
    /// Mix-shield
    MixShield,
}

impl TbmType {
    /// Suitable ground conditions
    pub fn suitable_ground(&self) -> Vec<GroundType> {
        match self {
            TbmType::OpenFace => vec![GroundType::HardRock, GroundType::SoftRock],
            TbmType::SlurryShield => vec![GroundType::GranularLoose, GroundType::GranularDense],
            TbmType::Epb => vec![GroundType::CohesiveSoft, GroundType::CohesiveStiff, GroundType::GranularDense],
            TbmType::HardRock => vec![GroundType::HardRock],
            TbmType::MixShield => vec![GroundType::MixedFace, GroundType::GranularDense, GroundType::CohesiveStiff],
        }
    }
}

/// TBM parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TbmParameters {
    /// TBM type
    pub tbm_type: TbmType,
    /// Excavation diameter (m)
    pub diameter: f64,
    /// Thrust force (kN)
    pub thrust: f64,
    /// Torque (kN·m)
    pub torque: f64,
    /// Cutterhead power (kW)
    pub power: f64,
}

impl TbmParameters {
    pub fn for_ground(diameter: f64, ground: GroundType) -> Self {
        let tbm_type = match ground {
            GroundType::HardRock => TbmType::HardRock,
            GroundType::SoftRock => TbmType::OpenFace,
            GroundType::GranularLoose | GroundType::GranularDense => TbmType::SlurryShield,
            GroundType::CohesiveSoft | GroundType::CohesiveStiff => TbmType::Epb,
            GroundType::MixedFace => TbmType::MixShield,
        };
        
        // Approximate thrust based on face area
        let face_area = PI * diameter.powi(2) / 4.0;
        let thrust = match ground {
            GroundType::HardRock => face_area * 1500.0,
            GroundType::SoftRock => face_area * 800.0,
            _ => face_area * 400.0,
        };
        
        // Torque ~ 10% of thrust × radius
        let torque = 0.1 * thrust * diameter / 2.0;
        
        // Power ~ torque × RPM
        let rpm = 2.0;
        let power = torque * rpm * 2.0 * PI / 60.0;
        
        Self {
            tbm_type,
            diameter,
            thrust,
            torque,
            power,
        }
    }
    
    /// Estimated advance rate (m/day)
    pub fn advance_rate(&self) -> f64 {
        match self.tbm_type {
            TbmType::HardRock => 8.0,
            TbmType::OpenFace => 15.0,
            TbmType::SlurryShield => 12.0,
            TbmType::Epb => 15.0,
            TbmType::MixShield => 10.0,
        }
    }
    
    /// Face support pressure (kPa)
    pub fn face_pressure(&self, cover: f64, water_head: f64) -> f64 {
        let earth_pressure = 18.0 * cover; // kPa
        let water_pressure = 10.0 * water_head; // kPa
        
        earth_pressure + water_pressure + 20.0 // Safety margin
    }
}

// ============================================================================
// CAVERN DESIGN
// ============================================================================

/// Underground cavern
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cavern {
    /// Span (m)
    pub span: f64,
    /// Height (m)
    pub height: f64,
    /// Length (m)
    pub length: f64,
    /// Cover depth (m)
    pub cover: f64,
    /// Rock mass Q value
    pub q_value: f64,
}

impl Cavern {
    pub fn new(span: f64, height: f64, length: f64, cover: f64, q_value: f64) -> Self {
        Self { span, height, length, cover, q_value }
    }
    
    /// Equivalent span (m)
    pub fn equivalent_span(&self) -> f64 {
        // ESR depends on use - assume general use = 1.0
        self.span / 1.0
    }
    
    /// Rock bolt spacing (m) - from Q chart
    pub fn bolt_spacing(&self) -> f64 {
        (0.5 * self.q_value.powf(0.4)).max(0.8).min(2.5)
    }
    
    /// Rock bolt length (m)
    pub fn bolt_length(&self) -> f64 {
        (0.15 * self.span / self.q_value.powf(0.2)).max(2.0).min(0.4 * self.span)
    }
    
    /// Shotcrete thickness (mm)
    pub fn shotcrete_thickness(&self) -> f64 {
        if self.q_value > 10.0 {
            0.0 // No shotcrete needed
        } else if self.q_value > 1.0 {
            50.0
        } else if self.q_value > 0.1 {
            100.0
        } else {
            150.0
        }
    }
    
    /// Support pressure (kPa) - Barton's formula
    pub fn support_pressure(&self) -> f64 {
        if self.q_value > 10.0 {
            0.0
        } else {
            2.0 * self.span / (3.0 * self.q_value.powf(0.333))
        }
    }
    
    /// Stand-up time (hours)
    pub fn stand_up_time(&self) -> f64 {
        // Bieniawski's correlation (approximate)
        10.0_f64.powf(self.q_value.log10() + 0.5 * self.span.log10())
    }
}

// ============================================================================
// CUT AND COVER
// ============================================================================

/// Cut and cover construction method
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CutCoverMethod {
    /// Bottom-up with open excavation
    BottomUp,
    /// Top-down with decking
    TopDown,
    /// Semi-top-down
    SemiTopDown,
}

/// Cut and cover box structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CutCoverBox {
    /// Width (m)
    pub width: f64,
    /// Height (m)  
    pub height: f64,
    /// Wall thickness (mm)
    pub wall_thickness: f64,
    /// Roof slab thickness (mm)
    pub roof_thickness: f64,
    /// Base slab thickness (mm)
    pub base_thickness: f64,
    /// Cover depth (m)
    pub cover: f64,
    /// Construction method
    pub method: CutCoverMethod,
}

impl CutCoverBox {
    pub fn new(width: f64, height: f64, cover: f64) -> Self {
        Self {
            width,
            height,
            wall_thickness: (height * 80.0).max(400.0).min(1200.0),
            roof_thickness: (width * 50.0).max(500.0).min(1500.0),
            base_thickness: (width * 60.0).max(600.0).min(1800.0),
            cover,
            method: CutCoverMethod::BottomUp,
        }
    }
    
    /// Total excavation depth (m)
    pub fn excavation_depth(&self) -> f64 {
        self.cover + self.roof_thickness / 1000.0 + self.height + self.base_thickness / 1000.0
    }
    
    /// Lateral earth pressure at base (kPa)
    pub fn lateral_pressure(&self) -> f64 {
        let ka = 0.33; // Active coefficient
        let gamma = 18.0; // kN/m³
        ka * gamma * self.excavation_depth()
    }
    
    /// Surcharge pressure (kPa)
    pub fn surcharge_pressure(&self, surcharge: f64) -> f64 {
        0.33 * surcharge
    }
    
    /// Wall bending moment (kN·m/m) - simplified
    pub fn wall_moment(&self) -> f64 {
        let w = self.lateral_pressure();
        let h = self.height;
        
        w * h.powi(2) / 12.0 // Propped cantilever approximation
    }
    
    /// Roof slab moment (kN·m/m)
    pub fn roof_moment(&self, live_load: f64) -> f64 {
        let dead = 25.0 * self.roof_thickness / 1000.0; // Self-weight
        let soil = 20.0 * self.cover; // Soil above
        let total = dead + soil + live_load;
        
        total * self.width.powi(2) / 12.0 // Fixed ends
    }
    
    /// Base slab uplift check
    pub fn uplift_factor(&self, water_table_depth: f64) -> f64 {
        let uplift = 10.0 * (self.excavation_depth() - water_table_depth).max(0.0);
        let weight = 25.0 * self.base_thickness / 1000.0 + 
                     25.0 * self.roof_thickness / 1000.0 +
                     2.0 * 25.0 * self.wall_thickness / 1000.0 * self.height / self.width;
        
        weight / uplift.max(1.0)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rock_mass_class() {
        assert!(RockMassClass::Excellent.typical_q() > RockMassClass::Poor.typical_q());
    }

    #[test]
    fn test_ground_type() {
        assert!(GroundType::HardRock.modulus() > GroundType::CohesiveSoft.modulus());
    }

    #[test]
    fn test_circular_lining() {
        let lining = TunnelLining::circular_tbm(6.0, 20.0);
        
        assert!(lining.external_diameter() > lining.internal_diameter);
    }

    #[test]
    fn test_lining_pressures() {
        let lining = TunnelLining::circular_tbm(6.0, 20.0);
        
        assert!(lining.crown_pressure() > 0.0);
        assert!(lining.lateral_pressure() > 0.0);
    }

    #[test]
    fn test_lining_forces() {
        let lining = TunnelLining::circular_tbm(6.0, 20.0);
        
        assert!(lining.max_thrust() > 0.0);
        assert!(lining.max_moment() > 0.0);
    }

    #[test]
    fn test_reinforcement() {
        let lining = TunnelLining::circular_tbm(6.0, 20.0);
        let rebar = lining.required_reinforcement();
        
        assert!(rebar > 400.0); // Minimum reinforcement
    }

    #[test]
    fn test_segment_ring() {
        let ring = SegmentRing::standard_tbm(6.0);
        
        assert!(ring.segment_angle() > 50.0 && ring.segment_angle() < 80.0);
    }

    #[test]
    fn test_segment_weight() {
        let ring = SegmentRing::standard_tbm(6.0);
        let weight = ring.segment_weight(3.0);
        
        assert!(weight > 10.0);
    }

    #[test]
    fn test_tbm_parameters() {
        let tbm = TbmParameters::for_ground(6.0, GroundType::CohesiveStiff);
        
        assert_eq!(tbm.tbm_type, TbmType::Epb);
        assert!(tbm.thrust > 0.0);
    }

    #[test]
    fn test_tbm_advance() {
        let tbm = TbmParameters::for_ground(6.0, GroundType::HardRock);
        
        assert!(tbm.advance_rate() > 0.0);
    }

    #[test]
    fn test_cavern() {
        let cavern = Cavern::new(20.0, 30.0, 100.0, 50.0, 5.0);
        
        assert!(cavern.bolt_spacing() > 0.5);
        assert!(cavern.bolt_length() > 2.0);
    }

    #[test]
    fn test_cavern_support() {
        let good_rock = Cavern::new(20.0, 30.0, 100.0, 50.0, 20.0);
        let poor_rock = Cavern::new(20.0, 30.0, 100.0, 50.0, 0.5);
        
        assert!(good_rock.shotcrete_thickness() < poor_rock.shotcrete_thickness());
    }

    #[test]
    fn test_cut_cover_box() {
        let box_struct = CutCoverBox::new(12.0, 6.0, 3.0);
        
        assert!(box_struct.excavation_depth() > 9.0);
    }

    #[test]
    fn test_cut_cover_moments() {
        let box_struct = CutCoverBox::new(12.0, 6.0, 3.0);
        
        assert!(box_struct.wall_moment() > 0.0);
        assert!(box_struct.roof_moment(20.0) > 0.0);
    }

    #[test]
    fn test_uplift_check() {
        let box_struct = CutCoverBox::new(12.0, 6.0, 3.0);
        let fos = box_struct.uplift_factor(2.0);
        
        assert!(fos > 0.0);
    }
}
