// ============================================================================
// TOWER & CHIMNEY DESIGN MODULE
// IS 6533, IS 4998, ACI 307, CICIND - Tall structure design
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// STRUCTURE TYPES
// ============================================================================

/// Tower/chimney structure types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TowerType {
    /// Self-supporting steel lattice tower
    SteelLattice,
    /// Guyed steel tower
    GuyedSteel,
    /// Reinforced concrete chimney
    RcChimney,
    /// Steel stack/chimney
    SteelChimney,
    /// Concrete cooling tower (hyperbolic)
    CoolingTower,
    /// Transmission tower
    TransmissionTower,
    /// Telecom tower
    TelecomTower,
    /// Water tower (elevated)
    WaterTower,
}

/// Chimney liner type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LinerType {
    /// No liner (single shell)
    None,
    /// Brick liner
    Brick,
    /// Steel liner
    Steel,
    /// Independent liner
    Independent,
    /// Gunite coating
    Gunite,
}

// ============================================================================
// WIND LOADING FOR TALL STRUCTURES
// ============================================================================

/// Wind parameters for tall structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TowerWindLoad {
    /// Basic wind speed (m/s)
    pub vb: f64,
    /// Terrain category (1-4)
    pub terrain_category: u8,
    /// Topography factor
    pub k_topo: f64,
    /// Importance factor
    pub importance: f64,
    /// Structure height (m)
    pub height: f64,
}

impl TowerWindLoad {
    pub fn new(vb: f64, height: f64) -> Self {
        Self {
            vb,
            terrain_category: 2,
            k_topo: 1.0,
            importance: 1.0,
            height,
        }
    }
    
    /// Design wind speed at height z (m/s) - IS 875 Part 3
    pub fn design_wind_speed(&self, z: f64) -> f64 {
        let k1 = self.importance;
        let k2 = self.terrain_factor(z);
        let k3 = self.k_topo;
        
        self.vb * k1 * k2 * k3
    }
    
    /// Terrain factor k2 at height z
    pub fn terrain_factor(&self, z: f64) -> f64 {
        let z = z.max(10.0);
        
        match self.terrain_category {
            1 => 1.05 * (z / 10.0).powf(0.09),  // Open sea
            2 => 1.00 * (z / 10.0).powf(0.11),  // Open terrain
            3 => 0.91 * (z / 10.0).powf(0.14),  // Suburban
            4 => 0.80 * (z / 10.0).powf(0.18),  // Urban
            _ => 1.00 * (z / 10.0).powf(0.11),
        }
    }
    
    /// Wind pressure at height z (kN/m²)
    pub fn wind_pressure(&self, z: f64) -> f64 {
        let vz = self.design_wind_speed(z);
        0.6 * vz.powi(2) / 1000.0
    }
    
    /// Gust factor for towers
    pub fn gust_factor(&self) -> f64 {
        // Simplified gust factor
        match self.terrain_category {
            1 => 1.9,
            2 => 2.0,
            3 => 2.2,
            4 => 2.4,
            _ => 2.0,
        }
    }
}

// ============================================================================
// CHIMNEY DESIGN (IS 6533 / ACI 307)
// ============================================================================

/// RC chimney geometry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RcChimney {
    /// Total height (m)
    pub height: f64,
    /// Base outer diameter (m)
    pub base_diameter: f64,
    /// Top outer diameter (m)
    pub top_diameter: f64,
    /// Base shell thickness (mm)
    pub base_thickness: f64,
    /// Top shell thickness (mm)
    pub top_thickness: f64,
    /// Liner type
    pub liner: LinerType,
    /// Liner thickness (mm)
    pub liner_thickness: f64,
    /// Foundation diameter (m)
    pub foundation_diameter: f64,
}

impl RcChimney {
    pub fn new(height: f64, base_diameter: f64) -> Self {
        // Empirical relationships
        let top_diameter = base_diameter * 0.6;
        let base_thickness = (height * 10.0).max(200.0).min(600.0);
        
        Self {
            height,
            base_diameter,
            top_diameter,
            base_thickness,
            top_thickness: (base_thickness * 0.6).max(150.0),
            liner: LinerType::Brick,
            liner_thickness: 115.0,
            foundation_diameter: base_diameter * 1.5,
        }
    }
    
    /// Diameter at height z (m)
    pub fn diameter_at(&self, z: f64) -> f64 {
        // Linear taper
        self.base_diameter - (self.base_diameter - self.top_diameter) * z / self.height
    }
    
