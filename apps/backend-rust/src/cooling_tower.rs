// ============================================================================
// COOLING TOWER MODULE
// CTI, ACI 334, cooling tower structural design
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// COOLING TOWER TYPES
// ============================================================================

/// Cooling tower type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CoolingTowerType {
    /// Natural draft hyperbolic
    NaturalDraftHyperbolic,
    /// Mechanical draft induced
    MechanicalInduced,
    /// Mechanical draft forced
    MechanicalForced,
    /// Crossflow
    Crossflow,
    /// Counterflow
    Counterflow,
}

/// Construction material
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TowerMaterial {
    /// Reinforced concrete
    ReinforcedConcrete,
    /// FRP
    FRP,
    /// Timber (treated)
    Timber,
    /// Steel (galvanized)
    Steel,
}

// ============================================================================
// HYPERBOLIC SHELL
// ============================================================================

/// Hyperbolic shell geometry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HyperbolicShell {
    /// Total height (m)
    pub height: f64,
    /// Throat diameter (m)
    pub throat_diameter: f64,
    /// Throat height from base (m)
    pub throat_height: f64,
    /// Base diameter (m)
    pub base_diameter: f64,
    /// Top diameter (m)
    pub top_diameter: f64,
    /// Shell thickness at base (mm)
    pub base_thickness: f64,
    /// Shell thickness at throat (mm)
    pub throat_thickness: f64,
    /// Shell thickness at top (mm)
    pub top_thickness: f64,
}

impl HyperbolicShell {
    pub fn new(height: f64, throat_diameter: f64) -> Self {
        // Typical proportions for natural draft tower
        let throat_height = height * 0.75;
        let base_diameter = throat_diameter * 1.4;
        let top_diameter = throat_diameter * 1.1;
        
        // Thickness estimates
        let base_thickness = (height / 0.5).max(150.0).min(400.0);
        
        Self {
            height,
            throat_diameter,
            throat_height,
            base_diameter,
            top_diameter,
            base_thickness,
            throat_thickness: base_thickness * 0.7,
            top_thickness: base_thickness * 0.5,
        }
    }
    
    /// Radius at height z (m)
    pub fn radius_at(&self, z: f64) -> f64 {
        if z <= self.throat_height {
            // Lower hyperbola
            let r_base = self.base_diameter / 2.0;
            let r_throat = self.throat_diameter / 2.0;
            let a = r_throat;
            let b = self.throat_height;
            
            // r² = a² + (z/b)² * (r_base² - a²)
            let ratio = (self.throat_height - z) / b;
            (a.powi(2) + ratio.powi(2) * (r_base.powi(2) - a.powi(2))).sqrt()
        } else {
            // Upper hyperbola
            let r_throat = self.throat_diameter / 2.0;
            let r_top = self.top_diameter / 2.0;
            let h_upper = self.height - self.throat_height;
            
            let ratio = (z - self.throat_height) / h_upper;
            r_throat + ratio * (r_top - r_throat)
        }
    }
    
    /// Thickness at height z (mm)
    pub fn thickness_at(&self, z: f64) -> f64 {
        if z <= self.throat_height {
            let ratio = z / self.throat_height;
            self.base_thickness - ratio * (self.base_thickness - self.throat_thickness)
        } else {
            let ratio = (z - self.throat_height) / (self.height - self.throat_height);
            self.throat_thickness - ratio * (self.throat_thickness - self.top_thickness)
        }
    }
    
    /// Meridional radius of curvature (m)
    pub fn meridional_radius(&self, z: f64) -> f64 {
        // Approximate for hyperbola
        let _r = self.radius_at(z);
        let dr_dz = self.slope_at(z);
        
        (1.0 + dr_dz.powi(2)).powf(1.5) / self.curvature_at(z).abs().max(0.001)
    }
    
    /// Slope dr/dz at height
    fn slope_at(&self, z: f64) -> f64 {
        let dz = 0.1;
        let r1 = self.radius_at(z);
        let r2 = self.radius_at(z + dz);
        
        (r2 - r1) / dz
    }
    
    /// Curvature d²r/dz² at height
    fn curvature_at(&self, z: f64) -> f64 {
        let dz = 0.1;
        let s1 = self.slope_at(z - dz);
        let s2 = self.slope_at(z + dz);
        
        (s2 - s1) / (2.0 * dz)
    }
    
    /// Circumferential radius (m) - same as radius for surface of revolution
    pub fn circumferential_radius(&self, z: f64) -> f64 {
        let r = self.radius_at(z);
        let dr_dz = self.slope_at(z);
        
        r * (1.0 + dr_dz.powi(2)).sqrt()
    }
    
