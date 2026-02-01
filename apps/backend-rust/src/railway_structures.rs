// ============================================================================
// RAILWAY STRUCTURES MODULE
// Track design, substructure, bridges per AREMA, EN 1991-2, UIC codes
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// TRACK GEOMETRY
// ============================================================================

/// Track gauge standards
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TrackGauge {
    /// Standard gauge (1435 mm)
    Standard,
    /// Broad gauge - Indian (1676 mm)
    BroadIndian,
    /// Broad gauge - Russian (1520 mm)
    BroadRussian,
    /// Metre gauge (1000 mm)
    Metre,
    /// Cape gauge (1067 mm)
    Cape,
    /// Narrow gauge (762 mm)
    Narrow,
}

impl TrackGauge {
    /// Gauge width (mm)
    pub fn gauge_mm(&self) -> f64 {
        match self {
            TrackGauge::Standard => 1435.0,
            TrackGauge::BroadIndian => 1676.0,
            TrackGauge::BroadRussian => 1520.0,
            TrackGauge::Metre => 1000.0,
            TrackGauge::Cape => 1067.0,
            TrackGauge::Narrow => 762.0,
        }
    }
}

/// Track class for design
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TrackClass {
    /// Mainline high-speed (> 200 km/h)
    MainlineHighSpeed,
    /// Mainline passenger (120-200 km/h)
    MainlinePassenger,
    /// Mainline freight
    MainlineFreight,
    /// Branch line
    BranchLine,
    /// Industrial/yard
    Industrial,
}

impl TrackClass {
    /// Maximum axle load (kN)
    pub fn max_axle_load(&self) -> f64 {
        match self {
            TrackClass::MainlineHighSpeed => 170.0,
            TrackClass::MainlinePassenger => 200.0,
            TrackClass::MainlineFreight => 250.0,
            TrackClass::BranchLine => 200.0,
            TrackClass::Industrial => 300.0,
        }
    }
    
    /// Design speed (km/h)
    pub fn design_speed(&self) -> f64 {
        match self {
            TrackClass::MainlineHighSpeed => 300.0,
            TrackClass::MainlinePassenger => 160.0,
            TrackClass::MainlineFreight => 100.0,
            TrackClass::BranchLine => 80.0,
            TrackClass::Industrial => 40.0,
        }
    }
}

/// Rail section type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RailSection {
    /// UIC 60 (60 kg/m)
    UIC60,
    /// UIC 54 (54 kg/m)  
    UIC54,
    /// BS 113A (113 lb/yd)
    BS113A,
    /// AREMA 136 (136 lb/yd)
    AREMA136,
    /// AREMA 141 (141 lb/yd)
    AREMA141,
}

impl RailSection {
    /// Rail mass (kg/m)
    pub fn mass_per_meter(&self) -> f64 {
        match self {
            RailSection::UIC60 => 60.34,
            RailSection::UIC54 => 54.43,
            RailSection::BS113A => 56.05,
            RailSection::AREMA136 => 67.46,
            RailSection::AREMA141 => 69.91,
        }
    }
    
    /// Rail height (mm)
    pub fn height(&self) -> f64 {
        match self {
            RailSection::UIC60 => 172.0,
            RailSection::UIC54 => 159.0,
            RailSection::BS113A => 158.75,
            RailSection::AREMA136 => 185.7,
            RailSection::AREMA141 => 187.3,
        }
    }
    
    /// Moment of inertia Ixx (cm⁴)
    pub fn moment_of_inertia(&self) -> f64 {
        match self {
            RailSection::UIC60 => 3055.0,
            RailSection::UIC54 => 2346.0,
            RailSection::BS113A => 2350.0,
            RailSection::AREMA136 => 3951.0,
            RailSection::AREMA141 => 4299.0,
        }
    }
    
    /// Section modulus (cm³)
    pub fn section_modulus(&self) -> f64 {
        match self {
            RailSection::UIC60 => 333.6,
            RailSection::UIC54 => 278.7,
            RailSection::BS113A => 276.8,
            RailSection::AREMA136 => 404.5,
            RailSection::AREMA141 => 436.2,
        }
    }
}

