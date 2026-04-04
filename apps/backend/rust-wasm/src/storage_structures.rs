// ============================================================================
// STORAGE STRUCTURES MODULE
// Silos, bunkers, tanks - ACI 313, EN 1991-4, API 650
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// SILO DESIGN (ACI 313, EN 1991-4)
// ============================================================================

/// Stored material properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredMaterial {
    /// Material name
    pub name: String,
    /// Unit weight γ (kN/m³)
    pub unit_weight: f64,
    /// Angle of internal friction φ (degrees)
    pub friction_angle: f64,
    /// Wall friction coefficient μ
    pub wall_friction: f64,
    /// Lateral pressure ratio K
    pub pressure_ratio: f64,
}

impl StoredMaterial {
    pub fn wheat() -> Self {
        Self {
            name: "Wheat".to_string(),
            unit_weight: 9.0,
            friction_angle: 30.0,
            wall_friction: 0.38,
            pressure_ratio: 0.50,
        }
    }
    
    pub fn cement() -> Self {
        Self {
            name: "Cement".to_string(),
            unit_weight: 16.0,
            friction_angle: 35.0,
            wall_friction: 0.46,
            pressure_ratio: 0.54,
        }
    }
    
    pub fn coal() -> Self {
        Self {
            name: "Coal".to_string(),
            unit_weight: 10.0,
            friction_angle: 35.0,
            wall_friction: 0.45,
            pressure_ratio: 0.52,
        }
    }
    
    pub fn sand() -> Self {
        Self {
            name: "Sand".to_string(),
            unit_weight: 16.0,
            friction_angle: 33.0,
            wall_friction: 0.40,
            pressure_ratio: 0.48,
        }
    }
}

/// Silo flow type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FlowType {
    /// Mass flow - all material moves
    MassFlow,
    /// Funnel flow - central channel
    FunnelFlow,
    /// Mixed flow
    MixedFlow,
}

/// Silo wall type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SiloWallType {
    /// Circular
    Circular,
    /// Rectangular
    Rectangular,
    /// Hexagonal
    Hexagonal,
}

/// Circular silo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircularSilo {
    /// Internal diameter (m)
    pub diameter: f64,
    /// Total height (m)
    pub height: f64,
    /// Hopper half-angle (degrees)
    pub hopper_angle: f64,
    /// Hopper height (m)
    pub hopper_height: f64,
    /// Wall thickness (mm)
    pub wall_thickness: f64,
    /// Stored material
    pub material: StoredMaterial,
    /// Flow type
    pub flow_type: FlowType,
}

impl CircularSilo {
    pub fn new(diameter: f64, height: f64, material: StoredMaterial) -> Self {
        Self {
            diameter,
            height,
            hopper_angle: 60.0,
            hopper_height: diameter * 0.866, // 60° hopper
            wall_thickness: 200.0,
            material,
            flow_type: FlowType::MassFlow,
        }
    }
    
    /// Cross-sectional area (m²)
    pub fn area(&self) -> f64 {
        PI * self.diameter.powi(2) / 4.0
    }
    
    /// Internal perimeter (m)
    pub fn perimeter(&self) -> f64 {
        PI * self.diameter
    }
    
    /// Hydraulic radius (m)
    pub fn hydraulic_radius(&self) -> f64 {
        self.area() / self.perimeter()
    }
    
    /// Characteristic depth z0 (m) - Janssen
    pub fn characteristic_depth(&self) -> f64 {
        let r = self.hydraulic_radius();
        let k = self.material.pressure_ratio;
        let mu = self.material.wall_friction;
        
        r / (k * mu)
    }
    
    /// Horizontal pressure at depth (kPa) - Janssen
    pub fn horizontal_pressure(&self, depth: f64) -> f64 {
        let gamma = self.material.unit_weight;
        let z0 = self.characteristic_depth();
        let k = self.material.pressure_ratio;
        
        gamma * z0 * k * (1.0 - (-depth / z0).exp())
    }
    
    /// Vertical pressure at depth (kPa)
    pub fn vertical_pressure(&self, depth: f64) -> f64 {
        let gamma = self.material.unit_weight;
        let z0 = self.characteristic_depth();
        
        gamma * z0 * (1.0 - (-depth / z0).exp())
    }
    
