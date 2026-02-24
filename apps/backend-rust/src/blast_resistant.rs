// ============================================================================
// BLAST RESISTANT DESIGN - UFC 3-340-02, ASCE 59
// Progressive collapse, blast loading, dynamic response
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// BLAST LOADING
// ============================================================================

/// TNT equivalent charge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TntCharge {
    /// TNT equivalent weight (kg)
    pub weight: f64,
    /// Standoff distance (m)
    pub standoff: f64,
    /// Height of burst (m)
    pub height_of_burst: f64,
}

impl TntCharge {
    pub fn new(weight: f64, standoff: f64) -> Self {
        Self {
            weight,
            standoff,
            height_of_burst: 1.0,
        }
    }
    
    /// Scaled distance Z (m/kg^1/3)
    pub fn scaled_distance(&self) -> f64 {
        self.standoff / self.weight.powf(1.0 / 3.0)
    }
    
    /// Peak positive overpressure Pso (kPa) - Kingery-Bulmash
    pub fn peak_overpressure(&self) -> f64 {
        let z = self.scaled_distance();
        
        // Kingery-Bulmash polynomial fit (simplified)
        if z < 0.5 {
            40000.0 / z.powi(2)
        } else if z < 2.0 {
            1772.0 * z.powf(-1.5) + 114.0
        } else if z < 10.0 {
            93.2 * z.powf(-1.13) + 8.0
        } else {
            6.7 * z.powf(-0.7)
        }
    }
    
    /// Positive phase duration td (ms)
    pub fn positive_duration(&self) -> f64 {
        let z = self.scaled_distance();
        let w_third = self.weight.powf(1.0 / 3.0);
        
        // Approximate duration
        0.8 * w_third * z.powf(0.4)
    }
    
    /// Positive impulse is (kPa·ms)
    pub fn positive_impulse(&self) -> f64 {
        let z = self.scaled_distance();
        let w_third = self.weight.powf(1.0 / 3.0);
        
        // Approximate impulse
        if z < 2.0 {
            800.0 * w_third / z
        } else {
            320.0 * w_third / z.powf(0.8)
        }
    }
    
    /// Peak negative overpressure Pso- (kPa)
    pub fn negative_overpressure(&self) -> f64 {
        self.peak_overpressure().min(100.0) * 0.3 // Approximate
    }
    
    /// Negative phase duration (ms)
    pub fn negative_duration(&self) -> f64 {
        self.positive_duration() * 3.0 // Typically 3x positive
    }
    
    /// Arrival time ta (ms)
    pub fn arrival_time(&self) -> f64 {
        let c = 340.0; // m/s sound speed
        self.standoff / c * 1000.0
    }
}

// ============================================================================
// PRESSURE-TIME HISTORY
// ============================================================================

/// Blast pressure-time function
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlastPressureTime {
    /// Peak overpressure (kPa)
    pub pso: f64,
    /// Positive duration (ms)
    pub td: f64,
    /// Waveform parameter b
    pub b: f64,
    /// Arrival time (ms)
    pub ta: f64,
}

impl BlastPressureTime {
    pub fn from_charge(charge: &TntCharge) -> Self {
        let pso = charge.peak_overpressure();
        let td = charge.positive_duration();
        let ta = charge.arrival_time();
        
        // Friedlander parameter
        let b = 1.5; // Typical
        
        Self { pso, td, b, ta }
    }
    
    /// Pressure at time t (kPa) - Friedlander equation
    pub fn pressure_at(&self, t: f64) -> f64 {
        if t < self.ta || t > self.ta + self.td {
            0.0
        } else {
            let t_rel = (t - self.ta) / self.td;
            self.pso * (1.0 - t_rel) * (-self.b * t_rel).exp()
        }
    }
    
    /// Impulse at time t (kPa·ms)
    pub fn impulse_at(&self, t: f64) -> f64 {
        if t < self.ta {
            0.0
        } else {
            let t_rel = ((t - self.ta) / self.td).min(1.0);
            
            // Integrated Friedlander
            self.pso * self.td * (1.0 - (1.0 + self.b * t_rel) * (-self.b * t_rel).exp()) / self.b
        }
    }
    
    /// Total positive impulse (kPa·ms)
    pub fn total_impulse(&self) -> f64 {
        self.pso * self.td * (1.0 - 2.0 / self.b + 2.0 / self.b.powi(2) * (1.0 - (-self.b).exp()))
    }
    
    /// Equivalent triangular duration (ms)
    pub fn equivalent_triangular_duration(&self) -> f64 {
        2.0 * self.total_impulse() / self.pso
    }
}

// ============================================================================
// REFLECTED PRESSURE
// ============================================================================

/// Reflected blast loading
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReflectedBlast {
    /// Incident overpressure (kPa)
    pub pso: f64,
    /// Dynamic pressure (kPa)
    pub qs: f64,
    /// Angle of incidence (degrees)
    pub angle: f64,
}

