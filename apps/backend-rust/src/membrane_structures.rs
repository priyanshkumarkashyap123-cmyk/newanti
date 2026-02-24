// ============================================================================
// MEMBRANE STRUCTURES - TENSIONED FABRIC, CABLES
// Based on ASCE/SEI 55, EN 13782, IASS Recommendations
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// FABRIC MATERIALS
// ============================================================================

/// Membrane fabric material
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FabricMaterial {
    /// Material type
    pub material_type: FabricType,
    /// Tensile strength warp (kN/m)
    pub strength_warp: f64,
    /// Tensile strength fill (kN/m)
    pub strength_fill: f64,
    /// Elastic modulus warp (kN/m)
    pub modulus_warp: f64,
    /// Elastic modulus fill (kN/m)
    pub modulus_fill: f64,
    /// Weight (kg/m²)
    pub weight: f64,
    /// Translucency (%)
    pub translucency: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum FabricType {
    PvcPolyester,
    PtfeFiberglass,
    EtfeFoil,
    SiliconeFiberglass,
    PvcCoatedMesh,
}

impl FabricMaterial {
    pub fn pvc_type_ii() -> Self {
        Self {
            material_type: FabricType::PvcPolyester,
            strength_warp: 60.0,
            strength_fill: 55.0,
            modulus_warp: 400.0,
            modulus_fill: 300.0,
            weight: 0.9,
            translucency: 15.0,
        }
    }
    
    pub fn pvc_type_iii() -> Self {
        Self {
            material_type: FabricType::PvcPolyester,
            strength_warp: 100.0,
            strength_fill: 90.0,
            modulus_warp: 600.0,
            modulus_fill: 500.0,
            weight: 1.2,
            translucency: 12.0,
        }
    }
    
    pub fn ptfe_standard() -> Self {
        Self {
            material_type: FabricType::PtfeFiberglass,
            strength_warp: 120.0,
            strength_fill: 100.0,
            modulus_warp: 1500.0,
            modulus_fill: 1200.0,
            weight: 1.5,
            translucency: 25.0,
        }
    }
    
    pub fn etfe_foil(thickness: f64) -> Self {
        Self {
            material_type: FabricType::EtfeFoil,
            strength_warp: 40.0 * thickness / 200.0,
            strength_fill: 40.0 * thickness / 200.0,
            modulus_warp: 500.0,
            modulus_fill: 500.0,
            weight: 0.175 * thickness / 100.0,
            translucency: 95.0,
        }
    }
    
    /// Design strength warp (kN/m)
    pub fn design_strength_warp(&self, factor: f64) -> f64 {
        self.strength_warp / factor
    }
    
    /// Design strength fill (kN/m)
    pub fn design_strength_fill(&self, factor: f64) -> f64 {
        self.strength_fill / factor
    }
    
    /// Biaxial stress ratio
    pub fn stress_ratio(&self) -> f64 {
        self.strength_warp / self.strength_fill
    }
    
    /// Expected lifespan (years)
    pub fn expected_life(&self) -> f64 {
        match self.material_type {
            FabricType::PvcPolyester => 15.0,
            FabricType::PtfeFiberglass => 30.0,
            FabricType::EtfeFoil => 25.0,
            FabricType::SiliconeFiberglass => 25.0,
            FabricType::PvcCoatedMesh => 20.0,
        }
    }
}

// ============================================================================
// MEMBRANE GEOMETRY
// ============================================================================

/// Anticlastic (saddle) surface
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnticlasticSurface {
    /// Span in x direction (m)
    pub span_x: f64,
    /// Span in y direction (m)
    pub span_y: f64,
    /// Sag in x direction (m)
    pub sag_x: f64,
    /// Rise in y direction (m)
    pub rise_y: f64,
}

impl AnticlasticSurface {
    pub fn new(span_x: f64, span_y: f64, sag_x: f64, rise_y: f64) -> Self {
        Self { span_x, span_y, sag_x, rise_y }
    }
    
    /// Curvature in x direction (1/m)
    pub fn curvature_x(&self) -> f64 {
        8.0 * self.sag_x / self.span_x.powi(2)
    }
    
    /// Curvature in y direction (1/m)
    pub fn curvature_y(&self) -> f64 {
        -8.0 * self.rise_y / self.span_y.powi(2) // Negative for anticlastic
    }
    
    /// Mean curvature
    pub fn mean_curvature(&self) -> f64 {
        (self.curvature_x() + self.curvature_y()) / 2.0
    }
    
    /// Gaussian curvature
    pub fn gaussian_curvature(&self) -> f64 {
        self.curvature_x() * self.curvature_y() // Negative for saddle
    }
    
    /// Approximate surface area (m²)
    pub fn surface_area(&self) -> f64 {
        // Simpson's rule approximation
        let a = self.span_x / 2.0;
        let b = self.span_y / 2.0;
        
        let base_area = self.span_x * self.span_y;
        let curvature_factor = 1.0 + 
            (self.sag_x.powi(2) + self.rise_y.powi(2)) / (a.powi(2) + b.powi(2)).max(1.0) / 6.0;
        
        base_area * curvature_factor
    }
}

/// Conical/radial surface
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadialSurface {
    /// Number of radial panels
    pub num_panels: u32,
    /// Outer radius (m)
    pub outer_radius: f64,
    /// Inner radius (m)
    pub inner_radius: f64,
    /// Cone height (m)
    pub height: f64,
}

impl RadialSurface {
    pub fn new(num_panels: u32, outer_r: f64, inner_r: f64, height: f64) -> Self {
        Self {
            num_panels,
            outer_radius: outer_r,
            inner_radius: inner_r,
            height,
        }
    }
    
    /// Cone angle (degrees)
    pub fn cone_angle(&self) -> f64 {
        (self.height / (self.outer_radius - self.inner_radius)).atan() * 180.0 / PI
    }
    
    /// Panel angle (degrees)
    pub fn panel_angle(&self) -> f64 {
        360.0 / self.num_panels as f64
    }
    
    /// Slant height (m)
    pub fn slant_height(&self) -> f64 {
        ((self.outer_radius - self.inner_radius).powi(2) + self.height.powi(2)).sqrt()
    }
    
    /// Surface area (m²)
    pub fn surface_area(&self) -> f64 {
        PI * (self.outer_radius + self.inner_radius) * self.slant_height()
    }
    
    /// Panel area (m²)
    pub fn panel_area(&self) -> f64 {
        self.surface_area() / self.num_panels as f64
    }
}

// ============================================================================
// PRESTRESS ANALYSIS
// ============================================================================

/// Membrane prestress state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MembranePrestress {
    /// Warp prestress (kN/m)
    pub t_warp: f64,
    /// Fill prestress (kN/m)
    pub t_fill: f64,
    /// Principal curvatures (1/m)
    pub k1: f64,
    pub k2: f64,
}