    /// Shell area (m²)
    pub fn shell_area(&self) -> f64 {
        let n_segments = 50;
        let dz = self.height / n_segments as f64;
        
        let mut area = 0.0;
        for i in 0..n_segments {
            let z = (i as f64 + 0.5) * dz;
            let r = self.radius_at(z);
            let dr_dz = self.slope_at(z);
            
            // Surface area of revolution
            area += 2.0 * PI * r * (1.0 + dr_dz.powi(2)).sqrt() * dz;
        }
        
        area
    }
    
    /// Concrete volume (m³)
    pub fn concrete_volume(&self) -> f64 {
        let n_segments = 50;
        let dz = self.height / n_segments as f64;
        
        let mut volume = 0.0;
        for i in 0..n_segments {
            let z = (i as f64 + 0.5) * dz;
            let r = self.radius_at(z);
            let t = self.thickness_at(z) / 1000.0;
            let dr_dz = self.slope_at(z);
            
            volume += 2.0 * PI * r * t * (1.0 + dr_dz.powi(2)).sqrt() * dz;
        }
        
        volume
    }
    
    /// Self-weight (kN)
    pub fn self_weight(&self) -> f64 {
        self.concrete_volume() * 25.0 // kN/m³
    }
}

// ============================================================================
// SHELL ANALYSIS
// ============================================================================

/// Shell stress analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellAnalysis {
    /// Shell geometry
    pub shell: HyperbolicShell,
    /// Wind pressure at 10m height (kPa)
    pub wind_pressure: f64,
    /// Concrete strength fck (MPa)
    pub fck: f64,
}

impl ShellAnalysis {
    pub fn new(shell: HyperbolicShell, wind_pressure: f64, fck: f64) -> Self {
        Self {
            shell,
            wind_pressure,
            fck,
        }
    }
    
    /// Wind pressure at height (kPa)
    pub fn wind_at_height(&self, z: f64) -> f64 {
        // Power law profile
        self.wind_pressure * (z / 10.0).powf(0.2)
    }
    
    /// Wind force per unit height (kN/m)
    pub fn wind_force(&self, z: f64) -> f64 {
        let q = self.wind_at_height(z);
        let d = 2.0 * self.shell.radius_at(z);
        let cd = 0.7; // Typical for cylinder
        
        q * d * cd
    }
    
    /// Base shear from wind (kN)
    pub fn wind_base_shear(&self) -> f64 {
        let n_segments = 50;
        let dz = self.shell.height / n_segments as f64;
        
        let mut v = 0.0;
        for i in 0..n_segments {
            let z = (i as f64 + 0.5) * dz;
            v += self.wind_force(z) * dz;
        }
        
        v
    }
    
    /// Base moment from wind (kN·m)
    pub fn wind_base_moment(&self) -> f64 {
        let n_segments = 50;
        let dz = self.shell.height / n_segments as f64;
        
        let mut m = 0.0;
        for i in 0..n_segments {
            let z = (i as f64 + 0.5) * dz;
            m += self.wind_force(z) * dz * z;
        }
        
        m
    }
    
    /// Meridional membrane stress (MPa)
    pub fn meridional_stress(&self, z: f64, vertical_load: f64) -> f64 {
        let r = self.shell.radius_at(z);
        let t = self.shell.thickness_at(z);
        let _r_m = self.shell.meridional_radius(z);
        
        // From self-weight
        let w = self.shell.self_weight() / (2.0 * PI * r);
        
        // Membrane stress
        w / t + vertical_load / (2.0 * PI * r * t)
    }
    
    /// Circumferential membrane stress (MPa)
    pub fn circumferential_stress(&self, z: f64) -> f64 {
        let r = self.shell.radius_at(z);
        let t = self.shell.thickness_at(z);
        
        // Wind induced circumferential stress
        let q = self.wind_at_height(z) * 1000.0; // Pa
        
        // Simplified membrane theory: σ = p(Pa) × R(m) / (t(mm) × 1000) → MPa
        q * r / (t * 1000.0)
    }
    
    /// Buckling check - critical wind speed
    pub fn critical_wind_speed(&self) -> f64 {
        let e = 30000.0; // MPa for concrete
        let r_throat = self.shell.throat_diameter / 2.0 * 1000.0; // mm
        let t = self.shell.throat_thickness;
        
        // Classical buckling
        let sigma_cr = 0.6 * e * t / r_throat;
        
        // Back-calculate wind speed
        let rho = 1.225; // kg/m³
        (2.0 * sigma_cr * 1e6 / (0.7 * rho * 2.0 * r_throat / 1000.0)).sqrt()
    }
    