impl ReflectedBlast {
    pub fn from_charge(charge: &TntCharge, angle: f64) -> Self {
        let pso = charge.peak_overpressure();
        
        // Dynamic pressure
        let _gamma = 1.4; // Air
        let qs = 2.5 * pso.powi(2) / (7.0 * 101.325 + pso);
        
        Self { pso, qs, angle }
    }
    
    /// Reflection coefficient Cr
    pub fn reflection_coefficient(&self) -> f64 {
        let angle_rad = self.angle * PI / 180.0;
        
        if self.angle < 40.0 {
            // Normal to nearly normal
            let cr_max = 2.0 + (self.pso / 101.325).min(7.0);
            cr_max * angle_rad.cos().powi(2)
        } else {
            // Oblique
            2.0 * angle_rad.cos()
        }
    }
    
    /// Peak reflected pressure Pr (kPa)
    pub fn peak_reflected_pressure(&self) -> f64 {
        self.pso * self.reflection_coefficient()
    }
    
    /// Stagnation pressure (kPa)
    pub fn stagnation_pressure(&self) -> f64 {
        self.pso + self.qs
    }
    
    /// Clearing time tc (ms) for finite surface
    pub fn clearing_time(&self, height: f64, width: f64) -> f64 {
        let s = height.min(width / 2.0);
        let u_s = 340.0 * (1.0 + 6.0 * self.pso / (7.0 * 101.325)).sqrt();
        
        3.0 * s / u_s * 1000.0
    }
    
    /// Effective pressure after clearing (kPa)
    pub fn cleared_pressure(&self, cd: f64) -> f64 {
        self.pso + cd * self.qs
    }
}

// ============================================================================
// SDOF MODEL
// ============================================================================

/// SDOF system for blast response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SdofBlast {
    /// Effective mass (kg)
    pub mass: f64,
    /// Stiffness (kN/m)
    pub stiffness: f64,
    /// Ultimate resistance (kN)
    pub resistance: f64,
    /// Damping ratio
    pub damping: f64,
}

impl SdofBlast {
    pub fn new(mass: f64, stiffness: f64, resistance: f64) -> Self {
        Self {
            mass,
            stiffness,
            resistance,
            damping: 0.05,
        }
    }
    
    /// Natural period (ms)
    pub fn natural_period(&self) -> f64 {
        2.0 * PI * (self.mass / self.stiffness / 1000.0).sqrt() * 1000.0
    }
    
    /// Elastic deflection at yield (mm)
    pub fn yield_deflection(&self) -> f64 {
        self.resistance / self.stiffness * 1000.0
    }
    
    /// Ductility ratio
    pub fn ductility_ratio(&self, max_deflection: f64) -> f64 {
        max_deflection / self.yield_deflection()
    }
    
    /// Response regime determination
    pub fn response_regime(&self, td: f64) -> ResponseRegime {
        let tn = self.natural_period();
        let ratio = td / tn;
        
        if ratio < 0.1 {
            ResponseRegime::Impulsive
        } else if ratio > 3.0 {
            ResponseRegime::QuasiStatic
        } else {
            ResponseRegime::Dynamic
        }
    }
    
    /// Maximum elastic response (mm) - impulsive
    pub fn impulsive_response(&self, impulse: f64, area: f64) -> f64 {
        let i = impulse * area / 1000.0; // kN·s
        let omega = 2.0 * PI / self.natural_period() * 1000.0;
        
        i / (self.mass * omega) * 1000.0
    }
    