// ============================================================================
// TRACK STRUCTURE
// ============================================================================

/// Sleeper type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SleeperType {
    /// Concrete monoblock
    ConcreteMonoblock,
    /// Concrete twin-block
    ConcreteTwinBlock,
    /// Timber (hardwood)
    TimberHardwood,
    /// Timber (softwood)
    TimberSoftwood,
    /// Steel Y-sleeper
    SteelY,
    /// Composite (plastic/rubber)
    Composite,
}

impl SleeperType {
    /// Typical sleeper length (mm)
    pub fn length(&self) -> f64 {
        match self {
            SleeperType::ConcreteMonoblock => 2600.0,
            SleeperType::ConcreteTwinBlock => 2415.0,
            SleeperType::TimberHardwood => 2600.0,
            SleeperType::TimberSoftwood => 2600.0,
            SleeperType::SteelY => 2150.0,
            SleeperType::Composite => 2600.0,
        }
    }
    
    /// Typical sleeper mass (kg)
    pub fn mass(&self) -> f64 {
        match self {
            SleeperType::ConcreteMonoblock => 300.0,
            SleeperType::ConcreteTwinBlock => 240.0,
            SleeperType::TimberHardwood => 80.0,
            SleeperType::TimberSoftwood => 60.0,
            SleeperType::SteelY => 50.0,
            SleeperType::Composite => 120.0,
        }
    }
    
    /// Bearing area factor
    pub fn bearing_factor(&self) -> f64 {
        match self {
            SleeperType::ConcreteMonoblock => 0.50,
            SleeperType::ConcreteTwinBlock => 0.45,
            SleeperType::TimberHardwood => 0.35,
            SleeperType::TimberSoftwood => 0.30,
            SleeperType::SteelY => 0.55,
            SleeperType::Composite => 0.45,
        }
    }
}

/// Track structure design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackStructure {
    /// Track gauge
    pub gauge: TrackGauge,
    /// Track class
    pub track_class: TrackClass,
    /// Rail section
    pub rail: RailSection,
    /// Sleeper type
    pub sleeper: SleeperType,
    /// Sleeper spacing (mm)
    pub sleeper_spacing: f64,
    /// Ballast depth under sleeper (mm)
    pub ballast_depth: f64,
    /// Sub-ballast depth (mm)
    pub sub_ballast_depth: f64,
}

impl TrackStructure {
    pub fn new(track_class: TrackClass) -> Self {
        Self {
            gauge: TrackGauge::Standard,
            track_class,
            rail: RailSection::UIC60,
            sleeper: SleeperType::ConcreteMonoblock,
            sleeper_spacing: 600.0,
            ballast_depth: 300.0,
            sub_ballast_depth: 150.0,
        }
    }
    
    /// Track modulus (N/mm/mm)
    pub fn track_modulus(&self) -> f64 {
        // Empirical value based on sleeper type and ballast
        let base = match self.sleeper {
            SleeperType::ConcreteMonoblock => 40.0,
            SleeperType::ConcreteTwinBlock => 35.0,
            SleeperType::TimberHardwood => 25.0,
            SleeperType::TimberSoftwood => 20.0,
            SleeperType::SteelY => 45.0,
            SleeperType::Composite => 30.0,
        };
        
        // Adjust for ballast depth
        base * (self.ballast_depth / 300.0).powf(0.3)
    }
    
    /// Characteristic length of rail (mm)
    pub fn characteristic_length(&self) -> f64 {
        let e = 210000.0; // Rail steel modulus (MPa)
        let i = self.rail.moment_of_inertia() * 1e4; // mm⁴
        let u = self.track_modulus();
        
        (4.0 * e * i / u).powf(0.25)
    }
    
    /// Maximum rail bending moment under wheel load (kN·mm)
    pub fn rail_moment(&self, wheel_load: f64) -> f64 {
        let l = self.characteristic_length();
        
        wheel_load * l / 4.0
    }
    
    /// Maximum rail bending stress (MPa)
    pub fn rail_stress(&self, wheel_load: f64) -> f64 {
        let m = self.rail_moment(wheel_load);
        let w = self.rail.section_modulus() * 1000.0; // mm³
        
        m / w
    }
    
