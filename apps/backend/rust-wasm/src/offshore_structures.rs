// ============================================================================
// OFFSHORE STRUCTURES - API RP 2A, ISO 19902, DNV-OS
// Jacket platforms, risers, marine loading
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// WAVE LOADING - MORISON EQUATION
// ============================================================================

/// Wave parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaveParameters {
    /// Significant wave height Hs (m)
    pub hs: f64,
    /// Peak period Tp (s)
    pub tp: f64,
    /// Water depth d (m)
    pub water_depth: f64,
    /// Current velocity at surface (m/s)
    pub current_velocity: f64,
}

impl WaveParameters {
    pub fn new(hs: f64, tp: f64, depth: f64) -> Self {
        Self {
            hs,
            tp,
            water_depth: depth,
            current_velocity: 0.0,
        }
    }
    
    /// Design wave height (m) - 100-year return
    pub fn design_wave_height(&self) -> f64 {
        1.86 * self.hs // Rayleigh distribution factor
    }
    
    /// Wave length (m) - deep water approximation
    pub fn wave_length(&self) -> f64 {
        let g = 9.81;
        g * self.tp.powi(2) / (2.0 * PI)
    }
    
    /// Wave number k (rad/m)
    pub fn wave_number(&self) -> f64 {
        2.0 * PI / self.wave_length()
    }
    
    /// Maximum horizontal particle velocity at MWL (m/s)
    pub fn max_velocity(&self) -> f64 {
        let h = self.design_wave_height();
        let k = self.wave_number();
        let omega = 2.0 * PI / self.tp;
        
        omega * h / 2.0 * (self.water_depth * k).tanh().min(1.0)
    }
    
    /// Maximum horizontal acceleration at MWL (m/s²)
    pub fn max_acceleration(&self) -> f64 {
        let omega = 2.0 * PI / self.tp;
        
        omega * self.max_velocity()
    }
    
    /// Velocity at depth z below MWL (m/s)
    pub fn velocity_at_depth(&self, z: f64) -> f64 {
        let k = self.wave_number();
        let u_0 = self.max_velocity();
        
        u_0 * ((k * (self.water_depth + z)).cosh() / (k * self.water_depth).cosh())
    }
}

// ============================================================================
// MORISON EQUATION
// ============================================================================

/// Tubular member for wave loading
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TubularMember {
    /// Outer diameter (m)
    pub diameter: f64,
    /// Wall thickness (mm)
    pub thickness: f64,
    /// Length (m)
    pub length: f64,
    /// Drag coefficient Cd
    pub cd: f64,
    /// Inertia coefficient Cm
    pub cm: f64,
    /// Marine growth thickness (mm)
    pub marine_growth: f64,
}

impl TubularMember {
    pub fn new(diameter: f64, thickness: f64, length: f64) -> Self {
        Self {
            diameter,
            thickness,
            length,
            cd: 0.65, // API RP 2A typical
            cm: 1.6,  // API RP 2A typical
            marine_growth: 50.0, // Typical splash zone
        }
    }
    
    /// Effective diameter with marine growth (m)
    pub fn effective_diameter(&self) -> f64 {
        self.diameter + 2.0 * self.marine_growth / 1000.0
    }
    
    /// Drag force per unit length (kN/m)
    pub fn drag_force(&self, velocity: f64) -> f64 {
        let rho = 1025.0; // kg/m³ seawater
        let d_eff = self.effective_diameter();
        
        0.5 * rho * self.cd * d_eff * velocity.abs() * velocity / 1000.0
    }
    
    /// Inertia force per unit length (kN/m)
    pub fn inertia_force(&self, acceleration: f64) -> f64 {
        let rho = 1025.0;
        let d_eff = self.effective_diameter();
        
        rho * self.cm * PI * d_eff.powi(2) / 4.0 * acceleration / 1000.0
    }
    
    /// Total wave force per unit length (kN/m)
    pub fn total_force(&self, velocity: f64, acceleration: f64) -> f64 {
        self.drag_force(velocity) + self.inertia_force(acceleration)
    }
    
    /// Keulegan-Carpenter number
    pub fn kc_number(&self, velocity: f64, period: f64) -> f64 {
        velocity * period / self.effective_diameter()
    }
}

// ============================================================================
// JACKET PLATFORM
// ============================================================================

/// Jacket platform configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JacketPlatform {
    /// Water depth (m)
    pub water_depth: f64,
    /// Number of legs
    pub num_legs: u32,
    /// Leg spacing at mudline (m)
    pub base_spacing: f64,
    /// Leg spacing at waterline (m)
    pub top_spacing: f64,
    /// Leg diameter (m)
    pub leg_diameter: f64,
    /// Leg wall thickness (mm)
    pub leg_thickness: f64,
    /// Number of horizontal framings
    pub num_levels: u32,
}

