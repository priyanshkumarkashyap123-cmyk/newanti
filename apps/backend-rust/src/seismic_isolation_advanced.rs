//! Advanced Seismic Isolation Module
//! 
//! Implements advanced seismic isolation and energy dissipation systems:
//! - Lead rubber bearings (LRB)
//! - High damping rubber bearings (HDRB)
//! - Friction pendulum systems (FPS)
//! - Triple friction pendulum (TFP)
//! - Viscous dampers
//! - Metallic yield dampers
//! - Tuned mass dampers
//! - Base isolation system design per ASCE 7

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;
use crate::special_functions::gamma as gamma_function;

// ============================================================================
// ISOLATION DEVICE TYPES
// ============================================================================

/// Isolation device type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum IsolationDeviceType {
    /// Lead rubber bearing
    LeadRubberBearing,
    /// High damping rubber bearing
    HighDampingRubberBearing,
    /// Natural rubber bearing
    NaturalRubberBearing,
    /// Single friction pendulum
    SingleFrictionPendulum,
    /// Double friction pendulum
    DoubleFrictionPendulum,
    /// Triple friction pendulum
    TripleFrictionPendulum,
    /// Sliding bearing
    SlidingBearing,
    /// Elastomeric bearing
    ElastomericBearing,
}

impl IsolationDeviceType {
    /// Typical equivalent damping ratio
    pub fn typical_damping(&self) -> f64 {
        match self {
            Self::LeadRubberBearing => 0.25,
            Self::HighDampingRubberBearing => 0.15,
            Self::NaturalRubberBearing => 0.05,
            Self::SingleFrictionPendulum => 0.15,
            Self::DoubleFrictionPendulum => 0.20,
            Self::TripleFrictionPendulum => 0.25,
            Self::SlidingBearing => 0.10,
            Self::ElastomericBearing => 0.05,
        }
    }
    
    /// Typical displacement capacity (mm) per unit effective stiffness
    pub fn displacement_capacity_factor(&self) -> f64 {
        match self {
            Self::LeadRubberBearing => 0.7,
            Self::HighDampingRubberBearing => 0.8,
            Self::NaturalRubberBearing => 1.0,
            Self::SingleFrictionPendulum => 0.5,
            Self::DoubleFrictionPendulum => 0.7,
            Self::TripleFrictionPendulum => 0.9,
            Self::SlidingBearing => 0.3,
            Self::ElastomericBearing => 0.6,
        }
    }
}

// ============================================================================
// LEAD RUBBER BEARING (LRB)
// ============================================================================

/// Lead rubber bearing parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeadRubberBearing {
    /// Outer diameter (mm)
    pub outer_diameter: f64,
    /// Lead core diameter (mm)
    pub lead_diameter: f64,
    /// Total rubber thickness (mm)
    pub total_rubber_thickness: f64,
    /// Individual rubber layer thickness (mm)
    pub rubber_layer_thickness: f64,
    /// Steel shim thickness (mm)
    pub steel_shim_thickness: f64,
    /// Rubber shear modulus (MPa)
    pub rubber_modulus: f64,
    /// Lead yield stress (MPa)
    pub lead_yield_stress: f64,
    /// Cover rubber thickness (mm)
    pub cover_rubber: f64,
}

impl LeadRubberBearing {
    /// Create typical LRB
    pub fn typical(outer_diameter: f64, lead_diameter: f64) -> Self {
        Self {
            outer_diameter,
            lead_diameter,
            total_rubber_thickness: 150.0,
            rubber_layer_thickness: 10.0,
            steel_shim_thickness: 3.0,
            rubber_modulus: 0.6,
            lead_yield_stress: 10.5,
            cover_rubber: 10.0,
        }
    }
    
    /// Rubber area (mm²)
    pub fn rubber_area(&self) -> f64 {
        PI / 4.0 * (self.outer_diameter.powi(2) - self.lead_diameter.powi(2))
    }
    
    /// Lead area (mm²)
    pub fn lead_area(&self) -> f64 {
        PI / 4.0 * self.lead_diameter.powi(2)
    }
    
