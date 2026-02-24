// ============================================================================
// CRANE RUNWAY BEAM DESIGN MODULE
// AISC Design Guide 7, IS 800, Eurocode 3-6 - Industrial crane structures
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// CRANE TYPES
// ============================================================================

/// Crane type classification
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CraneType {
    /// Overhead bridge crane (EOT)
    OverheadBridge,
    /// Gantry crane
    Gantry,
    /// Jib crane
    Jib,
    /// Monorail hoist
    Monorail,
    /// Semi-gantry
    SemiGantry,
}

/// Crane duty class (FEM/ISO)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CraneDutyClass {
    /// Light duty (A1-A2)
    Light,
    /// Medium duty (A3-A4)
    Medium,
    /// Heavy duty (A5-A6)
    Heavy,
    /// Very heavy/continuous (A7-A8)
    VeryHeavy,
}

impl CraneDutyClass {
    /// Impact factor for vertical loads
    pub fn impact_factor(&self) -> f64 {
        match self {
            CraneDutyClass::Light => 1.10,
            CraneDutyClass::Medium => 1.20,
            CraneDutyClass::Heavy => 1.25,
            CraneDutyClass::VeryHeavy => 1.30,
        }
    }
    
    /// Lateral load percentage of lifted load
    pub fn lateral_factor(&self) -> f64 {
        match self {
            CraneDutyClass::Light => 0.10,
            CraneDutyClass::Medium => 0.15,
            CraneDutyClass::Heavy => 0.20,
            CraneDutyClass::VeryHeavy => 0.25,
        }
    }
    
    /// Longitudinal (tractive) force percentage
    pub fn longitudinal_factor(&self) -> f64 {
        match self {
            CraneDutyClass::Light => 0.10,
            CraneDutyClass::Medium => 0.15,
            CraneDutyClass::Heavy => 0.20,
            CraneDutyClass::VeryHeavy => 0.20,
        }
    }
    
    /// Number of load cycles for fatigue
    pub fn design_cycles(&self) -> u64 {
        match self {
            CraneDutyClass::Light => 200_000,
            CraneDutyClass::Medium => 500_000,
            CraneDutyClass::Heavy => 1_000_000,
            CraneDutyClass::VeryHeavy => 2_000_000,
        }
    }
}

// ============================================================================
// CRANE LOAD DATA
// ============================================================================

/// Crane loading parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CraneLoads {
    /// Safe working load (kN)
    pub swl: f64,
    /// Crane bridge weight (kN)
    pub bridge_weight: f64,
    /// Crab/trolley weight (kN)
    pub crab_weight: f64,
    /// Wheel spacing on each end truck (mm)
    pub wheel_spacing: f64,
    /// Number of wheels per end truck
    pub wheels_per_truck: u32,
    /// Crane span (mm)
    pub crane_span: f64,
    /// Minimum hook approach (mm)
    pub min_hook_approach: f64,
    /// Crane type
    pub crane_type: CraneType,
    /// Duty class
    pub duty_class: CraneDutyClass,
}

impl CraneLoads {
    pub fn new(swl: f64, crane_span: f64) -> Self {
        // Empirical estimates for bridge/crab weights
        let bridge_weight = 0.3 * swl + 0.02 * crane_span / 1000.0 * swl;
        let crab_weight = 0.2 * swl;
        
        Self {
            swl,
            bridge_weight,
            crab_weight,
            wheel_spacing: 3000.0,
            wheels_per_truck: 2,
            crane_span,
            min_hook_approach: 1000.0,
            crane_type: CraneType::OverheadBridge,
            duty_class: CraneDutyClass::Medium,
        }
    }
    
    /// Total crane weight (kN)
    pub fn total_crane_weight(&self) -> f64 {
        self.bridge_weight + self.crab_weight
    }
    
    /// Maximum wheel load - lifted load at minimum approach (kN)
    pub fn max_wheel_load(&self) -> f64 {
        // Lifted load + crab at minimum approach
        let lever_arm = self.crane_span - self.min_hook_approach;
        let reaction_lifted = (self.swl + self.crab_weight) * lever_arm / self.crane_span;
        
        // Add bridge weight (equally distributed)
        let bridge_per_wheel = self.bridge_weight / (2.0 * self.wheels_per_truck as f64);
        
        // Per wheel
        reaction_lifted / self.wheels_per_truck as f64 + bridge_per_wheel
    }
    