    /// Wall friction at depth (kPa)
    pub fn wall_friction(&self, depth: f64) -> f64 {
        self.horizontal_pressure(depth) * self.material.wall_friction
    }
    
    /// Maximum horizontal pressure (kPa)
    pub fn max_horizontal_pressure(&self) -> f64 {
        let gamma = self.material.unit_weight;
        let z0 = self.characteristic_depth();
        let k = self.material.pressure_ratio;
        
        gamma * z0 * k
    }
    
    /// Discharge overpressure factor (EN 1991-4)
    pub fn overpressure_factor(&self) -> f64 {
        match self.flow_type {
            FlowType::MassFlow => 1.15,
            FlowType::FunnelFlow => 1.0,
            FlowType::MixedFlow => 1.10,
        }
    }
    
    /// Design horizontal pressure (kPa)
    pub fn design_horizontal_pressure(&self, depth: f64) -> f64 {
        self.horizontal_pressure(depth) * self.overpressure_factor()
    }
    
    /// Hoop tension in wall (kN/m)
    pub fn hoop_tension(&self, depth: f64) -> f64 {
        self.design_horizontal_pressure(depth) * self.diameter / 2.0
    }
    
    /// Required wall thickness for concrete (mm)
    pub fn required_wall_thickness(&self, fc: f64, cover: f64) -> f64 {
        let max_depth = self.height - self.hopper_height;
        let n_max = self.hoop_tension(max_depth);
        
        // Reinforced concrete - approximate
        let t = (n_max * 1000.0 / (0.5 * fc * 1000.0)).max(150.0);
        
        t + 2.0 * cover
    }
    
    /// Hopper meridional pressure (kPa)
    pub fn hopper_pressure(&self, h_above_outlet: f64) -> f64 {
        let pv = self.vertical_pressure(self.height - self.hopper_height);
        let beta = self.hopper_angle.to_radians();
        let mu = self.material.wall_friction;
        
        // Switch pressure at transition
        let p_switch = pv * (1.0 + mu / beta.tan());
        
        // Linear variation in hopper
        let ratio = h_above_outlet / self.hopper_height;
        
        p_switch * ratio
    }
    
    /// Storage capacity (m³)
    pub fn storage_capacity(&self) -> f64 {
        let cylinder_vol = self.area() * (self.height - self.hopper_height);
        let hopper_vol = self.hopper_volume();
        
        cylinder_vol + hopper_vol
    }
    
    /// Hopper volume (m³)
    pub fn hopper_volume(&self) -> f64 {
        let r1 = self.diameter / 2.0;
        let r2 = 0.1; // Outlet radius
        let h = self.hopper_height;
        
        PI * h * (r1.powi(2) + r1 * r2 + r2.powi(2)) / 3.0
    }
    
    /// Storage mass (tonnes)
    pub fn storage_mass(&self) -> f64 {
        self.storage_capacity() * self.material.unit_weight / 10.0 // kN/m³ to t/m³
    }
}

// ============================================================================
// RECTANGULAR SILO / BUNKER
// ============================================================================

/// Rectangular bunker
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RectangularBunker {
    /// Length (m)
    pub length: f64,
    /// Width (m)
    pub width: f64,
    /// Height (m)
    pub height: f64,
    /// Wall thickness (mm)
    pub wall_thickness: f64,
    /// Stored material
    pub material: StoredMaterial,
}

impl RectangularBunker {
    pub fn new(length: f64, width: f64, height: f64, material: StoredMaterial) -> Self {
        Self {
            length,
            width,
            height,
            wall_thickness: 250.0,
            material,
        }
    }
    
    /// Cross-sectional area (m²)
    pub fn area(&self) -> f64 {
        self.length * self.width
    }
    
    /// Perimeter (m)
    pub fn perimeter(&self) -> f64 {
        2.0 * (self.length + self.width)
    }
    
    /// Hydraulic radius (m)
    pub fn hydraulic_radius(&self) -> f64 {
        self.area() / self.perimeter()
    }
    
