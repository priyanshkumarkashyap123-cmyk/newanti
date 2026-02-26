// ============================================================================
// WATER TREATMENT STRUCTURES MODULE
// ACI 350, AWWA - Water/wastewater structure design
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// LIQUID-CONTAINING STRUCTURES
// ============================================================================

/// Exposure class (ACI 350)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExposureClass {
    /// Normal - freshwater
    Normal,
    /// Severe - wastewater, chemicals
    Severe,
    /// Very severe - aggressive chemicals
    VerySevere,
}

impl ExposureClass {
    /// Maximum crack width (mm)
    pub fn crack_width_limit(&self) -> f64 {
        match self {
            ExposureClass::Normal => 0.25,
            ExposureClass::Severe => 0.20,
            ExposureClass::VerySevere => 0.15,
        }
    }
    
    /// Minimum cover (mm)
    pub fn min_cover(&self) -> f64 {
        match self {
            ExposureClass::Normal => 50.0,
            ExposureClass::Severe => 60.0,
            ExposureClass::VerySevere => 75.0,
        }
    }
    
    /// Durability factor for design
    pub fn durability_factor(&self) -> f64 {
        match self {
            ExposureClass::Normal => 1.0,
            ExposureClass::Severe => 1.3,
            ExposureClass::VerySevere => 1.65,
        }
    }
}

// ============================================================================
// CIRCULAR TANK (CLARIFIER)
// ============================================================================

/// Circular clarifier/tank
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircularTank {
    /// Inside diameter (m)
    pub diameter: f64,
    /// Water depth (m)
    pub water_depth: f64,
    /// Freeboard (m)
    pub freeboard: f64,
    /// Wall thickness (mm)
    pub wall_thickness: f64,
    /// Floor thickness (mm)
    pub floor_thickness: f64,
    /// Concrete strength fck (MPa)
    pub fck: f64,
    /// Exposure class
    pub exposure: ExposureClass,
}

impl CircularTank {
    pub fn new(diameter: f64, water_depth: f64, fck: f64) -> Self {
        // Estimate wall thickness
        let t = (diameter * water_depth * 10.0 / (2.0 * 0.5 * fck * 1000.0) * 1000.0)
            .max(250.0)
            .min(600.0);
        
        Self {
            diameter,
            water_depth,
            freeboard: 0.5,
            wall_thickness: t,
            floor_thickness: 250.0,
            fck,
            exposure: ExposureClass::Normal,
        }
    }
    
    /// Total wall height (m)
    pub fn wall_height(&self) -> f64 {
        self.water_depth + self.freeboard
    }
    
    /// Volume (m³)
    pub fn volume(&self) -> f64 {
        PI * self.diameter.powi(2) / 4.0 * self.water_depth
    }
    
    /// Hydrostatic pressure at depth (kPa)
    pub fn hydrostatic_pressure(&self, depth: f64) -> f64 {
        10.0 * depth // γw = 10 kN/m³
    }
    
    /// Maximum hydrostatic pressure (kPa)
    pub fn max_pressure(&self) -> f64 {
        self.hydrostatic_pressure(self.water_depth)
    }
    
    /// Hoop tension at depth (kN/m)
    pub fn hoop_tension(&self, depth: f64) -> f64 {
        self.hydrostatic_pressure(depth) * self.diameter / 2.0
    }
    
    /// Maximum hoop tension (kN/m)
    pub fn max_hoop_tension(&self) -> f64 {
        self.hoop_tension(self.water_depth)
    }
    
    /// Required hoop steel (mm²/m) - ACI 350
    pub fn required_hoop_steel(&self, fy: f64) -> f64 {
        let t_max = self.max_hoop_tension();
        let sd = self.exposure.durability_factor();
        let fs = fy / 1.4; // Reduced for crack control
        
        t_max * sd * 1000.0 / fs
    }
    
    /// Vertical bending at base (kN·m/m)
    pub fn base_moment(&self) -> f64 {
        // Fixed base
        let gamma = 10.0;
        let h = self.water_depth;
        
        gamma * h.powi(3) / 6.0 * 0.5 // Coefficient varies with H²/Dt
    }
    
    /// Minimum vertical steel (mm²/m)
    pub fn min_vertical_steel(&self) -> f64 {
        // ACI 350 minimum
        0.003 * self.wall_thickness * 1000.0
    }
    