impl MembranePrestress {
    pub fn from_geometry(surface: &AnticlasticSurface, design_load: f64) -> Self {
        let k1 = surface.curvature_x();
        let k2 = surface.curvature_y();
        
        // Equilibrium under uniform load
        let t1 = design_load / (2.0 * k1.abs()).max(0.01);
        let t2 = design_load / (2.0 * k2.abs()).max(0.01);
        
        Self {
            t_warp: t1,
            t_fill: t2,
            k1,
            k2,
        }
    }
    
    /// Minimum prestress for stability (kN/m)
    pub fn minimum_prestress(&self) -> f64 {
        self.t_warp.min(self.t_fill)
    }
    
    /// Prestress ratio
    pub fn prestress_ratio(&self) -> f64 {
        self.t_warp / self.t_fill.max(0.01)
    }
    
    /// Check equilibrium under load q (kN/m²)
    pub fn equilibrium_check(&self, q: f64) -> bool {
        let lhs = self.t_warp * self.k1 + self.t_fill * self.k2;
        (lhs.abs() - q.abs()).abs() < 0.1 * q.abs().max(0.1)
    }
    
    /// Resulting tension under load increment (kN/m)
    pub fn tension_under_load(&self, delta_q: f64) -> (f64, f64) {
        let delta_t = delta_q / (self.k1.abs() + self.k2.abs()).max(0.01);
        
        (self.t_warp + delta_t, self.t_fill + delta_t)
    }
}

// ============================================================================
// CABLE ELEMENTS
// ============================================================================

/// Edge cable
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EdgeCable {
    /// Cable diameter (mm)
    pub diameter: f64,
    /// Span (m)
    pub span: f64,
    /// Sag (m)
    pub sag: f64,
    /// Breaking strength (kN)
    pub breaking_strength: f64,
    /// Elastic modulus (GPa)
    pub modulus: f64,
}

impl EdgeCable {
    pub fn spiral_strand(diameter: f64, span: f64, sag: f64) -> Self {
        // Typical spiral strand properties
        let area = PI * diameter.powi(2) / 4.0 * 0.7; // Fill factor 0.7
        let strength = area * 1770.0 / 1000.0; // kN (1770 MPa wire)
        
        Self {
            diameter,
            span,
            sag,
            breaking_strength: strength,
            modulus: 150.0, // GPa for strand
        }
    }
    
