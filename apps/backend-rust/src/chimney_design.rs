// ============================================================================
// CHIMNEY & STACK DESIGN MODULE
// ACI 307, EN 13084, IS 4998 - Industrial chimneys
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// CHIMNEY TYPES
// ============================================================================

/// Chimney construction type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ChimneyType {
    /// Reinforced concrete
    ReinforcedConcrete,
    /// Steel
    Steel,
    /// Brick/masonry
    Masonry,
    /// FRP/GRP
    FRP,
    /// Guyed steel
    GuyedSteel,
}

/// Chimney liner type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LinerType {
    /// Unlined
    None,
    /// Brick liner
    Brick,
    /// Steel liner
    Steel,
    /// FRP liner
    FRP,
    /// Acid resistant
    AcidResistant,
    /// Gunite/shotcrete
    Gunite,
}

// ============================================================================
// CONCRETE CHIMNEY (ACI 307)
// ============================================================================

/// Concrete chimney shell
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcreteChimney {
    /// Total height (m)
    pub height: f64,
    /// Base outside diameter (m)
    pub base_diameter: f64,
    /// Top outside diameter (m)
    pub top_diameter: f64,
    /// Base wall thickness (mm)
    pub base_thickness: f64,
    /// Top wall thickness (mm)
    pub top_thickness: f64,
    /// Concrete strength fck (MPa)
    pub fck: f64,
    /// Reinforcement yield fy (MPa)
    pub fy: f64,
    /// Liner type
    pub liner_type: LinerType,
}

impl ConcreteChimney {
    pub fn new(height: f64, base_diameter: f64) -> Self {
        // Typical proportions
        let top_diameter = base_diameter * 0.5;
        let base_thickness = (height / 15.0 * 1000.0).max(200.0).min(600.0);
        
        Self {
            height,
            base_diameter,
            top_diameter,
            base_thickness,
            top_thickness: base_thickness * 0.6,
            fck: 35.0,
            fy: 420.0,
            liner_type: LinerType::Brick,
        }
    }
    
    /// Diameter at height z (m)
    pub fn diameter_at(&self, z: f64) -> f64 {
        let ratio = z / self.height;
        self.base_diameter - (self.base_diameter - self.top_diameter) * ratio
    }
    
    /// Wall thickness at height z (mm)
    pub fn thickness_at(&self, z: f64) -> f64 {
        let ratio = z / self.height;
        self.base_thickness - (self.base_thickness - self.top_thickness) * ratio
    }
    
    /// Cross-sectional area at height (m²)
    pub fn area_at(&self, z: f64) -> f64 {
        let d_out = self.diameter_at(z);
        let t = self.thickness_at(z) / 1000.0;
        let d_in = d_out - 2.0 * t;
        
        PI * (d_out.powi(2) - d_in.powi(2)) / 4.0
    }
    
    /// Second moment of area at height (m⁴)
    pub fn inertia_at(&self, z: f64) -> f64 {
        let d_out = self.diameter_at(z);
        let t = self.thickness_at(z) / 1000.0;
        let d_in = d_out - 2.0 * t;
        
        PI * (d_out.powi(4) - d_in.powi(4)) / 64.0
    }
    
    /// Section modulus at height (m³)
    pub fn section_modulus_at(&self, z: f64) -> f64 {
        2.0 * self.inertia_at(z) / self.diameter_at(z)
    }
    
    /// Self-weight above height z (kN)
    pub fn weight_above(&self, z: f64) -> f64 {
        let gamma = 25.0; // kN/m³
        let n_segments = 20;
        let dz = (self.height - z) / n_segments as f64;
        
        let mut weight = 0.0;
        for i in 0..n_segments {
            let zi = z + (i as f64 + 0.5) * dz;
            weight += self.area_at(zi) * dz * gamma;
        }
        
        weight
    }
    
    /// Total self-weight (kN)
    pub fn total_weight(&self) -> f64 {
        self.weight_above(0.0)
    }
    