impl JacketPlatform {
    pub fn new(depth: f64, num_legs: u32, base_spacing: f64) -> Self {
        Self {
            water_depth: depth,
            num_legs,
            base_spacing,
            top_spacing: base_spacing * 0.7,
            leg_diameter: (depth / 30.0).max(1.0).min(3.0),
            leg_thickness: 25.0,
            num_levels: (depth / 15.0).ceil() as u32,
        }
    }
    
    /// Batter angle (degrees)
    pub fn batter_angle(&self) -> f64 {
        let dx = (self.base_spacing - self.top_spacing) / 2.0;
        (dx / self.water_depth).atan() * 180.0 / PI
    }
    
    /// Leg length (m)
    pub fn leg_length(&self) -> f64 {
        let dx = (self.base_spacing - self.top_spacing) / 2.0;
        (self.water_depth.powi(2) + dx.powi(2)).sqrt()
    }
    
    /// Total weight of jacket (tonnes) - approximate
    pub fn jacket_weight(&self) -> f64 {
        let leg_weight = self.num_legs as f64 * PI * 
            (self.leg_diameter.powi(2) - (self.leg_diameter - 2.0 * self.leg_thickness / 1000.0).powi(2)) / 4.0 *
            self.leg_length() * 7.85;
            
        let brace_factor = 1.5; // Braces add ~50%
        
        leg_weight * brace_factor
    }
    
    /// Fundamental period estimate (s)
    pub fn natural_period(&self) -> f64 {
        // Empirical formula
        0.05 * self.water_depth.powf(0.8)
    }
    
    /// Wave loading on jacket (kN)
    pub fn wave_force(&self, wave: &WaveParameters) -> f64 {
        let member = TubularMember::new(
            self.leg_diameter,
            self.leg_thickness,
            self.leg_length()
        );
        
        // Simplified - average over depth
        let u = wave.max_velocity() * 0.7; // Average velocity
        let a = wave.max_acceleration() * 0.7;
        
        let force_per_leg = member.total_force(u, a) * self.water_depth;
        
        force_per_leg * self.num_legs as f64 * 0.8 // Reduction for phase
    }
}

// ============================================================================
// RISER DESIGN
// ============================================================================

/// Marine riser
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Riser {
    /// Outer diameter (mm)
    pub outer_diameter: f64,
    /// Wall thickness (mm)
    pub thickness: f64,
    /// Length (m)
    pub length: f64,
    /// Design pressure (MPa)
    pub design_pressure: f64,
    /// Steel grade SMYS (MPa)
    pub smys: f64,
}

impl Riser {
    pub fn new(od: f64, thickness: f64, length: f64, pressure: f64) -> Self {
        Self {
            outer_diameter: od,
            thickness,
            length,
            design_pressure: pressure,
            smys: 450.0, // X65 typical
        }
    }
    
    /// Inner diameter (mm)
    pub fn inner_diameter(&self) -> f64 {
        self.outer_diameter - 2.0 * self.thickness
    }
    
    /// Hoop stress (MPa) - thin wall formula
    pub fn hoop_stress(&self) -> f64 {
        self.design_pressure * self.outer_diameter / (2.0 * self.thickness)
    }
    
    /// API 5C3 collapse pressure (MPa)
    pub fn collapse_pressure(&self) -> f64 {
        let d_t = self.outer_diameter / self.thickness;
        let e = 207000.0; // MPa
        
        // Elastic collapse
        let pe = 2.0 * e * (1.0 / d_t).powi(3) / (1.0 - 0.3_f64.powi(2));
        
        // Yield collapse
        let py = 2.0 * self.smys * (d_t - 1.0) / d_t.powi(2);
        
        // Plastic collapse
        let pp = self.smys * (d_t - 1.0) / d_t;
        
        pe.min(py).min(pp)
    }
    
    /// Weight in air (kg/m)
    pub fn weight_in_air(&self) -> f64 {
        let area = PI * (self.outer_diameter.powi(2) - self.inner_diameter().powi(2)) / 4.0 / 1e6;
        area * 7850.0
    }
    
    /// Submerged weight (kg/m)
    pub fn submerged_weight(&self) -> f64 {
        self.weight_in_air() - PI * self.outer_diameter.powi(2) / 4.0 / 1e6 * 1025.0
    }
    