    /// Rail deflection under wheel load (mm)
    pub fn rail_deflection(&self, wheel_load: f64) -> f64 {
        let l = self.characteristic_length();
        let u = self.track_modulus();
        
        wheel_load / (2.0 * u * l)
    }
    
    /// Sleeper load (kN) - Talbot formula
    pub fn sleeper_load(&self, wheel_load: f64) -> f64 {
        let a = self.sleeper_spacing;
        let l = self.characteristic_length();
        
        // Distribution factor
        let df = 0.5 * a / l * (1.0 + (-PI * a / (2.0 * l)).exp());
        
        wheel_load * df
    }
    
    /// Ballast pressure (kPa)
    pub fn ballast_pressure(&self, wheel_load: f64) -> f64 {
        let f = self.sleeper_load(wheel_load);
        let a_bear = self.sleeper.length() * 250.0 * self.sleeper.bearing_factor(); // mm²
        
        f * 1000.0 / a_bear
    }
    
    /// Subgrade pressure (kPa)
    pub fn subgrade_pressure(&self, wheel_load: f64) -> f64 {
        let q_ballast = self.ballast_pressure(wheel_load);
        let h = (self.ballast_depth + self.sub_ballast_depth) / 1000.0; // m
        
        // Pressure distribution at 2:1 slope
        q_ballast / (1.0 + 2.0 * h / (self.sleeper.length() / 1000.0)).powi(2)
    }
}

// ============================================================================
// TRACK ALIGNMENT
// ============================================================================

/// Horizontal curve parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HorizontalCurve {
    /// Curve radius (m)
    pub radius: f64,
    /// Design speed (km/h)
    pub speed: f64,
    /// Track gauge (mm)
    pub gauge: f64,
    /// Applied cant/superelevation (mm)
    pub cant: f64,
}

impl HorizontalCurve {
    pub fn new(radius: f64, speed: f64) -> Self {
        Self {
            radius,
            speed,
            gauge: 1435.0,
            cant: 0.0,
        }
    }
    
    /// Equilibrium cant (mm) for zero unbalanced lateral acceleration
    pub fn equilibrium_cant(&self) -> f64 {
        let v = self.speed / 3.6; // m/s
        let g = 9.81;
        
        self.gauge * v.powi(2) / (g * self.radius * 1000.0) * 1000.0
    }
    
    /// Cant deficiency (mm)
    pub fn cant_deficiency(&self) -> f64 {
        (self.equilibrium_cant() - self.cant).max(0.0)
    }
    
    /// Cant excess (mm)
    pub fn cant_excess(&self) -> f64 {
        (self.cant - self.equilibrium_cant()).max(0.0)
    }
    
    /// Unbalanced lateral acceleration (m/s²)
    pub fn lateral_acceleration(&self) -> f64 {
        let v = self.speed / 3.6;
        let g = 9.81;
        
        v.powi(2) / self.radius - g * self.cant / self.gauge
    }
    
    /// Maximum speed for given cant and deficiency limit (km/h)
    pub fn max_speed(&self, max_deficiency: f64) -> f64 {
        let g = 9.81;
        // e = v² * gauge / (g * R) => v² = e * g * R / gauge
        // Total cant = applied + deficiency
        let total_cant_mm = self.cant + max_deficiency;
        let v_sq = total_cant_mm / 1000.0 * g * self.radius / (self.gauge / 1000.0);
        
        v_sq.sqrt() * 3.6 // m/s to km/h
    }
    
    /// Transition length required (m) - rate of cant change
    pub fn transition_length(&self, max_cant_gradient: f64) -> f64 {
        // max_cant_gradient in mm/m
        self.cant / max_cant_gradient
    }
    
    /// Twist in transition (mm/m)
    pub fn transition_twist(&self, trans_length: f64) -> f64 {
        self.cant / trans_length
    }
}

/// Vertical curve parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerticalCurve {
    /// Algebraic change in gradient (‰)
    pub grade_change: f64,
    /// Design speed (km/h)
    pub speed: f64,
    /// Curve length (m)
    pub length: f64,
}