    /// Floor slab uplift (kN/m²)
    pub fn floor_uplift(&self, groundwater_depth: f64) -> f64 {
        let h_gw = self.water_depth + self.freeboard - groundwater_depth;
        
        (10.0 * h_gw.max(0.0)).max(0.0)
    }
    
    /// Check crack width (simplified)
    pub fn check_crack_width(&self, steel_stress: f64, bar_spacing: f64) -> f64 {
        // Gergely-Lutz approximation
        let dc = self.exposure.min_cover() + 8.0; // Cover + half bar
        let a = 2.0 * dc * bar_spacing;
        
        0.076 * steel_stress * a.cbrt() / 1e6
    }
}

// ============================================================================
// RECTANGULAR TANK
// ============================================================================

/// Rectangular basin
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RectangularBasin {
    /// Length (m)
    pub length: f64,
    /// Width (m)
    pub width: f64,
    /// Water depth (m)
    pub water_depth: f64,
    /// Wall thickness (mm)
    pub wall_thickness: f64,
    /// Floor thickness (mm)
    pub floor_thickness: f64,
    /// Concrete strength fck (MPa)
    pub fck: f64,
    /// Exposure class
    pub exposure: ExposureClass,
}

impl RectangularBasin {
    pub fn new(length: f64, width: f64, water_depth: f64) -> Self {
        Self {
            length,
            width,
            water_depth,
            wall_thickness: 300.0,
            floor_thickness: 300.0,
            fck: 35.0,
            exposure: ExposureClass::Normal,
        }
    }
    
    /// Volume (m³)
    pub fn volume(&self) -> f64 {
        self.length * self.width * self.water_depth
    }
    
    /// Long wall span (m)
    pub fn long_wall_span(&self) -> f64 {
        self.length
    }
    
    /// Short wall span (m)
    pub fn short_wall_span(&self) -> f64 {
        self.width
    }
    
    /// Long wall pressure moment (kN·m/m) - horizontal span
    pub fn long_wall_moment(&self) -> f64 {
        let gamma = 10.0;
        let h = self.water_depth;
        let l = self.width;
        
        // Simply supported horizontally
        gamma * h * l.powi(2) / 8.0
    }
    
    /// Short wall pressure moment (kN·m/m)
    pub fn short_wall_moment(&self) -> f64 {
        let gamma = 10.0;
        let h = self.water_depth;
        let l = self.length;
        
        gamma * h * l.powi(2) / 8.0
    }
    
    /// Vertical cantilever moment at base (kN·m/m)
    pub fn cantilever_moment(&self) -> f64 {
        let gamma = 10.0;
        let h = self.water_depth;
        
        gamma * h.powi(3) / 6.0
    }
    
    /// Wall corner tension (kN/m)
    pub fn corner_tension(&self) -> f64 {
        let gamma = 10.0;
        let h = self.water_depth;
        
        // At corner
        gamma * h * self.width.min(self.length) / 2.0
    }
    
    /// Floor moment - long span (kN·m/m)
    pub fn floor_moment(&self, soil_reaction: f64) -> f64 {
        let w = soil_reaction - self.floor_thickness as f64 / 1000.0 * 25.0;
        let l = self.width;
        
        w * l.powi(2) / 8.0
    }
}

// ============================================================================
// AERATION BASIN
// ============================================================================

/// Aeration basin with diffusers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AerationBasin {
    /// Basin type
    pub basin: RectangularBasin,
    /// Diffuser depth below water (m)
    pub diffuser_depth: f64,
    /// Air flow rate (m³/h)
    pub air_flow: f64,
    /// Walkway live load (kN/m²)
    pub walkway_load: f64,
}

impl AerationBasin {
    pub fn new(length: f64, width: f64, depth: f64) -> Self {
        Self {
            basin: RectangularBasin::new(length, width, depth),
            diffuser_depth: depth - 0.3,
            air_flow: length * width * 50.0, // 50 m³/h/m²
            walkway_load: 5.0,
        }
    }
    
    /// Dynamic load from aeration (kN/m²)
    pub fn aeration_load(&self) -> f64 {
        // Air bubbles cause dynamic uplift
        0.5 * (self.air_flow / (self.basin.length * self.basin.width) / 100.0)
    }
    