    /// Cable length (m)
    pub fn cable_length(&self) -> f64 {
        let c = self.span;
        let f = self.sag;
        
        // Parabolic approximation
        c * (1.0 + 8.0 * (f / c).powi(2) / 3.0)
    }
    
    /// Horizontal tension (kN)
    pub fn horizontal_tension(&self, uniform_load: f64) -> f64 {
        uniform_load * self.span.powi(2) / (8.0 * self.sag)
    }
    
    /// Maximum tension (kN)
    pub fn max_tension(&self, uniform_load: f64) -> f64 {
        let h = self.horizontal_tension(uniform_load);
        let v = uniform_load * self.span / 2.0;
        
        (h.powi(2) + v.powi(2)).sqrt()
    }
    
    /// Factor of safety
    pub fn factor_of_safety(&self, uniform_load: f64) -> f64 {
        self.breaking_strength / self.max_tension(uniform_load)
    }
    
    /// Elongation under tension (m)
    pub fn elongation(&self, tension: f64) -> f64 {
        let area = PI * self.diameter.powi(2) / 4.0 * 0.7 / 1e6; // m²
        let length = self.cable_length();
        
        tension / (self.modulus * 1e9 * area) * length
    }
}

/// Ring cable
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RingCable {
    /// Ring diameter (m)
    pub diameter: f64,
    /// Cable cross-section (mm²)
    pub area: f64,
    /// Breaking strength (kN)
    pub breaking_strength: f64,
}

impl RingCable {
    pub fn new(diameter: f64, cable_dia: f64) -> Self {
        let area = PI * cable_dia.powi(2) / 4.0 * 0.7;
        
        Self {
            diameter,
            area,
            breaking_strength: area * 1770.0 / 1000.0,
        }
    }
    
    /// Ring circumference (m)
    pub fn circumference(&self) -> f64 {
        PI * self.diameter
    }
    
    /// Tension from radial load (kN)
    pub fn tension(&self, radial_load: f64) -> f64 {
        radial_load * self.diameter / 2.0
    }
    
    /// Factor of safety
    pub fn factor_of_safety(&self, radial_load: f64) -> f64 {
        self.breaking_strength / self.tension(radial_load)
    }
}

// ============================================================================
// WIND ANALYSIS
// ============================================================================