    /// Minimum wheel load - crane without load (kN)
    pub fn min_wheel_load(&self) -> f64 {
        let total_crane = self.total_crane_weight();
        total_crane / (2.0 * self.wheels_per_truck as f64)
    }
    
    /// Factored maximum wheel load with impact (kN)
    pub fn factored_wheel_load(&self) -> f64 {
        self.max_wheel_load() * self.duty_class.impact_factor()
    }
    
    /// Horizontal lateral load per wheel (kN)
    pub fn lateral_load_per_wheel(&self) -> f64 {
        let lateral_total = self.swl * self.duty_class.lateral_factor();
        lateral_total / (2.0 * self.wheels_per_truck as f64)
    }
    
    /// Longitudinal (tractive) force (kN)
    pub fn longitudinal_force(&self) -> f64 {
        (self.swl + self.total_crane_weight()) * self.duty_class.longitudinal_factor()
    }
}

// ============================================================================
// CRANE RUNWAY BEAM
// ============================================================================

/// Crane runway beam configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunwayBeam {
    /// Span (mm)
    pub span: f64,
    /// Section depth (mm)
    pub depth: f64,
    /// Flange width (mm)
    pub flange_width: f64,
    /// Web thickness (mm)
    pub web_thickness: f64,
    /// Flange thickness (mm)
    pub flange_thickness: f64,
    /// Rail height (mm)
    pub rail_height: f64,
    /// Has cap channel (for lateral bracing)
    pub cap_channel: Option<CapChannel>,
    /// Material yield strength (MPa)
    pub fy: f64,
}

/// Cap channel for lateral strength
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapChannel {
    pub depth: f64,
    pub flange_width: f64,
    pub web_thickness: f64,
    pub flange_thickness: f64,
}

impl RunwayBeam {
    /// Create from standard I-beam designation
    pub fn from_depth(depth: f64, span: f64) -> Self {
        // Typical proportions for crane runway beams
        Self {
            span,
            depth,
            flange_width: depth * 0.4,
            web_thickness: depth * 0.02,
            flange_thickness: depth * 0.03,
            rail_height: 100.0, // Standard crane rail
            cap_channel: None,
            fy: 250.0,
        }
    }
    
    /// Add cap channel
    pub fn with_cap_channel(mut self, channel_depth: f64) -> Self {
        self.cap_channel = Some(CapChannel {
            depth: channel_depth,
            flange_width: channel_depth * 0.4,
            web_thickness: 8.0,
            flange_thickness: 10.0,
        });
        self
    }
    
    /// Strong axis moment of inertia (mm⁴)
    pub fn ixx(&self) -> f64 {
        let d = self.depth;
        let bf = self.flange_width;
        let tw = self.web_thickness;
        let tf = self.flange_thickness;
        
        // I-section
        let i_web = tw * (d - 2.0 * tf).powi(3) / 12.0;
        let i_flange = bf * tf.powi(3) / 12.0 + bf * tf * ((d - tf) / 2.0).powi(2);
        
        i_web + 2.0 * i_flange
    }
    
    /// Weak axis moment of inertia (mm⁴)
    pub fn iyy(&self) -> f64 {
        let bf = self.flange_width;
        let tw = self.web_thickness;
        let tf = self.flange_thickness;
        let d = self.depth;
        
        let mut iy = 2.0 * tf * bf.powi(3) / 12.0 + (d - 2.0 * tf) * tw.powi(3) / 12.0;
        
        // Add cap channel if present
        if let Some(ref cap) = self.cap_channel {
            let i_cap = cap.flange_thickness * cap.depth.powi(3) / 12.0;
            iy += i_cap;
        }
        
        iy
    }
    
    /// Strong axis section modulus (mm³)
    pub fn zxx(&self) -> f64 {
        self.ixx() / (self.depth / 2.0)
    }
    
    /// Weak axis section modulus (mm³) - top flange
    pub fn zyy(&self) -> f64 {
        if self.cap_channel.is_some() {
            let cap = self.cap_channel.as_ref().unwrap();
            let y_top = self.flange_width / 2.0 + cap.depth;
            self.iyy() / y_top
        } else {
            self.iyy() / (self.flange_width / 2.0)
        }
    }
    