    /// Shape factor (individual layer)
    pub fn shape_factor(&self) -> f64 {
        let loaded_area = PI / 4.0 * self.outer_diameter.powi(2);
        let perimeter = PI * self.outer_diameter;
        loaded_area / (perimeter * self.rubber_layer_thickness)
    }
    
    /// Rubber stiffness (kN/mm)
    pub fn rubber_stiffness(&self) -> f64 {
        self.rubber_modulus * self.rubber_area() / self.total_rubber_thickness / 1000.0
    }
    
    /// Lead yield force (kN)
    pub fn lead_yield_force(&self) -> f64 {
        self.lead_yield_stress * self.lead_area() / 1000.0
    }
    
    /// Post-yield stiffness (kN/mm)
    pub fn post_yield_stiffness(&self) -> f64 {
        self.rubber_stiffness() // Lead contributes negligibly after yielding
    }
    
    /// Elastic stiffness (kN/mm)
    pub fn elastic_stiffness(&self) -> f64 {
        // Lead shear modulus ~130 GPa before yielding
        let lead_g = 130000.0; // MPa
        let lead_stiffness = lead_g * self.lead_area() / self.total_rubber_thickness / 1000.0;
        self.rubber_stiffness() + lead_stiffness
    }
    
    /// Effective stiffness at displacement (kN/mm)
    pub fn effective_stiffness(&self, displacement: f64) -> f64 {
        if displacement < 1.0 {
            return self.elastic_stiffness();
        }
        
        let qd = self.lead_yield_force();
        let k2 = self.post_yield_stiffness();
        
        k2 + qd / displacement
    }
    
    /// Equivalent damping ratio at displacement
    pub fn equivalent_damping(&self, displacement: f64) -> f64 {
        if displacement < 1.0 {
            return 0.05;
        }
        
        let qd = self.lead_yield_force();
        let k_eff = self.effective_stiffness(displacement);
        let dy = qd / (self.elastic_stiffness() - self.post_yield_stiffness());
        
        // Energy dissipated per cycle
        let ed = 4.0 * qd * (displacement - dy);
        
        // Equivalent viscous damping
        ed / (2.0 * PI * k_eff * displacement.powi(2))
    }
    
    /// Hysteresis energy per cycle (kN·mm)
    pub fn hysteresis_energy(&self, displacement: f64) -> f64 {
        let qd = self.lead_yield_force();
        let dy = qd / (self.elastic_stiffness() - self.post_yield_stiffness());
        
        4.0 * qd * (displacement - dy).max(0.0)
    }
    
    /// Vertical stiffness (kN/mm)
    pub fn vertical_stiffness(&self) -> f64 {
        let s = self.shape_factor();
        let ec = 3.0 * self.rubber_modulus * (1.0 + 2.0 * s.powi(2)); // Compression modulus
        
        ec * self.rubber_area() / self.total_rubber_thickness / 1000.0
    }
    
    /// Critical buckling load (kN)
    pub fn critical_buckling_load(&self) -> f64 {
        let h = self.total_rubber_thickness + 
            (self.total_rubber_thickness / self.rubber_layer_thickness) as f64 * self.steel_shim_thickness;
        let i = PI / 64.0 * self.outer_diameter.powi(4);
        let area = PI / 4.0 * self.outer_diameter.powi(2);
        
        // Simplified Haringx formula
        let pe = PI.powi(2) * 200000.0 * i / h.powi(2) / 1000.0; // Euler load
        let ps = self.rubber_modulus * area / 1000.0; // Shear load
        
        pe * ps / (pe + ps)
    }
}

// ============================================================================
// FRICTION PENDULUM SYSTEM (FPS)
// ============================================================================

/// Single friction pendulum bearing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrictionPendulum {
    /// Radius of curvature (mm)
    pub radius: f64,
    /// Slider diameter (mm)
    pub slider_diameter: f64,
    /// Friction coefficient (slow)
    pub friction_slow: f64,
    /// Friction coefficient (fast)
    pub friction_fast: f64,
    /// Rate parameter (1/mm/s)
    pub rate_parameter: f64,
    /// Maximum displacement capacity (mm)
    pub displacement_capacity: f64,
}