    /// Horizontal pressure on long wall (kPa)
    pub fn pressure_long_wall(&self, depth: f64) -> f64 {
        let gamma = self.material.unit_weight;
        let k = self.material.pressure_ratio;
        let z0 = self.hydraulic_radius() / (k * self.material.wall_friction);
        
        gamma * z0 * k * (1.0 - (-depth / z0).exp())
    }
    
    /// Horizontal pressure on short wall (kPa)
    pub fn pressure_short_wall(&self, depth: f64) -> f64 {
        // Same as long wall for Janssen
        self.pressure_long_wall(depth)
    }
    
    /// Bending moment in long wall (kN·m/m) - simply supported
    pub fn bending_long_wall(&self, depth: f64) -> f64 {
        let p = self.pressure_long_wall(depth);
        let a = self.length; // Long wall spans the length
        
        // Plate bending
        p * a.powi(2) / 8.0
    }
    
    /// Bending moment in short wall (kN·m/m)
    pub fn bending_short_wall(&self, depth: f64) -> f64 {
        let p = self.pressure_short_wall(depth);
        let b = self.width; // Short wall spans the width
        
        p * b.powi(2) / 8.0
    }
    
    /// Corner moment (kN·m/m)
    pub fn corner_moment(&self, depth: f64) -> f64 {
        let p = self.pressure_long_wall(depth);
        let a = self.length;
        let b = self.width;
        
        // Frame analysis approximation
        p * (a.powi(2) * b.powi(2)) / (12.0 * (a + b))
    }
    
    /// Storage volume (m³)
    pub fn storage_volume(&self) -> f64 {
        self.area() * self.height * 0.9 // 90% fill
    }
}

// ============================================================================
// STEEL TANKS (API 650)
// ============================================================================

/// Steel storage tank
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelTank {
    /// Nominal diameter (m)
    pub diameter: f64,
    /// Total height (m)
    pub height: f64,
    /// Number of shell courses
    pub courses: Vec<ShellCourse>,
    /// Liquid specific gravity
    pub specific_gravity: f64,
    /// Design liquid level (m)
    pub design_level: f64,
    /// Corrosion allowance (mm)
    pub corrosion_allowance: f64,
}

/// Shell course
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellCourse {
    /// Course number (1 = bottom)
    pub number: u32,
    /// Course height (m)
    pub height: f64,
    /// Nominal thickness (mm)
    pub thickness: f64,
}

impl SteelTank {
    pub fn new(diameter: f64, height: f64, specific_gravity: f64) -> Self {
        // Default 2m courses
        let num_courses = (height / 2.0).ceil() as u32;
        let mut courses = Vec::new();
        
        for i in 1..=num_courses {
            courses.push(ShellCourse {
                number: i,
                height: 2.0_f64.min(height - (i - 1) as f64 * 2.0),
                thickness: 6.0, // Placeholder
            });
        }
        
        Self {
            diameter,
            height,
            courses,
            specific_gravity,
            design_level: height - 0.3, // 300mm freeboard
            corrosion_allowance: 3.0,
        }
    }
    
    /// Hydrostatic pressure at depth (kPa)
    pub fn hydrostatic_pressure(&self, depth_from_top: f64) -> f64 {
        let h = (self.design_level - (self.height - depth_from_top)).max(0.0);
        
        9.81 * self.specific_gravity * h
    }
    
    /// Shell thickness by one-foot method (mm)
    pub fn thickness_one_foot(&self, course: usize, sd: f64) -> f64 {
        let d = self.diameter; // API 650 uses D in meters
        let h = self.height_to_course_bottom(course);
        let g = self.specific_gravity;
        let ca = self.corrosion_allowance;
        
        // Height from liquid surface (m)
        let h_design = self.design_level - h - 0.3; // 1 foot (0.3m) above bottom reduces effective head
        
        // API 650 Eq. 5.6.3.2: td = 4.9*D*H*G/Sd + CA
        4.9 * d * h_design.max(0.0) * g / sd + ca
    }
    
    /// Height to course bottom (m)
    fn height_to_course_bottom(&self, course: usize) -> f64 {
        self.courses.iter()
            .take(course.saturating_sub(1))
            .map(|c| c.height)
            .sum()
    }
    