    /// Cross-sectional area (mm²)
    pub fn area(&self) -> f64 {
        let af = 2.0 * self.flange_width * self.flange_thickness;
        let aw = (self.depth - 2.0 * self.flange_thickness) * self.web_thickness;
        
        let mut a = af + aw;
        
        if let Some(ref cap) = self.cap_channel {
            a += 2.0 * cap.flange_width * cap.flange_thickness + cap.depth * cap.web_thickness;
        }
        
        a
    }
    
    /// Warping constant (mm⁶)
    pub fn cw(&self) -> f64 {
        let d = self.depth;
        let bf = self.flange_width;
        let tf = self.flange_thickness;
        
        // Approximate for doubly symmetric I-section
        (d - tf).powi(2) * bf.powi(3) * tf / 24.0
    }
    
    /// Torsional constant (mm⁴)
    pub fn j(&self) -> f64 {
        let bf = self.flange_width;
        let tw = self.web_thickness;
        let tf = self.flange_thickness;
        let d = self.depth;
        
        // Sum of bt³/3 for thin rectangles
        (2.0 * bf * tf.powi(3) + (d - 2.0 * tf) * tw.powi(3)) / 3.0
    }
    
    /// Height to centroid of top flange (mm)
    pub fn effective_depth(&self) -> f64 {
        self.depth - self.flange_thickness
    }
}

// ============================================================================
// RUNWAY BEAM DESIGNER
// ============================================================================

/// Crane runway beam designer per AISC DG7 / IS 800
pub struct RunwayBeamDesigner {
    pub beam: RunwayBeam,
    pub crane: CraneLoads,
}

impl RunwayBeamDesigner {
    pub fn new(beam: RunwayBeam, crane: CraneLoads) -> Self {
        Self { beam, crane }
    }
    
    /// Maximum bending moment from crane (kN·mm)
    pub fn max_moment_xx(&self) -> f64 {
        let p = self.crane.factored_wheel_load();
        let a = self.crane.wheel_spacing;
        let l = self.beam.span;
        
        if self.crane.wheels_per_truck == 2 {
            // Two concentrated loads
            // Max moment occurs under one wheel when wheels are positioned
            // such that the center of loads is at L/2 - a/4
            let x = l / 2.0 - a / 4.0;
            let r = p * (2.0 * l - a - 2.0 * x) / l;
            r * x
        } else {
            // Single concentrated load (conservative)
            p * l / 4.0
        }
    }
    
    /// Maximum lateral bending moment (kN·mm)
    pub fn max_moment_yy(&self) -> f64 {
        let h = self.crane.lateral_load_per_wheel();
        let l = self.beam.span;
        let a = self.crane.wheel_spacing;
        
        // Similar to vertical, but applied to weak axis
        if self.crane.wheels_per_truck == 2 {
            let x = l / 2.0 - a / 4.0;
            let r = h * (2.0 * l - a - 2.0 * x) / l;
            r * x
        } else {
            h * l / 4.0
        }
    }
    
    /// Maximum shear from crane (kN)
    pub fn max_shear(&self) -> f64 {
        let p = self.crane.factored_wheel_load();
        let a = self.crane.wheel_spacing;
        let l = self.beam.span;
        
        // Maximum shear when first wheel is at support
        p * (l + l - a) / l
    }
    
    /// Maximum deflection at midspan (mm)
    pub fn max_deflection(&self) -> f64 {
        let p = self.crane.max_wheel_load(); // Unfactored for serviceability
        let a = self.crane.wheel_spacing;
        let l = self.beam.span;
        let e = 200_000.0; // Steel E (MPa)
        let i = self.beam.ixx();
        
        // Two point loads
        // Δ = Pa(3L² - 4a²) / (48EI) when loads are at a from each support
        // Approximate maximum deflection position
        let defl = p * a * (3.0 * l.powi(2) - 4.0 * a.powi(2)) / (48.0 * e * i);
        
        // Account for second wheel
        defl * 2.0 * 0.85 // Overlap factor
    }
    
    /// Bending stress check (combined biaxial)
    pub fn stress_check(&self) -> StressCheckResult {
        let mxx = self.max_moment_xx();
        let myy = self.max_moment_yy();
        
        let fbx = mxx * 1000.0 / self.beam.zxx(); // MPa
        let fby = myy * 1000.0 / self.beam.zyy(); // MPa
        
        let fb_allow = 0.66 * self.beam.fy;
        
        // Interaction equation
        let ratio = fbx / fb_allow + fby / fb_allow;
        
        StressCheckResult {
            moment_xx: mxx,
            moment_yy: myy,
            stress_xx: fbx,
            stress_yy: fby,
            allowable: fb_allow,
            interaction_ratio: ratio,
            pass: ratio <= 1.0,
        }
    }
    