impl FrictionPendulum {
    /// Create typical FPS
    pub fn typical(radius: f64, slider_diameter: f64) -> Self {
        Self {
            radius,
            slider_diameter,
            friction_slow: 0.03,
            friction_fast: 0.08,
            rate_parameter: 0.015,
            displacement_capacity: radius * 0.3,
        }
    }
    
    /// Velocity-dependent friction coefficient
    pub fn friction_coefficient(&self, velocity: f64) -> f64 {
        self.friction_fast - (self.friction_fast - self.friction_slow) 
            * (-self.rate_parameter * velocity.abs()).exp()
    }
    
    /// Pendulum stiffness (kN/mm)
    pub fn pendulum_stiffness(&self, vertical_load: f64) -> f64 {
        vertical_load / self.radius
    }
    
    /// Characteristic strength (kN)
    pub fn characteristic_strength(&self, vertical_load: f64, velocity: f64) -> f64 {
        let mu = self.friction_coefficient(velocity);
        mu * vertical_load
    }
    
    /// Effective stiffness at displacement (kN/mm)
    pub fn effective_stiffness(&self, vertical_load: f64, displacement: f64, velocity: f64) -> f64 {
        if displacement < 1.0 {
            return vertical_load / self.radius + self.characteristic_strength(vertical_load, velocity);
        }
        
        let kp = self.pendulum_stiffness(vertical_load);
        let qd = self.characteristic_strength(vertical_load, velocity);
        
        kp + qd / displacement
    }
    
    /// Equivalent damping ratio
    pub fn equivalent_damping(&self, vertical_load: f64, displacement: f64, velocity: f64) -> f64 {
        if displacement < 1.0 {
            return 0.05;
        }
        
        let mu = self.friction_coefficient(velocity);
        let k_eff = self.effective_stiffness(vertical_load, displacement, velocity);
        
        // Energy dissipated
        let ed = 4.0 * mu * vertical_load * displacement;
        
        ed / (2.0 * PI * k_eff * displacement.powi(2))
    }
    
    /// Effective period (s)
    pub fn effective_period(&self, mass: f64, displacement: f64, velocity: f64) -> f64 {
        let k_eff = self.effective_stiffness(mass * 9.81, displacement, velocity);
        2.0 * PI * (mass / k_eff).sqrt()
    }
    
    /// Restoring force at displacement (kN)
    pub fn restoring_force(&self, vertical_load: f64, displacement: f64, velocity: f64) -> f64 {
        let kp = self.pendulum_stiffness(vertical_load);
        let qd = self.characteristic_strength(vertical_load, velocity);
        
        kp * displacement + qd * displacement.signum()
    }
    
    /// Uplift displacement (mm)
    pub fn uplift_displacement(&self) -> f64 {
        // Geometric uplift at slider edge
        let a = self.slider_diameter / 2.0;
        self.radius - (self.radius.powi(2) - a.powi(2)).sqrt()
    }
}

/// Triple friction pendulum bearing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TripleFrictionPendulum {
    /// Outer radius of curvature (mm)
    pub outer_radius: f64,
    /// Inner radius of curvature (mm)
    pub inner_radius: f64,
    /// Outer friction coefficient
    pub outer_friction: f64,
    /// Inner friction coefficient
    pub inner_friction: f64,
    /// Outer displacement capacity (mm)
    pub outer_capacity: f64,
    /// Inner displacement capacity (mm)
    pub inner_capacity: f64,
}

impl TripleFrictionPendulum {
    /// Create typical TFP
    pub fn typical() -> Self {
        Self {
            outer_radius: 2200.0,
            inner_radius: 350.0,
            outer_friction: 0.02,
            inner_friction: 0.06,
            outer_capacity: 400.0,
            inner_capacity: 100.0,
        }
    }
    
    /// Stage 1: Sliding on inner surfaces
    pub fn stage1_stiffness(&self, vertical_load: f64) -> f64 {
        vertical_load / (2.0 * self.inner_radius)
    }
    
    /// Stage 2: Combined sliding
    pub fn stage2_stiffness(&self, vertical_load: f64) -> f64 {
        vertical_load / (self.inner_radius + self.outer_radius)
    }
    
    /// Stage 3: Sliding on outer surfaces
    pub fn stage3_stiffness(&self, vertical_load: f64) -> f64 {
        vertical_load / (2.0 * self.outer_radius)
    }
    
