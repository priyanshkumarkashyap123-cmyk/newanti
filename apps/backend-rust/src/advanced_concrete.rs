// ============================================================================
// ADVANCED CONCRETE MATERIALS - Phase 20
// UHPC, fiber-reinforced concrete, self-healing, high-performance concrete
// Standards: AFGC/SETRA, fib MC2010, ACI 544, RILEM
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// CONCRETE TYPES
// ============================================================================

/// Advanced concrete types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ConcreteType {
    /// Normal strength concrete
    Normal,
    /// High strength concrete (HSC)
    HighStrength,
    /// High performance concrete (HPC)
    HighPerformance,
    /// Ultra-high performance concrete (UHPC)
    UltraHighPerformance,
    /// Steel fiber reinforced concrete (SFRC)
    SteelFiberReinforced,
    /// Glass fiber reinforced concrete (GFRC)
    GlassFiberReinforced,
    /// Polypropylene fiber reinforced
    PolypropyleneFiber,
    /// Self-compacting concrete (SCC)
    SelfCompacting,
    /// Self-healing concrete
    SelfHealing,
    /// Geopolymer concrete
    Geopolymer,
    /// Lightweight concrete
    Lightweight,
}

// ============================================================================
// UHPC - ULTRA HIGH PERFORMANCE CONCRETE
// ============================================================================

/// UHPC material properties per AFGC/SETRA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UhpcMaterial {
    /// Characteristic compressive strength (MPa)
    pub fck: f64,
    /// Mean compressive strength (MPa)
    pub fcm: f64,
    /// Elastic modulus (GPa)
    pub ecm: f64,
    /// Tensile strength - elastic limit (MPa)
    pub fctm_el: f64,
    /// Post-cracking tensile strength (MPa)
    pub fctfm: f64,
    /// Fiber content (%)
    pub fiber_content: f64,
    /// Fiber length (mm)
    pub fiber_length: f64,
    /// Fiber diameter (mm)
    pub fiber_diameter: f64,
    /// Strain at peak stress
    pub eps_c1: f64,
    /// Ultimate strain
    pub eps_cu: f64,
    /// Creep coefficient
    pub creep_coeff: f64,
    /// Shrinkage strain
    pub shrinkage: f64,
}

impl UhpcMaterial {
    /// Create UHPC with specified strength
    pub fn new(fck: f64, fiber_content: f64) -> Self {
        let fcm = fck + 8.0;
        
        // UHPC modulus (higher than conventional)
        let ecm = 50.0 + 0.1 * (fck - 150.0).max(0.0);
        
        // Tensile properties (fiber dependent)
        let fctm_el = 0.06 * fcm;
        let fctfm = fctm_el * (1.0 + 0.5 * fiber_content);
        
        Self {
            fck,
            fcm,
            ecm,
            fctm_el,
            fctfm,
            fiber_content,
            fiber_length: 13.0,    // Typical
            fiber_diameter: 0.2,   // Typical
            eps_c1: 0.0035,
            eps_cu: 0.0045,
            creep_coeff: 0.8,      // Lower than normal concrete
            shrinkage: 0.0005,     // Higher autogenous shrinkage
        }
    }
    
    /// Standard UHPC (150 MPa, 2% fibers)
    pub fn standard() -> Self {
        Self::new(150.0, 2.0)
    }
    
    /// High-end UHPC (200 MPa, 2.5% fibers)
    pub fn high_end() -> Self {
        Self::new(200.0, 2.5)
    }
    
    /// Fiber aspect ratio
    pub fn aspect_ratio(&self) -> f64 {
        self.fiber_length / self.fiber_diameter
    }
    
    /// Design compressive strength
    pub fn fcd(&self, gamma_c: f64) -> f64 {
        0.85 * self.fck / gamma_c
    }
    
    /// Design tensile strength
    pub fn fctd(&self, gamma_c: f64) -> f64 {
        self.fctfm / gamma_c
    }
    
    /// Stress-strain curve (compression)
    pub fn compression_stress(&self, strain: f64) -> f64 {
        let eps = strain.abs();
        
        if eps <= self.eps_c1 {
            // Ascending branch (parabolic)
            let eta = eps / self.eps_c1;
            self.fcm * (2.0 * eta - eta.powi(2))
        } else if eps <= self.eps_cu {
            // Descending branch (linear for UHPC)
            self.fcm * (1.0 - 0.15 * (eps - self.eps_c1) / (self.eps_cu - self.eps_c1))
        } else {
            0.0
        }
    }
    
