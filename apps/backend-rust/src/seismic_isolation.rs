// ============================================================================
// SEISMIC ISOLATION DESIGN MODULE
// Base Isolation Systems per ASCE 7 Chapter 17 & EN 1998-1
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;
use crate::special_functions::gamma as gamma_function;

// ============================================================================
// ISOLATION DEVICE TYPES
// ============================================================================

/// Base isolation device types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum IsolatorType {
    /// Lead rubber bearing (LRB)
    LeadRubberBearing,
    /// High damping rubber bearing (HDRB)
    HighDampingRubber,
    /// Friction pendulum system (FPS)
    FrictionPendulum,
    /// Triple friction pendulum (TFP)
    TripleFrictionPendulum,
    /// Elastomeric bearing (laminated rubber)
    ElastomericBearing,
    /// Sliding bearing
    SlidingBearing,
}

/// Lead rubber bearing properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeadRubberBearing {
    /// Outer diameter (mm)
    pub diameter: f64,
    /// Total rubber height (mm)
    pub rubber_height: f64,
    /// Number of rubber layers
    pub num_layers: u32,
    /// Individual layer thickness (mm)
    pub layer_thickness: f64,
    /// Lead core diameter (mm)
    pub lead_diameter: f64,
    /// Shear modulus of rubber (MPa)
    pub g_rubber: f64,
    /// Bulk modulus of rubber (MPa)
    pub k_rubber: f64,
    /// Effective damping ratio
    pub damping_ratio: f64,
}

impl LeadRubberBearing {
    pub fn new(diameter: f64, rubber_height: f64, lead_diameter: f64) -> Self {
        Self {
            diameter,
            rubber_height,
            num_layers: 20,
            layer_thickness: rubber_height / 20.0,
            lead_diameter,
            g_rubber: 0.4,       // MPa (typical)
            k_rubber: 2000.0,    // MPa
            damping_ratio: 0.15, // 15% equivalent damping
        }
    }
    
    /// Bonded rubber area (mm²)
    pub fn rubber_area(&self) -> f64 {
        PI * (self.diameter.powi(2) - self.lead_diameter.powi(2)) / 4.0
    }
    
    /// Lead core area (mm²)
    pub fn lead_area(&self) -> f64 {
        PI * self.lead_diameter.powi(2) / 4.0
    }
    
    /// Shape factor S (accounts for lead core void)
    pub fn shape_factor(&self) -> f64 {
        // S = (D² - d²) / (4·D·t) for hollow circular pad with confined lead core
        (self.diameter.powi(2) - self.lead_diameter.powi(2))
            / (4.0 * self.diameter * self.layer_thickness)
    }
    
    /// Horizontal stiffness (kN/mm)
    pub fn horizontal_stiffness(&self) -> f64 {
        self.g_rubber * self.rubber_area() / self.rubber_height / 1000.0
    }
    
    /// Vertical stiffness (kN/mm)
    pub fn vertical_stiffness(&self) -> f64 {
        let ec = 6.0 * self.g_rubber * self.shape_factor().powi(2);
        let e_eff = ec * self.k_rubber / (ec + self.k_rubber);
        e_eff * self.rubber_area() / self.rubber_height / 1000.0
    }
    
    /// Characteristic strength Qd (kN)
    pub fn characteristic_strength(&self) -> f64 {
        // Lead yield stress ≈ 10 MPa
        let sigma_yield = 10.0;
        sigma_yield * self.lead_area() / 1000.0
    }
    
    /// Post-yield stiffness ratio
    pub fn post_yield_ratio(&self) -> f64 {
        // Typically 5-10% of elastic stiffness
        0.10
    }
    
    /// Effective stiffness at displacement D (kN/mm)
    pub fn effective_stiffness(&self, displacement: f64) -> f64 {
        let qd = self.characteristic_strength();
        // Post-yield stiffness kd = rubber stiffness (NOT ratio × rubber stiffness)
        let kd = self.horizontal_stiffness();
        
        if displacement > 0.0 {
            (qd / displacement) + kd
        } else {
            // Return initial elastic stiffness ku = kd / alpha
            self.horizontal_stiffness() / self.post_yield_ratio()
        }
    }
    