    /// Transition displacements
    pub fn transition_displacements(&self, vertical_load: f64) -> (f64, f64) {
        let d1 = (self.inner_friction - self.outer_friction) * vertical_load 
            / self.stage1_stiffness(vertical_load);
        let d2 = d1 + (self.outer_friction - self.inner_friction) * vertical_load 
            / self.stage2_stiffness(vertical_load).abs();
        (d1.abs(), d2.abs())
    }
    
    /// Effective stiffness
    pub fn effective_stiffness(&self, vertical_load: f64, displacement: f64) -> f64 {
        let (d1, d2) = self.transition_displacements(vertical_load);
        
        if displacement <= d1 {
            // Stage 1
            self.stage1_stiffness(vertical_load) 
                + self.inner_friction * vertical_load / displacement.max(1.0)
        } else if displacement <= d2 {
            // Stage 2
            self.stage2_stiffness(vertical_load)
                + ((self.inner_friction + self.outer_friction) / 2.0) * vertical_load / displacement
        } else {
            // Stage 3
            self.stage3_stiffness(vertical_load)
                + self.outer_friction * vertical_load / displacement
        }
    }
    
    /// Total displacement capacity
    pub fn total_capacity(&self) -> f64 {
        2.0 * self.outer_capacity + 2.0 * self.inner_capacity
    }
}

// ============================================================================
// HIGH DAMPING RUBBER BEARING (HDRB)
// ============================================================================

/// High damping rubber bearing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighDampingRubberBearing {
    /// Outer diameter (mm)
    pub outer_diameter: f64,
    /// Inner hole diameter (mm)
    pub inner_diameter: f64,
    /// Total rubber thickness (mm)
    pub total_rubber_thickness: f64,
    /// Rubber layer thickness (mm)
    pub rubber_layer_thickness: f64,
    /// Shear modulus at 100% strain (MPa)
    pub g100: f64,
    /// Equivalent damping ratio
    pub equivalent_damping: f64,
}

impl HighDampingRubberBearing {
    /// Create typical HDRB
    pub fn typical(diameter: f64) -> Self {
        Self {
            outer_diameter: diameter,
            inner_diameter: 0.0,
            total_rubber_thickness: 150.0,
            rubber_layer_thickness: 10.0,
            g100: 0.6,
            equivalent_damping: 0.15,
        }
    }
    
    /// Bonded rubber area (mm²)
    pub fn rubber_area(&self) -> f64 {
        PI / 4.0 * (self.outer_diameter.powi(2) - self.inner_diameter.powi(2))
    }
    
    /// Shape factor
    pub fn shape_factor(&self) -> f64 {
        (self.outer_diameter - self.inner_diameter) / (4.0 * self.rubber_layer_thickness)
    }
    
    /// Strain-dependent shear modulus
    pub fn shear_modulus(&self, shear_strain: f64) -> f64 {
        // Polynomial fit for typical HDRB
        let gamma = shear_strain.min(3.0);
        self.g100 * (1.4 - 0.5 * gamma + 0.1 * gamma.powi(2))
    }
    
    /// Horizontal stiffness at strain (kN/mm)
    pub fn horizontal_stiffness(&self, shear_strain: f64) -> f64 {
        let g = self.shear_modulus(shear_strain);
        g * self.rubber_area() / self.total_rubber_thickness / 1000.0
    }
    
    /// Strain-dependent damping ratio
    pub fn damping_ratio(&self, shear_strain: f64) -> f64 {
        // Peak damping at around 50% strain
        let gamma = shear_strain.min(3.0);
        self.equivalent_damping * (1.0 + 0.5 * gamma - 0.3 * gamma.powi(2)).max(0.0)
    }
    
    /// Effective stiffness at displacement (kN/mm)
    pub fn effective_stiffness(&self, displacement: f64) -> f64 {
        let strain = displacement / self.total_rubber_thickness;
        self.horizontal_stiffness(strain)
    }
    
    /// Vertical stiffness (kN/mm)
    pub fn vertical_stiffness(&self) -> f64 {
        let s = self.shape_factor();
        let ec = 3.0 * self.g100 * (1.0 + 2.0 * s.powi(2));
        ec * self.rubber_area() / self.total_rubber_thickness / 1000.0
    }
}