    /// First mode period (s) - simplified
    pub fn fundamental_period(&self) -> f64 {
        // Approximate formula for tapered chimney
        let e = 30000.0; // MPa
        let gamma = 25.0 / 9.81; // t/m³
        
        let i_base = self.inertia_at(0.0);
        let a_avg = (self.area_at(0.0) + self.area_at(self.height)) / 2.0;
        
        // Simplified cantilever
        let c = 1.79;
        
        c * (gamma * a_avg * self.height.powi(4) / (e * 1e6 * i_base)).sqrt()
    }
    
    /// Critical wind speed for vortex shedding (m/s)
    pub fn critical_wind_speed(&self) -> f64 {
        let st = 0.2; // Strouhal number for cylinder
        let d_top = self.top_diameter;
        let f = 1.0 / self.fundamental_period();
        
        f * d_top / st
    }
    
    /// Minimum vertical reinforcement ratio
    pub fn min_vertical_ratio(&self) -> f64 {
        0.0025 // ACI 307 minimum
    }
    
    /// Minimum circumferential reinforcement ratio
    pub fn min_circumferential_ratio(&self) -> f64 {
        0.002 // ACI 307 minimum
    }
    
    /// Opening height limit (m)
    pub fn max_opening_height(&self) -> f64 {
        self.height / 3.0
    }
    
    /// Corbel requirement
    pub fn liner_corbel_spacing(&self) -> f64 {
        15.0 // m typical
    }
}

// ============================================================================
// STEEL CHIMNEY
// ============================================================================

/// Steel chimney/stack
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelChimney {
    /// Total height (m)
    pub height: f64,
    /// Outside diameter (m)
    pub diameter: f64,
    /// Shell thickness (mm)
    pub thickness: f64,
    /// Steel grade fy (MPa)
    pub fy: f64,
    /// Is lined
    pub is_lined: bool,
    /// Insulation thickness (mm)
    pub insulation: f64,
    /// Operating temperature (°C)
    pub temperature: f64,
}

impl SteelChimney {
    pub fn new(height: f64, diameter: f64) -> Self {
        // Typical thickness
        let thickness = (diameter * 1000.0 / 200.0).max(6.0).min(25.0);
        
        Self {
            height,
            diameter,
            thickness,
            fy: 250.0,
            is_lined: true,
            insulation: 100.0,
            temperature: 150.0,
        }
    }
    
    /// Cross-sectional area (mm²)
    pub fn area(&self) -> f64 {
        let d_out = self.diameter * 1000.0;
        let d_in = d_out - 2.0 * self.thickness;
        
        PI * (d_out.powi(2) - d_in.powi(2)) / 4.0
    }
    
    /// Second moment of area (mm⁴)
    pub fn inertia(&self) -> f64 {
        let d_out = self.diameter * 1000.0;
        let d_in = d_out - 2.0 * self.thickness;
        
        PI * (d_out.powi(4) - d_in.powi(4)) / 64.0
    }
    
    /// Section modulus (mm³)
    pub fn section_modulus(&self) -> f64 {
        2.0 * self.inertia() / (self.diameter * 1000.0)
    }
    
    /// Radius of gyration (mm)
    pub fn radius_of_gyration(&self) -> f64 {
        (self.inertia() / self.area()).sqrt()
    }
    
    /// Self-weight (kN/m)
    pub fn weight_per_m(&self) -> f64 {
        let steel_weight = self.area() * 7850.0 / 1e9; // kN/m
        
        if self.is_lined {
            steel_weight + 0.5 // Approximate liner weight
        } else {
            steel_weight
        }
    }
    
    /// Total weight (kN)
    pub fn total_weight(&self) -> f64 {
        self.weight_per_m() * self.height
    }
    