    /// Tensile stress-strain (with strain hardening)
    pub fn tension_stress(&self, strain: f64) -> f64 {
        let eps = strain.abs();
        let eps_el = self.fctm_el / (self.ecm * 1000.0);
        let eps_u = 0.01; // Ultimate tensile strain
        
        if eps <= eps_el {
            // Elastic
            self.ecm * 1000.0 * eps
        } else if eps <= 0.003 {
            // Strain hardening (UHPC specific)
            self.fctm_el + (self.fctfm - self.fctm_el) * (eps - eps_el) / (0.003 - eps_el)
        } else if eps <= eps_u {
            // Softening
            self.fctfm * (1.0 - (eps - 0.003) / (eps_u - 0.003))
        } else {
            0.0
        }
    }
}

// ============================================================================
// UHPC SECTION DESIGN
// ============================================================================

/// UHPC section analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UhpcSection {
    /// Width (mm)
    pub b: f64,
    /// Height (mm)
    pub h: f64,
    /// Effective depth (mm)
    pub d: f64,
    /// Material
    pub material: UhpcMaterial,
    /// Reinforcement area (mm²)
    pub as_tension: f64,
    /// Compression reinforcement (mm²)
    pub as_compression: f64,
    /// Reinforcement yield strength (MPa)
    pub fy: f64,
}

impl UhpcSection {
    pub fn new(b: f64, h: f64, d: f64, material: UhpcMaterial, as_tension: f64, fy: f64) -> Self {
        Self {
            b, h, d,
            material,
            as_tension,
            as_compression: 0.0,
            fy,
        }
    }
    
    /// Moment capacity including UHPC tension contribution (kN·m)
    pub fn moment_capacity(&self) -> f64 {
        // Simplified rectangular stress block
        let gamma_c = 1.5;
        let gamma_s = 1.15;
        
        let fcd = self.material.fcd(gamma_c);
        let fctd = self.material.fctd(gamma_c);
        let fyd = self.fy / gamma_s;
        
        // Neutral axis (iterative)
        let mut x = self.d / 3.0;
        
        for _ in 0..20 {
            // Compression in concrete
            let _fc_res = 0.8 * x * self.b * fcd;
            
            // Tension in steel
            let fs_res = self.as_tension * fyd;
            
            // Tension in UHPC (below neutral axis)
            let h_tension = self.h - x;
            let ft_res = h_tension * self.b * fctd * 0.8; // Reduced for cracking
            
            let x_new = (fs_res + ft_res) / (0.8 * self.b * fcd);
            
            if (x_new - x).abs() < 0.1 {
                break;
            }
            x = 0.5 * (x + x_new);
        }
        
        // Moment about neutral axis
        let lever_c = 0.4 * x;
        let lever_s = self.d - x;
        let lever_t = (self.h - x) / 2.0;
        
        let m_c = 0.8 * x * self.b * fcd * lever_c;
        let m_s = self.as_tension * (self.fy / gamma_s) * lever_s;
        let m_t = (self.h - x) * self.b * fctd * 0.8 * lever_t;
        
        (m_c + m_s + m_t) / 1e6
    }
    
    /// Shear capacity (UHPC contributes significantly)
    pub fn shear_capacity(&self) -> f64 {
        let gamma_c = 1.5;
        let fctd = self.material.fctd(gamma_c);
        
        // UHPC shear contribution (fiber bridging)
        let sigma_rd = fctd * 0.85; // Residual tensile stress
        let bw = self.b;
        let z = 0.9 * self.d;
        
        // Inclination of compression strut
        let theta = 35.0_f64 * PI / 180.0;
        
        let v_rd = sigma_rd * bw * z / theta.tan();
        
        v_rd / 1000.0 // kN
    }
}

// ============================================================================
// FIBER REINFORCED CONCRETE (FRC)
// ============================================================================

/// Fiber types for FRC
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum FiberMaterial {
    Steel,
    Glass,
    Polypropylene,
    Polyvinyl,
    Basalt,
    Carbon,
    Natural,
}

/// Steel fiber properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelFiber {
    /// Length (mm)
    pub length: f64,
    /// Diameter (mm)
    pub diameter: f64,
    /// Tensile strength (MPa)
    pub tensile_strength: f64,
    /// Elastic modulus (GPa)
    pub modulus: f64,
    /// Fiber type (hooked, crimped, etc.)
    pub fiber_type: String,
}