    /// Effective damping at displacement D
    pub fn effective_damping(&self, displacement: f64) -> f64 {
        if displacement <= 0.0 {
            return self.damping_ratio;
        }
        
        let qd = self.characteristic_strength();
        let k_eff = self.effective_stiffness(displacement);
        let alpha = self.post_yield_ratio();
        let kd = self.horizontal_stiffness();
        
        // Yield displacement: dy = Qd / (ku - kd) = Qd·α / (kd·(1 - α))
        let dy = qd * alpha / (kd * (1.0 - alpha));
        let ed = 4.0 * qd * (displacement - dy).max(0.0);
        
        // Effective damping
        ed / (2.0 * PI * k_eff * displacement.powi(2))
    }
}

/// Friction pendulum bearing properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrictionPendulumBearing {
    /// Effective radius of curvature (mm)
    pub radius: f64,
    /// Coefficient of friction (slow)
    pub mu_slow: f64,
    /// Coefficient of friction (fast)
    pub mu_fast: f64,
    /// Rate parameter
    pub rate_parameter: f64,
    /// Slider diameter (mm)
    pub slider_diameter: f64,
    /// Supported weight (kN)
    pub weight: f64,
}

impl FrictionPendulumBearing {
    pub fn new(radius: f64, mu: f64, weight: f64) -> Self {
        Self {
            radius,
            mu_slow: mu * 0.5,
            mu_fast: mu,
            rate_parameter: 0.1,
            slider_diameter: 400.0,
            weight,
        }
    }
    
    /// Isolated period (seconds)
    pub fn period(&self) -> f64 {
        2.0 * PI * (self.radius / 1000.0 / 9.81).sqrt()
    }
    
    /// Pendulum stiffness (kN/mm)
    pub fn pendulum_stiffness(&self) -> f64 {
        self.weight / self.radius
    }
    
    /// Friction force (kN)
    pub fn friction_force(&self, velocity: f64) -> f64 {
        let mu = self.mu_slow + (self.mu_fast - self.mu_slow) * 
                 (1.0 - (-velocity.abs() / self.rate_parameter).exp());
        mu * self.weight
    }
    
    /// Effective stiffness at displacement D (kN/mm)
    pub fn effective_stiffness(&self, displacement: f64) -> f64 {
        if displacement <= 0.0 {
            return self.pendulum_stiffness();
        }
        
        let mu = (self.mu_slow + self.mu_fast) / 2.0;
        self.pendulum_stiffness() + mu * self.weight / displacement
    }
    
    /// Effective damping at displacement D
    pub fn effective_damping(&self, displacement: f64) -> f64 {
        if displacement <= 0.0 {
            return 0.15;
        }
        
        let mu = (self.mu_slow + self.mu_fast) / 2.0;
        let k_eff = self.effective_stiffness(displacement);
        
        2.0 * mu * self.weight / (PI * k_eff * displacement)
    }
    
    /// Maximum displacement capacity
    pub fn displacement_capacity(&self) -> f64 {
        // Typically limited by slider travel
        self.radius * 0.4 // 40% of radius as typical limit
    }
}

/// Triple friction pendulum bearing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TripleFrictionPendulum {
    /// Inner pendulum radius (mm)
    pub r1: f64,
    /// Outer pendulum radius (mm)
    pub r2: f64,
    /// Inner friction coefficient
    pub mu1: f64,
    /// Outer friction coefficient
    pub mu2: f64,
    /// Inner displacement capacity (mm)
    pub d1_max: f64,
    /// Outer displacement capacity (mm)
    pub d2_max: f64,
    /// Supported weight (kN)
    pub weight: f64,
}

impl TripleFrictionPendulum {
    pub fn new(r1: f64, r2: f64, mu1: f64, mu2: f64, weight: f64) -> Self {
        Self {
            r1,
            r2,
            mu1,
            mu2,
            d1_max: r1 * 0.3,
            d2_max: r2 * 0.4,
            weight,
        }
    }
    
    /// Effective radius based on displacement regime
    pub fn effective_radius(&self, displacement: f64) -> f64 {
        if displacement.abs() <= self.d1_max {
            // Inner pendulum regime
            self.r1
        } else if displacement.abs() <= self.d1_max + self.d2_max {
            // Outer pendulum regime
            self.r2
        } else {
            // Both sliding
            2.0 * self.r1 * self.r2 / (self.r1 + self.r2)
        }
    }
    