    /// Fundamental period (s)
    pub fn fundamental_period(&self) -> f64 {
        let e = 200000.0; // MPa
        let m_per_length = self.weight_per_m() / 9.81 * 1000.0; // kg/m
        let i = self.inertia() / 1e12; // m⁴
        
        // Cantilever beam
        let omega = 1.875_f64.powi(2) * (e * 1e9 * i / (m_per_length * self.height.powi(4))).sqrt();
        
        2.0 * PI / omega
    }
    
    /// Temperature strength reduction factor
    pub fn temperature_factor(&self) -> f64 {
        if self.temperature <= 100.0 {
            1.0
        } else if self.temperature <= 200.0 {
            1.0 - (self.temperature - 100.0) * 0.001
        } else if self.temperature <= 400.0 {
            0.9 - (self.temperature - 200.0) * 0.002
        } else {
            0.5
        }
    }
    
    /// Allowable stress (MPa)
    pub fn allowable_stress(&self) -> f64 {
        self.fy * self.temperature_factor() / 1.5
    }
    
    /// Minimum shell thickness (mm)
    pub fn minimum_thickness(&self) -> f64 {
        // Corrosion + structural minimum
        if self.is_lined {
            (self.diameter * 1000.0 / 400.0).max(5.0)
        } else {
            (self.diameter * 1000.0 / 400.0).max(6.0) + 3.0 // Corrosion allowance
        }
    }
    
    /// Shell buckling stress (MPa)
    pub fn buckling_stress(&self) -> f64 {
        let e = 200000.0;
        let r = self.diameter * 1000.0 / 2.0;
        let t = self.thickness;
        
        // Classical elastic buckling
        let sigma_cr = 0.3 * e * t / r;
        
        // Knockdown factor for imperfections
        sigma_cr * 0.6
    }
    
    /// Check combined stress
    pub fn check_combined(&self, moment: f64, axial: f64, shear: f64) -> StressCheck {
        let sigma_m = moment * 1e6 / self.section_modulus();
        let sigma_a = axial * 1000.0 / self.area();
        let tau = shear * 1000.0 / (0.5 * self.area());
        
        let sigma_total = sigma_m + sigma_a;
        let sigma_vm = (sigma_total.powi(2) + 3.0 * tau.powi(2)).sqrt();
        
        let sigma_allow = self.allowable_stress();
        let sigma_buck = self.buckling_stress();
        
        StressCheck {
            bending_stress: sigma_m,
            axial_stress: sigma_a,
            shear_stress: tau,
            von_mises: sigma_vm,
            utilization: sigma_vm / sigma_allow.min(sigma_buck),
            is_adequate: sigma_vm <= sigma_allow.min(sigma_buck),
        }
    }
}

/// Stress check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StressCheck {
    pub bending_stress: f64,
    pub axial_stress: f64,
    pub shear_stress: f64,
    pub von_mises: f64,
    pub utilization: f64,
    pub is_adequate: bool,
}

// ============================================================================
// WIND LOADS ON CHIMNEYS
// ============================================================================

/// Chimney wind loading
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChimneyWindLoad {
    /// Basic wind speed (m/s)
    pub basic_wind_speed: f64,
    /// Terrain category (1-4)
    pub terrain_category: u32,
    /// Importance factor
    pub importance: f64,
}

impl ChimneyWindLoad {
    pub fn new(wind_speed: f64, terrain: u32) -> Self {
        Self {
            basic_wind_speed: wind_speed,
            terrain_category: terrain,
            importance: 1.0,
        }
    }
    
    /// Reference wind pressure (kPa)
    pub fn reference_pressure(&self) -> f64 {
        0.5 * 1.225 * self.basic_wind_speed.powi(2) / 1000.0
    }
    
    /// Exposure factor at height
    pub fn exposure_factor(&self, z: f64) -> f64 {
        let (_z0, zmin) = match self.terrain_category {
            1 => (0.01, 2.0),
            2 => (0.05, 4.0),
            3 => (0.3, 8.0),
            4 => (1.0, 15.0),
            _ => (0.05, 4.0),
        };
        
        let z_eff = z.max(zmin);
        
        // Simplified power law
        2.0 * (z_eff / 10.0).powf(0.2)
    }
    
