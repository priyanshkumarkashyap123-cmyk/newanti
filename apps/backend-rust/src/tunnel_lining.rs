// ============================================================================
// TUNNEL LINING DESIGN - NATM, TBM, Immersed Tubes
// Based on AFTES, DAUB, Eurocode 7
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// GROUND CONDITIONS
// ============================================================================

/// Rock mass classification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RockMassRating {
    /// Uniaxial compressive strength rating (0-15)
    pub r1_ucs: f64,
    /// RQD rating (0-20)
    pub r2_rqd: f64,
    /// Joint spacing rating (0-20)
    pub r3_spacing: f64,
    /// Joint condition rating (0-30)
    pub r4_condition: f64,
    /// Groundwater rating (0-15)
    pub r5_water: f64,
    /// Joint orientation adjustment (-12 to 0)
    pub r6_orientation: f64,
}

impl RockMassRating {
    pub fn new(ucs: f64, rqd: f64, spacing: f64, condition: f64, water: f64) -> Self {
        Self {
            r1_ucs: Self::ucs_rating(ucs),
            r2_rqd: Self::rqd_rating(rqd),
            r3_spacing: spacing,
            r4_condition: condition,
            r5_water: water,
            r6_orientation: -5.0, // Favorable default
        }
    }
    
    fn ucs_rating(ucs: f64) -> f64 {
        if ucs > 250.0 { 15.0 }
        else if ucs > 100.0 { 12.0 }
        else if ucs > 50.0 { 7.0 }
        else if ucs > 25.0 { 4.0 }
        else { 2.0 }
    }
    
    fn rqd_rating(rqd: f64) -> f64 {
        if rqd > 90.0 { 20.0 }
        else if rqd > 75.0 { 17.0 }
        else if rqd > 50.0 { 13.0 }
        else if rqd > 25.0 { 8.0 }
        else { 3.0 }
    }
    
    /// Total RMR value
    pub fn rmr(&self) -> f64 {
        self.r1_ucs + self.r2_rqd + self.r3_spacing +
        self.r4_condition + self.r5_water + self.r6_orientation
    }
    
    /// Rock mass class (I to V)
    pub fn rock_class(&self) -> &'static str {
        let rmr = self.rmr();
        if rmr > 80.0 { "I - Very Good" }
        else if rmr > 60.0 { "II - Good" }
        else if rmr > 40.0 { "III - Fair" }
        else if rmr > 20.0 { "IV - Poor" }
        else { "V - Very Poor" }
    }
    
    /// Stand-up time (hours)
    pub fn stand_up_time(&self, span: f64) -> f64 {
        let rmr = self.rmr();
        
        // Bieniawski correlation
        if rmr > 60.0 {
            10.0_f64.powf((rmr - 40.0) / 10.0) * (span / 3.0).powf(-0.5) / 24.0
        } else {
            ((rmr - 10.0) / 20.0).max(0.1) * 24.0 / span
        }
    }
    
    /// Cohesion estimate (MPa)
    pub fn cohesion(&self) -> f64 {
        let rmr = self.rmr();
        0.1 * (rmr / 5.0)
    }
    
    /// Friction angle estimate (degrees)
    pub fn friction_angle(&self) -> f64 {
        let rmr = self.rmr();
        0.5 * rmr + 5.0
    }
}

// ============================================================================
// Q-SYSTEM
// ============================================================================

/// Q-System classification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QSystem {
    /// Rock Quality Designation (%)
    pub rqd: f64,
    /// Joint set number Jn
    pub jn: f64,
    /// Joint roughness Jr
    pub jr: f64,
    /// Joint alteration Ja
    pub ja: f64,
    /// Joint water reduction Jw
    pub jw: f64,
    /// Stress reduction factor SRF
    pub srf: f64,
}

impl QSystem {
    pub fn new(rqd: f64, jn: f64, jr: f64, ja: f64, jw: f64, srf: f64) -> Self {
        Self { rqd, jn, jr, ja, jw, srf }
    }
    
    /// Q value
    pub fn q_value(&self) -> f64 {
        (self.rqd / self.jn) * (self.jr / self.ja) * (self.jw / self.srf)
    }
    
