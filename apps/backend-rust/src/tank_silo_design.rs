// ============================================================================
// TANK & SILO DESIGN MODULE
// IS 3370, ACI 350, Eurocode 2 Part 3 - Liquid retaining structures
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// TANK TYPES AND GEOMETRY
// ============================================================================

/// Tank configuration types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TankType {
    /// Circular ground-supported tank
    CircularGround,
    /// Rectangular ground tank
    RectangularGround,
    /// Elevated circular tank (Intze, shaft)
    ElevatedCircular,
    /// Underground tank
    Underground,
    /// Circular with conical bottom
    ConicalBottom,
    /// Circular with domed roof
    DomedRoof,
}

/// Silo types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SiloType {
    /// Deep silo (H/D > 1.5)
    Deep,
    /// Shallow silo/bunker (H/D <= 1.5)
    Shallow,
    /// Hopper bottom
    HopperBottom,
    /// Flat bottom
    FlatBottom,
}

/// Liquid/material stored
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StoredMaterial {
    Water,
    Oil,
    Chemicals,
    Grain,
    Cement,
    Coal,
    Sugar,
    Custom,
}

impl StoredMaterial {
    /// Unit weight (kN/m³)
    pub fn unit_weight(&self) -> f64 {
        match self {
            StoredMaterial::Water => 10.0,
            StoredMaterial::Oil => 9.0,
            StoredMaterial::Chemicals => 12.0,
            StoredMaterial::Grain => 8.5,
            StoredMaterial::Cement => 15.0,
            StoredMaterial::Coal => 9.0,
            StoredMaterial::Sugar => 9.5,
            StoredMaterial::Custom => 10.0,
        }
    }
    
    /// Angle of repose for granular (degrees)
    pub fn angle_of_repose(&self) -> f64 {
        match self {
            StoredMaterial::Grain => 28.0,
            StoredMaterial::Cement => 30.0,
            StoredMaterial::Coal => 35.0,
            StoredMaterial::Sugar => 32.0,
            _ => 30.0,
        }
    }
    
    /// Wall friction coefficient
    pub fn wall_friction(&self) -> f64 {
        match self {
            StoredMaterial::Grain => 0.40,
            StoredMaterial::Cement => 0.45,
            StoredMaterial::Coal => 0.50,
            StoredMaterial::Sugar => 0.42,
            _ => 0.40,
        }
    }
}

// ============================================================================
// CIRCULAR TANK DESIGN (IS 3370)
// ============================================================================

/// Circular tank geometry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircularTank {
    /// Internal diameter (m)
    pub diameter: f64,
    /// Liquid height (m)
    pub liquid_height: f64,
    /// Freeboard (m)
    pub freeboard: f64,
    /// Wall thickness (mm)
    pub wall_thickness: f64,
    /// Base slab thickness (mm)
    pub base_thickness: f64,
    /// Stored material
    pub material: StoredMaterial,
    /// Tank type
    pub tank_type: TankType,
}

impl CircularTank {
    pub fn new(diameter: f64, liquid_height: f64) -> Self {
        Self {
            diameter,
            liquid_height,
            freeboard: 0.3,
            wall_thickness: 200.0,
            base_thickness: 250.0,
            material: StoredMaterial::Water,
            tank_type: TankType::CircularGround,
        }
    }
    
    /// Total height (m)
    pub fn total_height(&self) -> f64 {
        self.liquid_height + self.freeboard
    }
    
    /// Internal radius (m)
    pub fn radius(&self) -> f64 {
        self.diameter / 2.0
    }
    
    /// Volume capacity (m³)
    pub fn volume(&self) -> f64 {
        PI * self.radius().powi(2) * self.liquid_height
    }
    
    /// Hoop tension at depth h from top (kN/m)
    pub fn hoop_tension(&self, depth: f64) -> f64 {
        let gamma = self.material.unit_weight();
        let r = self.radius();
        gamma * depth * r
    }
    
    /// Maximum hoop tension at base (kN/m)
    pub fn max_hoop_tension(&self) -> f64 {
        self.hoop_tension(self.liquid_height)
    }
    