    /// Turbulence intensity at height
    pub fn turbulence_intensity(&self, z: f64) -> f64 {
        let z0 = match self.terrain_category {
            1 => 0.01,
            2 => 0.05,
            3 => 0.3,
            4 => 1.0,
            _ => 0.05,
        };
        
        1.0 / (z / z0).ln()
    }
    
    /// Drag coefficient for cylinder
    pub fn drag_coefficient(&self, reynolds: f64) -> f64 {
        // Reynolds number dependent
        if reynolds < 3e5 {
            1.2
        } else if reynolds < 3.5e6 {
            0.9 - 0.5 * ((reynolds - 3e5) / 3e6).min(1.0)
        } else {
            0.7
        }
    }
    
    /// Along-wind force per unit height (kN/m)
    pub fn wind_force(&self, z: f64, diameter: f64) -> f64 {
        let q = self.reference_pressure();
        let ce = self.exposure_factor(z);
        
        // Estimate Reynolds number
        let v = self.basic_wind_speed * (z / 10.0).powf(0.15);
        let re = v * diameter / 1.5e-5;
        let cd = self.drag_coefficient(re);
        
        q * ce * cd * diameter * self.importance
    }
    
    /// Base shear (kN) for chimney
    pub fn base_shear(&self, chimney: &ConcreteChimney) -> f64 {
        let n_segments = 20;
        let dz = chimney.height / n_segments as f64;
        
        let mut v = 0.0;
        for i in 0..n_segments {
            let z = (i as f64 + 0.5) * dz;
            let d = chimney.diameter_at(z);
            v += self.wind_force(z, d) * dz;
        }
        
        v
    }
    
    /// Base moment (kN·m) for chimney
    pub fn base_moment(&self, chimney: &ConcreteChimney) -> f64 {
        let n_segments = 20;
        let dz = chimney.height / n_segments as f64;
        
        let mut m = 0.0;
        for i in 0..n_segments {
            let z = (i as f64 + 0.5) * dz;
            let d = chimney.diameter_at(z);
            let f = self.wind_force(z, d) * dz;
            m += f * z;
        }
        
        m
    }
}

// ============================================================================
// GUYED STACK
// ============================================================================

/// Guyed steel stack
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuyedStack {
    /// Stack height (m)
    pub height: f64,
    /// Stack diameter (m)
    pub diameter: f64,
    /// Shell thickness (mm)
    pub thickness: f64,
    /// Number of guy levels
    pub guy_levels: u32,
    /// Guy angle from horizontal (degrees)
    pub guy_angle: f64,
    /// Number of guys per level
    pub guys_per_level: u32,
    /// Guy wire diameter (mm)
    pub guy_diameter: f64,
    /// Guy wire breaking strength (kN)
    pub guy_strength: f64,
}

impl GuyedStack {
    pub fn new(height: f64, diameter: f64) -> Self {
        let guy_levels = (height / 30.0).ceil() as u32;
        
        Self {
            height,
            diameter,
            thickness: 6.0,
            guy_levels,
            guy_angle: 45.0,
            guys_per_level: 3, // Minimum
            guy_diameter: 16.0,
            guy_strength: 150.0,
        }
    }
    
    /// Height of guy level (m)
    pub fn guy_height(&self, level: u32) -> f64 {
        self.height * (level as f64 + 1.0) / (self.guy_levels as f64 + 1.0)
    }
    
    /// Guy length (m)
    pub fn guy_length(&self, level: u32) -> f64 {
        let h = self.guy_height(level);
        let angle_rad = self.guy_angle.to_radians();
        
        h / angle_rad.sin()
    }
    