    /// Shell thickness at height z (mm)
    pub fn thickness_at(&self, z: f64) -> f64 {
        self.base_thickness - (self.base_thickness - self.top_thickness) * z / self.height
    }
    
    /// Mean diameter at height z (m)
    pub fn mean_diameter_at(&self, z: f64) -> f64 {
        self.diameter_at(z) - self.thickness_at(z) / 1000.0
    }
    
    /// Cross-sectional area at height z (m²)
    pub fn area_at(&self, z: f64) -> f64 {
        let d_out = self.diameter_at(z);
        let t = self.thickness_at(z) / 1000.0;
        let d_in = d_out - 2.0 * t;
        
        PI * (d_out.powi(2) - d_in.powi(2)) / 4.0
    }
    
    /// Section modulus at height z (m³)
    pub fn section_modulus_at(&self, z: f64) -> f64 {
        let d_out = self.diameter_at(z);
        let t = self.thickness_at(z) / 1000.0;
        let d_in = d_out - 2.0 * t;
        
        PI * (d_out.powi(4) - d_in.powi(4)) / (32.0 * d_out)
    }
    
    /// Self weight above height z (kN)
    pub fn weight_above(&self, z: f64) -> f64 {
        let gamma_concrete = 25.0;
        let gamma_brick = 20.0;
        
        // Integrate shell weight (simplified trapezoidal)
        let n_segments = 20;
        let dz = (self.height - z) / (n_segments as f64);
        let mut weight = 0.0;
        
        for i in 0..n_segments {
            let z1 = z + (i as f64) * dz;
            let z2 = z1 + dz;
            let a1 = self.area_at(z1);
            let a2 = self.area_at(z2);
            weight += gamma_concrete * (a1 + a2) / 2.0 * dz;
        }
        
        // Add liner weight
        if matches!(self.liner, LinerType::Brick) {
            let liner_area = PI * (self.mean_diameter_at(z) - 0.15) * self.liner_thickness / 1000.0;
            weight += gamma_brick * liner_area * (self.height - z);
        }
        
        weight
    }
    
    /// Total chimney weight (kN)
    pub fn total_weight(&self) -> f64 {
        self.weight_above(0.0)
    }
    
    /// Slenderness ratio
    pub fn slenderness(&self) -> f64 {
        self.height / self.base_diameter
    }
}

/// Chimney designer per IS 6533 / ACI 307
pub struct ChimneyDesigner {
    pub chimney: RcChimney,
    pub wind: TowerWindLoad,
    /// Concrete strength (MPa)
    pub fck: f64,
    /// Steel yield strength (MPa)
    pub fy: f64,
}

impl ChimneyDesigner {
    pub fn new(chimney: RcChimney, wind: TowerWindLoad) -> Self {
        Self {
            chimney,
            wind,
            fck: 30.0,
            fy: 500.0,
        }
    }
    
    /// Drag coefficient for circular section
    pub fn drag_coefficient(&self, reynolds: f64) -> f64 {
        // ACI 307 / IS 6533
        if reynolds < 4e5 {
            1.2
        } else if reynolds < 2e6 {
            0.7
        } else {
            0.8
        }
    }
    
    /// Wind force on segment at height z (kN/m)
    pub fn wind_force_per_meter(&self, z: f64) -> f64 {
        let p = self.wind.wind_pressure(z);
        let d = self.chimney.diameter_at(z);
        let cd = self.drag_coefficient(1e6); // Assume high Reynolds
        let gf = self.wind.gust_factor();
        
        cd * gf * p * d
    }
    
    /// Base shear from wind (kN)
    pub fn base_shear(&self) -> f64 {
        let n = 50;
        let dz = self.chimney.height / (n as f64);
        let mut shear = 0.0;
        
        for i in 0..n {
            let z = (i as f64 + 0.5) * dz;
            shear += self.wind_force_per_meter(z) * dz;
        }
        
        shear
    }
    
    /// Base overturning moment from wind (kN·m)
    pub fn base_moment(&self) -> f64 {
        let n = 50;
        let dz = self.chimney.height / (n as f64);
        let mut moment = 0.0;
        
        for i in 0..n {
            let z = (i as f64 + 0.5) * dz;
            let force = self.wind_force_per_meter(z) * dz;
            moment += force * z;
        }
        
        moment
    }
    