// ============================================================================
// VISCOUS DAMPER
// ============================================================================

/// Viscous damper parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViscousDamper {
    /// Damping coefficient C (kN·s/mm for α=1)
    pub damping_coefficient: f64,
    /// Velocity exponent α
    pub velocity_exponent: f64,
    /// Maximum stroke (mm)
    pub max_stroke: f64,
    /// Maximum velocity (mm/s)
    pub max_velocity: f64,
    /// Maximum force capacity (kN)
    pub max_force: f64,
}

impl ViscousDamper {
    /// Create linear viscous damper
    pub fn linear(c: f64, stroke: f64) -> Self {
        Self {
            damping_coefficient: c,
            velocity_exponent: 1.0,
            max_stroke: stroke,
            max_velocity: 1000.0,
            max_force: c * 1000.0,
        }
    }
    
    /// Create nonlinear viscous damper
    pub fn nonlinear(c: f64, alpha: f64, stroke: f64) -> Self {
        Self {
            damping_coefficient: c,
            velocity_exponent: alpha,
            max_stroke: stroke,
            max_velocity: 1000.0,
            max_force: c * 1000.0_f64.powf(alpha),
        }
    }
    
    /// Damper force at velocity (kN)
    pub fn force(&self, velocity: f64) -> f64 {
        let f = self.damping_coefficient * velocity.abs().powf(self.velocity_exponent);
        f.min(self.max_force) * velocity.signum()
    }
    
    /// Energy dissipated per cycle (kN·mm)
    pub fn energy_per_cycle(&self, amplitude: f64, frequency: f64) -> f64 {
        let omega = 2.0 * PI * frequency;
        let _v_max = omega * amplitude;
        
        // Lambda factor for nonlinear damper
        let lambda = gamma_function(1.0 + self.velocity_exponent / 2.0).powi(2) 
            / gamma_function(2.0 + self.velocity_exponent) * 4.0;
        
        lambda * self.damping_coefficient * omega.powf(self.velocity_exponent) 
            * amplitude.powf(1.0 + self.velocity_exponent)
    }
    
    /// Equivalent viscous damping ratio
    pub fn equivalent_damping(&self, mass: f64, stiffness: f64, amplitude: f64) -> f64 {
        let omega = (stiffness / mass).sqrt();
        let ed = self.energy_per_cycle(amplitude, omega / (2.0 * PI));
        let es = 0.5 * stiffness * amplitude.powi(2);
        
        ed / (4.0 * PI * es)
    }
}

// ============================================================================
// METALLIC YIELD DAMPER
// ============================================================================

/// Metallic yield damper type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum MetallicDamperType {
    /// ADAS (Added Damping And Stiffness)
    ADAS,
    /// TADAS (Triangular ADAS)
    TADAS,
    /// BRB (Buckling Restrained Brace)
    BRB,
    /// Steel shear panel
    ShearPanel,
    /// Lead extrusion damper
    LeadExtrusion,
}

/// Metallic yield damper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetallicYieldDamper {
    /// Damper type
    pub damper_type: MetallicDamperType,
    /// Yield force (kN)
    pub yield_force: f64,
    /// Elastic stiffness (kN/mm)
    pub elastic_stiffness: f64,
    /// Post-yield stiffness ratio
    pub alpha: f64,
    /// Ultimate displacement (mm)
    pub ultimate_displacement: f64,
}

impl MetallicYieldDamper {
    /// Create BRB damper
    pub fn brb(yield_force: f64, core_length: f64, core_area: f64, e_steel: f64) -> Self {
        let elastic_stiffness = e_steel * core_area / core_length / 1000.0; // kN/mm
        
        Self {
            damper_type: MetallicDamperType::BRB,
            yield_force,
            elastic_stiffness,
            alpha: 0.03,
            ultimate_displacement: core_length * 0.02, // 2% strain
        }
    }
    