    /// Wall vibration consideration
    pub fn wall_thickness_vibration(&self) -> f64 {
        // Increased thickness for aeration basins
        (self.basin.wall_thickness * 1.2).max(350.0)
    }
}

// ============================================================================
// DIGESTER
// ============================================================================

/// Digester type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DigesterType {
    /// Primary digester - heated/mixed
    Primary,
    /// Secondary digester - storage
    Secondary,
    /// Egg-shaped
    EggShaped,
}

/// Anaerobic digester
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Digester {
    /// Digester type
    pub digester_type: DigesterType,
    /// Inside diameter (m)
    pub diameter: f64,
    /// Sidewall height (m)
    pub sidewall_height: f64,
    /// Cone/dome roof
    pub has_fixed_roof: bool,
    /// Floating cover
    pub has_floating_cover: bool,
    /// Gas pressure (kPa)
    pub gas_pressure: f64,
    /// Wall thickness (mm)
    pub wall_thickness: f64,
}

impl Digester {
    pub fn new(diameter: f64, volume: f64) -> Self {
        let sidewall_height = volume * 4.0 / (PI * diameter.powi(2)) - diameter / 6.0;
        
        Self {
            digester_type: DigesterType::Primary,
            diameter,
            sidewall_height,
            has_fixed_roof: true,
            has_floating_cover: false,
            gas_pressure: 2.5, // Typical biogas
            wall_thickness: 400.0,
        }
    }
    
    /// Total volume (m³)
    pub fn total_volume(&self) -> f64 {
        let cylinder = PI * self.diameter.powi(2) / 4.0 * self.sidewall_height;
        let cone = PI * self.diameter.powi(2) / 4.0 * (self.diameter / 6.0) / 3.0;
        
        cylinder + 2.0 * cone // Top and bottom cones
    }
    
    /// Liquid level (m)
    pub fn liquid_level(&self) -> f64 {
        self.sidewall_height + self.diameter / 12.0
    }
    
    /// Hoop tension from liquid (kN/m)
    pub fn hoop_tension_liquid(&self, depth: f64) -> f64 {
        let sludge_density = 11.0; // kN/m³ (slightly > water)
        
        sludge_density * depth * self.diameter / 2.0
    }
    
    /// Hoop tension from gas (kN/m)
    pub fn hoop_tension_gas(&self) -> f64 {
        self.gas_pressure * self.diameter / 2.0
    }
    
    /// Maximum design hoop tension (kN/m)
    pub fn max_hoop_tension(&self) -> f64 {
        let t_liquid = self.hoop_tension_liquid(self.liquid_level());
        let t_gas = self.hoop_tension_gas();
        
        // Combined per ACI 350
        t_liquid + t_gas
    }
    
    /// Roof dome thrust (kN/m)
    pub fn dome_thrust(&self) -> f64 {
        if self.has_fixed_roof {
            let r_dome = self.diameter; // Typical radius
            let p = self.gas_pressure;
            
            p * r_dome / 2.0
        } else {
            0.0
        }
    }
    
    /// Floor cone forces (kN/m)
    pub fn floor_cone_thrust(&self) -> f64 {
        let sludge_density = 11.0;
        let depth = self.liquid_level();
        let angle = 15.0_f64.to_radians(); // Typical 1:4 slope
        
        sludge_density * depth * self.diameter / (4.0 * angle.sin())
    }
    
    /// Temperature reinforcement requirement
    pub fn temperature_steel_ratio(&self) -> f64 {
        match self.digester_type {
            DigesterType::Primary => 0.005, // Heated
            DigesterType::Secondary => 0.003,
            DigesterType::EggShaped => 0.004,
        }
    }
}

// ============================================================================
// FILTER STRUCTURES
// ============================================================================

/// Filter type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FilterType {
    /// Rapid sand filter
    RapidSand,
    /// Slow sand filter
    SlowSand,
    /// Gravity filter
    Gravity,
    /// Pressure filter
    Pressure,
}

/// Filter structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterStructure {
    /// Filter type
    pub filter_type: FilterType,
    /// Plan area (m²)
    pub filter_area: f64,
    /// Media depth (m)
    pub media_depth: f64,
    /// Water depth above media (m)
    pub water_depth: f64,
    /// Underdrain depth (m)
    pub underdrain_depth: f64,
}