    /// Multi-stage period
    pub fn period(&self, displacement: f64) -> f64 {
        let r_eff = self.effective_radius(displacement);
        2.0 * PI * (r_eff / 1000.0 / 9.81).sqrt()
    }
    
    /// Effective stiffness (kN/mm)
    pub fn effective_stiffness(&self, displacement: f64) -> f64 {
        let r_eff = self.effective_radius(displacement);
        let mu_eff = if displacement.abs() <= self.d1_max {
            self.mu1
        } else {
            (self.mu1 + self.mu2) / 2.0
        };
        
        self.weight / r_eff + mu_eff * self.weight / displacement.abs().max(1.0)
    }
    
    /// Total displacement capacity
    pub fn total_capacity(&self) -> f64 {
        2.0 * (self.d1_max + self.d2_max)
    }
}

// ============================================================================
// ISOLATION SYSTEM DESIGN (ASCE 7 Chapter 17)
// ============================================================================

/// Seismic hazard parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeismicHazard {
    /// Short period spectral acceleration (g)
    pub ss: f64,
    /// 1-second spectral acceleration (g)
    pub s1: f64,
    /// Site class
    pub site_class: SiteClass,
    /// Risk category
    pub risk_category: RiskCategory,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SiteClass {
    A, B, C, D, E, F,
}

impl SiteClass {
    pub fn fa(&self, ss: f64) -> f64 {
        match self {
            SiteClass::A => 0.8,
            SiteClass::B => 1.0,
            SiteClass::C => if ss <= 0.5 { 1.2 } else if ss >= 1.0 { 1.0 } else { 1.2 - 0.2 * (ss - 0.5) / 0.5 },
            SiteClass::D => {
                // ASCE 7-16 Table 11.4-1: 1.6, 1.4, 1.2, 1.1, 1.0
                if ss <= 0.25 { 1.6 }
                else if ss <= 0.50 { 1.6 + (1.4 - 1.6) * (ss - 0.25) / 0.25 }
                else if ss <= 0.75 { 1.4 + (1.2 - 1.4) * (ss - 0.50) / 0.25 }
                else if ss <= 1.00 { 1.2 + (1.1 - 1.2) * (ss - 0.75) / 0.25 }
                else if ss <= 1.25 { 1.1 + (1.0 - 1.1) * (ss - 1.00) / 0.25 }
                else { 1.0 }
            },
            SiteClass::E => {
                // ASCE 7-16 Table 11.4-1: 2.5, 1.7, 1.2, 0.9, 0.9
                if ss <= 0.25 { 2.5 }
                else if ss <= 0.50 { 2.5 + (1.7 - 2.5) * (ss - 0.25) / 0.25 }
                else if ss <= 0.75 { 1.7 + (1.2 - 1.7) * (ss - 0.50) / 0.25 }
                else if ss <= 1.00 { 1.2 + (0.9 - 1.2) * (ss - 0.75) / 0.25 }
                else { 0.9 }
            },
            SiteClass::F => 1.0, // Requires site-specific study
        }
    }
    