    /// Create ADAS damper
    pub fn adas(n_plates: usize, b: f64, h: f64, t: f64, fy: f64) -> Self {
        // X-shaped plate
        let mp = fy * b * t.powi(2) / 4.0 / 1000.0; // Plastic moment (kN·mm)
        let yield_force = 4.0 * n_plates as f64 * mp / h;
        let elastic_stiffness = n_plates as f64 * 200000.0 * b * t.powi(3) / (6.0 * h.powi(3)) / 1000.0;
        
        Self {
            damper_type: MetallicDamperType::ADAS,
            yield_force,
            elastic_stiffness,
            alpha: 0.05,
            ultimate_displacement: h * 0.1, // 10% drift
        }
    }
    
    /// Yield displacement (mm)
    pub fn yield_displacement(&self) -> f64 {
        self.yield_force / self.elastic_stiffness
    }
    
    /// Force at displacement (kN) - bilinear model
    pub fn force(&self, displacement: f64) -> f64 {
        let dy = self.yield_displacement();
        
        if displacement.abs() <= dy {
            self.elastic_stiffness * displacement
        } else {
            let fy = self.yield_force * displacement.signum();
            let post_yield_stiffness = self.alpha * self.elastic_stiffness;
            fy + post_yield_stiffness * (displacement - dy * displacement.signum())
        }
    }
    
    /// Post-yield stiffness (kN/mm)
    pub fn post_yield_stiffness(&self) -> f64 {
        self.alpha * self.elastic_stiffness
    }
    
    /// Effective stiffness at displacement (kN/mm)
    pub fn effective_stiffness(&self, displacement: f64) -> f64 {
        if displacement.abs() < 1.0 {
            return self.elastic_stiffness;
        }
        
        self.force(displacement).abs() / displacement.abs()
    }
    
    /// Energy dissipated per cycle (kN·mm)
    pub fn energy_per_cycle(&self, amplitude: f64) -> f64 {
        let dy = self.yield_displacement();
        
        if amplitude <= dy {
            0.0
        } else {
            4.0 * self.yield_force * (amplitude - dy)
        }
    }
    
    /// Equivalent damping ratio
    pub fn equivalent_damping(&self, amplitude: f64) -> f64 {
        let k_eff = self.effective_stiffness(amplitude);
        let ed = self.energy_per_cycle(amplitude);
        
        ed / (2.0 * PI * k_eff * amplitude.powi(2))
    }
    
    /// Ductility ratio
    pub fn ductility(&self, displacement: f64) -> f64 {
        displacement / self.yield_displacement()
    }
}

// ============================================================================
// BASE ISOLATION SYSTEM DESIGN
// ============================================================================

/// ASCE 7 site class
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SiteClass {
    A, // Hard rock
    B, // Rock
    C, // Dense soil
    D, // Stiff soil
    E, // Soft clay
    F, // Special
}

/// Base isolation system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BaseIsolationSystem {
    /// Total seismic weight (kN)
    pub seismic_weight: f64,
    /// Number of isolators
    pub n_isolators: usize,
    /// Target isolation period (s)
    pub target_period: f64,
    /// Effective damping ratio
    pub effective_damping: f64,
    /// Spectral acceleration Sds
    pub sds: f64,
    /// Spectral acceleration Sd1
    pub sd1: f64,
}

impl BaseIsolationSystem {
    pub fn new(seismic_weight: f64, n_isolators: usize) -> Self {
        Self {
            seismic_weight,
            n_isolators,
            target_period: 2.5,
            effective_damping: 0.15,
            sds: 1.0,
            sd1: 0.6,
        }
    }
    
    /// Design displacement Dd (mm) - ASCE 7-22
    pub fn design_displacement(&self) -> f64 {
        let bd = self.damping_coefficient();
        
        // Dd = g·Sd1·Td / (4π²·Bd)
        9810.0 * self.sd1 * self.target_period / (4.0 * PI.powi(2) * bd)
    }
    
    /// Maximum displacement Dm (mm)
    pub fn maximum_displacement(&self) -> f64 {
        let bd = self.damping_coefficient();
        let tm = 1.5 * self.target_period; // MCE period
        
        9810.0 * self.sd1 * tm / (4.0 * PI.powi(2) * bd) * 1.5
    }
    
    /// Total displacement DTd (mm) including torsion
    pub fn total_displacement(&self, eccentricity: f64, plan_dimension: f64) -> f64 {
        let dd = self.design_displacement();
        let y = plan_dimension / 2.0;
        let pt = (12.0 * eccentricity.powi(2)).sqrt();
        
        dd * (1.0 + y * 12.0 * eccentricity / (plan_dimension.powi(2) + pt.powi(2)))
    }
    