impl SteelFiber {
    /// Hooked-end fiber (Dramix type)
    pub fn hooked(length: f64, diameter: f64) -> Self {
        Self {
            length,
            diameter,
            tensile_strength: 1100.0,
            modulus: 200.0,
            fiber_type: "hooked".to_string(),
        }
    }
    
    /// Crimped fiber
    pub fn crimped(length: f64, diameter: f64) -> Self {
        Self {
            length,
            diameter,
            tensile_strength: 800.0,
            modulus: 200.0,
            fiber_type: "crimped".to_string(),
        }
    }
    
    /// Aspect ratio
    pub fn aspect_ratio(&self) -> f64 {
        self.length / self.diameter
    }
}

/// FRC material per fib Model Code 2010
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrcMaterial {
    /// Base concrete strength (MPa)
    pub fck: f64,
    /// Fiber
    pub fiber: SteelFiber,
    /// Fiber dosage (kg/m³)
    pub dosage: f64,
    /// Residual strength at CMOD1 (MPa)
    pub fr1: f64,
    /// Residual strength at CMOD3 (MPa)
    pub fr3: f64,
    /// Post-cracking class
    pub frc_class: String,
}

impl FrcMaterial {
    pub fn new(fck: f64, fiber: SteelFiber, dosage: f64) -> Self {
        // Estimate residual strengths based on dosage and fiber properties
        let vf = dosage / 7850.0 * 100.0; // Volume fraction %
        let lambda = fiber.aspect_ratio();
        
        // Simplified estimation (actual should come from testing)
        let fr1 = 0.45 * fck.sqrt() * vf * lambda / 50.0;
        let fr3 = 0.37 * fck.sqrt() * vf * lambda / 50.0;
        
        // Classification per MC2010
        let frc_class = Self::classify(fr1, fr3);
        
        Self {
            fck,
            fiber,
            dosage,
            fr1,
            fr3,
            frc_class,
        }
    }
    
    fn classify(fr1: f64, fr3: f64) -> String {
        let strength_class = if fr1 >= 5.0 { "5" }
            else if fr1 >= 4.0 { "4" }
            else if fr1 >= 3.0 { "3" }
            else if fr1 >= 2.5 { "2.5" }
            else if fr1 >= 2.0 { "2" }
            else if fr1 >= 1.5 { "1.5" }
            else { "1" };
        
        let ductility_class = if fr3 / fr1 >= 1.1 { "d" }
            else if fr3 / fr1 >= 0.9 { "c" }
            else if fr3 / fr1 >= 0.7 { "b" }
            else { "a" };
        
        format!("{}{}", strength_class, ductility_class)
    }
    
    /// Design residual strength fFtud (MPa)
    pub fn design_residual_strength(&self, gamma_c: f64) -> f64 {
        let fftuk = self.fr3 / 3.0; // Characteristic
        fftuk / gamma_c
    }
    
    /// Can fibers replace minimum reinforcement?
    pub fn replaces_minimum_reinforcement(&self) -> bool {
        self.fr1 >= 0.4 * self.fck.sqrt() && self.fr3 / self.fr1 >= 0.5
    }
}

/// FRC section design per MC2010
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrcSection {
    pub b: f64,
    pub h: f64,
    pub d: f64,
    pub material: FrcMaterial,
    pub as_tension: f64,
    pub fy: f64,
}

impl FrcSection {
    pub fn new(b: f64, h: f64, d: f64, material: FrcMaterial, as_tension: f64, fy: f64) -> Self {
        Self { b, h, d, material, as_tension, fy }
    }
    
    /// Shear capacity with fiber contribution (kN)
    pub fn shear_capacity(&self) -> f64 {
        let gamma_c = 1.5;
        let _gamma_s = 1.15;
        
        // Concrete contribution
        let fck = self.material.fck;
        let rho = self.as_tension / (self.b * self.d);
        let k = (1.0 + (200.0 / self.d).sqrt()).min(2.0);
        
        let v_rd_c = 0.18 / gamma_c * k * (100.0 * rho * fck).powf(1.0 / 3.0) * self.b * self.d;
        
        // Fiber contribution
        let fftud = self.material.design_residual_strength(gamma_c);
        let v_rd_f = fftud * self.b * 0.9 * self.d / 1.4; // tan(45°) = 1
        
        (v_rd_c + v_rd_f) / 1000.0
    }
    