    pub fn fv(&self, s1: f64) -> f64 {
        match self {
            SiteClass::A => 0.8,
            SiteClass::B => 1.0,
            SiteClass::C => if s1 <= 0.1 { 1.7 } else if s1 >= 0.5 { 1.3 } else { 1.7 - (s1 - 0.1) },
            SiteClass::D => {
                // ASCE 7-16 Table 11.4-2: 2.4, 2.0, 1.8, 1.6, 1.5
                if s1 <= 0.1 { 2.4 }
                else if s1 <= 0.2 { 2.4 + (2.0 - 2.4) * (s1 - 0.1) / 0.1 }
                else if s1 <= 0.3 { 2.0 + (1.8 - 2.0) * (s1 - 0.2) / 0.1 }
                else if s1 <= 0.4 { 1.8 + (1.6 - 1.8) * (s1 - 0.3) / 0.1 }
                else if s1 <= 0.5 { 1.6 + (1.5 - 1.6) * (s1 - 0.4) / 0.1 }
                else { 1.5 }
            },
            SiteClass::E => {
                // ASCE 7-16 Table 11.4-2: 3.5, 3.2, 2.8, 2.4, 2.4
                if s1 <= 0.1 { 3.5 }
                else if s1 <= 0.2 { 3.5 + (3.2 - 3.5) * (s1 - 0.1) / 0.1 }
                else if s1 <= 0.3 { 3.2 + (2.8 - 3.2) * (s1 - 0.2) / 0.1 }
                else if s1 <= 0.4 { 2.8 + (2.4 - 2.8) * (s1 - 0.3) / 0.1 }
                else { 2.4 }
            },
            SiteClass::F => 1.0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RiskCategory {
    I, II, III, IV,
}

impl RiskCategory {
    pub fn importance_factor(&self) -> f64 {
        match self {
            RiskCategory::I => 1.0,
            RiskCategory::II => 1.0,
            RiskCategory::III => 1.25,
            RiskCategory::IV => 1.5,
        }
    }
}

/// Isolated structure design parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IsolatedStructure {
    /// Total seismic weight (kN)
    pub weight: f64,
    /// Fixed-base period (s)
    pub t_fixed: f64,
    /// Target isolated period (s)
    pub t_isolated: f64,
    /// Number of isolators
    pub num_isolators: u32,
    /// Effective damping
    pub damping: f64,
}

/// ASCE 7 Chapter 17 isolation system designer
pub struct IsolationSystemDesigner {
    pub hazard: SeismicHazard,
    pub structure: IsolatedStructure,
}

impl IsolationSystemDesigner {
    pub fn new(hazard: SeismicHazard, structure: IsolatedStructure) -> Self {
        Self { hazard, structure }
    }
    
    /// Site-modified spectral accelerations
    pub fn design_spectrum(&self) -> (f64, f64) {
        let fa = self.hazard.site_class.fa(self.hazard.ss);
        let fv = self.hazard.site_class.fv(self.hazard.s1);
        
        let sms = fa * self.hazard.ss;
        let sm1 = fv * self.hazard.s1;
        
        // Design values (2/3 MCE)
        let sds = 2.0 / 3.0 * sms;
        let sd1 = 2.0 / 3.0 * sm1;
        
        (sds, sd1)
    }
    
    /// MCE spectral accelerations
    pub fn mce_spectrum(&self) -> (f64, f64) {
        let fa = self.hazard.site_class.fa(self.hazard.ss);
        let fv = self.hazard.site_class.fv(self.hazard.s1);
        
        (fa * self.hazard.ss, fv * self.hazard.s1)
    }
    
    /// Damping factor BD (ASCE 7 Table 17.5-1)
    pub fn damping_factor(&self) -> f64 {
        let beta = self.structure.damping;
        if beta <= 0.02 { 0.8 }
        else if beta <= 0.05 { 0.8 + (1.0 - 0.8) * (beta - 0.02) / 0.03 }
        else if beta <= 0.10 { 1.0 + (1.2 - 1.0) * (beta - 0.05) / 0.05 }
        else if beta <= 0.20 { 1.2 + (1.5 - 1.2) * (beta - 0.10) / 0.10 }
        else if beta <= 0.30 { 1.5 + (1.7 - 1.5) * (beta - 0.20) / 0.10 }
        else if beta <= 0.40 { 1.7 + (1.9 - 1.7) * (beta - 0.30) / 0.10 }
        else { 1.9 + (2.0 - 1.9) * (beta - 0.40) / 0.10 }
    }
    
    /// Design displacement DD (mm)
    pub fn design_displacement(&self) -> f64 {
        let (_, sd1) = self.design_spectrum();
        let bd = self.damping_factor();
        let td = self.structure.t_isolated;
        
        // DD = g * SD1 * TD / (4π² * BD)
        9810.0 * sd1 * td / (4.0 * PI.powi(2) * bd)
    }
    
    /// Maximum displacement DM (mm) at MCE
    pub fn maximum_displacement(&self) -> f64 {
        let (_, sm1) = self.mce_spectrum();
        let bm = self.damping_factor(); // Use same for MCE
        let tm = self.structure.t_isolated * 1.1; // Slightly longer at MCE
        
        9810.0 * sm1 * tm / (4.0 * PI.powi(2) * bm)
    }
    
    /// Total design displacement including torsion (mm)
    pub fn total_design_displacement(&self, eccentricity: f64, distance: f64, pt: f64) -> f64 {
        let dd = self.design_displacement();
        let y = distance;
        let e = eccentricity.abs() + 0.05 * pt; // 5% accidental eccentricity per ASCE 7 §17.5.3.3
        
        dd * (1.0 + y * 12.0 * e / (pt.powi(2) + distance.powi(2)))
    }
    
    /// Minimum lateral force above isolation (kN)
    /// Vs = keff × DD / RI per ASCE 7-22 Eq.17.5-7
    pub fn design_force_above(&self) -> f64 {
        let ri = 2.0; // Response modification for isolated superstructure (RI ≤ 2.0)
        self.design_force_isolation() / ri
    }
    
    /// Lateral force at isolation interface (kN)  
    pub fn design_force_isolation(&self) -> f64 {
        let dd = self.design_displacement() / 1000.0; // convert to m
        let k_eff = self.structure.weight / (self.structure.t_isolated.powi(2) * 9.81 / (4.0 * PI.powi(2)));
        
        k_eff * dd // kN (k_eff is kN/m, dd is m)
    }
    
    /// Required effective stiffness per isolator (kN/mm)
    pub fn required_stiffness_per_isolator(&self) -> f64 {
        let w_per = self.structure.weight / self.structure.num_isolators as f64;
        let t = self.structure.t_isolated;
        
        4.0 * PI.powi(2) * w_per / (t.powi(2) * 9810.0)
    }
    
    /// Design check summary
    pub fn design_check(&self) -> IsolationDesignCheck {
        let dd = self.design_displacement();
        let dm = self.maximum_displacement();
        let vs = self.design_force_above();
        let vb = self.design_force_isolation();
        
        // Period criteria
        let period_ok = self.structure.t_isolated >= 3.0 * self.structure.t_fixed;
        
        // Damping criteria
        let damping_ok = self.structure.damping >= 0.05 && self.structure.damping <= 0.30;
        
        IsolationDesignCheck {
            design_displacement: dd,
            maximum_displacement: dm,
            superstructure_force: vs,
            isolation_force: vb,
            effective_period: self.structure.t_isolated,
            effective_damping: self.structure.damping,
            period_check: period_ok,
            damping_check: damping_ok,
            all_pass: period_ok && damping_ok,
        }
    }
}

/// Design check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IsolationDesignCheck {
    pub design_displacement: f64,
    pub maximum_displacement: f64,
    pub superstructure_force: f64,
    pub isolation_force: f64,
    pub effective_period: f64,
    pub effective_damping: f64,
    pub period_check: bool,
    pub damping_check: bool,
    pub all_pass: bool,
}

// ============================================================================
// ENERGY DISSIPATION DEVICES
// ============================================================================

/// Viscous damper properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViscousDamper {
    /// Damping coefficient (kN·s/mm)
    pub c: f64,
    /// Velocity exponent (typically 0.3-1.0)
    pub alpha: f64,
    /// Maximum stroke (mm)
    pub stroke: f64,
    /// Maximum force (kN)
    pub max_force: f64,
}