    /// Shell thickness by variable design point (mm)
    pub fn thickness_vdp(&self, course: usize, sd: f64) -> f64 {
        if course == 1 {
            return self.thickness_one_foot(course, sd);
        }
        
        let d = self.diameter; // API 650 uses D in meters
        let g = self.specific_gravity;
        let ca = self.corrosion_allowance;
        
        // Bottom of course
        let h1 = self.height_to_course_bottom(course);
        
        // Design point location (radius in mm = d*500, t in mm)
        let t_lower = self.courses.get(course - 2).map(|c| c.thickness).unwrap_or(6.0);
        let x = 0.61 * (d * 500.0 * t_lower).sqrt() / 1000.0; // Convert to m
        
        let h_design = self.design_level - h1 - x.min(0.3);
        
        4.9 * d * h_design.max(0.0) * g / sd + ca
    }
    
    /// Design shell courses
    pub fn design_courses(&mut self, sd: f64, min_thickness: f64) {
        for i in 0..self.courses.len() {
            let t = self.thickness_one_foot(i + 1, sd);
            self.courses[i].thickness = t.max(min_thickness);
        }
    }
    
    /// Bottom plate thickness (mm)
    pub fn bottom_thickness(&self) -> f64 {
        6.0_f64.max(self.corrosion_allowance + 3.0) // Minimum 6mm
    }
    
    /// Roof type selection
    pub fn roof_type(&self) -> RoofType {
        if self.diameter < 15.0 {
            RoofType::ConeRoof
        } else if self.diameter < 60.0 {
            RoofType::DomeRoof
        } else {
            RoofType::FloatingRoof
        }
    }
    
    /// Tank capacity (m³)
    pub fn capacity(&self) -> f64 {
        PI * self.diameter.powi(2) / 4.0 * self.design_level
    }
    
    /// Tank shell weight (tonnes)
    pub fn shell_weight(&self) -> f64 {
        let circ = PI * self.diameter;
        let weight: f64 = self.courses.iter()
            .map(|c| circ * c.height * c.thickness / 1000.0 * 7.85) // t/m³ steel
            .sum();
        
        weight
    }
}

/// Tank roof type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RoofType {
    /// Cone roof
    ConeRoof,
    /// Dome/umbrella roof  
    DomeRoof,
    /// Internal floating roof
    FloatingRoof,
    /// External floating roof
    ExternalFloating,
}

// ============================================================================
// ELEVATED TANKS
// ============================================================================

/// Elevated water tank (Intze type)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntzeRank {
    /// Tank capacity (m³)
    pub capacity: f64,
    /// Cylindrical diameter (m)
    pub diameter: f64,
    /// Cylindrical height (m)
    pub cylindrical_height: f64,
    /// Conical ring beam diameter (m)
    pub ring_diameter: f64,
    /// Bottom dome rise (m)
    pub dome_rise: f64,
    /// Conical slope angle (degrees)
    pub cone_angle: f64,
    /// Staging height (m)
    pub staging_height: f64,
}

impl IntzeRank {
    pub fn new(capacity: f64) -> Self {
        // Approximate sizing
        let diameter = (4.0 * capacity / PI).powf(1.0 / 3.0) * 1.2;
        let cylindrical_height = diameter * 0.6;
        
        Self {
            capacity,
            diameter,
            cylindrical_height,
            ring_diameter: diameter * 0.5,
            dome_rise: diameter * 0.15,
            cone_angle: 45.0,
            staging_height: 15.0, // Typical
        }
    }
    
    /// Cylindrical wall hoop tension (kN/m)
    pub fn wall_hoop_tension(&self, depth: f64) -> f64 {
        let gamma_w = 10.0; // kN/m³
        let d = self.diameter;
        
        gamma_w * depth * d / 2.0
    }
    
    /// Ring beam tension (kN)
    pub fn ring_beam_tension(&self) -> f64 {
        let gamma_w = 10.0;
        let h_water = self.cylindrical_height;
        let d = self.diameter;
        let d_ring = self.ring_diameter;
        let theta = self.cone_angle.to_radians();
        
        // Horizontal component at ring
        let p_h = gamma_w * h_water;
        let h_thrust = p_h * (d - d_ring) / 2.0 / theta.tan();
        
        h_thrust * PI * d_ring / 2.0
    }
    