    /// Damping coefficient Bd (ASCE 7 Table 17.5-1)
    pub fn damping_coefficient(&self) -> f64 {
        let beta = self.effective_damping;
        
        if beta <= 0.02 { 0.80 }
        else if beta <= 0.05 { 0.80 + (beta - 0.02) * (1.0 - 0.80) / 0.03 }
        else if beta <= 0.10 { 1.00 + (beta - 0.05) * (1.20 - 1.00) / 0.05 }
        else if beta <= 0.20 { 1.20 + (beta - 0.10) * (1.50 - 1.20) / 0.10 }
        else if beta <= 0.30 { 1.50 + (beta - 0.20) * (1.70 - 1.50) / 0.10 }
        else if beta <= 0.40 { 1.70 + (beta - 0.30) * (1.90 - 1.70) / 0.10 }
        else { 1.90 + (beta - 0.40) * (2.00 - 1.90) / 0.10 }
    }
    
    /// Required total stiffness (kN/mm)
    pub fn required_stiffness(&self) -> f64 {
        let mass = self.seismic_weight / 9.81;
        let omega = 2.0 * PI / self.target_period;
        
        mass * omega.powi(2)
    }
    
    /// Stiffness per isolator (kN/mm)
    pub fn stiffness_per_isolator(&self) -> f64 {
        self.required_stiffness() / self.n_isolators as f64
    }
    
    /// Design base shear Vb (kN)
    pub fn design_base_shear(&self) -> f64 {
        let dd = self.design_displacement();
        let k_eff = self.required_stiffness();
        
        k_eff * dd
    }
    
    /// Load per isolator (kN)
    pub fn load_per_isolator(&self) -> f64 {
        self.seismic_weight / self.n_isolators as f64
    }
    
    /// Verify period
    pub fn verify_period(&self, actual_stiffness: f64) -> bool {
        let mass = self.seismic_weight / 9.81;
        let actual_period = 2.0 * PI * (mass / actual_stiffness).sqrt();
        
        (actual_period - self.target_period).abs() / self.target_period < 0.1
    }
}

/// Isolation system design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IsolationDesignResult {
    /// Design displacement (mm)
    pub design_displacement: f64,
    /// Maximum displacement (mm)
    pub maximum_displacement: f64,
    /// Total displacement with torsion (mm)
    pub total_displacement: f64,
    /// Design base shear (kN)
    pub design_base_shear: f64,
    /// Required stiffness per isolator (kN/mm)
    pub stiffness_per_isolator: f64,
    /// Vertical load per isolator (kN)
    pub load_per_isolator: f64,
    /// Isolation period (s)
    pub isolation_period: f64,
}