    /// Crack width (FRC reduces crack width)
    pub fn crack_width(&self, moment: f64, cover: f64) -> f64 {
        // Simplified crack width calculation
        let _gamma_c = 1.5;
        let fctm = 0.3 * self.material.fck.powf(2.0 / 3.0);
        let fftum = self.material.fr3 / 3.0;
        
        // Steel stress
        let z = 0.9 * self.d;
        let sigma_s = moment * 1e6 / (self.as_tension * z);
        
        // Crack spacing (reduced by fibers)
        let phi = 16.0; // Assumed bar diameter
        let rho_eff = self.as_tension / (2.5 * (self.h - self.d) * self.b);
        let sr_max = 3.4 * cover + 0.425 * 0.8 * phi / rho_eff;
        
        // Fiber reduction factor
        let fiber_factor = 1.0 - 0.5 * fftum / fctm;
        
        // Mean strain
        let es = 200000.0;
        let eps_sm = sigma_s / es * (1.0 - 0.6 * fctm / sigma_s * (1.0 + fiber_factor));
        
        sr_max * eps_sm.max(0.0)
    }
}

// ============================================================================
// SELF-HEALING CONCRETE
// ============================================================================

/// Self-healing mechanism types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum HealingMechanism {
    /// Autogenous healing (continued hydration)
    Autogenous,
    /// Bacteria-based (MICP)
    Bacterial,
    /// Encapsulated polymers
    Encapsulated,
    /// Vascular network
    Vascular,
    /// Shape memory polymers
    ShapeMemory,
    /// Mineral additite
    MineralAdditive,
}

/// Self-healing concrete properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelfHealingConcrete {
    /// Base concrete strength (MPa)
    pub fck: f64,
    /// Healing mechanism
    pub mechanism: HealingMechanism,
    /// Maximum healable crack width (mm)
    pub max_healable_width: f64,
    /// Healing efficiency (%)
    pub healing_efficiency: f64,
    /// Time to heal (days)
    pub healing_time: f64,
    /// Number of healing cycles
    pub healing_cycles: usize,
}

impl SelfHealingConcrete {
    pub fn new(fck: f64, mechanism: HealingMechanism) -> Self {
        let (max_width, efficiency, time, cycles) = match mechanism {
            HealingMechanism::Autogenous => (0.15, 60.0, 28.0, 1),
            HealingMechanism::Bacterial => (0.50, 80.0, 14.0, 3),
            HealingMechanism::Encapsulated => (0.40, 85.0, 7.0, 1),
            HealingMechanism::Vascular => (0.80, 90.0, 3.0, 10),
            HealingMechanism::ShapeMemory => (0.30, 70.0, 1.0, 5),
            HealingMechanism::MineralAdditive => (0.30, 75.0, 21.0, 2),
        };
        
        Self {
            fck,
            mechanism,
            max_healable_width: max_width,
            healing_efficiency: efficiency,
            healing_time: time,
            healing_cycles: cycles,
        }
    }
    
    /// Can heal a crack of given width?
    pub fn can_heal(&self, crack_width: f64) -> bool {
        crack_width <= self.max_healable_width
    }
    
    /// Recovered strength after healing (fraction)
    pub fn recovered_strength(&self, crack_width: f64) -> f64 {
        if crack_width > self.max_healable_width {
            0.0
        } else {
            let width_ratio = 1.0 - crack_width / self.max_healable_width;
            self.healing_efficiency / 100.0 * width_ratio
        }
    }
    
    /// Cost factor relative to normal concrete
    pub fn cost_factor(&self) -> f64 {
        match self.mechanism {
            HealingMechanism::Autogenous => 1.0,
            HealingMechanism::Bacterial => 1.3,
            HealingMechanism::Encapsulated => 1.5,
            HealingMechanism::Vascular => 2.0,
            HealingMechanism::ShapeMemory => 2.5,
            HealingMechanism::MineralAdditive => 1.2,
        }
    }
    
    /// Service life extension factor
    pub fn service_life_factor(&self) -> f64 {
        1.0 + (self.healing_efficiency / 100.0) * (self.healing_cycles as f64).sqrt() * 0.5
    }
}

// ============================================================================
// HIGH PERFORMANCE CONCRETE (HPC)
// ============================================================================

/// HPC mix design parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HpcMixDesign {
    /// Target strength (MPa)
    pub fck: f64,
    /// Water-cite ratio
    pub w_c: f64,
    /// Cement content (kg/m³)
    pub cement: f64,
    /// Silica fume (kg/m³)
    pub silica_fume: f64,
    /// Fly ash (kg/m³)
    pub fly_ash: f64,
    /// GGBS (kg/m³)
    pub ggbs: f64,
    /// Superplasticizer (% by cement weight)
    pub superplasticizer: f64,
    /// Maximum aggregate size (mm)
    pub max_agg_size: f64,
}