    /// Maximum elastic response (mm) - quasi-static
    pub fn quasi_static_response(&self, pressure: f64, area: f64) -> f64 {
        let force = pressure * area; // kN
        
        2.0 * force / self.stiffness * 1000.0 // Dynamic factor 2.0
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum ResponseRegime {
    Impulsive,
    Dynamic,
    QuasiStatic,
}

// ============================================================================
// MEMBER DESIGN
// ============================================================================

/// Blast-resistant member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlastMember {
    /// Span (m)
    pub span: f64,
    /// Width (m)
    pub width: f64,
    /// Depth (mm)
    pub depth: f64,
    /// Support condition
    pub support: SupportType,
    /// Material
    pub material: BlastMaterial,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SupportType {
    SimpleSpan,
    FixedFixed,
    Cantilever,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum BlastMaterial {
    ReinforcedConcrete,
    StructuralSteel,
    ColdFormedSteel,
}

impl BlastMember {
    pub fn concrete_slab(span: f64, width: f64, thickness: f64) -> Self {
        Self {
            span,
            width,
            depth: thickness,
            support: SupportType::SimpleSpan,
            material: BlastMaterial::ReinforcedConcrete,
        }
    }
    
    pub fn steel_beam(span: f64, depth: f64) -> Self {
        Self {
            span,
            width: 0.3, // Tributary
            depth,
            support: SupportType::SimpleSpan,
            material: BlastMaterial::StructuralSteel,
        }
    }
    
    /// Load-mass factor KLM
    pub fn load_mass_factor(&self) -> f64 {
        match self.support {
            SupportType::SimpleSpan => 0.78,
            SupportType::FixedFixed => 0.77,
            SupportType::Cantilever => 0.45,
        }
    }
    
    /// Resistance factor KR
    pub fn resistance_factor(&self) -> f64 {
        match self.support {
            SupportType::SimpleSpan => 8.0,
            SupportType::FixedFixed => 16.0,
            SupportType::Cantilever => 2.0,
        }
    }
    
    /// Ultimate resistance (kN)
    pub fn ultimate_resistance(&self, mp: f64) -> f64 {
        self.resistance_factor() * mp / self.span
    }
    
    /// Effective stiffness (kN/m)
    pub fn effective_stiffness(&self, ei: f64) -> f64 {
        match self.support {
            SupportType::SimpleSpan => 384.0 * ei / (5.0 * self.span.powi(4)),
            SupportType::FixedFixed => 384.0 * ei / self.span.powi(4),
            SupportType::Cantilever => 3.0 * ei / self.span.powi(4),
        }
    }
    
    /// Dynamic increase factor
    pub fn dif(&self) -> f64 {
        match self.material {
            BlastMaterial::ReinforcedConcrete => 1.19,
            BlastMaterial::StructuralSteel => 1.29,
            BlastMaterial::ColdFormedSteel => 1.10,
        }
    }
    
    /// Strength increase factor
    pub fn sif(&self) -> f64 {
        match self.material {
            BlastMaterial::ReinforcedConcrete => 1.10,
            BlastMaterial::StructuralSteel => 1.05,
            BlastMaterial::ColdFormedSteel => 1.21,
        }
    }
    
    /// Enhanced ultimate resistance (kN)
    pub fn enhanced_resistance(&self, mp: f64) -> f64 {
        self.ultimate_resistance(mp) * self.dif() * self.sif()
    }
}

// ============================================================================
// PROGRESSIVE COLLAPSE
// ============================================================================

/// Progressive collapse analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressiveCollapse {
    /// Number of stories
    pub stories: u32,
    /// Story height (m)
    pub story_height: f64,
    /// Bay width x (m)
    pub bay_x: f64,
    /// Bay width y (m)
    pub bay_y: f64,
    /// Dead load (kN/m²)
    pub dead_load: f64,
    /// Live load (kN/m²)
    pub live_load: f64,
}

impl ProgressiveCollapse {
    pub fn new(stories: u32, bay_x: f64, bay_y: f64) -> Self {
        Self {
            stories,
            story_height: 3.5,
            bay_x,
            bay_y,
            dead_load: 6.0,
            live_load: 2.0,
        }
    }
    
    /// GSA load combination (kN/m²)
    pub fn gsa_load(&self) -> f64 {
        2.0 * (self.dead_load + 0.25 * self.live_load)
    }
    
    /// DoD load combination (kN/m²)
    pub fn dod_load(&self) -> f64 {
        1.2 * self.dead_load + 0.5 * self.live_load
    }
    
    /// Dynamic amplification factor
    pub fn dynamic_factor(&self, ductility: f64) -> f64 {
        if ductility < 1.0 {
            2.0
        } else {
            1.0 + 1.0 / ductility
        }
    }
    
    /// Tie force requirement (kN)
    pub fn tie_force(&self, edge: bool) -> f64 {
        let w = self.gsa_load();
        let l = if edge { self.bay_x.max(self.bay_y) } else { 
            (self.bay_x + self.bay_y) / 2.0 
        };
        
        w * l * (self.story_height + 1.0)
    }
    
    /// Column removal scenario - Double span beam moment (kN·m)
    pub fn double_span_moment(&self, tributary_width: f64) -> f64 {
        let w = self.gsa_load() * tributary_width;
        let l = 2.0 * self.bay_x; // Double span
        
        w * l.powi(2) / 8.0
    }
    
    /// Catenary action force (kN)
    pub fn catenary_force(&self, sag: f64, span: f64, load: f64) -> f64 {
        load * span.powi(2) / (8.0 * sag)
    }
    
    /// Acceptance criteria - rotation limit (radians)
    pub fn rotation_limit(&self, action: RotationCategory) -> f64 {
        match action {
            RotationCategory::FlexuralSteel => 0.21,
            RotationCategory::FlexuralConcrete => 0.105,
            RotationCategory::Catenary => 0.35,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum RotationCategory {
    FlexuralSteel,
    FlexuralConcrete,
    Catenary,
}

// ============================================================================
// FRAGMENT IMPACT
// ============================================================================

/// Fragment impact analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FragmentImpact {
    /// Fragment mass (kg)
    pub mass: f64,
    /// Fragment velocity (m/s)
    pub velocity: f64,
    /// Fragment area (cm²)
    pub area: f64,
}

impl FragmentImpact {
    pub fn from_standoff(charge_weight: f64, standoff: f64) -> Self {
        // Approximate fragment characteristics
        let mass = 0.001 * charge_weight; // Small fragment
        let velocity = 2000.0 * (charge_weight.powf(0.2) / standoff).min(1.0);
        let area = 1.0; // 1 cm² typical
        
        Self { mass, velocity, area }
    }
    
    /// Fragment kinetic energy (J)
    pub fn kinetic_energy(&self) -> f64 {
        0.5 * self.mass * self.velocity.powi(2)
    }
    
    /// Perforation velocity for steel (m/s)
    pub fn steel_perforation_velocity(&self, thickness: f64) -> f64 {
        // Thor equation (simplified)
        let a = self.area / 100.0; // cm² to m² factor
        1950.0 * (thickness / 25.4).powf(0.906) / (self.mass * 1000.0).powf(0.359) * a.powf(-0.273)
    }
    
    /// Perforation velocity for concrete (m/s)
    pub fn concrete_perforation_velocity(&self, thickness: f64, fc: f64) -> f64 {
        // Modified NDRC
        let d = (self.area * 4.0 / PI).sqrt() / 100.0; // Equivalent diameter m
        
        280.0 * (fc / 30.0).sqrt() * (thickness / 1000.0 / d).sqrt() / (self.mass).powf(0.4)
    }
    
    /// Check if fragment penetrates
    pub fn penetrates_steel(&self, thickness: f64) -> bool {
        self.velocity > self.steel_perforation_velocity(thickness)
    }
    
    /// Residual velocity after penetration (m/s)
    pub fn residual_velocity(&self, vp: f64) -> f64 {
        if self.velocity > vp {
            (self.velocity.powi(2) - vp.powi(2)).sqrt()
        } else {
            0.0
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
    fn test_scaled_distance() {
        let charge = TntCharge::new(100.0, 10.0);
        
        let z = charge.scaled_distance();
        assert!((z - 2.15).abs() < 0.1); // 10 / 100^(1/3) ≈ 2.15
    }

    #[test]
    fn test_overpressure() {
        let charge = TntCharge::new(500.0, 20.0);
        
        let pso = charge.peak_overpressure();
        assert!(pso > 0.0);
    }

    #[test]
    fn test_pressure_time() {
        let charge = TntCharge::new(100.0, 15.0);
        let pt = BlastPressureTime::from_charge(&charge);
        
        // Peak at arrival
        let p_peak = pt.pressure_at(pt.ta + 0.01);
        assert!(p_peak > 0.9 * pt.pso);
        
        // Zero after duration
        let p_end = pt.pressure_at(pt.ta + pt.td + 1.0);
        assert!(p_end < 0.01);
    }

    #[test]
    fn test_reflected() {
        let charge = TntCharge::new(50.0, 10.0);
        let reflected = ReflectedBlast::from_charge(&charge, 0.0);
        
        let pr = reflected.peak_reflected_pressure();
        assert!(pr > charge.peak_overpressure());
    }

    #[test]
    fn test_sdof() {
        let sdof = SdofBlast::new(1000.0, 500.0, 100.0);
        
        let tn = sdof.natural_period();
        assert!(tn > 50.0 && tn < 500.0);
    }

    #[test]
    fn test_response_regime() {
        let sdof = SdofBlast::new(500.0, 1000.0, 50.0);
        
        assert_eq!(sdof.response_regime(1.0), ResponseRegime::Impulsive);
        assert_eq!(sdof.response_regime(500.0), ResponseRegime::QuasiStatic);
    }

    #[test]
    fn test_blast_member() {
        let slab = BlastMember::concrete_slab(6.0, 1.0, 200.0);
        
        assert!(slab.dif() > 1.0);
        assert!(slab.sif() > 1.0);
    }

    #[test]
    fn test_progressive_collapse() {
        let pc = ProgressiveCollapse::new(10, 8.0, 8.0);
        
        let gsa = pc.gsa_load();
        assert!(gsa > 10.0);
        
        let tie = pc.tie_force(false);
        assert!(tie > 100.0);
    }

    #[test]
    fn test_fragment() {
        let frag = FragmentImpact::from_standoff(100.0, 20.0);
        
        let ke = frag.kinetic_energy();
        assert!(ke > 0.0);
    }

    #[test]
    fn test_perforation() {
        let frag = FragmentImpact {
            mass: 0.01,
            velocity: 500.0,
            area: 1.0,
        };
        
        let vp = frag.steel_perforation_velocity(10.0);
        assert!(vp > 0.0);
    }
}