    /// Normalized Q value (Qn)
    pub fn qn(&self, sigma_ci: f64, sigma_v: f64) -> f64 {
        self.q_value() * (sigma_ci / (100.0 * sigma_v)).max(0.5)
    }
    
    /// Equivalent dimension De (m)
    pub fn equivalent_dimension(&self, span: f64, esr: f64) -> f64 {
        span / esr
    }
    
    /// Required bolt spacing (m)
    pub fn bolt_spacing(&self, span: f64, esr: f64) -> f64 {
        let _de = self.equivalent_dimension(span, esr);
        let q = self.q_value();
        
        // Barton's chart approximation
        if q > 10.0 {
            2.5
        } else if q > 1.0 {
            1.5 + 0.1 * q
        } else {
            0.8 + 0.7 * q.powf(0.4)
        }
    }
    
    /// Required shotcrete thickness (mm)
    pub fn shotcrete_thickness(&self, span: f64, esr: f64) -> f64 {
        let de = self.equivalent_dimension(span, esr);
        let q = self.q_value();
        
        if q > 10.0 {
            0.0 // No shotcrete needed
        } else if q > 1.0 {
            50.0 * (de / 10.0)
        } else {
            100.0 + 50.0 * (1.0 - q) * (de / 10.0)
        }
    }
    
    /// Rock mass quality description
    pub fn quality_description(&self) -> &'static str {
        let q = self.q_value();
        if q > 100.0 { "Exceptionally Good" }
        else if q > 40.0 { "Extremely Good" }
        else if q > 10.0 { "Very Good" }
        else if q > 4.0 { "Good" }
        else if q > 1.0 { "Fair" }
        else if q > 0.1 { "Poor" }
        else if q > 0.01 { "Very Poor" }
        else { "Exceptionally Poor" }
    }
}

// ============================================================================
// CONVERGENCE-CONFINEMENT
// ============================================================================

/// Ground Reaction Curve
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroundReactionCurve {
    /// Tunnel radius (m)
    pub radius: f64,
    /// In-situ stress (MPa)
    pub p0: f64,
    /// Rock mass modulus (GPa)
    pub em: f64,
    /// Rock mass cohesion (MPa)
    pub cm: f64,
    /// Rock mass friction angle (degrees)
    pub phi: f64,
    /// Poisson's ratio
    pub nu: f64,
}

impl GroundReactionCurve {
    pub fn new(radius: f64, p0: f64, em: f64, cm: f64, phi: f64) -> Self {
        Self {
            radius,
            p0,
            em,
            cm,
            phi,
            nu: 0.25,
        }
    }
    
    /// Critical internal pressure (MPa) - Carranza-Torres formulation
    /// pcr = (2p₀ - σcm) / (Kp + 1), where σcm = 2c√Kp
    pub fn critical_pressure(&self) -> f64 {
        let phi_rad = self.phi * PI / 180.0;
        let kp = (1.0 + phi_rad.sin()) / (1.0 - phi_rad.sin());
        let sigma_cm = 2.0 * self.cm * kp.sqrt();
        
        (2.0 * self.p0 - sigma_cm) / (kp + 1.0)
    }
    
    /// Elastic convergence (mm) at pressure pi
    pub fn elastic_convergence(&self, pi: f64) -> f64 {
        let ur = (1.0 + self.nu) * (self.p0 - pi) * self.radius / self.em / 1000.0;
        ur * 1000.0 // mm
    }
    
    /// Plastic zone radius (m)
    pub fn plastic_radius(&self, pi: f64) -> f64 {
        if pi >= self.critical_pressure() {
            self.radius
        } else {
            let phi_rad = self.phi * PI / 180.0;
            let kp = (1.0 + phi_rad.sin()) / (1.0 - phi_rad.sin());
            let _sigma_cm = 2.0 * self.cm * kp.sqrt() / (kp - 1.0);
            
            self.radius * ((2.0 * (self.p0 + self.cm / (kp - 1.0).max(0.1))) / 
                          (pi + self.cm / (kp - 1.0).max(0.1)).max(0.01)).powf(1.0 / (kp - 1.0).max(0.1))
        }
    }
    