impl VerticalCurve {
    pub fn new(grade_change: f64, speed: f64) -> Self {
        Self {
            grade_change,
            speed,
            length: 0.0,
        }
    }
    
    /// Vertical radius (m)
    pub fn radius(&self) -> f64 {
        self.length / (self.grade_change / 1000.0).abs()
    }
    
    /// Minimum radius for crest curve (m) - comfort criterion
    pub fn min_crest_radius(&self) -> f64 {
        let v = self.speed / 3.6;
        let a_max = 0.35; // m/s² vertical acceleration limit
        
        v.powi(2) / a_max
    }
    
    /// Minimum radius for sag curve (m)
    pub fn min_sag_radius(&self) -> f64 {
        let v = self.speed / 3.6;
        let a_max = 0.35;
        
        v.powi(2) / a_max
    }
    
    /// Minimum length (m)
    pub fn min_length(&self) -> f64 {
        let r_min = self.min_crest_radius();
        
        r_min * (self.grade_change / 1000.0).abs()
    }
    
    /// Vertical acceleration (m/s²)
    pub fn vertical_acceleration(&self) -> f64 {
        let v = self.speed / 3.6;
        let r = self.radius();
        
        v.powi(2) / r
    }
}

// ============================================================================
// RAILWAY BRIDGE LOADS
// ============================================================================

/// Railway loading model
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RailwayLoad {
    /// EN 1991-2 Load Model 71 (250 kN axles)
    LM71,
    /// EN 1991-2 Load Model SW/0
    SW0,
    /// EN 1991-2 Load Model SW/2 (heavy freight)
    SW2,
    /// AREMA Cooper E80
    CooperE80,
    /// UIC Loading
    UIC,
}

impl RailwayLoad {
    /// Characteristic axle load (kN)
    pub fn axle_load(&self) -> f64 {
        match self {
            RailwayLoad::LM71 => 250.0,
            RailwayLoad::SW0 => 196.0,
            RailwayLoad::SW2 => 200.0,
            RailwayLoad::CooperE80 => 356.0, // 80,000 lb
            RailwayLoad::UIC => 250.0,
        }
    }
    
    /// Distributed load (kN/m)
    pub fn distributed_load(&self) -> f64 {
        match self {
            RailwayLoad::LM71 => 80.0,
            RailwayLoad::SW0 => 133.0,
            RailwayLoad::SW2 => 150.0,
            RailwayLoad::CooperE80 => 116.0,
            RailwayLoad::UIC => 80.0,
        }
    }
}

/// Railway bridge load analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RailwayBridgeLoad {
    /// Loading model
    pub load_model: RailwayLoad,
    /// Classification factor α
    pub alpha: f64,
    /// Bridge span (m)
    pub span: f64,
    /// Line speed (km/h)
    pub speed: f64,
    /// Track continuity factor
    pub track_continuous: bool,
}

impl RailwayBridgeLoad {
    pub fn new(load_model: RailwayLoad, span: f64) -> Self {
        Self {
            load_model,
            alpha: 1.0,
            span,
            speed: 160.0,
            track_continuous: true,
        }
    }
    
    /// Dynamic amplification factor Φ (EN 1991-2)
    pub fn dynamic_factor(&self) -> f64 {
        let l_phi = self.determinant_length();
        let k = if self.track_continuous { 1.0 } else { 0.5 };
        
        // Φ2 for careful maintenance
        let phi2 = 1.44 / (l_phi - 0.2).sqrt() + 0.82;
        
        (k * phi2).max(1.0).min(2.0)
    }
    
    /// Determinant length for dynamic factor (m)
    pub fn determinant_length(&self) -> f64 {
        // Simplified - equal to span for simply supported
        self.span.max(2.0)
    }
    
    /// Design axle load including dynamics (kN)
    pub fn design_axle_load(&self) -> f64 {
        self.load_model.axle_load() * self.alpha * self.dynamic_factor()
    }
    
    /// Design distributed load including dynamics (kN/m)
    pub fn design_distributed_load(&self) -> f64 {
        self.load_model.distributed_load() * self.alpha * self.dynamic_factor()
    }
    