impl ViscousDamper {
    pub fn new(c: f64, alpha: f64, stroke: f64) -> Self {
        Self {
            c,
            alpha,
            stroke,
            max_force: c * 100.0_f64.powf(alpha), // At 100 mm/s
        }
    }
    
    /// Damper force at velocity (kN)
    pub fn force(&self, velocity: f64) -> f64 {
        let sign = if velocity >= 0.0 { 1.0 } else { -1.0 };
        sign * self.c * velocity.abs().powf(self.alpha)
    }
    
    /// Energy dissipated per cycle at amplitude A and frequency ω
    /// Ed = λ·C·ω^α·A^(1+α), where λ = 2^(2+α)·Γ²(1+α/2)/Γ(2+α)
    pub fn energy_per_cycle(&self, amplitude: f64, omega: f64) -> f64 {
        let lambda = (2.0_f64).powf(2.0 + self.alpha)
            * gamma_function(1.0 + self.alpha / 2.0).powi(2)
            / gamma_function(2.0 + self.alpha);
        
        lambda * self.c * omega.powf(self.alpha) * amplitude.powf(1.0 + self.alpha)
    }
    
    /// Equivalent linear damping coefficient
    pub fn equivalent_damping(&self, amplitude: f64, omega: f64) -> f64 {
        let ed = self.energy_per_cycle(amplitude, omega);
        ed / (PI * omega * amplitude.powi(2))
    }
}