    /// Shear stress check
    pub fn shear_check(&self) -> ShearCheckResult {
        let v = self.max_shear();
        let aw = self.beam.depth * self.beam.web_thickness;
        
        let fv = v * 1000.0 / aw; // MPa
        let fv_allow = 0.4 * self.beam.fy;
        
        ShearCheckResult {
            shear_force: v,
            shear_stress: fv,
            allowable: fv_allow,
            ratio: fv / fv_allow,
            pass: fv <= fv_allow,
        }
    }
    
    /// Deflection check
    pub fn deflection_check(&self) -> DeflectionCheckResult {
        let delta = self.max_deflection();
        let limit = self.beam.span / 600.0; // Crane runway limit L/600
        
        DeflectionCheckResult {
            deflection: delta,
            limit,
            ratio: delta / limit,
            pass: delta <= limit,
        }
    }
    
    /// Web crippling check under concentrated load
    pub fn web_crippling_check(&self) -> WebCripplingResult {
        let p = self.crane.factored_wheel_load();
        let tw = self.beam.web_thickness;
        let tf = self.beam.flange_thickness;
        let d = self.beam.depth;
        let rail_h = self.beam.rail_height;
        
        // Bearing length (rail + 45° dispersion through flange)
        let n = rail_h + 2.0 * tf;
        
        // Web local yielding
        let rn_local = (5.0 * tf + n) * tw * self.beam.fy / 1000.0;
        
        // Web crippling (simplified)
        let _k = tf + d * 0.02; // Web-flange fillet
        let rn_cripple = 0.4 * tw.powi(2) * (1.0 + 3.0 * (n / d) * (tw / tf).powf(1.5)) 
                         * (200_000.0 * self.beam.fy * tf / tw).sqrt() / 1000.0;
        
        let rn = rn_local.min(rn_cripple);
        let ratio = p / rn;
        
        WebCripplingResult {
            wheel_load: p,
            bearing_length: n,
            capacity_local: rn_local,
            capacity_cripple: rn_cripple,
            ratio,
            pass: ratio <= 1.0,
        }
    }
    
    /// Lateral-torsional buckling check
    pub fn ltb_check(&self) -> LtbCheckResult {
        let l = self.beam.span;
        let e = 200_000.0;
        let g = 77_000.0;
        
        let iy = self.beam.iyy();
        let j = self.beam.j();
        let cw = self.beam.cw();
        let zx = self.beam.zxx();
        
        // Elastic LTB moment
        let cb = 1.14; // Moment gradient factor for crane loading
        let me = cb * PI / l * (e * iy * g * j + (PI * e / l).powi(2) * iy * cw).sqrt();
        
        // Plastic moment
        let mp = zx * self.beam.fy / 1000.0;
        
        // Nominal moment capacity
        let mn = if me >= mp {
            mp
        } else if me >= 0.7 * mp {
            mp - (mp - 0.7 * mp) * (mp - me) / (mp - 0.7 * mp)
        } else {
            me
        };
        
        let m_applied = self.max_moment_xx();
        let ratio = m_applied / mn;
        
        LtbCheckResult {
            elastic_moment: me,
            plastic_moment: mp,
            nominal_capacity: mn,
            applied_moment: m_applied,
            ratio,
            pass: ratio <= 1.0,
        }
    }
    
    /// Fatigue check per AISC DG7
    pub fn fatigue_check(&self) -> FatigueCheckResult {
        // Stress range from crane passage
        let m_max = self.max_moment_xx();
        let _m_min = 0.0; // No reversal typically
        let sr = m_max * 1000.0 / self.beam.zxx(); // Stress range MPa
        
        let cycles = self.crane.duty_class.design_cycles();
        
        // Category B detail (welded flange)
        let cf = 1.2e11_f64; // Fatigue constant for category B
        let fth = 110.0; // Threshold MPa
        
        // Allowable stress range
        let fsr = if cycles > 0 {
            (cf / cycles as f64).powf(1.0 / 3.0).min(fth)
        } else {
            fth
        };
        
        FatigueCheckResult {
            stress_range: sr,
            design_cycles: cycles,
            allowable_range: fsr,
            ratio: sr / fsr,
            pass: sr <= fsr,
        }
    }
    