    /// Vertical moment at base (fixed base) (kN·m/m)
    pub fn base_moment_fixed(&self) -> f64 {
        let gamma = self.material.unit_weight();
        let h = self.liquid_height;
        let _r = self.radius();
        let t = self.wall_thickness / 1000.0;
        
        // Coefficient based on H²/(D*t)
        let param = h.powi(2) / (self.diameter * t);
        let coeff = if param < 5.0 { 0.05 } 
                    else if param < 10.0 { 0.08 }
                    else { 0.10 };
        
        coeff * gamma * h.powi(3)
    }
    
    /// Required hoop steel area (mm²/m height)
    pub fn required_hoop_steel(&self, depth: f64, sigma_st: f64) -> f64 {
        let t = self.hoop_tension(depth) * 1000.0; // N/m
        t / sigma_st
    }
    
    /// Minimum wall thickness per IS 3370 (mm)
    pub fn min_wall_thickness(&self) -> f64 {
        let h = self.liquid_height;
        
        // IS 3370: min 150mm or H/40 (whichever greater)
        (150.0_f64).max(h * 1000.0 / 40.0)
    }
    
    /// Hydrostatic pressure at depth (kPa)
    pub fn pressure(&self, depth: f64) -> f64 {
        self.material.unit_weight() * depth
    }
}

/// Circular tank designer per IS 3370
pub struct Is3370TankDesigner {
    pub tank: CircularTank,
    /// Concrete grade fck (MPa)
    pub fck: f64,
    /// Steel grade fy (MPa)  
    pub fy: f64,
    /// Permissible tensile stress in concrete (MPa)
    pub sigma_ct: f64,
    /// Permissible stress in steel (MPa)
    pub sigma_st: f64,
    /// Crack width limit (mm)
    pub crack_limit: f64,
}

impl Is3370TankDesigner {
    pub fn new(tank: CircularTank) -> Self {
        Self {
            tank,
            fck: 30.0,
            fy: 500.0,
            sigma_ct: 1.5,  // IS 3370 Table 1
            sigma_st: 130.0, // IS 3370 Table 2 (water face)
            crack_limit: 0.20,
        }
    }
    
    /// Design wall for hoop tension
    pub fn design_wall(&self) -> TankWallDesign {
        let t_max = self.tank.max_hoop_tension();
        let m_base = self.tank.base_moment_fixed();
        
        // Required hoop steel at base
        let as_hoop = t_max * 1000.0 / self.sigma_st;
        
        // Required vertical steel for moment
        let d = self.tank.wall_thickness - 50.0; // Effective depth
        let as_vert = m_base * 1e6 / (0.87 * self.fy * 0.9 * d);
        
        // Minimum steel (0.35% for HYSD)
        let as_min = 0.0035 * self.tank.wall_thickness * 1000.0;
        
        // Check concrete stress
        let concrete_stress = t_max * 1000.0 / (self.tank.wall_thickness * 1000.0 + 
                             (self.fy / self.fck - 1.0) * as_hoop);
        
        TankWallDesign {
            wall_thickness: self.tank.wall_thickness,
            hoop_steel: as_hoop.max(as_min),
            vertical_steel: as_vert.max(as_min / 2.0),
            max_hoop_tension: t_max,
            base_moment: m_base,
            concrete_stress,
            steel_stress: self.sigma_st,
            crack_width_ok: concrete_stress < self.sigma_ct,
        }
    }
    