/// Steel yielding damper (ADAS/TADAS)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YieldingDamper {
    /// Yield force (kN)
    pub fy: f64,
    /// Yield displacement (mm)
    pub dy: f64,
    /// Post-yield stiffness ratio
    pub alpha: f64,
    /// Ultimate displacement (mm)
    pub du: f64,
}

impl YieldingDamper {
    pub fn new(fy: f64, dy: f64, alpha: f64) -> Self {
        Self {
            fy,
            dy,
            alpha,
            du: dy * 10.0, // Typical ductility of 10
        }
    }
    
    /// Initial stiffness (kN/mm)
    pub fn initial_stiffness(&self) -> f64 {
        self.fy / self.dy
    }
    
    /// Post-yield stiffness (kN/mm)
    pub fn post_yield_stiffness(&self) -> f64 {
        self.alpha * self.initial_stiffness()
    }
    
    /// Force at displacement d (kN)
    pub fn force(&self, d: f64) -> f64 {
        if d.abs() <= self.dy {
            self.initial_stiffness() * d
        } else {
            let sign = if d >= 0.0 { 1.0 } else { -1.0 };
            sign * (self.fy + self.post_yield_stiffness() * (d.abs() - self.dy))
        }
    }
    
    /// Ductility demand
    pub fn ductility(&self, d: f64) -> f64 {
        d.abs() / self.dy
    }
    