    /// Top tension (kN)
    pub fn top_tension(&self) -> f64 {
        self.submerged_weight() * self.length * 9.81 / 1000.0 * 1.1 // 10% overpull
    }
    
    /// Vortex shedding frequency (Hz)
    pub fn vortex_frequency(&self, velocity: f64) -> f64 {
        let st = 0.2; // Strouhal number
        st * velocity / (self.outer_diameter / 1000.0)
    }
}

// ============================================================================
// CATHODIC PROTECTION
// ============================================================================

/// Cathodic protection design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CathodicProtection {
    /// Protected surface area (m²)
    pub surface_area: f64,
    /// Design life (years)
    pub design_life: f64,
    /// Current density (mA/m²)
    pub current_density: f64,
    /// Anode type
    pub anode_type: AnodeType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AnodeType {
    AluminumAlloy,
    Zinc,
    Magnesium,
}

impl CathodicProtection {
    pub fn new(area: f64, life: f64) -> Self {
        Self {
            surface_area: area,
            design_life: life,
            current_density: 20.0, // mA/m² typical
            anode_type: AnodeType::AluminumAlloy,
        }
    }
    
    /// Total current requirement (A)
    pub fn current_required(&self) -> f64 {
        self.surface_area * self.current_density / 1000.0
    }
    
    /// Anode consumption rate (kg/A-year)
    pub fn consumption_rate(&self) -> f64 {
        match self.anode_type {
            AnodeType::AluminumAlloy => 3.2,
            AnodeType::Zinc => 11.2,
            AnodeType::Magnesium => 7.9,
        }
    }
    
    /// Total anode weight required (kg)
    pub fn anode_weight(&self) -> f64 {
        let i = self.current_required();
        let rate = self.consumption_rate();
        let utilization = 0.85; // 85% utilization factor
        
        i * rate * self.design_life / utilization
    }
    
    /// Number of anodes required (using standard 50kg anodes)
    pub fn num_anodes(&self) -> u32 {
        let weight = self.anode_weight();
        let single_anode = 50.0; // kg
        
        (weight / single_anode).ceil() as u32
    }
}

// ============================================================================
// PILE DESIGN
// ============================================================================

/// Offshore pile design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OffshorePile {
    /// Outer diameter (mm)
    pub diameter: f64,
    /// Wall thickness (mm)
    pub thickness: f64,
    /// Penetration depth (m)
    pub penetration: f64,
    /// Soil type
    pub soil_type: SoilType,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SoilType {
    Sand,
    Clay,
    SiltyClay,
}

impl OffshorePile {
    pub fn new(diameter: f64, thickness: f64, penetration: f64, soil: SoilType) -> Self {
        Self {
            diameter,
            thickness,
            penetration,
            soil_type: soil,
        }
    }
    
    /// Pile tip area (m²)
    pub fn tip_area(&self) -> f64 {
        PI * (self.diameter / 1000.0).powi(2) / 4.0
    }
    
    /// Pile shaft area (m²)
    pub fn shaft_area(&self) -> f64 {
        PI * self.diameter / 1000.0 * self.penetration
    }
    
    /// API RP 2A unit skin friction (kPa)
    pub fn unit_skin_friction(&self) -> f64 {
        match self.soil_type {
            SoilType::Sand => 96.0, // Maximum for dense sand
            SoilType::Clay => 75.0, // Typical clay
            SoilType::SiltyClay => 60.0,
        }
    }
    
    /// API RP 2A unit end bearing (kPa)
    pub fn unit_end_bearing(&self) -> f64 {
        match self.soil_type {
            SoilType::Sand => 10000.0, // Dense sand
            SoilType::Clay => 9.0 * 100.0, // 9 * Su
            SoilType::SiltyClay => 7.0 * 80.0,
        }
    }
    
    /// Ultimate axial capacity (kN)
    pub fn ultimate_capacity(&self) -> f64 {
        let qs = self.unit_skin_friction() * self.shaft_area(); // kN
        let qp = self.unit_end_bearing() * self.tip_area(); // kN
        
        qs + qp
    }
    
    /// Allowable axial capacity (kN)
    pub fn allowable_capacity(&self) -> f64 {
        self.ultimate_capacity() / 2.0 // Factor of safety = 2
    }
    
    /// Lateral capacity estimate (kN)
    pub fn lateral_capacity(&self) -> f64 {
        // Simplified - depends heavily on soil conditions
        match self.soil_type {
            SoilType::Sand => 0.3 * self.ultimate_capacity(),
            SoilType::Clay => 0.2 * self.ultimate_capacity(),
            SoilType::SiltyClay => 0.25 * self.ultimate_capacity(),
        }
    }
}