    /// Convergence at face (mm)
    pub fn face_convergence(&self) -> f64 {
        0.25 * self.elastic_convergence(self.critical_pressure() * 0.5)
    }
}

// ============================================================================
// LINING DESIGN
// ============================================================================

/// Shotcrete lining
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShotcreteLining {
    /// Thickness (mm)
    pub thickness: f64,
    /// Compressive strength (MPa)
    pub fck: f64,
    /// Fiber dosage (kg/m³) - 0 for plain
    pub fiber_dosage: f64,
    /// Young's modulus (GPa)
    pub ec: f64,
}

impl ShotcreteLining {
    pub fn plain(thickness: f64, fck: f64) -> Self {
        Self {
            thickness,
            fck,
            fiber_dosage: 0.0,
            ec: (fck / 10.0).sqrt() * 22.0, // GPa (EC2-style)
        }
    }
    
    pub fn fiber_reinforced(thickness: f64, fck: f64, fiber: f64) -> Self {
        Self {
            thickness,
            fck,
            fiber_dosage: fiber,
            ec: (fck / 10.0).sqrt() * 22.0, // GPa (EC2-style)
        }
    }
    
    /// Residual flexural strength (MPa)
    pub fn residual_strength(&self) -> f64 {
        if self.fiber_dosage > 0.0 {
            0.7 + 0.01 * self.fiber_dosage
        } else {
            0.0
        }
    }
    
    /// Moment capacity (kN·m/m)
    pub fn moment_capacity(&self) -> f64 {
        let h = self.thickness / 1000.0; // m
        let fctd = 0.3 * self.fck.powf(2.0 / 3.0); // Design tensile
        
        if self.fiber_dosage > 0.0 {
            let frs = self.residual_strength();
            (fctd + frs) * h.powi(2) / 6.0 * 1000.0
        } else {
            fctd * h.powi(2) / 6.0 * 1000.0
        }
    }
    
    /// Thrust capacity (kN/m)
    pub fn thrust_capacity(&self) -> f64 {
        let fcd = 0.85 * self.fck / 1.5;
        
        fcd * self.thickness / 1000.0 * 1000.0
    }
    
    /// Support reaction curve stiffness (MPa/m)
    pub fn stiffness(&self, radius: f64) -> f64 {
        self.ec * 1000.0 * self.thickness / 1000.0 / radius.powi(2)
    }
}

/// Segmental lining
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentalLining {
    /// Number of segments
    pub num_segments: u32,
    /// Segment thickness (mm)
    pub thickness: f64,
    /// Segment width (mm)
    pub width: f64,
    /// Internal diameter (m)
    pub internal_diameter: f64,
    /// Concrete strength (MPa)
    pub fck: f64,
}

impl SegmentalLining {
    pub fn new(internal_dia: f64, thickness: f64, width: f64) -> Self {
        Self {
            num_segments: 6,
            thickness,
            width,
            internal_diameter: internal_dia,
            fck: 50.0,
        }
    }
    
    /// External diameter (m)
    pub fn external_diameter(&self) -> f64 {
        self.internal_diameter + 2.0 * self.thickness / 1000.0
    }
    
    /// Ring area (m²)
    pub fn ring_area(&self) -> f64 {
        let r_ext = self.external_diameter() / 2.0;
        let r_int = self.internal_diameter / 2.0;
        
        PI * (r_ext.powi(2) - r_int.powi(2))
    }
    
    /// Ring inertia (m⁴)
    pub fn ring_inertia(&self) -> f64 {
        let r_ext = self.external_diameter() / 2.0;
        let r_int = self.internal_diameter / 2.0;
        
        PI * (r_ext.powi(4) - r_int.powi(4)) / 4.0
    }
    
    /// Effective ring stiffness (reduced for joints)
    pub fn effective_stiffness(&self) -> f64 {
        let i_full = self.ring_inertia();
        let ec = ((self.fck / 10.0).sqrt() * 22.0) as f64;
        
        // Reduction factor for segmental joints (Muir Wood)
        let eta = 1.0 - 4.0 / (self.num_segments as f64).powi(2);
        
        ec * i_full * eta / 1e9 // MN·m²
    }
    