    /// Design chimney at critical section
    pub fn design_section(&self, z: f64) -> ChimneySectionDesign {
        // Forces at section
        let dead_load = self.chimney.weight_above(z);
        
        // Moment at section (from wind above)
        let n = 50;
        let segment_height = (self.chimney.height - z) / (n as f64);
        let mut moment = 0.0;
        
        for i in 0..n {
            let zi = z + (i as f64 + 0.5) * segment_height;
            let force = self.wind_force_per_meter(zi) * segment_height;
            moment += force * (zi - z);
        }
        
        // Section properties
        let d = self.chimney.diameter_at(z);
        let t = self.chimney.thickness_at(z);
        let area = self.chimney.area_at(z);
        let z_sec = self.chimney.section_modulus_at(z);
        
        // Stresses
        let axial_stress = dead_load / area / 1000.0; // MPa
        let bending_stress = moment / z_sec / 1000.0; // MPa
        
        // Combined stress
        let max_comp = axial_stress + bending_stress;
        let max_tens = bending_stress - axial_stress;
        
        // Required vertical reinforcement
        let fc_allow = 0.25 * self.fck;
        let ft_allow = 0.7 * self.fck.sqrt();
        
        let as_required = if max_tens > ft_allow {
            (max_tens - ft_allow) * area * 1000.0 / (0.87 * self.fy)
        } else {
            0.0
        };
        
        // Minimum steel (0.25% each face)
        let as_min = 0.0025 * t * 1000.0 * PI * d;
        
        ChimneySectionDesign {
            height: z,
            diameter: d,
            thickness: t,
            axial_load: dead_load,
            moment,
            axial_stress,
            bending_stress,
            max_compression: max_comp,
            max_tension: max_tens.max(0.0),
            vertical_steel: as_required.max(as_min),
            circumferential_steel: as_min * 0.5,
            compression_ok: max_comp < fc_allow,
            tension_ok: max_tens < ft_allow || as_required > 0.0,
        }
    }
    
    /// Natural frequency (first mode) - simplified
    pub fn natural_frequency(&self) -> f64 {
        // Rayleigh method approximation
        let h = self.chimney.height;
        let d = self.chimney.base_diameter;
        let t = self.chimney.base_thickness / 1000.0;
        
        // Equivalent stiffness
        let e = 30000.0; // MPa for concrete
        let i = PI * d.powi(3) * t / 8.0;
        let m = self.chimney.total_weight() / 9.81; // Mass in tonnes
        
        // f = (1.875)² / (2π) * sqrt(EI / mL³)
        let f = 3.516 / (2.0 * PI) * (e * 1e6 * i / (m * 1000.0 * h.powi(3))).sqrt();
        f
    }
    