    /// Natural frequency (Hz) - simplified
    pub fn natural_frequency(&self) -> f64 {
        let h = self.shell.height;
        let e = 30000.0 * 1e6; // Pa
        let rho = 2500.0; // kg/m³
        
        // Cantilever approximation
        let c: f64 = 1.875;
        let r_avg = (self.shell.base_diameter + self.shell.throat_diameter) / 4.0;
        let t_avg = (self.shell.base_thickness + self.shell.throat_thickness) / 2.0 / 1000.0;
        let i = PI * r_avg.powi(3) * t_avg; // m⁴
        let m = rho * PI * 2.0 * r_avg * t_avg; // kg/m
        
        c.powi(2) / (2.0 * PI * h.powi(2)) * (e * i / m).sqrt()
    }
}

// ============================================================================
// SUPPORTING COLUMNS
// ============================================================================

/// Column support system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnSupports {
    /// Number of columns
    pub num_columns: u32,
    /// Column height (m)
    pub column_height: f64,
    /// Column diameter (m)
    pub column_diameter: f64,
    /// Lintel beam depth (m)
    pub lintel_depth: f64,
    /// Column inclination (degrees from vertical)
    pub inclination: f64,
}

impl ColumnSupports {
    pub fn new(shell: &HyperbolicShell, num_columns: u32) -> Self {
        let column_height = shell.throat_height * 0.15;
        let column_diameter = 1.5 + shell.base_diameter / 50.0;
        
        Self {
            num_columns,
            column_height,
            column_diameter,
            lintel_depth: column_diameter * 0.8,
            inclination: 10.0,
        }
    }
    
    /// Column spacing at base (m)
    pub fn column_spacing(&self, base_diameter: f64) -> f64 {
        PI * base_diameter / self.num_columns as f64
    }
    
    /// Axial load per column (kN)
    pub fn axial_load(&self, shell_weight: f64, fill_load: f64) -> f64 {
        (shell_weight + fill_load) / self.num_columns as f64
    }
    
    /// Column moment from wind (kN·m)
    pub fn wind_moment(&self, wind_shear: f64) -> f64 {
        // Distribution to columns - simplified
        let per_column = wind_shear / self.num_columns as f64;
        
        per_column * self.column_height * 0.7 // 70% height to shear center
    }
    
    /// Column effective length factor
    pub fn effective_length_factor(&self) -> f64 {
        // Restrained at base and top
        0.85
    }
    
    /// Slenderness ratio
    pub fn slenderness(&self) -> f64 {
        let k = self.effective_length_factor();
        let l = self.column_height / self.inclination.to_radians().cos();
        let r = self.column_diameter / 4.0; // Approximate radius of gyration
        
        k * l / r
    }
}

// ============================================================================
// FILL (PACKING) SUPPORT
// ============================================================================

/// Fill support structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FillSupport {
    /// Fill area (m²)
    pub fill_area: f64,
    /// Fill height (m)
    pub fill_height: f64,
    /// Fill type weight (kg/m³)
    pub fill_density: f64,
    /// Water flow rate (m³/h)
    pub water_flow: f64,
}

impl FillSupport {
    pub fn new(diameter: f64, fill_height: f64) -> Self {
        let fill_area = PI * diameter.powi(2) / 4.0;
        
        Self {
            fill_area,
            fill_height,
            fill_density: 100.0, // Typical PVC fill
            water_flow: fill_area * 15.0, // 15 m³/h/m²
        }
    }
    
    /// Fill dead load (kN/m²)
    pub fn fill_dead_load(&self) -> f64 {
        self.fill_density * 9.81 / 1000.0 * self.fill_height
    }
    
    /// Water on fill (kN/m²)
    pub fn water_load(&self) -> f64 {
        // 20% retention
        1000.0 * 9.81 / 1000.0 * self.fill_height * 0.2
    }
    
    /// Total fill support load (kN/m²)
    pub fn total_load(&self) -> f64 {
        self.fill_dead_load() + self.water_load() + 0.5 // Maintenance
    }
    
    /// Support beam span (m)
    pub fn support_span(&self, num_columns: u32) -> f64 {
        (PI * self.fill_area.sqrt() / num_columns as f64).sqrt()
    }
    
    /// Required beam depth (mm) - approximate
    pub fn beam_depth(&self, span: f64, fy: f64) -> f64 {
        let w = self.total_load() * span; // kN/m
        let m = w * span.powi(2) / 8.0; // kN·m
        
        // Approximate for rectangular beam
        (6.0 * m * 1e6 / (0.9 * fy * span * 1000.0)).sqrt() * 1.2
    }
}

// ============================================================================
// MECHANICAL DRAFT TOWER
// ============================================================================

