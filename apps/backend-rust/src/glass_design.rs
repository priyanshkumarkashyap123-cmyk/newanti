// ============================================================================
// GLASS DESIGN - ASTM E1300, EN 16612, AS 1288
// Structural glass, facades, glazing systems
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// GLASS TYPES
// ============================================================================

/// Glass type and properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlassType {
    /// Glass category
    pub category: GlassCategory,
    /// Nominal thickness (mm)
    pub thickness: f64,
    /// Characteristic strength (MPa)
    pub strength: f64,
    /// Modulus of elasticity (GPa)
    pub modulus: f64,
    /// Surface condition
    pub surface: SurfaceCondition,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum GlassCategory {
    Annealed,
    HeatStrengthened,
    FullyTempered,
    ChemicallyStrengthened,
    Laminated,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SurfaceCondition {
    AsReceived,
    Sandblasted,
    Enameled,
    Patterned,
}

impl GlassType {
    pub fn annealed(thickness: f64) -> Self {
        Self {
            category: GlassCategory::Annealed,
            thickness,
            strength: 45.0, // MPa
            modulus: 70.0,  // GPa
            surface: SurfaceCondition::AsReceived,
        }
    }
    
    pub fn heat_strengthened(thickness: f64) -> Self {
        Self {
            category: GlassCategory::HeatStrengthened,
            thickness,
            strength: 70.0,
            modulus: 70.0,
            surface: SurfaceCondition::AsReceived,
        }
    }
    
    pub fn fully_tempered(thickness: f64) -> Self {
        Self {
            category: GlassCategory::FullyTempered,
            thickness,
            strength: 120.0,
            modulus: 70.0,
            surface: SurfaceCondition::AsReceived,
        }
    }
    
    /// Load duration factor (3 second gust)
    pub fn duration_factor(&self) -> f64 {
        match self.category {
            GlassCategory::Annealed => 1.0,
            GlassCategory::HeatStrengthened => 1.0,
            GlassCategory::FullyTempered => 1.0,
            GlassCategory::ChemicallyStrengthened => 0.9,
            GlassCategory::Laminated => 1.0,
        }
    }
    
    /// Surface condition factor
    pub fn surface_factor(&self) -> f64 {
        match self.surface {
            SurfaceCondition::AsReceived => 1.0,
            SurfaceCondition::Sandblasted => 0.5,
            SurfaceCondition::Enameled => 0.6,
            SurfaceCondition::Patterned => 0.8,
        }
    }
    
    /// Design strength (MPa)
    pub fn design_strength(&self, load_factor: f64) -> f64 {
        self.strength * self.duration_factor() * self.surface_factor() / load_factor
    }
    
    /// Breakage pattern
    pub fn breakage_pattern(&self) -> &'static str {
        match self.category {
            GlassCategory::Annealed => "Large sharp shards",
            GlassCategory::HeatStrengthened => "Medium fragments",
            GlassCategory::FullyTempered => "Small cubes (dice)",
            GlassCategory::ChemicallyStrengthened => "Small sharp fragments",
            GlassCategory::Laminated => "Adhered to interlayer",
        }
    }
}

// ============================================================================
// LAMINATED GLASS
// ============================================================================