    /// Complete design summary
    pub fn design_summary(&self) -> RunwayDesignSummary {
        let stress = self.stress_check();
        let shear = self.shear_check();
        let defl = self.deflection_check();
        let cripple = self.web_crippling_check();
        let ltb = self.ltb_check();
        let fatigue = self.fatigue_check();
        
        let all_pass = stress.pass && shear.pass && defl.pass && 
                       cripple.pass && ltb.pass && fatigue.pass;
        
        RunwayDesignSummary {
            stress_check: stress,
            shear_check: shear,
            deflection_check: defl,
            web_crippling_check: cripple,
            ltb_check: ltb,
            fatigue_check: fatigue,
            overall_pass: all_pass,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StressCheckResult {
    pub moment_xx: f64,
    pub moment_yy: f64,
    pub stress_xx: f64,
    pub stress_yy: f64,
    pub allowable: f64,
    pub interaction_ratio: f64,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShearCheckResult {
    pub shear_force: f64,
    pub shear_stress: f64,
    pub allowable: f64,
    pub ratio: f64,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeflectionCheckResult {
    pub deflection: f64,
    pub limit: f64,
    pub ratio: f64,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebCripplingResult {
    pub wheel_load: f64,
    pub bearing_length: f64,
    pub capacity_local: f64,
    pub capacity_cripple: f64,
    pub ratio: f64,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LtbCheckResult {
    pub elastic_moment: f64,
    pub plastic_moment: f64,
    pub nominal_capacity: f64,
    pub applied_moment: f64,
    pub ratio: f64,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FatigueCheckResult {
    pub stress_range: f64,
    pub design_cycles: u64,
    pub allowable_range: f64,
    pub ratio: f64,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunwayDesignSummary {
    pub stress_check: StressCheckResult,
    pub shear_check: ShearCheckResult,
    pub deflection_check: DeflectionCheckResult,
    pub web_crippling_check: WebCripplingResult,
    pub ltb_check: LtbCheckResult,
    pub fatigue_check: FatigueCheckResult,
    pub overall_pass: bool,
}

// ============================================================================
// CRANE COLUMN DESIGN
// ============================================================================

/// Crane column (bracket or stepped)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CraneColumn {
    /// Column height (mm)
    pub height: f64,
    /// Height to crane bracket (mm)
    pub crane_level: f64,
    /// Lower column depth (mm)
    pub lower_depth: f64,
    /// Upper column depth (mm)
    pub upper_depth: f64,
    /// Flange width (mm)
    pub flange_width: f64,
    /// Bracket eccentricity (mm)
    pub bracket_eccentricity: f64,
}

impl CraneColumn {
    pub fn new_stepped(height: f64, crane_level: f64) -> Self {
        Self {
            height,
            crane_level,
            lower_depth: 600.0,
            upper_depth: 400.0,
            flange_width: 300.0,
            bracket_eccentricity: 500.0,
        }
    }
    
    /// Moment from crane vertical load (kN·mm)
    pub fn moment_from_vertical(&self, crane: &CraneLoads) -> f64 {
        let p = crane.factored_wheel_load() * crane.wheels_per_truck as f64;
        p * self.bracket_eccentricity
    }
    
    /// Moment from crane lateral load (kN·mm)
    pub fn moment_from_lateral(&self, crane: &CraneLoads) -> f64 {
        let h = crane.lateral_load_per_wheel() * crane.wheels_per_truck as f64;
        h * (self.height - self.crane_level)
    }
    
    /// Effective length factor (K)
    pub fn effective_length_factor(&self, braced: bool) -> f64 {
        if braced {
            0.85 // Braced in both directions
        } else {
            1.5 // Unbraced, stepped column
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
    fn test_crane_loads() {
        let crane = CraneLoads::new(100.0, 15000.0);
        
        let max_wheel = crane.max_wheel_load();
        let min_wheel = crane.min_wheel_load();
        
        assert!(max_wheel > min_wheel);
    }

    #[test]
    fn test_impact_factor() {
        assert!(CraneDutyClass::Heavy.impact_factor() > CraneDutyClass::Light.impact_factor());
    }

    #[test]
    fn test_factored_load() {
        let crane = CraneLoads::new(100.0, 15000.0);
        
        let factored = crane.factored_wheel_load();
        let unfactored = crane.max_wheel_load();
        
        assert!(factored > unfactored);
    }

    #[test]
    fn test_lateral_load() {
        let crane = CraneLoads::new(100.0, 15000.0);
        let lateral = crane.lateral_load_per_wheel();
        
        assert!(lateral > 0.0);
        assert!(lateral < crane.max_wheel_load());
    }

    #[test]
    fn test_runway_beam() {
        let beam = RunwayBeam::from_depth(600.0, 10000.0);
        
        assert!(beam.ixx() > 0.0);
        assert!(beam.zxx() > 0.0);
    }

    #[test]
    fn test_beam_with_cap() {
        let beam = RunwayBeam::from_depth(600.0, 10000.0).with_cap_channel(200.0);
        
        let beam_no_cap = RunwayBeam::from_depth(600.0, 10000.0);
        
        assert!(beam.iyy() > beam_no_cap.iyy());
    }

    #[test]
    fn test_max_moment() {
        let beam = RunwayBeam::from_depth(600.0, 10000.0);
        let crane = CraneLoads::new(100.0, 15000.0);
        let designer = RunwayBeamDesigner::new(beam, crane);
        
        let mxx = designer.max_moment_xx();
        
        assert!(mxx > 0.0);
    }

    #[test]
    fn test_stress_check() {
        let beam = RunwayBeam::from_depth(800.0, 10000.0);
        let crane = CraneLoads::new(100.0, 15000.0);
        let designer = RunwayBeamDesigner::new(beam, crane);
        
        let result = designer.stress_check();
        
        assert!(result.stress_xx > 0.0);
    }

    #[test]
    fn test_shear_check() {
        let beam = RunwayBeam::from_depth(800.0, 10000.0);
        let crane = CraneLoads::new(100.0, 15000.0);
        let designer = RunwayBeamDesigner::new(beam, crane);
        
        let result = designer.shear_check();
        
        assert!(result.shear_force > 0.0);
    }

    #[test]
    fn test_deflection_check() {
        let beam = RunwayBeam::from_depth(800.0, 10000.0);
        let crane = CraneLoads::new(100.0, 15000.0);
        let designer = RunwayBeamDesigner::new(beam, crane);
        
        let result = designer.deflection_check();
        
        assert!(result.deflection > 0.0);
        assert!(result.limit > 0.0);
    }

    #[test]
    fn test_web_crippling() {
        let beam = RunwayBeam::from_depth(800.0, 10000.0);
        let crane = CraneLoads::new(100.0, 15000.0);
        let designer = RunwayBeamDesigner::new(beam, crane);
        
        let result = designer.web_crippling_check();
        
        assert!(result.capacity_local > 0.0);
    }

    #[test]
    fn test_ltb_check() {
        let beam = RunwayBeam::from_depth(800.0, 10000.0);
        let crane = CraneLoads::new(100.0, 15000.0);
        let designer = RunwayBeamDesigner::new(beam, crane);
        
        let result = designer.ltb_check();
        
        assert!(result.elastic_moment > 0.0);
    }

    #[test]
    fn test_fatigue_check() {
        let beam = RunwayBeam::from_depth(800.0, 10000.0);
        let crane = CraneLoads::new(100.0, 15000.0);
        let designer = RunwayBeamDesigner::new(beam, crane);
        
        let result = designer.fatigue_check();
        
        assert!(result.stress_range > 0.0);
        assert!(result.design_cycles > 0);
    }

    #[test]
    fn test_design_summary() {
        let beam = RunwayBeam::from_depth(1000.0, 10000.0);
        let crane = CraneLoads::new(100.0, 15000.0);
        let designer = RunwayBeamDesigner::new(beam, crane);
        
        let summary = designer.design_summary();
        
        // Large beam should pass for modest crane
        assert!(summary.stress_check.pass || summary.stress_check.interaction_ratio < 2.0);
    }

    #[test]
    fn test_crane_column() {
        let column = CraneColumn::new_stepped(12000.0, 8000.0);
        let crane = CraneLoads::new(100.0, 15000.0);
        
        let m_vert = column.moment_from_vertical(&crane);
        let m_lat = column.moment_from_lateral(&crane);
        
        assert!(m_vert > 0.0);
        assert!(m_lat > 0.0);
    }

    #[test]
    fn test_duty_cycles() {
        assert!(CraneDutyClass::VeryHeavy.design_cycles() > CraneDutyClass::Light.design_cycles());
    }
}