// ============================================================================
// SPLASH ZONE PROTECTION
// ============================================================================

/// Splash zone protection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplashZone {
    /// Tidal range (m)
    pub tidal_range: f64,
    /// Wave height (m)
    pub wave_height: f64,
    /// Corrosion allowance (mm)
    pub corrosion_allowance: f64,
    /// Protection type
    pub protection: SplashProtection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SplashProtection {
    ExtraThickness,
    NiAlloyWeld,
    MonelClad,
    CoatingSystem,
}

impl SplashZone {
    pub fn new(tidal_range: f64, wave_height: f64) -> Self {
        Self {
            tidal_range,
            wave_height,
            corrosion_allowance: 6.0, // mm
            protection: SplashProtection::ExtraThickness,
        }
    }
    
    /// Upper splash zone limit (m above LAT)
    pub fn upper_limit(&self) -> f64 {
        self.tidal_range + self.wave_height / 2.0 + 2.0 // 2m margin
    }
    
    /// Lower splash zone limit (m above LAT)
    pub fn lower_limit(&self) -> f64 {
        -self.wave_height / 2.0 - 1.0 // 1m margin
    }
    
    /// Zone height (m)
    pub fn zone_height(&self) -> f64 {
        self.upper_limit() - self.lower_limit()
    }
    
    /// Required extra thickness (mm)
    pub fn extra_thickness(&self) -> f64 {
        match self.protection {
            SplashProtection::ExtraThickness => self.corrosion_allowance * 2.0,
            SplashProtection::NiAlloyWeld => 3.0,
            SplashProtection::MonelClad => 0.0,
            SplashProtection::CoatingSystem => self.corrosion_allowance,
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
    fn test_wave_parameters() {
        let wave = WaveParameters::new(10.0, 12.0, 100.0);
        
        assert!(wave.design_wave_height() > 15.0);
        assert!(wave.wave_length() > 100.0);
    }

    #[test]
    fn test_wave_velocity() {
        let wave = WaveParameters::new(8.0, 10.0, 50.0);
        
        let u = wave.max_velocity();
        assert!(u > 0.0 && u < 20.0);
        
        let u_deep = wave.velocity_at_depth(-25.0);
        assert!(u_deep < u);
    }

    #[test]
    fn test_morison() {
        let member = TubularMember::new(1.2, 40.0, 50.0);
        
        let fd = member.drag_force(2.0);
        let fi = member.inertia_force(1.0);
        
        assert!(fd > 0.0);
        assert!(fi > 0.0);
    }

    #[test]
    fn test_jacket() {
        let jacket = JacketPlatform::new(100.0, 4, 40.0);
        
        assert!(jacket.batter_angle() > 0.0);
        assert!(jacket.jacket_weight() > 100.0);
    }

    #[test]
    fn test_jacket_wave_force() {
        let jacket = JacketPlatform::new(80.0, 4, 35.0);
        let wave = WaveParameters::new(10.0, 12.0, 80.0);
        
        let force = jacket.wave_force(&wave);
        assert!(force > 0.0);
    }

    #[test]
    fn test_riser() {
        let riser = Riser::new(273.0, 25.0, 1000.0, 20.0);
        
        let sigma = riser.hoop_stress();
        assert!(sigma < riser.smys);
    }

    #[test]
    fn test_riser_collapse() {
        let riser = Riser::new(219.0, 20.0, 500.0, 15.0);
        
        let pc = riser.collapse_pressure();
        assert!(pc > 10.0);
    }

    #[test]
    fn test_cathodic_protection() {
        let cp = CathodicProtection::new(5000.0, 25.0);
        
        let weight = cp.anode_weight();
        let num = cp.num_anodes();
        
        assert!(weight > 1000.0);
        assert!(num > 10);
    }

    #[test]
    fn test_offshore_pile() {
        let pile = OffshorePile::new(1524.0, 50.0, 60.0, SoilType::Sand);
        
        let capacity = pile.ultimate_capacity();
        assert!(capacity > 10000.0);
    }

    #[test]
    fn test_splash_zone() {
        let splash = SplashZone::new(2.0, 6.0);
        
        assert!(splash.zone_height() > 8.0);
        assert!(splash.extra_thickness() > 0.0);
    }

    #[test]
    fn test_pile_lateral() {
        let pile = OffshorePile::new(1200.0, 40.0, 50.0, SoilType::Clay);
        
        let lateral = pile.lateral_capacity();
        assert!(lateral > 0.0);
        assert!(lateral < pile.ultimate_capacity());
    }
}