    /// Bending moment capacity (kN·m/m)
    pub fn moment_capacity(&self, axial: f64) -> f64 {
        let fcd = 0.85 * self.fck / 1.5;
        let b = self.width / 1000.0; // m
        let d = self.thickness / 1000.0; // m
        
        let nu = axial / (fcd * 1000.0 * b * d);
        
        // M-N interaction
        let mu = nu * (1.0 - 0.5 * nu);
        
        mu * fcd * 1000.0 * b * d.powi(2)
    }
    
    /// Thrust capacity (kN/m)
    pub fn thrust_capacity(&self) -> f64 {
        let fcd = 0.85 * self.fck / 1.5;
        
        fcd * self.thickness / 1000.0 * 1000.0
    }
    
    /// Jack force capacity per segment (kN)
    pub fn jack_capacity(&self) -> f64 {
        let fcd = 0.85 * self.fck / 1.5;
        let jack_area = 0.3 * self.width / 1000.0 * self.thickness / 1000.0; // Typical
        
        fcd * 1000.0 * jack_area * 2.0 // 2 jacks per segment
    }
}

// ============================================================================
// ROCK BOLT DESIGN
// ============================================================================

/// Rock bolt design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RockBolt {
    /// Bolt diameter (mm)
    pub diameter: f64,
    /// Bolt length (m)
    pub length: f64,
    /// Steel yield strength (MPa)
    pub fy: f64,
    /// Bolt type
    pub bolt_type: BoltType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BoltType {
    FullyGrouted,
    EndAnchored,
    SplitSet,
    Swellex,
    CableAnchor,
}

impl RockBolt {
    pub fn fully_grouted(diameter: f64, length: f64) -> Self {
        Self {
            diameter,
            length,
            fy: 500.0,
            bolt_type: BoltType::FullyGrouted,
        }
    }
    
    /// Bolt cross-section area (mm²)
    pub fn area(&self) -> f64 {
        PI * self.diameter.powi(2) / 4.0
    }
    
    /// Yield capacity (kN)
    pub fn yield_capacity(&self) -> f64 {
        self.fy * self.area() / 1000.0
    }
    
    /// Pull-out capacity (kN)
    pub fn pullout_capacity(&self, rock_strength: f64) -> f64 {
        match self.bolt_type {
            BoltType::FullyGrouted => {
                // Bond along full length
                let tau = 0.1 * rock_strength.sqrt(); // MPa
                PI * self.diameter * self.length * 1000.0 * tau / 1000.0
            }
            BoltType::EndAnchored => {
                // Anchor zone only
                0.5 * self.yield_capacity()
            }
            _ => 0.3 * self.yield_capacity(),
        }
    }
    
    /// Design capacity (kN)
    pub fn design_capacity(&self, rock_strength: f64) -> f64 {
        self.yield_capacity().min(self.pullout_capacity(rock_strength)) / 1.25
    }
    
    /// Required bolt density (bolts/m²)
    pub fn bolt_density(&self, support_pressure: f64, rock_strength: f64) -> f64 {
        let capacity = self.design_capacity(rock_strength);
        
        support_pressure * 1000.0 / capacity // MPa to kN
    }
}

// ============================================================================
// SUPPORT PRESSURE
// ============================================================================

/// Support pressure calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupportPressure {
    /// Tunnel span (m)
    pub span: f64,
    /// Overburden depth (m)
    pub cover: f64,
    /// Rock unit weight (kN/m³)
    pub gamma: f64,
    /// RMR value
    pub rmr: f64,
}

impl SupportPressure {
    pub fn new(span: f64, cover: f64, gamma: f64, rmr: f64) -> Self {
        Self { span, cover, gamma, rmr }
    }
    
    /// Vertical stress (MPa)
    pub fn vertical_stress(&self) -> f64 {
        self.gamma * self.cover / 1000.0
    }
    
    /// Terzaghi's loosening height (m)
    pub fn loosening_height(&self) -> f64 {
        // Based on RMR
        if self.rmr > 70.0 {
            0.0
        } else if self.rmr > 50.0 {
            0.1 * self.span
        } else if self.rmr > 30.0 {
            0.2 * self.span
        } else {
            0.3 * self.span + (50.0 - self.rmr) * self.span / 100.0
        }
    }
    