    /// Vortex shedding critical wind speed (m/s)
    pub fn vortex_critical_speed(&self) -> f64 {
        let f = self.natural_frequency();
        let d = self.chimney.top_diameter;
        let st = 0.2; // Strouhal number for circular section
        
        f * d / st
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChimneySectionDesign {
    pub height: f64,
    pub diameter: f64,
    pub thickness: f64,
    pub axial_load: f64,
    pub moment: f64,
    pub axial_stress: f64,
    pub bending_stress: f64,
    pub max_compression: f64,
    pub max_tension: f64,
    pub vertical_steel: f64,
    pub circumferential_steel: f64,
    pub compression_ok: bool,
    pub tension_ok: bool,
}

// ============================================================================
// STEEL LATTICE TOWER DESIGN
// ============================================================================

/// Steel lattice tower geometry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatticeTower {
    /// Total height (m)
    pub height: f64,
    /// Base width (m)
    pub base_width: f64,
    /// Top width (m)
    pub top_width: f64,
    /// Number of panels
    pub panels: u32,
    /// Bracing pattern
    pub bracing: BracingPattern,
    /// Leg section area (mm²)
    pub leg_area: f64,
    /// Bracing section area (mm²)
    pub bracing_area: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BracingPattern {
    SingleDiagonal,
    DoubleDiagonal,
    KBracing,
    XBracing,
}

impl LatticeTower {
    pub fn new(height: f64, base_width: f64) -> Self {
        Self {
            height,
            base_width,
            top_width: base_width * 0.3,
            panels: (height / 3.0).ceil() as u32,
            bracing: BracingPattern::KBracing,
            leg_area: 5000.0,
            bracing_area: 1500.0,
        }
    }
    
    /// Panel height (m)
    pub fn panel_height(&self) -> f64 {
        self.height / (self.panels as f64)
    }
    
    /// Width at height z (m)
    pub fn width_at(&self, z: f64) -> f64 {
        self.base_width - (self.base_width - self.top_width) * z / self.height
    }
    
    /// Solidity ratio (projected area / envelope area)
    pub fn solidity_ratio(&self) -> f64 {
        // Approximate based on member sizes
        let panel_h = self.panel_height();
        let avg_width = (self.base_width + self.top_width) / 2.0;
        
        // Legs
        let leg_width = (self.leg_area / 1e6).sqrt(); // Approximate
        let leg_area = 4.0 * leg_width * self.height;
        
        // Bracings
        let bracing_width = (self.bracing_area / 1e6).sqrt();
        let bracing_length = (panel_h.powi(2) + avg_width.powi(2)).sqrt();
        let bracing_area = 4.0 * bracing_width * bracing_length * (self.panels as f64);
        
        // Envelope area
        let envelope = avg_width * self.height;
        
        (leg_area + bracing_area) / envelope
    }
    
    /// Force coefficient for lattice tower
    pub fn force_coefficient(&self) -> f64 {
        let phi = self.solidity_ratio();
        
        // IS 875 Part 3 / ASCE 7
        if phi < 0.1 {
            1.9
        } else if phi < 0.3 {
            1.8 + (0.3 - phi) * 0.5
        } else if phi < 0.5 {
            1.6 + (0.5 - phi)
        } else {
            1.4
        }
    }
    
    /// Wind load at panel (kN)
    pub fn panel_wind_load(&self, panel_index: u32, wind: &TowerWindLoad) -> f64 {
        let panel_h = self.panel_height();
        let z = (panel_index as f64 + 0.5) * panel_h;
        
        let p = wind.wind_pressure(z);
        let w = self.width_at(z);
        let cf = self.force_coefficient();
        let gf = wind.gust_factor();
        
        cf * gf * p * w * panel_h
    }
    
    /// Total base shear (kN)
    pub fn base_shear(&self, wind: &TowerWindLoad) -> f64 {
        (0..self.panels)
            .map(|i| self.panel_wind_load(i, wind))
            .sum()
    }
    
    /// Base overturning moment (kN·m)
    pub fn base_moment(&self, wind: &TowerWindLoad) -> f64 {
        let panel_h = self.panel_height();
        
        (0..self.panels)
            .map(|i| {
                let z = (i as f64 + 0.5) * panel_h;
                self.panel_wind_load(i, wind) * z
            })
            .sum()
    }
    
    /// Leg force at base from overturning (kN)
    pub fn leg_force(&self, wind: &TowerWindLoad) -> f64 {
        let m = self.base_moment(wind);
        let w = self.base_width;
        
        // Force = M / (lever arm) for 4 legs
        m / (w * 1.414 / 2.0) / 2.0
    }
}

/// Lattice tower designer
pub struct LatticeTowerDesigner {
    pub tower: LatticeTower,
    pub wind: TowerWindLoad,
    /// Steel yield strength (MPa)
    pub fy: f64,
}

impl LatticeTowerDesigner {
    pub fn new(tower: LatticeTower, wind: TowerWindLoad) -> Self {
        Self {
            tower,
            wind,
            fy: 250.0,
        }
    }
    
    /// Design leg member
    pub fn design_leg(&self) -> LegDesign {
        let compression = self.tower.leg_force(&self.wind);
        let panel_h = self.tower.panel_height();
        
        // Effective length
        let kl = 0.85 * panel_h * 1000.0; // mm
        
        // Slenderness
        let r = (self.tower.leg_area / PI).sqrt(); // Approximate radius of gyration
        let lambda = kl / r;
        
        // Allowable stress (simplified)
        let fa = if lambda < 120.0 {
            self.fy * (1.0 - lambda.powi(2) / 20000.0) / 1.67
        } else {
            12.0 * PI.powi(2) * 200000.0 / (23.0 * lambda.powi(2)) / 1000.0
        };
        
        let stress = compression * 1000.0 / self.tower.leg_area;
        
        LegDesign {
            axial_force: compression,
            area_required: compression * 1000.0 / fa,
            area_provided: self.tower.leg_area,
            slenderness: lambda,
            allowable_stress: fa,
            actual_stress: stress,
            utilization: stress / fa,
            pass: stress <= fa,
        }
    }
    
    /// Design bracing member
    pub fn design_bracing(&self, panel_index: u32) -> BracingDesign {
        let panel_h = self.tower.panel_height();
        let w = self.tower.width_at((panel_index as f64) * panel_h);
        
        // Bracing length
        let length = match self.tower.bracing {
            BracingPattern::SingleDiagonal | BracingPattern::DoubleDiagonal => {
                (panel_h.powi(2) + w.powi(2)).sqrt()
            }
            BracingPattern::KBracing => {
                ((panel_h / 2.0).powi(2) + w.powi(2)).sqrt()
            }
            BracingPattern::XBracing => {
                (panel_h.powi(2) + w.powi(2)).sqrt() / 2.0
            }
        };
        
        // Shear in panel
        let shear: f64 = (panel_index..self.tower.panels)
            .map(|i| self.tower.panel_wind_load(i, &self.wind))
            .sum();
        
        // Bracing force
        let angle = (panel_h / length).asin();
        let bracing_force = shear / (2.0 * angle.sin());
        
        BracingDesign {
            panel: panel_index,
            length: length * 1000.0,
            force: bracing_force,
            area_required: bracing_force * 1000.0 / (0.6 * self.fy),
            area_provided: self.tower.bracing_area,
            pass: bracing_force * 1000.0 / self.tower.bracing_area < 0.6 * self.fy,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegDesign {
    pub axial_force: f64,
    pub area_required: f64,
    pub area_provided: f64,
    pub slenderness: f64,
    pub allowable_stress: f64,
    pub actual_stress: f64,
    pub utilization: f64,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BracingDesign {
    pub panel: u32,
    pub length: f64,
    pub force: f64,
    pub area_required: f64,
    pub area_provided: f64,
    pub pass: bool,
}

// ============================================================================
// GUYED TOWER ANALYSIS
// ============================================================================

/// Guyed tower configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuyedTower {
    /// Mast height (m)
    pub height: f64,
    /// Mast diameter (mm)
    pub mast_diameter: f64,
    /// Guy levels (heights in m)
    pub guy_levels: Vec<f64>,
    /// Guy anchor radius (m)
    pub anchor_radius: f64,
    /// Guy cable area (mm²)
    pub guy_area: f64,
    /// Initial guy tension (kN)
    pub pretension: f64,
}

impl GuyedTower {
    pub fn new(height: f64) -> Self {
        // Standard 3-level guys
        let guy_levels = vec![height * 0.35, height * 0.65, height * 0.95];
        
        Self {
            height,
            mast_diameter: 150.0,
            guy_levels,
            anchor_radius: height * 0.6,
            guy_area: 200.0,
            pretension: 20.0,
        }
    }
    
    /// Guy cable length to level i (m)
    pub fn guy_length(&self, level_index: usize) -> f64 {
        let h = self.guy_levels[level_index];
        (h.powi(2) + self.anchor_radius.powi(2)).sqrt()
    }
    
    /// Guy cable angle from vertical (degrees)
    pub fn guy_angle(&self, level_index: usize) -> f64 {
        let h = self.guy_levels[level_index];
        (self.anchor_radius / h).atan().to_degrees()
    }
    
    /// Horizontal stiffness from guy at level (kN/m)
    pub fn guy_stiffness(&self, level_index: usize) -> f64 {
        let l = self.guy_length(level_index);
        let angle = self.guy_angle(level_index).to_radians();
        
        let e = 160_000.0; // Steel cable E (MPa)
        let a = self.guy_area;
        
        // Horizontal stiffness = EA/L * cos²θ
        e * a / (l * 1000.0) * angle.cos().powi(2)
    }
    
    /// Guy tension under wind load
    pub fn guy_tension(&self, level_index: usize, deflection: f64) -> f64 {
        let angle = self.guy_angle(level_index).to_radians();
        let k = self.guy_stiffness(level_index);
        
        // Windward guys slacken, leeward guys tighten
        self.pretension + k * deflection / angle.cos()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wind_load() {
        let wind = TowerWindLoad::new(44.0, 100.0);
        
        let v50 = wind.design_wind_speed(50.0);
        let v100 = wind.design_wind_speed(100.0);
        
        assert!(v100 > v50);
    }

    #[test]
    fn test_wind_pressure() {
        let wind = TowerWindLoad::new(44.0, 100.0);
        let p = wind.wind_pressure(50.0);
        
        assert!(p > 0.0 && p < 5.0);
    }

    #[test]
    fn test_chimney_geometry() {
        let chimney = RcChimney::new(100.0, 8.0);
        
        assert!((chimney.top_diameter - 4.8).abs() < 0.1);
        assert!(chimney.base_thickness >= 200.0);
    }

    #[test]
    fn test_chimney_taper() {
        let chimney = RcChimney::new(100.0, 8.0);
        
        let d_mid = chimney.diameter_at(50.0);
        
        assert!(d_mid > chimney.top_diameter);
        assert!(d_mid < chimney.base_diameter);
    }

    #[test]
    fn test_chimney_section() {
        let chimney = RcChimney::new(100.0, 8.0);
        
        let area = chimney.area_at(0.0);
        let z = chimney.section_modulus_at(0.0);
        
        assert!(area > 0.0);
        assert!(z > 0.0);
    }

    #[test]
    fn test_chimney_weight() {
        let chimney = RcChimney::new(100.0, 8.0);
        let weight = chimney.total_weight();
        
        assert!(weight > 1000.0); // Should be several thousand kN
    }

    #[test]
    fn test_chimney_designer() {
        let chimney = RcChimney::new(100.0, 8.0);
        let wind = TowerWindLoad::new(44.0, 100.0);
        let designer = ChimneyDesigner::new(chimney, wind);
        
        let base_shear = designer.base_shear();
        let base_moment = designer.base_moment();
        
        assert!(base_shear > 0.0);
        assert!(base_moment > 0.0);
    }

    #[test]
    fn test_chimney_section_design() {
        let chimney = RcChimney::new(100.0, 8.0);
        let wind = TowerWindLoad::new(44.0, 100.0);
        let designer = ChimneyDesigner::new(chimney, wind);
        
        let design = designer.design_section(0.0);
        
        assert!(design.vertical_steel > 0.0);
    }

    #[test]
    fn test_chimney_frequency() {
        let chimney = RcChimney::new(100.0, 8.0);
        let wind = TowerWindLoad::new(44.0, 100.0);
        let designer = ChimneyDesigner::new(chimney, wind);
        
        let f = designer.natural_frequency();
        
        assert!(f > 0.0 && f < 5.0); // Typical range
    }

    #[test]
    fn test_lattice_tower() {
        let tower = LatticeTower::new(60.0, 6.0);
        
        assert!(tower.panels > 0);
        assert!(tower.solidity_ratio() > 0.0 && tower.solidity_ratio() < 1.0);
    }

    #[test]
    fn test_lattice_wind() {
        let tower = LatticeTower::new(60.0, 6.0);
        let wind = TowerWindLoad::new(44.0, 60.0);
        
        let shear = tower.base_shear(&wind);
        let moment = tower.base_moment(&wind);
        
        assert!(shear > 0.0);
        assert!(moment > 0.0);
    }

    #[test]
    fn test_lattice_design() {
        let tower = LatticeTower::new(60.0, 6.0);
        let wind = TowerWindLoad::new(44.0, 60.0);
        let designer = LatticeTowerDesigner::new(tower, wind);
        
        let leg = designer.design_leg();
        
        assert!(leg.axial_force > 0.0);
        assert!(leg.slenderness > 0.0);
    }

    #[test]
    fn test_bracing_design() {
        let tower = LatticeTower::new(60.0, 6.0);
        let wind = TowerWindLoad::new(44.0, 60.0);
        let designer = LatticeTowerDesigner::new(tower, wind);
        
        let bracing = designer.design_bracing(0);
        
        assert!(bracing.force > 0.0);
        assert!(bracing.length > 0.0);
    }

    #[test]
    fn test_guyed_tower() {
        let tower = GuyedTower::new(100.0);
        
        assert_eq!(tower.guy_levels.len(), 3);
        assert!(tower.anchor_radius > 0.0);
    }

    #[test]
    fn test_guy_geometry() {
        let tower = GuyedTower::new(100.0);
        
        let length = tower.guy_length(0);
        let angle = tower.guy_angle(0);
        
        assert!(length > tower.guy_levels[0]);
        assert!(angle > 0.0 && angle < 90.0);
    }

    #[test]
    fn test_guy_stiffness() {
        let tower = GuyedTower::new(100.0);
        
        let k = tower.guy_stiffness(0);
        
        assert!(k > 0.0);
    }

    #[test]
    fn test_force_coefficient() {
        let tower = LatticeTower::new(60.0, 6.0);
        let cf = tower.force_coefficient();
        
        assert!(cf > 1.0 && cf < 2.5);
    }
}