    /// Anchor radius (m)
    pub fn anchor_radius(&self, level: u32) -> f64 {
        let h = self.guy_height(level);
        let angle_rad = self.guy_angle.to_radians();
        
        h / angle_rad.tan()
    }
    
    /// Guy horizontal stiffness (kN/m)
    pub fn guy_stiffness(&self, level: u32) -> f64 {
        let e = 200000.0; // MPa for steel wire
        let a = PI * self.guy_diameter.powi(2) / 4.0; // mm²
        let l = self.guy_length(level) * 1000.0; // mm
        let angle_rad = self.guy_angle.to_radians();
        
        e * a / l * angle_rad.cos().powi(2)
    }
    
    /// Allowable guy tension (kN)
    pub fn allowable_tension(&self) -> f64 {
        self.guy_strength / 2.5 // Safety factor
    }
    
    /// Initial guy tension (kN)
    pub fn initial_tension(&self) -> f64 {
        self.allowable_tension() * 0.1 // 10% of allowable
    }
    
    /// Effective length between guys (m)
    pub fn effective_length(&self) -> f64 {
        self.height / (self.guy_levels as f64 + 1.0)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_concrete_chimney() {
        let chimney = ConcreteChimney::new(100.0, 10.0);
        
        assert!(chimney.top_diameter < chimney.base_diameter);
        assert!(chimney.diameter_at(50.0) > chimney.top_diameter);
    }

    #[test]
    fn test_chimney_properties() {
        let chimney = ConcreteChimney::new(80.0, 8.0);
        
        let area_base = chimney.area_at(0.0);
        let area_top = chimney.area_at(80.0);
        
        assert!(area_base > area_top);
    }

    #[test]
    fn test_chimney_weight() {
        let chimney = ConcreteChimney::new(100.0, 10.0);
        
        let weight = chimney.total_weight();
        assert!(weight > 5000.0); // Substantial weight
    }

    #[test]
    fn test_chimney_period() {
        let chimney = ConcreteChimney::new(100.0, 10.0);
        
        let t = chimney.fundamental_period();
        assert!(t > 0.01 && t < 10.0); // Reasonable range for tall chimney
    }

    #[test]
    fn test_steel_chimney() {
        let stack = SteelChimney::new(50.0, 3.0);
        
        assert!(stack.thickness >= 6.0); // Minimum is 6mm
        assert!(stack.fundamental_period() > 0.0); // Just verify positive
    }

    #[test]
    fn test_steel_temperature() {
        let mut stack = SteelChimney::new(40.0, 2.5);
        stack.temperature = 200.0;
        
        assert!(stack.temperature_factor() < 1.0);
    }

    #[test]
    fn test_steel_buckling() {
        let stack = SteelChimney::new(60.0, 4.0);
        
        let sigma = stack.buckling_stress();
        assert!(sigma > 50.0 && sigma < 500.0);
    }

    #[test]
    fn test_wind_load() {
        let wind = ChimneyWindLoad::new(40.0, 2);
        let chimney = ConcreteChimney::new(100.0, 10.0);
        
        let shear = wind.base_shear(&chimney);
        let moment = wind.base_moment(&chimney);
        
        assert!(shear > 100.0);
        assert!(moment > 5000.0);
    }

    #[test]
    fn test_guyed_stack() {
        let guyed = GuyedStack::new(80.0, 2.0);
        
        assert!(guyed.guy_levels >= 2);
        assert!(guyed.guy_length(0) > guyed.guy_height(0));
    }

    #[test]
    fn test_guy_stiffness() {
        let guyed = GuyedStack::new(60.0, 1.5);
        
        let k = guyed.guy_stiffness(0);
        assert!(k > 10.0);
    }

    #[test]
    fn test_exposure_factor() {
        let wind = ChimneyWindLoad::new(35.0, 2);
        
        let ce_10 = wind.exposure_factor(10.0);
        let ce_100 = wind.exposure_factor(100.0);
        
        assert!(ce_100 > ce_10);
    }
}