/// Wind analysis for membranes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MembraneWindAnalysis {
    /// Reference wind velocity (m/s)
    pub v_ref: f64,
    /// Terrain category
    pub terrain: TerrainCategory,
    /// Surface geometry
    pub geometry: SurfaceGeometry,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum TerrainCategory {
    Open,
    Suburban,
    Urban,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SurfaceGeometry {
    Saddle,
    Cone,
    Barrel,
    Hypar,
}

impl MembraneWindAnalysis {
    pub fn new(v_ref: f64, terrain: TerrainCategory, geometry: SurfaceGeometry) -> Self {
        Self { v_ref, terrain, geometry }
    }
    
    /// Terrain roughness coefficient
    pub fn terrain_factor(&self) -> f64 {
        match self.terrain {
            TerrainCategory::Open => 1.0,
            TerrainCategory::Suburban => 0.85,
            TerrainCategory::Urban => 0.7,
        }
    }
    
    /// Design velocity (m/s)
    pub fn design_velocity(&self) -> f64 {
        self.v_ref * self.terrain_factor()
    }
    
    /// Dynamic pressure (kN/m²)
    pub fn dynamic_pressure(&self) -> f64 {
        0.5 * 1.25 * self.design_velocity().powi(2) / 1000.0
    }
    
    /// External pressure coefficient
    pub fn cpe(&self, zone: &str) -> f64 {
        match (self.geometry, zone) {
            (SurfaceGeometry::Saddle, "windward") => 0.2,
            (SurfaceGeometry::Saddle, "leeward") => -0.6,
            (SurfaceGeometry::Cone, "upwind") => 0.4,
            (SurfaceGeometry::Cone, "downwind") => -0.8,
            _ => -0.5,
        }
    }
    
    /// Internal pressure coefficient
    pub fn cpi(&self, opening_ratio: f64) -> f64 {
        if opening_ratio < 0.05 {
            0.0
        } else if opening_ratio < 0.1 {
            0.2
        } else {
            0.4
        }
    }
    
    /// Net wind pressure (kN/m²)
    pub fn net_pressure(&self, cpe: f64, cpi: f64) -> f64 {
        self.dynamic_pressure() * (cpe - cpi)
    }
}

// ============================================================================
// PATTERNING
// ============================================================================

/// Membrane patterning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MembranePattern {
    /// Panel width (m)
    pub panel_width: f64,
    /// Compensation warp (%)
    pub comp_warp: f64,
    /// Compensation fill (%)
    pub comp_fill: f64,
    /// Seam type
    pub seam_type: SeamType,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SeamType {
    Welded,
    Sewn,
    Clamped,
    Laced,
}

impl MembranePattern {
    pub fn standard_pvc() -> Self {
        Self {
            panel_width: 2.5, // Typical roll width
            comp_warp: 2.0,
            comp_fill: 1.5,
            seam_type: SeamType::Welded,
        }
    }
    
    pub fn standard_ptfe() -> Self {
        Self {
            panel_width: 2.3,
            comp_warp: 1.0,
            comp_fill: 0.8,
            seam_type: SeamType::Welded,
        }
    }
    
    /// Number of panels for span
    pub fn num_panels(&self, span: f64) -> u32 {
        (span / self.panel_width).ceil() as u32
    }
    
    /// Total seam length (m)
    pub fn seam_length(&self, surface_area: f64, span: f64) -> f64 {
        let num = self.num_panels(span) - 1;
        let avg_length = surface_area / span;
        
        num as f64 * avg_length
    }
    
    /// Seam strength reduction
    pub fn seam_efficiency(&self) -> f64 {
        match self.seam_type {
            SeamType::Welded => 0.9,
            SeamType::Sewn => 0.7,
            SeamType::Clamped => 0.85,
            SeamType::Laced => 0.6,
        }
    }
    
    /// Compensated dimension (m)
    pub fn compensated_warp(&self, length: f64) -> f64 {
        length * (1.0 - self.comp_warp / 100.0)
    }
    
    pub fn compensated_fill(&self, length: f64) -> f64 {
        length * (1.0 - self.comp_fill / 100.0)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fabric_pvc() {
        let pvc = FabricMaterial::pvc_type_ii();
        
        assert!(pvc.strength_warp > 50.0);
        assert!(pvc.weight < 2.0);
    }

    #[test]
    fn test_fabric_ptfe() {
        let ptfe = FabricMaterial::ptfe_standard();
        
        assert!(ptfe.strength_warp > ptfe.strength_fill);
        assert!(ptfe.expected_life() > 25.0);
    }

    #[test]
    fn test_anticlastic() {
        let saddle = AnticlasticSurface::new(20.0, 15.0, 2.0, 3.0);
        
        let k_gauss = saddle.gaussian_curvature();
        assert!(k_gauss < 0.0); // Negative for anticlastic
    }

    #[test]
    fn test_surface_area() {
        let surface = AnticlasticSurface::new(10.0, 10.0, 1.0, 1.0);
        
        let area = surface.surface_area();
        assert!(area > 100.0); // Greater than flat
    }

    #[test]
    fn test_radial_surface() {
        let cone = RadialSurface::new(8, 15.0, 3.0, 5.0);
        
        assert!(cone.cone_angle() > 0.0);
        assert!(cone.surface_area() > 200.0);
    }

    #[test]
    fn test_prestress() {
        let surface = AnticlasticSurface::new(15.0, 12.0, 1.5, 2.0);
        let prestress = MembranePrestress::from_geometry(&surface, 0.5);
        
        assert!(prestress.t_warp > 0.0);
        assert!(prestress.t_fill > 0.0);
    }

    #[test]
    fn test_edge_cable() {
        let cable = EdgeCable::spiral_strand(20.0, 30.0, 3.0);
        
        let length = cable.cable_length();
        assert!(length > cable.span);
    }

    #[test]
    fn test_cable_tension() {
        let cable = EdgeCable::spiral_strand(25.0, 25.0, 2.5);
        let load = 5.0; // kN/m
        
        let fos = cable.factor_of_safety(load);
        assert!(fos > 2.0);
    }

    #[test]
    fn test_ring_cable() {
        let ring = RingCable::new(10.0, 30.0);
        
        let t = ring.tension(50.0);
        assert!(t > 0.0);
    }

    #[test]
    fn test_wind_analysis() {
        let wind = MembraneWindAnalysis::new(40.0, TerrainCategory::Suburban, SurfaceGeometry::Saddle);
        
        let q = wind.dynamic_pressure();
        assert!(q > 0.5 && q < 2.0);
    }

    #[test]
    fn test_patterning() {
        let pattern = MembranePattern::standard_pvc();
        
        let num = pattern.num_panels(30.0);
        assert!(num >= 12);
    }

    #[test]
    fn test_compensation() {
        let pattern = MembranePattern::standard_ptfe();
        
        let comp = pattern.compensated_warp(10.0);
        assert!(comp < 10.0);
    }
}