impl HpcMixDesign {
    /// Design mix for target strength
    pub fn design(target_fck: f64) -> Self {
        let w_c = if target_fck > 100.0 {
            0.20
        } else if target_fck > 80.0 {
            0.25
        } else if target_fck > 60.0 {
            0.32
        } else {
            0.40
        };
        
        let cement = 400.0 + 2.0 * (target_fck - 40.0).max(0.0);
        let silica_fume = if target_fck > 80.0 { 0.10 * cement } else { 0.05 * cement };
        let fly_ash = 0.15 * cement;
        
        Self {
            fck: target_fck,
            w_c,
            cement,
            silica_fume,
            fly_ash,
            ggbs: 0.0,
            superplasticizer: 1.5,
            max_agg_size: if target_fck > 80.0 { 10.0 } else { 20.0 },
        }
    }
    
    /// Total cementitious content
    pub fn total_cementitious(&self) -> f64 {
        self.cement + self.silica_fume + self.fly_ash + self.ggbs
    }
    
    /// Estimated 28-day strength (MPa)
    pub fn estimated_strength(&self) -> f64 {
        // Modified Abrams law for HPC
        let k = 96.0; // For high-quality aggregates
        k / self.w_c.powf(1.5)
    }
    
    /// Estimated elastic modulus (GPa)
    pub fn estimated_modulus(&self) -> f64 {
        22.0 * (self.fck / 10.0).powf(0.3)
    }
    
    /// Chloride diffusion coefficient (×10⁻¹² m²/s)
    pub fn chloride_diffusion(&self) -> f64 {
        // Reduced by SCMs
        let scm_factor = 1.0 - 0.5 * (self.silica_fume + self.fly_ash) / self.total_cementitious();
        10.0 * self.w_c.powf(2.5) * scm_factor
    }
    
    /// Cost per cubic meter (relative to C30)
    pub fn relative_cost(&self) -> f64 {
        1.0 + 0.01 * (self.fck - 30.0) + 0.002 * self.silica_fume
    }
}

// ============================================================================
// LIGHTWEIGHT CONCRETE
// ============================================================================

/// Lightweight aggregate types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum LightweightAggregate {
    ExpandedClay,
    ExpandedShale,
    Pumice,
    Perlite,
    Vermiculite,
    Foamed,
}

/// Lightweight concrete properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LightweightConcrete {
    /// Aggregate type
    pub aggregate: LightweightAggregate,
    /// Dry density (kg/m³)
    pub density: f64,
    /// Compressive strength (MPa)
    pub fck: f64,
    /// Elastic modulus (GPa)
    pub ecm: f64,
    /// Thermal conductivity (W/m·K)
    pub thermal_conductivity: f64,
}

impl LightweightConcrete {
    pub fn new(aggregate: LightweightAggregate, fck: f64) -> Self {
        let (density, lambda) = match aggregate {
            LightweightAggregate::ExpandedClay => (1600.0, 0.8),
            LightweightAggregate::ExpandedShale => (1700.0, 0.9),
            LightweightAggregate::Pumice => (1400.0, 0.5),
            LightweightAggregate::Perlite => (800.0, 0.2),
            LightweightAggregate::Vermiculite => (600.0, 0.15),
            LightweightAggregate::Foamed => (500.0, 0.12),
        };
        
        // Reduced modulus for lightweight
        let eta_e = (density / 2200.0_f64).powi(2);
        let ecm = 22.0 * (fck / 10.0).powf(0.3) * eta_e;
        
        Self {
            aggregate,
            density,
            fck,
            ecm,
            thermal_conductivity: lambda,
        }
    }
    
    /// Density class per Eurocode
    pub fn density_class(&self) -> f64 {
        (self.density / 200.0).floor() * 200.0
    }
    
    /// Conversion factor for tensile strength
    pub fn eta_1(&self) -> f64 {
        0.4 + 0.6 * self.density / 2200.0
    }
    
    /// Tensile strength (MPa)
    pub fn fctm(&self) -> f64 {
        self.eta_1() * 0.3 * self.fck.powf(2.0 / 3.0)
    }
    