impl FilterStructure {
    pub fn rapid_sand(area: f64) -> Self {
        Self {
            filter_type: FilterType::RapidSand,
            filter_area: area,
            media_depth: 0.75,
            water_depth: 1.5,
            underdrain_depth: 0.5,
        }
    }
    
    /// Total depth (m)
    pub fn total_depth(&self) -> f64 {
        self.media_depth + self.water_depth + self.underdrain_depth
    }
    
    /// Media load (kN/m²)
    pub fn media_load(&self) -> f64 {
        let media_density = 16.0; // kN/m³ saturated sand
        
        media_density * self.media_depth
    }
    
    /// Water load (kN/m²)
    pub fn water_load(&self) -> f64 {
        10.0 * self.water_depth
    }
    
    /// Total floor load (kN/m²)
    pub fn total_floor_load(&self) -> f64 {
        self.media_load() + self.water_load() + 2.0 // Equipment
    }
    
    /// Wall hydrostatic load (kN/m)
    pub fn wall_load(&self) -> f64 {
        let h = self.total_depth();
        
        10.0 * h.powi(2) / 2.0
    }
    
    /// Backwash uplift (kN/m²)
    pub fn backwash_uplift(&self) -> f64 {
        match self.filter_type {
            FilterType::RapidSand => 15.0, // High backwash rate
            FilterType::Gravity => 10.0,
            _ => 5.0,
        }
    }
    
    /// Floor slab design moment (kN·m/m)
    pub fn floor_moment(&self, span: f64) -> f64 {
        let w = self.total_floor_load();
        
        w * span.powi(2) / 8.0
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_circular_tank() {
        let tank = CircularTank::new(20.0, 5.0, 35.0);
        
        let volume = tank.volume();
        assert!(volume > 1500.0 && volume < 2000.0);
    }

    #[test]
    fn test_hoop_tension() {
        let tank = CircularTank::new(30.0, 6.0, 40.0);
        
        let t_max = tank.max_hoop_tension();
        assert!(t_max > 500.0);
    }

    #[test]
    fn test_required_steel() {
        let tank = CircularTank::new(25.0, 5.0, 35.0);
        
        let as_req = tank.required_hoop_steel(400.0);
        assert!(as_req > 1000.0);
    }

    #[test]
    fn test_exposure_class() {
        let normal = ExposureClass::Normal;
        let severe = ExposureClass::Severe;
        
        assert!(severe.crack_width_limit() < normal.crack_width_limit());
        assert!(severe.min_cover() > normal.min_cover());
    }

    #[test]
    fn test_rectangular_basin() {
        let basin = RectangularBasin::new(30.0, 10.0, 4.0);
        
        let vol = basin.volume();
        assert!((vol - 1200.0).abs() < 1.0);
    }

    #[test]
    fn test_wall_moments() {
        let basin = RectangularBasin::new(20.0, 8.0, 5.0);
        
        let m_long = basin.long_wall_moment();
        let m_cantilever = basin.cantilever_moment();
        
        assert!(m_long > 0.0);
        assert!(m_cantilever > 0.0);
    }

    #[test]
    fn test_digester() {
        let digester = Digester::new(20.0, 5000.0);
        
        let vol = digester.total_volume();
        assert!(vol > 4000.0 && vol < 6000.0);
    }

    #[test]
    fn test_digester_tension() {
        let digester = Digester::new(25.0, 8000.0);
        
        let t_max = digester.max_hoop_tension();
        assert!(t_max > 500.0);
    }

    #[test]
    fn test_filter() {
        let filter = FilterStructure::rapid_sand(50.0);
        
        assert!(filter.total_depth() > 2.0);
        assert!(filter.total_floor_load() > 20.0);
    }

    #[test]
    fn test_aeration_basin() {
        let basin = AerationBasin::new(40.0, 10.0, 5.0);
        
        let air_load = basin.aeration_load();
        assert!(air_load > 0.0 && air_load < 1.0);
    }

    #[test]
    fn test_crack_width() {
        let mut tank = CircularTank::new(15.0, 4.0, 35.0);
        tank.exposure = ExposureClass::Severe;
        
        let w = tank.check_crack_width(200.0, 150.0);
        assert!(w > 0.0 && w < 0.5);
    }
}