    /// Required support pressure (MPa)
    pub fn support_pressure(&self) -> f64 {
        let h_loose = self.loosening_height();
        self.gamma * h_loose / 1000.0
    }
    
    /// NATM excavation class
    pub fn excavation_class(&self) -> &'static str {
        if self.rmr > 70.0 { "Full face excavation" }
        else if self.rmr > 50.0 { "Top heading and bench" }
        else if self.rmr > 30.0 { "Top heading, bench, invert" }
        else { "Multiple drifts" }
    }
    
    /// Round length recommendation (m)
    pub fn round_length(&self) -> f64 {
        if self.rmr > 70.0 { 3.0 }
        else if self.rmr > 50.0 { 1.5 }
        else if self.rmr > 30.0 { 1.0 }
        else { 0.5 }
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rmr() {
        let rmr = RockMassRating::new(80.0, 75.0, 15.0, 20.0, 10.0);
        
        let total = rmr.rmr();
        assert!(total > 50.0 && total < 90.0);
    }

    #[test]
    fn test_rmr_class() {
        let good = RockMassRating::new(150.0, 90.0, 18.0, 25.0, 12.0);
        let poor = RockMassRating::new(30.0, 30.0, 5.0, 10.0, 5.0);
        
        assert!(good.rmr() > poor.rmr());
    }

    #[test]
    fn test_q_system() {
        let q = QSystem::new(80.0, 4.0, 2.0, 1.0, 1.0, 2.5);
        
        let q_val = q.q_value();
        assert!(q_val > 10.0);
        assert_eq!(q.quality_description(), "Very Good");
    }

    #[test]
    fn test_q_support() {
        let q = QSystem::new(50.0, 9.0, 1.5, 2.0, 1.0, 2.5);
        
        let spacing = q.bolt_spacing(10.0, 1.6);
        let shotcrete = q.shotcrete_thickness(10.0, 1.6);
        
        assert!(spacing > 0.5 && spacing < 3.0);
        assert!(shotcrete >= 0.0);
    }

    #[test]
    fn test_ground_reaction() {
        let grc = GroundReactionCurve::new(5.0, 5.0, 5.0, 1.0, 35.0);
        
        let pc = grc.critical_pressure();
        // Critical pressure can be positive or negative depending on rock parameters
        assert!(pc.is_finite());
    }

    #[test]
    fn test_convergence() {
        let grc = GroundReactionCurve::new(5.0, 3.0, 3.0, 0.5, 30.0);
        
        let u = grc.elastic_convergence(1.0);
        assert!(u > 0.0);
    }

    #[test]
    fn test_shotcrete() {
        let sfrs = ShotcreteLining::fiber_reinforced(200.0, 30.0, 40.0);
        
        let m = sfrs.moment_capacity();
        let n = sfrs.thrust_capacity();
        
        assert!(m > 10.0);
        assert!(n > 3000.0);
    }

    #[test]
    fn test_segments() {
        let seg = SegmentalLining::new(6.0, 350.0, 1400.0);
        
        assert!(seg.external_diameter() > seg.internal_diameter);
        assert!(seg.thrust_capacity() > 5000.0);
    }

    #[test]
    fn test_rock_bolt() {
        let bolt = RockBolt::fully_grouted(25.0, 4.0);
        
        let cap = bolt.yield_capacity();
        assert!(cap > 200.0);
    }

    #[test]
    fn test_support_pressure() {
        let sp = SupportPressure::new(10.0, 50.0, 25.0, 45.0);
        
        let p = sp.support_pressure();
        assert!(p > 0.0 && p < 1.0);
    }

    #[test]
    fn test_excavation_class() {
        let good_rock = SupportPressure::new(8.0, 30.0, 26.0, 75.0);
        let poor_rock = SupportPressure::new(8.0, 30.0, 26.0, 25.0);
        
        assert_eq!(good_rock.excavation_class(), "Full face excavation");
        assert!(poor_rock.round_length() < good_rock.round_length());
    }
}