    /// Design base slab
    pub fn design_base(&self) -> TankBaseDesign {
        let r = self.tank.radius();
        let h = self.tank.liquid_height;
        let gamma = self.tank.material.unit_weight();
        
        // Base pressure from liquid
        let liquid_pressure = gamma * h;
        
        // Self weight of base
        let base_weight = 25.0 * self.tank.base_thickness / 1000.0;
        
        // Net upward pressure (for ground tanks, assume soil reaction)
        let net_pressure = liquid_pressure + base_weight;
        
        // Radial moment at center (circular plate)
        let m_radial = net_pressure * r.powi(2) / 16.0;
        
        // Circumferential moment
        let m_circ = net_pressure * r.powi(2) / 16.0;
        
        // Required steel
        let d = self.tank.base_thickness - 50.0;
        let as_radial = m_radial * 1e6 / (0.87 * self.fy * 0.9 * d);
        let as_circ = m_circ * 1e6 / (0.87 * self.fy * 0.9 * d);
        
        let as_min = 0.0035 * self.tank.base_thickness * 1000.0;
        
        TankBaseDesign {
            thickness: self.tank.base_thickness,
            radial_steel: as_radial.max(as_min),
            circumferential_steel: as_circ.max(as_min),
            radial_moment: m_radial,
            circumferential_moment: m_circ,
            bearing_pressure: net_pressure,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TankWallDesign {
    pub wall_thickness: f64,
    pub hoop_steel: f64,
    pub vertical_steel: f64,
    pub max_hoop_tension: f64,
    pub base_moment: f64,
    pub concrete_stress: f64,
    pub steel_stress: f64,
    pub crack_width_ok: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TankBaseDesign {
    pub thickness: f64,
    pub radial_steel: f64,
    pub circumferential_steel: f64,
    pub radial_moment: f64,
    pub circumferential_moment: f64,
    pub bearing_pressure: f64,
}

// ============================================================================
// RECTANGULAR TANK DESIGN
// ============================================================================

/// Rectangular tank geometry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RectangularTank {
    /// Length (m)
    pub length: f64,
    /// Width (m)
    pub width: f64,
    /// Liquid height (m)
    pub liquid_height: f64,
    /// Wall thickness (mm)
    pub wall_thickness: f64,
    /// Stored material
    pub material: StoredMaterial,
}

impl RectangularTank {
    pub fn new(length: f64, width: f64, liquid_height: f64) -> Self {
        Self {
            length,
            width,
            liquid_height,
            wall_thickness: 200.0,
            material: StoredMaterial::Water,
        }
    }
    
    /// Volume (m³)
    pub fn volume(&self) -> f64 {
        self.length * self.width * self.liquid_height
    }
    
    /// Aspect ratio L/B
    pub fn aspect_ratio(&self) -> f64 {
        self.length / self.width
    }
    
    /// Long wall bending moment (kN·m/m) - IS 3370 Table 3
    pub fn long_wall_moment(&self) -> f64 {
        let gamma = self.material.unit_weight();
        let h = self.liquid_height;
        let a = self.length / 2.0;
        let b = self.width / 2.0;
        
        let ratio = a / b;
        
        // Coefficient from IS 3370 Table 3 (simplified)
        let coeff = if ratio <= 0.5 { 0.125 }
                    else if ratio <= 1.0 { 0.08 }
                    else if ratio <= 2.0 { 0.05 }
                    else { 0.03 };
        
        coeff * gamma * h.powi(3)
    }
    
    /// Short wall bending moment (kN·m/m)
    pub fn short_wall_moment(&self) -> f64 {
        let gamma = self.material.unit_weight();
        let h = self.liquid_height;
        let a = self.length / 2.0;
        let b = self.width / 2.0;
        
        let ratio = a / b;
        
        // Short wall takes more load
        let coeff = if ratio <= 0.5 { 0.06 }
                    else if ratio <= 1.0 { 0.08 }
                    else if ratio <= 2.0 { 0.10 }
                    else { 0.125 };
        
        coeff * gamma * h.powi(3)
    }
    
    /// Direct tension in long wall (kN/m)
    pub fn long_wall_tension(&self) -> f64 {
        let gamma = self.material.unit_weight();
        let h = self.liquid_height;
        let b = self.width;
        
        gamma * h * b / 2.0
    }
    
    /// Direct tension in short wall (kN/m)
    pub fn short_wall_tension(&self) -> f64 {
        let gamma = self.material.unit_weight();
        let h = self.liquid_height;
        let a = self.length;
        
        gamma * h * a / 2.0
    }
}

// ============================================================================
// SILO DESIGN (JANSSEN'S THEORY)
// ============================================================================

/// Silo geometry and parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Silo {
    /// Internal diameter (m)
    pub diameter: f64,
    /// Height of stored material (m)
    pub fill_height: f64,
    /// Hopper angle (degrees)
    pub hopper_angle: f64,
    /// Wall thickness (mm)
    pub wall_thickness: f64,
    /// Stored material
    pub material: StoredMaterial,
    /// Silo type
    pub silo_type: SiloType,
}

impl Silo {
    pub fn new(diameter: f64, fill_height: f64, material: StoredMaterial) -> Self {
        let silo_type = if fill_height / diameter > 1.5 {
            SiloType::Deep
        } else {
            SiloType::Shallow
        };
        
        Self {
            diameter,
            fill_height,
            hopper_angle: 60.0,
            wall_thickness: 200.0,
            material,
            silo_type,
        }
    }
    
    /// Hydraulic radius R = A/P = D/4 for circular
    pub fn hydraulic_radius(&self) -> f64 {
        self.diameter / 4.0
    }
    
    /// Janssen's ratio k = (1 - sin φ) / (1 + sin φ)
    pub fn janssen_k(&self) -> f64 {
        let phi_rad = self.material.angle_of_repose().to_radians();
        (1.0 - phi_rad.sin()) / (1.0 + phi_rad.sin())
    }
    
    /// Characteristic depth z0 = R / (k * μ)
    pub fn characteristic_depth(&self) -> f64 {
        let r = self.hydraulic_radius();
        let k = self.janssen_k();
        let mu = self.material.wall_friction();
        
        r / (k * mu)
    }
    
    /// Horizontal pressure at depth z (Janssen) (kPa)
    pub fn horizontal_pressure(&self, z: f64) -> f64 {
        let gamma = self.material.unit_weight();
        let z0 = self.characteristic_depth();
        let k = self.janssen_k();
        
        // ph = k * γ * z0 * (1 - e^(-z/z0)), where pv = γ·z0·(1-e^(-z/z0))
        k * gamma * z0 * (1.0 - (-z / z0).exp())
    }
    
    /// Vertical pressure at depth z (kPa)
    pub fn vertical_pressure(&self, z: f64) -> f64 {
        self.horizontal_pressure(z) / self.janssen_k()
    }
    
    /// Maximum horizontal pressure (at great depth)
    pub fn max_horizontal_pressure(&self) -> f64 {
        let gamma = self.material.unit_weight();
        let z0 = self.characteristic_depth();
        let k = self.janssen_k();
        // ph_max = k * γ * z0 = γ * R / μ
        k * gamma * z0
    }
    
    /// Wall friction force per unit area (kPa)
    pub fn wall_friction(&self, z: f64) -> f64 {
        let mu = self.material.wall_friction();
        self.horizontal_pressure(z) * mu
    }
    
    /// Hoop tension in wall at depth z (kN/m)
    pub fn hoop_tension(&self, z: f64) -> f64 {
        let ph = self.horizontal_pressure(z);
        let r = self.diameter / 2.0;
        ph * r
    }
    
    /// Cumulative vertical wall load (kN/m circumference)
    pub fn vertical_wall_load(&self, z: f64) -> f64 {
        let gamma = self.material.unit_weight();
        let z0 = self.characteristic_depth();
        let r = self.hydraulic_radius();
        
        // Fv = γR(z - z0(1 - e^(-z/z0))) from vertical equilibrium
        gamma * r * (z - z0 * (1.0 - (-z / z0).exp()))
    }
    
    /// Overpressure factor for filling/discharge
    pub fn overpressure_factor(&self, is_discharge: bool) -> f64 {
        if is_discharge {
            // Higher pressures during discharge
            match self.silo_type {
                SiloType::Deep => 1.5,
                SiloType::Shallow => 1.35,
                _ => 1.4,
            }
        } else {
            1.0
        }
    }
}

/// Silo wall designer
pub struct SiloDesigner {
    pub silo: Silo,
    /// Concrete grade (MPa)
    pub fck: f64,
    /// Steel grade (MPa)
    pub fy: f64,
}

impl SiloDesigner {
    pub fn new(silo: Silo) -> Self {
        Self {
            silo,
            fck: 30.0,
            fy: 500.0,
        }
    }
    
    /// Design silo wall
    pub fn design_wall(&self) -> SiloWallDesign {
        let h = self.silo.fill_height;
        let overpressure = self.silo.overpressure_factor(true);
        
        // Maximum hoop tension (with overpressure)
        let t_max = self.silo.hoop_tension(h) * overpressure;
        
        // Vertical load at base
        let v_load = self.silo.vertical_wall_load(h);
        
        // Required hoop steel
        let sigma_st = 130.0; // Permissible stress
        let as_hoop = t_max * 1000.0 / sigma_st;
        
        // Required vertical steel for compression + bending
        let as_vert = v_load * 1000.0 / (0.4 * self.fck) * 0.5; // Simplified
        
        // Minimum steel
        let as_min = 0.003 * self.silo.wall_thickness * 1000.0;
        
        SiloWallDesign {
            wall_thickness: self.silo.wall_thickness,
            hoop_steel: as_hoop.max(as_min),
            vertical_steel: as_vert.max(as_min),
            max_hoop_tension: t_max,
            vertical_load: v_load,
            max_horizontal_pressure: self.silo.horizontal_pressure(h) * overpressure,
        }
    }
    
    /// Design hopper
    pub fn design_hopper(&self) -> HopperDesign {
        let angle_rad = self.silo.hopper_angle.to_radians();
        let d = self.silo.diameter;
        let pv = self.silo.vertical_pressure(self.silo.fill_height);
        
        // Hopper wall pressure
        let ph = pv * (1.0 + angle_rad.sin()) / (1.0 - angle_rad.sin());
        
        // Meridional tension
        let t_meridional = ph * d / (2.0 * angle_rad.sin());
        
        // Hoop tension in hopper
        let t_hoop = ph * d / 2.0;
        
        HopperDesign {
            hopper_angle: self.silo.hopper_angle,
            meridional_tension: t_meridional,
            hoop_tension: t_hoop,
            wall_pressure: ph,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiloWallDesign {
    pub wall_thickness: f64,
    pub hoop_steel: f64,
    pub vertical_steel: f64,
    pub max_hoop_tension: f64,
    pub vertical_load: f64,
    pub max_horizontal_pressure: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HopperDesign {
    pub hopper_angle: f64,
    pub meridional_tension: f64,
    pub hoop_tension: f64,
    pub wall_pressure: f64,
}

// ============================================================================
// ELEVATED TANK (INTZE TANK)
// ============================================================================

/// Intze tank design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntzeTank {
    /// Top dome diameter (m)
    pub top_diameter: f64,
    /// Cylindrical portion diameter (m)
    pub cylinder_diameter: f64,
    /// Cylindrical portion height (m)
    pub cylinder_height: f64,
    /// Conical dome diameter at junction (m)
    pub cone_diameter: f64,
    /// Conical dome angle (degrees)
    pub cone_angle: f64,
    /// Bottom dome radius (m)
    pub bottom_dome_radius: f64,
    /// Staging height (m)
    pub staging_height: f64,
    /// Capacity (m³)
    pub capacity: f64,
}

impl IntzeTank {
    /// Create standard Intze tank for given capacity
    pub fn for_capacity(capacity: f64) -> Self {
        // Empirical relationships
        let d = (capacity / 0.6).powf(1.0 / 3.0);
        
        Self {
            top_diameter: d,
            cylinder_diameter: d,
            cylinder_height: d * 0.4,
            cone_diameter: d * 0.6,
            cone_angle: 45.0,
            bottom_dome_radius: d * 0.8,
            staging_height: 15.0,
            capacity,
        }
    }
    
    /// Top dome thrust (kN/m)
    pub fn top_dome_thrust(&self, rise: f64) -> f64 {
        let r = self.top_diameter / 2.0;
        let r_dome = (r.powi(2) + rise.powi(2)) / (2.0 * rise);
        
        // Self weight + live load
        let w = 5.0; // kN/m² typical
        w * r_dome / 2.0
    }
    
    /// Cylindrical wall hoop tension (kN/m)
    pub fn cylinder_hoop_tension(&self, depth: f64) -> f64 {
        let gamma = 10.0; // Water
        let r = self.cylinder_diameter / 2.0;
        gamma * depth * r
    }
    
    /// Ring beam tension at top dome junction (kN)
    pub fn top_ring_tension(&self, dome_thrust: f64, dome_angle: f64) -> f64 {
        let angle_rad = dome_angle.to_radians();
        let r = self.top_diameter / 2.0;
        dome_thrust * angle_rad.cos() * r
    }
    
    /// Total weight of tank (kN)
    pub fn total_weight(&self) -> f64 {
        // Simplified estimate
        let concrete_weight = 25.0; // kN/m³
        let water_weight = 10.0 * self.capacity;
        
        // Estimate concrete volume
        let wall_volume = PI * self.cylinder_diameter * self.cylinder_height * 0.2;
        let dome_volume = 2.0 * PI * (self.top_diameter / 2.0).powi(2) * 0.15;
        
        concrete_weight * (wall_volume + dome_volume) + water_weight
    }
}

// ============================================================================
// ACI 350 ENVIRONMENTAL ENGINEERING STRUCTURES
// ============================================================================

/// ACI 350 durability requirements
pub struct Aci350Designer {
    /// Exposure category (1-4)
    pub exposure_category: u8,
    /// Concrete strength (MPa)
    pub fc: f64,
    /// Steel yield strength (MPa)
    pub fy: f64,
}

impl Aci350Designer {
    pub fn new(exposure_category: u8) -> Self {
        Self {
            exposure_category,
            fc: 28.0,
            fy: 420.0,
        }
    }
    
    /// Required concrete cover (mm)
    pub fn required_cover(&self) -> f64 {
        match self.exposure_category {
            1 => 38.0,  // Normal
            2 => 50.0,  // Moderate
            3 => 63.0,  // Severe
            4 => 75.0,  // Very severe
            _ => 50.0,
        }
    }
    
    /// Durability factor Sd
    pub fn durability_factor(&self) -> f64 {
        match self.exposure_category {
            1 => 1.0,
            2 => 1.3,
            3 => 1.5,
            4 => 1.65,
            _ => 1.3,
        }
    }
    
    /// Required reinforcement ratio for crack control
    pub fn min_reinforcement_ratio(&self) -> f64 {
        // ACI 350 Section 7.12
        match self.exposure_category {
            1 | 2 => 0.003,
            3 => 0.004,
            4 => 0.005,
            _ => 0.003,
        }
    }
    
    /// Maximum steel stress for crack control (MPa)
    pub fn max_steel_stress(&self, bar_spacing: f64) -> f64 {
        // ACI 350 Eq. 10-4
        let dc = self.required_cover();
        let z = 17500.0; // N/mm for exterior exposure
        
        let a = 2.0 * dc * bar_spacing;
        z / (dc * a).powf(1.0 / 3.0)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_material_properties() {
        assert!((StoredMaterial::Water.unit_weight() - 10.0).abs() < 0.1);
        assert!((StoredMaterial::Grain.angle_of_repose() - 28.0).abs() < 1.0);
    }

    #[test]
    fn test_circular_tank_geometry() {
        let tank = CircularTank::new(10.0, 4.0);
        
        assert!((tank.radius() - 5.0).abs() < 0.01);
        assert!((tank.volume() - PI * 25.0 * 4.0).abs() < 1.0);
    }

    #[test]
    fn test_hoop_tension() {
        let tank = CircularTank::new(10.0, 4.0);
        let t = tank.hoop_tension(4.0);
        
        // T = γ * h * r = 10 * 4 * 5 = 200 kN/m
        assert!((t - 200.0).abs() < 1.0);
    }

    #[test]
    fn test_max_hoop_tension() {
        let tank = CircularTank::new(10.0, 4.0);
        let t_max = tank.max_hoop_tension();
        
        assert!((t_max - 200.0).abs() < 1.0);
    }

    #[test]
    fn test_min_wall_thickness() {
        let tank = CircularTank::new(10.0, 6.0);
        let t_min = tank.min_wall_thickness();
        
        assert!(t_min >= 150.0);
    }

    #[test]
    fn test_is3370_design() {
        let tank = CircularTank::new(10.0, 4.0);
        let designer = Is3370TankDesigner::new(tank);
        
        let wall = designer.design_wall();
        
        assert!(wall.hoop_steel > 0.0);
        assert!(wall.vertical_steel > 0.0);
    }

    #[test]
    fn test_base_design() {
        let tank = CircularTank::new(10.0, 4.0);
        let designer = Is3370TankDesigner::new(tank);
        
        let base = designer.design_base();
        
        assert!(base.radial_steel > 0.0);
        assert!(base.bearing_pressure > 0.0);
    }

    #[test]
    fn test_rectangular_tank() {
        let tank = RectangularTank::new(10.0, 6.0, 3.0);
        
        assert!((tank.volume() - 180.0).abs() < 1.0);
        assert!(tank.long_wall_moment() > 0.0);
    }

    #[test]
    fn test_rectangular_tension() {
        let tank = RectangularTank::new(10.0, 6.0, 3.0);
        let t = tank.long_wall_tension();
        
        // T = γ * h * b / 2 = 10 * 3 * 6 / 2 = 90 kN/m
        assert!((t - 90.0).abs() < 1.0);
    }

    #[test]
    fn test_silo_janssen() {
        let silo = Silo::new(6.0, 20.0, StoredMaterial::Grain);
        
        assert!(matches!(silo.silo_type, SiloType::Deep));
        assert!(silo.janssen_k() > 0.0 && silo.janssen_k() < 1.0);
    }

    #[test]
    fn test_silo_pressure() {
        let silo = Silo::new(6.0, 20.0, StoredMaterial::Grain);
        
        let p10 = silo.horizontal_pressure(10.0);
        let p20 = silo.horizontal_pressure(20.0);
        
        // Pressure increases with depth but asymptotes
        assert!(p20 > p10);
        assert!(p20 < silo.max_horizontal_pressure() * 1.01);
    }

    #[test]
    fn test_silo_hoop_tension() {
        let silo = Silo::new(6.0, 20.0, StoredMaterial::Grain);
        let t = silo.hoop_tension(10.0);
        
        assert!(t > 0.0);
    }

    #[test]
    fn test_silo_design() {
        let silo = Silo::new(6.0, 20.0, StoredMaterial::Cement);
        let designer = SiloDesigner::new(silo);
        
        let wall = designer.design_wall();
        
        assert!(wall.hoop_steel > 0.0);
        assert!(wall.max_horizontal_pressure > 0.0);
    }

    #[test]
    fn test_hopper_design() {
        let silo = Silo::new(6.0, 20.0, StoredMaterial::Grain);
        let designer = SiloDesigner::new(silo);
        
        let hopper = designer.design_hopper();
        
        assert!(hopper.meridional_tension > 0.0);
        assert!(hopper.hoop_tension > 0.0);
    }

    #[test]
    fn test_intze_tank() {
        let tank = IntzeTank::for_capacity(500.0);
        
        assert!(tank.cylinder_diameter > 0.0);
        assert!(tank.total_weight() > 0.0);
    }

    #[test]
    fn test_aci350_cover() {
        let designer = Aci350Designer::new(3);
        
        assert!((designer.required_cover() - 63.0).abs() < 1.0);
        assert!((designer.durability_factor() - 1.5).abs() < 0.1);
    }

    #[test]
    fn test_aci350_reinforcement() {
        let designer = Aci350Designer::new(4);
        
        assert!((designer.min_reinforcement_ratio() - 0.005).abs() < 0.001);
    }
}