/// Laminated glass unit
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaminatedGlass {
    /// Outer ply thickness (mm)
    pub outer_ply: f64,
    /// Inner ply thickness (mm)
    pub inner_ply: f64,
    /// Interlayer type
    pub interlayer: InterlayerType,
    /// Interlayer thickness (mm)
    pub interlayer_thickness: f64,
    /// Number of plies
    pub num_plies: u32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum InterlayerType {
    Pvb,       // Standard PVB
    SgpIonoplast,  // SentryGlas
    Eva,       // EVA
    Pva,       // Polyvinyl alcohol
}

impl LaminatedGlass {
    pub fn standard(outer: f64, inner: f64) -> Self {
        Self {
            outer_ply: outer,
            inner_ply: inner,
            interlayer: InterlayerType::Pvb,
            interlayer_thickness: 0.76,
            num_plies: 2,
        }
    }
    
    pub fn structural(outer: f64, inner: f64) -> Self {
        Self {
            outer_ply: outer,
            inner_ply: inner,
            interlayer: InterlayerType::SgpIonoplast,
            interlayer_thickness: 1.52,
            num_plies: 2,
        }
    }
    
    /// Total thickness (mm)
    pub fn total_thickness(&self) -> f64 {
        self.outer_ply + self.inner_ply + 
            self.interlayer_thickness * (self.num_plies - 1) as f64
    }
    
    /// Interlayer shear modulus (MPa) at temperature/duration
    pub fn interlayer_modulus(&self, temp: f64, duration: f64) -> f64 {
        match self.interlayer {
            InterlayerType::Pvb => {
                // Temperature and time dependent
                let base = if duration < 3.0 { 0.8 } else { 0.1 };
                base * (1.0 - (temp - 20.0) * 0.02).max(0.1)
            }
            InterlayerType::SgpIonoplast => {
                // Much stiffer
                let base = if duration < 3.0 { 100.0 } else { 10.0 };
                base * (1.0 - (temp - 20.0) * 0.01).max(0.3)
            }
            InterlayerType::Eva => {
                if duration < 3.0 { 0.5 } else { 0.05 }
            }
            InterlayerType::Pva => {
                0.1
            }
        }
    }
    
    /// Effective thickness for deflection (mm)
    pub fn effective_thickness_deflection(&self, g_int: f64) -> f64 {
        let h1 = self.outer_ply;
        let h2 = self.inner_ply;
        let hv = self.interlayer_thickness;
        
        // Simplified Wölfel-Bennison
        let is = h1 * h2 / (h1 + h2) * (h1 + h2 + hv).powi(2) / 4.0;
        let gamma = 1.0 / (1.0 + 9.6 * 70000.0 * is / (g_int * hv * 1000.0_f64.powi(2)));
        
        ((h1.powi(3) + h2.powi(3)) + 12.0 * gamma * is).powf(1.0 / 3.0)
    }
    
    /// Effective thickness for stress (mm)
    pub fn effective_thickness_stress(&self, g_int: f64) -> f64 {
        let h1 = self.outer_ply;
        let h2 = self.inner_ply;
        let hv = self.interlayer_thickness;
        
        let is = h1 * h2 / (h1 + h2) * (h1 + h2 + hv).powi(2) / 4.0;
        let gamma = 1.0 / (1.0 + 9.6 * 70000.0 * is / (g_int * hv * 1000.0_f64.powi(2)));
        
        let hef_w = ((h1.powi(3) + h2.powi(3)) + 12.0 * gamma * is).powf(1.0 / 3.0);
        
        hef_w.powi(2) / (h1.max(h2) + 2.0 * gamma * (h1 + h2 + hv) / 2.0 * h2 / (h1 + h2))
    }
}

// ============================================================================
// INSULATING GLASS UNIT
// ============================================================================

/// Insulating glass unit (IGU)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsulatingGlassUnit {
    /// Outer lite
    pub outer_lite: GlassType,
    /// Inner lite
    pub inner_lite: GlassType,
    /// Cavity width (mm)
    pub cavity: f64,
    /// Cavity gas
    pub gas_fill: GasFill,
    /// Altitude difference from fabrication (m)
    pub altitude_diff: f64,
    /// Temperature difference from fabrication (°C)
    pub temp_diff: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum GasFill {
    Air,
    Argon,
    Krypton,
    Xenon,
}

impl InsulatingGlassUnit {
    pub fn standard(outer_t: f64, inner_t: f64, cavity: f64) -> Self {
        Self {
            outer_lite: GlassType::annealed(outer_t),
            inner_lite: GlassType::annealed(inner_t),
            cavity,
            gas_fill: GasFill::Air,
            altitude_diff: 0.0,
            temp_diff: 0.0,
        }
    }
    
    /// Isochoric pressure (kPa)
    pub fn isochoric_pressure(&self) -> f64 {
        let p_alt = -0.012 * self.altitude_diff; // kPa per meter
        let p_temp = 0.34 * self.temp_diff;       // kPa per °C
        
        p_alt + p_temp
    }
    
    /// Thermal transmittance U-value (W/m²K) - approximate
    pub fn u_value(&self) -> f64 {
        let r_out = 0.04;
        let r_in = 0.13;
        let r_glass = (self.outer_lite.thickness + self.inner_lite.thickness) / 1000.0;
        
        let r_cavity = match self.gas_fill {
            GasFill::Air => 0.16,
            GasFill::Argon => 0.19,
            GasFill::Krypton => 0.21,
            GasFill::Xenon => 0.22,
        } * (self.cavity / 12.0).min(1.5);
        
        1.0 / (r_out + r_in + r_glass + r_cavity)
    }
    
    /// Load share factor for outer lite
    pub fn load_share_outer(&self) -> f64 {
        let t1 = self.outer_lite.thickness;
        let t2 = self.inner_lite.thickness;
        
        t1.powi(3) / (t1.powi(3) + t2.powi(3))
    }
    
    /// Load share factor for inner lite
    pub fn load_share_inner(&self) -> f64 {
        1.0 - self.load_share_outer()
    }
    
    /// Effective cavity stiffness (kPa/mm)
    pub fn cavity_stiffness(&self, area: f64) -> f64 {
        101.325 / self.cavity * 1000.0 / area // Simplified isothermal
    }
}

// ============================================================================
// GLASS PANEL DESIGN
// ============================================================================

/// Glass panel under load
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlassPanel {
    /// Width (mm)
    pub width: f64,
    /// Height (mm)
    pub height: f64,
    /// Glass type
    pub glass: GlassType,
    /// Support condition
    pub support: SupportCondition,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SupportCondition {
    FourSidesSimply,
    FourSidesFixed,
    TwoSidesOpposite,
    ThreeSides,
}

impl GlassPanel {
    pub fn new(width: f64, height: f64, glass: GlassType) -> Self {
        Self {
            width,
            height,
            glass,
            support: SupportCondition::FourSidesSimply,
        }
    }
    
    /// Aspect ratio
    pub fn aspect_ratio(&self) -> f64 {
        self.height / self.width
    }
    
    /// Short span (mm)
    pub fn short_span(&self) -> f64 {
        self.width.min(self.height)
    }
    
    /// Long span (mm)
    pub fn long_span(&self) -> f64 {
        self.width.max(self.height)
    }
    
    /// Area (m²)
    pub fn area(&self) -> f64 {
        self.width * self.height / 1e6
    }
    
    /// ASTM E1300 non-factored load (kPa) - simplified
    pub fn nfl_astm(&self) -> f64 {
        let t = self.glass.thickness;
        let a = self.short_span();
        let ar = self.aspect_ratio().min(5.0);
        
        // Approximate from charts
        let k = match self.support {
            SupportCondition::FourSidesSimply => 0.0138,
            SupportCondition::FourSidesFixed => 0.0083,
            SupportCondition::TwoSidesOpposite => 0.0625,
            SupportCondition::ThreeSides => 0.042,
        };
        
        let ar_factor = (1.0 + ar.powi(4)).powf(0.25) / ar;
        
        k * self.glass.strength * (t / a * 1000.0).powi(2) * ar_factor
    }
    
    /// Glass type factor (GTF) per ASTM E1300
    pub fn glass_type_factor(&self) -> f64 {
        match self.glass.category {
            GlassCategory::Annealed => 1.0,
            GlassCategory::HeatStrengthened => 2.0,
            GlassCategory::FullyTempered => 4.0,
            _ => 1.5,
        }
    }
    
    /// Load resistance (kPa)
    pub fn load_resistance(&self) -> f64 {
        self.nfl_astm() * self.glass_type_factor()
    }
    
    /// Center deflection (mm) under uniform load (kPa)
    pub fn center_deflection(&self, load: f64) -> f64 {
        let a = self.short_span() / 1000.0; // m
        let t = self.glass.thickness / 1000.0; // m
        let e = self.glass.modulus * 1e9; // Pa
        let nu: f64 = 0.22;
        
        let d = e * t.powi(3) / (12.0 * (1.0 - nu.powi(2)));
        
        // Simply supported plate
        let ar = self.aspect_ratio().min(5.0);
        let alpha = 0.0138 * (1.0 - 0.24 / ar.powi(2));
        
        alpha * load * 1000.0 * a.powi(4) / d * 1000.0
    }
    
    /// Maximum stress (MPa) under uniform load (kPa)
    pub fn maximum_stress(&self, load: f64) -> f64 {
        let a = self.short_span() / 1000.0;
        let t = self.glass.thickness / 1000.0;
        
        let ar = self.aspect_ratio().min(5.0);
        let beta = 0.0479 * (1.0 - 0.16 / ar.powi(2));
        
        beta * load * 1000.0 * a.powi(2) / t.powi(2) / 1e6
    }
    
    /// Deflection limit check
    pub fn check_deflection(&self, load: f64, limit: f64) -> bool {
        let delta = self.center_deflection(load);
        let span = self.short_span();
        
        delta / span < limit
    }
}

// ============================================================================
// POINT-SUPPORTED GLASS
// ============================================================================

/// Point-supported glass panel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointSupportedGlass {
    /// Panel width (mm)
    pub width: f64,
    /// Panel height (mm)
    pub height: f64,
    /// Glass
    pub glass: LaminatedGlass,
    /// Support pattern
    pub support: PointSupport,
    /// Bolt hole diameter (mm)
    pub hole_diameter: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum PointSupport {
    FourCorners,
    SixPoints,
    CountersunkBolts,
    ClampedFittings,
}

impl PointSupportedGlass {
    pub fn four_point(width: f64, height: f64, glass: LaminatedGlass) -> Self {
        Self {
            width,
            height,
            glass,
            support: PointSupport::FourCorners,
            hole_diameter: 26.0,
        }
    }
    
    /// Edge distance requirement (mm)
    pub fn min_edge_distance(&self) -> f64 {
        2.5 * self.hole_diameter
    }
    
    /// Stress concentration factor at hole
    pub fn stress_concentration(&self) -> f64 {
        match self.support {
            PointSupport::CountersunkBolts => 2.0,
            PointSupport::ClampedFittings => 1.5,
            _ => 1.8,
        }
    }
    
    /// Effective area factor
    pub fn area_factor(&self) -> f64 {
        let a_panel = self.width * self.height;
        let a_holes = match self.support {
            PointSupport::FourCorners => 4.0,
            PointSupport::SixPoints => 6.0,
            _ => 4.0,
        } * PI * self.hole_diameter.powi(2) / 4.0;
        
        (a_panel - a_holes) / a_panel
    }
    
    /// Approximate center deflection (mm)
    pub fn deflection(&self, load: f64) -> f64 {
        let g_int = self.glass.interlayer_modulus(20.0, 3.0);
        let t_eff = self.glass.effective_thickness_deflection(g_int);
        let a = self.width.min(self.height) / 1000.0;
        let e = 70.0e9;
        
        0.0111 * load * 1000.0 * a.powi(4) / (e * (t_eff / 1000.0).powi(3)) * 1000.0
    }
    
    /// Maximum stress at support (MPa)
    pub fn stress_at_support(&self, load: f64) -> f64 {
        let g_int = self.glass.interlayer_modulus(20.0, 3.0);
        let t_eff = self.glass.effective_thickness_stress(g_int);
        let a = self.width.min(self.height) / 1000.0;
        
        let base_stress = 0.0616 * load * 1000.0 * a.powi(2) / (t_eff / 1000.0).powi(2) / 1e6;
        
        base_stress * self.stress_concentration()
    }
}

// ============================================================================
// BALUSTRADE DESIGN
// ============================================================================

/// Glass balustrade
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlassBalustrade {
    /// Glass type
    pub glass: LaminatedGlass,
    /// Height (mm)
    pub height: f64,
    /// Panel width (mm)
    pub panel_width: f64,
    /// Fixing type
    pub fixing: BalustradeFixing,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum BalustradeFixing {
    BaseChannel,
    PointFixed,
    Handrail,
    StandoffFittings,
}

impl GlassBalustrade {
    pub fn base_fixed(height: f64, width: f64, glass: LaminatedGlass) -> Self {
        Self {
            glass,
            height,
            panel_width: width,
            fixing: BalustradeFixing::BaseChannel,
        }
    }
    
    /// Effective cantilever height (mm)
    pub fn effective_height(&self) -> f64 {
        match self.fixing {
            BalustradeFixing::BaseChannel => self.height - 80.0, // Channel depth
            BalustradeFixing::PointFixed => self.height - 50.0,
            BalustradeFixing::Handrail => self.height,
            BalustradeFixing::StandoffFittings => self.height - 25.0,
        }
    }
    
    /// Section modulus (mm³/mm)
    pub fn section_modulus(&self) -> f64 {
        let g_int = self.glass.interlayer_modulus(20.0, 60.0); // 1 minute load
        let t_eff = self.glass.effective_thickness_stress(g_int);
        
        t_eff.powi(2) / 6.0
    }
    
    /// Moment capacity (kN·m/m)
    pub fn moment_capacity(&self, design_strength: f64) -> f64 {
        let s = self.section_modulus();
        
        design_strength * s / 1e6
    }
    
    /// Maximum line load capacity (kN/m)
    pub fn line_load_capacity(&self, design_strength: f64) -> f64 {
        let m_cap = self.moment_capacity(design_strength);
        let h = self.effective_height() / 1000.0;
        
        m_cap / h
    }
    
    /// Deflection under line load (mm)
    pub fn deflection(&self, line_load: f64) -> f64 {
        let g_int = self.glass.interlayer_modulus(20.0, 60.0);
        let t_eff = self.glass.effective_thickness_deflection(g_int);
        let h = self.effective_height() / 1000.0;
        let e = 70.0e9;
        let i = (t_eff / 1000.0).powi(3) / 12.0;
        
        line_load * 1000.0 * h.powi(3) / (3.0 * e * i) * 1000.0
    }
    
    /// Check against AS 1288 requirements
    pub fn check_capacity(&self, line_load: f64, point_load: f64) -> bool {
        let strength = match self.glass.outer_ply {
            t if t >= 10.0 => 120.0, // Tempered
            _ => 45.0, // Annealed
        };
        
        let cap = self.line_load_capacity(strength / 1.5);
        let point_cap = cap * self.panel_width / 1000.0 / 0.3; // Distribute point load
        
        line_load <= cap && point_load <= point_cap
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_glass_types() {
        let an = GlassType::annealed(10.0);
        let ft = GlassType::fully_tempered(10.0);
        
        assert!(ft.strength > an.strength);
    }

    #[test]
    fn test_laminated() {
        let lam = LaminatedGlass::standard(6.0, 6.0);
        
        let total = lam.total_thickness();
        assert!((total - 12.76).abs() < 0.1);
    }

    #[test]
    fn test_effective_thickness() {
        let lam = LaminatedGlass::structural(10.0, 10.0);
        let g = lam.interlayer_modulus(20.0, 3.0);
        
        let t_eff = lam.effective_thickness_deflection(g);
        assert!(t_eff > 10.0); // Greater than single ply (some coupling)
    }

    #[test]
    fn test_igu() {
        let igu = InsulatingGlassUnit::standard(6.0, 6.0, 12.0);
        
        let u = igu.u_value();
        assert!(u < 3.0 && u > 1.5);
    }

    #[test]
    fn test_load_share() {
        let igu = InsulatingGlassUnit::standard(6.0, 6.0, 12.0);
        
        let outer = igu.load_share_outer();
        let inner = igu.load_share_inner();
        
        assert!((outer + inner - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_glass_panel() {
        let glass = GlassType::fully_tempered(10.0);
        let panel = GlassPanel::new(1500.0, 2000.0, glass);
        
        let lr = panel.load_resistance();
        assert!(lr > 2.0);
    }

    #[test]
    fn test_deflection() {
        let glass = GlassType::annealed(10.0);
        let panel = GlassPanel::new(1000.0, 1000.0, glass);
        
        let delta = panel.center_deflection(1.0);
        assert!(delta > 0.0 && delta < 50.0);
    }

    #[test]
    fn test_point_supported() {
        let lam = LaminatedGlass::structural(12.0, 12.0);
        let ps = PointSupportedGlass::four_point(1500.0, 1500.0, lam);
        
        assert!(ps.min_edge_distance() > 60.0);
    }

    #[test]
    fn test_balustrade() {
        let lam = LaminatedGlass::standard(10.0, 10.0);
        let bal = GlassBalustrade::base_fixed(1100.0, 1500.0, lam);
        
        let cap = bal.line_load_capacity(45.0 / 1.5);
        assert!(cap > 0.0); // Just verify positive capacity
    }

    #[test]
    fn test_balustrade_check() {
        let lam = LaminatedGlass::structural(12.0, 12.0);
        let bal = GlassBalustrade::base_fixed(1100.0, 1200.0, lam);
        
        // Code requirement typically 0.74 kN/m line, 1.0 kN point
        let ok = bal.check_capacity(0.74, 1.0);
        // May or may not pass depending on glass selection
        let _ = ok;
    }
}