    /// Fire resistance advantage (hours extra)
    pub fn fire_resistance_bonus(&self) -> f64 {
        (2200.0 - self.density) / 1000.0
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uhpc_material() {
        let uhpc = UhpcMaterial::standard();
        
        assert_eq!(uhpc.fck, 150.0);
        assert!(uhpc.ecm > 45.0);
        assert!(uhpc.fctfm > uhpc.fctm_el);
    }

    #[test]
    fn test_uhpc_stress_strain() {
        let uhpc = UhpcMaterial::standard();
        
        let stress_peak = uhpc.compression_stress(uhpc.eps_c1);
        assert!((stress_peak - uhpc.fcm).abs() < 1.0);
        
        let stress_0 = uhpc.compression_stress(0.0);
        assert!(stress_0.abs() < 0.01);
    }

    #[test]
    fn test_uhpc_tension() {
        let uhpc = UhpcMaterial::new(150.0, 2.5);
        
        let stress = uhpc.tension_stress(0.002);
        assert!(stress > 0.0);
        assert!(stress >= uhpc.fctm_el);
    }

    #[test]
    fn test_uhpc_section() {
        let uhpc = UhpcMaterial::standard();
        let section = UhpcSection::new(300.0, 400.0, 350.0, uhpc, 800.0, 500.0);
        
        let m_cap = section.moment_capacity();
        assert!(m_cap > 100.0);
        
        let v_cap = section.shear_capacity();
        assert!(v_cap > 100.0);
    }

    #[test]
    fn test_frc_material() {
        let fiber = SteelFiber::hooked(35.0, 0.55);
        let frc = FrcMaterial::new(40.0, fiber, 30.0);
        
        assert!(frc.fr1 > 0.0);
        assert!(frc.fr3 > 0.0);
        assert!(!frc.frc_class.is_empty());
    }

    #[test]
    fn test_frc_shear() {
        let fiber = SteelFiber::hooked(60.0, 0.75);
        let frc = FrcMaterial::new(40.0, fiber, 40.0);
        let section = FrcSection::new(300.0, 600.0, 540.0, frc, 1200.0, 500.0);
        
        let v_cap = section.shear_capacity();
        assert!(v_cap > 50.0);
    }

    #[test]
    fn test_fiber_aspect_ratio() {
        let fiber = SteelFiber::hooked(50.0, 0.62);
        let ar = fiber.aspect_ratio();
        
        assert!((ar - 80.6).abs() < 1.0);
    }

    #[test]
    fn test_self_healing() {
        let shc = SelfHealingConcrete::new(40.0, HealingMechanism::Bacterial);
        
        assert!(shc.can_heal(0.3));
        assert!(!shc.can_heal(1.0));
        
        let recovered = shc.recovered_strength(0.2);
        assert!(recovered > 0.0);
    }

    #[test]
    fn test_healing_efficiency() {
        let bacterial = SelfHealingConcrete::new(40.0, HealingMechanism::Bacterial);
        let autogenous = SelfHealingConcrete::new(40.0, HealingMechanism::Autogenous);
        
        assert!(bacterial.healing_efficiency > autogenous.healing_efficiency);
        assert!(bacterial.max_healable_width > autogenous.max_healable_width);
    }

    #[test]
    fn test_hpc_mix() {
        let mix = HpcMixDesign::design(80.0);
        
        assert!(mix.w_c < 0.35);
        assert!(mix.cement > 400.0);
        assert!(mix.silica_fume > 0.0);
    }

    #[test]
    fn test_hpc_strength() {
        let mix = HpcMixDesign::design(60.0);
        let estimated = mix.estimated_strength();
        
        assert!(estimated > 50.0);
    }

    #[test]
    fn test_lightweight_concrete() {
        let lwc = LightweightConcrete::new(LightweightAggregate::ExpandedClay, 30.0);
        
        assert!(lwc.density < 2000.0);
        assert!(lwc.ecm < 30.0);
        assert!(lwc.eta_1() < 1.0);
    }

    #[test]
    fn test_lightweight_thermal() {
        let lwc = LightweightConcrete::new(LightweightAggregate::Foamed, 5.0);
        
        assert!(lwc.thermal_conductivity < 0.2);
        assert!(lwc.fire_resistance_bonus() > 1.0);
    }

    #[test]
    fn test_frc_class() {
        let fiber = SteelFiber::hooked(50.0, 0.62);
        let frc = FrcMaterial::new(40.0, fiber, 50.0);
        
        assert!(frc.frc_class.len() >= 2);
    }
}