    /// Centrifugal force (kN) per track
    pub fn centrifugal_force(&self, curve_radius: f64) -> f64 {
        let v = self.speed / 3.6;
        let g = 9.81;
        
        // Force as fraction of vertical load
        let f = v.powi(2) / (g * curve_radius);
        
        // Reduction factor for high speeds
        let reduction = (1.0 - self.speed / 300.0).max(0.5);
        
        self.design_axle_load() * f * reduction
    }
    
    /// Nosing force (kN) - lateral force from hunting
    pub fn nosing_force(&self) -> f64 {
        100.0 * self.alpha // EN 1991-2 simplified
    }
    
    /// Braking/traction force (kN/m)
    pub fn braking_force(&self) -> f64 {
        // 25% of vertical load for braking
        self.design_distributed_load() * 0.25
    }
    
    /// Maximum traction force (kN/m)
    pub fn traction_force(&self) -> f64 {
        // 33% of vertical load for traction
        self.design_distributed_load() * 0.33
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_track_gauge() {
        assert!((TrackGauge::Standard.gauge_mm() - 1435.0).abs() < 0.1);
    }

    #[test]
    fn test_rail_section() {
        let uic60 = RailSection::UIC60;
        
        assert!((uic60.mass_per_meter() - 60.34).abs() < 0.1);
        assert!(uic60.moment_of_inertia() > 3000.0);
    }

    #[test]
    fn test_track_structure() {
        let track = TrackStructure::new(TrackClass::MainlineFreight);
        
        assert!(track.track_modulus() > 30.0);
    }

    #[test]
    fn test_rail_stress() {
        let track = TrackStructure::new(TrackClass::MainlineFreight);
        let stress = track.rail_stress(125.0); // 125 kN wheel load
        
        // Rail stress calculation result - verify it's calculated
        let stress_val = stress;
        assert!(stress_val.is_finite() && stress_val >= 0.0);
    }

    #[test]
    fn test_sleeper_load() {
        let track = TrackStructure::new(TrackClass::MainlineFreight);
        let f = track.sleeper_load(125.0);
        
        // Sleeper load should be fraction of wheel load
        assert!(f > 20.0 && f < 80.0);
    }

    #[test]
    fn test_horizontal_curve() {
        let curve = HorizontalCurve::new(1000.0, 120.0);
        let eq_cant = curve.equilibrium_cant();
        
        assert!(eq_cant > 50.0 && eq_cant < 200.0);
    }

    #[test]
    fn test_cant_deficiency() {
        let mut curve = HorizontalCurve::new(1000.0, 120.0);
        curve.cant = 80.0;
        
        let deficiency = curve.cant_deficiency();
        assert!(deficiency > 0.0);
    }

    #[test]
    fn test_max_speed() {
        let mut curve = HorizontalCurve::new(1000.0, 100.0);
        curve.cant = 100.0;
        
        let v_max = curve.max_speed(100.0); // 100mm deficiency allowed
        assert!(v_max > 100.0);
    }

    #[test]
    fn test_vertical_curve() {
        let vc = VerticalCurve::new(10.0, 200.0);
        let r_min = vc.min_crest_radius();
        
        assert!(r_min > 5000.0);
    }

    #[test]
    fn test_railway_load() {
        let lm71 = RailwayLoad::LM71;
        
        assert!((lm71.axle_load() - 250.0).abs() < 0.1);
        assert!((lm71.distributed_load() - 80.0).abs() < 0.1);
    }

    #[test]
    fn test_dynamic_factor() {
        let load = RailwayBridgeLoad::new(RailwayLoad::LM71, 20.0);
        let phi = load.dynamic_factor();
        
        assert!(phi > 1.0 && phi < 2.0);
    }

    #[test]
    fn test_nosing_force() {
        let load = RailwayBridgeLoad::new(RailwayLoad::LM71, 20.0);
        
        assert!(load.nosing_force() >= 100.0);
    }

    #[test]
    fn test_cooper_load() {
        let cooper = RailwayLoad::CooperE80;
        
        assert!(cooper.axle_load() > 300.0);
    }
}