/// Mechanical draft cooling tower
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MechanicalTower {
    /// Tower type
    pub tower_type: CoolingTowerType,
    /// Material
    pub material: TowerMaterial,
    /// Length (m) - for multi-cell
    pub length: f64,
    /// Width (m)
    pub width: f64,
    /// Height (m)
    pub height: f64,
    /// Number of cells
    pub cells: u32,
}

impl MechanicalTower {
    pub fn new(cells: u32, capacity: f64) -> Self {
        // Approximate sizing based on capacity (MW)
        let width = (capacity / cells as f64 / 3.0).sqrt() + 4.0;
        let length = width * cells as f64;
        let height = width * 0.8;
        
        Self {
            tower_type: CoolingTowerType::MechanicalInduced,
            material: TowerMaterial::FRP,
            length,
            width,
            height,
            cells,
        }
    }
    
    /// Plan area (m²)
    pub fn plan_area(&self) -> f64 {
        self.length * self.width
    }
    
    /// Wind load on structure (kN)
    pub fn wind_load(&self, wind_pressure: f64) -> f64 {
        let area = self.length.max(self.width) * self.height;
        let cf = 1.2; // Force coefficient
        
        wind_pressure * area * cf
    }
    
    /// Dead load (kN)
    pub fn dead_load(&self) -> f64 {
        let volume = self.plan_area() * self.height * 0.3; // 30% solid
        
        let density = match self.material {
            TowerMaterial::ReinforcedConcrete => 25.0,
            TowerMaterial::FRP => 2.0,
            TowerMaterial::Timber => 8.0,
            TowerMaterial::Steel => 78.5,
        };
        
        volume * density
    }
    
    /// Water load (kN)
    pub fn water_load(&self) -> f64 {
        // Basin + fill
        self.plan_area() * 3.0 * 10.0 // 3m water equivalent
    }
    
    /// Fan deck load (kN/m²)
    pub fn fan_deck_load(&self) -> f64 {
        5.0 // Equipment + maintenance
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hyperbolic_geometry() {
        let shell = HyperbolicShell::new(120.0, 60.0);
        
        let r_base = shell.radius_at(0.0);
        let r_throat = shell.radius_at(shell.throat_height);
        let r_top = shell.radius_at(shell.height);
        
        // Base > Throat, Top > Throat
        assert!(r_base > r_throat);
        assert!(r_top > r_throat);
    }

    #[test]
    fn test_shell_volume() {
        let shell = HyperbolicShell::new(100.0, 50.0);
        
        let volume = shell.concrete_volume();
        assert!(volume > 0.0); // Verify positive volume
    }

    #[test]
    fn test_shell_weight() {
        let shell = HyperbolicShell::new(120.0, 60.0);
        
        let weight = shell.self_weight();
        assert!(weight > 100000.0); // Substantial weight
    }

    #[test]
    fn test_shell_analysis() {
        let shell = HyperbolicShell::new(120.0, 60.0);
        let analysis = ShellAnalysis::new(shell, 1.0, 40.0);
        
        let shear = analysis.wind_base_shear();
        let moment = analysis.wind_base_moment();
        
        assert!(shear > 0.0);
        assert!(moment > 0.0);
    }

    #[test]
    fn test_critical_wind() {
        let shell = HyperbolicShell::new(150.0, 70.0);
        let analysis = ShellAnalysis::new(shell, 1.0, 40.0);
        
        let v_cr = analysis.critical_wind_speed();
        assert!(v_cr > 0.0); // Verify positive critical speed
    }

    #[test]
    fn test_column_supports() {
        let shell = HyperbolicShell::new(120.0, 60.0);
        let columns = ColumnSupports::new(&shell, 36);
        
        assert!(columns.column_height > 10.0);
        assert!(columns.slenderness() > 5.0);
    }

    #[test]
    fn test_fill_support() {
        let fill = FillSupport::new(80.0, 2.0);
        
        let load = fill.total_load();
        assert!(load > 2.0 && load < 10.0);
    }

    #[test]
    fn test_mechanical_tower() {
        let tower = MechanicalTower::new(4, 100.0);
        
        assert!(tower.cells == 4);
        assert!(tower.dead_load() > 0.0);
    }

    #[test]
    fn test_natural_frequency() {
        let shell = HyperbolicShell::new(120.0, 60.0);
        let analysis = ShellAnalysis::new(shell, 1.0, 40.0);
        
        let f = analysis.natural_frequency();
        assert!(f > 0.0); // Verify positive frequency
    }

    #[test]
    fn test_thickness_variation() {
        let shell = HyperbolicShell::new(100.0, 50.0);
        
        let t_base = shell.thickness_at(0.0);
        let t_throat = shell.thickness_at(shell.throat_height);
        let t_top = shell.thickness_at(shell.height);
        
        assert!(t_base > t_throat);
        assert!(t_throat > t_top);
    }
}