    /// Bottom dome thrust (kN/m)
    pub fn dome_thrust(&self) -> f64 {
        let gamma_w = 10.0;
        let h_total = self.cylindrical_height + self.dome_rise;
        let d = self.ring_diameter;
        
        // Spherical dome formula
        gamma_w * h_total * d / (4.0 * self.dome_rise)
    }
    
    /// Water weight (kN)
    pub fn water_weight(&self) -> f64 {
        self.capacity * 10.0
    }
    
    /// Empty tank weight estimate (kN)
    pub fn tank_weight(&self) -> f64 {
        // Rough estimate - 20% of water weight for RC
        self.water_weight() * 0.2
    }
    
    /// Total staging load (kN)
    pub fn staging_load(&self) -> f64 {
        self.water_weight() + self.tank_weight()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_janssen_pressure() {
        let material = StoredMaterial::wheat();
        let silo = CircularSilo::new(6.0, 20.0, material);
        
        let p_10 = silo.horizontal_pressure(10.0);
        let p_20 = silo.horizontal_pressure(20.0);
        
        // Pressure increases with depth but saturates
        assert!(p_20 > p_10);
        assert!(p_20 / p_10 < 2.0); // Not double at double depth
    }

    #[test]
    fn test_silo_capacity() {
        let material = StoredMaterial::cement();
        let silo = CircularSilo::new(8.0, 25.0, material);
        
        let vol = silo.storage_capacity();
        assert!(vol > 1000.0 && vol < 2000.0);
    }

    #[test]
    fn test_hoop_tension() {
        let material = StoredMaterial::coal();
        let silo = CircularSilo::new(6.0, 20.0, material);
        
        let n = silo.hoop_tension(15.0);
        assert!(n > 100.0); // Significant tension
    }

    #[test]
    fn test_rectangular_bunker() {
        let material = StoredMaterial::sand();
        let bunker = RectangularBunker::new(10.0, 5.0, 8.0, material);
        
        let p = bunker.pressure_long_wall(6.0);
        assert!(p > 20.0 && p < 100.0);
    }

    #[test]
    fn test_bunker_moment() {
        let material = StoredMaterial::coal();
        let bunker = RectangularBunker::new(8.0, 6.0, 10.0, material);
        
        let m = bunker.bending_long_wall(8.0);
        assert!(m > 10.0);
    }

    #[test]
    fn test_steel_tank() {
        let tank = SteelTank::new(20.0, 12.0, 0.9);
        
        let capacity = tank.capacity();
        assert!(capacity > 3000.0 && capacity < 4000.0);
    }

    #[test]
    fn test_tank_thickness() {
        let tank = SteelTank::new(30.0, 15.0, 1.0);
        
        let t = tank.thickness_one_foot(1, 160.0);
        assert!(t > 0.0); // Verify positive thickness
    }

    #[test]
    fn test_tank_weight() {
        let mut tank = SteelTank::new(20.0, 12.0, 0.85);
        tank.design_courses(160.0, 6.0);
        
        let w = tank.shell_weight();
        assert!(w > 0.0); // Verify positive weight
    }

    #[test]
    fn test_intze_tank() {
        let tank = IntzeRank::new(500.0);
        
        assert!(tank.diameter > 8.0 && tank.diameter < 15.0);
    }

    #[test]
    fn test_intze_loads() {
        let tank = IntzeRank::new(1000.0);
        
        let ring_tension = tank.ring_beam_tension();
        assert!(ring_tension > 100.0);
    }

    #[test]
    fn test_overpressure_factor() {
        let material = StoredMaterial::wheat();
        let mut silo = CircularSilo::new(6.0, 20.0, material);
        
        silo.flow_type = FlowType::MassFlow;
        assert!((silo.overpressure_factor() - 1.15).abs() < 0.01);
        
        silo.flow_type = FlowType::FunnelFlow;
        assert!((silo.overpressure_factor() - 1.0).abs() < 0.01);
    }
}