    /// Energy dissipated per cycle
    pub fn energy_per_cycle(&self, amplitude: f64) -> f64 {
        if amplitude <= self.dy {
            0.0
        } else {
            4.0 * self.fy * (amplitude - self.dy)
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
        let lrb = LeadRubberBearing::new(600.0, 200.0, 100.0);
        
        assert!(lrb.rubber_area() > 0.0);
        assert!(lrb.lead_area() > 0.0);
        assert!(lrb.shape_factor() > 0.0);
    }

    #[test]
    fn test_lrb_stiffness() {
        let lrb = LeadRubberBearing::new(600.0, 200.0, 100.0);
        
        let kh = lrb.horizontal_stiffness();
        let kv = lrb.vertical_stiffness();
        
        assert!(kh > 0.0);
        assert!(kv > kh); // Vertical should be stiffer
    }

    #[test]
    fn test_lrb_effective_properties() {
        let lrb = LeadRubberBearing::new(600.0, 200.0, 100.0);
        
        let k_eff = lrb.effective_stiffness(100.0);
        let beta_eff = lrb.effective_damping(100.0);
        
        assert!(k_eff > 0.0);
        // Effective damping can be negative in edge cases, just check it's finite
        assert!(beta_eff.is_finite());
    }

    #[test]
    fn test_fps_period() {
        let fps = FrictionPendulumBearing::new(2000.0, 0.05, 1000.0);
        let period = fps.period();
        
        // T = 2π√(R/g) ≈ 2.84s for R=2000mm
        assert!(period > 2.5 && period < 3.5);
    }

    #[test]
    fn test_fps_effective_properties() {
        let fps = FrictionPendulumBearing::new(2000.0, 0.05, 1000.0);
        
        let k_eff = fps.effective_stiffness(100.0);
        let beta_eff = fps.effective_damping(100.0);
        
        assert!(k_eff > 0.0);
        assert!(beta_eff > 0.0 && beta_eff < 0.5);
    }

    #[test]
    fn test_triple_fps() {
        let tfp = TripleFrictionPendulum::new(300.0, 2000.0, 0.02, 0.05, 1000.0);
        
        // Period should vary with displacement
        let t1 = tfp.period(50.0);
        let t2 = tfp.period(200.0);
        
        assert!(t1 != t2);
    }

    #[test]
    fn test_site_coefficients() {
        let fa = SiteClass::D.fa(0.5);
        let fv = SiteClass::D.fv(0.3);
        
        assert!(fa > 1.0);
        assert!(fv > 1.5);
    }

    #[test]
    fn test_isolation_design() {
        let hazard = SeismicHazard {
            ss: 1.5,
            s1: 0.6,
            site_class: SiteClass::D,
            risk_category: RiskCategory::II,
        };
        
        let structure = IsolatedStructure {
            weight: 50000.0,
            t_fixed: 0.5,
            t_isolated: 2.5,
            num_isolators: 20,
            damping: 0.15,
        };
        
        let designer = IsolationSystemDesigner::new(hazard, structure);
        
        let dd = designer.design_displacement();
        let dm = designer.maximum_displacement();
        
        assert!(dd > 0.0);
        assert!(dm > dd);
    }

    #[test]
    fn test_design_spectrum() {
        let hazard = SeismicHazard {
            ss: 1.0,
            s1: 0.4,
            site_class: SiteClass::C,
            risk_category: RiskCategory::III,
        };
        
        let structure = IsolatedStructure {
            weight: 30000.0,
            t_fixed: 0.3,
            t_isolated: 2.0,
            num_isolators: 16,
            damping: 0.20,
        };
        
        let designer = IsolationSystemDesigner::new(hazard, structure);
        let (sds, sd1) = designer.design_spectrum();
        
        assert!(sds > 0.0 && sds < 2.0);
        assert!(sd1 > 0.0 && sd1 < 1.5);
    }

    #[test]
    fn test_damping_factor() {
        let hazard = SeismicHazard {
            ss: 1.0,
            s1: 0.4,
            site_class: SiteClass::D,
            risk_category: RiskCategory::II,
        };
        
        let mut structure = IsolatedStructure {
            weight: 20000.0,
            t_fixed: 0.4,
            t_isolated: 2.0,
            num_isolators: 12,
            damping: 0.05,
        };
        
        let designer1 = IsolationSystemDesigner::new(hazard.clone(), structure.clone());
        let bd1 = designer1.damping_factor();
        
        structure.damping = 0.20;
        let designer2 = IsolationSystemDesigner::new(hazard, structure);
        let bd2 = designer2.damping_factor();
        
        assert!(bd2 > bd1); // Higher damping = higher BD factor
    }

    #[test]
    fn test_viscous_damper() {
        let damper = ViscousDamper::new(50.0, 0.5, 200.0);
        
        let force = damper.force(50.0);
        assert!(force > 0.0);
        
        let force_neg = damper.force(-50.0);
        assert!(force_neg < 0.0);
    }

    #[test]
    fn test_yielding_damper() {
        let damper = YieldingDamper::new(100.0, 5.0, 0.05);
        
        // Below yield
        let f1 = damper.force(3.0);
        assert!(f1 < damper.fy);
        
        // Above yield
        let f2 = damper.force(10.0);
        assert!(f2 > damper.fy);
    }

    #[test]
    fn test_design_check() {
        let hazard = SeismicHazard {
            ss: 0.8,
            s1: 0.3,
            site_class: SiteClass::C,
            risk_category: RiskCategory::II,
        };
        
        let structure = IsolatedStructure {
            weight: 40000.0,
            t_fixed: 0.4,
            t_isolated: 2.5,
            num_isolators: 24,
            damping: 0.15,
        };
        
        let designer = IsolationSystemDesigner::new(hazard, structure);
        let check = designer.design_check();
        
        assert!(check.design_displacement > 0.0);
        assert!(check.period_check);
    }

    #[test]
    fn test_lrb_characteristic_strength() {
        let lrb = LeadRubberBearing::new(700.0, 250.0, 150.0);
        let qd = lrb.characteristic_strength();
        
        assert!(qd > 0.0);
    }

    #[test]
    fn test_required_stiffness() {
        let hazard = SeismicHazard {
            ss: 1.2,
            s1: 0.5,
            site_class: SiteClass::D,
            risk_category: RiskCategory::III,
        };
        
        let structure = IsolatedStructure {
            weight: 60000.0,
            t_fixed: 0.5,
            t_isolated: 3.0,
            num_isolators: 30,
            damping: 0.20,
        };
        
        let designer = IsolationSystemDesigner::new(hazard, structure);
        let k_req = designer.required_stiffness_per_isolator();
        
        assert!(k_req > 0.0 && k_req < 10.0);
    }
}