impl IsolationDesignResult {
    /// Design the isolation system
    pub fn design(system: &BaseIsolationSystem, eccentricity: f64, plan_dimension: f64) -> Self {
        Self {
            design_displacement: system.design_displacement(),
            maximum_displacement: system.maximum_displacement(),
            total_displacement: system.total_displacement(eccentricity, plan_dimension),
            design_base_shear: system.design_base_shear(),
            stiffness_per_isolator: system.stiffness_per_isolator(),
            load_per_isolator: system.load_per_isolator(),
            isolation_period: system.target_period,
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
    fn test_lrb_properties() {
        let lrb = LeadRubberBearing::typical(600.0, 100.0);
        
        assert!(lrb.rubber_area() > 0.0);
        assert!(lrb.lead_area() > 0.0);
        assert!(lrb.shape_factor() > 0.0);
    }

    #[test]
    fn test_lrb_stiffness() {
        let lrb = LeadRubberBearing::typical(600.0, 100.0);
        
        let k_elastic = lrb.elastic_stiffness();
        let k_eff_100 = lrb.effective_stiffness(100.0);
        
        assert!(k_elastic > k_eff_100);
    }

    #[test]
    fn test_lrb_damping() {
        let lrb = LeadRubberBearing::typical(600.0, 100.0);
        
        let damping = lrb.equivalent_damping(100.0);
        assert!(damping > 0.1);
        assert!(damping < 0.5);
    }

    #[test]
    fn test_fps_properties() {
        let fps = FrictionPendulum::typical(2000.0, 400.0);
        let vertical_load = 1000.0;
        
        let k_eff = fps.effective_stiffness(vertical_load, 100.0, 500.0);
        assert!(k_eff > 0.0);
    }

    #[test]
    fn test_fps_velocity_dependent_friction() {
        let fps = FrictionPendulum::typical(2000.0, 400.0);
        
        let mu_slow = fps.friction_coefficient(1.0);
        let mu_fast = fps.friction_coefficient(1000.0);
        
        assert!(mu_fast > mu_slow);
    }

    #[test]
    fn test_tfp_stages() {
        let tfp = TripleFrictionPendulum::typical();
        let vertical_load = 1000.0;
        
        let k1 = tfp.stage1_stiffness(vertical_load);
        let k2 = tfp.stage2_stiffness(vertical_load);
        let k3 = tfp.stage3_stiffness(vertical_load);
        
        assert!(k1 > k2);
        assert!(k2 > k3);
    }

    #[test]
    fn test_hdrb() {
        let hdrb = HighDampingRubberBearing::typical(500.0);
        
        let g_50 = hdrb.shear_modulus(0.5);
        let g_150 = hdrb.shear_modulus(1.5);
        
        // Modulus typically decreases with strain
        assert!(g_50 != g_150);
    }

    #[test]
    fn test_viscous_damper() {
        let damper = ViscousDamper::linear(1.0, 100.0);
        
        let f100 = damper.force(100.0);
        let f200 = damper.force(200.0);
        
        assert!((f200 - 2.0 * f100).abs() < 0.01);
    }

    #[test]
    fn test_nonlinear_viscous_damper() {
        let damper = ViscousDamper::nonlinear(10.0, 0.3, 100.0);
        
        let f100 = damper.force(100.0);
        let f200 = damper.force(200.0);
        
        // Nonlinear: doubling velocity doesn't double force
        assert!(f200 < 2.0 * f100);
    }

    #[test]
    fn test_brb_damper() {
        let brb = MetallicYieldDamper::brb(500.0, 3000.0, 2000.0, 200000.0);
        
        assert!(brb.yield_displacement() > 0.0);
        assert!(brb.post_yield_stiffness() < brb.elastic_stiffness);
    }

    #[test]
    fn test_metallic_damper_hysteresis() {
        let damper = MetallicYieldDamper::brb(500.0, 3000.0, 2000.0, 200000.0);
        
        let dy = damper.yield_displacement();
        let energy_elastic = damper.energy_per_cycle(dy * 0.5);
        let energy_plastic = damper.energy_per_cycle(dy * 3.0);
        
        assert_eq!(energy_elastic, 0.0);
        assert!(energy_plastic > 0.0);
    }

    #[test]
    fn test_base_isolation_system() {
        let mut system = BaseIsolationSystem::new(50000.0, 20);
        system.sds = 1.0;
        system.sd1 = 0.6;
        
        let dd = system.design_displacement();
        assert!(dd > 0.0);
        
        let vb = system.design_base_shear();
        assert!(vb > 0.0);
    }

    #[test]
    fn test_damping_coefficient() {
        let mut system = BaseIsolationSystem::new(50000.0, 20);
        
        system.effective_damping = 0.05;
        let bd_5 = system.damping_coefficient();
        
        system.effective_damping = 0.20;
        let bd_20 = system.damping_coefficient();
        
        assert!(bd_20 > bd_5);
    }

    #[test]
    fn test_isolation_design() {
        let system = BaseIsolationSystem::new(50000.0, 20);
        let result = IsolationDesignResult::design(&system, 0.05, 30000.0);
        
        assert!(result.design_displacement > 0.0);
        assert!(result.total_displacement >= result.design_displacement);
        assert!(result.stiffness_per_isolator > 0.0);
    }

    #[test]
    fn test_lrb_buckling() {
        let lrb = LeadRubberBearing::typical(600.0, 100.0);
        
        let pcr = lrb.critical_buckling_load();
        assert!(pcr > 0.0); // Should be positive
    }
}
